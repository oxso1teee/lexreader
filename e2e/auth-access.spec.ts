import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { login, TEST_EMAIL, TEST_PASSWORD, waitForHydration } from "./helpers";

// Phase 2, итерация 1 — «Вход и восстановление доступа»: вход, регистрация
// режимом /login, вход по ссылке из письма (Mailpit), сброс пароля, «сессия
// истекла». Это сценарии ПОВЕРХ базовых проверок e2e/auth.spec.ts.
//
// Лимиты попыток считаются и по email, и по IP (auth-rate-limit), а весь набор
// идёт с одного адреса. Поэтому КАЖДЫЙ тест получает собственный «IP» через
// x-forwarded-for — иначе запросы ссылок и неудачные входы разных тестов
// копились бы в общем бакете и блокировали соседей (так и случилось в первом
// прогоне: шестой запрос ссылки за 15 минут справедливо упёрся в лимит).
const MAILPIT = "http://127.0.0.1:54324";

function freshIp() {
  const octet = () => 1 + Math.floor(Math.random() * 250);
  return `10.${octet()}.${octet()}.${octet()}`;
}

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": freshIp() });
});

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
}

function uniqueEmail(prefix: string, domain = "example.com") {
  return `e2e-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@${domain}`;
}

// Полноценный пользователь (профиль + колода, онбординг пройден) — отдельный
// от общего test@example.com, чтобы смена пароля и выход с других устройств
// не задели остальной набор.
async function createOnboardedUser(prefix: string) {
  const supabase = admin();
  const email = uniqueEmail(prefix);
  const password = "startpass123";
  const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("createUser: пользователь не создан");
  const id = data.user.id;
  const { error: profileError } = await supabase
    .from("profiles")
    .insert({ id, target_language: "en", native_language: "ru", level: "intermediate", daily_word_goal: 10, completed_first_win: true });
  if (profileError) throw profileError;
  await supabase.from("decks").insert({ owner_id: id, name: "Основная колода", is_default: true, language: "en" });
  return { id, email, password, remove: () => supabase.auth.admin.deleteUser(id) };
}

async function mailIds(email: string): Promise<string[]> {
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
  const body = (await res.json()) as { messages?: { ID: string }[] };
  return (body.messages ?? []).map((m) => m.ID);
}

// Ссылка из НОВОГО письма на адрес (письма, что были до действия, игнорируем).
async function mailLinkTo(email: string, knownIds: string[], timeoutMs = 20_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const fresh = (await mailIds(email)).filter((id) => !knownIds.includes(id));
    if (fresh.length > 0) {
      const message = (await (await fetch(`${MAILPIT}/api/v1/message/${fresh[0]}`)).json()) as { HTML?: string; Text?: string };
      const match = (message.HTML || message.Text || "").match(/href="([^"]*verify[^"]*)"/);
      if (match) return match[1].replace(/&amp;/g, "&");
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`Письмо со ссылкой для ${email} не пришло в Mailpit.`);
}

async function requestMagicLinkOnPage(page: Page, email: string) {
  const field = page.getByLabel("Email");
  await waitForHydration(field);
  await field.fill(email);
  await page.getByRole("button", { name: "Войти по ссылке из письма" }).click();
  await expect(page.getByRole("heading", { name: "Проверь почту" })).toBeVisible();
}

test.describe("регистрация режимом /login", () => {

  test("пароль проверяется единой политикой, аккаунт создаётся с языками по умолчанию и ведёт к тесту уровня", async ({ page }) => {
    // Многошаговый сценарий (несколько входов/писем/навигаций): общий лимит 30 с на нагруженной машине мал.
    test.slow();
    const email = uniqueEmail("signup");
    await page.goto("/login");
    await page.getByRole("link", { name: "Создать" }).click();
    await expect(page).toHaveURL(/\/login\?mode=signup$/);
    await expect(page.getByRole("heading", { name: "Создай аккаунт" })).toBeVisible();

    const emailField = page.getByLabel("Email");
    const passwordField = page.getByLabel("Пароль", { exact: true });
    await waitForHydration(passwordField);
    await emailField.fill(email);

    // Шкала и подсказка живут от ввода; слабый пароль без цифры сервер не примет.
    await passwordField.fill("abc");
    await expect(page.getByText("Слабый — добавь ещё 5 символов и цифру")).toBeVisible();
    await passwordField.fill("weakpassword");
    await page.getByRole("button", { name: "Создать аккаунт", exact: true }).click();
    await expect(page.getByText("Добавь в пароль хотя бы одну цифру.")).toBeVisible();
    await expect(emailField).toHaveValue(email); // после ошибки поля не стираются

    await passwordField.fill("goodpass123");
    await expect(page.getByRole("img", { name: /Надёжность пароля: (средний|надёжный)/ })).toBeVisible();
    await page.getByRole("button", { name: "Создать аккаунт", exact: true }).click();
    await page.waitForURL(/\/onboarding\/placement$/, { timeout: 20_000 });

    const supabase = admin();
    const { data: users } = await supabase.auth.admin.listUsers({ page: 1, perPage: 10_000 });
    const user = users?.users.find((u) => u.email === email);
    expect(user, "аккаунт создан").toBeTruthy();
    try {
      const { data: profile } = await supabase.from("profiles").select("target_language, native_language").eq("id", user!.id).single();
      expect(profile).toEqual({ target_language: "en", native_language: "ru" });
    } finally {
      await supabase.auth.admin.deleteUser(user!.id);
    }
  });
});

test.describe("лимит попыток входа", () => {

  test("«Осталось N попыток» после каждой неудачи и блокировка сразу после последней", async ({ page }) => {
    // Многошаговый сценарий (несколько входов/писем/навигаций): общий лимит 30 с на нагруженной машине мал.
    test.slow();
    await page.goto("/login");
    const email = page.getByLabel("Email");
    const password = page.getByLabel("Пароль", { exact: true });
    await waitForHydration(password);
    await email.fill(uniqueEmail("lock"));
    await password.fill("definitely-wrong-password");
    const submit = page.getByRole("button", { name: "Войти", exact: true });

    for (const expected of ["Осталось 4 попытки.", "Осталось 3 попытки.", "Осталось 2 попытки.", "Осталась 1 попытка."]) {
      await submit.click();
      await expect(page.getByText(`Неверный email или пароль. ${expected}`)).toBeVisible();
    }

    // Пятая неудача исчерпывает лимит — блокировка с обратным отсчётом сразу,
    // без ещё одной «пробной» попытки.
    await submit.click();
    await expect(page.getByText(/Слишком много попыток входа\. Попробуй снова через/)).toBeVisible();
    await expect(submit).toBeDisabled();
    // Заблокированный пароль не мешает войти по ссылке из письма.
    await expect(page.getByRole("button", { name: "Войти по ссылке из письма" })).toBeEnabled();
  });
});

test.describe("вход по ссылке из письма", () => {

  test("письмо → «Проверь почту» → ссылка в этом же браузере входит без пароля", async ({ page }) => {
    // Многошаговый сценарий (несколько входов/писем/навигаций): общий лимит 30 с на нагруженной машине мал.
    test.slow();
    const before = await mailIds(TEST_EMAIL);
    await page.goto("/login");
    await requestMagicLinkOnPage(page, TEST_EMAIL);

    await expect(page.getByText(TEST_EMAIL, { exact: true })).toBeVisible();
    await expect(page.getByText("Если аккаунт с этим email есть, мы отправили ссылку для входа на")).toBeVisible();
    // example.com — не известный почтовый сервис: кнопки «Открыть …» нет.
    await expect(page.getByRole("link", { name: /^Открыть / })).toHaveCount(0);
    await expect(page.getByText(/Отправить ещё раз через [01]:\d\d/)).toBeVisible();

    await page.goto(await mailLinkTo(TEST_EMAIL, before));
    await expect(page).toHaveURL(/\/home$/);
  });

  test("ссылка возвращает на ту страницу, откуда пришёл человек (?next=)", async ({ page }) => {
    // Многошаговый сценарий (несколько входов/писем/навигаций): общий лимит 30 с на нагруженной машине мал.
    test.slow();
    const user = await createOnboardedUser("magic-next");
    try {
      const before = await mailIds(user.email);
      await page.goto("/login?next=/library");
      await requestMagicLinkOnPage(page, user.email);
      await page.goto(await mailLinkTo(user.email, before));
      await expect(page).toHaveURL(/\/library$/);
    } finally {
      await user.remove();
    }
  });

  test("неизвестный email получает тот же экран, а письмо не уходит (нельзя проверять, есть ли аккаунт)", async ({ page }) => {
    const email = uniqueEmail("nobody");
    await page.goto("/login");
    await requestMagicLinkOnPage(page, email);
    await expect(page.getByText(email, { exact: true })).toBeVisible();
    await page.waitForTimeout(1_500);
    expect(await mailIds(email)).toHaveLength(0);
  });

  test("для известного почтового сервиса есть кнопка «Открыть …», открывающаяся в новой вкладке", async ({ page }) => {
    await page.goto("/login");
    await requestMagicLinkOnPage(page, uniqueEmail("gmail", "gmail.com"));
    const open = page.getByRole("link", { name: /Открыть Gmail/ });
    await expect(open).toHaveAttribute("href", "https://mail.google.com/");
    await expect(open).toHaveAttribute("target", "_blank");
    await expect(open).toHaveAttribute("rel", /noopener/);
  });

  test("«Ввести другой email» возвращает к форме, адрес не стирается", async ({ page }) => {
    const email = uniqueEmail("change");
    await page.goto("/login");
    await requestMagicLinkOnPage(page, email);
    // Экран подменил форму — фокус переносится на его заголовок, а не теряется.
    await expect(page.getByRole("heading", { name: "Проверь почту" })).toBeFocused();
    await page.getByRole("button", { name: "Ввести другой email" }).click();
    await expect(page.getByRole("heading", { name: "С возвращением!" })).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveValue(email);
    await expect(page.getByLabel("Email")).toBeFocused();
  });

  test("повторная отправка: после паузы появляется кнопка, она шлёт новое письмо и перезапускает отсчёт", async ({ page }) => {
    // Многошаговый сценарий с прокруткой часов: общий лимит 30 с на нагруженной машине мал.
    test.slow();
    const user = await createOnboardedUser("resend");
    try {
      // Минутная пауза до «Отправить ещё раз» — на фейковых часах, чтобы не ждать её по-настоящему.
      await page.clock.install();
      const before = await mailIds(user.email);
      await page.goto("/login");
      await requestMagicLinkOnPage(page, user.email);

      await expect(page.getByText(/Отправить ещё раз через [01]:\d\d/)).toBeVisible();
      await expect(page.getByRole("button", { name: "Отправить ещё раз" })).toHaveCount(0);

      await page.clock.fastForward(61_000);
      const resend = page.getByRole("button", { name: "Отправить ещё раз" });
      await expect(resend).toBeVisible();
      // Минимальную паузу между письмами одному пользователю Supabase считает по
      // НАСТОЯЩИМ часам (локально max_frequency = 1s, у хостинга — 60 с): фейковые
      // часы страницы его не обманывают, и слишком ранний клик получил бы 429.
      await page.waitForTimeout(1_300);
      await resend.click();

      await expect(page.getByText("Письмо отправлено ещё раз")).toBeVisible();
      // Отсчёт пошёл заново: кнопка снова спрятана за таймером.
      await expect(page.getByText(/Отправить ещё раз через [01]:\d\d/)).toBeVisible();
      await expect(page.getByRole("button", { name: "Отправить ещё раз" })).toHaveCount(0);

      // Реально ушло два письма: первое и повторное.
      await expect
        .poll(async () => (await mailIds(user.email)).filter((id) => !before.includes(id)).length, { timeout: 15_000 })
        .toBe(2);
    } finally {
      await user.remove();
    }
  });

  test("пустой или кривой email не уходит на сервер как «отправлено»", async ({ page }) => {
    await page.goto("/login");
    const field = page.getByLabel("Email");
    await waitForHydration(field);
    await field.fill("not-an-email");
    await page.getByRole("button", { name: "Войти по ссылке из письма" }).click();
    await expect(page.getByText("Введи email — отправим на него ссылку для входа.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Проверь почту" })).toHaveCount(0);
  });

  test("ссылка, открытая в ДРУГОМ браузере, не входит — вместо тишины понятное объяснение", async ({ page, browser }) => {
    // Многошаговый сценарий (несколько входов/писем/навигаций): общий лимит 30 с на нагруженной машине мал.
    test.slow();
    const user = await createOnboardedUser("magic-other");
    const other = await browser.newContext();
    try {
      const before = await mailIds(user.email);
      await page.goto("/login");
      await requestMagicLinkOnPage(page, user.email);
      const link = await mailLinkTo(user.email, before);

      const otherPage = await other.newPage();
      await otherPage.goto(link);
      await expect(otherPage).toHaveURL(/\/login\?error=link$/);
      await expect(otherPage.getByText("Ссылка не сработала")).toBeVisible();
    } finally {
      await other.close();
      await user.remove();
    }
  });
});

test.describe("ссылки, которые не сработали", () => {
  test("без кода и без сессии — на форму запроса новой ссылки с объяснением", async ({ page }) => {
    await page.goto("/auth/callback?next=/reset-password/confirm");
    await expect(page).toHaveURL(/\/reset-password\?error=link$/);
    await expect(page.getByText("Ссылка не сработала")).toBeVisible();

    await page.goto("/auth/callback?code=not-a-real-code&next=/home");
    await expect(page).toHaveURL(/\/login\?error=link$/);
    await expect(page.getByText("Ссылка не сработала")).toBeVisible();

    await page.goto("/reset-password/confirm"); // зашли напрямую, без ссылки из письма
    await expect(page).toHaveURL(/\/reset-password\?error=link$/);
  });

  test("?next= в callback не уводит на чужой хост", async ({ page }) => {
    await page.goto("/auth/callback?code=not-a-real-code&next=//evil.example.com/steal");
    await expect(page).toHaveURL(/\/login\?error=link$/);
    expect(new URL(page.url()).hostname).toBe(new URL(test.info().project.use.baseURL ?? "http://127.0.0.1:3000").hostname);
  });
});

test.describe("восстановление пароля", () => {

  test("новый пароль по правилам, человек остаётся в аккаунте, остальные устройства выходят", async ({ page, browser }) => {
    // Многошаговый сценарий (несколько входов/писем/навигаций): общий лимит 30 с на нагруженной машине мал.
    test.slow();
    const user = await createOnboardedUser("reset");
    const otherDevice = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": freshIp() } });
    try {
      // «Другое устройство»: отдельный контекст, вошёл со старым паролем.
      const otherPage = await otherDevice.newPage();
      await login(otherPage, user.email, user.password);
      await otherPage.goto("/library");
      await expect(otherPage).toHaveURL(/\/library$/);

      const before = await mailIds(user.email);
      await page.goto("/reset-password");
      const email = page.getByLabel("Email");
      await waitForHydration(email);
      await email.fill(user.email);
      await page.getByRole("button", { name: "Отправить ссылку" }).click();
      await expect(page.getByRole("heading", { name: "Проверь почту" })).toBeVisible();
      await expect(page.getByText("Если аккаунт с этим email есть, мы отправили ссылку для нового пароля на")).toBeVisible();

      await page.goto(await mailLinkTo(user.email, before));
      await expect(page).toHaveURL(/\/reset-password\/confirm$/);
      await expect(page.getByText("Ссылка подтверждена")).toBeVisible();
      await expect(page.getByText(/Аккаунт e•••••@example\.com/)).toBeVisible();

      const password = page.getByLabel("Новый пароль", { exact: true });
      const confirmation = page.getByLabel("Повтори пароль", { exact: true });
      const save = page.getByRole("button", { name: "Сохранить и войти" });
      await waitForHydration(password);

      await password.fill("short1");
      await confirmation.fill("short1");
      await save.click();
      await expect(page.getByText("Пароль должен быть не короче 8 символов.")).toBeVisible();

      await password.fill("onlyletters");
      await confirmation.fill("onlyletters");
      await save.click();
      await expect(page.getByText("Добавь в пароль хотя бы одну цифру.")).toBeVisible();

      await password.fill("fresh-pass-2026");
      await confirmation.fill("fresh-pass-2025");
      await save.click();
      await expect(page.getByText("Пароли не совпадают.")).toBeVisible();

      await confirmation.fill("fresh-pass-2026");
      await save.click();
      await expect(page).toHaveURL(/\/home$/, { timeout: 15_000 });
      await expect(page.getByText("Пароль обновлён")).toBeVisible();

      // Другое устройство больше не авторизовано: у него осталась подсказка
      // «входил раньше», поэтому вместо онбординга — «Войди снова».
      await otherPage.goto("/library");
      await expect(otherPage).toHaveURL(/\/login\?reason=expired/);

      // Новый пароль работает, старый — нет.
      await page.context().clearCookies();
      await login(page, user.email, "fresh-pass-2026");
      await expect(page).toHaveURL(/\/home$/);
    } finally {
      await otherDevice.close();
      await user.remove();
    }
  });
});

test.describe("сессия истекла", () => {

  test("вернувшийся без сессии видит «Войди снова» и после входа попадает на ту же страницу", async ({ page, context }) => {
    // Многошаговый сценарий (несколько входов/писем/навигаций): общий лимит 30 с на нагруженной машине мал.
    test.slow();
    await login(page);
    await page.goto("/library"); // GET с сессией: proxy запоминает, что здесь уже входили
    await expect(page).toHaveURL(/\/library$/);

    // Имитируем истёкшую сессию: cookie Supabase стёрты, «подсказка» остаётся.
    const kept = (await context.cookies()).filter((c) => !c.name.startsWith("sb-"));
    expect(kept.some((c) => c.name === "lr_session_hint")).toBe(true);
    await context.clearCookies();
    await context.addCookies(kept);

    await page.goto("/library");
    await expect(page).toHaveURL(/\/login\?reason=expired&next=%2Flibrary$/);
    await expect(page.getByRole("heading", { name: "Войди снова" })).toBeVisible();
    await expect(page.getByText("Прогресс сохранён")).toBeVisible();

    const email = page.getByLabel("Email");
    await waitForHydration(email);
    await email.fill(TEST_EMAIL);
    await page.getByLabel("Пароль", { exact: true }).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Войти", exact: true }).click();
    await expect(page).toHaveURL(/\/library$/);
  });

  test("осознанный выход стирает подсказку: дальше онбординг, а не «Войди снова»", async ({ page }) => {
    // Многошаговый сценарий (несколько входов/писем/навигаций): общий лимит 30 с на нагруженной машине мал.
    test.slow();
    await login(page);
    await page.goto("/settings");
    await page.getByRole("button", { name: "Выйти из аккаунта" }).click();
    await expect(page).toHaveURL(/\/onboarding$/);
    await page.goto("/library");
    await expect(page).toHaveURL(/\/onboarding$/);
  });

  test("новый посетитель без cookie по-прежнему попадает в онбординг", async ({ page }) => {
    await page.goto("/library");
    await expect(page).toHaveURL(/\/onboarding$/);
  });

  test("/login для уже вошедшего ведёт на ?next=, но не на чужой хост", async ({ page }) => {
    // Многошаговый сценарий (несколько входов/писем/навигаций): общий лимит 30 с на нагруженной машине мал.
    test.slow();
    await login(page);
    await page.goto("/login?next=/library");
    await expect(page).toHaveURL(/\/library$/);
    await page.goto("/login?next=//evil.example.com/steal");
    await expect(page).toHaveURL(/\/home$/);
    await page.goto("/login?next=https://evil.example.com");
    await expect(page).toHaveURL(/\/home$/);
  });
});

for (const theme of ["light", "dark"] as const) {
  test.describe(`a11y (axe) и тема — ${theme}`, () => {
    for (const [name, url] of [
      ["вход", "/login"],
      ["регистрация", "/login?mode=signup"],
      ["сессия истекла", "/login?reason=expired"],
      ["ссылка не сработала", "/login?error=link"],
      ["восстановление", "/reset-password"],
    ] as const) {
      test(`${name}: без нарушений WCAG 2.1 AA`, async ({ page }) => {
        await page.emulateMedia({ reducedMotion: "reduce", colorScheme: theme });
        await page.addInitScript((t) => localStorage.setItem("lexreader_theme", t), theme);
        await page.goto(url);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await expect(page.getByRole("main")).toBeVisible();
        const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      });
    }
  });
}

test.describe("адаптив", () => {
  for (const size of [
    { name: "mobile 390", width: 390, height: 844 },
    { name: "tablet 834", width: 834, height: 1112 },
    { name: "desktop 1280", width: 1280, height: 800 },
  ]) {
    test(`${size.name}: нет горизонтальной прокрутки, главное действие в пределах экрана, колонка по центру`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      for (const url of ["/login", "/login?mode=signup", "/reset-password"]) {
        await page.goto(url);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${url}: горизонтальная прокрутка`).toBeLessThanOrEqual(0);

        const primary = page.getByRole("button", { name: /^(Войти|Создать аккаунт|Отправить ссылку)$/ }).first();
        const box = await primary.boundingBox();
        expect(box, `${url}: кнопка видима`).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(size.width);
        expect(box!.height).toBeGreaterThanOrEqual(44);

        const main = await page.getByRole("main").boundingBox();
        expect(main!.width).toBeLessThanOrEqual(448 + 1);
        // колонка центрирована: левый и правый отступы равны
        expect(Math.abs(main!.x - (size.width - main!.x - main!.width))).toBeLessThanOrEqual(1);
      }
    });
  }
});
