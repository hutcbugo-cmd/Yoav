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

## How this client likes it (learned on Nomi, approved v9; `examples/plan_nomi_v9_hook1.example.json`)
- Captions: `caption_mode: "plain"`: white, no stroke, no colour fill, soft shadow; `caption_size` 0.14,
  two balanced lines (`line_spacing` 0.78), at 0.72 H. Brand words stay as words.
- Motion graphics over generic pop-ups: vanim animations that illustrate the exact words (no emoji-only
  stickers). Centred between chin and captions, one at a time, never on the face or captions. Real photos
  from the client beat drawn stand-ins. Brand logo animates in on every mention of the brand.
- Framing: level the horizon (`roll_deg`), centre face + body (`body_weight`), punch-ins on emphasis.
- Pace: no dead air anywhere. Check gaps with voicing (pitch), not energy (wind hides silence). Cut leftover
  words to the director ("okay").
- Sound: music under speech, not over it (−11 dB, duck ratio 5); SFX on every animation beat; gentle
  dialogue clean-up with presence; −14 LUFS, limiter −3 dBFS.
- Process: a short preview first, then the full video. Render one hook until it is approved, then reuse the
  approved edit for other hooks (source-anchored cues). Answer fast and in Hebrew.

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
- Noisy/windy field audio: DeepFilterNet3 (MIT). `pip install torch torchaudio deepfilternet` (PyPI; download.pytorch.org
  is blocked), then `pip install "numpy>=2.1"` again (deepfilternet pins numpy<2, which breaks OpenCV). Patch
  `df/io.py`: wrap `from torchaudio.backend.common import AudioMetaData` in try/except. Model: github.com is blocked,
  so fetch `https://raw.githubusercontent.com/Rikorose/DeepFilterNet/main/models/DeepFilterNet3.zip` and unzip.
  Run `examples/survey/enhance_df.example.py`. RNNoise (`assets/models/std.rnnn`, BSD) is the light fallback.
- Watch sticker: client photo of the L&P watch (dial reads "poedagar" — confirm with client); cut out with
  GrabCut + flat-background removal, lower strap faded (see Round 4 in the feedback log). Ask the client to re-send it.

## Brand assets
- Nomi: `assets/brands/nomi/` (app icon from the client, low-res; see its README). Client rule (round 16): keep
  the word "Nomi" in the captions and show the LogoReveal animation at the same moment. `caption_logos`
  (word → logo image) exists but is off for Nomi.
- Nomi layout (v9): captions at 0.72 H; animations centred between chin and captions
  (squares w 0.58 at y 0.495, phone w 0.42), one at a time; `examples/build_nomi_v9.example.py`. Pass it to vanim as
  `"logo": "assets/brands/nomi/logo_icon.png"` (SmartphoneAppReveal splash + header).
- Animation engine: `docs/animation-engine.md` (`vanim/`, `vanim.py`, pop-up kind `anim`).

## Nomi explainer (16:9), done
VO: the client's ElevenLabs take (voice "Posh", one recording) used as is. Sentence starts come from Whisper +
energy onset (`examples/explainer/vo_starts_elevenlabs.json`), and `make_explainer_vo.py` sets each scene on its
sentence. 27.9 s, −14.4 LUFS. To swap the voice again, send a new recording; the animation re-renders in ~10 min
(cache in the scratchpad) or ~2 min if the cache survived.
