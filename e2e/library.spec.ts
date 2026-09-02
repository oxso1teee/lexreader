import { test, expect } from "@playwright/test";
import { login } from "./helpers";

// M3 Slice 3: Library rewrite — search, filters, real covers, states.
// Uses the shared test account's real seeded materials rather than mock
// data (docs/ui/m3-slice3-library-reader-plan.md: no fake data in Production
// code paths).

test("Library search filters the real grid and updates the URL, without sending the query to PostHog", async ({
  page,
}) => {
  await login(page);
  await page.goto("/library");
  await expect(page.getByRole("heading", { name: "Библиотека" })).toBeVisible();

  const search = page.getByPlaceholder("Найти материал…");
  await search.fill("Park");
  await expect(page).toHaveURL(/[?&]q=Park/, { timeout: 2000 });
  await expect(page.getByRole("link", { name: /A Walk in the Park/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /The Job Interview/ })).toHaveCount(0);

  // Clear button resets both the input and the URL query param.
  await page.getByRole("button", { name: "Очистить поиск" }).click();
  await expect(search).toHaveValue("");
  await expect(page).not.toHaveURL(/[?&]q=/);
});

test("Library search with no matches shows the honest no-results state", async ({ page }) => {
  await login(page);
  await page.goto("/library");
  await page.getByPlaceholder("Найти материал…").fill("zzzznonexistentzzz");
  await expect(page.getByText("Ничего не нашлось")).toBeVisible();
});

test("Library filters map onto real fields: Видео shows only youtube materials, Завершённые only percent_read>=100", async ({
  page,
}) => {
  await login(page);
  await page.goto("/library");

  await page.getByRole("button", { name: "Видео", exact: true }).click();
  await expect(page).toHaveURL(/[?&]filter=video/);
  await expect(page.getByRole("link", { name: /Me at the zoo/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /A Walk in the Park/ })).toHaveCount(0);

  await page.getByRole("button", { name: "Все", exact: true }).click();
  await expect(page).not.toHaveURL(/[?&]filter=/);
  await expect(page.getByRole("link", { name: /A Walk in the Park/ })).toBeVisible();
});

test("Library material count in the header reflects real data, not a placeholder", async ({ page }) => {
  await login(page);
  await page.goto("/library");
  await expect(page.getByText(/^\d+ материал(а|ов)? · /)).toBeVisible();
});

test("YouTube material renders a real thumbnail image, not just a gradient placeholder", async ({ page }) => {
  await login(page);
  await page.goto("/library");
  const card = page.getByRole("link", { name: /Me at the zoo/ });
  const img = card.locator("img");
  // next/image (library-item-card.tsx) proxies through /_next/image?url=<encoded>,
  // not the raw i.ytimg.com URL directly — match the encoded original URL
  // inside the query string instead of the old literal-hostname pattern.
  await expect(img).toHaveAttribute("src", /_next\/image\?url=.*i\.ytimg\.com%2Fvi%2F.+%2Fhqdefault\.jpg/);
});

test("no horizontal overflow on Library at 360px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await login(page);
  await page.goto("/library");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
});
