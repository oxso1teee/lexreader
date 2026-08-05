import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeFront, findDuplicateFlashcardId, partitionByExistingFront } from "./flashcard-dedup.ts";
import type { SupabaseServerClient } from "./supabase/server.ts";

test("normalizeFront: trims whitespace and lowercases", () => {
  assert.equal(normalizeFront("  Hello World  "), "hello world");
});

test("normalizeFront: is idempotent on already-normalized input", () => {
  assert.equal(normalizeFront("hello"), "hello");
});

// Минимальная реализация цепочки .from().select().eq().eq() (await напрямую)
// и .from().select().eq().eq().ilike().maybeSingle() — ровно то, что
// использует flashcard-dedup.ts, не полный Supabase-клиент.
function makeSupabaseStub(existingFronts: string[]): SupabaseServerClient {
  const rows = existingFronts.map((front) => ({ front }));
  const chain = {
    select() {
      return chain;
    },
    eq() {
      return chain;
    },
    ilike(_col: string, pattern: string) {
      const needle = pattern.replace(/\\([%_])/g, "$1");
      const match = rows.find((r) => r.front.trim().toLowerCase() === needle);
      return { maybeSingle: async () => ({ data: match ? { id: "existing-id" } : null }) };
    },
    then(resolve: (v: { data: typeof rows }) => void) {
      resolve({ data: rows });
    },
  };
  return { from: () => chain } as unknown as SupabaseServerClient;
}

test("partitionByExistingFront: splits genuinely-new rows from duplicates of existing flashcards", async () => {
  const supabase = makeSupabaseStub(["hello", "goodbye"]);
  const rows = [{ front: "Hello" }, { front: "New Word" }, { front: "  GOODBYE  " }];

  const result = await partitionByExistingFront(supabase, "owner-1", "en", rows);

  assert.deepEqual(
    result.newRows.map((r) => r.front),
    ["New Word"],
  );
  assert.equal(result.skippedDuplicates, 2);
});

test("partitionByExistingFront: no duplicates in the batch means nothing is skipped", async () => {
  const supabase = makeSupabaseStub([]);
  const rows = [{ front: "one" }, { front: "two" }];

  const result = await partitionByExistingFront(supabase, "owner-1", "en", rows);

  assert.equal(result.newRows.length, 2);
  assert.equal(result.skippedDuplicates, 0);
});

test("findDuplicateFlashcardId: returns the existing id on a case/whitespace-insensitive match", async () => {
  const supabase = makeSupabaseStub(["serendipity"]);

  const id = await findDuplicateFlashcardId(supabase, "owner-1", "en", "  Serendipity  ");

  assert.equal(id, "existing-id");
});

test("findDuplicateFlashcardId: returns null when no flashcard matches", async () => {
  const supabase = makeSupabaseStub(["serendipity"]);

  const id = await findDuplicateFlashcardId(supabase, "owner-1", "en", "ephemeral");

  assert.equal(id, null);
});
