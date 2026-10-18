-- docs/moments/ROADMAP.md, этап 2 — Earn-back (серия прерывается не сразу в
-- "1", а даёт 3 дня на восстановление старого числа) и Perfect-week (+20 XP
-- раз в неделю, нужен сторож от повторного начисления в той же неделе).
--
-- streak_before_break/streak_repair_until — пара, не отдельные независимые
-- поля: repair активен ровно когда оба NOT NULL и today <= streak_repair_until
-- (вычисляется в src/lib/streak-engine.ts, не в SQL — та же причина, что и у
-- остальной бизнес-логики streak.ts: чистая TS-функция с тестами, миграция
-- только даёт место для хранения).
alter table profiles add column streak_before_break int;
alter table profiles add column streak_repair_until date;
alter table profiles add column perfect_week_awarded_week date;

-- Откат:
-- alter table profiles drop column perfect_week_awarded_week;
-- alter table profiles drop column streak_repair_until;
-- alter table profiles drop column streak_before_break;
