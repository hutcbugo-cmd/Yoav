"""Hook 2 = approved hook 1 (plan_v5_hook1.json, v9) with the opening swapped for the hook-2 take.
Every cue after the hook is source-anchored, so it carries over unchanged."""
import json
p = json.load(open('plan_v5_hook1.json'))
h2 = json.load(open('plan_v2_hook2.json'))
HOOK1 = {6.66, 26.19, 112.0}              # hook-1 opening clips (source starts)
hook2 = [c for c in h2['clips'] if c['s'] < 116]
p['clips'] = hook2 + [c for c in p['clips'] if round(c['s'], 2) not in HOOK1 and c['s'] > 116]
anims = [q for q in p['popups'] if q['at'] > 114]   # logo at "Nomi" onwards stays
sq = {k: v for k, v in anims[0].items() if k in ('size', 'w', 'x', 'y', 'sfx_gain_db')}
A = lambda name, at, params, **kw: dict(dict(kind="anim", name=name, at=at, params=params, **sq), **kw)
p['popups'] = [
    A("NailPainting", 105.2, {"_speed": 1.8}, size=[900, 900], w=0.56, y=0.49),   # paints on "לק ג'ל, מניקור"
    A("HomeCozy", 107.55, {"door_at": 0.8, "hold": 0.4}),                          # door shuts on "לצאת"
    A("CalendarFull", 109.7, {"x_end": 1.2, "stamp_at": 1.45, "hold": 0.3}),       # stamp on "אירוע חשוב"
] + anims
# hook-1 cut whooshes go; hook 2 keeps its one real cut (107.42) and the riser into "Nomi"
p['sfx'] = [s for s in p['sfx'] if s['at'] > 116 or (s['name'] == 'riser' and s['at'] == 114.84)]
p['sfx'].append({"name": "whoosh", "at": 107.42, "gain_db": -22, "dur": 0.6, "align": "peak", "lead": 0.3})
json.dump(p, open('plan_v9_hook2.json', 'w'), ensure_ascii=False, indent=1)
print(len(p['clips']), 'clips;', [(q['name'], q['at']) for q in p['popups']][:5])
