import Link from "next/link";
import { notFound } from "next/navigation";
import { getPath } from "@/lib/learning-paths/curriculum/index.ts";
import { findCurrentFocusSkill } from "@/lib/learning-paths/progress-engine.ts";
import { SkillStatusBadge } from "@/components/product/learning-paths/badges";
import type { PathSlug, SkillProgressRow } from "@/lib/learning-paths/types";
import LearningPathsSubHeader from "../../sub-header";
import LearningPathsViewTracker from "../../analytics";
import { getStageStateAction } from "../../actions";

export default async function LearningPathStagePage({ params }: { params: Promise<{ pathSlug: string; stageKey: string }> }) {
  const { pathSlug: slugParam, stageKey } = await params;
  const path = getPath(slugParam as PathSlug);
  if (!path) notFound();
  const pathSlug = path.slug;

  const state = await getStageStateAction(pathSlug, stageKey);
  if (!state) notFound();
  const { stage, progressRows } = state;

  const byKey = new Map(progressRows.map((row) => [row.skill_key, row]));
  const focusSkill = findCurrentFocusSkill(path, progressRows);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      <LearningPathsViewTracker event="stage_opened" props={{ path_slug: pathSlug, stage_key: stage.key }} />
      <LearningPathsSubHeader title={stage.title} description={stage.description} backHref={`/learning-paths/${pathSlug}`} backLabel={path.title} />

      <div className="flex flex-col gap-4">
        {stage.modules.map((mod) => (
          <div key={mod.key} className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-[var(--text-secondary)]">{mod.title}</p>
            <ul className="flex flex-col gap-2">
              {mod.skills.map((skill) => {
                const progress: SkillProgressRow | undefined = byKey.get(skill.key);
                const isCurrent = focusSkill?.key === skill.key;
                return (
                  <li key={skill.key}>
                    <Link
                      href={`/learning-paths/${pathSlug}/${stage.key}/${skill.key}`}
                      className="focus-ring flex flex-col gap-1 rounded-2xl bg-card p-3 shadow-sm transition-shadow hover:shadow-md"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <SkillStatusBadge status={progress?.status ?? "not_started"} />
                        {isCurrent && (
                          <span className="rounded-full bg-[var(--color-forest-text)]/15 px-2 py-0.5 text-xs font-semibold text-[var(--color-forest-text)]">
                            Сейчас
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium">{skill.title}</p>
                      <p className="text-xs text-[var(--text-secondary)]">{skill.lesson.objective}</p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
