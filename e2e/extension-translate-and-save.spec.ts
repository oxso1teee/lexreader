import { createClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";
import { signUpFreshAccount, completeOnboardingForTest } from "./helpers";

// docs/release-2026-08-22/10_VAU_NOVYE_FICHI_I_DIZAYN.md раздел C, Тир 3 —
// "тап-перевод на любой странице" через браузерное расширение. Живой код
// (browser-extension/) на момент этого дока не содержал НИКАКОЙ
// функциональности тап-по-слову — только YouTube-транскрипт-мост,
// построено с нуля (решение пользователя). Расширение само (content
// script/manifest) — отдельный PR; здесь проверяется бэкенд, на который
// оно будет опираться: персональный API-токен + api/extension/translate-and-save.
//
// Fresh account (не test@example.com) — избегает пересечения с
// FREE_DAILY_WORD_LIMIT/дедупом, которые другие спеки уже накручивают на
// общий аккаунт (тот же приём, что и в account-delete-export.spec.ts).

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
}

test("api/extension/translate-and-save: full round trip — create token via /settings UI, tap-translate-save a real word, verify it lands tagged 'extension' with its context", async ({ page, request }) => {
  const email = await signUpFreshAccount(page);
  await completeOnboardingForTest(email);

  const supabase = serviceClient();
  const { data: userList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const userId = userList!.users.find((u) => u.email === email)!.id;

  await page.goto("/settings");
  // /settings ships a beforeInteractive theme-init <script> (src/app/theme-init-script.ts,
  // unrelated to this feature) that structurally delays hydration completion past
  // page.goto()'s resolution — interacting immediately has been observed racing it: Playwright's
  // .fill()/.click() land on the DOM before React's event listeners attach, so the click still
  // fires (native DOM click always does) but with the pre-hydration/default form state, silently
  // creating a token with the server's fallback label instead of the one just typed. Same
  // settle-wait pattern already used for a different race in auth.spec.ts.
  await page.waitForTimeout(500);
  const labelInput = page.getByPlaceholder("Название (необязательно)");
  await labelInput.fill("e2e-test-extension");
  await expect(labelInput).toHaveValue("e2e-test-extension");
  await page.getByRole("button", { name: "Создать токен" }).click();

  const tokenCode = page.locator("code");
  await expect(tokenCode).toBeVisible();
  const token = (await tokenCode.textContent())?.trim();
  expect(token).toMatch(/^lxr_ext_/);

  async function tokenRowExists(): Promise<boolean> {
    const { data } = await supabase.from("extension_api_tokens").select("id").eq("owner_id", userId);
    return (data?.length ?? 0) > 0;
  }

  try {
    await expect.poll(tokenRowExists).toBe(true);

    // 1. Плохой токен — 401, ничего не утекает не-владельцу.
    const badAuth = await request.post("/api/extension/translate-and-save", {
      headers: { Authorization: "Bearer lxr_ext_not_a_real_token" },
      data: { word: "hello", sourceLang: "en", targetLang: "ru" },
    });
    expect(badAuth.status()).toBe(401);

    // 2. Фраза (несколько слов) — вне охвата этой фичи (см. комментарий в
    // route.ts), явный 400, а не молчаливая порча данных.
    const phraseRes = await request.post("/api/extension/translate-and-save", {
      headers: { Authorization: `Bearer ${token}` },
      data: { word: "good morning", sourceLang: "en", targetLang: "ru" },
    });
    expect(phraseRes.status()).toBe(400);

    // 3. Настоящий тап по слову — тот же перевод-в-контексте и сохранение,
    // что уже даёт Reader (POST /api/translate + upsertWord), но через
    // Bearer-токен вместо cookie-сессии.
    const res = await request.post("/api/extension/translate-and-save", {
      headers: { Authorization: `Bearer ${token}` },
      data: { word: "ephemeral", sentence: "Beauty is often ephemeral.", sourceLang: "en", targetLang: "ru" },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    const body = await res.json();
    expect(body.wordTranslation).toBeTruthy();
    expect(body.sentenceTranslation).toBeTruthy();
    expect(body.flashcardId).toBeTruthy();

    // Раздел C, Тир 3 — сохранённое слово помечено как пришедшее из
    // расширения (не "manual"/"reader"), и его контекстное предложение
    // реально долетело до vocabulary_contexts (не только до
    // legacy-колонки flashcards.context_sentence) — оба грант-пробела
    // (language_twin_settings, vocabulary_contexts под service_role),
    // найденные вживую при первой проверке, закрыты
    // 0048_extension_api_tokens.sql.
    const { data: flashcard } = await supabase
      .from("flashcards")
      .select("id, front, back, source_type, language")
      .eq("id", body.flashcardId)
      .single();
    expect(flashcard?.source_type).toBe("extension");
    expect(flashcard?.front).toBe("ephemeral");
    expect(flashcard?.language).toBe("en");

    const { data: contexts } = await supabase
      .from("vocabulary_contexts")
      .select("context_text, source_type")
      .eq("flashcard_id", body.flashcardId);
    expect(contexts).toHaveLength(1);
    expect(contexts?.[0].source_type).toBe("extension");
    expect(contexts?.[0].context_text).toBe("Beauty is often ephemeral.");

    // 4. Отзыв токена на /settings — тот же токен больше не работает. Проверяется
    // напрямую в БД (expect.poll — revokeExtensionToken's DELETE is real work, not
    // instantaneous from the click), а не по исчезновению текста в DOM: тот же
    // beforeInteractive-скрипт выше время от времени задерживает перерисовку
    // настолько, что текст ещё виден на кадре, где delete уже совершился.
    await page.getByRole("button", { name: "Отозвать" }).click();
    await expect.poll(tokenRowExists).toBe(false);

    const afterRevoke = await request.post("/api/extension/translate-and-save", {
      headers: { Authorization: `Bearer ${token}` },
      data: { word: "test", sourceLang: "en", targetLang: "ru" },
    });
    expect(afterRevoke.status()).toBe(401);
  } finally {
    await supabase.auth.admin.deleteUser(userId);
  }
});
