// CSP connect-src для Supabase Realtime (дуэли, duel-room.tsx). supabase-js
// открывает WebSocket на тот же хост, что и REST, но со сменой схемы —
// ровно `protocol.replace("http", "ws")` (node_modules/@supabase/supabase-js,
// конструктор SupabaseClient, realtimeUrl): https → wss в проде, http → ws
// для локального стека. CSP-источник `https://host` НЕ разрешает
// `wss://host`, поэтому без отдельной записи production-сокет блокируется и
// дуэль живёт только на 3-секундном fallback-поллинге. Здесь та же замена,
// что делает SDK, — только этот один хост, никаких голых `ws:`/`wss:`.
export function getSupabaseRealtimeCspOrigin(supabaseUrl: string | undefined): string {
  const url = (supabaseUrl ?? "").trim().replace(/\/$/, "");
  if (!/^https?:\/\//i.test(url)) return "";
  return url.replace(/^http/i, "ws");
}
