import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test("brain flow: create deck, add flashcard manually", async ({ page }) => {
  await login(page);

  // M3 Slice 4: создание колоды переехало с /brain на вкладку "Колоды"
  // /brain/vocabulary (см. docs/ui/m3-slice4-practice-brain-review-plan.md §4).
  await page.goto("/brain/vocabulary");
  await page.getByRole("button", { name: "📚 Колоды" }).click();
  await page.getByRole("button", { name: "+ Новая колода" }).click();
  const deckName = `E2E Deck ${Date.now()}`;
  await page.getByPlaceholder("Название колоды...").fill(deckName);
  await page.getByRole("button", { name: "Создать" }).click();

  // Редирект на страницу новой колоды — createDeck() добавляет ?created=true
  // для deck_create_succeeded (см. brain/actions.ts, [deckId]/deck-analytics.tsx).
  await expect(page).toHaveURL(/\/brain\/[\w-]+\?created=true$/, { timeout: 15_000 });

  await page.getByPlaceholder("Слово").fill("e2e-front");
  await page.getByPlaceholder("Перевод").fill("e2e-back");
  await page.getByRole("button", { name: "+ Добавить карточку" }).click();

  await expect(page.getByText("e2e-front")).toBeVisible();
  await expect(page.getByText("e2e-back")).toBeVisible();

  // FREE_DECK_LIMIT is 3 (src/lib/subscription.ts) — left uncleaned, this
  // deck plus the seeded default + any other test-created deck exhausts it
  // for whatever deck-creation test runs next in the same suite invocation
  // (global-setup's "E2E Deck %" cleanup only runs once, before all files).
  // Waiting for the post-delete redirect (not just the click) matters here:
  // deleteDeck() runs in a startTransition, so click() alone resolves
  // before the row is actually gone, and the test would "pass" while the
  // deck is still there for the next test to trip over.
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Удалить колоду" }).click();
  await expect(page).toHaveURL(/\/brain\/vocabulary$/);
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
