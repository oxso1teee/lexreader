import Link from "next/link";
import { notFound } from "next/navigation";
import { getPath, getAllSkills } from "@/lib/learning-paths/curriculum/index.ts";
import { stageStatus } from "@/lib/learning-paths/progress-engine.ts";
import { findCurrentFocusSkill } from "@/lib/learning-paths/progress-engine.ts";
import type { PathSlug } from "@/lib/learning-paths/types";
import LearningPathsSubHeader from "../sub-header";
import LearningPathsViewTracker from "../analytics";
import { getPathDetailsAction, getActivePathStateAction } from "../actions";
import { StartPathButton, PausePathButton } from "../path-actions";

const STAGE_STATUS_META: Record<string, { icon: string; label: string }> = {
  completed: { icon: "✓", label: "Завершён" },
  current: { icon: "◐", label: "Сейчас" },
  upcoming: { icon: "○", label: "Впереди" },
};

export default async function LearningPathDetailsPage({ params }: { params: Promise<{ pathSlug: string }> }) {
  const { pathSlug: slugParam } = await params;
  const path = getPath(slugParam as PathSlug);
  if (!path) notFound();
  const pathSlug = path.slug;

  const entry = await getPathDetailsAction(pathSlug);
  if (!entry) notFound();
  const { enrollment, otherActivePath } = entry;

  // Active Path Home: this route IS the one active enrollment (only one can
  // be active per user), so getActivePathStateAction's result belongs to
  // this path whenever enrollment.status === "active".
  const activeState = enrollment?.status === "active" ? await getActivePathStateAction() : null;

  const skillCount = getAllSkills(path).length;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      <LearningPathsViewTracker event="learning_path_opened" props={{ path_slug: pathSlug }} />
      <LearningPathsSubHeader title={path.title} description={path.goal} />

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-semibold text-[var(--text-secondary)] dark:bg-white/10">
          {path.levelFrom} → {path.levelTo}
        </span>
        <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-semibold text-[var(--text-secondary)] dark:bg-white/10">
          {path.stages.length} этапа · {skillCount} навыков
        </span>
        <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-semibold text-[var(--text-secondary)] dark:bg-white/10">
          v{path.version}
        </span>
      </div>

      {activeState ? (
        <ActivePathHome pathSlug={pathSlug} state={activeState} />
      ) : (
        <PathDetailsBody pathSlug={pathSlug} enrollmentStatus={enrollment?.status ?? null} otherActivePathTitle={otherActivePath?.title ?? null} />
      )}

      <div className="rounded-2xl bg-card p-4 shadow-sm">
        <p className="mb-3 text-sm font-semibold">Этапы</p>
        <ul className="flex flex-col gap-2">
          {path.stages.map((stage) => {
            const meta = activeState
              ? STAGE_STATUS_META[stageStatus(stage, activeState.progressRows, activeState.focusSkill?.key ?? null)]
              : null;
            const skillsInStage = stage.modules.flatMap((m) => m.skills).length;
            return (
              <li key={stage.key}>
                {activeState ? (
                  <Link
                    href={`/learning-paths/${pathSlug}/${stage.key}`}
                    className="focus-ring flex items-center justify-between gap-2 rounded-lg border border-[var(--border-strong)] px-3 py-2 text-sm hover:border-black/30 dark:hover:border-white/40"
                  >
                    <span className="flex items-center gap-2">
                      <span aria-hidden="true">{meta?.icon}</span>
                      {stage.title}
                    </span>
                    <span className="text-xs text-[var(--text-secondary)]">{meta?.label}</span>
                  </Link>
                ) : (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-strong)] px-3 py-2 text-sm">
                    <span>{stage.title}</span>
                    <span className="text-xs text-[var(--text-secondary)]">{skillsInStage} навыков</span>
                  </div>
                )}
                {!activeState && <p className="mt-1 px-3 text-xs text-[var(--text-secondary)]">{stage.description}</p>}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function PathDetailsBody({
  pathSlug,
  enrollmentStatus,
  otherActivePathTitle,
}: {
  pathSlug: PathSlug;
  enrollmentStatus: string | null;
  otherActivePathTitle: string | null;
}) {
  const label = enrollmentStatus === "paused" ? "Продолжить путь" : enrollmentStatus === "completed" ? "Пройти снова" : "Начать путь";
  const analyticsEvent = otherActivePathTitle
    ? "learning_path_switched"
    : enrollmentStatus === "paused"
      ? "learning_path_resumed"
      : "learning_path_started";
  return <StartPathButton pathSlug={pathSlug} label={label} switchingFrom={otherActivePathTitle} analyticsEvent={analyticsEvent} />;
}

function ActivePathHome({
  pathSlug,
  state,
}: {
  pathSlug: PathSlug;
  state: NonNullable<Awaited<ReturnType<typeof getActivePathStateAction>>>;
}) {
  const focusSkill = state.focusSkill ?? findCurrentFocusSkill(state.path, state.progressRows);
  const stage = focusSkill ? state.path.stages.find((s) => s.modules.some((m) => m.skills.some((sk) => sk.key === focusSkill.key))) : null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Прогресс по содержанию</p>
        <span className="text-sm font-bold">{state.contentProgressPercent}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
        <span className="block h-full rounded-full bg-forest transition-[width]" style={{ width: `${state.contentProgressPercent}%` }} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)]">
        <span>Уверенно: {state.skillsConfident}</span>
        <span>Улучшается: {state.skillsImproving}</span>
      </div>

      {focusSkill && stage ? (
        <div className="flex flex-col gap-2 rounded-lg border border-[var(--border-strong)] p-3">
          <span className="text-xs text-[var(--text-secondary)]">Следующий шаг</span>
          <p className="text-sm font-medium">{focusSkill.title}</p>
          <Link
            href={`/learning-paths/${pathSlug}/${stage.key}/${focusSkill.key}`}
            className="focus-ring self-start rounded-full bg-forest px-4 py-2 text-sm font-medium text-white"
          >
            Продолжить
          </Link>
        </div>
      ) : (
        <p className="text-sm font-medium text-[var(--color-success-text)]">Путь завершён 🎉</p>
      )}

      <PausePathButton pathSlug={pathSlug} />
    </div>
  );
}
