# M3 Unified UI — Slice 8: Learning Paths v1

Status: **in progress**. Durable source of truth for Slice 8 — read this first if resuming in a new session. Production already contains Slice 1–7 (App Shell/Today, Progress/Settings, Library/Reader, Practice/Brain, accessibility cleanup, Language Twin v1, Missions v1, Today v2).

**Base commit for this branch**: `d666a6c2dcad55dca2e652f9e3cb7bf3dd47a2cf` (`origin/main` tip at branch-creation time — the Today v2 merge). `feature/learning-paths-v1` was cut directly from `origin/main`.

## 1. Approved sources of truth

- **Interactive artifact** (product/UX/curriculum/data-model contract, approved in full): https://claude.ai/code/artifact/b9188f7b-b7c7-4004-a28a-07f2367184a4
- **Audit + product report** (delivered in-chat) — summarized below, not re-litigated, only implemented.

## 2. Core architecture

`Path → Stage → Module → Skill`. **Skill is the atomic unit.** Activities (Lesson, Knowledge Check, Mission, Practice, Reader) are generated *from* a skill at render time — never their own persisted curriculum row. No third exercise engine: Knowledge Check reuses the Grammar Runner's question-bank mechanics; "Potренировать" reuses the existing Missions pipeline unchanged.

## 3. Static versioned curriculum (not DB)

Curriculum lives as versioned TypeScript in `src/lib/learning-paths/curriculum/{slug}.v{n}.ts`, mirroring the precedent already set by `starter-decks.ts` and `grammar-bank.ts` — no CMS, type-safe, reviewable, free, deterministic. Database holds only the two genuinely per-user tables: `learning_path_enrollments` and `user_skill_progress`.

## 4. Skill taxonomy — the honest gap, and how it's closed

Current `PatternCategory` (migration `0036`, plain `text` + inline `check`, **not** a Postgres enum type — confirmed by reading the migration, so extending it is a simple `alter constraint`, not `ALTER TYPE ADD VALUE`):
`activation, review_recall, article, preposition, word_order, tense, passive, gerund_infinitive, possession, collocation, spelling, other`.

**Extending it** (additive migration `0039`, see §9) with exactly 5 new values, matching the brief's "don't multiply categories" instruction:
`comparative, modal, relative_clause, conditional, question_formation`.

Grammar-bank (`src/lib/missions/grammar-bank.ts`) gets curated questions for the new categories **plus** fills the real pre-existing gap inside `tense` (today's 8 `tense_*` questions are all Present Continuous) by adding a `sub_topic` field so Present Simple / Past Simple / Present Continuous can each pull their own question subset from the same `tense` category — no schema change needed for this part, just richer static data.

`GRAMMAR_RUNNER_CATEGORIES` grows from 7 to 12. Correction-rule detection (`correction-rules.ts`) is extended **only** where a rule can be written honestly and deterministically (modals, comparatives, relative-clause relative-pronoun misuse) — conditionals and question-formation get Knowledge-Check/Mission coverage but **no** new correction-input detection rule in v1 (flagged explicitly in the taxonomy mapping table, not silently skipped).

## 5. Skill → Language Twin mapping (explicit table, versioned in code)

```ts
// src/lib/learning-paths/skill-mapping.ts
export const SKILL_CATEGORY: Record<string, PatternCategory | null> = {
  "grammar.present_simple": "tense",
  "grammar.present_continuous": "tense",
  "grammar.past_simple": "tense",
  "grammar.questions": "question_formation",
  "grammar.word_order": "word_order",
  "grammar.articles": "article",
  "grammar.prepositions": "preposition",
  "grammar.comparatives": "comparative",
  "grammar.modals": "modal",
  "grammar.passive": "passive",
  "grammar.relative_clauses": "relative_clause",
  "grammar.conditionals": "conditional",
  "grammar.gerund_infinitive": "gerund_infinitive",
  "vocabulary.active_recall": "activation",
  "vocabulary.phrase_building": null, // maps via mission_type phrase_activation, not a PatternCategory
  "reading.general": null,             // Reader-only, no Language Twin signal
  "writing.correction": null,          // maps via correction_submission evidence, not a single category
};
```
Disclosed, deliberate simplification: `present_simple`/`present_continuous`/`past_simple` **share** the single `tense` category's Language Twin confidence signal (per-skill fine-grained tracking comes from `user_skill_progress`'s own Knowledge Check/Mission history, not from Language Twin, which stays coarse). No unsupported skill ever claims a confidence number it can't back up — `SKILL_CATEGORY[key] === null` skills never render a Language Twin confidence badge.

## 6. Path outlines v1

**A2 → B1** (4 stages, ~18 skills) — Stage 1 Core Sentence Building (Present Simple, Present Continuous, Past Simple, Questions, Word Order), Stage 2 Everyday Grammar (Articles, Prepositions, Comparatives, Modals), Stage 3 Connected English (Passive, Relative Clauses, Conditionals, Gerund/Infinitive), Stage 4 Active English (Vocabulary Activation, Phrase Building, Reading, Writing/Correction).

**B1 → B2** (4 stages) — advanced tense/aspect usage (still `tense`-mapped, disclosed), advanced Passive/Conditionals/Relative Clauses, Collocations/Phrasal verbs (maps to `collocation`, no grammar-bank coverage — Practice-only, disclosed), Active vocabulary/Reading/Writing fluency.

**Everyday English** (4 topic stages: Introductions & small talk; Shopping/Transport/Housing; Health & Travel; Friends/Calls/Everyday problems) — vocabulary-activation-first, reuses `vocab_activation`/`phrase_activation` Mission types directly, no new grammar mapping needed.

**English for IT** (4 stages: Describing work & bugs; Git/GitHub & collaboration; Docs & requirements; Professional communication/interviews) — same shape as Everyday.

Both topic paths' Reader integration stays honestly narrow (§ below) — no topic-tag matching exists on `texts` yet.

## 7. Mastery model

6 states: `not_started → introduced → practicing → improving → confident → maintenance`. Confidence for a skill blends (a) the mapped category's Language Twin evidence where one exists, and (b) the skill's own `user_skill_progress` record (Knowledge Check score, Mission completions, `last_practiced_at` recency). **Content completion and skill confidence are always rendered separately** — never collapsed.

## 8. Knowledge Check / test-out

Reuses the grammar-bank question engine (`buildGrammarQuestionSet`-style deterministic seeded selection), scoped by `skill_key` instead of `PatternCategory` directly (a skill's Knowledge Check pulls its mapped category's question pool, optionally filtered by the skill's `sub_topic`). Result buckets: `strong` (≥80%) → skill → `confident`, auto content-complete; `mixed` (50–79%) → stays `practicing`, recommends a Mission; `weak` (<50%) → stays/reverts `introduced`. **A single click never marks a skill confident** — only a completed Knowledge Check or sustained Mission evidence can.

## 9. Data model — migration checkpoint (this doc records the plan; the actual SQL/verification is produced and shown in-chat per the brief's explicit STOP-before-shared-apply requirement)

```sql
-- 0038_learning_paths.sql
create table learning_path_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  path_slug text not null,
  path_version int not null default 1,
  status text not null default 'active' check (status in ('active','paused','completed')),
  current_stage_key text not null,
  current_module_key text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- partial unique index: at most one ACTIVE enrollment per user (one primary path)
create unique index learning_path_enrollments_one_active_idx
  on learning_path_enrollments (user_id) where status = 'active';

create table user_skill_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  path_slug text not null,
  path_version int not null default 1,
  skill_key text not null,
  status text not null default 'not_started' check (status in (
    'not_started','introduced','practicing','improving','confident','maintenance'
  )),
  evidence_count int not null default 0,
  confidence text not null default 'low' check (confidence in ('low','medium','high')),
  content_completed_at timestamptz,
  last_practiced_at timestamptz,
  knowledge_check_best_score numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, path_slug, path_version, skill_key)
);

-- 0039_language_twin_taxonomy_extend.sql (additive, no data loss — see §4)
alter table language_error_patterns drop constraint if exists language_error_patterns_category_check;
alter table language_error_patterns add constraint language_error_patterns_category_check
  check (category in (
    'activation','review_recall','article','preposition','word_order','tense','passive',
    'gerund_infinitive','possession','collocation','spelling','other',
    'comparative','modal','relative_clause','conditional','question_formation'
  ));
```
RLS: identical owner-only shape to every other user-scoped table in this schema (`user_id = auth.uid()`, full access, `authenticated` grant). Curriculum content itself is static code — no table, no RLS needed. Rollback: `drop table user_skill_progress, learning_path_enrollments;` for `0038`; `0039`'s rollback re-narrows the check constraint (safe only if no row uses a new category value yet — documented, not automated).

## 10. Enrollment / path switching

One active enrollment per user, enforced at the DB level (partial unique index above), not just in application code. Switching sets the old enrollment `status='paused'` and creates/reactivates the new one — progress rows in `user_skill_progress` are keyed by `(user_id, path_slug, path_version, skill_key)` so nothing is ever deleted on switch. Language Twin and Missions are entirely path-agnostic and untouched by switching.

## 11. Integration contracts (no engine changes)

- **Missions**: skill's "Потренировать" CTA calls the existing `getOrGenerateActiveMissions()` unchanged, then looks for an active mission whose `skill_category` matches the skill's mapped category. No match → honest empty state, never a manually-inserted duplicate mission.
- **Practice**: same targeted-session reuse Missions v1 already established (`wordIds`/`missionId` query params) — no FSRS changes, no fake grades.
- **Reader**: only the curated system texts (`texts.owner_id is null`, `level_tag` set) are recommendable by level. No topic matching.
- **Today**: hero stays authoritative. When the hero mission's `skill_category` matches the active path's focus skill, add a one-line attribution to the *existing* hero card (zero ranking change). Otherwise a slim secondary "Мой путь" card appears below it.
- **Progress**: one compact stat block (path slug, content %, current stage, skills improved).
- **Library/nav**: no new bottom-nav item (`/library` already owns the "Учиться" label — confirmed in the audit). Entry points: a card on Library's page, a contextual card on Today, and the feature's own `LearningPathsSubHeader` mirroring `LanguageTwinSubHeader`/`MissionsSubHeader`.

## 12. Analytics (closed list, enum-only payloads)

`learning_paths_viewed, learning_path_opened, learning_path_started, learning_path_paused, learning_path_resumed, learning_path_switched, stage_opened, skill_opened, lesson_completed, knowledge_check_started, knowledge_check_completed, stage_completed, learning_path_completed`. Payload: `path_slug` (enum), `path_version`, `skill_key` (enum), `stage_index`, `completion` (boolean), `confidence` (bucket). Never: sentence/word/phrase/answer/material content. Enforced by a new `learning-paths-privacy.spec.ts` mirroring the Missions/Language Twin privacy tests.

## 13. Security

Server re-validates on every mutation: enrollment/progress row belongs to the requesting user (never trust a client-supplied `user_id`), `path_slug`/`path_version` exists in the static curriculum registry, `skill_key` belongs to that exact path/version (a user cannot submit an arbitrary `skill_key` to mutate unrelated progress). Curriculum content is read-only code — no mutation surface at all.

## 14. Implementation phases

**A** (this doc + taxonomy + grammar-bank + curriculum files + schema + migration checkpoint) — stops for explicit confirmation before the shared Preview/Production Supabase apply. **B** (catalog/details/path-home/stage/skill/lesson screens + enrollment engine). **C** (Knowledge Check, Language Twin mapping, Missions/Practice/Reader integration). **D** (Today/Progress/Library, analytics, accessibility, tests, Draft PR + Preview).

## 15. Deferred (explicitly out of v1)

AI-generated lessons/exercises, paid CEFR APIs, official certification claims, topic-tag semantic Reader matching, admin CMS, multi-active-paths, DAG prerequisites (v1: ordered modules + optional prerequisite `skill_key` only), speech/pronunciation paths, teacher marketplace, course economy/leaderboards, new pricing tier.
