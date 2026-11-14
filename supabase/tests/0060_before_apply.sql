-- Снимок «до переноса» для модели 0060_rollout_apply.sql: счётчики, накопленное в журнале и отложенные отметки целей.
\set ON_ERROR_STOP on
\set QUIET on
create schema apply_check;
create table apply_check.xp_before as select id as user_id, xp from profiles;
create table apply_check.day_before as select user_id, day, xp, goal_met from activity_days;
create table apply_check.pending_user as select user_id, sum(amount)::int as xp, count(*) as events from xp_events where not applied group by user_id;
create table apply_check.pending_day as select user_id, day, sum(amount)::int as xp from xp_events where not applied group by user_id, day;
create table apply_check.marks as select user_id, day from pending_goal_marks;
create table apply_check.ledger_before as select user_id, sum(amount)::int as xp from xp_events group by user_id;
-- у пользователей с накоплением данные закономерно изменятся при переносе — их проверяет модель, не снимок
insert into legacy_check.excluded select distinct user_id from xp_events where not applied union select user_id from pending_goal_marks on conflict do nothing;
select 'pending: ' || coalesce(sum(events), 0) || ' events, ' || coalesce(sum(xp), 0) || ' xp, ' || (select count(*) from apply_check.marks) || ' goal marks' as info from apply_check.pending_user \gset
\echo BEFORE-APPLY SNAPSHOT: :info
