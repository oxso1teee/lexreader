import { notFound } from "next/navigation";
import LessonView, { lessonSubtitle } from "@/components/product/learning-paths/lesson-view";
import LessonStartCard, { ExercisesRequiredNote } from "@/components/product/lessons/lesson-start-card";
import { getPath } from "@/lib/learning-paths/curriculum/index.ts";
import { playHref, unitHref } from "@/lib/learning-paths/routes";
import { hasCheckMode, lessonRequiresExercises } from "@/lib/lessons/plan";
import { getLessonOverview } from "@/lib/lessons/server";
import LearningPathsSubHeader from "../../../sub-header";
import LearningPathsViewTracker from "../../../analytics";
import { getSkillStateAction } from "../../../actions";
import CompleteLessonButton from "./lesson-actions";

// Урок (раздел курса → модуль → урок). Что открыто, а что закрыто, решает
// buildPathMap по сохранённому прогрессу — здесь только данные и слоты.
export default async function LearningPathLessonPage({
  params,
}: {
  params: Promise<{ pathSlug: string; stageKey: string; skillKey: string }>;
}) {
  const { pathSlug: slugParam, stageKey, skillKey } = await params;
  const path = getPath(slugParam);
  if (!path) notFound();
  const pathSlug = path.slug;

  const state = await getSkillStateAction(pathSlug, skillKey);
  if (!state || state.stage.key !== stageKey) notFound();
  const { skill, progress, languageTwinSignal, matchingMissionId, context } = state;

  // Knowledge Check is only offered where the grammar bank actually has
  // real questions for this skill's category/subTopic — never a fake
  // "coming soon" button for content that isn't there (plan doc's "no
  // active placeholders" rule). Решает тот же план, что и сама проверка.
  const hasKnowledgeCheck = hasCheckMode(skill);

  // Карточка входа в плеер — только у открытого урока. Ошибка чтения попыток
  // (например, не применена миграция) не ломает страницу: карточки просто нет.
  const overview =
    context.lesson.state === "locked"
      ? null
      : await getLessonOverview({ pathSlug, pathVersion: path.version, skillKey: skill.key }, skill);
  return (
    <LessonView
      pathSlug={pathSlug}
      skill={skill}
      progress={progress}
      context={context}
      languageTwinSignal={languageTwinSignal}
      matchingMissionId={matchingMissionId}
      hasKnowledgeCheck={hasKnowledgeCheck}
      startCard={
        overview ? (
          <LessonStartCard overview={overview} playUrl={playHref(pathSlug, context.lesson)} completed={Boolean(progress?.content_completed_at)} />
        ) : null
      }
      analytics={<LearningPathsViewTracker event="skill_opened" props={{ path_slug: pathSlug, skill_key: skill.key }} />}
      header={
        <LearningPathsSubHeader
          title={skill.title}
          description={lessonSubtitle(context)}
          backHref={unitHref(pathSlug, context.unit.key)}
          backLabel={context.unit.title}
        />
      }
      completeAction={
        // Ручное «изучено» — только для уроков без упражнений (и для уже пройденных:
        // там кнопка показывает «Урок изучен»). Иначе упражнения можно было бы пропустить.
        progress?.content_completed_at || !lessonRequiresExercises(skill) ? (
          <CompleteLessonButton pathSlug={pathSlug} skillKey={skill.key} alreadyCompleted={Boolean(progress?.content_completed_at)} />
        ) : (
          <ExercisesRequiredNote />
        )
      }
    />
  );
}
