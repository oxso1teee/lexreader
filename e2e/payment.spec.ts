import { test, expect } from "@playwright/test";
import { login } from "./helpers";

// Полный цикл оплаты (Stripe Checkout тестовыми картами, webhook, отмена)
// можно прогнать только против настоящего Stripe test-mode аккаунта — см.
// docs/BILLING_SUPPORT.md. Здесь — то, что проверяемо без него: сама
// страница тарифов и локальный dev-fallback (simulateSubscribe), которые
// работают уже сейчас.
test("pricing page shows plans and local dev fallback works without Stripe keys", async ({
  page,
}) => {
  await login(page);
  await page.goto("/pricing");

  // Идемпотентность: если предыдущий прогон теста упал до своей же очистки,
  // на аккаунте может остаться активная тестовая подписка — сбрасываем её.
  const leftoverCancelButton = page.getByRole("button", { name: "Отменить (тестовый режим)" });
  if (await leftoverCancelButton.isVisible()) {
    await leftoverCancelButton.click();
    await expect(page.getByText("LexReader Premium — Ежемесячно")).toBeVisible();
  }

  await expect(page.getByText("LexReader Premium — Ежемесячно")).toBeVisible();
  await expect(page.getByText("LexReader Premium — Ежегодно")).toBeVisible();

  const startButtons = page.getByRole("button", { name: "Начать" });
  await startButtons.first().click();

  // simulateSubscribe редиректит на /library (пользователь сразу может
  // пользоваться премиум-функциями), а не остаётся на /pricing.
  await expect(page).toHaveURL(/\/library$/);

  await page.goto("/pricing");
  await expect(page.getByText(/У тебя активна подписка/)).toBeVisible();

  // Возвращаем в исходное состояние для последующих прогонов теста.
  const cancelButton = page.getByRole("button", { name: "Отменить (тестовый режим)" });
  if (await cancelButton.isVisible()) {
    await cancelButton.click();
  }
  await expect(page.getByText("LexReader Premium — Ежемесячно")).toBeVisible();
});

test("real Stripe checkout session redirects to Stripe (requires STRIPE_SECRET_KEY)", async ({
  page,
}) => {
  test.skip(
    !process.env.STRIPE_SECRET_KEY,
    "Полный Stripe Checkout флоу требует настоящего тестового Stripe-аккаунта (STRIPE_SECRET_KEY) — см. docs/BILLING_SUPPORT.md",
  );

  await login(page);
  await page.goto("/pricing");
  await page.getByRole("button", { name: "Начать" }).first().click();
  await expect(page).toHaveURL(/checkout\.stripe\.com/);
});
