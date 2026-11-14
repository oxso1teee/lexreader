import { test } from "node:test";
import assert from "node:assert/strict";
import { awardXp, parseAwardResponse, toAddXpResult } from "./award.ts";
import { MemoryLedger } from "./testing/memory-ledger.ts";

const U = "user-1";
function setup(profile = {}) {
  const ledger = new MemoryLedger();
  ledger.addProfile(U, profile);
  return ledger;
}

test("начисление: сумма из каталога, журнал, profile.xp и день обновлены вместе", async () => {
  const ledger = setup();
  const outcome = await awardXp(U, { source: "lesson_complete", ref: "attempt-1", amount: 20 }, ledger.rpc);
  assert.equal(outcome.status, "awarded");
  assert.ok(outcome.status === "awarded");
  assert.equal(outcome.result.awarded, 20);
  assert.deepEqual(outcome.result.total, { before: 0, after: 20 });
  assert.deepEqual(outcome.result.today, { before: 0, after: 20 });
  assert.equal(outcome.result.goal, 50);
  assert.equal(outcome.result.day, "2026-11-14");
  assert.equal(ledger.totalXp(U), 20);
  assert.equal(ledger.dayXp(U, "2026-11-14"), 20);
  assert.equal(ledger.events.length, 1);
});

test("повторный запрос с тем же ключом: duplicate, XP не меняется", async () => {
  const ledger = setup();
  await awardXp(U, { source: "lesson_complete", ref: "attempt-1", amount: 20 }, ledger.rpc);
  const again = await awardXp(U, { source: "lesson_complete", ref: "attempt-1", amount: 20 }, ledger.rpc);
  assert.deepEqual(again, { status: "duplicate", awarded: 20 });
  assert.equal(ledger.totalXp(U), 20);
  assert.equal(ledger.events.length, 1);
  assert.equal(toAddXpResult(again), null, "повтор не порождает моментов");
});

test("тот же ключ у РАЗНЫХ источников — разные события; у разных пользователей — тоже", async () => {
  const ledger = setup();
  ledger.addProfile("user-2");
  assert.equal((await awardXp(U, { source: "lesson_complete", ref: "x", amount: 15 }, ledger.rpc)).status, "awarded");
  assert.equal((await awardXp(U, { source: "duel_win", ref: "x", amount: 25 }, ledger.rpc)).status, "awarded");
  assert.equal((await awardXp("user-2", { source: "lesson_complete", ref: "x", amount: 15 }, ledger.rpc)).status, "awarded");
  assert.equal(ledger.totalXp(U), 40);
  assert.equal(ledger.totalXp("user-2"), 15);
});

test("параллельные запросы: один ключ — одно начисление; разные — все, без потерянных обновлений", async () => {
  const ledger = setup();
  const same = await Promise.all(Array.from({ length: 10 }, () => awardXp(U, { source: "quest_chest", ref: "{day}" }, ledger.rpc)));
  assert.equal(same.filter((o) => o.status === "awarded").length, 1);
  assert.equal(same.filter((o) => o.status === "duplicate").length, 9);
  assert.equal(ledger.totalXp(U), 30);

  const distinct = await Promise.all(Array.from({ length: 40 }, (_, i) => awardXp(U, { source: "review_card", ref: `log-${i}` }, ledger.rpc)));
  assert.ok(distinct.every((o) => o.status === "awarded"));
  assert.equal(ledger.totalXp(U), 70);
  assert.equal(ledger.dayXp(U, "2026-11-14"), 70);
});

test("{day} в ключе: «один раз в день» — на следующий день снова можно", async () => {
  const ledger = setup();
  assert.equal((await awardXp(U, { source: "reading_session", ref: "text-1:{day}" }, ledger.rpc)).status, "awarded");
  assert.equal((await awardXp(U, { source: "reading_session", ref: "text-1:{day}" }, ledger.rpc)).status, "duplicate");
  assert.equal((await awardXp(U, { source: "reading_session", ref: "text-2:{day}" }, ledger.rpc)).status, "awarded", "другой текст — отдельная награда");
  ledger.profiles.get(U)!.today = "2026-11-15";
  assert.equal((await awardXp(U, { source: "reading_session", ref: "text-1:{day}" }, ledger.rpc)).status, "awarded");
});

test("дневной лимит источника: после потолка — capped; новый день — лимит свежий", async () => {
  const ledger = setup();
  for (let i = 0; i < 12; i++) assert.equal((await awardXp(U, { source: "combo_bonus", ref: `c-${i}` }, ledger.rpc)).status, "awarded", `combo ${i}`);
  const over = await awardXp(U, { source: "combo_bonus", ref: "c-12" }, ledger.rpc);
  assert.deepEqual(over, { status: "capped" });
  assert.equal(ledger.totalXp(U), 60);
  ledger.profiles.get(U)!.today = "2026-11-15";
  assert.equal((await awardXp(U, { source: "combo_bonus", ref: "c-12" }, ledger.rpc)).status, "awarded");
});

async function spend(ledger: MemoryLedger, source: "combo_bonus", count: number, tag: string): Promise<number> {
  let awarded = 0;
  for (let i = 0; i < count; i++) {
    const outcome = await awardXp(U, { source, ref: `${tag}-${i}` }, ledger.rpc);
    if (outcome.status === "awarded") awarded++;
  }
  return awarded;
}

test("скользящий лимит: «перебрасывание» календарной даты дневных лимитов сверх двух за 24 часа не даёт", async () => {
  const ledger = setup();
  let clock = Date.parse("2026-11-14T10:00:00Z");
  ledger.now = () => clock;
  // combo_bonus: 5 XP, потолок дня 60 → 12 начислений; за 24 часа — не больше 24
  assert.equal(await spend(ledger, "combo_bonus", 14, "d14"), 12, "лимит первой даты");
  ledger.profiles.get(U)!.today = "2026-11-15"; // пояс «перебросили» на следующую дату
  assert.equal(await spend(ledger, "combo_bonus", 14, "d15"), 12, "вторая дата — как честный стык двух дней");
  ledger.profiles.get(U)!.today = "2026-11-16"; // и ещё дальше
  assert.equal(await spend(ledger, "combo_bonus", 14, "d16"), 0, "третья дата за те же сутки — отказ");
  const refusal = await awardXp(U, { source: "combo_bonus", ref: "d16-x" }, ledger.rpc);
  assert.deepEqual(refusal, { status: "capped" });
  assert.equal(ledger.totalXp(U), 120);
  // сутки спустя окно освободилось
  clock += 24 * 3_600_000 + 1;
  assert.equal(await spend(ledger, "combo_bonus", 14, "later"), 12);
});

test("скользящий лимит не мешает честному стыку двух локальных дней", async () => {
  const ledger = setup();
  const t0 = Date.parse("2026-11-14T22:00:00Z");
  ledger.now = () => t0;
  assert.equal(await spend(ledger, "combo_bonus", 12, "evening"), 12, "вечером лимит выбран");
  ledger.now = () => t0 + 2 * 3_600_000; // два часа спустя уже новая локальная дата
  ledger.profiles.get(U)!.today = "2026-11-15";
  assert.equal(await spend(ledger, "combo_bonus", 14, "night"), 12, "сразу после полуночи свежий дневной лимит");
  assert.equal(ledger.totalXp(U), 120);
});

test("скользящий лимит действует по источникам независимо, а источники без потолка им не затронуты", async () => {
  const ledger = setup();
  ledger.now = () => Date.parse("2026-11-14T10:00:00Z");
  await spend(ledger, "combo_bonus", 12, "a");
  ledger.profiles.get(U)!.today = "2026-11-15";
  await spend(ledger, "combo_bonus", 12, "b");
  ledger.profiles.get(U)!.today = "2026-11-16";
  assert.equal((await awardXp(U, { source: "word_saved", ref: "w-1" }, ledger.rpc)).status, "awarded");
  assert.equal((await awardXp(U, { source: "lesson_complete", ref: "l-1", amount: 15 }, ledger.rpc)).status, "awarded");
  assert.equal((await awardXp(U, { source: "quest_chest", ref: "2026-11-16" }, ledger.rpc)).status, "awarded");
});

test("Double-XP: удваивается начисление, а лимит и журнал считают базовую сумму", async () => {
  const ledger = setup({ boostUntil: Date.now() + 60_000 });
  const outcome = await awardXp(U, { source: "word_saved", ref: "w1" }, ledger.rpc);
  assert.ok(outcome.status === "awarded");
  assert.equal(outcome.result.awarded, 4);
  assert.equal(outcome.result.boosted, true);
  assert.equal(outcome.base, 2);
  assert.equal(ledger.events[0].base, 2);
  const expired = setup({ boostUntil: Date.now() - 1 });
  const plain = await awardXp(U, { source: "word_saved", ref: "w1" }, expired.rpc);
  assert.ok(plain.status === "awarded" && plain.result.awarded === 2 && plain.result.boosted === false);
});

test("невалидный источник/сумма/ключ отклоняются до обращения к БД", async () => {
  const ledger = setup();
  const bad = [
    { source: "hack", ref: "x", amount: 1 },
    { source: "review_card", ref: "x", amount: 99 },
    { source: "lesson_complete", ref: "x" },
    { source: "lesson_complete", amount: 15 },
    { source: "lesson_complete", ref: "", amount: 15 },
  ];
  for (const request of bad) {
    const outcome = await awardXp(U, request, ledger.rpc);
    assert.equal(outcome.status, "rejected", JSON.stringify(request));
  }
  assert.equal(ledger.calls, 0, "в БД ни одного обращения");
  assert.equal(ledger.totalXp(U), 0);
});

test("профиль не найден — no_profile, ничего не записано", async () => {
  const ledger = new MemoryLedger();
  assert.deepEqual(await awardXp("ghost", { source: "review_card", ref: "x" }, ledger.rpc), { status: "no_profile" });
  assert.equal(ledger.events.length, 0);
});

test("ошибка хранилища: failed, ничего не записано, повтор после сбоя проходит ровно один раз", async () => {
  const ledger = setup();
  ledger.failNext = 1;
  const failed = await awardXp(U, { source: "lesson_complete", ref: "attempt-9", amount: 15 }, ledger.rpc);
  assert.deepEqual(failed, { status: "failed" });
  assert.equal(ledger.totalXp(U), 0);
  assert.equal(ledger.events.length, 0);

  const retry = await awardXp(U, { source: "lesson_complete", ref: "attempt-9", amount: 15 }, ledger.rpc);
  assert.equal(retry.status, "awarded");
  const again = await awardXp(U, { source: "lesson_complete", ref: "attempt-9", amount: 15 }, ledger.rpc);
  assert.equal(again.status, "duplicate");
  assert.equal(ledger.totalXp(U), 15);
});

test("исключение транспорта (сеть) превращается в failed, а не бросается наружу", async () => {
  const outcome = await awardXp(U, { source: "review_card", ref: "x" }, async () => {
    throw new Error("socket hang up");
  });
  assert.deepEqual(outcome, { status: "failed" });
});

test("parseAwardResponse: неожиданная форма ответа — failed, а не угаданный успех", () => {
  for (const data of [null, undefined, "ok", 5, [], {}, { status: 7 }, { status: "weird" }, { status: "awarded" }, { status: "awarded", awarded: "20" }]) {
    assert.deepEqual(parseAwardResponse(data, 1), { status: "failed" }, JSON.stringify(data));
  }
  assert.deepEqual(parseAwardResponse({ status: "duplicate", awarded: 5 }, 1), { status: "duplicate", awarded: 5 });
  assert.deepEqual(parseAwardResponse({ status: "capped" }, 1), { status: "capped" });
});

test("toAddXpResult: результат только у реального начисления", async () => {
  const ledger = setup();
  const outcome = await awardXp(U, { source: "review_card", ref: "l1" }, ledger.rpc);
  const result = toAddXpResult(outcome);
  assert.ok(result && result.awarded === 1 && result.day === "2026-11-14");
  for (const status of ["duplicate", "capped", "failed", "no_profile"] as const) {
    assert.equal(toAddXpResult({ status } as never), null);
  }
});

test("goal_met следует выбранному типу цели: XP-цель закрывается внутри начисления, остальные — нет", async () => {
  const xpGoal = setup({ goal: 20, goalType: "xp" });
  const first = await awardXp(U, { source: "lesson_complete", ref: "a", amount: 20 }, xpGoal.rpc);
  assert.ok(first.status === "awarded" && first.result.goal === 20);
  assert.equal(xpGoal.goalMet(U, "2026-11-14"), true);

  const lessonsGoal = setup({ goal: 20, goalType: "lessons" });
  const second = await awardXp(U, { source: "lesson_complete", ref: "a", amount: 20 }, lessonsGoal.rpc);
  assert.ok(second.status === "awarded");
  assert.equal(second.result.goal, 0, "XP-момент «цель выполнена» для чужой цели подавлен");
  assert.equal(lessonsGoal.goalMet(U, "2026-11-14"), false, "XP сверх XP-цели не закрывает цель «уроки»");
  assert.equal(lessonsGoal.markGoalMet(U, "2026-11-14"), true, "серверный код закрывает её по фактам");
  assert.equal(lessonsGoal.markGoalMet(U, "2026-11-14"), false, "повтор ничего не меняет");
});

test("goal_met только растёт: повышение XP-цели и смена типа выполненный день не отменяют", async () => {
  const ledger = setup({ goal: 20, goalType: "xp" });
  await awardXp(U, { source: "lesson_complete", ref: "a", amount: 20 }, ledger.rpc);
  ledger.profiles.get(U)!.goal = 120;
  await awardXp(U, { source: "lesson_complete", ref: "b", amount: 15 }, ledger.rpc);
  assert.equal(ledger.goalMet(U, "2026-11-14"), true);
  ledger.profiles.get(U)!.goalType = "words";
  await awardXp(U, { source: "lesson_complete", ref: "c", amount: 15 }, ledger.rpc);
  assert.equal(ledger.goalMet(U, "2026-11-14"), true);
  assert.equal(ledger.markGoalMet(U, "2026-11-14"), false);
});
