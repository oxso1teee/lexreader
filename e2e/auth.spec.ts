import { test, expect } from "@playwright/test";
import { login, restoreTestPassword, TEST_EMAIL, TEST_PASSWORD } from "./helpers";

test("login with correct credentials redirects to home", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/home$/);
});

test("login with wrong password shows a generic error", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(TEST_EMAIL);
  await page.getByPlaceholder("Пароль").fill("definitely-wrong-password");
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page.getByText("Неверный email или пароль.")).toBeVisible();
});

test("login with non-existent email shows the same generic error (no user enumeration)", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill("does-not-exist@example.com");
  await page.getByPlaceholder("Пароль").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page.getByText("Неверный email или пароль.")).toBeVisible();
});

test("password reset request shows a generic confirmation message", async ({ page }) => {
  await page.goto("/reset-password");
  await page.getByPlaceholder("Email").fill(TEST_EMAIL);
  await page.getByRole("button", { name: "Отправить ссылку для сброса" }).click();
  await expect(page.getByText(/Если такой email зарегистрирован/)).toBeVisible();
});

// Раньше login/signup/password-reset делили один identifier-бакет — неудачный
// вход мог молча "съесть" попытки сброса пароля того же email (и наоборот).
// Не гоняем здесь реальные 5 неудачных попыток до блокировки: это разделяет
// один и тот же IP-бакет с соседними тестами файла (у них тоже есть по одной
// неудачной попытке входа) и рискует словить настоящий 15-минутный лок для
// всего набора. Вместо этого — минимальное, безопасное доказательство, что
// один неудачный вход не мешает следующему же запросу сброса пароля для того
// же email, чего с общим бакетом раньше не было гарантировано.
test("a failed login attempt does not consume the password-reset bucket for the same email", async ({
  page,
}) => {
  const email = `rate-limit-bucket-check-${Date.now()}@example.com`;

  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Пароль").fill("whatever-wrong-password");
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page.getByText("Неверный email или пароль.")).toBeVisible();

  await page.goto("/reset-password");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByRole("button", { name: "Отправить ссылку для сброса" }).click();
  await expect(page.getByText(/Если такой email зарегистрирован/)).toBeVisible();
});

// Раньше в наборе не было ни одного теста, доходящего до конца ссылки сброса
// пароля (только до "письмо отправлено") — реальная проверка через локальный
// Mailpit нашла настоящий баг: /auth/callback строил редирект из origin
// запроса, который мог не совпадать с host, для которого была выставлена
// cookie сессии — пользователя тихо возвращало на /reset-password без
// единой ошибки. Исправлено (см. auth/callback/route.ts). Тест ниже не даёт
// этому повториться незаметно.
test("password reset completion: follow real link, set new password, log in with it", async ({
  page,
}) => {
  async function latestMailpitLink(): Promise<string> {
    const res = await fetch("http://127.0.0.1:54324/api/v1/messages");
    const data = await res.json();
    const msgRes = await fetch(`http://127.0.0.1:54324/api/v1/message/${data.messages[0].ID}`);
    const msg = await msgRes.json();
    const html: string = msg.HTML || msg.Text;
    const match = html.match(/href="([^"]*verify[^"]*)"/);
    if (!match) throw new Error("Ссылка сброса пароля не найдена в письме Mailpit.");
    return match[1].replace(/&amp;/g, "&");
  }

  const tempPassword = `temp-${Date.now()}`;

  // restoreTestPassword() идёт через service_role напрямую (не через
  // повторный email-цикл) — сбой в середине теста не должен оставлять
  // TEST_PASSWORD сломанным для всех остальных тестов набора.
  try {
    await page.goto("/reset-password");
    await page.getByPlaceholder("Email").fill(TEST_EMAIL);
    await page.getByRole("button", { name: "Отправить ссылку для сброса" }).click();
    await page.waitForTimeout(500);

    await page.goto(await latestMailpitLink());
    await expect(page).toHaveURL(/\/reset-password\/confirm/);

    await page.getByPlaceholder("Новый пароль (мин. 6 символов)").fill(tempPassword);
    await page.getByPlaceholder("Повтори пароль").fill(tempPassword);
    await page.getByRole("button", { name: "Сохранить новый пароль" }).click();
    await page.waitForURL(/\/login$/, { timeout: 5000 });

    // Сессия восстановления пароля всё ещё активна на этот момент — /login
    // для уже залогиненного пользователя сразу редиректит на /home, поэтому
    // явно разлогиниваемся перед проверкой входа с новым паролем.
    await page.context().clearCookies();
    await page.goto("/login");
    await page.getByPlaceholder("Email").fill(TEST_EMAIL);
    await page.getByPlaceholder("Пароль").fill(tempPassword);
    await page.getByRole("button", { name: "Войти" }).click();
    await expect(page).toHaveURL(/\/home$/);
  } finally {
    await restoreTestPassword();
  }
});
