import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENT_DEFS,
  STAT_KEYS,
  achievementProgress,
  buildAchievementViews,
  isAchievementEarned,
  neededStats,
  newlyEarned,
  type AchievementStats,
} from "./achievements-catalog.ts";
import { awardAchievements, type AchievementPorts } from "./achievements-award.ts";

const ZERO: AchievementStats = {
  totalWords: 0, finishedTexts: 0, bestStreak: 0, bestSessionCount: 0, lessons: 0, reviewsTotal: 0, goalDays: 0, perfectWeeks: 0, chests: 0, totalXp: 0,
};

test("каталог: уникальные id, известные категории и показатели, все пять категорий непустые", () => {
  const ids = ACHIEVEMENT_DEFS.map((d) => d.id);
  assert.equal(new Set(ids).size, ids.length);
  const categories = new Set(ACHIEVEMENT_CATEGORIES.map((c) => c.id));
  for (const def of ACHIEVEMENT_DEFS) {
    assert.ok(categories.has(def.category), def.id);
    assert.ok(STAT_KEYS.includes(def.stat), def.id);
    assert.ok(Number.isInteger(def.target) && def.target > 0, def.id);
    assert.ok(def.title.length > 0 && def.description.length > 0, def.id);
  }
  for (const category of categories) assert.ok(ACHIEVEMENT_DEFS.some((d) => d.category === category), `в категории ${category} есть достижения`);
});

test("совместимость: прежние id и пороги сохранены", () => {
  const byId = new Map(ACHIEVEMENT_DEFS.map((d) => [d.id, d]));
  assert.deepEqual([byId.get("streak_7")?.stat, byId.get("streak_7")?.target], ["bestStreak", 7]);
  assert.deepEqual([byId.get("words_100")?.stat, byId.get("words_100")?.target], ["totalWords", 100]);
  assert.deepEqual([byId.get("first_book")?.stat, byId.get("first_book")?.target], ["finishedTexts", 1]);
  assert.deepEqual([byId.get("perfect_session")?.stat, byId.get("perfect_session")?.target], ["bestSessionCount", 20]);
});

test("условие: ровно на пороге выполнено, на единицу ниже — нет", () => {
  for (const def of ACHIEVEMENT_DEFS) {
    assert.equal(isAchievementEarned(def, { [def.stat]: def.target }), true, def.id);
    assert.equal(isAchievementEarned(def, { [def.stat]: def.target - 1 }), false, def.id);
    assert.equal(isAchievementEarned(def, {}), false, def.id);
  }
});

test("прогресс: не выше цели, не ниже нуля, битое значение — ноль", () => {
  const def = ACHIEVEMENT_DEFS.find((d) => d.id === "words_100")!;
  assert.deepEqual(achievementProgress(def, { totalWords: 40 }), { current: 40, target: 100, ratio: 0.4 });
  assert.equal(achievementProgress(def, { totalWords: 4000 }).current, 100);
  assert.equal(achievementProgress(def, { totalWords: -5 }).current, 0);
  assert.equal(achievementProgress(def, { totalWords: Number.NaN }).current, 0);
});

test("витрина: статусы earned / in_progress / locked; полученное остаётся полученным", () => {
  const views = buildAchievementViews({ ...ZERO, totalWords: 30, totalXp: 0 }, new Map([["first_book", "2026-11-01T10:00:00Z"]]));
  const get = (id: string) => views.find((v) => v.id === id)!;
  assert.equal(get("first_book").status, "earned");
  assert.equal(get("first_book").earnedAt, "2026-11-01T10:00:00Z");
  assert.equal(get("first_book").progress.ratio, 1, "условие сейчас не выполняется (finishedTexts 0), но факт получения в БД главный");
  assert.equal(get("words_100").status, "in_progress");
  assert.equal(get("words_10").status, "in_progress");
  assert.equal(get("xp_100").status, "locked");
  assert.equal(get("xp_100").earnedAt, null);
});

test("newlyEarned: уже полученные не возвращаются повторно", () => {
  const stats = { ...ZERO, totalXp: 600, lessons: 1 };
  const first = newlyEarned(stats, new Set()).map((d) => d.id).sort();
  assert.deepEqual(first, ["first_lesson", "xp_100", "xp_500"]);
  assert.deepEqual(newlyEarned(stats, new Set(first)), []);
});

test("neededStats: считаем только показатели ещё не полученных достижений", () => {
  const locked = ACHIEVEMENT_DEFS.filter((d) => d.stat === "lessons" || d.stat === "chests");
  assert.deepEqual(neededStats(locked).sort(), ["chests", "lessons"]);
  assert.deepEqual(neededStats([]), []);
});

// ---- выдача через порты ----

function memoryPorts(stats: Partial<AchievementStats>, initiallyEarned: string[] = []) {
  const earned = new Set(initiallyEarned);
  const loadCalls: string[][] = [];
  let inserted: string[] = [];
  const ports: AchievementPorts = {
    loadEarnedIds: async () => new Set(earned),
    loadStats: async (keys) => {
      loadCalls.push([...keys]);
      await Promise.resolve();
      return Object.fromEntries(keys.map((k) => [k, stats[k] ?? 0]));
    },
    // как unique + ignoreDuplicates: возвращает только реально вставленные
    insertEarned: async (ids) => {
      await Promise.resolve();
      const fresh = ids.filter((id) => !earned.has(id));
      for (const id of fresh) earned.add(id);
      inserted = [...inserted, ...fresh];
      return fresh;
    },
  };
  return { ports, earned, loadCalls, insertedLog: () => inserted };
}

test("выдача: новые достижения по реальным условиям записываются и возвращаются", async () => {
  const h = memoryPorts({ lessons: 5, totalXp: 120, bestStreak: 3 });
  const result = await awardAchievements(h.ports);
  assert.deepEqual(result.sort(), ["first_lesson", "lessons_5", "streak_3", "xp_100"]);
  assert.deepEqual([...h.earned].sort(), ["first_lesson", "lessons_5", "streak_3", "xp_100"]);
});

test("выдача: повторная проверка ничего не выдаёт заново", async () => {
  const h = memoryPorts({ lessons: 1, totalXp: 150 });
  assert.deepEqual((await awardAchievements(h.ports)).sort(), ["first_lesson", "xp_100"]);
  assert.deepEqual(await awardAchievements(h.ports), []);
  assert.equal(h.insertedLog().length, 2);
});

test("выдача: параллельные проверки — каждое достижение «новое» ровно для одной", async () => {
  const h = memoryPorts({ lessons: 25, totalXp: 5000, totalWords: 500, bestStreak: 100 });
  const results = await Promise.all(Array.from({ length: 6 }, () => awardAchievements(h.ports)));
  const flat = results.flat();
  assert.equal(new Set(flat).size, flat.length, "ни одно достижение не выдано дважды");
  assert.equal(h.insertedLog().length, new Set(h.insertedLog()).size);
  assert.ok(flat.includes("xp_5000") && flat.includes("lessons_25"));
});

test("выдача: ничего не выполнено — записи нет; всё получено — показатели не считаются", async () => {
  const none = memoryPorts({});
  assert.deepEqual(await awardAchievements(none.ports), []);
  assert.deepEqual(none.insertedLog(), []);

  const all = memoryPorts({ totalXp: 99999 }, ACHIEVEMENT_DEFS.map((d) => d.id));
  assert.deepEqual(await awardAchievements(all.ports), []);
  assert.equal(all.loadCalls.length, 0, "нечего проверять — запросов к БД нет");
});

test("выдача: запрашиваются только показатели не полученных достижений", async () => {
  const h = memoryPorts({ lessons: 1 }, ACHIEVEMENT_DEFS.filter((d) => d.stat !== "lessons").map((d) => d.id));
  assert.deepEqual(await awardAchievements(h.ports), ["first_lesson"]);
  assert.deepEqual(h.loadCalls, [["lessons"]]);
});
