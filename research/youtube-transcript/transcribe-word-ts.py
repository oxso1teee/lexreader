import sys, time, json
from faster_whisper import WhisperModel

audio_path = sys.argv[1]
model_size = sys.argv[2] if len(sys.argv) > 2 else "tiny"

t0 = time.time()
model = WhisperModel(model_size, device="cpu", compute_type="int8")
t1 = time.time()

segments, info = model.transcribe(audio_path, beam_size=5, word_timestamps=True, vad_filter=True)
print(f"detected language: {info.language} (p={info.language_probability:.2f})")

seg_list = []
for seg in segments:
    words = [{"start": w.start, "end": w.end, "word": w.word} for w in (seg.words or [])]
    seg_list.append({"start": seg.start, "end": seg.end, "text": seg.text.strip(), "word_count": len(words)})

t2 = time.time()
print(f"model load: {t1-t0:.2f}s, transcribe: {t2-t1:.2f}s")
print(f"segment count (whisper native): {len(seg_list)}")
for s in seg_list:
    print(f"  [{s['start']:.2f} -> {s['end']:.2f}] ({s['word_count']} words) {s['text']}")

# Also dump word-level timestamps for the first segment to show sub-segment granularity is available
print("\nword-level timestamps available for finer regrouping:")
