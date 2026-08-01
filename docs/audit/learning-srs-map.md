# M0 — Brain, карточки и SRS (готовность к миграции на ts-fsrs)

## Текущая реализация — CONFIRMED

- `src/lib/srs.ts` — самописный SM-2-подобный алгоритм, 4-балльная
  шкала (0=не помню, 1=трудно, 2=помню, 3=легко — **уже семантически
  совпадает с Again/Hard/Good/Easy из FSRS**, отличается только
  формула расчёта интервала). `DEFAULT_SRS_PARAMS`: easyBonus 1.3,
  intervalModifier 1.0, maxIntervalDays 36500, graduatingIntervalDays 1,
  easyIntervalDays 4. Явный комментарий в коде: полноценные Anki-style
  learning/relearning steps (внутридневные интервалы) хранятся и
  показываются в UI Study Settings, но **не влияют на расчёт**.
- `src/lib/brain-stats.ts` — `getDueCount()`, считает через join
  `srs_state` ⋈ `flashcards` (owner_id, language) с `due_at <= now()`.
- `src/app/(app)/brain/[deckId]/review/actions.ts` — `reviewWord(flashcardId, grade)`,
  вызывает `reviewSrsState()`, пишет обновлённое состояние в
  `srs_state` + строку в `review_log`.
- `src/app/(app)/brain/[deckId]/review/review-session.tsx` — UI сессии
  повторения: 4 кнопки оценки, вибро-отклик (опционально), таймер,
  флип-анимация, edit-during-review, отправка карточки в Тетрадь.

## Схема БД, актуальная на сейчас

`srs_state` (PK `flashcard_id`): `ease_factor numeric`,
`interval_days numeric`, `repetitions int`, `due_at timestamptz`,
`last_reviewed_at timestamptz`. `review_log`: `id`, `flashcard_id`,
`reviewed_at`, `grade int check (0..3)`.

Это **не** формат состояния FSRS (`stability`, `difficulty`, `state`
enum New/Learning/Review/Relearning, `reps`, `lapses`) — миграция
потребует новых колонок, не переиспользования старых один в один.

## Точные файлы, которые затронет будущая миграция на ts-fsrs

(Информация — не выполнять миграцию сейчас, только фиксация)

1. `src/lib/srs.ts` — оставить как fallback-справочник, не удалять;
   новый код должен жить в отдельном модуле (например, `src/lib/fsrs.ts`),
   не переписывать этот файл на месте.
2. `supabase/migrations/00XX_fsrs_state.sql` (новый файл) — добавить
   колонки `fsrs_stability`, `fsrs_difficulty`, `fsrs_state`,
   `fsrs_lapses`, `fsrs_reps` к `srs_state`; добавить
   `response_time_ms`, `previous_state_json`, `next_state_json` к
   `review_log`.
3. `src/app/(app)/brain/[deckId]/review/actions.ts` (`reviewWord`) —
   единственная точка записи результата ревью, должна переключиться
   на новый модуль.
4. `src/lib/brain-stats.ts` (`getDueCount`) — логика due-очереди не
   меняется (фильтр `due_at <= now()` работает одинаково для обеих
   систем), но стоит перепроверить после миграции.
5. `src/app/(app)/brain/[deckId]/review/review-session.tsx` — UI не
   должен меняться (шкала Again/Hard/Good/Easy уже совпадает).
6. `src/app/(app)/brain/settings/settings-form.tsx` и
   `src/lib/srs-settings.ts` — Study Settings текущей SM-2-системы;
   решить отдельно, остаются ли learning/relearning steps как есть
   или тоже мигрируют на FSRS-эквивалент.

Подробный пошаговый план уже существует в этом репозитории:
`docs/fluency-os/02-phrase-model-fsrs.md` (написан в этой же сессии,
до получения текущего набора из 10 файлов — не выполнялся).

## Не устанавливалось в рамках этого аудита

`ts-fsrs` не установлен (проверено — отсутствует в `package.json`).
Никакие миграции не запускались.

## Смежное — уже существует и не нужно строить заново

- Достижения (`user_achievements`, `src/lib/achievements.ts`,
  `achievements-actions.ts`), недельный квест, заморозка стрика —
  таблица/логика в `0025_engagement_layer.sql`.
- XP и звания (`profiles.xp`, `src/lib/xp-actions.ts`, `src/lib/ranks.ts`).
- Стартовые колоды (NGSL, CEFR) — `src/lib/starter-decks.ts`,
  `starter-deck-actions.ts`, `starter-deck-card.tsx`.
- Reader → Brain — слово, сохранённое при чтении, уже создаёт
  реальную SRS-карточку (`0028_link_reading_words_to_brain.sql`,
  `src/lib/vocabulary.ts` → `linkToDefaultDeck()`).
- Избранное (`vocabulary_items.favorite`, `0022`).
- Импорт/экспорт карточек — `src/lib/import-cards.ts` (протестирован),
  `src/app/api/export/vocabulary/route.ts`.
- Четыре режима повторения: standard review, match-pairs, multiple-choice,
  type-word (`review-mode-switcher.tsx` + три отдельных компонента режимов).

Это означает: трек 03 из спецификации (Learning Core/Language
Twin/FSRS) в значительной части **не** "построить с нуля" — это
точечная замена алгоритма планирования плюс добавление нового слоя
(Language Twin/Phrase Skill Graph), а не отсутствующая система.
