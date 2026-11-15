import { test } from "node:test";
import assert from "node:assert/strict";
import {
  allQuestsComplete,
  generateQuestTargets,
  longestCorrectStreak,
  type DailyQuestDef,
  CHEST_XP,
  buildQuestItems,
  claimChestWith,
  generateDailyQuests,
  questProgressFromActivity,
  questStatus,
  questTitle,
  seededRandom,
  QUEST_TYPES,
  QUESTS_PER_DAY,
  type ChestPorts,
  type DailyQuestProgress,
} from "./daily-quests.ts";
import { awardXp } from "./xp/award.ts";
import { MemoryLedger } from "./xp/testing/memory-ledger.ts";
import type { DailyActivity } from "./goals/activity.ts";


test("longestCorrectStreak: all correct", () => {
  assert.equal(longestCorrectStreak([2, 3, 2, 3]), 4);
});

test("longestCorrectStreak: resets on a wrong grade (0 or 1)", () => {
  assert.equal(longestCorrectStreak([2, 2, 0, 2, 2, 2, 1, 2]), 3);
});

test("longestCorrectStreak: empty history", () => {
  assert.equal(longestCorrectStreak([]), 0);
});

test("longestCorrectStreak: never a single correct grade", () => {
  assert.equal(longestCorrectStreak([0, 1, 0]), 0);
});

test("longestCorrectStreak: best run can be at the end", () => {
  assert.equal(longestCorrectStreak([2, 0, 2, 2, 2, 2]), 4);
});

test("generateQuestTargets: deterministic with injected rand, within documented ranges", () => {
  const defs = generateQuestTargets(() => 0);
  const byType = new Map(defs.map((d) => [d.questType, d.target]));
  assert.equal(byType.get("read_minutes"), 5);
  assert.equal(byType.get("review_words"), 10);
  assert.equal(byType.get("combo_streak"), 3);

  const defsMax = generateQuestTargets(() => 0.999);
  const byTypeMax = new Map(defsMax.map((d) => [d.questType, d.target]));
  assert.equal(byTypeMax.get("read_minutes"), 15);
  assert.equal(byTypeMax.get("review_words"), 20);
  assert.equal(byTypeMax.get("combo_streak"), 7);
});

test("generateQuestTargets: always exactly the 3 distinct quest types", () => {
  const defs = generateQuestTargets(() => 0.5);
  assert.equal(defs.length, 3);
  assert.deepEqual(
    new Set(defs.map((d) => d.questType)),
    new Set(["read_minutes", "review_words", "combo_streak"]),
  );
});

test("allQuestsComplete: true only when every quest's progress meets its target", () => {
  const defs: DailyQuestDef[] = [
    { questType: "read_minutes", target: 10 },
    { questType: "review_words", target: 15 },
    { questType: "combo_streak", target: 5 },
  ];
  assert.equal(allQuestsComplete(defs, { read_minutes: 10, review_words: 15, combo_streak: 5 }), true);
  assert.equal(allQuestsComplete(defs, { read_minutes: 20, review_words: 20, combo_streak: 10 }), true);
  assert.equal(allQuestsComplete(defs, { read_minutes: 9, review_words: 15, combo_streak: 5 }), false);
});

test("allQuestsComplete: false when nothing started", () => {
  const defs: DailyQuestDef[] = [
    { questType: "read_minutes", target: 10 },
    { questType: "review_words", target: 15 },
    { questType: "combo_streak", target: 5 },
  ];
  assert.equal(allQuestsComplete(defs, { read_minutes: 0, review_words: 0, combo_streak: 0 }), false);
});

// ---------- Iteration 6: детерминированный набор, статусы, сундук ----------

const ZERO: DailyQuestProgress = { read_minutes: 0, review_words: 0, combo_streak: 0, earn_xp: 0, complete_lessons: 0, answer_exercises: 0 };

test("seededRandom: одно зерно — одна последовательность, разные зёрна расходятся, значения в [0,1)", () => {
  const a = seededRandom("u1:2026-11-14");
  const b = seededRandom("u1:2026-11-14");
  const seqA = Array.from({ length: 20 }, a);
  assert.deepEqual(seqA, Array.from({ length: 20 }, b));
  assert.notDeepEqual(seqA, Array.from({ length: 20 }, seededRandom("u1:2026-11-15")));
  for (const v of seqA) assert.ok(v >= 0 && v < 1);
});

test("generateDailyQuests: стабилен для (пользователь, день) — параллельные первые заходы пишут одно и то же", () => {
  const first = generateDailyQuests("user-1", "2026-11-14", { lessonsAvailable: true });
  for (let i = 0; i < 25; i++) assert.deepEqual(generateDailyQuests("user-1", "2026-11-14", { lessonsAvailable: true }), first);
});

test("generateDailyQuests: всегда 3 разных задания, чтение и повторение постоянны, цели в диапазонах", () => {
  const ranges: Record<string, [number, number]> = {
    read_minutes: [5, 15], review_words: [10, 20], combo_streak: [3, 7], earn_xp: [30, 80], complete_lessons: [1, 2], answer_exercises: [8, 20],
  };
  const challenges = new Set<string>();
  for (let n = 0; n < 300; n++) {
    const defs = generateDailyQuests(`user-${n}`, "2026-11-14", { lessonsAvailable: true });
    assert.equal(defs.length, QUESTS_PER_DAY);
    assert.equal(new Set(defs.map((d) => d.questType)).size, QUESTS_PER_DAY);
    assert.equal(defs[0].questType, "read_minutes");
    assert.equal(defs[1].questType, "review_words");
    challenges.add(defs[2].questType);
    for (const d of defs) {
      const [min, max] = ranges[d.questType];
      assert.ok(d.target >= min && d.target <= max, `${d.questType}=${d.target}`);
      assert.ok(QUEST_TYPES.includes(d.questType));
    }
  }
  assert.deepEqual([...challenges].sort(), ["answer_exercises", "combo_streak", "complete_lessons", "earn_xp"], "все типы заданий-вызовов реально встречаются");
});

test("generateDailyQuests: без уроков не выдаёт заданий по урокам и упражнениям", () => {
  for (let n = 0; n < 300; n++) {
    const defs = generateDailyQuests(`user-${n}`, "2026-11-14", { lessonsAvailable: false });
    assert.ok(!defs.some((d) => d.questType === "complete_lessons" || d.questType === "answer_exercises"));
  }
});

test("generateDailyQuests: XP-цели кратны 10, упражнения — чётные", () => {
  for (let n = 0; n < 200; n++) {
    for (const d of generateDailyQuests(`u${n}`, "2026-11-14", { lessonsAvailable: true })) {
      if (d.questType === "earn_xp") assert.equal(d.target % 10, 0);
      if (d.questType === "answer_exercises") assert.equal(d.target % 2, 0);
    }
  }
});

test("generateQuestTargets: явное задание-вызов подставляется третьим", () => {
  const defs = generateQuestTargets(() => 0, "earn_xp");
  assert.deepEqual(defs[2], { questType: "earn_xp", target: 30 });
});

test("questProgressFromActivity: каждое задание берёт свою метрику активности", () => {
  const progress = questProgressFromActivity({ readingMinutes: 7, reviewedWords: 12, correctStreak: 4, xp: 55, lessons: 2, exercises: 14 });
  assert.deepEqual(progress, { read_minutes: 7, review_words: 12, combo_streak: 4, earn_xp: 55, complete_lessons: 2, answer_exercises: 14 });
});

test("allQuestsComplete: пустой набор не считается выполненным (сундук не открывается при сбое генерации)", () => {
  assert.equal(allQuestsComplete([], ZERO), false);
});

test("questStatus: жизненный цикл Available → In Progress → Completed → Reward Claimed; прошедший день — Expired", () => {
  const base = { target: 10, day: "2026-11-14", today: "2026-11-14", claimed: false };
  assert.equal(questStatus({ ...base, current: 0 }), "available");
  assert.equal(questStatus({ ...base, current: 3 }), "in_progress");
  assert.equal(questStatus({ ...base, current: 10 }), "completed");
  assert.equal(questStatus({ ...base, current: 12 }), "completed");
  assert.equal(questStatus({ ...base, current: 10, claimed: true }), "claimed");
  const past = { ...base, day: "2026-11-13" };
  assert.equal(questStatus({ ...past, current: 4 }), "expired");
  assert.equal(questStatus({ ...past, current: 10 }), "expired", "выполнено, но сундук не забран до полуночи — награда сгорела");
  assert.equal(questStatus({ ...past, current: 10, claimed: true }), "claimed", "забранное остаётся забранным");
});

test("buildQuestItems: прогресс ограничен целью, статусы по каждому заданию", () => {
  const items = buildQuestItems(
    [{ questType: "read_minutes", target: 10 }, { questType: "review_words", target: 15 }, { questType: "combo_streak", target: 5 }],
    { ...ZERO, read_minutes: 40, review_words: 3 },
    { day: "2026-11-14", today: "2026-11-14", claimed: false },
  );
  assert.deepEqual(items.map((i) => [i.current, i.done, i.status]), [[10, true, "completed"], [3, false, "in_progress"], [0, false, "available"]]);
});

test("questTitle: русские формы", () => {
  assert.equal(questTitle("read_minutes", 5), "Прочитать 5 минут");
  assert.equal(questTitle("review_words", 12), "Повторить 12 слов");
  assert.equal(questTitle("complete_lessons", 1), "Пройти 1 урок");
  assert.equal(questTitle("complete_lessons", 2), "Пройти 2 урока");
  assert.equal(questTitle("answer_exercises", 8), "Выполнить 8 упражнений");
  assert.equal(questTitle("earn_xp", 50), "Заработать 50 XP");
  assert.equal(questTitle("combo_streak", 5), "5 верных подряд");
});

// ---- сундук: порты в памяти, награда идёт через настоящий awardXp + журнал в памяти ----

const DONE: DailyActivity = { day: "2026-11-14", xp: 90, readingMinutes: 15, reviewedWords: 20, correctStreak: 7, lessons: 2, exercises: 20 };
const DEFS = [
  { questType: "read_minutes", target: 10 },
  { questType: "review_words", target: 15 },
  { questType: "combo_streak", target: 5 },
] as const;
const NOW = new Date("2026-11-14T12:00:00Z");

function chestHarness(overrides: { activity?: Partial<DailyActivity>; claimedDate?: string | null; timezone?: string | null } = {}) {
  const ledger = new MemoryLedger();
  ledger.addProfile("u1", { today: "2026-11-14" });
  const profile = { claimedDate: overrides.claimedDate ?? null, language: "en", timezone: overrides.timezone ?? null, freeze: false, boostUntil: null as string | null };
  const markCalls: string[] = [];
  const ports: ChestPorts = {
    loadProfile: async () => ({ claimedDate: profile.claimedDate, language: profile.language, timezone: profile.timezone }),
    loadDefs: async () => DEFS.map((d) => ({ ...d })),
    loadActivity: async (_u, day) => ({ ...DONE, ...overrides.activity, day }),
    award: (userId, day) => awardXp(userId, { source: "quest_chest", ref: day }, ledger.rpc),
    // условная запись: выигрывает только первый, у кого отметки за день ещё нет
    markClaimed: async (_u, day, boostUntil) => {
      await Promise.resolve();
      if (profile.claimedDate === day) return false;
      profile.claimedDate = day;
      profile.freeze = true;
      profile.boostUntil = boostUntil;
      markCalls.push(day);
      return true;
    },
  };
  return { ledger, profile, ports, markCalls };
}

test("сундук: все задания выполнены → +30 XP, заморозка и Double-XP на 15 минут, один раз", async () => {
  const h = chestHarness();
  const result = await claimChestWith(h.ports, "u1", NOW);
  assert.equal(result.ok, true);
  assert.equal(result.xpAwarded, CHEST_XP);
  assert.equal(result.boostUntil, new Date(NOW.getTime() + 15 * 60_000).toISOString());
  assert.equal(h.ledger.totalXp("u1"), 30);
  assert.equal(h.profile.freeze, true);
  assert.equal(h.profile.claimedDate, "2026-11-14");
});

test("сундук: повторный запрос не начисляет второй раз", async () => {
  const h = chestHarness();
  assert.equal((await claimChestWith(h.ports, "u1", NOW)).ok, true);
  const second = await claimChestWith(h.ports, "u1", NOW);
  assert.equal(second.ok, false);
  assert.match(second.error ?? "", /уже открыт/);
  assert.equal(h.ledger.totalXp("u1"), 30);
  assert.equal(h.ledger.events.filter((e) => e.source === "quest_chest").length, 1);
});

test("сундук: две параллельные вкладки — XP и награда профиля ровно один раз", async () => {
  const h = chestHarness();
  const results = await Promise.all(Array.from({ length: 5 }, () => claimChestWith(h.ports, "u1", NOW)));
  assert.equal(results.filter((r) => r.ok).length, 1);
  assert.equal(h.ledger.totalXp("u1"), 30);
  assert.equal(h.ledger.events.filter((e) => e.source === "quest_chest").length, 1);
  assert.equal(h.markCalls.length, 1);
});

test("сундук: не выполнены все задания — отказ, XP не начисляется", async () => {
  const h = chestHarness({ activity: { readingMinutes: 3 } });
  const result = await claimChestWith(h.ports, "u1", NOW);
  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /Не все задания/);
  assert.equal(h.ledger.events.length, 0);
  assert.equal(h.profile.freeze, false);
});

test("сундук: сбой хранилища XP — ничего не отмечается, повтор проходит", async () => {
  const h = chestHarness();
  h.ledger.failNext = 1;
  const failed = await claimChestWith(h.ports, "u1", NOW);
  assert.equal(failed.ok, false);
  assert.equal(h.profile.claimedDate, null, "отметка не ставится без начисленного XP");
  const retry = await claimChestWith(h.ports, "u1", NOW);
  assert.equal(retry.ok, true);
  assert.equal(h.ledger.totalXp("u1"), 30);
});

test("сундук: сбой между начислением и отметкой профиля — повтор дописывает награду без второго XP", async () => {
  const h = chestHarness();
  const realMark = h.ports.markClaimed;
  let crash = true;
  h.ports.markClaimed = async (u, d, b) => {
    if (crash) {
      crash = false;
      throw new Error("процесс упал");
    }
    return realMark(u, d, b);
  };
  await assert.rejects(() => claimChestWith(h.ports, "u1", NOW));
  assert.equal(h.ledger.totalXp("u1"), 30);
  assert.equal(h.profile.freeze, false);
  const retry = await claimChestWith(h.ports, "u1", NOW);
  assert.equal(retry.ok, true);
  assert.equal(h.ledger.totalXp("u1"), 30, "XP не удвоился");
  assert.equal(h.profile.freeze, true);
  assert.equal(h.profile.claimedDate, "2026-11-14");
});

test("сундук: прежняя отметка профиля за сегодня (аккаунт до журнала XP) блокирует повтор", async () => {
  const h = chestHarness({ claimedDate: "2026-11-14" });
  const result = await claimChestWith(h.ports, "u1", NOW);
  assert.equal(result.ok, false);
  assert.equal(h.ledger.events.length, 0);
});

test("сундук: день — по поясу пользователя (вечером по UTC в Токио уже следующий день)", async () => {
  const h = chestHarness({ timezone: "Asia/Tokyo", claimedDate: "2026-11-14" });
  h.ledger.addProfile("u1", { today: "2026-11-15" });
  const result = await claimChestWith(h.ports, "u1", new Date("2026-11-14T20:00:00Z"));
  assert.equal(result.ok, true, "отметка за 14-е не мешает забрать сундук за 15-е");
  assert.equal(h.profile.claimedDate, "2026-11-15");
});

test("сундук: нет профиля — отказ без начисления", async () => {
  const h = chestHarness();
  h.ports.loadProfile = async () => null;
  const result = await claimChestWith(h.ports, "u1", NOW);
  assert.equal(result.ok, false);
  assert.equal(h.ledger.events.length, 0);
});
