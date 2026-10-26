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
PF = "assets/brands/nomi/portfolio/"
# layout: everything stays above the caption band (bottom <= 0.60 H) and never overlaps in time
sq = dict(size=[800, 800], w=0.6, x=0.69, y=0.42, sfx_gain_db=-5)
def anim(name, out_t, params, **kw):
    d = dict(sq); d.update(kw)
    return dict(kind="anim", name=name, at=src(out_t), params=params, **d)
keep = [q for q in p['popups'] if q.get('preset') == 'slam']
nomi_src = 114.84  # measured audio onset of "Nomi" (drop + flash are synced to it)
PHONE = dict(size=[900, 1500], w=0.52, x=0.73, y=0.355)
p['popups'] = keep + [
    anim("NailPainting", 2.2, {"_speed": 1.7}, size=[900, 900], w=0.56, x=0.74, y=0.33),
    anim("CalendarFull", 4.7, {"x_end": 1.0, "stamp_at": 1.0, "hold": 0.5}),
    anim("HomeCozy", 7.0, {"door_at": 0.6, "hold": 0.9}),
    dict(kind="anim", name="LogoReveal", at=nomi_src - 0.3, params={"logo": LOGO, "hold": 0.0}, **sq),
    # app section: phone (search -> results), portfolio on "תיק העבודות", phone again (book)
    anim("SmartphoneAppReveal", 13.5, {"logo": LOGO, "exit_at": 2.65, "_timemap": [[0, 0], [0.75, 1.25],
        [1.1, 2.05], [1.4, 2.45], [3.95, 2.65], [4.4, 3.1]]}, **PHONE),
    anim("PortfolioGallery", 17.95, {"hold": 0.4, "photos": [  # real work photos from the client
        {"src": PF + "sage.jpg", "pos": "55% 32%"}, {"src": PF + "nude_shimmer.jpg", "pos": "45% 60%"},
        {"src": PF + "milky_white.jpg", "pos": "35% 55%"}]}),
    anim("SmartphoneAppReveal", 20.4, {"logo": LOGO, "content_offset": 2.85, "_timemap": [[0, 0], [0.95, 1.2],
        [3.65, 3.9], [4.1, 4.35]]}, **PHONE),
    anim("ChatSend", 24.55, {"hold": 0.8, "photo": PF + "sage.jpg"}),
    anim("VibeToggle", 27.45, {"quiet_at": 2.46, "fun_at": 5.25, "hold": 0.6}),
    anim("VerifiedStars", 35.2, {"check_at": 0.45, "stars_at": 2.7, "hold": 0.0}),
    anim("BusinessSignup", 39.1, {"type_at": 0.3, "chips_at": 0.9, "tap_at": 1.2, "badge_at": 1.45, "hold": 0.0}),
    anim("LogoReveal", 41.3, {"logo": LOGO, "tagline": "לעסקים", "hold": 0.2}, y=0.39),
    anim("MapCustomers", 43.05, {"hold": 0.2}),
    anim("NoNeed", 45.45, {"items": [{"icon": "megaphone", "label": "שיווק", "at": 0.34},
                                      {"icon": "store", "label": "קליניקה", "at": 2.12}], "hold": 0.6}),
    anim("LogoReveal", 53.6, {"logo": LOGO, "tagline": "הורידו עכשיו", "hold": 1.2, "exit": False}, y=0.39),
]
# sounds of the replaced pop-ups (stamp, text logo, chips, CTA) go; cut whooshes, slam and riser stay
drop = {("whoosh2", 11.1), ("click", 11.4), ("sparkle", 114.84), ("pop2", 114.84), ("pop", 283.02),
        ("pop", 311.47), ("pop", 312.89), ("pop2", 412.08), ("click", 412.53)}
p['sfx'] = [s for s in p['sfx'] if (s['name'], s['at']) not in drop]
p['style']['sfx_gain_db'] = -3
p['style']['caption_logos'] = {'Nomi': '/home/user/Yoav/' + LOGO}  # the word "Nomi" shows as the logo
json.dump(p, open('plan_v5_hook1.json', 'w'), ensure_ascii=False, indent=1)
for q in p['popups']: print(q.get('name', q.get('preset')), q['at'])
print(len(p['sfx']), 'sfx')
