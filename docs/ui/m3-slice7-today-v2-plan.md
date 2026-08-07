# M3 Unified UI — Slice 7: Today v2

Status: **in progress**. Durable source of truth for Slice 7 — read this first if
resuming in a new session. Production already contains Slice 1 (App Shell +
Today v1), Slice 2 (Progress + Settings), Slice 3 (Library + Reader), Slice 4
(Practice/Brain/Review), Slice 4.1 (accessibility cleanup), Slice 5 (Language
Twin v1), and Missions v1 (Phase A–D, merged as `46c10583fa91e212eeea401bd8daf9ddcd3ee14a`).

**Base commit for this branch**: `46c10583fa91e212eeea401bd8daf9ddcd3ee14a` (`origin/main` tip at branch-creation time). `feature/today-v2` was cut directly from `origin/main`.

## 1. Trigger

The user shared a Today mockup after Missions v1 shipped: a single hero card
("Твой следующий шаг" — one specific mission with a personalized reason and
duration), a compact "Сегодня" list (due reviews / continue reading / new
recommendations), a compact "Мой английский" pattern list, and a "Прогресс
недели" widget (active days + missions completed). Asked directly whether
this was reference-only, a small polish, or a full redesign — the user chose
**full Today v2 redesign**.

## 2. Problem with Today v1

Today v1 (this slice's starting point) shows, in order: a generic primary
action (review / continue reading / add material), a "План на сегодня"
metrics grid, "Продолжить обучение", "Повторение", "Прогресс" metrics grid, a
"Миссии" section (up to 3 `MissionCard`s), then the full `LanguageTwinSummaryCard`
"Твой фокус сегодня". Several of these can describe the same underlying
Language Twin pattern from different angles (e.g. a `review_recovery` mission,
the due-reviews CTA, and the Language Twin focus card can all be about the
same weak vocabulary set) with no single obvious "what do I do right now."

## 3. What's reused verbatim (no rewrite)

- `decidePrimaryAction`, `dueCountBucket`, `greetingForHour` — `src/lib/today.ts`
- `getDueCount`, `getReviewsThisWeekCount` — `src/lib/brain-stats.ts`
- `getOrGenerateActiveMissions` — `src/lib/missions/persist.ts`
- `getLanguageTwinEntryState` — `src/lib/language-twin/summary.ts` (still used by `/progress`; Today stops rendering the full `LanguageTwinSummaryCard`)
- `PrimaryActionCard`, `ContinueLearningCard`, `ReviewSummaryCard` — unchanged components, exact same copy/analytics, just re-housed under one `SectionHeader`
- `CategoryBadge`, `StatusBadge`, `TrendIndicator`, `categoryLabel`, `reasonLabel` — `src/components/product/language-twin/badges.tsx`

## 4. New Today layout

1. Header (`PageHeader`, `InstallBanner`) — unchanged.
2. **Hero — "Твой следующий шаг"**:
   - `pickHeroMission(missions)` (new, `src/lib/missions/ranking.ts`) — prefers a `started` mission (most recent) over `available`; among `available`, sorts by `priority` (high > medium > low) then `generated_at` desc.
   - Mission present → `hero-mission-card.tsx`: headline (`Спринт: {categoryLabel}` for grammar-runner types, a fixed phrase per targeted type), reason line (real `evidence_count` via the pattern, or `reasonLabel(mission.reason_key)` fallback), `~N мин`, Начать/Продолжить → `/missions/{id}`, "Все миссии →" → `/missions`.
   - No mission → exactly the current `PrimaryActionCard` logic, unchanged — this is the compatibility guarantee for `e2e/unified-shell-today.spec.ts`'s two copy-asserting tests, neither of which seeds Language Twin evidence.
3. **Compact "Сегодня"** — one `SectionHeader`, then `ReviewSummaryCard` + `ContinueLearningCard` verbatim, plus a new "N новых рекомендаций" row (only when count > 0, linking to `/language-twin/recommendations`). The old "План на сегодня" metrics grid (due/daily-goal/words-saved) is dropped from Today — those numbers stay on `/progress`.
4. **Compact "Мой английский"** — up to 2 patterns inline (`{categoryLabel} — {statusPhrase}`), only rendered when at least one active/improving/uncertain pattern exists. Links to `/language-twin`. Replaces the full `LanguageTwinSummaryCard` on Today only.
5. **"Прогресс недели"** — `getMissionsCompletedThisWeek` (new, extracted into `src/lib/missions/persist.ts` from `/progress/page.tsx`'s inline query, then reused by both pages) + active-days-this-week (computed inline, same technique as `/progress`) + 🔥 streak. Replaces the old "Прогресс" grid (streak/reviewsThisWeek/materialsInProgress).
6. `ComingSoonCard` — unchanged, stays last.

## 5. Disclosed simplifications vs. the mockup

- Hero headline uses the real category label ("Спринт: Времена") — no schema field names a specific tense like "Present Continuous."
- Reason line uses real evidence-count phrasing ("Эта тема встречалась N раз(а)") — which specific word/form was missed isn't aggregated anywhere.
- The "Прогресс недели" card keeps the 🔥 streak metric alongside active-days and missions-completed (mockup shows only 2) — streak is the one number people check daily; dropping it silently felt like a regression.

## 6. Data model / migrations

None. Everything reads existing tables (`missions`, `language_error_patterns`,
`language_recommendations`, `reading_sessions`, `review_log`). No new columns,
no RLS changes.

## 7. Analytics

No new events. `today_primary_action_clicked` now only fires on the
no-mission fallback path (still privacy-safe, still the same properties).
`mission_impression` (already added in Missions v1) continues to cover the
hero-mission-shown case. Documented in `docs/ui/analytics-events.md`.

## 8. Compatibility contract

`e2e/unified-shell-today.spec.ts` and `e2e/unified-shell-a11y.spec.ts` must
pass **unmodified** — they encode the exact fallback copy ("Повторить" /
`/к повторению/` heading / "Добавить материал" → `/library/new` /
"Пока нет материала в процессе") that this redesign must not regress.

## 9. Deferred / out of scope

Everything not explicitly listed above: no changes to FSRS/SRS, Stripe/pricing,
Missions engine/schema, Language Twin engine, or any route other than `/home`
and the two small extractions in `/progress` and `ranking.ts`/`persist.ts`.

## 10. Implementation phases

Single phase — this is a page-composition change, not a new subsystem.
`pickHeroMission` + `getMissionsCompletedThisWeek` get unit tests; the page
itself is verified via the existing Today/a11y e2e specs plus a manual Preview
check of the hero-mission-present state (can't be seeded in e2e without real
Language Twin evidence).
