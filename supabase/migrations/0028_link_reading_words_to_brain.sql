-- Продуктовое решение пользователя: Тетрадь и Мозг ощущались как два
-- дублирующих друг друга раздела — слово из чтения (vocabulary_items)
-- никогда не попадало в настоящее интервальное повторение (srs_state
-- целиком переехал на flashcards ещё в 0004_decks.sql). Сливаем в один
-- раздел: каждое слово из чтения теперь сразу получает связанную карточку
-- в Мозге (в колоде по умолчанию пользователя), Тетрадь остаётся как
-- витрина/фильтр этих же слов, но реальное повторение идёт через Мозг.

alter table flashcards add column context_sentence text;
alter table flashcards add column context_translation text;
alter table flashcards add column source_text_id uuid references texts(id) on delete set null;

alter table vocabulary_items add column flashcard_id uuid references flashcards(id) on delete set null;

-- Бэкафилл: у всех уже существующих слов из чтения создаём карточку +
-- srs_state, чтобы они сразу встали на повторение, без потери прогресса.
do $$
declare
  v record;
  v_deck_id uuid;
  v_flashcard_id uuid;
  v_ease numeric;
begin
  for v in select * from vocabulary_items where flashcard_id is null loop
    select id into v_deck_id from decks
      where owner_id = v.owner_id and is_default = true and language = v.language;

    if v_deck_id is null then
      insert into decks (owner_id, name, is_default, language)
      values (v.owner_id, 'Основная колода', true, v.language)
      returning id into v_deck_id;
    end if;

    select starting_ease into v_ease from srs_settings where owner_id = v.owner_id;

    insert into flashcards (
      deck_id, owner_id, front, back, photo_url, language,
      context_sentence, context_translation, source_text_id
    )
    values (
      v_deck_id, v.owner_id, v.headword, v.translation, v.photo_url, v.language,
      v.context_sentence, v.context_translation, v.source_text_id
    )
    returning id into v_flashcard_id;

    insert into srs_state (flashcard_id, ease_factor) values (v_flashcard_id, coalesce(v_ease, 2.5));

    update vocabulary_items set flashcard_id = v_flashcard_id where id = v.id;
  end loop;
end $$;
