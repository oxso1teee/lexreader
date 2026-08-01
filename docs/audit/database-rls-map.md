# M0 — База данных и RLS

**30 файлов миграций** (`0001`–`0031`, с пропуском `0026` — см.
BLOCKER ниже). **20 уникальных живых таблиц.** CONFIRMED: 100% таблиц
имеют `alter table X enable row level security` где-то в истории
миграций (проверено программно по всем 20 именам таблиц — исключений
не найдено).

## Список миграций по порядку

| Файл | Назначение | Деструктивность |
|---|---|---|
| `0001_init.sql` | Базовая схема: profiles, texts, vocabulary_items, srs_state (vocabulary_item_id), review_log, reading_sessions, subscriptions, translations_cache + первые RLS-политики | нет |
| `0002_word_photos.sql` | Фото на карточках слов | нет |
| `0003_push_subscriptions.sql` | Таблица push-подписок (web-push) | нет |
| `0004_decks.sql` | Колоды/карточки Мозга. **Дропает и пересоздаёт** `srs_state`/`review_log` с ключом `flashcard_id` вместо `vocabulary_item_id` | ДА — drop table (осознанный, до появления реальных пользователей) |
| `0005_word_levels.sql` | 5-уровневая шкала знания слова (0-4) в читалке, отдельно от `status` | нет |
| `0006_text_progress.sql` | Прогресс чтения текста (`text_progress`) | нет |
| `0007_youtube_captions.sql` | `caption_segments` для YouTube Watch Mode | нет |
| `0008_service_role_grants.sql` | GRANT для `service_role` (нужен для cron, обходящего RLS) | нет |
| `0009_translate_rate_limit.sql` | `translate_requests` — лог для rate-limit перевода | нет |
| `0010_stripe_billing.sql` | Расширение `subscriptions` под реальный Stripe (customer_id, price_id и т.д.) | нет |
| `0011_auth_rate_limit.sql` | `auth_attempts` — рейт-лимит попыток входа/сброса пароля | нет |
| `0012_word_photos_upload_limits.sql` | **Security fix**: лимит размера/типа файла на уровне Storage bucket (5 МБ, jpeg/png/webp/gif) — раньше проверка была только клиентская | нет |
| `0013_harden_subscriptions_rls.sql` | **Security fix**: сузил RLS-политику `subscriptions` | нет |
| `0014_harden_shared_tables_rls.sql` | **Security fix (P0-АУДИТ 3.1)**: убрал возможность любого юзера писать произвольный "перевод" в общий `translations_cache` напрямую | нет |
| `0015_vocabulary_language.sql` | Колонка `language` на `vocabulary_items` | нет |
| `0016_srs_first_reviewed_at.sql` | `first_reviewed_at` на `srs_state` | нет |
| `0017_word_photos_private.sql` | Приватность фото-бакета | нет |
| `0018_brain_language.sql` | `language` на decks/flashcards + фильтрация | нет |
| `0019_free_tier_db_backstop.sql` | **Security fix (2-й аудит, находка 9)**: триггеры на уровне БД, дублирующие лимиты бесплатного тарифа — RLS insert проверял только владение, не количество, что позволяло обойти лимиты прямым PostgREST-запросом с украденным anon key+JWT | нет |
| `0020_collections.sql` | Сборники (многочастные тексты) | нет |
| `0021_starter_decks.sql` | Стартовые колоды (NGSL) | нет |
| `0022_vocabulary_favorite.sql` | Флаг «избранное» на слове | нет |
| `0023_first_win_flag.sql` | `completed_first_win` на `profiles` | нет |
| `0024_seed_library_content.sql` | Сид системных текстов (owner_id null), 19 авторских историй A1-B2 | нет (только insert) |
| `0025_engagement_layer.sql` | Достижения, недельный квест, заморозка стрика | нет |
| `0027_notify_hour.sql` | Персональный час уведомлений | нет |
| `0028_link_reading_words_to_brain.sql` | Связывает `vocabulary_items`↔`flashcards`, слово из чтения создаёт карточку в SRS | нет |
| `0029_language_waitlist.sql` | Лист ожидания языков вне EN | нет |
| `0030_xp_system.sql` | `xp` на `profiles` | нет |
| `0031_feedback.sql` | Форма обратной связи | нет |

**BLOCKER (NEEDS VERIFICATION → скорее всего не блокер, но требует
подтверждения владельца):** файл `0026` отсутствует в последовательности
(прыжок `0025` → `0027`). Это может быть: (а) намеренный пропуск
(миграция была создана и откачена до применения где-либо), (б)
файл, который существовал только локально и не был закоммичен. Раз
локальная БД и прод оба доехали до `0031` без ошибок (см.
`test-gap-map.md` — вся E2E-сессия проходит), пропуск не блокирует
работу, но по правилам аудита это нужно явно подтвердить у владельца
проекта, а не тихо считать нормальным.

## Карта таблиц

| Таблица | Назначение | PK | Owner-связь | RLS | Политики (кратко) | Риск |
|---|---|---|---|---|---|---|
| `profiles` | Профиль пользователя (язык, уровень, streak, xp, флаги) | `id` (=auth.uid()) | сама себе owner | ДА | full access `id = auth.uid()` | низкий |
| `texts` | Тексты для чтения (свои + системные `owner_id null`) | `id` | `owner_id` nullable | ДА | select: own OR system; write/update/delete: own only | низкий |
| `text_progress` | Прогресс чтения | составной | `owner_id` | ДА | own only | низкий |
| `vocabulary_items` | Слова из чтения (Тетрадь) | `id` | `owner_id` | ДА | own only | низкий |
| `decks` | Колоды карточек | `id` | `owner_id` | ДА | full access own | низкий |
| `flashcards` | Карточки (слово/фраза) | `id` | `owner_id` | ДА | full access own | низкий |
| `srs_state` | Состояние повторения (ease/interval/reps/due) — ключ `flashcard_id` | `flashcard_id` | через `flashcards.owner_id` | ДА | через связь с flashcards | низкий |
| `review_log` | История оценок повторения | `id` | через `flashcard_id` | ДА | через связь | низкий |
| `srs_settings` | Настройки SRS на пользователя (learning/relearning steps, лимиты) | `owner_id` | `owner_id` | ДА | own only | низкий |
| `reading_sessions` | Сессии чтения (метрики) | `id` | `owner_id` | ДА | own only | низкий |
| `subscriptions` | Статус подписки (Stripe) | `owner_id` | `owner_id` | ДА (ужесточено в 0013) | select own; **write только через service_role** (иначе юзер мог бы сам себе выставить `status=active`) | средний — критично, что write запрещён для authenticated, стоит перепроверить после любых будущих миграций этой таблицы |
| `push_subscriptions` | Web-push подписки устройств | `id` | `owner_id` | ДА | own only | низкий |
| `translate_requests` | Лог для rate-limit перевода | `id` | `owner_id` | ДА (только service_role пишет, см. 0014) | insert/select только service_role | низкий |
| `translations_cache` | Общий кэш переводов (не per-user) | составной | нет (общий) | ДА | select всем authenticated; write только service_role (fix 0014) | низкий, уже пофикшен |
| `auth_attempts` | Рейт-лимит входа/сброса пароля | `id` | по email/IP, не по user | ДА | только service_role | низкий |
| `caption_segments` | Сегменты субтитров YouTube | `id` | через `text_id`→`texts.owner_id` | ДА | через связь | низкий |
| `collections` | Сборники (многочастные тексты) | `id` | `owner_id` | ДА | own only | низкий |
| `user_achievements` | Достижения пользователя | составной | `owner_id` | ДА | own only | низкий |
| `language_waitlist` | Лист ожидания для языков вне EN | `id` | нет (anon insert) | ДА | insert-only для anon+authenticated | низкий — по конструкции публичная форма |
| `feedback` | Обратная связь из Настроек | `id` | `owner_id` | ДА | insert-only own | низкий |

## IDOR-паттерны (запрос только по `id` без проверки владельца)

CONFIRMED: не найдено ни одного явного случая, где серверный код делает
`.eq("id", x)` без последующей проверки через RLS (все таблицы имеют
RLS, включённый по умолчанию для клиента через `createClient()` с anon
key — то есть даже пропущенная проверка владельца в коде приложения
всё равно упёрлась бы в RLS на уровне Postgres). Отдельно стоит
`createServiceClient()` (обходит RLS полностью) — используется в:
`src/app/api/webhooks/stripe/route.ts`, `src/app/api/translate/route.ts`
(rate-limit таблица), `src/app/api/cron/push-reminders/route.ts`,
`src/app/(app)/settings/delete-account-actions.ts`. Во всех проверенных
местах service-client-запросы либо не принимают `owner_id`/`user_id` от
клиента напрямую (Stripe webhook берёт его из подписанного Stripe
payload, cron перебирает всех пользователей намеренно), либо берут его
из `supabase.auth.getUser()` на этом же запросе — NEEDS VERIFICATION
только для полной уверенности, что нигде `service_role` не принимает
`ownerId`/`userId` как параметр формы от клиента без сверки с сессией
(беглый просмотр не нашёл таких мест, но не является формальным
построчным аудитом всех вызовов `createServiceClient()`).
