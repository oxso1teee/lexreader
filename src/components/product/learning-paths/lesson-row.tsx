import { BookOpen, CircleCheck, Layers, Lock, MessageCircle, PenLine, Puzzle, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardLink } from "@/components/ui/card";
import { opensAfterLesson } from "@/lib/learning-paths/copy";
import { LESSON_KIND_LABEL, lessonKind, type LessonKind } from "@/lib/learning-paths/lesson-kind";
import type { LessonNode } from "@/lib/learning-paths/path-map";
import { lessonHref } from "@/lib/learning-paths/routes";
import type { PathSlug } from "@/lib/learning-paths/types";
import { SkillStatusBadge } from "./badges";

const KIND_ICON: Record<LessonKind, LucideIcon> = {
  grammar: Puzzle,
  vocabulary: Layers,
  reading: BookOpen,
  writing: PenLine,
  topic: MessageCircle,
};

// Один урок в цепочке раздела (макет Unit-overview): пройден — галочка и статус
// навыка, текущий — выделен и с кнопкой, закрытый — замок и «Откроется после…».
// Закрытый урок остаётся ссылкой: страница объяснит, почему закрыт, и предложит
// пройти проверку, если тема уже знакома.
export default function LessonRow({ lesson, pathSlug }: { lesson: LessonNode; pathSlug: PathSlug }) {
  const kind = lessonKind(lesson.key);
  const KindIcon = KIND_ICON[kind];
  const href = lessonHref(pathSlug, lesson);
  const swatch = (
    <span className="lp-sw" aria-hidden="true">
      {lesson.state === "locked" ? <Lock className="h-5 w-5" /> : <KindIcon className="h-5 w-5" />}
    </span>
  );

  if (lesson.state === "current") {
    return (
      <Card className="lp-lesson" data-state="current">
        {swatch}
        <div className="lp-lesson-body">
          <p className="lp-lesson-title">{lesson.skill.title}</p>
          <p className="lp-lesson-sub">{lesson.skill.lesson.objective}</p>
        </div>
        <div className="lp-lesson-end">
          <Badge tone="ember">сейчас</Badge>
          <ButtonLink href={href} size="sm" aria-current="step" aria-label={`${lesson.status === "not_started" ? "Начать урок" : "Продолжить"}: ${lesson.skill.title}`}>
            {lesson.status === "not_started" ? "Начать урок" : "Продолжить"}
          </ButtonLink>
        </div>
      </Card>
    );
  }

  if (lesson.state === "done") {
    return (
      <CardLink href={href} className="lp-lesson" data-state="done">
        {swatch}
        <div className="lp-lesson-body">
          <p className="lp-lesson-title">{lesson.skill.title}</p>
          <p className="lp-lesson-sub">{LESSON_KIND_LABEL[kind]}</p>
        </div>
        <div className="lp-lesson-end">
          <SkillStatusBadge status={lesson.status} />
          <CircleCheck aria-hidden="true" className="lp-done-mark h-6 w-6" />
          <span className="sr-only">Урок пройден</span>
        </div>
      </CardLink>
    );
  }

  return (
    <CardLink href={href} className="lp-lesson" data-state="locked">
      {swatch}
      <div className="lp-lesson-body">
        <p className="lp-lesson-title">
          <span className="sr-only">Закрыт: </span>
          {lesson.skill.title}
        </p>
        <p className="lp-lesson-sub">{lesson.opensAfter ? opensAfterLesson(lesson.opensAfter.title) : LESSON_KIND_LABEL[kind]}</p>
      </div>
    </CardLink>
  );
}
