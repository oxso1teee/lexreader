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
          background: "linear-gradient(135deg, #a67c52, #c99a68)",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 28, opacity: 0.85, letterSpacing: 4, textTransform: "uppercase" }}>
          LexReader
        </div>
        <div style={{ display: "flex", gap: 60, marginTop: 40 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontSize: 96, fontWeight: 800 }}>🔥 {profile.streak_current}</div>
            <div style={{ fontSize: 28, opacity: 0.85 }}>дней подряд</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontSize: 96, fontWeight: 800 }}>💯 {wordCount ?? 0}</div>
            <div style={{ fontSize: 28, opacity: 0.85 }}>слов выучено</div>
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1080 },
  );
}
