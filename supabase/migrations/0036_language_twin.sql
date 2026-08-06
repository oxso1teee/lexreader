-- M3 Slice 5: Language Twin v1 — personalization layer built entirely on
-- deterministic aggregation of existing signals (review_log, vocabulary_items,
-- reading_sessions) plus one new consented input (Correction Input). No
-- external AI, no paid API — see docs/ui/m3-slice5-language-twin-plan.md.
--
-- Naming note: every other owned table in this schema uses `owner_id`
-- (vocabulary_items, decks, flashcards, srs_settings, collections). These six
-- tables intentionally use `user_id` instead, matching the exact column name
-- fixed in the approved audit/plan doc (docs/ui/m3-slice5-language-twin-plan.md
-- §5) — a deliberate, documented one-off, not an oversight.
--
-- All six tables are strictly additive: no existing table is altered, no
-- existing column changed, no existing RLS policy touched. Rollback is a
-- single `drop table ... cascade` — see the bottom of this file (commented
-- out; not executed by this migration).

create table language_twin_profiles (
  user_id uuid primary key references profiles(id) on delete cascade,
  self_reported_level text,
  diagnostic_level_range text,
  behavioral_level_range text,
  confidence text not null default 'low' check (confidence in ('low', 'medium', 'high')),
  confidence_score numeric not null default 0,
  observed_receptive_vocabulary int,
  observed_active_vocabulary int,
  summary_json jsonb not null default '{}'::jsonb,
  strengths_json jsonb not null default '[]'::jsonb,
  weaknesses_json jsonb not null default '[]'::jsonb,
  recommendations_json jsonb not null default '[]'::jsonb,
  algorithm_version int not null default 1,
  last_recomputed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table language_error_patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  category text not null check (category in (
    'activation', 'review_recall', 'article', 'preposition', 'word_order',
    'tense', 'passive', 'gerund_infinitive', 'possession', 'collocation',
    'spelling', 'other'
  )),
  pattern_key text not null,
  title text not null,
  description text not null,
  confidence text not null default 'low' check (confidence in ('low', 'medium', 'high')),
  confidence_score numeric not null default 0,
  evidence_count int not null default 0,
  severity text not null default 'low' check (severity in ('low', 'medium', 'high')),
  trend text not null default 'flat' check (trend in ('up', 'down', 'flat')),
  status text not null default 'uncertain' check (status in (
    'active', 'improving', 'resolved', 'uncertain', 'dismissed'
  )),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, pattern_key)
);

-- Deliberately does NOT store raw sentence/word/translation text for
-- review- or reading-derived evidence — those join back to flashcards/
-- vocabulary_items by source_id at display time. source_id is a soft
-- reference (no FK): it can point at flashcards, vocabulary_items,
-- language_correction_submissions, or a diagnostic session id depending on
-- source_type, and this schema has no existing precedent for a polymorphic
-- FK — validated in application code instead.
create table language_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  pattern_id uuid references language_error_patterns(id) on delete set null,
  evidence_type text not null,
  source_type text not null check (source_type in (
    'flashcard', 'vocabulary_item', 'correction_submission', 'diagnostic_session'
  )),
  source_id uuid,
  normalized_category text,
  result text,
  confidence text not null default 'low' check (confidence in ('low', 'medium', 'high')),
  metadata_json jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table language_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  recommendation_type text not null,
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  reason_key text not null,
  related_pattern_id uuid references language_error_patterns(id) on delete set null,
  action_type text not null,
  action_target_json jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'dismissed', 'completed', 'expired')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  dismissed_at timestamptz,
  expires_at timestamptz
);

create table language_twin_settings (
  user_id uuid primary key references profiles(id) on delete cascade,
  enabled boolean not null default true,
  include_review_history boolean not null default true,
  include_reading_behavior boolean not null default true,
  include_writing_exercises boolean not null default true,
  include_saved_vocabulary boolean not null default true,
  allow_diagnostic boolean not null default true,
  algorithm_version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Kept separate from language_evidence on purpose: this is the one table
-- where a user's own brand-new free text is stored, and only after they
-- explicitly click "Сохранить как свидетельство" in the Correction Input
-- screen — never captured automatically. Its own row means its own
-- independent delete/export path, distinct from the rest of the feature's
-- id-only evidence.
create table language_correction_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  submitted_text text not null,
  detected_patterns_json jsonb not null default '[]'::jsonb,
  suggested_correction text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index language_error_patterns_user_idx on language_error_patterns (user_id);
create index language_error_patterns_user_status_idx on language_error_patterns (user_id, status);
create index language_evidence_user_idx on language_evidence (user_id);
create index language_evidence_user_created_idx on language_evidence (user_id, created_at);
create index language_evidence_pattern_idx on language_evidence (pattern_id);
create index language_recommendations_user_idx on language_recommendations (user_id);
create index language_recommendations_user_status_idx on language_recommendations (user_id, status);
create index language_correction_submissions_user_created_idx on language_correction_submissions (user_id, created_at);

alter table language_twin_profiles enable row level security;
alter table language_error_patterns enable row level security;
alter table language_evidence enable row level security;
alter table language_recommendations enable row level security;
alter table language_twin_settings enable row level security;
alter table language_correction_submissions enable row level security;

-- Same "owner full access" shape used everywhere else in this schema
-- (vocabulary_items, decks, flashcards, srs_settings, collections) — just
-- keyed on user_id instead of owner_id per the naming note above.
create policy "language_twin_profiles: owner full access" on language_twin_profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "language_error_patterns: owner full access" on language_error_patterns
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "language_evidence: owner full access" on language_evidence
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "language_recommendations: owner full access" on language_recommendations
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "language_twin_settings: owner full access" on language_twin_settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "language_correction_submissions: owner full access" on language_correction_submissions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on
  language_twin_profiles, language_error_patterns, language_evidence,
  language_recommendations, language_twin_settings, language_correction_submissions
  to authenticated;

-- Rollback (not executed — additive-only migration, kept here for the
-- migration checkpoint per docs/ui/m3-slice5-language-twin-plan.md §14):
--
-- drop table if exists
--   language_correction_submissions, language_recommendations, language_evidence,
--   language_error_patterns, language_twin_settings, language_twin_profiles
--   cascade;
