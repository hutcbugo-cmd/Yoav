#!/usr/bin/env python3
"""vanim: bridge from the Python editor to the vanim animation engine (vanim/).

Animations are JavaScript modules in vanim/lib/ (three.js 3D, HTML/CSS 3D, SVG, canvas) that
Chromium renders frame by frame to transparent PNGs (vanim/render.js). Each animation also
returns its sound cues, so the editor can place SFX on the exact frames where things happen.

    import vanim
    fdir, info = vanim.render("NailPainting", {"color": "#FF2E8B"}, 900, 900, 30, cache_dir)
    cues = vanim.sfx_cues(info, t0, sfx_dir, cache_dir)   # [{"file", "out", "gain_db", "align"}]

CLI (standalone preview on a background, with its sound):
    python3 vanim.py NailPainting --params '{"color":"#FF2E8B"}' --size 900x900 -o nail.mp4 \
        --sfx-dir sfx/ [--bg footage.mp4 --bg-start 0.8 --x 0.72 --y 0.36 --width 0.5]
"""
import argparse
import hashlib
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.join(HERE, "vanim")

# sounds whose loudest point should land on the visual event (vs. starting on it)
PEAK_ALIGNED = {"pop", "pop2", "click", "impact", "coin", "money"}


def _node_env():
    env = dict(os.environ)
    if "NODE_PATH" not in env:  # playwright is installed globally in this environment
        root = subprocess.run(["npm", "root", "-g"], capture_output=True, text=True).stdout.strip()
        env["NODE_PATH"] = root
    return env


def ensure_engine():
    """Install the engine's npm dependencies (three.js) on first use."""
    if not os.path.isdir(os.path.join(ENGINE, "node_modules", "three")):
        subprocess.run(["npm", "ci", "--silent"], cwd=ENGINE, check=True)


def render(name, params, w, h, fps, cache_dir):
    """Render animation `name` at w x h; cached by name, params, size, fps and the module sources."""
    ensure_engine()
    lib = os.path.join(ENGINE, "lib")
    src_sig = "".join(open(os.path.join(lib, f), encoding="utf-8").read()
                      for f in sorted(os.listdir(lib)) if f.endswith(".js"))
    key = hashlib.sha1(json.dumps([name, params, w, h, fps], sort_keys=True).encode()
                       + src_sig.encode()).hexdigest()[:12]
    out = os.path.join(cache_dir, f"anim_{name}_{key}")
    info_path = os.path.join(out, "info.json")
    if not os.path.exists(info_path):
        subprocess.run(["node", os.path.join(ENGINE, "render.js"), name, "--params", json.dumps(params),
                        "--w", str(w), "--h", str(h), "--fps", f"{fps:.5f}", "--out", out],
                       check=True, env=_node_env())
    with open(info_path, encoding="utf-8") as f:
        return out, json.load(f)


def synth_sfx(name, cache_dir):
    """Procedural sounds that are not in the SFX library. Returns a wav path."""
    path = os.path.join(cache_dir, f"synth_{name}.wav")
    if os.path.exists(path):
        return path
    if name == "brush":  # polish brush stroke: soft band-passed noise swell, ~0.45 s
        af = ("anoisesrc=d=0.45:c=pink:r=48000:a=0.6,highpass=f=1800,lowpass=f=7000,"
              "afade=t=in:d=0.08:curve=qsin,afade=t=out:st=0.18:d=0.27:curve=qsin,"
              "tremolo=f=11:d=0.25")
    elif name == "swipe":  # marker slash: fast rising band-passed noise, ~0.22 s
        af = ("anoisesrc=d=0.22:c=white:r=48000:a=0.5,bandpass=f=2600:width_type=o:w=1.4,"
              "afade=t=in:d=0.03,afade=t=out:st=0.08:d=0.14,vibrato=f=7:d=0.3")
    else:
        raise ValueError(f"no synthesised sound '{name}'")
    os.makedirs(cache_dir, exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", af, path], check=True)
    return path


def sfx_cues(info, t0, sfx_dir, cache_dir, gain_db=0.0):
    """Animation sound cues -> absolute cues on the output timeline (t0 = animation start)."""
    cues = []
    for c in info.get("sfx", []):
        f = os.path.join(sfx_dir, c["name"] + ".mp3")
        if not os.path.exists(f):
            f = synth_sfx(c["name"], cache_dir)
        cues.append({"file": f, "out": t0 + c["t"], "gain_db": c.get("gain", 0) + gain_db,
                     "align": "peak" if c["name"] in PEAK_ALIGNED else "start", "lead": 0.04,
                     "dur": 2.0, "name": c["name"]})
    return cues


def _peak(path):
    """Time of the loudest 10 ms in a sound file."""
    import numpy as np
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", "8000", "-f", "s16le", "-"],
                         capture_output=True, check=True).stdout
    x = np.abs(np.frombuffer(raw, dtype=np.int16).astype(np.float32))
    if not len(x):
        return 0.0
    win = 80
    env = np.convolve(x, np.ones(win) / win, mode="same")
    return float(np.argmax(env)) / 8000


def place_cue(c):
    """(trim, start) for a cue: peak-aligned sounds put their loudest point on the event."""
    if c["align"] == "peak":
        pk = _peak(c["file"])
        trim = max(0.0, pk - c.get("lead", 0.04))
        t = c["out"] - (pk - trim)
    else:
        trim, t = 0.0, c["out"]
    if t < 0:
        trim, t = trim - t, 0.0
    return trim, t


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("name")
    p.add_argument("--params", default="{}")
    p.add_argument("--size", default="900x900")
    p.add_argument("--fps", type=float, default=30)
    p.add_argument("--sfx-dir", required=True)
    p.add_argument("--cache", default="vanim_cache")
    p.add_argument("--bg", help="footage to composite onto (default: brand gradient)")
    p.add_argument("--bg-start", type=float, default=0.0)
    p.add_argument("--lead", type=float, default=0.4, help="seconds of background before the animation")
    p.add_argument("--x", type=float, default=0.5, help="centre x as a fraction of the frame width")
    p.add_argument("--y", type=float, default=0.42)
    p.add_argument("--width", type=float, default=0.8, help="overlay width as a fraction of the frame")
    p.add_argument("-o", "--output", required=True)
    a = p.parse_args()
    w, h = map(int, a.size.split("x"))
    fdir, info = render(a.name, json.loads(a.params), w, h, a.fps, a.cache)
    dur = info["n"] / a.fps
    total = a.lead + dur + 0.4
    W, H = 1080, 1920
    ow = round(W * a.width / 2) * 2
    if a.bg:
        inputs = ["-ss", f"{a.bg_start:.3f}", "-t", f"{total:.3f}", "-i", a.bg]
        bg = f"[0:v]scale={W}:{H},setsar=1,fps={a.fps}[bg]"
        base_audio = "[0:a]volume=-6dB,"
    else:
        inputs = ["-f", "lavfi", "-t", f"{total:.3f}", "-i",
                  f"gradients=s={W}x{H}:c0=0x4A2238:c1=0x1E1018:x0=0:y0=0:x1={W}:y1={H}:r={a.fps}",
                  "-f", "lavfi", "-t", f"{total:.3f}", "-i", "anullsrc=r=48000:cl=stereo"]
        bg = "[0:v]setsar=1[bg]"
        base_audio = "[1:a]"
    n_in = len([x for x in inputs if x == "-i"])
    inputs += ["-framerate", f"{a.fps}", "-i", os.path.join(fdir, "f_%05d.png")]
    g = [bg, f"[{n_in}:v]format=rgba,scale={ow}:-2,setpts=PTS-STARTPTS+{a.lead:.3f}/TB[an]",
         f"[bg][an]overlay=x={round(W * a.x)}-w/2:y={round(H * a.y)}-h/2:eof_action=pass,format=yuv420p[v]"]
    n_in += 1
    mix = [f"{base_audio}aresample=48000[base]"]
    labels = ["[base]"]
    for k, c in enumerate(sfx_cues(info, a.lead, a.sfx_dir, a.cache)):
        trim, t = place_cue(c)
        inputs += ["-i", c["file"]]
        mix.append(f"[{n_in}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=start={trim:.3f}:"
                   f"duration={c['dur']:.3f},asetpts=PTS-STARTPTS,volume={c['gain_db'] - 6:.1f}dB,"
                   f"adelay={int(t * 1000)}:all=1[s{k}]")
        labels.append(f"[s{k}]")
        n_in += 1
    mix.append(f"{''.join(labels)}amix=inputs={len(labels)}:normalize=0:duration=first,"
               "loudnorm=I=-16:TP=-1.5,aresample=48000,alimiter=limit=0.84:level=false[aout]")
    subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(g + mix),
                    "-map", "[v]", "-map", "[aout]", "-t", f"{total:.3f}", "-c:v", "libx264", "-crf", "18",
                    "-preset", "medium", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", a.output],
                   check=True)
    print(f"wrote {a.output} ({total:.1f} s, {len(info.get('sfx', []))} sound cues)")


if __name__ == "__main__":
    sys.exit(main())
