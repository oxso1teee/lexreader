export interface TimedSegment {
  startMs: number;
  endMs: number;
}

// M3 Slice 12 Gate #3 — the old implementation did a full linear scan of every segment on every
// ~300ms player-time tick (O(n) per tick, O(n * ticks) over a session), fine for the old 5-line
// window but not for a real synced transcript over 500-2000+ segment long-form videos. This is
// the rightmost-startMs-<=-t binary search instead: O(log n) per tick.
//
// Deliberately ignores endMs: captions frequently have small gaps between lines (silence), and
// "last line that started" reads better during a gap than "nothing highlighted, then everything
// flickers off". This also sidesteps malformed timing (endMs <= startMs) entirely — it never
// looks at endMs, so a zero/negative-duration segment just behaves like a very short one, never
// crashes or misbehaves.
export function findActiveSegmentIndex(
  segments: TimedSegment[],
  currentTimeMs: number,
  fallbackIndex: number,
): number {
  if (segments.length === 0) return fallbackIndex;
  if (currentTimeMs < segments[0].startMs) return fallbackIndex;

  let lo = 0;
  let hi = segments.length - 1;
  let result = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (segments[mid].startMs <= currentTimeMs) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return result;
}

// text_progress.last_page_index is reused here as "caption segment index" (the same convention
// the pre-Gate-#3 Watch Mode already established) — clamped defensively since the transcript
// could have been re-imported/shortened since the progress row was written.
export function clampResumeIndex(lastPageIndex: number | null | undefined, segmentCount: number): number {
  if (segmentCount === 0) return 0;
  if (lastPageIndex == null || !Number.isFinite(lastPageIndex)) return 0;
  return Math.min(Math.max(0, Math.trunc(lastPageIndex)), segmentCount - 1);
}

// Per-segment seek button label ("0:07", "12:03", "1:04:22") — negative/non-finite input
// (shouldn't happen, but this reads real DB rows) never throws, just reads as 0:00.
export function formatTimestamp(ms: number): string {
  const totalSeconds = Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 1000)) : 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}
