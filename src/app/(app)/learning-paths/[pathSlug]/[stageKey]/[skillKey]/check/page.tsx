import { notFound } from "next/navigation";
import LessonPlayer from "@/components/product/lessons/lesson-player";
import { getPath } from "@/lib/learning-paths/curriculum/index.ts";
import { checkHref, lessonHref, pathHref } from "@/lib/learning-paths/routes";
import { hasCheckMode } from "@/lib/lessons/plan";
import LearningPathsViewTracker from "../../../../analytics";
import { getSkillStateAction } from "../../../../actions";

// Быстрая проверка знаний: те же вопросы банка, что и раньше, но теперь на
// общем движке упражнений — ответы проверяет сервер (клиент больше не знает
// правильных ответов и не присылает «сколько верно»), прогресс сохраняется
// после каждого вопроса, XP — через ту же систему, что и урок.
export default async function LearningPathKnowledgeCheckPage({
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
  const { skill, context } = state;
  if (!hasCheckMode(skill)) notFound();

  return (
    <div className="lp page-content">
      <LearningPathsViewTracker event="knowledge_check_started" props={{ path_slug: pathSlug, skill_key: skill.key }} />
      <LessonPlayer
        pathSlug={pathSlug}
        mode="check"
        skill={{ key: skill.key, title: skill.title, lesson: skill.lesson }}
        subtitle={`Проверка знаний · ${skill.title}`}
        lessonUrl={lessonHref(pathSlug, context.lesson)}
        pathUrl={pathHref(pathSlug)}
        loginUrl={`/login?reason=expired&next=${encodeURIComponent(checkHref(pathSlug, context.lesson))}`}
      />
    </div>
  );
}
