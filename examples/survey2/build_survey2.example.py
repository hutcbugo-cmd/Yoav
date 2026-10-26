"""Video 4: street survey (fast Q/A cuts, per-speaker framing, colour grade) + Maya's approved Nomi app
explanation, on one combined source (make_combined.py). Cues are source(combined)-anchored."""
import json
V3 = "/tmp/claude-0/-home-user-Yoav/730ded80-32ca-5134-9de8-8bc6d8b574d9/scratchpad/video3/work"
V4 = "/tmp/claude-0/-home-user-Yoav/730ded80-32ca-5134-9de8-8bc6d8b574d9/scratchpad/video5"
offs = json.load(open(f"{V4}/work/nomi_offsets.json"))
def comb(t):
    for s, e, o in offs:
        if s - 0.01 <= t <= e + 0.01:
            return round(o + t - s, 3)
    raise ValueError(t)
nomi = json.load(open(f"{V3}/plan_v5_hook1.json"))          # approved Nomi v9
GRADE = "curves=all='0/0 0.25/0.23 0.75/0.77 1/1',eq=saturation=1.1,colorbalance=rm=0.01:bm=-0.015,unsharp=5:5:0.3"  # v2: v1 too saturated
# v4: wind removed up front with DeepFilterNet3 (enhance_df.py -> combined_enh.mp4); here only presence and a
# gentle compressor so both voices sit forward ("weak" in v3)
WIND = "highpass=f=90,equalizer=f=3500:t=q:w=1.2:g=2.5,acompressor=threshold=-26dB:ratio=3:attack=5:release=150:makeup=3"
MAYA, GIRLS = 0.75, 0.3                                     # Maya right; Noa + Adi together on the left
Z, ZP, WIDE = 1.39, 1.5, 0.8163
def sv(s, e, who, zoom=Z, **kw):
    return dict(s=s, e=e, face_x=who, zoom=zoom, grade=GRADE, afilter=WIND, body_weight=0.0, drift=0.03,
                snap_start=False, snap_end=False, **kw)              # cuts measured on the clean audio
clips = [
    sv(78.2, 80.1, GIRLS, 1.5, note="COLD OPEN: האמת היא שהתחננתי שהיא תקבל אותי"),
    sv(28.58, 31.02, MAYA, note="Q1: כמה זמן לוקח לכם לקבוע תור לציפורניים?"),
    sv(35.42, 38.96, GIRLS, note="A1: אני כאילו קובעת בסוף התור, אז… זה כל פעם לפעם הבאה."),
    sv(44.78, 47.16, MAYA, note="Q2: מה הכי מעצבן אתכם בלקבוע תור לציפורניים?"),
    sv(47.82, 49.2, GIRLS, note="A2: שאני צריכה להגיע לתור."),
    sv(52.98, 55.96, GIRLS, ZP, note="A2: זה סיוט. כאילו, אני מתה לעשות על זה וי ולהתקדם."),
    sv(67.88, 73.0, MAYA, note="Q3: קרה לכם מקרה שהייתם צריכות לקבוע תור דחוף… ולא הייתה אף אחת פנויה?"),
    sv(74.78, 75.58, GIRLS, note="A3: האמת שכן."),
    sv(76.86, 77.72, MAYA, note="Q: ומה עשיתם?"),
    sv(77.98, 83.22, GIRLS, ZP, note="A3: האמת היא שהתחננתי שהיא תקבל אותי, ואז היא סידרה לי איזה חברה שלה או משהו, זה היה לא נעים"),
    sv(86.36, 89.1, GIRLS, note="A3b: אותה סיטואציה. התחלתי לחפש מלא באינטרנט."),
    sv(90.28, 94.16, MAYA, note="Q4: אם הייתן יכולות למצוא מישהי בלחיצת כפתור באפליקציה"),
    sv(96.18, 98.22, MAYA, ZP, note="Q4: כשהיא מגיעה אליכן הביתה, הייתן משתמשות?"),
    sv(98.84, 99.98, GIRLS, ZP, note="A4: ברור שכן."),
    sv(100.5, 101.02, GIRLS, note="A4: בטח."),
]
keep = [112.0, 124.13, 143.2, 147.04, 205.42, 412.08]  # 122.91 ("את", 0.34 s, odd look) cut
for c in nomi["clips"]:
    if any(abs(c["s"] - k) < 0.2 for k in keep):
        d = {k: v for k, v in c.items() if k not in ("joined",)}
        d["s"], d["e"] = comb(c["s"]), comb(min(c["e"], [e for s, e, o in offs if s <= c["s"] <= e][0]))
        for k in ("punch_at",):
            if k in d: d[k] = comb(d[k])
        d["note"] = "MAYA: " + c.get("note", "")
        clips.append(d)
p = dict(nomi)
p["source"] = f"{V4}/combined.mp4"  # survey audio enhanced with DeepFilterNet3 before combining
p["work"] = f"{V4}/work"
p["clips"] = clips
p["framing"] = dict(nomi["framing"], roll_deg=0.0)           # Nomi segments come from the levelled copy
LOGO = "assets/brands/nomi/logo_icon.png"; PF = "assets/brands/nomi/portfolio/"
sq = dict(size=[800, 800], w=0.58, x=0.5, y=0.495, sfx_gain_db=-5)
BIG = dict(w=0.66, y=0.5)  # survey shots are wider: their animations read better bigger
A = lambda name, at, params, **kw: dict(dict(kind="anim", name=name, at=at, params=params, **sq), **kw)
# Nomi animations, re-anchored on the combined source (timemaps are relative, so they carry over)
nm = {q["name"] + str(round(q["at"])): q for q in nomi["popups"]}
def moved(key, **kw):
    q = dict(nm[key]); q["at"] = comb(q["at"]); q.update(kw); return q
p["popups"] = [
    A("PleaChat", 78.25, {"reply_at": 1.2, "step": 0.18, "hold": 0.0}, **BIG),          # cold open (first clip with 78.25)
    A("BookingLoop", 35.6, {"step": 0.42, "hold": 0.6}, **BIG),                          # "קובעת… כל פעם לפעם הבאה"
    A("CheckOff", 53.0, {"stuck_at": 0.35, "tick_at": 2.3, "hold": 0.2}, **BIG),        # stuck on "סיוט", tick on "וי"
    A("PleaChat", 77.99, {"reply_at": 3.1, "step": 0.3, "hold": 0.6}, **BIG),           # A3 clip (77.98 is before the cold open's 78.2): pleas on "התחננתי", reply on "חברה שלה"
    A("SearchFrenzy", 86.45, {"step": 0.4, "hold": 0.2}, **BIG),                         # "התחלתי לחפש מלא באינטרנט"
    A("BigButton", 91.6, {"label": "הזמנה הביתה", "press_at": 0.7, "answer_at": 4.9, "answer": "ברור שכן!", "hold": 0.2}, **BIG),  # press on "בלחיצת", stamp on "ברור"
    moved("LogoReveal115"),
    moved("SmartphoneAppReveal125", at=comb(125.0), params=dict(nm["SmartphoneAppReveal125"]["params"], _timemap=[
        [0, 0], [0.75, 1.25], [1.1, 2.05], [1.4, 2.45], [3.6, 2.65], [4.05, 3.1]])),  # after the logo leaves, out before the portfolio
    moved("PortfolioGallery129", params=dict(nm["PortfolioGallery129"]["params"])),
    moved("SmartphoneAppReveal144"),
    moved("VerifiedStars206", at=comb(206.7), params={"check_at": 0.25, "stars_at": 2.45, "hold": 0.0,
          "_timemap": [[0, 0], [2.3, 2.45], [2.6, 3.35], [2.9, 3.65]]}),  # gone before the end logo
    moved("LogoReveal412"),
]
# sounds: riser into "Nomi", whoosh on each question and into Maya's part
p["sfx"] = [dict(s, at=comb(s["at"])) for s in nomi["sfx"] if s["name"] == "riser" and s["at"] == 114.84]
for t in (28.58, 44.78, 67.88, 90.28):
    p["sfx"].append({"name": "whoosh2", "at": t, "gain_db": -20, "dur": 0.6, "align": "peak", "lead": 0.3})
p["sfx"].append({"name": "riser", "at": 28.58, "gain_db": -9, "dur": 1.4, "align": "end"})  # rise up through the hook into Q1
p["sfx"].append({"name": "impact", "at": 28.58, "gain_db": -14, "dur": 1.0, "align": "peak", "lead": 0.02})
p["sfx"].append({"name": "whoosh", "at": comb(112.0), "gain_db": -18, "dur": 0.6, "align": "peak", "lead": 0.3})
p["flashes"] = [{"at": comb(114.84), "dur": 0.3}]
# music: groove from the top under the survey, then the drop lands on "Nomi" again
mu = dict(nomi["music"])
mu["sections"] = [{"out_until": comb(112.0), "track_start": 0.0, "fade_in": 0.02, "fade_out": 0.6, "gain_db": -15},  # under the windy survey: voice first
                  {"out_from": comb(112.0), "sync": {"src": comb(114.84), "track": 18.28}, "fade_in": 0.4, "fade_out": 1.0}]
p["music"] = mu
json.dump(p, open(f"{V4}/work/plan_v1.json", "w"), ensure_ascii=False, indent=1)
print(len(clips), "clips;", [(c["s"], c["e"]) for c in clips[13:]])
