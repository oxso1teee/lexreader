// Session Resume (M3 Slice 4 §7): localStorage only, no schema change. Scoped
// to the main "cards" review flow reached from Practice Home's primary CTA —
// Choice/Type/Match are short, low-stakes quick-practice modes that don't
// need resume. Stores only flashcard IDs, never front/back/context content —
// "не хранить PII или содержимое всех карточек без необходимости" (brief §7).
//
// Never throws: parseSnapshot validates field-by-field and falls back to
// null on any malformed/stale/mismatched data, mirroring the defensive
// pattern already used by src/app/read/[textId]/reader-prefs.ts. Lives in
// src/lib/ (not the [deckId] route directory) both to match this repo's
// convention for framework-agnostic logic and because Node's test runner
// silently finds zero tests for files under a `[bracket]`-named directory.

const STORAGE_KEY = "lexreader_review_session_v1";
const STALE_MS = 6 * 60 * 60 * 1000; // 6h — older sessions are treated as abandoned

export interface ReviewSessionSnapshot {
  userId: string;
  deckId: string;
  cardIds: string[];
  gradedIds: string[];
  index: number;
  phase: "question" | "answer";
  updatedAt: string;
}

function isValidSnapshot(v: unknown): v is ReviewSessionSnapshot {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.userId === "string" &&
    typeof s.deckId === "string" &&
    Array.isArray(s.cardIds) &&
    s.cardIds.every((id) => typeof id === "string") &&
    Array.isArray(s.gradedIds) &&
    s.gradedIds.every((id) => typeof id === "string") &&
    typeof s.index === "number" &&
    (s.phase === "question" || s.phase === "answer") &&
    typeof s.updatedAt === "string" &&
    !Number.isNaN(new Date(s.updatedAt).getTime())
  );
}

export function saveReviewSession(
  snapshot: Omit<ReviewSessionSnapshot, "updatedAt">,
): void {
  if (typeof window === "undefined") return;
  const full: ReviewSessionSnapshot = { ...snapshot, updatedAt: new Date().toISOString() };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(full));
  } catch {
    // localStorage unavailable (private mode, quota) — resume is a
    // convenience feature, never block the review itself on this failing.
  }
}

/** Returns null on any missing/corrupted/stale/user-mismatched/deck-mismatched data. */
export function loadReviewSession(
  userId: string,
  deckId?: string,
): ReviewSessionSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidSnapshot(parsed)) return null;
    if (parsed.userId !== userId) return null;
    if (deckId !== undefined && parsed.deckId !== deckId) return null;
    if (Date.now() - new Date(parsed.updatedAt).getTime() > STALE_MS) return null;
    if (parsed.index >= parsed.cardIds.length) return null; // already-completed session
    return parsed;
  } catch {
    return null;
  }
}

export function clearReviewSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // best-effort
  }
}
