-- docs/IMPLEMENTATION_PROMPT_2026-07-28.md, раздел 9: предпочитаемый час
-- уведомлений — null, пока не набралось достаточно данных о поведении
-- (lib/notify-timing.ts тогда использует дефолт).
alter table profiles add column preferred_notify_hour smallint;
