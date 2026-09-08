import { createClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";
import { signUpFreshAccount, completeOnboardingForTest } from "./helpers";

// docs/release-2026-08-22/07_TESTIROVANIE_I_CI.md section 1 — RLS was only
// ever checked by migration code review, never by an automated test that
// two real users' data actually stays apart. This test uses a raw
// supabase-js client authenticated as user B (anon key + B's own session,
// exactly what a direct PostgREST call from outside the app would use) to
// read/write user A's rows on every sensitive table named in that doc:
// subscriptions, texts, vocabulary_items, decks, flashcards. It goes
// through neither server actions nor service_role — if a future migration
// ever weakens a policy, this fails on its own, without anyone needing to
// remember it exists.

const FRESH_ACCOUNT_PASSWORD = "testpass123"; // matches signUpFreshAccount in helpers.ts

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
}

// Deliberately the *anon* key, not service_role — this is what any direct
// PostgREST call from outside the app authenticates with, real user
// session or not.
async function signInAnon(email: string) {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "");
  const { data, error } = await client.auth.signInWithPassword({ email, password: FRESH_ACCOUNT_PASSWORD });
  if (error || !data.session) throw new Error(`signInAnon(${email}) failed: ${error?.message}`);
  return client;
}

async function getUserIdByEmail(supabase: ReturnType<typeof serviceClient>, email: string): Promise<string> {
  const { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 10_000 });
  const user = data?.users.find((u) => u.email === email);
  if (!user) throw new Error(`no auth user found for ${email}`);
  return user.id;
}

// Fresh free-tier account plus its own anon-key session — the same "direct
// PostgREST from outside the app" client the main test uses, here to prove
// the free-tier limit *triggers* (not RLS) hold up against direct writes.
async function createFreeUser(page: import("@playwright/test").Page, service: ReturnType<typeof serviceClient>) {
  const email = await signUpFreshAccount(page);
  await completeOnboardingForTest(email);
  const userId = await getUserIdByEmail(service, email);
  const client = await signInAnon(email);
  return { userId, client };
}

async function getRegularDeckCount(service: ReturnType<typeof serviceClient>, userId: string): Promise<number> {
  const { count } = await service.from("decks").select("id", { count: "exact", head: true }).eq("owner_id", userId).eq("is_starter", false);
  return count ?? 0;
}

async function getRegularFlashcardCount(service: ReturnType<typeof serviceClient>, userId: string): Promise<number> {
  const { count } = await service.from("flashcards").select("id", { count: "exact", head: true }).eq("owner_id", userId).eq("is_starter", false);
  return count ?? 0;
}

test("a second user cannot read or write another user's subscriptions/texts/vocabulary_items/decks/flashcards via a direct Supabase client", async ({ page, browser }) => {
  const service = serviceClient();

  // Two real, separate accounts — separate browser contexts so both
  // genuinely coexist rather than one login overwriting the other.
  const emailA = await signUpFreshAccount(page);
  await completeOnboardingForTest(emailA);
  const userIdA = await getUserIdByEmail(service, emailA);

  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  let emailB: string;
  try {
    emailB = await signUpFreshAccount(pageB);
    await completeOnboardingForTest(emailB);
  } finally {
    await contextB.close();
  }

  // Real data for A, owned by A — seeded directly (this test's job is
  // proving RLS isolation, not re-proving the creation flows other specs
  // already cover).
  const { data: textA } = await service.from("texts").insert({ owner_id: userIdA, title: "A's private text", body: "Only user A should ever see this.", source_type: "manual", language: "en" }).select("id, title").single();
  const { data: deckA } = await service.from("decks").insert({ owner_id: userIdA, name: "A's private deck", language: "en" }).select("id, name").single();
  const { data: flashcardA } = await service.from("flashcards").insert({ owner_id: userIdA, deck_id: deckA!.id, front: "a-front", back: "a-back", language: "en", item_type: "word", normalized_key: "a-front", source_type: "manual" }).select("id, front").single();
  const { data: vocabItemA } = await service.from("vocabulary_items").insert({ owner_id: userIdA, headword: "a-headword", translation: "a-translation", language: "en" }).select("id, headword").single();
  await service.from("subscriptions").upsert({ owner_id: userIdA, plan: "premium_yearly", status: "active" });
  if (!textA || !deckA || !flashcardA || !vocabItemA) throw new Error("test setup failed to seed user A's data");

  // Real user sessions, real anon key — no service_role anywhere below.
  const clientA = await signInAnon(emailA);
  const clientB = await signInAnon(emailB);

  // --- Confirm both clients are genuinely authenticated as the specific
  // users they claim to be, not e.g. silently anonymous (an anon session
  // would also fail every check below for the wrong reason — auth.uid() is
  // NULL, and owner_id = NULL is never true — which would make this test
  // pass without actually exercising per-user RLS at all). ---
  const { data: whoAmIA } = await clientA.auth.getUser();
  const { data: whoAmIB } = await clientB.auth.getUser();
  expect(whoAmIA.user?.id, "client A did not authenticate as user A").toBe(userIdA);
  expect(whoAmIB.user?.id, "client B did not authenticate as a real, distinct user").toBeTruthy();
  expect(whoAmIB.user?.id, "client B ended up authenticated as user A instead of user B").not.toBe(userIdA);

  // --- Sanity: A can read her own data through the same kind of client —
  // otherwise "B sees nothing" could just mean RLS blocks everyone,
  // including legitimate owners, which would be a different (if less
  // severe) bug this test isn't about. ---
  const ownReadChecks: { table: string; match: Record<string, string> }[] = [
    { table: "texts", match: { id: textA.id } },
    { table: "decks", match: { id: deckA.id } },
    { table: "flashcards", match: { id: flashcardA.id } },
    { table: "vocabulary_items", match: { id: vocabItemA.id } },
    { table: "subscriptions", match: { owner_id: userIdA } },
  ];
  for (const { table, match } of ownReadChecks) {
    const { data } = await clientA.from(table).select("*").match(match);
    expect(data?.length ?? 0, `user A couldn't read her own ${table} row — RLS setup is broken, not just strict`).toBeGreaterThan(0);
  }

  // --- The actual test: B, using her own real session, tries to read
  // A's rows both by exact id/owner filter and via an unfiltered listing
  // (an attacker doesn't necessarily know the target's id). ---
  for (const { table, match } of ownReadChecks) {
    const { data: filtered } = await clientB.from(table).select("*").match(match);
    expect(filtered ?? [], `user B could read user A's ${table} row by id/owner filter — RLS regression`).toEqual([]);

    const { data: listing } = await clientB.from(table).select("*");
    const leaked = (listing ?? []).some((row) => Object.entries(match).every(([k, v]) => (row as Record<string, unknown>)[k] === v));
    expect(leaked, `user A's ${table} row appeared in user B's unfiltered listing — RLS regression`).toBe(false);
  }

  // --- B tries to modify A's rows. UPDATE/DELETE under RLS match zero
  // rows rather than error (same as a WHERE clause matching nothing) —
  // the real proof is the follow-up service-role read confirming A's data
  // is untouched, not just that these calls "look" like they did nothing. ---
  const { data: updateTexts } = await clientB.from("texts").update({ title: "HACKED" }).eq("id", textA.id).select();
  expect(updateTexts ?? [], "user B's UPDATE on user A's text matched a row — RLS regression").toEqual([]);

  const { data: updateDecks } = await clientB.from("decks").update({ name: "HACKED" }).eq("id", deckA.id).select();
  expect(updateDecks ?? [], "user B's UPDATE on user A's deck matched a row — RLS regression").toEqual([]);

  const { data: updateFlashcards } = await clientB.from("flashcards").update({ front: "HACKED" }).eq("id", flashcardA.id).select();
  expect(updateFlashcards ?? [], "user B's UPDATE on user A's flashcard matched a row — RLS regression").toEqual([]);

  const { data: updateVocab } = await clientB.from("vocabulary_items").update({ headword: "HACKED" }).eq("id", vocabItemA.id).select();
  expect(updateVocab ?? [], "user B's UPDATE on user A's vocabulary_items row matched a row — RLS regression").toEqual([]);

  // subscriptions has no INSERT/UPDATE/DELETE grant for `authenticated` at
  // all (only Stripe-webhook/service_role writes it) — a real error is the
  // *correct* outcome here, not a silent zero-rows match.
  const { error: subUpdateError } = await clientB.from("subscriptions").update({ plan: "premium_yearly" }).eq("owner_id", userIdA);
  expect(subUpdateError, "user B was able to attempt an UPDATE on subscriptions at all — should be rejected outright").not.toBeNull();

  const { error: deleteError } = await clientB.from("texts").delete().eq("id", textA.id);
  const { data: stillExists } = await service.from("texts").select("id").eq("id", textA.id).maybeSingle();
  expect(stillExists, "user B's DELETE removed user A's text — RLS regression").not.toBeNull();
  void deleteError; // DELETE under RLS matching zero rows isn't itself an error — the row's survival is the real assertion.

  // --- B tries to forge a new row under A's ownership — INSERT's WITH
  // CHECK clause makes this a real error (not a silent no-op like
  // UPDATE/DELETE matching nothing), and it must stay that way. ---
  const { error: insertTextError } = await clientB.from("texts").insert({ owner_id: userIdA, title: "forged", body: "forged body", source_type: "manual", language: "en" });
  expect(insertTextError, "user B inserted a text row owned by user A — RLS regression").not.toBeNull();

  const { error: insertDeckError } = await clientB.from("decks").insert({ owner_id: userIdA, name: "forged", language: "en" });
  expect(insertDeckError, "user B inserted a deck row owned by user A — RLS regression").not.toBeNull();

  const { error: insertVocabError } = await clientB.from("vocabulary_items").insert({ owner_id: userIdA, headword: "forged", translation: "forged", language: "en" });
  expect(insertVocabError, "user B inserted a vocabulary_items row owned by user A — RLS regression").not.toBeNull();

  // --- Ground truth: every one of A's original rows is exactly as it was
  // before any of B's attempts — the assertions above prove each call was
  // individually rejected; this proves nothing slipped through overall. ---
  const { data: finalText } = await service.from("texts").select("title").eq("id", textA.id).single();
  expect(finalText?.title).toBe("A's private text");
  const { data: finalDeck } = await service.from("decks").select("name").eq("id", deckA.id).single();
  expect(finalDeck?.name).toBe("A's private deck");
  const { data: finalFlashcard } = await service.from("flashcards").select("front").eq("id", flashcardA.id).single();
  expect(finalFlashcard?.front).toBe("a-front");
  const { data: finalVocab } = await service.from("vocabulary_items").select("headword").eq("id", vocabItemA.id).single();
  expect(finalVocab?.headword).toBe("a-headword");
  const { count: forgedTextsCount } = await service.from("texts").select("id", { count: "exact", head: true }).eq("owner_id", userIdA).eq("title", "forged");
  expect(forgedTextsCount ?? 0).toBe(0);
});

test("free user deck limit enforced at DB level via direct PostgREST", async ({ page }) => {
  const service = serviceClient();
  const { userId, client } = await createFreeUser(page, service);

  const { data: sub } = await service.from("subscriptions").select("plan, status").eq("owner_id", userId).maybeSingle();
  expect(sub, "user should have no subscription (free tier)").toBeNull();

  const baselineRegularDecks = await getRegularDeckCount(service, userId);
  const decksToCreate = 3 - baselineRegularDecks;

  const testDeckIds: string[] = [];
  for (let i = 0; i < decksToCreate; i++) {
    const { data: deck, error } = await service.from("decks").insert({ owner_id: userId, name: `Test Regular Deck ${i}`, language: "en", is_starter: false }).select("id").single();
    expect(error, `failed to create test regular deck ${i}`).toBeNull();
    expect(deck).not.toBeNull();
    testDeckIds.push(deck!.id);
  }

  const regularCountAfterSetup = await getRegularDeckCount(service, userId);
  expect(regularCountAfterSetup).toBe(baselineRegularDecks + decksToCreate);

  const { error: insertError4th } = await client.from("decks").insert({ owner_id: userId, name: "4th Regular Deck", language: "en", is_starter: false });
  expect(insertError4th, "4th regular deck should be blocked by FREE_DECK_LIMIT_EXCEEDED trigger").not.toBeNull();
  expect(String(insertError4th?.message).toUpperCase()).toContain("FREE_DECK_LIMIT_EXCEEDED");

  const { data: starterDeck, error: starterError } = await client.from("decks").insert({ owner_id: userId, name: "Starter Deck", language: "en", is_starter: true }).select("id, is_starter").single();
  expect(starterError, "starter deck insert should succeed").toBeNull();
  expect(starterDeck).not.toBeNull();
  expect(starterDeck!.is_starter).toBe(true);

  const regularCountAfterStarter = await getRegularDeckCount(service, userId);
  expect(regularCountAfterStarter).toBe(baselineRegularDecks + decksToCreate);

  const { error: insertError4thAgain } = await client.from("decks").insert({ owner_id: userId, name: "4th Regular Deck Again", language: "en", is_starter: false });
  expect(insertError4thAgain, "4th regular deck should still be blocked after starter deck").not.toBeNull();
  expect(String(insertError4thAgain?.message).toUpperCase()).toContain("FREE_DECK_LIMIT_EXCEEDED");

  await service.from("decks").delete().in("id", testDeckIds);
  await service.from("decks").delete().eq("id", starterDeck!.id);
});

test("free user flashcard limit enforced at DB level via direct PostgREST", async ({ page }) => {
  const service = serviceClient();
  const { userId, client } = await createFreeUser(page, service);

  const { data: sub } = await service.from("subscriptions").select("plan, status").eq("owner_id", userId).maybeSingle();
  expect(sub).toBeNull();

  const { data: deck, error: deckError } = await service.from("decks").insert({ owner_id: userId, name: "Test Deck", language: "en", is_starter: false }).select("id").single();
  expect(deckError).toBeNull();
  expect(deck).not.toBeNull();
  const deckId = deck!.id;

  const baselineRegularFlashcards = await getRegularFlashcardCount(service, userId);

  const flashcardRows = Array.from({ length: 50 }, (_, i) => ({
    deck_id: deckId,
    owner_id: userId,
    front: `word-${i}`,
    back: `translation-${i}`,
    language: "en",
    item_type: "word",
    normalized_key: `word-${i}`,
    source_type: "manual",
    is_starter: false,
  }));
  const { error: fcInsertError } = await service.from("flashcards").insert(flashcardRows);
  expect(fcInsertError).toBeNull();

  const regularCountAfterSetup = await getRegularFlashcardCount(service, userId);
  expect(regularCountAfterSetup).toBe(baselineRegularFlashcards + 50);

  const { error: insertError51st } = await client.from("flashcards").insert({
    deck_id: deckId,
    owner_id: userId,
    front: "word-51",
    back: "translation-51",
    language: "en",
    item_type: "word",
    normalized_key: "word-51",
    source_type: "manual",
    is_starter: false,
  });
  expect(insertError51st, "51st regular flashcard should be blocked by FREE_FLASHCARD_LIMIT_EXCEEDED trigger").not.toBeNull();
  expect(String(insertError51st?.message).toUpperCase()).toContain("FREE_FLASHCARD_LIMIT_EXCEEDED");

  // Regression guard (migration 0051): at the flashcard limit, a plain edit
  // of an existing card (no is_starter / owner_id change) must still succeed —
  // the UPDATE trigger's WHEN clause is what keeps it from firing here.
  const { data: anyRegularFc } = await service.from("flashcards").select("id").eq("owner_id", userId).eq("is_starter", false).eq("deck_id", deckId).limit(1).single();
  const { error: benignEditError } = await client.from("flashcards").update({ back: "edited at the limit" }).eq("id", anyRegularFc!.id);
  expect(benignEditError, "editing an existing card at the flashcard limit must be allowed").toBeNull();

  const { data: starterFc, error: starterFcError } = await client.from("flashcards").insert({
    deck_id: deckId,
    owner_id: userId,
    front: "starter-word",
    back: "starter-translation",
    language: "en",
    item_type: "word",
    normalized_key: "starter-word",
    source_type: "manual",
    is_starter: true,
  }).select("id, is_starter").single();

  expect(starterFcError, "starter flashcard insert should succeed (is_starter column exists per migration 0021)").toBeNull();
  expect(starterFc).not.toBeNull();
  expect(starterFc!.is_starter).toBe(true);

  const regularCountAfterStarterFc = await getRegularFlashcardCount(service, userId);
  expect(regularCountAfterStarterFc).toBe(baselineRegularFlashcards + 50);

  const { error: insertError51stAgain } = await client.from("flashcards").insert({
    deck_id: deckId,
    owner_id: userId,
    front: "word-51-again",
    back: "translation-51-again",
    language: "en",
    item_type: "word",
    normalized_key: "word-51-again",
    source_type: "manual",
    is_starter: false,
  });
  expect(insertError51stAgain, "51st regular flashcard should still be blocked after starter flashcard").not.toBeNull();
  expect(String(insertError51stAgain?.message).toUpperCase()).toContain("FREE_FLASHCARD_LIMIT_EXCEEDED");

  await service.from("flashcards").delete().eq("deck_id", deckId);
  await service.from("decks").delete().eq("id", deckId);
});

test("update triggers for free tier limits: is_starter and owner_id changes", async ({ page, browser }) => {
  const service = serviceClient();
  const { userId, client } = await createFreeUser(page, service);

  const { data: sub } = await service.from("subscriptions").select("plan, status").eq("owner_id", userId).maybeSingle();
  expect(sub).toBeNull();

  const baselineRegularDecks = await getRegularDeckCount(service, userId);
  const decksToCreate = 3 - baselineRegularDecks;

  const testDeckIds: string[] = [];
  for (let i = 0; i < decksToCreate; i++) {
    const { data: deck, error } = await service.from("decks").insert({ owner_id: userId, name: `Test Regular Deck ${i}`, language: "en", is_starter: false }).select("id").single();
    expect(error, `failed to create test regular deck ${i}`).toBeNull();
    expect(deck).not.toBeNull();
    testDeckIds.push(deck!.id);
  }

  let regularCount = await getRegularDeckCount(service, userId);
  expect(regularCount).toBe(baselineRegularDecks + decksToCreate);

  // Regression guard (migration 0051): at the deck limit, a plain rename
  // (nothing touching is_starter / owner_id) must NOT trip the free-limit
  // trigger. Only is_starter / owner_id changes are limit-checked on UPDATE.
  const { error: benignRenameError } = await client.from("decks").update({ name: "Renamed at the limit" }).eq("id", testDeckIds[0]);
  expect(benignRenameError, "renaming an existing deck at the deck limit must be allowed").toBeNull();

  const { data: starterTestDeck, error: starterTestDeckError } = await service.from("decks").insert({ owner_id: userId, name: "Starter Test Deck", language: "en", is_starter: true }).select("id, is_starter").single();
  expect(starterTestDeckError).toBeNull();
  expect(starterTestDeck).not.toBeNull();
  expect(starterTestDeck!.is_starter).toBe(true);

  regularCount = await getRegularDeckCount(service, userId);
  expect(regularCount).toBe(baselineRegularDecks + decksToCreate);

  const { error: updateToStarterError } = await client.from("decks").update({ is_starter: true }).eq("id", testDeckIds[0]);
  expect(updateToStarterError, "regular -> starter update should succeed (frees slot)").toBeNull();

  regularCount = await getRegularDeckCount(service, userId);
  expect(regularCount).toBe(baselineRegularDecks + decksToCreate - 1);

  const { error: insert4thAfterFree } = await client.from("decks").insert({ owner_id: userId, name: "4th After Free", language: "en", is_starter: false });
  expect(insert4thAfterFree, "4th regular deck should succeed after regular->starter freed a slot").toBeNull();

  regularCount = await getRegularDeckCount(service, userId);
  expect(regularCount).toBe(baselineRegularDecks + decksToCreate);

  // The bypass this migration exists to close: flipping a starter deck back
  // to regular while already at the regular limit must be rejected.
  const { error: updateToRegularError } = await client.from("decks").update({ is_starter: false }).eq("id", testDeckIds[0]);
  expect(updateToRegularError, "starter -> regular update should be blocked at limit").not.toBeNull();
  expect(String(updateToRegularError?.message).toUpperCase()).toContain("FREE_DECK_LIMIT_EXCEEDED");

  const { data: verifyStarterStill } = await service.from("decks").select("is_starter").eq("id", testDeckIds[0]).single();
  expect(verifyStarterStill?.is_starter).toBe(true);

  // Flashcard UPDATE tests - use existing test deck (testDeckIds[1]) which is still regular
  // Don't create a new regular deck for flashcards when at limit
  const fcDeckId = testDeckIds[1];

  const baselineRegularFlashcards = await getRegularFlashcardCount(service, userId);

  const fcRows = Array.from({ length: 50 }, (_, i) => ({
    deck_id: fcDeckId,
    owner_id: userId,
    front: `fc-word-${i}`,
    back: `fc-translation-${i}`,
    language: "en",
    item_type: "word",
    normalized_key: `fc-word-${i}`,
    source_type: "manual",
    is_starter: false,
  }));
  const { error: fcInsertError } = await service.from("flashcards").insert(fcRows);
  expect(fcInsertError).toBeNull();

  const regularFcCountAfterSetup = await getRegularFlashcardCount(service, userId);
  expect(regularFcCountAfterSetup).toBe(baselineRegularFlashcards + 50);

  const { data: starterFcRow, error: starterFcRowError } = await service.from("flashcards").insert({
    deck_id: fcDeckId,
    owner_id: userId,
    front: "starter-fc",
    back: "starter-fc-trans",
    language: "en",
    item_type: "word",
    normalized_key: "starter-fc",
    source_type: "manual",
    is_starter: true,
  }).select("id").single();
  expect(starterFcRowError).toBeNull();
  expect(starterFcRow).not.toBeNull();

  const { data: regularFcRow } = await service.from("flashcards").select("id").eq("owner_id", userId).eq("is_starter", false).eq("deck_id", fcDeckId).limit(1).single();
  expect(regularFcRow).not.toBeNull();

  const { error: fcUpdateToStarter } = await client.from("flashcards").update({ is_starter: true }).eq("id", regularFcRow!.id);
  expect(fcUpdateToStarter, "flashcard regular->starter update should succeed").toBeNull();

  const regularFcCountAfterUpdate = await getRegularFlashcardCount(service, userId);
  expect(regularFcCountAfterUpdate).toBe(baselineRegularFlashcards + 49);

  // Flipping a starter card back to regular is limit-checked, but a BEFORE
  // UPDATE trigger counts the pre-update state, so at 49 regular this brings
  // the user to exactly 50 (the cap) — not past it. The next regular INSERT
  // is still blocked, so this is a hard ceiling, not a bypass.
  const { error: fcUpdateToRegular } = await client.from("flashcards").update({ is_starter: false }).eq("id", starterFcRow!.id);
  expect(fcUpdateToRegular, "starter -> regular flashcard update lands exactly at the cap (49 -> 50)").toBeNull();

  const regularFcCountAfterStarterToRegular = await getRegularFlashcardCount(service, userId);
  expect(regularFcCountAfterStarterToRegular).toBe(baselineRegularFlashcards + 50);

  const { data: verifyStarterFcStill } = await service.from("flashcards").select("is_starter").eq("id", starterFcRow!.id).single();
  expect(verifyStarterFcStill?.is_starter).toBe(false);

  // Owner_id change test - isolated from free-tier trigger
  // Create second user, verify they exist
  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  let emailB: string;
  try {
    emailB = await signUpFreshAccount(pageB);
    await completeOnboardingForTest(emailB);
    const userIdB = await getUserIdByEmail(service, emailB);

    // User A tries to UPDATE their deck to owner_id = userIdB
    // This should be blocked by RLS (owner_id change not allowed by RLS policy)
    const { error: ownerChangeError } = await client.from("decks").update({ owner_id: userIdB }).eq("id", testDeckIds[1]);
    expect(ownerChangeError, "owner_id change should be blocked by RLS").not.toBeNull();

    const { data: verifyOwnerUnchanged } = await service.from("decks").select("owner_id").eq("id", testDeckIds[1]).single();
    expect(verifyOwnerUnchanged?.owner_id).toBe(userId);
  } finally {
    await contextB.close();
  }

  // Cleanup - only test-created rows
  await service.from("flashcards").delete().eq("deck_id", fcDeckId);
  await service.from("decks").delete().in("id", testDeckIds);
  await service.from("decks").delete().eq("id", starterTestDeck!.id);
});

test("premium user unlimited via direct PostgREST", async ({ page }) => {
  const service = serviceClient();
  const { userId, client } = await createFreeUser(page, service);

  await service.from("subscriptions").upsert({ owner_id: userId, plan: "premium_yearly", status: "active", current_period_end: new Date(Date.now() + 365 * 86_400_000).toISOString() });

  const { data: sub } = await service.from("subscriptions").select("plan, status").eq("owner_id", userId).single();
  expect(sub?.plan).toBe("premium_yearly");
  expect(sub?.status).toBe("active");

  const baselineRegularDecks = await getRegularDeckCount(service, userId);
  const DECKS_TO_CREATE = 10;

  const createdDeckIds: string[] = [];
  for (let i = 0; i < DECKS_TO_CREATE; i++) {
    const { data: deck, error } = await client.from("decks").insert({ owner_id: userId, name: `Premium Deck ${i}`, language: "en", is_starter: false }).select("id").single();
    expect(error, `premium user should create deck ${i} over free limit`).toBeNull();
    expect(deck).not.toBeNull();
    createdDeckIds.push(deck!.id);
  }

  const finalRegularDecks = await getRegularDeckCount(service, userId);
  expect(finalRegularDecks).toBe(baselineRegularDecks + DECKS_TO_CREATE);

  const { data: fcDeck, error: fcDeckError } = await service.from("decks").insert({ owner_id: userId, name: "FC Premium Deck", language: "en", is_starter: false }).select("id").single();
  expect(fcDeckError).toBeNull();
  expect(fcDeck).not.toBeNull();
  const fcDeckId = fcDeck!.id;

  const baselineRegularFlashcards = await getRegularFlashcardCount(service, userId);
  const FLASHCARDS_TO_CREATE = 60;

  for (let i = 0; i < FLASHCARDS_TO_CREATE; i++) {
    const { error } = await client.from("flashcards").insert({
      deck_id: fcDeckId,
      owner_id: userId,
      front: `premium-word-${i}`,
      back: `premium-trans-${i}`,
      language: "en",
      item_type: "word",
      normalized_key: `premium-word-${i}`,
      source_type: "manual",
      is_starter: false,
    });
    expect(error, `premium user should create flashcard ${i} over free limit`).toBeNull();
  }

  const finalRegularFlashcards = await getRegularFlashcardCount(service, userId);
  expect(finalRegularFlashcards).toBe(baselineRegularFlashcards + FLASHCARDS_TO_CREATE);

  // Cleanup - only test-created rows by ID
  await service.from("flashcards").delete().eq("deck_id", fcDeckId);
  await service.from("decks").delete().eq("id", fcDeckId);
  await service.from("decks").delete().in("id", createdDeckIds);
  await service.from("subscriptions").delete().eq("owner_id", userId);
});
