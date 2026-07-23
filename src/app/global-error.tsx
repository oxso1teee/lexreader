"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Ловит сбои в самом корневом layout.tsx — здесь нельзя переиспользовать
  // ни один из его компонентов (шрифты/провайдеры), поэтому html/body
  // задаются заново по правилам Next.js для global-error.tsx.
  console.error("[global-error]", error.message, error.digest);

  return (
    <html lang="ru">
      <body>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.75rem",
            minHeight: "100vh",
            padding: "2.5rem 1.5rem",
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <p style={{ fontSize: "2.5rem" }}>😕</p>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Приложение не смогло загрузиться</h1>
          <p style={{ fontSize: "0.875rem", color: "rgba(0,0,0,0.6)" }}>
            Произошла непредвиденная ошибка. Попробуй обновить страницу.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "0.5rem",
              minHeight: "2.75rem",
              padding: "0 1.25rem",
              borderRadius: "9999px",
              background: "#a67c52",
              color: "white",
              fontWeight: 500,
              border: "none",
            }}
          >
            Попробовать снова
          </button>
        </div>
      </body>
    </html>
  );
}
