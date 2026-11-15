import type { ReactNode } from "react";
import { Lex } from "@/components/product/mascot/lex";
import { lessonsCount, unitsCount } from "@/lib/learning-paths/copy";
import type { PathMap } from "@/lib/learning-paths/path-map";
import type { EnrollmentStatus, LearningPath } from "@/lib/learning-paths/types";
import PathHero from "./path-hero";
import UnitCard from "./unit-card";

// Карта курса (макет Curriculum): hero с прогрессом и следующим шагом, ниже —
// разделы по порядку. Страница и галерея /dev/screens рисуют именно этот
// компонент, поэтому раскладка и состояния проверяются на нём же.
//
// Три положения пути: зачислен (карта с замками и прогрессом), на паузе (та
// же карта, но вместо следующего шага — возврат в путь) и не начат (описание
// пути и список разделов без состояний).
export default function PathView({
  path,
  map,
  enrollmentStatus,
  header,
  analytics,
  startAction,
  resumeAction,
  footer,
}: {
  path: LearningPath;
  map: PathMap;
  /** null — зачисления в этот путь нет. */
  enrollmentStatus: EnrollmentStatus | null;
  header: ReactNode;
  analytics?: ReactNode;
  /** «Начать путь» — для пути без зачисления (белая кнопка на hero). */
  startAction?: ReactNode;
  /** «Продолжить путь» — для пути на паузе (внутри карточки hero). */
  resumeAction?: ReactNode;
  /** Нижние действия: пауза, смена пути. */
  footer?: ReactNode;
}) {
  return (
    <div className="lp page-content" data-status={enrollmentStatus ?? "none"}>
      {analytics}
      {header}

      {enrollmentStatus !== null ? (
        <PathHero map={map} pathSlug={path.slug} status={enrollmentStatus} resumeAction={resumeAction} />
      ) : (
        <section aria-labelledby="lp-hero-title" className="lp-hero">
          <div className="lp-hero-body">
            <h2 id="lp-hero-title" className="lp-eyebrow">
              {path.levelFrom} → {path.levelTo}
            </h2>
            <p className="lp-hero-sub">{path.goal}</p>
            <ul className="lp-hero-meta" aria-label="Состав курса">
              <li>{unitsCount(map.totalUnits)}</li>
              <li>{lessonsCount(map.totalLessons)}</li>
            </ul>
            {startAction}
          </div>
          <div className="lp-hero-lex" aria-hidden="true">
            <Lex mood="wink" tone="pale" size={88} bob />
          </div>
        </section>
      )}

      <section aria-labelledby="lp-units-title" className="flex flex-col gap-3">
        <h2 id="lp-units-title" className="lp-section-title">
          Разделы
        </h2>
        <ol className="lp-units">
          {map.units.map((unit) => (
            <li key={unit.key}>
              <UnitCard unit={unit} pathSlug={path.slug} preview={enrollmentStatus === null} />
            </li>
          ))}
        </ol>
      </section>

      {footer}
    </div>
  );
}
