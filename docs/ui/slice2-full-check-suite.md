# M3 UI Slice 2 — full check suite results

Branch `feature/unified-ui-progress-profile`, base `main` at `cbcc864855331091a8dc7b41c8222e4810e153a4`.

## Static checks

| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run lint` | ✅ clean (including the newer `react-hooks/purity` rule — fixed 3 direct `Date.now()` calls in the Progress Server Component by moving them into module-level helpers, matching the file's own existing pattern) |
| `npm run build` | ✅ clean, 32 routes |

## Unit tests

| Suite | Result |
|---|---|
| `test:import` | ✅ 6/6 |
| `test:extension` | ✅ 4/4 |
| `test:srs` | ✅ 10/10 |
| `test:fsrs` | ✅ 42/42 |
| `test:csp` | ✅ 13/13 |
| `test:ui` | ✅ 47/47 (21 pre-existing + 26 new: `progress-insight` 9, `skill-status` 5, `avatar-initials` 4, `subscription-display` 8) |

**122/122 unit tests pass.**

## E2E (`npm run test:e2e`, full suite)

37 total (32 passed, 1 skipped — real Stripe checkout, needs a live key — 4 failed). Isolated re-run of the 4 failures: `onboarding-first-win.spec.ts` passed on retry (one-off flake, unrelated to this branch); the other 3 reproduced **byte-for-byte identically** every time:

```
Error: expect(page).toHaveURL(expected) failed
Expected pattern: /\/brain\/[\w-]+$/
Received string:  "http://127.0.0.1:3000/brain"
Timeout: 5000ms
13-14 × unexpected value "http://127.0.0.1:3000/brain"
```

Proof this is not caused by this branch: the same failure reproduces in **`e2e/brain-notebook.spec.ts`**, which has zero diff vs `main`, alongside `e2e/unified-shell-today.spec.ts` (merged in PR #11, unmodified here) and this branch's own new test — all three share the identical "create deck → wait for redirect" pattern and the same root cause (Turbopack dev-server compilation timing under load), already documented for PR #11 (`docs/ui/full-check-suite.md`). Also independently confirmed pre-existing on `main` itself: `main`'s own tip commit (`cbcc864`, already merged) currently fails CI's `e2e` job with an unrelated but equally pre-existing issue (Node 20 lacks the native WebSocket `@supabase/realtime-js` needs; tracked separately, not re-diagnosed here).

**Local-environment note**: earlier runs in this pass surfaced two false leads before the real signal — (1) a second, unrelated Claude Code session was briefly running the same suite against the same local dev server/Supabase instance concurrently, and (2) `e2e/helpers.ts`'s `restoreTestPassword()` called `listUsers()` without pagination, silently missing `test@example.com` once the local instance accumulated 68+ test accounts from repeated runs, so it stopped actually restoring the shared account's password after any test that changes it. Fixed by passing an explicit `perPage`. Both were resolved before the results above.

New e2e coverage (`e2e/unified-shell-progress-settings.spec.ts`, 11 tests, 10/11 passing — the 1 failure is the flake above):
1. Brand-new account → honest empty Progress state, no fake CEFR strings.
2. Real due-flashcard history → due-reviews insight wins (the one hit by the flake).
3. Settings Profile section renders real email/languages/goal/plan.
4. Learning-preferences save shows success confirmation.
5. Subscription section never shows a renewal date for the free plan (the bug this test caught, see below).
6. Password-reset link opens the existing `/reset-password` flow.
7. Mobile nav visible / desktop sidebar hidden at 390px on both pages.
8. Desktop sidebar visible at 1280px on both pages.
9. No horizontal overflow at 360px on both pages.
10. `/progress` — zero serious/critical axe violations, desktop + mobile.
11. `/settings` — zero serious/critical axe violations, desktop + mobile.

## Real bugs found and fixed during this pass (not hypothetical)

1. **Subscription section showed a renewal date for the free plan.** `subscriptions.current_period_end` can outlive a cancelled subscription; `getPlan()` already correctly falls back to `"free"`, but a naive `periodEnd !== null` check would still render "Продление: …" next to "Бесплатный". Fixed via a new pure `subscriptionPeriodInfo()` helper (tested) that requires an active paid plan, matching `/pricing`'s existing condition.
2. **Avatar initials contrast (3.16:1)** — `text-caramel` on `bg-caramel/15` in the new `ProfileCard`, same failure class as PR #11's sidebar bug. Fixed with the existing `--color-caramel-text` accessible variant.
3. **PeriodTabs active-tab contrast (3.73:1)** — pre-existing bug in `period-tabs.tsx` (white text on caramel background), caught because axe now scans the whole `/progress` page. Fixed by switching to the same black/white "selected" pattern used everywhere else in the app.
4. **SkillSection status-badge contrast (3.29:1 for success, likely similar for warning)** — new code, same class of bug. Fixed by adding `--color-success-text`/`--color-warning-text` tokens (precise sRGB-linearized contrast math, ≥7:1 margin in both themes), following the exact precedent `--color-caramel-text` set in PR #11.
5. **Feedback-form submit button (36px) below the 44px touch-target minimum** — pre-existing, re-skinned and fixed while touching this file for token consistency.

## Not run / out of scope

- CI's Node 20 `e2e` job (pre-existing, unrelated, tracked separately).
- Supabase schema changes, FSRS changes, Stripe changes — none made, per instructions.
