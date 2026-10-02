-- Fix: ensure FREE_DECK_LIMIT and FREE_FLASHCARD_LIMIT exclude is_starter rows
-- both on INSERT (already fixed in 0021 via CREATE OR REPLACE FUNCTION) and
-- on UPDATE (missing until now). Also makes the logic idempotent and explicit
-- so future readers don't need to trace 0019 -> 0021 chain.

-- Constants must match src/lib/subscription.ts:
-- FREE_DECK_LIMIT = 3, FREE_FLASHCARD_LIMIT = 50
-- is_free_plan() logic matches getPlan() grace period (3 days).

-- Deck limit: exclude starter decks from count on INSERT and UPDATE
create or replace function enforce_free_deck_limit() returns trigger
language plpgsql as $$
begin
  if new.is_starter then
    return new;
  end if;
  if is_free_plan(new.owner_id) and
     (select count(*) from decks where owner_id = new.owner_id and not is_starter) >= 3 then
    raise exception 'FREE_DECK_LIMIT_EXCEEDED';
  end if;
  return new;
end;
$$;

-- Flashcard limit: exclude starter flashcards from count on INSERT and UPDATE
create or replace function enforce_free_flashcard_limit() returns trigger
language plpgsql as $$
begin
  if new.is_starter then
    return new;
  end if;
  if is_free_plan(new.owner_id) and
     (select count(*) from flashcards where owner_id = new.owner_id and not is_starter) >= 50 then
    raise exception 'FREE_FLASHCARD_LIMIT_EXCEEDED';
  end if;
  return new;
end;
$$;

-- UPDATE triggers: catch ONLY the two column changes that could bypass a free
-- limit -- flipping is_starter off (an exempt row becomes a counted one) or
-- reassigning owner_id. The WHEN clause is essential: without it the trigger
-- fires on every UPDATE, so a free user sitting exactly at the limit can no
-- longer rename a deck, edit a card, toggle a favourite, or have
-- recomputeAndPersistLearningState() write learning_state -- all of which are
-- benign UPDATEs that leave is_starter/owner_id untouched.
drop trigger if exists decks_free_limit_update on decks;
create trigger decks_free_limit_update
  before update on decks
  for each row
  when (new.is_starter is distinct from old.is_starter or new.owner_id is distinct from old.owner_id)
  execute function enforce_free_deck_limit();

drop trigger if exists flashcards_free_limit_update on flashcards;
create trigger flashcards_free_limit_update
  before update on flashcards
  for each row
  when (new.is_starter is distinct from old.is_starter or new.owner_id is distinct from old.owner_id)
  execute function enforce_free_flashcard_limit();

-- Note: INSERT triggers from 0019 (decks_free_limit, flashcards_free_limit)
-- already exist and call the same functions, so they automatically use the
-- updated logic above. No need to recreate them.