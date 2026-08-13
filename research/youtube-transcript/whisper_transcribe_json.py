import sys
import json
import time
from faster_whisper import WhisperModel

audio_path = sys.argv[1]
model_size = sys.argv[2] if len(sys.argv) > 2 else "tiny"

t0 = time.time()
model = WhisperModel(model_size, device="cpu", compute_type="int8")
t1 = time.time()

segments, info = model.transcribe(audio_path, beam_size=5, word_timestamps=True, vad_filter=True)

words = []
for seg in segments:
    for w in (seg.words or []):
        words.append({"start": w.start, "end": w.end, "word": w.word})

t2 = time.time()

print(json.dumps({
    "language": info.language,
    "language_probability": info.language_probability,
    "model_load_s": round(t1 - t0, 2),
    "transcribe_s": round(t2 - t1, 2),
    "words": words,
}))
