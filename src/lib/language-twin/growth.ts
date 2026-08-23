import type { ConfidenceLevel } from "./types";

// docs/release-2026-08-22/10_VAU_NOVYE_FICHI_I_DIZAYN.md раздел C, Тир 3 —
// "Визуальный Language Twin": превращает существующие цифры в визуальную
// стадию роста, не вводит новых метрик. GROWTH_THRESHOLDS — те же самые
// пороги observed_receptive_vocabulary, что уже использует
// behavioral-level.ts для CEFR-диапазона (15/500/1500/3000) — растение
// растёт ровно тогда, когда меняется реальная оценка уровня, не по
// отдельной, придуманной для этого шкале.
export type GrowthStage = 0 | 1 | 2 | 3 | 4;

export function growthStage(observedReceptiveVocabulary: number): GrowthStage {
  if (observedReceptiveVocabulary >= 3000) return 4;
  if (observedReceptiveVocabulary >= 1500) return 3;
  if (observedReceptiveVocabulary >= 500) return 2;
  if (observedReceptiveVocabulary >= 15) return 1;
  return 0;
}

export const GROWTH_STAGE_LABEL: Record<GrowthStage, string> = {
  0: "Семя",
  1: "Росток",
  2: "Молодое деревце",
  3: "Крепкое дерево",
  4: "Цветущее дерево",
};

// Общая геометрия дерева — единственный источник правды для ДВУХ разных
// рендеров: TwinAvatar (обычный React/SVG на странице /language-twin) и
// api/language-twin/share-card (next/og ImageResponse, скачиваемая PNG-
// карточка для шеринга). Satori (движок ImageResponse) НЕ принимает сырые
// SVG-элементы как вход — только HTML/CSS (div+flexbox) — поэтому у
// каждого рендера свой JSX, но геометрия/цвета/пороги — одни и те же,
// чтобы дерево на странице и дерево на скачанной картинке не разъезжались
// визуально. [cx, cy, r] — те же координаты в системе viewBox 200×200,
// что использует TwinAvatar.
export interface LeafCluster {
  cx: number;
  cy: number;
  r: number;
}
export interface StageGeometry {
  trunkHeight: number;
  trunkWidth: number;
  leafClusters: LeafCluster[];
}

export const STAGE_GEOMETRY: Record<GrowthStage, StageGeometry> = {
  0: { trunkHeight: 0, trunkWidth: 0, leafClusters: [] },
  1: {
    trunkHeight: 22,
    trunkWidth: 3,
    leafClusters: [
      { cx: 100, cy: 148, r: 9 },
      { cx: 108, cy: 152, r: 7 },
    ],
  },
  2: {
    trunkHeight: 46,
    trunkWidth: 6,
    leafClusters: [
      { cx: 100, cy: 118, r: 18 },
      { cx: 84, cy: 128, r: 14 },
      { cx: 116, cy: 128, r: 14 },
    ],
  },
  3: {
    trunkHeight: 62,
    trunkWidth: 9,
    leafClusters: [
      { cx: 100, cy: 96, r: 26 },
      { cx: 76, cy: 112, r: 19 },
      { cx: 124, cy: 112, r: 19 },
      { cx: 100, cy: 128, r: 20 },
    ],
  },
  4: {
    trunkHeight: 70,
    trunkWidth: 11,
    leafClusters: [
      { cx: 100, cy: 80, r: 30 },
      { cx: 68, cy: 100, r: 22 },
      { cx: 132, cy: 100, r: 22 },
      { cx: 82, cy: 126, r: 24 },
      { cx: 118, cy: 126, r: 24 },
      { cx: 100, cy: 116, r: 26 },
    ],
  },
};

// Низкая уверенность — крона заметно бледнее (буквально "мы пока не
// уверены, что это твой реальный уровень"), высокая — полный цвет.
export const CONFIDENCE_OPACITY: Record<ConfidenceLevel, number> = { low: 0.45, medium: 0.72, high: 1 };

export const MAX_VISIBLE_FLOWERS = 6;

// Детерминированный, но не строго-регулярный разброс позиций цветов внутри
// кроны — без Math.random() (SSR/ImageResponse должны рендерить
// одинаково каждый раз).
export function flowerOffset(i: number): [number, number] {
  const angle = (i * 137.508 * Math.PI) / 180; // золотой угол — естественный разброс без рандома
  const radius = 10 + (i % 3) * 6;
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}
