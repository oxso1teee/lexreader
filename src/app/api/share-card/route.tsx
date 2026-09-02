import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

export const runtime = "nodejs";

// Раздел 5 промта 2026-07-30 (рост): бесплатный органический канал —
// картинка со стриком/словами для сторис, без реальной интеграции с
// соцсетями, просто скачивание готового PNG.
export async function GET() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { count: wordCount } = await supabase
    .from("vocabulary_items")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", profile.id)
    .eq("language", profile.target_language);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          // docs/release-2026-08-26/12_VIZUALNAYA_IDENTICHNOST_RESHENIE_2026-08-26.md
          // — единственный акцент. Был старый caramel-градиент (#a67c52,
          // #c99a68) — next/og's ImageResponse (Satori) рендерится вне DOM
          // страницы, не читает Tailwind-классы/CSS-переменные, поэтому
          // миграция caramel→forest (PR #49, искала bg-caramel и т.п. по
          // TSX) физически не могла это поймать. Raw hex тех же значений,
          // что --color-forest/--color-forest-light в tokens.css — тот же
          // паттерн, что уже правильно сделан в api/language-twin/share-card
          // (см. его CANOPY_COLOR-комментарий).
          background: "linear-gradient(135deg, #1f4d3b, #2f6b52)",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 28, opacity: 0.85, letterSpacing: 4, textTransform: "uppercase" }}>
          LexReader
        </div>
        <div style={{ display: "flex", gap: 60, marginTop: 40 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            {/* Found live-testing this exact route while fixing its colors
                (никогда не было e2e-покрыто — просто "скачай PNG", без UI-
                assertion): Satori (движок next/og's ImageResponse) требует
                явный display:flex/contents/none у любого <div> с больше чем
                одним child-узлом — здесь их два ("🔥 " текстовый литерал +
                выражение {'{'}profile.streak_current{'}'}), без явного
                display этот div падал с 500 на каждый реальный запрос.
                Настоящий, пред-существующий баг, не связанный с цветом. */}
            <div style={{ display: "flex", fontSize: 96, fontWeight: 800 }}>🔥 {profile.streak_current}</div>
            <div style={{ fontSize: 28, opacity: 0.85 }}>дней подряд</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ display: "flex", fontSize: 96, fontWeight: 800 }}>💯 {wordCount ?? 0}</div>
            <div style={{ fontSize: 28, opacity: 0.85 }}>слов выучено</div>
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1080 },
  );
}
