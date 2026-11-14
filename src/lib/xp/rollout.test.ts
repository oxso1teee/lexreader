import { test } from "node:test";
import assert from "node:assert/strict";
import { OVERLAP_CACHE_MS, NO_PENDING_XP, createPhaseSource, loadPendingXp, parseRewardsPhase } from "./rollout.ts";
import { LEGACY_CHALLENGE, generateDailyQuests } from "../daily-quests.ts";

// Барьер выкладки на стороне приложения: фаза читается осторожно (всё, кроме явного «live», — overlap),
// «live» необратим и кэшируется навсегда, сбой чтения не кэшируется; в overlap выдаются только прежние типы
// заданий. SQL-часть барьера проверяет supabase/tests/run-local.sh.

test("parseRewardsPhase: только точное «live» включает live; мусор, null и ошибка — осторожный overlap", () => {
  assert.equal(parseRewardsPhase("live"), "live");
  for (const value of ["overlap", "LIVE", " live", "", null, undefined, 1, true, {}, ["live"]]) assert.equal(parseRewardsPhase(value), "overlap", String(value));
});

test("createPhaseSource: overlap кэшируется на короткий срок, потом перечитывается; live — навсегда", async () => {
  let now = 1_000;
  let reads = 0;
  let answer: unknown = "overlap";
  const phase = createPhaseSource(async () => (reads++, answer), () => now);
  assert.equal(await phase(), "overlap");
  assert.equal(await phase(), "overlap");
  assert.equal(reads, 1, "второй вызов — из кэша");
  now += OVERLAP_CACHE_MS - 1;
  await phase();
  assert.equal(reads, 1, "кэш ещё действует");
  answer = "live";
  now += 2;
  assert.equal(await phase(), "live", "после срока перечитано");
  assert.equal(reads, 2);
  answer = "overlap"; // откат невозможен: live необратим, и кэш ему доверяет
  now += 10 * OVERLAP_CACHE_MS;
  assert.equal(await phase(), "live");
  assert.equal(reads, 2, "live больше не читается");
});

test("createPhaseSource: сбой чтения → overlap, не кэшируется и не бросает", async () => {
  let fail = true;
  let reads = 0;
  const phase = createPhaseSource(async () => {
    reads++;
    if (fail) throw new Error("db down");
    return "live";
  }, () => 5_000);
  assert.equal(await phase(), "overlap");
  assert.equal(await phase(), "overlap");
  assert.equal(reads, 2, "сбой не запоминается — следующий вызов пробует снова");
  fail = false;
  assert.equal(await phase(), "live");
});

test("loadPendingXp: в live запроса нет; в overlap суммирует по дням, мусорные строки пропускает, ошибка чтения не роняет", async () => {
  const calls: string[] = [];
  const client = (result: { data: unknown; error: { message: string } | null }) => {
    const query: Record<string, unknown> = {};
    query.select = (columns: string) => (calls.push(`select ${columns}`), query);
    query.eq = (column: string, value: unknown) => (calls.push(`eq ${column}=${String(value)}`), query);
    query.then = (resolve: (value: unknown) => unknown) => resolve(result);
    return { from: (table: string) => (calls.push(`from ${table}`), query) } as never;
  };
  assert.equal(await loadPendingXp(client({ data: [], error: null }), "u1", "live"), NO_PENDING_XP);
  assert.deepEqual(calls, [], "в live база не опрашивается");

  const rows = [
    { day: "2026-11-14", amount: 5 },
    { day: "2026-11-14", amount: 7 },
    { day: "2026-11-13", amount: 2 },
    { day: "2026-11-14", amount: -9 }, // не бывает — отброшено
    { day: 5, amount: 3 }, // не бывает — отброшено
    { day: "2026-11-14", amount: 1.5 }, // не бывает — отброшено
  ];
  const pending = await loadPendingXp(client({ data: rows, error: null }), "u1", "overlap");
  assert.equal(pending.total, 14);
  assert.equal(pending.byDay.get("2026-11-14"), 12);
  assert.equal(pending.byDay.get("2026-11-13"), 2);
  assert.deepEqual(calls, ["from xp_events", "select day, amount", "eq user_id=u1", "eq applied=false"]);

  assert.equal(await loadPendingXp(client({ data: null, error: { message: "boom" } }), "u1", "overlap"), NO_PENDING_XP);
  // фаза берётся из источника, если не передана
  calls.length = 0;
  assert.equal(await loadPendingXp(client({ data: rows, error: null }), "u1", undefined, async () => "live"), NO_PENDING_XP);
  assert.deepEqual(calls, []);
});

test("задания в overlap: только прежние типы (старый интерфейс не умеет показывать новые) — для любого пользователя и дня", () => {
  const legacy = new Set(["read_minutes", "review_words", "combo_streak"]);
  assert.equal(LEGACY_CHALLENGE, "combo_streak");
  for (let i = 0; i < 400; i++) {
    for (const lessonsAvailable of [true, false]) {
      const defs = generateDailyQuests(`user-${i}`, `2026-11-${String((i % 28) + 1).padStart(2, "0")}`, { lessonsAvailable, legacyTypesOnly: true });
      assert.equal(defs.length, 3);
      for (const def of defs) assert.ok(legacy.has(def.questType), `${def.questType} не должен выдаваться в overlap`);
    }
  }
  // в live набор шире — иначе флаг ничего бы не проверял
  const seen = new Set<string>();
  for (let i = 0; i < 400; i++) for (const def of generateDailyQuests(`user-${i}`, "2026-11-14", { lessonsAvailable: true })) seen.add(def.questType);
  assert.ok(seen.has("earn_xp") && seen.has("complete_lessons") && seen.has("answer_exercises"));
  // цели в overlap те же, что и раньше: набор не зависит от флага, кроме типа задания-вызова
  const a = generateDailyQuests("u", "2026-11-14", { lessonsAvailable: true, legacyTypesOnly: true });
  const b = generateDailyQuests("u", "2026-11-14", { lessonsAvailable: true, legacyTypesOnly: true });
  assert.deepEqual(a, b, "детерминированность сохранена");
});
