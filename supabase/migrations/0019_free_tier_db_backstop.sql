-- Второй аудит, находка 9: лимиты бесплатного тарифа проверялись только в
-- Next.js server actions (hasFreeTextRoom/hasFreeDeckRoom/hasFreeFlashcardRoom/
-- saveVocabularyItem) — RLS-политики insert проверяют только владение
-- (owner_id = auth.uid()), но не количество. Пользователь, вытащивший свой
-- собственный anon key + JWT из devtools, мог слать insert-запросы напрямую
-- в PostgREST в обход server actions и обходить бесплатные лимиты.
-- Добавляем те же лимиты триггерами на уровне БД как страховку — значения
-- захардкожены и должны совпадать с src/lib/subscription.ts
-- (FREE_TEXT_LIMIT=3, FREE_DECK_LIMIT=3, FREE_FLASHCARD_LIMIT=50,
-- FREE_DAILY_WORD_LIMIT=10, PAYMENT_GRACE_PERIOD_DAYS=3), если константы там
-- изменятся — обновить и здесь.

create or replace function is_free_plan(p_owner_id uuid) returns boolean
language plpgsql stable as $$
declare
  v_status text;
  v_period_end timestamptz;
begin
  select status, current_period_end into v_status, v_period_end
  from subscriptions where owner_id = p_owner_id;

  if v_status is null then
    return true;
  end if;

  if v_status = 'active' then
    return false;
  end if;

  if v_status = 'past_due' and coalesce(v_period_end, now()) + interval '3 days' > now() then
    return false;
  end if;

  return true;
end;
$$;

create or replace function enforce_free_text_limit() returns trigger
language plpgsql as $$
begin
  if is_free_plan(new.owner_id) and
     (select count(*) from texts where owner_id = new.owner_id) >= 3 then
    raise exception 'FREE_TEXT_LIMIT_EXCEEDED';
  end if;
  return new;
end;
$$;

create trigger texts_free_limit before insert on texts
  for each row execute function enforce_free_text_limit();

create or replace function enforce_free_deck_limit() returns trigger
language plpgsql as $$
begin
  if is_free_plan(new.owner_id) and
     (select count(*) from decks where owner_id = new.owner_id) >= 3 then
    raise exception 'FREE_DECK_LIMIT_EXCEEDED';
  end if;
  return new;
end;
$$;

create trigger decks_free_limit before insert on decks
  for each row execute function enforce_free_deck_limit();

create or replace function enforce_free_flashcard_limit() returns trigger
language plpgsql as $$
begin
  if is_free_plan(new.owner_id) and
     (select count(*) from flashcards where owner_id = new.owner_id) >= 50 then
    raise exception 'FREE_FLASHCARD_LIMIT_EXCEEDED';
  end if;
  return new;
end;
$$;

create trigger flashcards_free_limit before insert on flashcards
  for each row execute function enforce_free_flashcard_limit();

create or replace function enforce_free_vocabulary_daily_limit() returns trigger
language plpgsql as $$
begin
  if is_free_plan(new.owner_id) and
     (
       select count(*) from vocabulary_items
       where owner_id = new.owner_id
         and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc'
     ) >= 10 then
    raise exception 'FREE_DAILY_WORD_LIMIT_EXCEEDED';
  end if;
  return new;
end;
$$;

create trigger vocabulary_items_free_daily_limit before insert on vocabulary_items
  for each row execute function enforce_free_vocabulary_daily_limit();
