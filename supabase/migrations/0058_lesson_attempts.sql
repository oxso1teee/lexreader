-- Phase 2, итерация 5 — уроки и упражнения: состояние прохождения урока.
--
-- Курс (шаги, упражнения, правильные ответы) остаётся статическим кодом
-- (src/lib/learning-paths/curriculum + src/lib/lessons), как и в 0038: таблицы
-- с контентом нет. Здесь хранится только то, что принадлежит пользователю:
-- на каком шаге он остановился, что ответил, чем закончилась попытка и
-- получено ли за навык XP. Итог по навыку по-прежнему пишется в
-- user_skill_progress (0038) — вторая система прогресса не заводится.
--
-- Модель доверия отличается от остальных таблиц пути: authenticated может
-- только ЧИТАТЬ свои строки. Любая запись идёт с сервера (service_role) после
-- серверной проверки ответа. Иначе пользователь мог бы напрямую через
-- PostgREST выставить себе правильные ответы, счётчики или «XP получен».
--
-- Строго аддитивно: ни одна существующая таблица и политика не меняется.
-- Откат — внизу (закомментирован, не выполняется).

create table lesson_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  path_slug text not null,
  path_version int not null default 1,
  skill_key text not null,
  -- lesson — полный урок; check — быстрая проверка знаний (только упражнения).
  mode text not null check (mode in ('lesson', 'check')),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned')),
  -- Сколько шагов плана уже пройдено; steps_total — длина плана на момент
  -- начала, plan_signature — отпечаток его состава (если курс изменился,
  -- открытая попытка закрывается как abandoned и начинается новая).
  step_index int not null default 0 check (step_index >= 0),
  steps_total int not null check (steps_total > 0),
  plan_signature text not null,
  check (step_index <= steps_total),
  -- [{exerciseId, response, correct, at}] — ответы пользователя. `correct`
  -- пересчитывается сервером при чтении, сохранённому флагу не доверяем.
  answers jsonb not null default '[]'::jsonb check (jsonb_typeof(answers) = 'array'),
  correct_count int not null default 0 check (correct_count >= 0),
  incorrect_count int not null default 0 check (incorrect_count >= 0),
  passed boolean,
  score_ratio numeric check (score_ratio is null or (score_ratio >= 0 and score_ratio <= 1)),
  -- XP: xp_claimed_at ставится атомарным UPDATE ... WHERE xp_claimed_at IS NULL
  -- до начисления (src/lib/lessons/supabase-store.ts::claimXp), xp_awarded —
  -- сколько реально начислено (с учётом Double-XP).
  xp_awarded int not null default 0 check (xp_awarded >= 0),
  xp_claimed_at timestamptz,
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  completed_at timestamptz,
  -- Побочные эффекты завершения (user_skill_progress, XP) применены. Пока NULL,
  -- повторный вызов завершения доделывает их — каждый шаг идемпотентен.
  finalized_at timestamptz
);

-- Не больше одной ОТКРЫТОЙ попытки на навык и режим: двойной клик «Начать»
-- или две вкладки не создают дубликатов — второй INSERT получает 23505 и
-- берёт уже созданную строку.
create unique index lesson_attempts_one_open_idx
  on lesson_attempts (user_id, path_slug, path_version, skill_key, mode)
  where status = 'in_progress';

-- XP за навык выдаётся не более одного раза за всё время, независимо от числа
-- попыток и параллельных запросов: второй claim упирается в этот индекс.
create unique index lesson_attempts_one_xp_claim_idx
  on lesson_attempts (user_id, path_slug, path_version, skill_key)
  where xp_claimed_at is not null;

create index lesson_attempts_user_skill_idx
  on lesson_attempts (user_id, path_slug, path_version, skill_key, started_at desc);

alter table lesson_attempts enable row level security;

create policy "lesson_attempts: owner can read" on lesson_attempts
  for select using (user_id = auth.uid());

-- Намеренно НЕТ политик insert/update/delete и грантов на запись для
-- authenticated (см. шапку).
grant select on lesson_attempts to authenticated;
grant select, insert, update, delete on lesson_attempts to service_role;

-- Откат (не выполняется — миграция аддитивна):
--
-- drop table if exists lesson_attempts cascade;
