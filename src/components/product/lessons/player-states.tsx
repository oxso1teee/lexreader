import { AlertTriangle } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { LessonErrorCode } from "@/lib/lessons/errors";

export interface PlayerError {
  code: LessonErrorCode;
  message: string;
  retryable: boolean;
}

const TITLES: Partial<Record<LessonErrorCode, string>> = {
  unauthorized: "Нужно войти снова",
  not_found: "Урок не найден",
  locked: "Урок пока закрыт",
  no_exercises: "Проверки для этого урока нет",
};

// Загрузка плеера: скелет повторяет форму экрана (шапка + карточка + кнопка),
// а смысл «идёт загрузка» несёт контейнер role="status".
export function PlayerLoading() {
  return (
    <div role="status" aria-busy="true" className="ls" data-state="loading">
      <span className="sr-only">Загружаем урок…</span>
      <div className="flex items-center gap-2" aria-hidden="true">
        <Skeleton circle width="2.75rem" />
        <Skeleton height="1.25rem" className="flex-1" />
        <Skeleton circle width="2.75rem" />
      </div>
      <Skeleton height="2.25rem" width="70%" />
      <Skeleton height="9rem" className="rounded-[var(--radius-card)]" />
      <Skeleton height="3.5rem" className="rounded-[var(--radius-btn)]" />
    </div>
  );
}

// Ошибка, из которой нужно дать выход: «Попробовать снова» там, где повтор
// может помочь; вход — если закончилась сессия; всегда — возврат к уроку.
// Разметка повторяет общий ErrorState (иконка в кружке, заголовок, текст), но
// заголовок здесь — настоящий h1: на экране ошибки больше нет ни шага, ни
// заголовка урока, и скринридер иначе остался бы без заголовка страницы.
export function PlayerFatal({
  error,
  onRetry,
  retrying,
  backHref,
  loginHref,
}: {
  error: PlayerError;
  onRetry?: () => void;
  retrying?: boolean;
  backHref: string;
  loginHref: string;
}) {
  return (
    <div className="ls" data-state="error">
      <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--danger-tint)]">
          <AlertTriangle aria-hidden="true" className="h-8 w-8 text-[var(--danger-text)]" />
        </span>
        <h1 className="ls-title text-center">{TITLES[error.code] ?? "Не получилось загрузить урок"}</h1>
        <p className="ls-lead max-w-xs">{error.message}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {error.code === "unauthorized" && <ButtonLink href={loginHref}>Войти</ButtonLink>}
          {error.retryable && onRetry && (
            <Button onClick={onRetry} loading={retrying}>
              Попробовать снова
            </Button>
          )}
          <ButtonLink href={backHref} variant="ghost">
            Вернуться к уроку
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
