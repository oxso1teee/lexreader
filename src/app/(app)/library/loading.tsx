// Next.js route-level Suspense fallback — shown for real while the server
// component above fetches data (client-side navigation to /library), not a
// decorative always-mounted skeleton (docs/ui/m3-slice3-library-reader-plan.md §5).
function SkeletonCard() {
  return (
    <div className="flex flex-col gap-2 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
      <div className="h-26 animate-pulse rounded-xl bg-[var(--surface-muted)]" style={{ height: "6.5rem" }} />
      <div className="h-3 w-4/5 animate-pulse rounded bg-[var(--surface-muted)]" />
      <div className="h-3 w-2/5 animate-pulse rounded bg-[var(--surface-muted)]" />
      <div className="h-1.5 w-full animate-pulse rounded-full bg-[var(--surface-muted)]" />
    </div>
  );
}

export default function LibraryLoading() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-5 py-6">
      <div className="h-8 w-40 animate-pulse rounded bg-[var(--surface-muted)]" />
      <div className="h-10 w-full max-w-sm animate-pulse rounded-full bg-[var(--surface-muted)]" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
