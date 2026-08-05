# M3 Unified UI — Slice 4: Practice / Brain / Review

Status: **in progress**. Durable source of truth for Slice 4 — read this first if resuming in a new session, before re-deriving anything from chat history.

## 1. Approved artifact

https://claude.ai/code/artifact/e7d4eed4-7398-47d5-80a6-1c8790b9b90a

Approved in full by the user on 2026-08-05 ("ARTIFACT ОДОБРЕН") — structure, IA, screens (Practice Home, Review question/answer, Phrase card, Session Complete, Vocabulary Words/Phrases/Decks, Deck Details, Create Deck, Item Details, states, keyboard interactions, status map) and desktop+mobile layouts are the visual/product contract. The artifact went through one correction round: its first version used a forest-green palette copied from Slice 3, which the user explicitly withheld approval on pending verification (see §2) — the palette was corrected to caramel before final approval; everything else from the first version was already approved and untouched by that correction.

## 2. Production design tokens (verified, not assumed)

Verified 2026-08-05 by diffing `src/styles/tokens.css` / `src/app/globals.css` against the live deployed CSS bundle (`curl https://lexreader.vercel.app/_next/static/chunks/*.css`):

```
--color-primary: var(--color-caramel)      /* tokens.css:35 — confirmed live */
--color-caramel: #a67c52                    /* globals.css:14 */
--color-caramel-light: #b08968               /* globals.css:15 */
--color-caramel-text: #7d5d3e (light) / #c79562 (dark)   /* WCAG-AA text-safe variant — raw caramel is 3.16–3.73:1, fails AA text */
--color-forest: #1f4d3b                      /* exists in the bundle but NOT aliased to --color-primary */
```

`tokens.css:60-64` comments the forest tokens as **"additive — used only by Library/Add Material/Reader. Does NOT repoint --color-primary."** Grepping `bg-caramel` across `src/app` (~22 hits) confirms caramel is the actual primary everywhere else: App Shell active-nav state, Today, Progress, Settings, Pricing, error pages, and — critically — the *current* `brain-control-panel.tsx:21` hero card (`bg-gradient-to-br from-caramel to-caramel-light`). Forest is confirmed genuinely scoped to Library/Reader only (Slice 3).

**Rule for this Slice**: use `--caramel` / `--caramel-light` / `--color-caramel-text` / cream background / white cards / existing neutral borders / existing focus ring / existing dark-mode overrides — the same tokens already used by Today/Progress/Settings/App Shell. No new tokens, no separate theme.

## 3. Current architecture audit

### 3.1 Routes (existing, file:line-verified)

| Route | File | Purpose |
|---|---|---|
| `/brain` | `src/app/(app)/brain/page.tsx` | Landing: due-count banner, starter decks, deck list |
| `/brain/[deckId]` | `.../brain/[deckId]/page.tsx` | Deck details, card list, add card, import |
| `/brain/[deckId]/review` | `.../review/page.tsx` | Builds the review queue, hands off to `ReviewModeSwitcher` |
| `/brain/all/review` | same route, `deckId="all"` | Cross-deck review (the actual Practice Home "Учить" target today) |
| `/brain/settings` | `.../brain/settings/page.tsx` | SM-2 parameters, direction, daily limits |
| `/notebook` | `src/app/(app)/notebook/page.tsx` | "Тетрадь" — words saved while reading, `vocabulary_items` |
| `/pricing`, `/paywall` | existing | Upgrade flow, `?reason=` query param |

Sidebar (`src/components/product/app-shell/nav-items.ts:16-21`) already has exactly one nav item pointing at `/brain`, labeled via `messages.appShell.nav.practice` → **"Практика"**. No separate Brain/Decks/Notebook sidebar items exist today — the IA requirement in this brief ("single Практика item, no separate Decks/Notebook items") is **already the current state**, not a change. `/brain` and `/notebook` stay as routes (backward-compat deep links); UI copy becomes "Практика" / "Словарь" / "Мои слова" per this brief.

### 3.2 Database entities (verified against migrations, not assumed)

Two originally-separate systems, now linked:

**`vocabulary_items`** (0001_init.sql, "Тетрадь" — words saved from Reading): `id, owner_id, source_text_id, headword, translation, context_sentence, context_translation, photo_url, status ('new'|'learning'|'known'|'ignored'), language (0015), is_favorite (0022), flashcard_id (0028, nullable FK → flashcards)`. `status` here is the 4-level(+ignored) knowledge state used by the Reader's tap-to-translate popup — **not** the same thing as SRS scheduler state.

**`decks`** (0004_decks.sql): `id, owner_id, name, is_default, language (0018), is_starter (0021)`. **No `description` column** (confirmed: no migration ever adds one).

**`flashcards`** (0004_decks.sql, "Мозг" cards): `id, deck_id, owner_id, front, back, notes, photo_url, language (0018), is_starter (0021), context_sentence, context_translation, source_text_id (all 0028)`. Context/source fields **already exist** — the review query (`page.tsx:14-16`) simply doesn't select them yet (§6.6).

**`srs_state`** (0004_decks.sql, keyed by `flashcard_id`): `ease_factor, interval_days, repetitions, due_at, last_reviewed_at, first_reviewed_at (0016)`, plus FSRS shadow columns `fsrs_stability, fsrs_difficulty, fsrs_state, fsrs_lapses, fsrs_reps, fsrs_scheduled_days` (0032).

**`review_log`** (0004_decks.sql, keyed by `flashcard_id`, no direct `owner_id` — resolved via `flashcards.owner_id` join, same pattern RLS uses): `id, flashcard_id, reviewed_at, grade (0-3)`, plus `scheduler_type ('sm2'|'fsrs'), previous_state_json (jsonb), next_state_json (jsonb)` (0032). **Important nuance for undo, see §3.4.**

**Words vs. phrases: no DB column.** Confirmed via `reader.tsx:390` (`phraseText.includes(" ")`) — "phrase" is purely a client-side classification (contains a space), computed identically wherever needed. The new Vocabulary UI's Words/Phrases tabs must classify the same way, not invent a schema field.

**Reading → SRS bridge** (`src/lib/vocabulary.ts:29-75`, `linkToDefaultDeck`): every word saved from the Reader now *also* creates a `flashcards` row in the user's default deck (best-effort — silently skipped if the free-tier deck/card limit is exhausted, never blocks the Reader save itself). This is the real mechanism behind "reading words enter real SRS" — there is no separate scheduler for `vocabulary_items`.

### 3.3 FSRS / legacy SRS architecture

- **Legacy SM-2** (`src/lib/srs.ts`): grade 0-3 (Again/Hard/Good/Easy), 4-value simplified SM-2. `DEFAULT_SRS_PARAMS` and per-user overrides in `srs_settings`. This is authoritative for `due_at` for essentially all users today.
- **FSRS** (`src/lib/fsrs.ts`, `ts-fsrs` v5.4.1): `Rating` enum starts at `Manual=0` — grade→rating mapped explicitly (`GRADE_TO_RATING`, `fsrs.ts:13-18`) so the same 0-3 grade scale drives both schedulers identically; **no separate rating scale for FSRS in this app**.
- **Rollout gating** (`src/lib/fsrs-flags.ts:42-58`): `enabled = schemaReady && (FSRS_ENABLED==="true" || userId in FSRS_ENABLED_USER_IDS allowlist)`. `shadowEnabled = schemaReady` — i.e. **once migration 0032 is applied and `FSRS_SCHEMA_READY=true` (already true in Production), FSRS is computed in shadow for every user**, but only authoritative for due dates when `enabled` is true (currently one allowlisted test account).
- **Dual-write** (`review/actions.ts:141-175`, `reviewWord`): every review updates legacy `srs_state` fields unconditionally, and — when `usedFsrsColumns` — also updates the FSRS shadow columns and writes `scheduler_type`/`previous_state_json`/`next_state_json` to `review_log`. This confirms the dual-write architecture is real and must not be touched.

### 3.4 Undo feasibility — a real gap, not just a UI task

`previous_state_json`/`next_state_json` (0032) store a full `ts-fsrs` `Card` object (`fsrs.ts:34-46`: `due, stability, difficulty, elapsed_days, scheduled_days, learning_steps, reps, lapses, state, last_review`) — **the FSRS shadow state, not the legacy SM-2 state** (`ease_factor`/`interval_days`/`repetitions`). For the allowlisted FSRS-authoritative account, restoring from `previous_state_json` is sufficient. For the ~all-other-users legacy-authoritative case (which is what `due_at` actually depends on), **no existing column captures the pre-review `ease_factor`/`interval_days`/`repetitions`/`due_at`/`first_reviewed_at`** — undo cannot correctly restore the real scheduling state from what exists today.

This satisfies the brief's own contingency ("если схема не позволяет — подготовить минимальную migration, показать SQL, не применять Production, продолжать всё остальное"). Migration proposed in §14; not applied to Production, applied only to local/dev Supabase for implementation and testing.

Row identification for undo *is* solvable without new columns: `review_log` has no unique-per-review external id exposed to the client today, but `id` (UUID PK) plus `reviewed_at` are enough — "is this the most recent review for this card" is `SELECT ... WHERE flashcard_id = ? ORDER BY reviewed_at DESC LIMIT 1` and comparing the returned `id`.

### 3.5 Review session — current state (verified by reading the live components)

`review-session.tsx` (314 lines): plain unstyled flashcard UI (no App Shell chrome inside the mode components), **no keyboard shortcuts at all**, **no pronunciation**, **no context/source/photo rendering** (query only selects `front, back, notes, deck_id, owner_id` — `page.tsx:14`), **no session persistence** (React state only — comment at `review-session.tsx:55-58` explains why it avoids re-reading server props mid-session, but a hard reload still loses everything). Grading is sequential and button-disabled during `isPending`, so no double-grade risk from rapid clicks within one component instance. Grade→color mapping: 0=red "Не помню" (Again), 1=orange "Трудно" (Hard), 2=emerald "Помню" (Good), 3=dark-emerald "Легко" (Easy) — this exact label/order must be preserved. `SessionComplete` (`session-complete.tsx:29`) currently links to **`/library`**, not back to Practice — a real, small, in-scope UX bug to fix alongside the redesign (not a scheduler change).

Three other modes exist and work today: `multiple-choice-mode.tsx`, `type-word-mode.tsx`, `match-pairs-mode.tsx` (binary-graded, switched via `review-mode-switcher.tsx`). These are the "Cards/Choice/Type/Match" quick-practice modes referenced in the brief — already functional, need re-skinning only, and their binary-grading limitation vs. the 4-rating FSRS/SM-2 flow must stay honestly labeled per the brief.

### 3.6 Paywall / createDeck bug — corrected root cause

**Correction note** (the original Slice-3-era plan doc attributed the `createDeck` redirect issue to a Turbopack/memory timing flake — that was wrong; corrected here per this brief, old text left in place elsewhere as history, not deleted):

Actual cause, verified by reading the code directly: `FREE_DECK_LIMIT = 3` (`src/lib/subscription.ts:8`); onboarding auto-creates one default deck (`src/app/onboarding/actions.ts:77-84`); `createDeck` (`brain/actions.ts:24-26`) checks `hasFreeDeckRoom` and returns `{ paywall: true }` **without calling `redirect()`** when the limit is hit — `redirect()` only happens after a successful insert (`actions.ts:36`). `new-deck-modal.tsx` does correctly render the paywall message today (`state.paywall` branch, line 36-43) — so the "redirect bug" is not a broken redirect, it's that **the limit is only discovered after submit**, with no pre-emptive display of current count/remaining slots, and the `/pricing?reason=decks` link lands on a page whose `REASONS` map (`pricing/page.tsx:19-22`) only defines `texts`/`words` — `decks` and `cards` silently render no explanatory banner. Both are real, fixable gaps (§12), not a redirect bug.

`deleteDeck` (`brain/actions.ts:39-60`) protects only `is_default` decks server-side. **Starter decks (`is_starter=true`) have no delete protection at all**, server- or client-side — `deck-card.tsx` never even receives `isStarter` as a prop. This is a real gap to close in Deck Details (§11), not present in the original brief's assumptions.

### 3.7 Import/dedup — current state

`import-cards.ts` dedups **within a single import batch only** (`front back` lowercased, `validateCards:162-168`) — never checked against cards already in the DB. `addFlashcard` (manual add) has no dedup check at all. Both are real gaps closed in §13.

### 3.8 Pronunciation precedent

`window.speechSynthesis`/`SpeechSynthesisUtterance` already used in `src/app/read/[textId]/reader.tsx` and `reader-listening.tsx` (Slice 3 Listening mode) — free, no paid TTS anywhere in the repo. Same pattern reused for word/phrase pronunciation buttons in Review and Item Details.

### 3.9 Reusable data sources (avoid duplicating analytics)

- `getDueCount(supabase, ownerId, language)` (`src/lib/brain-stats.ts:3-14`) — due count, already scoped by language.
- `getReviewsThisWeekCount` (`brain-stats.ts:19-30`) — precedent for a new `getReviewsTodayCount` (same join pattern, `todayStart` instead of `weekAgo`) for Practice Home's "reviewed today".
- `computeHardestWords` + `<HardestWords>` (`src/app/(app)/progress/page.tsx:32`, `hardest-words.tsx`) — already computes accuracy-ranked weak words from `review_log`/`accuracyLog`. Reused directly for Practice Home's "weak words", not reimplemented.
- `touchStreak`/`profiles.streak_current` (`src/lib/streak.ts`) — existing streak, already updated on every review.
- `profiles.daily_word_goal` — existing per-user daily target column, reused as the "daily target" metric on Practice Home rather than inventing a new one.
- Dead/unused: `profiles.xp` + `src/lib/ranks.ts` (rank system, zero UI anywhere) — confirmed still unused; **stays deferred** per the brief (§16 below), not wired into Slice 4.

## 4. Existing bugs found (this audit, in addition to §3.6 correction)

1. `SessionComplete` links to `/library` instead of back to Practice — fixed as part of the redesign.
2. `deleteDeck` has no starter-deck protection (only default-deck) — fixed in Deck Details.
3. `pricing/page.tsx`'s `REASONS` map is missing `decks`/`cards` entries — Brain-triggered paywall visits get no explanation banner — fixed in §12.
4. Dedup is batch-local only, never checked against existing DB rows; manual add has none — fixed in §13.
5. Review query never selects `context_sentence`/`context_translation`/`source_text_id`/`photo_url` even though all four columns exist — fixed in §6.6 (no schema change needed).
6. `review_log.previous_state_json` cannot restore legacy SM-2 state (only FSRS shadow state) — real undo gap, migration proposed in §14, **not applied to Production**.

## 5. Scope of Slice 4

Practice Home redesign · Review Session redesign (question/answer, context/source/photo, pronunciation, keyboard shortcuts, mobile) · session resume (localStorage) · undo last grade (real, ownership+staleness-checked) · Vocabulary (Words/Phrases/Decks unified UI, search/filter/sort, safe bulk actions) · Item Details · Deck Details (rename/delete/starter-protection) · createDeck pre-emptive paywall + pricing reasons fix · import/manual dedup fix · analytics (approved event list only) · accessibility pass · tests · Draft PR + Preview. All on the existing caramel Production palette, existing App Shell.

## 6. Deferred scope (explicitly out of this Slice, per the brief)

FSRS global rollout or algorithm changes · XP/rank UI · Language Twin · Missions · Today v2 · offline mode · paid TTS/LLM/speech-recognition · full cloze-generation backend · separate Voice product · deck `description` field (no column exists; rename ships without it, not blocked by it) · real cover images/thumbnails-adjacent work (unrelated to this Slice). Roadmap note: the dead XP/rank system remains a candidate for a future slice once a product decision is made on whether to launch it or remove it — not decided here.

## 7. Data integrity rules (hard constraints for every phase below)

- Never change `src/lib/fsrs.ts` scheduling math, `src/lib/srs.ts` SM-2 math, or the grade→rating mapping.
- Never flip `FSRS_ENABLED` globally or edit `FSRS_ENABLED_USER_IDS`.
- Every review still dual-writes legacy + FSRS-shadow columns exactly as today.
- No mass data migration, no card recreation, no due-date reset, ever.
- New migration (§14) is additive-only (new nullable columns), never touches existing rows' meaning.
- Undo only ever touches the single most recent `review_log` row for one card, ownership-checked, staleness-checked (§14).

## 8. Implementation phases

1. **This plan doc** (current step).
2. **Practice Home** — real due/new/est.-duration, resume banner, daily progress (reviewed-today/target/streak), weak words (reused from Progress), quick-practice mode grid (honest binary-grading disclosure), all states.
3. **Review Session** — question/answer redesign on caramel tokens, context/source/photo wired from already-existing columns, pronunciation, keyboard shortcuts, mobile fullscreen, `SessionComplete` link fix.
4. **Session resume** — localStorage, following the defensive never-throws parse pattern already used by `reader-prefs.ts`.
5. **Undo** — local migration (dev-only), server action, ownership/staleness checks, UI wiring.
6. **Vocabulary rebuild** — Words/Phrases/Decks tabs, search/filter/sort, bulk actions.
7. **Item Details + Deck Details** — including starter-deck delete protection fix, rename.
8. **createDeck paywall fix + pricing reasons**.
9. **Dedup fix** — manual add + all import formats, DB-aware.
10. **Analytics + privacy audit**.
11. **Accessibility pass**.
12. **Tests** (unit/integration/e2e) + full check suite.
13. **Draft PR + Preview + final report.**

Each phase lands as its own small, logically-scoped commit per the brief's git workflow.

## 9. Definition of Done

Matches brief §21 verbatim — visual parity with the approved (caramel) artifact; Practice Home/Review/Vocabulary/Decks on real data; FSRS and legacy SRS semantics unchanged; context/source/photo/pronunciation working; keyboard shortcuts; resume; undo; session complete; item details; deck create with honest pre-emptive limit; starter/default deck protected; rename/delete safe; dedup working; imports not broken; real empty/loading/error states; desktop+mobile; accessibility; tests; Preview ready; Production untouched; no dead/inactive buttons.

## 10. Rollback plan

- Pure UI/route changes: revert via git, no data impact.
- New localStorage session-resume key: additive, ignored by old code, safe to ship/revert independently.
- New migration (§14): additive nullable columns only — safe to leave applied even if the undo feature is reverted; no down-migration required for safety, but one will be included for completeness.
- No changes to `FSRS_ENABLED*` env vars — rollback of this Slice never touches scheduler rollout state.

## 11. Paywall decisions

- Deck creation: show current count/limit/remaining **before** submit (data already available on `/brain`'s server component — `decks?.length` vs `FREE_DECK_LIMIT`), disable Create at the limit instead of only failing after submit, keep the existing post-submit `{paywall:true}` path as defense-in-depth (e.g. race between two tabs).
- Fix `pricing/page.tsx`'s `REASONS` map to add real `decks`/`cards` copy (mirroring the existing `texts`/`words` entries) so the existing `?reason=decks`/`?reason=cards` links (already fired from Brain today) actually explain themselves.
- No changes to `FREE_DECK_LIMIT`/`FREE_FLASHCARD_LIMIT` values or to Stripe/subscription logic.

## 12. Deck decisions

- Rename: `name` is already a plain mutable column — ship a real server action, no schema needed.
- Description: column doesn't exist — deferred, does not block rename.
- Starter-deck delete protection: currently missing entirely — add both server-side check (mirroring the existing `is_default` check in `deleteDeck`) and UI affordance explaining the restriction.
- Default-deck protection: already correct server-side, kept as-is.

## 13. Words/phrases decisions

- Classification stays client-side (`headword.includes(" ")`), matching the Reader's own existing logic exactly — no new schema column.
- Vocabulary tabs read from `vocabulary_items` (for status/knowledge-level/source) joined with `flashcards`/`srs_state` via the existing `flashcard_id` link (0028) for due-state/next-review — no new join infrastructure needed, the link already exists.

## 14. Free-tier / constraint decisions

- Pronunciation: browser `speechSynthesis` only, same as Slice 3 Listening mode — zero cost, zero new dependency.
- No AI-generated grammar/explanation anywhere in Review or Item Details (brief explicitly forbids fake AI content).
- Estimated review duration: deterministic formula, no AI — documented in the Practice Home phase as `cards × avg_seconds_per_card` using a fixed, labeled constant (not false precision — displayed as a rounded range, e.g. "~9 мин", matching the artifact).

## 15. Undo migration proposal (SQL shown, NOT applied to Production)

Additive-only, mirrors the existing 0032 pattern exactly:

```sql
-- 0035_review_log_legacy_snapshot.sql
-- Additive: captures pre-review legacy SM-2 state so "undo last grade" can
-- restore due_at/ease_factor/interval_days/repetitions/first_reviewed_at for
-- legacy-authoritative users, the same way previous_state_json already does
-- for FSRS-authoritative ones. Nullable — existing rows are simply not
-- undo-able (no snapshot exists for them), which is correct: undo only ever
-- targets the most recent review, and this column starts getting populated
-- going forward from the moment this ships.
alter table review_log
  add column previous_legacy_state_json jsonb,
  add column next_legacy_state_json jsonb;
```

Populated in `reviewWord()` alongside the existing FSRS snapshot write, unconditionally (no flag gating — this is legacy state, always relevant): `{ ease_factor, interval_days, repetitions, due_at, first_reviewed_at, last_reviewed_at }` before/after. Applied to **local/dev Supabase only** during this Slice's implementation and testing. **Not applied to Production** — flagged in the final report as a pending manual step requiring separate confirmation before merge, per the brief's explicit stop condition.

## 16. Roadmap (deferred items, for future slices)

- XP/rank UI decision (ship or remove `profiles.xp`/`src/lib/ranks.ts`).
- Deck `description` field, if the user wants it later.
- FSRS global rollout, once enough shadow-data confidence exists.
- Language Twin, Missions, Today v2, offline mode, paid TTS/LLM/speech-recognition, full cloze-generation, separate Voice product — all explicitly deferred per the brief, no work started.
