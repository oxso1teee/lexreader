"use client";

import { Button } from "@/components/ui/button";
import { MomentScreen } from "@/components/product/moments/moment-screen";

// docs/moments/mockups/Mistakes.dc.html, reference/Mistakes.png. Отличие от
// макета: под каждым словом в макете есть придуманная причина ("перепутал
// с «рад»" / "ошибка в написании") — у cards-режима нет такого факта
// (пользователь сам жмёт "Не помню"/"Трудно", никакого конкретного неверного
// варианта не существует), поэтому подпись заменена на честный перевод
// слова вместо выдуманной причины промаха. MomentScreen: Esc = "Пропустить"
// (не "Исправить" — закрытие не должно само по себе брать на себя
// обязательство второго прохода).
// Тот же 3-формный русский plural, что у wordCountLabel в session-
// complete.tsx — бинарный "N===1 ? X : Y" (как было здесь раньше) даёт
// неверную форму при N>=5 ("5 слова" вместо "5 слов").
function wordsLabel(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "Одно слово";
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return `${n} слова`;
  return `${n} слов`;
}

function tasksLabel(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} задание`;
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return `${n} задания`;
  return `${n} заданий`;
}

export function MistakesScreen({
  words,
  onRetry,
  onSkip,
}: {
  words: readonly { front: string; back: string }[];
  onRetry: () => void;
  onSkip: () => void;
}) {
  return (
    <MomentScreen
      title="Повтор ошибок"
      onClose={onSkip}
      footer={
        <>
          <Button variant="sky" className="mo-cta" onClick={onRetry}>
            Исправить · {tasksLabel(words.length)}
          </Button>
          <button
            type="button"
            onClick={onSkip}
            style={{ display: "block", width: "100%", textAlign: "center", font: "600 15px/1 var(--font-onest), sans-serif", color: "var(--text-secondary)", padding: "16px 0 0", textDecoration: "underline", background: "none", border: 0 }}
          >
            Пропустить
          </button>
        </>
      }
    >
      <div style={{ textAlign: "center", padding: "56px 28px 0" }}>
        <div
          style={{
            position: "relative",
            width: 140,
            height: 140,
            margin: "0 auto",
            borderRadius: 999,
            background: "var(--sky-tint)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg viewBox="0 0 128 150" width="76" height="90" aria-hidden="true">
            <path d="M64 8C78 26 100 44 92 72C87 92 66 104 48 90C32 78 32 54 48 40C58 31 60 20 64 8Z" fill="var(--leaf)" />
            <path d="M60 46C70 58 76 68 68 82C63 90 50 90 44 81C39 73 43 61 51 53C55 50 57 48 60 46Z" fill="var(--leaf-tint)" opacity="0.9" />
          </svg>
          <span
            className="mo-disp"
            style={{
              position: "absolute",
              right: 2,
              top: 2,
              width: 40,
              height: 40,
              borderRadius: 999,
              background: "var(--color-danger)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 17,
              fontWeight: 900,
              border: "4px solid var(--background)",
            }}
          >
            {words.length}
          </span>
        </div>
        <h1 className="mo-disp mo-rise" style={{ margin: "22px 0 0", fontSize: 24, lineHeight: 1.2, fontWeight: 900 }}>
          Вернёмся к ошибкам
        </h1>
        <p className="mo-muted mo-rise" style={{ margin: "10px 0 0", fontSize: 15, lineHeight: 1.45 }}>
          {wordsLabel(words.length)}, на которых ты споткнулся. Ещё одна попытка — и они станут твоими.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "22px 20px 0" }}>
        {words.map((w, i) => (
          <div key={`${w.front}:${i}`} className="mo-card mo-rise" style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "var(--danger-tint)",
                color: "var(--color-danger-text)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "none",
              }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M3 12a9 9 0 1 0 3-6.7L3 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3 3v5h5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 600 }}>{w.front}</div>
              <div className="mo-muted" style={{ fontSize: 13, marginTop: 2 }}>{w.back}</div>
            </div>
          </div>
        ))}
      </div>
    </MomentScreen>
  );
}
