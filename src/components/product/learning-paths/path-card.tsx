import { Check, CircleDot, Pause, type LucideIcon } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { CardLink } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { doneOfLessons } from "@/lib/learning-paths/copy";
import { pathHref } from "@/lib/learning-paths/routes";
import type { EnrollmentRow, LearningPath } from "@/lib/learning-paths/types";

// M3 Slice 8 — Catalog card (plan doc's Path Catalog screen). No fake
// duration claims ("30 days") — only the honest level range, goal and the
// real number of finished lessons the curriculum and progress actually carry.
const STATUS_META: Record<EnrollmentRow["status"], { label: string; icon: LucideIcon; tone: BadgeTone }> = {
  active: { label: "Активный путь", icon: CircleDot, tone: "leaf" },
  paused: { label: "На паузе", icon: Pause, tone: "sun" },
  completed: { label: "Завершён", icon: Check, tone: "neutral" },
};

export default function PathCard({
  path,
  enrollment,
  progress,
}: {
  path: LearningPath;
  enrollment: EnrollmentRow | null;
  progress: { done: number; total: number };
}) {
  const statusMeta = enrollment ? STATUS_META[enrollment.status] : null;
  const StatusIcon = statusMeta?.icon;
  const percent = progress.total > 0 ? progress.done / progress.total : 0;

  return (
    <CardLink href={pathHref(path.slug)} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>
          {path.levelFrom} → {path.levelTo}
        </Badge>
        {statusMeta && StatusIcon && (
          <Badge tone={statusMeta.tone}>
            <StatusIcon aria-hidden="true" className="h-3 w-3" />
            {statusMeta.label}
          </Badge>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="m-0 text-sm font-bold">
          {path.title}
        </h3>
        <p className="m-0 text-xs text-[var(--text-secondary)]">{path.goal}</p>
      </div>
      {progress.done > 0 && (
        <div className="flex items-center gap-2">
          <Progress
            value={percent}
            size="sm"
            className="min-w-0 flex-1"
            label={`Пройдено в пути «${path.title}»: ${doneOfLessons(progress.done, progress.total)}`}
          />
          <span className="shrink-0 text-xs font-bold">{doneOfLessons(progress.done, progress.total)}</span>
        </div>
      )}
    </CardLink>
  );
}
