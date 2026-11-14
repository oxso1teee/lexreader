import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Phase 2, WP5 — учебный путь на галерее /dev/screens (фикстуры, без Supabase и
// логина): карта курса, раздел, урок и закрытый урок, каталог. Курс настоящий
// (A2→B1 из curriculum/), состояния считает тот же buildPathMap, что и боевые
// страницы; фикстура «середина пути»: раздел 1 пройден (5 уроков), в разделе 2
// пройдены 2 урока из 4, остальные закрыты.
// Запуск: npm run test:ui-kit (поднимает next dev на :3100). На production-
// сборке /dev/screens закрыта без MOMENTS_GALLERY=1.

async function open(page: Page, screen: string, theme: "light" | "dark" = "light") {
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: theme });
  // только первый заход: перезагрузка не должна затирать выбор, сделанный в тесте
  await page.addInitScript((t) => {
    if (localStorage.getItem("lexreader_theme") === null) localStorage.setItem("lexreader_theme", t);
  }, theme);
  await page.goto(`/dev/screens?s=${screen}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

test.describe("карта курса", () => {
  test("середина пути: прогресс, следующий шаг, разделы пройден / текущий / закрыты", async ({ page }) => {
    await open(page, "Curriculum");
    await expect(page.getByRole("heading", { level: 2, name: "Пройдено курса" })).toBeVisible();
    await expect(page.getByText("39%", { exact: true })).toBeVisible();
    await expect(page.getByText("1 из 4 разделов · 7 из 18 уроков")).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Пройдено курса: 39%" })).toBeVisible();

    // следующий шаг — первый непройденный урок, ведёт на его страницу
    const next = page.getByRole("link", { name: "Продолжить: Сравнительная степень" });
    await expect(next).toHaveAttribute("href", /\/learning-paths\/a2-b1\/everyday-grammar\/grammar\.comparatives$/);

    const units = page.getByRole("list").filter({ has: page.getByRole("heading", { level: 3 }) }).first();
    await expect(units.locator(":scope > li")).toHaveCount(4);
    // пройденный раздел — ссылка с «5/5»
    await expect(page.getByRole("link", { name: /Основы предложения/ })).toContainText("5/5");
    // текущий — с прогрессом раздела и кнопкой
    await expect(page.getByRole("progressbar", { name: /Пройдено в разделе «Грамматика на каждый день»/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Продолжить раздел" })).toHaveAttribute("href", /\/everyday-grammar$/);
    // закрытые — замок и «Откроется после раздела N», но не пустой экран: это ссылки
    await expect(page.getByRole("link", { name: /Закрыт: Связная речь/ })).toContainText("Откроется после раздела 2");
    await expect(page.getByRole("link", { name: /Закрыт: Активный английский/ })).toContainText("Откроется после раздела 3");
  });

  test("свежий путь: «Начать», ни одного пройденного, первый раздел текущий, остальные закрыты", async ({ page }) => {
    await open(page, "Curriculum-new");
    await expect(page.getByText("0%", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Начать: / })).toBeVisible();
    await expect(page.getByText("сейчас", { exact: true })).toHaveCount(1);
    await expect(page.getByRole("link", { name: /^Закрыт: / })).toHaveCount(3);
  });

  test("путь не начат: описание пути и «Начать путь», разделы без замков и без перехода", async ({ page }) => {
    await open(page, "Curriculum-intro");
    await expect(page.getByRole("button", { name: "Начать путь" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3 })).toHaveCount(4);
    // без зачисления разделы — описание, а не ссылки; замков и «сейчас» нет
    await expect(page.getByRole("link", { name: /Основы предложения/ })).toHaveCount(0);
    await expect(page.getByText(/Откроется после/)).toHaveCount(0);
    await expect(page.getByText("сейчас", { exact: true })).toHaveCount(0);
  });

  test("путь на паузе: прогресс сохранён, вместо следующего шага — возврат в путь", async ({ page }) => {
    await open(page, "Curriculum-paused");
    await expect(page.getByText("Путь на паузе")).toBeVisible();
    await expect(page.getByRole("button", { name: "Продолжить путь" })).toBeVisible();
    await expect(page.getByText("7 из 18 уроков")).toBeVisible();
    await expect(page.getByRole("link", { name: /^Продолжить: / })).toHaveCount(0);
  });

  test("путь пройден: 100%, «Курс пройден», все разделы пройдены, замков нет", async ({ page }) => {
    await open(page, "Curriculum-done");
    await expect(page.getByRole("heading", { level: 2, name: "Курс пройден" })).toBeVisible();
    await expect(page.getByText("100%", { exact: true })).toBeVisible();
    await expect(page.getByText("4 из 4 разделов · 18 из 18 уроков")).toBeVisible();
    await expect(page.getByRole("link", { name: /^Закрыт: / })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^Продолжить: / })).toHaveCount(0);
  });
});

test.describe("раздел", () => {
  test("текущий раздел: уроки по модулям, пройденные / текущий / закрытый", async ({ page }) => {
    await open(page, "Unit-overview");
    await expect(page.getByRole("heading", { level: 1, name: "Раздел 2" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Грамматика на каждый день" })).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Пройдено в разделе: 2 из 4 уроков" })).toBeVisible();
    // два модуля со своими счётчиками
    await expect(page.getByRole("heading", { level: 3, name: "Артикли и предлоги" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "Сравнения и модальность" })).toBeVisible();
    await expect(page.getByText("2 из 2 уроков", { exact: true })).toBeVisible();
    await expect(page.getByText("0 из 2 уроков", { exact: true })).toBeVisible();
    // пройденный: ссылка, «Урок пройден», статус навыка
    const done = page.getByRole("link", { name: /Артикли/ });
    await expect(done).toContainText("Урок пройден");
    // текущий — единственный с aria-current="step" среди ссылок-кнопок и ведёт на урок
    const current = page.getByRole("link", { name: "Начать урок: Сравнительная степень" });
    await expect(current).toHaveAttribute("aria-current", "step");
    await expect(current).toHaveAttribute("href", /\/everyday-grammar\/grammar\.comparatives$/);
    // закрытый называет урок, после которого откроется
    await expect(page.getByRole("link", { name: /Закрыт: Модальные глаголы/ })).toContainText(
      "Откроется после урока «Сравнительная степень»",
    );
  });

  test("закрытый раздел: объяснение и те же уроки с замками", async ({ page }) => {
    await open(page, "Unit-locked");
    await expect(page.getByText("Раздел откроется после раздела 2")).toBeVisible();
    await expect(page.getByText(/пройди проверку — при результате от 80%/)).toBeVisible();
    await expect(page.getByRole("link", { name: /^Закрыт: / })).toHaveCount(4);
    await expect(page.getByRole("link", { name: /^Начать урок/ })).toHaveCount(0);
  });

  test("пройденный раздел: «Раздел пройден» и переход к следующему", async ({ page }) => {
    await open(page, "Unit-finished");
    await expect(page.getByText("Раздел пройден", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /Дальше: Грамматика на каждый день/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Закрыт: / })).toHaveCount(0);
  });
});

test.describe("урок", () => {
  test("текущий урок: шаги раздела, содержимое, «изучено», практика и соседи", async ({ page }) => {
    await open(page, "Lesson-current");
    await expect(page.getByRole("heading", { level: 1, name: "Сравнительная степень" })).toBeVisible();
    await expect(page.getByText("Урок 3 из 4 · Грамматика на каждый день")).toBeVisible();
    const steps = page.getByRole("navigation", { name: "Уроки раздела" });
    await expect(steps.getByRole("listitem")).toHaveCount(4);
    await expect(steps.locator('[aria-current="step"]')).toHaveAttribute("aria-label", /Урок 3: Сравнительная степень — текущий/);
    await expect(page.getByRole("heading", { level: 2, name: "Примеры" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Частые ошибки" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Отметить как изученное" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Практика" })).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Соседние уроки" });
    await expect(nav.getByRole("link", { name: /Предыдущий урок.*Предлоги/ })).toBeVisible();
    // следующий урок ещё закрыт — это пояснение, а не ссылка
    await expect(nav.getByRole("link")).toHaveCount(1);
    await expect(nav).toContainText("Следующий урок · закрыт");
  });

  test("пройденный урок: «Урок изучен» и «Дальше» ведёт к текущему уроку", async ({ page }) => {
    await open(page, "Lesson-done");
    await expect(page.getByText("Урок изучен", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Отметить как изученное" })).toHaveCount(0);
    await expect(page.getByText("Дальше: Сравнительная степень")).toBeVisible();
    await expect(page.getByRole("link", { name: "Продолжить", exact: true })).toHaveAttribute(
      "href",
      /\/everyday-grammar\/grammar\.comparatives$/,
    );
  });

  test("закрытый урок: без содержимого, с объяснением, текущим уроком и проверкой", async ({ page }) => {
    await open(page, "Lesson-locked");
    await expect(page.getByRole("heading", { level: 2, name: "Урок пока закрыт" })).toBeVisible();
    await expect(page.getByText("Откроется после урока «Модальные глаголы»").first()).toBeVisible();
    // содержимое урока не показывается
    await expect(page.getByRole("heading", { level: 2, name: "Примеры" })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 2, name: "Частые ошибки" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Отметить как изученное" })).toHaveCount(0);
    // выходы: к текущему уроку и проверка знаний (обходной путь для знакомой темы)
    await expect(page.getByRole("link", { name: "Перейти к уроку: Сравнительная степень" })).toHaveAttribute(
      "href",
      /\/everyday-grammar\/grammar\.comparatives$/,
    );
    await expect(page.getByText("Пройди проверку: при результате от 80% урок засчитается сразу.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Пройти проверку" })).toHaveAttribute("href", /\/check$/);
    // шаги раздела: все закрыты, текущий просмотр отмечен
    const steps = page.getByRole("navigation", { name: "Уроки раздела" });
    await expect(steps.getByRole("link")).toHaveCount(0);
    await expect(steps.locator('[aria-current="step"]')).toHaveAttribute("aria-label", /закрыт/);
  });
});

test.describe("каталог путей", () => {
  test("активный, на паузе, пройденный и не начатый путь с прогрессом", async ({ page }) => {
    await open(page, "Course-pick");
    await expect(page.getByRole("heading", { level: 1, name: "Пути обучения" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3 })).toHaveCount(4);
    await expect(page.getByText("Активный путь", { exact: true })).toBeVisible();
    await expect(page.getByText("На паузе", { exact: true })).toBeVisible();
    await expect(page.getByText("Завершён", { exact: true })).toBeVisible();
    await expect(page.getByRole("progressbar", { name: /Пройдено в пути «A2 → B1: Прочный фундамент»: 7 из 18 уроков/ })).toBeVisible();
    // пока нет активного — рекомендации нет (карточка показывается только без зачисления)
    await expect(page.getByText("Рекомендуем тебе")).toHaveCount(0);
  });

  test("новый пользователь: рекомендация и четыре пути без прогресса", async ({ page }) => {
    await open(page, "Course-pick-new");
    await expect(page.getByRole("heading", { level: 2, name: "Рекомендуем тебе" })).toBeVisible();
    await expect(page.getByRole("progressbar")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /A2 → B1/ }).first()).toHaveAttribute("href", "/learning-paths/a2-b1");
  });
});

// Обе темы и четыре ширины: нет горизонтальной прокрутки и серьёзных
// нарушений доступности (WCAG 2.1 AA). Высокий вьюпорт — чтобы закреплённая
// нижняя навигация не перекрывала кнопки в потоке (axe считает их «частично
// закрытыми» только из-за положения прокрутки).
const SCREENS = [
  "Curriculum",
  "Curriculum-new",
  "Curriculum-intro",
  "Curriculum-paused",
  "Curriculum-done",
  "Unit-overview",
  "Unit-locked",
  "Unit-finished",
  "Lesson-current",
  "Lesson-done",
  "Lesson-locked",
  "Course-pick",
  "Course-pick-new",
] as const;

test.describe("адаптивность и доступность", () => {
  for (const theme of ["light", "dark"] as const) {
    for (const width of [360, 768, 1024, 1280]) {
      test(`${theme}, ${width}px: без переполнения и нарушений axe`, async ({ page }) => {
        // 13 экранов подряд; под next dev каждый маршрут компилируется лениво
        test.setTimeout(240_000);
        await page.setViewportSize({ width, height: 3200 });
        for (const screen of SCREENS) {
          await open(page, screen, theme);
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          expect(overflow, `${screen}: горизонтальная прокрутка`).toBeLessThanOrEqual(1);
          const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
          expect(results.violations, `${screen}: ${JSON.stringify(results.violations.map((v) => v.id))}`).toEqual([]);
        }
      });
    }
  }
});
