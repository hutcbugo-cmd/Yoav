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
- Cost on 4 CPU cores: NailPainting renders 126 frames at 900² in about 45 s (supersample 1.25), and
  SmartphoneAppReveal renders 216 frames at 900×1500 in about 39 s (4 browser workers; WebGL is CPU-bound, so workers don't help 3D).
  Renders are cached, so a re-cut only re-renders what changed.

## Library (status)
| Animation | Technique | Status |
|---|---|---|
| NailPainting | three.js 3D: bent nail-plate mesh, polish painted into its texture by the brush strokes, clearcoat + studio reflections, gloss sweep, sparkles | built (Demo A) |
| SmartphoneAppReveal | CSS 3D phone with a real HTML Hebrew UI: splash → search → results → profile → date/time → confirmation tick + confetti | built (Demo B) |
| LogoReveal | client app icon flips in on the beat (lands at 0.3 s), ring, burst, wordmark, optional tagline pill | built (Nomi v4) |
| CalendarFull | slots struck with drawn red X's, accelerating, then "אין תורים" stamp + shake | built |
| HomeCozy | house bounces in, door shuts, window glows, moon, drifting Zzz (SVG) | built |
| ChatSend | photo bubble flies in, read ticks, typing dots, reply | built |
| VibeToggle | quiet/fun switch timed to the two words, colour shift, notes and bubbles burst | built |
| VerifiedStars | shield flip, tick draws, "verified" pill, stars fill, score counts up | built |
| MapCustomers | map tilts in, pin drops with ripples, customers pop and link, count pill | built |
| NoNeed | icon cards slashed red on their words, grey out | built |
| PortfolioGallery | stack of manicure photo cards (french, ombre, glitter, red, dots) fans out, browsed, favourite lifts with a heart | built (Nomi v5) |
| BusinessSignup | sign-up card: business name types, service chips, button tap, "בעלת עסק" badge stamp + confetti | built (Nomi v5) |
| CoinBurst, BeautyTransformation, ProductPopUp | same contract | next |

SmartphoneAppReveal `content_offset` / `exit_at` split one screen flow across two shots, so another animation
(the portfolio) can take the slot in between.

Layout rules (client): an animation never sits on the captions or on another animation. `vplan` warns when an
`anim` rectangle reaches the caption band or overlaps another `anim` in time and space. Defaults: square
overlays w 0.6 at y 0.42 (bottom 0.59 H), phone w 0.52 at y 0.355.

Timing: `_speed` and `_timemap` ([[out_t, anim_t], …]) retime any module so its beats land on words.
`vplan.py plan.json --dry` prints every word's output time; `examples/build_nomi_v4.example.py` turns
word times into source-time cues. `--draft` renders at half resolution for a quick look.
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
