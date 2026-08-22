import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";
import { signUpFreshAccount, completeOnboardingForTest } from "./helpers";

// docs/release-2026-08-22/07_TESTIROVANIE_I_CI.md section 1 — "Delete/Export
// аккаунта" was untested (neither unit nor e2e). Apple requires working
// in-app account deletion for App Store review (file 05); GDPR-style export
// is the other half of the same data-rights story.

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
}

function psql(sql: string): string {
  return execFileSync("psql", ["-h", "127.0.0.1", "-p", "54322", "-U", "postgres", "-d", "postgres", "-t", "-A", "-F", "|", "-c", sql], {
    env: { ...process.env, PGPASSWORD: "postgres" },
    encoding: "utf8",
  });
}

// Discovered live from pg_constraint, not a hand-maintained list — a future
// migration that adds a new user-owned table (an owner_id/user_id column
// with a single-column FK to profiles) is automatically picked up here.
// Deliberately NOT filtered to confdeltype = 'c' at the SQL level: if some
// future migration *weakens* an existing FK from CASCADE to SET NULL/NO
// ACTION/RESTRICT, filtering here would just silently stop checking that
// table instead of catching the regression. Every FK to profiles is
// discovered regardless of its delete rule, and the delete rule itself is
// asserted to be CASCADE below — a weakened rule fails loudly, on its own,
// even before the row-count checks run.
function discoverProfilesForeignKeys(): { table: string; column: string; deleteRule: string }[] {
  const sql = `
    select conrelid::regclass::text, a.attname, c.confdeltype
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.confrelid = 'public.profiles'::regclass
      and array_length(c.conkey, 1) = 1
    order by 1;
  `;
  return psql(sql)
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [table, column, deleteRule] = line.split("|");
      return { table, column, deleteRule };
    });
}

async function getUserIdByEmail(supabase: ReturnType<typeof serviceClient>, email: string): Promise<string> {
  const { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 10_000 });
  const user = data?.users.find((u) => u.email === email);
  if (!user) throw new Error(`no auth user found for ${email}`);
  return user.id;
}

// Counts go straight through psql, not supabase-js's PostgREST client —
// confirmed by hand that PostgREST/fetch was serving a stale cached "0"
// count for a row that direct psql could already see committed at the same
// moment, and that repeating the *same* supabase-js query never picked up
// the change even over several seconds. Direct psql has no such cache.
function countRowsPsql(table: string, column: string, value: string): number {
  const output = psql(`select count(*) from ${table} where ${column} = '${value}';`).trim();
  return Number(output);
}

test("deleting an account cascades across every user-owned table, not just auth.users", async ({ page }) => {
  const supabase = serviceClient();
  const email = await signUpFreshAccount(page);
  await completeOnboardingForTest(email);
  const userId = await getUserIdByEmail(supabase, email);

  // --- Real data, created through the real app (not fabricated rows) for
  // the three things explicitly asked for: a text, a deck, a word. ---

  // 1. A text in the library.
  await page.goto("/library/new");
  const textTitle = `E2E delete-account text ${Date.now()}`;
  await page.getByLabel("Название").fill(textTitle);
  await page.getByLabel("Текст").fill("A real sentence used only to prove account deletion cascades correctly across every table.");
  await page.getByRole("button", { name: "Добавить в библиотеку" }).click();
  await expect(page).toHaveURL(/\/read\/[\w-]+$/, { timeout: 10_000 });
  const textId = page.url().match(/\/read\/([\w-]+)/)?.[1];
  if (!textId) throw new Error("textId not captured from the post-import redirect URL");

  // 2. An explicit deck with a flashcard on it.
  await page.goto("/brain/vocabulary");
  await page.getByRole("button", { name: "📚 Колоды" }).click();
  await page.getByRole("button", { name: "+ Новая колода" }).click();
  await page.getByPlaceholder("Название колоды...").fill(`E2E Delete Deck ${Date.now()}`);
  await page.getByRole("button", { name: "Создать" }).click();
  await expect(page).toHaveURL(/\/brain\/[\w-]+\?created=true$/, { timeout: 15_000 });
  const deckId = page.url().match(/\/brain\/([\w-]+)\?/)?.[1];
  if (!deckId) throw new Error("deckId not captured from the post-create redirect URL");
  await page.getByPlaceholder("Слово").fill("e2e-delete-front");
  await page.getByPlaceholder("Перевод").fill("e2e-delete-back");
  await page.getByRole("button", { name: "+ Добавить карточку" }).click();
  await expect(page.getByText("e2e-delete-front")).toBeVisible();

  // 3. A word in the dictionary — manual add goes through
  // src/lib/vocabulary/save.ts, which also creates vocabulary_contexts, its
  // own flashcard, and srs_state (not just vocabulary_items).
  await page.goto("/notebook");
  await page.getByRole("button", { name: "Добавить слово вручную" }).click();
  await page.getByPlaceholder("Например: serendipity").fill("e2e-delete-word");
  await page.getByPlaceholder("Перевод").fill("e2e-delete-translation");
  // A note becomes the vocabulary_contexts row (see appendContextIfNew in
  // src/lib/vocabulary/save.ts) — without one, manual add creates no context
  // at all, and the vocabulary_contexts cascade check below would be
  // checking a table that was never populated in the first place.
  await page.getByPlaceholder("Где услышал / контекст").fill("e2e delete-account context note");
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByText("e2e-delete-word")).toBeVisible();

  // Ids the UI itself never surfaces, needed to check the handful of tables
  // one hop further out that have no owner_id/user_id column of their own
  // (they cascade via flashcard_id/text_id instead): review_log, srs_state,
  // vocabulary_contexts, caption_segments.
  const { data: deckFlashcard } = await supabase.from("flashcards").select("id").eq("deck_id", deckId).eq("front", "e2e-delete-front").single();
  const { data: wordFlashcard } = await supabase.from("flashcards").select("id").eq("owner_id", userId).eq("front", "e2e-delete-word").single();
  if (!deckFlashcard || !wordFlashcard) throw new Error("expected flashcards not found before deletion — test setup itself is broken");

  // --- Direct seed for breadth: tables with no UI-driven creation flow
  // worth exercising in *this* test (that's other e2e specs' job), but
  // still real user-owned data this test must prove gets deleted too. ---
  await supabase.from("subscriptions").upsert({ owner_id: userId, plan: "free", status: "active" });
  await supabase.from("push_subscriptions").insert({ owner_id: userId, endpoint: `https://e2e-fake-push.example/${userId}`, p256dh: "e2e-p256dh", auth: "e2e-auth" });
  await supabase.from("translate_requests").insert({ owner_id: userId });
  await supabase.from("text_progress").insert({ owner_id: userId, text_id: textId, last_page_index: 1 });
  await supabase.from("reading_sessions").insert({ owner_id: userId, text_id: textId, words_looked_up: 1 });
  await supabase.from("srs_settings").upsert({ owner_id: userId });
  await supabase.from("review_log").insert({ flashcard_id: deckFlashcard.id, grade: 2 });
  await supabase.from("caption_segments").insert({ text_id: textId, start_ms: 0, end_ms: 1000, body: "e2e caption", segment_index: 0 });

  const profileForeignKeys = discoverProfilesForeignKeys();
  // Structural check first, independent of any seeded data: every one of
  // these FKs must actually be ON DELETE CASCADE. Fails immediately and
  // explicitly if a migration ever weakens one, rather than relying on the
  // row-count checks below to notice the fallout indirectly.
  for (const { table, column, deleteRule } of profileForeignKeys) {
    expect(deleteRule, `${table}.${column} -> profiles is no longer ON DELETE CASCADE (rule: ${deleteRule})`).toBe("c");
  }
  const populatedBefore = new Set([
    "texts", "decks", "flashcards", "vocabulary_items", "subscriptions",
    "push_subscriptions", "translate_requests", "text_progress",
    "reading_sessions", "srs_settings",
  ]);
  const secondHopChecks = [
    ["review_log", "flashcard_id", deckFlashcard.id],
    ["srs_state", "flashcard_id", wordFlashcard.id],
    ["vocabulary_contexts", "flashcard_id", wordFlashcard.id],
    ["caption_segments", "text_id", textId],
  ] as const;

  // --- Sanity check: everything above actually has a row right now —
  // otherwise the "0 rows after deletion" assertions further down would be
  // vacuously true for an empty table and prove nothing at all. ---
  for (const { table, column } of profileForeignKeys) {
    if (!populatedBefore.has(table)) continue;
    const count = countRowsPsql(table, column, userId);
    expect(count, `test setup bug: expected ${table}.${column} to have a row for this user before deletion`).toBeGreaterThan(0);
  }
  for (const [table, column, id] of secondHopChecks) {
    const count = countRowsPsql(table, column, id);
    expect(count, `test setup bug: expected ${table} to have a row for ${column}=${id} before deletion`).toBeGreaterThan(0);
  }

  // --- Delete the account through the real UI flow (confirmation phrase
  // and all), not a raw admin API call — this is what a real user does. ---
  await page.goto("/settings");
  await page.getByRole("button", { name: "Удалить аккаунт" }).click();
  await page.getByLabel("Введи УДАЛИТЬ для подтверждения").fill("УДАЛИТЬ");
  await page.getByRole("button", { name: "Удалить аккаунт навсегда" }).click();
  await expect(page).toHaveURL(/\/login$/, { timeout: 10_000 });

  // --- The auth user itself is gone (the "obvious" half everyone checks). ---
  const { data: usersAfter } = await supabase.auth.admin.listUsers({ page: 1, perPage: 10_000 });
  expect(usersAfter?.users.find((u) => u.email === email)).toBeUndefined();

  // --- Every single-hop cascade table (dynamically discovered) is empty
  // for this user (the "not just auth" half this test actually exists for). ---
  for (const { table, column } of profileForeignKeys) {
    const count = countRowsPsql(table, column, userId);
    expect(count, `${table}.${column} still has rows for a deleted user — cascade delete regression`).toBe(0);
  }
  for (const [table, column, id] of secondHopChecks) {
    const count = countRowsPsql(table, column, id);
    expect(count, `${table} still has a row referencing a deleted user's ${column} — cascade delete regression`).toBe(0);
  }
});

test("/api/export/data and /api/export/vocabulary return only the requesting user's own data", async ({ page, browser }) => {
  // Two fully separate fresh accounts, each with distinctly-named data —
  // the whole point is proving user A's export cannot contain anything
  // that belongs to user B, not just that it contains *something*.
  const emailA = await signUpFreshAccount(page);
  await completeOnboardingForTest(emailA);

  const secretMarker = `E2E-EXPORT-ISOLATION-${Date.now()}`;
  const textTitleA = `${secretMarker}-A-text`;
  const wordA = `${secretMarker}-A-word`;

  await page.goto("/library/new");
  await page.getByLabel("Название").fill(textTitleA);
  await page.getByLabel("Текст").fill("Text that belongs only to user A, used to check export isolation.");
  await page.getByRole("button", { name: "Добавить в библиотеку" }).click();
  await expect(page).toHaveURL(/\/read\/[\w-]+$/, { timeout: 10_000 });

  await page.goto("/notebook");
  await page.getByRole("button", { name: "Добавить слово вручную" }).click();
  await page.getByPlaceholder("Например: serendipity").fill(wordA);
  await page.getByPlaceholder("Перевод").fill("translation-a");
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByText(wordA)).toBeVisible();

  // User B, in a fully separate browser context (separate cookies/session)
  // so both accounts genuinely coexist rather than one overwriting the
  // other's login.
  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  try {
    const emailB = await signUpFreshAccount(pageB);
    await completeOnboardingForTest(emailB);

    const textTitleB = `${secretMarker}-B-text`;
    const wordB = `${secretMarker}-B-word`;

    await pageB.goto("/library/new");
    await pageB.getByLabel("Название").fill(textTitleB);
    await pageB.getByLabel("Текст").fill("Text that belongs only to user B, used to check export isolation.");
    await pageB.getByRole("button", { name: "Добавить в библиотеку" }).click();
    await expect(pageB).toHaveURL(/\/read\/[\w-]+$/, { timeout: 10_000 });

    await pageB.goto("/notebook");
    await pageB.getByRole("button", { name: "Добавить слово вручную" }).click();
    await pageB.getByPlaceholder("Например: serendipity").fill(wordB);
    await pageB.getByPlaceholder("Перевод").fill("translation-b");
    await pageB.getByRole("button", { name: "Сохранить" }).click();
    await expect(pageB.getByText(wordB)).toBeVisible();

    // --- User A's exports: must contain A's own data, must never contain
    // anything with B's marker. ---
    const dataResponse = await page.request.get("/api/export/data");
    expect(dataResponse.ok()).toBe(true);
    const dataBody = await dataResponse.text();
    expect(dataBody).toContain(textTitleA);
    expect(dataBody).toContain(wordA);
    expect(dataBody, "user A's /api/export/data leaked user B's data").not.toContain(textTitleB);
    expect(dataBody, "user A's /api/export/data leaked user B's data").not.toContain(wordB);

    const vocabResponse = await page.request.get("/api/export/vocabulary");
    expect(vocabResponse.ok()).toBe(true);
    const vocabBody = await vocabResponse.text();
    expect(vocabBody).toContain(wordA);
    expect(vocabBody, "user A's /api/export/vocabulary leaked user B's data").not.toContain(wordB);

    // --- Same check the other way round, from B's own session — isolation
    // must hold in both directions, not just "the first user we happened
    // to test". ---
    const dataResponseB = await pageB.request.get("/api/export/data");
    expect(dataResponseB.ok()).toBe(true);
    const dataBodyB = await dataResponseB.text();
    expect(dataBodyB).toContain(textTitleB);
    expect(dataBodyB).toContain(wordB);
    expect(dataBodyB, "user B's /api/export/data leaked user A's data").not.toContain(textTitleA);
    expect(dataBodyB, "user B's /api/export/data leaked user A's data").not.toContain(wordA);

    const vocabResponseB = await pageB.request.get("/api/export/vocabulary");
    expect(vocabResponseB.ok()).toBe(true);
    const vocabBodyB = await vocabResponseB.text();
    expect(vocabBodyB).toContain(wordB);
    expect(vocabBodyB, "user B's /api/export/vocabulary leaked user A's data").not.toContain(wordA);
  } finally {
    await contextB.close();
  }
});

test("/api/export/data and /api/export/vocabulary reject an unauthenticated request", async ({ browser }) => {
  const anonContext = await browser.newContext();
  try {
    const anonPage = await anonContext.newPage();
    const dataResponse = await anonPage.request.get("/api/export/data");
    expect(dataResponse.status()).toBe(401);
    const vocabResponse = await anonPage.request.get("/api/export/vocabulary");
    expect(vocabResponse.status()).toBe(401);
  } finally {
    await anonContext.close();
  }
});
