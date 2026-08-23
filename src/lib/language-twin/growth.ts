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
