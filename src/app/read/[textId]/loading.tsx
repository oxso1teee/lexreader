// Next.js route-level Suspense fallback for /read/[textId] — page-specific skeleton
// matching the Reader layout (header + text content area + word panel).
// Respects prefers-reduced-motion via global rule in tokens.css.
export default function ReadLoading() {
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
          <div className="h-10 w-10 animate-pulse rounded-full bg-[var(--surface-muted)]" />
        </div>
      </div>
      {/* Reader content area skeleton */}
      <div className="flex-1 overflow-auto p-4 md:px-12">
        <div className="mx-auto max-w-3xl space-y-6 animate-pulse">
          {/* Chapter indicator placeholder */}
          <div className="h-4 w-32 animate-pulse rounded-full bg-[var(--surface-muted)]" />
          {/* Text paragraphs */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2">
              {Array.from({ length: 3 + (i % 3) }).map((_, j) => (
                <div
                  key={j}
                  className="h-6 animate-pulse rounded bg-[var(--surface-muted)]"
                  style={{ width: `${60 + Math.random() * 30}%` }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      {/* Word panel placeholder (right side on desktop) */}
      <div className="hidden h-64 shrink-0 border-l border-[var(--border)] bg-[var(--surface)] p-4 md:block animate-pulse">
        <div className="h-5 w-20 animate-pulse rounded bg-[var(--surface-muted)]" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 w-full animate-pulse rounded-xl bg-[var(--surface-muted)]" />
          ))}
        </div>
      </div>
    </div>
  );
}