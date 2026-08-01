# M0 — Reader и Library: типы импорта

| Тип | UI-маршрут | Компонент | Server action/API | Библиотека | Лимиты | Владение | Тест |
|---|---|---|---|---|---|---|---|
| Текст (вставка) | `/library/new` | `new-text-form.tsx` | `library/actions.ts` | — | `FREE_TEXT_LIMIT` (бесплатный тариф) | `owner_id` при insert | косвенно |
| URL-статья | `/library/new` | `url-import-form.tsx` | `library/actions.ts` (`createTextFromUrl` — точное имя не проверялось) | `@mozilla/readability` + `linkedom` (не jsdom — см. BLOCKER истории проекта, jsdom ломался ESM-ошибкой в проде) | пагинация до `MAX_PAGINATED_PAGES`, суммарная длина до `MAX_ARTICLE_BODY_LENGTH`, `PAGINATION_TIME_BUDGET_MS` | `assertPublicUrl`/`fetchPublicUrl` (SSRF-guard, см. ниже) | НЕТ прямого e2e |
| YouTube (браузерный мост) | `/library/new` | `youtube-import-form.tsx` | `library/youtube-actions.ts` (`saveBrowserYoutubeTranscript`) | расширение-браузер передаёт готовый транскрипт | лимит текста (`hasFreeTextRoom`) | через `requireProfile()` | НЕТ прямого e2e |
| YouTube (серверный фетч) | `/library/new` | тот же | `library/youtube-actions.ts` (`createTextFromYoutube`, `fetchWatchPage`) | опционально ScraperAPI (см. `SCRAPERAPI_KEY`) | то же | то же | НЕТ |
| PDF | `/library/new` | `pdf-import-form.tsx` | — (уточнить точный action, не открывался в этом проходе) | `pdfjs-dist` | `MAX_PDF_SIZE_BYTES` = 20 МБ + серверный лимит Storage bucket | через `requireProfile()` | НЕТ |
| Фото/OCR | `/library/new` | `photo-import-form.tsx` | — | `tesseract.js` + `ocr-lang-map.ts` | `MAX_IMAGE_SIZE_BYTES` = 5 МБ (клиент) + 5 МБ Storage bucket лимит (сервер, миграция `0012`) | через `requireProfile()` | НЕТ |
| Карточки CSV/TSV/JSON | Мозг → `import-modal.tsx` | — | `src/lib/import-cards.ts` | собственный парсер | — | — | ДА — `src/lib/import-cards.test.ts`, 6 юнит-тестов (CSV/TSV/JSON, дедупликация, отклонение phrase-only JSON, отклонение сохранённого HTML вместо кода) |

## SSRF-защита (URL-импорт) — CONFIRMED, хорошо реализовано

`src/lib/ssrf-guard.ts`:
- Резолвит хост в реальный IP через `dns.lookup(..., {all: true})` —
  не доверяет строке хоста (закрывает DNS rebinding).
- Блокирует приватные диапазоны IPv4 (`10.x`, `127.x`, `169.254.x`,
  `172.16-31.x`, `192.168.x`, `0.x`) и IPv6 (`::1`, `fe80:`, ULA
  `fc00::/7`, `::ffff:`-мапленные IPv4).
- **Повторно проверяет каждый redirect hop** (до 5) вручную
  (`redirect: "manual"`, не `"follow"`) — закрывает конкретно
  найденную ранее дыру (P0-АУДИТ 3.4): сайт мог отдать 302 на
  внутренний адрес и обойти проверку, если бы `fetch` сам следовал
  редиректам.

Единственное, что НЕ проверялось в этом проходе: поведение при
IPv6-адресах с zone id (`fe80::1%eth0`) и при DNS, возвращающем и
публичный, и приватный адрес одновременно (round-robin) — код,
похоже, проверяет **все** адреса из `lookup`, что корректно, но не
запускал живой тест этого сценария.

## Валидация загружаемых файлов

CONFIRMED двухуровневая: клиентская (`file-validation.ts`, явно
подписана как "только UX, не защита") + серверная (Storage bucket
`file_size_limit`/`allowed_mime_types`, миграция `0012`). Комментарий
в коде прямо объясняет, зачем нужен второй уровень — обход через
прямой вызов Storage API. Это правильная модель угрозы.

## Санитизация

NEEDS VERIFICATION: не нашёл отдельного явного HTML-санитайзера для
текста статьи после `Readability.parse()` — `linkedom` парсит HTML в
DOM, `article.textContent` берёт только текст (не innerHTML), что
само по себе исключает XSS через импортированный контент (текст, не
разметка, рендерится в React как строка, не `dangerouslySetInnerHTML`).
Не проверялось, есть ли где-то `dangerouslySetInnerHTML` в читалке —
если только текстовый контент, риска нет по конструкции; если где-то
рендерится сырой HTML источника — стоит проверить отдельно.

## Таймауты

CONFIRMED: `fetchPublicUrl` использует `AbortSignal.timeout(10_000)`
для URL-импорта. YouTube watch-page fetch — не проверялся на предмет
таймаута в этом проходе.
