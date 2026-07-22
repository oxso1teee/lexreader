import { createServiceClient } from "@/lib/supabase/service";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60_000;

// P0-AUTH-04: троттлинг попыток входа — по email и по IP отдельно, любой из
// двух лимитов может заблокировать попытку. Не раскрывает, какой из них
// сработал (одинаковое сообщение) — иначе это тоже канал для user enumeration.
export async function isAuthAttemptAllowed(identifiers: string[]): Promise<boolean> {
  const supabase = createServiceClient();
  const windowStart = new Date(Date.now() - WINDOW_MS).toISOString();

  for (const raw of identifiers) {
    const key = raw.trim().toLowerCase();
    if (!key) continue;

    const { count } = await supabase
      .from("auth_attempts")
      .select("id", { count: "exact", head: true })
      .eq("identifier", key)
      .gte("attempted_at", windowStart);

    if ((count ?? 0) >= MAX_ATTEMPTS) return false;
  }

  return true;
}

export async function logAuthAttempt(identifiers: string[]): Promise<void> {
  const supabase = createServiceClient();
  const rows = identifiers
    .map((raw) => raw.trim().toLowerCase())
    .filter(Boolean)
    .map((identifier) => ({ identifier }));
  if (rows.length > 0) {
    await supabase.from("auth_attempts").insert(rows);
  }

  if (Math.random() < 0.02) {
    const cutoff = new Date(Date.now() - 24 * 3_600_000).toISOString();
    await supabase.from("auth_attempts").delete().lt("attempted_at", cutoff);
  }
}
