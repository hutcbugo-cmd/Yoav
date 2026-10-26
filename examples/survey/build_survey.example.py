"""Video 4: street survey (fast Q/A cuts, per-speaker framing, colour grade) + Maya's approved Nomi app
explanation, on one combined source (make_combined.py). Cues are source(combined)-anchored."""
import json
V3 = "/tmp/claude-0/-home-user-Yoav/730ded80-32ca-5134-9de8-8bc6d8b574d9/scratchpad/video3/work"
V4 = "/tmp/claude-0/-home-user-Yoav/730ded80-32ca-5134-9de8-8bc6d8b574d9/scratchpad/video4"
offs = json.load(open(f"{V4}/work/nomi_offsets.json"))
def comb(t):
    for s, e, o in offs:
        if s - 0.01 <= t <= e + 0.01:
            return round(o + t - s, 3)
    raise ValueError(t)
nomi = json.load(open(f"{V3}/plan_v5_hook1.json"))          # approved Nomi v9
GRADE = "curves=all='0/0 0.25/0.23 0.75/0.77 1/1',eq=saturation=1.1,colorbalance=rm=0.01:bm=-0.015,unsharp=5:5:0.3"  # v2: v1 too saturated
WIND = "highpass=f=120,arnndn=m=/home/user/Yoav/assets/models/bd.rnnn:mix=0.9,equalizer=f=3500:t=q:w=1.2:g=2"  # wind ≈ voice level on this take
MAYA, GUEST = 0.22, 0.76
Z, ZP, WIDE = 1.39, 1.55, 0.8163                            # x base 1.225 -> 1.70 / 1.90 / 1.0 total
def sv(s, e, who, zoom=Z, **kw):
    return dict(s=s, e=e, face_x=who, zoom=zoom, grade=GRADE, afilter=WIND, body_weight=0.0, drift=0.03, **kw)
clips = [
    sv(36.84, 38.12, GUEST, 1.45, note="COLD OPEN: אז נסעתי לבאר שבע ללק"),
    sv(0.0, 2.36, MAYA, note="Q1: אז כמה זמן לוקח לך להזמין טיפול ציפורניים?"),
    sv(6.53, 8.35, GUEST, note="A1: שלושה-ארבעה שבועות."),
    sv(8.35, 10.25, GUEST, ZP, note="A1: אני יוצאת מתור וקובעת כבר לתור הבא."),
    sv(11.77, 14.63, MAYA, note="Q2: מה הכי מעצבן אותך בלקבוע תור לטיפול ציפורניים?"),
    sv(15.98, 16.98, GUEST, snap_start=False, snap_end=False, note="A2: הזמינות"),  # voiced 16.10-16.95
    sv(17.7, 23.94, GUEST, ZP, note="A2: אני לא אצל מישהי שמשתמשת באפליקציה נגיד, אז זה בוואטסאפ, אז אני צריכה לחכות שהיא תענה לי"),
    sv(26.43, 30.61, MAYA, note="Q3: קרה לך שהיית צריכה טיפול ממש דחוף ולא הייתה אף אחת פנויה?"),
    sv(31.36, 32.02, GUEST, snap_start=False, note="A3: כן, זה קרה לי,"),
    sv(33.22, 38.12, GUEST, punch_at=36.86, punch_zoom=1.6, note="A3: הייתי גרה בבאר שבע… אז נסעתי לבאר שבע ללק."),
    sv(38.6, 40.08, MAYA, WIDE, note="REACT (wide two-shot): וואו, זה אחד המושקעים."),
    sv(44.56, 49.12, MAYA, snap_start=False, note="Q4: אם היית יכולה להזמין… בלחיצת כפתור היית רוצה?"),
    sv(49.2, 49.68, GUEST, 1.6, note="A4: ברור."),
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
p["source"] = f"{V4}/combined.mp4"
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
    A("RoadTrip", 36.84, {"drive_at": 0.45, "nail_at": 1.0, "hold": 0.1}, **BIG),  # cold open (first clip with 36.84)
    A("RoadTrip", 33.3, {"drive_at": 3.6, "nail_at": 4.5, "hold": 0.1}, **BIG),   # map on "גרה בבאר שבע", car on "נסעתי", nail on "ללק"
    A("DaysCounter", 6.5, {"flips_end": 1.3, "label_at": 1.4, "hold": 1.4}, **BIG),
    A("ChatWait", 21.4, {"hold": 0.1}, **BIG),                                       # "בוואטסאפ… לחכות שהיא תענה לי"
    A("BigButton", 47.2, {"press_at": 0.45, "answer_at": 2.0, "hold": 0.3}, **BIG),  # press on "בלחיצת כפתור", stamp on "ברור"
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
for t in (0.0, 11.77, 26.43, 44.56):
    p["sfx"].append({"name": "whoosh2", "at": t, "gain_db": -20, "dur": 0.6, "align": "peak", "lead": 0.3})
p["sfx"].append({"name": "riser", "at": 0.0, "gain_db": -9, "dur": 1.4, "align": "end"})  # rise up through the hook into Q1
p["sfx"].append({"name": "impact", "at": 0.0, "gain_db": -14, "dur": 1.0, "align": "peak", "lead": 0.02})
p["sfx"].append({"name": "whoosh", "at": comb(112.0), "gain_db": -18, "dur": 0.6, "align": "peak", "lead": 0.3})
p["flashes"] = [{"at": comb(114.84), "dur": 0.3}]
# music: groove from the top under the survey, then the drop lands on "Nomi" again
mu = dict(nomi["music"])
mu["sections"] = [{"out_until": comb(112.0), "track_start": 0.0, "fade_in": 0.02, "fade_out": 0.6},
                  {"out_from": comb(112.0), "sync": {"src": comb(114.84), "track": 18.28}, "fade_in": 0.4, "fade_out": 1.0}]
p["music"] = mu
json.dump(p, open(f"{V4}/work/plan_v1.json", "w"), ensure_ascii=False, indent=1)
print(len(clips), "clips;", [(c["s"], c["e"]) for c in clips[13:]])
