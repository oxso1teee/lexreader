-- Iteration 6, 0060 (CONTRACT): что перестаёт работать у СТАРОГО приложения (так и задумано), что продолжает
-- работать у обоих, и что новое приложение не затронуто. Запуск: run-local.sh сразу после 0060.
\set ON_ERROR_STOP on
\set QUIET on
create or replace function t_assert(cond boolean, msg text) returns void language plpgsql as $$ begin if not coalesce(cond,false) then raise exception 'ASSERT FAILED: %', msg; end if; end $$;
grant execute on function t_assert(boolean,text) to authenticated, anon, service_role;
create or replace function refused(sql text) returns boolean language plpgsql as $$
begin
  execute sql;
  return false;
exception when insufficient_privilege then return true;
end $$;
grant execute on function refused(text) to authenticated;

select t_assert(rewards_phase() = 'live', '0060 leaves the rollout in the live phase');
-- новые типы ежедневных заданий включает 0060 (старого интерфейса, не умеющего их показывать, уже нет)
insert into daily_quests (owner_id, day, quest_type, target) values ('00000000-0000-0000-0000-00000000e103', current_date, 'earn_xp', 40), ('00000000-0000-0000-0000-00000000e103', current_date, 'complete_lessons', 1), ('00000000-0000-0000-0000-00000000e103', current_date, 'answer_exercises', 8);
do $$ begin begin insert into daily_quests (owner_id, day, quest_type, target) values ('00000000-0000-0000-0000-00000000e103', current_date + 3, 'hack', 5); raise exception 'ACCEPTED'; exception when check_violation then null; end; end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000e101', false);
set role authenticated;
-- ===== старое приложение: запросы, которые теперь отклоняются (SQLSTATE 42501) =====
select t_assert(refused($q$update profiles set xp = 99999 where id = '00000000-0000-0000-0000-00000000e101'$q$), 'old addXp: profiles.xp refused');
select t_assert(refused($q$insert into activity_days (user_id, day, xp) values ('00000000-0000-0000-0000-00000000e101', current_date - 40, 5)$q$), 'old addXp: activity_days insert refused');
select t_assert(refused($q$update activity_days set xp = 9999, goal_met = true where user_id = '00000000-0000-0000-0000-00000000e101'$q$), 'old addXp: activity_days update refused');
select t_assert(refused($q$delete from activity_days where user_id = '00000000-0000-0000-0000-00000000e101'$q$), 'activity_days delete refused');
select t_assert(refused($q$insert into user_achievements (owner_id, achievement_id) values ('00000000-0000-0000-0000-00000000e101','xp_5000')$q$), 'old achievements: client insert refused');
select t_assert(refused($q$update profiles set xp_boost_until = now() + interval '1 year' where id = '00000000-0000-0000-0000-00000000e101'$q$), 'old chest: xp_boost_until refused');
select t_assert(refused($q$update profiles set daily_quest_chest_claimed_date = current_date - 100 where id = '00000000-0000-0000-0000-00000000e101'$q$), 'old chest: chest mark refused');
-- серия, заморозка, восстановление серии, рекорд сессии и отметка идеальной недели — тоже только сервер
select t_assert(refused($q$update profiles set streak_current = 14, streak_longest = 31, last_active_date = current_date, streak_freeze_available = false, streak_freeze_week = current_date, streak_before_break = null, streak_repair_until = null where id = '00000000-0000-0000-0000-00000000e101'$q$), 'old touchStreak: streak fields refused');
select t_assert(refused($q$update profiles set streak_freeze_available = false where id = '00000000-0000-0000-0000-00000000e101'$q$), 'client cannot change the freeze flag (granting is covered in the guards suite: a7 has none)');
select t_assert(refused($q$update profiles set review_best_session_count = 999 where id = '00000000-0000-0000-0000-00000000e101'$q$), 'old updateReviewBest: refused');
select t_assert(refused($q$update profiles set perfect_week_awarded_week = current_date where id = '00000000-0000-0000-0000-00000000e101'$q$), 'old perfect-week mark: refused');
-- ===== то, что остаётся у обоих приложений =====
update profiles set daily_xp_goal = 120 where id = '00000000-0000-0000-0000-00000000e101';
insert into daily_quests (owner_id, day, quest_type, target) values ('00000000-0000-0000-0000-00000000e101', current_date + 1, 'read_minutes', 6), ('00000000-0000-0000-0000-00000000e101', current_date + 1, 'review_words', 11), ('00000000-0000-0000-0000-00000000e101', current_date + 1, 'combo_streak', 3);
update profiles set xp = xp where id = '00000000-0000-0000-0000-00000000e101';                    -- запись без изменения значения не считается записью награды
update profiles set timezone = 'Europe/Moscow' where id = '00000000-0000-0000-0000-00000000e101'; -- первая установка пояса (в live синхронизация включена)
-- читать своё можно
select t_assert((select count(*) from activity_days) >= 10, 'owner reads own activity days');
select t_assert((select count(*) from user_achievements) >= 5, 'owner reads own achievements');
select t_assert((select count(*) from activity_days where user_id <> '00000000-0000-0000-0000-00000000e101') = 0, 'RLS: only own days');
reset role;
-- ===== онбординг НОВОЙ учётной записи старого и нового приложения проходит =====
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000e105','legacy5@x.test');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000e105', false);
set role authenticated;
insert into profiles (id, target_language, native_language, level, daily_word_goal, primary_goal, self_reported_cefr)
  values ('00000000-0000-0000-0000-00000000e105','en','ru','B1',20,'work_it','B1')
  on conflict (id) do update set target_language = excluded.target_language;
reset role;
select t_assert(exists(select 1 from profiles where id = '00000000-0000-0000-0000-00000000e105'), 'onboarding upsert works after contract');
-- ===== новое приложение: серверные пути не затронуты =====
select t_assert(award_xp('00000000-0000-0000-0000-00000000e101','lesson_complete','contract-lesson',20,null)->>'status' = 'awarded', 'new app: award_xp after contract');
select t_assert(mark_goal_met('00000000-0000-0000-0000-00000000e103', (now() at time zone 'UTC')::date) is true, 'new app: mark_goal_met after contract');
set role service_role;
-- серверный touchStreak: те же поля, но сервисной ролью
update profiles set streak_current = 14, streak_longest = 31, last_active_date = current_date, streak_freeze_available = false, streak_freeze_week = current_date, streak_before_break = 9, streak_repair_until = current_date + 2, review_best_session_count = 12, perfect_week_awarded_week = current_date where id = '00000000-0000-0000-0000-00000000e101';
insert into activity_days (user_id, day, freeze_used) values ('00000000-0000-0000-0000-00000000e103', current_date - 2, true) on conflict (user_id, day) do update set freeze_used = true;
insert into user_achievements (owner_id, achievement_id) values ('00000000-0000-0000-0000-00000000e103','words_10') on conflict (owner_id, achievement_id) do nothing;
update profiles set xp_boost_until = now() + interval '15 minutes', daily_quest_chest_claimed_date = current_date where id = '00000000-0000-0000-0000-00000000e103';
reset role;
select t_assert(exists(select 1 from profiles where id = '00000000-0000-0000-0000-00000000e103' and xp_boost_until > now()), 'new app: server writes boost / chest mark');
select t_assert((select streak_current from profiles where id = '00000000-0000-0000-0000-00000000e101') = 14 and (select streak_freeze_available from profiles where id = '00000000-0000-0000-0000-00000000e101') = false, 'new app: server writes streak fields');

-- защита порядка: 0060 нельзя применить без 0059 — проверено в run-local.sh отдельным шагом
\echo CONTRACT COMPAT PASSED
