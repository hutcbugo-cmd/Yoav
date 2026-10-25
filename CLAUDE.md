# StreetUP video editing — start here

Hebrew street-interview / UGC ads, edited by `vedit.py` (transcribe → diarize → report) and
`vplan.py` (render an approved plan). Read `docs/feedback-log.md` (client feedback, root causes,
rules) and `docs/style-references.md` before editing. Reply to the client in Hebrew.

## Current approved style (baseline = v5, `examples/plan_v5.example.json`)
- Cutting: one shot per thought, cut between ideas never inside them; pauses removed; ~25–35 s.
  Keep only clear, confident answers. Client instructions beat reference statistics.
- Framing: interview footage `base_zoom 1.22, face_top 0.13` (little headroom); selfie footage
  (face ≈ 30 % of height) `base_zoom 1.0`. Punch-ins only on cuts / emphasis words.
- Captions: `caption_mode: "fill"`, Assistant ExtraBold, 8.2 % of width, at 70 % height, 2–4 words,
  white with black stroke, spoken word filled #27995F. No box, no white outline.
- Pop-ups: green box (#183D32) with emoji, strike-through `price` card for the reveal, product
  `image` sticker beside the head, white flash on the reveal. Placement is face-aware.
- Sound: Mixkit music "Party" (groove under the hook, drop synced to the price reveal),
  SFX on peaks, dialogue levelled, −14 LUFS.

## Workflow
1. Client sends a Google Drive link → `curl -L "https://drive.usercontent.google.com/download?id=<ID>&export=download&confirm=t"`.
2. `vedit.py transcribe` + `diarize` + `report`; write `work/review.json` (terms: `{"L&P": ["NLP","L&B","LNP"]}`).
3. Write `work/plan.json` (see examples), `python3 vplan.py work/plan.json -o edit.mp4`.
4. QC before sending: frames at every pop-up (faces clear?), cut-edge levels, lip sync, −14 LUFS.
5. Record client feedback + root cause + pipeline fix in `docs/feedback-log.md`.
Approval stages (A analysis → B EDL → C style → D render) unless the client says to just render.

## Restoring assets in a fresh session (not in git)
- `pip install -r requirements.txt opencv-python-headless fonttools` (models download from Hugging Face; needs `huggingface.co` + `*.hf.co` allowed).
- Mixkit (license: social ads OK, no standalone redistribution → never commit the files). Allow `mixkit.co`, `assets.mixkit.co`.
  Music: `https://assets.mixkit.co/music/303/303.mp3` → `m303.mp3` ("Party", drop at 13.95 s).
  SFX (`https://assets.mixkit.co/active_storage/sfx/<id>/<id>-preview.mp3` → `<name>.mp3`):
  pop 2364, pop2 2357, whoosh 1489, whoosh2 1490, riser 1144, impact 1143, money 1989, coin 1999, sparkle 871, click 1109.
- Watch sticker: client photo of the L&P watch (dial reads "poedagar" — confirm with client); cut out with
  GrabCut + flat-background removal, lower strap faded (see Round 4 in the feedback log). Ask the client to re-send it.
