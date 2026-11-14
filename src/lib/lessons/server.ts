import { createClient } from "@/lib/supabase/server";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { afterProgressChange } from "@/lib/learning-paths/after-progress";
import { findSkill, getPath } from "@/lib/learning-paths/curriculum/index";
import { emptySkillProgress } from "@/lib/learning-paths/progress-engine";
import {
  applySkillProgressPatch,
  getOrCreateSkillProgress,
  getSkillProgressForPath,
  getSkillProgressRow,
} from "@/lib/learning-paths/persist";
import type { Skill } from "@/lib/learning-paths/types";
import { minutesHintForGoal } from "@/lib/daily-goal";
import { log } from "@/lib/log";
import { collectMoments } from "@/lib/moments/collect";
import type { Moment } from "@/lib/moments/types";
import { fetchGoalWeekMarks } from "@/lib/moments/week-query";
import { fetchStreakWeekMarks } from "@/lib/moments/streak-week-query";
import { touchStreak } from "@/lib/streak";
import { addXp, todayUtcIso } from "@/lib/xp-actions";
import type { LessonErrorCode } from "./errors";
import { buildLessonPlan, hasCheckMode } from "./plan";
import type { AttemptStore, ProgressPort, RewardPort, ServiceDeps } from "./ports";
import { createSupabaseAttemptStore } from "./supabase-store";
import type { AttemptRecord, SkillAddress } from "./types";

// Серверная сборка сервиса уроков: настоящие реализации портов поверх
// Supabase и существующих систем приложения (прогресс пути, XP, серия, моменты).
// Всё, что можно проверить без БД, — в service.ts и его тестах; здесь только
// проводка. Пользователь определяется ЗДЕСЬ из серверной сессии
// (auth.getUser() проверяет токен в GoTrue), а не берётся из аргументов.

function createProgressPort(supabase: SupabaseServerClient, userId: string, address: SkillAddress): ProgressPort {
  const path = getPath(address.pathSlug);
  if (!path) throw new Error(`Unknown learning path: ${address.pathSlug}`);
  return {
    loadPathRows: () => getSkillProgressForPath(supabase, userId, address.pathSlug, address.pathVersion),

    async load() {
      const existing = await getSkillProgressRow(supabase, userId, address.pathSlug, address.pathVersion, address.skillKey);
      if (existing) return existing;
      return { id: "", created_at: "", updated_at: "", ...emptySkillProgress(userId, path, address.skillKey) };
    },

    async save(row, patch) {
      const target =
        row.id !== "" ? row : await getOrCreateSkillProgress(supabase, userId, address.pathSlug, address.pathVersion, address.skillKey);
      const updated = await applySkillProgressPatch(supabase, userId, target.id, patch);
      // applySkillProgressPatch глотает ошибки Supabase и возвращает null:
      // для завершения урока это недопустимо — иначе попытка пометилась бы
      // завершённой, а прогресс остался старым. Бросаем — сервис ответит
      // storage_failed, а повторный вызов доделает запись.
      if (!updated) throw new Error("user_skill_progress write failed");
      return updated;
    },

    afterChange: (newlyCompleted) => afterProgressChange(supabase, userId, path, address.skillKey, newlyCompleted),
  };
}

// Награда — те же addXp/touchStreak/collectMoments, что у чтения и повторения
// (не отдельная система). Серия и момент «цель дня» идут вместе с XP: урок —
// такая же настоящая активность, как глава или сессия повторения.
//
// Контракт grantXp (см. ports.ts): null означает «XP не начислен, ничего не
// записано» — только тогда сервис освобождает право на награду и допускает
// повтор. addXp сам не бросает исключений и возвращает null лишь когда запись
// не началась (профиль не найден / ошибка до записи), поэтому всё, что идёт
// ПОСЛЕ успешного addXp (сборка моментов), обёрнуто отдельно: её сбой не должен
// превратить уже начисленный XP в null — повтор начислил бы его дважды.
function createRewardPort(supabase: SupabaseServerClient, userId: string): RewardPort {
  return {
    async grantXp(amount) {
      const streak = await touchStreak(supabase, userId).catch((error: unknown) => {
        log.error({ kind: "lesson_streak", message: error instanceof Error ? error.message : "unknown" });
        return null;
      });
      const xp = await addXp(supabase, userId, amount);
      if (!xp) return null;

      let moments: Moment[] = [];
      try {
        const [goalWeek, streakWeek] = await Promise.all([
          fetchGoalWeekMarks(supabase, userId),
          streak ? fetchStreakWeekMarks(supabase, userId) : Promise.resolve([]),
        ]);
        moments = [
          ...collectMoments({
            xp: {
              before: { total: xp.total.before, today: xp.today.before },
              after: { total: xp.total.after, today: xp.today.after },
              goal: xp.goal,
              minutesHint: minutesHintForGoal(xp.goal),
            },
            streak,
            goalWeek,
            streakWeek,
            newAchievementIds: [],
            wordMastered: null,
            today: todayUtcIso(),
          }),
          ...(streak?.friendStreaks ?? []),
        ];
      } catch (error) {
        log.error({ kind: "lesson_moments", message: error instanceof Error ? error.message : "unknown" });
      }
      return { awarded: xp.awarded, moments };
    },

    async markFirstWin() {
      // Условное обновление: true только у вызова, который реально сменил флаг.
      const { data, error } = await supabase
        .from("profiles")
        .update({ completed_first_win: true })
        .eq("id", userId)
        .eq("completed_first_win", false)
        .select("id");
      if (error) throw new Error(`completed_first_win: ${error.message}`);
      return Boolean(data && data.length > 0);
    },
  };
}

export interface LessonServerContext {
  userId: string;
  deps: ServiceDeps;
}

export type LessonContextResult = { ok: true; context: LessonServerContext } | { ok: false; code: LessonErrorCode };

/** Контекст сервиса для текущего пользователя или причина отказа. Не
 *  редиректит (в отличие от requireProfile): server action должна вернуть
 *  ошибку клиенту, а не подменить свой ответ переходом на логин. */
export async function createLessonContext(): Promise<LessonContextResult> {
  let supabase: SupabaseServerClient;
  let userId: string;
  try {
    supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, code: "unauthorized" };
    userId = user.id;
  } catch {
    return { ok: false, code: "storage_failed" };
  }

  let write: ReturnType<typeof createServiceClient>;
  try {
    write = createServiceClient();
  } catch (error) {
    log.error({ kind: "lesson_service_client", message: error instanceof Error ? error.message : "unknown" });
    return { ok: false, code: "storage_failed" };
  }

  const store: AttemptStore = createSupabaseAttemptStore({ read: supabase, write, userId });
  return {
    ok: true,
    context: {
      userId,
      deps: {
        userId,
        store,
        progressFor: (address) => createProgressPort(supabase, userId, address),
        rewards: createRewardPort(supabase, userId),
        now: () => new Date().toISOString(),
      },
    },
  };
}

// ---------- обзор урока для страницы навыка ----------

export interface LessonOverview {
  /** Шагов в уроке и упражнений среди них. */
  stepCount: number;
  exerciseCount: number;
  hasCheck: boolean;
  /** Открытая попытка полного урока — можно продолжить. */
  open: { stepIndex: number; stepsTotal: number } | null;
  /** Результат последней завершённой попытки. */
  last: { passed: boolean; correctCount: number; incorrectCount: number; mode: AttemptRecord["mode"] } | null;
  /** XP за урок уже получен. */
  xpEarned: boolean;
}

/** Данные для карточки «Начать/Продолжить урок». Ошибка чтения (например, не
 *  применена миграция) не должна ронять страницу урока — возвращаем null, и
 *  страница остаётся рабочей без карточки плеера. */
export async function getLessonOverview(address: SkillAddress, skill: Skill): Promise<LessonOverview | null> {
  const plan = buildLessonPlan(skill, "lesson");
  if (!plan) return null;
  const context = await createLessonContext();
  if (!context.ok) return null;
  const { store } = context.context.deps;
  try {
    const [open, last, xpEarned] = await Promise.all([
      store.findOpen(address, "lesson"),
      store.findLatestCompleted(address),
      store.hasXpClaim(address),
    ]);
    const resumable = open && open.signature === plan.signature && open.stepsTotal === plan.steps.length ? open : null;
    return {
      stepCount: plan.steps.length,
      exerciseCount: plan.exerciseOrder.length,
      hasCheck: hasCheckMode(skill),
      open: resumable ? { stepIndex: resumable.stepIndex, stepsTotal: resumable.stepsTotal } : null,
      last: last
        ? { passed: last.passed === true, correctCount: last.correctCount, incorrectCount: last.incorrectCount, mode: last.mode }
        : null,
      xpEarned,
    };
  } catch (error) {
    log.error({ kind: "lesson_overview", message: error instanceof Error ? error.message : "unknown" });
    return null;
  }
}

export function resolveSkill(pathSlug: string, skillKey: string): { skill: Skill; address: SkillAddress } | null {
  const path = getPath(pathSlug);
  const skill = path ? findSkill(path, skillKey) : null;
  if (!path || !skill) return null;
  return { skill, address: { pathSlug: path.slug, pathVersion: path.version, skillKey: skill.key } };
}
