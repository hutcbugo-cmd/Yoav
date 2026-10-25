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
