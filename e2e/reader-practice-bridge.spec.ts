import { test, expect } from "@playwright/test";
import { login, getSystemTextIdByTitle } from "./helpers";

// M3 Slice 11 (plan doc §2) — Reader v2's centerpiece: a saved word/phrase must show its real
// learning_state and a working Practice CTA that routes into a targeted review session, backed
// by the vocabulary_items.flashcard_id join added in page.tsx (no schema change — see plan doc
// §3). "A Walk in the Park" is the same seeded system text reading.spec.ts already uses.
const READ_TEXT_TITLE = "A Walk in the Park";

test("Practice Bridge: saving a word reveals a real learning-state chip and a working Practice CTA", async ({
  page,
}) => {
  test.setTimeout(60_000);

  await login(page);
  const textId = await getSystemTextIdByTitle(READ_TEXT_TITLE);
  await page.goto(`/read/${textId}`);

  const panel = page.locator("aside");
  await page.getByRole("button", { name: "trees", exact: true }).click();
  await expect(panel.getByText("Уровень знания")).toBeVisible({ timeout: 20_000 });

  const practiceLink = panel.getByRole("link", { name: "Практика →" });
  await expect(practiceLink).toBeVisible();
  const href = await practiceLink.getAttribute("href");
  expect(href).toMatch(/^\/brain\/[^/]+\/review\?wordIds=[^/]+$/);

  await practiceLink.click();
  await expect(page).toHaveURL(/\/brain\/[^/]+\/review\?wordIds=/);
  // A targeted single-word session — confirms the flashcardId in the CTA's href really is a
  // reviewable card, not a dangling id.
  await expect(page.getByRole("button", { name: "Показать ответ" })).toBeVisible({ timeout: 15_000 });
});

test("Reader word lookup is keyboard-accessible (Enter opens the panel, not just a pointer tap)", async ({
  page,
}) => {
  // M3 Slice 11 (plan doc §2, accessibility) — word buttons previously only handled
  // onPointerDown/Enter/Up; Tab-to-focus then Enter did nothing. onClickWord in reader.tsx is
  // the fix under test here.
  await login(page);
  const textId = await getSystemTextIdByTitle(READ_TEXT_TITLE);
  await page.goto(`/read/${textId}`);

  const wordButton = page.getByRole("button", { name: "calm", exact: true }).first();
  await wordButton.focus();
  await page.keyboard.press("Enter");

  const panel = page.locator("aside");
  await expect(panel.getByText("Уровень знания")).toBeVisible({ timeout: 20_000 });
});
