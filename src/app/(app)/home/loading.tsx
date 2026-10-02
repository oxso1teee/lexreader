// Next.js route-level Suspense fallback for /home — page-specific skeleton
// matching the Today layout shape (HeroCard + StatStrip + sections).
// Respects prefers-reduced-motion via global rule in tokens.css.
export default function HomeLoading() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4 md:max-w-3xl md:gap-5 md:px-0 md:py-8">
      {/* Analytics placeholder */}
      <div className="h-4 w-24 animate-pulse rounded bg-[var(--surface-muted)]" />
      {/* Greeting row */}
      <div className="h-6 w-32 animate-pulse rounded bg-[var(--surface-muted)]" />
      {/* Install banner placeholder */}
      <div className="h-10 w-full animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
      {/* Hero card skeleton */}
      <div className="flex flex-col gap-3 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 animate-pulse">
        <div className="h-3 w-24 animate-pulse rounded bg-[var(--surface-muted)]" />
        <div className="h-6 w-48 animate-pulse rounded bg-[var(--surface-muted)]" />
        <div className="h-4 w-36 animate-pulse rounded bg-[var(--surface-muted)]" />
        <div className="mt-2 h-10 w-32 animate-pulse rounded-full bg-[var(--surface-muted)]" />
        <div className="mt-2 h-2 w-full animate-pulse rounded-full bg-[var(--surface-muted)]" style={{ width: "60%" }} />
      </div>
      {/* Path secondary card placeholder */}
      <div className="h-16 w-full animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
      {/* Summary section */}
      <div className="flex flex-col gap-2 animate-pulse">
        <div className="h-5 w-20 animate-pulse rounded bg-[var(--surface-muted)]" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
          ))}
        </div>
        <div className="h-16 w-full animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
      </div>
      {/* My English section placeholder */}
      <div className="h-24 w-full animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
      {/* Coming soon card */}
      <div className="h-16 w-full animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
    </div>
  );
}