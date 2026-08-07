-- M3 Slice 6: Missions v1 — deterministic, evidence-based "next best step"
-- generated from Language Twin state. Two additive tables only; no changes
-- to any existing table. See docs/ui/m3-slice6-missions-v1-plan.md for the
-- full product/data-model rationale — this file is the implementation, not
-- the source of truth for *why*.
--
-- No mission_steps table on purpose: a mission's exact question set is
-- frozen into payload_json at generation time (see plan doc §6) so an
-- in-progress mission never changes shape after a deploy bumps
-- algorithm_version. Revisit only if per-user question variation is ever
-- actually built — don't add it speculatively now.

create table missions (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references profiles(id) on delete cascade,
  mission_type              text not null check (mission_type in (
    'grammar_pattern', 'vocab_activation', 'review_recovery', 'reading',
    'phrase_activation', 'correction', 'diagnostic_followup', 'maintenance', 'onboarding'
  )),
  source_pattern_id         uuid references language_error_patterns(id) on delete set null,
  source_recommendation_id  uuid references language_recommendations(id) on delete set null,
  title                     text not null,
  reason_key                text not null,
  skill_category            text,
  difficulty                text not null check (difficulty in ('easy', 'medium', 'hard')),
  estimated_minutes         int not null check (estimated_minutes > 0),
  step_count                int not null check (step_count > 0),
  status                    text not null default 'available' check (status in (
    'available', 'started', 'completed', 'dismissed', 'expired', 'replaced'
  )),
  priority                  text not null check (priority in ('high', 'medium', 'low')),
  fingerprint               text not null,
  payload_json              jsonb not null default '{}'::jsonb,
  algorithm_version         int not null default 1,
  generated_at              timestamptz not null default now(),
  started_at                timestamptz,
  completed_at              timestamptz,
  dismissed_at              timestamptz,
  expires_at                timestamptz not null
);

create index missions_user_idx on missions(user_id);
create index missions_user_status_idx on missions(user_id, status);
create index missions_user_generated_idx on missions(user_id, generated_at);
create index missions_user_expires_idx on missions(user_id, expires_at);

-- Database-backed duplicate prevention (plan doc §6/§11): a fingerprint can
-- have at most one row in an "active" state (available or started) per
-- user at a time. Two concurrent generation calls racing to insert the same
-- fingerprint will have exactly one succeed — the caller must catch the
-- unique-violation and treat it as "already exists, fetch and use that one."
create unique index missions_active_fingerprint_idx on missions(user_id, fingerprint)
  where status in ('available', 'started');

create table mission_attempts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references profiles(id) on delete cascade,
  mission_id         uuid not null references missions(id) on delete cascade,
  started_at         timestamptz not null default now(),
  completed_at       timestamptz,
  correct_count      int not null default 0,
  incorrect_count    int not null default 0,
  duration_seconds   int,
  current_step       int not null default 0,
  answers_json       jsonb not null default '[]'::jsonb,
  evidence_generated boolean not null default false,
  created_at         timestamptz not null default now()
);

create index mission_attempts_user_idx on mission_attempts(user_id);
create index mission_attempts_mission_idx on mission_attempts(mission_id);
create index mission_attempts_user_created_idx on mission_attempts(user_id, created_at);

-- At most one open (not-yet-completed) attempt per mission at a time — the
-- DB-level guarantee behind idempotent "start mission" (plan doc §10/§12):
-- a duplicate start request hits this constraint and the server action
-- falls back to returning the existing open attempt instead of erroring.
create unique index mission_attempts_active_idx on mission_attempts(mission_id)
  where completed_at is null;

alter table missions enable row level security;
create policy "missions: owner full access" on missions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on missions to authenticated;

alter table mission_attempts enable row level security;
create policy "mission_attempts: owner full access" on mission_attempts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on mission_attempts to authenticated;

-- Rollback (plan doc §19): purely additive migration, no existing table
-- touched — dropping both tables is fully safe and loses no other feature's
-- data.
--   drop table if exists mission_attempts;
--   drop table if exists missions;
