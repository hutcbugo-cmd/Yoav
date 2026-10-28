"""Nomi 9:16 fast-cut ad (reference 4, "Agent for All" style): client's ElevenLabs VO -> NomiAd shots + captions
-> music + SFX mix -> MP4.  Usage: make_nomi_ad.py VO.wav OUT.mp4 [--draft]"""
import json, os, subprocess, sys
import numpy as np, soundfile as sf, pyloudnorm as pyln
sys.path.insert(0, "/home/user/Yoav")
import vanim

HERE = os.path.dirname(os.path.abspath(__file__))
SCR = "/tmp/claude-0/-home-user-Yoav/730ded80-32ca-5134-9de8-8bc6d8b574d9/scratchpad"
SFX = f"{SCR}/mixkit/sfx"
MUSIC, DROP = f"{SCR}/mixkit/m228.mp3", 18.28           # Mixkit "Fashion", drop on the brand reveal
VO, OUT = sys.argv[1], sys.argv[2]
DRAFT = "--draft" in sys.argv
W, H, FPS = (540, 960, 15) if DRAFT else (1080, 1920, 30)
PF = "assets/brands/nomi/portfolio/"
plan = json.load(open(f"{HERE}/plan.json"))          # VO-relative times (Whisper words on the take)
SHIFT = plan["lead_in"]

SR = 44100
w, sr = sf.read(VO)
w = w.mean(1) if w.ndim > 1 else w
w = pyln.normalize.loudness(w, pyln.Meter(sr).integrated_loudness(w), -18.0)
end = round(plan["end"] + SHIFT, 2)
w = np.concatenate([np.zeros(int(SHIFT * sr)), w])
w = np.concatenate([w, np.zeros(max(0, int(end * sr) - len(w)))])[:int(end * sr)]
sf.write(f"{HERE}/vo_track.wav", w, sr)

shots = [dict(id=i, t=round(t + SHIFT - 0.05, 3) if t else 0.0) for i, t in plan["shots"]]
caps = []
for k, (t, text, hl) in enumerate(plan["caps"]):
    nxt = plan["caps"][k + 1][0] if k + 1 < len(plan["caps"]) else plan["caps_end"]
    caps.append(dict(t=round(t + SHIFT, 3), e=round(nxt + SHIFT, 3), text=text, hl=hl))
params = dict(shots=shots, caps=caps, headline=plan["headline"], end=end, logo="assets/brands/nomi/logo_icon.png",
              photos=[{"src": PF + "sage.jpg", "pos": "55% 32%"}, {"src": PF + "nude_shimmer.jpg", "pos": "45% 60%"},
                      {"src": PF + "milky_white.jpg", "pos": "35% 55%"}])
fdir, info = vanim.render("NomiAd", params, W, H, FPS, f"{SCR}/ad30/cache")

logo_t = next(s["t"] for s in shots if s["id"] == "logo")
inputs = ["-i", f"{HERE}/vo_track.wav", "-ss", f"{max(0, DROP - logo_t):.3f}", "-i", MUSIC]
g = [f"[0:a]aresample=48000,aformat=channel_layouts=stereo,highpass=f=80,equalizer=f=3500:t=q:w=1.2:g=1.5,asplit=2[vo][vok]",
     f"[1:a]aresample=48000,atrim=duration={end:.3f},afade=t=in:d=0.4,afade=t=out:st={end - 1.4:.3f}:d=1.4,volume=-11dB[mus0]",
     f"[mus0][vok]sidechaincompress=threshold=0.04:ratio=5:attack=20:release=350:makeup=1[mus]"]
mix, n = ["[vo]", "[mus]"], 2
for k, c in enumerate(vanim.sfx_cues(info, 0.0, SFX, f"{SCR}/ad30/cache", gain_db=-6)):
    trim, t0 = vanim.place_cue(c)
    inputs += ["-i", c["file"]]
    g.append(f"[{n}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=start={trim:.3f}:duration={c['dur']:.3f},"
             f"asetpts=PTS-STARTPTS,volume={c['gain_db']:.1f}dB,adelay={int(t0 * 1000)}:all=1[s{k}]")
    mix.append(f"[s{k}]"); n += 1
g.append(f"{''.join(mix)}amix=inputs={len(mix)}:normalize=0:duration=first,loudnorm=I=-14:TP=-1.5:LRA=9,"
         f"aresample=48000,alimiter=limit=0.708:level=false[a]")
inputs += ["-framerate", str(FPS), "-i", os.path.join(fdir, "f_%05d.png")]
subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(g), "-map", f"{n}:v", "-map", "[a]",
                "-c:v", "libx264", "-preset", "veryfast" if DRAFT else "slow", "-crf", "16", "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-b:a", "256k", "-t", f"{end:.3f}", "-movflags", "+faststart", OUT], check=True)
print("wrote", OUT, end, "s")
