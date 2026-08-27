import Link from "next/link";
import { notFound } from "next/navigation";
import { getPath } from "@/lib/learning-paths/curriculum/index.ts";
import { buildGrammarQuestionSet } from "@/lib/missions/grammar-bank";
import { SkillStatusBadge } from "@/components/product/learning-paths/badges";
import { ConfidenceBadge } from "@/components/product/language-twin/badges";
import type { PathSlug } from "@/lib/learning-paths/types";
import LearningPathsSubHeader from "../../../sub-header";
import LearningPathsViewTracker from "../../../analytics";
import { getSkillStateAction } from "../../../actions";
import CompleteLessonButton from "./lesson-actions";

export default async function LearningPathSkillPage({
  params,
}: {
  params: Promise<{ pathSlug: string; stageKey: string; skillKey: string }>;
}) {
  const { pathSlug: slugParam, stageKey, skillKey } = await params;
  const path = getPath(slugParam as PathSlug);
  if (!path) notFound();
  const pathSlug = path.slug;

  const state = await getSkillStateAction(pathSlug, skillKey);
  if (!state || state.stage.key !== stageKey) notFound();
  const { skill, stage, progress, languageTwinSignal, matchingMissionId } = state;

  // Knowledge Check is only offered where the grammar bank actually has
  // real questions for this skill's category/subTopic — never a fake
  // "coming soon" button for content that isn't there (plan doc's "no
  // active placeholders" rule).
  const hasKnowledgeCheck = Boolean(skill.category) && buildGrammarQuestionSet(skill.category!, 1, "probe", skill.subTopic).length > 0;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      <LearningPathsViewTracker event="skill_opened" props={{ path_slug: pathSlug, skill_key: skill.key }} />
      <LearningPathsSubHeader title={skill.title} backHref={`/learning-paths/${pathSlug}/${stage.key}`} backLabel={stage.title} />

      <div className="flex flex-wrap items-center gap-2">
        <SkillStatusBadge status={progress?.status ?? "not_started"} />
        {languageTwinSignal && <ConfidenceBadge level={languageTwinSignal.confidence} />}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-sm">
        <p className="text-sm font-semibold">{skill.lesson.objective}</p>
        <p className="text-sm text-[var(--text-secondary)]">{skill.lesson.explanation}</p>

        <div>
          <p className="mb-1 text-xs font-semibold text-[var(--text-secondary)]">Примеры</p>
          <ul className="flex flex-col gap-1 text-sm">
            {skill.lesson.examples.map((ex, i) => (
              <li key={i} className="rounded-lg bg-black/5 px-3 py-2 dark:bg-white/10">
                {ex}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold text-[var(--text-secondary)]">Частые ошибки</p>
          <ul className="flex list-disc flex-col gap-1 pl-4 text-sm text-[var(--text-secondary)]">
            {skill.lesson.commonMistakes.map((mistake, i) => (
              <li key={i}>{mistake}</li>
            ))}
          </ul>
        </div>

        <CompleteLessonButton pathSlug={pathSlug} skillKey={skill.key} alreadyCompleted={Boolean(progress?.content_completed_at)} />
      </div>

      {languageTwinSignal && (
        <div className="rounded-2xl bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold text-[var(--text-secondary)]">Из твоего профиля «Мой английский»</p>
          <p className="mt-1 text-sm">{languageTwinSignal.patternTitle}</p>
          <p className="text-xs text-[var(--text-secondary)]">Наблюдений: {languageTwinSignal.evidenceCount}</p>
        </div>
      )}

      <div className="flex flex-col gap-2 rounded-2xl bg-card p-4 shadow-sm">
        <p className="text-sm font-semibold">Практика</p>
        <div className="flex flex-wrap gap-2">
          {hasKnowledgeCheck && (
            <Link
              href={`/learning-paths/${pathSlug}/${stage.key}/${skill.key}/check`}
              className="focus-ring rounded-full bg-forest px-4 py-2 text-sm font-medium text-white"
            >
              Проверить себя
            </Link>
          )}
          {matchingMissionId ? (
            <Link
              href={`/missions/${matchingMissionId}`}
              className="focus-ring rounded-full border border-[var(--border-strong)] px-4 py-2 text-sm font-medium"
            >
              Потренировать
            </Link>
          ) : (
            <span className="rounded-full border border-dashed border-[var(--border-strong)] px-4 py-2 text-sm text-[var(--text-secondary)]">
              Активной миссии по этой теме пока нет
            </span>
          )}
          <Link href="/brain" className="focus-ring rounded-full border border-[var(--border-strong)] px-4 py-2 text-sm font-medium">
            Открыть Практику
          </Link>
          <Link href="/library" className="focus-ring rounded-full border border-[var(--border-strong)] px-4 py-2 text-sm font-medium">
            Открыть библиотеку
          </Link>
        </div>
        {!hasKnowledgeCheck && (
          <p className="text-xs text-[var(--text-secondary)]">Автоматической проверки для этого навыка пока нет — используй Практику и чтение.</p>
        )}
      </div>
    </div>
  );
}
