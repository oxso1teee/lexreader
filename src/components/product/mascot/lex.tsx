import type { ReactNode } from "react";
import { cx } from "@/lib/ui/cx";

// Lex — маскот LexReader (Ultimate Design System). Один компонент вместо
// десяти инлайн-копий SVG в экранах: настроение (mood), размер (size) и тон
// (tone). Геометрия и 8 лиц — из design/ultimate/tools/build_ds.py; цвета
// заданы в src/styles/lex.css и от темы не зависят.
//
// Декоративный: aria-hidden — смысл всегда несёт текст рядом. Не путать с
// ReadingCompanion (искра экрана чтения, умеет «возбуждаться») — тот остаётся.
//
// Пример:
//   <Lex mood="wink" size={88} bob />
//   <Lex mood="sleep" tone="ghost" size={56} />
export type LexMood = "happy" | "wink" | "joy" | "sad" | "sleep" | "think" | "wow" | "cool";
export type LexTone = "default" | "pale" | "ghost";

export const LEX_MOODS: readonly LexMood[] = ["happy", "wink", "joy", "sad", "sleep", "think", "wow", "cool"];

const INK = "var(--lex-ink)";
const stroke = { fill: "none", stroke: INK, strokeWidth: 2.4, strokeLinecap: "round" } as const;
const thinStroke = { stroke: INK, strokeWidth: 2, strokeLinecap: "round" } as const;

function Eyes({ y = 62, x1 = 54, x2 = 66 }: { y?: number; x1?: number; x2?: number }) {
  return (
    <>
      <ellipse cx={x1} cy={y} rx={3.2} ry={4.4} fill={INK} />
      <ellipse cx={x2} cy={y} rx={3.2} ry={4.4} fill={INK} />
    </>
  );
}

const FACES: Record<LexMood, ReactNode> = {
  happy: (
    <>
      <Eyes />
      <path d="M53 71q7 7 14 0" {...stroke} />
    </>
  ),
  wink: (
    <>
      <ellipse cx={54} cy={62} rx={3.2} ry={4.4} fill={INK} />
      <path d="M62 62q4-3 8 0" {...stroke} />
      <path d="M53 70q7 8 14 0" {...stroke} />
    </>
  ),
  joy: (
    <>
      <path d="M50 63q4-5 8 0M62 63q4-5 8 0" {...stroke} />
      <path d="M52 70q8 10 16 0z" fill={INK} />
    </>
  ),
  sad: (
    <>
      <Eyes />
      <path d="M54 75q6-5 12 0" {...stroke} />
      <path d="M49 55l7 2M71 55l-7 2" {...thinStroke} />
    </>
  ),
  sleep: (
    <>
      <path d="M50 63q4 3 8 0M62 63q4 3 8 0" {...stroke} />
      <path d="M56 72h8" {...stroke} />
    </>
  ),
  think: (
    <>
      <Eyes y={60} x1={55} x2={67} />
      <path d="M55 73h9" {...stroke} />
      <path d="M49 53l8-2" {...thinStroke} />
    </>
  ),
  wow: (
    <>
      <Eyes />
      <ellipse cx={60} cy={74} rx={3.6} ry={4.4} fill={INK} />
    </>
  ),
  cool: (
    <>
      <path d="M47 58h26v5a6 6 0 0 1-12 0 6 6 0 0 1-12 0z" fill={INK} />
      <path d="M54 72q6 5 12 0" {...stroke} />
    </>
  ),
};

export function Lex({
  mood = "happy",
  size = 64,
  tone = "default",
  bob = false,
  className,
}: {
  mood?: LexMood;
  /** Ширина в px; высота — по пропорции 128:150. В макетах: 40, 56, 64, 88, 120, 160. */
  size?: number;
  tone?: LexTone;
  /** Лёгкое покачивание (только при prefers-reduced-motion: no-preference). */
  bob?: boolean;
  className?: string;
}) {
  // «Призрак» в макетах всегда спит, какое бы настроение ни передали.
  const shown: LexMood = tone === "ghost" ? "sleep" : mood;
  return (
    <svg
      viewBox="0 0 128 150"
      width={size}
      height={Math.round((size * 150) / 128)}
      aria-hidden="true"
      focusable="false"
      data-lex-mood={shown}
      className={cx("lex", tone !== "default" && `lex-${tone}`, bob && "lex-bob", className)}
    >
      <ellipse cx={64} cy={134} rx={34} ry={8} fill="var(--lex-shadow)" />
      <path d="M64 8C78 26 100 44 92 72C87 92 66 104 48 90C32 78 32 54 48 40C58 31 60 20 64 8Z" fill="var(--lex-body)" />
      <path
        d="M60 46C70 58 76 68 68 82C63 90 50 90 44 81C39 73 43 61 51 53C55 50 57 48 60 46Z"
        fill="var(--lex-belly)"
        opacity={0.92}
      />
      {FACES[shown]}
      <ellipse cx={90} cy={100} rx={19} ry={12} fill="var(--lex-bean)" transform="rotate(-28 90 100)" />
      <ellipse cx={94} cy={96} rx={8} ry={5} fill="var(--lex-bean-hi)" transform="rotate(-28 94 96)" opacity={0.85} />
    </svg>
  );
}
