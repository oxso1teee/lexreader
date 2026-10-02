// Next.js route-level Suspense fallback for /learning-paths — page-specific skeleton
// matching the Learning Paths catalog layout (header + recommendation + path cards).
// Respects prefers-reduced-motion via global rule in tokens.css.
export default function LearningPathsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      {/* View tracker placeholder */}
      <div className="h-4 w-24 animate-pulse rounded bg-[var(--surface-muted)]" />
      {/* Sub-header */}
      <div className="flex flex-col gap-2 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-6 w-24 animate-pulse rounded bg-[var(--surface-muted)]" />
          <div className="h-10 w-24 animate-pulse rounded-full bg-[var(--surface-muted)]" />
        </div>
        <div className="h-4 w-64 animate-pulse rounded bg-[var(--surface-muted)]" />
      </div>
      {/* Recommendation card */}
      <div className="h-24 w-full animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
      {/* Path cards */}
      <div className="flex flex-col gap-3 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <div className="h-5 w-32 animate-pulse rounded bg-[var(--surface-muted)]" />
                <div className="h-3 w-24 animate-pulse rounded bg-[var(--surface-muted)]" />
              </div>
              <div className="h-8 w-20 animate-pulse rounded-full bg-[var(--surface-muted)]" />
            </div>
            <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--surface-muted)]" />
            <div className="flex items-center justify-between">
              <div className="h-5 w-20 animate-pulse rounded bg-[var(--surface-muted)]" />
              <div className="h-5 w-20 animate-pulse rounded bg-[var(--surface-muted)]" />
            </div>
            <div className="h-10 w-full animate-pulse rounded-full bg-[var(--surface-muted)]" />
          </div>
        ))}
      </div>
    </div>
  );
}