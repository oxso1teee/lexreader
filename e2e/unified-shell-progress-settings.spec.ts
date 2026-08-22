import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { login, signUpFreshAccount, completeOnboardingForTest, TEST_EMAIL } from "./helpers";

test("Progress with a brand-new account shows honest zero/empty state, no fake CEFR levels", async ({
  page,
}) => {
  const email = await signUpFreshAccount(page);
  await completeOnboardingForTest(email);

  await page.goto("/progress");
  await expect(page.getByText("Добавь первый материал, чтобы здесь появился реальный прогресс.")).toBeVisible();
  await expect(page.getByText("Пока нет активности за неделю")).toBeVisible();

  const body = await page.locator("body").innerText();
  expect(body).not.toMatch(/\bA1\b|\bA2\b|\bB1\b|\bB2\b|\bC1\b|\bC2\b/);
  expect(body).not.toMatch(/Speaking|Listening|Grammar|Pronunciation/i);
});

test("Progress with real review/material history shows the due-reviews insight and non-zero metrics", async ({
  page,
}) => {
  await login(page);

  // Тот же надёжный паттерн, что и у Today CTA (unified-shell-today.spec.ts)
  // — создаём свою карточку с due_at=now(), не завязываясь на состояние
  // общего e2e-аккаунта, которое меняют другие тесты в наборе.
  //
  // M3 Slice 4: создание колоды переехало с /brain на вкладку "Колоды"
  // /brain/vocabulary (см. docs/ui/m3-slice4-practice-brain-review-plan.md §4).
  await page.goto("/brain/vocabulary");
  await page.getByRole("button", { name: "📚 Колоды" }).click();
  await page.getByRole("button", { name: "+ Новая колода" }).click();
  await page.getByPlaceholder("Название колоды...").fill(`Progress insight ${Date.now()}`);
  await page.getByRole("button", { name: "Создать" }).click();
  await expect(page).toHaveURL(/\/brain\/[\w-]+\?created=true$/, { timeout: 15_000 });
  await page.getByPlaceholder("Слово").fill("progress-insight-front");
  await page.getByPlaceholder("Перевод").fill("progress-insight-back");
  await page.getByRole("button", { name: "+ Добавить карточку" }).click();
  await expect(page.getByText("progress-insight-front")).toBeVisible();

  await page.goto("/progress");
  await expect(page.getByRole("heading", { name: "Показатели" }).first()).toBeVisible();
  // due_reviews must win over every other insight per decideProgressInsight()'s priority.
  await expect(page.getByText(/карточк.* к повторению\./)).toBeVisible();
});

test("Settings profile section renders real fields: email, languages, goal, plan", async ({ page }) => {
  await login(page);
  await page.goto("/settings");

  await expect(page.getByText(TEST_EMAIL)).toBeVisible();
  await expect(page.getByText("Английский").first()).toBeVisible();
  await expect(page.getByText("10 слов")).toBeVisible();
  await expect(page.getByText("Бесплатный").first()).toBeVisible();
});

test("Settings: learning preferences save shows success confirmation", async ({ page }) => {
  await login(page);
  await page.goto("/settings");

  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByText("Сохранено ✓")).toBeVisible();
});

test("Settings: subscription section never shows a renewal date for the free plan", async ({ page }) => {
  await login(page);
  await page.goto("/settings");

  await expect(page.getByText("Текущий тариф:")).toBeVisible();
  await expect(page.getByText(/^Продление:/)).not.toBeVisible();
});

test("Settings: password-reset link opens the existing reset-password flow", async ({ page }) => {
  await login(page);
  await page.goto("/settings");

  await page.getByRole("link", { name: "Сменить пароль" }).click();
  await expect(page).toHaveURL(/\/reset-password$/);
});

test("mobile navigation is visible and desktop sidebar is hidden on /progress and /settings at 390px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);

  for (const path of ["/progress", "/settings"]) {
    await page.goto(path);
    await expect(page.getByRole("navigation", { name: "Основная навигация" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Боковая навигация" })).toBeHidden();
  }
});

test("desktop sidebar is visible on /progress and /settings at 1280px", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await login(page);

  for (const path of ["/progress", "/settings"]) {
    await page.goto(path);
    await expect(page.getByRole("complementary", { name: "Боковая навигация" })).toBeVisible();
  }
});

test("no horizontal overflow on /progress or /settings at 360px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await login(page);

  for (const path of ["/progress", "/settings"]) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${path} overflows horizontally`).toBeLessThanOrEqual(1);
  }
});

test("/progress has no serious/critical axe violations on desktop or mobile", async ({ page }) => {
  await login(page);

  // feat/page-transitions (PR #35) wraps every (app) page in a motion.div
  // (src/app/(app)/template.tsx) — scanning right after goto(), with no
  // wait for anything, occasionally caught this specific page's async
  // data still settling (Progress fetches review/mission stats) and threw
  // a transient color-contrast false-positive. Every OTHER test in this
  // file already waits for real content before asserting anything (see
  // "Settings profile section..." above) — these two just never had a
  // reason to until page-transitions made the race visible.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/progress");
  await expect(page.getByRole("heading", { name: "Показатели" }).first()).toBeVisible();
  const desktopResults = await new AxeBuilder({ page }).include("body").analyze();
  const desktopSerious = desktopResults.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(desktopSerious, JSON.stringify(desktopSerious, null, 2)).toEqual([]);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/progress");
  await expect(page.getByRole("heading", { name: "Показатели" }).first()).toBeVisible();
  const mobileResults = await new AxeBuilder({ page }).include("body").analyze();
  const mobileSerious = mobileResults.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(mobileSerious, JSON.stringify(mobileSerious, null, 2)).toEqual([]);
});

test("/settings has no serious/critical axe violations on desktop or mobile", async ({ page }) => {
  await login(page);

  // Same page-transitions render race as the /progress test above.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/settings");
  await expect(page.getByText(TEST_EMAIL)).toBeVisible();
  const desktopResults = await new AxeBuilder({ page }).include("body").analyze();
  const desktopSerious = desktopResults.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(desktopSerious, JSON.stringify(desktopSerious, null, 2)).toEqual([]);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/settings");
  await expect(page.getByText(TEST_EMAIL)).toBeVisible();
  const mobileResults = await new AxeBuilder({ page }).include("body").analyze();
  const mobileSerious = mobileResults.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(mobileSerious, JSON.stringify(mobileSerious, null, 2)).toEqual([]);
});
