# M3 Unified UI — Slice 6: Missions v1

Status: **in progress**. Durable source of truth for Slice 6 — read this first if resuming in a new session, before re-deriving anything from chat history. Production already contains Slice 1 (App Shell + Today), Slice 2 (Progress + Settings), Slice 3 (Library + Reader), Slice 4 (Practice/Brain/Review), Slice 4.1 (accessibility cleanup), Slice 5 (Language Twin v1, merged as `f2bd582`).

**Base commit for this branch**: `f2bd582222ea1ac34d80e56ab017180fafcd77a6` (`origin/main` tip at branch-creation time — confirmed to contain the Slice 5 Language Twin merge before `feature/missions-v1` was cut from it). Local `main` was found stale/diverged (1 unpushed commit, missing Slices 3–5) during the audit — `feature/missions-v1` was deliberately branched from `origin/main` directly, not from local `main` or the old unmerged `feature/language-twin-v1`, to avoid building on stale ground.

## 1. Approved sources of truth

- **Interactive artifact** (visual/interaction/UX contract, approved in full): https://claude.ai/code/artifact/b529aa19-28de-4a94-804b-2fe5e61a91b3
- **Audit + product report** (delivered in-chat, product/data-model contract) — summarized in full below; not re-litigated, only implemented.

Approved 2026-08-07 ("ARTIFACT И PRODUCT MODEL MISSIONS v1 ОДОБРЕНЫ ПОЛНОСТЬЮ"). Every screen, IA decision, and data-model direction below traces back to one of these two documents.

## 2. Product model

**Missions are not a generic quest list.** A Mission is a short, personal, explainable next step, generated deterministically from Language Twin state. Core loop:

```
Language Twin (pattern/evidence/confidence)
  → Mission generated (deterministic, no LLM)
  → user completes a measurable exercise
  → mission_result evidence recorded
  → recomputeLanguageTwin()
  → pattern status/trend may shift
  → Today / /language-twin reflect the new state
```

Mission code **never** writes to `language_error_patterns` directly — only `evidence → recompute → engine decides`, identical discipline to the correction-evidence pattern-source added in Slice 5.

No fake gamification: no XP farming, no coins/store, no leaderboard, no loot boxes, no streak pressure beyond what already exists (`profiles.streak_current`). Missions may show completion/progress/a light streak-of-completed-missions — never drive the product with it.

## 3. No second application

Missions live entirely inside the existing App Shell (`src/components/product/app-shell/`), the existing sidebar/bottom nav, the existing `PageHeader`/sub-header pattern built for Language Twin in Slice 5. No second shell, no Missions-specific nav bar, no horizontal internal tabs. Mission sub-routes reuse the exact "Мой английский"-style eyebrow + "← Назад" back-link component pattern (`src/app/(app)/language-twin/sub-header.tsx`) — the same fix applied to Language Twin after its own "feels like a separate app" incident.

## 4. Audit findings (verified against `origin/main` + `feature/language-twin-v1`, file:line, not assumed)

**Reusable today, zero new capability needed:**
- Targeted sessions: `review/page.tsx`'s `wordIds` searchParam → `.in("flashcard_id", wordIds)` scoped to `flashcards.owner_id = profile.id` — bypasses due-date/daily-limits, never touches FSRS scheduling.
- Grading primitive `reviewWord(flashcardId, grade: 0|1|2|3)` — feeds `srs_state`, `review_log`, streak, achievements, XP automatically; any mission using it inherits all of that for free.
- Choice/Type/Match components take a plain `ReviewCard[]` prop — reusable verbatim for a 5-card targeted mission.
- `getLanguageTwinUpdateAction()` (Slice 5) — already forces recompute post-session and surfaces the most-recently-touched pattern; the template for the mission result's Language Twin section.
- `recordEvidence()` + 6 real evidence types already wired and gated by `language_twin_settings` toggles.
- `isoWeekStart()` + `getReviewsThisWeekCount()` — the exact aggregation shape "Missions completed this week" should copy.

**Missing, needed for v1:**
- No session-duration tracking anywhere in Practice (no start/end timestamp). Mission Player will track its own `started_at`/`completed_at` in `mission_attempts` — does not touch Practice/Brain analytics globally.
- No "N sessions completed" counter primitive (only day-level streak + one best-session-size record exist).
- No exercise runner for freshly-generated grammar/correction questions — only real flashcard review exists. This is the one genuinely new UI component (§9).
- No `mission_result` evidence type, no mission-derived pattern-source in `recomputeLanguageTwin`.

## 5. Mission types — v1 scope

| Type | v1 status | Mechanism |
|---|---|---|
| `vocab_activation` | **Built** | Targeted `wordIds` session, Type mode preferred |
| `review_recovery` | **Built** | Targeted `wordIds` session from Again/Hard cards, FSRS untouched |
| `phrase_activation` | **Built** | Targeted `wordIds` session over phrase flashcards |
| `maintenance` | **Built** | Same runner as grammar, seeded from `improving`/`resolved` high-confidence patterns |
| `grammar_pattern` | **Built** | New deterministic exercise runner (§9) |
| `correction` | **Built** | Same new runner, seeded from `correction_*` patterns |
| `diagnostic_followup` | **Built** | Same new runner, seeded from weak diagnostic `byTag` categories |
| `onboarding` | **Built** | Generic, explicitly non-personalized, used only in the empty state |
| `reading` | **Deferred v1** — see §16 | — |

## 6. Data model (migration `0037_missions.sql`)

```sql
create table missions (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references profiles(id) on delete cascade,
  mission_type              text not null check (mission_type in (
    'grammar_pattern','vocab_activation','review_recovery','reading',
    'phrase_activation','correction','diagnostic_followup','maintenance','onboarding'
  )),
  source_pattern_id         uuid references language_error_patterns(id) on delete set null,
  source_recommendation_id  uuid references language_recommendations(id) on delete set null,
  title                     text not null,
  reason_key                text not null,
  skill_category            text,
  difficulty                text not null check (difficulty in ('easy','medium','hard')),
  estimated_minutes         int not null check (estimated_minutes > 0),
  step_count                int not null check (step_count > 0),
  status                    text not null default 'available' check (status in (
    'available','started','completed','dismissed','expired','replaced'
  )),
  priority                  text not null check (priority in ('high','medium','low')),
  fingerprint               text not null,
  payload_json              jsonb not null default '{}'::jsonb,
  algorithm_version         int not null default 1,
  generated_at              timestamptz not null default now(),
  started_at                timestamptz,
  completed_at              timestamptz,
  dismissed_at              timestamptz,
  expires_at                timestamptz not null
);

create table mission_attempts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references profiles(id) on delete cascade,
  mission_id         uuid not null references missions(id) on delete cascade,
  started_at         timestamptz not null default now(),
  completed_at       timestamptz,
  correct_count      int not null default 0,
  incorrect_count    int not null default 0,
  duration_seconds   int,
  current_step       int not null default 0,
  answers_json       jsonb not null default '[]'::jsonb,
  evidence_generated boolean not null default false,
  created_at         timestamptz not null default now()
);
```

**No `mission_steps` table.** Steps are deterministically generated from a curated, versioned question bank (same philosophy as `src/lib/language-twin/diagnostic.ts`'s fixed bank and `correction-rules.ts`'s curated rules) and **frozen into `payload_json` at generation time** — a mission's exact 5 questions are decided once, at `generated_at`, and never regenerated from a live "current" bank version. This guarantees a mission never changes mid-flight after a deploy bumps `algorithm_version`. Tradeoff accepted: no per-user question variation in v1 (deferred, §16) — this needs a real steps table later if pursued, not built speculatively now.

**Indexes:**
```sql
create index missions_user_idx on missions(user_id);
create index missions_user_status_idx on missions(user_id, status);
create index missions_user_generated_idx on missions(user_id, generated_at);
create index missions_user_expires_idx on missions(user_id, expires_at);
create unique index missions_active_fingerprint_idx on missions(user_id, fingerprint)
  where status in ('available', 'started');

create index mission_attempts_user_idx on mission_attempts(user_id);
create index mission_attempts_mission_idx on mission_attempts(mission_id);
create index mission_attempts_user_created_idx on mission_attempts(user_id, created_at);
create unique index mission_attempts_active_idx on mission_attempts(mission_id)
  where completed_at is null;
```

The second unique index is the database-level guarantee behind §11 (idempotent generation) and §12 (idempotent start) — a duplicate "start mission" call cannot create two open attempts for the same mission; the server action catches the constraint violation and returns the existing open attempt instead.

**RLS** — identical pattern to `0036_language_twin.sql`:
```sql
alter table missions enable row level security;
create policy "missions: owner full access" on missions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on missions to authenticated;

alter table mission_attempts enable row level security;
create policy "mission_attempts: owner full access" on mission_attempts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on mission_attempts to authenticated;
```

No service-role usage anywhere in Missions — nothing here needs to bypass RLS.

## 7. Generation engine

**Trigger**: on-demand, at Today load — check for existing `status in ('available','started')` missions first (started always wins, never replaced by regeneration); only generate if none exist or the newest `available` one is stale (>24h).

**Inputs**: active/improving `language_error_patterns` (severity, confidence, trend, `evidence_count`, `updated_at`), pending `language_recommendations`, this user's mission history (`generated_at`, `completed_at`, `dismissed_at`, `fingerprint`), `getDueCount()`, `getReviewsThisWeekCount()`.

**Ranking** (deterministic, never shown to the user as a number):
```
score = severity_weight[severity]        // high=3, medium=2, low=1
      + confidence_weight[confidence]    // high=2, medium=1, low=0
      + recency_bonus                    // +1 if pattern touched in last 3 days
      - cooldown_penalty                 // effectively excludes: same fingerprint completed <12h or dismissed <48h ago
      - duration_penalty                 // -1 if adding this mission pushes today's total estimated minutes over ~10
```
Take the top-scoring candidates, **hard cap 3**, **max one mission per `source_pattern_id`**, never regenerate a fingerprint under cooldown.

**Priority bucket** (display only): `high` = active pattern + high confidence + repeated recent evidence; `medium` = improving pattern, activation/recall gap, or recent Hard/Again; `low` = maintenance, reading, exploration.

## 8. Lifecycle, fingerprint, cooldown, expiry

**Statuses**: `available → started → completed`; `available → dismissed`; `available → expired` (never opened, past `expires_at`); `available → replaced` (generator found a materially better candidate for the same pattern before this one was touched). **`started` is never auto-expired or auto-replaced mid-session** — a mission that's in progress may finish even past its original `expires_at`; expiry is only checked/enforced against `available` missions at generation/list time.

**Fingerprint**: `sha256(mission_type + ':' + (source_pattern_id ?? source_recommendation_id ?? 'generic') + ':' + skill_category + ':' + algorithm_version)`, truncated to a stable hex string. Combined with the partial unique index (§6), this makes duplicate-prevention a database guarantee, not application-logic hope — two concurrent generation calls can't create two rows with the same active fingerprint.

**Cooldown**: `completed` blocks regeneration of the same fingerprint for **12h**; `dismissed` blocks it for **48h**. Computed from `missions.completed_at`/`dismissed_at` at generation time — no separate cooldown table.

**Expiry**: pattern-based missions (`grammar_pattern`, `correction`, `diagnostic_followup`, `maintenance`, `vocab_activation`, `review_recovery`, `phrase_activation`) get `expires_at = generated_at + 48h`; `onboarding` gets `+24h`.

## 9. Grammar/Correction exercise runner (the one new UI component)

A lightweight, deterministic, versioned question bank — same shape as `src/lib/language-twin/diagnostic.ts`'s fixed 6-question bank, extended to cover every category the deterministic engine can honestly detect: missing auxiliary (Present Continuous), subject-`be` agreement, articles (heuristic, low-confidence framing preserved), prepositions, possession, fronted-adverb word order, malformed passive participle, gerund/infinitive verb-choice. **No question is written for a category the engine can't honestly grade** (no speech, no open-ended writing scoring). Grading is multiple-choice/short-answer exact-match — never routed through `reviewWord`/FSRS; grammar missions never touch `srs_state` or `review_log`.

## 10. Resume architecture

**Server-authoritative**: `mission_attempts.current_step` + `answers_json` is the source of truth, updated after every submitted step. Chosen over localStorage-as-source-of-truth because losing progress silently on a new device/incognito/cleared-storage would be a worse failure mode than the small extra write per step — and results must reach the server anyway for the evidence loop to work. localStorage is permitted only as a *temporary* cache of the current unsent answer (network-flake protection), never as the resume mechanism itself.

## 11. Completion rules

Grammar/Correction/Diagnostic-followup/Maintenance: all `step_count` steps submitted (regardless of score — completion ≠ perfection). Vocab/Review-recovery/Phrase-activation: the underlying targeted Practice session's real completion signal fires. No mission is ever completed by a bare button click with no underlying measurable event.

## 12. Evidence loop + dedup

New evidence type `mission_result`, written once via the existing `recordEvidence()`, `confidence` derived from correct-ratio. Dedup uses `mission_attempts.evidence_generated` with an atomic compare-and-set: `update mission_attempts set evidence_generated = true where id = $1 and evidence_generated = false returning id` — only the caller that receives a row back writes evidence; a concurrent/retried completion request gets nothing back and skips, guaranteeing exactly one `mission_result` row per attempt even under a network retry race.

## 13–15. Integration (Language Twin / Practice / Today / Progress)

- **Language Twin** (`/language-twin`): "Сейчас в фокусе" gains "Последняя практика: сегодня" once a mission touches that pattern; its existing link becomes "Потренировать сейчас →" into Mission Details. No new nav area.
- **Practice**: zero changes to Brain/Practice pages — missions link *into* `/brain/[deckId]/review?wordIds=...` and reuse `SessionComplete` + `getLanguageTwinUpdateAction` verbatim.
- **Today**: one new conditional card, same gating shape as `LanguageTwinSummaryCard` (`kind !== "hidden"`), showing 1 primary mission + compact access to up to 2 more. No Today v2, no layout rewrite.
- **Progress**: one new stat pair ("Missions completed this week" / "skills touched"), computed with the same `isoWeekStart()` shape as `getReviewsThisWeekCount`.

## 16. Reading Mission — deferred, with proven reason

`reading_sessions` (`started_at`, `ended_at`, `words_looked_up`) exists and is real, but there is **no mechanism today to associate a specific reading session with a specific mission** — `finishReading()` has no concept of "this session counts toward mission X," and building one honestly requires either (a) a new column linking `reading_sessions` to an active mission (a real, if small, schema change beyond the approved `missions`/`mission_attempts` tables), or (b) polling elapsed session time client-side in a way that can't be tied to a specific measurable server event. Neither is a one-line addition. **Deferred to a follow-up slice, not silently dropped** — this is an honest architecture limitation, not a shortcut.

## 17. Analytics (privacy-safe)

Events: `mission_impression`, `mission_opened`, `mission_started`, `mission_step_completed`, `mission_completed`, `mission_dismissed`, `mission_resumed`, `mission_result_viewed`. Payload: `mission_type`, `skill_category` (enum), `difficulty`, duration bucket, `step_count`, `completion: boolean`, `priority`. Never: sentence/word/phrase/translation/correction/material content/free-form answer text — enforced by extending the existing `language-twin-privacy.spec.ts` regex test to the new mission files.

## 18. Accessibility

Keyboard-reachable Mission Player, `aria-live` feedback region, correct/incorrect shown via icon+text+color (never color-only), visible focus management after each step transition and after mission completion, 44px touch targets, `prefers-reduced-motion` respected, WCAG AA in both themes, no horizontal overflow at 200% zoom — same baseline Slice 4.1 already established project-wide.

## 19. Rollback strategy

Migration `0037` is purely additive (two new tables, no alters to existing tables) — rollback is `drop table mission_attempts; drop table missions;` with no data-loss risk to any existing feature. If Missions needs to be disabled post-deploy without a rollback, the Today/Language Twin integration points are single conditional blocks (mirroring how `LanguageTwinSummaryCard` is gated) — commenting them out fully hides the feature without touching schema.

## 20. Implementation phases

- **Phase A** (this doc + migration + RLS + generator/ranking/fingerprint engine + attempts persistence) — stops at the **migration checkpoint** for explicit approval before applying `0037` to the shared Preview/Production Supabase project.
- **Phase B** — Today Mission card, Mission Details, Mission Player (grammar runner + targeted-practice reuse), Result, Resume, History, empty/low-confidence states.
- **Phase C** — Language Twin/Practice/Progress integration, `mission_result` evidence + recompute pattern-source.
- **Phase D** — privacy/analytics/accessibility/security/idempotency hardening, e2e, full check suite, Draft PR + Preview.

## 21. Definition of Done

See the final report delivered at the end of implementation (43-point list mirrored from the approved brief) — not duplicated here to avoid drift between two copies; this doc is the living technical record, the final chat report is the completion attestation.

## 22. Deferred (explicitly out of v1)

Reading Mission (§16, proven limitation), AI-generated mission text, paid LLM, social/leaderboard, coins/store/loot economy, teacher/parent dashboards, full Today v2, new pricing tier, per-user infinite generated grammar questions, speech/pronunciation missions, push notifications for missions specifically.
