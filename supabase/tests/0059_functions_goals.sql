-- Iteration 6, 0059 (EXPAND): скользящий лимит 24 ч и goal_met по выбранному типу цели (mark_goal_met).
-- Работает ПОСЛЕ 0059 и не требует 0060. Запуск: supabase/tests/run-local.sh.
\set ON_ERROR_STOP on
\set QUIET on
create or replace function t_assert(cond boolean, msg text) returns void language plpgsql as $$ begin if not coalesce(cond,false) then raise exception 'ASSERT FAILED: %', msg; end if; end $$;
grant execute on function t_assert(boolean,text) to authenticated, anon, service_role;

insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-0000000000f6','f@x.test'), ('00000000-0000-0000-0000-000000000a07','g@x.test'),
 ('00000000-0000-0000-0000-000000000a08','h@x.test'), ('00000000-0000-0000-0000-000000000a09','i@x.test');
insert into profiles (id, target_language, native_language) select id, 'en','ru' from auth.users where email in ('f@x.test','g@x.test','h@x.test','i@x.test');

-- ======== B. скользящий лимит 24 часа ========
-- Детерминированно: «уже потрачено» под разными локальными датами за последний час.
-- cap=5 → за 24 часа можно не больше 10.
select set_config('t.u','00000000-0000-0000-0000-000000000a07', false);
insert into xp_events (user_id, source, ref, base_amount, amount, day, created_at) values
 ('00000000-0000-0000-0000-000000000a07','review_card','old-1',5,5,current_date - 2, now() - interval '30 minutes'),
 ('00000000-0000-0000-0000-000000000a07','review_card','old-2',5,5,current_date + 2, now() - interval '20 minutes');
-- текущая локальная дата ни под одну из них не подпадает, лимит по дате не сработает, а скользящий — да
select set_config('t.r', award_xp('00000000-0000-0000-0000-000000000a07','review_card','new-1',1,5)::text, false);
select t_assert(current_setting('t.r')::jsonb->>'status'='capped' and current_setting('t.r')::jsonb->>'window'='rolling', 'rolling window blocks a third bucket');
-- другой источник того же пользователя не затронут
select t_assert(award_xp('00000000-0000-0000-0000-000000000a07','word_saved','ws-1',2,100)->>'status'='awarded', 'other sources unaffected');
-- честный стык двух локальных дней: вчера лимит выбран, сегодня ещё лимит — разрешено ровно до 2×
select set_config('t.u','00000000-0000-0000-0000-000000000a08', false);
insert into xp_events (user_id, source, ref, base_amount, amount, day, created_at) values
 ('00000000-0000-0000-0000-000000000a08','review_card','y-1',5,5,current_date - 1, now() - interval '1 hour');
do $$ declare i int; r jsonb; ok int := 0; begin
  for i in 1..8 loop
    r := award_xp('00000000-0000-0000-0000-000000000a08','review_card','t-'||i,1,5);
    if r->>'status' = 'awarded' then ok := ok + 1; end if;
  end loop;
  perform t_assert(ok = 5, 'honest midnight boundary: exactly one more daily cap allowed, got '||ok);
end $$;
-- смена пояса «на лету» (сервисной ролью, мимо триггера) больше 2 лимитов за сутки не даёт
update profiles set timezone='Pacific/Pago_Pago' where id='00000000-0000-0000-0000-000000000a07';
delete from xp_events where user_id='00000000-0000-0000-0000-000000000a07';
do $$ declare tz text; i int; total int := 0; r jsonb; begin
  foreach tz in array array['Pacific/Pago_Pago','UTC','Pacific/Kiritimati','Pacific/Pago_Pago','UTC','Pacific/Kiritimati'] loop
    update profiles set timezone = tz where id='00000000-0000-0000-0000-000000000a07';
    for i in 1..8 loop
      r := award_xp('00000000-0000-0000-0000-000000000a07','review_card','hop-'||tz||'-'||i||'-'||total,1,5);
      if r->>'status' = 'awarded' then total := total + 1; end if;
    end loop;
  end loop;
  perform t_assert(total <= 10, 'timezone hopping yields at most 2 daily caps per 24h, got '||total);
  perform t_assert(total >= 5, 'but at least one cap');
  raise notice 'hopping across 3 zones x2 gave % XP (limit 10)', total;
end $$;

-- ======== C. goal_met по выбранному типу цели ========
select set_config('t.u','00000000-0000-0000-0000-0000000000f6', false);
-- тип 'lessons': XP выше XP-цели goal_met НЕ ставит
update profiles set timezone=null, daily_goal_type='lessons', daily_goal_target=2, daily_xp_goal=20 where id='00000000-0000-0000-0000-0000000000f6';
select award_xp('00000000-0000-0000-0000-0000000000f6','lesson_complete','l-1',25,null);
select t_assert((select xp from activity_days where user_id='00000000-0000-0000-0000-0000000000f6' and day=(now() at time zone 'UTC')::date)=25, 'xp counted');
select t_assert(not (select goal_met from activity_days where user_id='00000000-0000-0000-0000-0000000000f6' and day=(now() at time zone 'UTC')::date), 'xp >= xp goal does NOT mark a lessons goal');
select t_assert((award_xp('00000000-0000-0000-0000-0000000000f6','lesson_complete','l-2',15,null)->>'goal')::int=0, 'moment goal suppressed for non-xp goal');
-- mark_goal_met: первый вызов true, повтор false
select t_assert(mark_goal_met('00000000-0000-0000-0000-0000000000f6', (now() at time zone 'UTC')::date) is true, 'mark_goal_met flips once');
select t_assert(mark_goal_met('00000000-0000-0000-0000-0000000000f6', (now() at time zone 'UTC')::date) is false, 'mark_goal_met second call is false');
select t_assert((select goal_met from activity_days where user_id='00000000-0000-0000-0000-0000000000f6' and day=(now() at time zone 'UTC')::date), 'goal_met stored');
-- день без строки: строка создаётся, xp = 0
select t_assert(mark_goal_met('00000000-0000-0000-0000-0000000000f6', (now() at time zone 'UTC')::date - 1) is true, 'creates the day row');
select t_assert((select xp from activity_days where user_id='00000000-0000-0000-0000-0000000000f6' and day=(now() at time zone 'UTC')::date - 1)=0, 'created row has xp 0');
-- гарантии аргументов
do $$ begin begin perform mark_goal_met('00000000-0000-0000-0000-0000000000f6', current_date + 10); raise exception 'FUTURE ACCEPTED'; exception when others then if sqlerrm <> 'invalid_day' then raise; end if; end; end $$;
do $$ begin begin perform mark_goal_met('00000000-0000-0000-0000-0000000000f6', current_date - 10); raise exception 'PAST ACCEPTED'; exception when others then if sqlerrm <> 'invalid_day' then raise; end if; end; end $$;
do $$ begin begin perform mark_goal_met(null, current_date); raise exception 'NULL ACCEPTED'; exception when others then if sqlerrm <> 'invalid_arguments' then raise; end if; end; end $$;
select t_assert(mark_goal_met('00000000-0000-0000-0000-0000000000ff', current_date) is false, 'unknown user → false, no row');
select t_assert(not exists(select 1 from activity_days where user_id='00000000-0000-0000-0000-0000000000ff'), 'no row for unknown user');
-- тип 'xp': award_xp ставит отметку сам; повышение цели её не отменяет; смена типа тоже
update profiles set daily_goal_type='xp', daily_goal_target=null, daily_xp_goal=20 where id='00000000-0000-0000-0000-000000000a08';
select award_xp('00000000-0000-0000-0000-000000000a08','lesson_complete','x-1',25,null);
select t_assert((select goal_met from activity_days where user_id='00000000-0000-0000-0000-000000000a08' and day=(now() at time zone 'UTC')::date), 'xp goal met inside award_xp');
update profiles set daily_xp_goal=120 where id='00000000-0000-0000-0000-000000000a08';
select award_xp('00000000-0000-0000-0000-000000000a08','lesson_complete','x-2',15,null);
select t_assert((select goal_met from activity_days where user_id='00000000-0000-0000-0000-000000000a08' and day=(now() at time zone 'UTC')::date), 'raising the goal does not undo a met day');
update profiles set daily_goal_type='words' where id='00000000-0000-0000-0000-000000000a08';
select award_xp('00000000-0000-0000-0000-000000000a08','lesson_complete','x-3',15,null);
select t_assert((select goal_met from activity_days where user_id='00000000-0000-0000-0000-000000000a08' and day=(now() at time zone 'UTC')::date), 'switching goal type does not undo a met day');
select t_assert(mark_goal_met('00000000-0000-0000-0000-000000000a08', (now() at time zone 'UTC')::date) is false, 'already met → false');

-- права на mark_goal_met
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000f6', false);
set role authenticated;
do $$ begin begin perform mark_goal_met('00000000-0000-0000-0000-0000000000f6', current_date); raise exception 'CALLED'; exception when insufficient_privilege then null; end; end $$;
set role anon;
do $$ begin begin perform mark_goal_met('00000000-0000-0000-0000-0000000000f6', current_date); raise exception 'CALLED'; exception when insufficient_privilege then null; end; end $$;
reset role;


\echo FUNCTIONS GOALS PASSED
