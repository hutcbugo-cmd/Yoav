"""DeepFilterNet3 speech enhancement of the survey part (0-56.32 s) of combined.mp4 -> survey_df.wav (48 kHz)."""
import subprocess, sys, numpy as np, torch
from df.enhance import init_df, enhance
MODEL = "/tmp/claude-0/-home-user-Yoav/730ded80-32ca-5134-9de8-8bc6d8b574d9/scratchpad/dfm/model/DeepFilterNet3"
src, out, end, lim = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4])
raw = subprocess.run(["ffmpeg", "-v", "error", "-t", str(end), "-i", src, "-ac", "1", "-ar", "48000", "-f", "f32le", "-"],
                     capture_output=True, check=True).stdout
x = torch.from_numpy(np.frombuffer(raw, np.float32).copy())[None]
model, st, _ = init_df(MODEL)
y = enhance(model, st, x, atten_lim_db=lim).squeeze(0).numpy()
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", "48000", "-ac", "1", "-i", "-", out],
               input=y.astype(np.float32).tobytes(), check=True)
print("enhanced", len(y) / 48000, "s")
