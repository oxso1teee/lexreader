# Minimal MVP worker image: Node (HTTP server + dispatcher + innertube
# provider) + Python (faster-whisper) + ffmpeg + yt-dlp + Deno (yt-dlp's own
# documented JS-runtime dependency for full extractor reliability -- see
# docs/ui/m3-slice12-import-video-reader-v2-audit-and-research.md Round 2).
# See docs/ui/m3-slice12-production-architecture.md §17 for the full
# deployment rationale.

FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 python3-pip python3-venv ffmpeg curl ca-certificates unzip \
    && rm -rf /var/lib/apt/lists/*

# Deno, for yt-dlp's own signature-challenge solving. Installed to /opt (not
# the default $HOME/.deno, which would land under /root and be unreadable
# once we drop to a non-root user below).
ENV DENO_INSTALL=/opt/deno
RUN curl -fsSL https://deno.land/install.sh | sh -s -- -y \
    && ln -s /opt/deno/bin/deno /usr/local/bin/deno

# yt-dlp as a standalone binary (pinned build, matches how this project's
# dev environment already runs it -- update deliberately, not automatically,
# per the "no auto-update at runtime" decision in the architecture doc).
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

# Python deps in an isolated venv, matching the exact tooling proven in
# research (faster-whisper via pip in a venv, not system Python).
RUN python3 -m venv /opt/whisper-venv
ENV WHISPER_PYTHON_BIN=/opt/whisper-venv/bin/python
RUN /opt/whisper-venv/bin/pip install --no-cache-dir faster-whisper

# Node deps.
COPY package.json ./
RUN npm install --omit=dev

COPY src ./src

# Pre-bake the tiny Whisper model into the image (§12: avoids a runtime
# HuggingFace Hub dependency and the ~60s cold-start download observed in
# research). Cached to /opt/hf-cache (not the default ~/.cache/huggingface,
# which would land under /root and be unreadable once we drop to a
# non-root user below) so the non-root user can read the pre-baked model.
ENV HF_HOME=/opt/hf-cache
RUN /opt/whisper-venv/bin/python -c "from faster_whisper import WhisperModel; WhisperModel('tiny', device='cpu', compute_type='int8')"

# Run as a non-root user -- yt-dlp/ffmpeg/whisper only ever need to write to
# os.tmpdir() (world-writable by default) and read the app/model files
# below, nothing here needs root.
RUN useradd --uid 10001 --no-create-home --shell /usr/sbin/nologin worker \
    && chown -R worker:worker /app "$HF_HOME"
USER worker

ENV PORT=8080
ENV WHISPER_MODEL=tiny
# WORKER_SHARED_SECRET must be provided at deploy time (never baked into the
# image, never committed) -- see .env.example.

EXPOSE 8080
CMD ["node", "src/server.mjs"]
