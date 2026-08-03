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
