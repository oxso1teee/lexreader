// Shared-secret header auth (§6 of the production architecture doc) — the
// worker must not be a publicly-abusable transcription endpoint. Simple by
// design for MVP: a single long random secret, provided only via env var,
// compared with a timing-safe comparison, never logged.
import { timingSafeEqual } from "node:crypto";

const HEADER_NAME = "x-worker-secret";

export function isAuthorized(request, expectedSecret) {
  if (!expectedSecret) {
    // Fail closed: an unconfigured worker refuses everything rather than
    // silently accepting unauthenticated requests.
    return false;
  }
  const provided = request.headers.get(HEADER_NAME);
  if (typeof provided !== "string" || provided.length === 0) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(expectedSecret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const WORKER_SECRET_HEADER = HEADER_NAME;
