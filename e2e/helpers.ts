import { expect, type Locator, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

export const TEST_EMAIL = "test@example.com";
export const TEST_PASSWORD = "newtestpass456";

export async function login(page: Page, email = TEST_EMAIL, password = TEST_PASSWORD) {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Пароль").fill(password);
  await page.getByRole("button", { name: "Войти" }).click();
  // Логин идёт через Server Action + redirect(); без явного ожидания
  // следующий page.goto() может улететь раньше, чем auth-cookie реально
  // закоммитится, и словить неавторизованный редирект на /onboarding.
  await page.waitForURL(/\/home$/);
}

// M3 Slice 3: некоторые проверки (например, свободное место по free-tier
// лимиту текстов) не могут переиспользовать общий test@example.com — он
// давно исчерпал FREE_TEXT_LIMIT за счёт множества прогонов набора за один
// день. Даёт новый аккаунт с нуля, останавливаясь сразу после регистрации
// (M3 Slice 9: не проходит сам Placement — вызывающий тест сам решает,
// куда перейти дальше).
export async function signUpFreshAccount(page: Page): Promise<string> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

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
  await page.getByPlaceholder("Пароль (мин. 6 символов)").fill("testpass123");
  await page.getByRole("button", { name: "Создать аккаунт и начать" }).click();

  await page.waitForURL(/\/onboarding\/placement$/);
  return email;
}

// M3 Slice 9 — several existing tests (Progress/Today empty-state checks)
// need an account that's genuinely zero on reading/review/material activity
// but IS past onboarding v2's own gate (src/app/(app)/layout.tsx), since a
// not-yet-onboarded account now gets redirected into /onboarding/** before
// it can reach /home or /progress at all. Flips completed_first_win
// directly via service_role rather than running the real Placement ->
// result -> path -> Knowledge Check flow, which would leave the account
// with real Learning Path progress and defeat the point of these
// particular tests (verifying Progress/Today's OWN empty-state handling,
// not onboarding's). Represents a real, valid account shape: someone who
// onboarded long ago but hasn't touched Reader/Brain yet.
export async function completeOnboardingForTest(email: string): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  );
  const { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = data?.users.find((u) => u.email === email);
  if (!user) throw new Error(`completeOnboardingForTest: no auth user found for ${email}`);
  await supabase.from("profiles").update({ completed_first_win: true }).eq("id", user.id);
}

// Быстрый, надёжный способ вернуть TEST_PASSWORD напрямую через service_role
// (без повторного похода через email/Mailpit) — используется в finally
// тестов, которые сами меняют пароль, чтобы сбой в середине теста не
// оставлял общий фикстур сломанным для всех остальных тестов набора.
//
// listUsers() без perPage отдаёт только первую страницу (50 записей по
// умолчанию) — по мере накопления тестовых аккаунтов (signup-тесты создают
// новый на каждый прогон) test@example.com рано или поздно уходит на
// следующую страницу, и функция молча ничего не восстанавливает. Явный
// perPage покрывает весь реалистичный диапазон одним запросом.
// Seeded system texts (supabase/seed.sql) don't have fixed ids — every
// `supabase db reset` regenerates fresh UUIDs. Tests that need to
// page.goto() a specific text directly (skipping a Library click) must
// look the id up by title instead of hardcoding it.
export async function getSystemTextIdByTitle(title: string): Promise<string> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  );
  const { data, error } = await supabase.from("texts").select("id").eq("title", title).single();
  if (error || !data) throw new Error(`Seeded text "${title}" not found — check supabase/seed.sql`);
  return data.id;
}

// e2e/reading.spec.ts's Library→Reader click flaked repeatedly on CI's
// shared 2-vCPU runner (never locally): the click itself always registers
// (Playwright's own actionability wait already covers that), but the
// client-side navigation it triggers occasionally never completes within
// even a generous window — root-caused to the runner's CPU/DB contention,
// NOT MyMemory/translate (the target route, /read/[textId], does zero
// external calls on initial load — pure Supabase reads, see page.tsx).
// A blind CI-level rerun ("try the whole job again") was masking this
// without fixing it. This retries the *actual* flaky step — click, wait a
// bounded window for navigation, and if it didn't happen, click again
// (the link is idempotent: clicking it again from the same page is a
// no-op-safe retry, not a duplicate action) — instead of failing the whole
// test outright or leaning on external-process-level retries.
export async function clickAndWaitForNav(
  page: Page,
  link: Locator,
  urlPattern: RegExp,
  { attempts = 3, perAttemptTimeoutMs = 10_000 }: { attempts?: number; perAttemptTimeoutMs?: number } = {},
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    await link.click();
    try {
      await expect(page).toHaveURL(urlPattern, { timeout: perAttemptTimeoutMs });
      return;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

export async function restoreTestPassword() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  );
  const { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 10_000 });
  const user = data?.users.find((u) => u.email === TEST_EMAIL);
  if (user) {
    await supabase.auth.admin.updateUserById(user.id, { password: TEST_PASSWORD });
  }
}
