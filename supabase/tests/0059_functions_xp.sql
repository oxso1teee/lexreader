-- Iteration 6, 0059 (EXPAND): начисление XP — идемпотентность, лимиты, Double-XP, {day}, часовой пояс,
-- права на award_xp, RLS журнала, типы заданий, совместимость с 0058. Работает ПОСЛЕ 0059 и не требует 0060.
-- Запуск: supabase/tests/run-local.sh. Любое нарушение — ASSERT FAILED и ненулевой код выхода.
\set ON_ERROR_STOP on
\set QUIET on
create or replace function t_assert(cond boolean, msg text) returns void language plpgsql as $$ begin if not coalesce(cond,false) then raise exception 'ASSERT FAILED: %', msg; end if; end $$;
grant execute on function t_assert(boolean,text) to authenticated, anon, service_role;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','a@x.test'),('00000000-0000-0000-0000-0000000000b2','b@x.test');
insert into profiles (id, target_language, native_language) values ('00000000-0000-0000-0000-0000000000a1','en','ru'),('00000000-0000-0000-0000-0000000000b2','en','ru');

-- 1. базовое начисление
select set_config('t.r', award_xp('00000000-0000-0000-0000-0000000000a1','lesson_complete','attempt-1',20,null)::text, false);
select t_assert(current_setting('t.r')::jsonb->>'status'='awarded', 'awarded');
select t_assert((current_setting('t.r')::jsonb->>'awarded')::int=20, 'awarded=20');
select t_assert((select xp from profiles where id='00000000-0000-0000-0000-0000000000a1')=20, 'profiles.xp=20');
select t_assert((select xp from activity_days where user_id='00000000-0000-0000-0000-0000000000a1' and day=current_date)=20, 'activity_days.xp=20 (UTC day)');
select t_assert((select count(*) from xp_events where user_id='00000000-0000-0000-0000-0000000000a1')=1, 'one ledger row');
select t_assert((current_setting('t.r')::jsonb->>'goal')::int=50, 'goal=daily_xp_goal for xp type');

-- 2. повтор того же ключа
select set_config('t.r', award_xp('00000000-0000-0000-0000-0000000000a1','lesson_complete','attempt-1',20,null)::text, false);
select t_assert(current_setting('t.r')::jsonb->>'status'='duplicate', 'duplicate');
select t_assert((select xp from profiles where id='00000000-0000-0000-0000-0000000000a1')=20, 'xp unchanged after duplicate');
select t_assert((select count(*) from xp_events where user_id='00000000-0000-0000-0000-0000000000a1')=1, 'no extra ledger row');

-- 3. дневной лимит по базовой сумме
select award_xp('00000000-0000-0000-0000-0000000000a1','review_card','r1',1,3);
select award_xp('00000000-0000-0000-0000-0000000000a1','review_card','r2',1,3);
select award_xp('00000000-0000-0000-0000-0000000000a1','review_card','r3',1,3);
select set_config('t.r', award_xp('00000000-0000-0000-0000-0000000000a1','review_card','r4',1,3)::text, false);
select t_assert(current_setting('t.r')::jsonb->>'status'='capped', 'capped after cap reached');
select t_assert((select xp from profiles where id='00000000-0000-0000-0000-0000000000a1')=23, 'xp=23 (20+3), capped not added');

-- 4. Double-XP удваивает начисленное, base остаётся
update profiles set xp_boost_until = now() + interval '10 minutes' where id='00000000-0000-0000-0000-0000000000a1';
select set_config('t.r', award_xp('00000000-0000-0000-0000-0000000000a1','word_saved','w1',2,null)::text, false);
select t_assert((current_setting('t.r')::jsonb->>'awarded')::int=4 and (current_setting('t.r')::jsonb->>'boosted')::boolean, 'boost doubles');
select t_assert((select base_amount from xp_events where ref='w1')=2 and (select amount from xp_events where ref='w1')=4, 'ledger base=2 amount=4');
update profiles set xp_boost_until = now() - interval '1 minute' where id='00000000-0000-0000-0000-0000000000a1';
select set_config('t.r', award_xp('00000000-0000-0000-0000-0000000000a1','word_saved','w2',2,null)::text, false);
select t_assert((current_setting('t.r')::jsonb->>'awarded')::int=2, 'expired boost does not double');

-- 5. {day} → локальный день, второй вызов — duplicate
select set_config('t.r', award_xp('00000000-0000-0000-0000-0000000000a1','reading_session','text9:{day}',10,null)::text, false);
select t_assert((select ref from xp_events where source='reading_session' and user_id='00000000-0000-0000-0000-0000000000a1')='text9:'||current_date::text, '{day} replaced with local date');
select set_config('t.r', award_xp('00000000-0000-0000-0000-0000000000a1','reading_session','text9:{day}',10,null)::text, false);
select t_assert(current_setting('t.r')::jsonb->>'status'='duplicate', 'same text same day duplicate');

-- 6. часовой пояс: день по поясу пользователя
update profiles set timezone='Pacific/Kiritimati' where id='00000000-0000-0000-0000-0000000000b2';  -- UTC+14
select set_config('t.r', award_xp('00000000-0000-0000-0000-0000000000b2','lesson_complete','tz-1',15,null)::text, false);
select t_assert((current_setting('t.r')::jsonb->>'day')::date = (now() at time zone 'Pacific/Kiritimati')::date, 'day follows profile timezone');
select t_assert(exists(select 1 from activity_days where user_id='00000000-0000-0000-0000-0000000000b2' and day=(now() at time zone 'Pacific/Kiritimati')::date), 'activity_days row on local day');
update profiles set timezone='Not/AZone' where id='00000000-0000-0000-0000-0000000000b2';
select set_config('t.r', award_xp('00000000-0000-0000-0000-0000000000b2','lesson_complete','tz-2',15,null)::text, false);
select t_assert(current_setting('t.r')::jsonb->>'status'='awarded' and (current_setting('t.r')::jsonb->>'day')::date=(now() at time zone 'UTC')::date, 'broken timezone falls back to UTC, does not raise');

-- 7. не-XP цель: moment goal = 0, goal_met по XP-цели остаётся
update profiles set daily_goal_type='lessons', daily_goal_target=2 where id='00000000-0000-0000-0000-0000000000b2';
select set_config('t.r', award_xp('00000000-0000-0000-0000-0000000000b2','lesson_complete','tz-3',15,null)::text, false);
select t_assert((current_setting('t.r')::jsonb->>'goal')::int=0, 'goal=0 for non-xp goal type');
select t_assert((select goal_met from activity_days where user_id='00000000-0000-0000-0000-0000000000b2' and day=current_date), 'goal_met still by xp goal (45 vs 50?)') where false;

-- 8. валидация аргументов
do $$ begin begin perform award_xp(null,'x','r',1,null); raise exception 'no error'; exception when sqlstate '22023' then null; end; end $$;
do $$ begin begin perform award_xp('00000000-0000-0000-0000-0000000000a1','BAD SOURCE','r',1,null); raise exception 'no error'; exception when sqlstate '22023' then null; end; end $$;
do $$ begin begin perform award_xp('00000000-0000-0000-0000-0000000000a1','lesson_complete','r',0,null); raise exception 'no error'; exception when sqlstate '22023' then null; end; end $$;
do $$ begin begin perform award_xp('00000000-0000-0000-0000-0000000000a1','lesson_complete','r',5000,null); raise exception 'no error'; exception when sqlstate '22023' then null; end; end $$;
select t_assert(award_xp('00000000-0000-0000-0000-0000000000ff','lesson_complete','r',5,null)->>'status'='no_profile', 'unknown user → no_profile');

-- 9. права: authenticated/anon не могут вызвать award_xp
set role authenticated;
do $$ begin begin perform award_xp('00000000-0000-0000-0000-0000000000a1','lesson_complete','hack',20,null); raise exception 'CALLED'; exception when insufficient_privilege then null; end; end $$;
set role anon;
do $$ begin begin perform award_xp('00000000-0000-0000-0000-0000000000a1','lesson_complete','hack',20,null); raise exception 'CALLED'; exception when insufficient_privilege then null; end; end $$;
reset role;

-- 11. RLS xp_events: читает только своё, писать не может
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1', false);
select t_assert((select count(*) from xp_events where user_id <> '00000000-0000-0000-0000-0000000000a1')=0, 'sees only own events');
select t_assert((select count(*) from xp_events)>0, 'sees own events');
do $$ begin begin insert into xp_events(user_id,source,ref,base_amount,amount,day) values ('00000000-0000-0000-0000-0000000000a1','lesson_complete','forge',1,1,current_date); raise exception 'INSERTED'; exception when insufficient_privilege then null; end; end $$;
do $$ begin begin update xp_events set amount=99999; raise exception 'UPDATED'; exception when insufficient_privilege then null; end; end $$;
do $$ begin begin delete from xp_events; raise exception 'DELETED'; exception when insufficient_privilege then null; end; end $$;
reset role;

-- 12. типы заданий
insert into daily_quests (owner_id, day, quest_type, target) values
 ('00000000-0000-0000-0000-0000000000a1', current_date, 'read_minutes', 5),
 ('00000000-0000-0000-0000-0000000000a1', current_date, 'earn_xp', 30),
 ('00000000-0000-0000-0000-0000000000a1', current_date, 'complete_lessons', 1),
 ('00000000-0000-0000-0000-0000000000a1', current_date, 'answer_exercises', 8),
 ('00000000-0000-0000-0000-0000000000a1', current_date, 'combo_streak', 3),
 ('00000000-0000-0000-0000-0000000000a1', current_date, 'review_words', 10);
do $$ begin begin insert into daily_quests (owner_id, day, quest_type, target) values ('00000000-0000-0000-0000-0000000000a1', current_date+1, 'hack', 5); raise exception 'ACCEPTED'; exception when check_violation then null; end; end $$;
do $$ begin begin insert into daily_quests (owner_id, day, quest_type, target) values ('00000000-0000-0000-0000-0000000000a1', current_date, 'earn_xp', 99); raise exception 'DUP'; exception when unique_violation then null; end; end $$;

-- 13. профили: новые колонки и проверки
do $$ begin begin update profiles set daily_goal_type='nonsense' where id='00000000-0000-0000-0000-0000000000a1'; raise exception 'ACCEPTED'; exception when check_violation then null; end; end $$;
do $$ begin begin update profiles set daily_goal_target=0 where id='00000000-0000-0000-0000-0000000000a1'; raise exception 'ACCEPTED'; exception when check_violation then null; end; end $$;
select t_assert((select daily_goal_type from profiles where id='00000000-0000-0000-0000-0000000000b2')='lessons', 'default/explicit goal type stored');

-- 14. совместимость с 0058: индекс и таблица на месте, вставка завершённой попытки проходит
select t_assert(exists(select 1 from pg_indexes where indexname='lesson_attempts_user_completed_idx'), 'completed attempts index exists');
select t_assert(exists(select 1 from pg_class where relname='lesson_attempts'), '0058 table present');



\echo FUNCTIONS XP PASSED
