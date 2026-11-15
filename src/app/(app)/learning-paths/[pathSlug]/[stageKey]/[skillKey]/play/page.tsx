import { notFound, redirect } from "next/navigation";
import LessonPlayer from "@/components/product/lessons/lesson-player";
import { getPath } from "@/lib/learning-paths/curriculum/index.ts";
import { lessonPosition } from "@/lib/learning-paths/copy";
import { lessonHref, pathHref, playHref } from "@/lib/learning-paths/routes";
import { getSkillStateAction } from "../../../../actions";

// Плеер урока: введение → материал → частые ошибки → упражнения → результат.
// Страница только проверяет, что урок существует и открыт, и отдаёт плееру
// статичное содержимое курса. Саму попытку (создание или восстановление) плеер
// запрашивает у сервера при открытии — GET ничего не создаёт.
export default async function LearningPathLessonPlayerPage({
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

  // Закрытый урок проходить нельзя (сервер проверяет это ещё раз при старте):
  // ведём на страницу урока, где объяснено, когда он откроется.
  if (context.lesson.state === "locked") redirect(lessonHref(pathSlug, context.lesson));

  return (
    <div className="lp page-content">
      <LessonPlayer
        pathSlug={pathSlug}
        mode="lesson"
        skill={{ key: skill.key, title: skill.title, lesson: skill.lesson }}
        subtitle={`${lessonPosition(context.positionInUnit, context.unitSize)} · ${context.unit.title}`}
        lessonUrl={lessonHref(pathSlug, context.lesson)}
        pathUrl={pathHref(pathSlug)}
        loginUrl={`/login?reason=expired&next=${encodeURIComponent(playHref(pathSlug, context.lesson))}`}
      />
    </div>
  );
}
