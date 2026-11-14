import type { SkillProgressRow } from "../learning-paths/types.ts";
import type { Moment, UnitDoneMoment } from "../moments/types.ts";
import type { AttemptRecord, LessonMode, SkillAddress, StoredAnswer } from "./types.ts";

// Порты сервиса уроков. Бизнес-логика (service.ts) знает только эти
// интерфейсы: реализации на Supabase лежат в supabase-store.ts / server.ts, а
// в тестах подставляются реализации в памяти. Благодаря этому идемпотентность,
// гонки и повторные отправки проверяются без базы.

export interface CreateAttemptInput extends SkillAddress {
  mode: LessonMode;
  stepsTotal: number;
  signature: string;
}

export interface ProgressWrite {
  stepIndex: number;
  answers: StoredAnswer[];
  correctCount: number;
  incorrectCount: number;
}

export interface CompletionWrite {
  passed: boolean;
  scoreRatio: number | null;
  correctCount: number;
  incorrectCount: number;
}

/** Хранилище попыток. Владелец (userId) зашит в реализацию при создании и
 *  берётся из серверной сессии — ни один метод не принимает user id от клиента,
 *  и каждый запрос ограничен этим владельцем. */
export interface AttemptStore {
  findById(attemptId: string): Promise<AttemptRecord | null>;
  findOpen(address: SkillAddress, mode: LessonMode): Promise<AttemptRecord | null>;
  /** Последняя завершённая попытка по навыку (любой режим) — для страницы урока. */
  findLatestCompleted(address: SkillAddress): Promise<AttemptRecord | null>;
  /** Создаёт открытую попытку. Если открытая попытка этого режима уже есть
   *  (гонка двух вкладок/кликов), возвращает её, а не падает. */
  create(input: CreateAttemptInput): Promise<AttemptRecord>;
  abandon(attemptId: string): Promise<void>;
  /** Запись шага с проверкой позиции (compare-and-swap по step_index): при
   *  гонке выигрывает один запрос, проигравший получает null. */
  saveProgress(attemptId: string, expectedStepIndex: number, next: ProgressWrite): Promise<AttemptRecord | null>;
  /** in_progress → completed ровно один раз; проигравший получает null. */
  markCompleted(attemptId: string, result: CompletionWrite): Promise<AttemptRecord | null>;
  /** Занимает право на XP за навык. true — это обращение выиграло; false —
   *  право уже занято (этой или другой попыткой того же навыка). */
  claimXp(attemptId: string, amount: number): Promise<boolean>;
  setXpAwarded(attemptId: string, amount: number): Promise<void>;
  /** Освобождает право на XP, если начислить его не удалось (addXp ничего не записал):
   *  тогда повторное завершение сможет занять его снова и начислить. */
  releaseXpClaim(attemptId: string): Promise<void>;
  /** Получено ли XP за этот навык какой-либо попыткой. */
  hasXpClaim(address: SkillAddress): Promise<boolean>;
  markFinalized(attemptId: string): Promise<void>;
}

/** Прогресс навыка и пути (user_skill_progress + зачисление). */
export interface ProgressPort {
  loadPathRows(): Promise<SkillProgressRow[]>;
  /** Строка прогресса навыка или несохранённая заготовка (id === ""). */
  load(): Promise<SkillProgressRow>;
  /** Применяет патч; для заготовки сначала создаёт строку. */
  save(row: SkillProgressRow, patch: Partial<SkillProgressRow>): Promise<SkillProgressRow>;
  /** Сдвигает «текущий раздел» зачисления, закрывает путь, отдаёт «раздел пройден». */
  afterChange(newlyCompleted: boolean): Promise<UnitDoneMoment | null>;
}

export interface XpGrant {
  /** Реально начислено (с учётом Double-XP). */
  awarded: number;
  moments: Moment[];
}

/** Награды — существующая система XP/серии/моментов, не отдельная. */
export interface RewardPort {
  /** Контракт: null — XP НЕ начислен и ничего не записано (профиль не найден или
   *  addXp упал до записи), поэтому право на XP можно освободить и повторить.
   *  Если XP начислен, а сбилось что-то после (например, сборка моментов),
   *  возвращается результат с пустыми моментами — но не null: иначе повтор
   *  начислил бы XP второй раз. */
  grantXp(amount: number): Promise<XpGrant | null>;
  /** true — флаг completed_first_win выставлен именно этим вызовом. Ошибка записи
   *  пробрасывается: завершение не считается доведённым до конца и будет повторено. */
  markFirstWin(): Promise<boolean>;
}

export interface ServiceDeps {
  /** Пользователь из серверной сессии. */
  userId: string;
  store: AttemptStore;
  progressFor(address: SkillAddress): ProgressPort;
  rewards: RewardPort;
  now(): string;
}
