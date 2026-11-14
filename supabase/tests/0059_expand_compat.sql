-- Iteration 6, 0059 (EXPAND), фаза overlap: старое приложение продолжает работать, новое — работает
-- (начисления откладываются барьером выкладки), данные не тронуты.
-- Запуск: run-local.sh, между 0059 и 0060. «Старое приложение» здесь — те самые запросы, которые делает
-- код до итерации 6 (addXp, touchStreak, достижения, сундук) от имени пользователя (роль authenticated).
\set ON_ERROR_STOP on
\set QUIET on
create or replace function t_assert(cond boolean, msg text) returns void language plpgsql as $$ begin if not coalesce(cond,false) then raise exception 'ASSERT FAILED: %', msg; end if; end $$;
grant execute on function t_assert(boolean,text) to authenticated, anon, service_role;

-- новые колонки не изменили существующих аккаунтов
select t_assert((select count(*) from profiles where id::text like '00000000-0000-0000-0000-00000000e10%' and timezone is null and timezone_changed_at is null and daily_goal_type = 'xp' and daily_goal_target is null) = 3, 'legacy profiles: new columns take defaults');

-- ===== СТАРОЕ приложение (до итерации 6), роль authenticated =====
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000e101', false);
set role authenticated;
-- addXp: читает xp, затем пишет profiles.xp и upsert activity_days (день по UTC)
update profiles set xp = 1200 + 15 where id = '00000000-0000-0000-0000-00000000e101';
insert into activity_days (user_id, day, xp, goal_met) values ('00000000-0000-0000-0000-00000000e101', (now() at time zone 'UTC')::date, 15, false)
  on conflict (user_id, day) do update set xp = excluded.xp, goal_met = excluded.goal_met;
-- touchStreak: серия в профиле и отметка дня заморозки
update profiles set streak_current = 13, streak_longest = 30, last_active_date = (now() at time zone 'UTC')::date, streak_freeze_available = false where id = '00000000-0000-0000-0000-00000000e101';
insert into activity_days (user_id, day, freeze_used) values ('00000000-0000-0000-0000-00000000e101', current_date - 5, true)
  on conflict (user_id, day) do update set freeze_used = true;
-- достижения
insert into user_achievements (owner_id, achievement_id) values ('00000000-0000-0000-0000-00000000e101','words_500')
  on conflict (owner_id, achievement_id) do nothing;
-- сундук: бонус и отметка
update profiles set xp_boost_until = now() + interval '15 minutes', daily_quest_chest_claimed_date = (now() at time zone 'UTC')::date, streak_freeze_available = true where id = '00000000-0000-0000-0000-00000000e101';
-- ежедневные задания старых типов
insert into daily_quests (owner_id, day, quest_type, target) values ('00000000-0000-0000-0000-00000000e101', current_date, 'read_minutes', 8), ('00000000-0000-0000-0000-00000000e101', current_date, 'review_words', 12), ('00000000-0000-0000-0000-00000000e101', current_date, 'combo_streak', 4);
-- цель дня в XP
update profiles set daily_xp_goal = 80 where id = '00000000-0000-0000-0000-00000000e101';
reset role;
select t_assert((select xp from profiles where id = '00000000-0000-0000-0000-00000000e101') = 1215, 'old app: profiles.xp written by the client still works');
select t_assert((select count(*) from user_achievements where owner_id = '00000000-0000-0000-0000-00000000e101') = 5, 'old app: client can still insert achievements');
select t_assert((select freeze_used from activity_days where user_id = '00000000-0000-0000-0000-00000000e101' and day = current_date - 5), 'old app: freeze day written by the client');
select t_assert((select count(*) from daily_quests where owner_id = '00000000-0000-0000-0000-00000000e101' and day = current_date) = 3, 'old app: old quest types accepted');

-- онбординг старого приложения: upsert профиля новой учётной записи БЕЗ полей наград
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000e104','legacy4@x.test');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000e104', false);
set role authenticated;
insert into profiles (id, target_language, native_language, level, daily_word_goal, primary_goal, self_reported_cefr)
  values ('00000000-0000-0000-0000-00000000e104','en','ru','B1',20,'work_it','B1')
  on conflict (id) do update set target_language = excluded.target_language, native_language = excluded.native_language, level = excluded.level;
reset role;
select t_assert(exists(select 1 from profiles where id = '00000000-0000-0000-0000-00000000e104'), 'old app: onboarding upsert works');

-- ===== НОВОЕ приложение поверх expand (без 0060): фаза overlap =====
select t_assert(rewards_phase() = 'overlap', '0059 leaves the rollout in the overlap phase');
-- Барьер: начисление записывается в журнал, но НЕ в счётчики, которые пишет старое приложение.
select set_config('t.r', award_xp('00000000-0000-0000-0000-00000000e101','lesson_complete','compat-lesson',20,null)::text, false);
select t_assert(current_setting('t.r')::jsonb->>'status' = 'awarded', 'new app: award_xp works on a legacy account');
select t_assert((current_setting('t.r')::jsonb->>'deferred')::boolean, 'overlap: the award is reported as deferred');
select t_assert((select xp from profiles where id = '00000000-0000-0000-0000-00000000e101') = 1215, 'overlap: profiles.xp is written only by the old app (1215 untouched)');
-- старое приложение только что выдало Double-XP (xp_boost_until): award_xp его учитывает, 20 → 40
select t_assert((select boosted from xp_events where ref = 'compat-lesson'), 'the boost written by the old app doubles the new award');
select t_assert((select not applied and amount = 40 from xp_events where ref = 'compat-lesson'), 'the ledger holds the award as pending (40 = 20×2)');
select t_assert((current_setting('t.r')::jsonb->>'total_before')::int = 1215 and (current_setting('t.r')::jsonb->>'total_after')::int = 1255, 'the response shows the virtual total (counter + pending) so the toast is right');
select t_assert((select xp from activity_days where user_id = '00000000-0000-0000-0000-00000000e101' and day = (now() at time zone 'UTC')::date) = 15, 'overlap: activity_days.xp is untouched by the new app');
-- mark_goal_met откладывается, строка activity_days не создаётся и не переписывается
select t_assert(mark_goal_met('00000000-0000-0000-0000-00000000e102', (now() at time zone 'UTC')::date) is true, 'new app: mark_goal_met works');
select t_assert(not exists(select 1 from activity_days where user_id = '00000000-0000-0000-0000-00000000e102' and day = (now() at time zone 'UTC')::date), 'overlap: mark_goal_met does not touch activity_days');
select t_assert(exists(select 1 from pending_goal_marks where user_id = '00000000-0000-0000-0000-00000000e102'), 'overlap: the goal mark is kept as pending');
-- сервер пишет то, что нужно новому коду
set role service_role;
insert into activity_days (user_id, day, freeze_used) values ('00000000-0000-0000-0000-00000000e103', current_date - 1, true) on conflict (user_id, day) do update set freeze_used = true;
insert into user_achievements (owner_id, achievement_id) values ('00000000-0000-0000-0000-00000000e103','first_lesson') on conflict (owner_id, achievement_id) do nothing;
update profiles set xp_boost_until = now() + interval '15 minutes', daily_quest_chest_claimed_date = current_date where id = '00000000-0000-0000-0000-00000000e103';
reset role;
-- журнал XP нового кода читается владельцем
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000e101', false);
set role authenticated;
select t_assert((select count(*) from xp_events) = 1, 'new app: owner reads own ledger');
select t_assert(rewards_phase() = 'overlap', 'the client role can read the phase through the function');
do $$ begin begin perform 1 from rollout_state; raise exception 'READ'; exception when insufficient_privilege then null; end; end $$;
do $$ begin begin perform 1 from pending_goal_marks; raise exception 'READ'; exception when insufficient_privilege then null; end; end $$;
reset role;
-- типы заданий: в overlap допустимы только прежние (старый интерфейс не отображает новые)
do $$ begin begin insert into daily_quests (owner_id, day, quest_type, target) values ('00000000-0000-0000-0000-00000000e102', current_date, 'earn_xp', 40); raise exception 'ACCEPTED'; exception when check_violation then null; end; end $$;
do $$ begin begin insert into daily_quests (owner_id, day, quest_type, target) values ('00000000-0000-0000-0000-00000000e102', current_date, 'complete_lessons', 1); raise exception 'ACCEPTED'; exception when check_violation then null; end; end $$;
insert into daily_quests (owner_id, day, quest_type, target) values ('00000000-0000-0000-0000-00000000e102', current_date, 'combo_streak', 4), ('00000000-0000-0000-0000-00000000e102', current_date, 'read_minutes', 6);
-- смена пояса клиентом приостановлена; старое приложение пояс не пишет
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000e102', false);
set role authenticated;
do $$ begin begin update profiles set timezone = 'Europe/Moscow' where id = '00000000-0000-0000-0000-00000000e102'; raise exception 'CHANGED'; exception when others then if sqlerrm <> 'timezone_sync_paused' then raise; end if; end; end $$;
update profiles set daily_xp_goal = 90 where id = '00000000-0000-0000-0000-00000000e102';  -- прочие поля профиля по-прежнему меняются
reset role;

\echo EXPAND COMPAT PASSED
