import { NextResponse } from "next/server";
import { translateText } from "@/lib/translate";

// P0-OBS-02: health-check AI-провайдера перевода — дёргать внешним
// uptime-монитором (см. docs/OBSERVABILITY.md) отдельно от обычного трафика
// пользователей, чтобы узнавать о простое MyMemory раньше жалоб.
export async function GET() {
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
