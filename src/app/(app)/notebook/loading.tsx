// Next.js route-level Suspense fallback for /notebook — page-specific skeleton
// matching the Notebook layout (header + filters + vocabulary list).
// Respects prefers-reduced-motion via global rule in tokens.css.
export default function NotebookLoading() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="h-6 w-24 animate-pulse rounded bg-[var(--surface-muted)]" />
        <div className="h-4 w-32 animate-pulse rounded bg-[var(--surface-muted)]" />
      </div>
      {/* Filter tabs */}
      <div className="flex gap-2 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 w-24 animate-pulse rounded-full bg-[var(--surface-muted)]" />
        ))}
      </div>
      {/* Vocabulary list */}
      <div className="flex-1 overflow-auto space-y-3 animate-pulse">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3"
          >
            <div className="h-10 w-10 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
            <div className="flex-1 min-w-0 space-y-1">
              <div className="h-5 w-3/4 animate-pulse rounded bg-[var(--surface-muted)]" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-[var(--surface-muted)]" />
            </div>
            <div className="h-8 w-8 animate-pulse rounded-full bg-[var(--surface-muted)]" />
          </div>
        ))}
      </div>
      {/* Review due card placeholder */}
      <div className="h-20 w-full animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
    </div>
  );
}