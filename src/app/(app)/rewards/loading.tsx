import { LoadingState } from "@/components/ui/states";

// Route-level Suspense fallback для /rewards: заголовок и скелеты карточек.
export default function RewardsLoading() {
  return (
    <div className="page-content flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <div className="h-8 w-32 animate-pulse rounded bg-[var(--surface-muted)]" />
        <div className="h-4 w-64 max-w-full animate-pulse rounded bg-[var(--surface-muted)]" />
      </div>
      <LoadingState rows={4} label="Загрузка наград" />
    </div>
  );
}
