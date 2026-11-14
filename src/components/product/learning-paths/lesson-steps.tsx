import Link from "next/link";
import { Check, Lock } from "lucide-react";
import type { LessonNode } from "@/lib/learning-paths/path-map";
import { lessonHref } from "@/lib/learning-paths/routes";
import type { PathSlug } from "@/lib/learning-paths/types";

const STATE_WORD = { done: "пройден", current: "текущий", locked: "закрыт" } as const;

// Полоска шагов раздела на странице урока: где я в цепочке и что дальше.
// Открытые шаги — ссылки, закрытые — просто отмечены замком (перейти в закрытый
// урок можно из списка раздела: там он объяснён).
export default function LessonSteps({
  lessons,
  activeKey,
  pathSlug,
}: {
  lessons: LessonNode[];
  activeKey: string;
  pathSlug: PathSlug;
}) {
  return (
    <nav aria-label="Уроки раздела">
      <ol className="lp-steps">
        {lessons.map((lesson, index) => {
          const label = `Урок ${index + 1}: ${lesson.skill.title} — ${STATE_WORD[lesson.state]}`;
          const active = lesson.key === activeKey;
          return (
            <li key={lesson.key}>
              {lesson.state === "locked" ? (
                <span className="lp-step" data-state="locked" role="img" aria-label={label} aria-current={active ? "step" : undefined}>
                  <Lock aria-hidden="true" className="h-4 w-4" />
                </span>
              ) : (
                <Link
                  href={lessonHref(pathSlug, lesson)}
                  className="lp-step"
                  data-state={lesson.state}
                  aria-label={label}
                  aria-current={active ? "step" : undefined}
                >
                  {lesson.state === "done" ? <Check aria-hidden="true" className="h-4 w-4" /> : index + 1}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
