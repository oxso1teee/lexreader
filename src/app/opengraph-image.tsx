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
          // Тот же старый caramel-градиент, пропущенный по той же причине,
          // что и api/share-card/route.tsx (см. комментарий там) —
          // ImageResponse/Satori не видит Tailwind/CSS-переменные. Эта
          // картинка — то, что видно в превью при шаринге ссылки на сайт
          // в мессенджерах/соцсетях, самый заметный из трёх touchpoint'ов.
          background: "linear-gradient(135deg, #1f4d3b, #2f6b52)",
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
