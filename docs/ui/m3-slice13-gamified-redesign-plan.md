# LexReader gamified redesign (Duolingo-style reference)

## Context

The user wants LexReader's existing, mature app (Next.js 16, ~15 shipped
"Slices": Missions v1, Language Twin, Learning Paths v1, Vocabulary/SRS
"Brain", Video Reader, etc.) restructured and reskinned to match a reference
screenshot: a dark-navy, cyan/teal, gamified language-learning app with a
6-tab nav (Home/Path/Missions/Arena/Library/Profile), a Practice Hub, XP,
streak, levels, missions, achievements, a competitive Arena leaderboard, and
new practice modes (Speaking, Grammar Gym, Listening, Stories). This is
explicitly **not** a rebuild — reuse existing DB tables, server actions, and
components; only add what's genuinely missing.

Audit findings that materially shape this plan:
- **Most of the reference already exists under different names.** XP
  (`profiles.xp` + `src/lib/xp-actions.ts:addXp`), streak
  (`profiles.streak_current`), ranks (`src/lib/ranks.ts`), achievements
  (`user_achievements` + `src/lib/achievements.ts`), Missions v1 (`missions`/
  `mission_attempts` tables, full engine in `src/lib/missions/`), Learning
  Paths v1 (`learning_path_enrollments`/`user_skill_progress`, curriculum in
  `src/lib/learning-paths/curriculum/`, includes an actual "everyday" path
  matching the reference's "Everyday Life" hero card) are all real, working
  systems. The redesign's job is mostly **routing + restyling existing data**,
  not inventing new backend.
- **Two genuine gaps**: (1) no Speaking/pronunciation practice exists at all
  (only `mic-button.tsx`, browser dictation for manual word entry, no
  scoring); (2) no social graph — no leaderboard, no follow/friend tables,
  `profiles` has no display name/avatar/country field, only `profiles.xp`.
- **Design tokens today**: `src/app/globals.css` (legacy vars, primary is
  caramel `#a67c52`, light background) imports `src/styles/tokens.css` (M3
  semantic layer: `--surface`, `--text-secondary`, `--color-primary`, etc.,
  with `@media (prefers-color-scheme: dark)` overrides already present but no
  manual toggle). Single nav source of truth:
  `src/components/product/app-shell/nav-items.ts` (5 items today), consumed
  by `desktop-sidebar.tsx` + `mobile-bottom-nav.tsx`.

**Confirmed with the user:**
1. Add a real light/dark theme toggle; new/default state is the dark-navy
   theme from the reference; the current light theme stays fully reachable.
2. Arena = a real global leaderboard ranked by `profiles.xp` (no new social
   schema). Following/Followers on Profile are hidden ("coming soon") rather
   than faked, since there is no follow-graph table.
3. The public landing page is untouched — this redesign is scoped to the
   authenticated app.

## Design system: theme toggle

- Add `data-theme="dark"|"light"` support to `tokens.css`/`globals.css`
  alongside the existing `@media` blocks (mirror the existing dark-mode
  variable values into a `:root[data-theme="dark"]` block for now-explicit
  control; keep `:root[data-theme="light"]` = today's current light values
  unchanged). Redefine the **base `:root` values** (outside any
  selector/media condition) to the new dark-navy/cyan palette so dark is the
  default appearance app-wide, matching the reference, unless the user has
  toggled to light.
- New small client component `src/components/theme-toggle.tsx` +
  `src/lib/theme.ts` (get/set via `localStorage`, applied by stamping
  `data-theme` on `<html>` in a tiny inline script in the root layout to
  avoid a flash-of-wrong-theme). No DB column — purely client-side
  preference, consistent with "don't touch backend without a reason."
- New palette direction (exact values tuned during implementation, checked
  against the reference screenshot per the user's own Phase 6 instruction):
  background near-black navy, card surface a lighter navy with soft shadow
  and ~16–20px radius, primary accent cyan/teal, gold/amber reserved for
  XP/rewards/streak, red reserved for errors only (already the existing
  convention — kept).
- New shared primitives worth extracting once other pages need them
  repeatedly: `Avatar` (initials-based, reusing existing
  `src/lib/avatar-initials.ts`), `Badge`/`Pill`, `StatChip` — consolidating
  the currently-duplicated per-feature badge files
  (`missions/badges.tsx`, `learning-paths/badges.tsx`,
  `language-twin/badges.tsx`) is explicitly out of scope for this pass
  (large, separate refactor) — new screens get their own small badge
  components following the same existing pattern instead.

## Information architecture (existing routes are reused, not duplicated)

| Reference concept | Route | Source |
|---|---|---|
| Home | `/home` (existing) | Restyled. Hero card switches from "hero mission" to **hero Learning Path progress** (current enrollment %, 3-stage breakdown), reusing `learning_path_enrollments`/`user_skill_progress`/`src/lib/learning-paths/progress-engine.ts`. Existing hero-mission/primary-action logic moves down into a compact "Today" section (kept, not deleted). New: a Practice Hub entry card. |
| Path | `/learning-paths` (existing) | Restyled only — catalog + enrolled path view already match the reference almost exactly. |
| Missions | `/missions` (existing) | Restyled with a "Daily Focus" hero treatment on top of the existing mission list; no new data model. |
| Arena | `/arena` (**new**) | Real global leaderboard: server-side query top-N `profiles` by `xp` (+ current user's own real rank if outside top-N), `Avatar` from email initials, rank from `src/lib/ranks.ts`. No country flags (no data — omitted, not faked). |
| Library | `/library` (existing) | Restyled only. Also the landing point for "Story Corner." |
| Profile | `/profile` (**new**) | New stats-forward profile: avatar, rank/level, XP, streak, courses-in-progress count, "Learning statistics" and "Achievements" sections **reusing existing `/progress` components** (`activity-week-card`, `achievements-shelf`, `hardest-words`) verbatim, Following/Followers shown as "Скоро" (per confirmed decision), "Edit profile"/"Settings" button linking to the existing `/settings` route (kept as-is for account/subscription/security — not duplicated). |
| Practice Hub | `/practice` (**new**) | Hub page, 5 cards linking to: Words Lab → `/brain` (existing), Grammar Gym → `/grammar` (**new**, thin wrapper reusing `src/lib/missions/grammar-bank.ts` + the existing `grammar-runner.tsx` component logic outside the mission-gated flow), Listen Lounge → `/listen` (**new**, surfaces existing texts/videos with a listening mode, reusing Reader's existing `listening` mode + Watch Mode), Speak Studio → `/speak` (**new**, see below), Story Corner → links into existing `/library` + `/read/[textId]`. Reached via the Home hero-section card (not a 7th nav tab, matching the user's own explicit 6-item nav spec). |
| Word Practice (letter-tile game) | New mode inside `/brain` review flow | New UI component, but wired into the **existing** SRS grading pipeline (`src/lib/srs.ts` / the existing review-log insert in `brain/[deckId]/review/actions.ts`) — a correct build counts as a normal "good" review, not a parallel tracking system. |

`nav-items.ts` becomes 6 items: Home/Path/Missions/Arena/Library/Profile
(`/home`, `/learning-paths`, `/missions`, `/arena`, `/library`, `/profile`).
`/progress` and `/settings` stay live routes (not deleted, not broken) but
drop out of the bottom nav, reached from the new Profile page instead.

## Speaking (`/speak`) — the one real net-new feature

No pronunciation-scoring API exists or is being added (matches "prefer free
tools"). Real, honest scope: reuse the existing browser `SpeechRecognition`
wrapper pattern from `mic-button.tsx` to record a real transcript for a
prompt (e.g. "Talk about your latest weekend", 30s timer). Feedback is
**rule-based, not fake**: run the transcript through the existing
Language Twin correction-rule engine (`src/lib/language-twin/correction-rules.ts`)
for grammar flags, and a simple word-count/vocabulary-variety check reusing
existing vocabulary lookups — no invented "pronunciation score." On
completion, awards XP via the existing `addXp` + `checkAndAwardAchievements`
+ `touchStreak` checkpoint pattern (same three calls used together in
`brain/[deckId]/review/actions.ts` and `read/[textId]/actions.ts`).

**New DB**: one small table, `speaking_attempts` (id, user_id, prompt,
transcript, feedback_json, xp_awarded, created_at) — needed so attempts
persist and Practice Hub / Profile can show real history, not because the
architecture demands it elsewhere. One migration file, RLS scoped to
`auth.uid() = user_id` matching every other user-owned table's existing
pattern.

## Implementation phases

1. **Design tokens + theme toggle + nav** — new palette, `data-theme`
   plumbing, `ThemeToggle` component (placed in Settings/Profile), update
   `NAV_ITEMS` to the 6-item set, update icons (`nav-icons.tsx`).
2. **Reskin existing screens** — Home, Library, Missions, Learning Paths,
   Brain review, Settings: restyle with the new tokens/card style, no
   behavior changes. This is the highest-leverage phase since it's pure CSS
   surface area over already-correct logic.
3. **New routes on existing data** — `/arena` (leaderboard query),
   `/profile` (composes existing Progress/Achievements components),
   `/practice` (hub), `/grammar`, `/listen`.
4. **Speaking** — migration + `/speak` route + XP/streak/achievement wiring.
5. **Word Practice mini-game** — new review-mode UI inside `/brain`, wired
   into the existing grading pipeline.
6. **Polish pass** — the user's own explicit final check: run the app, open
   it next to the reference screenshot, and compare spacing/radius/type
   scale/color/progress-bar styling directly rather than stopping at "first
   working version." Loading/empty/error/locked states for every new route
   (reusing existing `loading-state.tsx`/`error-state.tsx`/`empty-state.tsx`
   patterns).

## Files (representative, not exhaustive)

**New**: `src/lib/theme.ts`, `src/components/theme-toggle.tsx`,
`src/app/(app)/arena/page.tsx`, `src/app/(app)/profile/page.tsx`,
`src/app/(app)/practice/page.tsx`, `src/app/(app)/grammar/page.tsx`,
`src/app/(app)/listen/page.tsx`, `src/app/(app)/speak/{page.tsx,actions.ts}`,
`supabase/migrations/00XX_speaking_attempts.sql`, plan doc
`docs/ui/m3-slice-redesign-plan.md` (same convention as every prior slice).

**Modified**: `src/styles/tokens.css`, `src/app/globals.css`,
`src/components/product/app-shell/nav-items.ts`, `src/components/nav-icons.tsx`,
`src/app/(app)/home/page.tsx`, `src/app/(app)/missions/page.tsx`,
`src/app/(app)/library/*`, `src/app/(app)/brain/[deckId]/review/*`.

## Verification

- `npm run typecheck && npm run lint && npm run build`.
- `npm run test:ui` plus new unit tests for any new pure logic (e.g. leaderboard
  ranking, grammar-check wiring).
- Re-run existing e2e suites (`unified-shell-today.spec.ts`,
  `unified-shell-a11y.spec.ts`, etc.) — must still pass since routes/copy
  contracts they assert on are preserved, not deleted.
- Manual Preview walkthrough of all 6 nav tabs + Practice Hub + Speak Studio
  in both themes, on mobile and desktop viewports, compared directly against
  the reference screenshot.
- No merge/Production deploy without explicit instruction, consistent with
  how every prior slice in this project has shipped.
