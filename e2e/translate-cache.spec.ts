import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { completeOnboardingForTest, signUpFreshAccount } from "./helpers";

// TD-1 — переводчик в E2E подменён детерминированной заглушкой (E2E_TRANSLATE_STUB=1, см.
// src/lib/translate-stub.ts и .github/workflows/ci.yml), поэтому набор не зависит от MyMemory.
// Заглушка отвечает "[stub#N] <текст>", где N растёт на каждый РЕАЛЬНЫЙ вызов «провайдера».
// Значит, повторный ответ с тем же N — это попадание в кэш (translations_cache), а новый N — промах.
// Здесь проверяется боевой кэш и маршрут /api/translate целиком (БД, RLS, лимит запросов).
//
// Свой свежий аккаунт: лимит перевода (30/мин) считается по пользователю, и общий
// test@example.com не должен делить его с остальными спеками.

const QUOTA = "__stub_quota__";
const ERROR = "__stub_error__";

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
}

const unique = () => `td1${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

async function translate(page: Page, data: Record<string, unknown>) {
  const res = await page.request.post("/api/translate", { data });
  return { status: res.status(), body: (await res.json()) as Record<string, string | null> };
}

test.describe.configure({ mode: "serial" });

test.describe("translation provider stub and cache", () => {
  let userId: string | null = null;
  let page: Page;

  // Один свежий аккаунт на весь файл: регистрация дорогая и сама ограничена по частоте.
  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    const email = await signUpFreshAccount(page);
    await completeOnboardingForTest(email);
    const { data } = await serviceClient().auth.admin.listUsers({ page: 1, perPage: 1000 });
    userId = data.users.find((u) => u.email === email)?.id ?? null;
  });

  test.afterAll(async () => {
    if (userId) await serviceClient().auth.admin.deleteUser(userId);
    await page.close();
  });

  test("cache miss goes to the provider; the repeat is a cache hit with the identical answer", async () => {
    const word = unique();

    const miss = await translate(page, { word, sourceLang: "en", targetLang: "ru" });
    expect(miss.status).toBe(200);
    expect(miss.body.wordTranslation).toMatch(/^\[stub#\d+\] /);
    expect(miss.body.sentenceTranslation).toBeNull();

    // Попадание: если бы провайдер вызвали снова, номер N в ответе изменился бы.
    const hit = await translate(page, { word, sourceLang: "en", targetLang: "ru" });
    expect(hit.status).toBe(200);
    expect(hit.body.wordTranslation).toBe(miss.body.wordTranslation);

    // Другое слово — снова промах (новый номер вызова).
    const other = await translate(page, { word: unique(), sourceLang: "en", targetLang: "ru" });
    expect(other.body.wordTranslation).not.toBe(miss.body.wordTranslation);
  });

  test("the sentence is cached independently: a cached word plus a new sentence translates only the sentence", async () => {
    const word = unique();
    const sentence = `This sentence contains ${word}, and it is new.`;

    const first = await translate(page, { word, sourceLang: "en", targetLang: "ru" });
    const withSentence = await translate(page, { word, sentence, sourceLang: "en", targetLang: "ru" });
    expect(withSentence.status).toBe(200);
    expect(withSentence.body.wordTranslation).toBe(first.body.wordTranslation);
    expect(withSentence.body.sentenceTranslation).toMatch(/^\[stub#\d+\] This sentence contains /);

    const again = await translate(page, { word, sentence, sourceLang: "en", targetLang: "ru" });
    expect(again.body).toEqual(withSentence.body);
  });

  test("a single word is cached case-insensitively (R3 normalized key)", async () => {
    const base = unique();
    const capitalized = `${base.charAt(0).toUpperCase()}${base.slice(1)}`;

    const first = await translate(page, { word: capitalized, sourceLang: "en", targetLang: "ru" });
    const second = await translate(page, { word: base, sourceLang: "en", targetLang: "ru" });
    const third = await translate(page, { word: `  ${base.toUpperCase()} `, sourceLang: "en", targetLang: "ru" });

    expect(second.body.wordTranslation).toBe(first.body.wordTranslation);
    expect(third.body.wordTranslation).toBe(first.body.wordTranslation);
  });

  test("cached answers do not consume the translation rate limit (30/min)", async () => {
    const word = unique();
    const first = await translate(page, { word, sourceLang: "en", targetLang: "ru" });
    expect(first.status).toBe(200);

    // 45 повторов > лимита 30/мин: если бы попадания тратили лимит, дальше пошли бы 429.
    for (let i = 0; i < 45; i++) {
      const hit = await translate(page, { word, sourceLang: "en", targetLang: "ru" });
      expect(hit.status, `hit #${i + 1}`).toBe(200);
    }

    // И непосещённое слово по-прежнему переводится.
    const fresh = await translate(page, { word: unique(), sourceLang: "en", targetLang: "ru" });
    expect(fresh.status).toBe(200);
  });

  test("provider quota maps to 503 and provider failure to 502, and failures are never cached", async () => {
    const quota = await translate(page, { word: QUOTA, sourceLang: "en", targetLang: "ru" });
    expect(quota.status).toBe(503);
    expect(quota.body.error).toMatch(/квота|перегружен/i);

    const failure = await translate(page, { word: ERROR, sourceLang: "en", targetLang: "ru" });
    expect(failure.status).toBe(502);
    expect(failure.body.error).toBeTruthy();

    // Повтор снова идёт к провайдеру (ошибка не закэширована как перевод).
    const quotaAgain = await translate(page, { word: QUOTA, sourceLang: "en", targetLang: "ru" });
    expect(quotaAgain.status).toBe(503);

    // Сбой в предложении не портит перевод слова в кэше: слово остаётся переводимым.
    const word = unique();
    const partial = await translate(page, { word, sentence: `${ERROR} ${word}`, sourceLang: "en", targetLang: "ru" });
    expect(partial.status).toBe(502);
    const ok = await translate(page, { word, sourceLang: "en", targetLang: "ru" });
    expect(ok.status).toBe(200);
    expect(ok.body.wordTranslation).toMatch(/^\[stub#\d+\] /);
  });

  test("invalid input is rejected with 400 instead of reaching the provider", async () => {
    expect((await translate(page, { word: 123, sourceLang: "en", targetLang: "ru" })).status).toBe(400);
    expect((await translate(page, { word: "   ", sourceLang: "en", targetLang: "ru" })).status).toBe(400);
    expect((await translate(page, { word: "hello", sourceLang: "en" })).status).toBe(400);
    expect((await translate(page, { word: "hello", sentence: 42, sourceLang: "en", targetLang: "ru" })).status).toBe(400);
  });

  test("the endpoint requires a session", async ({ playwright, baseURL }) => {
    const anonymous = await playwright.request.newContext({ baseURL });
    const res = await anonymous.post("/api/translate", { data: { word: "hello", sourceLang: "en", targetLang: "ru" } });
    expect(res.status()).toBe(401);
    await anonymous.dispose();
  });
});
