-- Push-уведомления о повторении (раздел 4.7 ТЗ).
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index push_subscriptions_owner_idx on push_subscriptions (owner_id);

alter table push_subscriptions enable row level security;

create policy "push_subscriptions: owner full access" on push_subscriptions
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

grant select, insert, update, delete on push_subscriptions to authenticated;
