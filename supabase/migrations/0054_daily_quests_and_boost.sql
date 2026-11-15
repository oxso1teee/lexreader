-- docs/moments/ROADMAP.md, этап 5 — Daily-quests (3 задания дня, отдельно
-- от недельных миссий), Chest (награда: XP + заморозка + Double-XP) и
-- Double-XP (множитель в addXp).
--
-- daily_quests хранит только ЦЕЛИ (target), не прогресс — прогресс всегда
-- считается живьём из reading_sessions/review_log за day (src/lib/
-- daily-quests.ts), тот же принцип, что у остальных "дневных" метрик
-- проекта: хранить факт, не кэш производного числа. day — UTC, как и
-- activity_days (todayUtcIso()) — "по времени пользователя" из роадмапа не
-- реализовано: в profiles нет колонки часового пояса, и заводить её только
-- для этого было бы явным расширением задачи за пределы этого этапа.
create table daily_quests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  day date not null,
  quest_type text not null check (quest_type in ('read_minutes', 'review_words', 'combo_streak')),
  target int not null check (target > 0),
  created_at timestamptz not null default now(),
  unique (owner_id, day, quest_type)
);

create index daily_quests_owner_day_idx on daily_quests (owner_id, day desc);

alter table daily_quests enable row level security;

create policy "daily_quests: owner full access" on daily_quests
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

grant select, insert, update, delete on daily_quests to authenticated;

-- Сторож от повторного открытия сундука в тот же день — тот же приём, что
-- у perfect_week_awarded_week (0053).
alter table profiles add column daily_quest_chest_claimed_date date;

-- Double-XP: множитель активен, пока now() < xp_boost_until (addXp() в
-- xp-actions.ts). NULL — буста нет.
alter table profiles add column xp_boost_until timestamptz;

-- Откат:
-- alter table profiles drop column xp_boost_until;
-- alter table profiles drop column daily_quest_chest_claimed_date;
-- drop table if exists daily_quests;
