import { emptySkillProgress } from "../../learning-paths/progress-engine.ts";
import { getPath } from "../../learning-paths/curriculum/index.ts";
import type { SkillProgressRow } from "../../learning-paths/types.ts";
import type { UnitDoneMoment } from "../../moments/types.ts";
import type {
  AttemptStore,
  CompletionWrite,
  CreateAttemptInput,
  ProgressPort,
  ProgressWrite,
  RewardPort,
  ServiceDeps,
  XpGrant,
} from "../ports.ts";
import type { AttemptRecord, LessonMode, SkillAddress } from "../types.ts";

// Реализации портов в памяти — для тестов. Повторяют ограничения настоящей БД
// (миграция 0058): одна открытая попытка на навык и режим, запись шага с
// проверкой позиции, XP — максимум один раз на навык. Так тесты ловят те же
// гонки, что и настоящая база.

type StoreOp =
  | "findById"
  | "findOpen"
  | "create"
  | "saveProgress"
  | "markCompleted"
  | "claimXp"
  | "releaseXpClaim"
  | "markFinalized"
  | "hasXpClaim";

export class MemoryAttemptStore implements AttemptStore {
  readonly userId: string;
  readonly rows: AttemptRecord[];
  private failing = new Set<StoreOp>();
  private counter = 0;
  /** Сколько раз сработал каждый метод — для проверок «не вызывалось повторно». */
  readonly calls: Record<string, number> = {};

  // Без parameter properties: тесты идут через node --experimental-strip-types,
  // который их не поддерживает.
  constructor(
    userId: string,
    /** Общий список строк нескольких пользователей: хранилище видит только свои. */
    shared?: AttemptRecord[],
  ) {
    this.userId = userId;
    this.rows = shared ?? [];
  }

  failNext(op: StoreOp): void {
    this.failing.add(op);
  }

  private hit(op: StoreOp): void {
    this.calls[op] = (this.calls[op] ?? 0) + 1;
    if (this.failing.delete(op)) throw new Error(`injected failure: ${op}`);
  }

  private own(): AttemptRecord[] {
    return this.rows.filter((row) => row.userId === this.userId);
  }

  private same(row: AttemptRecord, address: SkillAddress): boolean {
    return row.pathSlug === address.pathSlug && row.pathVersion === address.pathVersion && row.skillKey === address.skillKey;
  }

  async findById(attemptId: string): Promise<AttemptRecord | null> {
    this.hit("findById");
    const row = this.own().find((r) => r.id === attemptId);
    return row ? structuredClone(row) : null;
  }

  async findOpen(address: SkillAddress, mode: LessonMode): Promise<AttemptRecord | null> {
    this.hit("findOpen");
    const row = this.own().find((r) => this.same(r, address) && r.mode === mode && r.status === "in_progress");
    return row ? structuredClone(row) : null;
  }

  async findLatestCompleted(address: SkillAddress): Promise<AttemptRecord | null> {
    const done = this.own()
      .filter((r) => this.same(r, address) && r.status === "completed")
      .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
    return done[0] ? structuredClone(done[0]) : null;
  }

  async create(input: CreateAttemptInput): Promise<AttemptRecord> {
    this.hit("create");
    const existing = await this.findOpen(input, input.mode);
    if (existing) return existing;
    const now = new Date(Date.UTC(2026, 0, 1, 0, 0, this.counter)).toISOString();
    const row: AttemptRecord = {
      id: `attempt-${this.userId}-${++this.counter}`,
      userId: this.userId,
      pathSlug: input.pathSlug,
      pathVersion: input.pathVersion,
      skillKey: input.skillKey,
      mode: input.mode,
      status: "in_progress",
      stepIndex: 0,
      stepsTotal: input.stepsTotal,
      signature: input.signature,
      answers: [],
      correctCount: 0,
      incorrectCount: 0,
      passed: null,
      scoreRatio: null,
      xpAwarded: 0,
      xpClaimedAt: null,
      startedAt: now,
      lastActivityAt: now,
      completedAt: null,
      finalizedAt: null,
    };
    this.rows.push(row);
    return structuredClone(row);
  }

  async abandon(attemptId: string): Promise<void> {
    const row = this.own().find((r) => r.id === attemptId && r.status === "in_progress");
    if (row) row.status = "abandoned";
  }

  async saveProgress(attemptId: string, expectedStepIndex: number, next: ProgressWrite): Promise<AttemptRecord | null> {
    this.hit("saveProgress");
    const row = this.own().find((r) => r.id === attemptId);
    if (!row || row.status !== "in_progress" || row.stepIndex !== expectedStepIndex) return null;
    row.stepIndex = next.stepIndex;
    row.answers = structuredClone(next.answers);
    row.correctCount = next.correctCount;
    row.incorrectCount = next.incorrectCount;
    return structuredClone(row);
  }

  async markCompleted(attemptId: string, result: CompletionWrite): Promise<AttemptRecord | null> {
    this.hit("markCompleted");
    const row = this.own().find((r) => r.id === attemptId);
    if (!row || row.status !== "in_progress") return null;
    row.status = "completed";
    row.passed = result.passed;
    row.scoreRatio = result.scoreRatio;
    row.correctCount = result.correctCount;
    row.incorrectCount = result.incorrectCount;
    row.completedAt = new Date().toISOString();
    return structuredClone(row);
  }

  async claimXp(attemptId: string, amount: number): Promise<boolean> {
    this.hit("claimXp");
    const row = this.own().find((r) => r.id === attemptId);
    if (!row || row.status !== "completed" || row.xpClaimedAt !== null) return false;
    // partial unique index (user, path, version, skill) where xp_claimed_at is not null
    if (this.own().some((r) => r.id !== row.id && this.same(r, row) && r.xpClaimedAt !== null)) return false;
    row.xpClaimedAt = new Date().toISOString();
    row.xpAwarded = amount;
    return true;
  }

  async setXpAwarded(attemptId: string, amount: number): Promise<void> {
    const row = this.own().find((r) => r.id === attemptId && r.xpClaimedAt !== null);
    if (row) row.xpAwarded = amount;
  }

  async releaseXpClaim(attemptId: string): Promise<void> {
    this.hit("releaseXpClaim");
    const row = this.own().find((r) => r.id === attemptId && r.status === "completed" && r.xpClaimedAt !== null);
    if (row) {
      row.xpClaimedAt = null;
      row.xpAwarded = 0;
    }
  }

  async hasXpClaim(address: SkillAddress): Promise<boolean> {
    this.hit("hasXpClaim");
    return this.own().some((r) => this.same(r, address) && r.xpClaimedAt !== null);
  }

  async markFinalized(attemptId: string): Promise<void> {
    this.hit("markFinalized");
    const row = this.own().find((r) => r.id === attemptId);
    if (row && row.finalizedAt === null) row.finalizedAt = new Date().toISOString();
  }
}

export class MemoryProgress implements ProgressPort {
  afterChangeCalls: boolean[] = [];
  saves = 0;
  unitDone: UnitDoneMoment | null = null;
  readonly address: SkillAddress;
  readonly rows: SkillProgressRow[];
  private readonly userId: string;

  constructor(address: SkillAddress, rows: SkillProgressRow[], userId: string) {
    this.address = address;
    this.rows = rows;
    this.userId = userId;
  }

  async loadPathRows(): Promise<SkillProgressRow[]> {
    return this.rows.filter((row) => row.path_slug === this.address.pathSlug).map((row) => ({ ...row }));
  }

  async load(): Promise<SkillProgressRow> {
    const found = this.rows.find((row) => row.path_slug === this.address.pathSlug && row.skill_key === this.address.skillKey);
    if (found) return { ...found };
    const path = getPath(this.address.pathSlug);
    if (!path) throw new Error("unknown path");
    return { id: "", created_at: "", updated_at: "", ...emptySkillProgress(this.userId, path, this.address.skillKey) };
  }

  async save(row: SkillProgressRow, patch: Partial<SkillProgressRow>): Promise<SkillProgressRow> {
    this.saves++;
    let target = this.rows.find((r) => r.path_slug === row.path_slug && r.skill_key === row.skill_key);
    if (!target) {
      target = { ...row, id: `progress-${this.rows.length + 1}`, created_at: "t", updated_at: "t" };
      this.rows.push(target);
    }
    Object.assign(target, patch);
    return { ...target };
  }

  async afterChange(newlyCompleted: boolean): Promise<UnitDoneMoment | null> {
    this.afterChangeCalls.push(newlyCompleted);
    return newlyCompleted ? this.unitDone : null;
  }
}

export class MemoryRewards implements RewardPort {
  /** Реально начисленные суммы (успешные grantXp). */
  xpGrants: number[] = [];
  /** Сколько раз grantXp вернул null (XP не начислен). */
  failedGrants = 0;
  firstWinSet = false;
  firstWinAlready = false;
  grantResult: XpGrant | null | "fail" = null;
  /** Следующий grantXp не начислит XP (одноразово). */
  failNextGrant = false;
  /** Следующий markFirstWin бросит исключение (одноразово). */
  failNextFirstWin = false;

  async grantXp(amount: number): Promise<XpGrant | null> {
    if (this.failNextGrant || this.grantResult === "fail") {
      this.failNextGrant = false;
      this.failedGrants++;
      return null;
    }
    this.xpGrants.push(amount);
    return this.grantResult ?? { awarded: amount, moments: [] };
  }

  async markFirstWin(): Promise<boolean> {
    if (this.failNextFirstWin) {
      this.failNextFirstWin = false;
      throw new Error("injected failure: first win");
    }
    if (this.firstWinAlready || this.firstWinSet) return false;
    this.firstWinSet = true;
    return true;
  }
}

export interface Harness {
  deps: ServiceDeps;
  store: MemoryAttemptStore;
  progress: MemoryProgress;
  rewards: MemoryRewards;
  /** Строки user_skill_progress (общие с progress). */
  rows: SkillProgressRow[];
}

export function createHarness(address: SkillAddress, options: { userId?: string; rows?: SkillProgressRow[]; shared?: AttemptRecord[] } = {}): Harness {
  const userId = options.userId ?? "user-1";
  const rows = options.rows ?? [];
  const store = new MemoryAttemptStore(userId, options.shared);
  const progress = new MemoryProgress(address, rows, userId);
  const rewards = new MemoryRewards();
  let tick = 0;
  const deps: ServiceDeps = {
    userId,
    store,
    progressFor: () => progress,
    rewards,
    now: () => new Date(Date.UTC(2026, 0, 1, 12, 0, tick++)).toISOString(),
  };
  return { deps, store, progress, rewards, rows };
}
