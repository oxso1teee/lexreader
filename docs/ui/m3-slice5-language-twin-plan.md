# M3 Unified UI — Slice 5: Language Twin v1

Status: **in progress**. Durable source of truth for Slice 5 — read this first if resuming in a new session, before re-deriving anything from chat history. Production already contains Slice 1 (App Shell + Today), Slice 2 (Progress + Settings), Slice 3 (Library + Reader), Slice 4 (Practice/Brain/Review), Slice 4.1 (accessibility cleanup, merged as `e04cd05`).

## 1. Approved sources of truth

- **Interactive artifact** (visual/interaction/IA contract, approved in full): https://claude.ai/code/artifact/58754a85-919d-44f4-a8d8-bbc9a532fc3b
- **Full audit report** (product/data-model contract): https://claude.ai/code/artifact/6284d338-ac33-4182-b631-51e72a8fb852

Approved 2026-08-06 ("ARTIFACT И PRODUCT MODEL ОДОБРЕНЫ ПОЛНОСТЬЮ"). Every screen, IA decision, and data-model direction below traces back to one of these two documents; neither is re-litigated here, only implemented.

## 2. Product model

Internal/brand name: **Language Twin**. User-facing name: **«Мой английский»**. Six layers (from the audit report, unchanged):

- **Language Profile** — three separately-labeled level signals (self-reported / diagnostic / behavioral), never merged into one falsely-precise number; vocabulary shown as an observed exact lower bound *and* a confidence-labeled estimated range.
- **Evidence** — every pattern/strength resolves to concrete, independently-deletable evidence rows.
- **Error Patterns** — flagship v1 category is *passive recognition vs. active recall* (100% existing data, see §6); remaining categories (articles, prepositions, word order, tense, passive, gerund/infinitive, possession, collocations, spelling) come from the new Correction Input flow and are only shown when a supported rule actually fires.
- **Strengths** — mirrors patterns structurally, sourced from the same evidence.
- **Recommendations** — deterministic `pattern → action` table (§8).
- **Feedback loop** — evidence appends synchronously and cheaply on existing write paths; profile/pattern recompute is on-demand or triggered by meaningful new evidence, never per-keystroke.

## 3. Visual system

Production tokens only, verified live against `src/styles/tokens.css` / `src/app/globals.css` (same verification method as Slice 4's plan doc, §2 there):

```
--color-primary: var(--color-caramel)         /* caramel #a67c52 stays app-wide primary */
--color-caramel-text: #7d5d3e (light) / #c79562 (dark)   /* WCAG-AA text-safe variant */
--background: #f5f1ea (light) / #14120f (dark)
--surface/--card: #ffffff (light) / #201d29 (dark)
--text-secondary, --border, --border-strong, --focus-ring: existing tokens, unchanged
--color-success/-warning/-danger + their -text variants: existing, unchanged
--color-forest*: exists, scoped to Library/Reader only — NOT used anywhere in Language Twin
```

No new tokens, no separate theme, no neon/sci-fi treatment. Language Twin renders inside the existing App Shell (`src/components/product/app-shell/`) using the same card-stack rhythm (`max-w-2xl`, `rounded-2xl bg-card p-4 shadow-sm`) already used by Today/Progress/Settings. Accessibility baseline is Slice 4.1: no color-only status, 44px touch targets, WCAG AA contrast, dark/light parity.

## 4. Current data sources (verified, not assumed — full detail in the audit report §4-9)

- Every Reader word tap auto-saves to `vocabulary_items` (`reader.tsx:195-201`, `vocabulary.ts:137-148`); repeat taps only bump `seen_count`; phrases go straight to `flashcards` with no `vocabulary_items` row and no `seen_count` equivalent.
- Every reading word is mirrored into `flashcards`+`srs_state` at insert time via `vocabulary_items.flashcard_id` (`0028_link_reading_words_to_brain.sql`, `vocabulary.ts:31-91`) — this FK is the join Language Twin's flagship signal depends on.
- `review_log` gets one row per grading action, on every mode, unconditionally: `flashcard_id, grade (0-3), reviewed_at, scheduler_type`, plus FSRS/legacy JSON snapshots (`review/actions.ts:190-207`). No word/answer content stored.
- Choice/Type/Match modes collapse FSRS grading to binary (correct→2, wrong→0); only "Cards" mode uses the full 0-3 scale (`multiple-choice-mode.tsx:81`, `type-word-mode.tsx:45`, `match-pairs-mode.tsx:70-76`).
- Type-mode's typed string never leaves the browser — only the derived boolean crosses the network (`type-word-mode.tsx:42-45`). Correction Input (§13) is a deliberate, separate, consented flow — not a repurposing of this signal.
- `src/lib/brain-stats.ts` (`computeHardestWords`) is a pure, reusable per-card accuracy aggregator with an existing `MIN_ATTEMPTS_FOR_ACCURACY = 3` evidence-threshold convention, reused directly in the confidence model (§7).
- `profiles.level` is free-text, populated from a 3-value onboarding enum (`beginner|intermediate|advanced`, `onboarding-options.ts:1-5`) — this is the "self-reported" signal.
- No `phrases` table, no word-level history table, no local analytics table, no existing jsonb blob suitable for a learner-model profile exist anywhere in the schema.

## 5. Schema (implemented — see migration files, not just this doc)

Five tables, following the codebase's dominant RLS convention (`owner_id = auth.uid()`, confirmed as the pattern used by `vocabulary_items`, `decks`, `flashcards`, `srs_settings`, `collections`):

- **`language_twin_profiles`** — one row per user. `user_id` (PK, FK→profiles), `self_reported_level`, `diagnostic_level_range`, `behavioral_level_range`, `confidence`, `observed_receptive_vocabulary`, `observed_active_vocabulary`, `summary_json`, `strengths_json`, `weaknesses_json`, `recommendations_json`, `algorithm_version`, `last_recomputed_at`, `created_at`, `updated_at`.
- **`language_error_patterns`** — `id`, `user_id`, `category`, `pattern_key` (unique per user), `title`, `description`, `confidence`, `evidence_count`, `severity`, `trend`, `status` (`active|improving|resolved|uncertain|dismissed`), `first_seen_at`, `last_seen_at`, `metadata_json`, `created_at`, `updated_at`.
- **`language_evidence`** — `id`, `user_id`, `pattern_id` (nullable FK), `evidence_type`, `source_type`, `source_id` (soft reference — no polymorphic FK precedent exists in this schema, validated in app code instead), `normalized_category`, `result`, `confidence`, `metadata_json` (never raw sentence/word text for review/reading-derived evidence — joins back to `flashcards`/`vocabulary_items` by id at display time), `occurred_at`, `created_at`, `deleted_at` (soft delete).
- **`language_recommendations`** — `id`, `user_id`, `recommendation_type`, `priority`, `reason_key`, `related_pattern_id` (nullable FK), `action_type`, `action_target_json`, `status` (`pending|dismissed|completed|expired`), `created_at`, `completed_at`, `dismissed_at`, `expires_at`.
- **`language_twin_settings`** — one row per user. `user_id` (PK), `enabled`, `include_review_history`, `include_reading_behavior`, `include_writing_exercises`, `include_saved_vocabulary`, `allow_diagnostic`, `algorithm_version`, `created_at`, `updated_at`.

One deliberate addition beyond the audit report's 4-table sketch: **`language_correction_submissions`** stays a separate table (not folded into `language_evidence`) because it's the one place a user types brand-new free text specifically for this feature — isolated so it has its own delete/export/consent story. Fields: `id`, `user_id`, `submitted_text`, `detected_patterns_json`, `suggested_correction`, `created_at`, `deleted_at`. Text is stored **only** after the user explicitly clicks "Сохранить как свидетельство" — never automatically.

RLS: `enable row level security` + `for all using (user_id = auth.uid()) with check (user_id = auth.uid())` on all six tables, no exceptions, no shared/public rows. Indexes: `user_id` (RLS-driven) on all six; `(user_id, status)` on patterns and recommendations; `(user_id, created_at)` on evidence and correction submissions; `pattern_id` on evidence.

## 6. Deterministic engine (no external AI, no paid API)

**Flagship v1 signal — passive recognition vs. active recall**: for each `vocabulary_items` row with a non-null `flashcard_id`, compare its Reader-side engagement (`level`, `seen_count`, `status`) against that flashcard's review accuracy in `review_log` (grade≥2 = success, reusing the existing binary-success convention from `computeHardestWords`). A word leveled up in Reader but failing review in Brain (below a minimum-evidence threshold of 3 attempts, same constant as `brain-stats.ts`) is the pattern. Zero new input required — this is the one pattern that ships with full confidence from day one.

**Repeated review failure**: generalizes `computeHardestWords` beyond "top N worst" to a full per-card accuracy map with trend (recent window vs. all-time).

**Correction-rule engine**: curated regex/lookup-table checks over user-submitted sentences (Correction Input, §13) — known Russian→English transfer errors (preposition pairs, article heuristics, word-order checks, passive/gerund-infinitive lookup patterns). Zero new dependencies — confirmed no NLP library exists in `package.json` today; none is added. Every unsupported sentence shape returns an explicit "не можем надёжно проверить" state, never a guessed correction.

**Diagnostic engine**: fixed, versioned multiple-choice question bank, deterministic scoring, no free-text grading.

## 7. Confidence model

Score = evidence count (capped, floor at 3 attempts — the existing `MIN_ATTEMPTS_FOR_ACCURACY` convention) + consistency of outcomes (conflicting evidence lowers it) + recency (exponential decay favoring the last 14-30 days) + source diversity (single-source caps at "medium"; ≥2 corroborating source types required for "high"). Internal score is numeric for ranking; the UI only ever shows `low | medium | high`, plus the reason (мало evidence / conflicting evidence / consistent evidence / recently updated) — never a percentage.

## 8. Recommendation engine

Deterministic `pattern → action` table:

| Signal | Action |
|---|---|
| Passive-recognition gap | Targeted recall session on the gap-flagged cards |
| Repeated Again/Hard on a cluster | Standard FSRS review, surfaced with higher priority (never reordering the due queue itself) |
| Article/preposition rule hit (Correction Input) | Short targeted diagnostic or curated example set |
| Insufficient evidence | Prompt to complete the mini-diagnostic |
| No data at all | Onboarding-style nudge: read something / save a word / do a review |
| Strong recent progress | Short "maintain" session, not a new drill |

## 9. Privacy model

Per-source opt-out (`language_twin_settings.include_*`) is real and enforced at the evidence-ingestion call site, not decorative. `language_evidence.metadata_json` never contains raw sentence/word/translation content for review- or reading-derived evidence. `language_correction_submissions.submitted_text` is the sole exception, stored only on explicit user action, independently exportable/deletable. Disable stops new evidence generation but does not auto-delete history (separate reset flow, §25 of the brief). Confidence labels only, never raw scores, in any user-facing surface.

## 10. Analytics policy

Events (enums/counts/booleans/ids only, matching the existing rule verified verbatim in `docs/ui/analytics-events.md:49-51`): `language_twin_viewed`, `pattern_opened`, `strength_opened`, `recommendation_opened`, `recommendation_dismissed`, `diagnostic_started`, `diagnostic_completed`, `correction_check_started`, `correction_check_completed`, `profile_recompute_requested`, `evidence_deleted`, `pattern_marked_inaccurate`, `pattern_dismissed`, `language_twin_enabled`, `language_twin_disabled`, `language_twin_reset`. Never sent: sentence, corrected sentence, word, phrase, translation, context, evidence content, material title, URL, deck name, email, exact error, free-form text. New `track()` call sites get added to the existing regex-enforcement test pattern (`practice-brain-a11y.spec.ts:164-186`'s approach, generalized) rather than trusted to manual review alone.

## 11. Integrations

- **Reader**: word/phrase save and mark-known become evidence-append points; no Reader UI/logic change beyond a lightweight hook at the existing write path.
- **Practice**: recommendations can open a filtered custom session; FSRS due queue, ratings, and scheduler stay 100% authoritative and untouched.
- **Progress**: compact summary card (current focus, one strength, one weak pattern, confidence, link to full profile) — does not duplicate the full screen.
- **Today**: compact card (current focus, one recommendation, profile-updated note, CTA) — Today v2 is not started.
- **Settings**: enable/disable, per-source toggles, diagnostic permission, recompute, export, reset.

## 12. Implementation phases

**A — Foundation**: schema, RLS, indexes, settings, evidence ingestion, deterministic engine, local migrations, migration checkpoint (this doc + explicit confirmation before Production).
**B — Core Profile**: Overview, Patterns, Pattern Details, Strengths, Evidence Explorer, Recommendations, empty/low-confidence/loading/error states.
**C — Input flows**: Correction Input, Mini Diagnostic, save-as-evidence, recompute.
**D — Integrations**: Reader, Practice, Progress, Today, Settings, export/reset.
**E — Hardening**: privacy, analytics, accessibility, performance, tests, Preview, final report.

One feature branch (`feature/language-twin-v1`), one Draft PR. Production migration is a separate, explicitly-gated step (§13 below).

## 13. Migration plan

1. Write migration SQL (all 6 tables, RLS, indexes, defaults/nullability documented inline).
2. Apply to **local** Supabase only (`supabase db reset` / local `db push`), run tests against it.
3. Show the complete SQL, an explanation of every table/column, RLS policies, indexes, and a backward-compatibility argument (additive-only, no existing table altered) directly in chat.
4. **Stop and request one explicit confirmation** before any Production apply.
5. After confirmation: apply via whatever safe access exists (Supabase CLI linked project or, if no CLI access, hand over exact SQL for the Supabase Dashboard) — never ask for secrets, never attempt to bypass Vercel/Supabase protection.

## 14. Rollback plan

All six tables are strictly additive — no existing table is altered, no existing column changed, no existing RLS policy touched. Rollback is a single `drop table if exists language_twin_profiles, language_error_patterns, language_evidence, language_recommendations, language_correction_submissions, language_twin_settings cascade;` (exact SQL published alongside the migration itself, not written from memory later). Disabling the feature at the application layer (env/flag) is independently possible without any DB rollback if only a soft disable is needed.

## 15. Definition of Done

See brief §34 verbatim — artifact parity across all 16 screens with real (not stubbed) states, evidence-based profile, explainable confidence, working passive-recognition and repeated-review-failure patterns, deterministic correction engine with an honest unsupported state, working diagnostic, working dismiss/mark-inaccurate/delete-evidence/settings/opt-out/reset/export/recompute, working Reader/Practice/Progress/Today integrations, privacy and accessibility holding, tests passing, Preview ready, Production untouched, no active stub buttons.

## 16. Explicitly deferred

Paid LLM correction, voice/pronunciation/accent analysis, personality/intelligence claims, automatic Mission generation, full Today v2, global FSRS rollout, new pricing tier, teacher/parental dashboards, social comparison/leaderboards, AI chat tutor. None started, scaffolded, or implied as "coming soon" in any copy.

## 17. Known limitations

Reading-side evidence has no history table (`vocabulary_items.level`/`status` transitions are point-in-time only) — "improving vs. resolved" status for reading-derived patterns can only be inferred at recompute time, not from a true log, until a future history table is added (not proposed now). The correction-rule engine will have real false positives/negatives by design — every result must visibly carry "может быть неточно." Choice/Type/Match's binary-collapsed grading means any pattern assuming graded nuance (1/3) must explicitly account for which mode produced each `review_log` row.

## 18. Free-only constraints

No OpenAI/Anthropic/paid-LLM/paid-TTS/paid-STT/paid-grammar/paid-embeddings/paid-pronunciation/paid-learning API anywhere in v1. Confirmed no NLP dependency exists in `package.json` today; none added. Self-hosted LanguageTool remains a documented *future option* (open-source license, but real new infrastructure — an ops decision, explicitly not part of v1).

## 19. No-LLM behavior

Every Language Twin output — pattern, strength, recommendation, correction, diagnostic result — is produced by a deterministic function with a traceable rule/threshold, never a model call. `FSRS_ENABLED` is not touched and stays whatever it already is in each environment. No hidden AI inference of any kind, anywhere in this feature.

## 20. Roadmap after Slice 5

Missions generated from patterns/recommendations (structurally compatible, not implemented); Today v2 full redesign; word-level history table enabling true improving/resolved tracking on the reading side; optional self-hosted LanguageTool as a richer correction engine (infra decision); broader analytics-payload enforcement test generalized beyond the current Slice-4-scoped regex check.
