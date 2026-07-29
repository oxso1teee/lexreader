-- docs/IMPLEMENTATION_PROMPT_2026-07-28.md, раздел 5: заморозка стрика (раз
-- в неделю пропуск одного дня не обнуляет серию) + журнал полученных
-- достижений (каталог достижений — код, lib/achievements.ts, не таблица;
-- здесь фиксируем только факт и дату получения).

alter table profiles add column streak_freeze_available boolean not null default true;
alter table profiles add column streak_freeze_week date;

-- Перенесено сюда из раздела 6 промта (личный рекорд сессии повторения):
-- достижение "Идеальная сессия" в каталоге ниже читает именно эту колонку,
-- так что она нужна уже на этом шаге, а не только когда дойдём до раздела 6.
alter table profiles add column review_best_session_count int not null default 0;

create table user_achievements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  achievement_id text not null,
  earned_at timestamptz not null default now(),
  unique (owner_id, achievement_id)
);

alter table user_achievements enable row level security;

create policy "user_achievements: owner select" on user_achievements
  for select using (owner_id = auth.uid());
create policy "user_achievements: owner insert" on user_achievements
  for insert with check (owner_id = auth.uid());

grant select, insert on user_achievements to authenticated;
