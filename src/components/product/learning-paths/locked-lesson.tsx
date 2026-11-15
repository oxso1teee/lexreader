import { Lock } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { opensAfterLesson } from "@/lib/learning-paths/copy";
import type { LessonNode } from "@/lib/learning-paths/path-map";
import { checkHref, lessonHref } from "@/lib/learning-paths/routes";
import type { PathSlug } from "@/lib/learning-paths/types";

// Закрытый урок: содержимое не показываем, объясняем, почему закрыт, и даём два
// выхода — идти к текущему уроку или, если тема уже знакома, пройти проверку
// (результат от 80% засчитывает урок сразу, см. applyKnowledgeCheckResult).
export default function LockedLesson({
  lesson,
  current,
  pathSlug,
  canCheck,
}: {
  lesson: LessonNode;
  /** Первый непройденный урок пути — куда вести. */
  current: LessonNode | null;
  pathSlug: PathSlug;
  /** У навыка есть проверка знаний (не у всех навыков она есть). */
  canCheck: boolean;
}) {
  return (
    <Card as="section" tone="sunken" aria-labelledby="lp-locked-title" className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="lp-sw" aria-hidden="true">
          <Lock className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 id="lp-locked-title" className="m-0 text-base font-bold">
            Урок пока закрыт
          </h2>
          {lesson.opensAfter && <p className="m-0 text-sm text-[var(--text-secondary)]">{opensAfterLesson(lesson.opensAfter.title)}</p>}
        </div>
      </div>

      <p className="m-0 text-sm">О чём урок: {lesson.skill.lesson.objective}</p>
      <p className="m-0 text-sm text-[var(--text-secondary)]">Уроки идут по порядку: каждая тема опирается на предыдущую.</p>

      {current && (
        <ButtonLink href={lessonHref(pathSlug, current)} className="self-start">
          Перейти к уроку: {current.skill.title}
        </ButtonLink>
      )}

      {canCheck && (
        <div className="flex flex-col gap-2 border-t-2 border-[var(--border)] pt-4">
          <h3 className="m-0 text-sm font-bold">Уже знаешь эту тему?</h3>
          <p className="m-0 text-sm text-[var(--text-secondary)]">
            Пройди проверку: при результате от 80% урок засчитается сразу.
          </p>
          <ButtonLink href={checkHref(pathSlug, lesson)} variant="ghost" size="sm" className="self-start">
            Пройти проверку
          </ButtonLink>
        </div>
      )}
    </Card>
  );
}
