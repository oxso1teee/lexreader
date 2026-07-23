import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const TEST_EMAIL = "test@example.com";
const TEST_PASSWORD = "newtestpass456";

function loadEnvLocal() {
  const envPath = path.resolve(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2];
    }
  }
}

// P0-АУДИТ 3.22: делает набор самодостаточным для CI — на свежей базе
// (после supabase start + миграций + seed) тестового пользователя ещё нет.
// Раньше он создавался вручную один раз, и весь набор молча зависел от
// этого локального состояния.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureTestUser(supabase: any) {
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  });

  let userId = created?.user?.id;
  if (createError) {
    // Уже существует (обычный случай при повторных локальных прогонах) —
    // находим существующего пользователя вместо падения.
    const { data: list } = await supabase.auth.admin.listUsers();
    userId = list?.users.find((u: { email?: string }) => u.email === TEST_EMAIL)?.id;
  }
  if (!userId) return;

  await supabase.from("profiles").upsert({
    id: userId,
    target_language: "en",
    native_language: "ru",
    level: "intermediate",
    daily_word_goal: 10,
  });

  const { data: existingDeck } = await supabase
    .from("decks")
    .select("id")
    .eq("owner_id", userId)
    .eq("is_default", true)
    .maybeSingle();
  if (!existingDeck) {
    await supabase.from("decks").insert({ owner_id: userId, name: "Основная колода", is_default: true });
  }
}

// Тесты в этом наборе логинятся много раз подряд (несколько spec-файлов,
// один процесс) — без сброса это само упирается в наш же rate-limit на
// вход (P0-AUTH-04), который иначе рассчитан на реальных пользователей за
// 15 минут, а не на прогон тестов за пару минут.
export default async function globalSetup() {
  loadEnvLocal();
  const supabase: ReturnType<typeof createClient> = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  );
  await ensureTestUser(supabase);
  await supabase.from("auth_attempts").delete().gte("id", 0);

  // brain-notebook.spec.ts создаёт новую тестовую колоду в каждом прогоне —
  // без очистки они копятся и упираются в FREE_DECK_LIMIT (P0-6.3).
  await supabase.from("decks").delete().like("name", "E2E Deck %");
}
