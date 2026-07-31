-- Раздел 5 промта 2026-07-30 (рост): явный канал обратной связи в
-- Настройках — раньше его не было вообще.
create table feedback (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

alter table feedback enable row level security;

create policy "feedback: owner insert" on feedback
  for insert with check (owner_id = auth.uid());

grant insert on feedback to authenticated;
