import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseServerClient } from "./supabase/server";
import { getPlan, PAYMENT_GRACE_PERIOD_DAYS } from "./subscription.ts";

const MOCK_USER_ID = "test-user-id";

function makeMockSupabase(returnValue: { plan?: string; status?: string; current_period_end?: string | null }): SupabaseServerClient {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => ({ data: returnValue, error: null }),
  };
  return {
    from: () => chain,
  } as unknown as SupabaseServerClient;
}

test("getPlan: active subscription returns plan", async () => {
  const supabase = makeMockSupabase({ plan: "premium_monthly", status: "active", current_period_end: "2026-12-01T00:00:00.000Z" });
  const plan = await getPlan(supabase, MOCK_USER_ID);
  assert.equal(plan, "premium_monthly");
});

test("getPlan: trialing subscription returns plan (mapped to active in webhook)", async () => {
  const supabase = makeMockSupabase({ plan: "premium_monthly", status: "active", current_period_end: "2026-12-01T00:00:00.000Z" });
  const plan = await getPlan(supabase, MOCK_USER_ID);
  assert.equal(plan, "premium_monthly");
});

test("getPlan: past_due with current_period_end in future -> premium within grace", async () => {
  const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
  const supabase = makeMockSupabase({ plan: "premium_monthly", status: "past_due", current_period_end: futureDate });
  const plan = await getPlan(supabase, MOCK_USER_ID);
  assert.equal(plan, "premium_monthly");
});

test("getPlan: past_due with current_period_end in past but grace not expired -> premium", async () => {
  const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const supabase = makeMockSupabase({ plan: "premium_yearly", status: "past_due", current_period_end: pastDate });
  const plan = await getPlan(supabase, MOCK_USER_ID);
  assert.equal(plan, "premium_yearly");
});

test("getPlan: past_due with current_period_end in past and grace expired -> free", async () => {
  const oldDate = new Date(Date.now() - (PAYMENT_GRACE_PERIOD_DAYS + 5) * 24 * 60 * 60 * 1000).toISOString();
  const supabase = makeMockSupabase({ plan: "premium_monthly", status: "past_due", current_period_end: oldDate });
  const plan = await getPlan(supabase, MOCK_USER_ID);
  assert.equal(plan, "free");
});

test("getPlan: past_due with current_period_end = NULL -> free (no artificial grace)", async () => {
  const supabase = makeMockSupabase({ plan: "premium_monthly", status: "past_due", current_period_end: null });
  const plan = await getPlan(supabase, MOCK_USER_ID);
  assert.equal(plan, "free");
});

test("getPlan: past_due with missing current_period_end -> free (no artificial grace)", async () => {
  const supabase = makeMockSupabase({ plan: "premium_monthly", status: "past_due" });
  const plan = await getPlan(supabase, MOCK_USER_ID);
  assert.equal(plan, "free");
});

test("getPlan: canceled subscription -> free", async () => {
  const supabase = makeMockSupabase({ plan: "premium_monthly", status: "canceled", current_period_end: "2026-12-01T00:00:00.000Z" });
  const plan = await getPlan(supabase, MOCK_USER_ID);
  assert.equal(plan, "free");
});

test("getPlan: no subscription row -> free", async () => {
  const supabase = makeMockSupabase({});
  const plan = await getPlan(supabase, MOCK_USER_ID);
  assert.equal(plan, "free");
});

test("getPlan: active with current_period_end in past -> still premium (not past_due)", async () => {
  const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
  const supabase = makeMockSupabase({ plan: "premium_monthly", status: "active", current_period_end: pastDate });
  const plan = await getPlan(supabase, MOCK_USER_ID);
  assert.equal(plan, "premium_monthly");
});