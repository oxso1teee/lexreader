import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

// Phase 1 — библиотека src/components/ui на справочнике /dev/ui: рендер,
// props/состояния, клавиатура, a11y (axe) в светлой и тёмной теме, адаптив.
// Запуск: npm run test:ui-kit (поднимает next dev на :3100, Supabase не нужен).

async function open(page: Page, theme: "light" | "dark" = "light") {
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: theme });
  // только первый заход: перезагрузка не должна затирать выбор, сделанный в тесте
  await page.addInitScript((t) => {
    if (localStorage.getItem("lexreader_theme") === null) localStorage.setItem("lexreader_theme", t);
  }, theme);
  await page.goto("/dev/ui");
  await expect(page.getByRole("heading", { level: 1, name: "UI kit" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

test.describe("рендер и состояния", () => {
  test("все секции справочника на месте", async ({ page }) => {
    await open(page);
    for (const name of ["Кнопки", "Карточки", "Поля", "Поле пароля", "Lex", "Выбор", "Плитки с вариантами", "Метки и аватары", "Вкладки, меню, слои", "Прогресс и загрузка", "Сообщения и уведомления", "Состояния экрана"]) {
      await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
    }
  });

  test("Button: loading блокирует повторный клик и сообщает aria-busy; disabled недоступна", async ({ page }) => {
    await open(page);
    const save = page.getByRole("button", { name: "Сохранить" });
    await expect(save).not.toHaveAttribute("aria-busy", "true");
    await save.click();
    const busy = page.getByRole("button", { name: "Сохраняем…" });
    await expect(busy).toHaveAttribute("aria-busy", "true");
    await expect(busy.locator(".spinner")).toBeVisible();
    await expect(page.getByRole("button", { name: "Сохранить" })).toBeVisible({ timeout: 4000 }); // вернулась
    await expect(page.getByRole("button", { name: "Недоступна" })).toBeDisabled();
  });

  test("IconButton: доступное имя обязательно и совпадает с label", async ({ page }) => {
    await open(page);
    for (const name of ["Уведомления", "Редактировать", "Добавить", "Маленькая иконка"]) {
      await expect(page.getByRole("button", { name })).toBeVisible();
    }
  });

  test("Card tones и Badge tones рендерятся классами ролей", async ({ page }) => {
    await open(page);
    for (const tone of ["leaf", "sky", "sun", "ember", "danger", "sunken"]) {
      await expect(page.locator(`.card-tone-${tone}`).first()).toBeVisible();
    }
    await expect(page.locator(".card-dashed")).toBeVisible();
    for (const tone of ["leaf", "sky", "ember", "sun", "danger", "solid", "ink", "plus", "count"]) {
      await expect(page.locator(`.badge-${tone}`).first()).toBeVisible();
    }
  });

  test("Avatar: инициалы из имени и из email, кольцо «я», доступное имя только когда задано label", async ({ page }) => {
    await open(page);
    await expect(page.locator(".avatar-me")).toHaveText("СЕ");
    await expect(page.locator(".avatar", { hasText: "АК" })).toBeVisible();
    await expect(page.locator(".avatar", { hasText: "TE" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Лена" })).toBeVisible();
    await expect(page.locator(".avatar-me")).toHaveAttribute("aria-hidden", "true");
  });

  test("Progress / ProgressRing выставляют значение и имя", async ({ page }) => {
    await open(page);
    const bar = page.getByRole("progressbar", { name: "Прочитано 64%" });
    await expect(bar).toHaveAttribute("aria-valuenow", "64");
    await expect(page.getByRole("progressbar", { name: "Цель дня 30 из 50" })).toHaveAttribute("aria-valuenow", "60");
  });

  test("состояния экрана: loading / empty / error / offline / not found", async ({ page }) => {
    await open(page);
    await expect(page.locator('[role="status"][aria-busy="true"]')).toContainText("Загрузка");
    await expect(page.getByText("Колода пуста")).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "Не получилось обработать видео" })).toBeVisible();
    await expect(page.getByText("Код: YT-404")).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "Нет соединения" })).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "Такой страницы нет" })).toBeVisible();
  });
});

test.describe("поля и выбор", () => {
  test("Input: label, hint и error связаны с полем", async ({ page }) => {
    await open(page);
    const email = page.getByLabel("Email");
    await email.fill("sergey@example.com");
    await expect(email).toHaveValue("sergey@example.com");
    await expect(email).toHaveAccessibleDescription("Пришлём ссылку для входа");
    await expect(email).not.toHaveAttribute("aria-invalid", "true");

    // exact: в справочнике есть и «Новый пароль», и кнопка «Показать пароль».
    const password = page.getByLabel("Пароль", { exact: true });
    await expect(password).toHaveAttribute("aria-invalid", "true");
    await expect(password).toHaveAccessibleDescription("Неверный email или пароль");
    await expect(page.getByLabel("Недоступное")).toBeDisabled();
  });

  test("Checkbox, Switch и RadioGroup работают с клавиатуры", async ({ page }) => {
    await open(page);
    const box = page.getByRole("checkbox", { name: /Обратные карточки/ });
    await box.focus();
    await page.keyboard.press("Space");
    await expect(box).toBeChecked();

    const sw = page.getByRole("switch", { name: "Письма с итогами недели" });
    await expect(sw).toHaveAttribute("aria-checked", "false");
    await sw.focus();
    await page.keyboard.press("Space");
    await expect(sw).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("Enter");
    await expect(sw).toHaveAttribute("aria-checked", "false");
    await expect(page.getByRole("switch", { name: "Недоступный переключатель" })).toBeDisabled();
    await expect(page.getByRole("switch", { name: "Ежедневное напоминание" })).toHaveAccessibleDescription("В 21:00, если ты ещё не занимался");

    const year = page.getByRole("radio", { name: /Год/ });
    await expect(year).toBeChecked();
    await year.focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("radio", { name: /Месяц/ })).toBeChecked();
    await expect(page.getByRole("group", { name: "Тариф" })).toBeVisible();
  });
});

test.describe("вкладки, меню, диалог, подсказка", () => {
  test("Tabs: стрелки, Home/End, roving tabindex, disabled пропускается, панели скрываются", async ({ page }) => {
    await open(page);
    const tabs = page.getByRole("tablist", { name: "Период" });
    const week = tabs.getByRole("tab", { name: "Неделя" });
    const month = tabs.getByRole("tab", { name: "Месяц" });
    const all = tabs.getByRole("tab", { name: "Всё время" });
    await expect(week).toHaveAttribute("aria-selected", "true");
    await expect(week).toHaveAttribute("tabindex", "0");
    await expect(month).toHaveAttribute("tabindex", "-1");
    await expect(page.getByRole("tabpanel", { name: "Неделя" })).toBeVisible();

    await week.focus();
    await page.keyboard.press("ArrowRight");
    await expect(month).toBeFocused();
    await expect(month).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel", { name: "Месяц" })).toBeVisible();
    await expect(page.getByText("Данные за неделю")).toBeHidden();
    await page.keyboard.press("End");
    await expect(all).toBeFocused();
    await page.keyboard.press("ArrowRight"); // замыкается на первой
    await expect(week).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(all).toBeFocused();

    const underline = page.getByRole("tablist", { name: "Раздел" });
    await underline.getByRole("tab", { name: "Колоды" }).click();
    await page.keyboard.press("ArrowRight"); // «Скоро» disabled → обратно к «Слова»
    await expect(underline.getByRole("tab", { name: "Слова" })).toBeFocused();
    await expect(underline.getByRole("tab", { name: "Скоро" })).toBeDisabled();
  });

  test("DropdownMenu: открытие, стрелки, typeahead, Escape возвращает фокус, выбор, disabled, клик снаружи", async ({ page }) => {
    await open(page);
    const trigger = page.getByRole("button", { name: "Действия с колодой" });
    await expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    const menu = page.getByRole("menu", { name: "Действия с колодой" });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Переименовать" })).toBeFocused();

    await page.keyboard.press("ArrowDown");
    await expect(menu.getByRole("menuitem", { name: "Экспорт CSV" })).toBeFocused();
    await page.keyboard.press("ArrowDown"); // «Недоступно» пропускается
    await expect(menu.getByRole("menuitem", { name: "Удалить" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(menu.getByRole("menuitem", { name: "Переименовать" })).toBeFocused();
    await page.keyboard.press("End");
    await expect(menu.getByRole("menuitem", { name: "Удалить" })).toBeFocused();
    await menu.dispatchEvent("keydown", { key: "э" }); // Playwright не умеет press() кириллицы
    await expect(menu.getByRole("menuitem", { name: "Экспорт CSV" })).toBeFocused();
    await expect(menu.getByRole("menuitem", { name: "Недоступно" })).toHaveAttribute("aria-disabled", "true");

    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await menu.getByRole("menuitem", { name: "Переименовать" }).click();
    await expect(menu).toBeHidden();
    await expect(page.getByTestId("last-action")).toContainText("rename");

    await trigger.click();
    await page.getByRole("heading", { level: 1 }).click(); // клик снаружи
    await expect(menu).toBeHidden();
  });

  test("Dialog: aria, фокус внутри, ловушка Tab, Escape и возврат фокуса, блокировка прокрутки", async ({ page }) => {
    await open(page);
    const opener = page.getByRole("button", { name: "Открыть диалог" });
    await opener.click();
    const dialog = page.getByRole("dialog", { name: "Удалить колоду?" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(dialog).toHaveAccessibleDescription(/безвозвратно/);
    await expect(page.getByLabel("Название для подтверждения")).toBeFocused();
    await expect(page.locator("body")).toHaveCSS("overflow", "hidden");

    // Tab зациклен внутри: поле → Да, удалить → Оставить → Закрыть? (порядок DOM: Закрыть, поле, кнопки)
    const seen = new Set<string>();
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      const inside = await dialog.evaluate((el) => el.contains(document.activeElement));
      expect(inside, `Tab #${i + 1} вывел фокус из диалога`).toBe(true);
      seen.add(await page.evaluate(() => document.activeElement?.textContent?.trim() || document.activeElement?.getAttribute("aria-label") || ""));
    }
    expect(seen.size).toBeGreaterThanOrEqual(3);
    await page.keyboard.press("Shift+Tab");
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
    await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  });

  test("Dialog закрывается кликом по подложке, но не по самому окну", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Открыть диалог" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("heading").click();
    await expect(dialog).toBeVisible();
    await page.mouse.click(5, 5);
    await expect(dialog).toBeHidden();
  });

  test("Tooltip: hover и фокус показывают, Escape скрывает, описывает триггер", async ({ page }) => {
    await open(page);
    const trigger = page.getByRole("button", { name: "Удалить колоду" });
    const tip = page.getByRole("tooltip");
    await expect(tip).toBeHidden();
    await trigger.hover();
    await expect(tip).toBeVisible();
    await expect(tip).toHaveText("Удалить колоду");
    await expect(trigger).toHaveAccessibleDescription("Удалить колоду");
    await page.keyboard.press("Escape");
    await expect(tip).toBeHidden();
    await page.mouse.move(0, 0);
    await trigger.focus();
    await expect(tip).toBeVisible();
    await trigger.blur();
    await expect(tip).toBeHidden();
  });
});

test.describe("toast и обратная связь", () => {
  test("success — role=status, автозакрытие; error — role=alert, живёт дольше", async ({ page }) => {
    await page.clock.install();
    await open(page);
    await page.getByRole("button", { name: "Success", exact: true }).click();
    const ok = page.getByRole("status").filter({ hasText: "Слово добавлено в «Мозг»" });
    await expect(ok).toBeVisible();
    await page.getByRole("button", { name: "Error", exact: true }).click();
    const err = page.getByRole("alert").filter({ hasText: "Не удалось сохранить слово" });
    await expect(err).toBeVisible();
    await expect(err).toContainText("Проверь соединение и повтори.");

    await page.clock.runFor(4000); // > success (3.5 c), < error (8 c)
    await expect(ok).toBeHidden();
    await expect(err).toBeVisible();
    await page.clock.runFor(5000);
    await expect(err).toBeHidden();
  });

  test("автозакрытие ставится на паузу при наведении и возобновляется после", async ({ page }) => {
    await page.clock.install();
    await open(page);
    await page.getByRole("button", { name: "Success", exact: true }).click();
    const t = page.getByRole("status").filter({ hasText: "Слово добавлено в «Мозг»" });
    await t.hover();
    await page.clock.runFor(10_000);
    await expect(t).toBeVisible();
    await page.mouse.move(0, 0);
    await page.clock.runFor(4000);
    await expect(t).toBeHidden();
  });

  test("действие в toast выполняется и закрывает его; крестик закрывает", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "С действием" }).click();
    const t = page.getByRole("status").filter({ hasText: "Колода удалена" });
    await t.getByRole("button", { name: "Отменить" }).click();
    await expect(page.getByTestId("last-action")).toContainText("undo");
    await expect(t).toBeHidden();

    await page.getByRole("button", { name: "Info", exact: true }).click();
    const info = page.getByRole("status").filter({ hasText: "Новая неделя началась" });
    await info.getByRole("button", { name: "Закрыть уведомление" }).click();
    await expect(info).toBeHidden();
  });

  test("promise: loading заменяется на success на месте; fromResult показывает текст ошибки", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Promise" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Сохраняем…" }).locator(".spinner")).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: /^Сохранено/ })).toBeVisible();
    await expect(page.locator(".toast", { hasText: "Сохраняем…" })).toHaveCount(0);

    await page.getByRole("button", { name: "Из результата" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Колода не найдена" })).toBeVisible();
  });

  test("не больше 4 toast одновременно; «Закрыть все» очищает регион", async ({ page }) => {
    await open(page);
    const warning = page.getByRole("button", { name: "Warning", exact: true });
    for (let i = 0; i < 7; i++) await warning.click();
    // тот же текст — разные id → стопка ограничена лимитом
    await expect(page.locator(".toast")).toHaveCount(4);
    await page.getByRole("button", { name: "Закрыть все" }).click();
    await expect(page.locator(".toast")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Уведомления", exact: true })).toBeAttached();
  });

  test("офлайн: постоянный toast «Нет соединения», затем «Снова онлайн»", async ({ page, context }) => {
    await open(page);
    await context.setOffline(true);
    const offline = page.getByRole("alert").filter({ hasText: "Нет соединения" }).locator("xpath=ancestor-or-self::*[contains(@class,'toast')]");
    await expect(page.locator(".toast", { hasText: "Нет соединения" })).toBeVisible();
    await expect(page.locator(".toast", { hasText: "Нет соединения" }).getByRole("button", { name: "Закрыть уведомление" })).toHaveCount(0); // не закрывается вручную
    void offline;
    await context.setOffline(false);
    await expect(page.locator(".toast", { hasText: "Снова онлайн" })).toBeVisible();
    await expect(page.locator(".toast", { hasText: "Нет соединения" })).toHaveCount(0);
  });
});

test.describe("темы", () => {
  test("переключатель меняет data-theme, сохраняется и переживает перезагрузку", async ({ page }) => {
    await open(page, "light");
    const lightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await page.getByRole("tab", { name: "Тёмная" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const darkBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(darkBg).not.toBe(lightBg);
    expect(await page.evaluate(() => localStorage.getItem("lexreader_theme"))).toBe("dark");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("системная тема следует за ОС, явный выбор — нет", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("lexreader_theme", "system"));
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await page.goto("/dev/ui");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });

  test("поверхности лестницы различаются между темами (не инверсия одного цвета)", async ({ page }) => {
    const read = async () =>
      page.evaluate(() => {
        const cs = getComputedStyle(document.documentElement);
        return ["--background", "--surface", "--surface-muted", "--surface-elevated"].map((n) => cs.getPropertyValue(n).trim());
      });
    await open(page, "light");
    const l = await read();
    await page.getByRole("tab", { name: "Тёмная" }).click();
    const d = await read();
    expect(new Set(d).size).toBe(4);
    for (let i = 0; i < 4; i++) expect(d[i]).not.toBe(l[i]);
  });
});

test.describe("Lex и поле пароля (Phase 2, экраны входа)", () => {
  // Клиентские поля приходят в HTML раньше, чем React их подключил: ввод до
  // гидратации не обновил бы шкалу и чеклист (тот же приём, что в e2e/helpers).
  const hydrated = (locator: Locator) =>
    expect.poll(() => locator.evaluate((el) => Object.keys(el).some((key) => key.startsWith("__reactProps")))).toBe(true);

  test("Lex: 8 настроений, декоративный, «призрак» всегда спит", async ({ page }) => {
    await open(page);
    const lex = page.getByRole("region", { name: "Lex" });
    for (const mood of ["happy", "wink", "joy", "sad", "sleep", "think", "wow", "cool"]) {
      const svg = lex.locator(`svg.lex[data-lex-mood="${mood}"]`).first();
      await expect(svg).toBeVisible();
      await expect(svg).toHaveAttribute("aria-hidden", "true");
    }
    await expect(lex.locator("svg.lex-ghost")).toHaveAttribute("data-lex-mood", "sleep");
  });

  test("Lex: цвета фиксированы и от темы не зависят (живот остаётся светлым в тёмной)", async ({ page }) => {
    await open(page);
    const readBelly = () =>
      page.locator("svg.lex").first().evaluate((el) => getComputedStyle(el).getPropertyValue("--lex-belly").trim());
    const light = await readBelly();
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    expect(await readBelly()).toBe(light);
    expect(light).not.toBe("");
  });

  test("PasswordField: «Показать» меняет type и подпись кнопки, значение не теряется", async ({ page }) => {
    await open(page);
    const field = page.getByLabel("Новый пароль", { exact: true });
    await hydrated(field);
    await field.fill("lighthouse2026");
    await expect(field).toHaveAttribute("type", "password");

    await page.getByRole("button", { name: "Показать пароль" }).first().click();
    await expect(field).toHaveAttribute("type", "text");
    await expect(field).toHaveValue("lighthouse2026");

    await page.getByRole("button", { name: "Скрыть пароль" }).click();
    await expect(field).toHaveAttribute("type", "password");
    await expect(field).toHaveValue("lighthouse2026");
  });

  test("PasswordField: шкала и подсказка меняются по мере ввода и описывают поле", async ({ page }) => {
    await open(page);
    const field = page.getByLabel("Новый пароль", { exact: true });
    await hydrated(field);
    await expect(page.getByRole("img", { name: "Надёжность пароля: пароль пока не введён" })).toBeVisible();

    await field.fill("abc");
    await expect(page.getByRole("img", { name: "Надёжность пароля: слабый" })).toBeVisible();
    await expect(page.getByText("Слабый — добавь ещё 5 символов и цифру")).toBeVisible();

    await field.fill("abcdefg1");
    await expect(page.getByRole("img", { name: "Надёжность пароля: средний" })).toBeVisible();

    await field.fill("lighthouse2026");
    await expect(page.getByRole("img", { name: "Надёжность пароля: надёжный" })).toBeVisible();
    await expect(field).toHaveAccessibleDescription(/Такой пароль сложно подобрать/);
  });

  test("PasswordRequirements: чеклист отмечает длину, цифру и совпадение", async ({ page }) => {
    await open(page);
    const items = page.getByRole("region", { name: "Требования к паролю" }).getByRole("listitem");
    await hydrated(page.getByLabel("Новый пароль", { exact: true }));
    await expect(items).toHaveText([
      "Не выполнено: Не меньше 8 символов",
      "Не выполнено: Хотя бы одна цифра",
      "Не выполнено: Пароли совпадают — повтори пароль во втором поле",
    ]);

    await page.getByLabel("Новый пароль", { exact: true }).fill("lighthouse2026");
    await page.getByLabel("Повтори пароль", { exact: true }).fill("lighthouse2025");
    await expect(items).toHaveText([
      "Выполнено: Не меньше 8 символов",
      "Выполнено: Хотя бы одна цифра",
      "Не выполнено: Пароли пока не совпадают",
    ]);

    await page.getByLabel("Повтори пароль", { exact: true }).fill("lighthouse2026");
    await expect(items.nth(2)).toHaveText("Выполнено: Пароли совпадают");
  });

  test("поле с иконкой: текст не заезжает под иконку и кнопку, зона кнопки не меньше 44px", async ({ page }) => {
    await open(page);
    const field = page.getByLabel("Новый пароль", { exact: true });
    const paddings = await field.evaluate((el) => {
      const style = getComputedStyle(el);
      return { left: parseFloat(style.paddingLeft), right: parseFloat(style.paddingRight) };
    });
    expect(paddings.left).toBeGreaterThanOrEqual(40);
    expect(paddings.right).toBeGreaterThanOrEqual(48);
    const box = await page.getByRole("button", { name: "Показать пароль" }).first().boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe("ChoiceGroup (Phase 2, онбординг)", () => {
  test("радио-семантика: группа с вопросом, короткое имя карточки, описание отдельно, выбор кликом и стрелками", async ({ page }) => {
    await open(page);
    const group = page.getByRole("group", { name: "Цель занятий" });
    const travel = group.getByRole("radio", { name: "Путешествия" });

    await expect(travel).toBeChecked();
    // Имя карточки — только подпись; описание подключено отдельно (aria-describedby).
    await expect(travel).toHaveAccessibleName("Путешествия");
    await expect(travel).toHaveAccessibleDescription("Отели, кафе, дорога");

    await group.getByRole("radio", { name: "Работа и карьера" }).click();
    await expect(group.getByRole("radio", { name: "Работа и карьера" })).toBeChecked();
    await expect(travel).not.toBeChecked();

    await page.keyboard.press("ArrowDown"); // нативное поведение radio
    await expect(group.getByRole("radio", { name: "Для себя" })).toBeChecked();
  });

  test("numbered: цифры выбирают вариант только пока фокус в группе; недоступный вариант не выбирается", async ({ page }) => {
    await open(page);
    const group = page.getByRole("group", { name: "Какой вариант подходит?" });
    await expect(group.locator(".choice-card-key")).toHaveText(["1", "2", "3", "4"]);

    // Вне группы одиночные клавиши ничего не делают (WCAG 2.1.4).
    await page.locator("body").press("2");
    await expect(group.getByRole("radio", { checked: true })).toHaveCount(0);

    await group.getByRole("radio", { name: "lived", exact: true }).focus();
    await page.keyboard.press("3");
    const haveLived = group.getByRole("radio", { name: "have lived", exact: true });
    await expect(haveLived).toBeChecked();
    await expect(haveLived).toBeFocused();

    await page.keyboard.press("4"); // «live» недоступен
    await expect(haveLived).toBeChecked();
    await expect(group.getByRole("radio", { name: "live", exact: true })).toBeDisabled();
  });

  test("две колонки: недоступная карточка не получает фокус и не выбирается", async ({ page }) => {
    await open(page);
    const group = page.getByRole("group", { name: "Язык для перевода" });
    await expect(group.getByRole("radio", { name: "Испанский" })).toBeChecked();
    await group.getByRole("radio", { name: "Немецкий" }).click();
    await expect(group.getByRole("radio", { name: "Немецкий" })).toBeChecked();
    await expect(group.getByRole("radio", { name: "Итальянский" })).toBeDisabled();
    // У fieldset Chrome отдаёт grid-template-columns как заданную строку, а не как
    // пиксели, поэтому колонки проверяем по положению карточек: 2 в ряд.
    const boxes = await group
      .locator("label.choice-card")
      .evaluateAll((cards) => cards.map((card) => ({ x: Math.round(card.getBoundingClientRect().x), y: Math.round(card.getBoundingClientRect().y) })));
    expect(boxes[0].y).toBe(boxes[1].y);
    expect(boxes[2].y).toBeGreaterThan(boxes[0].y);
    expect(boxes[2].x).toBe(boxes[0].x);
  });
});

test.describe("a11y (axe, WCAG 2.1 AA)", () => {
  for (const theme of ["light", "dark"] as const) {
    test(`справочник без нарушений — ${theme}`, async ({ page }) => {
      await open(page, theme);
      const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
    });

    test(`диалог, меню и toast без нарушений — ${theme}`, async ({ page }) => {
      await open(page, theme);
      await page.getByRole("button", { name: "Error", exact: true }).click();
      await page.getByRole("button", { name: "Открыть диалог" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
    });
  }
});

test.describe("адаптив", () => {
  const sizes = [
    { name: "mobile", width: 390, height: 844 },
    { name: "tablet", width: 834, height: 1112 },
    { name: "desktop", width: 1280, height: 800 },
  ];

  for (const size of sizes) {
    test(`${size.name}: нет горизонтальной прокрутки`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await open(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }

  test("cards-grid: число колонок растёт с шириной", async ({ page }) => {
    const columns = async () =>
      page.locator(".cards-grid").first().evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page);
    const mobile = await columns();
    await page.setViewportSize({ width: 1280, height: 800 });
    const desktop = await columns();
    expect(mobile).toBe(1);
    expect(desktop).toBeGreaterThanOrEqual(3);
  });

  test("mobile: зоны нажатия основных контролов не меньше 44px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page);
    const small = await page.evaluate(() => {
      const bad: string[] = [];
      const targets = document.querySelectorAll<HTMLElement>("main button:not(.btn-sm):not(.icon-btn-sm), main input:not([type=hidden]), main select, main textarea, main [role=tab], main [role=switch]");
      targets.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0) return;
        // чекбокс/радио — нативный кружок 24px внутри строки 44px: проверяем строку-обёртку
        const box = el.closest<HTMLElement>("label.choice") ?? el;
        const b = box.getBoundingClientRect();
        // переключатель: визуальный трек 48×28 внутри зоны 60×44 (отрицательный margin)
        if (b.height < 43.5) bad.push(`${el.tagName.toLowerCase()}[${el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 20) ?? ""}] ${Math.round(b.width)}x${Math.round(b.height)}`);
      });
      return bad;
    });
    expect(small).toEqual([]);
  });

  test("Dialog: нижний шит на mobile, окно по центру на desktop; Drawer — шит → правая панель", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page);
    await page.getByRole("button", { name: "Открыть диалог" }).click();
    let box = (await page.getByRole("dialog").boundingBox())!;
    expect(Math.round(box.y + box.height)).toBe(844); // прижат к низу
    expect(Math.round(box.width)).toBe(390);
    await page.keyboard.press("Escape");

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole("button", { name: "Открыть диалог" }).click();
    box = (await page.getByRole("dialog").boundingBox())!;
    expect(box.y).toBeGreaterThan(20); // не прижат к краям
    expect(box.y + box.height).toBeLessThan(780);
    expect(Math.abs(box.x + box.width / 2 - 640)).toBeLessThan(2); // по центру
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Открыть панель" }).click();
    box = (await page.getByRole("dialog", { name: "Фильтры" }).boundingBox())!;
    expect(Math.round(box.x + box.width)).toBe(1280); // справа
    expect(Math.round(box.height)).toBe(800); // на всю высоту
    await page.keyboard.press("Escape");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Открыть панель" }).click();
    box = (await page.getByRole("dialog", { name: "Фильтры" }).boundingBox())!;
    expect(Math.round(box.y + box.height)).toBe(844);
  });

  test("toast на mobile выше нижней навигации, на desktop — справа внизу", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page);
    await page.getByRole("button", { name: "Info", exact: true }).click();
    let box = (await page.locator(".toast").first().boundingBox())!;
    expect(844 - (box.y + box.height)).toBeGreaterThanOrEqual(80); // над таббаром (~5.5rem)
    await page.setViewportSize({ width: 1280, height: 800 });
    box = (await page.locator(".toast").first().boundingBox())!;
    expect(1280 - (box.x + box.width)).toBeLessThan(40);
    expect(box.x).toBeGreaterThan(640);
  });
});

test("404: своя страница вместо стандартной Next.js", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/this-route-does-not-exist");
  await expect(page.getByRole("heading", { name: "Такой страницы нет" }).or(page.getByText("Такой страницы нет"))).toBeVisible();
  await expect(page.getByRole("link", { name: "На главную" })).toHaveAttribute("href", "/home");
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(result.violations.map((v) => v.id)).toEqual([]);
});
