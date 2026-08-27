import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";
import { login, TEST_EMAIL } from "./helpers";

// missions (migration 0037) only grants authenticated, not service_role —
// a pre-existing, unrelated gap (every other e2e-seeded table does grant
// service_role). Rather than adding a new migration mid-incident-fix, seed
// via a direct psql connection to the same fixed local Supabase Postgres
// (`supabase start`'s unchanging default: postgres:postgres@127.0.0.1:54322)
// used both locally and by this project's own CI e2e job — the same
// approach already established for this project's migration checkpoints.
function psql(sql: string) {
  execFileSync("psql", ["-h", "127.0.0.1", "-p", "54322", "-U", "postgres", "-d", "postgres", "-c", sql], {
    env: { ...process.env, PGPASSWORD: "postgres" },
  });
}

// M3 Slice 8 regression — a real Vercel Preview crash reported after this
// slice shipped: authenticated /home hit the (app) error boundary
// ("Не получилось выполнить действие") instead of rendering. Root cause
// (found via Vercel runtime logs, an "Event handlers cannot be passed to
// Client Component props" RSC error): src/components/product/today/
// hero-mission-card.tsx was missing "use client" while using onClick on a
// <Link> — a pre-existing Today v2 (M3 Slice 7) bug, unrelated to Learning
// Paths' own code, that no e2e test had ever caught because no test seeds
// a real active Mission for the hero slot. This file locks down both the
// state that was suspected (empty Learning Paths) and the state that
// actually crashed (a real hero Mission present).

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
}

async function getTestUserId(supabase: ReturnType<typeof serviceClient>): Promise<string> {
  const { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 10_000 });
  const user = data?.users.find((u) => u.email === TEST_EMAIL);
  if (!user) throw new Error(`${TEST_EMAIL} not found — check global-setup.ts`);
  return user.id;
}

test("Today renders successfully for an authenticated user with no Learning Paths enrollment (empty state)", async ({ page }) => {
  const supabase = serviceClient();
  const userId = await getTestUserId(supabase);
  // No enrollment row for this user by default — confirm the (app) error
  // boundary never fires and the page's own content renders.
  const { data: enrollment } = await supabase.from("learning_path_enrollments").select("id").eq("user_id", userId).maybeSingle();
  expect(enrollment, "test precondition: TEST_EMAIL must have no Learning Paths enrollment").toBeNull();

  await login(page);
  await expect(page.getByText("Не получилось выполнить действие")).not.toBeVisible();
  // src/lib/today.ts greetingForHour() has 4 buckets, not 3 — hour < 5
  // returns "Доброй ночи", which this assertion was missing entirely, so
  // any CI run landing between 00:00-04:59 UTC failed here on a real
  // "Доброй ночи!" greeting the test simply never recognized as valid.
  await expect(
    page
      .getByText("Добрый день!")
      .or(page.getByText("Доброе утро!"))
      .or(page.getByText("Добрый вечер!"))
      .or(page.getByText("Доброй ночи!")),
  ).toBeVisible();
});

test("Today renders successfully for an authenticated user with a real active Mission (hero slot)", async ({ page }) => {
  const supabase = serviceClient();
  const userId = await getTestUserId(supabase);
  const fingerprint = "e2e-today-crash-regression";

  psql(
    `insert into missions (user_id, mission_type, title, reason_key, skill_category, difficulty, estimated_minutes, step_count, status, priority, fingerprint, payload_json, expires_at)
     values ('${userId}', 'grammar_pattern', 'Regression test mission', 'test_reason', 'article', 'medium', 4, 5, 'available', 'high', '${fingerprint}', '{"questions": []}', now() + interval '7 days')`,
  );

  try {
    await login(page);
    // This exact render path (hero-mission-card.tsx's onClick usage) is
    // what threw the RSC "Event handlers cannot be passed to Client
    // Component props" error before the fix.
    await expect(page.getByText("Не получилось выполнить действие")).not.toBeVisible();
    await expect(page.getByText("Твой следующий шаг")).toBeVisible();
  } finally {
    psql(`delete from missions where fingerprint = '${fingerprint}'`);
  }
});
