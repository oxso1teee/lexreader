# Фаза 2 — Настоящий FSRS вместо самодельного SM-2

**Ворота:** нет — дёшево, укладывается в текущий Next.js-монолит.
**Источник:** v1 §4.6 (`ts-fsrs`), v1 §13 Этап 1 «Надёжные фразы и FSRS».

## Важное уточнение по факту аудита кода

v1 предполагает, что в проекте нет ни модели «фраза», ни
интервального повторения, и предлагает строить оба с нуля. Это не
так: в LexReader уже есть рабочая система карточек с интервальным
повторением (`flashcards` + `srs_state` + `review_log`, миграция
`supabase/migrations/0004_decks.sql`), уже поддерживающая фразы (не
только одно слово — `front`/`back` могут содержать произвольный
текст), уже связанная с чтением (`flashcard_id` на `vocabulary_items`,
миграция `0028_link_reading_words_to_brain.sql` — слово, сохранённое
при чтении, сразу создаёт карточку). Экран повторения
(`src/app/(app)/brain/[deckId]/review/review-session.tsx`) уже
использует 4-балльную шкалу Again/Hard/Good/Easy («Не помню / Трудно
/ Помню / Легко»).

**Значит, Фаза 2 — не «построить с нуля», а точечный апгрейд:**
заменить самописный SM-2-подобный алгоритм в `src/lib/srs.ts` на
настоящий `ts-fsrs`, который даёт математически обоснованные
интервалы и умеет самообучаться на истории повторений конкретного
пользователя (это и есть то ценное, что v1 имел в виду под «FSRS»).

## 2.1 Установка

```bash
npm install ts-fsrs
```

## 2.2 Миграция — `supabase/migrations/0032_fsrs_state.sql`

Текущая `srs_state` (ключ `flashcard_id`): `ease_factor`,
`interval_days`, `repetitions`, `due_at`, `last_reviewed_at`. FSRS
использует другую модель состояния — добавляем новые колонки, не
удаляя старые (чтобы старые данные не терялись, если что-то пойдёт
не так — их всегда можно откатить):

```sql
alter table srs_state
  add column fsrs_stability numeric,
  add column fsrs_difficulty numeric,
  add column fsrs_state smallint, -- 0=New 1=Learning 2=Review 3=Relearning, см. ts-fsrs State enum
  add column fsrs_lapses int not null default 0,
  add column fsrs_reps int not null default 0;

alter table review_log
  add column response_time_ms int,
  add column previous_state_json jsonb,
  add column next_state_json jsonb;
```

Бэкфилл для существующих карточек: `DO $$ ... $$` блок, который для
каждой строки `srs_state` без `fsrs_stability` инициализирует FSRS
через `createEmptyCard()` (эквивалент на SQL-стороне — просто
проставить `fsrs_state = 0`, `fsrs_reps = repetitions`,
`fsrs_stability = null`; настоящая инициализация происходит лениво в
коде при первом ревью после миграции — см. 2.4).

## 2.3 Обёртка — `src/lib/fsrs.ts` (новый файл)

```ts
import { fsrs, generatorParameters, Rating, State, createEmptyCard, type Card } from "ts-fsrs";

const params = generatorParameters({ enable_fuzz: true });
const scheduler = fsrs(params);

export interface FsrsRow {
  fsrsStability: number | null;
  fsrsDifficulty: number | null;
  fsrsState: number | null;
  fsrsLapses: number;
  fsrsReps: number;
  dueAt: string;
  lastReviewedAt: string | null;
}

const GRADE_TO_RATING: Record<0 | 1 | 2 | 3, Rating> = {
  0: Rating.Again,
  1: Rating.Hard,
  2: Rating.Good,
  3: Rating.Easy,
};

export function reviewFsrsCard(row: FsrsRow, grade: 0 | 1 | 2 | 3, now = new Date()) {
  const card: Card =
    row.fsrsStability == null
      ? createEmptyCard(now)
      : {
          due: new Date(row.dueAt),
          stability: row.fsrsStability,
          difficulty: row.fsrsDifficulty!,
          elapsed_days: 0,
          scheduled_days: 0,
          reps: row.fsrsReps,
          lapses: row.fsrsLapses,
          state: row.fsrsState as State,
          last_review: row.lastReviewedAt ? new Date(row.lastReviewedAt) : undefined,
        };

  const result = scheduler.next(card, now, GRADE_TO_RATING[grade]);
  return {
    dueAt: result.card.due.toISOString(),
    fsrsStability: result.card.stability,
    fsrsDifficulty: result.card.difficulty,
    fsrsState: result.card.state,
    fsrsLapses: result.card.lapses,
    fsrsReps: result.card.reps,
    // для review_log.previous_state_json / next_state_json
    previousState: card,
    nextState: result.card,
  };
}
```

Не удалять `src/lib/srs.ts` — оставить как fallback-справочник и на
случай, если `ts-fsrs` понадобится сравнить со старым поведением при
отладке. Новый код использует только `fsrs.ts`.

## 2.4 Точка вызова — `src/app/(app)/brain/[deckId]/review/actions.ts`

Найти `reviewWord(flashcardId, grade)` (использует
`reviewSrsState` из `src/lib/srs.ts`). Заменить на вызов
`reviewFsrsCard`, сохранить `dueAt`/`fsrsStability`/`fsrsDifficulty`/
`fsrsState`/`fsrsLapses`/`fsrsReps` в `srs_state`, и записать в
`review_log` дополнительно `previous_state_json`/`next_state_json`
(результат `reviewFsrsCard`) — это тот самый лог, на основе которого
в будущем (не в этой фазе) можно будет запустить
`scheduler.computeParameters()` из `ts-fsrs` и подобрать персональные
параметры конкретному пользователю, как описано в v1 §4.6.

Due-очередь (`getDueCount`, `src/lib/brain-stats.ts`, и выборка
карточек для сессии) продолжает работать без изменений — она уже
фильтрует по `due_at <= now()`, а FSRS просто аккуратнее считает,
каким должен быть `due_at`.

## 2.5 Что НЕ делать в этой фазе

- Не переименовывать `flashcards`/`vocabulary_items` в `phrases` —
  это чисто косметическое переименование без функциональной пользы,
  ломает миграционную историю зря.
- Не добавлять Phrase Skill Graph (recognition_reading/listening/
  recall/pronunciation/free_usage из v1 §3.7) — это требует данных,
  которых ещё нет (нет голоса, нет отдельных типов упражнений).
  Отдельные измерения появятся органично в Фазе 7 (Error Memory) и
  Фазе 6 (голос), когда будет что туда писать.
- Не трогать `srs_settings` (Study Settings в Мозге) — там уже есть
  своя логика learning/relearning steps, FSRS это не заменяет, они
  сосуществуют.

## Критерий готовности фазы

- Миграция применена локально и в проде.
- `reviewWord` использует `ts-fsrs`, старые вызовы `reviewSrsState`
  из `srs.ts` больше не задействованы в рантайме.
- Юнит-тест на `reviewFsrsCard`: одинаковый grade на новой карточке
  даёт неотрицательный `dueAt` в будущем, `Again` (grade=0) всегда
  уменьшает интервал относительно предыдущего.
- Ручная проверка в браузере: пройти сессию повторения в `/brain`,
  убедиться, что due-очередь и статистика на Статистике не сломались.
- `review_log.previous_state_json`/`next_state_json` заполняются на
  каждом новом ревью — проверить прямым запросом к БД.
