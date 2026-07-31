import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Раздел 5 промта 2026-07-30 (полировка): раньше ссылка при шаринге в
// мессенджерах/соцсетях показывала стандартную заглушку Next.js.
export default function Image() {
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
        <div style={{ fontSize: 64, fontWeight: 800 }}>📖 LexReader</div>
        <div style={{ fontSize: 32, marginTop: 20, opacity: 0.9 }}>
          Учи язык через чтение реальных текстов
        </div>
      </div>
    ),
    size,
  );
}
