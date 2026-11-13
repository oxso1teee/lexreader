"use client";

import Link from "next/link";

// Эталон: docs/moments/mockups/Splash.dc.html. Не момент (MomentScreen) —
// обычный первый шаг онбординга (src/app/onboarding/onboarding-wizard.tsx,
// step 0), поэтому свой .onb-screen (reduced-motion scope, см.
// moments.css) вместо .mo-screen.
const MASCOT = (
  <svg viewBox="0 0 128 150" width="160" height="188" aria-hidden="true">
    <ellipse cx="64" cy="128" rx="34" ry="9" fill="rgba(0,0,0,0.18)" />
    <path d="M64 8C78 26 100 44 92 72C87 92 66 104 48 90C32 78 32 54 48 40C58 31 60 20 64 8Z" fill="var(--leaf-tint-strong)" />
    <path
      d="M60 46C70 58 76 68 68 82C63 90 50 90 44 81C39 73 43 61 51 53C55 50 57 48 60 46Z"
      fill="#fff"
      opacity="0.95"
    />
    <ellipse className="onb-blink" cx="54" cy="62" rx="3.4" ry="4.6" fill="var(--leaf-deep)" />
    <ellipse className="onb-blink" cx="66" cy="62" rx="3.4" ry="4.6" fill="var(--leaf-deep)" />
    <path d="M54 72q6 5 12 0" fill="none" stroke="var(--leaf-deep)" strokeWidth={2.4} strokeLinecap="round" />
    <ellipse cx="90" cy="100" rx="19" ry="12" fill="var(--ember)" transform="rotate(-28 90 100)" />
    <ellipse cx="94" cy="96" rx="8" ry="5" fill="var(--sun)" transform="rotate(-28 94 96)" />
  </svg>
);

const WORDS: { t: string; l: string; x: number; y: number }[] = [
  { t: "reading", l: "EN", x: -150, y: -120 },
  { t: "lesen", l: "DE", x: 70, y: -135 },
  { t: "leer", l: "ES", x: -165, y: -20 },
  { t: "leggere", l: "IT", x: 72, y: -45 },
  { t: "читать", l: "RU", x: -180, y: 70 },
  { t: "lire", l: "FR", x: 108, y: 75 },
];

const TITLE = "LexReader";

export function SplashScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="onb-screen relative flex min-h-screen flex-col overflow-hidden bg-forest text-white">
      <div
        aria-hidden="true"
        className="absolute rounded-full opacity-35"
        style={{ width: 560, height: 560, background: "var(--leaf-edge)", left: -280, bottom: -230 }}
      />
      <div
        aria-hidden="true"
        className="absolute rounded-full opacity-30"
        style={{ width: 320, height: 320, background: "var(--leaf-edge)", right: -160, top: -100 }}
      />

      <div className="relative mx-auto mt-16 h-[260px] w-full max-w-sm flex-none">
        {WORDS.map((w, i) => (
          <span
            key={w.t}
            className="onb-orbit-word rounded-xl border-2 px-3 py-1.5 font-semibold"
            style={
              {
                fontFamily: "var(--font-reading, Georgia, serif)",
                fontSize: 15,
                background: "rgba(255,255,255,.14)",
                borderColor: "rgba(255,255,255,.22)",
                "--x0": "-50%",
                "--y0": "40px",
                "--x1": `${w.x}px`,
                "--y1": `${w.y}px`,
                "--d": `${(1.05 + i * 0.09).toFixed(2)}s`,
                "--d2": `${(1.85 + i * 0.09).toFixed(2)}s`,
              } as React.CSSProperties
            }
          >
            {w.t}
            <b className="ml-1.5 text-[11px] font-bold uppercase tracking-wide opacity-70">{w.l}</b>
          </span>
        ))}
        <div className="absolute bottom-0 left-0 right-0 flex justify-center">
          <span className="onb-rip" aria-hidden="true" />
          <div className="onb-drop">{MASCOT}</div>
        </div>
      </div>

      <div className="relative mt-6 flex-1 text-center">
        <h1
          className="text-[40px] font-black tracking-tight"
          style={{ fontFamily: "var(--font-reading, Georgia, serif)" }}
          aria-label={TITLE}
        >
          {TITLE.split("").map((ch, i) => (
            <span
              key={i}
              className="onb-letter"
              aria-hidden="true"
              style={{ "--d": `${(0.95 + i * 0.05).toFixed(2)}s`, color: i >= 3 ? "var(--sun-tint)" : undefined } as React.CSSProperties}
            >
              {ch}
            </span>
          ))}
        </h1>
        <p className="mo-rise mt-3 text-[17px] font-semibold opacity-90" style={{ animationDelay: "1.6s" }}>
          Учи язык, читая то, что любишь
        </p>
        <div
          className="mo-rise mx-auto mt-6 h-1.5 w-28 overflow-hidden rounded-full"
          style={{ background: "rgba(255,255,255,.22)", animationDelay: "1.6s" }}
          aria-hidden="true"
        >
          <div className="onb-load" />
        </div>
      </div>

      <div className="mo-rise relative flex flex-col gap-2.5 px-5 pb-10 pt-4" style={{ animationDelay: "2.2s" }}>
        <button
          type="button"
          onClick={onStart}
          className="focus-ring flex min-h-[54px] w-full items-center justify-center rounded-2xl bg-white px-5 font-bold text-[var(--leaf-text)] shadow-[inset_0_-4px_0_0_var(--leaf-tint-strong)] active:translate-y-1 active:shadow-none"
        >
          Начать бесплатно
        </button>
        <Link
          href="/login"
          className="focus-ring flex min-h-[50px] w-full items-center justify-center rounded-2xl border-2 border-white/55 px-5 font-bold text-white"
        >
          У меня уже есть аккаунт
        </Link>
      </div>
    </div>
  );
}
