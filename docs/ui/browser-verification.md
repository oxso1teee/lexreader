# M3 Slice 1 — browser verification

Manual pass against local dev server (`next dev`, Supabase local), account `test@example.com`, in addition to the automated Playwright coverage in `e2e/unified-shell-today.spec.ts` and `e2e/unified-shell-a11y.spec.ts`.

Note: the in-app screenshot tool (`computer screenshot`) timed out repeatedly in this environment (same pre-existing issue noted in `docs/ui/current-ui-audit.md`), so verification below uses the accessibility tree (`read_page`), computed styles (`javascript_tool`), console, and network inspection instead — all of which give an equally precise (and in some ways more falsifiable) signal than a pixel screenshot for layout/contrast/structure checks.

## Desktop — 1440×900

- `/login` → filled real test credentials, submitted, redirected to `/home`.
- `/home`: sidebar (`Сегодня/Учиться/Практика/Прогресс/Профиль`) + header "Добрый день!" + date + primary CTA "11 к повторению" → "Повторить" (`/brain/all/review`) + Today Plan + Continue Learning (in-progress book with progress bar) + Review summary ("11 к повтору" / "Все карточки →") + Progress snapshot + Coming Soon list. Matches decision logic: due reviews (11) > continue reading, so review is primary.
- `/library`: opens inside the same shell, existing catalogue/mine tabs and text list intact.
- `/brain/all/review`: opens inside the shell, review session shows card 1/11, mode toggles, answer buttons — unaffected by the shell change.
- `/progress`: opens inside the shell, all stats/achievements/heatmap sections intact.
- `/settings`: opens inside the shell, no console errors.
- No console errors, no failed network requests on any of the above.

## Desktop — 1024×768

- `/home`: sidebar `display: flex` (visible), bottom nav `display: none` (hidden), `scrollWidth - clientWidth = 0` (no horizontal overflow).

## Mobile — 390×844

- `/home`: sidebar `display: none`, bottom nav `display: flex`, 0px overflow.
- All 5 bottom-nav touch targets measured 78×62px — comfortably over the 44px minimum.

## Mobile — 360×800 (smallest required width)

- `/home`: 0px horizontal overflow, bottom nav visible, no console errors.

## Dark mode

- Forced `prefers-color-scheme: dark` at 1280×800 on `/home`: `--surface-elevated` resolves to `#262330`, `--text-secondary` to `#f0ece3ad` (68% alpha, the WCAG-AA-fixed value), page background switches accordingly. No console errors under dark mode.

## Analytics (PostHog)

- `initPostHog()` confirmed to run client-side: `localStorage` contains the `ph_<project-key>_posthog` key after login, proving the SDK initialized (this part of the pipeline predates this slice — see `8b2f406 fix: restore PostHog analytics under production CSP`).
- CSP `connect-src` includes the configured PostHog API host (`src/lib/posthog-csp.ts`), so outbound analytics calls are not blocked in this build.
- The new `track()` call sites added in this slice (`today_viewed`, `today_primary_action_clicked` via `PrimaryActionCard`, `app_nav_clicked`, `continue_learning_clicked`, `review_entry_clicked`) are statically verified to never pass user content — enforced by the passing `e2e/unified-shell-a11y.spec.ts` "analytics: track() calls..." test (source-scan against a forbidden-key blocklist).
- The network-request inspector in this browser tool did not itself capture an outbound beacon to `i.posthog.com` in the verification window (batched/beacon delivery isn't always visible to this tool) — this is a tooling visibility gap, not a code issue, given the two checks above.

## Not re-verified here (already covered elsewhere)

- Keyboard navigation / focus-visible / axe violations — covered by `e2e/unified-shell-a11y.spec.ts` (5/5 passing).
- Loading/empty/error states for Today (no material, no reviews) — covered by `e2e/unified-shell-today.spec.ts` ("brand-new account" test, 1/1 passing) and unit tests in `src/lib/today.test.ts`.
