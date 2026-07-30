-- docs/IMPLEMENTATION_PROMPT_2026-07-28.md, раздел 8: показываем управляемый
-- туториал "текст → слово → карточка" только тем, кто ещё не проходил
-- полный цикл — существующие профили помечаем сразу пройденными, чтобы не
-- показать им туториал задним числом при следующем логине.

alter table profiles add column completed_first_win boolean not null default false;
update profiles set completed_first_win = true;
