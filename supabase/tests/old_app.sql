-- Вспомогательные функции тестов барьера выкладки (0059): «старое приложение» и «новое приложение» как вызовы.
-- Подключается из 0059_rollout_fence.sql и используется параллельными сценариями run-local.sh.
\set ON_ERROR_STOP on
\set QUIET on
-- «Старый addXp»: чтение и запись — отдельные запросы (отдельные транзакции PostgREST), между ними может случиться что угодно.
create or replace function old_read(p_user uuid) returns int language plpgsql as $$
declare v int;
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  set local role authenticated;
  select xp into v from profiles where id = p_user;
  reset role;
  return v;
end $$;
create or replace function old_read_day(p_user uuid) returns int language plpgsql as $$
declare v int;
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  set local role authenticated;
  select coalesce((select xp from activity_days where user_id = p_user and day = (now() at time zone 'UTC')::date), 0) into v;
  reset role;
  return v;
end $$;
-- запись прочитанного + n (абсолютное значение, как в addXp: update profiles set xp = X; upsert activity_days (xp, goal_met))
create or replace function old_write(p_user uuid, p_read int, p_read_day int, p_n int) returns void language plpgsql as $$
declare goal int;
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  set local role authenticated;
  select daily_xp_goal into goal from profiles where id = p_user;
  update profiles set xp = p_read + p_n where id = p_user;
  insert into activity_days (user_id, day, xp, goal_met) values (p_user, (now() at time zone 'UTC')::date, p_read_day + p_n, p_read_day + p_n >= goal)
    on conflict (user_id, day) do update set xp = excluded.xp, goal_met = excluded.goal_met;
  reset role;
end $$;
create or replace function counter(p_user uuid) returns int language sql as $$ select xp from profiles where id = p_user $$;
create or replace function pending(p_user uuid) returns int language sql as $$ select coalesce(sum(amount), 0)::int from xp_events where user_id = p_user and not applied $$;
create or replace function new_award(p_user uuid, p_ref text, p_amount int default 10) returns jsonb language sql as $$ select award_xp(p_user, 'lesson_complete', p_ref, p_amount, null) $$;

