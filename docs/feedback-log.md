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
