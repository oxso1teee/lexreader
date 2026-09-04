import Link from "next/link";
import { Playfair_Display } from "next/font/google";
import { notFound } from "next/navigation";
import { getPath, getAllSkills } from "@/lib/learning-paths/curriculum/index.ts";
import { stageStatus } from "@/lib/learning-paths/progress-engine.ts";
import { findCurrentFocusSkill } from "@/lib/learning-paths/progress-engine.ts";
import type { PathSlug } from "@/lib/learning-paths/types";
import LearningPathsSubHeader from "../sub-header";
import LearningPathsViewTracker from "../analytics";
import { getPathDetailsAction, getActivePathStateAction } from "../actions";
import { StartPathButton, PausePathButton } from "../path-actions";

// Path overview mockup alignment — replaces the old icon+label
// STAGE_STATUS_META lookup (✓/◐/○ + "Завершён"/"Сейчас"/"Впереди") with the
// numbered-circle + real doneInStage/skillsInStage fraction design below;
// no longer referenced anywhere in this file.
//
// Also: scoped Playfair Display italic for the hero's path title, same
// pattern as library/page.tsx (--font-library-serif) and
// read/[textId]/page.tsx (--font-reading) — local next/font/google load
// right here, unique variable name, not the shared --font-serif.
const playfairDisplay = Playfair_Display({
  variable: "--font-path-hero",
  subsets: ["latin", "cyrillic"],
});

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
        {/* Path overview mockup alignment — doneInStage mirrors
            stageStatus()'s own byKey/content_completed_at logic
            (progress-engine.ts), computed locally here rather than
            exporting a new helper from that file (out of scope for this
            task). One shared byKey map for the whole list, not rebuilt per
            stage. */}
        {(() => {
          const progressByKey = activeState ? new Map(activeState.progressRows.map((row) => [row.skill_key, row])) : null;
          return (
            <ul className="flex flex-col gap-2">
              {path.stages.map((stage, index) => {
                const status = activeState
                  ? stageStatus(stage, activeState.progressRows, activeState.focusSkill?.key ?? null)
                  : null;
                const skills = stage.modules.flatMap((m) => m.skills);
                const skillsInStage = skills.length;
                const doneInStage = progressByKey
                  ? skills.filter((skill) => Boolean(progressByKey.get(skill.key)?.content_completed_at)).length
                  : 0;
                return (
                  <li key={stage.key}>
                    {activeState && status ? (
                      <Link
                        href={`/learning-paths/${pathSlug}/${stage.key}`}
                        className="focus-ring flex items-center gap-2.5 rounded-2xl border border-[var(--border)] bg-card px-3.5 py-2.5 hover:border-black/30 dark:hover:border-white/40"
                      >
                        <span
                          aria-hidden="true"
                          className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                            status === "completed"
                              ? "bg-[var(--color-forest)] text-white"
                              : status === "current"
                                ? "border-[1.5px] border-[var(--color-forest)] bg-[var(--color-forest-tint)] text-[var(--color-forest-text)]"
                                : "bg-[var(--border)] text-[var(--text-secondary)]"
                          }`}
                        >
                          {status === "completed" ? "✓" : index + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[12.5px] font-bold">{stage.title}</span>
                          {/* No "Открой этап N" for upcoming stages — every
                              stage is already clickable, that copy would be
                              a lie. Just the same doneInStage/skillsInStage
                              fraction, "· сейчас" appended only for the
                              actual current stage. */}
                          <span className="text-[10.5px] text-[var(--text-secondary)]">
                            {doneInStage}/{skillsInStage}
                            {status === "current" && " · сейчас"}
                          </span>
                        </span>
                      </Link>
                    ) : (
                      <div className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--border-strong)] px-3 py-2 text-sm">
                        <span>{stage.title}</span>
                        <span className="text-xs text-[var(--text-secondary)]">{skillsInStage} навыков</span>
                      </div>
                    )}
                    {!activeState && <p className="mt-1 px-3 text-xs text-[var(--text-secondary)]">{stage.description}</p>}
                  </li>
                );
              })}
            </ul>
          );
        })()}
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
    <div className="flex flex-col gap-3">
      {/* Path overview mockup alignment — "Прогресс по содержанию" card
          replaced by this gradient hero (same var(--color-forest) ->
          var(--color-forest-light) gradient PR #85 already used on the
          duel avatar). Confident/improving line moved down here, inside
          the same card, per the task. */}
      <div
        className={`${playfairDisplay.variable} rounded-[20px] p-4 text-white`}
        style={{ background: "linear-gradient(150deg, var(--color-forest), var(--color-forest-light))" }}
      >
        <p className="text-[10.5px] font-bold uppercase tracking-wide text-white/85">Мой путь</p>
        <p className="mt-1 font-[family-name:var(--font-path-hero)] text-lg font-bold italic">{state.path.title}</p>
        <div className="mt-3 h-[7px] w-full overflow-hidden rounded-full bg-white/25">
          <span className="block h-full rounded-full bg-white transition-[width]" style={{ width: `${state.contentProgressPercent}%` }} />
        </div>
        <p className="mt-1 text-right text-[11px] text-white/85">{state.contentProgressPercent}% пройдено</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/80">
          <span>Уверенно: {state.skillsConfident}</span>
          <span>Улучшается: {state.skillsImproving}</span>
        </div>
      </div>

      {/* "Следующий шаг" + PausePathButton stay outside the hero, same
          wrapper/styling as before this task. */}
      <div className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-sm">
        {focusSkill && stage ? (
          <div className="flex flex-col gap-2 rounded-2xl border border-[var(--border-strong)] p-3">
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
    </div>
  );
}
