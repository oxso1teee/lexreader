import { test, expect, type Page } from "@playwright/test";
import { login } from "./helpers";

// M3 Slice 4.1: Choice/Type/Match used to signal correct/incorrect purely
// via border/background color (an a11y gap — color-blind or screen-reader
// users got no other cue). Fixed by adding an icon, a text label, and an
// aria-live announcement to each mode, without touching the grading logic
// in ./actions.ts (reviewWord). These tests seed their own deck+cards (new
// cards are due immediately — srs_state.due_at defaults to now(), see
// supabase/migrations/0001_init.sql) so Choice/Match always have enough
// distinct answers to render real options, unlike the single always-due
// "birds" card used elsewhere in this suite. Word text is unique per run
// (Date.now() suffix) so retries don't trip the cross-deck dedup guard in
// addFlashcard() (src/app/(app)/brain/[deckId]/actions.ts).
function makeWords(seed: string): [string, string][] {
  return [
    [`e2e-fb-w1-${seed}`, `e2e-fb-t1-${seed}`],
    [`e2e-fb-w2-${seed}`, `e2e-fb-t2-${seed}`],
    [`e2e-fb-w3-${seed}`, `e2e-fb-t3-${seed}`],
  ];
}

async function createDeckWithCards(page: Page, words: [string, string][]): Promise<string> {
  await page.goto("/brain/vocabulary");
  await page.getByRole("button", { name: "📚 Колоды" }).click();
  await page.getByRole("button", { name: "+ Новая колода" }).click();
  await page.getByPlaceholder("Название колоды...").fill(`E2E Deck Feedback ${Date.now()}`);
  await page.getByRole("button", { name: "Создать" }).click();
  await expect(page).toHaveURL(/\/brain\/([\w-]+)\?created=true$/, { timeout: 15_000 });
  const deckId = page.url().match(/\/brain\/([\w-]+)\?/)![1];

  for (const [front, back] of words) {
    await page.getByPlaceholder("Слово").fill(front);
    await page.getByPlaceholder("Перевод").fill(back);
    await page.getByRole("button", { name: "+ Добавить карточку" }).click();
    await expect(page.getByText(front)).toBeVisible();
  }
  return deckId;
}

async function deleteDeck(page: Page, deckId: string) {
  await page.goto(`/brain/${deckId}`);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Удалить колоду" }).click();
  await expect(page).toHaveURL(/\/brain\/vocabulary$/);
}

test("Choice mode: correct/incorrect differ by more than color (icon, label, aria-live)", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await login(page);
  const words = makeWords(`${Date.now()}`);
  const backByFront = new Map(words);
  const deckId = await createDeckWithCards(page, words);

  try {
    await page.goto(`/brain/${deckId}/review?mode=choice`);
    const question = await page.locator("p.text-2xl.font-semibold").innerText();
    const correctAnswer = backByFront.get(question);
    expect(correctAnswer, `unexpected question text: ${question}`).toBeTruthy();

    const options = page.locator("div.flex.flex-col.gap-2 > button");
    await expect(options.first()).toBeVisible({ timeout: 10_000 });

    // Pick any option whose visible text isn't the correct answer.
    const count = await options.count();
    let wrongIndex = -1;
    let correctIndex = -1;
    for (let i = 0; i < count; i++) {
      const text = await options.nth(i).locator("span").first().innerText();
      if (text === correctAnswer) correctIndex = i;
      else if (wrongIndex === -1) wrongIndex = i;
    }
    expect(wrongIndex, "expected at least one distractor option").toBeGreaterThanOrEqual(0);
    expect(correctIndex, "expected the correct answer to be one of the options").toBeGreaterThanOrEqual(0);

    await options.nth(wrongIndex).click();

    // Non-color cues on the two specific buttons: visible icon + text label...
    await expect(options.nth(wrongIndex).getByText("Неверно")).toBeVisible();
    await expect(options.nth(wrongIndex).getByText("✗")).toBeVisible();
    await expect(options.nth(correctIndex).getByText("Верно")).toBeVisible();
    await expect(options.nth(correctIndex).getByText("✓")).toBeVisible();
    // ...and a live-region announcement a screen reader picks up without color.
    const liveRegion = page.locator('[role="status"][aria-live="polite"]');
    await expect(liveRegion).toContainText("Неверно");
  } finally {
    await deleteDeck(page, deckId);
  }
});

test("Type mode: correct/incorrect differ by more than color (icon, label, aria-live)", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await login(page);
  const words = makeWords(`${Date.now()}`);
  const deckId = await createDeckWithCards(page, words);

  try {
    await page.goto(`/brain/${deckId}/review?mode=type`);
    await expect(page.locator('input[type="text"]')).toBeVisible({ timeout: 10_000 });

    await page.locator('input[type="text"]').fill("definitely-wrong-answer");
    await page.getByRole("button", { name: "Проверить" }).click();

    const resultEl = page.locator('[role="status"][aria-live="polite"]');
    await expect(resultEl).toContainText("Правильный ответ");
    // Icon is a separate aria-hidden glyph, not just a color change.
    await expect(resultEl.locator('span[aria-hidden="true"]')).toHaveText("✗");
  } finally {
    await deleteDeck(page, deckId);
  }
});

test("Match mode: mismatched pairs differ by more than color (icon + aria-live)", async ({ page }) => {
  test.setTimeout(60_000);
  await login(page);
  const words = makeWords(`${Date.now()}`);
  const deckId = await createDeckWithCards(page, words);

  try {
    await page.goto(`/brain/${deckId}/review?mode=match`);
    const wordButtons = page.locator(".grid.flex-1.grid-cols-2 > div:nth-child(1) > button");
    const translationButtons = page.locator(".grid.flex-1.grid-cols-2 > div:nth-child(2) > button");
    await expect(wordButtons.first()).toBeVisible({ timeout: 10_000 });

    const liveRegion = page.locator('[role="status"][aria-live="polite"]');

    // Deliberately mismatch the first word with the second translation.
    await wordButtons.nth(0).click();
    await translationButtons.nth(1).click();
    await expect(liveRegion).toContainText("Неверно");
    await expect(wordButtons.nth(0).getByText("✗")).toBeVisible();
  } finally {
    await deleteDeck(page, deckId);
  }
});
