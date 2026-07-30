import { test, expect } from "@playwright/test";

// docs/IMPLEMENTATION_PROMPT_2026-07-28.md, раздел 8: полный цикл нового
// профиля от регистрации до Главной через управляемый туториал
// "текст → слово → карточка", без единого пустого экрана по пути.
test("onboarding first-win: full cycle from signup to home", async ({ page }) => {
  const email = `first-win-${Date.now()}@example.com`;

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

  await expect(page).toHaveURL(/\/onboarding\/first-win$/);
  await expect(page.getByText("Выбери текст, чтобы начать")).toBeVisible();

  // Шаг A: выбор текста — берём первую плитку.
  await page.locator("main button").first().click();
  await expect(page.getByText(/сохранено/)).toBeVisible();

  // Шаг B: тап по первым трём словам-токенам текста (заведомо разные слова —
  // начало любого текста, в отличие от случайных индексов вглубь текста, не
  // рискует дважды попасть в одно и то же слово и не увеличить счётчик).
  const wordButtons = page.locator("main button");
  await wordButtons.nth(0).click();
  await expect(page.getByText("1/3 сохранено")).toBeVisible();
  await wordButtons.nth(1).click();
  await expect(page.getByText("2/3 сохранено")).toBeVisible();
  await wordButtons.nth(2).click();

  // Шаг C: авто-переход на одиночную карточку повторения.
  await expect(page.getByText("Повтори прямо сейчас")).toBeVisible();
  await page.getByRole("button", { name: "Показать перевод" }).click();
  await page.getByRole("button", { name: "Понял(а)" }).click();

  // Шаг D: праздничный экран → редирект на Главную.
  await expect(page.getByText("Ты прошёл весь цикл!")).toBeVisible();
  await page.getByRole("button", { name: "На Главную" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByText("3 / 10 слов")).toBeVisible();

  // Повторный заход по прямой ссылке не должен показывать туториал снова.
  await page.goto("/onboarding/first-win");
  await expect(page).toHaveURL(/\/home$/);
});
