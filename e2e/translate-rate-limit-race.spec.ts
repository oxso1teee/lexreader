import { createClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";
import { TEST_EMAIL } from "./helpers";

// docs/release-2026-08-22/02_KRITICHNYE_BAGI_SEYCHAS.md B.2 — proves
// check_translate_rate_limit (supabase/migrations/0045_atomic_translate_rate_limit.sql)
// is actually atomic under real concurrent load, not just correct when
// called one request at a time. This needs a real Postgres connection —
// the whole point is proving the advisory lock actually serializes
// concurrent transactions; a mocked Supabase client couldn't prove or
// disprove that. No `page`/browser needed, same non-UI style as
// today-crash-regression.spec.ts's direct-DB assertions.

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
}

async function getTestUserId(supabase: ReturnType<typeof serviceClient>): Promise<string> {
  const { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 10_000 });
  const user = data?.users.find((u) => u.email === TEST_EMAIL);
  if (!user) throw new Error(`${TEST_EMAIL} not found — check global-setup.ts`);
  return user.id;
}

test("check_translate_rate_limit allows exactly the limit — never more — under real concurrent load", async () => {
  const supabase = serviceClient();
  const userId = await getTestUserId(supabase);
  const LIMIT = 10;
  const CONCURRENCY = 40;

  // Clean slate: leftover rows from a previous run (or another spec that
  // happened to exercise this same account's translate_requests) would make
  // "allowed === LIMIT" meaningless. playwright.config.ts runs test files
  // serially (fullyParallel: false, workers: 1), so no other spec is
  // touching this account's rows concurrently with this one.
  await supabase.from("translate_requests").delete().eq("owner_id", userId);

  try {
    // Fire all CONCURRENCY calls in the same instant — this is the exact
    // shape of load the old select-count-then-insert logic couldn't survive:
    // every one of these would read the same pre-burst count before any of
    // the others' inserts were visible to it, letting well more than LIMIT
    // through. The advisory-lock RPC must serialize them instead.
    const results = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        supabase.rpc("check_translate_rate_limit", {
          p_owner_id: userId,
          p_limit: LIMIT,
          p_window_seconds: 60,
        }),
      ),
    );

    for (const r of results) {
      expect(r.error, `rpc call failed: ${JSON.stringify(r.error)}`).toBeNull();
    }

    const allowedCount = results.filter((r) => r.data === true).length;
    const { count: recordedCount } = await supabase
      .from("translate_requests")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId);

    // The actual regression this test locks down: with real atomicity, a
    // burst of 40 concurrent requests against a limit of 10 allows exactly
    // 10 through — deterministically, not "approximately 10 plus however
    // many raced past before the count caught up" like the pre-fix logic.
    expect(allowedCount).toBe(LIMIT);
    // Rejection must mean "logged, but over the line", never "silently
    // dropped" — every concurrent call still gets its own row.
    expect(recordedCount).toBe(CONCURRENCY);
  } finally {
    await supabase.from("translate_requests").delete().eq("owner_id", userId);
  }
});
