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


SEG_MODEL = os.path.join(HERE, "assets/models/human_segmentation_pphumanseg_2023mar.onnx")


def body_offset(src, meta, s, e, faces, cache):
    """Median horizontal offset of the torso (person mask, neck to hips) from the face
    centre within a clip, from three sampled frames (OpenCV PP-HumanSeg, Apache-2.0)."""
    import cv2
    store = json.load(open(cache)) if os.path.exists(cache) else {}
    key = f"{os.path.basename(src)}:{s:.3f}-{e:.3f}"
    if key in store:
        return store[key]
    net = cv2.dnn.readNet(SEG_MODEL)
    offs = []
    for t in np.linspace(s + 0.1, max(s + 0.1, e - 0.1), 3):
        raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", src, "-frames:v", "1", "-vf", "scale=360:640",
                              "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
        if len(raw) < 360 * 640 * 3:
            continue
        img = np.frombuffer(raw, np.uint8).reshape(640, 360, 3)
        blob = ((cv2.resize(img, (192, 192)).astype(np.float32) / 255.0 - 0.5) / 0.5).transpose(2, 0, 1)[None]
        net.setInput(blob)
        out = net.forward()[0]
        mask = cv2.resize((out[1] > out[0]).astype(np.uint8), (360, 640))
        near = [f for f in faces if abs(f[0] - t) <= 0.5]
        if not near:
            continue
        _, fcx, ftop, fh = min(near, key=lambda f: abs(f[0] - t))
        y0, y1 = int((ftop + fh) * 640), int(min(1.0, ftop + fh * 4) * 640)
        xs = np.nonzero(mask[y0:y1])[1]
        if len(xs):
            offs.append(xs.mean() / 360 - fcx)
    val = float(np.median(offs)) if offs else 0.0
    store[key] = val
    json.dump(store, open(cache, "w"))
    return val


def face_track_expr(faces, s, e, fallback):
    """Piecewise-linear ffmpeg expression of the smoothed face x-centre over clip time t."""
    pts = [(f[0] - s, f[1]) for f in faces if s - 0.3 <= f[0] <= e + 0.3]
    if len(pts) < 3:
        return f"{fallback:.4f}"
    t = np.array([p[0] for p in pts])
    x = np.array([p[1] for p in pts])
    # median-of-3 then exponential smoothing (forward + backward, no lag) so the frame glides
    xm = np.array([np.median(x[max(0, i - 1):i + 2]) for i in range(len(x))])
    a = 0.35
    fw = xm.copy()
    for i in range(1, len(fw)):
        fw[i] = a * xm[i] + (1 - a) * fw[i - 1]
    bw = fw.copy()
    for i in range(len(bw) - 2, -1, -1):
        bw[i] = a * fw[i] + (1 - a) * bw[i + 1]
    keys = list(zip(t, bw))
    expr = f"{keys[-1][1]:.4f}"
    for (t0, x0), (t1, x1) in reversed(list(zip(keys, keys[1:]))):
        expr = (f"if(lt(t,{t1:.3f}),{x0:.4f}+({x1 - x0:.4f})*(t-{t0:.3f})/{max(t1 - t0, 1e-3):.3f},{expr})")
    return f"if(lt(t,{keys[0][0]:.3f}),{keys[0][1]:.4f},{expr})"


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


def caption_logo_png(src, size, out):
    """Logo scaled to caption size with the captions' soft drop shadow, on a padded canvas."""
    from PIL import Image, ImageFilter
    lg = Image.open(src).convert("RGBA")
    lg = lg.resize((size, round(size * lg.height / lg.width)), Image.LANCZOS)
    pad = max(4, size // 8)
    can = Image.new("RGBA", (lg.width + 2 * pad, lg.height + 2 * pad), (0, 0, 0, 0))
    sh = Image.new("RGBA", can.size, (0, 0, 0, 0))
    sh.paste((0, 0, 0, 110), (pad, pad + max(2, size // 25)), lg.split()[3])
    can = Image.alpha_composite(can, sh.filter(ImageFilter.GaussianBlur(size / 30)))
    can.alpha_composite(lg, (pad, pad))
    can.save(out)


# ---------------------------------------------------------------- captions
def split_lines(words, font, max_w):
    """One line if it fits, else the two-line split with the narrowest wider line."""
    text = " ".join(words)
    if len(words) < 2 or font.getlength(text) <= max_w:
        return [words]
    k = min(range(1, len(words)), key=lambda k: max(font.getlength(" ".join(words[:k])),
                                                    font.getlength(" ".join(words[k:]))))
    return [words[:k], words[k:]]


def logo_segments(row, logos):
    """Split a caption row into [("t", text) | ("logo", file)] when a word is a brand with a logo
    ("Nomi", "Nomi.", "ל-Nomi" -> "ל-" + logo). None when the row has no brand word."""
    segs, cur, hit = [], [], False
    for wd in row:
        bare = wd.rstrip(".,?!")
        brand = next((b for b in logos if bare.endswith(b)), None)
        if brand is None:
            cur.append(wd)
            continue
        hit = True
        pre = bare[: -len(brand)]
        if pre:
            cur.append(pre)
        if cur:
            segs.append(("t", " ".join(cur)))
        cur = []
        segs.append(("logo", logos[brand]))
    if cur:
        segs.append(("t", " ".join(cur)))
    return segs if hit else None


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
    mode = st.get("caption_mode", "boxed")
    clean_mode = mode == "clean"
    if mode == "plain":  # white, no stroke, no highlight: a soft drop shadow only (client reference)
        head = head.replace(
            f"Style: Cap,{st['font']},{fs},&H00FFFFFF,&H00FFFFFF,{box},&H64000000,0,0,0,0,100,100,0,0,3,{round(fs * 0.22)},0,5,80,80,0,-1",
            f"Style: Cap,{st['font']},{fs},&H00FFFFFF,&H00FFFFFF,&H00000000,&H90000000,0,0,0,0,100,100,0,0,1,"
            f"0,{max(2, round(fs * 0.05))},5,90,90,0,-1")
        hi_on = hi_off = ""
        from PIL import ImageFont
        plain_font = ImageFont.truetype(st["font_file"], fs)
        # libass scales a font so ascent+descent = font size; Pillow sizes the em. This font's
        # em is 0.7645 of the ASS size (measured: rendered width 642 px = Pillow 853 x 0.76)
        from fontTools.ttLib import TTFont
        tt = TTFont(st["font_file"])
        em = tt["head"].unitsPerEm / (tt["hhea"].ascent - tt["hhea"].descent)
        ass_font = ImageFont.truetype(st["font_file"], max(1, round(fs * em)))
        space = ass_font.getlength(" ")
        logos = st.get("caption_logos", {})  # {"Nomi": "assets/brands/nomi/logo_icon.png"}
        logo_px = round(fs * st.get("caption_logo_size", 0.82))
    if mode == "fill":
        # white words with a solid black stroke; the spoken word's fill turns the accent colour
        ob = max(2, round(fs * st.get("stroke", 0.06)))
        stroke = hex_to_ass(st.get("stroke_color", "#000000"))
        head = head.replace(
            f"Style: Cap,{st['font']},{fs},&H00FFFFFF,&H00FFFFFF,{box},&H64000000,0,0,0,0,100,100,0,0,3,{round(fs * 0.22)},0,5,80,80,0,-1",
            f"Style: Cap,{st['font']},{fs},&H00FFFFFF,&H00FFFFFF,{stroke},&H80000000,0,0,0,0,100,100,0,0,1,"
            f"{ob},{round(ob * st.get('shadow', 0))},5,90,90,0,-1")
        fill = hex_to_ass(st.get("fill_color", st["accent"]))
        pop_pct = st.get("word_pop", 100)  # spoken word slightly larger
        hi_on = r"{\c" + fill + rf"\fscx{pop_pct}\fscy{pop_pct}" + "}"
        hi_off = r"{\c&H00FFFFFF&\fscx100\fscy100}"
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
            if cur and (len(cur) >= st.get("cap_max_words", 3) or wd["s"] - cur[-1]["e"] > 0.35
                        or sum(len(x["w"]) for x in cur) + len(wd["w"]) > st.get("cap_max_chars", 18)):
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
                if mode == "plain":
                    if i:  # one event per caption chunk; no per-word change
                        continue
                    # two balanced lines placed by hand: libass's own line gap (~1.03 x font
                    # size) looked too airy, so `line_spacing` sets the gap between line centres
                    rows = split_lines(clean, plain_font, W - 180)
                    gap = round(fs * st.get("line_spacing", 0.78))
                    for r, row in enumerate(rows):
                        ry = y + round((r - (len(rows) - 1) / 2) * gap)
                        segs = logo_segments(row, logos)
                        if not segs:
                            lines.append(f"Dialogue: 0,{vedit.ass_time(s)},{vedit.ass_time(end)},Cap,,0,0,0,,"
                                         f"{{\\an5\\pos({W // 2},{ry})}}{{\\blur2}}{' '.join(row)}")
                            continue
                        # brand word -> its logo: lay the row out right-to-left by hand, text runs
                        # as separate events, the logo as an image overlay in the gap
                        widths = [logo_px if k == "logo" else ass_font.getlength(v) for k, v in segs]
                        seps = [space * (0.25 if k == "t" and v.endswith("-") else 1) for k, v in segs[:-1]]
                        xr = W / 2 + (sum(widths) + sum(seps)) / 2
                        for j, ((k, v), wd) in enumerate(zip(segs, widths)):
                            cx = round(xr - wd / 2)
                            if k == "logo":
                                plan.setdefault("_caption_logos", []).append(
                                    {"file": v, "t0": s, "t1": end, "x": cx, "y": ry, "size": logo_px})
                            else:
                                lines.append(f"Dialogue: 0,{vedit.ass_time(s)},{vedit.ass_time(end)},Cap,,0,0,0,,"
                                             f"{{\\an5\\pos({cx},{ry})}}{{\\blur2}}{v}")
                            xr -= wd + (seps[j] if j < len(seps) else 0)
                    continue
                elif mode == "fill":
                    txt = " ".join((hi_on + t + hi_off) if j == i else t for j, t in enumerate(clean))
                else:
                    txt = " ".join((r"{\c" + hi + "}" + t + r"{\c&H00FFFFFF&}") if j == i else t
                                   for j, t in enumerate(clean))
                pop = r"{\fscx88\fscy88\t(0,90,\fscx100\fscy100)}" if i == 0 and mode != "plain" else ""
                lines.append(f"Dialogue: 0,{vedit.ass_time(s)},{vedit.ass_time(e)},Cap,,0,0,0,,"
                             f"{{\\an5\\pos({W // 2},{y})}}{pop}{txt}")
    # force a right-to-left base direction: libass takes it from the first strong
    # character, so a caption starting with a Latin brand ("Nomi היא...") was laid out LTR
    # and the brand jumped to the wrong side. RLM after the override block fixes it.
    rtl = []
    for ln in lines:
        body_at = ln.find(",,0,0,0,,") + len(",,0,0,0,,")
        rest = ln[body_at:]
        lead = ""
        while rest.startswith("{"):  # keep leading override blocks first
            j = rest.find("}") + 1
            lead, rest = lead + rest[:j], rest[j:]
        rtl.append(ln[:body_at] + lead + ("\u200f" if any("\u0590" <= ch <= "\u05ff" for ch in rest) else "") + rest)
    lines = rtl
    return head + "\n".join(lines) + "\n"


# ---------------------------------------------------------------- render
def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("plan")
    p.add_argument("-o", "--output", default="final.mp4")
    p.add_argument("--preset", default="medium")
    p.add_argument("--crf", type=int, default=19)
    p.add_argument("--dry", action="store_true",
                   help="resolve cuts and print every word's output time (for timing animations), no render")
    p.add_argument("--draft", action="store_true", help="fast preview: half resolution, ultrafast encode")
    a = p.parse_args()
    with open(a.plan, encoding="utf-8") as f:
        plan = json.load(f)
    work = plan["work"]
    src = normalize_source(plan["source"], work, plan.get("framing", {}).get("roll_deg", 0.0))
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
        ws = [] if c.get("no_captions") else [w for w in allw if c["s"] <= (w["s"] + w["e"]) / 2 <= c["e"]]
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

    if a.dry:
        timeline = [{"w": w["w"], "out": round(w["s"], 2), "src": round(w["s"] - o + c["s"], 2), "clip": i + 1}
                    for i, (c, o, ws) in enumerate(zip(clips, offsets, words_by_clip)) for w in ws]
        with open(os.path.join(work, "timeline.json"), "w", encoding="utf-8") as f:
            json.dump(timeline, f, ensure_ascii=False, indent=0)
        print("\n".join(f"{x['out']:6.2f}  (src {x['src']:7.2f})  {x['w']}" for x in timeline))
        print(f"total {total:.2f} s")
        return

    faces = track_faces(src, meta, os.path.join(work, "faces.json" if src == plan["source"]
                                                 else f"faces_{os.path.basename(src)}.json"))
    body_w = plan.get("framing", {}).get("body_weight", 0.0)

    # one input per clip, opened with an accurate seek: a single input split into N trim
    # branches buffered frames across branches and was OOM-killed on a 7-minute source
    inputs = []
    for c in clips:
        inputs += ["-ss", f"{c['s']:.4f}", "-t", f"{c['e'] - c['s'] + 0.2:.4f}", "-i", src]
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
            z = f"{z0:.4f}"
            scale = f"scale={2 * round(W * z0 / 2)}:{2 * round(H * z0 / 2)}:flags=bicubic"
        # follow the face: smoothed per-frame horizontal centre (a per-clip median left her
        # >6 % off-centre in 22 % of frames), and anchor zooms on the face centre so a
        # punch-in grows around her face instead of around the top of the frame
        cx_expr = face_track_expr(faces, c["s"], c["e"], fc["cx"]) if plan.get("framing", {}).get("track", True) \
            else f"{fc['cx']:.4f}"
        if body_w:  # a leaning presenter: centre between face and torso, not on the face alone
            off = body_offset(src, meta, c["s"], c["e"], faces, os.path.join(work, "body_offsets.json"))
            cx_expr = f"({cx_expr})+{body_w * off:.4f}"
        face_cy = fc["top"] + fc["h"] / 2
        target_cy = plan.get("framing", {}).get("face_center_y", face_top + fc["h"] * base / 2)
        # positions come from the zoom expression itself, not iw/ih: crop keeps the frame
        # size it was configured with, so during a punch-in iw was stale and the face
        # slid 6-9 % off-centre (measured on the punch clips only)
        zw, zh = f"(2*trunc({W}*{z}/2))", f"(2*trunc({H}*{z}/2))"
        x = f"min(max(({cx_expr})*{zw}-{W / 2},0),{zw}-{W})"
        y = f"min(max({face_cy:.4f}*{zh}-{target_cy * H:.1f},0),{zh}-{H})"
        vparts.append(f"[{i}:v]trim=duration={d:.4f},setpts=PTS-STARTPTS,{scale},"
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
        aparts.append(f"[{i}:a]atrim=duration={d:.4f},asetpts=PTS-STARTPTS,volume={gain:.2f}dB"
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
    n_in = len(clips)
    for k, lg in enumerate(plan.get("_caption_logos", [])):  # brand logos inside captions
        png = os.path.join(work, f"caplogo_{lg['size']}.png")
        if not os.path.exists(png):
            caption_logo_png(lg["file"], lg["size"], png)
        inputs += ["-loop", "1", "-t", f"{lg['t1'] - lg['t0'] + 0.1:.3f}", "-i", png]
        graph.append(f"[{n_in}:v]format=rgba,setpts=PTS-STARTPTS+{lg['t0']:.3f}/TB[cl{k}]")
        graph.append(f"[{vlast}][cl{k}]overlay=x={lg['x']}-w/2:y={lg['y']}-h/2:eof_action=pass:"
                     f"enable='gte(t,{lg['t0']:.3f})*lt(t,{lg['t1']:.3f})'[vcl{k}]")  # the next caption starts at t1
        vlast = f"vcl{k}"
        n_in += 1
    anim_cues = []  # sound cues returned by vanim animations (output-timeline seconds)
    anim_boxes = []  # (name, t0, t1, rect) for the layout check
    fs_cap = W * st.get("caption_size", 0.068)
    for k, pu in enumerate(plan.get("popups", [])):
        if pu.get("kind") == "anim":  # vanim engine: three.js / HTML / SVG animation with alpha
            import vanim
            t0 = out_t(pu["at"])
            cw, ch = pu.get("size", [900, 900])
            fdir, info = vanim.render(pu["name"], pu.get("params", {}), cw, ch, meta["fps"], work)
            dur = info["n"] / meta["fps"]
            ow = 2 * round(W * pu.get("w", 0.5) / 2)
            oh = 2 * round(ow * ch / cw / 2)
            inputs += ["-framerate", f"{meta['fps']:.5f}", "-i", os.path.join(fdir, "f_%05d.png")]
            py = round(H * pu.get("y", st.get("popup_y", 0.53)))
            if "y" not in pu and "x" not in pu:
                py = place_clear_of_face(pu["at"], py, oh, ow, clips, faces, base, face_top, W, H, st)
            px = f"{round(W * pu['x'])}-w/2" if "x" in pu else "(W-w)/2"
            graph.append(f"[{n_in}:v]format=rgba,scale={ow}:{oh},setpts=PTS-STARTPTS+{t0:.3f}/TB[p{k}]")
            graph.append(f"[{vlast}][p{k}]overlay=x='{px}':y='{py}-h/2':eof_action=pass:"
                         f"enable='between(t,{t0:.3f},{t0 + dur:.3f})'[vp{k}]")
            vlast = f"vp{k}"
            n_in += 1
            if pu.get("sfx", True):
                anim_cues += vanim.sfx_cues(info, t0, plan["sfx_dir"], work, pu.get("sfx_gain_db", -10))
            # layout rules (client: never on the captions, never on top of each other)
            cx = W * pu["x"] if "x" in pu else W / 2
            rect = (cx - ow / 2, py - oh / 2, cx + ow / 2, py + oh / 2)
            cap_top = H * st.get("caption_y", 0.70) - fs_cap * (st.get("line_spacing", 0.78) / 2 + 0.45)
            if rect[3] > cap_top:
                report.append(f"WARNING anim {pu['name']} at {t0:.2f}s reaches y={rect[3] / H:.2f}H, "
                              f"caption band starts {cap_top / H:.2f}H")
            for (n0, a0, a1, r0) in anim_boxes:
                if t0 < a1 - 0.05 and a0 < t0 + dur - 0.05 and rect[0] < r0[2] and r0[0] < rect[2] and rect[1] < r0[3] and r0[1] < rect[3]:
                    report.append(f"WARNING anim {pu['name']} ({t0:.2f}-{t0 + dur:.2f}s) overlaps {n0} ({a0:.2f}-{a1:.2f}s)")
            anim_boxes.append((pu["name"], t0, t0 + dur, rect))
            continue
        if pu.get("kind") == "mg":  # frame-by-frame motion graphics (vmotion.py)
            import vmotion
            t0 = out_t(pu["at"])
            spec = dict(pu)
            if "items" in spec:  # item cues are source times -> seconds after the pop-up starts
                spec["items"] = [dict(it, t=max(0.0, out_t(it["at"]) - t0)) for it in pu["items"]]
            fdir, mw, mh, nf = vmotion.render(spec, st, W, meta["fps"], os.path.join(work, f"mg_{k}"))
            dur = nf / meta["fps"]
            inputs += ["-framerate", f"{meta['fps']:.5f}", "-i", os.path.join(fdir, "%04d.png")]
            py = round(H * pu.get("y", st.get("popup_y", 0.53)))
            if "y" not in pu and "x" not in pu:
                py = place_clear_of_face(pu["at"], py, mh, mw, clips, faces, base, face_top, W, H, st)
            px = f"{round(W * pu['x'])}-w/2" if "x" in pu else "(W-w)/2"
            graph.append(f"[{n_in}:v]format=rgba,setpts=PTS-STARTPTS+{t0:.3f}/TB[p{k}]")
            graph.append(f"[{vlast}][p{k}]overlay=x='{px}':y='{py}-h/2':eof_action=pass:"
                         f"enable='between(t,{t0:.3f},{t0 + dur:.3f})'[vp{k}]")
            vlast = f"vp{k}"
            n_in += 1
            continue
        png = os.path.join(work, f"popup_{k}.png")
        pw, ph = render_popup(pu, png, st, W, H)
        grow = 1.12 * (1.07 if pu.get("anim") == "pulse" else 1.0) + 0.01  # pop overshoot (+ pulse)
        pw, ph = 2 * round(pw * grow / 2 + 1), 2 * round(ph * grow / 2 + 1)
        t0 = out_t(pu["at"])
        dur = pu.get("dur", 1.2)
        inputs += ["-loop", "1", "-t", f"{dur:.3f}", "-i", png]
        # pop: scale 0 -> 112% -> 100% in 0.2 s, then hold; quick fade out at the end
        s_expr = "if(lt(t,0.12),1.12*t/0.12,if(lt(t,0.2),1.12-0.12*(t-0.12)/0.08,1))"
        # constant canvas (overlay can't take frames that change size)
        anim = pu.get("anim")
        if anim == "pulse":  # keeps breathing after the pop
            s_expr = f"({s_expr})*(1+0.07*sin(2*PI*2.5*t))"
        rot = ""
        if anim == "shake":  # alarm-clock wobble that settles
            rot = (",rotate=a='0.22*sin(2*PI*9*t)*exp(-1.2*t)':c=none:"
                   f"ow='hypot(iw,ih)':oh='hypot(iw,ih)'")
            pw = ph = 2 * round(((pw ** 2 + ph ** 2) ** 0.5) / 2)
        graph.append(f"[{n_in}:v]format=rgba,scale=w='max(2,iw*{s_expr})':h='max(2,ih*{s_expr})':eval=frame,"
                     f"pad=w={pw}:h={ph}:x='(ow-iw)/2':y='(oh-ih)/2':eval=frame:color=0x00000000{rot},"
                     f"fade=t=out:st={dur - 0.12:.3f}:d=0.12:alpha=1,setpts=PTS+{t0:.3f}/TB[p{k}]")
        py = round(H * pu.get("y", st.get("popup_y", 0.53)))
        if "y" not in pu and "x" not in pu:  # explicit positions are kept as given
            py = place_clear_of_face(pu["at"], py, ph, pw, clips, faces, base, face_top, W, H, st)
        px = f"{round(W * pu['x'])}-w/2" if "x" in pu else "(W-w)/2"
        dy = ""
        if anim == "bounce":
            dy = f"-{round(H * 0.025)}*abs(sin(2*PI*2.2*(t-{t0:.3f})))"
        elif anim == "float":
            dy = f"-{round(H * 0.012)}*sin(2*PI*1.1*(t-{t0:.3f}))"
        graph.append(f"[{vlast}][p{k}]overlay=x='{px}':y='{py}-h/2{dy}':eof_action=pass:"
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
    # gentle: afftdn nf=-30 dulled the voice above 2.5 kHz (client: "she sounds weak"); a highpass takes
    # the wind rumble, light tracking noise reduction the hiss, and a presence lift keeps her clear
    graph.append(f"[dia]highpass=f=90,afftdn=nr={st.get('denoise_nr', 8)}:nf=-42:tn=1,"
                 f"equalizer=f=250:t=q:w=1:g=-1.5,equalizer=f=3500:t=q:w=1.2:g={st.get('presence_db', 2.5)},"
                 "acompressor=threshold=-20dB:ratio=3:attack=5:release=120,asplit=2[diam][diak]")
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
                     f"afade=t=out:st={max(0, dur - 0.15):.3f}:d=0.15,volume={fx.get('gain_db', -10) + st.get('sfx_gain_db', 0):.1f}dB,"
                     f"adelay={int(t0 * 1000)}:all=1[fx{k}]")
        mix.append(f"[fx{k}]")
        n_in += 1
    for k, c in enumerate(anim_cues):  # placed so each sound lands on its animation frame
        import vanim
        trim, t0 = vanim.place_cue(c)
        inputs += ["-i", c["file"]]
        graph.append(f"[{n_in}:a]aresample=48000,atrim=start={trim:.3f}:duration={c['dur']:.3f},"
                     f"asetpts=PTS-STARTPTS,afade=t=out:st={max(0, c['dur'] - 0.15):.3f}:d=0.15,"
                     f"volume={c['gain_db'] + st.get('sfx_gain_db', 0):.1f}dB,adelay={int(t0 * 1000)}:all=1[ax{k}]")
        mix.append(f"[ax{k}]")
        n_in += 1
    graph.append(f"{''.join(mix)}amix=inputs={len(mix)}:normalize=0:duration=first,"
                 f"loudnorm=I={st.get('lufs', -14)}:TP=-1.5:LRA=11,aresample=48000,"
                 # loudnorm alone let a Nomi render peak at 0.0 dBFS; a final limiter holds -1.5 dBFS
                 # -3 dBFS: at -1.5 the AAC encode of a dense SFX mix produced +1.0 dBTP inter-sample overs
                 f"alimiter=limit=0.708:attack=2:release=50:level=false[aout]")
    if a.draft:  # quick look: half resolution, fastest encode (~2x faster end to end)
        graph.append(f"[{vlast}]scale=trunc(iw/4)*2:-2[vdraft]")
        vlast = "vdraft"
        a.preset, a.crf = "ultrafast", 26
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


def place_clear_of_face(src_t, py, ph, pw, clips, faces, base, face_top, W, H, st):
    """Move a pop-up off the face visible at src_t: keep the default height if it is clear,
    else go below the chin (above the captions) or above the head. In selfie footage the
    fixed height covered mouths and the closing tongue-out punchline."""
    near = [f for f in faces if abs(f[0] - src_t) <= 0.3]
    clip = next((c for c in clips if c["s"] - 0.15 <= src_t <= c["e"] + 0.15), None)
    if not near or clip is None:
        return py
    _, cx, top, fh = min(near, key=lambda f: abs(f[0] - src_t))
    z = base * (clip.get("punch_zoom", clip.get("zoom", 1.0)) if src_t >= clip.get("punch_at", 1e9)
                else clip.get("zoom", 1.0))
    ih = H * z
    y0 = min(max(top * ih - face_top * H, 0), ih - H)
    ftop, fbot = (top * ih - y0) / H, ((top + fh * 1.15) * ih - y0) / H  # 1.15: chin below the box
    margin = 0.02
    half = ph / 2 / H

    def clear(yc):
        return yc + half < ftop - margin or yc - half > fbot + margin
    cap_top = st.get("caption_y", 0.70) - st.get("caption_size", 0.068) * W / H
    for yc in (py / H, fbot + margin + half, ftop - margin - half):
        if half + 0.02 <= yc <= cap_top - half and clear(yc):
            return round(yc * H)
    return round(max(half + 0.02, ftop - margin - half) * H) if ftop - margin - half > half else py


def normalize_source(src, work, roll=0.0):
    """Phone footage (iPhone: HEVC 10-bit HLG/HDR, rotation flag, extra data tracks) is
    converted once to an 8-bit SDR H.264 working copy. Rendering straight from it used
    ~14 GB of RAM (OOM-killed) and the HDR colours came out washed-out grey."""
    info = json.loads(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-print_format", "json",
                                      "-show_streams", src], capture_output=True, text=True, check=True).stdout)
    v = info["streams"][0]
    hdr = v.get("color_transfer") in ("arib-std-b67", "smpte2084")
    if not hdr and not roll and v.get("codec_name") == "h264" and v.get("pix_fmt") == "yuv420p":
        return src
    out = os.path.join(work, f"source_sdr{'_roll%+.2f' % roll if roll else ''}.mp4")
    if os.path.exists(out) and os.path.getmtime(out) > os.path.getmtime(src):
        return out
    vf = ("zscale=t=linear:npl=203,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=mobius:desat=0,"
          "zscale=t=bt709:m=bt709:r=tv,format=yuv420p") if hdr else "format=yuv420p"
    if roll:  # level a tilted camera (measured on posts / horizon); scale just enough to hide corners
        a = np.radians(abs(roll))
        w0, h0 = int(v["width"]), int(v["height"])
        k = np.cos(a) + max(w0, h0) / min(w0, h0) * np.sin(a)
        vf += (f",rotate={np.radians(roll):.5f}:ow=iw:oh=ih,scale=2*trunc(iw*{k:.4f}/2):2*trunc(ih*{k:.4f}/2),"
               f"crop={w0}:{h0},format=yuv420p")
    print(f"normalizing source ({v.get('codec_name')} {v.get('pix_fmt')}{', HDR tone-mapped' if hdr else ''})")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", src, "-map", "0:v:0", "-map", "0:a:0", "-vf", vf,
                    "-c:v", "libx264", "-preset", "fast", "-crf", "14", "-c:a", "pcm_s16le", out], check=True)
    return out


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

    def level(t):
        return env[min(len(env) - 1, max(0, int(t * sr)))]

    def tight(lo, hi, toward):
        """Frame boundary closest to the word (`toward` = "end": earliest after it, "start":
        latest before it) where the sound has fallen to the local background level.
        Picking the *quietest* point instead added ~0.25 s of dead air at each edge
        (53.7 s of script rendered as 58 s)."""
        ts = np.arange(np.ceil(lo * fps), np.floor(hi * fps) + 1) / fps
        if len(ts) == 0:
            return round((lo + hi) / 2 * fps) / fps
        lv = np.array([level(t) for t in ts])
        around = env[max(0, int((lo - 1.0) * sr)):int((hi + 1.0) * sr)]
        floor = np.percentile(around, 10) if len(around) else lv.min()
        quiet = lv <= max(floor * 2.0, lv.min() * 1.2)  # within ~6 dB of the background
        order = range(len(ts)) if toward == "end" else range(len(ts) - 1, -1, -1)
        for k in order:
            if quiet[k]:
                return float(ts[k])
        return float(ts[int(np.argmin(lv))])

    c["s_orig"], c["e_orig"] = c["s"], c["e"]
    if start:
        c["s"] = round(tight(max(prev_e - 0.03, first["s"] - 0.25), first["s"] + 0.04, "start"), 4)
    if end:
        c["e"] = round(tight(last["e"] - 0.04, min(next_s + 0.03, last["e"] + 0.25), "end"), 4)


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
