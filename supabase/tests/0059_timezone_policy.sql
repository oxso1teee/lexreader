-- Iteration 6, 0059 (EXPAND): политика смены часового пояса — допустимые имена и антидребезг в 1 час.
-- Первая установка не ограничена и отметку не ставит. Работает ПОСЛЕ 0059 (триггер profiles_guard_timezone).
-- Запуск: run-local.sh.
\set ON_ERROR_STOP on
\set QUIET on
create or replace function t_assert(cond boolean, msg text) returns void language plpgsql as $$ begin if not coalesce(cond,false) then raise exception 'ASSERT FAILED: %', msg; end if; end $$;
grant execute on function t_assert(boolean,text) to authenticated, anon, service_role;

-- Смена пояса от имени клиента; возвращает 'ok' или причину отказа.
create or replace function try_tz(p_user uuid, p_tz text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  set local role authenticated;
  begin
    update profiles set timezone = p_tz where id = p_user;
    reset role;
    return 'ok';
  exception when others then
    reset role;
    return sqlerrm;
  end;
end $$;
-- «С последней смены прошло N минут» (под суперпользователем)
create or replace function age_tz(p_user uuid, p_minutes int) returns void language sql as $$
  update profiles set timezone_changed_at = now() - make_interval(mins => p_minutes) where id = p_user;
$$;
create or replace function tz_of(p_user uuid) returns text language sql as $$ select timezone from profiles where id = p_user $$;
create or replace function stamp_of(p_user uuid) returns timestamptz language sql as $$ select timezone_changed_at from profiles where id = p_user $$;

insert into auth.users (id, email) select ('00000000-0000-0000-0000-00000000f1' || lpad(i::text, 2, '0'))::uuid, 'tzp' || i || '@x.test' from generate_series(1, 8) i;
insert into profiles (id, target_language, native_language) select id, 'en', 'ru' from auth.users where email like 'tzp%@x.test';

-- 1. Первая установка — сразу, без задержки и без отметки; ошибку первой синхронизации можно исправить тут же.
select t_assert(try_tz('00000000-0000-0000-0000-00000000f101', 'America/New_York') = 'ok', 'first set accepted');
select t_assert(stamp_of('00000000-0000-0000-0000-00000000f101') is null, 'first set does not start a cooldown');
select t_assert(try_tz('00000000-0000-0000-0000-00000000f101', 'Europe/Moscow') = 'ok', 'immediate correction of the first set accepted (no artificial delay)');
select t_assert(tz_of('00000000-0000-0000-0000-00000000f101') = 'Europe/Moscow', 'corrected');
select t_assert(stamp_of('00000000-0000-0000-0000-00000000f101') > now() - interval '1 minute', 'a CHANGE of an existing timezone starts the debounce');

-- 2. Антидребезг: следующая смена раньше чем через час — отказ с понятной причиной; через час — можно.
select t_assert(try_tz('00000000-0000-0000-0000-00000000f101', 'Asia/Tokyo') = 'timezone_change_too_frequent', 'second change within an hour refused');
select t_assert(tz_of('00000000-0000-0000-0000-00000000f101') = 'Europe/Moscow', 'timezone unchanged after the refusal');
select age_tz('00000000-0000-0000-0000-00000000f101', 59);
select t_assert(try_tz('00000000-0000-0000-0000-00000000f101', 'Asia/Tokyo') = 'timezone_change_too_frequent', '59 minutes is still too soon');
select age_tz('00000000-0000-0000-0000-00000000f101', 61);
select t_assert(try_tz('00000000-0000-0000-0000-00000000f101', 'Asia/Tokyo') = 'ok', 'after an hour the change is accepted');

-- 3. Обычные сценарии без суточной блокировки.
--   перелёт: пояс не менялся давно → сразу;
select try_tz('00000000-0000-0000-0000-00000000f102', 'Europe/Moscow');
select age_tz('00000000-0000-0000-0000-00000000f102', 60 * 24 * 10);
select t_assert(try_tz('00000000-0000-0000-0000-00000000f102', 'Asia/Tokyo') = 'ok', 'long-haul flight: instant');
--   однодневная поездка Москва → Лондон → Москва: через 9 часов возвращение принимается (раньше — отказ на сутки);
select try_tz('00000000-0000-0000-0000-00000000f103', 'Europe/Moscow');
select age_tz('00000000-0000-0000-0000-00000000f103', 60 * 100);
select t_assert(try_tz('00000000-0000-0000-0000-00000000f103', 'Europe/London') = 'ok', 'day trip: outbound');
select age_tz('00000000-0000-0000-0000-00000000f103', 9 * 60);
select t_assert(try_tz('00000000-0000-0000-0000-00000000f103', 'Europe/Moscow') = 'ok', 'day trip: return home the same day is accepted');
--   пересадки с разными поясами в течение дня (Москва → Дубай → Сингапур): с часовым интервалом проходят;
select try_tz('00000000-0000-0000-0000-00000000f104', 'Europe/Moscow');
select age_tz('00000000-0000-0000-0000-00000000f104', 60 * 48);
select t_assert(try_tz('00000000-0000-0000-0000-00000000f104', 'Asia/Dubai') = 'ok', 'connection 1');
select age_tz('00000000-0000-0000-0000-00000000f104', 70);
select t_assert(try_tz('00000000-0000-0000-0000-00000000f104', 'Asia/Singapore') = 'ok', 'connection 2 after an hour');

-- 4. Два устройства с разными поясами: переключение возможно не чаще раза в час (раньше — раз в сутки).
select try_tz('00000000-0000-0000-0000-00000000f105', 'Europe/Moscow');
select age_tz('00000000-0000-0000-0000-00000000f105', 120);
select t_assert(try_tz('00000000-0000-0000-0000-00000000f105', 'UTC') = 'ok', 'phone wins');
select t_assert(try_tz('00000000-0000-0000-0000-00000000f105', 'Europe/Moscow') = 'timezone_change_too_frequent', 'laptop immediately after: refused');

-- 5. Перебор поясов: серия попыток подряд — проходит не больше одной (дальше защищают скользящий лимит и ключи по дате).
select try_tz('00000000-0000-0000-0000-00000000f106', 'Pacific/Pago_Pago');
select age_tz('00000000-0000-0000-0000-00000000f106', 70);
select t_assert((select count(*) from unnest(array['UTC','Pacific/Kiritimati','Pacific/Pago_Pago','Asia/Tokyo','America/New_York','Pacific/Kiritimati']) z where try_tz('00000000-0000-0000-0000-00000000f106', z) = 'ok') = 1, 'a burst of changes yields exactly one accepted change');

-- 6. Имена: только известные PostgreSQL именованные пояса; смещения и мусор отклоняются и при первой установке, и позже.
select t_assert((select count(*) from unnest(array['Mars/Olympus','+03:00','-05:00','x','UTC+3','Europe/Moscow; drop table profiles']) z where try_tz('00000000-0000-0000-0000-00000000f107', z) = 'invalid_timezone') = 6, 'invalid names refused on first set');
select t_assert(tz_of('00000000-0000-0000-0000-00000000f107') is null, 'nothing stored');
select t_assert(try_tz('00000000-0000-0000-0000-00000000f107', 'Etc/GMT+3') = 'ok', 'a named Etc zone is fine (POSIX sign is the same as in IANA/Intl)');
select age_tz('00000000-0000-0000-0000-00000000f107', 200);
select t_assert(try_tz('00000000-0000-0000-0000-00000000f107', '+03:00') = 'invalid_timezone', 'offset refused later too');

-- 7. Запись того же значения и других полей — не смена; сервисная роль не ограничена.
select try_tz('00000000-0000-0000-0000-00000000f108', 'Europe/Moscow');
select age_tz('00000000-0000-0000-0000-00000000f108', 70);
select t_assert(try_tz('00000000-0000-0000-0000-00000000f108', 'Europe/Moscow') = 'ok', 'same value: no change');
select t_assert(stamp_of('00000000-0000-0000-0000-00000000f108') < now() - interval '60 minutes', 'same value does not restart the debounce');
set role service_role;
update profiles set timezone = 'Pacific/Kiritimati' where id = '00000000-0000-0000-0000-00000000f108';
update profiles set timezone = 'Pacific/Pago_Pago' where id = '00000000-0000-0000-0000-00000000f108';
reset role;
select t_assert(tz_of('00000000-0000-0000-0000-00000000f108') = 'Pacific/Pago_Pago', 'service_role is not limited');

\echo TIMEZONE POLICY PASSED
