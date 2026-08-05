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

# Analytics events — M3 Slice 4 (Practice / Brain / Review)

Same `track()` wrapper, same PostHog project. Approved event list only —
no event fires that isn't in this table.

| Event | Fired from | Properties |
|---|---|---|
| `practice_viewed` | `brain/practice-analytics.tsx` (mount, client) | `due_count_bucket`, `viewport_type` |
| `review_session_started` | `brain/[deckId]/review/review-session.tsx` (mount, client) | `card_count` |
| `review_session_resumed` | same file, same mount effect — mutually exclusive with `review_session_started` | `card_count` |
| `review_answer_revealed` | `review-session.tsx`, `revealAnswer()` | *(none)* |
| `review_card_graded` | `review-session.tsx`, `grade()` | `grade` (`0`\|`1`\|`2`\|`3`) |
| `review_undo_used` | `review-session.tsx`, `undo()`, only after server confirms the undo | *(none)* |
| `review_session_completed` | `review-session.tsx`, `grade()`, last-card branch | `count` (session total) |
| `vocabulary_viewed` | `brain/vocabulary/vocabulary-browser.tsx` (mount, client) | `initial_tab` (`words`\|`phrases`\|`decks`) |
| `vocabulary_filter_changed` | same file — tab switch, bucket chip, deck select, sort select, "only from reading" checkbox | `filter_type` (`tab`\|`bucket`\|`deck`\|`sort`\|`source_only`), `value` (enum, or `all`/`specific` for `deck`) |
| `vocabulary_bulk_action_used` | same file — bulk mark-known/move/delete/export | `action` (`mark_known`\|`move`\|`delete`\|`export`) |
| `deck_opened` | `brain/[deckId]/deck-analytics.tsx` (mount, client) | `deck_type` (`default`\|`starter`\|`custom`), `card_count` |
| `deck_create_started` | `brain/new-deck-modal.tsx`, open-button click, when not at the free-tier limit | *(none)* |
| `deck_create_blocked_by_limit` | `new-deck-modal.tsx` — open-button click at the limit, or the post-submit paywall race | *(none)* |
| `deck_create_succeeded` | `brain/[deckId]/deck-analytics.tsx`, only when landing via `?created=true` from `createDeck()`'s redirect | `deck_type` |

## Privacy

No word, phrase, translation, context sentence, source text, deck name,
card content, or material URL appears in any Slice 4 event payload —
verified by grepping every `track()` call added in this slice (see list
above; every property is a boolean, enum, or count). Search queries in
Vocabulary are never sent (`vocabulary_filter_changed` only fires from the
tab/bucket/deck/sort/source controls, never the text input), and the deck
filter reports `all`/`specific` rather than the deck id, since a raw deck
id would let a filter-change event be joined back to one specific deck.
`createDeck()`'s redirect target gained a `?created=true` query param —
not sensitive, no change needed to `custom_personal_data_properties` in
`posthog-client.ts` (which already strips `q`).
