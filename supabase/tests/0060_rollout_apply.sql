-- Iteration 6, 0060: перенос накопленного барьером выкладки проверяется по МОДЕЛИ, а не по примерам:
-- для каждого пользователя и дня «после = до + накопленное в журнале». Запускается сразу после 0060, когда
-- 0060_before_apply.sql снял «до». Потерянное или задвоенное начисление нарушает хотя бы одно равенство.
\set ON_ERROR_STOP on
\set QUIET on
create or replace function t_assert(cond boolean, msg text) returns void language plpgsql as $$ begin if not coalesce(cond,false) then raise exception 'ASSERT FAILED: %', msg; end if; end $$;

select t_assert(rewards_phase() = 'live', 'the rollout is live after 0060');
select t_assert((select count(*) from apply_check.pending_user) > 0, 'precondition: the test exercised a non-empty backlog');
select t_assert(not exists(select 1 from xp_events where not applied), 'every event is applied');
select t_assert((select count(*) from pending_goal_marks) = 0, 'no pending goal marks left');

-- 1. общий XP: после = до + накопленное (для ВСЕХ пользователей, в том числе без накопления)
select t_assert(not exists(
  select 1 from profiles p join apply_check.xp_before b on b.user_id = p.id left join apply_check.pending_user pu on pu.user_id = p.id
   where p.xp <> b.xp + coalesce(pu.xp, 0)), 'profiles.xp = before + pending, for every user');
select t_assert((select count(*) from profiles) = (select count(*) from apply_check.xp_before), 'no profile appeared or vanished');

-- 2. XP по дням: после = до + накопленное; строка есть, если было накопление
select t_assert(not exists(
  select 1 from apply_check.pending_day pd
   left join apply_check.day_before db on db.user_id = pd.user_id and db.day = pd.day
   left join activity_days ad on ad.user_id = pd.user_id and ad.day = pd.day
   where ad.xp is distinct from coalesce(db.xp, 0) + pd.xp), 'activity_days.xp = before + pending, for every pending day');
select t_assert(not exists(
  select 1 from apply_check.day_before db
   left join apply_check.pending_day pd on pd.user_id = db.user_id and pd.day = db.day
   join activity_days ad on ad.user_id = db.user_id and ad.day = db.day
   where pd.day is null and (ad.xp <> db.xp or ad.goal_met <> db.goal_met)), 'days without a backlog are untouched');
select t_assert((select count(*) from activity_days) = (select count(*) from apply_check.day_before) + (
  select count(*) from apply_check.pending_day pd where not exists (select 1 from apply_check.day_before db where db.user_id = pd.user_id and db.day = pd.day))
  + (select count(*) from apply_check.marks m where not exists (select 1 from apply_check.day_before db where db.user_id = m.user_id and db.day = m.day)
        and not exists (select 1 from apply_check.pending_day pd where pd.user_id = m.user_id and pd.day = m.day)), 'only the expected activity day rows were created');

-- 3. журнал: сумма событий не изменилась переносом (перенос не создаёт и не удаляет события)
select t_assert(not exists(
  select 1 from apply_check.ledger_before lb left join (select user_id, sum(amount)::int xp from xp_events group by user_id) l on l.user_id = lb.user_id
   where l.xp is distinct from lb.xp), 'the ledger is unchanged by the transfer');

-- 4. цель дня: отметка только растёт; XP-цель закрыта, если набрано; отложенные отметки выставлены
select t_assert(not exists(select 1 from apply_check.day_before db join activity_days ad using (user_id, day) where db.goal_met and not ad.goal_met), 'goal_met never decreases');
select t_assert(not exists(
  select 1 from apply_check.pending_day pd join activity_days ad using (user_id, day) join profiles p on p.id = pd.user_id
   where p.daily_goal_type = 'xp' and ad.xp >= p.daily_xp_goal and not ad.goal_met), 'an XP goal reached through pending awards is marked met');
select t_assert(not exists(select 1 from apply_check.marks m left join activity_days ad on ad.user_id = m.user_id and ad.day = m.day where ad.goal_met is not true), 'deferred goal marks are applied');

-- 5. повторный вызов — безопасный no-op; дальше начисление идёт напрямую
select t_assert(finish_rewards_rollout()->>'status' = 'already_live', 'finish is idempotent');
select t_assert((select count(*) from profiles p join apply_check.xp_before b on b.user_id = p.id left join apply_check.pending_user pu on pu.user_id = p.id where p.xp = b.xp + coalesce(pu.xp, 0)) = (select count(*) from profiles), 'the second finish changed nothing');
select set_config('t.x', (select xp from profiles where id = '00000000-0000-0000-0000-0000000fa001')::text, false);
select set_config('t.r', award_xp('00000000-0000-0000-0000-0000000fa001', 'lesson_complete', 'after-live', 10, null)::text, false);
select t_assert((current_setting('t.r')::jsonb->>'deferred')::boolean is false, 'after the transfer awards are applied directly');
select t_assert((select xp from profiles where id = '00000000-0000-0000-0000-0000000fa001') = current_setting('t.x')::int + 10, 'live award writes the counter');
select t_assert((current_setting('t.r')::jsonb->>'total_before')::int = current_setting('t.x')::int, 'live totals agree with the counter');

\echo ROLLOUT APPLY PASSED
