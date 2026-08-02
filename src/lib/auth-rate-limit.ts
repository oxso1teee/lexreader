import { createServiceClient } from "@/lib/supabase/service";
import { type AuthAction, authAttemptKey, authRateLimitConfig } from "@/lib/auth-rate-limit-config";

export type { AuthAction };
export { authAttemptKey, authRateLimitConfig };

export interface AuthAttemptCheck {
  allowed: boolean;
  retryAfterSeconds?: number;
}

// P0-AUTH-04: троттлинг попыток — по email и по IP отдельно (в своём бакете
// на action), любой из двух лимитов может заблокировать попытку. Не
// раскрывает, какой из них сработал (одинаковое сообщение) — иначе это тоже
// канал для user enumeration.
export async function isAuthAttemptAllowed(action: AuthAction, identifiers: string[]): Promise<AuthAttemptCheck> {
  const supabase = createServiceClient();
  const { maxAttempts: limit, windowMs: window } = authRateLimitConfig();
  const windowStart = new Date(Date.now() - window).toISOString();

  for (const raw of identifiers) {
    const key = authAttemptKey(action, raw);
    if (!key) continue;

    const { count } = await supabase
      .from("auth_attempts")
      .select("id", { count: "exact", head: true })
      .eq("identifier", key)
      .gte("attempted_at", windowStart);

    if ((count ?? 0) >= limit) {
      // В обычной работе счётчик не растёт после блокировки (logAuthAttempt
      // для этого action больше не вызывается), так что самая старая запись
      // в окне — она же и определяет, когда лимит освободится.
      const { data: oldest } = await supabase
        .from("auth_attempts")
        .select("attempted_at")
        .eq("identifier", key)
        .gte("attempted_at", windowStart)
        .order("attempted_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      const oldestMs = oldest ? new Date(oldest.attempted_at).getTime() : Date.now();
      const retryAfterSeconds = Math.max(1, Math.ceil((oldestMs + window - Date.now()) / 1000));
      return { allowed: false, retryAfterSeconds };
    }
  }

  return { allowed: true };
}

export async function logAuthAttempt(action: AuthAction, identifiers: string[]): Promise<void> {
  const supabase = createServiceClient();
  const rows = identifiers
    .map((raw) => authAttemptKey(action, raw))
    .filter((key): key is string => key !== null)
    .map((identifier) => ({ identifier }));
  if (rows.length > 0) {
    await supabase.from("auth_attempts").insert(rows);
  }

  if (Math.random() < 0.02) {
    const cutoff = new Date(Date.now() - 24 * 3_600_000).toISOString();
    await supabase.from("auth_attempts").delete().lt("attempted_at", cutoff);
  }
}
