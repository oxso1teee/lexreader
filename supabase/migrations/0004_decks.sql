-- «Мозг» — колоды с полноценным SM-2 (отдельно от «Тетради»/чтения).
-- srs_state/review_log раньше указывали на vocabulary_items — теперь SRS
-- целиком переезжает на flashcards внутри колод; локальная БД для разработки,
-- тестовые данные можно потерять.

drop policy if exists "srs_state: owner full access" on srs_state;
drop policy if exists "review_log: owner full access" on review_log;
drop table if exists review_log;
drop table if exists srs_state;

create table decks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table flashcards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references decks(id) on delete cascade,
  owner_id uuid not null references profiles(id) on delete cascade,
  front text not null,
  back text not null,
  notes text,
  photo_url text,
  created_at timestamptz not null default now()
);

create table srs_state (
  flashcard_id uuid primary key references flashcards(id) on delete cascade,
  ease_factor numeric not null default 2.5,
  interval_days numeric not null default 0,
  repetitions int not null default 0,
  due_at timestamptz not null default now(),
  last_reviewed_at timestamptz
);

create table review_log (
  id uuid primary key default gen_random_uuid(),
  flashcard_id uuid not null references flashcards(id) on delete cascade,
  reviewed_at timestamptz not null default now(),
  grade int not null check (grade between 0 and 3)
);

-- настройки SM-2 и вида карточек, по одной строке на пользователя
create table srs_settings (
  owner_id uuid primary key references profiles(id) on delete cascade,
  new_cards_per_day int not null default 20,
  max_reviews_per_day int not null default 200,
  study_direction text not null default 'front_back' check (study_direction in ('front_back','back_front')),
  starting_ease numeric not null default 2.5,
  easy_bonus numeric not null default 1.3,
  interval_modifier numeric not null default 1.0,
  max_interval_days int not null default 36500,
  learning_steps_minutes text not null default '1,10',
  relearning_steps_minutes text not null default '10',
  graduating_interval_days int not null default 1,
  easy_interval_days int not null default 4,
  show_timer boolean not null default true,
  autoplay_audio boolean not null default false
);

create index flashcards_deck_idx on flashcards (deck_id);
create index flashcards_owner_idx on flashcards (owner_id);
create index decks_owner_idx on decks (owner_id);
create index srs_state_due_at_idx on srs_state (due_at);

alter table decks enable row level security;
alter table flashcards enable row level security;
alter table srs_state enable row level security;
alter table review_log enable row level security;
alter table srs_settings enable row level security;

create policy "decks: owner full access" on decks
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "flashcards: owner full access" on flashcards
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "srs_state: owner full access" on srs_state
  for all using (
    exists (select 1 from flashcards f where f.id = srs_state.flashcard_id and f.owner_id = auth.uid())
  ) with check (
    exists (select 1 from flashcards f where f.id = srs_state.flashcard_id and f.owner_id = auth.uid())
  );

create policy "review_log: owner full access" on review_log
  for all using (
    exists (select 1 from flashcards f where f.id = review_log.flashcard_id and f.owner_id = auth.uid())
  ) with check (
    exists (select 1 from flashcards f where f.id = review_log.flashcard_id and f.owner_id = auth.uid())
  );

create policy "srs_settings: owner full access" on srs_settings
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

grant select, insert, update, delete on
  decks, flashcards, srs_state, review_log, srs_settings
  to authenticated;
