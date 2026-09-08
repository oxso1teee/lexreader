import { createClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";
import { signUpFreshAccount, completeOnboardingForTest } from "./helpers";

// test-gap-map.md / release-blockers.md P1 #5: the review session
// (reviewWord -> srs_state + review_log persistence) had NO automated
// coverage — "единственная проверка ... делалась вручную в браузере". Unit
// coverage of the pure scheduler (src/lib/srs.test.ts) exists; this closes
// the other half: the real user path through the "cards" review mode
// actually writes scheduling state and a review-log row, and the graded
// card genuinely leaves the due queue afterwards (survives a reload).
//
// Deliberately seeds the deck + flashcard + srs_state directly via
// service_role (same approach as e2e/rls-cross-user-isolation.spec.ts —
// the creation flows are already covered by e2e/brain-notebook.spec.ts and
// e2e/practice-modes-feedback.spec.ts; this test's job is the scheduler
// write, not re-proving card creation) and uses a fresh account so the
// session queue contains exactly this one card (no shared-fixture
// contention with practice-brain-a11y's "birds" card, no interaction with
// the per-day new-card limit — the card is seeded as an already-introduced
// review card: first_reviewed_at set, due_at in the past).

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  );
}

async function getUserIdByEmail(service: ReturnType<typeof serviceClient>, email: string): Promise<string> {
  const { data } = await service.auth.admin.listUsers({ page: 1, perPage: 10_000 });
  const user = data?.users.find((u) => u.email === email);
  if (!user) throw new Error(`no auth user found for ${email}`);
  return user.id;
}

test("review 'cards' mode: grading a due card persists srs_state + review_log and removes it from the queue", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const service = serviceClient();

  const email = await signUpFreshAccount(page);
  await completeOnboardingForTest(email);
  const userId = await getUserIdByEmail(service, email);

  // --- Seed one deck + one flashcard + one due review card. ---
  const stamp = Date.now();
  const { data: deck, error: deckError } = await service
    .from("decks")
    .insert({ owner_id: userId, name: `E2E Deck Review ${stamp}`, language: "en", is_starter: false })
    .select("id")
    .single();
  expect(deckError, "deck seed failed").toBeNull();
  const deckId = deck!.id;

  const { data: flashcard, error: fcError } = await service
    .from("flashcards")
    .insert({
      owner_id: userId,
      deck_id: deckId,
      front: "e2e-review-word",
      back: "тест-повторение",
      language: "en",
      item_type: "word",
      normalized_key: `e2e-review-${stamp}`,
      source_type: "manual",
      is_starter: false,
    })
    .select("id")
    .single();
  expect(fcError, "flashcard seed failed").toBeNull();
  const flashcardId = flashcard!.id;

  const pastDueAt = new Date(stamp - 60 * 60 * 1000).toISOString();
  const firstReviewedAt = new Date(stamp - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { error: srsError } = await service.from("srs_state").insert({
    flashcard_id: flashcardId,
    ease_factor: 2.5,
    interval_days: 1,
    repetitions: 1,
    due_at: pastDueAt,
    first_reviewed_at: firstReviewedAt,
  });
  expect(srsError, "srs_state seed failed").toBeNull();

  try {
    // --- The card is available for review. ---
    await page.goto(`/brain/${deckId}/review`);
    await expect(page.getByRole("button", { name: "Показать ответ" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("e2e-review-word").first()).toBeVisible();

    // --- Reveal + grade "Помню" (grade 2). The inner label span is exactly
    // "Помню", which disambiguates it from "Не помню" (grade 0). ---
    await page.getByRole("button", { name: "Показать ответ" }).click();
    await expect(page.getByText("тест-повторение").first()).toBeVisible();
    await page.getByRole("button").filter({ has: page.getByText("Помню", { exact: true }) }).click();

    // --- Single-card session -> completion screen. ---
    await expect(page.getByText("Сессия завершена")).toBeVisible({ timeout: 20_000 });

    // --- srs_state was really rescheduled by the SM-2 scheduler. ---
    const { data: srs } = await service.from("srs_state").select("*").eq("flashcard_id", flashcardId).single();
    expect(Number(srs!.repetitions), "repetitions incremented 1 -> 2").toBe(2);
    // repetitions was 1 -> the scheduler's fixed second-review interval is 6
    // days (src/lib/srs.ts) — comfortably in the future regardless of clock skew.
    expect(new Date(srs!.due_at).getTime(), "due_at pushed well into the future").toBeGreaterThan(
      Date.now() + 3 * 24 * 60 * 60 * 1000,
    );
    expect(srs!.last_reviewed_at, "last_reviewed_at stamped").not.toBeNull();
    // Same instant, compared as a timestamp — PostgREST serializes it as
    // "...+00:00", not the "...Z" that was sent in.
    expect(
      new Date(srs!.first_reviewed_at).getTime(),
      "first_reviewed_at preserved, not overwritten",
    ).toBe(new Date(firstReviewedAt).getTime());

    // --- review_log row was written with the legacy snapshot undo relies on. ---
    const { data: logs } = await service
      .from("review_log")
      .select("*")
      .eq("flashcard_id", flashcardId);
    expect(logs, "exactly one review_log row for this card").toHaveLength(1);
    const log = logs![0];
    expect(log.grade).toBe(2);
    expect(log.practice_mode).toBe("cards");
    expect(log.previous_legacy_state_json, "previous legacy snapshot present").not.toBeNull();
    expect(log.next_legacy_state_json, "next legacy snapshot present").not.toBeNull();
    expect(log.previous_legacy_state_json.repetitions).toBe(1);
    expect(log.next_legacy_state_json.repetitions).toBe(2);
    expect(
      new Date(log.next_legacy_state_json.due_at).getTime(),
      "review_log's next due_at matches the persisted srs_state due_at",
    ).toBe(new Date(srs!.due_at).getTime());

    // --- Persistence across a reload: the graded card is no longer due. ---
    await page.goto(`/brain/${deckId}/review`);
    await expect(page.getByText("Нечего повторять")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Показать ответ" })).toHaveCount(0);
  } finally {
    // flashcards delete cascades srs_state + review_log (FK on delete cascade,
    // migration 0004_decks.sql).
    await service.from("flashcards").delete().eq("id", flashcardId);
    await service.from("decks").delete().eq("id", deckId);
  }
});
