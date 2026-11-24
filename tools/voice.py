"""Offline narrator voice (Kokoro, free, Apache-2.0) with per-sentence + estimated per-word timing.

  python tools/voice.py samples <out_dir>                 -> one short mp3 per candidate voice
  python tools/voice.py speak <narration.txt> <out_dir> [--voice am_fenrir] [--speed 0.92]
      -> <out_dir>/voice.wav, <out_dir>/lines.json [{text,start,end,words:[{w,s,e}]}]

Model files live in ~/.cache/kokoro (kokoro-v1.0.onnx, voices-v1.0.bin).
"""
import json
import os
import re
import subprocess
import sys

import numpy as np
import soundfile as sf

MODEL_DIR = os.path.expanduser("~/.cache/kokoro")
SR = 24000
CANDIDATES = ["am_fenrir", "am_michael", "am_onyx", "bm_george", "bm_lewis", "am_puck"]
SAMPLE = "Tonight, you are just a baby, screaming inside a wagon, on the coldest night of the year."


def engine():
    from kokoro_onnx import Kokoro
    return Kokoro(os.path.join(MODEL_DIR, "kokoro-v1.0.onnx"), os.path.join(MODEL_DIR, "voices-v1.0.bin"))


def split_sentences(text):
    paras = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    out = []
    for pi, p in enumerate(paras):
        p = re.sub(r"\s+", " ", p)
        # keep "..." with the sentence, split on . ! ? followed by space
        parts = re.split(r"(?<=[.!?])\s+(?=[A-Z\"'])", p)
        for si, s in enumerate(parts):
            if s.strip():
                out.append({"text": s.strip(), "para": pi, "para_end": si == len(parts) - 1})
    return out


def word_times(text, start, end):
    """Spread words over the line by character weight (good enough for captions)."""
    words = text.split()
    weights = [len(re.sub(r"[^\w]", "", w)) + 2 for w in words]
    total = sum(weights)
    t, res = start, []
    span = end - start
    for w, wt in zip(words, weights):
        d = span * wt / total
        res.append({"w": w, "s": round(t, 3), "e": round(t + d, 3)})
        t += d
    return res


def trim(a, thr=0.004):
    idx = np.where(np.abs(a) > thr)[0]
    if len(idx) == 0:
        return a
    s = max(0, idx[0] - int(0.02 * SR))
    e = min(len(a), idx[-1] + int(0.06 * SR))
    return a[s:e]


def speak(narr_path, out_dir, voice="am_fenrir", speed=0.92):
    os.makedirs(out_dir, exist_ok=True)
    k = engine()
    text = open(narr_path, encoding="utf-8").read()
    lines = split_sentences(text)
    chunks, t = [np.zeros(int(0.4 * SR), dtype=np.float32)], 0.4
    for i, ln in enumerate(lines):
        samples, sr = k.create(ln["text"], voice=voice, speed=speed, lang="en-us")
        a = trim(np.asarray(samples, dtype=np.float32))
        dur = len(a) / SR
        ln["start"], ln["end"] = round(t, 3), round(t + dur, 3)
        ln["words"] = word_times(ln["text"], t, t + dur)
        chunks.append(a)
        # dramatic pauses: longer between paragraphs, after "..." and short lines
        gap = 0.32
        if ln["text"].endswith("..."):
            gap = 0.7
        if ln["para_end"]:
            gap = 0.9
        chunks.append(np.zeros(int(gap * SR), dtype=np.float32))
        t += dur + gap
        print(f"{i + 1}/{len(lines)} {dur:5.2f}s  {ln['text'][:60]}")
    audio = np.concatenate(chunks)
    audio = audio / max(1e-6, np.max(np.abs(audio))) * 0.89
    sf.write(os.path.join(out_dir, "voice.wav"), audio, SR)
    json.dump(lines, open(os.path.join(out_dir, "lines.json"), "w"), indent=1)
    nw = sum(len(l["words"]) for l in lines)
    print(f"voice.wav {len(audio) / SR:.1f}s, {nw} words, {nw / (len(audio) / SR) * 60:.0f} wpm")


def samples(out_dir):
    os.makedirs(out_dir, exist_ok=True)
    k = engine()
    for v in CANDIDATES:
        s, sr = k.create(SAMPLE, voice=v, speed=0.92, lang="en-us")
        wav = os.path.join(out_dir, f"{v}.wav")
        sf.write(wav, s, sr)
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", wav, "-b:a", "128k", wav[:-4] + ".mp3"], check=True)
        os.remove(wav)
        print(v)


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "samples":
        samples(sys.argv[2])
    elif cmd == "speak":
        args = sys.argv[2:]
        voice = args[args.index("--voice") + 1] if "--voice" in args else "am_fenrir"
        speed = float(args[args.index("--speed") + 1]) if "--speed" in args else 0.92
        speak(args[0], args[1], voice, speed)
