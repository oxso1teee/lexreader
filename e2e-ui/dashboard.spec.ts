import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Phase 2, WP2 — главный экран «Сегодня» на галерее /dev/screens (фикстуры, без
// Supabase и логина): состояния «обычный день / первый день / цель выполнена /
// пустые состояния», обе темы, четыре ширины, a11y (axe, WCAG 2.1 AA).
// Запуск: npm run test:ui-kit (поднимает next dev на :3100). На production-
// сборке /dev/screens закрыта без MOMENTS_GALLERY=1.

const STATES = [
  { id: "Main", name: "обычный день", hero: /к повторению/ },
  { id: "Today-new", name: "первый день", hero: "Добавь первый материал" },
  { id: "Today-done", name: "цель выполнена", hero: "Цель дня выполнена" },
  { id: "Today-empty", name: "пустые состояния", hero: "Добавь первый материал" },
] as const;

const GREETING = /^(Добрый день|Доброе утро|Добрый вечер|Доброй ночи), Сергей$/;

async function open(page: Page, state: string, theme: "light" | "dark" = "light") {
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: theme });
  // только первый заход: перезагрузка не должна затирать выбор, сделанный в тесте
  await page.addInitScript((t) => {
    if (localStorage.getItem("lexreader_theme") === null) localStorage.setItem("lexreader_theme", t);
  }, theme);
  await page.goto(`/dev/screens?s=${state}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

test.describe("главный экран: состояния", () => {
  for (const state of STATES) {
    test(`${state.name}: приветствие и главный блок`, async ({ page }) => {
      await open(page, state.id);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(GREETING);
      await expect(page.getByRole("heading", { level: 2, name: state.hero })).toBeVisible();
      // профиль, серия и XP — всегда в шапке, с понятными именами
      await expect(page.getByRole("link", { name: "Профиль" }).first()).toBeVisible();
      await expect(page.getByRole("link", { name: /^Серия|^Серии пока нет/ })).toBeVisible();
      await expect(page.getByRole("link", { name: /\sXP$/ }).first()).toBeVisible();
    });
  }

  test("первый день: чек-лист 0 из 3, первый шаг текущий, пустая неделя зовёт начать серию", async ({ page }) => {
    await open(page, "Today-new");
    await expect(page.getByRole("heading", { level: 2, name: "Первые шаги" })).toBeVisible();
    await expect(page.getByText("0 из 3", { exact: true })).toBeVisible();
    await expect(page.locator('[aria-current="step"]')).toHaveCount(1);
    await expect(page.getByText("Начни серию сегодня")).toBeVisible();
    // «Добавить материал» ровно одна ссылка — на неё опираются e2e основного набора
    await expect(page.getByRole("link", { name: "Добавить материал" })).toHaveCount(1);
    await expect(page.getByText("Пока нет материала в процессе")).toBeVisible();
  });

  test("цель выполнена: итог дня, серия продлена, «Хочешь ещё?» с главным действием", async ({ page }) => {
    await open(page, "Today-done");
    await expect(page.getByRole("progressbar", { name: "Цель дня: 50 из 50 XP" }).first()).toBeVisible();
    await expect(page.getByText("Серия продлена — 13 дней подряд")).toBeVisible();
    await expect(page.getByText("12 мин чтения · 18 повторений · 9 новых слов")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Хочешь ещё?" })).toBeVisible();
    // главное действие дня остаётся доступным, те же слова и ссылка
    await expect(page.getByRole("link", { name: "Повторить" })).toHaveAttribute("href", "/brain/all/review");
    await expect(page.getByRole("heading", { level: 3, name: /к повторению/ })).toBeVisible();
    // недочитанный текст показан один раз (в «Хочешь ещё?»), а не дважды
    await expect(page.getByRole("link", { name: /The Last Lighthouse/ })).toHaveCount(1);
  });

  test("пустые состояния: серия прервана, путь предлагается выбрать, сбой блока виден", async ({ page }) => {
    await open(page, "Today-empty");
    await expect(page.getByRole("link", { name: "Серии пока нет" })).toBeVisible();
    await expect(page.getByText("Серия прервалась — начни новую")).toBeVisible();
    await expect(page.getByRole("link", { name: /Учебный путь/ })).toHaveAttribute("href", "/learning-paths");
    await expect(page.getByText("Часть данных сейчас недоступна")).toBeVisible();
  });
});

test.describe("главный экран: раскладка по ширине", () => {
  test("mobile: одна колонка, неделя выше «Продолжить»", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, "Main");
    const display = await page.locator(".dash-cols").evaluate((el) => getComputedStyle(el).display);
    expect(display).toBe("flex");
    const week = await page.getByRole("heading", { level: 2, name: "Неделя" }).boundingBox();
    const next = await page.getByRole("heading", { level: 2, name: "Продолжить" }).boundingBox();
    expect(week && next && week.y < next.y).toBe(true);
  });

  test("desktop: основная колонка и правая панель рядом", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page, "Main");
    const columns = await page
      .locator(".dash-cols")
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
    expect(columns).toBe(2);
    const hero = await page.getByRole("heading", { level: 2, name: /к повторению/ }).boundingBox();
    const week = await page.getByRole("heading", { level: 2, name: "Неделя" }).boundingBox();
    expect(hero && week && week.x > hero.x + 300).toBe(true);
  });

  test("tablet с боковой панелью остаётся одной колонкой (экран уже порога в 56rem)", async ({ page }) => {
    await page.setViewportSize({ width: 834, height: 1112 });
    await open(page, "Main");
    await expect(page.getByRole("complementary", { name: "Боковая навигация" })).toBeVisible();
    const display = await page.locator(".dash-cols").evaluate((el) => getComputedStyle(el).display);
    expect(display).toBe("flex");
  });

  for (const width of [360, 390, 834, 1280]) {
    for (const state of STATES) {
      test(`${width}px, ${state.name}: нет горизонтальной прокрутки`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await open(page, state.id);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(1);
      });
    }
  }
});

test.describe("главный экран: a11y (axe, WCAG 2.1 AA)", () => {
  for (const theme of ["light", "dark"] as const) {
    for (const width of [390, 1280]) {
      for (const state of STATES) {
        test(`${state.name}, ${width}px — ${theme}`, async ({ page }) => {
          await page.setViewportSize({ width, height: 900 });
          await open(page, state.id, theme);
          const result = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
            .analyze();
          expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
        });
      }
    }
  }
});
