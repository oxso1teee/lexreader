import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test("reading flow: open text, tap word, translate, change level, finish", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/home$/);

  await page.goto("/library");
  // M3 Slice 3: Library больше не разделена на вкладки "Мои"/"Каталог" —
  // один общий грид (собственные + системные тексты по языку), поэтому
  // не нужно переключать вкладку перед тем, как найти системный текст.
  await page.getByRole("link", { name: /A Walk in the Park/ }).click();
  // Более длинный таймаут: в dev-режиме (Turbopack) первая клиентская
  // навигация на /read/[textId] после его изменения требует холодной
  // компиляции + двойного React StrictMode-эффекта (сохранение прогресса),
  // из-за чего переход иногда занимает больше стандартных 5с. В проде
  // (сборка в CI) страница уже скомпилирована и StrictMode выключен —
  // там такой задержки нет, это чисто dev-артефакт, подтверждено вручную.
  await expect(page).toHaveURL(/\/read\//, { timeout: 15_000 });

  // Тап по слову — попап с переводом. M3 Slice 3: контекстная панель
  // рендерится ДВАЖДЫ в DOM — один раз в десктопном <aside>, один раз в
  // мобильном bottom sheet (тот же ReaderWordPanel, скрыт через lg:hidden
  // на десктопном вьюпорте). Реальным пользователям и скринридерам это не
  // видно (display:none убирает элемент из a11y-дерева и таб-порядка), но
  // Playwright's getByText/getByRole матчат оба DOM-узла независимо от
  // видимости — поэтому здесь и ниже скоупим локаторы на <aside>, как это
  // реально видит десктопный пользователь (дефолтный вьюпорт теста).
  const panel = page.locator("aside");
  await page.getByRole("button", { name: "birds", exact: true }).click();
  await expect(panel.getByText("Уровень знания")).toBeVisible({ timeout: 10_000 });

  // Меняем уровень знания слова на 4 ("Овладел")
  await panel.locator("button", { hasText: /^4$/ }).click();

  // Закрываем попап (не путать с кнопкой "Завершить чтение" в шапке — у
  // обеих раньше был одинаковый aria-label "Закрыть", из-за чего .first()
  // мог кликнуть не туда).
  await panel.getByRole("button", { name: "Закрыть" }).click();

  // Долистываем до конца и завершаем чтение (не путать с кнопкой
  // "Завершить чтение" в шапке — это тот же экшен, но другая кнопка).
  const finishButton = page.getByRole("button", { name: "Завершить ✓" });
  await expect(finishButton).toBeVisible();
  await finishButton.click();
  await expect(page).toHaveURL(/\/library$/);
});
