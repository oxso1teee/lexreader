-- Контрольный опыт: ПОЧЕМУ нужен барьер. В фазе live то же чередование «старый читает → новый начисляет → старый
-- пишет устаревшее» теряет начисление. Старое приложение эмулируется суперпользователем (после 0060 клиентская роль
-- такую запись уже не может — это проверяют 0060_contract_*; поэтому в живой системе потеря возможна только пока
-- 0060 не применена, и именно эту возможность закрывает фаза overlap).
\set ON_ERROR_STOP on
\set QUIET on
create or replace function t_assert(cond boolean, msg text) returns void language plpgsql as $$ begin if not coalesce(cond,false) then raise exception 'ASSERT FAILED: %', msg; end if; end $$;
select t_assert(rewards_phase() = 'live', 'precondition: live');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000fd001', 'ctl@x.test');
insert into profiles (id, target_language, native_language, xp) values ('00000000-0000-0000-0000-0000000fd001', 'en', 'ru', 100);
select set_config('t.read', (select xp from profiles where id = '00000000-0000-0000-0000-0000000fd001')::text, false);   -- старый прочитал 100
select award_xp('00000000-0000-0000-0000-0000000fd001', 'lesson_complete', 'ctl', 20, null);                              -- новый начислил: 120
update profiles set xp = current_setting('t.read')::int + 1 where id = '00000000-0000-0000-0000-0000000fd001';           -- старый записал устаревшее: 101
select t_assert((select xp from profiles where id = '00000000-0000-0000-0000-0000000fd001') = 101, 'control: the stale write overwrote the live award');
select t_assert((select sum(amount) from xp_events where user_id = '00000000-0000-0000-0000-0000000fd001') = 20, 'control: the ledger still has it — which is why live must not coexist with the old writer');
\echo LIVE STALE-WRITE CONTROL PASSED
