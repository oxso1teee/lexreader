// Skeleton matching the Today layout shape (docs/ui/current-ui-audit.md
// requirement: no full-page spinner after navigation). Respects
// prefers-reduced-motion via the global rule in src/styles/tokens.css.
export default function LoadingState({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Загрузка">
      <div className="h-28 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
      ))}
    </div>
  );
}
