import { createClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";
import { signUpFreshAccount, completeOnboardingForTest } from "./helpers";

// docs/release-2026-08-22/10_VAU_NOVYE_FICHI_I_DIZAYN.md раздел C, Тир 3 —
// "Соревновательность — недельная лига/лидерборд". Первый в проекте
// SECURITY DEFINER RPC (supabase/migrations/0049_weekly_leaderboard.sql) —
// первый в проекте случай, когда межпользовательское чтение вообще
// ДОЛЖНО работать (агрегированная лига), но обязано никогда не выдавать
// ничего сверх rank/is_you/инициалы/агрегаты. Тот же стиль, что и
// e2e/rls-cross-user-isolation.spec.ts: реальные сессии через анонимный
// ключ (то, чем реально авторизуется прямой вызов PostgREST/`.rpc()` из
// браузера), не service_role — если политика/функция когда-нибудь
// ослабнет, это упадёт само, без напоминаний.

const FRESH_ACCOUNT_PASSWORD = "testpass123"; // matches signUpFreshAccount in helpers.ts

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
}

async function signInAnon(email: string) {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "");
  const { data, error } = await client.auth.signInWithPassword({ email, password: FRESH_ACCOUNT_PASSWORD });
  if (error || !data.session) throw new Error(`signInAnon(${email}) failed: ${error?.message}`);
  return client;
}

function initialsFromEmail(email: string): string {
  const local = email.split("@")[0]?.trim() ?? "";
  const letters = local.match(/[a-zA-Z0-9]/g) ?? [];
  return letters.slice(0, 2).join("").toUpperCase();
}

async function seedWord(service: ReturnType<typeof serviceClient>, ownerId: string, headword: string) {
  await service.from("vocabulary_items").insert({ owner_id: ownerId, headword, translation: "x", language: "en" });
}

test("weekly leaderboard: opt-in is required to appear, only initials+aggregates ever leak, opting out removes you", async ({ page, browser }) => {
  const service = serviceClient();

  const emailA = await signUpFreshAccount(page);
  await completeOnboardingForTest(emailA);
  const { data: usersA } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const userIdA = usersA!.users.find((u) => u.email === emailA)!.id;

  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  let emailB: string;
  let userIdB: string;
  try {
    emailB = await signUpFreshAccount(pageB);
    await completeOnboardingForTest(emailB);
    const { data: usersB } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
    userIdB = usersB!.users.find((u) => u.email === emailB)!.id;
  } finally {
    await contextB.close();
  }

  try {
    // Real activity for BOTH, seeded before either opts in.
    await seedWord(service, userIdA, "lb-a-word-1");
    await seedWord(service, userIdB, "lb-b-word-1");

    const clientA = await signInAnon(emailA);
    const clientB = await signInAnon(emailB);

    // --- 1. Neither opted in yet — real activity exists, but nobody appears. ---
    const { data: beforeOptIn } = await clientA.rpc("get_weekly_leaderboard");
    expect(beforeOptIn ?? [], "activity exists but neither user opted in — leaderboard must be empty").toEqual([]);

    // --- 2. A opts in (real UPDATE through A's own RLS-scoped session — same
    // path Settings' checkbox uses, not a service_role shortcut). B still
    // has NOT opted in. ---
    const { error: optInErrorA } = await clientA.from("profiles").update({ leaderboard_opt_in: true }).eq("id", userIdA);
    expect(optInErrorA).toBeNull();

    // Exactly one row — B has real activity too but never opted in, so if
    // she leaked in this would be 2, not 1 (initials alone can't
    // distinguish them here: signUpFreshAccount emails all share the same
    // "e2e-" prefix, so A and B can validly derive to identical initials —
    // that collision is an *expected*, even desirable, anonymity property,
    // not something this test should route around by making emails more
    // distinguishable).
    const { data: afterAOptIn } = await clientA.rpc("get_weekly_leaderboard");
    expect(afterAOptIn ?? [], "only A opted in — exactly one row (B must not have leaked in)").toHaveLength(1);
    const rowA = afterAOptIn![0];
    expect(rowA.is_you, "A viewing her own row must see is_you=true").toBe(true);
    expect(rowA.initials).toBe(initialsFromEmail(emailA));
    expect(rowA.words_count).toBeGreaterThanOrEqual(1);

    // --- 3. B (not opted in herself) can still VIEW the leaderboard — seeing
    // it and being ranked on it are different things — and sees A's row
    // correctly with is_you=false from B's perspective, and NOTHING beyond
    // the safe columns (no email, no id, no raw table names). ---
    const { data: viewedByB } = await clientB.rpc("get_weekly_leaderboard");
    expect(viewedByB ?? []).toHaveLength(1);
    const rowAFromB = viewedByB![0];
    expect(rowAFromB.is_you, "B must never see is_you=true for A's row").toBe(false);
    expect(rowAFromB.initials).toBe(initialsFromEmail(emailA));

    const allKeys = new Set(Object.keys(rowAFromB));
    for (const forbidden of ["email", "id", "user_id", "owner_id", "headword", "front", "back"]) {
      expect(allKeys.has(forbidden), `RPC response leaked a raw field: ${forbidden}`).toBe(false);
    }
    expect(JSON.stringify(viewedByB)).not.toContain("@"); // no email-shaped string anywhere in the payload

    // --- 4. Raw per-user tables are still exactly as locked down as
    // rls-cross-user-isolation.spec.ts already proves generally — the
    // leaderboard RPC is the ONLY sanctioned cross-user read, direct table
    // access must remain blocked. ---
    const { data: rawRead } = await clientB.from("vocabulary_items").select("*").eq("owner_id", userIdA);
    expect(rawRead ?? [], "B could read A's raw vocabulary_items directly — RLS regression").toEqual([]);

    // --- 5. Both opt in — both appear, ranked, each sees their own is_you. ---
    const { error: optInErrorB } = await clientB.from("profiles").update({ leaderboard_opt_in: true }).eq("id", userIdB);
    expect(optInErrorB).toBeNull();
    const { data: bothIn } = await clientA.rpc("get_weekly_leaderboard");
    expect(bothIn ?? []).toHaveLength(2);
    expect(bothIn!.filter((r: { is_you: boolean }) => r.is_you)).toHaveLength(1);

    // --- 6. Opting back out removes you immediately (not just "hides" —
    // gone from the very next call), same explicit-control the checkbox promises. ---
    const { error: optOutErrorA } = await clientA.from("profiles").update({ leaderboard_opt_in: false }).eq("id", userIdA);
    expect(optOutErrorA).toBeNull();
    const { data: afterAOptOut } = await clientB.rpc("get_weekly_leaderboard");
    expect(afterAOptOut ?? []).toHaveLength(1);
    expect(afterAOptOut![0].initials).toBe(initialsFromEmail(emailB));
  } finally {
    await service.from("vocabulary_items").delete().in("owner_id", [userIdA, userIdB]);
    await service.auth.admin.deleteUser(userIdA);
    await service.auth.admin.deleteUser(userIdB);
  }
});
