# Second-pass audit — remaining findings (2026-07-23)

This is a follow-up to `docs/PRELAUNCH_AUDIT_2026-07-23.md`. That first audit was
fully remediated and deployed. This second, more adversarial pass (3 parallel
agents: regression check, full-app walkthrough, RLS/security re-audit) plus
live Playwright click-testing found more issues. The high-confidence, contained
ones were already fixed directly in this pass (see the list at the bottom).
Everything below is **still open** — each item has the exact file/line, the
concrete failure scenario, and a recommended fix, written so it can be handed
back as a work prompt.

---

## 1. Watch Mode contributes nothing to stats, streak, or reading progress — HIGH

**Where:** [src/app/watch/[textId]/watch-player.tsx](../src/app/watch/%5BtextId%5D/watch-player.tsx)

**What's wrong:** `WatchPlayer` calls `upsertWord` and `setWordLevel` (for
tap-to-translate) but never calls `finishReading`, `updateTextProgress`, or
`touchStreak` — all three of which the text-reading path
([src/app/read/[textId]/reader.tsx](../src/app/read/%5BtextId%5D/reader.tsx))
calls. Compare with
[src/app/read/[textId]/actions.ts:100-153](../src/app/read/%5BtextId%5D/actions.ts#L100).

**Failure scenario:** A user watches a 20-minute YouTube video in Watch Mode,
looks up 15 words. They then check Статистика — "Слов прочитано" and the
review-log-driven charts show nothing for this session because no
`reading_sessions` row was ever inserted. Their daily streak (`touchStreak`)
doesn't advance even though they genuinely studied. The Library screen's
progress bar / "last read" timestamp for that video never updates either,
since `updateTextProgress` is never called — the video always looks unopened.
This silently breaks streak-based motivation and the entire Статистика screen
for anyone who prefers video over plain text.

**Fix:** In `watch-player.tsx`, track elapsed watch time and words-looked-up
count locally (a ref/counter), and call `finishReading({ textId, minutes,
wordsLookedUp })` on unmount / page navigation-away (e.g. via a
`beforeunload`/cleanup effect), the same way the text reader does. Also call
`updateTextProgress` periodically (e.g. every N seconds of playback, keyed off
`activeIndex` as a proxy for "page") so the Library progress bar reflects
video watch progress. `touchStreak` is already called inside `finishReading`
server-side, so wiring that one call fixes the streak too.

---

## 2. Decks/flashcards have no `language` column — no isolation by target language — HIGH

**Where:** [supabase/migrations/0004_decks.sql:11-56](../supabase/migrations/0004_decks.sql#L11),
contrast with the fix already applied to vocabulary in
[supabase/migrations/0015_vocabulary_language.sql](../supabase/migrations/0015_vocabulary_language.sql).

**What's wrong:** `decks` and `flashcards` were never given a `language`
column. Migration 0015 fixed exactly this gap for `vocabulary_items` (so
switching `target_language` in Settings correctly scopes the Тетрадь/notebook
and Статистика counts), but the same fix was never applied to Мозг.

**Failure scenario:** A user studies Spanish for a while, builds up decks and
flashcards, then switches `target_language` to French in Настройки. Мозг
still shows every Spanish deck and card mixed in with new French ones — there
is no language filter anywhere in the Brain feature's queries
([src/app/(app)/brain/actions.ts](../src/app/(app)/brain/actions.ts),
[src/app/(app)/brain/[deckId]/review/page.tsx](../src/app/(app)/brain/%5BdeckId%5D/review/page.tsx)).
The SRS review queue will serve Spanish cards to review during what the user
thinks is a French-only study session. This is the single largest
architectural gap left in the app.

**Fix:** New migration (0018) mirroring 0015:
```sql
alter table decks add column language text;
update decks set language = (select target_language from profiles where profiles.id = decks.owner_id) where language is null;
alter table decks alter column language set not null;
create index decks_owner_language_idx on decks (owner_id, language);

alter table flashcards add column language text;
update flashcards set language = (select language from decks where decks.id = flashcards.deck_id) where language is null;
alter table flashcards alter column language set not null;
create index flashcards_owner_language_idx on flashcards (owner_id, language);
```
Then: deck creation (`brain/actions.ts` `createDeck`) must stamp
`language: profile.target_language`; every deck-list/card-list/review query
must add `.eq("language", profile.target_language)`; and the "default deck"
concept (`is_default`) needs to become per-language (one default deck per
language, not one global default) since `addPhraseToDefaultDeck` currently
assumes a single global default deck — this touches
[src/app/read/[textId]/actions.ts:60-97](../src/app/read/%5BtextId%5D/actions.ts#L60)
and the onboarding default-deck creation in
[src/app/onboarding/actions.ts:75-77](../src/app/onboarding/actions.ts#L75).
This is a multi-file change; recommend doing it as its own dedicated pass
rather than folding it into smaller fixes.

---

## 3. Reading-progress concurrent-write race can regress progress — HIGH

**Where:** [src/app/read/[textId]/actions.ts:127-153](../src/app/read/%5BtextId%5D/actions.ts#L127) (`updateTextProgress`)

**What's wrong:** The upsert is unconditional — it always writes whatever
`pageIndex`/`percentRead` the calling tab currently has, regardless of what's
already stored:
```ts
const { error } = await supabase.from("text_progress").upsert(
  { owner_id: user.id, text_id: input.textId, last_page_index: input.pageIndex,
    percent_read: percentRead, last_read_at: new Date().toISOString() },
  { onConflict: "owner_id,text_id" },
);
```

**Failure scenario:** User opens the same text in two tabs (or a tab left
open from yesterday plus a fresh one today), reads further in tab B (page 40),
then tab A — still open on page 10 — fires its own periodic
`updateTextProgress` call (e.g. from a stale `setInterval` or an old
`beforeunload`) and silently overwrites progress back down to page 10 and an
older `last_read_at`. The user reopens the text later and it resumes from
page 10, looking like their reading progress "reset."

**Fix:** Make the write conditional on advancing progress: read the current
row first (or use a single upsert with a `where` guard via raw SQL / RPC) so
it only updates when `input.pageIndex >= last_page_index` (or `last_read_at`
is more recent than the stored one). Simplest: fetch existing
`last_page_index` for `(owner_id, text_id)` before the upsert, skip the write
if the incoming `pageIndex` is lower, unless this is an intentional
re-read-from-start action (in which case that should be an explicit "restart"
control, not an implicit side effect of the periodic autosave).

---

## 4. Settings "Disable notifications" only affects the current device — HIGH

**Where:** [src/app/(app)/settings/settings-client.tsx:80-96](../src/app/(app)/settings/settings-client.tsx#L80)
vs. [src/app/(app)/settings/page.tsx:10-16](../src/app/(app)/settings/page.tsx#L10)

**What's wrong:** `initialPushEnabled` is computed server-side from whether
*any* row exists in `push_subscriptions` for this user
(`count > 0`) — i.e. it reflects "push enabled on at least one device."
But `disablePush()` only ever unsubscribes the **current browser's own**
service-worker subscription (`registration.pushManager.getSubscription()`),
and deletes only that one endpoint. If `subscription` is `null` on this
device (never subscribed here), the whole `if (subscription)` block is
skipped — no DB row is deleted anywhere — yet `setPushEnabled(false)` still
runs unconditionally in the `try` block.

**Failure scenario:** User enables push on their phone. Later opens Settings
on their laptop (which never subscribed) — toggle shows "enabled" (correct,
based on the phone's row), user clicks "Disable." Nothing is deleted
server-side (laptop had no subscription to remove), but the laptop UI now
shows "disabled," even though the phone keeps receiving push reminders. The
user believes they've turned notifications off and is confused/annoyed when
reminders keep arriving.

**Fix:** Either (a) make disable delete **all** of the user's
`push_subscriptions` rows server-side via a dedicated server action
(`deleteAllPushSubscriptions(ownerId)`) rather than only the current device's
endpoint, or (b) if per-device control is intended, change the UI copy and
`initialPushEnabled` logic to be scoped to "this device" only (which requires
persisting a device identifier), and add a separate "disable on all devices"
control. Option (a) is simpler and matches the current single-toggle UI's
implied meaning.

---

## 5. OCR paywall check happens after (free but slow) OCR completes, and Library loses edited text on rejection — MEDIUM/HIGH

**Where:**
[src/app/(app)/library/new/photo-import-form.tsx:69-95](../src/app/(app)/library/new/photo-import-form.tsx#L69) and
[src/app/(app)/library/actions.ts (createText → hasFreeTextRoom)](../src/app/(app)/library/actions.ts#L26).

**What's wrong:** `PhotoImportForm` runs the full client-side Tesseract OCR
pass (can take 10-30s), lets the user review/edit the recognized text, and
only when they click "Добавить в библиотеку" does the server action check
`hasFreeTextRoom`. If the user is at the free-tier text limit,
`state.paywall` becomes true and the component's top-level `if (state.paywall)
return <PaywallNotice />;` unconditionally replaces the whole view — the
local `text`/`title` state (the user's OCR-corrected transcription) is not
persisted anywhere and is gone if they navigate back.

**Failure scenario:** Free-tier user at the text limit photographs a page,
waits through OCR, spends two minutes manually fixing OCR mistakes in the
textarea, submits — and gets bounced to a paywall screen with their edited
transcription discarded. If they upgrade and come back, they have to
re-photograph and re-correct everything from scratch.

**Fix:** Check `hasFreeTextRoom` up front (e.g. pass the current plan/room as
a prop from the server component that renders `PhotoImportForm`, or make a
cheap server call before allowing the file picker to even open) so the
paywall is shown *before* the user invests time in OCR + editing. If the
paywall must be re-checked at submit time (race with other tabs), on
rejection keep rendering the edit form with the existing `text`/`title` state
and show the paywall as a dismissable banner above it, instead of unmounting
the form.

Note: `brain/import-modal.tsx`'s equivalent flow (`handleImport` at
[src/app/(app)/brain/import-modal.tsx:178-194](../src/app/(app)/brain/import-modal.tsx#L178))
has the same "paywall checked only after OCR" ordering issue, but does *not*
lose data on rejection — `setCards([])` is only called on success, so the
parsed cards remain editable after a paywall error. Lower priority there;
only the up-front timing issue applies.

---

## 6. Onboarding Step 1 (target language) doesn't exclude the not-yet-chosen native language — MEDIUM

**Where:** [src/app/onboarding/onboarding-wizard.tsx:106-111](../src/app/onboarding/onboarding-wizard.tsx#L106)
(Step 1, no `exclude` prop) vs.
[src/app/onboarding/onboarding-wizard.tsx:119-123](../src/app/onboarding/onboarding-wizard.tsx#L119)
(Step 2, correctly passes `exclude={targetLanguage}`).

**What's wrong:** Step 1's `<LanguagePicker value={targetLanguage}
onChange={setTargetLanguage} />` has no `exclude`, so a user can pick, say,
Russian as their target language, then on Step 2 Russian is correctly hidden
from the native-language list — but if they go **back** to Step 1 and change
their mind, or if in a future variant Step 2 came first, there's no symmetric
protection. More concretely: nothing stops a user from later using the
Settings screen to independently set target = native (same gap exists there
too — worth checking
[src/app/(app)/settings/actions.ts](../src/app/(app)/settings/actions.ts) for
an equivalent `targetLanguage === nativeLanguage` guard).

**Failure scenario:** The actual submit-time guard
(`onboarding/actions.ts:32-34`, `if (targetLanguage === nativeLanguage) return
{ error: ... }`) only fires on final submit at Step 5, after the user has
already gone through Steps 1-4. If they picked the same language for both
(possible since Step 1 has no exclusion and a user could pick the same code
twice before Step 2 even renders — Step 2 excludes it, so this exact
collision actually can't happen through the wizard's own forward flow, but a
user bouncing Back-and-forth between steps 1 and 2 could still end up
picking the same language for both since `exclude` is evaluated against
whatever `targetLanguage` was *at Step 2's render time*, not re-validated
when Step 1 changes afterward) gets an error only at the very last step,
five steps in, with no automatic navigation back to fix it.

**Fix:** On submit error due to language collision, navigate the user back to
Step 1 automatically (`setStep(1)`) instead of just showing an inline error
on the Step 5 form (which the user might not connect to a Step-1 problem).
Simpler alternative: re-validate `targetLanguage !== nativeLanguage` reactively
whenever either changes (e.g. reset `nativeLanguage` to `""` if it equals a
newly-changed `targetLanguage`), removing the possibility of reaching Step 5
in a conflicting state at all.

---

## 7. No flashcard editing in Мозг — MEDIUM-HIGH (missing feature, not a bug)

**Where:** [src/app/(app)/brain/[deckId]/actions.ts](../src/app/(app)/brain/%5BdeckId%5D/actions.ts)
only exports `addFlashcard` and `deleteFlashcard` — no `updateFlashcard`.

**What's wrong:** Once a flashcard is created, its `front`/`back`/`notes`
cannot be edited — a typo or wrong translation can only be fixed by deleting
the card (which also throws away its SRS review history/state) and
re-creating it from scratch.

**Fix:** Add an `updateFlashcard(cardId, { front, back, notes })` server
action with the same ownership check pattern as `addFlashcard`
(`deck_id`/`owner_id` verification), and an edit affordance in the deck's card
list UI (likely `src/app/(app)/brain/[deckId]/page.tsx` / a card-row
component) — inline edit or a small modal, consistent with how
`card-row.tsx` already handles other per-card actions.

---

## 8. Notebook Чтение↔Повтор tab switch resets in-progress practice session — MEDIUM

**Where:** [src/app/(app)/notebook/notebook-client.tsx:43,137-139](../src/app/(app)/notebook/notebook-client.tsx#L43)

**What's wrong:** `mode` toggles between `"read"` and `"practice"` and
`{mode === "read" ? (...) : <PracticeSession words={allWords} />}` — when
`mode` flips away from `"practice"` and back, `PracticeSession` fully
unmounts and remounts (no shared key, no lifted state), losing whatever
progress the user had made in the practice/review flow.

**Failure scenario:** User starts a Тетрадь practice session, answers a few
cards, then taps over to "Чтение" to search for a word, then taps back to
"Повтор" — their practice session has restarted from the beginning instead of
resuming where they left off.

**Fix:** Lift the practice session's progress state (current index / answered
set) up into `NotebookClient` so it survives the tab switch, or keep
`PracticeSession` mounted at all times and just toggle its visibility with
CSS (`hidden` class) instead of conditional rendering — cheaper fix, and
`PracticeSession` isn't expensive enough to justify unmounting on every tab
flip.

---

## 9. Free-tier limits are enforced only in the app layer, bypassable via direct PostgREST calls — MEDIUM

**Where:** All `has*Room` checks (`hasFreeTextRoom` in
`library/actions.ts:26`, `hasFreeFlashcardRoom` in `lib/subscription.ts`,
equivalents for decks/vocabulary) run in Next.js server actions, but the
underlying `insert` RLS policies on `texts`/`decks`/`flashcards`/
`vocabulary_items` only check ownership (`owner_id = auth.uid()`), not plan
limits.

**Failure scenario:** A free-tier user extracts their own Supabase anon key +
their session JWT (both readily available from browser devtools/network
tab, not a secret) and issues raw `POST` requests directly to
`https://<project>.supabase.co/rest/v1/texts` (or `flashcards`, etc.),
bypassing the Next.js server actions entirely — and therefore bypassing
`hasFreeTextRoom`/`hasFreeFlashcardRoom` checks, since RLS alone doesn't
enforce a *count* limit. They can create unlimited texts/decks/cards for
free.

**Fix:** This is a acceptable-risk item for a small-scale launch (requires a
technically sophisticated user to bother extracting their own JWT to cheat a
free-tier quota they could otherwise just pay for), but if it needs closing:
add a Postgres trigger (`before insert`) on each limited table that raises an
exception when the caller's existing row count for that owner already meets
the free limit and their `subscriptions` status isn't active — mirroring the
app-layer check as a DB-level backstop. This is the only fully-robust fix
since RLS policies can reference `count(*)` subqueries but get awkward for
"insert N more" batch inserts (e.g. `importFlashcards`) — a trigger handles
both single and batch inserts uniformly.

---

## 10. Minor/cosmetic items — LOW

- **"Welcome to LexReader!" home card never goes away**
  ([src/app/(app)/home/welcome-card.tsx](../src/app/(app)/home/welcome-card.tsx)) —
  shown unconditionally to every user regardless of account age. Fix: only
  render it when `profile.created_at` is within, say, the last 7 days (needs
  `created_at` passed down from `home/page.tsx`, which already fetches
  `profile`).

- **Onboarding language search has no "not found" empty state**
  ([src/app/onboarding/onboarding-wizard.tsx:38-53](../src/app/onboarding/onboarding-wizard.tsx#L38),
  `LanguagePicker`) — typing a query that matches nothing just renders an
  empty grid with no explanation. Fix: render a small "Ничего не найдено"
  message when `filtered.length === 0`.

- **Progress screen vocabulary stat cards never respect the period-tab
  filter** ([src/app/(app)/progress/page.tsx:74-95](../src/app/(app)/progress/page.tsx#L74)) —
  `totalWords`/`knownWords`/`learningWords` are always all-time counts
  regardless of the selected period (7/30/90/all tab), while `wordsReadTotal`
  and the charts below do respect it. This may be intentional (vocabulary
  size is a cumulative stat, doesn't make sense "per period"), but it's worth
  either a one-line UI label clarifying "всего" next to those three cards, or
  confirming with the user this is by design.

---

## Already fixed in this second pass (for reference, no action needed)

Storage bucket privacy leak (word-photos publicly enumerable), study-direction
inconsistency across the three review modes, lapsed-card `first_reviewed_at`
new-card miscounting, missing default-deck delete protection, Home screen
showing the premium upsell to paying users, CSV export missing the `language`
column, `addFlashcard` missing deck-ownership check, match-pairs mode always
grading correct matches as "Помню" regardless of prior mistakes, and the
Статистика "Всё время" chart being capped at 30 days while the stat cards
above summed full history.
