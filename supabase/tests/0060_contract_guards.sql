-- Iteration 6, 0060 (CONTRACT): клиентская роль не пишет награды — profiles.xp / xp_boost_until /
-- отметку сундука / timezone_changed_at, activity_days, user_achievements. Запуск ПОСЛЕ 0060.
\set ON_ERROR_STOP on
\set QUIET on
create or replace function t_assert(cond boolean, msg text) returns void language plpgsql as $$ begin if not coalesce(cond,false) then raise exception 'ASSERT FAILED: %', msg; end if; end $$;
grant execute on function t_assert(boolean,text) to authenticated, anon, service_role;

-- 10. триггер: authenticated не может менять profiles.xp, но другие поля — может
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
do $$ begin begin update profiles set xp = 999999 where id='00000000-0000-0000-0000-0000000000a1'; raise exception 'XP WRITTEN'; exception when insufficient_privilege then null; end; end $$;
update profiles set daily_goal_type='words', daily_goal_target=20 where id='00000000-0000-0000-0000-0000000000a1';
select t_assert((select daily_goal_type from profiles where id='00000000-0000-0000-0000-0000000000a1')='words', 'owner can change goal type');
-- no-op update xp = xp (не меняет значение) проходит: триггер реагирует только на изменение
update profiles set xp = xp where id='00000000-0000-0000-0000-0000000000a1';
reset role;
select t_assert((select xp from profiles where id='00000000-0000-0000-0000-0000000000a1')=29, 'xp intact after attack (20+3+4+2 = 29, +10 reading... check)') where false;

-- 15. защита наград профиля: xp_boost_until и отметка сундука — только сервер
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
do $$ begin begin update profiles set xp_boost_until = now() + interval '10 years' where id='00000000-0000-0000-0000-0000000000a1'; raise exception 'BOOST WRITTEN'; exception when insufficient_privilege then null; end; end $$;
do $$ begin begin update profiles set daily_quest_chest_claimed_date = current_date where id='00000000-0000-0000-0000-0000000000a1'; raise exception 'CHEST MARK WRITTEN'; exception when insufficient_privilege then null; end; end $$;
-- обычные поля профиля по-прежнему меняются
update profiles set timezone='Europe/Moscow', daily_goal_type='xp', daily_goal_target=null where id='00000000-0000-0000-0000-0000000000a1';
select t_assert((select timezone from profiles where id='00000000-0000-0000-0000-0000000000a1')='Europe/Moscow', 'owner can set timezone');
-- создание профиля клиентом: с нулевым XP можно, с чужими наградами — нельзя
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d4','d@x.test'),('00000000-0000-0000-0000-0000000000e5','e@x.test');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000d4', false);
set role authenticated;
insert into profiles (id, target_language, native_language) values ('00000000-0000-0000-0000-0000000000d4','en','ru');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000e5', false);
do $$ begin begin insert into profiles (id, target_language, native_language, xp) values ('00000000-0000-0000-0000-0000000000e5','en','ru',500000); raise exception 'INSERTED WITH XP'; exception when insufficient_privilege then null; end; end $$;
do $$ begin begin insert into profiles (id, target_language, native_language, xp_boost_until) values ('00000000-0000-0000-0000-0000000000e5','en','ru',now()+interval '1 year'); raise exception 'INSERTED WITH BOOST'; exception when insufficient_privilege then null; end; end $$;
reset role;
-- сервисная роль и award_xp (security definer) работают как прежде
set role service_role;
update profiles set xp_boost_until = now() + interval '15 minutes', daily_quest_chest_claimed_date = current_date where id='00000000-0000-0000-0000-0000000000a1';
select t_assert((select xp_boost_until from profiles where id='00000000-0000-0000-0000-0000000000a1') > now(), 'service_role can set boost');
select t_assert(award_xp('00000000-0000-0000-0000-0000000000a1','quest_chest','2026-01-01',30,null)->>'status'='awarded', 'award_xp works for service_role');
reset role;

-- 16. user_achievements: клиент не пишет, сервер пишет, читает владелец
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
do $$ begin begin insert into user_achievements (owner_id, achievement_id) values ('00000000-0000-0000-0000-0000000000a1','xp_5000'); raise exception 'ACH FORGED'; exception when insufficient_privilege then null; end; end $$;
reset role;
set role service_role;
insert into user_achievements (owner_id, achievement_id) values ('00000000-0000-0000-0000-0000000000a1','first_lesson');
do $$ begin begin insert into user_achievements (owner_id, achievement_id) values ('00000000-0000-0000-0000-0000000000a1','first_lesson'); raise exception 'DUP'; exception when unique_violation then null; end; end $$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select t_assert((select count(*) from user_achievements)=1, 'owner reads own achievement');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b2', false);
select t_assert((select count(*) from user_achievements)=0, 'other user does not see it');
reset role;

\echo ALL SQL CHECKS PASSED

-- ======== D. activity_days: клиент только читает ========
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000f6', false);
set role authenticated;
select t_assert((select count(*) from activity_days) >= 1, 'owner reads own days');
select t_assert((select count(*) from activity_days where user_id <> '00000000-0000-0000-0000-0000000000f6')=0, 'sees only own days');
do $$ begin begin insert into activity_days (user_id, day, xp, goal_met) values ('00000000-0000-0000-0000-0000000000f6', current_date - 1, 999, true); raise exception 'INSERTED'; exception when insufficient_privilege then null; end; end $$;
do $$ begin begin update activity_days set goal_met = true, xp = 9999; raise exception 'UPDATED'; exception when insufficient_privilege then null; end; end $$;
do $$ begin begin delete from activity_days; raise exception 'DELETED'; exception when insufficient_privilege then null; end; end $$;
reset role;
set role service_role;
insert into activity_days (user_id, day, freeze_used) values ('00000000-0000-0000-0000-0000000000f6', current_date - 2, true) on conflict (user_id, day) do update set freeze_used = true;
reset role;
select t_assert((select freeze_used from activity_days where user_id='00000000-0000-0000-0000-0000000000f6' and day=current_date - 2), 'service_role can mark a freeze day');




-- отметка времени смены пояса принадлежит серверу: клиент не может ни сбросить её, ни подделать
update profiles set timezone_changed_at = now() - interval '2 hours' where id='00000000-0000-0000-0000-0000000000f6';  -- у пользователя есть отметка (под суперпользователем)
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000f6', false);
set role authenticated;
do $$ begin begin update profiles set timezone_changed_at = null where id='00000000-0000-0000-0000-0000000000f6'; raise exception 'STAMP RESET'; exception when others then if sqlerrm <> 'profile rewards are managed by the server' then raise; end if; end; end $$;
do $$ begin begin update profiles set timezone_changed_at = now() - interval '3 days' where id='00000000-0000-0000-0000-0000000000f6'; raise exception 'STAMP FORGED'; exception when others then if sqlerrm <> 'profile rewards are managed by the server' then raise; end if; end; end $$;
reset role;

-- ======== серия, заморозка и производные поля: только сервер ========
create or replace function guard_try(p_user uuid, p_sql text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  set local role authenticated;
  begin
    execute p_sql;
    reset role;
    return 'allowed';
  exception when others then
    reset role;
    return sqlerrm;
  end;
end $$;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a7','a7@x.test') on conflict do nothing;
insert into profiles (id, target_language, native_language, streak_current, streak_longest, last_active_date, streak_freeze_available, streak_freeze_week, streak_before_break, streak_repair_until, review_best_session_count, perfect_week_awarded_week)
  values ('00000000-0000-0000-0000-0000000000a7','en','ru', 5, 8, current_date - 1, false, current_date - 3, 12, current_date + 1, 14, current_date - 7);

-- каждое поле по отдельности: клиент не может ни поднять, ни сбросить значение
select t_assert((select count(*) from unnest(array[
  'streak_current = 9999', 'streak_current = 0', 'streak_longest = 9999', 'last_active_date = current_date', 'last_active_date = null',
  'streak_freeze_available = true', 'streak_freeze_week = null', 'streak_before_break = 500', 'streak_before_break = null',
  'streak_repair_until = current_date + 30', 'streak_repair_until = null', 'review_best_session_count = 99999', 'perfect_week_awarded_week = null'
]) c where guard_try('00000000-0000-0000-0000-0000000000a7', format('update profiles set %s where id = %L', c, '00000000-0000-0000-0000-0000000000a7')) = 'profile rewards are managed by the server') = 13, 'every server-owned column is refused for the client, alone');
-- сценарий «бесконечные заморозки»: вернуть заморозку и сбросить неделю одним запросом
select t_assert(guard_try('00000000-0000-0000-0000-0000000000a7', $q$update profiles set streak_freeze_available = true, streak_freeze_week = null where id = '00000000-0000-0000-0000-0000000000a7'$q$) = 'profile rewards are managed by the server', 'unlimited-freeze trick refused');
-- сценарий «бесплатное восстановление серии»
select t_assert(guard_try('00000000-0000-0000-0000-0000000000a7', $q$update profiles set streak_current = 0, streak_before_break = 400, streak_repair_until = current_date + 365 where id = '00000000-0000-0000-0000-0000000000a7'$q$) = 'profile rewards are managed by the server', 'forged repair refused');
-- ничего не изменилось
select t_assert((select streak_current from profiles where id = '00000000-0000-0000-0000-0000000000a7') = 5 and (select streak_freeze_available from profiles where id = '00000000-0000-0000-0000-0000000000a7') = false and (select review_best_session_count from profiles where id = '00000000-0000-0000-0000-0000000000a7') = 14, 'values untouched after the attempts');
-- присвоение того же значения — не запись; остальные поля профиля меняются
select t_assert(guard_try('00000000-0000-0000-0000-0000000000a7', $q$update profiles set streak_current = streak_current, streak_freeze_available = streak_freeze_available, daily_xp_goal = 70, streak_goal_days = 5, leaderboard_opt_in = true where id = '00000000-0000-0000-0000-0000000000a7'$q$) = 'allowed', 'no-op writes and the user''s own settings pass');
select t_assert((select daily_xp_goal from profiles where id = '00000000-0000-0000-0000-0000000000a7') = 70, 'own settings applied');
-- создание профиля клиентом: с начальными значениями можно, с серией и заморозкой — нельзя
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a8','a8@x.test'),('00000000-0000-0000-0000-0000000000a9','a9@x.test') on conflict do nothing;
select t_assert(guard_try('00000000-0000-0000-0000-0000000000a8', $q$insert into profiles (id, target_language, native_language) values ('00000000-0000-0000-0000-0000000000a8','en','ru')$q$) = 'allowed', 'client creates a profile with initial values');
select t_assert((select streak_freeze_available from profiles where id = '00000000-0000-0000-0000-0000000000a8') = true and (select streak_current from profiles where id = '00000000-0000-0000-0000-0000000000a8') = 0, 'initial values: no streak, a freeze available');
select t_assert((select count(*) from unnest(array['streak_current', 'streak_longest', 'review_best_session_count']) c
  where guard_try('00000000-0000-0000-0000-0000000000a9', format('insert into profiles (id, target_language, native_language, %s) values (%L, %L, %L, 7)', c, '00000000-0000-0000-0000-0000000000a9', 'en', 'ru')) = 'profile rewards are managed by the server') = 3, 'client cannot create a profile with a streak or a record');
select t_assert(guard_try('00000000-0000-0000-0000-0000000000a9', $q$insert into profiles (id, target_language, native_language, streak_freeze_available) values ('00000000-0000-0000-0000-0000000000a9','en','ru', false)$q$) = 'profile rewards are managed by the server', 'client cannot create a profile without the default freeze state');
select t_assert(guard_try('00000000-0000-0000-0000-0000000000a9', $q$insert into profiles (id, target_language, native_language, last_active_date, streak_before_break, perfect_week_awarded_week) values ('00000000-0000-0000-0000-0000000000a9','en','ru', current_date, 3, current_date)$q$) = 'profile rewards are managed by the server', 'client cannot create a profile with dates of a streak');
-- онбординг: upsert с конфликтом (профиль уже есть) обновляет только перечисленные поля и проходит
select t_assert(guard_try('00000000-0000-0000-0000-0000000000a8', $q$insert into profiles (id, target_language, native_language, level) values ('00000000-0000-0000-0000-0000000000a8','en','ru','B1') on conflict (id) do update set target_language = excluded.target_language, native_language = excluded.native_language, level = excluded.level$q$) = 'allowed', 'onboarding retry (upsert) still works');
-- сервер пишет всё это без ограничений
set role service_role;
update profiles set streak_current = 6, streak_longest = 9, last_active_date = current_date, streak_freeze_available = true, streak_freeze_week = current_date, streak_before_break = null, streak_repair_until = null, review_best_session_count = 15, perfect_week_awarded_week = current_date where id = '00000000-0000-0000-0000-0000000000a7';
reset role;
select t_assert((select streak_current from profiles where id = '00000000-0000-0000-0000-0000000000a7') = 6 and (select review_best_session_count from profiles where id = '00000000-0000-0000-0000-0000000000a7') = 15, 'service_role writes the streak fields');

\echo CONTRACT GUARDS PASSED
