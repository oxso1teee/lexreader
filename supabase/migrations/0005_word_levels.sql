-- Пятиуровневая шкала знания слова для подсветки в читалке (раздел 15.3 ТЗ):
-- 0 New, 1 Видел раньше, 2 Знакомое, 3 Знаю значение, 4 Овладел.
-- Отдельно от vocabulary_items.status (используется в Тетради) — level точнее
-- и управляется прямо из попапа читалки; status синхронизируется по level
-- (level=4 -> known) на уровне приложения.

alter table vocabulary_items
  add column level int not null default 0 check (level between 0 and 4),
  add column seen_count int not null default 1;
