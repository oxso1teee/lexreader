// Коды ошибок серверных действий урока и их тексты для пользователя. Тексты
// здесь, а не в компонентах: каждый код имеет понятное сообщение и явный
// признак «можно повторить» — по нему интерфейс решает, показывать ли кнопку
// «Попробовать снова» или вести пользователя дальше.

export type LessonErrorCode =
  | "unauthorized"
  | "not_found"
  | "locked"
  | "no_exercises"
  | "out_of_sequence"
  | "empty_response"
  | "invalid_response"
  | "not_ready"
  | "stale_plan"
  | "conflict"
  | "storage_failed";

export interface LessonErrorInfo {
  message: string;
  /** Повтор того же действия может помочь (сеть, гонка, сбой хранилища). */
  retryable: boolean;
}

export const LESSON_ERRORS: Record<LessonErrorCode, LessonErrorInfo> = {
  unauthorized: { message: "Сессия закончилась. Войди снова — прогресс урока сохранён.", retryable: false },
  not_found: { message: "Такого урока нет — возможно, ссылка устарела.", retryable: false },
  locked: { message: "Урок ещё закрыт: он откроется после предыдущего.", retryable: false },
  no_exercises: { message: "Для этого урока пока нет заданий для проверки.", retryable: false },
  out_of_sequence: { message: "Этот шаг уже не актуален. Обновим урок и вернём тебя на нужное место.", retryable: true },
  empty_response: { message: "Сначала выбери или собери ответ.", retryable: false },
  invalid_response: { message: "Не удалось принять такой ответ. Попробуй ещё раз.", retryable: true },
  not_ready: { message: "В уроке остались непройденные шаги.", retryable: true },
  stale_plan: { message: "Урок обновился, пока ты занимался. Начнём заново — это быстро.", retryable: true },
  conflict: { message: "Урок открыт в другой вкладке. Обновим состояние.", retryable: true },
  storage_failed: { message: "Не удалось сохранить прогресс. Проверь соединение и повтори.", retryable: true },
};

export type ActionResult<T> = { ok: true; data: T } | { ok: false; code: LessonErrorCode; message: string; retryable: boolean };

export function failure(code: LessonErrorCode): { ok: false; code: LessonErrorCode; message: string; retryable: boolean } {
  const info = LESSON_ERRORS[code];
  return { ok: false, code, message: info.message, retryable: info.retryable };
}

export function success<T>(data: T): { ok: true; data: T } {
  return { ok: true, data };
}
