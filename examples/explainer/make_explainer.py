"""Nomi explainer (16:9): VO lines -> timeline -> NomiExplainer animation -> music + SFX mix -> MP4."""
import json, os, subprocess, sys
import numpy as np, soundfile as sf, pyloudnorm as pyln
sys.path.insert(0, "/home/user/Yoav")
import vanim

HERE = os.path.dirname(os.path.abspath(__file__))
SCR = "/tmp/claude-0/-home-user-Yoav/730ded80-32ca-5134-9de8-8bc6d8b574d9/scratchpad"
SFX = f"{SCR}/mixkit/sfx"
MUSIC, DROP = f"{SCR}/mixkit/m228.mp3", 18.28           # Mixkit "Fashion", drop at 18.28 s
W, H, FPS = int(sys.argv[2]) if len(sys.argv) > 2 else 1920, int(sys.argv[3]) if len(sys.argv) > 3 else 1080, 30
OUT = sys.argv[1] if len(sys.argv) > 1 else f"{HERE}/nomi_explainer.mp4"
PF = "assets/brands/nomi/portfolio/"
sc = json.load(open(f"{HERE}/script.json"))

# 1. VO lines: trim silence, level each to -18 LUFS, lay out with breathing gaps
SR = 24000
meter = pyln.Meter(SR)
GAP = {"logo": 0.55, "end": 0.6}            # a beat before the brand moments
t, cues, track = 1.3, [], []                # 1.3 s of line + music before the first word
for l in sc:
    w, sr = sf.read(f"{HERE}/vo/{l['id']}.wav")
    if sr != SR:
        import librosa
        w = librosa.resample(w, orig_sr=sr, target_sr=SR)
    env = np.abs(w) > 0.02
    i0, i1 = np.argmax(env), len(w) - np.argmax(env[::-1])
    w = w[max(0, i0 - int(0.03 * SR)):min(len(w), i1 + int(0.08 * SR))]
    w = pyln.normalize.loudness(w, meter.integrated_loudness(w), -18.0)
    t += GAP.get(l["id"], 0.0)
    cues.append(dict(id=l["id"], t=round(t, 3), t1=l["t1"], t2=l["t2"]))
    track.append((t, w))
    t += len(w) / SR + 0.32
end = t + 2.0
vo = np.zeros(int(end * SR) + SR)
for t0, w in track:
    vo[int(t0 * SR):int(t0 * SR) + len(w)] += w
sf.write(f"{HERE}/vo_track.wav", vo, SR)
print("cues", [(c["id"], c["t"]) for c in cues], "end", round(end, 2))

# 2. animation
params = dict(cues=cues, end=round(end, 2), logo="assets/brands/nomi/logo_icon.png",
              photos=[{"src": PF + "sage.jpg", "pos": "55% 32%"}, {"src": PF + "nude_shimmer.jpg", "pos": "45% 60%"},
                      {"src": PF + "milky_white.jpg", "pos": "35% 55%"}])
fdir, info = vanim.render("NomiExplainer", params, W, H, FPS, f"{HERE}/cache")

# 3. audio: VO + music (drop on "תכירי את נומי") ducked under VO + SFX on the animation beats
logo_t = next(c["t"] for c in cues if c["id"] == "logo")
ts = DROP - logo_t                          # music track time at output 0
inputs = ["-i", f"{HERE}/vo_track.wav", "-ss", f"{max(0, ts):.3f}", "-i", MUSIC]
g = [f"[0:a]aresample=48000,aformat=channel_layouts=stereo,equalizer=f=3500:t=q:w=1.2:g=1.5,asplit=2[vo][vok]",
     f"[1:a]aresample=48000,atrim=duration={end:.3f},afade=t=in:d=0.6,afade=t=out:st={end - 1.6:.3f}:d=1.6,volume=-13dB[mus0]",
     f"[mus0][vok]sidechaincompress=threshold=0.04:ratio=4:attack=20:release=400:makeup=1[mus]"]
mix, n = ["[vo]", "[mus]"], 2
for k, c in enumerate(vanim.sfx_cues(info, 0.0, SFX, f"{HERE}/cache", gain_db=-6)):
    trim, t0 = vanim.place_cue(c)
    inputs += ["-i", c["file"]]
    g.append(f"[{n}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=start={trim:.3f}:duration={c['dur']:.3f},"
             f"asetpts=PTS-STARTPTS,volume={c['gain_db']:.1f}dB,adelay={int(t0 * 1000)}:all=1[s{k}]")
    mix.append(f"[s{k}]"); n += 1
g.append(f"{''.join(mix)}amix=inputs={len(mix)}:normalize=0:duration=first,loudnorm=I=-14:TP=-1.5:LRA=9,"
         f"aresample=48000,alimiter=limit=0.708:level=false[a]")
inputs += ["-framerate", str(FPS), "-i", os.path.join(fdir, "f_%05d.png")]
subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(g), "-map", f"{n}:v", "-map", "[a]",
                "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "256k",
                "-t", f"{end:.3f}", "-movflags", "+faststart", OUT], check=True)
print("wrote", OUT, round(end, 2), "s")
