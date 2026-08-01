-- M2 Learning Upgrade (LEARN-002): additive FSRS columns, ничего не удаляем.
-- ease_factor/interval_days/repetitions/due_at/last_reviewed_at остаются —
-- пока FSRS_ENABLED=false, они по-прежнему единственный источник истины;
-- пока FSRS_ENABLED=true, они продолжают параллельно обновляться (см.
-- src/app/(app)/brain/[deckId]/review/actions.ts), чтобы откат флага назад
-- не встречал карточки с состоянием, замороженным на дату переключения.
--
-- Значения ts-fsrs Card/State/Rating взяты из фактических типов
-- node_modules/ts-fsrs/dist/index.d.ts (версия 5.4.1), не по памяти:
-- State: 0=New 1=Learning 2=Review 3=Relearning.
alter table srs_state
  add column fsrs_stability numeric,
  add column fsrs_difficulty numeric,
  add column fsrs_state smallint,
  add column fsrs_lapses int not null default 0,
  add column fsrs_reps int not null default 0,
  add column fsrs_scheduled_days numeric not null default 0;

-- previous/next_state_json хранят полный Card (до/после) для конкретного
-- ревью — источник данных для будущего scheduler.computeParameters() и для
-- разбора расхождений между алгоритмами при откате. scheduler_type
-- фиксирует, каким алгоритмом реально был посчитан due_at в этой строке
-- лога (due_at в srs_state всегда один, но разные ревью в истории могли
-- считаться разными планировщиками при переключении флага).
alter table review_log
  add column scheduler_type text not null default 'sm2' check (scheduler_type in ('sm2', 'fsrs')),
  add column previous_state_json jsonb,
  add column next_state_json jsonb;

-- RLS не меняется: новые колонки — часть тех же таблиц srs_state/review_log,
-- существующие политики "srs_state: owner full access" и
-- "review_log: owner full access" (миграция 0004_decks.sql) применяются к
-- строкам целиком, не к отдельным колонкам.
