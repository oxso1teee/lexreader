import { test } from "node:test";
import assert from "node:assert/strict";
import { isMissingRelationError, getOrCreateSettings, getOrCreateSettingsSafe } from "./settings.ts";
import type { SupabaseServerClient } from "@/lib/supabase/server";

// Same style as fsrs.test.ts's isMissingFsrsColumnsError coverage — pure
// error-classification function, tested directly against representative
// error codes. Both codes are real: 42P01 is the raw Postgres SQLSTATE;
// PGRST205 is what supabase-js/PostgREST actually returns in practice
// (confirmed empirically 2026-08-06 by dropping the six language_twin_*
// tables locally and hitting /home — see isMissingRelationError's comment).
test("isMissingRelationError(): true for Postgres 42P01 (undefined_table) and PostgREST's PGRST205", () => {
  assert.equal(isMissingRelationError({ code: "42P01" }), true);
  assert.equal(isMissingRelationError({ code: "PGRST205" }), true);
});

test("isMissingRelationError(): false for other error codes and for null/undefined", () => {
  assert.equal(isMissingRelationError({ code: "23505" }), false); // unique_violation, for example
  assert.equal(isMissingRelationError({}), false);
  assert.equal(isMissingRelationError(null), false);
  assert.equal(isMissingRelationError(undefined), false);
});

// Incident 2026-08-06: Preview/Production share one Supabase project (see
// Vercel env config) and migration 0036 has only ever been applied locally
// — every language_twin_* query there fails with PGRST205 until that
// migration is applied. getOrCreateSettings() correctly still throws
// (existing callers like the settings-mutation actions want a hard
// failure); this fake client reproduces that exact "table doesn't exist"
// condition without a real Supabase connection, matching how it actually
// failed on Preview (verified against the real error via `vercel logs`).
function fakeMissingTableClient(): SupabaseServerClient {
  const relationError = { code: "PGRST205", message: "Could not find the table 'public.language_twin_settings' in the schema cache" };
  const terminal = { maybeSingle: async () => ({ data: null, error: relationError }), single: async () => ({ data: null, error: relationError }) };
  const fake = {
    from() {
      return {
        select: () => ({ eq: () => terminal }),
        insert: () => ({ select: () => ({ single: terminal.single }) }),
      };
    },
  };
  return fake as unknown as SupabaseServerClient;
}

test("getOrCreateSettings(): throws when language_twin_settings doesn't exist (PGRST205)", async () => {
  await assert.rejects(() => getOrCreateSettings(fakeMissingTableClient(), "user-1"));
});

test("getOrCreateSettingsSafe(): never throws for the same missing-table condition — returns null instead", async () => {
  const result = await getOrCreateSettingsSafe(fakeMissingTableClient(), "user-1");
  assert.equal(result, null);
});
