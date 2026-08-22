import { createClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";
import { login, TEST_EMAIL, signUpFreshAccount, completeOnboardingForTest } from "./helpers";

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
}

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
  // M3 Slice 7 (Today v2): a real active Mission (pickHeroMission) takes the
  // primary-CTA slot over the plain review action — src/app/(app)/home/page.tsx
  // renders HeroMissionCard instead of PrimaryActionCard whenever one exists,
  // regardless of dueCount. The shared TEST_EMAIL account accumulates real
  // state across every e2e run (missions included, same as its texts/decks),
  // so this test's own "Повторить" assertion below is only meaningful once
  // no mission is currently occupying that slot — dismiss any, exactly the
  // way the real UI does it (dismissMissionAction in
  // src/app/(app)/missions/actions.ts), same self-contained spirit as the
  // due-card setup right after this.
  const supabase = serviceClient();
  const { data: users } = await supabase.auth.admin.listUsers({ page: 1, perPage: 10_000 });
  const userId = users?.users.find((u) => u.email === TEST_EMAIL)?.id;
  if (userId) {
    await supabase
      .from("missions")
      .update({ status: "dismissed", dismissed_at: new Date().toISOString() })
      .eq("user_id", userId)
      .in("status", ["available", "started"]);
  }

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
  await expect(page.getByText("Библиотека")).toBeVisible();
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
