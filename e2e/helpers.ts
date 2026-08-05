import type { Page } from "@playwright/test";
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
// (не проходит сам first-win — вызывающий тест сам решает, куда перейти).
export async function signUpFreshAccount(page: Page): Promise<string> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

  await page.goto("/onboarding");
  await page.getByRole("button", { name: "Далее" }).click();
  await page.getByRole("button", { name: "Английский" }).click();
  await page.getByRole("button", { name: "Далее" }).click();
  await page.getByRole("button", { name: "Русский" }).click();
  await page.getByRole("button", { name: "Далее" }).click();
  await page.getByRole("button", { name: "Начинающий" }).click();
  await page.getByRole("button", { name: "Далее" }).click();
  await page.getByRole("button", { name: "10", exact: true }).click();
  await page.getByRole("button", { name: "Далее" }).click();

  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Пароль (мин. 6 символов)").fill("testpass123");
  await page.getByRole("button", { name: "Создать аккаунт и начать" }).click();

  await page.waitForURL(/\/onboarding\/first-win$/);
  return email;
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
