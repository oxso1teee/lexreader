-- Второй аудит, находка 2: у decks/flashcards не было колонки language —
-- при смене target_language в профиле Мозг продолжал показывать колоды и
-- карточки всех языков вперемешку (та же проблема, что чинили для
-- vocabulary_items в 0015_vocabulary_language.sql, но для Мозга это не
-- сделали). Колода наследует язык из профиля владельца на момент бэкафилла;
-- карточка — язык своей колоды.

alter table decks add column language text;

update decks
set language = p.target_language
from profiles p
where decks.owner_id = p.id and decks.language is null;

alter table decks alter column language set not null;
create index decks_owner_language_idx on decks (owner_id, language);

alter table flashcards add column language text;

update flashcards
set language = d.language
from decks d
where flashcards.deck_id = d.id and flashcards.language is null;

alter table flashcards alter column language set not null;
create index flashcards_owner_language_idx on flashcards (owner_id, language);
