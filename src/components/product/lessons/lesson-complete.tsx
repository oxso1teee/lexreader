import { PartyPopper, RotateCcw, Target } from "lucide-react";
import type { Ref } from "react";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { doneOfLessons } from "@/lib/learning-paths/copy";
import { lessonHref } from "@/lib/learning-paths/routes";
import type { LessonCompletionDto } from "@/lib/lessons/dto";
import { LESSON_BASE_XP } from "@/lib/lessons/scoring";
import StepHeading from "./step-heading";

function headline(completion: LessonCompletionDto): { title: string; body: string } {
  const perfect = completion.scoreRatio === 1;
  if (completion.passed) {
    if (completion.path.complete) return { title: "Курс пройден!", body: "Ты прошёл все уроки пути. Отличная работа." };
    return {
      title: perfect ? "Без единой ошибки!" : "Урок пройден!",
      body: completion.lessonCompleted ? "Урок засчитан, следующий открыт." : "Результат записан.",
    };
  }
  return completion.mode === "check"
    ? { title: "Проверка не засчитана", body: "Для зачёта нужно от 80% правильных ответов. Вернись к уроку и попробуй ещё раз." }
    : { title: "Пока рано закрывать тему", body: "Для зачёта нужно хотя бы половина верных ответов. Перечитай материал и пройди урок ещё раз." };
}

function xpText(completion: LessonCompletionDto): string {
  if (completion.xpAwarded > 0) return `+${completion.xpAwarded}`;
  if (completion.xpPending) return "ожидает";
  if (completion.xpAlreadyEarned) return "уже получено";
  return completion.passed ? "—" : "не начислено";
}

// Экран результата. Показывает то, что сохранено на сервере: повторное открытие
// (обновление страницы) даёт те же цифры и не начисляет XP второй раз.
export default function LessonComplete({
  completion,
  skillTitle,
  lessonUrl,
  pathUrl,
  onRetry,
  retrying,
  onRetryXp,
  headingRef,
}: {
  completion: LessonCompletionDto;
  skillTitle: string;
  lessonUrl: string;
  pathUrl: string;
  onRetry: () => void;
  retrying: boolean;
  /** Повторить начисление XP (урок засчитан, а награда не дошла). */
  onRetryXp: () => void;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const { title, body } = headline(completion);
  const total = completion.correctCount + completion.incorrectCount;
  const percent = completion.scoreRatio === null ? null : Math.round(completion.scoreRatio * 100);
  const next = completion.nextLesson;

  return (
    <div className="ls-main" data-state={completion.passed ? "passed" : "failed"}>
      <Card tone={completion.passed ? "leaf" : "sunken"} className="flex flex-col gap-2">
        <StepHeading eyebrow={`${completion.mode === "check" ? "Проверка знаний" : "Урок"} · ${skillTitle}`} headingRef={headingRef}>
          {title}
        </StepHeading>
        <p className="ls-lead">{body}</p>
        {completion.firstWin && (
          <p className="m-0 flex items-center gap-2 text-sm font-bold">
            <PartyPopper aria-hidden="true" className="h-5 w-5" />
            Отличное начало! Твой путь сохранён — дальше «Сегодня» будет подсказывать, что делать.
          </p>
        )}
      </Card>

      {completion.xpPending && (
        <Alert
          tone="warning"
          live="polite"
          title="XP пока не начислен"
          action={
            <Button size="sm" variant="ghost" onClick={onRetryXp} loading={retrying}>
              Повторить начисление
            </Button>
          }
        >
          Урок засчитан и сохранён. Награда не дошла из-за временного сбоя — повтори, она не потеряется и не удвоится.
        </Alert>
      )}

      <dl className="ls-stats" aria-label="Итоги">
        {total > 0 && (
          <>
            <div className="ls-stat" data-tone="leaf">
              <dt>Верно</dt>
              <dd>{completion.correctCount}</dd>
            </div>
            <div className="ls-stat" data-tone={completion.incorrectCount > 0 ? "danger" : undefined}>
              <dt>Ошибок</dt>
              <dd>{completion.incorrectCount}</dd>
            </div>
            <div className="ls-stat">
              <dt>Результат</dt>
              <dd>{percent}%</dd>
            </div>
          </>
        )}
        <div className="ls-stat" data-tone={completion.xpAwarded > 0 ? "sun" : undefined} data-compact={completion.xpAwarded > 0 ? undefined : "true"}>
          <dt>XP</dt>
          <dd>{xpText(completion)}</dd>
        </div>
      </dl>

      <Card className="flex flex-col gap-2">
        <p className="m-0 text-sm font-bold">{completion.path.unitTitle}</p>
        <Progress
          value={completion.path.percent / 100}
          label={`Пройдено ${doneOfLessons(completion.path.doneLessons, completion.path.totalLessons)}`}
        />
        <p className="m-0 text-xs text-[var(--text-secondary)]">{doneOfLessons(completion.path.doneLessons, completion.path.totalLessons)}</p>
        {!completion.passed && completion.xpAwarded === 0 && !completion.xpAlreadyEarned && (
          <p className="m-0 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <Target aria-hidden="true" className="h-4 w-4 shrink-0" />
            За зачтённое прохождение: +{LESSON_BASE_XP} XP.
          </p>
        )}
      </Card>

      <div className="ls-actions">
        {completion.firstWin && (
          <ButtonLink href="/home" variant={next ? "ghost" : "leaf"}>
            Перейти в Today
          </ButtonLink>
        )}
        {!completion.passed && (
          <>
            <ButtonLink href={lessonUrl} variant="ghost">
              К материалу
            </ButtonLink>
            <Button onClick={onRetry} loading={retrying}>
              <RotateCcw aria-hidden="true" className="h-4 w-4" /> Попробовать ещё раз
            </Button>
          </>
        )}
        {completion.passed && (
          <>
            <ButtonLink href={pathUrl} variant="ghost">
              К пути
            </ButtonLink>
            {next ? (
              <ButtonLink href={lessonHref(completion.pathSlug, { unitKey: next.unitKey, key: next.skillKey })}>Дальше: {next.title}</ButtonLink>
            ) : (
              <ButtonLink href={pathUrl}>Продолжить обучение</ButtonLink>
            )}
          </>
        )}
      </div>
    </div>
  );
}
