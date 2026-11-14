import type { AwardRpc, AwardRpcArgs } from "../award.ts";

// Реализация award_xp в памяти для тестов — повторяет семантику SQL-функции
// (миграция 0059, проверена на реальном Postgres): блокировка профиля
// сериализует начисления, уникальный (user, source, ref), дневной лимит по
// base-сумме плюс скользящий лимит 2× за 24 часа, Double-XP, подстановка {day},
// activity_days по локальному дню, goal_met по выбранному типу цели.
// Асинхронные вызовы выполняются строго по очереди — как под блокировкой строки.

export interface LedgerEvent {
  id: string;
  user: string;
  source: string;
  ref: string | null;
  base: number;
  amount: number;
  boosted: boolean;
  day: string;
  /** Момент начисления (мс) — для скользящего лимита 24 часа. */
  at: number;
}

export interface LedgerProfile {
  xp: number;
  goal: number;
  /** Тип цели дня: goal_met внутри award_xp ставится только для 'xp'. */
  goalType: string;
  boostUntil: number | null;
  /** Локальный день пользователя на «сейчас» — задаётся тестом. */
  today: string;
}

export class MemoryLedger {
  readonly events: LedgerEvent[] = [];
  readonly profiles = new Map<string, LedgerProfile>();
  readonly days = new Map<string, { xp: number; goalMet: boolean }>();
  /** Следующие N вызовов упадут как сбой хранилища (транзакция откатывается — ничего не записано). */
  failNext = 0;
  /** Сколько вызовов дошло до БД (для проверки «лишний вызов не делался»). */
  calls = 0;
  now: () => number = () => Date.now();
  private chain: Promise<unknown> = Promise.resolve();
  private seq = 0;

  addProfile(user: string, profile: Partial<LedgerProfile> = {}): void {
    this.profiles.set(user, { xp: 0, goal: 50, goalType: "xp", boostUntil: null, today: "2026-11-14", ...profile });
  }

  readonly rpc: AwardRpc = (args) => {
    const run = this.chain.then(() => this.execute(args));
    this.chain = run.catch(() => undefined);
    return run;
  };

  private async execute(args: AwardRpcArgs) {
    this.calls++;
    await Promise.resolve();
    if (this.failNext > 0) {
      this.failNext--;
      return { data: null, error: { message: "injected storage failure" } };
    }
    const profile = this.profiles.get(args.p_user);
    if (!profile) return { data: { status: "no_profile" }, error: null };

    const ref = args.p_ref === null ? null : args.p_ref.replace("{day}", profile.today);
    if (ref !== null) {
      const existing = this.events.find((e) => e.user === args.p_user && e.source === args.p_source && e.ref === ref);
      if (existing) return { data: { status: "duplicate", awarded: existing.amount, day: existing.day }, error: null };
    }
    if (args.p_daily_cap !== null) {
      const used = this.events
        .filter((e) => e.user === args.p_user && e.source === args.p_source && e.day === profile.today)
        .reduce((sum, e) => sum + e.base, 0);
      if (used + args.p_amount > args.p_daily_cap) return { data: { status: "capped", used, cap: args.p_daily_cap }, error: null };
      // скользящее окно: за любые 24 часа — не больше двух дневных лимитов
      const since = this.now() - 24 * 3_600_000;
      const used24 = this.events
        .filter((e) => e.user === args.p_user && e.source === args.p_source && e.at > since)
        .reduce((sum, e) => sum + e.base, 0);
      if (used24 + args.p_amount > args.p_daily_cap * 2) {
        return { data: { status: "capped", used: used24, cap: args.p_daily_cap * 2, window: "rolling" }, error: null };
      }
    }

    const boosted = profile.boostUntil !== null && profile.boostUntil > this.now();
    const awarded = args.p_amount * (boosted ? 2 : 1);
    const event: LedgerEvent = {
      id: `evt-${++this.seq}`,
      user: args.p_user,
      source: args.p_source,
      ref,
      base: args.p_amount,
      amount: awarded,
      boosted,
      day: profile.today,
      at: this.now(),
    };
    this.events.push(event);
    const totalBefore = profile.xp;
    profile.xp += awarded;
    const key = `${args.p_user}|${profile.today}`;
    const dayRow = this.days.get(key) ?? { xp: 0, goalMet: false };
    const todayBefore = dayRow.xp;
    dayRow.xp += awarded;
    // отметка только растёт и ставится здесь лишь для XP-цели (остальные — markGoalMet)
    dayRow.goalMet = dayRow.goalMet || (profile.goalType === "xp" && dayRow.xp >= profile.goal);
    this.days.set(key, dayRow);

    return {
      data: {
        status: "awarded",
        event_id: event.id,
        awarded,
        base: args.p_amount,
        boosted,
        goal: profile.goalType === "xp" ? profile.goal : 0,
        day: profile.today,
        total_before: totalBefore,
        total_after: profile.xp,
        today_before: todayBefore,
        today_after: dayRow.xp,
      },
      error: null,
    };
  }

  /** mark_goal_met(): true только вызову, который перевёл день в «выполнено». */
  markGoalMet(user: string, day: string): boolean {
    const key = `${user}|${day}`;
    const row = this.days.get(key) ?? { xp: 0, goalMet: false };
    this.days.set(key, row);
    if (row.goalMet) return false;
    row.goalMet = true;
    return true;
  }

  goalMet(user: string, day: string): boolean {
    return this.days.get(`${user}|${day}`)?.goalMet ?? false;
  }

  totalXp(user: string): number {
    return this.profiles.get(user)?.xp ?? 0;
  }

  dayXp(user: string, day: string): number {
    return this.days.get(`${user}|${day}`)?.xp ?? 0;
  }
}
