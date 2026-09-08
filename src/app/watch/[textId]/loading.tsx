// Next.js route-level Suspense fallback for /watch/[textId] — page-specific skeleton
// matching the WatchPlayer layout (video player + transcript + word panel).
// Respects prefers-reduced-motion via global rule in tokens.css.
export default function WatchLoading() {
  return (
    <div className="flex h-full w-full flex-col">
      {/* Header skeleton */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 animate-pulse rounded-full bg-[var(--surface-muted)]" />
          <div className="flex flex-col gap-1">
            <div className="h-5 w-40 animate-pulse rounded bg-[var(--surface-muted)]" />
            <div className="h-3 w-24 animate-pulse rounded bg-[var(--surface-muted)]" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 animate-pulse rounded-full bg-[var(--surface-muted)]" />
          <div className="h-10 w-10 animate-pulse rounded-full bg-[var(--surface-muted)]" />
        </div>
      </div>
      {/* Video player skeleton */}
      <div className="relative flex-1 bg-black/10">
        <div className="absolute inset-0 flex items-center justify-center animate-pulse">
          <div className="aspect-video w-full max-w-4xl bg-[var(--surface-muted)]" />
        </div>
        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-2 bg-[var(--surface-muted)] animate-pulse" style={{ width: "30%" }} />
      </div>
      {/* Transcript area skeleton */}
      <div className="border-t border-[var(--border)] bg-[var(--surface)] p-4 md:hidden">
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-8 w-8 animate-pulse rounded-full bg-[var(--surface-muted)]" />
              <div className="flex-1 space-y-1">
                <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--surface-muted)]" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-[var(--surface-muted)]" />
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Word panel placeholder (bottom on mobile, right on desktop) */}
      <div className="hidden border-t border-[var(--border)] bg-[var(--surface)] p-4 md:block animate-pulse">
        <div className="h-5 w-20 animate-pulse rounded bg-[var(--surface-muted)]" />
        <div className="mt-4 space-y-3 max-h-64 overflow-auto">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-10 w-full animate-pulse rounded-xl bg-[var(--surface-muted)]" />
          ))}
        </div>
      </div>
    </div>
  );
}