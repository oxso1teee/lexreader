-- service_role должен полностью обходить RLS (это его смысл), но в этой
-- версии Supabase базовые GRANT нужны отдельно от RLS-политик. Раньше
-- грантовали только роли authenticated — service_role никогда не
-- использовался до раздела 9 роадмапа (cron push-уведомления, которым
-- нужен доступ ко всем пользователям без активной сессии).

grant usage on schema public to service_role;
grant select, insert, update, delete on
  profiles, texts, vocabulary_items, srs_state, review_log,
  reading_sessions, subscriptions, translations_cache,
  push_subscriptions, decks, flashcards, srs_settings,
  text_progress, caption_segments
  to service_role;
