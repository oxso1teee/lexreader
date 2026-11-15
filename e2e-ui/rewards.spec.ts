import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Phase 2, итерация 6 — экран наград на галерее /dev/screens (фикстуры, без Supabase
// и логина): состояния, обе темы, три ширины, a11y (axe, WCAG 2.2 AA), редактор цели
// дня и карточка наград на главном экране. Запуск: npm run test:ui-kit.

const STATES = [
  { id: "Rewards-main", name: "обычный день" },
  { id: "Rewards-new", name: "новый пользователь" },
  { id: "Rewards-done", name: "всё выполнено, сундук ждёт" },
  { id: "Rewards-claimed", name: "сундук забран" },
  { id: "Rewards-goal-edit", name: "редактор цели" },
  { id: "Rewards-error", name: "частичный сбой" },
] as const;

const WIDTHS = [360, 768, 1280] as const;

async function open(page: Page, state: string, theme: "light" | "dark" = "light", width = 1280) {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: theme });
  await page.addInitScript((t) => {
    if (localStorage.getItem("lexreader_theme") === null) localStorage.setItem("lexreader_theme", t);
  }, theme);
  await page.goto(`/dev/screens?s=${state}`);
  await expect(page.getByRole("heading", { level: 1, name: "Награды" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

async function expectAccessibleAndFits(page: Page, label: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${label}: горизонтальная прокрутка`).toBeLessThanOrEqual(1);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`), label).toEqual([]);
}

test.describe("награды: содержимое состояний", () => {
  test("обычный день: уровень, цель, задания со статусами, достижения по категориям, история", async ({ page }) => {
    await open(page, "Rewards-main");
    await expect(page.getByRole("heading", { level: 2, name: "Опыт" })).toBeVisible();
    await expect(page.getByText("Уровень 2", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Ещё 32 XP до уровня 3")).toBeVisible();

    await expect(page.getByRole("progressbar", { name: "Цель дня: 35 из 50 XP" })).toBeVisible();
    await expect(page.getByText("Ещё 15 XP")).toBeVisible();

    const quests = page.getByRole("region", { name: "Задания дня" });
    await expect(quests.getByText("Прочитать 10 минут")).toBeVisible();
    await expect(quests.getByText("Выполнено", { exact: true })).toBeVisible();
    await expect(quests.getByText("В процессе", { exact: true })).toBeVisible();
    await expect(quests.getByText("Доступно", { exact: true })).toBeVisible();
    await expect(quests.getByText("Истекло", { exact: true })).toBeVisible();
    await expect(quests.getByText("Награда получена", { exact: true })).toBeVisible();
    await expect(quests.getByRole("link", { name: "Открыть сундук" })).toHaveCount(0);
    // значки заданий действительно отрисованы (серверный компонент не получает их пустыми)
    const icons = await quests.locator("li > span[aria-hidden='true']").allTextContents();
    expect(icons.length).toBeGreaterThanOrEqual(3);
    for (const icon of icons) expect(icon.trim().length).toBeGreaterThan(0);

    const achievements = page.getByRole("region", { name: "Достижения" });
    for (const category of ["Обучение", "Чтение", "Словарь", "Постоянство", "Вехи"]) {
      await expect(achievements.getByRole("heading", { level: 3, name: category })).toBeVisible();
    }
    await expect(achievements.locator('[data-status="earned"]').first()).toContainText("Получено");
    await expect(achievements.locator('[data-status="in_progress"]').first()).toBeVisible();

    const history = page.getByRole("region", { name: "История XP" });
    await expect(history.getByRole("heading", { level: 3, name: "Сегодня" })).toBeVisible();
    await expect(history.getByRole("heading", { level: 3, name: "Вчера" })).toBeVisible();
    await expect(history.getByRole("heading", { level: 3, name: "1 ноября" })).toBeVisible();
    await expect(history.getByText("Урок пройден", { exact: true })).toBeVisible();
    await expect(history.getByText("×2")).toBeVisible();
  });

  test("новый пользователь: честные нули, пустая история, все достижения закрыты", async ({ page }) => {
    await open(page, "Rewards-new");
    await expect(page.getByText("Ещё 100 XP до уровня 2")).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Цель дня: 0 из 50 XP" })).toBeVisible();
    await expect(page.getByText("Пока пусто.", { exact: false })).toBeVisible();
    await expect(page.getByRole("region", { name: "Достижения" }).locator('[data-status="earned"]')).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Задания дня" }).getByText("Доступно", { exact: true })).toHaveCount(3);
  });

  test("всё выполнено: цель закрыта, сундук доступен ссылкой", async ({ page }) => {
    await open(page, "Rewards-done");
    await expect(page.getByText("Выполнена", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Открыть сундук" })).toHaveAttribute("href", "/quests/chest");
  });

  test("сундук забран: ссылки на сундук нет, статус и метка названы словами", async ({ page }) => {
    await open(page, "Rewards-claimed");
    await expect(page.getByRole("link", { name: "Открыть сундук" })).toHaveCount(0);
    await expect(page.getByText("Сундук открыт")).toBeVisible();
    await expect(page.getByRole("region", { name: "Задания дня" }).getByText("Награда получена", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Первый сундук")).toBeVisible();
  });

  test("частичный сбой: предупреждение видно, остальные блоки работают", async ({ page }) => {
    await open(page, "Rewards-error");
    await expect(page.getByText("Часть данных не загрузилась")).toBeVisible();
    await expect(page.getByRole("region", { name: "Задания дня" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Достижения" })).toHaveCount(0);
  });

  test("скелет загрузки: объявлен как статус", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/dev/screens?s=Rewards-loading");
    await expect(page.getByRole("status")).toBeVisible();
    await expect(page.getByText("Загрузка наград")).toBeAttached();
  });
});

test.describe("награды: редактор цели дня", () => {
  test("открывается сразу в галерее; смена типа подставляет пресеты этого типа", async ({ page }) => {
    await open(page, "Rewards-goal-edit");
    const editor = page.locator("#goal-editor");
    await expect(editor).toBeVisible();
    await expect(editor.getByRole("radio", { name: "Уроки" })).toBeChecked();
    // для типа «Уроки» — 1/2/3 урока
    await expect(editor.getByRole("radio", { name: "2 урока" })).toBeChecked();
    await expect(editor.getByRole("radio", { name: "1 урок" })).toBeVisible();
    await expect(editor.getByRole("radio", { name: "3 урока" })).toBeVisible();

    await editor.getByRole("radio", { name: "Слова" }).check();
    await expect(editor.getByRole("radio", { name: "20 слов" })).toBeChecked();
    await expect(editor.getByRole("radio", { name: "10 слов" })).toBeVisible();
    await expect(editor.getByRole("radio", { name: "2 урока" })).toHaveCount(0);

    await editor.getByRole("radio", { name: "Опыт (XP)" }).check();
    await expect(editor.getByRole("radio", { name: /^50 XP/ })).toBeVisible();
    await expect(editor.getByText("~10 мин занятия")).toBeVisible();
  });

  test("отмена закрывает редактор и возвращает прежний выбор", async ({ page }) => {
    await open(page, "Rewards-goal-edit");
    const editor = page.locator("#goal-editor");
    await editor.getByRole("radio", { name: "Слова" }).check();
    await editor.getByRole("button", { name: "Отмена" }).click();
    await expect(page.locator("#goal-editor")).toHaveCount(0);
    await page.getByRole("button", { name: "Изменить" }).click();
    await expect(page.locator("#goal-editor").getByRole("radio", { name: "Уроки" })).toBeChecked();
  });

  test("обычный день: редактор закрыт, кнопка «Изменить» открывает его", async ({ page }) => {
    await open(page, "Rewards-main");
    await expect(page.locator("#goal-editor")).toHaveCount(0);
    await page.getByRole("button", { name: "Изменить" }).click();
    await expect(page.locator("#goal-editor")).toBeVisible();
  });
});

test.describe("главный экран: карточка наград", () => {
  test("уровень, последние достижения и ссылка на экран наград", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
    await page.goto("/dev/screens?s=Main");
    const card = page.getByRole("region", { name: "Награды" });
    await expect(card).toBeVisible();
    await expect(card.getByText(/^Уровень \d+/)).toBeVisible();
    await expect(card.getByText("Неделя подряд")).toBeVisible();
    await expect(card.getByText("Первая книга")).toBeVisible();
    await expect(card.getByRole("link", { name: /Все/ })).toHaveAttribute("href", "/rewards");
  });

  test("новый пользователь: достижений нет — сказано прямо", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/dev/screens?s=Today-new");
    await expect(page.getByRole("region", { name: "Награды" }).getByText("Достижений пока нет")).toBeVisible();
  });

  test("плитка цели ведёт на экран наград", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/dev/screens?s=Main");
    await expect(page.locator("a.dash-tile").first()).toHaveAttribute("href", "/rewards");
  });
});

test.describe("момент «цель дня выполнена»", () => {
  test("цель в XP: числа и подпись в XP", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/dev/moments?m=Goal-done");
    await expect(page.getByRole("img", { name: "Цель дня: 50 из 50 XP" })).toBeVisible();
    await expect(page.getByText("XP сегодня", { exact: true })).toBeVisible();
    await expect(page.getByText(/Завтра цель та же: 50 XP, около 10 минут/)).toBeVisible();
  });

  test("цель не в XP: показывает выполненную цель, а не XP", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/dev/moments?m=Goal-done-lessons");
    await expect(page.getByRole("img", { name: "Цель дня: 2 из 2 уроков" })).toBeVisible();
    await expect(page.getByText("уроков сегодня", { exact: true })).toBeVisible();
    await expect(page.getByText("Завтра цель та же: 2 уроков")).toBeVisible();
    await expect(page.getByText("XP сегодня")).toHaveCount(0);
    await expect(page.getByText(/около \d+ минут/)).toHaveCount(0);
  });
});

test.describe("награды: доступность и вёрстка", () => {
  for (const theme of ["light", "dark"] as const) {
    for (const width of WIDTHS) {
      for (const state of STATES) {
        test(`${state.id} · ${theme} · ${width}px`, async ({ page }) => {
          await open(page, state.id, theme, width);
          await expectAccessibleAndFits(page, `${state.id} ${theme} ${width}`);
        });
      }
    }
  }

  test("главный экран с карточкой наград: axe в обеих темах", async ({ page }) => {
    for (const theme of ["light", "dark"] as const) {
      await page.emulateMedia({ reducedMotion: "reduce", colorScheme: theme });
      await page.addInitScript((t) => localStorage.setItem("lexreader_theme", t), theme);
      await page.goto("/dev/screens?s=Main");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expectAccessibleAndFits(page, `Main ${theme}`);
    }
  });
});
