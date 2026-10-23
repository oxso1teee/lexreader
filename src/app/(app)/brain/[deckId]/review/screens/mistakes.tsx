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
  progress = 0.85,
}: {
  words: readonly { front: string; back: string }[];
  /** Доля занятия до повтора ошибок — полоса сверху, как в макете. */
  progress?: number;
  onRetry: () => void;
  onSkip: () => void;
}) {
  return (
    <MomentScreen
      title="Повтор ошибок"
      onClose={onSkip}
      footer={
        <>
          <Button variant="sky" className="mo-cta" style={{ ["--btn-fill" as string]: "#0b79b0", ["--btn-edge" as string]: "#075a85", ["--btn-label" as string]: "#fff" }} onClick={onRetry}>
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
      <div style={{ padding: "16px 20px 0" }}>
        <div role="progressbar" aria-label="Прогресс занятия" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} style={{ height: 16, borderRadius: 99, background: "var(--surface-muted)", overflow: "hidden" }}>
          <div style={{ width: `${Math.round(progress * 100)}%`, height: "100%", borderRadius: 99, background: "var(--leaf)", boxShadow: "inset 0 -4px 0 0 var(--leaf-edge)" }} />
        </div>
      </div>
      <div style={{ textAlign: "center", padding: "40px 28px 0" }}>
        {/* Эталон: docs/moments/mockups/Mistakes.dc.html — кружок с маскотом,
            вращающиеся стрелки «повтора» и красный счётчик ошибок. */}
        <div className="mi-zoom" style={{ position: "relative", width: 176, height: 176, margin: "0 auto" }}>
          <svg className="mi-spin" viewBox="0 0 176 176" width="176" height="176" aria-hidden="true" style={{ position: "absolute", inset: 0 }}>
            <path d="M88 10a78 78 0 0 1 74 54" fill="none" stroke="var(--sky)" strokeWidth="7" strokeLinecap="round" />
            <path d="M150 52l13 13 6-18" fill="none" stroke="var(--sky)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M88 166a78 78 0 0 1-74-54" fill="none" stroke="var(--sky)" strokeWidth="7" strokeLinecap="round" />
            <path d="M26 124l-13-13-6 18" fill="none" stroke="var(--sky)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{ position: "absolute", inset: 22, borderRadius: 999, background: "var(--sky-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div className="mi-tilt">
              <svg viewBox="0 0 128 150" width="88" height="104" aria-hidden="true">
                <path d="M64 8C78 26 100 44 92 72C87 92 66 104 48 90C32 78 32 54 48 40C58 31 60 20 64 8Z" fill="var(--leaf)" />
                <path d="M60 46C70 58 76 68 68 82C63 90 50 90 44 81C39 73 43 61 51 53C55 50 57 48 60 46Z" fill="var(--leaf-tint)" opacity="0.9" />
                <path d="M49 56l8 2M71 56l-8 2" stroke="var(--leaf-edge)" strokeWidth="2.4" strokeLinecap="round" />
                <ellipse cx="54" cy="62" rx="3.4" ry="4.6" fill="var(--leaf-edge)" />
                <ellipse cx="66" cy="62" rx="3.4" ry="4.6" fill="var(--leaf-edge)" />
                <path d="M55 73q5 3 10 0" fill="none" stroke="var(--leaf-edge)" strokeWidth="2.4" strokeLinecap="round" />
                <ellipse cx="90" cy="100" rx="19" ry="12" fill="var(--ember)" transform="rotate(-28 90 100)" />
                <ellipse cx="94" cy="96" rx="8" ry="5" fill="var(--sun)" transform="rotate(-28 94 96)" opacity="0.85" />
              </svg>
            </div>
          </div>
          <span
            className="mo-disp mi-badge"
            style={{ position: "absolute", right: 6, top: 6, width: 44, height: 44, borderRadius: 999, background: "var(--danger)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, fontWeight: 900, border: "4px solid var(--background)" }}
          >
            {words.length}
          </span>
        </div>
        <h1 className="mo-disp mo-rise" style={{ margin: "26px 0 0", animationDelay: ".35s", fontSize: 26, lineHeight: 1.2, fontWeight: 900 }}>
          Вернёмся к ошибкам
        </h1>
        <p className="mo-muted mo-rise" style={{ margin: "10px 0 0", fontSize: 15, lineHeight: 1.45 }}>
          {wordsLabel(words.length)}, на которых ты споткнулся. Ещё одна попытка — и они станут твоими.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "22px 20px 0" }}>
        {words.map((w, i) => (
          <div key={`${w.front}:${i}`} className="mo-card mo-rise" style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, animationDelay: `${0.6 + i * 0.12}s` }}>
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
              <div style={{ font: "600 18px/1.2 var(--font-reading), Georgia, serif" }}>{w.front}</div>
              <div className="mo-muted" style={{ fontSize: 13, marginTop: 2 }}>{w.back}</div>
            </div>
          </div>
        ))}
      </div>
    </MomentScreen>
  );
}
