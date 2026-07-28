-- Задача 97 (готовые стартовые колоды NGSL/CEFR): по продуктовому решению
-- пользователя такие карточки не должны расходовать лимит бесплатного
-- тарифа (ни как "уже занятое место", ни как "новая карточка, которая
-- упрётся в лимит"). Помечаем колоду и её карточки флагом is_starter и
-- исключаем такие строки из подсчёта в трёх местах: hasFreeDeckRoom/
-- hasFreeFlashcardRoom (lib/subscription.ts) и в тех же двух DB-триггерах
-- бэкстопа из 0019_free_tier_db_backstop.sql (иначе серверная проверка
-- обойдена, а триггер всё равно отклонит insert).

alter table decks add column is_starter boolean not null default false;
alter table flashcards add column is_starter boolean not null default false;

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
