-- P0-АУДИТ 3.9: vocabulary_items не хранил язык вообще — после того как
-- профиль стал редактируемым (смена target_language), слова разных
-- изучаемых языков стали видны вперемешку и даже "склеивались" при
-- совпадении написания (например "la" во французском и испанском).

alter table vocabulary_items add column language text;

-- Best-effort бэкфилл существующих строк: берём язык текста-источника, а
-- для слов без текста (ручное добавление) — текущий target_language
-- профиля на момент миграции (лучшее доступное приближение).
update vocabulary_items v
set language = t.language
from texts t
where v.source_text_id = t.id and v.language is null;

update vocabulary_items v
set language = p.target_language
from profiles p
where v.owner_id = p.id and v.language is null;

alter table vocabulary_items alter column language set not null;

create index vocabulary_items_owner_language_idx on vocabulary_items (owner_id, language);
