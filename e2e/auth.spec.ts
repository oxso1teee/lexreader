import { test, expect } from "@playwright/test";
import { login, TEST_EMAIL, TEST_PASSWORD } from "./helpers";

test("login with correct credentials redirects to home", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/home$/);
});

test("login with wrong password shows a generic error", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(TEST_EMAIL);
  await page.getByPlaceholder("Пароль").fill("definitely-wrong-password");
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page.getByText("Неверный email или пароль.")).toBeVisible();
});

test("login with non-existent email shows the same generic error (no user enumeration)", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill("does-not-exist@example.com");
  await page.getByPlaceholder("Пароль").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page.getByText("Неверный email или пароль.")).toBeVisible();
});

test("password reset request shows a generic confirmation message", async ({ page }) => {
  await page.goto("/reset-password");
  await page.getByPlaceholder("Email").fill(TEST_EMAIL);
  await page.getByRole("button", { name: "Отправить ссылку для сброса" }).click();
  await expect(page.getByText(/Если такой email зарегистрирован/)).toBeVisible();
});
