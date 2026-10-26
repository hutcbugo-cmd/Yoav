# Animation engine (vanim): architecture, evaluation, status

## Goal
Replace static PNG pop-ups with motion design built from the meaning of the dialogue: real 3D,
UI demos and illustrated effects, with sound placed on the frames where things happen.

## Architecture (built)
```
vplan.py  (plan.json → ffmpeg graph)          ← unchanged path for everything else
   │  popups: {"kind": "anim", "name": "NailPainting", "at": <source s>, "params": {...},
   │           "size": [900, 900], "w": 0.5, "x": 0.75, "y": 0.42, "sfx_gain_db": -10}
   ▼
vanim.py  render() → cache by name+params+size+fps+module source; sfx_cues(); place_cue()
   ▼
vanim/render.js   Playwright + the pre-installed Chromium (WebGL via SwiftShader, CPU)
   │  local HTTP server → vanim/stage.html → vanim/lib/<Name>.js
   │  for each frame: __frame(t) then screenshot #root with alpha → f_00000.png …
   ▼
info.json {w, h, fps, n, duration, sfx: [{t, name, gain}]}
```
- An animation module exports `setup(root, params, W, H)` → `{duration, sfx}` and `frame(t)`.
  A frame is a pure function of t (no rAF, no wall clock), so renders are reproducible and slow
  3D frames never drop.
- Anything Chromium draws can be used: three.js (MIT) for real 3D with physically based
  materials, HTML/CSS 3D for UI demos, SVG, canvas 2D, and later lottie-web (MIT, npm).
- Alpha is preserved end to end (PNG sequence → ffmpeg `overlay`).
- Sound: each animation lists its cues. Clicks, pops and impacts are aligned on their peak,
  and the rest start on the cue. Sounds missing from the library are synthesised (`brush`).
- Standalone preview: `python3 vanim.py <Name> --sfx-dir … -o out.mp4 [--bg footage.mp4 …]`.
- Cost: on 4 CPU cores, NailPainting renders 126 frames at 900² in about 65 s, and
  SmartphoneAppReveal renders 216 frames at 900×1500 in about 55 s.

## Library (status)
| Animation | Technique | Status |
|---|---|---|
| NailPainting | three.js 3D: bent nail-plate mesh, polish painted into its texture by the brush strokes, clearcoat + studio reflections, gloss sweep, sparkles | built (Demo A) |
| SmartphoneAppReveal | CSS 3D phone with a real HTML Hebrew UI: splash → search → results → profile → date/time → confirmation tick + confetti | built (Demo B) |
| CoinBurst, AppointmentBooking (calendar only), BeautyTransformation, ProductPopUp, SparkleReveal | same contract | next, after approval |
| Older presets in `vmotion.py` (slam, stamp_x, chips, logo, cta) | Pillow frames | kept, still used |

## Options evaluated
| Option | Verdict |
|---|---|
| **Remotion** (React video) | Fits well technically: npm is reachable and Chromium is installed. **But its licence is free only for individuals, non-profits and companies of up to 3 employees**; bigger companies need a paid Company License (`remotion` 4.0.538 LICENSE.md). Also, remotion.dev is blocked from this container. vanim uses the same idea (deterministic browser frames) without the licence question, and its modules can be ported to Remotion later if the licence is bought. |
| SVG / vector | Available now inside vanim (SVG in the page). |
| Lottie | lottie-web (MIT) installs from npm. Useful for designer-made .json files from LottieFiles. Check each file's licence; the CDN (jsdelivr) is blocked, so install it from npm. |
| Procedural 2D/3D | Built: three.js + CSS 3D + canvas. This is real 3D rendering, not AI generation. |
| Alpha compositing | Built (PNG with alpha → overlay). ProRes 4444 / qtrle are available if an alpha video file is needed. |
| AI image APIs (custom assets, e.g. a photoreal nail, a product cut-out) | Not connected: no credentials, and the hosts are not allowed in this container's network policy. Indicative prices (unverified secondary sources, check before budgeting): OpenAI gpt-image-1 ≈ $0.04 per 1024² image, more for large or transparent ones; gpt-image-2 has transparent backgrounds in preview, priced per token; hosted FLUX/SD ≈ $0.01–0.04 per image. Best use: generate a still asset with a transparent background, then animate it in vanim. |
| AI video APIs (complex shots) | Not connected (same reasons). Indicative 720p prices: Kling 3.0 ≈ $0.08–0.13/s; Veo 3.1 Lite ≈ $0.03–0.05/s and standard ≈ $0.40/s; Runway Gen-4 Turbo ≈ $0.05/s and Gen-4.5 ≈ $0.12/s; Seedance 2.x ≈ $0.15–0.30/s; fal.ai aggregates many of them behind one key. They output opaque video with no alpha, so the result is a full-frame B-roll insert, not a pop-up overlay. Hebrew text inside generated video is unreliable. |

## Honesty rules
- Call vanim output "3D motion graphics" or "procedural animation". Use "AI-generated" only for
  assets that actually came from a generative model.
- No external API is called and nothing is paid for without the client's approval.

## Next (after approval of the demos)
1. Transcript → animation planner: a catalog of animations with trigger concepts (nail/polish → NailPainting,
   app/booking → SmartphoneAppReveal, money/price → CoinBurst, availability → AppointmentBooking).
   It proposes phrase, time, technique, duration and SFX for each opportunity, for approval.
2. Remaining library modules; real Nomi logo and screens in SmartphoneAppReveal (`logo` param).
3. Optional: an AI-generation adapter (image first) behind a key the client provides.
