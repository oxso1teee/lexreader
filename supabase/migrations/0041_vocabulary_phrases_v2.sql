-- M3 Slice 10 — Vocabulary & Phrase System v2 (docs/ui/m3-slice10-vocabulary-phrases-v2-plan.md
-- §3). Strictly additive: no existing column/table renamed, dropped, or retyped; no existing
-- constraint changed; no existing row deleted. flashcards/vocabulary_items/review_log/srs_state
-- keep working exactly as today for any code not yet updated to read the new columns.
--
-- Backfills below reuse the EXACT heuristics/normalization already live in the application
-- (front.includes(" ") for word/phrase, trim().toLowerCase() for dedup keys) — they formalize
-- existing behavior into stored columns rather than guessing new ones. See plan doc §5 for the
-- full existing-data strategy and §6 for why no unique constraint is added here.

-- ---------------------------------------------------------------------------
-- 1. flashcards: item_type, normalized_key, source_type, learning_state
-- ---------------------------------------------------------------------------

alter table flashcards add column item_type text;
update flashcards set item_type = case when position(' ' in trim(front)) > 0 then 'phrase' else 'word' end;
alter table flashcards alter column item_type set not null;
alter table flashcards alter column item_type set default 'word';
alter table flashcards add constraint flashcards_item_type_check check (item_type in ('word', 'phrase'));

alter table flashcards add column normalized_key text;
update flashcards set normalized_key = trim(lower(front));
alter table flashcards alter column normalized_key set not null;

alter table flashcards add column source_type text;
update flashcards set source_type = case
  when is_starter then 'starter_deck'
  when source_text_id is not null then 'reader'
  else 'manual' -- honest catch-all: also covers historical CSV/bulk-import rows, which no
                 -- existing column ever distinguished from a hand-typed add (plan doc §3.3).
end;
alter table flashcards alter column source_type set not null;
alter table flashcards alter column source_type set default 'manual';
alter table flashcards add constraint flashcards_source_type_check
  check (source_type in ('reader', 'manual', 'import_bulk', 'starter_deck', 'mission', 'path'));

-- learning_state defaults to 'new' for every existing row here. The real, evidence-based value
-- for existing flashcards is computed by a separate one-time backfill script (deriveVocabularyState()
-- against real review_log history — plan doc §5/§7) run only after this migration is approved and
-- applied, never fabricated inline in SQL.
alter table flashcards add column learning_state text not null default 'new'
  check (learning_state in ('new', 'learning', 'familiar', 'active', 'maintenance'));
alter table flashcards add column learning_state_version int not null default 1;
alter table flashcards add column learning_state_updated_at timestamptz;

create index flashcards_owner_normalized_key_idx on flashcards (owner_id, language, normalized_key);
create index flashcards_owner_item_type_idx on flashcards (owner_id, language, item_type);
create index flashcards_owner_learning_state_idx on flashcards (owner_id, language, learning_state);

-- ---------------------------------------------------------------------------
-- 2. vocabulary_items: item_type (same heuristic, applied to headword)
-- ---------------------------------------------------------------------------

alter table vocabulary_items add column item_type text;
update vocabulary_items set item_type = case when position(' ' in trim(headword)) > 0 then 'phrase' else 'word' end;
alter table vocabulary_items alter column item_type set not null;
alter table vocabulary_items alter column item_type set default 'word';
alter table vocabulary_items add constraint vocabulary_items_item_type_check check (item_type in ('word', 'phrase'));

-- ---------------------------------------------------------------------------
-- 3. review_log: practice_mode (provenance only, never backfilled — genuinely unknown for
--    historical rows) + the flashcard_id index this table has been missing since migration 0004.
-- ---------------------------------------------------------------------------

alter table review_log add column practice_mode text
  check (practice_mode in ('cards', 'choice', 'type', 'match'));

create index review_log_flashcard_idx on review_log (flashcard_id, reviewed_at desc);

-- ---------------------------------------------------------------------------
-- 4. vocabulary_contexts — one row per real occurrence of a word/phrase, replacing the
--    single-slot context_sentence/context_translation columns as the place NEW contexts get
--    written. Those legacy columns are left in place, untouched (plan doc §3.6) — existing
--    readers keep working; Phase B migrates them to read this table instead.
--
--    Keyed on flashcard_id, not vocabulary_item_id: flashcards is the universal superset (every
--    practiceable/browsable item has one; phrases and bulk-imported words never have a linked
--    vocabulary_items row at all). See plan doc §3.6 for the full rationale.
-- ---------------------------------------------------------------------------

create table vocabulary_contexts (
  id uuid primary key default gen_random_uuid(),
  flashcard_id uuid not null references flashcards(id) on delete cascade,
  context_text text not null,
  context_translation text,
  source_text_id uuid references texts(id) on delete set null,
  source_type text not null check (source_type in ('reader', 'manual', 'import')),
  created_at timestamptz not null default now()
);

create index vocabulary_contexts_flashcard_idx on vocabulary_contexts (flashcard_id);

alter table vocabulary_contexts enable row level security;
create policy "vocabulary_contexts: owner full access" on vocabulary_contexts
  for all
  using (exists (select 1 from flashcards f where f.id = vocabulary_contexts.flashcard_id and f.owner_id = auth.uid()))
  with check (exists (select 1 from flashcards f where f.id = vocabulary_contexts.flashcard_id and f.owner_id = auth.uid()));

grant select, insert, update, delete on vocabulary_contexts to authenticated;

-- Backfill: one context row per existing flashcard that has a stored context_sentence. Lossless —
-- carries over context_translation/source_text_id, derives source_type with the same rule used
-- for flashcards.source_type above (starter decks never have context_sentence, so that branch
-- never fires here in practice, but is included for completeness/symmetry).
insert into vocabulary_contexts (flashcard_id, context_text, context_translation, source_text_id, source_type, created_at)
select
  id,
  context_sentence,
  context_translation,
  source_text_id,
  case when source_text_id is not null then 'reader' else 'manual' end,
  created_at
from flashcards
where context_sentence is not null;

-- ---------------------------------------------------------------------------
-- Rollback (not executed — additive-only migration; safe because nothing pre-existing was
-- altered, so every DROP below undoes exactly and only what this migration added).
--
-- drop table if exists vocabulary_contexts cascade;
--
-- drop index if exists review_log_flashcard_idx;
-- alter table review_log drop column if exists practice_mode;
--
-- alter table vocabulary_items drop constraint if exists vocabulary_items_item_type_check;
-- alter table vocabulary_items drop column if exists item_type;
--
-- drop index if exists flashcards_owner_learning_state_idx;
-- drop index if exists flashcards_owner_item_type_idx;
-- drop index if exists flashcards_owner_normalized_key_idx;
-- alter table flashcards drop column if exists learning_state_updated_at;
-- alter table flashcards drop column if exists learning_state_version;
-- alter table flashcards drop column if exists learning_state;
-- alter table flashcards drop constraint if exists flashcards_source_type_check;
-- alter table flashcards drop column if exists source_type;
-- alter table flashcards drop column if exists normalized_key;
-- alter table flashcards drop constraint if exists flashcards_item_type_check;
-- alter table flashcards drop column if exists item_type;
