// docs/moments/ROADMAP.md, этап 2 — чистая версия решающей логики streak.ts
// (без Supabase) для нормального покрытия тестами всех переходов: обычный
// рост, заморозка, Earn-back (прервалась → 3 дня подряд → старое число
// возвращается), рубежи (Streak-30). streak.ts остаётся единственным, кто
// читает/пишет profiles — здесь только даты (строки YYYY-MM-DD) и числа.

export const STREAK_MILESTONES = [7, 14, 30, 50, 100, 365] as const;

export interface StreakProfileSnapshot {
  streakCurrent: number;
  streakLongest: number;
  lastActiveDate: string | null;
  freezeAvailable: boolean;
  freezeWeek: string | null;
  /** Оба NOT NULL ровно когда Earn-back активен. */
  streakBeforeBreak: number | null;
  repairUntil: string | null;
}

export interface StreakUpdate {
  streakCurrent: number;
  streakLongest: number;
  lastActiveDate: string;
  freezeAvailable: boolean;
  freezeWeek: string;
  streakBeforeBreak: number | null;
  repairUntil: string | null;
  before: number;
  after: number;
  usedFreeze: boolean;
  /** День, который реально пропустили и который заморозка спасла (вчера
   *  относительно today) — activity_days.freeze_used пишется на эту дату. */
  frozenDay: string | null;
  repairStarted: boolean;
  repairCompleted: boolean;
  repairFailed: boolean;
  milestonesCrossed: number[];
}

/** MILESTONES строго между (before, after] — восстановление Earn-back не
 *  считается (число уже было достигнуто раньше, до обрыва). */
export function crossedMilestones(before: number, after: number): number[] {
  return STREAK_MILESTONES.filter((m) => before < m && after >= m);
}

function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function computeStreakUpdate(
  profile: StreakProfileSnapshot,
  today: string,
  yesterday: string,
  twoDaysAgo: string,
  thisWeekStart: string,
): StreakUpdate | null {
  if (profile.lastActiveDate === today) return null;

  const freezeAvailableNow = profile.freezeWeek !== thisWeekStart ? true : profile.freezeAvailable;
  const repairActive =
    profile.repairUntil !== null && profile.streakBeforeBreak !== null && today <= profile.repairUntil;
  const wasActiveYesterday = profile.lastActiveDate === yesterday;

  // 1) Earn-back в процессе, продолжают подряд.
  if (repairActive && wasActiveYesterday) {
    const progress = profile.streakCurrent + 1;
    if (progress >= 3) {
      const restored = profile.streakBeforeBreak as number;
      return {
        streakCurrent: restored,
        streakLongest: Math.max(restored, profile.streakLongest),
        lastActiveDate: today,
        freezeAvailable: freezeAvailableNow,
        freezeWeek: thisWeekStart,
        streakBeforeBreak: null,
        repairUntil: null,
        before: profile.streakCurrent,
        after: restored,
        usedFreeze: false,
        frozenDay: null,
        repairStarted: false,
        repairCompleted: true,
        repairFailed: false,
        milestonesCrossed: [],
      };
    }
    return {
      streakCurrent: progress,
      streakLongest: Math.max(progress, profile.streakLongest),
      lastActiveDate: today,
      freezeAvailable: freezeAvailableNow,
      freezeWeek: thisWeekStart,
      streakBeforeBreak: profile.streakBeforeBreak,
      repairUntil: profile.repairUntil,
      before: profile.streakCurrent,
      after: progress,
      usedFreeze: false,
      frozenDay: null,
      repairStarted: false,
      repairCompleted: false,
      repairFailed: false,
      milestonesCrossed: [],
    };
  }

  // 2) Earn-back в процессе, но пропустили день — восстановление не удалось.
  if (repairActive && !wasActiveYesterday) {
    return {
      streakCurrent: 1,
      streakLongest: profile.streakLongest,
      lastActiveDate: today,
      freezeAvailable: freezeAvailableNow,
      freezeWeek: thisWeekStart,
      streakBeforeBreak: null,
      repairUntil: null,
      before: profile.streakCurrent,
      after: 1,
      usedFreeze: false,
      frozenDay: null,
      repairStarted: false,
      repairCompleted: false,
      repairFailed: true,
      milestonesCrossed: [],
    };
  }

  // 3) Заморозка спасает ровно однодневный пропуск (раздел 5.1 промта 2026-07-28).
  if (profile.lastActiveDate === twoDaysAgo && freezeAvailableNow) {
    const after = profile.streakCurrent + 1;
    const milestonesCrossed = crossedMilestones(profile.streakCurrent, after);
    return {
      streakCurrent: after,
      streakLongest: Math.max(after, profile.streakLongest),
      lastActiveDate: today,
      // Streak-30.dc.html — "Награда: +1 заморозка" на рубеже: сама же
      // потраченная сейчас заморозка тут же возвращается, если рубеж
      // совпал с её спасением (edge case, но честно — экран обещает ровно
      // это).
      freezeAvailable: milestonesCrossed.length > 0,
      freezeWeek: thisWeekStart,
      streakBeforeBreak: null,
      repairUntil: null,
      before: profile.streakCurrent,
      after,
      usedFreeze: true,
      frozenDay: yesterday,
      repairStarted: false,
      repairCompleted: false,
      repairFailed: false,
      milestonesCrossed,
    };
  }

  // 4) Обычный рост.
  if (wasActiveYesterday) {
    const after = profile.streakCurrent + 1;
    const milestonesCrossed = crossedMilestones(profile.streakCurrent, after);
    return {
      streakCurrent: after,
      streakLongest: Math.max(after, profile.streakLongest),
      lastActiveDate: today,
      // Streak-30.dc.html — "Награда: +1 заморозка" на каждом рубеже
      // (7/14/30/50/100/365), независимо от того, использована ли уже
      // заморозка на этой неделе.
      freezeAvailable: milestonesCrossed.length > 0 ? true : freezeAvailableNow,
      freezeWeek: thisWeekStart,
      streakBeforeBreak: null,
      repairUntil: null,
      before: profile.streakCurrent,
      after,
      usedFreeze: false,
      frozenDay: null,
      repairStarted: false,
      repairCompleted: false,
      repairFailed: false,
      milestonesCrossed,
    };
  }

  // 5) Настоящий обрыв. Earn-back предлагается только на свежем обрыве
  // реальной серии (>1 день) без уже висящего repair-состояния — не
  // плодим повторные попытки на одном и том же обрыве.
  const offerRepair = profile.streakCurrent > 1 && profile.repairUntil === null;
  return {
    streakCurrent: 1,
    streakLongest: profile.streakLongest,
    lastActiveDate: today,
    freezeAvailable: freezeAvailableNow,
    freezeWeek: thisWeekStart,
    streakBeforeBreak: offerRepair ? profile.streakCurrent : null,
    repairUntil: offerRepair ? addDaysIso(today, 2) : null,
    before: profile.streakCurrent,
    after: 1,
    usedFreeze: false,
    frozenDay: null,
    repairStarted: offerRepair,
    repairCompleted: false,
    repairFailed: false,
    milestonesCrossed: [],
  };
}
