import type { Page } from "@playwright/test";

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
