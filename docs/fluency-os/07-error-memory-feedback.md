# Фаза 7 — Error Memory + разбор «топ-3»

**Ворота:** Фаза 6 стабильно отдаёт `transcript_turns` (минимум 20
завершённых голосовых сессий с сохранённым транскриптом).
**Источник:** v1 §3.6, §3.8, §10 (prompt contract), v3 §90 (Errors
page), §85 post-session правило «top 3, не 40».

## Цель

Превратить сырой транскрипт голосовой сессии в: (а) короткий отчёт
для пользователя сразу после разговора, (б) записи в очередь
повторения (используя FSRS из Фазы 2), (в) накопительную группировку
по грамматическим паттернам для страницы «Ошибки».

## 7.1 Схема данных — `supabase/migrations/0036_learner_errors.sql`

```sql
create table learner_errors (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  voice_session_id uuid references voice_sessions(id) on delete set null,
  category text not null, -- 'grammar' | 'vocabulary' | 'word_order' | 'pronunciation' | 'filler_words'
  pattern_key text not null, -- 'present_perfect_continuous', 'articles', 'prepositions', ...
  original_text text not null,
  corrected_text text not null,
  explanation text not null,
  severity text not null default 'medium', -- 'low' | 'medium' | 'high'
  confidence numeric not null,
  status text not null default 'active', -- 'active' | 'improving' | 'resolved'
  occurrence_count int not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index learner_errors_owner_pattern_idx on learner_errors (owner_id, pattern_key);

alter table learner_errors enable row level security;
create policy "learner_errors: owner full access" on learner_errors for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
```

Правило накопления: при новом извлечении ошибки с тем же
`pattern_key` для того же `owner_id` за последние 14 дней — не
создавать новую строку, инкрементировать `occurrence_count` и
обновлять `last_seen_at`/`corrected_text`/`explanation` у
существующей. Это то, что превращает разрозненные случаи в паттерн
(«4 раза за 14 дней», см. мокап «Экран 07» в артефакте).

## 7.2 Извлечение ошибок — строгий JSON-контракт

Новый файл `src/lib/error-extractor.ts`. Промпт по образцу из v1
§10 — **обязательно** с валидацией JSON-схемы перед сохранением
(через `zod`, уже используется в проекте для других форм), не
доверять сырому тексту модели напрямую:

```ts
import { z } from "zod";

const ErrorSchema = z.object({
  category: z.enum(["grammar", "vocabulary", "word_order", "pronunciation", "filler_words"]),
  patternKey: z.string(),
  original: z.string(),
  corrected: z.string(),
  severity: z.enum(["low", "medium", "high"]),
  confidence: z.number().min(0).max(1),
  explanation: z.string(),
});
const ExtractionResultSchema = z.object({ errors: z.array(ErrorSchema).max(10) });
```

Вход: полный транскрипт (`transcript_turns` где `speaker = 'user'`),
профессия/уровень пользователя для контекста. Выход — не более 10
ошибок за сессию (сама модель не должна пытаться найти «всё» — цель
не exhaustive-разбор, а самые значимые повторяющиеся паттерны).

## 7.3 Пост-сессионный отчёт — правило «топ-3»

`src/app/(app)/voice-sessions/[id]/report/page.tsx` (новый маршрут):
из всех извлечённых ошибок сессии показывать **три** с наивысшим
`severity`/`confidence`, остальные — доступны по ссылке «весь
транскрипт», не на первом экране. Это прямое правило v3 §85 — явно
названное в документе как «не вываливать 40 ошибок».

Компонент карточки ошибки — уже смакетирован («Экран 06» в
`docs/FLUENCY_OS_VISION_ALL3_2026-07-31.html`): зачёркнутый
оригинал → исправленная версия → тег паттерна с частотой.

Кнопка «Добавить в повторение» — создаёт `flashcard` (используя уже
существующую инфраструктуру Мозга из Фазы 2) с `front` = corrected
sentence, `back` = original construction, и связывает с
`learner_errors.id` через новую колонку
`flashcards.source_error_id uuid references learner_errors(id)`.

## 7.4 Страница «Ошибки» — `src/app/(app)/errors/page.tsx`

Группировка по `pattern_key` (не по отдельным случаям) — карточка на
паттерн: название, частота, последний пример, статус, ссылка «начать
упражнение» (ведёт на review-сессию, отфильтрованную по связанным
flashcards). См. мокап «Экран 07».

`status` меняется автоматически: `active` → `improving`, если
`occurrence_count` не растёт 14 дней подряд при регулярном
использовании голоса; → `resolved`, если ошибка не встречалась 30
дней. Простое правило на cron (тот же паттерн, что и в Фазе 3).

## 7.5 AI Twin (лёгкая версия)

Полный AI Twin из v1 §3.8 (голосовое воспроизведение улучшенной
версии, повторная генерация новой ситуации с той же конструкцией) —
избыточен для этой фазы. Достаточно текстового варианта: в карточке
ошибки показывать оригинал → исправление → объяснение одним
предложением (уже покрыто 7.3). Голосовое воспроизведение
исправленной фразы — можно добавить позже через TTS-плагин, который
уже используется в voice-agent (Фаза 6), без нового провайдера.

## Критерий готовности фазы

- После завершения голосовой сессии в течение 30 секунд появляется
  отчёт с максимум 3 ошибками.
- Повторяющиеся паттерны действительно накапливаются (проверить: две
  сессии с одинаковой ошибкой → одна строка в `learner_errors` с
  `occurrence_count = 2`, не две отдельные).
- «Добавить в повторение» создаёт карточку, она появляется в
  due-очереди Мозга (Фаза 2).
- `/errors` показывает сгруппированный список, ссылка «начать
  упражнение» реально фильтрует review-сессию по паттерну.
- JSON-схема валидируется, невалидный ответ модели не роняет отчёт
  (graceful fallback: «не удалось разобрать эту сессию, попробуй ещё
  раз» вместо 500-й ошибки).
