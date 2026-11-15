-- «Существующие данные» ДО итерации 6: накатывается после миграций 0001–0058 и до 0059. Затем проверяется,
-- что expand (0059) и contract (0060) эти данные не меняют и не ломают. Только колонки, которые есть на 0058.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000e101','legacy1@x.test'),
  ('00000000-0000-0000-0000-00000000e102','legacy2@x.test'),
  ('00000000-0000-0000-0000-00000000e103','legacy3@x.test');
insert into profiles (id, target_language, native_language, xp, streak_current, streak_longest, last_active_date, daily_xp_goal,
                      streak_freeze_available, perfect_week_awarded_week, daily_quest_chest_claimed_date, xp_boost_until, completed_first_win)
values
  ('00000000-0000-0000-0000-00000000e101','en','ru',1200,12,30,current_date - 1,50,true,date_trunc('week', now())::date - 7, current_date - 3, now() - interval '2 days', true),
  ('00000000-0000-0000-0000-00000000e102','en','ru',430,3,9,current_date - 2,80,false,null,null,null,true),
  ('00000000-0000-0000-0000-00000000e103','en','ru',0,0,0,null,20,true,null,null,null,false);

insert into activity_days (user_id, day, xp, minutes, lessons, freeze_used, goal_met)
select '00000000-0000-0000-0000-00000000e101', current_date - g, 20 + g * 7, 0, 0, g = 4, g % 3 <> 0 from generate_series(1, 10) g;
insert into activity_days (user_id, day, xp, goal_met) values
  ('00000000-0000-0000-0000-00000000e102', current_date - 1, 95, true), ('00000000-0000-0000-0000-00000000e102', current_date - 2, 15, false);

insert into user_achievements (owner_id, achievement_id, earned_at) values
  ('00000000-0000-0000-0000-00000000e101','streak_7', now() - interval '20 days'),
  ('00000000-0000-0000-0000-00000000e101','words_100', now() - interval '12 days'),
  ('00000000-0000-0000-0000-00000000e101','first_book', now() - interval '9 days'),
  ('00000000-0000-0000-0000-00000000e101','perfect_session', now() - interval '3 days'),
  ('00000000-0000-0000-0000-00000000e102','first_book', now() - interval '1 day');

insert into daily_quests (owner_id, day, quest_type, target) values
  ('00000000-0000-0000-0000-00000000e101', current_date - 1, 'read_minutes', 10),
  ('00000000-0000-0000-0000-00000000e101', current_date - 1, 'review_words', 15),
  ('00000000-0000-0000-0000-00000000e101', current_date - 1, 'combo_streak', 5);

-- завершённая попытка урока из итерации 5 с занятым правом на XP
insert into lesson_attempts (user_id, path_slug, path_version, skill_key, mode, status, step_index, steps_total, plan_signature,
                             correct_count, incorrect_count, passed, score_ratio, xp_awarded, xp_claimed_at, completed_at, finalized_at)
values ('00000000-0000-0000-0000-00000000e101','a2-b1',1,'grammar.present_simple','lesson','completed',10,10,'sig-legacy',7,0,true,1,20, now() - interval '5 days', now() - interval '5 days', now() - interval '5 days');

-- Снимок агрегатов по таблицам, которые трогают миграции. assert_same сверяет живые данные со снимком.
create schema legacy_check;
create table legacy_check.snapshots (name text, tbl text, rows bigint, checksum text, primary key (name, tbl));

-- Пользователи, у которых к моменту снимка есть НЕприменённые начисления барьера выкладки (0059): их счётчики
-- закономерно изменятся при переносе в 0060, их проверяет отдельный набор (0060_rollout_apply.sql) по модели.
create table legacy_check.excluded (user_id uuid primary key);

create function legacy_check.live() returns table (tbl text, rows bigint, checksum text) language sql as $$
  select 'profiles', count(*), md5(string_agg(concat_ws('|', id, xp, streak_current, streak_longest, last_active_date, daily_xp_goal, daily_word_goal,
         streak_freeze_available, perfect_week_awarded_week, daily_quest_chest_claimed_date, xp_boost_until, completed_first_win, target_language, native_language), ';' order by id))
    from profiles where id not in (select user_id from legacy_check.excluded)
  union all select 'activity_days', count(*), md5(string_agg(concat_ws('|', user_id, day, xp, minutes, lessons, freeze_used, goal_met), ';' order by user_id, day))
    from activity_days where user_id not in (select user_id from legacy_check.excluded)
  union all select 'user_achievements', count(*), md5(string_agg(concat_ws('|', owner_id, achievement_id, earned_at), ';' order by owner_id, achievement_id))
    from user_achievements where owner_id not in (select user_id from legacy_check.excluded)
  union all select 'daily_quests', count(*), md5(string_agg(concat_ws('|', owner_id, day, quest_type, target), ';' order by owner_id, day, quest_type))
    from daily_quests where owner_id not in (select user_id from legacy_check.excluded)
  union all select 'lesson_attempts', count(*), md5(string_agg(concat_ws('|', id, user_id, skill_key, mode, status, xp_awarded, xp_claimed_at), ';' order by id))
    from lesson_attempts where user_id not in (select user_id from legacy_check.excluded)
$$;

create function legacy_check.take(p_name text) returns void language sql as $$
  insert into legacy_check.snapshots select p_name, tbl, rows, checksum from legacy_check.live();
$$;

create function legacy_check.assert_same(p_name text) returns void language plpgsql as $$
declare r record;
begin
  for r in select l.tbl, l.rows as live_rows, s.rows as snap_rows, l.checksum is not distinct from s.checksum as same
             from legacy_check.live() l join legacy_check.snapshots s on s.tbl = l.tbl and s.name = p_name loop
    if r.live_rows <> r.snap_rows or not r.same then
      raise exception 'LEGACY DATA CHANGED in % against snapshot %: rows % → %', r.tbl, p_name, r.snap_rows, r.live_rows;
    end if;
  end loop;
end $$;

\echo LEGACY SEED LOADED
