import sys
import json
from faster_whisper import WhisperModel

def main():
    audio_path = sys.argv[1]
    model_size = sys.argv[2] if len(sys.argv) > 2 else "tiny"

    model = WhisperModel(model_size, device="cpu", compute_type="int8")
    segments, info = model.transcribe(audio_path, beam_size=5, word_timestamps=True, vad_filter=True)

    words = []
    for seg in segments:
        for w in (seg.words or []):
            words.append({"start": w.start, "end": w.end, "word": w.word})

    print(json.dumps({
        "language": info.language,
        "language_probability": info.language_probability,
        "words": words,
    }))

if __name__ == "__main__":
    main()
