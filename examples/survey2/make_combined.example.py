"""Combined source for video 4: street-survey take + Maya's app explanation segments from the
Nomi shoot (levelled copy), concatenated; transcript merged with corrections applied."""
import json, subprocess, sys, copy
sys.path.insert(0, "/home/user/Yoav")
import vedit
V3 = "/tmp/claude-0/-home-user-Yoav/730ded80-32ca-5134-9de8-8bc6d8b574d9/scratchpad/video3/work"
V4 = "/tmp/claude-0/-home-user-Yoav/730ded80-32ca-5134-9de8-8bc6d8b574d9/scratchpad/video5"
FPS = 25
SURVEY_END = 112.8                                   # whole frames
NOMI_SEGS = [(111.0, 116.32), (122.0, 131.4), (142.2, 149.4), (204.4, 210.4), (411.2, 414.2)]
offsets = []                                         # (nomi_s, nomi_e, combined_s)
o = SURVEY_END
for s, e in NOMI_SEGS:
    offsets.append((s, e, round(o, 2)))
    o += e - s
json.dump(offsets, open(f"{V4}/work/nomi_offsets.json", "w"))

def comb(t):  # Nomi source time -> combined time
    for s, e, o in offsets:
        if s <= t <= e:
            return round(o + t - s, 3)
    raise ValueError(t)

# video: survey + segments, one encode at high quality
NOMI = f"{V3}/source_sdr_roll+2.00.mp4"
inputs = ["-t", f"{SURVEY_END}", "-i", f"{V4}/raw_enh.mp4"]
for s, e in NOMI_SEGS:
    inputs += ["-ss", f"{s}", "-t", f"{e - s:.2f}", "-i", NOMI]
n = 1 + len(NOMI_SEGS)
g = "".join(f"[{i}:v]fps={FPS},setsar=1,format=yuv420p[v{i}];[{i}:a]aresample=48000,aformat=channel_layouts=stereo[a{i}];"
            for i in range(n))
g += "".join(f"[v{i}][a{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=1[v][a]"
subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", g, "-map", "[v]", "-map", "[a]",
                "-c:v", "libx264", "-crf", "14", "-preset", "fast", "-c:a", "aac", "-b:a", "256k",
                f"{V4}/combined.mp4"], check=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", f"{V4}/combined.mp4", "-ac", "1", "-ar", "16000",
                f"{V4}/work/audio16k.wav"], check=True)

# transcript: survey (with fixes) + Nomi words (with the approved Nomi review), shifted
sv = json.load(open(f"{V4}/work_enh/transcript.json"))
vedit.apply_review(sv, {"fix": [
    {"t": 36.4, "from": "התואר,", "to": "התור,"}, {"t": 30.5, "from": "לציפורניים", "to": "לציפורניים?"},
    {"t": 72.6, "from": "בנויה?", "to": "פנויה?"}, {"t": 96.7, "from": "אליכם", "to": "אליכן"},
    {"t": 79.9, "from": "אותי", "to": "אותי,"}, {"t": 82.8, "from": "נעים", "to": "נעים."}]})
nm = json.load(open(f"{V3}/transcript.json"))
vedit.apply_review(nm, json.load(open(f"{V3}/review.json")))
# whisper runs ~0.25 s early on the DeepFilterNet-cleaned audio (Q1 28.30 vs voiced 28.68, "ומה" 76.82 vs 76.92):
# without the shift, the first word of half the clips fell outside them and dropped from the captions
words = [dict(w, s=round(w["s"] + 0.25, 3), e=round(w["e"] + 0.25, 3)) for sg in sv["segments"] for w in sg["words"]
         if w["e"] <= SURVEY_END]
for w in words:
    if w["w"] == "סיוט" and 52 < w["s"] < 54: w["w"] = "זה סיוט."
    if w["w"] == "משתמשות?" and 97 < w["s"] < 99: w["s"], w["e"] = 97.95, 98.2
    if w["w"] == "אותי," and 79.9 < w["s"] < 80.2: w["s"], w["e"] = min(w["s"], 79.95), min(w["e"], 80.08)
words = [w for w in words if not ((w["w"] == "לא" and 52.8 < w["s"] < 53.0) or (w["w"] == "דבר" and 95.9 < w["s"] < 96.1))]
for sg in nm["segments"]:
    for w in sg["words"]:
        m = (w["s"] + w["e"]) / 2
        for s, e, o in offsets:
            if s <= m <= e:
                words.append(dict(w, s=round(o + w["s"] - s, 3), e=round(o + w["e"] - s, 3)))
words.sort(key=lambda w: w["s"])
json.dump({"segments": [{"start": words[0]["s"], "end": words[-1]["e"], "text": "", "words": words}]},
          open(f"{V4}/work/transcript.json", "w"), ensure_ascii=False)
json.dump({}, open(f"{V4}/work/review.json", "w"))
print("combined", round(o, 2), "s;", len(words), "words;", offsets)
