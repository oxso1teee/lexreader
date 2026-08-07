# Analytics events — M3 Slice 1

All events use the existing `track()` from `src/lib/posthog-client.ts` — no
new analytics library. PostHog already works in production (see
`docs/analytics/posthog-production-verification.md`).

| Event | Fired from | Properties |
|---|---|---|
| `today_viewed` | `home/today-analytics.tsx` (mount, client) | `due_count_bucket`, `has_active_material`, `viewport_type` |
| `today_primary_action_clicked` | `product/primary-action-card.tsx` (no-mission fallback), or `product/today/hero-mission-card.tsx` (Today v2, when a mission fills the hero slot) | `action_type` (`review`\|`continue_reading`\|`add_material`\|`mission`), `destination` |
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

# Analytics events — M3 Slice 5 (Language Twin)

Same `track()` wrapper. This is the exact, closed event list for the
Language Twin feature — no event outside this table fires from any
`language-twin/*` file (enforced by `e2e/language-twin-privacy.spec.ts`'s
regex scan, not just this table).

| Event | Fired from | Properties |
|---|---|---|
| `language_twin_viewed` | `language-twin/language-twin-analytics.tsx` (mount, on `page.tsx`) | `confidence` (`low`\|`medium`\|`high`\|`none`) |
| `pattern_opened` | `language-twin/patterns/pattern-list-client.tsx`, list-item click | `category`, `confidence` |
| `strength_opened` | `language-twin/strengths-list.tsx`, strength-row click | *(none)* |
| `recommendation_opened` | `language-twin/recommendation-card.tsx`, CTA `<a>` click | `recommendation_type`, `priority` |
| `recommendation_dismissed` | same file, "Скрыть" click | `recommendation_type` |
| `diagnostic_started` | `language-twin/diagnostic/diagnostic-flow.tsx`, "Начать" click | *(none)* |
| `diagnostic_completed` | same file, after `submitDiagnosticAction` resolves | `correct` (count), `total` (count) |
| `correction_check_started` | `language-twin/correction/correction-form.tsx`, "Проверить" click | *(none)* |
| `correction_check_completed` | same file, after `checkCorrectionAction` resolves | `supported` (boolean), `match_count` (count) |
| `profile_recompute_requested` | `language-twin/recompute-button.tsx` click | *(none)* |
| `evidence_deleted` | `language-twin/patterns/pattern-list-client.tsx` and `evidence/evidence-list-client.tsx`, delete click | `source_type` |
| `pattern_marked_inaccurate` | `language-twin/patterns/pattern-list-client.tsx` | `category` |
| `pattern_dismissed` | same file, "Скрыть паттерн" click | `category` |
| `language_twin_enabled` | `language-twin/settings/settings-form.tsx` and `enable-toggle-inline.tsx` | *(none)* |
| `language_twin_disabled` | `language-twin/settings/settings-form.tsx` | *(none)* |
| `language_twin_reset` | `language-twin/settings/settings-form.tsx`, reset confirm | *(none)* |

## Privacy

Never sent, by design (brief's explicit list): sentence, corrected
sentence, word, phrase, translation, context, evidence content, material
title, URL, deck name, user email, exact error, free-form text. Every
property above is an enum, a count, or a boolean — verified mechanically
by `e2e/language-twin-privacy.spec.ts`'s regex scan of every file in the
table (forbidden keys: title/text/word/phrase/email/content/body/front/
back/headword/query/translation/deck_name/deck_id/notes/context/sentence/
explanation/suggestion/url/material), not just by this document. The
Correction Input sentence itself is never sent to PostHog at any point —
`checkCorrectionAction`/`saveCorrectionEvidenceAction` (server actions)
never call `track()`, only the client-side started/completed events above
do, and those carry no text. PostHog pageview autocapture already masks
`?q=` (Library search) via `custom_personal_data_properties`; Language
Twin adds no new query params that need masking.

# Analytics events — M3 Slice 6 (Missions v1)

Same `track()` wrapper. Closed event list, enforced by
`e2e/missions-privacy.spec.ts`'s regex scan of every file below.

| Event | Fired from | Properties |
|---|---|---|
| `mission_impression` | `home/today-analytics.tsx` (mount, client, only when Today shows ≥1 mission) | `mission_count` (count) |
| `mission_opened` | `missions/[missionId]/mission-screen.tsx` (mount, when mission is `available`) | `mission_type` |
| `mission_resumed` | same file, same mount effect — mutually exclusive with `mission_opened`/`mission_result_viewed` | `mission_type` |
| `mission_result_viewed` | same file, same mount effect (mission is `completed`) | `mission_type` |
| `mission_started` | `mission-screen.tsx`, "Начать" click | `mission_type` |
| `mission_step_completed` | `missions/[missionId]/grammar-runner.tsx`, after `submitMissionStepAction` resolves | `mission_type`, `step_index` (count), `correct` (boolean) |
| `mission_completed` | `grammar-runner.tsx` (grammar-runner types) after `completeMissionAction` resolves, or `brain/[deckId]/review/session-complete.tsx` (targeted types — no `mission_type` known on this path) | `mission_type` (grammar-runner path only) |
| `mission_dismissed` | `mission-screen.tsx`, "Не сейчас" click | `mission_type` |

## Privacy

Never sent: the mission's own title/reason text, question prompts/options/
explanations, target words/flashcard ids, answers, or the source Language
Twin pattern's title/category text. Deliberately no raw `mission_id` (UUID)
either — every event uses `mission_type` (a 9-value enum already public in
the schema) instead of an opaque identifier that could be joined back to
one specific mission's content, the same reasoning Language Twin uses for
`category`/`confidence` instead of a pattern id. Verified by
`e2e/missions-privacy.spec.ts`, which extends the forbidden-key list above
with `answer`/`prompt`/`option`/`mission_id`.

# Analytics events — M3 Slice 7 (Today v2)

No new events. `today_primary_action_clicked` (table above, M3 Slice 1) gains
one more `action_type` value, `"mission"`, fired from the new
`product/today/hero-mission-card.tsx` when an active mission fills the Today
hero slot instead of the generic review/continue/add-material action — same
event name, same property shape, still only an enum + a route string.
`mission_impression` (Missions v1, above) is unchanged and continues to be
the signal for "Today showed at least one mission."
