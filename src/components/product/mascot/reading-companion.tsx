"use client";

import { useEffect, useState, type CSSProperties } from "react";

// redesign/duolingo-flat, phase 5 — маскот «искра для чтения». Геометрия
// перенесена из утверждённого артефакта как есть, анимации — в
// src/styles/mascot.css. Не путать с language-twin/twin-avatar.tsx.
// Excited (hover/click) — просто класс на корне на ~0.8s: squash-stretch и
// 6 фиксированных искр-«взрыва» запускаются им и перезапускаются при
// следующем включении. Декоративный — aria-hidden, текст рядом несёт смысл.
//
// Пример:
//   <ReadingCompanion />
//   <ReadingCompanion size={96} withHalo={false} />
const EXCITED_MS = 800;

export function ReadingCompanion({
  size = 160,
  withHalo = true,
  className,
}: {
  size?: number;
  withHalo?: boolean;
  className?: string;
}) {
  const [excited, setExcited] = useState(false);

  useEffect(() => {
    if (!excited) return;
    const timer = setTimeout(() => setExcited(false), EXCITED_MS);
    return () => clearTimeout(timer);
  }, [excited]);

  const excite = () => setExcited(true);

  return (
    <div
      aria-hidden="true"
      className={["mascot", excited && "mascot-excited", className].filter(Boolean).join(" ")}
      style={{ "--mascot-size": `${size}px` } as CSSProperties}
      onMouseEnter={excite}
      onClick={excite}
    >
      {withHalo && (
        <>
          <span className="mascot-halo mascot-halo-outer" />
          <span className="mascot-halo mascot-halo-inner" />
        </>
      )}
      <span className="mascot-float">
        <span className="mascot-spark" />
        <span className="mascot-spark" />
        <span className="mascot-spark" />
        <span className="mascot-spark" />
      </span>
      <div className="mascot-entrance">
        <div className="mascot-bob">
          <div className="mascot-squash">
            <svg viewBox="0 0 128 150" xmlns="http://www.w3.org/2000/svg">
              <ellipse cx="64" cy="128" rx="34" ry="9" fill="rgba(0,0,0,0.06)" />
              <path
                d="M64 8C78 26 100 44 92 72C87 92 66 104 48 90C32 78 32 54 48 40C58 31 60 20 64 8Z"
                fill="var(--color-forest)"
              />
              <path
                d="M60 46C70 58 76 68 68 82C63 90 50 90 44 81C39 73 43 61 51 53C55 50 57 48 60 46Z"
                fill="var(--leaf-tint)"
                opacity="0.9"
              />
              <ellipse
                cx="90"
                cy="100"
                rx="19"
                ry="12"
                fill="var(--ember, var(--color-warning))"
                transform="rotate(-28 90 100)"
              />
              <ellipse
                cx="94"
                cy="96"
                rx="8"
                ry="5"
                fill="var(--sun)"
                transform="rotate(-28 94 96)"
                opacity="0.85"
              />
            </svg>
          </div>
        </div>
      </div>
      <span className="mascot-burst">
        <span className="mascot-spark" />
        <span className="mascot-spark" />
        <span className="mascot-spark" />
        <span className="mascot-spark" />
        <span className="mascot-spark" />
        <span className="mascot-spark" />
      </span>
    </div>
  );
}
