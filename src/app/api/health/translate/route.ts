import { NextResponse } from "next/server";
import { translateText } from "@/lib/translate";

// P0-OBS-02: health-check AI-провайдера перевода — дёргать внешним
// uptime-монитором (см. docs/OBSERVABILITY.md) отдельно от обычного трафика
// пользователей, чтобы узнавать о простое MyMemory раньше жалоб.
//
// P0-АУДИТ 3.5: раньше был полностью открыт без авторизации и без лимита —
// любой мог дёргать его в цикле и незаметно жрать общую дневную квоту
// MyMemory, от которой зависит перевод для всех пользователей. Теперь
// требует тот же секрет, что и cron (см. HEALTH_CHECK_SECRET в Vercel env) —
// уптайм-монитор передаёт его как Authorization: Bearer <секрет>.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.HEALTH_CHECK_SECRET || authHeader !== `Bearer ${process.env.HEALTH_CHECK_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  try {
    const result = await translateText("hello", "en", "es");
    return NextResponse.json({
      ok: true,
      latencyMs: Date.now() - startedAt,
      sample: result,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        latencyMs: Date.now() - startedAt,
        error: e instanceof Error ? e.message : "unknown error",
      },
      { status: 503 },
    );
  }
}
