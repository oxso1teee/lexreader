import type { ConfidenceLevel } from "@/lib/language-twin/types";
import type { GrowthStage } from "@/lib/language-twin/growth";

// docs/release-2026-08-22/10_VAU_NOVYE_FICHI_I_DIZAYN.md раздел C, Тир 3 —
// "Визуальный Language Twin". Каждый визуальный параметр — прямое,
// задокументированное отображение уже существующих реальных полей, ничего
// не выдумано:
//   - stage (0-4)     ← growthStage(observed_receptive_vocabulary) —
//                        те же пороги, что уже даёт behavioral-level.ts
//   - confidence      ← language_twin_profiles.confidence (низкая/средняя/
//                        высокая) — модулирует насыщенность кроны: чем
//                        меньше уверенность в оценке, тем более "блёклое"
//                        дерево, буквально показывает "мы пока не уверены"
//   - streakActive    ← profile.streak_current > 0 — тёплый акцент-свечение,
//                        тот же смысл, что 🔥-стрик на Today
//   - resolvedCount   ← count(language_error_patterns.status='resolved') —
//                        каждый решённый паттерн — один "цветок" на кроне,
//                        видимый предел (не рисуем сотню точек)
//
// Чисто SVG, без внешних зависимостей — та же техника, что уже
// используется для cover-градиентов (src/lib/text-cover.ts), только с
// процедурной геометрией вместо готовых фигур.
const MAX_VISIBLE_FLOWERS = 6;

const STAGE_GEOMETRY: Record<GrowthStage, { trunkHeight: number; trunkWidth: number; canopyRadius: number; leafClusters: [number, number, number][] }> = {
  0: { trunkHeight: 0, trunkWidth: 0, canopyRadius: 0, leafClusters: [] },
  1: {
    trunkHeight: 22,
    trunkWidth: 3,
    canopyRadius: 0,
    leafClusters: [
      [100, 148, 9],
      [108, 152, 7],
    ],
  },
  2: {
    trunkHeight: 46,
    trunkWidth: 6,
    canopyRadius: 0,
    leafClusters: [
      [100, 118, 18],
      [84, 128, 14],
      [116, 128, 14],
    ],
  },
  3: {
    trunkHeight: 62,
    trunkWidth: 9,
    canopyRadius: 0,
    leafClusters: [
      [100, 96, 26],
      [76, 112, 19],
      [124, 112, 19],
      [100, 128, 20],
    ],
  },
  4: {
    trunkHeight: 70,
    trunkWidth: 11,
    canopyRadius: 0,
    leafClusters: [
      [100, 80, 30],
      [68, 100, 22],
      [132, 100, 22],
      [82, 126, 24],
      [118, 126, 24],
      [100, 116, 26],
    ],
  },
};

// Низкая уверенность — крона заметно бледнее (буквально "мы пока не
// уверены, что это твой реальный уровень"), высокая — полный цвет.
const CONFIDENCE_OPACITY: Record<ConfidenceLevel, number> = { low: 0.45, medium: 0.72, high: 1 };

// Детерминированный, но не строго-регулярный разброс позиций цветов внутри
// кроны — без Math.random() (SSR должен рендерить одинаково каждый раз).
function flowerOffset(i: number): [number, number] {
  const angle = (i * 137.508 * Math.PI) / 180; // золотой угол — естественный разброс без рандома
  const radius = 10 + (i % 3) * 6;
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}

export default function TwinAvatar({
  stage,
  confidence,
  streakActive,
  resolvedCount,
  size = 200,
}: {
  stage: GrowthStage;
  confidence: ConfidenceLevel;
  streakActive: boolean;
  resolvedCount: number;
  size?: number;
}) {
  const geo = STAGE_GEOMETRY[stage];
  const canopyOpacity = CONFIDENCE_OPACITY[confidence];
  const flowerCount = stage === 4 ? Math.min(resolvedCount, MAX_VISIBLE_FLOWERS) : 0;
  const trunkTop = 170 - geo.trunkHeight;

  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      role="img"
      aria-label={`Дерево прогресса, стадия ${stage} из 4${streakActive ? ", активная серия дней" : ""}`}
      className="mx-auto"
    >
      {streakActive && (
        <circle cx="100" cy="105" r="88" fill="var(--color-warning)" opacity="0.12" />
      )}

      {/* Земля/горшок — присутствует на всех стадиях, даже у "семени". */}
      <ellipse cx="100" cy="175" rx="34" ry="7" fill="var(--color-forest-tint-strong)" />

      {stage === 0 ? (
        <circle cx="100" cy="171" r="4" fill="var(--color-forest-text)" opacity={canopyOpacity} />
      ) : (
        <>
          <rect
            x={100 - geo.trunkWidth / 2}
            y={trunkTop}
            width={geo.trunkWidth}
            height={geo.trunkHeight}
            rx={geo.trunkWidth / 2}
            fill="var(--color-caramel-text)"
          />
          {geo.leafClusters.map(([cx, cy, r], i) => (
            <circle key={i} cx={cx} cy={cy} r={r} fill="var(--color-forest-text)" opacity={canopyOpacity} />
          ))}
          {Array.from({ length: flowerCount }, (_, i) => {
            const [dx, dy] = flowerOffset(i);
            return (
              <circle
                key={i}
                cx={100 + dx}
                cy={90 + dy}
                r="3"
                fill="var(--color-warning-text)"
                stroke="var(--card)"
                strokeWidth="0.75"
              />
            );
          })}
        </>
      )}
    </svg>
  );
}
