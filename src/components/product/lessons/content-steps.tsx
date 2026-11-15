import type { Ref } from "react";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { LESSON_KIND_LABEL, lessonKind } from "@/lib/learning-paths/lesson-kind";
import type { LessonContent } from "@/lib/learning-paths/types";
import type { ContentBlock } from "@/lib/lessons/types";
import StepHeading from "./step-heading";

// Шаги урока с содержимым. Текст берётся из курса как есть (objective,
// explanation, examples, commonMistakes) — ничего не придумываем; примеры в
// курсе без перевода, поэтому показываются как есть.

export interface LessonOutline {
  hasMistakes: boolean;
  exerciseCount: number;
}

function outlineLine({ hasMistakes, exerciseCount }: LessonOutline): string[] {
  const parts = ["Правило и примеры"];
  if (hasMistakes) parts.push("Частые ошибки");
  if (exerciseCount > 0) parts.push(`Упражнения: ${exerciseCount}`);
  return parts;
}

function IntroStep({ skillKey, content, outline, headingRef }: { skillKey: string; content: LessonContent; outline: LessonOutline; headingRef?: Ref<HTMLHeadingElement> }) {
  return (
    <>
      <StepHeading eyebrow={LESSON_KIND_LABEL[lessonKind(skillKey)]} headingRef={headingRef}>
        {content.objective}
      </StepHeading>
      <Card className="flex flex-col gap-2">
        <h2 className="lp-section-title">В этом уроке</h2>
        <ul className="ls-list">
          {outlineLine(outline).map((line) => (
            <li key={line} className="text-sm font-semibold">
              {line}
            </li>
          ))}
        </ul>
        <p className="ls-lead">Прогресс сохраняется после каждого шага — можно закрыть урок и вернуться с того же места.</p>
      </Card>
    </>
  );
}

function MaterialStep({ content, headingRef }: { content: LessonContent; headingRef?: Ref<HTMLHeadingElement> }) {
  return (
    <>
      <StepHeading eyebrow="Правило" headingRef={headingRef}>
        Разберём тему
      </StepHeading>
      <Card className="flex flex-col gap-4">
        <p className="m-0 text-base leading-relaxed">{content.explanation}</p>
        <section aria-labelledby="ls-examples-title" className="flex flex-col gap-2">
          <h2 id="ls-examples-title" className="lp-section-title">
            Примеры
          </h2>
          <ul className="ls-list">
            {content.examples.map((example, index) => (
              <li key={index} className="ls-example">
                {example}
              </li>
            ))}
          </ul>
        </section>
      </Card>
    </>
  );
}

function MistakesStep({ content, headingRef }: { content: LessonContent; headingRef?: Ref<HTMLHeadingElement> }) {
  return (
    <>
      <StepHeading eyebrow="Осторожно" headingRef={headingRef}>
        Частые ошибки
      </StepHeading>
      <ul className="ls-list">
        {content.commonMistakes.map((mistake, index) => (
          <li key={index}>
            <Alert tone="warning">{mistake}</Alert>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function ContentStep({
  block,
  skillKey,
  content,
  outline,
  headingRef,
}: {
  block: ContentBlock;
  skillKey: string;
  content: LessonContent;
  outline: LessonOutline;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  switch (block) {
    case "intro":
      return <IntroStep skillKey={skillKey} content={content} outline={outline} headingRef={headingRef} />;
    case "material":
      return <MaterialStep content={content} headingRef={headingRef} />;
    case "mistakes":
      return <MistakesStep content={content} headingRef={headingRef} />;
  }
}
