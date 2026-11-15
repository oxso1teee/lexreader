import { Check, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardLink } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { doneOfLessons, lessonsCount, modulesCount, opensAfterUnit } from "@/lib/learning-paths/copy";
import type { UnitNode } from "@/lib/learning-paths/path-map";
import { unitHref } from "@/lib/learning-paths/routes";
import type { PathSlug } from "@/lib/learning-paths/types";

// Раздел на карте курса (макет Curriculum): пройден — галочка и «8/8», текущий —
// выделен, с прогрессом и кнопкой, закрытый — замок и «Откроется после раздела N».
// Пока путь не начат (preview) состояния не показываем: у раздела нет ни
// замка, ни прогресса, и перейти в него нельзя.
export default function UnitCard({ unit, pathSlug, preview = false }: { unit: UnitNode; pathSlug: PathSlug; preview?: boolean }) {
  const titleId = `lp-unit-${unit.key}`;
  const tags = (
    <ul className="lp-tags" aria-label="Состав раздела">
      <li>
        <Badge>{modulesCount(unit.modules.length)}</Badge>
      </li>
      <li>
        <Badge>{lessonsCount(unit.total)}</Badge>
      </li>
    </ul>
  );

  if (preview) {
    return (
      <Card as="section" aria-labelledby={titleId} className="lp-unit" data-state="preview">
        <span className="lp-unit-no" aria-hidden="true">
          {unit.number}
        </span>
        <div className="lp-unit-body">
          <h3 id={titleId} className="lp-unit-title">
            {unit.title}
          </h3>
          <p className="text-sm text-[var(--text-secondary)]">{unit.description}</p>
          {tags}
        </div>
      </Card>
    );
  }

  if (unit.state === "current") {
    return (
      <Card as="section" aria-labelledby={titleId} className="lp-unit" data-state="current">
        <span className="lp-unit-no" aria-hidden="true">
          {unit.number}
        </span>
        <div className="lp-unit-body">
          <div className="lp-unit-head">
            <h3 id={titleId} className="lp-unit-title">
              {unit.title}
            </h3>
            <Badge tone="ember">сейчас</Badge>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">{unit.description}</p>
          {tags}
          <div className="flex items-center gap-2">
            <Progress
              value={unit.percent / 100}
              size="sm"
              className="min-w-0 flex-1"
              label={`Пройдено в разделе «${unit.title}»: ${doneOfLessons(unit.done, unit.total)}`}
            />
            <span className="shrink-0 text-xs font-bold">{doneOfLessons(unit.done, unit.total)}</span>
          </div>
          <ButtonLink href={unitHref(pathSlug, unit.key)} size="sm" className="self-start">
            Продолжить раздел
          </ButtonLink>
        </div>
      </Card>
    );
  }

  const done = unit.state === "done";
  return (
    <CardLink href={unitHref(pathSlug, unit.key)} className="lp-unit" data-state={unit.state}>
      <span className="lp-unit-no" aria-hidden="true">
        {done ? <Check className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
      </span>
      <div className="lp-unit-body">
        <div className="lp-unit-head">
          <h3 className="lp-unit-title">
            {done ? null : <span className="sr-only">Закрыт: </span>}
            {unit.title}
          </h3>
          {done && (
            <span className="shrink-0 text-xs font-bold text-[var(--leaf-text)]">
              {unit.done}/{unit.total}
              <span className="sr-only"> уроков пройдено</span>
            </span>
          )}
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          {done || !unit.opensAfter ? unit.description : opensAfterUnit(unit.opensAfter.number)}
        </p>
        {tags}
      </div>
    </CardLink>
  );
}
