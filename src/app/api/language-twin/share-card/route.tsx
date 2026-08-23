import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { growthStage, STAGE_GEOMETRY, MAX_VISIBLE_FLOWERS, flowerOffset } from "@/lib/language-twin/growth";
import type { ConfidenceLevel } from "@/lib/language-twin/types";

export const runtime = "nodejs";

// docs/release-2026-08-22/10_VAU_NOVYE_FICHI_I_DIZAYN.md раздел C, Тир 3 —
// та же самая техника, что уже есть в api/share-card/route.tsx (стрик +
// счётчик слов) и src/app/opengraph-image.tsx — next/og's ImageResponse,
// без единой новой зависимости. НЕ переиспользует TwinAvatar напрямую:
// Satori (движок ImageResponse) принимает только HTML/CSS (div+flexbox),
// не сырые SVG-элементы — geometry/цвета/пороги общие (growth.ts), рендер
// свой, div-based.
//
// Публичной ссылки/страницы нет осознанно — тот же паттерн, что и у
// существующей карточки прогресса: authenticated-only скачивание PNG,
// пользователь сам решает, куда его выложить (Stories и т.п.), без новой
// инфраструктуры публичных снапшотов/RLS.
const SCALE = 1.5; // viewBox дерева — 200×200, área в карточке — 300×300
const TREE_BOX = 300;
const TRUNK_COLOR = "#c79562";
const CANOPY_COLOR: Record<ConfidenceLevel, string> = {
  // Совпадает с --color-forest-text (dark) — тот же токен, что и у
  // TwinAvatar, просто ImageResponse не читает CSS-переменные из tokens.css
  // (рендерится вне DOM страницы), поэтому здесь raw-hex тех же значений.
  low: "#34d39973",
  medium: "#34d399b8",
  high: "#34d399",
};
const FLOWER_COLOR = "#fdba74";

export async function GET() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: twinProfile } = await supabase
    .from("language_twin_profiles")
    .select("behavioral_level_range, confidence, observed_receptive_vocabulary")
    .eq("user_id", profile.id)
    .maybeSingle();

  const { count: resolvedCount } = await supabase
    .from("language_error_patterns")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .eq("status", "resolved");

  const vocab = twinProfile?.observed_receptive_vocabulary ?? 0;
  const stage = growthStage(vocab);
  const confidence: ConfidenceLevel = twinProfile?.confidence ?? "low";
  const geo = STAGE_GEOMETRY[stage];
  const canopyColor = CANOPY_COLOR[confidence];
  const flowerCount = stage === 4 ? Math.min(resolvedCount ?? 0, MAX_VISIBLE_FLOWERS) : 0;
  const trunkTop = (170 - geo.trunkHeight) * SCALE;
  const trunkLeft = (100 - geo.trunkWidth / 2) * SCALE;

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
          background: "linear-gradient(135deg, #e4ede7, #cfe0d6)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 26, opacity: 0.7, letterSpacing: 4, textTransform: "uppercase", color: "#163a2c" }}>
          Мой английский · LexReader
        </div>

        <div style={{ display: "flex", position: "relative", width: TREE_BOX, height: TREE_BOX, marginTop: 30 }}>
          {/* Земля — те же координаты/масштаб, что и TwinAvatar. */}
          <div
            style={{
              display: "flex",
              position: "absolute",
              left: (100 - 34) * SCALE,
              top: (175 - 7) * SCALE,
              width: 68 * SCALE,
              height: 14 * SCALE,
              borderRadius: 999,
              background: "#cfe0d6",
            }}
          />

          {stage === 0 ? (
            <div
              style={{
                display: "flex",
                position: "absolute",
                left: (100 - 4) * SCALE,
                top: (171 - 4) * SCALE,
                width: 8 * SCALE,
                height: 8 * SCALE,
                borderRadius: "50%",
                background: canopyColor,
              }}
            />
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  position: "absolute",
                  left: trunkLeft,
                  top: trunkTop,
                  width: geo.trunkWidth * SCALE,
                  height: geo.trunkHeight * SCALE,
                  borderRadius: (geo.trunkWidth / 2) * SCALE,
                  background: TRUNK_COLOR,
                }}
              />
              {geo.leafClusters.map(({ cx, cy, r }, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    position: "absolute",
                    left: (cx - r) * SCALE,
                    top: (cy - r) * SCALE,
                    width: r * 2 * SCALE,
                    height: r * 2 * SCALE,
                    borderRadius: "50%",
                    background: canopyColor,
                  }}
                />
              ))}
              {Array.from({ length: flowerCount }, (_, i) => {
                const [dx, dy] = flowerOffset(i);
                const fcx = 100 + dx;
                const fcy = 90 + dy;
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      position: "absolute",
                      left: (fcx - 3) * SCALE,
                      top: (fcy - 3) * SCALE,
                      width: 6 * SCALE,
                      height: 6 * SCALE,
                      borderRadius: "50%",
                      background: FLOWER_COLOR,
                    }}
                  />
                );
              })}
            </>
          )}
        </div>

        <div style={{ display: "flex", fontSize: 44, fontWeight: 800, color: "#163a2c", marginTop: 20 }}>
          {twinProfile?.behavioral_level_range ?? "Собираем оценку"}
        </div>
        <div style={{ display: "flex", fontSize: 26, opacity: 0.75, color: "#163a2c", marginTop: 4 }}>
          {vocab}+ слов в пассивном словаре
        </div>
      </div>
    ),
    { width: 1080, height: 1080 },
  );
}
