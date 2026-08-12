-- M3 Slice 8 — Learning Paths v1: user-specific state only. Curriculum
-- content itself is static, versioned TypeScript in
-- src/lib/learning-paths/curriculum/ — no table for it, nothing to migrate
-- when curriculum content changes. See docs/ui/m3-slice8-learning-paths-v1-plan.md.
--
-- Strictly additive: no existing table altered, no existing RLS policy
-- touched. Rollback is `drop table user_skill_progress,
-- learning_path_enrollments;` (commented out at the bottom, not executed).

create table learning_path_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  path_slug text not null,
  path_version int not null default 1,
  status text not null default 'active' check (status in ('active', 'paused', 'completed')),
  current_stage_key text not null,
  current_module_key text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One primary active path per user (plan doc §10/§12) — enforced at the DB
-- level, not just in application code. Switching pauses the old row first,
-- so this never blocks a legitimate switch.
create unique index learning_path_enrollments_one_active_idx
  on learning_path_enrollments (user_id) where status = 'active';

create index learning_path_enrollments_user_idx on learning_path_enrollments (user_id);

create table user_skill_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  path_slug text not null,
  path_version int not null default 1,
  skill_key text not null,
  status text not null default 'not_started' check (status in (
    'not_started', 'introduced', 'practicing', 'improving', 'confident', 'maintenance'
  )),
  evidence_count int not null default 0,
  confidence text not null default 'low' check (confidence in ('low', 'medium', 'high')),
  content_completed_at timestamptz,
  last_practiced_at timestamptz,
  knowledge_check_best_score numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, path_slug, path_version, skill_key)
);

create index user_skill_progress_user_idx on user_skill_progress (user_id);
create index user_skill_progress_user_path_idx on user_skill_progress (user_id, path_slug, path_version);

alter table learning_path_enrollments enable row level security;
alter table user_skill_progress enable row level security;

create policy "learning_path_enrollments: owner full access" on learning_path_enrollments
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "user_skill_progress: owner full access" on user_skill_progress
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on learning_path_enrollments, user_skill_progress to authenticated;

-- Rollback (not executed — additive-only migration):
--
-- drop table if exists user_skill_progress, learning_path_enrollments cascade;
