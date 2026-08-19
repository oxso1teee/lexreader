-- Gamified redesign — Speak Studio. The one genuinely new practice
-- feature in this redesign (no speaking/pronunciation system existed at
-- all before: only mic-button.tsx's browser dictation for manual word
-- entry). One small, additive table, same owner-RLS pattern as every
-- other user-owned table (see e.g. 0037_missions.sql). No pronunciation
-- score column on purpose -- feedback is real (word count, wpm, grammar-
-- pattern matches via the existing correction-rules engine, see
-- src/lib/speaking-feedback.ts) but deliberately doesn't invent a
-- phoneme-level score no free tool in this stack can produce.
create table speaking_attempts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references profiles(id) on delete cascade,
  prompt           text not null,
  transcript       text not null,
  duration_seconds int not null check (duration_seconds >= 0),
  word_count       int not null check (word_count >= 0),
  xp_awarded       int not null default 0 check (xp_awarded >= 0),
  feedback_json    jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);

create index speaking_attempts_user_idx on speaking_attempts(user_id);
create index speaking_attempts_user_created_idx on speaking_attempts(user_id, created_at);

alter table speaking_attempts enable row level security;
create policy "speaking_attempts: owner full access" on speaking_attempts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on speaking_attempts to authenticated;
