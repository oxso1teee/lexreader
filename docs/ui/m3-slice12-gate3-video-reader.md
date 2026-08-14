# M3 Slice 12 — Gate #3: Video Reader

## What changed

`/watch/[textId]` is rebuilt in place as a real learning-focused Video
Reader, reusing Reader v2's exact word/phrase interaction surface instead of
building a second one:

- `src/app/watch/[textId]/watch-player.tsx` — full rewrite. Real YT IFrame
  Player with a proper `onReady`-gated lifecycle (the old version started
  polling `getCurrentTime()` on a bare timer with no readiness guarantee —
  a real, previously-undetected race), `onError` mapped to honest failure
  copy (deleted/private video, embedding disabled, HTML5 player error),
  binary-search active-segment lookup, non-fighting auto-scroll (a manual
  scroll disables auto-follow until the user taps "Вернуться к текущей
  строке"), click-or-Enter/Space-to-seek per segment via a dedicated,
  properly-sized (`min-h-11 min-w-11`) timestamp button — not the old
  `div[role=button]`-wrapping-`button` anti-pattern — word tap and
  long-press phrase selection reusing the exact `ReaderWordPanel` component
  and gesture code Reader v2 already uses (desktop side panel + mobile
  bottom sheet, same component, same callbacks), and resume via
  `text_progress.last_page_index` reused as "caption segment index" (the
  same convention the pre-Gate-#3 Watch Mode already established).
- `src/app/watch/[textId]/page.tsx` — loads `text_progress` and the same
  flashcard-linked `wordLevels` join Reader v2's `page.tsx` already does
  (learning_state, deck_id, context count), plus the new `texts` columns
  (`youtube_duration_seconds`, `transcript_source`, `processing_status`).
- `src/lib/video-reader/segment-lookup.ts` (new) — pure, unit-tested
  helpers: `findActiveSegmentIndex` (binary search, ignores `endMs` so gaps
  and malformed timing never break it), `clampResumeIndex`,
  `formatTimestamp`. 17 tests, `src/lib/video-reader/segment-lookup.test.ts`.

## Timestamp context — schema decision

`vocabulary_contexts.source_type` (migration 0041) only allowed
`'reader' | 'manual' | 'import'` and had no timestamp column — captured
"where this word came from" but not "at what second". Migration 0043 adds
one nullable `vocabulary_contexts.source_timestamp_ms integer` column and
widens the `source_type` check to add `'video'`. Additive only, matching
0033/0042's pattern: every existing row is unaffected, no backfill.

`upsertWord`/`addPhraseToDefaultDeck` (`src/app/read/[textId]/actions.ts`)
gained one new optional field, `sourceTimestampMs`, threaded through
`saveVocabularyItem`/`findOrCreateFlashcard` down to the `vocabulary_contexts`
insert. `source_type` is derived (`'video'` when a timestamp is present,
else the existing `'reader'`/`'manual'` logic) — no new parameter needed,
and Reader v2's own callers are unaffected since they never pass a
timestamp. **No new save function was written** — Video Reader calls the
exact same `upsertWord`/`addPhraseToDefaultDeck`/`findOrCreateFlashcard`
Reader v2 uses.

## Real evidence (this session, real browser extension, real YouTube, local Supabase)

A fresh Playwright-driven Chromium loaded the actual unpacked extension
(`browser-extension/`), logged into a fresh local test account, and drove
the real `/library/new` → YouTube tab → bridge-extract → import → redirect
→ Video Reader flow twice:

| Video | Segments | Click-seek | Word tap | Phrase select+save | Resume after reload |
|---|---|---|---|---|---|
| `jNQXAC9IVRw` ("Me at the zoo", 19s) | 6 | ✅ row highlighted active | ✅ "All"→"Все" saved | ✅ "All right" saved as phrase | ✅ segment 2 still active |
| `aircAruvnKk` (3Blue1Brown, 18.7min) | 267 | ✅ row highlighted active | see below | — | ✅ segment 2 still active |

Database confirmation (`vocabulary_contexts`, owner = the test account):

```
context_text                                          | source_type | source_timestamp_ms | front      | item_type
All right, so here we are, in front of the elephants  | video       | 1200                 | All        | word
All right, so here we are, in front of the elephants  | video       | 1200                 | All right  | phrase
```

`text_progress.last_page_index` was `2` for both texts after reload,
confirming resume works for both a 6-segment and a 267-segment transcript.

**Second video's word-tap showed a translation error, by design, not a
regression.** This video's captured transcript language is Russian (the
already-disclosed Gate #2C language-targeting limitation — the extension
sometimes can't force a specific caption language), and the test account's
native language is also Russian, so `/api/translate` was asked to
translate ru→ru, which the MyMemory API correctly rejects (502). The
Video Reader's error-state UI handled it exactly as designed: an inline
error message plus a manual-translation fallback input, no blank screen,
no raw error text, and — confirmed via `vocabulary_items` — no partial or
corrupt write reached the database.

Scripts: `research/youtube-transcript/gate3-setup-test-user.mjs` (test
account provisioning), `gate3-e2e.mjs` (the real end-to-end run above),
`gate3-debug-player.mjs` (used once to diagnose a test-script selector bug,
not a product bug — see below).

## One real bug found and fixed during this session (test tooling, not product)

The end-to-end script's own `#yt-player iframe` selector never matched.
Diagnosed live: the YouTube IFrame API doesn't insert an `<iframe>` *inside*
`#yt-player` — it replaces the target element itself, keeping the same
`id`. Fixed the *test script's* selector to `iframe#yt-player`. No
application code was involved.

## Scope calls

- **No new test framework.** This repo's entire test suite (340 tests
  across `test:ui`) is pure-function `node:test`, zero DOM/component
  testing anywhere (no jsdom/Testing Library dependency exists). Rather
  than introduce one just for this slice, the testable logic was extracted
  into `segment-lookup.ts` (17 unit tests covering active-line lookup,
  boundary timestamps, resume clamping, and malformed/empty transcripts)
  and the DOM-dependent behavior (click-seek, word tap, phrase drag-select,
  resume) was verified via the real end-to-end browser run above instead.
- **Full-list transcript rendering, not the old 5-line window.** The
  pre-Gate-#3 Watch Mode only ever rendered `activeIndex ± a few` lines,
  which meant a viewer could never freely scroll the transcript. Video
  Reader renders the whole list (proven up to 267 real segments this
  session) with memoized tokenization; virtualization was deliberately not
  added since nothing here showed a real need for it yet.
