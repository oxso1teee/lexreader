// SM-2, упрощённая 4-балльная версия с настраиваемыми параметрами
// (экран Study Settings в разделе «Мозг»).
// grade: 0 = не помню, 1 = трудно, 2 = помню, 3 = легко.
//
// Упрощение: полноценные Anki-style learning/relearning steps (внутридневные
// интервалы в минутах) не реализованы — learning_steps/relearning_steps
// хранятся и показываются в настройках, но на расчёт интервалов пока не
// влияют. graduating/easy interval применяются к первому успешному повтору.

export interface SrsState {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
}

export interface SrsParams {
  easyBonus: number;
  intervalModifier: number;
  maxIntervalDays: number;
  graduatingIntervalDays: number;
  easyIntervalDays: number;
}

export const DEFAULT_SRS_PARAMS: SrsParams = {
  easyBonus: 1.3,
  intervalModifier: 1.0,
  maxIntervalDays: 36500,
  graduatingIntervalDays: 1,
  easyIntervalDays: 4,
};

export function reviewSrsState(
  state: SrsState,
  grade: 0 | 1 | 2 | 3,
  params: SrsParams = DEFAULT_SRS_PARAMS,
): SrsState {
  let { easeFactor, intervalDays, repetitions } = state;

  if (grade === 0) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    if (repetitions === 0) {
      intervalDays = grade === 3 ? params.easyIntervalDays : params.graduatingIntervalDays;
    } else if (repetitions === 1) {
      intervalDays = Math.round(6 * params.intervalModifier);
    } else {
      let next = intervalDays * easeFactor * params.intervalModifier;
      if (grade === 3) next *= params.easyBonus;
      intervalDays = Math.round(next);
    }
    intervalDays = Math.min(intervalDays, params.maxIntervalDays);
    repetitions += 1;
  }

  easeFactor = easeFactor + (0.1 - (3 - grade) * (0.08 + (3 - grade) * 0.02));
  easeFactor = Math.max(easeFactor, 1.3);

  return { easeFactor, intervalDays, repetitions };
}

export function isLearned(state: SrsState): boolean {
  return state.intervalDays >= 21 && state.repetitions >= 3;
}
