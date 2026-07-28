-- Задача 99 (полировка Тетради): отдельный флаг "избранное", не привязанный
-- к статусу изучения (new/learning/known) — закрепить сложное/важное слово
-- для быстрого доступа независимо от прогресса.
alter table vocabulary_items add column is_favorite boolean not null default false;
