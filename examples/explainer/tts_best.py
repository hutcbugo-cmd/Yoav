"""Hebrew VO (Chatterbox Multilingual, MIT): niqqud text, one synthetic reference voice for consistency,
3 candidates per line, the clearest (Whisper similarity) in the target pitch range is kept."""
import json, numpy as np, torch, difflib, re, soundfile as sf, librosa
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
from faster_whisper import WhisperModel
tts = ChatterboxMultilingualTTS.from_pretrained(device="cpu")
asr = WhisperModel("ivrit-ai/whisper-large-v3-turbo-ct2", device="cpu", compute_type="int8")
strip = lambda s: re.sub(r"[֑-ׇ.,?!\s‫]", "", s)
def score(w, ref):
    a = librosa.resample(w, orig_sr=tts.sr, target_sr=16000)
    heard = " ".join(x.text for x in asr.transcribe(a, language="he")[0])
    ps = []
    for i in range(0, len(a) - 640, 320):
        f = a[i:i+640] - a[i:i+640].mean()
        if np.sqrt((f**2).mean()) < 0.02: continue
        ac = np.correlate(f, f, 'full')[639:]; k = 40 + np.argmax(ac[40:200])
        if ac[k] / (ac[0] + 1e-9) > 0.5: ps.append(16000 / k)
    return difflib.SequenceMatcher(None, strip(heard), strip(ref)).ratio(), (np.median(ps) if ps else 0), heard.strip()
sc = json.load(open("script.json"))
# reference voice: the warm female take of the hook (seed 3: clear, 190 Hz)
torch.manual_seed(3)
ref = tts.generate(sc[0]["vo_nq"], language_id="he", exaggeration=0.5, cfg_weight=0.5, temperature=0.6).squeeze(0).numpy()
sf.write("vo/_ref.wav", ref, tts.sr)
report = {}
for l in sc:
    best = None
    for seed in (11, 12, 13):
        torch.manual_seed(seed)
        w = tts.generate(l["vo_nq"], language_id="he", audio_prompt_path="vo/_ref.wav", exaggeration=0.55,
                         cfg_weight=0.5, temperature=0.6).squeeze(0).numpy()
        sim, p, heard = score(w, l["vo"])
        ok = 150 <= p <= 280
        key = (ok, round(sim, 2))
        if best is None or key > best[0]:
            best = (key, w, sim, p, heard, seed)
    sf.write(f"vo/{l['id']}.wav", best[1], tts.sr)
    report[l["id"]] = dict(sim=round(best[2], 2), pitch=int(best[3]), heard=best[4], seed=best[5], dur=round(len(best[1]) / tts.sr, 2))
    print(l["id"], report[l["id"]], flush=True)
json.dump(report, open("vo/report.json", "w"), ensure_ascii=False, indent=1)
