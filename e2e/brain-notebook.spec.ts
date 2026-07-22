import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test("brain flow: create deck, add flashcard manually", async ({ page }) => {
  await login(page);

  await page.goto("/brain");
  await page.getByRole("button", { name: "+ Новая колода" }).click();
  const deckName = `E2E Deck ${Date.now()}`;
  await page.getByPlaceholder("Название колоды...").fill(deckName);
  await page.getByRole("button", { name: "Создать" }).click();

  // Редирект на страницу новой колоды
  await expect(page).toHaveURL(/\/brain\/[\w-]+$/);

  await page.getByPlaceholder("Слово").fill("e2e-front");
  await page.getByPlaceholder("Перевод").fill("e2e-back");
  await page.getByRole("button", { name: "+ Добавить карточку" }).click();

  await expect(page.getByText("e2e-front")).toBeVisible();
  await expect(page.getByText("e2e-back")).toBeVisible();
});

test("notebook flow: manually add a word without a source text", async ({ page }) => {
  await login(page);

  await page.goto("/notebook");
  await page.getByRole("button", { name: "Добавить слово вручную" }).click();

  await page.getByPlaceholder("Например: serendipity").fill("e2e-manual-word");
  await page.getByPlaceholder("Перевод").fill("e2e-manual-translation");
  await page.getByRole("button", { name: "Сохранить" }).click();

  await expect(page.getByText("e2e-manual-word")).toBeVisible();
});
