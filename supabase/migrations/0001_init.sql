-- LexReader — начальная схема (раздел 5 ТЗ)
create extension if not exists pgcrypto;

-- профиль пользователя, привязан к auth.users
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  target_language text not null,
  native_language text not null,
  level text,
  daily_word_goal int not null default 10,
  streak_current int not null default 0,
  streak_longest int not null default 0,
  last_active_date date,
  created_at timestamptz not null default now()
);

create table texts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete cascade, -- null = системный/библиотечный текст
  title text not null,
  body text not null,
  source_type text not null check (source_type in ('manual','article_url','youtube','system')),
  source_url text,
  language text not null,
  level_tag text,
  word_count int,
  created_at timestamptz not null default now()
);

create table vocabulary_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  source_text_id uuid references texts(id) on delete set null,
  headword text not null,
  translation text not null,
  context_sentence text,
  context_translation text,
  photo_url text,
  status text not null default 'new' check (status in ('new','learning','known','ignored')),
  created_at timestamptz not null default now()
);

create table srs_state (
  vocabulary_item_id uuid primary key references vocabulary_items(id) on delete cascade,
  ease_factor numeric not null default 2.5,
  interval_days numeric not null default 0,
  repetitions int not null default 0,
  due_at timestamptz not null default now(),
  last_reviewed_at timestamptz
);

create table review_log (
  id uuid primary key default gen_random_uuid(),
  vocabulary_item_id uuid not null references vocabulary_items(id) on delete cascade,
  reviewed_at timestamptz not null default now(),
  grade int not null check (grade between 0 and 3)
);

create table reading_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  text_id uuid references texts(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  words_looked_up int not null default 0
);

create table subscriptions (
  owner_id uuid primary key references profiles(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','premium_monthly','premium_yearly')),
  status text not null default 'active',
  provider text check (provider in ('apple','google','stripe')),
  current_period_end timestamptz
);

-- общий кеш переводов между всеми пользователями (раздел 7 ТЗ)
create table translations_cache (
  id uuid primary key default gen_random_uuid(),
  source_text text not null,
  source_lang text not null,
  target_lang text not null,
  translation text not null,
  created_at timestamptz not null default now(),
  unique (source_text, source_lang, target_lang)
);

create index vocabulary_items_owner_status_idx on vocabulary_items (owner_id, status);
create index srs_state_due_at_idx on srs_state (due_at);
create index texts_owner_language_idx on texts (owner_id, language);

-- Row Level Security
alter table profiles enable row level security;
alter table texts enable row level security;
alter table vocabulary_items enable row level security;
alter table srs_state enable row level security;
alter table review_log enable row level security;
alter table reading_sessions enable row level security;
alter table subscriptions enable row level security;
alter table translations_cache enable row level security;

create policy "profiles: owner full access" on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy "texts: read own or system" on texts
  for select using (owner_id = auth.uid() or owner_id is null);
create policy "texts: write own" on texts
  for insert with check (owner_id = auth.uid());
create policy "texts: update own" on texts
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "texts: delete own" on texts
  for delete using (owner_id = auth.uid());

create policy "vocabulary_items: owner full access" on vocabulary_items
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "srs_state: owner full access" on srs_state
  for all using (
    exists (
      select 1 from vocabulary_items v
      where v.id = srs_state.vocabulary_item_id and v.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from vocabulary_items v
      where v.id = srs_state.vocabulary_item_id and v.owner_id = auth.uid()
    )
  );

create policy "review_log: owner full access" on review_log
  for all using (
    exists (
      select 1 from vocabulary_items v
      where v.id = review_log.vocabulary_item_id and v.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from vocabulary_items v
      where v.id = review_log.vocabulary_item_id and v.owner_id = auth.uid()
    )
  );

create policy "reading_sessions: owner full access" on reading_sessions
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "subscriptions: owner full access" on subscriptions
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- некритичный общий кеш переводов — доступен всем авторизованным пользователям
create policy "translations_cache: authenticated read" on translations_cache
  for select to authenticated using (true);
create policy "translations_cache: authenticated write" on translations_cache
  for insert to authenticated with check (true);

-- начиная с этой версии Supabase таблицы не экспонируются в PostgREST
-- автоматически — нужны явные GRANT в дополнение к RLS.
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  profiles, texts, vocabulary_items, srs_state, review_log,
  reading_sessions, subscriptions, translations_cache
  to authenticated;
