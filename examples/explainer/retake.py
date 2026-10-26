import json, re, difflib, numpy as np, torch, soundfile as sf, librosa
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
from faster_whisper import WhisperModel
tts = ChatterboxMultilingualTTS.from_pretrained(device="cpu")
asr = WhisperModel("ivrit-ai/whisper-large-v3-turbo-ct2", device="cpu", compute_type="int8")
strip = lambda s: re.sub(r"[֑-ׇ.,?!\s‫]", "", s)
rep = json.load(open("vo/report.json"))
for lid, variants, ref in [("end", ["נוֹמִי. מָנִיקוּר עַד הַבַּיִת.", "נוֹמִי, מָנִיקוּר עַד הַבַּיִת!"], "נומי מניקור עד הבית"),
                           ("trust", ["כׇּל הַמָּנִיקוּרִיסְטִיּוֹת מְאֻמָּתוֹת, עִם דֵּרוּגִים אֲמִתִּיִּים.", "כָּל הַמָּנִיקוּרִיסְטִיּוֹת מְאֻמָּתוֹת, עִם דֵּרוּגִים אֲמִתִּיִּים."],
                            "כל המניקוריסטיות מאומתות עם דירוגים אמיתיים")]:
    best = (rep[lid]["sim"], None, rep[lid]["heard"])
    for txt in variants:
        for seed in (21, 22, 23, 24):
            torch.manual_seed(seed)
            w = tts.generate(txt, language_id="he", audio_prompt_path="vo/_ref.wav", exaggeration=0.55, cfg_weight=0.5, temperature=0.6).squeeze(0).numpy()
            a = librosa.resample(w, orig_sr=tts.sr, target_sr=16000)
            heard = " ".join(x.text for x in asr.transcribe(a, language="he")[0]).strip()
            sim = difflib.SequenceMatcher(None, strip(heard), strip(ref)).ratio()
            print(lid, seed, round(sim, 2), heard, flush=True)
            if sim > best[0]:
                best = (sim, w, heard)
    if best[1] is not None:
        sf.write(f"vo/{lid}.wav", best[1], tts.sr)
        rep[lid].update(sim=round(best[0], 2), heard=best[2])
json.dump(rep, open("vo/report.json", "w"), ensure_ascii=False, indent=1)
print({k: (v["sim"], v["heard"]) for k, v in rep.items() if k in ("end", "trust")})
