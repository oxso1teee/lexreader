-- Iteration 6, 0060: duel_win_streak принадлежит серверу. Единственный законный писатель — claim_duel_result()
-- (security definer, 0055): клиентская роль не может ни выставить, ни сбросить значение запросом из браузера,
-- а серверная функция продолжает работать, пока триггер profiles_guard_rewards включён.
-- Запуск: run-local.sh ПОСЛЕ 0060.
\set ON_ERROR_STOP on
\set QUIET on
create or replace function t_assert(cond boolean, msg text) returns void language plpgsql as $$ begin if not coalesce(cond,false) then raise exception 'ASSERT FAILED: %', msg; end if; end $$;
grant execute on function t_assert(boolean,text) to authenticated, anon, service_role;
create or replace function duel_try(p_user uuid, p_sql text) returns text language plpgsql as $$
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
create or replace function duel_claim(p_user uuid, p_duel uuid) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  set local role authenticated;
  r := public.claim_duel_result(p_duel);
  reset role;
  return r;
end $$;
create or replace function streak_of(p_user uuid) returns int language sql as $$ select duel_win_streak from profiles where id = p_user $$;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000d0001','d1@x.test'),('00000000-0000-0000-0000-0000000d0002','d2@x.test'),('00000000-0000-0000-0000-0000000d0003','d3@x.test');
insert into profiles (id, target_language, native_language) values ('00000000-0000-0000-0000-0000000d0001','en','ru'),('00000000-0000-0000-0000-0000000d0002','en','ru'),('00000000-0000-0000-0000-0000000d0003','en','ru');
-- завершённые дуэли d1 (создатель) против d2: победа, победа, поражение, ничья
insert into duels (id, creator_id, creator_initials, opponent_id, opponent_initials, language, native_language, status, round_count, creator_score, opponent_score, winner_id, finished_at) values
  ('00000000-0000-0000-0000-0000000dd001','00000000-0000-0000-0000-0000000d0001','D1','00000000-0000-0000-0000-0000000d0002','D2','en','ru','finished',5,4,1,'00000000-0000-0000-0000-0000000d0001', now()),
  ('00000000-0000-0000-0000-0000000dd002','00000000-0000-0000-0000-0000000d0001','D1','00000000-0000-0000-0000-0000000d0002','D2','en','ru','finished',5,5,0,'00000000-0000-0000-0000-0000000d0001', now()),
  ('00000000-0000-0000-0000-0000000dd003','00000000-0000-0000-0000-0000000d0001','D1','00000000-0000-0000-0000-0000000d0002','D2','en','ru','finished',5,1,4,'00000000-0000-0000-0000-0000000d0002', now()),
  ('00000000-0000-0000-0000-0000000dd004','00000000-0000-0000-0000-0000000d0001','D1','00000000-0000-0000-0000-0000000d0002','D2','en','ru','finished',4,2,2,null, now());

-- ===== 1. клиент не может подделать значение =====
select t_assert(duel_try('00000000-0000-0000-0000-0000000d0001', $q$update profiles set duel_win_streak = 99 where id = '00000000-0000-0000-0000-0000000d0001'$q$) = 'profile rewards are managed by the server', 'client cannot raise the duel win streak');
select t_assert(streak_of('00000000-0000-0000-0000-0000000d0001') = 0, 'value untouched after the forged update');
select t_assert(duel_try('00000000-0000-0000-0000-0000000d0001', $q$update profiles set duel_win_streak = duel_win_streak + 1 where id = '00000000-0000-0000-0000-0000000d0001'$q$) = 'profile rewards are managed by the server', 'client cannot increment it either');
select t_assert(duel_try('00000000-0000-0000-0000-0000000d0001', $q$update profiles set duel_win_streak = 0, daily_xp_goal = 90 where id = '00000000-0000-0000-0000-0000000d0001'$q$) = 'allowed', 'writing the same value (a no-op) next to a user setting passes');
select t_assert((select daily_xp_goal from profiles where id = '00000000-0000-0000-0000-0000000d0001') = 90, 'the user setting was saved');
select t_assert(duel_try('00000000-0000-0000-0000-0000000d0003', $q$insert into profiles (id, target_language, native_language, duel_win_streak) values ('00000000-0000-0000-0000-0000000d0003','en','ru', 7) on conflict (id) do update set duel_win_streak = excluded.duel_win_streak$q$) = 'profile rewards are managed by the server', 'client cannot create or upsert a profile with a streak');
select t_assert(streak_of('00000000-0000-0000-0000-0000000d0003') = 0, 'value untouched after the forged upsert');

-- ===== 2. серверный путь: claim_duel_result — security definer, работает при включённом триггере =====
select t_assert((select prosecdef from pg_proc where proname = 'claim_duel_result' and pronamespace = 'public'::regnamespace), 'claim_duel_result is security definer');
select t_assert((select proconfig::text from pg_proc where proname = 'claim_duel_result' and pronamespace = 'public'::regnamespace) like '%search_path=%', 'with a fixed search_path');
select t_assert(exists(select 1 from pg_trigger where tgname = 'profiles_guard_rewards' and tgrelid = 'public.profiles'::regclass), 'precondition: the guard trigger is active');

select set_config('t.r', duel_claim('00000000-0000-0000-0000-0000000d0001', '00000000-0000-0000-0000-0000000dd001')::text, false);
select t_assert((current_setting('t.r')::jsonb->>'winStreak')::int = 1 and (current_setting('t.r')::jsonb->>'xpToAward')::int = 25, 'win #1 → streak 1, 25 XP to award');
select t_assert(streak_of('00000000-0000-0000-0000-0000000d0001') = 1, 'profile streak = 1 (written by the definer function)');
-- повтор того же клейма: серия не растёт, XP не выдаётся второй раз
select set_config('t.r', duel_claim('00000000-0000-0000-0000-0000000d0001', '00000000-0000-0000-0000-0000000dd001')::text, false);
select t_assert((current_setting('t.r')::jsonb->>'winStreak')::int = 1 and (current_setting('t.r')::jsonb->>'xpToAward')::int = 0, 'repeated claim: no growth, no XP');
select set_config('t.r', duel_claim('00000000-0000-0000-0000-0000000d0001', '00000000-0000-0000-0000-0000000dd002')::text, false);
select t_assert((current_setting('t.r')::jsonb->>'winStreak')::int = 2, 'win #2 → streak 2');
-- подделка между победами не меняет серверный счёт
select t_assert(duel_try('00000000-0000-0000-0000-0000000d0001', $q$update profiles set duel_win_streak = 50 where id = '00000000-0000-0000-0000-0000000d0001'$q$) = 'profile rewards are managed by the server', 'forging between wins is refused');
select t_assert(streak_of('00000000-0000-0000-0000-0000000d0001') = 2, 'server count intact');
-- ничья не трогает серию, поражение обрывает
select set_config('t.r', duel_claim('00000000-0000-0000-0000-0000000d0001', '00000000-0000-0000-0000-0000000dd004')::text, false);
select t_assert((current_setting('t.r')::jsonb->>'winStreak')::int = 2 and (current_setting('t.r')::jsonb->>'xpToAward')::int = 0, 'draw: streak untouched');
select set_config('t.r', duel_claim('00000000-0000-0000-0000-0000000d0001', '00000000-0000-0000-0000-0000000dd003')::text, false);
select t_assert((current_setting('t.r')::jsonb->>'winStreak')::int = 0 and streak_of('00000000-0000-0000-0000-0000000d0001') = 0, 'loss resets the streak to 0 (by the server function)');
-- соперник: его серия считается независимо (победа в #3)
select set_config('t.r', duel_claim('00000000-0000-0000-0000-0000000d0002', '00000000-0000-0000-0000-0000000dd003')::text, false);
select t_assert((current_setting('t.r')::jsonb->>'winStreak')::int = 1, 'the opponent has their own streak');

-- ===== 3. права: не участник и анонимная роль =====
select t_assert(duel_try('00000000-0000-0000-0000-0000000d0003', $q$select public.claim_duel_result('00000000-0000-0000-0000-0000000dd001')$q$) = 'not_a_participant', 'a non-participant cannot claim');
set role anon;
do $$ begin begin perform public.claim_duel_result('00000000-0000-0000-0000-0000000dd001'); raise exception 'CALLED'; exception when insufficient_privilege then null; end; end $$;
reset role;

-- ===== 4. сервисная роль не ограничена =====
set role service_role;
update profiles set duel_win_streak = 3 where id = '00000000-0000-0000-0000-0000000d0003';
reset role;
select t_assert(streak_of('00000000-0000-0000-0000-0000000d0003') = 3, 'service_role can write the streak');

\echo DUEL STREAK PASSED
