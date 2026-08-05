# M3 Unified UI — Slice 3: Library + Add Material + Reader

Status: **in progress**. This document is the durable source of truth for Slice 3 — read this first if resuming the work in a new session, before re-deriving anything from chat history.

## 1. Approved artifact

https://claude.ai/code/artifact/38e41925-8d00-41dc-93d3-c55fdb7e6268

Approved in full by the user on 2026-08-03 ("ARTIFACT ОДОБРЕН"). Treated as the visual contract for Slice 3 — structure, spacing, and component shapes should match it; deviations require a real technical reason, documented inline where they occur.

## 2. Approved palette

Dark forest green primary, replacing caramel as the primary/action accent **for Library, Add Material, and Reader only**. Today/Progress/Settings keep their existing caramel-primary tokens unchanged in this PR — new tokens are additive, not a replacement of `--color-primary`.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--color-forest` | `#1f4d3b` | `#3f8a68` | primary action (buttons, active chips/tabs, progress fill, links) |
| `--color-forest-deep` | `#163a2c` | `#2c6b4f` | hover/pressed |
| `--color-forest-tint` | `#e4ede7` | `#16281f` | active-state background, badges |
| `--color-forest-tint-strong` | `#cfe0d6` | `#1c3427` | selection highlight |

Contrast verified (sRGB-linearized, same methodology as prior slices): `#1f4d3b` gives ~9.6:1 as white-text-on-green and ~8.6:1 as green-text-on-cream — passes AAA both ways, needs no separate "text-safe" variant (unlike caramel, which needed `--color-caramel-text` because raw `#a67c52` only reaches 3.16–3.73:1).

Caramel (`--color-caramel`, unchanged) is kept available as a limited secondary/decorative accent only — not used as a primary action color anywhere in Slice 3's new screens.

## 3. Data/architecture baseline (from artifact-phase audit, re-confirmed before coding)

- Source types: `manual | article_url | youtube | system` only (`src/lib/types.ts`). No distinct PDF/photo type — both funnel into `manual` via client-side extraction (`pdfjs-dist`, `tesseract.js`).
- Library (`src/app/(app)/library/page.tsx`) queries `texts` + `text_progress` + `collections`, scoped to the user's `target_language`. No search/filter UI exists yet.
- Reading progress: `text_progress(owner_id, text_id, last_page_index, percent_read, last_read_at)`, updated on page-index change (`src/app/read/[textId]/actions.ts`).
- Words: `vocabulary_items` (headword, translation, context_sentence, context_translation, level 0-4, source_text_id) — fully working, `source_text_id` correctly populated.
- Phrases: inserted directly into `flashcards`, **bypassing `vocabulary_items`**, via `addPhraseToDefaultDeck()` — **real bug**: omits `context_sentence`/`context_translation`/`source_text_id` even though `flashcards` has had those columns since migration `0028`. Fixed in this Slice (§7).
- Collections: `collections` + `texts.collection_id`/`collection_order` already exist; the Reader has **no chapter navigation UI** today — added in this Slice using existing columns, no schema change.
- Translation: MyMemory (free, keyless) via `src/lib/translate.ts`, cached in `translations_cache` (shared across users, keyed on source/lang pair), rate-limited 30 req/min/user. No LLM/AI-explanation provider exists anywhere in the repo.
- TTS: browser `window.speechSynthesis` only, no server-side/paid TTS anywhere.
- Reader settings (font size, line-height, theme): `localStorage` only (`lexreader_reader_prefs`), deliberately device-local, no `profiles` JSON column exists to reuse for account-sync (confirmed: `Profile` type in `src/lib/types.ts` has no JSON/preferences field).
- No persistent "processing" status exists for imports — creation is synchronous request/response.

Full detail in the artifact-phase audit (already delivered in chat, not duplicated here — see this doc's §6 for what's deferred and why).

## 4. Scope categories (from the artifact's own legend) → what happens to each this Slice

| Category | Meaning | This Slice |
|---|---|---|
| ✅ работает | Already functional | Re-skinned into new design, kept working (tap-translate, phrase select, 5-level scale, save word, mark-known, TTS via browser) |
| 🟡 частично | Partial | Browser TTS pronunciation (device-dependent) — kept honest, no upgrade promised |
| 🔧 нужен UI | Needs frontend work, no schema | Library search/filter/covers, chapter navigation, Focus mode, Parallel mode (uses existing translation infra), phrase-context fix, keyboard nav |
| 🛠 нужен backend | Needs new server logic, no schema | (folded into "нужен UI" items above — all achievable without new tables) |
| 🧱 нужна schema | Needs a migration | Persistent processing status; reader-settings account sync — **both gated on one user confirmation before Production migration, see §8** |
| 🚫 вне Slice 3 | Out of scope | Listening mode ships as browser-TTS-only (no paid TTS, no schema) — this is the honest ceiling, not deferred further |

## 5. What ships this Slice (implemented for real, not decorative)

- **Library**: header + real material count, client-side debounced search (title + type label, URL-reflected via `?q=`, never sent to PostHog), filter chips mapped onto real fields (Все / Тексты = manual+article_url / Видео = youtube / Книги = has collection_id / Завершённые = percent_read≥100), real saved-word/phrase counts per material, real last-opened, YouTube thumbnail (`i.ytimg.com/vi/{id}/hqdefault.jpg`, free, no key) with graceful fallback, enhanced deterministic gradient+initial cover for everything else, loading skeleton, empty state, no-results state, generic error+retry for the client-side pieces.
- **Add Material**: re-skinned tabs (Текст / Файл / YouTube / Сайт / Транскрипт — transcript reuses the manual-text action, documented as such, not a fake separate mechanism), real validation states, honest client-side pending state during the (still-synchronous) import call, inline error display (no global error boundary), duplicate-submit guard.
- **Reader desktop**: full layout per artifact (breadcrumb, chapter/position, progress, mode tabs, main column, contextual panel), chapter/collection navigation using existing `collection_order`, Focus mode (real, frontend-only — hides panel, widens column), Parallel mode (real — on-demand per-paragraph translation via the existing MyMemory provider + `translations_cache`, chunked, cached, rate-limited, progressive rendering), Listening mode (real — browser Web Speech API, paragraph-tracked play/pause/stop/speed/voice, honest unavailable state on unsupported devices).
- **Phrase save fix**: `addPhraseToDefaultDeck` now persists `context_sentence`/`context_translation`/`source_text_id`, tested.
- **Mobile Reader**: bottom sheet for word/phrase panel, compact header, safe-area padding, 44px touch targets, no horizontal overflow at 390/360.
- **Keyboard navigation**: Escape (close panel / exit Focus), Left/Right (chapter), F (Focus toggle), Space (Listening play/pause when not focused in an input), visible focus throughout — all guarded to not fire while a text input/textarea has focus.
- **Reader settings**: font size, line-height, reading width, theme — kept in `localStorage` for now (explicitly allowed temporary fallback per instructions), account-sync proposed as a migration in §8.
- **Analytics**: the approved event list only, no PII (see §9).
- **Tests**: unit + e2e per §10.

## 6. Deliberately deferred (and why)

| Item | Why deferred | Condition to revisit |
|---|---|---|
| Real cover/thumbnail images for non-YouTube materials | No `og:image`/thumbnail persistence exists; live-fetching per card on every Library render is slow/unreliable and was explicitly deprioritized ("only if safe and already available") | Add a `cover_image_url` column + capture `og:image` at import time (URL articles) — needs schema, propose alongside §8 items if the user wants it in a follow-up |
| Persistent, reload-safe "processing"/"failed" status on Library cards | Import is synchronous today; a real job-status needs a DB column, not just client state | Ship after the §8 migration is approved and applied |
| Reader settings synced across devices/accounts | No JSON preferences column exists on `profiles` | Ship after the §8 migration is approved and applied |
| Studio-quality Listening narration | Would require a paid TTS API — explicitly excluded by instructions | Only if the user later approves a paid provider |
| AI "explain in context" (the pre-existing 💬/📖/✏️ paywall stubs) | No LLM provider exists anywhere in the repo; adding one is a new integration, not a UI redesign | Separate slice, needs its own scoping/budget decision |

## 7. Phrase-context fix (small, high-value, tested)

`src/app/read/[textId]/actions.ts`'s `addPhraseToDefaultDeck()` inserts directly into `flashcards` without `context_sentence`, `context_translation`, `source_text_id` — all three columns already exist (migration `0028`). Fix: populate them from the already-available `popup.sentence`/translation/text id, matching the sibling word-save path (`linkToDefaultDeck` in `src/lib/vocabulary.ts`) that already does this correctly. Covered by a new unit/integration test.

## 8. Schema proposal — STOP POINT (needs one explicit confirmation before Production)

Two small, additive, backward-compatible migrations proposed together (not applied without the user's confirmation):

**a) Persistent import processing status** — add to `texts`:
```sql
alter table texts
  add column processing_status text not null default 'ready'
    check (processing_status in ('pending', 'processing', 'ready', 'failed')),
  add column processing_stage text,
  add column processing_error text,
  add column processing_started_at timestamptz,
  add column processing_completed_at timestamptz;
```
- Default `'ready'` means every existing row is unaffected (backward compatible, no backfill needed).
- Rollback: `alter table texts drop column processing_status, drop column processing_stage, drop column processing_error, drop column processing_started_at, drop column processing_completed_at;`

**b) Reader settings account sync** — add to `profiles`:
```sql
alter table profiles
  add column reader_settings jsonb not null default '{}'::jsonb;
```
- Default `'{}'` — existing rows unaffected, client falls back to `localStorage` defaults when the key is absent from the JSON.
- Rollback: `alter table profiles drop column reader_settings;`

Both will get: local migration + tests run, exact SQL shown again at confirmation time, rollback SQL ready, Production backup plan stated, before touching Production. Everything not dependent on these two migrations proceeds in the meantime per instructions.

## 9. Analytics (no PII)

`library_viewed`, `library_search_used` (fires without the query text), `library_filter_changed` (filter name only), `material_add_started`/`_succeeded`/`_failed` (source type + failure reason enum only), `reader_opened` (text id, not title/body), `reader_mode_changed`, `word_panel_opened`, `phrase_saved`, `word_saved`, `word_marked_known`, `chapter_changed`, `listening_started`, `parallel_mode_opened`, `reader_settings_changed`. Never: email, name, full user id, search text, book content, selected word/phrase, translation, user-supplied source URL.

## 10. Test plan (summary — full list executed, not narrowed silently)

Unit: cover-fallback determinism, search/filter matching logic, phrase-context persistence. E2e: Library search/filter/empty/no-results, Add Material per-source validation + success + error, Reader word/phrase save + phrase-context regression, chapter navigation, Focus/Parallel/Listening mode behavior (Listening asserts graceful unsupported-device fallback rather than assuming every CI runner has speech synthesis), mobile bottom sheet, keyboard shortcuts (with input-focus guard), no horizontal overflow at 360/390, axe a11y scan. Regression: FSRS, SRS, Brain/review, imports, auth, App Shell, Progress, Settings — existing suites re-run, not modified except the phrase-context fix's own coverage.

## 11. Definition of Done

See the task's own §19 — restated here for durability: no decorative dead buttons; Library/Add Material/Reader visually match the artifact; only real data; search/filters/completed-filter/covers work; word+phrase selection, save, already-known, 5-level scale, chapter nav, progress persistence all work; Focus works; Parallel has a real free implementation; Listening works via browser TTS or shows an honest unsupported-device state; reader settings persist (localStorage now, account-sync after §8 approval); mobile bottom sheet, keyboard nav, and all listed states work; tests added; Preview ready; Production untouched until separately approved.

## 12. Log

- 2026-08-03 — Plan created, branch `feature/unified-ui-library-reader` cut from `main` @ `5bf9c9e`.
- 2026-08-05 — Reader rewrite committed (chapter nav, Focus/Parallel/Listening modes, mobile bottom sheet, keyboard shortcuts). Two real bugs found and fixed during verification: (1) `pdf-import-form.tsx` statically imported `pdfjs-dist`, crashing SSR for the whole `/library/new` route (pre-existing, unrelated to this Slice's own changes — fixed with a dynamic import scoped to the file-select handler); (2) `e2e/reading.spec.ts` had a strict-mode locator bug — `ReaderWordPanel` is intentionally mounted twice (desktop `<aside>` + CSS-hidden mobile sheet, invisible to real users/screen readers via `display:none`), but Playwright's text/role queries counted both DOM nodes — fixed by scoping the test's popup locators to the desktop `<aside>`. Also found and fixed a real accessibility bug: the popup's "Закрыть" (✕) button and pronunciation button had no explicit touch-target sizing (measured 13×24px on a 390px viewport, well under the required 44×44px) — fixed with `min-h-11 min-w-11`, along with two header icon buttons (`h-10 w-10` → `h-11 w-11`) and the mode-tab row (`min-h-9` → `min-h-11`) found during the same pass.
  - **Known local-only flake, documented per task instructions (not chased further)**: `reading.spec.ts`'s first navigation assertion (`click → toHaveURL(/\/read\//)`) intermittently exceeds even a widened 15s timeout on this specific dev machine. Root-caused via server logs across ~8 repeated runs: the dev server's RSC response for `/read/[textId]` is consistently fast (1–2s, cold or warm) in every single logged instance, including failing runs — so the stall is client-side, not a compile or server-logic issue. It correlates precisely with measured severe host memory/swap exhaustion (repeatedly observed at ~150-300MB free RAM and swap essentially full, from unrelated processes — Chrome, Claude Desktop, gnome-shell — not from the dev server or Playwright's own Chromium instance). Passed cleanly in isolation multiple times when memory had headroom; failed consistently when swap was exhausted, including immediately after a full dev-server restart (which frees the *server's* memory but not the *system's*, since the other desktop processes are the actual pressure source). Structurally impossible in CI, which runs `next build && next start` (no Turbopack dev compilation, no React StrictMode double-effects) on an isolated runner. Revisit condition: if this reproduces in CI or on a clean machine, treat it as a real regression, not environmental.
