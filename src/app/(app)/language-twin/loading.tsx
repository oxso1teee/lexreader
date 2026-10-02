// Next.js route-level Suspense fallback for /language-twin — page-specific skeleton
// matching the Language Twin layout (header + summary card + tabs + content).
// Respects prefers-reduced-motion via global rule in tokens.css.
export default function LanguageTwinLoading() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      {/* Page header */}
      <div className="flex flex-col gap-1">
        <div className="h-6 w-24 animate-pulse rounded bg-[var(--surface-muted)]" />
        <div className="h-4 w-40 animate-pulse rounded bg-[var(--surface-muted)]" />
      </div>
      {/* Summary card */}
      <div className="flex flex-col gap-3 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 animate-pulse rounded-full bg-[var(--surface-muted)]" />
          <div className="flex-1 space-y-1">
            <div className="h-5 w-32 animate-pulse rounded bg-[var(--surface-muted)]" />
            <div className="h-4 w-24 animate-pulse rounded bg-[var(--surface-muted)]" />
          </div>
        </div>
        <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--surface-muted)]" />
        <div className="flex gap-2">
          <div className="h-6 w-20 animate-pulse rounded-full bg-[var(--surface-muted)]" />
          <div className="h-6 w-20 animate-pulse rounded-full bg-[var(--surface-muted)]" />
          <div className="h-6 w-20 animate-pulse rounded-full bg-[var(--surface-muted)]" />
        </div>
      </div>
      {/* Tab navigation */}
      <div className="flex gap-2 animate-pulse">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 w-24 animate-pulse rounded-full bg-[var(--surface-muted)]" />
        ))}
      </div>
      {/* Tab content placeholder */}
      <div className="flex-1 space-y-4 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <div className="h-5 w-24 animate-pulse rounded bg-[var(--surface-muted)]" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="h-12 w-full animate-pulse rounded-xl bg-[var(--surface-muted)]" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}