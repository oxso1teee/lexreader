import { test, expect } from "@playwright/test";
import { login, clickAndWaitForNav } from "./helpers";

test("reading flow: open text, tap word, translate, change level, finish", async ({ page }) => {
  // Root-caused via temporary CI diagnostics: the Library grid's material
  // links had no prefetch={false}, so Next.js's default Link prefetching
  // fired the FULL dynamic /read|/watch/[id] route (every DB query the
  // Reader page makes — /read/[textId] has no loading.js boundary) for
  // every card the moment the page mounted. On a real user's browser that's
  // just wasteful; on CI's shared 2-vCPU runner, also running the full local
  // Supabase stack (Postgres/GoTrue/Kong/Realtime/PostgREST/Storage)
  // concurrently, the resulting burst of a dozen+ simultaneous heavy
  // prefetch requests was severe enough to starve the actual click-triggered
  // navigation. Fixed at the source in library-item-card.tsx
  // (prefetch={false}); this generous timeout stays as a safety margin for
  // CI's genuinely more constrained CPU/DB throughput vs a real deployment.
  test.setTimeout(60_000);

  await login(page);
  await expect(page).toHaveURL(/\/home$/);

  await page.goto("/library");
  // M3 Slice 3: Library больше не разделена на вкладки "Мои"/"Каталог" —
  // один общий грид (собственные + системные тексты по языку), поэтому
  // не нужно переключать вкладку перед тем, как найти системный текст.
  //
  // The prefetch fix above didn't fully close this out — this specific
  // click→navigate still occasionally times out on CI's shared runner even
  // with prefetch off (never locally, never on any other test's Library
  // click). Confirmed via CI logs it's NOT MyMemory/translate: the
  // navigation itself times out before any translate call happens (that's
  // a separate, later step below, with its own generous timeout) — /read/
  // does zero external calls on load, only Supabase reads. Genuine
  // CPU/DB-contention flake, not a logic bug — retries the actual flaky
  // step (click-and-wait-for-nav) with a bounded budget instead of relying
  // on external CI-level job reruns to paper over it.
  await clickAndWaitForNav(page, page.getByRole("link", { name: /A Walk in the Park/ }), /\/read\//, {
    attempts: 3,
    perAttemptTimeoutMs: 12_000,
  });

  // Тап по слову — попап с переводом. M3 Slice 3: контекстная панель
  // рендерится ДВАЖДЫ в DOM — один раз в десктопном <aside>, один раз в
  // мобильном bottom sheet (тот же ReaderWordPanel, скрыт через lg:hidden
  // на десктопном вьюпорте). Реальным пользователям и скринридерам это не
  // видно (display:none убирает элемент из a11y-дерева и таб-порядка), но
  // Playwright's getByText/getByRole матчат оба DOM-узла независимо от
  // видимости — поэтому здесь и ниже скоупим локаторы на <aside>, как это
  // реально видит десктопный пользователь (дефолтный вьюпорт теста).
  // /api/translate calls MyMemory (free third-party API) — CI's shared
  // egress IP can see slower/rate-limited responses than a residential IP,
  // so this needs more headroom than the in-app assertions above.
  const panel = page.locator("aside");
  await page.getByRole("button", { name: "birds", exact: true }).click();
  await expect(panel.getByText("Уровень знания")).toBeVisible({ timeout: 20_000 });

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
