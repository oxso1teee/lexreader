# M0 — Push и Cron

## Компоненты — CONFIRMED

| Компонент | Файл | Заметки |
|---|---|---|
| Service worker | найден через `register-service-worker.tsx` (PWA) | Отдельно от push-логики — общий SW для offline/PWA |
| Push subscription | `push_subscriptions` (таблица), сохраняется через `settings/actions.ts` (`savePushSubscription`) | |
| Notification permission | клиентский запрос браузера, не проверялся отдельно в этом проходе | NEEDS VERIFICATION — какой именно UI просит разрешение |
| Reminder settings | `preferred_notify_hour` на `profiles`, вычисляется `computePreferredHour()` при первом запуске | Автоматически, не ручная настройка пользователем |
| Cron endpoint | `src/app/api/cron/push-reminders/route.ts` | `GET`, требует `Authorization: Bearer CRON_SECRET` |
| Расписание | `.github/workflows/push-reminders.yml`, `cron: "0 * * * *"` (каждый час) | **Не Vercel Cron** — обходит ограничение Hobby-плана (макс. раз в сутки) внешним GitHub Actions расписанием, дёргающим тот же защищённый эндпоинт |
| Shared secret | `CRON_SECRET`, передаётся как `secrets.CRON_SECRET` в workflow | Auth-проверка защищена от "Bearer undefined"-бага (явная проверка `!process.env.CRON_SECRET`) |
| Timing | UTC-часы, мода по `review_log.reviewed_at` за последние 200 записей, дефолт 19:00 UTC при <10 сэмплов | Не учитывает часовой пояс пользователя явно — это UTC-час активности, что косвенно соответствует локальному времени только если пользователь всегда активен в одном поясе |
| Timezone | NEEDS VERIFICATION — нет явного поля `timezone` на `profiles`, используется чистый UTC-час | Потенциальная неточность для пользователей, которые путешествуют/меняют пояс |
| Deduplication | CONFIRMED | Максимум один пуш в сутки на пользователя — проверка `last_active_date` + совпадение `currentHour === preferredHour` |
| Retry | НЕТ явного ретрая при неудачной отправке (кроме удаления мёртвых подписок) | Одна попытка `sendPush` на подписку за прогон крона |
| Unsubscribe | CONFIRMED, двух видов | (1) автоматически при `404`/`410` от push-сервиса — подписка удаляется; (2) вручную — `deleteAllPushSubscriptions()` в `settings/actions.ts`, удаляет **все** подписки владельца, не только с текущего устройства (P0-фикс, задокументирован в коде — раньше кнопка "Отключить" на одном устройстве не трогала подписку, сделанную с телефона) |
| Ошибки не 404/410 | CONFIRMED залогированы | `log.error({kind: "push_send", ...})` — раньше молча проглатывались (P0-АУДИТ фикс) |

## Что НЕ найдено / не проверялось

- Novu или любой другой notification-оркестратор — не установлен
  (в соответствии с явным запретом задания).
- Явного UI для настройки часа уведомлений вручную не найдено —
  час вычисляется автоматически, у пользователя нет управления им
  напрямую (NEEDS VERIFICATION — возможно, есть переключатель
  включить/выключить в Settings, но не найден отдельный контрол
  времени).
