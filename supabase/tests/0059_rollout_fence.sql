-- Iteration 6, барьер выкладки (0059), фаза overlap: пока жив старый код приложения, award_xp и mark_goal_met
-- НЕ пишут счётчики, которые перезаписывает старый addXp, но ничего не теряют: всё копится в журнале и
-- переносится при 0060 (проверяет 0060_rollout_apply.sql по модели «после = до + накопленное»).
-- «Старое приложение» — это ровно запросы старого addXp: прочитать profiles.xp / activity_days.xp, потом
-- записать прочитанное + N абсолютным значением (роль authenticated, два отдельных запроса).
\set ON_ERROR_STOP on
\set QUIET on
create or replace function t_assert(cond boolean, msg text) returns void language plpgsql as $$ begin if not coalesce(cond,false) then raise exception 'ASSERT FAILED: %', msg; end if; end $$;
grant execute on function t_assert(boolean,text) to authenticated, anon, service_role;

select t_assert(rewards_phase() = 'overlap', 'precondition: overlap phase');

\ir old_app.sql

insert into auth.users (id, email) select ('00000000-0000-0000-0000-0000000fa0' || lpad(i::text, 2, '0'))::uuid, 'fence' || i || '@x.test' from generate_series(1, 12) i;
insert into profiles (id, target_language, native_language, xp, daily_xp_goal) select id, 'en', 'ru', 100, 500 from auth.users where email like 'fence%@x.test';

-- ===== 1. сценарий из аудита: старый ЧИТАЕТ xp, новый начисляет, старый ЗАПИСЫВАЕТ устаревшее =====
select set_config('t.read',  old_read('00000000-0000-0000-0000-0000000fa001')::text, false);       -- 100
select set_config('t.rday',  old_read_day('00000000-0000-0000-0000-0000000fa001')::text, false);   -- 0
select set_config('t.r', new_award('00000000-0000-0000-0000-0000000fa001', 'a1', 20)::text, false);
select t_assert(current_setting('t.r')::jsonb->>'status' = 'awarded' and (current_setting('t.r')::jsonb->>'deferred')::boolean, 'S1: the new app got its award (deferred)');
select old_write('00000000-0000-0000-0000-0000000fa001', current_setting('t.read')::int, current_setting('t.rday')::int, 1);   -- запись устаревшего: 100 + 1
select t_assert(counter('00000000-0000-0000-0000-0000000fa001') = 101, 'S1: the counter is exactly what the old app wrote (nobody else wrote it)');
select t_assert(pending('00000000-0000-0000-0000-0000000fa001') = 20, 'S1: the new award survives in the ledger (nothing lost)');
select t_assert((select count(*) from xp_events where user_id = '00000000-0000-0000-0000-0000000fa001') = 1, 'S1: exactly one event');

-- ===== 2. все порядки одного старого запроса и одного нового =====
-- [новый, старый читает, старый пишет]
select set_config('t.r', new_award('00000000-0000-0000-0000-0000000fa002', 'a1', 10)::text, false);
select set_config('t.read', old_read('00000000-0000-0000-0000-0000000fa002')::text, false);
select old_write('00000000-0000-0000-0000-0000000fa002', current_setting('t.read')::int, old_read_day('00000000-0000-0000-0000-0000000fa002'), 1);
select t_assert(counter('00000000-0000-0000-0000-0000000fa002') = 101 and pending('00000000-0000-0000-0000-0000000fa002') = 10, 'S2: [new, old read, old write]');
-- [старый читает, старый пишет, новый]
select set_config('t.read', old_read('00000000-0000-0000-0000-0000000fa003')::text, false);
select old_write('00000000-0000-0000-0000-0000000fa003', current_setting('t.read')::int, old_read_day('00000000-0000-0000-0000-0000000fa003'), 1);
select new_award('00000000-0000-0000-0000-0000000fa003', 'a1', 10);
select t_assert(counter('00000000-0000-0000-0000-0000000fa003') = 101 and pending('00000000-0000-0000-0000-0000000fa003') = 10, 'S3: [old read, old write, new]');
-- длинная смесь: 6 старых и 6 новых вперемешку, чтение старого «залипает» на несколько шагов
do $$
declare
  u uuid := '00000000-0000-0000-0000-0000000fa004';
  stale_read int; stale_day int; i int; total_new int := 0; old_writes int := 0;
begin
  for i in 1..12 loop
    if i % 3 = 1 then stale_read := old_read(u); stale_day := old_read_day(u); end if;
    if i % 2 = 0 then
      perform new_award(u, 'mix-' || i, i);
      total_new := total_new + i;
    elsif i % 3 = 0 or i % 3 = 2 then
      perform old_write(u, stale_read, stale_day, 1);
      stale_read := stale_read + 1; stale_day := stale_day + 1; old_writes := old_writes + 1;
    end if;
  end loop;
  -- счётчик = только то, что писал старый код (по его же учёту); новые начисления — целиком в журнале
  if counter(u) <> 100 + old_writes then raise exception 'ASSERT FAILED: S4 counter % vs % old writes', counter(u), old_writes; end if;
  if pending(u) <> total_new then raise exception 'ASSERT FAILED: S4 pending % vs %', pending(u), total_new; end if;
end $$;

-- ===== 3. барьер не пишет в таблицы счётчиков вообще (строки не перезаписаны) =====
insert into activity_days (user_id, day, xp) values ('00000000-0000-0000-0000-0000000fa005', (now() at time zone 'UTC')::date, 7);
create temp table before_rows as select 'p' k, xmin::text x from profiles where id = '00000000-0000-0000-0000-0000000fa005'
  union all select 'a', xmin::text from activity_days where user_id = '00000000-0000-0000-0000-0000000fa005';
select new_award('00000000-0000-0000-0000-0000000fa005', 'x1', 5);
select new_award('00000000-0000-0000-0000-0000000fa005', 'x2', 5);
select mark_goal_met('00000000-0000-0000-0000-0000000fa005', (now() at time zone 'UTC')::date);
select t_assert((select x from before_rows where k = 'p') = (select xmin::text from profiles where id = '00000000-0000-0000-0000-0000000fa005'), 'S5: the profile row was not rewritten (same xmin)');
select t_assert((select x from before_rows where k = 'a') = (select xmin::text from activity_days where user_id = '00000000-0000-0000-0000-0000000fa005'), 'S5: the activity day row was not rewritten (same xmin)');
select t_assert(counter('00000000-0000-0000-0000-0000000fa005') = 100 and (select xp from activity_days where user_id = '00000000-0000-0000-0000-0000000fa005') = 7, 'S5: counters unchanged');

-- ===== 4. идемпотентность, лимиты, Double-XP, ответ — в overlap работают как в live =====
select t_assert(new_award('00000000-0000-0000-0000-0000000fa006', 'dup', 10)->>'status' = 'awarded', 'S6: first award');
select t_assert(new_award('00000000-0000-0000-0000-0000000fa006', 'dup', 10)->>'status' = 'duplicate', 'S6: same key is a duplicate');
select t_assert(pending('00000000-0000-0000-0000-0000000fa006') = 10, 'S6: the duplicate added nothing');
select award_xp('00000000-0000-0000-0000-0000000fa006', 'review_card', 'r1', 1, 3);
select award_xp('00000000-0000-0000-0000-0000000fa006', 'review_card', 'r2', 1, 3);
select award_xp('00000000-0000-0000-0000-0000000fa006', 'review_card', 'r3', 1, 3);
select t_assert(award_xp('00000000-0000-0000-0000-0000000fa006', 'review_card', 'r4', 1, 3)->>'status' = 'capped', 'S6: the daily cap counts pending events');
-- виртуальные итоги идут цепочкой
select set_config('t.r1', award_xp('00000000-0000-0000-0000-0000000fa007', 'word_saved', 'c1', 4, null)::text, false);
select set_config('t.r2', award_xp('00000000-0000-0000-0000-0000000fa007', 'word_saved', 'c2', 6, null)::text, false);
select t_assert((current_setting('t.r1')::jsonb->>'total_before')::int = 100 and (current_setting('t.r1')::jsonb->>'total_after')::int = 104, 'S7: virtual totals, first');
select t_assert((current_setting('t.r2')::jsonb->>'total_before')::int = 104 and (current_setting('t.r2')::jsonb->>'total_after')::int = 110, 'S7: virtual totals chain over pending events');
select t_assert((current_setting('t.r2')::jsonb->>'today_before')::int = 4 and (current_setting('t.r2')::jsonb->>'today_after')::int = 10, 'S7: virtual day totals chain');
-- Double-XP
update profiles set xp_boost_until = now() + interval '10 minutes' where id = '00000000-0000-0000-0000-0000000fa008';
select t_assert((new_award('00000000-0000-0000-0000-0000000fa008', 'b1', 5)->>'awarded')::int = 10, 'S8: boost doubles in overlap');
-- день в overlap — UTC, даже если у профиля задан другой пояс (его ставит только сервер/суперпользователь)
update profiles set timezone = 'Pacific/Kiritimati' where id = '00000000-0000-0000-0000-0000000fa009';
select t_assert((new_award('00000000-0000-0000-0000-0000000fa009', 'tz1', 5)->>'day')::date = (now() at time zone 'UTC')::date, 'S9: overlap days are UTC (the same rows the old app writes)');
select t_assert(((select ref from xp_events where user_id = '00000000-0000-0000-0000-0000000fa009') is not distinct from 'tz1'), 'S9: ledger row recorded');
select set_config('t.r', award_xp('00000000-0000-0000-0000-0000000fa009', 'reading_session', 't:{day}', 3, null)::text, false);
select t_assert(current_setting('t.r')::jsonb->>'status' = 'awarded' and exists(select 1 from xp_events where ref = 't:' || (now() at time zone 'UTC')::date::text), 'S9: {day} expands to the UTC day in overlap');

-- ===== 5. mark_goal_met: ровно один true, отметка откладывается; уже выставленную старым кодом не дублирует =====
update profiles set daily_goal_type = 'lessons', daily_goal_target = 2 where id in ('00000000-0000-0000-0000-0000000fa010', '00000000-0000-0000-0000-0000000fa011');
select t_assert(mark_goal_met('00000000-0000-0000-0000-0000000fa010', (now() at time zone 'UTC')::date) is true, 'S10: first mark → true');
select t_assert(mark_goal_met('00000000-0000-0000-0000-0000000fa010', (now() at time zone 'UTC')::date) is false, 'S10: second mark → false');
select t_assert((select count(*) from pending_goal_marks where user_id = '00000000-0000-0000-0000-0000000fa010') = 1, 'S10: a single pending mark');
select t_assert(not exists(select 1 from activity_days where user_id = '00000000-0000-0000-0000-0000000fa010'), 'S10: no activity_days row written');
-- старое приложение уже закрыло цель дня само → новая отметка не нужна
insert into activity_days (user_id, day, xp, goal_met) values ('00000000-0000-0000-0000-0000000fa011', (now() at time zone 'UTC')::date, 600, true);
select t_assert(mark_goal_met('00000000-0000-0000-0000-0000000fa011', (now() at time zone 'UTC')::date) is false, 'S11: already met by the old app → false');
select t_assert(not exists(select 1 from pending_goal_marks where user_id = '00000000-0000-0000-0000-0000000fa011'), 'S11: nothing pending');
-- XP-цель: новое начисление, закрывающее цель, откладывается вместе с остальным; goal_met выставит перенос
select t_assert((new_award('00000000-0000-0000-0000-0000000fa012', 'g1', 500)->>'today_after')::int = 500, 'S12: the virtual day total reaches the goal');
select t_assert(not exists(select 1 from activity_days where user_id = '00000000-0000-0000-0000-0000000fa012'), 'S12: the activity day is written only at the transfer');

-- ===== 6. пояс: клиентская смена приостановлена (кроме сервиса) =====
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000fa001', false);
set role authenticated;
do $$ begin begin update profiles set timezone = 'Asia/Tokyo' where id = '00000000-0000-0000-0000-0000000fa001'; raise exception 'CHANGED'; exception when others then if sqlerrm <> 'timezone_sync_paused' then raise; end if; end; end $$;
reset role;
set role service_role;
update profiles set timezone = 'Asia/Tokyo' where id = '00000000-0000-0000-0000-0000000fa001';
reset role;
select t_assert((select timezone from profiles where id = '00000000-0000-0000-0000-0000000fa001') = 'Asia/Tokyo', 'S13: service_role is not limited by the pause');
update profiles set timezone = null where id = '00000000-0000-0000-0000-0000000fa001';

\echo ROLLOUT FENCE PASSED
