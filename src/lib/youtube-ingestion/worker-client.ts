import type { TranscriptResult, ErrorCategoryValue } from "./types.ts";

export type WorkerIngestResponse =
  | { ok: true; transcript: TranscriptResult; attempts: unknown[]; ingestionDurationMs: number }
  | { ok: false; error: ErrorCategoryValue; message: string; attempts: unknown[]; ingestionDurationMs: number };

const WORKER_URL = process.env.YOUTUBE_WORKER_URL;
const WORKER_SECRET = process.env.YOUTUBE_WORKER_SHARED_SECRET;

export class WorkerUnavailableError extends Error {}

/** Calls the standalone ingestion worker's /ingest endpoint with the shared
 * secret header (§6 — never logged, never sent to the client). */
export async function callIngestionWorker(input: {
  videoId: string;
  targetLanguage: string;
}): Promise<WorkerIngestResponse> {
  if (!WORKER_URL || !WORKER_SECRET) {
    throw new WorkerUnavailableError("YOUTUBE_WORKER_URL/YOUTUBE_WORKER_SHARED_SECRET not configured");
  }

  let response: Response;
  try {
    response = await fetch(`${WORKER_URL}/ingest`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-worker-secret": WORKER_SECRET,
      },
      body: JSON.stringify({ videoId: input.videoId, targetLanguage: input.targetLanguage }),
      // No `next: { revalidate }` -- this is a live job dispatch, never cached.
      cache: "no-store",
    });
  } catch (err) {
    throw new WorkerUnavailableError(err instanceof Error ? err.message : "Worker request failed");
  }

  if (response.status === 503) {
    throw new WorkerUnavailableError("Worker is at capacity");
  }
  if (!response.ok) {
    throw new WorkerUnavailableError(`Worker responded with HTTP ${response.status}`);
  }

  return (await response.json()) as WorkerIngestResponse;
}
