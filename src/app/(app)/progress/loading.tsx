// Next.js route-level Suspense fallback for /progress — page-specific skeleton
// matching the Progress dashboard layout (InsightBanner + cards + charts + heatmap).
// Respects prefers-reduced-motion via global rule in tokens.css.
export default function ProgressLoading() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      {/* View tracker placeholder */}
      <div className="h-4 w-24 animate-pulse rounded bg-[var(--surface-muted)]" />
      {/* Page header */}
      <div className="flex flex-col gap-1">
        <div className="h-6 w-20 animate-pulse rounded bg-[var(--surface-muted)]" />
        <div className="h-4 w-28 animate-pulse rounded bg-[var(--surface-muted)]" />
      </div>
      {/* InsightBanner skeleton */}
      <div className="flex flex-col gap-2 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 animate-pulse">
        <div className="h-5 w-32 animate-pulse rounded bg-[var(--surface-muted)]" />
        <div className="h-4 w-full animate-pulse rounded bg-[var(--surface-muted)]" />
      </div>
      {/* LanguageTwinSummaryCard placeholder */}
      <div className="h-24 w-full animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
      {/* League/Duel link cards */}
      <div className="flex flex-col gap-3 animate-pulse">
        <div className="h-20 w-full animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
        <div className="h-20 w-full animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
      </div>
      {/* Learning Paths card placeholder */}
      <div className="h-24 w-full animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
      {/* StreakHero */}
      <div className="flex flex-col gap-2 overflow-hidden rounded-2xl bg-[var(--color-forest)] p-6 animate-pulse">
        <div className="h-6 w-32 animate-pulse rounded bg-white/20" />
        <div className="h-12 w-24 animate-pulse rounded bg-white/20" />
        <div className="h-4 w-36 animate-pulse rounded bg-white/20" />
      </div>
      {/* WeekActivityRow */}
      <div className="flex flex-col gap-2 animate-pulse">
        <div className="h-5 w-24 animate-pulse rounded bg-[var(--surface-muted)]" />
        <div className="flex gap-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex-1 h-16 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
          ))}
        </div>
      </div>
      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 animate-pulse">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
        ))}
      </div>
      {/* ActivityWeekCard */}
      <div className="flex flex-col gap-2 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 animate-pulse">
        <div className="h-5 w-28 animate-pulse rounded bg-[var(--surface-muted)]" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
          ))}
        </div>
      </div>
      {/* SkillSection */}
      <div className="flex flex-col gap-2 animate-pulse">
        <div className="h-5 w-20 animate-pulse rounded bg-[var(--surface-muted)]" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
          ))}
        </div>
      </div>
      {/* Missions section */}
      <div className="h-24 w-full animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
      {/* PeriodTabs */}
      <div className="flex gap-2 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 w-20 animate-pulse rounded-full bg-[var(--surface-muted)]" />
        ))}
      </div>
      {/* Vocabulary stats cards */}
      <div className="grid grid-cols-2 gap-3 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
        ))}
      </div>
      {/* Flashcards stats cards */}
      <div className="grid grid-cols-2 gap-3 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
        ))}
      </div>
      {/* LineCharts */}
      <div className="flex flex-col gap-4 animate-pulse">
        <div className="flex flex-col gap-2">
          <div className="h-5 w-36 animate-pulse rounded bg-[var(--surface-muted)]" />
          <div className="h-48 w-full animate-pulse rounded-xl bg-[var(--surface-muted)]" />
        </div>
        <div className="flex flex-col gap-2">
          <div className="h-5 w-40 animate-pulse rounded bg-[var(--surface-muted)]" />
          <div className="h-48 w-full animate-pulse rounded-xl bg-[var(--surface-muted)]" />
        </div>
      </div>
      {/* HardestWords */}
      <div className="flex flex-col gap-2 animate-pulse">
        <div className="h-5 w-24 animate-pulse rounded bg-[var(--surface-muted)]" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 w-full animate-pulse rounded-xl bg-[var(--surface-muted)]" />
          ))}
        </div>
      </div>
      {/* PersonalRecords */}
      <div className="flex flex-col gap-2 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 animate-pulse">
        <div className="h-5 w-28 animate-pulse rounded bg-[var(--surface-muted)]" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
          ))}
        </div>
      </div>
      {/* Share card button */}
      <div className="h-12 w-full animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
      {/* AchievementsShelf */}
      <div className="flex flex-col gap-2 animate-pulse">
        <div className="h-5 w-24 animate-pulse rounded bg-[var(--surface-muted)]" />
        <div className="flex gap-3 overflow-x-auto">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="shrink-0 h-16 w-16 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
          ))}
        </div>
      </div>
      {/* ActivityHeatmap */}
      <div className="overflow-x-auto rounded-2xl bg-[var(--surface)] p-4 animate-pulse">
        <div className="h-5 w-20 animate-pulse rounded bg-[var(--surface-muted)]" />
        <div className="mt-4 h-32 w-full animate-pulse rounded-xl bg-[var(--surface-muted)]" />
      </div>
    </div>
  );
}