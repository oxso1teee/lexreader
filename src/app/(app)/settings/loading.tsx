// Next.js route-level Suspense fallback for /settings — page-specific skeleton
// matching the Settings layout (header + sections).
// Respects prefers-reduced-motion via global rule in tokens.css.
export default function SettingsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      {/* Page header */}
      <div className="flex flex-col gap-1">
        <div className="h-6 w-20 animate-pulse rounded bg-[var(--surface-muted)]" />
      </div>
      {/* Settings sections */}
      <div className="space-y-4 animate-pulse">
        {/* Profile section */}
        <div className="flex flex-col gap-3 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="h-5 w-24 animate-pulse rounded bg-[var(--surface-muted)]" />
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 animate-pulse rounded-full bg-[var(--surface-muted)]" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-32 animate-pulse rounded bg-[var(--surface-muted)]" />
              <div className="h-4 w-24 animate-pulse rounded bg-[var(--surface-muted)]" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="h-10 animate-pulse rounded-full bg-[var(--surface-muted)]" />
            <div className="h-10 animate-pulse rounded-full bg-[var(--surface-muted)]" />
          </div>
        </div>
        {/* Language section */}
        <div className="flex flex-col gap-3 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="h-5 w-24 animate-pulse rounded bg-[var(--surface-muted)]" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-12 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
            <div className="h-12 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
          </div>
        </div>
        {/* Daily goal section */}
        <div className="flex flex-col gap-3 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="h-5 w-24 animate-pulse rounded bg-[var(--surface-muted)]" />
          <div className="h-12 w-32 animate-pulse rounded-full bg-[var(--surface-muted)]" />
        </div>
        {/* Subscription section */}
        <div className="flex flex-col gap-3 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="h-5 w-24 animate-pulse rounded bg-[var(--surface-muted)]" />
          <div className="h-16 w-full animate-pulse rounded-xl bg-[var(--surface-muted)]" />
          <div className="h-10 w-36 animate-pulse rounded-full bg-[var(--surface-muted)]" />
        </div>
        {/* Push notifications */}
        <div className="flex flex-col gap-3 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="h-5 w-24 animate-pulse rounded bg-[var(--surface-muted)]" />
          <div className="h-12 w-full animate-pulse rounded-xl bg-[var(--surface-muted)]" />
        </div>
        {/* Extension tokens */}
        <div className="flex flex-col gap-3 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="h-5 w-24 animate-pulse rounded bg-[var(--surface-muted)]" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 w-full animate-pulse rounded-xl bg-[var(--surface-muted)]" />
            ))}
          </div>
        </div>
        {/* Leaderboard opt-in */}
        <div className="flex flex-col gap-3 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="h-5 w-24 animate-pulse rounded bg-[var(--surface-muted)]" />
          <div className="h-12 w-full animate-pulse rounded-xl bg-[var(--surface-muted)]" />
        </div>
        {/* Danger zone */}
        <div className="flex flex-col gap-3 overflow-hidden rounded-2xl border border-[var(--color-danger-text)]/30 bg-[var(--color-danger-text)]/5 p-4">
          <div className="h-5 w-24 animate-pulse rounded bg-[var(--color-danger-text)]/20" />
          <div className="h-10 w-40 animate-pulse rounded-full bg-[var(--color-danger-text)]/20" />
        </div>
      </div>
    </div>
  );
}