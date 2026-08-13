# M3 Slice 11 — Reader v2

## 1. Audit summary (real code, confirmed by reading every file below)

Files inspected: `src/app/read/[textId]/{page,reader,reader-word-panel,reader-settings,reader-prefs,reader-listening,use-keyboard-shortcuts,use-parallel-translation,actions}.tsx|ts`, `src/lib/{vocabulary,types,word-level}.ts`, `src/lib/vocabulary/save.ts`, `src/app/(app)/library/{library-item-card,library-item}.tsx|ts`, `src/app/(app)/brain/vocabulary/[id]/page.tsx`, migrations `0001`, `0006`, `0028`, `0041`, `e2e/reader-library-a11y.spec.ts`.

### 1.1 The central finding: Reader's reading surface still runs on the pre-Slice-10 model

`saveVocabularyItem()` (`src/lib/vocabulary.ts`) dual-writes on every word tap:
1. **`vocabulary_items`** (`headword`/`level` 0-4/`seen_count`/`status`) — the legacy per-word record. This is what `Reader`'s word-highlight colors, the stats bar (Новые/Учу/Знакомые/Знаю), and the word panel's "Уровень знания" 0-4 slider all read (`reader.tsx`'s `levels` state, `WORD_LEVELS` from `src/lib/types.ts`).
2. **`flashcards`** via `linkToFlashcard()` → `findOrCreateFlashcard()` (Slice 10's real service) — creates/reuses the real flashcard, writes `vocabulary_contexts`, and stores the link back as `vocabulary_items.flashcard_id` (this FK column already exists — added in migration `0028_link_reading_words_to_brain.sql`, already backfilled for historical rows).

So every word saved from Reader **does** get a real `flashcards` row with a real `learning_state` — but **Reader itself never reads it**. A word reviewed to `active` in Мозг still shows in Reader tinted by its static, self-reported 0-4 `level` (set only by the user clicking "Уровень знания" buttons, never by actual review evidence). This is the exact "two disagreeing 'known' signals" gap flagged in Slice 10 Phase A's audit (§1.3) and deliberately left untouched by Slice 10 (which only touched Мозг/Vocabulary v2/Missions/Language Twin/Learning Paths/Progress — never Reader's own display).

Phrases already go through `findOrCreateFlashcard()` directly (`addPhraseToDefaultDeck` in `actions.ts`) with no `vocabulary_items` shadow — phrases have no level/color, just a "фраза" tag.

**Consequence for the brief's loop** (`Read → save → context → practice → learning_state → missions/progress/today`): the "learning_state" leg is completely invisible inside Reader today. The user can save a word, go review it to `active` state, come back to the same text — and see zero change. There's also no CTA anywhere in Reader that routes to Practice.

### 1.2 Other confirmed findings

- **Word interaction**: pointer-only. `onPointerDown/Enter/Up` handlers, no `onClick` — a keyboard user can **Tab** to a word button but pressing **Enter/Space does nothing** (native keyboard activation fires `click`, not synthetic pointer events). Confirmed by reading the full handler set in `reader.tsx`; no `onClick` exists anywhere on word buttons.
- **Phrase selection**: long-press+drag (450 ms, boundary-hint toast if crossing a sentence), already routes through the central dedup service. Works; not touched structurally.
- **Context**: dedup already correct (verified live in the Slice 10 release pass — repeat taps never create a duplicate `vocabulary_contexts` row for the same sentence). Reader's panel shows only "Уже изучается [— новый контекст сохранён]" — no context *count*, no link to see them.
- **Reading progress**: `text_progress` (owner_id, text_id, last_page_index, percent_read, last_read_at) — race-guarded (never regresses a concurrently-advanced index), resumes correctly via `initialPageIndex`. Solid, no changes needed.
- **Navigation**: Library link, breadcrumb, chapter prev/next (via `collection_id`/`collection_order`, no schema change), keyboard shortcuts (←/→ page or chapter, F focus, Space play/pause, Esc). No quick link *from* Reader to `/brain/vocabulary` — has to leave via Library/nav. No "resume where I left off" issue since `text_progress` already makes returning to `/read/[textId]` resume correctly.
- **Settings**: font size (15-24px), line height (1.5-2.2), width (narrow/wide), theme (paper/sepia/dark). Synced to `profiles.reader_settings` + localStorage fallback. Already minimal and complete — no font-family option, and none is warranted.
- **Listening**: real browser `speechSynthesis` only, honestly labeled ("не студийная запись"), whole-page sentence-by-sentence auto-advance with rate control. Word-level TTS exists (🔊 in the word panel). No isolated "read just this sentence" outside Listening mode.
- **Library integration**: already solid — `LibraryItemCard` shows title, type icon/thumbnail, language, percent-read progress bar, saved words+phrases count, last-read date, and a state-aware CTA ("Начать"/"Продолжить →"/"Перечитать"). No changes needed.
- **Mobile**: bottom sheet reuses the same `ReaderWordPanel`; word buttons use `touch-none select-none` + `[-webkit-touch-callout:none]` (already handles the "no accidental native text-selection" concern). Min 44px (`min-h-11`) touch targets throughout.
- **Accessibility**: existing axe tests pass (desktop/mobile, panel open) and there's an Escape-closes-panel test — both must keep passing. The keyboard-activation gap above is real and previously untested (the existing keyboard test only checks Escape, not Enter-to-open).
- **Performance**: pages capped at ~260 words (`WORDS_PER_PAGE`), translation requests already cached+rate-limited+concurrency-capped (3 at a time). `tokenizeSentence()` is called three separate times per page (pagination, render, phrase-extraction on pointer-up) — cheap at this page size but easy to memoize once.

## 2. Reader v2 scope (concrete, real implementation)

**Centerpiece — the Practice Bridge (brief §2/§9), no schema change:**
- Extend `page.tsx`'s query: for every `vocabulary_items` row (already fetched for `wordLevels`), also join its linked `flashcards` row (`vocabulary_items.flashcard_id` FK, already populated) for `learning_state`, `deck_id`, and a `vocabulary_contexts` count — same join pattern already used in `/brain/vocabulary/[id]/page.tsx`.
- Thread `learningState`, `flashcardId`, `deckId`, `contextCount` through `Reader` → `ReaderWordPanel`.
- New shared label map `src/lib/vocabulary/learning-state-label.ts` (extracted from `detail-view.tsx`'s local `LEARNING_STATE_LABEL`, reused by both) — avoids duplicating the Russian copy.
- Word/phrase panel, once saved: show learning-state chip, context count, and a **"Практика"** button routing to `/brain/{deckId}/review?wordIds={flashcardId}` (the exact targeted-session mechanism already used by Missions/Vocabulary detail).
- Same treatment for phrases (currently they get none of this).

**Word interaction fix (brief §2, accessibility §12):**
- Add `onClick` fallback to word/phrase buttons so Enter/Space (native keyboard button activation) triggers the same simple single-word lookup a tap-without-drag does. Long-press-drag phrase selection stays pointer-only (inherently a gesture) but every word remains keyboard-openable.

**Navigation (brief §6, no new top-level nav item):**
- Small "Словарь" link inside the Reader header (next to Library breadcrumb) to `/brain/vocabulary` — Reader's own position is already preserved via `text_progress`, so no extra state to carry.

**Performance (brief §13, "fix obvious issues" only):**
- Memoize `tokenizeSentence()` per page (`useMemo` keyed on `pageSentences`) instead of recomputing on every popup/selection state change.

**Analytics (brief, matching existing convention):**
- `reader_practice_cta_clicked` event, documented in `docs/ui/analytics-events.md`.

**Explicitly NOT doing** (confirmed already strong or out of stated bounds): reading-surface typography/pagination/themes, phrase-selection gesture mechanics, context dedup logic, reading-progress persistence, chapter navigation, reader settings panel, translation/TTS providers, Library card, app shell/nav, FSRS/SM-2, Stripe/pricing, paid AI, Today.

## 3. Database decision

**No migration needed.** Everything Reader v2 requires already exists:
- `flashcards.learning_state` (migration 0041) — already populated by the existing `linkToFlashcard()` write path.
- `vocabulary_items.flashcard_id` (migration 0028) — already the join key, already backfilled for historical rows.
- `vocabulary_contexts` (migration 0041) — already populated per occurrence.

This is a read-query extension + UI change only. Continuing straight to implementation per the brief's instruction.
