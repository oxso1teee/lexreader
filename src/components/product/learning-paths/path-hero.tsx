import type { ReactNode } from "react";
import { Target } from "lucide-react";
import { Lex } from "@/components/product/mascot/lex";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { nextStepLabel, pathProgressLine } from "@/lib/learning-paths/copy";
import type { PathMap } from "@/lib/learning-paths/path-map";
import { lessonHref } from "@/lib/learning-paths/routes";
import type { PathSlug } from "@/lib/learning-paths/types";

// Курс целиком (макет Curriculum): процент пройденного, разделы и уроки,
// следующий шаг. Цифры — из PathMap, то есть из сохранённого прогресса;
// ничего не придумано (ни «недель», ни «слов», которых в курсе нет).
export default function PathHero({
  map,
  pathSlug,
  status,
  resumeAction,
}: {
  map: PathMap;
  pathSlug: PathSlug;
  /** Зачисление: на паузе вместо «следующего шага» показываем возврат в путь. */
  status: "active" | "paused" | "completed";
  resumeAction?: ReactNode;
}) {
  const finished = map.complete;
  const next = map.next;

  return (
    <section aria-labelledby="lp-hero-title" className="lp-hero">
      <div className="lp-hero-body">
        <h2 id="lp-hero-title" className="lp-eyebrow">
          {finished ? "Курс пройден" : "Пройдено курса"}
        </h2>
        <p className="lp-hero-num">{map.percent}%</p>
        <p className="lp-hero-sub">{pathProgressLine(map)}</p>
        <div
          className="lp-bar"
          role="progressbar"
          aria-valuenow={map.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Пройдено курса: ${map.percent}%`}
        >
          <span style={{ width: `${map.percent}%` }} />
        </div>

        {status === "paused" ? (
          <Card className="lp-next">
            <div className="lp-next-body">
              <p className="text-xs font-bold text-[var(--text-secondary)]">Путь на паузе</p>
              <p className="text-sm font-bold">Прогресс сохранён</p>
            </div>
            {resumeAction}
          </Card>
        ) : status === "active" && next ? (
          <Card className="lp-next">
            <span className="lp-sw" data-tone="ember" aria-hidden="true">
              <Target className="h-5 w-5" />
            </span>
            <div className="lp-next-body">
              <p className="text-xs font-bold text-[var(--text-secondary)]">Следующий шаг · раздел {next.unit.number}</p>
              <p className="truncate text-sm font-bold">{next.lesson.skill.title}</p>
            </div>
            <ButtonLink
              href={lessonHref(pathSlug, next.lesson)}
              size="sm"
              aria-label={`${nextStepLabel(map.started)}: ${next.lesson.skill.title}`}
            >
              {nextStepLabel(map.started)}
            </ButtonLink>
          </Card>
        ) : null}
      </div>
      <div className="lp-hero-lex" aria-hidden="true">
        <Lex mood={finished ? "joy" : "happy"} tone="pale" size={88} bob />
      </div>
    </section>
  );
}
