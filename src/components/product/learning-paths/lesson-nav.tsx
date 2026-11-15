import { ArrowLeft, ArrowRight, Lock } from "lucide-react";
import { Card, CardLink } from "@/components/ui/card";
import type { LessonNode } from "@/lib/learning-paths/path-map";
import { lessonHref } from "@/lib/learning-paths/routes";
import type { PathSlug } from "@/lib/learning-paths/types";

function NavItem({
  lesson,
  direction,
  pathSlug,
}: {
  lesson: LessonNode;
  direction: "prev" | "next";
  pathSlug: PathSlug;
}) {
  const caption = direction === "prev" ? "Предыдущий урок" : "Следующий урок";
  const text = (
    <span className="lp-nav-text">
      <span>{caption}</span>
      <span>{lesson.skill.title}</span>
    </span>
  );
  const className = direction === "next" ? "lp-nav-link lp-nav-next" : "lp-nav-link";

  // Сосед может быть закрыт (следующий урок пока недоступен) — тогда это не
  // ссылка, а пояснение; иначе кнопка вела бы на экран «урок закрыт».
  if (lesson.state === "locked") {
    return (
      <Card className={className} data-disabled="true">
        {direction === "prev" && <Lock aria-hidden="true" className="h-5 w-5 shrink-0" />}
        <span className="lp-nav-text">
          <span>{caption} · закрыт</span>
          <span>{lesson.skill.title}</span>
        </span>
        {direction === "next" && <Lock aria-hidden="true" className="h-5 w-5 shrink-0" />}
      </Card>
    );
  }

  return (
    <CardLink href={lessonHref(pathSlug, lesson)} className={className}>
      {direction === "prev" && <ArrowLeft aria-hidden="true" className="h-5 w-5 shrink-0" />}
      {text}
      {direction === "next" && <ArrowRight aria-hidden="true" className="h-5 w-5 shrink-0" />}
    </CardLink>
  );
}

// Переход к соседним урокам по порядку курса (в том числе через границу
// разделов).
export default function LessonNav({
  prev,
  next,
  pathSlug,
}: {
  prev: LessonNode | null;
  next: LessonNode | null;
  pathSlug: PathSlug;
}) {
  if (!prev && !next) return null;
  return (
    <nav aria-label="Соседние уроки" className="lp-nav">
      {prev && <NavItem lesson={prev} direction="prev" pathSlug={pathSlug} />}
      {next && <NavItem lesson={next} direction="next" pathSlug={pathSlug} />}
    </nav>
  );
}
