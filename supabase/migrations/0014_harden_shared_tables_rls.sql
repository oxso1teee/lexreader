-- P0-АУДИТ 3.1: "translations_cache: authenticated write" (insert to
-- authenticated with check (true)) позволяла любому пользователю вставить
-- произвольный "перевод" для любого слова — из-за ignoreDuplicates в коде
-- приложения первая вставленная строка побеждает навсегда. Запись в общий
-- кэш теперь только через service_role (см. src/app/api/translate/route.ts).
drop policy if exists "translations_cache: authenticated write" on translations_cache;
revoke insert, update, delete on translations_cache from authenticated;

-- P0-АУДИТ 3.2: "translate_requests: owner full access" (for all) включала
-- delete — пользователь мог сам стереть свою историю рейт-лимита и слать
-- запросы без ограничения. Таблица лимита теперь полностью управляется
-- service_role (тот же паттерн, что уже был правильно сделан для
-- auth_attempts в 0011_auth_rate_limit.sql).
drop policy if exists "translate_requests: owner full access" on translate_requests;
revoke select, insert, update, delete on translate_requests from authenticated;
