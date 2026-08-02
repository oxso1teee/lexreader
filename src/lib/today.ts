// Чистая функция принятия решения о primary CTA на Today — вынесена
// отдельно от page.tsx, чтобы её можно было юнит-тестировать без
// Supabase/Next server context (docs/ui/unified-ui-slice-1-plan.md).
// Приоритет строго по заданию: due reviews > continue reading > add
// material — никогда не показываем выдуманный AI-mission CTA.
export type ContinueReadingInfo = {
  textId: string;
  title: string;
  percentRead: number;
};

export type PrimaryAction =
  | { type: "review"; dueCount: number }
  | ({ type: "continue_reading" } & ContinueReadingInfo)
  | { type: "add_material" };

export function decidePrimaryAction(input: {
  dueCount: number;
  continueReading: ContinueReadingInfo | null;
}): PrimaryAction {
  if (input.dueCount > 0) {
    return { type: "review", dueCount: input.dueCount };
  }
  if (input.continueReading) {
    return { type: "continue_reading", ...input.continueReading };
  }
  return { type: "add_material" };
}

// Privacy-safe bucket для аналитики (docs/ui/analytics-events.md) — точное
// число карточек не отправляем как есть, только диапазон.
export function dueCountBucket(dueCount: number): "0" | "1-5" | "6-20" | "20+" {
  if (dueCount <= 0) return "0";
  if (dueCount <= 5) return "1-5";
  if (dueCount <= 20) return "6-20";
  return "20+";
}

// Профиль не хранит имя пользователя — приветствие всегда безличное,
// только по времени суток (не выдумываем данные, которых нет).
export function greetingForHour(hour: number): string {
  if (hour < 5) return "Доброй ночи";
  if (hour < 12) return "Доброе утро";
  if (hour < 18) return "Добрый день";
  return "Добрый вечер";
}
