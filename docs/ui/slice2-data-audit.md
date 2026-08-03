# M3 UI Slice 2 — Progress + Profile/Settings data audit

Read before any code was written. Answers the 7 audit questions from the task.

## 1. What data already exists

| Field/metric | Source | Notes |
|---|---|---|
| `target_language`, `native_language`, `level`, `daily_word_goal` | `profiles` | Editable today via `updateProfile()` |
| `streak_current`, `streak_longest`, `last_active_date`, `streak_freeze_available/week` | `profiles`, updated by `touchStreak()` (`src/lib/streak.ts`) | Correct day-by-day logic (UTC dates), verified by reading the function in full |
| `review_best_session_count`, `xp`, `created_at`, `completed_first_win` | `profiles` | Read-only display candidates |
| Vocabulary counts (total/known/learning) | `vocabulary_items` | Already queried in old `/progress` |
| Cards created, answers given | `flashcards`, `review_log` | Already queried in old `/progress` |
| Due reviews right now | `getDueCount()` (`src/lib/brain-stats.ts`) | Already built for Today (PR #11), reused here |
| Reviews in trailing 7 days | `getReviewsThisWeekCount()` (`src/lib/brain-stats.ts`) | Already built for Today, reused here |
| Reading sessions (`started_at`, `ended_at`, `words_looked_up`) | `reading_sessions` | Written once per finished reading/watch session |
| Text completion (`percent_read >= 100`) | `text_progress` | Same criterion already used for the "Первая книга" achievement |
| Email | `auth.users` via `supabase.auth.getUser()` | Never stored on `profiles`; only place in the whole codebase it's read is Stripe customer creation |
| Subscription (`plan`, `status`, `current_period_end`, `stripe_customer_id`) | `subscriptions` | Already queried in full on `/pricing`; Settings only showed the plan name |

## 2. What can be honestly displayed

Everything in the table above. Additionally: distinct active days (derived from `reading_sessions`/`review_log` timestamps, no new column needed), "materials completed" (derived from `text_progress`, no new column).

## 3. What's missing entirely

- **No time-spent tracking for flashcard review** — `review_log` has no duration column, only `reviewed_at` + `grade`. Reading sessions have `started_at`/`ended_at` but that's a self-reported client wall-clock timer (floored at 1 minute), not a precise measurement.
- **No name or avatar field anywhere** — `profiles` has no `display_name`/`full_name`/`avatar_url` column, and no other table has one either.
- **No per-skill (reading/listening/speaking/writing) proficiency tracking** — `profiles.level` is one whole-account self-reported value (`beginner`/`intermediate`/`advanced`), set at onboarding. The only CEFR-letter strings in the codebase tag *content* (`texts.level_tag`) or *starter deck bundles* (`starter-decks.ts`), never the user.

## 4. What's currently hardcoded

Nothing hardcoded was found in the *data* the old `/progress`/`/settings` displayed — every number there already came from a real query. The gap was structural (no insight, no honest empty states for the 7-day window, no skill-status framing) rather than fabricated values.

## 5. Reusable components (from PR #11)

`PageHeader`, `SectionHeader`, `MetricCard`-pattern, `EmptyState`, the design tokens (`--surface`, `--text-secondary`, `--color-success/-warning/-danger/-caramel-text`), `getDueCount()`/`getReviewsThisWeekCount()` from `brain-stats.ts`. The pre-existing `StatCard`, `LineChart`, `HardestWords`, `PersonalRecords`, `AchievementsShelf`, `ActivityHeatmap` on `/progress` are kept (real, working, data-driven — removing them wasn't asked for and would be a regression), just re-skinned to the current token set for contrast/consistency.

## 6. Where only UI was needed

- Wrapping existing `getDueCount()`/`getReviewsThisWeekCount()` results into new cards.
- Restructuring Settings into named sections without changing any server action's behavior (profile save, push notifications, feedback, data export, logout, account deletion all already worked).

## 7. Where a minimal server query was needed

Four small additions, all reusing existing tables/patterns, no schema change:
1. `getDueCount()` call (existing helper) for the top "due" stat + insight.
2. `getReviewsThisWeekCount()` call (existing helper) for the insight's "words added but no reviews" branch.
3. One `reading_sessions` query (`order by started_at desc limit 1`) for "days since last reading".
4. One `vocabulary_items` count query scoped to the last 7 days (rolling window, distinct from the existing ISO-week "Квест недели" query) for the Activity section and the Skill section's vocabulary-growth dimension.
5. One `text_progress` count query (`percent_read >= 100`) for "materials completed" — same criterion already computed in `achievements-actions.ts`, just not previously surfaced on Progress.
6. One `subscriptions` read (status/period-end/stripe_customer_id) on the Settings page — the exact same query already used on `/pricing`.

No Supabase schema changes. No new tables. No Stripe code touched.
