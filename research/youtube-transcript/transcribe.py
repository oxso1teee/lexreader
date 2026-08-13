import sys
import time
from faster_whisper import WhisperModel

audio_path = sys.argv[1]
model_size = sys.argv[2] if len(sys.argv) > 2 else "tiny"

t0 = time.time()
model = WhisperModel(model_size, device="cpu", compute_type="int8")
t1 = time.time()
print(f"model load time: {t1-t0:.2f}s")

segments, info = model.transcribe(audio_path, beam_size=5, word_timestamps=False)
print(f"detected language: {info.language} (p={info.language_probability:.2f})")

seg_list = []
for seg in segments:
    seg_list.append({"start": seg.start, "end": seg.end, "text": seg.text.strip()})

t2 = time.time()
print(f"transcription time: {t2-t1:.2f}s")
print(f"segment count: {len(seg_list)}")
for s in seg_list:
    print(f"  [{s['start']:.2f} -> {s['end']:.2f}] {s['text']}")
