import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseServerClient } from "./supabase/server";
import {
  hasFreeDeckRoom,
  hasFreeFlashcardRoom,
  FREE_DECK_LIMIT,
  FREE_FLASHCARD_LIMIT,
  getPlan,
} from "./subscription.ts";

const MOCK_USER_ID = "test-user-id";

function makeMockSupabaseWithCounts(deckCount: number, flashcardCount: number, plan: "free" | "premium_monthly" | "premium_yearly" = "free"): SupabaseServerClient {
  const deckQuery = {
    select: (_cols: string, opts?: { count?: "exact"; head?: boolean }) => {
      if (opts?.count === "exact" && opts?.head) {
        return {
          eq: (col: string, val: unknown) => {
            if (col === "owner_id" && val === MOCK_USER_ID) {
              return {
                eq: (col2: string, val2: unknown) => {
                  if (col2 === "is_starter" && val2 === false) {
                    return Promise.resolve({ count: deckCount, error: null });
                  }
                  return Promise.resolve({ count: deckCount, error: null });
                },
              };
            }
            return Promise.resolve({ count: 0, error: null });
          },
        };
      }
      return deckQuery;
    },
    eq: () => deckQuery,
    maybeSingle: async () => ({ data: null, error: null }),
  };

  const flashcardQuery = {
    select: (_cols: string, opts?: { count?: "exact"; head?: boolean }) => {
      if (opts?.count === "exact" && opts?.head) {
        return {
          eq: (col: string, val: unknown) => {
            if (col === "owner_id" && val === MOCK_USER_ID) {
              return {
                eq: (col2: string, val2: unknown) => {
                  if (col2 === "is_starter" && val2 === false) {
                    return Promise.resolve({ count: flashcardCount, error: null });
                  }
                  return Promise.resolve({ count: flashcardCount, error: null });
                },
              };
            }
            return Promise.resolve({ count: 0, error: null });
          },
        };
      }
      return flashcardQuery;
    },
    eq: () => flashcardQuery,
    maybeSingle: async () => ({ data: null, error: null }),
  };

  const subscriptionQuery = {
    select: () => subscriptionQuery,
    eq: () => subscriptionQuery,
    maybeSingle: async () => {
      if (plan === "free") return { data: null, error: null };
      return { data: { plan, status: "active", current_period_end: "2026-12-01T00:00:00.000Z" }, error: null };
    },
  };

  return {
    from: (table: string) => {
      if (table === "decks") return deckQuery;
      if (table === "flashcards") return flashcardQuery;
      if (table === "subscriptions") return subscriptionQuery;
      return deckQuery;
    },
  } as unknown as SupabaseServerClient;
}

test("hasFreeDeckRoom: free user with 0 decks -> true", async () => {
  const supabase = makeMockSupabaseWithCounts(0, 0, "free");
  const result = await hasFreeDeckRoom(supabase, MOCK_USER_ID);
  assert.equal(result, true);
});

test("hasFreeDeckRoom: free user with 2 decks -> true", async () => {
  const supabase = makeMockSupabaseWithCounts(2, 0, "free");
  const result = await hasFreeDeckRoom(supabase, MOCK_USER_ID);
  assert.equal(result, true);
});

test("hasFreeDeckRoom: free user with 3 decks -> false (limit reached)", async () => {
  const supabase = makeMockSupabaseWithCounts(3, 0, "free");
  const result = await hasFreeDeckRoom(supabase, MOCK_USER_ID);
  assert.equal(result, false);
});

test("hasFreeDeckRoom: free user with 3 starter decks -> true (starter not counted)", async () => {
  const supabase = makeMockSupabaseWithCounts(0, 0, "free");
  const result = await hasFreeDeckRoom(supabase, MOCK_USER_ID);
  assert.equal(result, true);
});

test("hasFreeDeckRoom: free user with 3 regular decks + 5 starter decks -> false (regular limit reached)", async () => {
  const supabase = makeMockSupabaseWithCounts(3, 0, "free");
  const result = await hasFreeDeckRoom(supabase, MOCK_USER_ID);
  assert.equal(result, false);
});

test("hasFreeDeckRoom: free user with 2 regular decks + 5 starter decks -> true (under regular limit)", async () => {
  const supabase = makeMockSupabaseWithCounts(2, 0, "free");
  const result = await hasFreeDeckRoom(supabase, MOCK_USER_ID);
  assert.equal(result, true);
});

test("hasFreeDeckRoom: premium user -> true (unlimited)", async () => {
  const supabase = makeMockSupabaseWithCounts(100, 0, "premium_monthly");
  const result = await hasFreeDeckRoom(supabase, MOCK_USER_ID);
  assert.equal(result, true);
});

test("hasFreeFlashcardRoom: free user with 0 flashcards -> true", async () => {
  const supabase = makeMockSupabaseWithCounts(0, 0, "free");
  const result = await hasFreeFlashcardRoom(supabase, MOCK_USER_ID);
  assert.equal(result, true);
});

test("hasFreeFlashcardRoom: free user with 49 flashcards -> true", async () => {
  const supabase = makeMockSupabaseWithCounts(0, 49, "free");
  const result = await hasFreeFlashcardRoom(supabase, MOCK_USER_ID);
  assert.equal(result, true);
});

test("hasFreeFlashcardRoom: free user with 50 flashcards -> false (limit reached)", async () => {
  const supabase = makeMockSupabaseWithCounts(0, 50, "free");
  const result = await hasFreeFlashcardRoom(supabase, MOCK_USER_ID);
  assert.equal(result, false);
});

test("hasFreeFlashcardRoom: free user with 50 starter flashcards -> true (starter not counted)", async () => {
  const supabase = makeMockSupabaseWithCounts(0, 0, "free");
  const result = await hasFreeFlashcardRoom(supabase, MOCK_USER_ID);
  assert.equal(result, true);
});

test("hasFreeFlashcardRoom: free user with 50 regular flashcards + 20 starter -> false (regular limit reached)", async () => {
  const supabase = makeMockSupabaseWithCounts(0, 50, "free");
  const result = await hasFreeFlashcardRoom(supabase, MOCK_USER_ID);
  assert.equal(result, false);
});

test("hasFreeFlashcardRoom: free user with 49 regular flashcards + 20 starter -> true (under regular limit)", async () => {
  const supabase = makeMockSupabaseWithCounts(0, 49, "free");
  const result = await hasFreeFlashcardRoom(supabase, MOCK_USER_ID);
  assert.equal(result, true);
});

test("hasFreeFlashcardRoom: additional parameter respected", async () => {
  const supabase = makeMockSupabaseWithCounts(0, 47, "free");
  const result = await hasFreeFlashcardRoom(supabase, MOCK_USER_ID, 3);
  assert.equal(result, true);
  const result2 = await hasFreeFlashcardRoom(supabase, MOCK_USER_ID, 4);
  assert.equal(result2, false);
});

test("hasFreeFlashcardRoom: premium user -> true (unlimited)", async () => {
  const supabase = makeMockSupabaseWithCounts(0, 1000, "premium_monthly");
  const result = await hasFreeFlashcardRoom(supabase, MOCK_USER_ID);
  assert.equal(result, true);
});

test("getPlan: free user (no subscription) -> free", async () => {
  const supabase = makeMockSupabaseWithCounts(0, 0, "free");
  const plan = await getPlan(supabase, MOCK_USER_ID);
  assert.equal(plan, "free");
});

test("Constants: FREE_DECK_LIMIT and FREE_FLASHCARD_LIMIT match expected values", () => {
  assert.equal(FREE_DECK_LIMIT, 3);
  assert.equal(FREE_FLASHCARD_LIMIT, 50);
});