import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test("reading flow: open text, tap word, translate, change level, finish", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/home$/);

  await page.goto("/library");
  // Раздел 5 промта 2026-07-30 (композиция): Библиотека теперь одна полка
  // с вкладками "Мои"/"Каталог" — системные тексты видны только во вкладке
  // "Каталог" (по умолчанию открыта, только если у аккаунта ещё нет своих
  // текстов; у переиспользуемого e2e-аккаунта они могут уже быть).
  await page.getByRole("button", { name: "Каталог" }).click();
  await page.getByText("A Walk in the Park").click();
  await expect(page).toHaveURL(/\/read\//);

  // Тап по слову — попап с переводом
  await page.getByRole("button", { name: "birds", exact: true }).click();
  await expect(page.getByText("Уровень знания")).toBeVisible({ timeout: 10_000 });

  // Меняем уровень знания слова на 4 ("Овладел")
  await page.locator("button", { hasText: /^4$/ }).click();

  // Закрываем попап (не путать с кнопкой "Завершить чтение" в шапке — у
  // обеих раньше был одинаковый aria-label "Закрыть", из-за чего .first()
  // мог кликнуть не туда).
  await page.getByRole("button", { name: "Закрыть" }).click();

  // Долистываем до конца и завершаем чтение (не путать с кнопкой
  // "Завершить чтение" в шапке — это тот же экшен, но другая кнопка).
  const finishButton = page.getByRole("button", { name: "Завершить ✓" });
  await expect(finishButton).toBeVisible();
  await finishButton.click();
  await expect(page).toHaveURL(/\/library$/);
});
