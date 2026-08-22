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
