import type { CSSProperties } from "react";

// Детерминированное конфетти (тот же генератор, что в макетах v7): одно и то
// же seed → одна и та же картинка, поэтому скриншот-сверка стабильна и нет
// расхождения между сервером и клиентом при гидрации. Скрыто при
// prefers-reduced-motion (moments.css).
export interface ConfettiProps {
  seed: number;
  count?: number;
  colors?: string[];
  /** Минимальная и добавочная дальность разлёта, px. */
  reach?: [number, number];
  /** Сдвиг по вертикали — «падение» вниз. */
  fall?: number;
  /** Задержка старта, с. */
  delay?: number;
  /** Ограничить сектор разлёта (радианы от, до). По умолчанию — круг. */
  arc?: [number, number];
  /** "leaf" — Word-mastered.dc.html: одинаковые 14px «листья», не случайные
   *  квадраты/кружки. */
  shape?: "default" | "leaf";
}

const DEFAULT_COLORS = ["var(--sun)", "var(--leaf)", "var(--sky)", "var(--ember)", "var(--danger)"];

export function confettiPieces({
  seed,
  count = 28,
  colors = DEFAULT_COLORS,
  reach = [140, 100],
  fall = 40,
  delay = 0,
  arc = [0, Math.PI * 2],
  shape = "default",
}: ConfettiProps): CSSProperties[] {
  let s = seed;
  const r = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const pieces: CSSProperties[] = [];
  for (let i = 0; i < count; i++) {
    const a = arc[0] + r() * (arc[1] - arc[0]);
    const d = reach[0] + r() * reach[1];
    const w = 6 + Math.round(r() * 6);
    pieces.push({
      width: shape === "leaf" ? 14 : w,
      height: shape === "leaf" ? 14 : r() < 0.5 ? w : w * 2,
      background: colors[i % colors.length],
      borderRadius: shape === "leaf" ? "0 70% 0 70%" : r() < 0.3 ? 99 : 2,
      ["--dx" as string]: `${Math.round(Math.cos(a) * d)}px`,
      ["--dy" as string]: `${Math.round(Math.sin(a) * d + fall)}px`,
      ["--r" as string]: `${Math.round(r() * 720 - 360)}deg`,
      ["--d" as string]: `${(delay + r() * 0.15).toFixed(2)}s`,
      ["--t" as string]: `${(1.2 + r() * 0.8).toFixed(2)}s`,
    } as CSSProperties);
  }
  return pieces;
}

/** Точка-источник; ставится абсолютно в центр того, что «взрывается». */
export function Confetti(props: ConfettiProps & { style?: CSSProperties }) {
  const { style, ...rest } = props;
  return (
    <div aria-hidden="true" style={{ position: "absolute", width: 0, height: 0, ...style }}>
      {confettiPieces(rest).map((p, i) => (
        <span key={i} className="mo-cf" style={p} />
      ))}
    </div>
  );
}
