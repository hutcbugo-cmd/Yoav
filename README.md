# Interview auto-editor (Hebrew)

`vedit.py` turns raw interview footage into an edited MP4:

| Feature | How |
|---|---|
| Transcription (Hebrew, word timings) | `faster-whisper` (`large-v3` by default) |
| Question / answer detection | sentence ends in `?` or opens with a question word (מה, למה, איך, האם…) |
| Silence removal | cuts every pause longer than `--max-gap` (default 0.45 s), keeps `--pad` around words |
| Mistake removal | fillers (אה, אמ, הממ…), stutters ("אני אני"), false starts (phrase restarted → keep the last take) |
| Dynamic zoom | questions stay wide; answers alternate wide / 115% punch-in on each jump cut, with an eased slow push-in on takes over 4 s |
| Animated Hebrew subtitles | ASS burned in with libass: 2–4 word captions that pop in, current word highlighted gold, correct RTL; questions shown whole in a box at the top |
| Chapters | one MP4 chapter marker per question |

## Setup

```bash
sudo apt install ffmpeg          # needs libass + libfribidi (standard builds have them)
pip install -r requirements.txt
```

The Whisper model downloads from **huggingface.co** on first use. In a sandbox
whose network policy blocks that host, allow it, or copy a model directory in
and pass `--model /path/to/faster-whisper-large-v3`.

## Usage (step by step)

```bash
# 1. transcribe -> work/transcript.json
python3 vedit.py transcribe interview.mp4

# 2. analyze -> work/edl.json   (prints detected Q/A, removed words, new duration)
python3 vedit.py analyze interview.mp4

#    optional: open work/edl.json and fix anything — e.g. edit "keep" ranges,
#    change a block "type", or fix a word's text (subtitles use these words)

# 3. render -> edited.mp4
python3 vedit.py render interview.mp4 -o edited.mp4
```

Or all at once: `python3 vedit.py all interview.mp4 -o edited.mp4`.

Without a speech model: `python3 vedit.py analyze interview.mp4 --silence-only`
then `render` — silence cuts + zooms only (no subtitles, Q&A or mistake removal).

Useful flags: `--focus 0.5,0.35` (where to zoom toward, as a fraction of
frame width/height — set it to the subject's face), `--zoom 0.15`, `--no-zoom`,
`--font "DejaVu Sans"` (any installed font with Hebrew glyphs), `--height 1080`,
`--crf 20`, `--preset medium`.

## Known limits

- Whisper tends to "clean up" speech, so some fillers and false starts never
  appear in the transcript and can't be cut; the prompt nudges it toward
  verbatim output but it's not guaranteed.
- Q&A detection is text-based, not speaker-based: a question the interviewee
  asks rhetorically will be labelled a question. Fix it in `edl.json`.
- Zoom anchors on a fixed point (`--focus`), not a tracked face.
- Rendering re-encodes with per-frame scaling: roughly real-time at 1080p on 4 CPU cores.
