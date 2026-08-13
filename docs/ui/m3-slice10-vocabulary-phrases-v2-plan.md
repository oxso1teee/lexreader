# M3 Slice 10 — Vocabulary & Phrase System v2

Branch: `feature/vocabulary-phrases-v2`. Base SHA: `61efa14af0a05d8f5081531bd04055ffe4fffad6` (origin/main, contains Slice 9 / PR #21).

## 1. Audit summary

Four parallel research passes covered: (A) DB schema + FSRS/legacy-SRS, (B) Reader save flow + imports + translation, (C) Brain/Practice/Vocabulary UI, (D) Language Twin/Missions/Learning Paths/Progress integration. Full findings are in the session transcript; this section distills what actually shapes the v2 design.

### 1.1 The central fact: two parallel tables, not one

`vocabulary_items` (Reader/Notebook lineage, migration `0001`) and `flashcards`+`srs_state`+`review_log` (Brain/Practice/SRS lineage, migration `0004`) are **separate tables**, optionally linked by a nullable `vocabulary_items.flashcard_id` (migration `0028`). Both carry their own parallel copy of `context_sentence`/`context_translation`/`source_text_id`. This split — not a single missing column — is the root cause of every inconsistency below.

**Five independent code paths create `flashcards` rows today**, each with different dedup/context behavior:

| Path | Writes to | Dedup | Context stored | Links `vocabulary_items`? |
|---|---|---|---|---|
| Reader word tap (auto-save) | `vocabulary_items` → auto-links a `flashcards` row on first save | `ilike` on `vocabulary_items.headword` | Single slot, **discarded on repeat save** (only `seen_count++`) | Yes (creates it) |
| Reader phrase select (explicit button) | `flashcards` only | `ilike` on `flashcards.front` | Single slot, **discarded on repeat save** (silent no-op) | No — never touches `vocabulary_items` |
| Manual "Add word" (Notebook) | Same as Reader word tap (`saveVocabularyItem`) | Same as above | User's free-text note becomes `context_sentence` | Yes |
| CSV/TSV/JSON bulk import | `flashcards` only | A **third**, independently-implemented check (`partitionByExistingFront`, bulk-fetch + client-side filter) | Never set (always null) | No |
| Starter decks | `flashcards` only | **None at all** — only checks "have I added this named starter deck already," never per-word | Never set | No |

No table has a DB-level unique constraint anywhere — every dedup check above is app-level and race-condition-prone.

### 1.2 Word vs. phrase: a heuristic, not data

`isPhrase = front.includes(" ")`, computed independently in two places (`src/lib/vocabulary-list.ts:130` and `src/app/read/[textId]/reader.tsx:390`). No schema column. `docs/fluency-os/02-phrase-model-fsrs.md` already documents that phrases were deliberately modeled as "flashcards with arbitrary text," not a first-class type — that decision is now superseded by this brief.

### 1.3 Two disagreeing "known" signals

1. **Scheduler bucket** (`bucketFor()` in `vocabulary-list.ts`) — recomputed fresh every read from `srs_state.interval_days`/`repetitions` (`isLearned()`: `interval≥21 && repetitions≥3`). Pure derived label, never stored.
2. **`vocabulary_items.status`** — a real stored column, set by `bulkMarkKnown` or the Notebook's mark-known flow. Only exists for flashcards linked to a `vocabulary_items` row (so manually-imported/CSV/starter cards never have it).

These can disagree and currently aren't reconciled anywhere. v2's `learning_state` is a **third**, explicitly evidence-based concept — see §3.

### 1.4 FSRS / legacy SRS reality check

**Legacy SM-2 (`src/lib/srs.ts`) is the live, currently-authoritative scheduler for essentially all users today** — not a fallback for a few stragglers. FSRS (`src/lib/fsrs.ts`, fields on `srs_state.fsrs_*`) is computed in shadow mode on every review for everyone, but only becomes authoritative for `due_at` when `FSRS_ENABLED`/an env allowlist turns it on for that user. Both are computed unconditionally today (`review/actions.ts`). `docs/fluency-os/02-phrase-model-fsrs.md` explicitly says never delete `srs.ts` — keep as permanent fallback. **v2 touches neither algorithm.**

### 1.5 Practice modes produce genuinely different evidence strength — but nothing records which mode was used

Four modes, one shared `reviewWord(flashcardId, grade)` action, one `review_log` table:
- **Cards** — full 4-point grade (0–3), the only mode with FSRS/SM-2 interval math, session-resume (localStorage, Cards-only), and undo-last-grade.
- **Choice / Type / Match** — binary outcome only (`grade` always 0 or 2), no resume, no undo (the code itself documents Choice/Type/Match as a weaker signal than Cards — `quick-practice-grid.tsx`'s own copy).

**`review_log` has no `mode` column.** A stored grade of 0/2 could be Choice, Type, or Match — indistinguishable after the fact, even though Type (typed recall) is a materially stronger production signal than Choice (recognition) or Match (association). This is the one gap that genuinely blocks the recognition/recall/activation model the brief asks for — **Phase A adds a nullable `practice_mode` column to `review_log`** (schema only; the write-path wiring is Phase B/C application code, not a second migration).

Also confirmed: `review_log` has **no index on `flashcard_id`** at all today — every history query full-scans. Fixed as part of this migration (pure performance win, zero behavior change).

### 1.6 `wordIds`-scoped targeted sessions: real, but only two producers

`?wordIds=<comma-separated-flashcard-ids>` on `/brain/[deckId]/review` bypasses the normal due/new queue entirely (`review/page.tsx`). Two real producers today: Missions (`vocab_activation`/`phrase_activation`/`review_recovery`) and Language Twin recommendation cards. **Learning Paths' Knowledge Check does NOT use this mechanism** — it's a separate, unrelated grammar-quiz surface (`buildGrammarQuestionSet`) that never touches `flashcards`/`srs_state`. Every vocabulary/phrase-flavored skill across all 4 curricula (`a2-b1`, `b1-b2`, `everyday`, `it-english`) maps to `category: "activation"`, `"collocation"`, or `null` — **none of which have real Knowledge Check content today** (the grammar question bank has zero vocabulary/collocation questions). This is honestly disclosed and gated in the existing code (button hidden, not broken, covered by a passing test) — it's an intentionally absent feature, not a bug. Phase C's job is to route these skill slots into real, wordIds-scoped Vocabulary Practice instead of a Knowledge Check that can't exist for this content shape.

### 1.7 Decks and Collections — pre-existing conclusions this plan does not revisit

- **Decks** are organizational containers only, never a scheduling boundary — daily new/review limits are per-owner, global across all decks (`srs_settings`, no `deck_id` column). Two protected system decks: `is_default` (Reader/manual-add target) and `is_starter` (undeletable, free-tier-exempt). v2 builds on this unchanged.
- **Collections** are entirely unrelated — a `texts`-grouping feature for multi-chapter Library imports, with zero relationship to `flashcards`/`decks`. Not touched by this slice.

### 1.8 Missions and Language Twin — already live, not dormant

`activation-gap.ts`/`review-recall.ts` already read real `vocabulary_items.level` + `review_log.grade` data (not fed by something else) — v2 extends an active pipeline. Missions `vocab_activation`/`review_recovery` pull their word list straight from the `activation_gap`/`review_recall` pattern's own stored word-id metadata; `phrase_activation` is independent, reading `language_evidence` (`evidence_type="phrase_saved"`) joined to low-repetition `srs_state` rows. Mission completion = a genuine `wordIds`-scoped review session with **no mode gating** — any of the 4 practice modes completes it, confidence is tiered by correct-ratio, evidence is recorded exactly once (idempotent CAS flag) via `recordEvidence()` → `recomputeLanguageTwin()`, never a direct pattern mutation. This project's established "add a new evidence source" recipe (schema constraint widen → type union → settings-toggle gate → `recordEvidence()` producer → `recompute.ts` consumer with a ≥2-occurrence threshold → UI label) is fully reusable for v2's activation/recall evidence — `placement_session` (Slice 9) is the worked template.

### 1.9 Pre-existing finding that needs an explicit decision, not a silent fix

**A word-count-derived CEFR-band label already exists and is already shown to users.** `behavioralLevelRange()` (`src/lib/language-twin/behavioral-level.ts`) maps `observed_receptive_vocabulary` (a raw count from `vocabulary_items`) → `"A1–A2" | "A2–B1" | "B1–B2" | "B2+"`, with a coarse accuracy-based downshift. It's the single largest, boldest number on `/language-twin` today, and it drives which Learning Path gets recommended. It is explicitly documented in-code as "never a precise CEFR letter+number, always a range," with a disclosure UI (`how-calculated.tsx`) showing the raw inputs.

**Decision: out of scope, left exactly as-is.** The brief's "no fake CEFR from word count" rule governs what v2 *adds* (Progress vocabulary metrics, Word/Phrase Detail screens) — it does not retroactively require touching a pre-existing, already-disclosed, already-shipped feature from a prior slice. Reconciling or tightening `behavioralLevelRange()` is a reasonable future slice, not this one.

### 1.10 Analytics precedent

Existing vocabulary-adjacent events already documented (`vocabulary_viewed`, `vocabulary_filter_changed`, `vocabulary_bulk_action_used`, the `review_*`/`deck_*`/`mission_*` families) — new events extend this vocabulary, not replace it. `phrase_saved` is already used as an internal `language_evidence.evidence_type` string (not a PostHog event name) — safe to keep separate. Privacy regex tests (`missions-privacy.spec.ts`, `learning-paths-privacy.spec.ts`, `language-twin-privacy.spec.ts`) already forbid `word`/`phrase`/`headword`/`translation`/`front`/`back`/`context`/`sentence` keys — the new `placement-privacy.spec.ts`-style spec for this slice follows the identical idiom.

## 2. Product model

**Word** — a single lexeme (`avoid`). **Phrase** — a multi-word unit (`figure out`, `at the end of the day`). **Context occurrence** — a real sentence the user met the word/phrase in. One vocabulary item can have many contexts; contexts are never a reason to create a second item for the same word.

No new normalization tables (no lemmas/morphemes/phonemes/semantic graphs). `flashcards` remains the canonical, practiceable "vocabulary item" — it's already what `/brain/vocabulary`'s list query (`getVocabularyRows`) is built around, with `vocabulary_items` joined in best-effort where linked. v2 formalizes what's already the de facto architecture rather than replacing it.

## 3. Data model decisions

All changes are **additive only** — no renames, no drops, no column-type changes, no existing constraint changes (aside from adding a new index). Applies to `supabase/migrations/0041_vocabulary_phrases_v2.sql`.

### 3.1 `item_type` (word vs. phrase) — real column, both tables

`flashcards.item_type text not null default 'word' check (item_type in ('word','phrase'))`, same on `vocabulary_items`. Backfilled with the **exact existing heuristic** (`position(' ' in trim(front)) > 0 → 'phrase'`) — a lossless, behavior-preserving backfill: every row's computed type after migration matches what the UI already shows today. Going forward, every save path sets this explicitly instead of relying on a client-side heuristic, and the two duplicated `includes(" ")` call sites collapse into one stored source of truth.

### 3.2 `normalized_key` (dedup) — additive, non-unique for now

`flashcards.normalized_key text`, backfilled as `trim(lower(front))` — reusing `normalizeFront()` from `flashcard-dedup.ts` verbatim (no new normalization rule). Indexed (`(owner_id, language, normalized_key)`) for fast lookup, replacing the current `ilike` scans. **Not a unique constraint** — see §6 (existing-duplicate audit) for why.

### 3.3 `source_type` — honest provenance, not fabricated for history

`flashcards.source_type text check (source_type in ('reader','manual','import_bulk','starter_deck','mission','path')) default 'manual'`. Backfill is best-effort and explicitly disclosed as imprecise for one case: `is_starter → 'starter_deck'`, `source_text_id is not null → 'reader'`, everything else → `'manual'` (this bucket *includes* historical CSV/bulk-import rows, since the current schema genuinely cannot distinguish a hand-typed manual add from a CSV-imported row after the fact — no column ever recorded it). Going forward every save path sets this precisely, so the imprecision only affects historical rows, and only affects the *label shown*, never scheduling/practice/dedup behavior.

### 3.4 `learning_state` — the vocabulary lifecycle, explicitly not the FSRS state

`flashcards.learning_state text not null default 'new' check (learning_state in ('new','learning','familiar','active','maintenance'))`, plus `learning_state_version int not null default 1` (so a future algorithm change can trigger a clean recompute without a schema migration) and `learning_state_updated_at timestamptz`. See §4 for the derivation function. **Migration adds the column with a conservative default (`'new'`) for every row** — the real backfill (computing genuine historical state from real `review_log`/`srs_state` data) is a separate, disclosed, non-schema data-backfill step, run only after this migration is approved and applied (see §7). This keeps the schema migration itself simple and independently reviewable.

### 3.5 `review_log.practice_mode` — provenance for evidence strength

`review_log.practice_mode text check (practice_mode in ('cards','choice','type','match'))`, nullable (historical rows genuinely don't know — never backfilled, never guessed). New index: `review_log_flashcard_idx (flashcard_id, reviewed_at desc)` — fixes the pre-existing missing index noted in §1.5, independent of everything else in this slice.

### 3.6 `vocabulary_contexts` — the new table

```sql
create table vocabulary_contexts (
  id uuid primary key default gen_random_uuid(),
  flashcard_id uuid not null references flashcards(id) on delete cascade,
  context_text text not null,
  context_translation text,
  source_text_id uuid references texts(id) on delete set null,
  source_type text not null check (source_type in ('reader', 'manual', 'import')),
  created_at timestamptz not null default now()
);
```

**Keyed on `flashcard_id`, not `vocabulary_item_id`.** Rationale: `flashcards` is the universal superset — every practiceable, browsable vocabulary item has a `flashcards` row; not every one has a `vocabulary_items` row (phrases never do; CSV/starter imports never do). Anchoring on `vocabulary_items` would leave phrases and bulk-imported words permanently unable to hold contexts, defeating the point. A `vocabulary_items` row that exists without a linked flashcard (possible today if the free-tier flashcard cap was hit at save time) is already invisible to the Vocabulary browser/list query — out of scope, a pre-existing limitation this slice doesn't need to solve.

**Backfill**: one row per existing flashcard with a non-null `context_sentence`, carrying over `context_translation`/`source_text_id` and a `source_type` derived the same way as §3.3. **Existing `flashcards.context_sentence`/`context_translation` columns are left untouched, not dropped** — Phase B application code adds new contexts to `vocabulary_contexts` and reads from it, while the legacy single-slot columns keep working for any code not yet migrated. Dropping them is out of scope for this slice (would require touching every current reader of those columns — `item-details-sheet.tsx`, `vocabulary-list.ts`, `api/export/vocabulary` — in the same change as a schema migration, which is exactly the kind of combined-risk change this project's migration governance avoids).

RLS: owner-only via the same join-through-`flashcards.owner_id` pattern already used by `srs_state`/`review_log`. Cascades on flashcard delete (contexts are meaningless without their parent item — matches the "audit delete behavior" requirement in §8).

## 4. State engine — `deriveVocabularyState()`

Pure, deterministic, unit-tested function in `src/lib/vocabulary/state-engine.ts`. Never called on every page render — computed once when new evidence arrives (a review completes, a mission completes) and persisted to `learning_state`, matching the "avoid N+1, use aggregates" performance requirement.

```ts
export type LearningState = "new" | "learning" | "familiar" | "active" | "maintenance";
export type PracticeMode = "cards" | "choice" | "type" | "match";

export interface ReviewSignal {
  grade: number;              // 0-3
  mode: PracticeMode | null;  // null = historical review, mode unknown
}

export interface VocabularySignals {
  recentReviews: ReviewSignal[]; // newest first, capped at last 6 — see rationale below
  intervalDays: number | null;   // legacy SM-2 interval_days, or FSRS scheduled_days if authoritative
  fsrsStability: number | null;
}

export function deriveVocabularyState(signals: VocabularySignals): LearningState
```

**Recognition vs. recall vs. activation, mapped to real modes**: Cards (grade≥2) and Type both count as *recall-or-better* evidence (the user reproduced the answer without being shown options). Choice and Match count as *recognition-only* evidence (the user selected/matched among visible options). This mapping is the direct, literal translation of the brief's recognition/recall/activation triad onto the four modes that actually exist — no new practice modes required for Phase A/B; Phase C's "Activation Practice" additions (context-gap, translation→English) are new *Type-shaped* content, reusing this same signal, not a new signal category.

**Fixed evidence window (last 6 reviews, or all if fewer)** — this is the hysteresis mechanism. Because state is recomputed fresh from a window each time (never "current state + one new event"), a single new failure only nudges the window by one slot; it cannot erase two-or-more prior successes unless the window itself is that small. This directly satisfies "a word should not bounce active → learning → active from one mistake."

**Derivation** (ordered, first match wins):
1. `recentReviews.length === 0` → **`new`**.
2. `recentReviews.length ≥ 5` AND zero failures in the window AND (`intervalDays ≥ 60` OR `fsrsStability ≥ 60`) → **`maintenance`** (long, stable, trouble-free retention).
3. Count `recallSuccesses` = reviews in window where `mode ∈ {cards, type}` AND `grade ≥ 2`. Count `recentFailures` = reviews in window where `grade < 2`. If `recallSuccesses ≥ 2` AND `recentFailures ≤ 1` → **`active`**.
4. Count `recognitionSuccesses` = reviews in window where `mode ∈ {choice, match}` AND `grade ≥ 2`. If `recognitionSuccesses ≥ 2` OR `recallSuccesses ≥ 1` → **`familiar`**.
5. Otherwise → **`learning`**.

Historical reviews with `mode: null` (everything before this slice ships) count toward `recentFailures`/general activity but never toward `recallSuccesses` or `recognitionSuccesses` — they're real signal for "this word has been touched," but not strong enough to claim recall/recognition specifically, since the mode is genuinely unknown. This means **no word can be retroactively promoted to `active` from historical data alone** — active requires at least 2 real `type`/`cards` successes recorded *after* `practice_mode` starts being written, which is honest given the data that actually exists.

**Unit tests** (`state-engine.test.ts`) cover: new word (0 reviews), single success doesn't over-promote, 2 typed successes → active, active demoted only after ≥2 failures not 1 (hysteresis), long-stable-interval → maintenance, mixed recognition+recall evidence, all-null-mode historical reviews cap at `familiar` never `active`, window boundary (exactly 6 vs. 7 reviews).

## 5. Existing-data migration strategy

**No existing flashcard/vocabulary_item/review row is deleted, renamed, or reinterpreted.** Every new column has a safe, non-destructive default:
- `item_type`: backfilled deterministically from existing text (same heuristic already live in the UI — not a guess, a formalization).
- `source_type`: backfilled best-effort, with the one known imprecision (manual vs. historical bulk-import indistinguishable) explicitly disclosed above, not hidden.
- `learning_state`: defaults to `'new'` for every existing row at migration time; **real state is computed by a separate, disclosed, post-approval backfill script** using the exact same `deriveVocabularyState()` function Phase C uses going forward, run once against real `review_log` history. This directly satisfies "calculate from real review history only if deterministic" — never a fabricated `'active'` state for old words.
- `normalized_key`: pure backfill from existing `front`, no interpretation involved.
- `practice_mode` on historical `review_log` rows: left `null` — never guessed.
- `vocabulary_contexts`: backfilled 1:1 from existing `context_sentence` — no data loss, no data invented.

## 6. Duplicate-existing-items analysis

Per governance, this migration proposes **no unique constraint** on `normalized_key` — the brief explicitly requires proving there are no dangerous existing duplicates before even considering one, and merging existing duplicate flashcards is flagged as dangerous (differing review history/FSRS state per row) and explicitly out of scope without hard proof either way.

**Correction, discovered while running this check**: `.env.local`'s `NEXT_PUBLIC_SUPABASE_URL` points to a local Docker Postgres instance (`127.0.0.1:54321`), confirmed via `vercel env ls production` to be entirely separate from the real Production/Preview Supabase project (which has its own, Vercel-managed, encrypted credentials I do not have access to). A read-only duplicate-count query was run against the local instance only — it found a 7-row duplicate group for a single e2e test fixture ("birds"), which is illustrative of the failure mode but is not real user data. The exact read-only query to run against the real instance (Supabase SQL Editor or direct psql) is provided separately for you to run if you want real numbers. This does not change the Phase A decision: the structural argument — five independently-implemented dedup checks across the five save paths, one of them (starter decks) with no per-word dedup at all — already justifies not adding a unique constraint yet, regardless of the exact real count. **Phase A does not add a unique constraint**; that decision is deferred to a future slice once duplicates (if any) have a proven-safe resolution path, which is exactly the brief's own instruction (§43).

## 7. Migration checkpoint deliverable (this document's companion pieces)

1. Full migration SQL — `supabase/migrations/0041_vocabulary_phrases_v2.sql`.
2. Full rollback SQL (additive-only migration → rollback is drop-column/drop-table, safe since nothing existing was altered).
3. Full verification SQL (column presence, backfill correctness spot-checks, RLS policy presence, index presence).
4. Expected output for each verification query.
5. Existing-data impact: zero rows deleted/altered in any pre-existing column; new columns get safe defaults as above.
6. Backfill strategy: see §5.
7. Dedupe strategy: see §3.2/§6 — column added, no constraint yet.
8. Why no existing reviews break: `review_log`/`srs_state` schemas are completely untouched (only a new index and a new nullable column on `review_log`); every existing query against them continues to work unchanged.
9. Why FSRS references remain valid: zero changes to `srs_state`, zero changes to `fsrs.ts`/`fsrs-flags.ts`/`srs.ts` in this migration.
10. RLS: every new/touched table gets the identical owner-scoped policy pattern already used by `srs_state`/`review_log`.
11. Indexes: `flashcards(owner_id, language, normalized_key)`, `review_log(flashcard_id, reviewed_at desc)` (fixes a pre-existing gap), `vocabulary_contexts(flashcard_id)`.
12. Unique constraints: none added (see §6).

## 8. Delete behavior (audited, not newly designed)

Current cascade (confirmed via local schema inspection): deleting a `flashcards` row cascades to `srs_state` and `review_log` (both `on delete cascade`) and nulls out `vocabulary_items.flashcard_id` (`on delete set null`) — i.e. deleting a flashcard today already destroys its review history, and this slice does not change that behavior. The new `vocabulary_contexts` table follows the same cascade (`on delete cascade` from `flashcards`) for consistency — contexts have no meaning without their parent item. No new "archive vs. delete" distinction is introduced; Phase B's delete UI continues to use the existing (already-cascading) delete action, now also honestly labeled given contexts will be visible.

## 9. Phase A scope (this checkpoint)

Branch ✅. Audit ✅ (this document). Plan ✅ (this document). Data model ✅ (§3). State engine — pure function + unit tests (§4). Migration SQL + rollback + verification, tested against a local isolated Postgres, **not applied to shared Supabase**. Existing-duplicate read-only audit against shared Supabase (§6). **STOP here for migration approval** before any Phase B/C/D work (Vocabulary list v2, Word/Phrase Detail, Reader dedup-and-attach-context integration, Practice activation modes, Language Twin/Missions/Learning Paths wiring, Progress metrics, analytics, accessibility, e2e, Draft PR).

## 10. Open risks (for the approval decision)

1. **Backfilling `learning_state` for real** touches every existing flashcard row in shared Supabase — proposed as a separate, disclosed, non-schema data step after this migration lands, not bundled into it. Needs explicit go-ahead when the time comes, same as the migration itself.
2. **`source_type` historical imprecision** (manual vs. bulk-import indistinguishable) is a label-only issue — never affects scheduling, dedup, or practice — but worth a conscious "yes, that's acceptable" from you rather than a silent choice.
3. **No unique constraint yet** means the pre-existing duplicate-creation gap (most acutely: starter decks have zero per-word dedup) remains open after this slice ships, unless Phase B/C also hardens the five save paths to share one dedup implementation — recommended for Phase B, not yet decided/scoped in detail.
4. **`behavioral_level_range`** (§1.9) is knowingly left as-is — flagging in case you'd rather fold its reconciliation into this slice instead of deferring it.
