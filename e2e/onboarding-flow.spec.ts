import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { completeOnboardingForTest, signUpFreshAccount, waitForHydration } from "./helpers";

// Phase 2, итерация 2 — «Онбординг до конца»: шаги визарда (цель → изучаемый
// язык → родной язык → уровень → аккаунт) и тест уровня в каркасе макетов
// Onboarding-why / Placement-question. Сценарии поверх onboarding-orphan-
// recovery.spec (восстановление аккаунта) и placement-privacy.spec (аналитика,
// чтение исходников): интерфейс этих экранов раньше e2e не проверялся.
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
}

async function startWizard(page: Page, theme: "light" | "dark" = "light") {
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: theme });
  await page.addInitScript((t) => localStorage.setItem("lexreader_theme", t), theme);
  await page.goto("/onboarding");
  const start = page.getByRole("button", { name: "Начать бесплатно" });
  await waitForHydration(start, 30_000);
  await start.click();
  await expect(page.getByRole("progressbar", { name: "Шаг 1 из 5" })).toBeVisible();
}

const next = (page: Page) => page.getByRole("button", { name: "Далее" });

// Проходит шаги подряд: каждый вызов выбирает ответ текущего шага и жмёт «Далее».
const STEP_CHOICES = [
  { radio: "Для жизни" },
  { radio: "Английский" },
  { radio: "Русский" },
  { radio: "A2", exact: true },
] as const;

async function answerStep(page: Page, stepIndex: 0 | 1 | 2 | 3) {
  const choice = STEP_CHOICES[stepIndex];
  await page.getByRole("radio", { name: choice.radio, exact: "exact" in choice }).check();
  await next(page).click();
}

async function axeViolations(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
}

test.describe("визард: шаги", () => {
  test("шаг 1: цели с описаниями, «Далее» ждёт выбора, полоса «Шаг 1 из 5», «Назад» ведёт на заставку", async ({ page }) => {
    await startWizard(page);
    await expect(page.getByRole("heading", { level: 1, name: "Для чего тебе английский?" })).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Шаг 1 из 5" })).toHaveAttribute("aria-valuenow", "20");
    await expect(page.getByText("1/5")).toBeVisible();
    await expect(page.getByRole("radio")).toHaveCount(7);
    await expect(next(page)).toBeDisabled();

    const travel = page.getByRole("radio", { name: "Путешествия" });
    await expect(travel).toHaveAccessibleName("Путешествия");
    await expect(travel).toHaveAccessibleDescription("Отели, кафе, дорога");
    await travel.check();
    await expect(next(page)).toBeEnabled();

    await page.getByRole("button", { name: "Назад" }).click();
    await expect(page.getByRole("button", { name: "Начать бесплатно" })).toBeVisible();
  });

  test("«Назад» между шагами сохраняет выбор, полоса растёт с каждым шагом", async ({ page }) => {
    await startWizard(page);
    await answerStep(page, 0);
    await expect(page.getByRole("progressbar", { name: "Шаг 2 из 5" })).toHaveAttribute("aria-valuenow", "40");
    await page.getByRole("radio", { name: "Английский" }).check();

    await page.getByRole("button", { name: "Назад" }).click();
    await expect(page.getByRole("radio", { name: "Для жизни" })).toBeChecked();
    await next(page).click();
    await expect(page.getByRole("radio", { name: "Английский" })).toBeChecked();
    await next(page).click();
    await expect(page.getByRole("progressbar", { name: "Шаг 3 из 5" })).toHaveAttribute("aria-valuenow", "60");
  });

  test("шаг 2: поиск по языкам; неготовый язык — «Скоро» и лист ожидания, запись попадает в базу", async ({ page }) => {
    // Многошаговый сценарий с формой и обращением к базе: общий лимит 30 с на нагруженной машине мал.
    test.slow();
    const email = `e2e-waitlist-${Date.now()}@example.com`;
    await startWizard(page);
    await answerStep(page, 0);

    await expect(page.getByRole("heading", { level: 1, name: "Какой язык учишь?" })).toBeVisible();
    // Готов только английский — он единственный радио, остальные — карточки «Скоро».
    await expect(page.getByRole("radio")).toHaveCount(1);

    const search = page.getByRole("searchbox", { name: "Поиск языка" });
    await search.fill("исп");
    await expect(page.getByRole("radio")).toHaveCount(0);
    await page.getByRole("button", { name: /Испанский/ }).click();

    await page.getByLabel(/оставь почту/).fill(email);
    await page.getByRole("button", { name: "Сообщить мне" }).click();
    await expect(page.getByText("Сообщим, когда будет готово")).toBeVisible();

    const supabase = admin();
    try {
      const { data } = await supabase.from("language_waitlist").select("email, language").eq("email", email);
      expect(data).toEqual([{ email, language: "es" }]);
    } finally {
      await supabase.from("language_waitlist").delete().eq("email", email);
    }

    await search.fill("такого языка нет");
    await expect(page.getByText("Ничего не найдено — попробуй другой запрос.")).toBeVisible();
  });

  test("шаг 3: родной язык не предлагает уже выбранный изучаемый", async ({ page }) => {
    await startWizard(page);
    await answerStep(page, 0);
    await answerStep(page, 1);
    await expect(page.getByRole("heading", { level: 1, name: "Какой у тебя родной язык?" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Английский" })).toHaveCount(0);
    await expect(page.getByRole("radio", { name: "Русский" })).toBeVisible();
    await expect(page.getByRole("radio")).toHaveCount(14);
  });

  test("шаг 4: уровни с подсказками, «Не знаю» отсылает к короткому тесту", async ({ page }) => {
    await startWizard(page);
    await answerStep(page, 0);
    await answerStep(page, 1);
    await answerStep(page, 2);
    await expect(page.getByRole("heading", { level: 1, name: "Какой у тебя уровень английского?" })).toBeVisible();
    await expect(page.getByRole("radio")).toHaveCount(5);
    await expect(page.getByRole("radio", { name: "A2", exact: true })).toHaveAccessibleDescription("Понимаю простые тексты и фразы");
    await expect(page.getByRole("radio", { name: "Не знаю" })).toHaveAccessibleDescription("Определим коротким тестом");
  });

  test("весь путь: пароль проверяется политикой, аккаунт получает выбранные ответы и ведёт к тесту уровня", async ({ page }) => {
    test.slow();
    const email = `e2e-wizard-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
    await startWizard(page);
    for (const stepIndex of [0, 1, 2, 3] as const) await answerStep(page, stepIndex);

    await expect(page.getByRole("progressbar", { name: "Шаг 5 из 5" })).toHaveAttribute("aria-valuenow", "100");
    await expect(page.getByRole("heading", { level: 1, name: "Создай аккаунт" })).toBeVisible();
    const emailField = page.getByLabel("Email");
    const password = page.getByLabel("Пароль", { exact: true });
    await waitForHydration(password);
    await emailField.fill(email);

    await password.fill("weakpassword");
    await page.getByRole("button", { name: "Создать аккаунт и начать" }).click();
    await expect(page.getByText("Добавь в пароль хотя бы одну цифру.")).toBeVisible();
    await expect(emailField).toHaveValue(email); // после ошибки поля не стираются

    await password.fill("goodpass123");
    await page.getByRole("button", { name: "Создать аккаунт и начать" }).click();
    await page.waitForURL(/\/onboarding\/placement$/, { timeout: 20_000 });

    const supabase = admin();
    const { data: users } = await supabase.auth.admin.listUsers({ page: 1, perPage: 10_000 });
    const user = users?.users.find((u) => u.email === email);
    expect(user, "аккаунт создан").toBeTruthy();
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("primary_goal, target_language, native_language, self_reported_cefr")
        .eq("id", user!.id)
        .single();
      expect(profile).toEqual({ primary_goal: "everyday", target_language: "en", native_language: "ru", self_reported_cefr: "A2" });
    } finally {
      await supabase.auth.admin.deleteUser(user!.id);
    }
  });
});

for (const theme of ["light", "dark"] as const) {
  test(`визард: все шаги без нарушений axe (WCAG 2.1 AA) — ${theme}`, async ({ page }) => {
    test.slow();
    await startWizard(page, theme);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    expect(await axeViolations(page), "шаг 1").toEqual([]);
    for (const stepIndex of [0, 1, 2, 3] as const) {
      await answerStep(page, stepIndex);
      await expect(page.getByRole("progressbar", { name: `Шаг ${stepIndex + 2} из 5` })).toBeVisible();
      expect(await axeViolations(page), `шаг ${stepIndex + 2}`).toEqual([]);
    }
  });
}

test.describe("визард: адаптив", () => {
  for (const size of [
    { name: "mobile 390", width: 390, height: 844 },
    { name: "tablet 834", width: 834, height: 1112 },
    { name: "desktop 1280", width: 1280, height: 800 },
  ]) {
    test(`${size.name}: нет горизонтальной прокрутки, главная кнопка в экране, колонка по центру`, async ({ page }) => {
      test.slow();
      await page.setViewportSize({ width: size.width, height: size.height });
      await startWizard(page);

      const checkLayout = async (label: string) => {
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${label}: горизонтальная прокрутка`).toBeLessThanOrEqual(0);
        const main = await page.getByRole("main").boundingBox();
        expect(main!.width, `${label}: ширина колонки`).toBeLessThanOrEqual(449);
        expect(Math.abs(main!.x - (size.width - main!.x - main!.width)), `${label}: колонка по центру`).toBeLessThanOrEqual(1);
        const primary = await page.getByRole("button", { name: /^(Далее|Создать аккаунт и начать)$/ }).boundingBox();
        expect(primary, `${label}: главная кнопка видима`).not.toBeNull();
        expect(primary!.x).toBeGreaterThanOrEqual(0);
        expect(primary!.x + primary!.width).toBeLessThanOrEqual(size.width);
        expect(primary!.height).toBeGreaterThanOrEqual(44);
      };

      await checkLayout("шаг 1");
      for (const stepIndex of [0, 1, 2, 3] as const) {
        await answerStep(page, stepIndex);
        await checkLayout(`шаг ${stepIndex + 2}`);
      }
    });
  }
});

test.describe("тест уровня", () => {
  test("вводный экран → вопросы: прогресс, пропуск-плитка, цифры выбирают вариант → результат", async ({ page }) => {
    test.slow();
    await signUpFreshAccount(page);

    await expect(page.getByRole("heading", { level: 1, name: "Короткая проверка уровня" })).toBeVisible();
    await expect(page.getByText(/10 коротких вопросов/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Пропустить диагностику" })).toBeVisible();
    await page.getByRole("button", { name: "Начать проверку" }).click();

    await expect(page.getByRole("progressbar", { name: "Вопрос 1 из 10" })).toHaveAttribute("aria-valuenow", "10");
    await expect(next(page)).toBeDisabled();

    // Первый вопрос — предложение с пропуском: до выбора плитка пустая, после — показывает вариант.
    const group = page.getByRole("group", { name: "Какой вариант подходит?" });
    await expect(page.getByRole("img", { name: "пропуск" })).toBeVisible();
    await group.getByRole("radio").first().focus();
    await page.keyboard.press("2");
    const second = group.getByRole("radio").nth(1);
    await expect(second).toBeChecked();
    const chosen = (await group.locator(".choice-card-label").nth(1).innerText()).trim();
    await expect(page.getByRole("region", { name: "Предложение" })).toContainText(chosen);
    await expect(page.getByRole("img", { name: "пропуск" })).toHaveCount(0);
    await next(page).click();

    for (let question = 2; question <= 10; question++) {
      await expect(page.getByRole("progressbar", { name: `Вопрос ${question} из 10` })).toBeVisible();
      await page.getByRole("radio").first().check();
      await page.getByRole("button", { name: question === 10 ? "Завершить" : "Далее", exact: true }).click();
    }
    await page.waitForURL(/\/onboarding\/result$/, { timeout: 20_000 });
  });

  test("после перезагрузки тест продолжается с того же вопроса", async ({ page }) => {
    test.slow();
    await signUpFreshAccount(page);
    await page.getByRole("button", { name: "Начать проверку" }).click();
    for (let question = 1; question <= 3; question++) {
      await expect(page.getByRole("progressbar", { name: `Вопрос ${question} из 10` })).toBeVisible();
      await page.getByRole("radio").first().check();
      await next(page).click();
    }
    await expect(page.getByRole("progressbar", { name: "Вопрос 4 из 10" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("progressbar", { name: "Вопрос 4 из 10" })).toBeVisible();
  });

  test("«Пропустить диагностику» ведёт к результату", async ({ page }) => {
    test.slow();
    await signUpFreshAccount(page);
    await page.getByRole("button", { name: "Пропустить диагностику" }).click();
    await page.waitForURL(/\/onboarding\/result$/, { timeout: 20_000 });
  });

  test("повторное прохождение (?retake=1): «Обновить диагностику» и «Отмена» в Мой английский", async ({ page }) => {
    test.slow();
    const email = await signUpFreshAccount(page);
    await completeOnboardingForTest(email);
    await page.goto("/onboarding/placement?retake=1");
    await expect(page.getByRole("button", { name: "Обновить диагностику" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Пропустить диагностику" })).toHaveCount(0);
    await page.getByRole("button", { name: "Отмена" }).click();
    await expect(page).toHaveURL(/\/language-twin/);
  });

  for (const theme of ["light", "dark"] as const) {
    test(`вводный экран и вопрос без нарушений axe (WCAG 2.1 AA) — ${theme}`, async ({ page }) => {
      test.slow();
      await page.emulateMedia({ reducedMotion: "reduce", colorScheme: theme });
      await page.addInitScript((t) => localStorage.setItem("lexreader_theme", t), theme);
      await signUpFreshAccount(page);
      await expect(page.getByRole("heading", { level: 1, name: "Короткая проверка уровня" })).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      expect(await axeViolations(page), "вводный экран").toEqual([]);

      await page.getByRole("button", { name: "Начать проверку" }).click();
      await expect(page.getByRole("progressbar", { name: "Вопрос 1 из 10" })).toBeVisible();
      await page.getByRole("radio").first().check();
      expect(await axeViolations(page), "вопрос с выбранным вариантом").toEqual([]);
    });
  }
});
