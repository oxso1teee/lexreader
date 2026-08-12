-- M3 Slice 9 — Onboarding + Placement v2 (docs/ui/m3-slice9-onboarding-
-- placement-v2-plan.md §8). Strictly additive: no existing table altered
-- except two widening constraint changes (profiles gets 2 new nullable
-- columns; language_evidence's source_type check constraint gains one new
-- allowed value), no existing column changed, no existing RLS policy
-- touched, no existing row's data affected.
--
-- profiles.level (beginner/intermediate/advanced) is deliberately left
-- untouched — plan doc §1/§5: repurposing its values to CEFR letters would
-- require fabricating a backfilled guess for every existing user's
-- already-stored value, which the plan doc explicitly rejects as
-- dishonest. The new CEFR self-report lives in its own column instead.

create table placement_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  version int not null default 1,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'skipped')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  question_count int not null default 0,
  correct_count int not null default 0,
  -- [{question_id, category, difficulty_tier, correct}] only — never
  -- prompt/option text (plan doc §8's explicit privacy preference).
  answers_json jsonb not null default '[]'::jsonb,
  result_range text check (result_range in ('A1–A2', 'A2–B1', 'B1–B2', 'B2+')),
  confidence text check (confidence in ('low', 'medium', 'high')),
  category_scores_json jsonb not null default '{}'::jsonb,
  recommended_path_slug text,
  self_reported_level_at_attempt text,
  primary_goal_at_attempt text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index placement_attempts_user_idx on placement_attempts (user_id);
create index placement_attempts_user_started_idx on placement_attempts (user_id, started_at desc);

alter table placement_attempts enable row level security;
create policy "placement_attempts: owner full access" on placement_attempts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on placement_attempts to authenticated;

-- profiles: 2 new nullable columns (plan doc §4/§5). Nullable because
-- every existing row predates both fields — never backfilled with a guess.
alter table profiles add column primary_goal text
  check (primary_goal in ('everyday', 'travel', 'work_it', 'study', 'friends_international', 'reading_content', 'general'));
alter table profiles add column self_reported_cefr text
  check (self_reported_cefr in ('A1', 'A2', 'B1', 'B2', 'unsure'));

-- language_evidence: widen source_type to add 'placement_session' (plan
-- doc §13). Same additive-constraint-swap pattern as migration 0039 —
-- source_type is plain text with an inline check, not a Postgres enum, so
-- this is a safe constraint replacement, not ALTER TYPE ADD VALUE. No
-- existing row uses the new value yet, and no existing allowed value is
-- removed.
alter table language_evidence drop constraint if exists language_evidence_source_type_check;
alter table language_evidence add constraint language_evidence_source_type_check
  check (source_type in ('flashcard', 'vocabulary_item', 'correction_submission', 'diagnostic_session', 'placement_session'));

-- Rollback (not executed — additive-only migration):
--
-- drop table if exists placement_attempts cascade;
-- alter table profiles drop column if exists primary_goal;
-- alter table profiles drop column if exists self_reported_cefr;
--
-- language_evidence's constraint rollback is safe only if no row uses the
-- new value yet — verify with:
--   select count(*) from language_evidence where source_type = 'placement_session';
-- returning 0 before running:
--
-- alter table language_evidence drop constraint if exists language_evidence_source_type_check;
-- alter table language_evidence add constraint language_evidence_source_type_check
--   check (source_type in ('flashcard', 'vocabulary_item', 'correction_submission', 'diagnostic_session'));
