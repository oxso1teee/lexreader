-- Раздел P0-AI-04 промта release-readiness: перевод слова — самый частый и
-- потенциально самый дорогой (внешний API) эндпоинт, дёргается на каждый тап
-- по слову. Лог запросов на пользователя для скользящего rate-limit.

create table translate_requests (
  id bigint generated always as identity primary key,
  owner_id uuid not null references profiles(id) on delete cascade,
  requested_at timestamptz not null default now()
);

create index translate_requests_owner_time_idx on translate_requests (owner_id, requested_at desc);

alter table translate_requests enable row level security;

create policy "translate_requests: owner full access" on translate_requests
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

grant select, insert, delete on translate_requests to authenticated;
grant select, insert, delete on translate_requests to service_role;
