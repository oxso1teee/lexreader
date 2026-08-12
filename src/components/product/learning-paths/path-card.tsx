import Link from "next/link";
import type { EnrollmentRow, LearningPath } from "@/lib/learning-paths/types";

// M3 Slice 8 — Catalog card (plan doc's Path Catalog screen). No fake
// duration claims ("30 days") — only the honest level range and goal the
// curriculum actually carries.
const STATUS_META: Record<EnrollmentRow["status"], { label: string; className: string }> = {
  active: { label: "● Активный путь", className: "bg-[var(--color-success)]/15 text-[var(--color-success-text)]" },
  paused: { label: "На паузе", className: "bg-[var(--color-warning)]/15 text-[var(--color-warning-text)]" },
  completed: { label: "✓ Завершён", className: "bg-black/5 text-[var(--text-secondary)] dark:bg-white/10" },
};

export default function PathCard({ path, enrollment }: { path: LearningPath; enrollment: EnrollmentRow | null }) {
  const statusMeta = enrollment ? STATUS_META[enrollment.status] : null;
  return (
    <Link
      href={`/learning-paths/${path.slug}`}
      className="focus-ring flex flex-col gap-2 rounded-2xl bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-semibold text-[var(--text-secondary)] dark:bg-white/10">
          {path.levelFrom} → {path.levelTo}
        </span>
        {statusMeta && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusMeta.className}`}>{statusMeta.label}</span>
        )}
      </div>
      <p className="text-sm font-semibold">{path.title}</p>
      <p className="text-xs text-[var(--text-secondary)]">{path.goal}</p>
    </Link>
  );
}
