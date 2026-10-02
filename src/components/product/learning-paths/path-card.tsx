import Link from "next/link";
import { Check, CircleDot, type LucideIcon } from "lucide-react";
import { cardClassName } from "@/components/ui/card";
import type { EnrollmentRow, LearningPath } from "@/lib/learning-paths/types";

// M3 Slice 8 — Catalog card (plan doc's Path Catalog screen). No fake
// duration claims ("30 days") — only the honest level range and goal the
// curriculum actually carries.
const STATUS_META: Record<EnrollmentRow["status"], { label: string; icon?: LucideIcon; className: string }> = {
  active: { label: "Активный путь", icon: CircleDot, className: "bg-[var(--color-success)]/15 text-[var(--color-success-text)]" },
  paused: { label: "На паузе", className: "bg-[var(--color-warning)]/15 text-[var(--color-warning-text)]" },
  completed: { label: "Завершён", icon: Check, className: "bg-[var(--border)] text-[var(--text-secondary)]" },
};

export default function PathCard({ path, enrollment }: { path: LearningPath; enrollment: EnrollmentRow | null }) {
  const statusMeta = enrollment ? STATUS_META[enrollment.status] : null;
  return (
    <Link
      href={`/learning-paths/${path.slug}`}
      className={cardClassName({ interactive: true, className: "focus-ring flex flex-col gap-2" })}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[var(--border)] px-2 py-0.5 text-xs font-semibold text-[var(--text-secondary)]">
          {path.levelFrom} → {path.levelTo}
        </span>
        {statusMeta && (
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${statusMeta.className}`}>
            {statusMeta.icon && <statusMeta.icon aria-hidden="true" className="h-3 w-3" />}
            {statusMeta.label}
          </span>
        )}
      </div>
      <p className="text-sm font-semibold">{path.title}</p>
      <p className="text-xs text-[var(--text-secondary)]">{path.goal}</p>
    </Link>
  );
}
