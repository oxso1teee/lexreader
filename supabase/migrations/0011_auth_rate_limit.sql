-- P0-AUTH-04 release-readiness промта: троттлинг попыток входа. Пишется
-- через service_role (до аутентификации ещё нет пользовательской сессии,
-- RLS по owner_id здесь неприменим — идентификатор это email/IP, не user id).

create table auth_attempts (
  id bigint generated always as identity primary key,
  identifier text not null,
  attempted_at timestamptz not null default now()
);

create index auth_attempts_identifier_idx on auth_attempts (identifier, attempted_at desc);

alter table auth_attempts enable row level security;
-- Намеренно нет policy для authenticated/anon — доступ только через
-- service_role (см. src/lib/supabase/service.ts), обходит RLS.

grant select, insert, delete on auth_attempts to service_role;
