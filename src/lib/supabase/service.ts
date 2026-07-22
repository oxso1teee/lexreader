import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Обходит RLS — только для серверных операций без сессии пользователя
// (например, cron-джобы, которым нужно видеть данные всех пользователей).
// Никогда не использовать в коде, доступном клиенту.
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
