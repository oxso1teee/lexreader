# M3 Unified UI — Slice 9: Onboarding + Placement v2

Status: **in progress**. Durable source of truth for Slice 9 — read this first if resuming in a new session. Production already contains Slice 1–8 (App Shell/Today, Progress/Settings, Library/Reader, Practice/Brain, Language Twin v1, Missions v1, Today v2, Learning Paths v1, PR #20).

**Base commit for this branch**: `b315bdb422b02c13cf40aecf3bcb8c231d44b443` (`origin/main` tip at branch-creation time — the Learning Paths v1 squash merge). `feature/onboarding-placement-v2` was cut directly from `origin/main`.

The Claude-artifact UX mockup from the audit phase (https://claude.ai/code/artifact/872eb29a-f901-4822-8410-5412079c7eab) is **explicitly rejected as a UI source of truth**. Its product/technical research (schema shape, scoring model, reuse targets) is retained below; its visuals are not implemented anywhere. All UI in this slice is built from real LexReader components/tokens.

## 1. Current-state audit (condensed — full findings were delivered in-chat before this doc)

- **"Onboarding complete" today = a `profiles` row exists**, full stop. `completed_first_win` (bool, `0023`) exists but gates nothing except one URL (`/onboarding/first-win`).
- **No DB trigger creates `profiles`.** Single client-triggered insert in `completeOnboarding` (`src/app/onboarding/actions.ts`). A failed insert after a successful `auth.signUp` strands a real `auth.users` row with no recovery path in existing code — fixed in this slice (§9).
- **No goal field exists anywhere.** Fields collected today: target language (English-gated) → native language → `level` (`beginner`/`intermediate`/`advanced`, not CEFR) → `daily_word_goal` (5/10/20/30) → email/password.
- **`profiles.level` usage audit (re-verified fresh on this branch, not reused from stale memory)**: read in exactly 2 places — `src/app/(app)/settings/page.tsx:35` (Settings display/edit) and `src/app/(app)/language-twin/page.tsx:184` → `how-calculated.tsx` (labeled **"Самооценка при регистрации"**, shown next to `diagnosticLevelRange`/`behavioralLevelRange`). Written in exactly 2 places — `completeOnboarding` and `settings/actions.ts`'s `updateProfile`. Small, well-contained field — but repurposing its *values* (`beginner/intermediate/advanced` → CEFR letters) would require fabricating a backfilled CEFR guess for every existing user's already-stored value, which is dishonest. **Decision: `profiles.level` is left untouched, still legacy/compatibility-only. A new column carries the CEFR self-report** (§8).
- **Language Twin's existing mini-diagnostic already does most of what Placement needs**: 6 MC questions, deterministic scoring, coarse range output, `language_evidence` persistence, `diagnostic_level_range` on `language_twin_profiles`. Placement v2 is this diagnostic's larger front-door sibling, not a new engine — and does not replace it (the existing diagnostic stays available as a deeper Language Twin tool).
- **Grammar Bank v2** (82 questions, 12 categories, `src/lib/missions/grammar-bank.ts`) has no per-question difficulty tag. Placement adds its own thin difficulty-tier layer on top, in a new module, without touching `grammar-bank.ts`.
- **Knowledge Check runner** (`check-runner.tsx`) is a strong reuse reference for the placement question UI, with one real behavioral difference: placement shows **no per-question correctness feedback** (deferred to the Result screen, to avoid anchoring later answers), so it's a sibling component, not a verbatim import.
- **`recommendPath()`** (`src/lib/learning-paths/recommendation.ts`) already deterministically maps a level range to `a2-b1`/`b1-b2`. Left unmodified; a new additive `recommendPathFromPlacement()` in the same file adds the goal-driven topical alternative.
- **Starter decks** exist, work, and are currently disconnected from onboarding — out of scope for this slice (not required for a real first action; Learning Paths' own first skill fills that role).

## 2. Product principle

Placement v2 never claims an official level. Every range uses the **existing** diagnostic's own vocabulary and shape, verified byte-for-byte against `diagnosticLevelRange()` (`src/lib/language-twin/diagnostic.ts:104-111`) — exactly `A1–A2 | A2–B1 | B1–B2 | B2+` (4 buckets, not 5 — no standalone "A2"), one range vocabulary app-wide. Self-report, placement, and Language Twin's behavioral estimate are three separately labeled signals, never merged.

## 3. Flow

```
SIGN UP → GOAL → SELF-REPORTED LEVEL → PLACEMENT (skippable) → RESULT
  → RECOMMENDED PATH → USER CONFIRMS → FIRST REAL ACTION → FIRST WIN → TODAY
```

6 pre-account/pre-placement decision screens (goal, target language, native language, self-level are the "profile basics"; signup is the account step — same total screen count as today's wizard, `goal` is the only net-new mandatory screen). `daily_word_goal` is **removed from the critical path** — defaults to the existing DB default (10), editable later in Settings exactly as today.

## 4. Goal

New enum, 7 values, matching the brief exactly:
`everyday | travel | work_it | study | friends_international | reading_content | general`.
One primary goal only for v1 — no secondary goal field (the recommendation engine only ever needs one topical signal; adding a second would be speculative schema per the brief's own instruction).

## 5. Self-reported CEFR level

New value set for placement's own self-report step: `A1 | A2 | B1 | B2 | unsure`. Stored in a **new** column, not `profiles.level` (see §1). Needs to persist beyond a single placement attempt (a skipped-placement user still has a self-report), so it lives on `profiles`, matching precedent (`level`, `daily_word_goal` are also permanent profile-level settings, not attempt-scoped).

## 6. Placement v2

Deterministic, no AI, no external API, no official CEFR claim. **10 fixed questions**, one at a time, no correctness feedback until the Result screen. Composition (reuses real `GRAMMAR_QUESTION_BANK` entries via `buildGrammarQuestionSet` — **no duplicated question text**, `grammar-bank.ts` itself untouched):

| Tier | Weight | Categories (1 question each) |
|---|---|---|
| Foundational (4) | 1 | `tense/present_simple`, `tense/present_continuous`, `word_order`, `question_formation` |
| Intermediate (3) | 2 | `article`, `preposition`, `modal` |
| Upper (3) | 2.5 | `passive`, `relative_clause`, `conditional` |

`PLACEMENT_VERSION = 1`. Same version → same 10 questions for everyone (seeded, deterministic — mirrors the Knowledge Check's own "same skill key → same questions" precedent).

## 7. Scoring, range, confidence

Weighted score = `Σ(weight for correct) / Σ(weight for all 10)`. **Foundation floor**: 2+ missed foundational answers caps the range at `A1–A2` regardless of upper-tier correctness (a correct hard-question guess never overrides a shaky foundation). Range buckets: `ratio ≥ 0.85 → B2+`, `ratio ≥ 0.6 → B1–B2`, `ratio ≥ 0.35 → A2–B1`, else `A1–A2` — same thresholds and same 4-value vocabulary as the existing diagnostic's `diagnosticLevelRange()`, so a placement result and a Language Twin diagnostic result are always directly comparable. Confidence: `high` (all 10 answered, no tier inversion, self-report within 1 bucket of result), `medium` (tier inversion or self-report/placement mismatch), `low` (skipped or partial). No decimals, no "B1.6", no "Official B1" anywhere in copy.

## 8. Data model

**One new table + two new `profiles` columns + one new evidence source-type value.** No repurposing of existing fields (see §1/§5).

```sql
create table placement_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  version int not null default 1,
  status text not null default 'in_progress' check (status in ('in_progress','completed','skipped')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  question_count int not null default 0,
  correct_count int not null default 0,
  answers_json jsonb not null default '[]'::jsonb,
  result_range text,
  confidence text check (confidence in ('low','medium','high')),
  category_scores_json jsonb not null default '{}'::jsonb,
  recommended_path_slug text,
  self_reported_level_at_attempt text,
  primary_goal_at_attempt text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles add column primary_goal text
  check (primary_goal in ('everyday','travel','work_it','study','friends_international','reading_content','general'));
alter table profiles add column self_reported_cefr text
  check (self_reported_cefr in ('A1','A2','B1','B2','unsure'));

alter table language_evidence drop constraint if exists language_evidence_source_type_check;
alter table language_evidence add constraint language_evidence_source_type_check
  check (source_type in ('flashcard','vocabulary_item','correction_submission','diagnostic_session','placement_session'));
```

`answers_json` is `[{question_id, category, difficulty_tier, correct}]` only — **never prompt/option text**. RLS: identical owner-only idiom to every table since `0036` (`user_id = auth.uid()`, single `for all` policy, `authenticated` grant — the known `service_role` grant gap that exists on every table since migration `0008` is not being closed here, same as it wasn't in `0038`/`0039`). Full SQL, rollback, and verification queries are produced separately per the brief's explicit STOP-before-shared-apply requirement.

## 9. Profile-creation orphan fix (§19 of the brief)

`completeOnboarding` (`src/app/onboarding/actions.ts`) is made idempotent:
1. On `auth.signUp` returning "already registered" (meaning a prior attempt got this far), fall back to `signInWithPassword` with the same credentials instead of erroring into a dead end.
2. Profile insert becomes `upsert(..., { onConflict: "id" })` — safe to retry.
3. Default-deck creation checks for an existing `is_default` deck for the user before inserting, preventing a duplicate on retry.

This closes the redirect-loop risk without new schema. Regression test added (§16).

## 10. Onboarding resume — no new "current step" field

Resume is **fully derived**, never a separately-stored enum that can drift from reality:

```
no profiles row               → /onboarding (pre-account wizard)
profiles row, no placement_attempts row → placement intro
in_progress attempt           → resume at question (answers_json.length + 1)
completed/skipped attempt, no active enrollment → result / path screen
active enrollment, completed_first_win = false  → first action
completed_first_win = true    → /home (fully onboarded)
```

Implemented as a pure function `deriveOnboardingStep(profile, latestAttempt, activeEnrollment)` in `src/lib/onboarding/state.ts`, unit-tested against every case above plus the ambiguous edges (multiple attempts, skipped-then-retaken, enrollment paused before first action).

## 11. Existing-user grandfathering

`completed_first_win` is **reused as-is** as the master gate — not repurposed in meaning, just relied upon as already being `true` for every existing account (backfilled by `0023` for pre-existing users, naturally set for everyone who completed the old first-win tutorial since). `deriveOnboardingStep` returns "fully onboarded" for any profile with `completed_first_win = true`, regardless of whether placement/goal were ever set — so no existing user is ever routed into onboarding v2. Placement v2 becomes available to them **only** as an opt-in entry point from Language Twin (§14).

## 12. Learning Paths integration

`recommendPathFromPlacement({ range, confidence, selfReportedCefr, primaryGoal })` — new, additive function in `src/lib/learning-paths/recommendation.ts`. Primary path: same range→path logic as the existing `recommendPath()` (never modified). Alternative: `everyday/travel/friends_international → everyday`, `work_it → it-english`, `study/reading_content/general → none`. Enrollment goes through the existing, unmodified `startPathAction` — never silent auto-enroll, user must tap "Выбрать".

## 13. Language Twin integration

New `EvidenceSourceType` value `'placement_session'` (additive, §8). A new branch in `recompute.ts` (mirroring the existing `diagnostic_result` handling, same file, same pattern) writes one low/medium-confidence evidence row per weak category from a completed placement — **never mutates pattern status directly**. The existing corroboration rule in `confidence.ts` (single source capped at 0.69, never "high") applies unchanged — no changes needed there. One wrong placement answer cannot create a severe, permanent weakness.

## 14. Settings / Language Twin surface

Language Twin's existing "How is this calculated" dialog (`how-calculated.tsx`) gains a third row — **Placement**, alongside the existing **Самооценка при регистрации** and **Мини-диагностика** rows — never merged into one number. Settings gets one compact link row ("Диагностика английского"), not a dashboard.

## 15. Missions

Not touched in this slice. First action goes directly to a real Learning Paths Skill (§16) — no fabricated Mission, no forced generation. The existing engine (`getOrGenerateActiveMissions`, dedup/cooldown/ranking) is free to naturally pick up placement-derived Language Twin evidence later, exactly as it already does for the existing diagnostic's `fetchDiagnosticFollowupCandidates` path — no new code required for this slice.

## 16. First action / first win

The user's own `findCurrentFocusSkill()`-selected first Skill (existing Learning Paths logic, unmodified) → its real Knowledge Check. Any completion bucket (`strong`/`mixed`/`weak`) counts as first win — matches existing `progress-engine.ts` semantics. `completed_first_win = true` on completion; onboarding is complete; redirect `/home`. Today's existing hero/secondary-card logic (confirmed working in the PR #20 release audit) needs no changes.

## 17. Analytics (closed list, enum/count/boolean only)

`onboarding_started, onboarding_goal_selected, onboarding_level_selected, placement_started, placement_question_answered, placement_completed, placement_skipped, recommended_path_viewed, learning_path_selected_from_onboarding, onboarding_first_action_started, onboarding_first_win_completed, onboarding_completed, onboarding_resumed`. `placement_question_answered` payload: `question_id` (enum), `difficulty_tier` (enum), `correct` (boolean) — never prompt/option text. Enforced by a new `e2e/onboarding-placement-privacy.spec.ts` using the identical `FORBIDDEN_PATTERN` regex + non-vacuous-call-count idiom as `missions-privacy.spec.ts`/`learning-paths-privacy.spec.ts`.

## 18. Accessibility

Same established codebase patterns, reused not reinvented: keyboard nav, `aria-live` progress ("Вопрос 4 из 10"), 44px targets, non-color feedback, `prefers-reduced-motion` (already global), dark/light (existing tokens only, no new palette), no horizontal overflow, 200% zoom.

## 19. Security

Server validates every transition via the derived-state model (§10) — client can never claim to be further along than the DB shows. Question set is server-generated at attempt creation and stored on the row, not client-chosen. Scoring is server-side only (matches existing Knowledge Check precedent). Recommendation computed server-side from the stored result. Enrollment goes through the existing, already-validated `startPathAction`.

## 20. Tests

Unit: placement question-set composition/uniqueness, scoring (incl. foundation floor), confidence, range mapping, `recommendPathFromPlacement`, `deriveOnboardingStep` (every resume case + existing-user grandfathering), profile-creation idempotency. E2E: full new-user flow, skip-placement flow, mid-test resume, existing-user-not-forced, profile-creation-retry, privacy, accessibility.

## 21. Rollback

`placement_attempts`, `profiles.primary_goal`, `profiles.self_reported_cefr`, and the `language_evidence` source-type widening are all purely additive — rollback is `drop table placement_attempts;` + `alter table profiles drop column primary_goal, drop column self_reported_cefr;` + re-narrowing the `language_evidence` check constraint (safe only if no row uses `'placement_session'` yet — verified by query before running, same pattern as `0039`'s own rollback comment).

## 22. Implementation phases

**A** (this doc + placement engine + onboarding state/resume + orphan fix + migration + local checkpoint) — **stops for explicit confirmation before the shared Preview/Production Supabase apply**, per the brief. **B** (onboarding UI: goal/level/placement runner/result screens, built from real LexReader components). **C** (path recommendation/enrollment UI, Language Twin bootstrap, first action/first win wiring). **D** (Today handoff verification, Settings/Language Twin surface, analytics/privacy, accessibility, mobile/dark, e2e, Draft PR + Preview).

## 23. Deferred (explicitly out of v1)

AI interview, speech/pronunciation assessment, essay grading, official CEFR certification, adaptive IRT/CAT scoring, paid placement APIs, webcam/mic, teacher review, social onboarding, referral flow, upsell/paywall in the first minute, secondary goal, hard DB-enforced retake cooldown.
