# M0 — Browser Extension (YouTube Bridge)

## Файлы

| Файл | Роль |
|---|---|
| `browser-extension/manifest.json` | Manifest V3, минимальные permissions |
| `browser-extension/background.mjs` | Service worker — вызывает `fetchYoutubeTranscript`, проверяет sender origin |
| `browser-extension/lexreader-bridge.js` | Content script на страницах LexReader — мост window.postMessage ↔ chrome.runtime |
| `browser-extension/youtube-transcript.mjs` | Логика извлечения субтитров со страницы YouTube |
| `browser-extension/youtube-transcript.test.mjs` | 4 юнит-теста |
| `browser-extension/README.md` | Инструкция установки |

## Flow

```
YouTube-страница (не задействована content script'ом напрямую —
  расширение работает через background.mjs, вызываемый со страницы LexReader)
→ страница LexReader (lexreader-bridge.js, content script)
→ window.postMessage("lexreader-web" → LEXREADER_YOUTUBE_TRANSCRIPT_REQUEST)
→ chrome.runtime.sendMessage → background.mjs
→ fetchYoutubeTranscript(url, targetLanguage) — фетчит YouTube watch-страницу
  напрямую из background worker (не с самой YouTube-вкладки)
→ ответ в content script → window.postMessage обратно на страницу
→ src/app/(app)/library/youtube-actions.ts (saveBrowserYoutubeTranscript)
→ валидация (validateBrowserTranscript) → сохранение texts + caption_segments
```

## Проверка безопасности

| Пункт | Статус | Детали |
|---|---|---|
| Permissions | CONFIRMED минимальны | `"permissions": []` — пусто |
| Host permissions | CONFIRMED узкие | Только `youtube.com`/`www.youtube.com` |
| Allowed origins (content script) | CONFIRMED явный allowlist | `lexreader.vercel.app`, `lexreader.app`, `www.lexreader.app`, `localhost:3000`, `127.0.0.1:3000` — задан и в `matches` манифеста, и повторно проверяется в рантайме `lexreader-bridge.js` (`ALLOWED_ORIGINS.has(window.location.origin)`) |
| Message source (page→extension) | CONFIRMED | Проверяется `event.source === window`, `event.origin === window.location.origin`, `message.source === "lexreader-web"` |
| Sender origin (extension→background) | CONFIRMED | `isAllowedSender(sender)` в `background.mjs`, тот же allowlist |
| Schema validation входящего транскрипта | NEEDS VERIFICATION | `validateBrowserTranscript` вызывается в `youtube-actions.ts`, но сама функция не открывалась в этом проходе — не подтверждено, что она проверяет форму каждого сегмента (не только наличие поля) |
| Video ID validation | CONFIRMED (юнит-тест) | `extractVideoId` протестирован на normal/short/Shorts URL формах |
| Transcript size limit | NEEDS VERIFICATION | Не найден явный верхний лимит на количество/размер сегментов при приёме на стороне Next.js — умеренный риск (не критично, т.к. запрос всё равно проходит через `hasFreeTextRoom`, но потенциально большой JSON payload) |
| Replay protection | NEEDS VERIFICATION | `requestId` используется для сопоставления запрос/ответ внутри одной сессии страницы, но не похоже, что где-то проверяется уникальность/одноразовость — низкий риск, так как это локальный мост в пределах одного браузера пользователя, не сетевой протокол между разными сторонами |
| Production domain | CONFIRMED | `lexreader.vercel.app` в allowlist |
| Local dev domain | CONFIRMED | `localhost:3000`/`127.0.0.1:3000` в allowlist — стоит помнить, что это означает: любая **локальная** страница на порту 3000 у любого расширения на машине разработчика теоретически могла бы быть тем, с кем говорит background-скрипт, если бы там был другой процесс на этом порту. Практический риск низкий (локальная машина разработчика), но стоит знать. |

## Тесты

CONFIRMED: `npm run test:extension` — 4 теста, все прошли зелёным в
этом прогоне (`extractVideoId`, `extractCaptionTracks`,
`parseJson3Segments`, `fetchYoutubeTranscript` выбор языковой дорожки).
Нет теста на сам `lexreader-bridge.js`/`background.mjs` (message-passing
слой) — юнит-тесты покрывают только чистую логику извлечения
транскрипта, не браузерный IPC.
