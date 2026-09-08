// Next.js route-level Suspense fallback for /brain — page-specific skeleton
// matching the Brain dashboard layout (PracticeHero + DailyProgressCard +
// WeakWordsCard + QuickPracticeGrid + footer links).
// Respects prefers-reduced-motion via global rule in tokens.css.
export default function BrainLoading() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      {/* Analytics placeholder */}
      <div className="h-4 w-24 animate-pulse rounded bg-[var(--surface-muted)]" />
      {/* Page header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="h-6 w-24 animate-pulse rounded bg-[var(--surface-muted)]" />
          <div className="h-4 w-28 animate-pulse rounded bg-[var(--surface-muted)]" />
        </div>
        <div className="h-8 w-28 animate-pulse rounded-full bg-[var(--surface-muted)]" />
      </div>
      {/* PracticeHero skeleton */}
      <div className="flex flex-col gap-3 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 animate-pulse">
        <div className="h-5 w-32 animate-pulse rounded bg-[var(--surface-muted)]" />
        <div className="h-8 w-48 animate-pulse rounded bg-[var(--surface-muted)]" />
        <div className="h-4 w-36 animate-pulse rounded bg-[var(--surface-muted)]" />
        <div className="mt-2 flex gap-2">
          <div className="flex-1 h-10 animate-pulse rounded-full bg-[var(--surface-muted)]" />
          <div className="flex-1 h-10 animate-pulse rounded-full bg-[var(--surface-muted)]" />
        </div>
      </div>
      {/* DailyProgressCard skeleton */}
      <div className="flex flex-col gap-2 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 animate-pulse">
        <div className="h-5 w-24 animate-pulse rounded bg-[var(--surface-muted)]" />
        <div className="h-12 w-full animate-pulse rounded bg-[var(--surface-muted)]" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--surface-muted)]" />
      </div>
      {/* WeakWordsCard skeleton */}
      <div className="flex flex-col gap-2 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 animate-pulse">
        <div className="h-5 w-20 animate-pulse rounded bg-[var(--surface-muted)]" />
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex-1 h-16 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
          ))}
        </div>
      </div>
      {/* QuickPracticeGrid skeleton */}
      <div className="flex flex-col gap-2 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 animate-pulse">
        <div className="h-5 w-24 animate-pulse rounded bg-[var(--surface-muted)]" />
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
          ))}
        </div>
      </div>
      {/* Reading words link placeholder */}
      <div className="h-12 w-full animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
      {/* Footer action buttons */}
      <div className="flex gap-2 animate-pulse">
        <div className="flex-1 h-11 animate-pulse rounded-full bg-[var(--surface-muted)]" />
        <div className="flex-1 h-11 animate-pulse rounded-full bg-[var(--surface-muted)]" />
      </div>
    </div>
  );
}