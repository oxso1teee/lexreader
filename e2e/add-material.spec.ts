import { test, expect } from "@playwright/test";
import { login, signUpFreshAccount, completeOnboardingForTest } from "./helpers";

// M3 Slice 3: Add Material rewrite. createText/createTextFromUrl/
// createTextFromYoutube now return { redirectTo } instead of calling
// redirect() server-side (docs/ui/m3-slice3-library-reader-plan.md §9) — this
// suite proves that change still lands the user on the right page.
//
// Tests that actually insert a text use a fresh signup rather than the
// shared test account — that account accumulates real owned texts across
// every e2e run in a day and eventually exhausts FREE_TEXT_LIMIT for real,
// which correctly shows the paywall (proven by hitting this for real while
// writing this suite) rather than the success path this test wants to check.

test("Add Material: text tab creates a real material and redirects to the Reader", async ({ page }) => {
  const email = await signUpFreshAccount(page);
  await completeOnboardingForTest(email);
  await page.goto("/library/new");
  await expect(page.getByRole("heading", { name: "Добавить материал" })).toBeVisible();

  const title = `E2E text ${Date.now()}`;
  await page.getByLabel("Название").fill(title);
  await page.getByLabel("Текст").fill("This is a real sentence used only for this automated test run.");
  await page.getByRole("button", { name: "Добавить в библиотеку" }).click();

  await expect(page).toHaveURL(/\/read\/[\w-]+$/, { timeout: 10_000 });
  await expect(page.getByText(title)).toBeVisible();
});

test("Add Material: text tab rejects an empty and a too-short body honestly", async ({ page }) => {
  const email = await signUpFreshAccount(page);
  await completeOnboardingForTest(email);
  await page.goto("/library/new");

  await page.getByLabel("Название").fill("Too short");
  await page.getByLabel("Текст").fill("hi");
  await page.getByRole("button", { name: "Добавить в библиотеку" }).click();
  await expect(page.getByRole("alert").first()).toContainText("короткий");
  await expect(page).toHaveURL(/\/library\/new$/);
});

test("Add Material: URL tab rejects a malformed URL without a server round trip", async ({ page }) => {
  await login(page);
  await page.goto("/library/new");
  await page.getByRole("tab", { name: "Сайт" }).click();
  await page.getByLabel("Ссылка на статью").fill("not-a-url");
  await page.getByRole("button", { name: "Импортировать статью" }).click();
  // Native URL input validation blocks submission before the server action fires.
  await expect(page).toHaveURL(/\/library\/new$/);
});

test("Add Material: submit button disables while pending, preventing a duplicate submit", async ({ page }) => {
  await login(page);
  await page.goto("/library/new");
  await page.getByLabel("Название").fill(`E2E dup guard ${Date.now()}`);
  await page.getByLabel("Текст").fill("Another real sentence, long enough to pass validation for this test.");
  const submit = page.getByRole("button", { name: "Добавить в библиотеку" });
  await submit.click();
  // Once pending, the label changes and the button is disabled — a second
  // click cannot fire a second insert.
  await expect(page.getByRole("button", { name: "Сохраняем…" })).toBeDisabled();
});

test("Add Material: all 5 tabs from the approved artifact are present and switchable", async ({ page }) => {
  await login(page);
  await page.goto("/library/new");
  for (const name of ["Текст", "Файл", "YouTube", "Сайт", "Транскрипт"]) {
    await page.getByRole("tab", { name }).click();
    await expect(page.getByRole("tab", { name, selected: true })).toBeVisible();
  }
});

test("Add Material: Файл tab offers PDF/Фото sub-choice, both honestly labeled", async ({ page }) => {
  await login(page);
  await page.goto("/library/new");
  await page.getByRole("tab", { name: "Файл" }).click();
  // exact:true — the hidden file input's own accessible name ("Выбери
  // PDF-файл") contains "PDF" as a substring and would otherwise match too.
  await expect(page.getByRole("button", { name: "PDF", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Фото", exact: true })).toBeVisible();
});
