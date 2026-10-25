#!/usr/bin/env python3
"""Interview auto-editor: transcribe (Hebrew) -> detect Q&A / silences / mistakes
-> render a cut MP4 with dynamic zooms and animated Hebrew subtitles.

Steps (each writes into the work dir so you can inspect / hand-edit between them):
  transcribe  video -> work/transcript.json   (faster-whisper, word timestamps)
  analyze     transcript -> work/edl.json     (keep ranges, Q/A labels, cut reasons)
  render      video + edl -> output.mp4       (cuts, zooms, burned-in ASS subtitles)
  all         run the three steps in a row

Without a speech model you can still run `analyze --silence-only`, which cuts
silences with FFmpeg's silencedetect (no subtitles, no Q&A, no mistake removal).
"""
import argparse
import json
import os
import re
import subprocess
import sys

FILLERS = {"אה", "אהה", "אההה", "אמ", "אממ", "אמממ", "אהמ", "הממ", "ממ", "אממה", "eh", "uh", "um", "umm", "hmm"}
QUESTION_WORDS = ("מה", "למה", "מדוע", "איך", "כיצד", "מתי", "איפה", "היכן", "מי", "האם", "כמה", "איזה", "איזו", "אילו", "מאיפה", "לאן", "ספר", "ספרי", "תספר", "תספרי")
PUNCT = "\"'.,!?;:()[]-–—…״׳"


def run(cmd, **kw):
    print("+", " ".join(cmd) if len(" ".join(cmd)) < 400 else cmd[0] + " ... (long)", file=sys.stderr)
    return subprocess.run(cmd, check=True, **kw)


def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-print_format", "json", "-show_streams", "-show_format", path],
                         check=True, capture_output=True, text=True).stdout
    info = json.loads(out)
    v = next(s for s in info["streams"] if s["codec_type"] == "video")
    num, den = map(int, v.get("avg_frame_rate", "30/1").split("/"))
    rot = 0
    for sd in v.get("side_data_list", []):
        rot = int(sd.get("rotation", 0) or 0)
    w, h = int(v["width"]), int(v["height"])
    if abs(rot) in (90, 270):
        w, h = h, w
    return {"w": w, "h": h, "fps": num / den if den else 30.0, "duration": float(info["format"]["duration"]),
            "has_audio": any(s["codec_type"] == "audio" for s in info["streams"])}


def norm(word):
    return word.strip().strip(PUNCT).lower()


# ---------------------------------------------------------------- transcribe
def cmd_transcribe(a):
    from faster_whisper import WhisperModel
    os.makedirs(a.work, exist_ok=True)
    wav = os.path.join(a.work, "audio16k.wav")
    run(["ffmpeg", "-y", "-v", "error", "-i", a.video, "-vn", "-ac", "1", "-ar", "16000", wav])
    model = WhisperModel(a.model, device="auto", compute_type=a.compute_type)
    # The prompt nudges Whisper toward verbatim output (keeping fillers / false starts)
    # so the analyzer can find and remove them; Whisper otherwise "cleans" speech.
    segments, info = model.transcribe(
        wav, language=a.language, word_timestamps=True, beam_size=5, vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 300},
        initial_prompt="אה, אמ... כן. אז, אממ, מה שרציתי להגיד זה... שאלה: מה דעתך?",
        condition_on_previous_text=False)
    out = {"language": info.language, "duration": info.duration, "segments": []}
    for s in segments:
        words = [{"w": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3), "p": round(w.probability, 3)}
                 for w in (s.words or []) if w.word.strip()]
        out["segments"].append({"s": round(s.start, 3), "e": round(s.end, 3), "text": s.text.strip(), "words": words})
        print(f"[{s.start:7.2f}-{s.end:7.2f}] {s.text.strip()}", file=sys.stderr)
    path = os.path.join(a.work, "transcript.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f"wrote {path}  ({len(out['segments'])} segments)")


# ---------------------------------------------------------------- analyze
def split_sentences(segments):
    """Re-split Whisper segments into sentences on . ? ! and long pauses."""
    sents, cur = [], []
    words = [w for s in segments for w in s["words"]]
    for i, w in enumerate(words):
        cur.append(w)
        nxt = words[i + 1] if i + 1 < len(words) else None
        if nxt is None or w["w"].rstrip("\"'״").endswith((".", "?", "!")) or nxt["s"] - w["e"] > 1.2:
            sents.append(cur)
            cur = []
    return sents


def is_question(words):
    text = " ".join(w["w"] for w in words).strip()
    if text.rstrip("\"'״").endswith("?"):
        return True
    first = norm(words[0]["w"]) if words else ""
    return first in QUESTION_WORDS and len(words) <= 25


def mark_mistakes(sents):
    """Return per-word drop flags + reasons: fillers, stutters, false starts."""
    flat = [w for s in sents for w in s]
    drop = [None] * len(flat)
    for i, w in enumerate(flat):
        n = norm(w["w"])
        if n in FILLERS:
            drop[i] = "filler"
        elif i + 1 < len(flat) and n and n == norm(flat[i + 1]["w"]) and flat[i + 1]["s"] - w["e"] < 0.6:
            drop[i] = "stutter"  # "אני אני" -> keep the second
    # False start: a phrase restarted with the same 2+ opening words within a few seconds.
    # Drop the abandoned attempt, keep the last take.
    for i in range(len(flat)):
        for j in range(i + 2, min(i + 15, len(flat) - 1)):
            if flat[j]["s"] - flat[i]["s"] > 8:
                break
            if all(norm(flat[i + k]["w"]) == norm(flat[j + k]["w"]) for k in range(2)) and norm(flat[i]["w"]):
                for k in range(i, j):
                    drop[k] = drop[k] or "false-start"
                break
    return flat, drop


def cmd_analyze(a):
    meta = probe(a.video)
    if a.silence_only:
        return analyze_silence_only(a, meta)
    with open(os.path.join(a.work, "transcript.json"), encoding="utf-8") as f:
        tr = json.load(f)
    sents = split_sentences(tr["segments"])
    flat, drop = mark_mistakes(sents)
    # label sentences
    idx, blocks = 0, []
    for s in sents:
        blocks.append({"type": "question" if is_question(s) else "answer",
                       "s": s[0]["s"], "e": s[-1]["e"], "text": " ".join(w["w"] for w in s),
                       "word_idx": list(range(idx, idx + len(s)))})
        idx += len(s)
    for i, w in enumerate(flat):
        w["drop"] = drop[i]
        w["block"] = next(bi for bi, b in enumerate(blocks) if i in b["word_idx"])
    # build keep ranges from kept words: merge when the gap is short, pad edges
    pad, gap = a.pad, a.max_gap
    keep = []
    for w in flat:
        if w["drop"]:
            continue
        s, e = max(0.0, w["s"] - pad), min(meta["duration"], w["e"] + pad)
        if keep and s - keep[-1]["e"] <= gap and keep[-1]["block_type"] == blocks[w["block"]]["type"]:
            keep[-1]["e"] = max(keep[-1]["e"], e)
        else:
            if keep and s < keep[-1]["e"]:
                s = keep[-1]["e"]
            keep.append({"s": s, "e": e, "block_type": blocks[w["block"]]["type"]})
    keep = [k for k in keep if k["e"] - k["s"] >= 0.25]
    cuts = [{"w": w["w"], "s": w["s"], "e": w["e"], "reason": w["drop"]} for w in flat if w["drop"]]
    edl = {"source": os.path.abspath(a.video), "meta": meta, "keep": keep, "blocks": [
        {k: b[k] for k in ("type", "s", "e", "text")} for b in blocks], "words": flat, "cut_words": cuts}
    with open(os.path.join(a.work, "edl.json"), "w", encoding="utf-8") as f:
        json.dump(edl, f, ensure_ascii=False, indent=1)
    kept = sum(k["e"] - k["s"] for k in keep)
    print(f"blocks: {sum(b['type'] == 'question' for b in blocks)} questions / "
          f"{sum(b['type'] == 'answer' for b in blocks)} answers")
    print(f"removed words: {len(cuts)} ({', '.join(sorted({c['reason'] for c in cuts})) or 'none'})")
    print(f"duration {meta['duration']:.1f}s -> {kept:.1f}s in {len(keep)} clips")
    for b in blocks:
        print(f"  {'Q' if b['type'] == 'question' else 'A'} [{b['s']:7.2f}] {b['text'][:90]}")


def analyze_silence_only(a, meta):
    os.makedirs(a.work, exist_ok=True)
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", a.video, "-vn", "-af",
                        f"silencedetect=noise={a.noise}dB:d={a.max_gap}", "-f", "null", "-"],
                       capture_output=True, text=True)
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", r.stderr)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", r.stderr)]
    sil = list(zip(starts, ends + [meta["duration"]] * (len(starts) - len(ends))))
    keep, t = [], 0.0
    for s, e in sil:
        if s - t > 0.25:
            keep.append({"s": max(0, t - a.pad if t else 0), "e": min(meta["duration"], s + a.pad), "block_type": "answer"})
        t = e
    if meta["duration"] - t > 0.25:
        keep.append({"s": max(0, t - a.pad), "e": meta["duration"], "block_type": "answer"})
    edl = {"source": os.path.abspath(a.video), "meta": meta, "keep": keep, "blocks": [], "words": [], "cut_words": []}
    with open(os.path.join(a.work, "edl.json"), "w", encoding="utf-8") as f:
        json.dump(edl, f, ensure_ascii=False, indent=1)
    print(f"silences found: {len(sil)}; duration {meta['duration']:.1f}s -> "
          f"{sum(k['e'] - k['s'] for k in keep):.1f}s in {len(keep)} clips")


# ---------------------------------------------------------------- render
def ass_time(t):
    t = max(0.0, t)
    return f"{int(t // 3600)}:{int(t % 3600 // 60):02d}:{t % 60:05.2f}"


def build_ass(edl, w, h, font):
    """Animated subtitles: 2-4 word chunks that pop in, current word highlighted."""
    keep = edl["keep"]
    offs, acc = [], 0.0
    for k in keep:
        offs.append(acc)
        acc += k["e"] - k["s"]

    def remap(t):
        for k, o in zip(keep, offs):
            if k["s"] <= t <= k["e"]:
                return o + t - k["s"]
        return None

    words = []
    for wd in edl["words"]:
        if wd.get("drop"):
            continue
        s, e = remap((wd["s"] + wd["e"]) / 2), None
        s0, e0 = remap(wd["s"]), remap(wd["e"])
        if s is None:
            continue
        words.append({"w": wd["w"].strip(), "s": s0 if s0 is not None else s, "e": e0 if e0 is not None else s + 0.2,
                      "q": edl["blocks"][wd["block"]]["type"] == "question"})
    # chunk words into short caption lines
    chunks, cur = [], []
    for i, wd in enumerate(words):
        max_words, max_chars = (12, 70) if wd["q"] else (4, 22)
        # don't strand the last word of a sentence alone on its own caption
        last_of_sentence = wd["w"].endswith((".", "?", "!")) and len(cur) == max_words
        if cur and ((len(cur) >= max_words and not last_of_sentence) or wd["s"] - cur[-1]["e"] > 0.6
                    or wd["q"] != cur[-1]["q"] or sum(len(x["w"]) for x in cur) > max_chars):
            chunks.append(cur)
            cur = []
        cur.append(wd)
        if wd["w"].endswith((".", "?", "!", ",")):
            chunks.append(cur)
            cur = []
    if cur:
        chunks.append(cur)

    fs = round(h * 0.062)
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {w}
PlayResY: {h}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: A,{font},{fs},&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,{max(2, fs // 14)},{max(1, fs // 30)},2,60,60,{round(h * 0.09)},-1
Style: Q,{font},{round(fs * 0.85)},&H00FFFFFF,&H00FFFFFF,&H00000000,&HB0202020,1,0,0,0,100,100,0,0,3,{max(6, fs // 5)},0,8,60,60,{round(h * 0.06)},-1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    hi = "&H0000D7FF&"  # highlight colour (BGR): gold
    lines = []
    for c in chunks:
        style = "Q" if c[0]["q"] else "A"
        start, end = c[0]["s"], max(c[-1]["e"], c[0]["s"] + 0.5)
        clean = [x["w"].replace("{", "").replace("}", "") for x in c]
        if style == "Q":  # questions: one static box at the top, no per-word animation
            pop = r"{\fad(120,80)}"
            lines.append(f"Dialogue: 0,{ass_time(start)},{ass_time(end)},Q,,0,0,0,,{pop}" + " ".join(clean))
            continue
        for i, x in enumerate(c):
            s = x["s"] if i else start
            e = c[i + 1]["s"] if i + 1 < len(c) else end
            if e <= s:
                continue
            txt = " ".join((r"{\c" + hi + r"}" + t + r"{\c&H00FFFFFF&}") if j == i else t for j, t in enumerate(clean))
            # pop-in only on the first word of the chunk; later words just move the highlight
            anim = r"{\fscx80\fscy80\t(0,120,\fscx105\fscy105)\t(120,200,\fscx100\fscy100)}" if i == 0 else ""
            lines.append(f"Dialogue: 0,{ass_time(s)},{ass_time(e)},A,,0,0,0,,{anim}{txt}")
    return head + "\n".join(lines) + "\n"


def zoom_plan(keep, strength):
    """Per clip: (z_start, z_end). Questions stay wide; answers alternate punch-in
    (hides jump cuts) and slow push-ins on long takes."""
    plan, toggle = [], False
    for k in keep:
        d = k["e"] - k["s"]
        if k["block_type"] == "question":
            plan.append((1.0, 1.0))
            toggle = False
            continue
        toggle = not toggle
        base = 1.0 if toggle else 1.0 + strength
        plan.append((base, base + (strength * 0.6 if d > 4 else 0.0)))
    return plan


def cmd_render(a):
    with open(os.path.join(a.work, "edl.json"), encoding="utf-8") as f:
        edl = json.load(f)
    meta = edl["meta"]
    src = a.video or edl["source"]
    W, H = (meta["w"] // 2) * 2, (meta["h"] // 2) * 2
    if a.height and a.height < H:
        W, H = round(W * a.height / H / 2) * 2, a.height
    fx, fy = map(float, a.focus.split(","))
    keep, plan = edl["keep"], zoom_plan(edl["keep"], 0 if a.no_zoom else a.zoom)
    parts, labels = [], []
    for i, (k, (z0, z1)) in enumerate(zip(keep, plan)):
        d = k["e"] - k["s"]
        # eased zoom: z(t) = z0 + (z1-z0) * smoothstep(t/d)
        z = f"({z0}+({z1 - z0})*(3*pow(min(t/{d:.3f},1),2)-2*pow(min(t/{d:.3f},1),3)))"
        v = (f"[0:v]trim=start={k['s']:.3f}:end={k['e']:.3f},setpts=PTS-STARTPTS,"
             f"scale=w='2*trunc({W}*{z}/2)':h='2*trunc({H}*{z}/2)':eval=frame:flags=bicubic,"
             f"crop={W}:{H}:x='(iw-{W})*{fx}':y='(ih-{H})*{fy}',setsar=1,fps={meta['fps']:.3f}[v{i}]")
        fade = min(0.02, d / 4)
        au = (f"[0:a]atrim=start={k['s']:.3f}:end={k['e']:.3f},asetpts=PTS-STARTPTS,"
              f"afade=t=in:d={fade:.3f},afade=t=out:st={d - fade:.3f}:d={fade:.3f}[a{i}]")
        parts += [v, au]
        labels.append(f"[v{i}][a{i}]")
    graph = ";\n".join(parts) + f";\n{''.join(labels)}concat=n={len(keep)}:v=1:a=1[cv][ca]"
    if edl["words"] and not a.no_subs:
        ass = os.path.abspath(os.path.join(a.work, "subs.ass"))
        with open(ass, "w", encoding="utf-8") as f:
            f.write(build_ass(edl, W, H, a.font))
        graph += f";\n[cv]ass='{ass}'[ov]"
        vout = "[ov]"
    else:
        vout = "[cv]"
    gpath = os.path.join(a.work, "filter.txt")
    with open(gpath, "w", encoding="utf-8") as f:
        f.write(graph)
    meta_args = []
    if edl["blocks"]:
        chap = write_chapters(edl, a.work)
        meta_args = ["-i", chap, "-map_metadata", "1", "-map_chapters", "1"]
    run(["ffmpeg", "-y", "-hide_banner", "-v", "warning", "-stats", "-i", src, *meta_args,
         "-filter_complex_script", gpath, "-map", vout, "-map", "[ca]",
         "-c:v", "libx264", "-preset", a.preset, "-crf", str(a.crf), "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", a.output])
    print(f"wrote {a.output}")


def write_chapters(edl, work):
    """One chapter per question, mapped onto the edited timeline (MP4 chapter markers)."""
    keep = edl["keep"]
    offs, acc = [], 0.0
    for k in keep:
        offs.append(acc)
        acc += k["e"] - k["s"]
    marks = []
    for b in edl["blocks"]:
        if b["type"] != "question":
            continue
        for k, o in zip(keep, offs):
            if k["e"] >= b["s"]:
                marks.append((o + max(0, b["s"] - k["s"]), b["text"]))
                break
    path = os.path.join(work, "chapters.txt")
    with open(path, "w", encoding="utf-8") as f:
        f.write(";FFMETADATA1\n")
        bounds = marks + [(acc, None)]
        if not marks or marks[0][0] > 0.5:
            bounds = [(0.0, "פתיחה")] + bounds
        for (s, title), (e, _) in zip(bounds, bounds[1:]):
            t = re.sub(r"[=;#\\\n]", " ", title)[:80]
            f.write(f"[CHAPTER]\nTIMEBASE=1/1000\nSTART={int(s * 1000)}\nEND={int(e * 1000)}\ntitle={t}\n")
    return path


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    def common(sp):
        sp.add_argument("video")
        sp.add_argument("--work", default="work")

    t = sub.add_parser("transcribe"); common(t)
    an = sub.add_parser("analyze"); common(an)
    r = sub.add_parser("render"); common(r)
    al = sub.add_parser("all"); common(al)
    for sp in (t, al):
        sp.add_argument("--model", default="ivrit-ai/whisper-large-v3-turbo-ct2",
                        help="faster-whisper model: HF repo id (Hebrew fine-tune by default), name like large-v3, or local dir")
        sp.add_argument("--language", default="he")
        sp.add_argument("--compute-type", default="int8")
    for sp in (an, al):
        sp.add_argument("--pad", type=float, default=0.12, help="seconds kept around speech")
        sp.add_argument("--max-gap", type=float, default=0.45, help="pauses longer than this are cut")
        sp.add_argument("--silence-only", action="store_true", help="no transcript: cut silences only")
        sp.add_argument("--noise", type=float, default=-35, help="silencedetect threshold (dB)")
    for sp in (r, al):
        sp.add_argument("-o", "--output", default="edited.mp4")
        sp.add_argument("--zoom", type=float, default=0.15, help="punch-in amount (0.15 = 115%%)")
        sp.add_argument("--no-zoom", action="store_true")
        sp.add_argument("--no-subs", action="store_true")
        sp.add_argument("--focus", default="0.5,0.35", help="zoom anchor x,y in 0..1 (face position)")
        sp.add_argument("--font", default="DejaVu Sans")
        sp.add_argument("--height", type=int, default=1080, help="max output height")
        sp.add_argument("--crf", type=int, default=20)
        sp.add_argument("--preset", default="medium")
    a = p.parse_args()
    if a.cmd == "transcribe" or (a.cmd == "all" and not a.silence_only):
        cmd_transcribe(a)
    if a.cmd in ("analyze", "all"):
        cmd_analyze(a)
    if a.cmd in ("render", "all"):
        cmd_render(a)


if __name__ == "__main__":
    main()
