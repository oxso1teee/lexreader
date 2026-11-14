import { notFound } from "next/navigation";
import { buildGrammarQuestionSet } from "@/lib/missions/grammar-bank";
import LessonView, { lessonSubtitle } from "@/components/product/learning-paths/lesson-view";
import { getPath } from "@/lib/learning-paths/curriculum/index.ts";
import { unitHref } from "@/lib/learning-paths/routes";
import type { PathSlug } from "@/lib/learning-paths/types";
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
  const path = getPath(slugParam as PathSlug);
  if (!path) notFound();
  const pathSlug = path.slug;

  const state = await getSkillStateAction(pathSlug, skillKey);
  if (!state || state.stage.key !== stageKey) notFound();
  const { skill, progress, languageTwinSignal, matchingMissionId, context } = state;

  // Knowledge Check is only offered where the grammar bank actually has
  // real questions for this skill's category/subTopic — never a fake
  // "coming soon" button for content that isn't there (plan doc's "no
  // active placeholders" rule).
  const hasKnowledgeCheck = Boolean(skill.category) && buildGrammarQuestionSet(skill.category!, 1, "probe", skill.subTopic).length > 0;

  return (
    <LessonView
      pathSlug={pathSlug}
      skill={skill}
      progress={progress}
      context={context}
      languageTwinSignal={languageTwinSignal}
      matchingMissionId={matchingMissionId}
      hasKnowledgeCheck={hasKnowledgeCheck}
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
        <CompleteLessonButton pathSlug={pathSlug} skillKey={skill.key} alreadyCompleted={Boolean(progress?.content_completed_at)} />
      }
    />
  );
}
