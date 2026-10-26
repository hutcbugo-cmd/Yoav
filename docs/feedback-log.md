# Feedback log — StreetUP editing system

Each round: what the client flagged, why it happened, and what changed in the
pipeline (not just in one video). "Status" says whether a fix is implemented
*and tested*.

## Round 1 — first render (interview "מרואיינת 3 בונוס", 2:13 → 1:31)

| # | Problem flagged | Root cause | Pipeline change | Status |
|---|---|---|---|---|
| 1 | Too much footage: instructions, weak answers, dead moments | Pipeline only removed silence/fillers; it had no notion of content value, speaker role or production directions | Speaker identification by voice (`diarize`), review report (`report`); content selection & story structure → Stage B | diarize: implemented, tested on 1 video. Selection: not yet |
| 2 | Slow, repetitive pacing; random zooms | Fixed 0.45 s gap threshold; zoom alternated per cut regardless of content | Stage B/C: pacing + emphasis-driven zoom rules | Not yet |
| 3 | Subtitles: top *and* bottom, yellow, wrong font | Questions were styled as a top box by design | Stage C: one position, Assistant font, preset colours (#183D32) | Not yet |
| 4 | No music / SFX | Not implemented | Stage C: needs licensed assets | Not yet — assets needed |
| 5 | Zoom framing inaccurate, too much headroom | Fixed `--focus` point, no face tracking | Stage C: face detection + headroom rule | Not yet |
| 6 | 91 s far too long | No target length / selection | Stage B: 25–40 s target, no padding | Not yet |
| 7 | Rendered without approval | Workflow was one-shot | Approval stages A→D; no render before explicit approval | Adopted |

## Reusable rules learned
- Mono street-interview audio: identify speakers by voice, not by wording.
  The text-only Q/A rule mislabelled 6 of 39 sentences on this video.
- Lines where voice confidence < 0.3 (short words: "כן.", "אה") need review.
- Re-transcribing unclear regions with surrounding context fixes gibberish
  ("נוי נאט" → "לא יודעת").
- In scripted ads, the interviewer's coaching ("עוד פעם", "תגיד ככה…") and the
  first takes before it are production material, never content.

## Round 2 — client notes on the Stage A analysis

| # | Note | Planned pipeline change | Status |
|---|---|---|---|
| 1 | Must have rhythmic music — find a source | Music track + ducking under dialogue; source decided with client (music sites blocked from sandbox) | Waiting on source |
| 2 | Cuts must be fast; drop her repeating the question ("להגיד מי נראה הכי טוב?") — "זריז, קליל, לא לופי" | Tight gaps (pause ≤ 0.15 s), never keep an interviewee echo of the question | Planned (Stage B EDL) |
| 3 | One consistent subtitle position, not yellow | Single position, colour preset (#183D32 accent) | Planned (Stage C) |
| 4 | Chunkier font | Assistant ExtraBold (800) static instance, OFL — downloaded | Asset ready |
| 5 | Less headroom | Face tracking (YuNet, MIT) — measured: head top at 29 %, eyes at 36 % of frame height; she sways 26–66 % horizontally | Model ready, crop logic planned |
| 6 | SFX + pop-ups for rhythm / virality | Intentional SFX + text/emoji pop-ups tied to story beats | Planned (Stage B marks, Stage C preview) |
| 7 | Brand is **L&P** (model heard "NLP" and "L&B") | `terms` glossary in review.json: every variant → canonical name, split tokens rejoined. faster-whisper `hotwords="L&P"` was tested first: fixed 1 of 2 mentions and misplaced it at the sentence end, so it is not used | Implemented, tested on this video |

## Round 3 — render v2 (green light, Mixkit allowed): 2:13 → 29.2 s

Implemented in `vplan.py` (renders an approved plan; reusable for the next video):
- Ordered clips from the Stage B EDL (reordering allowed), quick punch-ins on chosen words (0.12 s eased).
- Face-tracked framing (YuNet, 4 fps): face top held at 13 % of the frame (was 29 %); per-clip check that the face stays inside the crop — 13/13 ok.
- One caption position (70 % height), Assistant ExtraBold, #183D32 box, white text, mint highlight on the spoken word.
- Pop-ups rendered with Pillow (raqm RTL + colour emoji), scale-pop animation.
- Music: "Party" (Arulo, Mixkit Stock Music Free License — allows social ads; files kept out of git, no standalone redistribution). Groove under the hook → hard stop on "שתים עשרה אלף" → drop (track 13.95 s) synced to "500".
- 13 Mixkit SFX aligned on their measured peak (impacts, coins) or with a lead (riser peaks on the cut).
- Dialogue: per-clip RMS levelling, high-pass, light denoise, compression; music ducked by sidechain; −14 LUFS, −1 dBTP.

Found by QC and fixed in the pipeline (not by hand):
- Cuts on Whisper word times landed inside neighbouring words (e.g. the "ר" of "כלומר" audible) → every cut snaps to the quietest 10 ms between words (cut-point level dropped 5–15 dB); 40 ms fades where speech is continuous.
- Mixed Hebrew/number/₪ pop-ups read awkwardly → Hebrew convention "500 ₪".
- Two-emoji pop-up lost its second emoji → canvas sized per emoji.

Rules learned:
- Never cut exactly on ASR word boundaries; snap to the audio.
- Mixkit asset pages: titles follow their audio URL in the HTML.
- Render time for a 30 s 1080×1920 edit with all effects: ~1 min 10 s on 4 cores.

## Round 4 — v3 after studying two reference ads (combined style, no English line)

Client: "80%" on v2; asked to learn from two reference ads, combine both styles, no translation line.
Analysis: `docs/style-references.md`. Changes, all in `vplan.py` (plan: `examples/plan_v3.example.json`):

| Reference finding | Change | Status |
|---|---|---|
| Captions have no box; hard switch; no word highlight | `caption_mode: "clean"`: white + soft shadow, 1–3 words, hard switch | Done |
| Vibe 2 colour-codes speakers | interviewer white, interviewee mint neon with blurred green glow (`clip.speaker`) | Done |
| v2 framing too tight (face 24–30 % of height vs 16 %) | `base_zoom 1.08`, `face_top 0.22` — head, chest and hands visible | Done |
| 60–71 % of reference cuts change size > 15 % | takes split into contiguous sub-shots alternating 1.08 / 1.35 (25 % change); joins keep audio continuous (no snap, no fade, one gain per take) | Done |
| 19–41 % of shots slowly push in | `drift` 4 % per shot | Done |
| Music near speech level | gain −11 dB, ducking ratio 3 | Done |
| Product sticker, white flash | watch cut-out (GrabCut + flat-background cleanup) as `image` pop-ups; `flashes` | Done |
| Story: build tension before the product | added "למה דווקא הבחור עם השעון דירגת הכי גבוה?" / "לא יודעת, נראה הכי טוב" before the price question; ends on her line | Done |

Found in QC and fixed in the pipeline:
- Glow pop-ups at 30 % height covered her eyes after the wider framing → pop-ups above the head (11.5 %), big sticker beside her.
- Video trims whole frames, audio exact samples → lip sync drifted up to 46 ms over 25 shots → cuts now chosen only among frame boundaries (quietest one) → drift 0.07 ms.
- Cut quality: median level at cuts −10.4 dB vs speech; 9/30 cuts still near speech level (words run together / street noise) — 40 ms fades.

Open: the product photo's dial reads "poedagar" while the ad says L&P — client to confirm.

## Round 5 — client: v2 was better than v3 (answers cut better, pace, composition, cuts)

Root causes (my mistakes in v3, not tooling bugs):
1. **Copied a statistic without its cause.** The references cut every 1–2 s because they are montages of *many people*; each cut is a new person. With one interviewee I imitated that rate by splitting single answers into 1 s sub-shots with alternating size — that chops a thought in the middle instead of cutting on meaning.
2. **Overrode an explicit client instruction with a reference measurement.** Client asked for less headroom; v3 widened the frame again (face_top 0.13 → 0.22) because the references are wider.
3. **Added a weak, hesitant answer** ("לא יודעת, נראה הכי טוב") to "build tension" — +5 s and slower pace (29.2 s → 34.7 s).
4. **Effects applied uniformly** (4 % push-in on every shot, size change on every join) instead of only where they add meaning.

Rules (apply to every future edit):
- Client instructions beat reference statistics. References inform *style elements*; pacing comes from the content.
- One shot per thought: cut between answers/ideas, not inside them. Size changes on cuts and on emphasis words only.
- Only keep answers that are clear and confident; a hesitant answer needs a strong reason.
- Baseline for StreetUP edits = v2 cutting, framing and pace (`examples/plan.example.json`).

## Round 6 — v4 = v2 unchanged + pop-ups (client: v2 wins on answers, pace, sounds; captions so-so in both)

Clips, captions, music, framing identical to v2 (`examples/plan_v4.example.json`); cut points only moved to frame boundaries (lip-sync fix from round 4, 29.2 s → 29.5 s).
Added: strike-through price card ("12,000 ₪" crossed in red → "רק 500 ₪ 😱", new `price` pop-up kind), white flash on "500", watch sticker beside her head on "שעון" and on "L&P", reaction emoji (💸 🤔 😂 🎁❤️), two quiet pops for the stickers.
Open: client is not fully happy with the caption style in either version — needs direction (examples) before changing it.

## Round 7 — v5 = v4 with the client's caption style

Client direction: keep everything, same font and vibe, no green box; white text, each spoken word fills dark green (#183D32).
New `caption_mode: "fill"`: white words with a solid black stroke; the spoken word's fill turns the accent colour,
same black stroke. (First try added a white outline around the green word for contrast — client: "don't complicate it",
no white wrap. Rule: implement the client's description literally first; propose extras separately.)
Same chunking, position and pop-in as v2. Plan: `examples/plan_v5.example.json`.
Default caption style for StreetUP from now on: `fill` with the brand's dark accent.
- Round 7b: #183D32 fill disappears on dark clothing → caption fill #27995F (compared 4 shades on the real frame); caption size 7.6 % → 8.2 % of width.
  Rule: test accent colours against the actual background before rendering; brand-dark colours need a lighter variant for text fills.

## Round 8 — second video (iPhone selfie, two soldiers, 15 s → 13.3 s) in the v5 style, no approval stages (client asked "everything included")

New footage exposed four pipeline gaps, all fixed in code:
| Problem | Cause | Fix |
|---|---|---|
| ffmpeg OOM-killed (~14 GB) | iPhone HEVC 10-bit with rotation + 9 extra tracks, decoded per clip | `normalize_source`: one 8-bit H.264 working copy before rendering |
| Colours would be washed-out grey | Source is HDR (HLG, BT.2020) | HDR→SDR tone mapping (zscale + tonemap **mobius**, chosen over hable/naive by comparing frames) |
| "20,000" end clipped by 60 ms | Review deleted the split token ",000." but the merged word kept the first token's end | deleting a token glued to the previous word extends that word's time |
| Pop-ups covered mouths and the tongue-out punchline | Fixed pop-up height (53 %) assumes interview framing; selfie faces sit lower and larger | `place_clear_of_face`: at each pop-up's time, compute the face box in the output frame (incl. zoom) and use default / below chin / above head, whichever is clear |
Selfie framing: faces are already 31 % of frame height → base zoom 1.0 (v5's 1.22 would be too tight), punch-ins +15 % on answers.
Plan: `examples/plan_selfie.example.json`.

## Round 9 — video 3 (Nomi app): Latin brand name inside Hebrew captions

Client: the app is "Nomi" (Latin letters) and must sit on the correct side — a sentence ending with Nomi shows it on the left.
Tested with libass (measured the brand's pixel position): captions starting with a Latin word were laid out left-to-right
("Nomi היא האפליקציה" → Nomi on the left). Fix: every Hebrew caption gets an RLM (U+200F) after its override tags,
forcing a right-to-left base direction; all four test cases now correct. Pop-ups already render with direction="rtl".
Glossary: `{"Nomi": ["נעמי","נומי","לאומי"], "ל-Nomi": ["לנעמי","לנומי"]}`.

## Round 10 — Nomi v1 (7-min single take with director prompts → 55.9 s, full script, hook 1)

New in the pipeline, each found while building this edit:
| Problem | Fix |
|---|---|
| ffmpeg OOM again on a 7-min H.264 source (17 trim branches from one input buffered frames) | one input per clip with an accurate `-ss` seek; render 46 s instead of OOM |
| "Pulse" pop-ups crashed the graph (pad smaller than 1.12× overshoot × 1.07 pulse) | canvas sized from the animation |
| Cut snapping picked the *quietest* point → ~0.25 s dead air per edge (53.7 s script → 58 s) | cut at the first frame where sound reaches background level after the word / last before it; measured: extensions now match real word tails (Whisper ends words early) |
| Animated stickers requested ("AI animations") | `anim`: shake / bounce / float / pulse (procedural, not generative AI — no image/video model available here) |
| Thick, large captions up to 2 lines | `cap_max_words`, `cap_max_chars`, `stroke`, `stroke_color`; pink fill #FF2E8B |
Style for this brand: pink #FF2E8B pop-up boxes + caption fill, black stroke, 9.5 % caption size; music "Fashion" (Arulo, Mixkit), drop at 18.28 s synced to "Nomi". App section (lines 4–11): captions + zooms only, no pop-ups (client will add screen recordings).
Plan: `examples/plan_nomi.example.json`.
- Round 10b: hook 2 version (one take split into 5 joined shots by idea, 7 animated pop-ups on its keywords).
  Found: Whisper put "Nomi" at 114.66 s, but the audio shows a 130 ms gap and the word starts at 114.84 —
  drop, flash and pop-up were 0.18 s early in v1 → synced to the measured onset in both versions.
  Rule: sync music drops / flashes to the audio onset of the word, not the ASR start time.
  Punch-ins capped at ~1.6× total magnification (1.72× visibly softened 1080p).
- Round 10c: hook-2 render peaked at 0.0 dBFS despite loudnorm TP=-1.5 → final alimiter at -1.5 dBFS in every render.

## Round 11 — Nomi v2 (client: "fine, only fine")

| Client note | Root cause (measured) | Fix in the pipeline | Result |
|---|---|---|---|
| "והיא תגיע אלייך" — she isn't looking at the camera | Content choice | Clip removed; rule: drop takes where the presenter looks away | — |
| She sits on the side, cut-zooms/zooms not centred | Static per-clip median crop (face >6 % off-centre in 22 % of frames); and during punch-ins crop used the stale configured `iw`, sliding the face 6–9 % | Smoothed per-frame face tracking (`face_track_expr`); crop position computed from the zoom expression; zooms anchored on the face centre (`face_center_y`) | 0 % of frames off-centre, face height on screen steady 24–27 % (both hooks) |
| Emoji-only pop-ups are cringe; text pop-ups work; wanted more invested animation | Static PNG + generic scale-pop | Emoji-only pop-ups removed. New `vmotion.py`: frame-by-frame motion graphics (slam, stamp_x with drawn X, building chips list, letter-by-letter logo with sparkle burst, CTA button with bouncing arrow) | — |
| "AI animations" | No GPU; open generative models are CPU-infeasible or non-commercial licensed | Procedural motion graphics instead (told the client plainly) | — |
| Music weak, not enough sounds, not enough to keep watching | Music −12 dB with heavy ducking; SFX only on pop-ups | Music −7 dB, ducking ratio 3; whoosh on every real cut, impacts/clicks/pops per animation (27 SFX); spoken-word pop 108 %; 3 % drift on every shot; business section gets a text list | — |
Rules: text-only pop-ups for this client (emoji may sit inside a text pill); measure framing on the rendered output, not just the plan.

## Round 12 — Nomi v3 hook 1 (client: frame feels crooked, she isn't really centred; plain white captions)

| Client note | Root cause (measured) | Fix in the pipeline | Result |
|---|---|---|---|
| Frame feels crooked | Camera roll ≈ 2° (lamp posts 1.8–2.9°, horizon ≈ 1.6°); automatic Hough/grass-line detection failed (few straight lines in a park), verified by eye against guide lines | `framing.roll_deg`: levelled working copy (`rotate` + scale by cos a + (max/min)·sin a + crop) made once in `normalize_source` | Lamp post vertical in the output |
| She isn't really in the middle | Crop centred on the face, but the torso sits ≈ 0.13 of the frame width right of the face, so the person as a whole looked off-centre | `body_offset` (PP-HumanSeg torso mask, cached) + `framing.body_weight` blends face and body centres | Face + body centred in preview frames |
| No "?" after "תיק העבודות שלה" | ASR punctuation | review `fix` "שלה?"→"שלה" | — |
| White captions, no stroke, no pink | Style choice | `caption_mode: "plain"`: white, no outline, soft shadow, no word fill, no pop-in | — |
Rule: check the roll on every new camera setup (vertical lines against a guide) before framing.
- Round 12b: "captions really small". In `plain` mode (no stroke) Assistant's Hebrew glyphs render at only ≈ half of
  the ASS font size, so 0.095 W looked like ≈ 0.05 W of letter height. Fix: `caption_size 0.14` for plain captions;
  libass wraps them into two balanced lines. Rule: judge caption size on a rendered frame, not by the number.
- Round 12c: "music a bit too loud" and "less space between caption lines". Music −7 → −11 dB, ducking ratio 3 → 5
  at threshold 0.04 (round 11's −7 dB overcorrected "music weak"). Plain captions now split into two balanced
  lines by `split_lines` (Pillow width) and placed by hand, `line_spacing` 0.78 × font size between line centres
  (libass's own gap ≈ 1.03 ×). Output −14.1 LUFS, peak −1.5 dBFS.

## Round 13 — "still too static": animation engine (vanim)
Client brief: real motion design from the meaning of the dialogue, not static PNG pop-ups.
Root cause: pop-ups were Pillow PNG frames with scale/fade only; no 3D, no UI, nothing illustrating the words.
Fix: new modular engine `vanim/` + `vanim.py` (see docs/animation-engine.md). Chromium is driven frame by frame
(three.js 3D, HTML/CSS 3D, SVG, canvas) into an alpha PNG sequence. Every animation returns its SFX cues, and `vplan`
pop-up kind `anim` composites the animation and places the cues. First modules: NailPainting (3D) and
SmartphoneAppReveal (booking flow). Remotion was evaluated: same approach, but its licence needs a paid Company
License above 3 employees. AI image/video APIs are not connected (no credentials, hosts blocked); costs are documented.
Rule: never call procedural output "AI-generated".

## Round 14 — Nomi v4 hook 1: animations on the key moments
| Client note | Root cause | Fix | Result |
|---|---|---|---|
| Wind cleanup makes May sound weak | afftdn nf=−30 shaved −0.5 dB above 2.5 kHz; music and SFX crowd the voice | highpass 90 Hz + afftdn nr=8 nf=−42 with tracking, −1.5 dB @250 Hz, presence +2.5 dB @3.5 kHz (`denoise_nr`, `presence_db`); all SFX −3 dB (`sfx_gain_db`) | −14.0 LUFS, peak −1.2 dBFS |
| Show the Nomi logo when she says "Nomi" | text-only logo pop-up | client icon in `assets/brands/nomi`; LogoReveal at all three "Nomi" (taglines "לעסקים", "הורידו עכשיו") | — |
| More animations like the demos on key moments | — | 12 animation cues, each locked to a word with `_timemap`: nail paint, calendar X's, house, logo, phone booking flow (retimed to her sentence), chat photo, vibe switch, verified + stars, map, crossed-out icons, end logo | — |
| How to make the tool faster | 4-core CPU, no GPU; whole-source levelling (once, ~12 min) | animation cache, 4 browser workers for HTML (1.4×), 3D supersample 1.25 (−30 %), `--dry` timing, `--draft` half-res preview (≈1.7× faster) | full 55 s hook re-render ≈2 min after the first |
Rules: place overlays from QC frames, not from numbers. Taglines must clear the caption band (≈0.62 H), and nothing may cross the frame edge.
- Round 14b: "when she says Nomi, put the Nomi logo, don't just write Nomi" → `style.caption_logos`
  {"Nomi": icon}: the brand word in a caption is replaced by the logo image, placed in the gap by laying the
  row out right-to-left by hand. libass sizes a font by ascent+descent, so 1 em = 0.7645 × the ASS size for
  Assistant; measured rendered width 642 px vs Pillow 853 px. Prefixes stay glued ("עסק ל-[logo]").
  Logo windows end strictly before the next caption (the first try showed one stale frame).

## Round 15 — Nomi v5 hook 1 ("animations are amazing; not on the captions, not on each other")
| Client note | Root cause | Fix | Result |
|---|---|---|---|
| Add an animation for "תיק העבודות" showing manicure examples | phone showed only a small gallery | PortfolioGallery; phone split into two shots around it (`content_offset`, `exit_at`) | portfolio 17.95–20.4 s, phone before and after |
| Add an animation for "אם את מניקוריסטית… בעלת עסק" | none there | BusinessSignup (type, chips, tap, badge), handing over to the "לעסקים" logo | — |
| Animations sit on the captions / on each other | placement by eye, bottoms at 0.62 H, back-to-back cues overlapping during exits | everything above 0.60 H; vplan layout + overlap warnings; cues re-timed so each starts when the previous has left | 0 warnings |
| (found in QC) true peak +1.0 dBTP | limiter at −1.5 dBFS + AAC encode of a dense SFX mix → inter-sample overs | final limiter −3 dBFS | −14.0 LUFS, −1.8 dBTP |
- Round 15b: "better to use real examples, exactly like this" (client sent 3 manicure photos) → PortfolioGallery
  `photos` [{src, pos}] (bigger cards, object-position keeps the nails in frame) and ChatSend `photo`. Rule: when
  the client has real product/work photos, use them instead of drawn stand-ins. Photos sit in
  `assets/brands/nomi/portfolio/`, git-ignored until their usage rights are confirmed.

## Round 16 — Nomi v6 hook 1 ("animations perfect, position wrong: too far right")
| Client note | Root cause | Fix |
|---|---|---|
| Animations sit too far to the side, want them central | right-side placement (x 0.69–0.74) | all centred x 0.5, between her chin (~0.33 H) and the caption band (0.63 H): squares w 0.5 at y 0.475, phone w 0.38; "דחוף!" slam dropped (it would sit on the centred nail painting) |
| Bring the word "Nomi" back; show the logo at the same time | round 14b replaced the word | `caption_logos` off; the LogoReveal animation shows with the word |
| A stray "okay" before "אני מזמינה" | whisper heard it as "אז" (360.43); clip started there | CTA clip starts at 360.8 on "אני" |
Rule: default overlay position is centre-chest, not the side. Check the start of every clip for leftover words to the director ("okay", "אז").

## Round 17 — Nomi v7 hook 1 ("close to perfect": two fixes)
| Client note | Root cause | Fix |
|---|---|---|
| Silence before "בלי לשווק את עצמך" | Whisper put "בלי" at 310.45; re-transcribing the 2.6 s snippet put the real onset at 310.70 (breath before it); the snap trusted the early time | clip starts at 310.66 with per-clip `snap_start: false` (new option for measured cuts) |
| Animations touch her face and are a bit small | centred overlays had to fit between chin and captions at 0.70 H | captions down to 0.77 H; overlays down and bigger (squares w 0.62 at y 0.52, phone w 0.46, nail w 0.6) |
Note: QC frames past the end of the video return a misleading frame; check the duration first.

## Round 18 — Nomi v8 hook 1 ("almost approved")
| Client note | Root cause | Fix |
|---|---|---|
| Silence before "בלי לשווק" still there | round 17 trimmed only 0.3 s. Pitch tracking showed no voicing 310.60–311.26 (wind noise kept the energy up, so energy-based checks saw "speech"); "בלי" is voiced from 311.29. Whisper had stretched "בלי" over the noise | clip starts 311.22; review `fix` can now retime a word (`s`/`e`) so the caption keeps "בלי"; "שלך" → "בלי" now 0.33 s |
| Captions too low now; smaller gap to the animations | 0.77 H overcorrected | captions 0.745 H; tagline logos raised to y 0.485 |
| (found while fixing) a dry run overwrote the shared `timeline.json` the plan builder reads → every later cue shifted (render failed on 413.56) | one file for all plans | `--dry` writes `timeline_<plan>.json`; builder reads the v3 timeline; late cues anchored by source time |
Rule: find pauses with voicing (pitch), not energy. Wind noise hides silence from energy measurements.
- Round 18b: "a half second of complete silence at ~45 s between 'בסביבה שלך' and 'בלי לשווק'". Measured v8: voice
  continuous 44.0–45.1 s (cut gap 0.11 s) and the music has no drop there. v7 did have a 0.6 s wind-only gap at
  exactly that spot, so the client probably replayed v7. Asked to confirm against v9. Captions raised to 0.72 H;
  overlays slightly smaller to keep clear of them.

## Round 19 — hook 1 approved ("יש לנו את זה 👏"); hook 2 rendered
Hook 1 v9 approved: `examples/plan_nomi_v9_hook1.example.json`.
Hook 2 = the approved plan with the opening swapped for the one-take hook 2 (103.40–115.25, 5 joined sub-shots).
New cues on its words: NailPainting on "לק ג'ל, מניקור", HomeCozy door on "לצאת", CalendarFull stamp on
"אירוע חשוב". Everything after the hook is source-anchored and carries over untouched
(`examples/build_nomi_hook2.example.py`). 52.4 s, −13.9 LUFS.
Rule: anchor cues to source times, so one approved edit can take any hook.
Hook 2 approved by the client ("כן").
Final files: nomi_v9_hook1.mp4, nomi_v9_hook2.mp4 (scratchpad/video3).

## Video 4 — street survey (Maya asks one passer-by 4 questions) + Maya's Nomi app explanation
Client: fast cuts, best answers marked first, Nomi-style captions, good colour and sound, new animations on what
they talk about, end with Maya's app explanation from the Nomi shoot, at most a minute. "Don't make it a
million rounds of fixes."
Built (53.4 s, −13.7 LUFS):
- `make_combined.py`: one combined source = survey take + 5 Nomi segments (levelled copy), with a merged
  transcript (corrections applied), so `vplan` keeps working on a single source.
- vplan: per-clip `face_x` (two-person shot: frame the face nearest that x, from `track_faces_all`),
  per-clip `grade` (S-curve + saturation dehaze for the hazy rooftop footage) and per-clip `body_weight`.
- Cold open on the strongest line ("…אז נסעתי לבאר שבע ללק"), then Q/A cut tight: Maya's question in close-up,
  the answer in close-up, the reaction in the wide two-shot. Clip starts measured by voicing (Q4 "אם" at 44.18,
  not whisper's 43.72).
- New vanim modules: DaysCounter (3–4 weeks), ChatWait (WhatsApp wait), RoadTrip (centre → Be'er Sheva, km
  counter, "בשביל לק?!"), BigButton (press on "בלחיצת כפתור", "ברור!" stamp).
- Music: groove from the top, then the drop lands again on Maya's "Nomi".
Limits: wide 1080p source, so close-ups are digital zoom ≤1.9×. Maya stands at the frame edge (x 0.22), so her
close-up can't be fully centred.
- Video 4 v2 (client notes, all fixed and verified one by one):
  | Note | Root cause | Fix |
  |---|---|---|
  | Hook needs captions | plain mode dropped a chunk whose first word lasted 0.02 s ("אז") — also lost "אז נסעתי לבאר שבע ללק" in the answer | chunk length = chunk end, not first word |
  | Hook: hear her more, add a rise-up | wind as loud as her voice; no build-up | riser ending on Q1 + impact; per-clip leveling after clean-up |
  | Wind loud, interview barely audible | wind ≈ speech level (pause −17.3 vs speech −16.8 LUFS); light afftdn did nothing | per-clip `afilter`: RNNoise `bd.rnnn` (mix 0.9) + presence; wind in pauses −46.5 LUFS. Gain measured after the filter (`filtered_rms`) |
  | Survey colour over-saturated | S-curve + sat 1.3 | gentler curve, sat 1.1 |
  | "הזמינות" cut off | clip ended at whisper's word end; the voice runs 16.10–16.95 | 15.98–16.98, no snap; "של" retimed so the caption matches |
  | Maya's "אמ" before Q4 | voiced 44.22–44.37 | Q4 starts 44.56 ("היית יכולה…") |
  | Road-trip animation in the hook too | — | fast RoadTrip in the cold open |
  | Odd 0.3 s shot of Maya after "Nomi" | clip 122.91 ("את", 0.34 s) | removed; phone re-timed so it doesn't hit the logo or the portfolio |
- Video 4 v3/v4: "sound weak and windy, a better tool must exist; 'הזמינות' still not heard, caption late".
  Root cause: the clip began at 15.98 but the word is voiced 15.70–16.30 (a 20 ms pitch track shows it; the
  30 ms one missed it), so half the word and the caption's start were cut. RNNoise `bd` also ate the word's body.
  Fix: clip 15.62–16.42 (+3 dB `gain_adj`), caption retimed. Survey audio enhanced up front with **DeepFilterNet3**
  (pause wind −17.3 → −31.5 LUFS with the voice kept: "הזמינות" −15.7 → −15.9). Then presence + gentle
  compression per clip. Music −15 dB under the survey. Result: guest +1 dB, "הזמינות" −12.6, total −14.2 LUFS.
  Rule: for field audio, use DeepFilterNet first; RNNoise only as a light fallback.

## Video 5 — street survey #2 (Maya + Noa & Adi, very windy) + Maya's Nomi explanation
55.9 s, −14.2 LUFS. Built on the video-4 pipeline, with one change in order: **DeepFilterNet3 on the whole
take first** (pause wind −15.9 → −63.9 LUFS; in the raw take the wind was louder than speech), then a
re-transcription on the clean audio (clearer words), then cutting.
- Cuts measured on the clean audio (energy works again once the wind is gone); `snap: false` on every survey clip.
- Whisper on the cleaned audio runs ≈0.25 s early. Without a +0.25 s shift the first word of half the clips
  ("מה", "אם", "אני", "האמת") dropped out of the captions. `make_combined` now shifts survey words.
- Left out what can't be verified: the second girl's "soldier" answer and "בייזן חוץ" stayed garbled even after
  enhancement. Rule: don't caption guesses.
- Two-shot of both girls (face_x 0.3), Maya close-up (0.75), cold open on "האמת היא שהתחננתי שהיא תקבל אותי".
- New vanim modules: BookingLoop (books the next one each time), CheckOff (stuck mid-day → tick it off),
  PleaChat (begging messages → referral), SearchFrenzy (search results all "אין זמינות"). BigButton → "ברור שכן!".
- Video 5 v2: Maya's "אמממ" before Q3: re-transcription showed "אה..." 67.98–68.38 that whisper had merged into
  "קרה"; clip now starts 68.50. "הייתן משתמשות" was cut: the word runs to 98.38, the clip ended 98.22 (energy
  threshold too strict on the tail); now 98.44. Rule: before every clip start, look for a filler word that
  whisper merged into the next one; for clip ends, use the 20 ms energy tail, not the run detector.

## Nomi explainer (16:9, 25.7 s) in the Yellow-reference style
Client: "exactly a video like this, landscape, our logo, colours and story, a pleasant female VO, ~30 s".
- VO: Chatterbox Multilingual (Resemble AI, **MIT**; it adds a Perth watermark marking the audio as AI). ElevenLabs,
  OpenAI and Microsoft are blocked here, and Meta MMS Hebrew is non-commercial. Plain Hebrew text came out
  garbled (Whisper similarity 0.6–0.78); **niqqud text → 0.96–1.0**. A single synthetic reference take (no real
  person cloned) keeps one voice across lines (pitch 152–205 Hz). Best of 3 seeds per line, scored by Whisper
  similarity + pitch range; retakes for the 2 weak lines. Install: `pip install --no-deps chatterbox-tts` + deps
  without its torch pins, `setuptools<81` (perth needs pkg_resources), save with soundfile (torchaudio wants
  torchcodec).
- Animation: `vanim/lib/NomiExplainer.js`, one world with 10 scenes on a continuous pink light-trail line, camera
  glides on each VO line with motion blur, 2-line text pulls focus, brand flood end card. 1920×1080, 30 fps.
- Mix: VO −18 LUFS per line, Mixkit "Fashion" ducked under the VO with its drop on "תכירי את נומי", SFX from the
  animation cues, −14.3 LUFS, −2.7 dBTP. Scripts: `examples/explainer/`.
