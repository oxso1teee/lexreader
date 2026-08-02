# Analytics events — M3 Slice 1

All events use the existing `track()` from `src/lib/posthog-client.ts` — no
new analytics library. PostHog already works in production (see
`docs/analytics/posthog-production-verification.md`).

| Event | Fired from | Properties |
|---|---|---|
| `today_viewed` | `home/today-analytics.tsx` (mount, client) | `due_count_bucket`, `has_active_material`, `viewport_type` |
| `today_primary_action_clicked` | `product/primary-action-card.tsx` | `action_type` (`review`\|`continue_reading`\|`add_material`), `destination` |
| `app_nav_clicked` | `app-shell/desktop-sidebar.tsx`, `app-shell/mobile-bottom-nav.tsx` | `destination`, `viewport_type` |
| `continue_learning_clicked` | `product/today/continue-learning-card.tsx` | `destination` |
| `review_entry_clicked` | `product/today/review-summary-card.tsx` | `destination` |

## Privacy

`destination` is a route path (`/brain/all/review`, `/read/[id]`, etc.) —
no text content, no titles, no vocabulary. `due_count_bucket` is one of
`"0"`/`"1-5"`/`"6-20"`/`"20+"` (`src/lib/today.ts`, `dueCountBucket()`) —
never the raw due count as a potentially-identifying precise number
alongside other properties, though the range itself is already low-risk.
No email, no card/book text, no secrets in any event — verified by
grepping every `track()` call added in this slice for string literals
that could contain user content (none found; all properties are booleans,
enums, or route strings).
