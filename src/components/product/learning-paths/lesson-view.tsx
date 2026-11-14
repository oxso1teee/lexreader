import type { ReactNode } from "react";
import { ConfidenceBadge } from "@/components/product/language-twin/badges";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { lessonPosition } from "@/lib/learning-paths/copy";
import type { SkillLanguageTwinSignal } from "@/lib/learning-paths/language-twin-mapping";
import type { LessonContext } from "@/lib/learning-paths/path-map";
import { checkHref, lessonHref, pathHref } from "@/lib/learning-paths/routes";
import type { PathSlug, Skill, SkillProgressRow } from "@/lib/learning-paths/types";
import { SkillStatusBadge } from "./badges";
import LessonBody from "./lesson-body";
import LessonNav from "./lesson-nav";
import LessonSteps from "./lesson-steps";
import LockedLesson from "./locked-lesson";

// Урок (раздел курса → модуль → урок). Открытый урок — содержимое, «изучено»,
// практика и переход к соседним урокам; закрытый — объяснение, когда он
// откроется, без содержимого. Страница и галерея /dev/screens рисуют именно
// этот компонент; кнопка «Отметить как изученное» приходит слотом (она
// клиентская и вызывает серверное действие маршрута).
export default function LessonView({
  pathSlug,
  skill,
  progress,
  context,
  languageTwinSignal,
  matchingMissionId,
  hasKnowledgeCheck,
  header,
  analytics,
  completeAction,
}: {
  pathSlug: PathSlug;
  skill: Skill;
  progress: SkillProgressRow | null;
  context: LessonContext;
  languageTwinSignal: SkillLanguageTwinSignal | null;
  matchingMissionId: string | null;
  /** У навыка есть проверка знаний (не у всех навыков она есть). */
  hasKnowledgeCheck: boolean;
  header: ReactNode;
  analytics?: ReactNode;
  completeAction: ReactNode;
}) {
  const { lesson, unit, prev, next, current } = context;

  if (lesson.state === "locked") {
    return (
      <div className="lp page-content" data-state="locked">
        {analytics}
        {header}
        <LessonSteps lessons={unit.lessons} activeKey={lesson.key} pathSlug={pathSlug} />
        <LockedLesson lesson={lesson} current={current} pathSlug={pathSlug} canCheck={hasKnowledgeCheck} />
        <LessonNav prev={prev} next={next} pathSlug={pathSlug} />
      </div>
    );
  }

  return (
    <div className="lp page-content" data-state={lesson.state}>
      {analytics}
      {header}
      <LessonSteps lessons={unit.lessons} activeKey={lesson.key} pathSlug={pathSlug} />

      <div className="flex flex-wrap items-center gap-2">
        <SkillStatusBadge status={progress?.status ?? "not_started"} />
        {languageTwinSignal && <ConfidenceBadge level={languageTwinSignal.confidence} />}
      </div>

      <LessonBody content={skill.lesson}>{completeAction}</LessonBody>

      {lesson.state === "done" && (
        <Card tone="leaf" className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="m-0 text-xs font-bold text-[var(--leaf-text)]">Урок пройден</p>
            <p className="m-0 text-sm font-bold">{current ? `Дальше: ${current.skill.title}` : "Курс пройден"}</p>
          </div>
          {current ? (
            <ButtonLink href={lessonHref(pathSlug, current)} size="sm">
              Продолжить
            </ButtonLink>
          ) : (
            <ButtonLink href={pathHref(pathSlug)} size="sm">
              К карте курса
            </ButtonLink>
          )}
        </Card>
      )}

      {languageTwinSignal && (
        <Card as="section" aria-labelledby="lp-twin-title">
          <h2 id="lp-twin-title" className="lp-section-title">
            Из твоего профиля «Мой английский»
          </h2>
          <p className="m-0 mt-1 text-sm">{languageTwinSignal.patternTitle}</p>
          <p className="m-0 text-xs text-[var(--text-secondary)]">Наблюдений: {languageTwinSignal.evidenceCount}</p>
        </Card>
      )}

      <Card as="section" aria-labelledby="lp-practice-title" className="flex flex-col gap-2">
        <h2 id="lp-practice-title" className="lp-section-title">
          Практика
        </h2>
        <div className="flex flex-wrap gap-2">
          {hasKnowledgeCheck && (
            <ButtonLink href={checkHref(pathSlug, lesson)} variant="leaf" size="sm">
              Проверить себя
            </ButtonLink>
          )}
          {matchingMissionId ? (
            <ButtonLink href={`/missions/${matchingMissionId}`} variant="ghost" size="sm">
              Потренировать
            </ButtonLink>
          ) : (
            <span className="inline-flex items-center rounded-full border-2 border-dashed border-[var(--border-strong)] px-4 py-2 text-sm text-[var(--text-secondary)]">
              Активной миссии по этой теме пока нет
            </span>
          )}
          <ButtonLink href="/brain" variant="ghost" size="sm">
            Открыть Практику
          </ButtonLink>
          <ButtonLink href="/library" variant="ghost" size="sm">
            Открыть библиотеку
          </ButtonLink>
        </div>
        {!hasKnowledgeCheck && (
          <p className="m-0 text-xs text-[var(--text-secondary)]">Автоматической проверки для этого навыка пока нет — используй Практику и чтение.</p>
        )}
      </Card>

      <LessonNav prev={prev} next={next} pathSlug={pathSlug} />
    </div>
  );
}

/** Подзаголовок страницы урока: «Урок 3 из 5 · Название раздела». */
export function lessonSubtitle(context: Pick<LessonContext, "positionInUnit" | "unitSize" | "unit">): string {
  return `${lessonPosition(context.positionInUnit, context.unitSize)} · ${context.unit.title}`;
}
