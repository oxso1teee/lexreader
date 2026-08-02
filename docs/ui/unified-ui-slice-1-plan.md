# M3 Unified UI — Vertical Slice 1 plan (App Shell + Today)

Scope confirmed against `docs/ui/current-ui-audit.md` and
`docs/ui/route-map.md`. This plan lists exactly what will be created or
touched — nothing outside this list is in scope for this branch.

## What we reuse

- `src/components/nav-icons.tsx` — 5 existing SVG icons, reused as-is for
  both desktop sidebar and mobile bottom nav.
- `src/components/empty-state.tsx` — reused as-is (already matches the
  required empty-state structure).
- `getDueCount()` (`src/lib/brain-stats.ts`) and the `text_progress`
  continue-reading query already in `home/page.tsx` — reused as the real
  data sources for the Today primary CTA (no new queries invented).
- `src/lib/posthog-client.ts`'s `track()` — reused for the new analytics
  events, no new analytics library.
- Existing `--color-background/--color-foreground/--color-card/--color-caramel*`
  tokens — extended, not replaced.

## What we replace (new components only, old ones untouched elsewhere)

- `(app)/nav.tsx` bottom bar → becomes the `MobileBottomNav` half of a new
  `AppShell`, with `aria-current` added and shared nav-item data.
- `(app)/layout.tsx`'s manual header/`<Nav/>` markup → renders `<AppShell>`.
- `/home` page composition (`TodayCard`/`AccountStrip`/`SecondaryTips`) →
  new Today composition described below. The route itself (`/home`) does
  not change.

## Exact file list

**New files:**
- `src/styles/tokens.css` — extended semantic tokens (imported from `globals.css`)
- `src/components/product/app-shell/nav-items.ts` — shared nav data (5 items)
- `src/components/product/app-shell/desktop-sidebar.tsx`
- `src/components/product/app-shell/mobile-bottom-nav.tsx`
- `src/components/product/app-shell/app-shell.tsx`
- `src/components/product/page-header.tsx`
- `src/components/product/section-header.tsx`
- `src/components/product/primary-action-card.tsx`
- `src/components/product/metric-card.tsx`
- `src/components/product/progress-bar.tsx`
- `src/components/product/loading-state.tsx`
- `src/components/product/error-state.tsx`
- `src/components/product/today/continue-learning-card.tsx`
- `src/components/product/today/review-summary-card.tsx`
- `src/components/product/today/daily-plan-card.tsx`
- `src/components/product/today/coming-soon-card.tsx`
- `src/lib/today.ts` — pure primary-CTA decision function (unit-testable, no I/O)
- `messages/ru.json`, `messages/en.json` — App Shell + Today strings only
- `src/lib/i18n.ts` — minimal string lookup (no locale switching UI added — none exists elsewhere in the app)
- Tests: `src/lib/today.test.ts`, `src/components/product/app-shell/nav-items.test.ts` (if logic warrants), `e2e/unified-shell-today.spec.ts`, `e2e/unified-shell-a11y.spec.ts`
- Docs: this file, `docs/ui/current-ui-audit.md`, `docs/ui/route-map.md`, `docs/ui/verification-slice-1.md` (written after browser verification)

**Modified files:**
- `src/app/(app)/layout.tsx` — use `AppShell` instead of inline header/Nav
- `src/app/(app)/nav.tsx` — either superseded by `mobile-bottom-nav.tsx` or thinned to re-export it (decided during implementation, whichever is less risky)
- `src/app/(app)/home/page.tsx` — new Today composition, same route
- `src/app/globals.css` — `@import` the new tokens file, keep existing variables
- `src/app/layout.tsx` — add `viewportFit: "cover"` for safe-area support
- `package.json` — no new runtime dependency expected (see decision below); may add nothing or a single tiny dev-only test dependency if strictly needed

## Package decision

No new UI library is added. Rationale, matching the task's own
constraint ("не добавлять новую большую UI-библиотеку без доказанной
необходимости", "не создавать Storybook, если его сейчас нет"):
- Icons: reuse `src/components/nav-icons.tsx` (already the single existing
  icon set for navigation) — no `lucide-react`.
- No Storybook — not present, and the twelve new components are simple
  enough to unit-test directly (props → rendered output) and cover via
  Playwright screenshots instead.
- No `next-intl`/`react-intl` — a five-minute-old two-file JSON lookup is
  enough for "App Shell + Today strings only"; introducing a full i18n
  runtime when the rest of the app is 100% hardcoded Russian would be
  scope creep beyond this slice.

## Risks

See `docs/ui/current-ui-audit.md` §9 for the full table. Summary:
layout change could affect existing e2e (mitigated by running the full
suite before/after and diffing failures against the already-documented
pre-existing flake); new `<h1>` on Today has no known DOM dependents
(verified via grep before implementing).

## Rollback

Branch-only; PR stays Draft; no merge, no deploy in this phase. If a
problem surfaces after eventual merge, reverting the merge commit fully
restores the previous `(app)/layout.tsx` + `/home` composition — no
database or route changes are involved, so rollback carries zero data risk.

## Before screenshots

See `docs/ui/current-ui-audit.md` §11 — pixel screenshots were not
obtainable at audit time (tool timeout, transient); the DOM/accessibility
tree snapshot taken at 1440×900 on a live authenticated session serves as
the recorded baseline. Screenshot capture is retried at the browser
verification step.
