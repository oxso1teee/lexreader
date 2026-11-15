import type { ReactNode } from "react";
import { Lex } from "@/components/product/mascot/lex";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { doneOfLessons, lessonsCount, modulesCount } from "@/lib/learning-paths/copy";
import type { UnitNode } from "@/lib/learning-paths/path-map";
import { pathHref, unitHref } from "@/lib/learning-paths/routes";
import type { EnrollmentStatus, LearningPath } from "@/lib/learning-paths/types";
import LessonRow from "./lesson-row";

// Раздел курса (макет Unit-overview): hero с прогрессом раздела и цепочка
// уроков по модулям. Закрытый раздел показывает те же уроки, но с замками и
// объяснением, когда он откроется.
export default function UnitView({
  path,
  unit,
  nextUnit,
  enrollmentStatus,
  header,
  analytics,
}: {
  path: LearningPath;
  unit: UnitNode;
  /** Раздел после этого — для подсказки, когда этот пройден. */
  nextUnit: UnitNode | null;
  enrollmentStatus: EnrollmentStatus | null;
  header: ReactNode;
  analytics?: ReactNode;
}) {
  return (
    <div className="lp page-content" data-state={unit.state}>
      {analytics}
      {header}

      <section aria-labelledby="lp-unit-hero-title" className="lp-hero" data-tone="ember">
        <div className="lp-hero-body">
          <p className="lp-eyebrow">
            Раздел {unit.number} из {path.stages.length}
          </p>
          <h2 id="lp-unit-hero-title" className="lp-hero-title">
            {unit.title}
          </h2>
          <p className="lp-hero-sub">{unit.description}</p>
          <div
            className="lp-bar"
            role="progressbar"
            aria-valuenow={unit.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Пройдено в разделе: ${doneOfLessons(unit.done, unit.total)}`}
          >
            <span style={{ width: `${unit.percent}%` }} />
          </div>
          <p className="lp-hero-sub">{doneOfLessons(unit.done, unit.total)}</p>
          <ul className="lp-hero-meta" aria-label="Состав раздела">
            <li>{modulesCount(unit.modules.length)}</li>
            <li>{lessonsCount(unit.total)}</li>
          </ul>
        </div>
        <div className="lp-hero-lex" aria-hidden="true">
          <Lex mood={unit.state === "done" ? "joy" : "cool"} tone="pale" size={72} bob />
        </div>
      </section>

      {unit.state === "locked" && unit.opensAfter && (
        <Alert tone="info" title={`Раздел откроется после раздела ${unit.opensAfter.number}`}>
          Сначала пройди «{unit.opensAfter.title}». Уже знаешь тему? Открой урок и пройди проверку — при результате от 80%
          он засчитается сразу.
        </Alert>
      )}

      {unit.state === "done" && (
        <Alert
          tone="success"
          title="Раздел пройден"
          action={
            nextUnit ? (
              <ButtonLink href={unitHref(path.slug, nextUnit.key)} size="sm" variant="ghost">
                Дальше: {nextUnit.title}
              </ButtonLink>
            ) : (
              <ButtonLink href={pathHref(path.slug)} size="sm" variant="ghost">
                К карте курса
              </ButtonLink>
            )
          }
        >
          Все уроки раздела пройдены — к ним можно вернуться в любой момент.
        </Alert>
      )}

      {enrollmentStatus === "paused" && (
        <Alert
          tone="warning"
          title="Путь на паузе"
          action={
            <ButtonLink href={pathHref(path.slug)} size="sm" variant="ghost">
              К карте курса
            </ButtonLink>
          }
        >
          Прогресс сохранён. Продолжи путь на карте курса, чтобы идти дальше.
        </Alert>
      )}

      <section aria-labelledby="lp-lessons-title" className="flex flex-col gap-3">
        <h2 id="lp-lessons-title" className="lp-section-title">
          Уроки по порядку
        </h2>
        <ul className="lp-modules">
          {unit.modules.map((mod) => (
            <li key={mod.key}>
              <div className="lp-module-head">
                <h3 className="lp-module-title">{mod.title}</h3>
                <span className="text-xs text-[var(--text-secondary)]">{doneOfLessons(mod.done, mod.total)}</span>
              </div>
              <ol className="lp-path">
                {mod.lessons.map((lesson) => (
                  <li key={lesson.key}>
                    <LessonRow lesson={lesson} pathSlug={path.slug} />
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
