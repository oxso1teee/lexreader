import { createClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";

// M3 Slice 9 (plan doc §9) — regression test for a real pre-existing gap:
// before this fix, a signUp() that succeeded followed by a failed
// `profiles` insert left a real auth.users row with no way to ever finish
// onboarding (retrying the form always hit "already registered" with no
// recovery). Reproduces that exact orphaned state directly (auth user
// exists, no profiles row) via the admin API rather than trying to force a
// real mid-flight DB failure, then proves the onboarding form recovers it.
function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
}

test("orphaned auth user (no profiles row) recovers via the onboarding form instead of looping", async ({ page }) => {
  const supabase = serviceClient();
  const email = `e2e-orphan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = "testpass123";

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  expect(createError, "test setup: creating the orphaned auth user must succeed").toBeNull();
  const userId = created!.user!.id;

  const { data: precondition } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  expect(precondition, "test precondition: the orphaned user must have no profiles row yet").toBeNull();

  try {
    await page.goto("/onboarding");
    await page.getByRole("button", { name: "Далее" }).click();
    await page.getByRole("button", { name: "Для жизни" }).click();
    await page.getByRole("button", { name: "Далее" }).click();
    await page.getByRole("button", { name: "Английский" }).click();
    await page.getByRole("button", { name: "Далее" }).click();
    await page.getByRole("button", { name: "Русский" }).click();
    await page.getByRole("button", { name: "Далее" }).click();
    await page.getByRole("button", { name: "A2", exact: true }).click();
    await page.getByRole("button", { name: "Далее" }).click();

    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Пароль (мин. 6 символов)").fill(password);
    await page.getByRole("button", { name: "Создать аккаунт и начать" }).click();

    // The regression: before the fix, this hit "already registered" and
    // stayed on /onboarding forever. The fix falls back to a real login
    // with the same credentials, then upserts the profile — so this must
    // now redirect exactly like a normal fresh signup does.
    await page.waitForURL(/\/onboarding\/placement$/, { timeout: 15_000 });
    await expect(page.getByText(/Не удалось создать аккаунт|уже существует/)).not.toBeVisible();

    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id, target_language, native_language, primary_goal, self_reported_cefr")
      .eq("id", userId);
    expect(profileRows?.length, "exactly one profile row must exist — no duplicate from the upsert").toBe(1);
    expect(profileRows?.[0].target_language).toBe("en");
    expect(profileRows?.[0].native_language).toBe("ru");
    expect(profileRows?.[0].primary_goal).toBe("everyday");
    expect(profileRows?.[0].self_reported_cefr).toBe("A2");
  } finally {
    await supabase.from("decks").delete().eq("owner_id", userId);
    await supabase.from("profiles").delete().eq("id", userId);
    await supabase.auth.admin.deleteUser(userId);
  }
});
