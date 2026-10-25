#!/usr/bin/env python3
"""Render an approved edit plan (Stage D): ordered clips, face-tracked framing with
punch-ins, phrase captions, pop-ups, music with ducking, and synced sound effects.

    python3 vplan.py work/plan.json -o final.mp4 [--preview-stills DIR]

The plan is the Stage B EDL made executable; see examples/plan.example.json.
Reuses vedit.py for the transcript, review corrections and caption timing.
"""
import argparse
import json
import os
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import vedit  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
FACE_MODEL = os.path.join(HERE, "assets/models/face_detection_yunet_2023mar.onnx")
EMOJI_FONT = "/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf"


def hex_to_ass(c, alpha=0):
    c = c.lstrip("#")
    return f"&H{alpha:02X}{c[4:6]}{c[2:4]}{c[0:2]}".upper()


# ---------------------------------------------------------------- face tracking
def track_faces(src, meta, cache, fps=4):
    """Largest face per sampled frame -> [(t, cx, top, h)] in 0..1 frame units."""
    if os.path.exists(cache):
        with open(cache) as f:
            return json.load(f)
    import cv2
    w, h = 540, round(540 * meta["h"] / meta["w"] / 2) * 2
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-vf", f"fps={fps},scale={w}:{h}",
                          "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], capture_output=True, check=True).stdout
    frames = np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3)
    det = cv2.FaceDetectorYN.create(FACE_MODEL, "", (w, h), 0.6)
    out = []
    for i, fr in enumerate(frames):
        _, faces = det.detect(fr)
        if faces is not None:
            x, y, fw, fh = max(faces, key=lambda r: r[2] * r[3])[:4]
            out.append([i / fps, float((x + fw / 2) / w), float(y / h), float(fh / h)])
    with open(cache, "w") as f:
        json.dump(out, f)
    return out


def clip_face(faces, s, e):
    pts = [f for f in faces if s - 0.25 <= f[0] <= e + 0.25]
    if not pts:
        return None
    a = np.array(pts)
    return {"cx": float(np.median(a[:, 1])), "cx_min": float(a[:, 1].min()), "cx_max": float(a[:, 1].max()),
            "top": float(np.median(a[:, 2])), "h": float(np.median(a[:, 3]))}


# ---------------------------------------------------------------- pop-up images
def render_popup(pu, path, style, W, H):
    """kind "box": accent box with text + emoji; "glow": neon text with a coloured
    glow and no box; "image": product sticker (PNG with alpha), height as a fraction of H."""
    kind = pu.get("kind", "box")
    if kind == "image":
        return render_sticker(pu, path, H)
    if kind == "glow":
        return render_glow(pu, path, style, W)
    if kind == "price":
        return render_price(pu, path, style, W)
    return render_box(pu.get("text", ""), pu.get("emoji", ""), path, style, W)


def hex_rgb(c):
    c = c.lstrip("#")
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


def render_sticker(pu, path, H):
    from PIL import Image, ImageFilter
    im = Image.open(pu["image"]).convert("RGBA")
    h = round(H * pu.get("height", 0.3))
    im = im.resize((round(im.width * h / im.height), h), Image.LANCZOS)
    if pu.get("rotate"):
        im = im.rotate(pu["rotate"], resample=Image.BICUBIC, expand=True)
    pad = 30
    out = Image.new("RGBA", (im.width + 2 * pad, im.height + 2 * pad), (0, 0, 0, 0))
    sh = Image.new("RGBA", out.size, (0, 0, 0, 0))
    sh.paste((0, 0, 0, 110), (pad + 8, pad + 14), im.split()[3])  # soft drop shadow
    out.alpha_composite(sh.filter(ImageFilter.GaussianBlur(12)))
    out.alpha_composite(im, (pad, pad))
    out.save(path)
    return out.size


def render_glow(pu, path, style, W):
    from PIL import Image, ImageDraw, ImageFilter, ImageFont
    size = round(W * pu.get("size", style.get("popup_size", 0.085)))
    font = ImageFont.truetype(style["font_file"], size)
    text = pu["text"]
    l, t, r, b = font.getbbox(text, direction="rtl", features=["-liga"])
    pad = round(size * 0.6)
    cw, ch = r - l + 2 * pad, b - t + 2 * pad
    em = None
    if pu.get("emoji"):
        ef = ImageFont.truetype(EMOJI_FONT, 109)
        em = Image.new("RGBA", (140 * len(pu["emoji"]), 128), (0, 0, 0, 0))
        ImageDraw.Draw(em).text((0, 0), pu["emoji"], font=ef, embedded_color=True)
        em = em.crop(em.getbbox())
        em = em.resize((round(em.width * size * 1.05 / em.height), round(size * 1.05)), Image.LANCZOS)
        cw += em.width + round(size * 0.2)
    fill = hex_rgb(pu.get("color", style.get("glow_text", "#FFFFFF")))
    glow = hex_rgb(pu.get("glow", style.get("glow_color", "#1ED37A")))
    x0 = pad + (em.width + round(size * 0.2) if em else 0)

    def layer(colour, alpha=255):
        im = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        ImageDraw.Draw(im).text((x0 - l, pad - t), text, font=font, fill=colour + (alpha,), direction="rtl",
                                features=["-liga"])
        return im
    out = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    shadow = layer((0, 0, 0), 150).filter(ImageFilter.GaussianBlur(size * 0.08))
    out.alpha_composite(shadow, (0, round(size * 0.05)))
    g = layer(glow).filter(ImageFilter.GaussianBlur(size * 0.16))
    for _ in range(3):  # stack the blur for a dense neon halo
        out.alpha_composite(g)
    out.alpha_composite(layer(fill))
    if em:
        out.alpha_composite(em, (pad, (ch - em.height) // 2))
    out.save(path)
    return out.size


def render_price(pu, path, style, W):
    """Accent card: old price struck through in red above the new price (+ emoji)."""
    from PIL import Image, ImageDraw, ImageFont
    big = round(W * style.get("popup_size", 0.085) * 1.25)
    small = round(big * 0.55)
    fb, fs_ = ImageFont.truetype(style["font_file"], big), ImageFont.truetype(style["font_file"], small)
    old_t, new_t = pu["old"], pu["new"]
    lo = fs_.getbbox(old_t, direction="rtl", features=["-liga"])
    ln = fb.getbbox(new_t, direction="rtl", features=["-liga"])
    em = None
    if pu.get("emoji"):
        ef = ImageFont.truetype(EMOJI_FONT, 109)
        em = Image.new("RGBA", (140 * len(pu["emoji"]), 128), (0, 0, 0, 0))
        ImageDraw.Draw(em).text((0, 0), pu["emoji"], font=ef, embedded_color=True)
        em = em.crop(em.getbbox())
        em = em.resize((round(em.width * big / em.height), big), Image.LANCZOS)
    gap = round(big * 0.2)
    new_w = ln[2] - ln[0] + (em.width + gap if em else 0)
    pad_x, pad_y, line_gap = round(big * 0.4), round(big * 0.25), round(big * 0.12)
    bw = max(lo[2] - lo[0], new_w) + 2 * pad_x
    bh = (lo[3] - lo[1]) + line_gap + (ln[3] - ln[1]) + 2 * pad_y
    img = Image.new("RGBA", (bw + 16, bh + 16), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rgb = hex_rgb(style["accent"])
    d.rounded_rectangle((10, 12, bw + 10, bh + 12), radius=round(bh * 0.18), fill=(0, 0, 0, 90))
    d.rounded_rectangle((4, 4, bw + 4, bh + 4), radius=round(bh * 0.18), fill=rgb + (255,))
    # old price, centred, dimmed, with a red strike
    ox = 4 + (bw - (lo[2] - lo[0])) // 2 - lo[0]
    oy = 4 + pad_y - lo[1]
    d.text((ox, oy), old_t, font=fs_, fill=(255, 255, 255, 170), direction="rtl", features=["-liga"])
    sy = 4 + pad_y + (lo[3] - lo[1]) // 2
    d.line((ox + lo[0] - 6, sy + 4, ox + lo[2] + 6, sy - 4), fill=(255, 70, 85, 255), width=max(4, small // 9))
    # new price (+ emoji on the left, i.e. the end of the RTL line)
    ny = 4 + pad_y + (lo[3] - lo[1]) + line_gap
    nx = 4 + (bw - new_w) // 2
    if em:
        img.alpha_composite(em, (nx, ny + ((ln[3] - ln[1]) - em.height) // 2))
        nx += em.width + gap
    d.text((nx - ln[0], ny - ln[1]), new_t, font=fb, fill=(255, 255, 255, 255), direction="rtl", features=["-liga"])
    img.save(path)
    return img.size


def render_box(text, emoji, path, style, W):
    from PIL import Image, ImageDraw, ImageFont
    size = round(W * style.get("popup_size", 0.085))
    font = ImageFont.truetype(style["font_file"], size)
    pad_x, pad_y = round(size * 0.45), round(size * 0.28)
    tw = th = 0
    if text:
        l, t, r, b = font.getbbox(text, direction="rtl", features=["-liga"])
        tw, th = r - l, b - t
    em = None
    if emoji:
        ef = ImageFont.truetype(EMOJI_FONT, 109)
        em = Image.new("RGBA", (140 * len(emoji), 128), (0, 0, 0, 0))
        ImageDraw.Draw(em).text((0, 0), emoji, font=ef, embedded_color=True)
        em = em.crop(em.getbbox())
        es = round(size * 1.15)
        em = em.resize((round(em.width * es / em.height), es), Image.LANCZOS)
    gap = round(size * 0.25) if (text and em) else 0
    box_w = tw + (em.width if em else 0) + gap + 2 * pad_x
    box_h = max(th, em.height if em else 0) + 2 * pad_y
    img = Image.new("RGBA", (box_w + 16, box_h + 16), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    acc = style["accent"].lstrip("#")
    rgb = tuple(int(acc[i:i + 2], 16) for i in (0, 2, 4))
    d.rounded_rectangle((10, 12, box_w + 10, box_h + 12), radius=round(box_h * 0.3), fill=(0, 0, 0, 90))  # shadow
    d.rounded_rectangle((4, 4, box_w + 4, box_h + 4), radius=round(box_h * 0.3), fill=rgb + (255,))
    x = 4 + pad_x
    if em:  # emoji on the left = end of an RTL line
        img.alpha_composite(em, (x, 4 + (box_h - em.height) // 2))
        x += em.width + gap
    if text:
        l, t, r, b = font.getbbox(text, direction="rtl", features=["-liga"])
        d.text((x - l, 4 + (box_h - th) // 2 - t), text, font=font, fill=(255, 255, 255, 255), direction="rtl",
               features=["-liga"])
    img.save(path)
    return img.size


# ---------------------------------------------------------------- captions
def build_captions(plan, words_by_clip, offsets, W, H):
    st = plan["style"]
    fs = round(W * st.get("caption_size", 0.068))
    y = round(H * st.get("caption_y", 0.70))
    box = hex_to_ass(st["accent"], 0x18)
    hi = hex_to_ass(st.get("highlight", "#9EE6C1"))
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,{st['font']},{fs},&H00FFFFFF,&H00FFFFFF,{box},&H64000000,0,0,0,0,100,100,0,0,3,{round(fs * 0.22)},0,5,80,80,0,-1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    clean_mode = st.get("caption_mode", "boxed") == "clean"
    if clean_mode:
        # no box, hard switch, colour by speaker: interviewer white + soft shadow,
        # interviewee neon text with a blurred glow (reference "vibe 2" colour code)
        ink = hex_to_ass(st.get("interviewee_text", "#C8FFE0"))
        halo = hex_to_ass(st.get("interviewee_glow", "#1ED37A"), 0x30)
        head = head.replace(
            f"Style: Cap,{st['font']},{fs},&H00FFFFFF,&H00FFFFFF,{box},&H64000000,0,0,0,0,100,100,0,0,3,{round(fs * 0.22)},0,5,80,80,0,-1",
            f"Style: CapI,{st['font']},{fs},&H00FFFFFF,&H00FFFFFF,&H70000000,&H80000000,0,0,0,0,100,100,0,0,1,"
            f"{max(2, round(fs * 0.05))},{max(1, round(fs * 0.04))},5,80,80,0,-1\n"
            f"Style: CapA,{st['font']},{fs},{ink},{ink},{halo},&H80000000,0,0,0,0,100,100,0,0,1,"
            f"{max(3, round(fs * 0.09))},{max(1, round(fs * 0.04))},5,80,80,0,-1")
    lines = []
    for ci, words in enumerate(words_by_clip):
        chunks, cur = [], []
        for wd in words:
            if cur and (len(cur) >= 3 or wd["s"] - cur[-1]["e"] > 0.35
                        or sum(len(x["w"]) for x in cur) + len(wd["w"]) > 18):
                chunks.append(cur)
                cur = []
            cur.append(wd)
            if wd["w"].endswith((".", "?", "!", ",")) and len(cur) >= 2:
                chunks.append(cur)
                cur = []
        if cur:
            # fold a stranded single word into the previous caption of the same clip
            if len(cur) == 1 and chunks and len(chunks[-1]) < 4:
                chunks[-1] += cur
            else:
                chunks.append(cur)
        clip_end = offsets[ci] + plan["clips"][ci]["e"] - plan["clips"][ci]["s"]
        if clean_mode:
            sty = "CapA" if plan["clips"][ci].get("speaker") == "interviewee" else "CapI"
            blur = r"{\blur6}" if sty == "CapA" else r"{\blur3}"
            for k, c in enumerate(chunks):
                end = chunks[k + 1][0]["s"] if k + 1 < len(chunks) else clip_end
                txt = " ".join(x["w"].strip(".,").replace("{", "").replace("}", "") for x in c)
                if end - c[0]["s"] >= 0.02:
                    lines.append(f"Dialogue: 0,{vedit.ass_time(c[0]['s'])},{vedit.ass_time(end)},{sty},,0,0,0,,"
                                 f"{{\\an5\\pos({W // 2},{y})}}{blur}{txt}")
            continue
        for k, c in enumerate(chunks):
            start = c[0]["s"]
            end = chunks[k + 1][0]["s"] if k + 1 < len(chunks) else clip_end
            clean = [x["w"].strip(".,").replace("{", "").replace("}", "") for x in c]
            for i, x in enumerate(c):
                s = x["s"] if i else start
                e = c[i + 1]["s"] if i + 1 < len(c) else end
                if e - s < 0.02:
                    continue
                txt = " ".join((r"{\c" + hi + "}" + t + r"{\c&H00FFFFFF&}") if j == i else t
                               for j, t in enumerate(clean))
                pop = r"{\fscx88\fscy88\t(0,90,\fscx100\fscy100)}" if i == 0 else ""
                lines.append(f"Dialogue: 0,{vedit.ass_time(s)},{vedit.ass_time(e)},Cap,,0,0,0,,"
                             f"{{\\an5\\pos({W // 2},{y})}}{pop}{txt}")
    return head + "\n".join(lines) + "\n"


# ---------------------------------------------------------------- render
def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("plan")
    p.add_argument("-o", "--output", default="final.mp4")
    p.add_argument("--preset", default="medium")
    p.add_argument("--crf", type=int, default=19)
    a = p.parse_args()
    with open(a.plan, encoding="utf-8") as f:
        plan = json.load(f)
    work = plan["work"]
    src = plan["source"]
    meta = vedit.probe(src)
    W, H = (meta["w"] // 2) * 2, (meta["h"] // 2) * 2
    st = plan["style"]
    fr = plan.get("framing", {})
    base, face_top = fr.get("base_zoom", 1.0), fr.get("face_top", 0.14)

    # transcript words with review corrections, mapped onto the edited timeline
    with open(os.path.join(work, "transcript.json"), encoding="utf-8") as f:
        tr = json.load(f)
    rv = os.path.join(work, "review.json")
    if os.path.exists(rv):
        with open(rv, encoding="utf-8") as f:
            vedit.apply_review(tr, json.load(f))
    allw = [w for s in tr["segments"] for w in s["words"]]
    clips = plan["clips"]
    audio = vedit_audio(os.path.join(work, "audio16k.wav"))
    # a clip whose start equals the previous clip's end is a sub-shot of the same take
    # (size change mid-sentence): its join keeps the audio continuous - no snap, no fade
    for a_, b_ in zip(clips, clips[1:]):
        b_["joined"] = abs(b_["s"] - a_["e"]) < 1e-3
    if plan.get("snap_cuts", True):
        for k, c in enumerate(clips):
            nxt_joined = k + 1 < len(clips) and clips[k + 1].get("joined")
            snap_clip(c, allw, audio, meta["fps"], start=not c.get("joined"), end=not nxt_joined)
        for a_, b_ in zip(clips, clips[1:]):
            if b_.get("joined"):
                b_["s"] = a_["e"]
    # put every cut on a frame boundary: video trims whole frames while audio trims exact
    # samples, so off-grid cuts drifted lip sync by up to ~46 ms over 25 shots
    fps = meta["fps"]
    for c in clips:
        c["s"], c["e"] = round(round(c["s"] * fps) / fps, 4), round(round(c["e"] * fps) / fps, 4)
    with open(os.path.join(work, "plan_resolved.json"), "w", encoding="utf-8") as f:
        json.dump(plan, f, ensure_ascii=False, indent=1)
    offsets, acc = [], 0.0
    for c in clips:
        offsets.append(acc)
        acc += c["e"] - c["s"]
    total = acc
    words_by_clip = []
    for c, o in zip(clips, offsets):
        ws = [w for w in allw if c["s"] <= (w["s"] + w["e"]) / 2 <= c["e"]]
        words_by_clip.append([{"w": w["w"], "s": o + max(w["s"], c["s"]) - c["s"],
                               "e": o + min(w["e"], c["e"]) - c["s"]} for w in ws])

    def out_t(src_t):  # source time -> output time (first clip containing it)
        for c, o in zip(clips, offsets):
            if c["s"] - 0.01 <= src_t <= c["e"] + 0.01:
                return o + src_t - c["s"]
        for c, o in zip(clips, offsets):  # a cue just outside a snapped cut sticks to that edge
            if c["s"] - 0.15 <= src_t <= c["e"] + 0.15:
                return o + min(max(src_t, c["s"]), c["e"]) - c["s"]
        raise ValueError(f"source time {src_t} is not inside any clip")

    faces = track_faces(src, meta, os.path.join(work, "faces.json"))

    inputs = ["-i", src]
    vparts, aparts, labels = [], [], []
    report = []
    for i, c in enumerate(clips):
        d = c["e"] - c["s"]
        fc = clip_face(faces, c["s"], c["e"]) or {"cx": 0.5, "cx_min": 0.5, "cx_max": 0.5, "top": 0.25, "h": 0.2}
        z0 = base * c.get("zoom", 1.0)
        z1 = base * c.get("punch_zoom", c.get("zoom", 1.0))
        tp = (c["punch_at"] - c["s"]) if "punch_at" in c else 0.0
        drift = c.get("drift", plan.get("framing", {}).get("drift", 0.0))
        if z1 != z0 or drift:
            prog = f"min(max((t-{tp:.3f})/0.12,0),1)"
            z = f"({z0:.4f}+({z1 - z0:.4f})*(3*pow({prog},2)-2*pow({prog},3)))*(1+{drift:.4f}*t/{d:.3f})"
            scale = f"scale=w='2*trunc({W}*{z}/2)':h='2*trunc({H}*{z}/2)':eval=frame:flags=bicubic"
        else:
            scale = f"scale={2 * round(W * z0 / 2)}:{2 * round(H * z0 / 2)}:flags=bicubic"
        # keep the face centred horizontally and its top at face_top of the output height
        x = f"min(max({fc['cx']:.4f}*iw-{W / 2},0),iw-{W})"
        y = f"min(max({fc['top']:.4f}*ih-{face_top * H:.1f},0),ih-{H})"
        vparts.append(f"[0:v]trim=start={c['s']:.3f}:end={c['e']:.3f},setpts=PTS-STARTPTS,{scale},"
                      f"crop={W}:{H}:x='{x}':y='{y}',setsar=1,fps={meta['fps']:.5f}[v{i}]")
        # level each clip's dialogue to a common RMS so interviewer / interviewee match
        g0 = i  # level the whole take (run of joined sub-shots) with one gain, so joins stay seamless
        while g0 > 0 and clips[g0].get("joined"):
            g0 -= 1
        g1 = i
        while g1 + 1 < len(clips) and clips[g1 + 1].get("joined"):
            g1 += 1
        seg = audio[int(clips[g0]["s"] * 16000):int(clips[g1]["e"] * 16000)]
        rms = 20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-9)
        gain = float(np.clip(st.get("dialog_rms", -20) - rms, -6, 9))
        # 15 ms fades on clean cuts; 40 ms where the cut had to land inside continuous speech
        def edge_fade(t):
            lvl = 20 * np.log10(np.sqrt(np.mean(audio[int(t * 16000) - 160:int(t * 16000) + 160] ** 2)) + 1e-9)
            return min(0.04 if lvl > rms - 12 else 0.015, d / 4)
        fi = 0.0 if c.get("joined") else edge_fade(c["s"])
        fo = 0.0 if (i + 1 < len(clips) and clips[i + 1].get("joined")) else edge_fade(c["e"])
        aparts.append(f"[0:a]atrim=start={c['s']:.3f}:end={c['e']:.3f},asetpts=PTS-STARTPTS,volume={gain:.2f}dB"
                      + (f",afade=t=in:d={fi:.3f}" if fi else "") + (f",afade=t=out:st={d - fo:.3f}:d={fo:.3f}" if fo else "")
                      + f"[a{i}]")
        labels.append(f"[v{i}][a{i}]")
        # framing check: is the face fully inside the crop at the tightest zoom?
        zt = max(z0, z1)
        cw = 1 / zt
        x0 = min(max(fc["cx"] - cw / 2, 0), 1 - cw)
        inside = x0 <= fc["cx_min"] - fc["h"] * 0.3 and fc["cx_max"] + fc["h"] * 0.3 <= x0 + cw
        report.append(f"clip {i + 1:2d} {c['s']:7.2f}-{c['e']:7.2f} ({d:4.2f}s, snapped "
                      f"{c['s'] - c.get('s_orig', c['s']):+.2f}/{c['e'] - c.get('e_orig', c['e']):+.2f}) zoom {z0:.2f}->{z1:.2f} "
                      f"face x {fc['cx']:.2f} [{fc['cx_min']:.2f}-{fc['cx_max']:.2f}] "
                      f"{'ok' if inside else 'FACE MAY TOUCH EDGE'}; gain {gain:+.1f} dB")
    graph = vparts + aparts + [f"{''.join(labels)}concat=n={len(clips)}:v=1:a=1[cv][dia]"]

    # captions + pop-ups
    ass = os.path.abspath(os.path.join(work, "plan_subs.ass"))
    with open(ass, "w", encoding="utf-8") as f:
        f.write(build_captions(plan, words_by_clip, offsets, W, H))
    fontsdir = os.path.dirname(os.path.abspath(st["font_file"]))
    vlast = "cv"
    graph.append(f"[{vlast}]ass='{ass}':fontsdir='{fontsdir}'[vs]")
    vlast = "vs"
    n_in = 1
    for k, pu in enumerate(plan.get("popups", [])):
        png = os.path.join(work, f"popup_{k}.png")
        pw, ph = render_popup(pu, png, st, W, H)
        pw, ph = 2 * round(pw * 1.13 / 2), 2 * round(ph * 1.13 / 2)  # room for the overshoot
        t0 = out_t(pu["at"])
        dur = pu.get("dur", 1.2)
        inputs += ["-loop", "1", "-t", f"{dur:.3f}", "-i", png]
        # pop: scale 0 -> 112% -> 100% in 0.2 s, then hold; quick fade out at the end
        s_expr = "if(lt(t,0.12),1.12*t/0.12,if(lt(t,0.2),1.12-0.12*(t-0.12)/0.08,1))"
        # constant canvas (overlay can't take frames that change size)
        graph.append(f"[{n_in}:v]format=rgba,scale=w='max(2,iw*{s_expr})':h='max(2,ih*{s_expr})':eval=frame,"
                     f"pad=w={pw}:h={ph}:x='(ow-iw)/2':y='(oh-ih)/2':eval=frame:color=0x00000000,"
                     f"fade=t=out:st={dur - 0.12:.3f}:d=0.12:alpha=1,setpts=PTS+{t0:.3f}/TB[p{k}]")
        py = round(H * pu.get("y", st.get("popup_y", 0.53)))
        px = f"{round(W * pu['x'])}-w/2" if "x" in pu else "(W-w)/2"
        graph.append(f"[{vlast}][p{k}]overlay=x='{px}':y='{py}-h/2':eof_action=pass:"
                     f"enable='between(t,{t0:.3f},{t0 + dur:.3f})'[vp{k}]")
        vlast = f"vp{k}"
        n_in += 1

    for k, fl in enumerate(plan.get("flashes", [])):
        t0, dur = out_t(fl["at"]), fl.get("dur", 0.32)
        graph.append(f"color=c=white:s={W}x{H}:d={dur:.3f}:r={meta['fps']:.5f},format=rgba,"
                     f"fade=t=in:st=0:d=0.05:alpha=1,fade=t=out:st=0.06:d={dur - 0.06:.3f}:alpha=1,"
                     f"setpts=PTS+{max(0, t0 - 0.05):.3f}/TB[fl{k}]")
        graph.append(f"[{vlast}][fl{k}]overlay=eof_action=pass:enable='between(t,{max(0, t0 - 0.05):.3f},"
                     f"{t0 - 0.05 + dur:.3f})'[vf{k}]")
        vlast = f"vf{k}"
    # dialogue clean-up
    graph.append("[dia]highpass=f=80,afftdn=nf=-30,acompressor=threshold=-20dB:ratio=3:attack=5:release=120,"
                  "asplit=2[diam][diak]")
    mix = ["[diam]"]
    # music: sections of the track placed on the output timeline, ducked under speech
    mu = plan.get("music")
    if mu:
        inputs += ["-i", mu["file"]]
        mi = n_in
        n_in += 1
        sects = mu["sections"]
        graph.append(f"[{mi}:a]asplit={len(sects)}" + "".join(f"[ms{j}]" for j in range(len(sects))))
        mlabels = []
        for j, sc in enumerate(sects):
            # section spans source times out_from..out_until on the edited timeline;
            # sync {"src": t, "track": T} makes track time T land exactly on source time t
            o0 = out_t(sc["out_from"]) if "out_from" in sc else 0.0
            o1 = out_t(sc["out_until"]) if "out_until" in sc else total
            ts = sc["sync"]["track"] - (out_t(sc["sync"]["src"]) - o0) if "sync" in sc else sc.get("track_start", 0.0)
            ts_out = o0
            if ts < 0:
                ts_out -= ts
                ts = 0.0
            dd = o1 - ts_out
            fi, fo = sc.get("fade_in", 0.02), sc.get("fade_out", 0.05)
            graph.append(f"[ms{j}]atrim=start={ts:.3f}:duration={dd:.3f},asetpts=PTS-STARTPTS,"
                         f"afade=t=in:d={fi:.3f},afade=t=out:st={max(0, dd - fo):.3f}:d={fo:.3f},"
                         f"volume={sc.get('gain_db', mu.get('gain_db', -14)):.1f}dB,"
                         f"adelay={int(ts_out * 1000)}:all=1[mm{j}]")
            mlabels.append(f"[mm{j}]")
        graph.append(f"{''.join(mlabels)}amix=inputs={len(mlabels)}:normalize=0:duration=longest,"
                     f"apad=whole_dur={total:.3f}[mus]")
        graph.append(f"[mus][diak]sidechaincompress=threshold={mu.get('duck_threshold', 0.03)}:"
                     f"ratio={mu.get('duck_ratio', 6)}:attack=15:release=350:makeup=1[mduck]")
        mix.append("[mduck]")
    # sound effects, aligned on their loudest point (impacts) or their start
    for k, fx in enumerate(plan.get("sfx", [])):
        path = os.path.join(plan["sfx_dir"], fx["name"] + ".mp3")
        inputs += ["-i", path]
        dur = fx.get("dur", 3.0)
        cue = out_t(fx["at"]) + fx.get("offset", 0.0)
        if fx.get("align") == "end":  # risers: play the last `dur` seconds, finishing on the cue
            trim = max(0.0, audio_dur(path) - dur)
            t0 = cue - dur
        elif fx.get("align") == "peak":  # loudest point on the cue (impacts, coins, risers)
            pk = sfx_peak(path)
            trim = max(0.0, pk - fx["lead"]) if "lead" in fx else 0.0  # lead: start only this long before
            t0 = cue - (pk - trim)
        else:  # "start": begins on the cue
            trim, t0 = 0.0, cue
        if t0 < 0:
            trim, t0 = trim - t0, 0.0
        graph.append(f"[{n_in}:a]aresample=48000,atrim=start={trim:.3f}:duration={dur:.3f},asetpts=PTS-STARTPTS,"
                     f"afade=t=out:st={max(0, dur - 0.15):.3f}:d=0.15,volume={fx.get('gain_db', -10):.1f}dB,"
                     f"adelay={int(t0 * 1000)}:all=1[fx{k}]")
        mix.append(f"[fx{k}]")
        n_in += 1
    graph.append(f"{''.join(mix)}amix=inputs={len(mix)}:normalize=0:duration=first,"
                 f"loudnorm=I={st.get('lufs', -14)}:TP=-1.5:LRA=11,aresample=48000[aout]")
    gpath = os.path.join(work, "plan_filter.txt")
    with open(gpath, "w", encoding="utf-8") as f:
        f.write(";\n".join(graph))
    print("\n".join(report))
    print(f"edited duration {total:.2f}s, {len(clips)} clips, {len(plan.get('popups', []))} pop-ups, "
          f"{len(plan.get('sfx', []))} sfx")
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-v", "warning", "-stats", *inputs,
                    "-filter_complex_script", gpath, "-map", f"[{vlast}]", "-map", "[aout]",
                    "-c:v", "libx264", "-preset", a.preset, "-crf", str(a.crf), "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart",
                    "-t", f"{total:.3f}", a.output], check=True)
    print(f"wrote {a.output}")


def snap_clip(c, words, audio, fps, sr=16000, start=True, end=True):
    """Move each cut to the quietest 10 ms between the kept word and its neighbour.
    Whisper word times drift 50-100 ms; cutting on them left fragments of the
    neighbouring word ("כלומר" -> "ר") or clipped onsets ("ש" of "שתים")."""
    inside = [w for w in words if c["s"] <= (w["s"] + w["e"]) / 2 <= c["e"]]
    if not inside:
        return
    first, last = inside[0], inside[-1]
    prev_e = max([w["e"] for w in words if w["e"] <= first["s"] + 0.01 and w is not first], default=first["s"] - 0.3)
    next_s = min([w["s"] for w in words if w["s"] >= last["e"] - 0.01 and w is not last], default=last["e"] + 0.3)
    hop = sr // 100
    env = np.sqrt(np.convolve(audio ** 2, np.ones(hop) / hop, "same"))

    def quietest(lo, hi):
        # candidates are frame boundaries only, so the cut is both quiet and frame-exact
        ts = np.arange(np.ceil(lo * fps), np.floor(hi * fps) + 1) / fps
        if len(ts) == 0:
            return round((lo + hi) / 2 * fps) / fps
        lv = [env[min(len(env) - 1, max(0, int(t * sr)))] for t in ts]
        return float(ts[int(np.argmin(lv))])

    c["s_orig"], c["e_orig"] = c["s"], c["e"]
    if start:
        c["s"] = round(quietest(max(prev_e - 0.03, first["s"] - 0.25), first["s"] + 0.04), 4)
    if end:
        c["e"] = round(quietest(last["e"] - 0.04, min(next_s + 0.03, last["e"] + 0.25)), 4)


def vedit_audio(path):
    import wave
    with wave.open(path, "rb") as f:
        return np.frombuffer(f.readframes(f.getnframes()), np.int16).astype(np.float32) / 32768.0


def decode(path, sr=22050):
    return np.frombuffer(subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(sr),
                                         "-f", "f32le", "-"], capture_output=True, check=True).stdout, np.float32)


def sfx_peak(path):
    a = decode(path)
    env = np.convolve(np.abs(a), np.ones(441) / 441, "same")
    return float(np.argmax(env) / 22050)


def audio_dur(path):
    return len(decode(path)) / 22050


if __name__ == "__main__":
    main()
