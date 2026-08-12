import { notFound } from "next/navigation";
import { getPath } from "@/lib/learning-paths/curriculum/index.ts";
import { buildGrammarQuestionSet } from "@/lib/missions/grammar-bank";
import type { PathSlug } from "@/lib/learning-paths/types";
import LearningPathsSubHeader from "../../../../sub-header";
import LearningPathsViewTracker from "../../../../analytics";
import { getSkillStateAction } from "../../../../actions";
import CheckRunner from "./check-runner";

const QUESTION_COUNT = 5;

export default async function LearningPathKnowledgeCheckPage({
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
  const { skill, stage } = state;
  if (!skill.category) notFound();

  // Fixed seed per skill (not per attempt): the same 5 questions every time
  // — deterministic, no LLM, no illusion of an ever-growing question bank
  // (plan doc's Knowledge Check requirements).
  const questions = buildGrammarQuestionSet(skill.category, QUESTION_COUNT, skill.key, skill.subTopic);
  if (questions.length === 0) notFound();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      <LearningPathsViewTracker event="knowledge_check_started" props={{ path_slug: pathSlug, skill_key: skill.key }} />
      <LearningPathsSubHeader
        title={`Проверка: ${skill.title}`}
        backHref={`/learning-paths/${pathSlug}/${stage.key}/${skill.key}`}
        backLabel={skill.title}
      />
      <CheckRunner pathSlug={pathSlug} skillKey={skill.key} questions={questions} />
    </div>
  );
}
