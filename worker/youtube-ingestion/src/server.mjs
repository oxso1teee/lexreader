import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isAuthorized } from "./auth.mjs";
import { isValidVideoId } from "./video-id.mjs";
import { dispatchTranscript } from "./dispatch.mjs";
import { IngestionError, ErrorCategory } from "./errors.mjs";
import { MAX_CONCURRENT_JOBS, JOB_TIMEOUT_MS } from "./limits.mjs";

const PORT = Number(process.env.PORT ?? 8080);
const WORKER_SECRET = process.env.WORKER_SHARED_SECRET;
const PYTHON_BIN = process.env.WHISPER_PYTHON_BIN ?? "python3";
const WHISPER_MODEL = process.env.WHISPER_MODEL ?? "tiny";
const LANG_PATTERN = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/;

let inFlightJobs = 0;

// Structured, privacy-safe job log -- videoId is public (part of the
// video's own URL); everything else is metadata (outcome, category,
// counts, timing). Never the transcript text, never cookies/auth headers,
// never WORKER_SECRET.
function logJob(fields) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), event: "ingest_job", ...fields }));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;
    let tooLarge = false;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 10_000) {
        // Stop accumulating (bounds memory) but let the request drain
        // normally rather than destroying the socket -- an abrupt destroy()
        // races the client and surfaces as a raw connection reset instead
        // of a clean 400 response.
        tooLarge = true;
        return;
      }
      body += chunk;
    });
    req.on("end", () => {
      if (tooLarge) {
        reject(new Error("request body too large"));
        return;
      }
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(body);
}

// node:http's raw IncomingMessage doesn't have a `.headers.get()` API the
// way auth.mjs (written against a fetch-style Request) expects -- adapt it.
function toFetchLikeRequest(req) {
  return { headers: { get: (name) => req.headers[name.toLowerCase()] ?? null } };
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    sendJson(res, 200, { ok: true, inFlightJobs, maxConcurrentJobs: MAX_CONCURRENT_JOBS });
    return;
  }

  if (req.method !== "POST" || req.url !== "/ingest") {
    sendJson(res, 404, { error: "not_found" });
    return;
  }

  // Auth check BEFORE anything else -- never do any work for an
  // unauthenticated request. Never log the secret itself.
  if (!isAuthorized(toFetchLikeRequest(req), WORKER_SECRET)) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    sendJson(res, 400, { error: "invalid_request", message: err.message });
    return;
  }

  const { videoId, targetLanguage } = body ?? {};
  if (!isValidVideoId(videoId)) {
    sendJson(res, 400, { error: ErrorCategory.INVALID_URL, message: "videoId is missing or malformed" });
    return;
  }
  const lang = typeof targetLanguage === "string" && LANG_PATTERN.test(targetLanguage) ? targetLanguage : "en";

  if (inFlightJobs >= MAX_CONCURRENT_JOBS) {
    sendJson(res, 503, { error: ErrorCategory.WORKER_UNAVAILABLE, message: "Worker is at capacity, try again shortly" });
    return;
  }

  inFlightJobs += 1;
  const jobStart = Date.now();
  try {
    const { transcript, attempts } = await Promise.race([
      dispatchTranscript({ videoId, targetLanguage: lang, pythonBin: PYTHON_BIN, whisperModel: WHISPER_MODEL }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new IngestionError(ErrorCategory.TIMEOUT, "Job exceeded the hard timeout")), JOB_TIMEOUT_MS),
      ),
    ]);
    const ingestionDurationMs = Date.now() - jobStart;
    logJob({
      videoId,
      outcome: "success",
      source: transcript.source,
      segmentCount: transcript.segments.length,
      ingestionDurationMs,
      attempts: attempts.map((a) => ({ provider: a.provider, outcome: a.outcome })),
    });
    sendJson(res, 200, { ok: true, transcript, attempts, ingestionDurationMs });
  } catch (err) {
    const category = err instanceof IngestionError ? err.category : ErrorCategory.TRANSCRIPTION_FAILED;
    const ingestionDurationMs = Date.now() - jobStart;
    logJob({ videoId, outcome: "error", error: category, ingestionDurationMs });
    // Structured, sanitized failure -- raw stderr/exception detail never
    // leaves this process; only the enum category and a short message do.
    sendJson(res, 200, {
      ok: false,
      error: category,
      message: err.message,
      attempts: err.detail?.attempts ?? [],
      ingestionDurationMs,
    });
  } finally {
    inFlightJobs -= 1;
  }
});

export { server };

// Only auto-listen when this file is executed directly (`node src/server.mjs`
// or the Docker CMD) -- importing it from a test suite must not bind a real
// port as a side effect. process.argv[1] is whatever path was typed on the
// command line (often relative, e.g. the Dockerfile's `node src/server.mjs`
// from WORKDIR /app) while import.meta.url is always absolute, so both must
// be resolved to the same absolute form before comparing.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  // Explicit 0.0.0.0 -- Render (and most container platforms) require
  // binding to all interfaces, not just localhost, to route inbound traffic.
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`youtube-ingestion worker listening on :${PORT}`);
    if (!WORKER_SECRET) {
      console.warn("WARNING: WORKER_SHARED_SECRET is not set -- all /ingest requests will be rejected.");
    }
  });

  // Graceful shutdown: deploy platforms (Fly/Railway/Render) send SIGTERM
  // before killing the container. STT jobs can run for minutes, so we stop
  // accepting new connections and let in-flight jobs finish naturally
  // instead of dropping them mid-transcription -- but still force-exit
  // after a bounded grace period so a stuck job can't block a deploy
  // forever.
  const SHUTDOWN_GRACE_MS = 30_000;
  let shuttingDown = false;
  function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(JSON.stringify({ ts: new Date().toISOString(), event: "shutdown_start", signal, inFlightJobs }));
    server.close(() => {
      console.log(JSON.stringify({ ts: new Date().toISOString(), event: "shutdown_complete", signal }));
      process.exit(0);
    });
    setTimeout(() => {
      console.warn(JSON.stringify({ ts: new Date().toISOString(), event: "shutdown_forced", signal, inFlightJobs }));
      process.exit(1);
    }, SHUTDOWN_GRACE_MS).unref();
  }
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
