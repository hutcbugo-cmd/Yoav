"""Frame-by-frame motion graphics for pop-ups (rendered with Pillow to PNG sequences).

Presets: slam, stamp_x, chips, logo, cta. Each returns (frame_dir, width, height, n_frames).
Drawn at 2x and downsampled for clean edges; Hebrew text is shaped RTL by raqm.
"""
import math
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

EMOJI_FONT = "/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf"
SS = 2  # supersampling


def ease_out_back(x, k=1.70158):
    x = min(max(x, 0.0), 1.0) - 1
    return 1 + (k + 1) * x ** 3 + k * x ** 2


def ease_out(x):
    x = min(max(x, 0.0), 1.0)
    return 1 - (1 - x) ** 3


def rgb(c):
    c = c.lstrip("#")
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


def emoji_img(e, size):
    f = ImageFont.truetype(EMOJI_FONT, 109)
    im = Image.new("RGBA", (140 * len(e), 128), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((0, 0), e, font=f, embedded_color=True)
    im = im.crop(im.getbbox())
    return im.resize((max(1, round(im.width * size / im.height)), size), Image.LANCZOS)


def pill(text, font_file, size, fill, emoji="", text_color=(255, 255, 255)):
    """Rounded pill with RTL text (+ emoji at the line end, i.e. on the left)."""
    font = ImageFont.truetype(font_file, size)
    l, t, r, b = font.getbbox(text, direction="rtl", features=["-liga"]) if text else (0, 0, 0, 0)
    em = emoji_img(emoji, round(size * 1.05)) if emoji else None
    gap = round(size * 0.25) if (em and text) else 0
    px, py = round(size * 0.5), round(size * 0.3)
    w = (r - l) + (em.width if em else 0) + gap + 2 * px
    h = max(b - t, em.height if em else 0) + 2 * py
    im = Image.new("RGBA", (w + 24, h + 28), (0, 0, 0, 0))
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle((12, 20, w + 12, h + 20), radius=h // 2, fill=(40, 0, 20, 120))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(8)))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((12, 12, w + 12, h + 12), radius=h // 2, fill=fill + (255,))
    x = 12 + px
    if em:
        im.alpha_composite(em, (x, 12 + (h - em.height) // 2))
        x += em.width + gap
    if text:
        d.text((x - l, 12 + (h - (b - t)) // 2 - t), text, font=font, fill=text_color + (255,), direction="rtl",
               features=["-liga"])
    return im


def place(canvas, sprite, cx, cy, scale=1.0, angle=0.0, alpha=1.0):
    if scale <= 0.01 or alpha <= 0.01:
        return
    sp = sprite.resize((max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale))), Image.BICUBIC)
    if angle:
        sp = sp.rotate(angle, resample=Image.BICUBIC, expand=True)
    if alpha < 1:
        a = sp.split()[3].point(lambda v: round(v * alpha))
        sp.putalpha(a)
    canvas.alpha_composite(sp, (round(cx - sp.width / 2), round(cy - sp.height / 2)))


def save_frames(frames, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    for f in os.listdir(out_dir):
        os.remove(os.path.join(out_dir, f))
    for i, fr in enumerate(frames):
        fr.resize((fr.width // SS, fr.height // SS), Image.LANCZOS).save(os.path.join(out_dir, f"{i:04d}.png"))
    return out_dir, frames[0].width // SS, frames[0].height // SS, len(frames)


def exit_scale(t, dur, d_out=0.14):
    return 1.0 if t < dur - d_out else max(0.0, (dur - t) / d_out)


# ---------------------------------------------------------------- presets
def slam(p, style, W, fps, out_dir):
    """Box crashes in from 2.2x, settles with overshoot, ring shock-wave, decaying shake."""
    size = round(W * p.get("size", 0.1)) * SS
    fill = rgb(p.get("color", style["accent"]))
    sp = pill(p["text"], style["font_file"], size, fill, p.get("emoji", ""))
    cw, ch = round(sp.width * 2.0), round(sp.height * 2.6)
    frames = []
    dur = p["dur"]
    for i in range(round(dur * fps)):
        t = i / fps
        fr = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        k = min(t / 0.16, 1)
        sc = 2.2 - 1.3 * ease_out(k) if k < 1 else 0.9 + 0.1 * ease_out_back(min((t - 0.16) / 0.12, 1), 3)
        if t > 0.1:  # shock-wave ring
            rt = (t - 0.1) / 0.35
            if rt < 1:
                d = ImageDraw.Draw(fr)
                rw, rh = sp.width * (0.7 + 0.6 * rt), sp.height * (0.9 + 1.2 * rt)
                d.rounded_rectangle((cw / 2 - rw / 2, ch / 2 - rh / 2, cw / 2 + rw / 2, ch / 2 + rh / 2),
                                    radius=rh / 2, outline=fill + (round(255 * (1 - rt)),), width=round(10 * SS * (1 - rt)) + 1)
        shake = 7 * math.sin(2 * math.pi * 11 * t) * math.exp(-5 * max(t - 0.16, 0)) if t > 0.16 else 0
        place(fr, sp, cw / 2 + shake * SS, ch / 2, sc * exit_scale(t, dur), angle=-4 * (1 - min(t / 0.2, 1)) + shake * 0.4)
        frames.append(fr)
    return save_frames(frames, out_dir)


def stamp_x(p, style, W, fps, out_dir):
    """Card slides in, a red X is drawn stroke by stroke over the icon, then a stamp shake."""
    size = round(W * p.get("size", 0.1)) * SS
    fill = rgb(p.get("color", style["accent"]))
    font = ImageFont.truetype(style["font_file"], size)
    l, t_, r, b = font.getbbox(p["text"], direction="rtl", features=["-liga"])
    icon = emoji_img(p.get("emoji", "📅"), round(size * 1.3))
    px, py, gap = round(size * 0.5), round(size * 0.35), round(size * 0.35)
    w, h = (r - l) + icon.width + gap + 2 * px, max(b - t_, icon.height) + 2 * py
    card = Image.new("RGBA", (w + 24, h + 28), (0, 0, 0, 0))
    sh = Image.new("RGBA", card.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle((12, 20, w + 12, h + 20), radius=h // 3, fill=(40, 0, 20, 120))
    card.alpha_composite(sh.filter(ImageFilter.GaussianBlur(8)))
    d = ImageDraw.Draw(card)
    d.rounded_rectangle((12, 12, w + 12, h + 12), radius=h // 3, fill=fill + (255,))
    ix, iy = 12 + px, 12 + (h - icon.height) // 2
    card.alpha_composite(icon, (ix, iy))
    d.text((ix + icon.width + gap - l, 12 + (h - (b - t_)) // 2 - t_), p["text"], font=font, fill=(255, 255, 255, 255),
           direction="rtl", features=["-liga"])
    cw, ch = round(card.width * 1.6), round(card.height * 1.8)
    frames, dur = [], p["dur"]
    for i in range(round(dur * fps)):
        t = i / fps
        fr = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        slide = 1 - ease_out_back(t / 0.22, 2.2)
        stamp_t = t - 0.42
        shake = 6 * math.sin(2 * math.pi * 13 * stamp_t) * math.exp(-6 * stamp_t) if stamp_t > 0 else 0
        c = card.copy()
        dd = ImageDraw.Draw(c)
        for j, (a0, a1) in enumerate((((-0.05, -0.05), (1.05, 1.05)), ((1.05, -0.05), (-0.05, 1.05)))):
            k = min(max((t - 0.22 - j * 0.1) / 0.1, 0), 1)  # draw each stroke over 0.1 s
            if k > 0:
                x0, y0 = ix + a0[0] * icon.width, iy + a0[1] * icon.height
                x1, y1 = ix + a1[0] * icon.width, iy + a1[1] * icon.height
                dd.line((x0, y0, x0 + (x1 - x0) * k, y0 + (y1 - y0) * k), fill=(230, 20, 40, 255), width=round(size * 0.24))
        place(fr, c, cw / 2 + slide * cw * 0.6 + shake * SS, ch / 2, exit_scale(t, dur), angle=shake * 0.5)
        frames.append(fr)
    return save_frames(frames, out_dir)


def chips(p, style, W, fps, out_dir):
    """A list that builds up: each item slides in on its own cue with a drawn check mark."""
    size = round(W * p.get("size", 0.085)) * SS
    fill = rgb(p.get("color", style["accent"]))
    sprites = [pill(it["text"], style["font_file"], size, fill, it.get("emoji", "")) for it in p["items"]]
    sw = max(s.width for s in sprites)
    sh_ = sprites[0].height
    step = round(sh_ * 0.82)
    cw, ch = round(sw * 1.5), step * (len(sprites) - 1) + sh_ + 40 * SS
    frames, dur = [], p["dur"]
    for i in range(round(dur * fps)):
        t = i / fps
        fr = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        for j, (sp, it) in enumerate(zip(sprites, p["items"])):
            tt = t - it["t"]
            if tt < 0:
                continue
            k = ease_out_back(tt / 0.2, 2.0)
            x = cw / 2 + (1 - k) * cw * 0.55 * (1 if j % 2 == 0 else -1)
            place(fr, sp, x, 20 * SS + sh_ / 2 + j * step, exit_scale(t, dur), angle=(1 - min(tt / 0.2, 1)) * (8 if j % 2 else -8))
        frames.append(fr)
    return save_frames(frames, out_dir)


def logo(p, style, W, fps, out_dir):
    """Brand reveal: letters pop in one by one on a glowing pill, sparkle burst."""
    size = round(W * p.get("size", 0.15)) * SS
    fill = rgb(p.get("color", style["accent"]))
    font = ImageFont.truetype(style["font_file"], size)
    text = p["text"]
    widths = [font.getlength(ch) for ch in text]
    tw = sum(widths)
    asc, desc = font.getmetrics()
    pw, ph = tw + size * 1.1, (asc + desc) * 1.25
    cw, ch = round(pw * 1.8), round(ph * 2.6)
    frames, dur = [], p["dur"]
    sparks = [(math.cos(a) * 1.0, math.sin(a) * 1.0, 0.6 + 0.5 * ((k * 37) % 10) / 10)
              for k, a in enumerate([j * 2 * math.pi / 14 + 0.2 for j in range(14)])]
    for i in range(round(dur * fps)):
        t = i / fps
        fr = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        ex = exit_scale(t, dur)
        ps = ease_out_back(t / 0.18, 2.5) * ex * (1 + 0.035 * math.sin(2 * math.pi * 2 * max(t - 0.5, 0)))
        if ps > 0.01:
            g = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
            gd = ImageDraw.Draw(g)
            gw, gh = pw * ps * 1.12, ph * ps * 1.25
            gd.rounded_rectangle((cw / 2 - gw / 2, ch / 2 - gh / 2, cw / 2 + gw / 2, ch / 2 + gh / 2), radius=gh / 2,
                                 fill=fill + (150,))
            fr.alpha_composite(g.filter(ImageFilter.GaussianBlur(18 * SS)))
            d = ImageDraw.Draw(fr)
            bw, bh = pw * ps, ph * ps
            d.rounded_rectangle((cw / 2 - bw / 2, ch / 2 - bh / 2, cw / 2 + bw / 2, ch / 2 + bh / 2), radius=bh / 2,
                                fill=fill + (255,))
        x = cw / 2 - tw / 2
        for j, (c, wdt) in enumerate(zip(text, widths)):  # Latin brand: left-to-right letters
            lt = t - 0.12 - j * 0.06
            if lt > 0:
                ls = ease_out_back(lt / 0.16, 3) * ex
                li = Image.new("RGBA", (round(wdt + size * 0.4), round((asc + desc) * 1.3)), (0, 0, 0, 0))
                ImageDraw.Draw(li).text((size * 0.2, (asc + desc) * 0.15), c, font=font, fill=(255, 255, 255, 255))
                place(fr, li, x + wdt / 2, ch / 2, ls)
            x += wdt
        st = t - 0.35
        if 0 < st < 0.6:  # sparkle burst
            d = ImageDraw.Draw(fr)
            for dx, dy, sp in sparks:
                r = (pw * 0.55 + st * pw * 0.9 * sp)
                cx_, cy_ = cw / 2 + dx * r, ch / 2 + dy * r * 0.7
                s = size * 0.12 * (1 - st / 0.6)
                d.polygon([(cx_, cy_ - s * 2), (cx_ + s * 0.5, cy_ - s * 0.5), (cx_ + s * 2, cy_), (cx_ + s * 0.5, cy_ + s * 0.5),
                           (cx_, cy_ + s * 2), (cx_ - s * 0.5, cy_ + s * 0.5), (cx_ - s * 2, cy_), (cx_ - s * 0.5, cy_ - s * 0.5)],
                          fill=(255, 245, 160, round(255 * (1 - st / 0.6))))
        frames.append(fr)
    return save_frames(frames, out_dir)


def cta(p, style, W, fps, out_dir):
    """Download button: pops in, a 'press' dip, arrow bouncing toward the link below."""
    size = round(W * p.get("size", 0.1)) * SS
    fill = rgb(p.get("color", style["accent"]))
    sp = pill(p["text"], style["font_file"], size, fill, p.get("emoji", ""))
    arrow = emoji_img("👇", round(size * 1.1))
    cw, ch = round(sp.width * 1.5), round(sp.height + arrow.height * 2.4)
    frames, dur = [], p["dur"]
    for i in range(round(dur * fps)):
        t = i / fps
        fr = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        ex = exit_scale(t, dur)
        press = 1 - 0.08 * math.sin(math.pi * min(max((t - 0.45) / 0.18, 0), 1))
        place(fr, sp, cw / 2, sp.height * 0.7, ease_out_back(t / 0.2, 2.2) * press * ex)
        if t > 0.2:
            bounce = abs(math.sin(2 * math.pi * 1.8 * (t - 0.2))) * arrow.height * 0.45
            place(fr, arrow, cw / 2, sp.height * 1.25 + arrow.height * 0.6 + bounce, min((t - 0.2) / 0.1, 1) * ex)
        frames.append(fr)
    return save_frames(frames, out_dir)


PRESETS = {"slam": slam, "stamp_x": stamp_x, "chips": chips, "logo": logo, "cta": cta}


def render(p, style, W, fps, out_dir):
    return PRESETS[p["preset"]](p, style, W, fps, out_dir)
