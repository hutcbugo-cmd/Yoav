import json, bisect
tl = json.load(open('timeline.json'))
p = json.load(open('plan_v3_hook1.json'))
outs = [w['out'] for w in tl]
def src(out_t):
    """output time -> source time, via the nearest word at or before it in the same clip"""
    i = max(0, bisect.bisect_right(outs, out_t) - 1)
    w = tl[i]
    return round(w['src'] + (out_t - w['out']), 3)
LOGO = "assets/brands/nomi/logo_icon.png"
sq = dict(size=[800, 800], w=0.6, x=0.69, y=0.45, sfx_gain_db=-5)
def anim(name, out_t, params, **kw):
    d = dict(sq); d.update(kw)
    return dict(kind="anim", name=name, at=src(out_t), params=params, **d)
keep = [q for q in p['popups'] if q.get('preset') == 'slam']
nomi_src = 114.84  # measured audio onset of "Nomi" (drop + flash are synced to it)
p['popups'] = keep + [
    anim("NailPainting", 2.2, {"_speed": 1.5}, size=[900, 900], w=0.56, x=0.73, y=0.36),
    anim("CalendarFull", 4.55, {"x_end": 1.1, "stamp_at": 1.2, "hold": 0.5}),
    anim("HomeCozy", 7.0, {"door_at": 0.6, "hold": 0.9}),
    dict(kind="anim", name="LogoReveal", at=nomi_src - 0.3, params={"logo": LOGO, "hold": 0.0}, **sq),
    anim("SmartphoneAppReveal", 13.25, {"logo": LOGO, "_timemap": [[0, 0], [0.75, 1.25], [1.1, 2.05], [1.4, 2.45],
        [4.6, 2.6], [4.85, 2.72], [5.2, 3.0], [5.9, 3.7], [7.85, 3.85], [8.1, 4.05], [8.6, 4.55], [9.1, 5.0],
        [9.3, 5.2], [10.7, 6.6], [10.85, 6.75], [11.3, 7.2]]}, size=[900, 1500], w=0.52, x=0.73, y=0.42),
    anim("ChatSend", 24.3, {"hold": 0.8}),
    anim("VibeToggle", 27.45, {"quiet_at": 2.46, "fun_at": 5.25, "hold": 0.6}),
    anim("VerifiedStars", 35.2, {"check_at": 0.45, "stars_at": 2.7, "hold": 0.4}),
    anim("LogoReveal", 41.25, {"logo": LOGO, "tagline": "לעסקים", "hold": 0.2}, y=0.39),
    anim("MapCustomers", 42.9, {"hold": 0.3}),
    anim("NoNeed", 45.4, {"items": [{"icon": "megaphone", "label": "שיווק", "at": 0.4},
                                     {"icon": "store", "label": "קליניקה", "at": 2.17}], "hold": 0.6}),
    anim("LogoReveal", 53.6, {"logo": LOGO, "tagline": "הורידו עכשיו", "hold": 1.2, "exit": False}, y=0.39),
]
# sounds of the replaced pop-ups (stamp, text logo, chips, CTA) go; cut whooshes, slam and riser stay
drop = {("whoosh2", 11.1), ("click", 11.4), ("sparkle", 114.84), ("pop2", 114.84), ("pop", 283.02),
        ("pop", 311.47), ("pop", 312.89), ("pop2", 412.08), ("click", 412.53)}
p['sfx'] = [s for s in p['sfx'] if (s['name'], s['at']) not in drop]
p['style']['sfx_gain_db'] = -3
p['style']['caption_logos'] = {'Nomi': '/home/user/Yoav/' + LOGO}  # the word "Nomi" shows as the logo
json.dump(p, open('plan_v4_hook1.json', 'w'), ensure_ascii=False, indent=1)
for q in p['popups']: print(q.get('name', q.get('preset')), q['at'])
print(len(p['sfx']), 'sfx')
