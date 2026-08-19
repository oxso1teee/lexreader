import { test, expect } from "@playwright/test";
import { login, signUpFreshAccount, completeOnboardingForTest } from "./helpers";

test("navigation: active route gets aria-current, others do not", async ({ page }) => {
  await login(page);
  await page.goto("/home");

  const todayLinks = page.locator('a[href="/home"][aria-current="page"]');
  await expect(todayLinks.first()).toBeVisible();
  await expect(page.locator('a[href="/library"][aria-current="page"]')).toHaveCount(0);

  await page.goto("/library");
  await expect(page.locator('a[href="/library"][aria-current="page"]').first()).toBeVisible();
  await expect(page.locator('a[href="/home"][aria-current="page"]')).toHaveCount(0);
});

test("Today primary CTA shows review action once a due flashcard exists", async ({ page }) => {
  await login(page);

  // Гарантированно создаёт карточку с due_at=now() (default в схеме) —
  // немедленно попадает в getDueCount(), не завязано на порядок других
  // тестов общего e2e-аккаунта.
  //
  // M3 Slice 4: создание колоды переехало с /brain на вкладку "Колоды"
  // /brain/vocabulary (см. docs/ui/m3-slice4-practice-brain-review-plan.md §4).
  await page.goto("/brain/vocabulary");
  await page.getByRole("button", { name: "📚 Колоды" }).click();
  await page.getByRole("button", { name: "+ Новая колода" }).click();
  await page.getByPlaceholder("Название колоды...").fill(`Today CTA ${Date.now()}`);
  await page.getByRole("button", { name: "Создать" }).click();
  await expect(page).toHaveURL(/\/brain\/[\w-]+\?created=true$/, { timeout: 15_000 });
  await page.getByPlaceholder("Слово").fill("today-cta-front");
  await page.getByPlaceholder("Перевод").fill("today-cta-back");
  await page.getByRole("button", { name: "+ Добавить карточку" }).click();
  await expect(page.getByText("today-cta-front")).toBeVisible();

  await page.goto("/home");
  const primaryCta = page.getByRole("link", { name: "Повторить" });
  await expect(primaryCta).toBeVisible();
  await expect(primaryCta).toHaveAttribute("href", "/brain/all/review");
  await expect(page.getByRole("heading", { name: /к повторению/ })).toBeVisible();
});

test("Today shows the add-material empty state for a brand-new account (no reviews, no material)", async ({
  page,
}) => {
  const email = await signUpFreshAccount(page);
  await completeOnboardingForTest(email);

  await page.goto("/home");
  await expect(page.getByRole("link", { name: "Добавить материал" })).toHaveAttribute("href", "/library/new");
  await expect(page.getByText("Пока нет материала в процессе")).toBeVisible();
});

test("mobile navigation is visible and desktop sidebar is hidden at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto("/home");

  await expect(page.getByRole("navigation", { name: "Основная навигация" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Боковая навигация" })).toBeHidden();
});

test("desktop sidebar is visible at 1280px", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await login(page);
  await page.goto("/home");

  await expect(page.getByRole("complementary", { name: "Боковая навигация" })).toBeVisible();
});

test("no horizontal overflow on Today at 360px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await login(page);
  await page.goto("/home");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("existing Library route still opens inside the new shell", async ({ page }) => {
  await login(page);
  await page.goto("/library");
  // Gamified redesign: Library is now also a bottom-nav/sidebar item (the
  // reference's 6-tab IA), so a bare getByText("Библиотека") now matches
  // the nav link(s) too, not just the page heading -- scope to the heading
  // specifically, which is what this test actually verifies.
  await expect(page.getByRole("heading", { name: "Библиотека" })).toBeVisible();
});

test("existing Progress route still opens inside the new shell", async ({ page }) => {
  await login(page);
  await page.goto("/progress");
  await expect(page).toHaveURL(/\/progress$/);
});

test("existing Review route still opens inside the new shell", async ({ page }) => {
  await login(page);
  await page.goto("/brain/all/review");
  await expect(page).toHaveURL(/\/brain\/all\/review$/);
});
