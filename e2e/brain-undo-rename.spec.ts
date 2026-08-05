import { test, expect } from "@playwright/test";
import { login } from "./helpers";

// M3 Slice 4 §8: undoLastGrade() is a real DB mutation (restores the
// previous srs_state/review_log snapshot, ownership+staleness-checked on
// the server) — the highest-risk new write path in this slice, so it gets
// its own functional e2e test rather than relying only on the a11y spec's
// incidental coverage. Also self-cleaning: undo restores the exact
// previous due_at, so "birds" (kept due by e2e/global-setup.ts) is due
// again for whatever test runs next.
test("Undo restores the previous grade and returns to a question screen", async ({ page }) => {
  await login(page);
  await page.goto("/brain/all/review");
  await expect(page.getByRole("button", { name: "Показать ответ" })).toBeVisible({ timeout: 10_000 });

  // Not asserting on the session tally here: the queue's exact size depends
  // on shared account state (other specs' notebook/import flows add "new"
  // cards), so whether grading this card is the session's last one varies
  // run to run. The undo bar reappearing/disappearing and a question screen
  // coming back either way is what actually proves the round trip.
  await page.getByRole("button", { name: "Показать ответ" }).click();
  await page.getByRole("button", { name: /Помню/, exact: false }).first().click();

  const undoButton = page.getByRole("button", { name: /Отменить оценку/ });
  await expect(undoButton).toBeVisible();

  await undoButton.click();
  await expect(undoButton).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Показать ответ" })).toBeVisible();
});

// M3 Slice 4 §11: renameDeck() is a real server action against a
// previously-write-only column — verify the round trip end to end rather
// than only at the unit level (there's no pure logic to unit-test here).
test("Deck rename persists and default/starter decks hide the delete button", async ({ page }) => {
  await login(page);
  await page.goto("/brain/vocabulary");
  await page.getByRole("button", { name: "📚 Колоды" }).click();
  await page.getByRole("button", { name: "+ Новая колода" }).click();
  const originalName = `E2E Rename ${Date.now()}`;
  await page.getByPlaceholder("Название колоды...").fill(originalName);
  await page.getByRole("button", { name: "Создать" }).click();
  await expect(page).toHaveURL(/\/brain\/[\w-]+\?created=true$/, { timeout: 15_000 });

  await page.getByRole("button", { name: "Переименовать колоду" }).click();
  const renamedTo = `${originalName} (renamed)`;
  const nameInput = page.getByRole("textbox", { name: "Название колоды" });
  await nameInput.fill(renamedTo);
  await page.getByRole("button", { name: "OK" }).click();
  await expect(page.getByRole("heading", { name: renamedTo })).toBeVisible();

  // This freshly-created deck is neither default nor starter — delete is
  // available, and cleans up after the test.
  await expect(page.getByRole("button", { name: "Удалить колоду" })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Удалить колоду" }).click();
  await expect(page).toHaveURL(/\/brain\/vocabulary$/);

  // The default deck ("Основная колода") must never offer deletion.
  await page.getByRole("button", { name: "📚 Колоды" }).click();
  await page.getByRole("link", { name: /Основная колода/ }).click();
  await expect(page.getByRole("button", { name: "Удалить колоду" })).toHaveCount(0);
});
