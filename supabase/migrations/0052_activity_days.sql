-- docs/moments/ROADMAP.md, этап 1 — дневной XP и история дней для Goal-done/
-- Streak-up (неделя из реальных дней) и будущих экранов стрика (этап 2).
--
-- Цель дня переходит со слов на XP (продуктовое решение из ROADMAP.md):
-- daily_word_goal остаётся как есть (используется им же для старой метрики),
-- daily_xp_goal — новая, отдельная колонка с шагами 20/50/80/120 XP
-- (= 5/10/15/20 минут занятия), по умолчанию 50.
alter table profiles add column daily_xp_goal int not null default 50
  check (daily_xp_goal > 0);

-- Одна строка на пользователя на день (UTC, как и все остальные "сегодня"-
-- границы в проекте — см. todayStartUtc() в home/page.tsx и vocabulary.ts).
-- xp/minutes/lessons — накопительные счётчики за день, freeze_used/goal_met —
-- факты, вычисленные в момент записи (goal_met сравнивается с
-- profiles.daily_xp_goal на тот момент — не пересчитывается ретроактивно,
-- если пользователь потом меняет цель, то же самое допущение, что и у
-- остальной "истории" в проекте, например review_log.practice_mode).
create table activity_days (
  user_id uuid not null references profiles(id) on delete cascade,
  day date not null,
  xp int not null default 0,
  minutes int not null default 0,
  lessons int not null default 0,
  freeze_used boolean not null default false,
  goal_met boolean not null default false,
  primary key (user_id, day)
);

create index activity_days_user_day_idx on activity_days (user_id, day desc);

alter table activity_days enable row level security;

create policy "activity_days: owner full access" on activity_days
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on activity_days to authenticated;

-- Откат:
-- drop table if exists activity_days;
-- alter table profiles drop column daily_xp_goal;
