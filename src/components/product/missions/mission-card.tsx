import Link from "next/link";
import { reasonLabel } from "@/components/product/language-twin/badges";
import { MissionTypeBadge, MissionPriorityBadge, difficultyLabel } from "./badges";
import type { MissionRow, MissionStatus } from "@/lib/missions/types";

const STATUS_BADGE: Partial<Record<MissionStatus, { label: string; className: string }>> = {
  started: { label: "В процессе", className: "bg-[var(--color-info)]/15 text-[var(--color-info-text)]" },
  completed: { label: "✓ Завершена", className: "bg-[var(--color-success)]/15 text-[var(--color-success-text)]" },
  dismissed: { label: "Отклонена", className: "bg-black/5 text-[var(--text-secondary)] dark:bg-white/10" },
  expired: { label: "Истекла", className: "bg-black/5 text-[var(--text-secondary)] dark:bg-white/10" },
};

// Shared card used by /missions (active list), /missions/history, and the
// Today Missions section — one visual language for "here's a mission", not
// a bespoke summary per surface. Never shows a numeric match score (plan
// doc §6): priority is always the 3-value badge, never "78% match".
export default function MissionCard({ mission }: { mission: MissionRow }) {
  const statusBadge = STATUS_BADGE[mission.status];
  return (
    <Link
      href={`/missions/${mission.id}`}
      className="focus-ring flex flex-col gap-2 rounded-2xl bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex flex-wrap items-center gap-2">
        <MissionTypeBadge type={mission.mission_type} />
        <MissionPriorityBadge priority={mission.priority} />
        {statusBadge && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge.className}`}>{statusBadge.label}</span>
        )}
      </div>
      <p className="text-sm font-medium">{mission.title}</p>
      <p className="text-xs text-[var(--text-secondary)]">{reasonLabel(mission.reason_key)}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-secondary)]">
        <span>~{mission.estimated_minutes} мин</span>
        <span>{difficultyLabel(mission.difficulty)}</span>
        <span>Шагов: {mission.step_count}</span>
      </div>
    </Link>
  );
}
