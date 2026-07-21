// SM-2, упрощённая 4-балльная версия (раздел 6 ТЗ).
// grade: 0 = не помню, 1 = трудно, 2 = помню, 3 = легко.

export interface SrsState {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
}

export function reviewSrsState(state: SrsState, grade: 0 | 1 | 2 | 3): SrsState {
  let { easeFactor, intervalDays, repetitions } = state;

  if (grade === 0) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    if (repetitions === 0) {
      intervalDays = 1;
    } else if (repetitions === 1) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(intervalDays * easeFactor);
    }
    repetitions += 1;
  }

  easeFactor = easeFactor + (0.1 - (3 - grade) * (0.08 + (3 - grade) * 0.02));
  easeFactor = Math.max(easeFactor, 1.3);

  return { easeFactor, intervalDays, repetitions };
}

export function isLearned(state: SrsState): boolean {
  return state.intervalDays >= 21 && state.repetitions >= 3;
}
