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

// M3 Slice 4: practice-brain-a11y.spec.ts стартует настоящую сессию
// повторения на test@example.com — каждый прогон (или ручная проверка тем же
// аккаунтом) переносит due_at "birds" в будущее, и следующий прогон находит
// пустую очередь. reader-library-a11y.spec.ts полагается на тот же
// сидированный флеш-карт как "always due" — без явного сброса здесь оба
// набора рано или поздно начинают молча ловить пустое состояние вместо
// экрана повторения.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureDueCard(supabase: any, userId: string) {
  const { data: card } = await supabase
    .from("flashcards")
    .select("id")
    .eq("owner_id", userId)
    .eq("front", "birds")
    .maybeSingle();
  if (!card) return;
  await supabase
    .from("srs_state")
    .update({ due_at: new Date(Date.now() - 60 * 60 * 1000).toISOString() })
    .eq("flashcard_id", card.id);
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

  // Несколько спек-файлов создают свою тестовую колоду на каждый прогон
  // (brain-notebook.spec.ts, unified-shell-today.spec.ts,
  // unified-shell-progress-settings.spec.ts, brain-undo-rename.spec.ts) —
  // без очистки они копятся и рано или поздно упираются в FREE_DECK_LIMIT=3
  // (P0-6.3), заставляя ЛЮБОЙ следующий тест, создающий колоду, попасть на
  // paywall-ветку вместо формы создания. Четыре отдельных .like() вместо
  // одного .or() — синтаксис wildcard внутри сырых .or()-фильтров PostgREST
  // (`*`) отличается от .like() (`%`), не стоит рисковать тихо не находящим
  // совпадений фильтром.
  for (const pattern of ["E2E Deck %", "Today CTA %", "Progress insight %", "E2E Rename %"]) {
    await supabase.from("decks").delete().like("name", pattern);
  }

  const { data: users } = await supabase.auth.admin.listUsers();
  const userId = users?.users.find((u: { email?: string }) => u.email === TEST_EMAIL)?.id;
  if (userId) await ensureDueCard(supabase, userId);
}
