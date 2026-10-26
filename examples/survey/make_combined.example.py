"""Combined source for video 4: street-survey take + Maya's app explanation segments from the
Nomi shoot (levelled copy), concatenated; transcript merged with corrections applied."""
import json, subprocess, sys, copy
sys.path.insert(0, "/home/user/Yoav")
import vedit
V3 = "/tmp/claude-0/-home-user-Yoav/730ded80-32ca-5134-9de8-8bc6d8b574d9/scratchpad/video3/work"
V4 = "/tmp/claude-0/-home-user-Yoav/730ded80-32ca-5134-9de8-8bc6d8b574d9/scratchpad/video4"
FPS = 25
SURVEY_END = 56.32                                   # whole frames
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
inputs = ["-t", f"{SURVEY_END}", "-i", f"{V4}/raw.mp4"]
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
sv = json.load(open(f"{V4}/work/transcript_survey.json"))
vedit.apply_review(sv, {"fix": [
    {"t": 8.65, "from": "נוצאת", "to": "יוצאת"}, {"t": 37.9, "from": "ללאק.", "to": "ללק."},
    {"t": 23.14, "from": "לך", "to": "לחכות"}, {"t": 23.3, "from": "כבוד", "to": ""},
    {"t": 44.79, "from": "הייתי", "to": "היית"},
    {"t": 7.05, "from": "שלושה", "to": "שלושה–ארבעה"}, {"t": 7.7, "from": "-ארבעה", "to": ""}]})
nm = json.load(open(f"{V3}/transcript.json"))
vedit.apply_review(nm, json.load(open(f"{V3}/review.json")))
words = [w for sg in sv["segments"] for w in sg["words"] if w["e"] <= SURVEY_END]
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
