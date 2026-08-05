# M3 Unified UI — rolling roadmap

One-line status per slice, for anyone (including a future Claude Code session) to see where the redesign stands without reading every plan doc.

| Slice | Scope | Status | Plan doc |
|---|---|---|---|
| 1 | App Shell (desktop sidebar + mobile nav) + Today | Shipped to Production (PR #11) | `docs/ui/unified-ui-slice-1-plan.md` |
| 2 | Progress + Profile/Settings | Shipped to Production (PR #12) | `docs/ui/slice2-data-audit.md`, `docs/ui/slice2-full-check-suite.md` |
| 3 | Library + Add Material + Reader (desktop & mobile) | In progress — branch `feature/unified-ui-library-reader` | `docs/ui/m3-slice3-library-reader-plan.md` |

Explicitly not started: Brain/Review redesign, Language Twin, Missions, Voice product. None of these are implied by Slice 3 and shouldn't be started under it.

Design system note: Slice 3 introduces a dark-forest-green primary accent (`--color-forest*` tokens) for Library/Add Material/Reader only. Today/Progress/Settings keep their existing caramel-primary tokens unchanged — a full app-wide palette migration, if ever wanted, would be its own separate slice with its own approval.
