import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

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

// Тесты в этом наборе логинятся много раз подряд (несколько spec-файлов,
// один процесс) — без сброса это само упирается в наш же rate-limit на
// вход (P0-AUTH-04), который иначе рассчитан на реальных пользователей за
// 15 минут, а не на прогон тестов за пару минут.
export default async function globalSetup() {
  loadEnvLocal();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  );
  await supabase.from("auth_attempts").delete().gte("id", 0);

  // brain-notebook.spec.ts создаёт новую тестовую колоду в каждом прогоне —
  // без очистки они копятся и упираются в FREE_DECK_LIMIT (P0-6.3).
  await supabase.from("decks").delete().like("name", "E2E Deck %");
}
