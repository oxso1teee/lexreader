-- docs/release-2026-08-22/10_VAU_NOVYE_FICHI_I_DIZAYN.md раздел C, Тир 3 —
-- "Расширение браузерного расширения с YouTube на весь интернет". Живой
-- код (browser-extension/) на деле не содержит НИКАКОЙ функциональности
-- тап-по-слову — только YouTube-транскрипт-мост для /library/new. Строим
-- тап-перевод-на-любой-странице как новую фичу с нуля (решение
-- пользователя), а не "расширяем" несуществующий охват.
--
-- Контент-скрипт на произвольном сайте не имеет открытой сессии LexReader
-- (cookie-аутентификация createClient()/supabase.auth.getUser() тут не
-- работает — нет открытой вкладки с залогиненным LexReader), поэтому нужен
-- отдельный, долгоживущий credential — персональный API-токен,
-- сгенерированный один раз на /settings и вставленный в расширение.
--
-- Тот же паттерн, что и push_subscriptions (0003): одна таблица на
-- владельца, RLS на чтение/удаление своих строк. Ключевое отличие —
-- хранится ТОЛЬКО sha256-хэш токена (как GitHub PAT/session token
-- best-practice), plaintext возвращается пользователю один раз в момент
-- создания и никогда больше не читается из БД. Верификация входящего
-- запроса (по заголовку Authorization: Bearer <token>) идёт через
-- service_role (у расширения нет auth.uid() — оно не Supabase-сессия), а
-- RLS-политика ниже защищает только UI на /settings (владелец видит и
-- удаляет свои токены через обычный authenticated-клиент).
create table extension_api_tokens (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  token_hash text not null unique,
  -- Последние 4 символа plaintext-токена — чтобы владелец мог узнать
  -- токен в списке ("...a1b2"), не имея возможности восстановить его
  -- целиком по одной этой колонке.
  token_last4 text not null,
  label text not null default 'Расширение',
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index extension_api_tokens_owner_idx on extension_api_tokens (owner_id);

alter table extension_api_tokens enable row level security;

create policy "extension_api_tokens: owner full access" on extension_api_tokens
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

grant select, insert, update, delete on extension_api_tokens to authenticated;
grant select, insert, update, delete on extension_api_tokens to service_role;

-- Слово/фраза, сохранённые тапом на произвольной странице вне LexReader —
-- не "вручную" (пользователь ничего не печатал) и не "из чтения" (нет
-- textId/text-источника в БД). Расширяем оба существующих CHECK ровно тем
-- же способом, что и 0043 (vocabulary_contexts) — дописываем новое
-- значение, ничего не убирая и не переименовывая.
alter table flashcards drop constraint flashcards_source_type_check;
alter table flashcards add constraint flashcards_source_type_check
  check (source_type in ('reader', 'manual', 'import_bulk', 'starter_deck', 'mission', 'path', 'extension'));

alter table vocabulary_contexts drop constraint vocabulary_contexts_source_type_check;
alter table vocabulary_contexts add constraint vocabulary_contexts_source_type_check
  check (source_type in ('reader', 'manual', 'import', 'video', 'extension'));

-- Найдено вживую при первой реальной проверке api/extension/translate-and-save
-- (тем же способом, что и в 0047_missions_service_role_grants.sql):
-- saveVocabularyItem() под service_role (у расширения нет auth.uid()) дошёл
-- до recordEvidence() → getOrCreateSettings() → "permission denied for
-- table language_twin_settings" — 0036_language_twin.sql грантовал все
-- шесть language_twin_*/language_correction_submissions таблиц только
-- authenticated, ни разу не service_role, потому что до этого эндпоинта
-- ни один вызов saveVocabularyItem() не проходил под service_role.
grant select, insert, update, delete on
  language_twin_profiles, language_error_patterns, language_evidence,
  language_recommendations, language_twin_settings, language_correction_submissions
  to service_role;

-- Тот же пробел, тот же способ находки, для vocabulary_contexts
-- (0041_vocabulary_phrases_v2.sql) — appendContextIfNew() в
-- src/lib/vocabulary/save.ts не бросает исключение на ошибку insert'а
-- (просто возвращает contextAdded: false), поэтому без этого гранта
-- запрос через расширение "успешно" сохранял бы слово, но БЕЗ
-- контекстного предложения — именно то, ради чего эта фича вообще
-- существует ("перевод в контексте"). Найдено тем же живым end-to-end
-- прогоном через curl, что и находка выше.
grant select, insert, update, delete on vocabulary_contexts to service_role;

-- Откат (если понадобится до появления первых расширение-строк):
-- alter table flashcards drop constraint flashcards_source_type_check;
-- alter table flashcards add constraint flashcards_source_type_check
--   check (source_type in ('reader', 'manual', 'import_bulk', 'starter_deck', 'mission', 'path'));
-- alter table vocabulary_contexts drop constraint vocabulary_contexts_source_type_check;
-- alter table vocabulary_contexts add constraint vocabulary_contexts_source_type_check
--   check (source_type in ('reader', 'manual', 'import', 'video'));
-- drop table extension_api_tokens;
