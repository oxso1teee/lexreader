import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { awardXp } from "./award.ts";
import {
  COMBO_SIZE,
  PERFECT_MIN_CARDS,
  SESSION_GAP_MS,
  activeComboState,
  comboBlockRefs,
  currentSession,
  isUndoable,
  nextUnawardedBlock,
  perfectSession,
  isSameLocalDay,
  reviewSlotDay,
  reviewSlotRef,
  type ReviewLogRow,
} from "./review-bonuses.ts";
import { MemoryLedger } from "./testing/memory-ledger.ts";

const T0 = Date.parse("2026-11-14T10:00:00Z");
const STEP = 20_000; // карточка — 20 секунд
const rows = (grades: number[], startAt = T0, prefix = "r"): ReviewLogRow[] =>
  grades.map((grade, i) => ({ id: `${prefix}${i + 1}`, grade, at: startAt + i * STEP }));
/** Следующая сессия начинается через gapMs после последней оценки предыдущей. */
const then = (previous: ReviewLogRow[], grades: number[], gapMs: number, prefix: string): ReviewLogRow[] => [
  ...previous,
  ...rows(grades, previous[previous.length - 1].at + gapMs, prefix),
];

// ---------- серия: правило одно — внутри сессии (пауза между карточками не дольше 15 минут) ----------

test("серия: блок из 5 верных подряд даёт ключ «первая оценка сессии:позиция пятой»; 4 верных — нет", () => {
  assert.deepEqual(comboBlockRefs(rows([2, 3, 2, 3, 2])), ["r1:5"]);
  assert.deepEqual(comboBlockRefs(rows([2, 3, 2, 3])), []);
  assert.equal(COMBO_SIZE, 5);
});

test("серия: неверный ответ обнуляет — 4 верных, ошибка, 5 верных = один блок на позиции 10", () => {
  assert.deepEqual(comboBlockRefs(rows([2, 2, 2, 2, 0, 3, 3, 3, 3, 3])), ["r1:10"]);
  assert.deepEqual(comboBlockRefs(rows([2, 2, 2, 2, 1, 2, 2, 2, 2])), [], "grade 1 («Трудно») — не верный");
});

test("серия: длинная серия даёт блок на каждой пятёрке (5, 10, 15…); пустой журнал и одни ошибки — блоков нет", () => {
  assert.deepEqual(comboBlockRefs(rows(Array(12).fill(3))), ["r1:5", "r1:10"]);
  assert.deepEqual(comboBlockRefs(rows(Array(15).fill(2))), ["r1:5", "r1:10", "r1:15"]);
  assert.deepEqual(comboBlockRefs([]), []);
  assert.deepEqual(comboBlockRefs(rows([0, 1, 0, 1, 0])), []);
});

test("серия: позиция считается по сессии, а не по серии — после ошибки блок закрывается на позиции ошибки + 5", () => {
  assert.deepEqual(comboBlockRefs(rows([0, 3, 3, 3, 3, 3])), ["r1:6"]);
  assert.deepEqual(comboBlockRefs(rows([3, 3, 0, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3])), ["r1:8", "r1:13"]);
});

test("серия: пауза дольше 15 минут начинает новую сессию — серия НЕ переносится (сервер = интерфейс)", () => {
  const first = rows([0, 3, 3, 3], T0, "a");
  const second = then(first, [3, 3, 0], SESSION_GAP_MS + 1, "b");
  assert.deepEqual(comboBlockRefs(second), [], "в текущей сессии серия короче 5");
  // а если бы пауза была короче — те же карточки дали бы блок
  const sameSession = then(first, [3, 3, 0], SESSION_GAP_MS, "b");
  assert.deepEqual(comboBlockRefs(sameSession), ["a1:6"]);
});

test("серия: граница паузы — ровно 15 минут та же сессия, на миллисекунду больше — новая", () => {
  const base = rows([3, 3, 3], T0, "a");
  assert.equal(currentSession(then(base, [3, 3], SESSION_GAP_MS, "b")).length, 5);
  assert.equal(currentSession(then(base, [3, 3], SESSION_GAP_MS + 1, "b")).length, 2);
});

test("серия: сессия через локальную полночь остаётся одной сессией (окно чтения журнала не привязано к дню)", () => {
  const beforeMidnight = rows([3, 3, 3], Date.parse("2026-11-14T23:59:20Z"), "a");
  const afterMidnight = then(beforeMidnight, [3, 3], STEP, "b");
  assert.equal(new Date(afterMidnight[3].at).toISOString().slice(0, 10), "2026-11-15");
  assert.deepEqual(comboBlockRefs(afterMidnight), ["a1:5"], "серия 3 + 2 через полночь — блок");
});

test("серия: повторные вызовы дают те же ключи, а выплата по одному ключу — один раз", async () => {
  const ledger = new MemoryLedger();
  ledger.addProfile("u1", { today: "2026-11-14" });
  const day = rows(Array(12).fill(3)); // 2 блока
  const pay = async (): Promise<string> => {
    const ref = nextUnawardedBlock(comboBlockRefs(day), new Set((ledger.events as { ref: string | null }[]).map((e) => e.ref ?? "")));
    return ref ? (await awardXp("u1", { source: "combo_bonus", ref }, ledger.rpc)).status : "none";
  };
  assert.deepEqual([await pay(), await pay(), await pay(), await pay()], ["awarded", "awarded", "none", "none"]);
  assert.equal(ledger.totalXp("u1"), 10);
  // повтор того же ключа напрямую (две вкладки): ровно один выигрывает
  const results = await Promise.all(Array.from({ length: 6 }, () => awardXp("u1", { source: "combo_bonus", ref: comboBlockRefs(day)[0] }, ledger.rpc)));
  assert.equal(results.filter((r) => r.status === "awarded").length, 0);
  assert.equal(results.filter((r) => r.status === "duplicate").length, 6);
});

test("серия: отмена последней оценки и повторная оценка не дают второй выплаты за тот же блок", async () => {
  const ledger = new MemoryLedger();
  ledger.addProfile("u1", { today: "2026-11-14" });
  let log = rows([3, 3, 3, 3, 3]);
  const [ref] = comboBlockRefs(log);
  assert.equal((await awardXp("u1", { source: "combo_bonus", ref }, ledger.rpc)).status, "awarded");
  // отменили пятую (хвост журнала) и оценили снова — у новой строки другой id, место то же
  log = [...log.slice(0, 4), { id: "r5-again", grade: 3, at: log[4].at + 5_000 }];
  assert.deepEqual(comboBlockRefs(log), [ref], "ключ блока не зависит от id закрывающей строки");
  assert.equal((await awardXp("u1", { source: "combo_bonus", ref: comboBlockRefs(log)[0] }, ledger.rpc)).status, "duplicate");
  assert.equal(ledger.totalXp("u1"), 5);
  // а если после отмены ответили НЕВЕРНО и затем набрали новую пятёрку — это новый честный блок
  log = [...log.slice(0, 4), { id: "r5-wrong", grade: 0, at: log[4].at }, ...rows([3, 3, 3, 3, 3], log[4].at + STEP, "n")];
  assert.deepEqual(comboBlockRefs(log), ["r1:10"]);
  assert.equal((await awardXp("u1", { source: "combo_bonus", ref: "r1:10" }, ledger.rpc)).status, "awarded");
});

test("серия: состояние для интерфейса — сколько верных подряд сейчас; после паузы или без оценок — 0", () => {
  const log = rows([0, 3, 3, 3]);
  const lastAt = log[3].at;
  assert.deepEqual(activeComboState(log, lastAt + 1_000), { run: 3, lastAtMs: lastAt });
  assert.deepEqual(activeComboState(log, lastAt + SESSION_GAP_MS), { run: 3, lastAtMs: lastAt }, "ровно 15 минут — сессия ещё идёт");
  assert.deepEqual(activeComboState(log, lastAt + SESSION_GAP_MS + 1), { run: 0, lastAtMs: lastAt }, "пауза дольше — новая сессия");
  assert.deepEqual(activeComboState(rows([3, 3, 1]), T0 + 60_000), { run: 0, lastAtMs: T0 + 2 * STEP }, "последняя оценка неверная");
  assert.deepEqual(activeComboState([], T0), { run: 0, lastAtMs: null });
});

/** Модель интерфейса (review-session.tsx): счётчик серии, обнуление ошибкой и паузой > SESSION_GAP_MS, баннер на каждой 5-й. */
function uiModel(sequence: ReviewLogRow[], seed: { run: number; lastAtMs: number | null } = { run: 0, lastAtMs: null }): { banners: number; combo: number } {
  let combo = seed.run;
  let lastAt = seed.lastAtMs;
  let banners = 0;
  for (const row of sequence) {
    const base = lastAt !== null && row.at - lastAt > SESSION_GAP_MS ? 0 : combo;
    lastAt = row.at;
    if (row.grade >= 2) {
      combo = base + 1;
      if (combo % COMBO_SIZE === 0) banners += 1;
    } else {
      combo = 0;
    }
  }
  return { banners, combo };
}

function lcg(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

test("серия: интерфейс и сервер согласны на тысяче случайных журналов (ошибки, «Трудно», паузы, перезагрузки)", () => {
  const rand = lcg(20261114);
  for (let n = 0; n < 1000; n++) {
    const length = 1 + Math.floor(rand() * 40);
    let at = T0;
    const log: ReviewLogRow[] = [];
    for (let i = 0; i < length; i++) {
      // чаще короткие паузы, изредка — перерыв около порога (±1 мс) или длиннее
      const roll = rand();
      at += roll < 0.85 ? 3_000 + Math.floor(rand() * 20_000) : roll < 0.9 ? SESSION_GAP_MS : roll < 0.95 ? SESSION_GAP_MS + 1 : SESSION_GAP_MS * 3;
      const g = rand();
      log.push({ id: `x${n}-${i}`, grade: g < 0.72 ? 3 : g < 0.82 ? 2 : g < 0.92 ? 1 : 0, at });
    }
    const session = currentSession(log);
    // баннеры интерфейса внутри текущей сессии (счётчик с нуля в её начале) = блоки сервера
    assert.equal(uiModel(session).banners, comboBlockRefs(log).length, `журнал #${n}`);
    // и посев при перезагрузке страницы сразу после последней оценки даёт то же значение счётчика
    const state = activeComboState(log, log[log.length - 1].at + 1_000);
    assert.equal(uiModel(session).combo, state.run, `счётчик после журнала #${n}`);
    // перезагрузка в середине сессии: посев состоянием «на тот момент» и продолжение дают те же итоги
    const cut = Math.floor(rand() * log.length);
    const head = log.slice(0, cut);
    const tail = log.slice(cut);
    const seed = activeComboState(head, (head[head.length - 1]?.at ?? T0) + 500);
    const resumed = uiModel(tail, seed);
    const whole = uiModel(log);
    assert.equal(resumed.combo, whole.combo, `продолжение после перезагрузки #${n}`);
  }
});

test("серия: «Трудно» (grade 1) и «Не помню» (0) обрывают серию одинаково на сервере и в интерфейсе", () => {
  const session = rows([3, 3, 3, 3, 1, 3, 3, 3, 3, 0, 3, 3, 3, 3, 3]);
  assert.equal(comboBlockRefs(session).length, 1);
  assert.equal(uiModel(session).banners, 1);
});

// ---------- идеальная сессия: сессию и порог определяет сервер ----------

test("идеальная сессия: все оценки сессии верные и их не меньше PERFECT_MIN_CARDS", () => {
  const session = perfectSession(rows([2, 3, 2, 3, 3, 2]));
  assert.deepEqual(session, { ref: "r1", cardCount: 6, durationSec: 100 });
  assert.equal(PERFECT_MIN_CARDS, 5);
});

test("идеальная сессия: прежняя накрутка не проходит — 5 верных в конце сессии, где были ошибки", () => {
  // 20 карточек с ошибками, затем 5 верных подряд. Раньше клиент присылал N=5, и бонус выдавался.
  const messy = rows([3, 0, 2, 1, 3, 2, 2, 0, 3, 3, 2, 1, 3, 3, 2, 3, 0, 2, 3, 3, 3, 3, 3, 3, 3]);
  assert.equal(perfectSession(messy), null);
  // и ошибка где угодно внутри сессии — отказ
  for (const bad of [[1, 2, 2, 2, 2, 2], [2, 2, 2, 0, 2, 2], [2, 2, 2, 2, 2, 1]]) assert.equal(perfectSession(rows(bad)), null, bad.join());
});

test("идеальная сессия: короткая сессия — отказ, даже если предыдущая была идеальной", () => {
  assert.equal(perfectSession(rows([3, 3, 3, 3])), null);
  assert.equal(perfectSession(rows([])), null);
  const twoSessions = then(rows(Array(8).fill(3)), [3, 3, 3], SESSION_GAP_MS + 1, "b");
  assert.equal(perfectSession(twoSessions), null, "оценивается текущая сессия (3 карточки), а не прошлая");
});

test("идеальная сессия: границы сессии определяет пауза — ошибки до паузы бонусу не мешают", () => {
  const earlier = rows([0, 1, 2, 0, 3, 3], T0, "a");
  const later = then(earlier, [3, 3, 3, 3, 3], SESSION_GAP_MS + 1, "b");
  assert.deepEqual(currentSession(later).map((r) => r.id), ["b1", "b2", "b3", "b4", "b5"]);
  assert.deepEqual(perfectSession(later), { ref: "b1", cardCount: 5, durationSec: 80 });
});

test("идеальная сессия: пауза ровно SESSION_GAP_MS — та же сессия, на миллисекунду больше — новая", () => {
  const same = then(rows([0, 3, 3, 3]), [3, 3, 3, 3], SESSION_GAP_MS, "b");
  assert.equal(currentSession(same).length, 8);
  assert.equal(perfectSession(same), null, "ошибка первой части теперь в той же сессии");
  const split = then(rows([0, 3, 3, 3]), [3, 3, 3, 3, 3], SESSION_GAP_MS + 1, "b");
  assert.equal(perfectSession(split)?.cardCount, 5);
});

test("идеальная сессия: ключ — первая оценка сессии, поэтому растущая сессия даёт один и тот же ключ", () => {
  const all = rows(Array(15).fill(3));
  const refs = [5, 6, 10, 15].map((n) => perfectSession(all.slice(0, n))?.ref);
  assert.deepEqual(refs, ["r1", "r1", "r1", "r1"]);
});

test("идеальная сессия: порядок строк на входе не важен", () => {
  const shuffled = [...rows([3, 3, 3, 3, 3, 3])].reverse();
  assert.deepEqual(perfectSession(shuffled), { ref: "r1", cardCount: 6, durationSec: 100 });
});

test("идеальная сессия: клиент не может повлиять на условие — лишние аргументы игнорируются", () => {
  const call = perfectSession as unknown as (...args: unknown[]) => unknown;
  const good = rows(Array(6).fill(3));
  const messy = rows([3, 0, 3, 3, 3, 3, 3, 3]);
  const attempts: unknown[][] = [[2], [3], [5], [999], [Number.NaN], [-1], ["5"], [null], [{ count: 2 }], [2, 100], [1.5, "x"], [Infinity]];
  for (const extra of attempts) {
    assert.deepEqual(call(good, ...extra), perfectSession(good), `верная сессия, аргументы ${JSON.stringify(extra)}`);
    assert.equal(call(messy, ...extra), null, `сессия с ошибкой, аргументы ${JSON.stringify(extra)}`);
    assert.equal(call(rows([3, 3, 3]), ...extra), null, `короткая сессия, аргументы ${JSON.stringify(extra)}`);
  }
  assert.equal(perfectSession.length, 1, "функция принимает только журнал оценок");
});

test("идеальная сессия: серверное действие и клиентский вызов не имеют параметров N / durationSec", () => {
  const root = resolve(import.meta.dirname, "../../app/(app)/brain/[deckId]/review");
  const actions = readFileSync(resolve(root, "actions.ts"), "utf8");
  assert.match(actions, /export async function awardPerfectBonus\(\): Promise<\{ moments: Moment\[\] \}>/);
  const body = actions.slice(actions.indexOf("export async function awardPerfectBonus"), actions.indexOf("export async function awardComboBonus"));
  // размер и длительность в моменте берутся из серверной оценки сессии, больше эти имена не встречаются
  const rest = body.replace("cardCount: session.cardCount", "").replace("durationSec: session.durationSec", "");
  assert.doesNotMatch(rest, /\bcardCount\b|\bdurationSec\b|\barguments\b/, "тело не читает размер и длительность от клиента");
  assert.match(body, /perfectSession\(sessionRows\)/);
  const client = readFileSync(resolve(root, "review-session.tsx"), "utf8");
  assert.match(client, /awardPerfectBonus\(\)/);
  assert.doesNotMatch(client, /awardPerfectBonus\([^)]/);
});

test("идеальная сессия: бонус один за сессию — любое число вызовов в любые моменты, 3 сессии в день по лимиту", async () => {
  const ledger = new MemoryLedger();
  ledger.addProfile("u1", { today: "2026-11-14" });
  const grant = async (log: ReviewLogRow[]) => {
    const session = perfectSession(log);
    return session ? (await awardXp("u1", { source: "perfect_session", ref: session.ref }, ledger.rpc)).status : "none";
  };

  let log = rows(Array(5).fill(3), T0, "a");
  assert.equal(await grant(log), "awarded", "сессия достигла 5 карточек");
  log = [...log, ...rows(Array(5).fill(3), log[4].at + STEP, "a2")];
  assert.equal(await grant(log), "duplicate", "та же сессия выросла — второго бонуса нет");
  assert.equal(await grant(log), "duplicate", "повторный вызов — тоже");
  assert.equal(ledger.totalXp("u1"), 10);

  log = then(log, Array(6).fill(2), SESSION_GAP_MS + 1, "b");
  assert.equal(await grant(log), "awarded", "новая сессия — новый бонус");
  log = then(log, Array(5).fill(3), SESSION_GAP_MS + 1, "c");
  assert.equal(await grant(log), "awarded");
  log = then(log, Array(5).fill(3), SESSION_GAP_MS + 1, "d");
  assert.equal(await grant(log), "capped", "четвёртая за день — дневной лимит источника (30 XP)");
  assert.equal(ledger.totalXp("u1"), 30);
});


// ---------- XP за оценку карточки: место в журнале, отмена и повторная оценка ----------

test("ключ XP за оценку — «день:номер оценки за день»; номера и дни не пересекаются", () => {
  assert.equal(reviewSlotRef("2026-11-14", 1), "2026-11-14:1");
  assert.notEqual(reviewSlotRef("2026-11-14", 1), reviewSlotRef("2026-11-15", 1));
  assert.notEqual(reviewSlotRef("2026-11-14", 1), reviewSlotRef("2026-11-14", 11));
});

test("отменить можно только самую последнюю оценку пользователя; чужие значения и пустой журнал — отказ", () => {
  assert.equal(isUndoable("log-9", "log-9"), true);
  assert.equal(isUndoable("log-9", "log-8"), false, "оценка из середины сессии");
  assert.equal(isUndoable(null, "log-9"), false);
  for (const bad of [undefined, null, 9, {}, ["log-9"], ""]) assert.equal(isUndoable("log-9", bad), false, String(bad));
});

/** Журнал повторений + журнал XP: те же операции, что reviewWord / undoLastGrade, без БД. */
function sandbox(scheme: "slot" | "row-id" = "slot") {
  const ledger = new MemoryLedger();
  ledger.addProfile("u1", { today: "2026-11-14" });
  const log: string[] = [];
  let next = 0;
  let peak = 0;
  return {
    ledger,
    log,
    get peak() {
      return peak;
    },
    async review(): Promise<string> {
      const id = `row-${++next}`;
      log.push(id);
      peak = Math.max(peak, log.length);
      const ref = scheme === "slot" ? reviewSlotRef("2026-11-14", log.length) : id;
      return (await awardXp("u1", { source: "review_card", ref }, ledger.rpc)).status;
    },
    /** undoLastGrade: удаляется только последняя строка; журнал XP не трогается. */
    undo(): boolean {
      return log.pop() !== undefined;
    },
  };
}

test("оценка → отмена → повторная оценка: XP начислен один раз, на повтор — duplicate", async () => {
  const s = sandbox();
  assert.equal(await s.review(), "awarded");
  assert.ok(s.undo());
  assert.equal(await s.review(), "duplicate", "то же место в журнале — тот же ключ");
  assert.equal(s.ledger.totalXp("u1"), 1);
  assert.equal(s.ledger.events.length, 1);
});

test("оценка → отмена → ДРУГАЯ карточка на то же место: XP не выдаётся второй раз", async () => {
  const s = sandbox();
  assert.equal(await s.review(), "awarded");
  s.undo();
  assert.equal(await s.review(), "duplicate");
  assert.equal(s.ledger.totalXp("u1"), s.log.length, "XP равен числу оценок в журнале: каждая оценка оплачена один раз");
});

test("старая схема (ключ = id строки) эту накрутку допускала: тот же сценарий давал XP за каждый круг", async () => {
  const old = sandbox("row-id");
  for (let i = 0; i < 6; i++) {
    await old.review();
    old.undo();
  }
  assert.equal(old.log.length, 0, "в журнале ни одной оценки");
  assert.equal(old.ledger.totalXp("u1"), 6, "а XP начислен за шесть — тест чувствителен к ошибке");
  const fixed = sandbox();
  for (let i = 0; i < 6; i++) {
    await fixed.review();
    fixed.undo();
  }
  assert.equal(fixed.ledger.totalXp("u1"), 1, "по месту в журнале — один раз за все шесть кругов");
});

test("цепочка отмен и оценок: XP никогда не больше пика числа оценок за день; журнал, profiles.xp и день равны", async () => {
  const rand = lcg(7);
  for (let run = 0; run < 40; run++) {
    const s = sandbox();
    for (let step = 0; step < 120; step++) {
      if (rand() < 0.42 && s.log.length > 0) s.undo();
      else await s.review();
    }
    const xp = s.ledger.totalXp("u1");
    assert.ok(xp <= s.peak, `прогон ${run}: XP ${xp} > пика оценок ${s.peak}`);
    assert.equal(xp, s.ledger.events.length, "каждая выплата = 1 XP, без отрицательных событий");
    assert.equal(xp, s.ledger.dayXp("u1", "2026-11-14"), "profiles.xp = activity_days.xp");
    assert.equal(xp, s.ledger.events.reduce((sum, e) => sum + e.amount, 0), "profiles.xp = сумма журнала");
    assert.equal(new Set(s.ledger.events.map((e) => e.ref)).size, s.ledger.events.length, "ключи уникальны");
    assert.ok(s.ledger.events.every((e) => e.amount > 0));
  }
});

test("параллельные оценки на одно место и параллельные повторы: выплата ровно одна", async () => {
  const s = sandbox();
  s.log.push("row-1");
  const ref = reviewSlotRef("2026-11-14", 1);
  const results = await Promise.all(Array.from({ length: 12 }, () => awardXp("u1", { source: "review_card", ref }, s.ledger.rpc)));
  assert.equal(results.filter((r) => r.status === "awarded").length, 1);
  assert.equal(results.filter((r) => r.status === "duplicate").length, 11);
  assert.equal(s.ledger.totalXp("u1"), 1);
});

test("отмена и оценка в гонке: возможна только недовыплата (ключи совпали), но не двойная выплата", async () => {
  const s = sandbox();
  for (let i = 0; i < 3; i++) await s.review(); // места 1..3 оплачены
  // гонка: отмена третьей оценки и две новые оценки одновременно; обе видят место 3 или 4
  s.undo();
  const [a, b] = await Promise.all([s.review(), s.review()]);
  const statuses = [a, b].sort();
  assert.ok(statuses.every((st) => st === "awarded" || st === "duplicate"));
  assert.ok(s.ledger.totalXp("u1") <= s.peak);
  assert.equal(s.ledger.totalXp("u1"), s.ledger.events.length);
});

test("полночь: место считается заново для нового дня — отмена вчерашней оценки после полуночи платит максимум один раз за новый день", async () => {
  const s = sandbox();
  await s.review(); // 23:59 — место 2026-11-14:1
  s.undo();
  s.ledger.profiles.get("u1")!.today = "2026-11-15";
  const ref = reviewSlotRef("2026-11-15", 1);
  assert.equal((await awardXp("u1", { source: "review_card", ref }, s.ledger.rpc)).status, "awarded");
  assert.equal((await awardXp("u1", { source: "review_card", ref }, s.ledger.rpc)).status, "duplicate");
  assert.equal(s.ledger.totalXp("u1"), 2, "по одному XP на каждый из двух дней — ограничено дневным лимитом, не растёт");
});

test("действия сервера: XP за оценку — по месту в журнале, undo — только последней оценки, серия — по сессии", () => {
  const dir = resolve(import.meta.dirname, "../../app/(app)/brain/[deckId]/review");
  const actions = readFileSync(resolve(dir, "actions.ts"), "utf8");
  const review = actions.slice(actions.indexOf("export async function reviewWord"), actions.indexOf("export async function awardPerfectBonus"));
  assert.match(review, /reviewSlotDay\(slotClock\.timezone, \(logRow as \{ reviewed_at: string \}\)\.reviewed_at\)/, "день места — по метке времени записанной строки");
  assert.match(review, /reviewSlotRef\(slot\.day, position\)/);
  assert.doesNotMatch(review, /reviewSlotRef\(clock\.today/, "и не по часам приложения");
  assert.doesNotMatch(review, /ref:\s*logRow/, "ключ XP больше не id строки журнала");
  assert.doesNotMatch(review, /randomUUID/, "и не случайный uuid");
  const undo = actions.slice(actions.indexOf("export async function undoLastGrade"));
  assert.match(undo, /loadLatestReviewId\(supabase, user\.id\)/);
  assert.match(undo, /isUndoable\(latestId, reviewLogId\)/);
  assert.match(undo, /isSameLocalDay\(undoClock\.timezone/, "отмена только в тот же локальный день");
  assert.doesNotMatch(undo.slice(0, 2500), /\.eq\("flashcard_id", logRow\.flashcard_id\)\s*\.order/, "отмена не ограничивается последней оценкой КАРТОЧКИ");
  const combo = actions.slice(actions.indexOf("export async function awardComboBonus"));
  assert.match(combo.slice(0, 1800), /loadRecentReviews\(supabase, user\.id\)/);
  assert.doesNotMatch(combo.slice(0, 1800), /todayWindow|clock\.today/, "серия не привязана к локальному дню");
});

// ---------- состязательная проверка: граница дня, повтор после сбоя сети, параллельные запросы ----------

const MSK = "Europe/Moscow";
const iso = (value: string) => new Date(value).toISOString();

test("день оценки берётся из метки записанной строки: 23:59:59 остаётся прошлым днём, даже если считаем после полуночи", () => {
  // Москва UTC+3: 2026-11-14T20:59:59.900Z — 23:59:59.9 14 ноября
  const written = iso("2026-11-14T20:59:59.900Z");
  const slot = reviewSlotDay(MSK, written);
  assert.equal(slot.day, "2026-11-14");
  assert.ok(Date.parse(slot.window.startIso) <= Date.parse(written) && Date.parse(written) < Date.parse(slot.window.endIso), "строка внутри своего окна — номер места ≥ 1");
  // старая ошибка: день по часам приложения после полуночи → окно нового дня, строки в нём нет (номер 0)
  const lateClock = reviewSlotDay(MSK, iso("2026-11-14T21:00:00.500Z"));
  assert.equal(lateClock.day, "2026-11-15");
  assert.ok(Date.parse(written) < Date.parse(lateClock.window.startIso), "строка 23:59:59.9 в окне нового дня не оказывается");
  assert.equal(reviewSlotDay(null, "2026-11-14T23:59:59.000Z").day, "2026-11-14", "без пояса — UTC");
});

test("отмена возможна только в тот же локальный день", () => {
  const written = iso("2026-11-14T20:59:59.000Z"); // 23:59:59 по Москве
  assert.equal(isSameLocalDay(MSK, written, new Date("2026-11-14T21:00:00.000Z")), false, "через секунду уже следующий день");
  assert.equal(isSameLocalDay(MSK, written, new Date("2026-11-14T21:00:00.000Z")), false);
  assert.equal(isSameLocalDay(MSK, written, new Date("2026-11-14T20:59:59.999Z")), true);
  assert.equal(isSameLocalDay(MSK, iso("2026-11-14T10:00:00Z"), new Date("2026-11-14T15:00:00Z")), true);
  assert.equal(isSameLocalDay("America/Los_Angeles", iso("2026-11-14T07:30:00Z"), new Date("2026-11-14T08:30:00Z")), false, "в Лос-Анджелесе граница дня в 08:00 UTC зимой");
  assert.equal(isSameLocalDay(null, "garbage", new Date()), false);
  assert.equal(isSameLocalDay("Not/AZone", iso("2026-11-14T23:00:00Z"), new Date("2026-11-14T23:30:00Z")), true, "битый пояс — UTC, не ошибка");
});

/** Журнал + XP во времени: те же правила, что reviewWord / undoLastGrade, с настоящими метками времени и поясом. */
function timeline(timezone: string | null = MSK) {
  const ledger = new MemoryLedger();
  ledger.addProfile("u1", { today: "2026-11-14" });
  const rows: Array<{ id: string; at: number }> = [];
  const peakByDay = new Map<string, number>();
  let n = 0;
  const countInDay = (window: { startIso: string; endIso: string }) => rows.filter((r) => r.at >= Date.parse(window.startIso) && r.at < Date.parse(window.endIso)).length;
  return {
    ledger,
    rows,
    peakByDay,
    /** reviewWord: строка записана в момент at, номер считается позже (appLagMs) — по часам БД это не важно. */
    async review(at: number, observedCount?: (real: number) => number): Promise<string> {
      rows.push({ id: `row-${++n}`, at });
      const slot = reviewSlotDay(timezone, new Date(at).toISOString());
      const real = countInDay(slot.window);
      peakByDay.set(slot.day, Math.max(peakByDay.get(slot.day) ?? 0, real));
      const position = observedCount ? observedCount(real) : real;
      if (position < 1) return "skipped";
      ledger.profiles.get("u1")!.today = slot.day;
      ledger.now = () => at;
      return (await awardXp("u1", { source: "review_card", ref: reviewSlotRef(slot.day, position) }, ledger.rpc)).status;
    },
    /** undoLastGrade в момент at: последняя строка и тот же локальный день. */
    undo(at: number): boolean {
      const tail = rows[rows.length - 1];
      if (!tail || !isSameLocalDay(timezone, new Date(tail.at).toISOString(), new Date(at))) return false;
      rows.pop();
      return true;
    },
  };
}

test("граница дня: оценка в 23:59:59, отмена после полуночи отклоняется, XP за прошлый день не выдаётся второй раз", async () => {
  const t = timeline();
  const written = Date.parse("2026-11-14T20:59:59.000Z");
  assert.equal(await t.review(written), "awarded");
  assert.equal(t.undo(Date.parse("2026-11-14T21:00:05.000Z")), false, "после полуночи отменить нельзя");
  assert.equal(t.rows.length, 1, "оценка осталась в журнале");
  // повторная оценка той же карточки — второе место НОВОГО дня, а не освобождённое место прошлого
  assert.equal(await t.review(Date.parse("2026-11-14T21:00:30.000Z")), "awarded");
  assert.equal(t.ledger.totalXp("u1"), 2, "две оценки в журнале — два XP, ни одного лишнего");
  assert.equal(t.rows.length, 2);
});

test("граница дня: до полуночи отмена и повторная оценка по-прежнему не дают второго XP", async () => {
  const t = timeline();
  assert.equal(await t.review(Date.parse("2026-11-14T20:59:50.000Z")), "awarded");
  assert.ok(t.undo(Date.parse("2026-11-14T20:59:55.000Z")));
  assert.equal(await t.review(Date.parse("2026-11-14T20:59:58.000Z")), "duplicate");
  assert.equal(t.ledger.totalXp("u1"), 1);
});

test("случайные сутки с полуночами, отменами и повторами: XP за день ≤ пика числа оценок этого дня; журнал и итоги равны", async () => {
  const rand = lcg(20261115);
  for (let run = 0; run < 60; run++) {
    const t = timeline(run % 3 === 0 ? "America/Los_Angeles" : run % 3 === 1 ? MSK : "Pacific/Kiritimati");
    let at = Date.parse("2026-11-13T12:00:00Z");
    for (let step = 0; step < 150; step++) {
      at += Math.floor(rand() * 40 * 60_000); // до 40 минут между действиями: ночи пересекаются
      if (rand() < 0.4) t.undo(at + Math.floor(rand() * 5_000));
      else await t.review(at);
    }
    const xpByDay = new Map<string, number>();
    for (const e of t.ledger.events) {
      const day = (e.ref ?? "").split(":")[0];
      xpByDay.set(day, (xpByDay.get(day) ?? 0) + e.amount);
    }
    for (const [day, xp] of xpByDay) assert.ok(xp <= (t.peakByDay.get(day) ?? 0), `прогон ${run}, день ${day}: XP ${xp} > пика ${t.peakByDay.get(day)}`);
    const total = t.ledger.events.reduce((sum, e) => sum + e.amount, 0);
    assert.equal(t.ledger.totalXp("u1"), total, "profiles.xp = сумма журнала");
    assert.equal(new Set(t.ledger.events.map((e) => e.ref)).size, t.ledger.events.length, "ключи уникальны");
    assert.ok(t.ledger.events.every((e) => e.amount > 0 && !(e.ref ?? "").endsWith(":0")), "нет отрицательных событий и места «0»");
  }
});

test("параллельные оценки: если все видят одно и то же число оценок — платится одна (недовыплата), если каждая своё — столько, сколько строк", async () => {
  const worst = timeline();
  const base = Date.parse("2026-11-14T10:00:00Z");
  // все 8 запросов считают место после того, как записаны все 8 строк → одинаковый номер
  const results = await Promise.all(Array.from({ length: 8 }, (_, i) => worst.review(base + i * 10, () => 8)));
  assert.equal(results.filter((r) => r === "awarded").length, 1);
  assert.ok(worst.ledger.totalXp("u1") <= worst.rows.length);

  const best = timeline();
  const ok = await Promise.all(Array.from({ length: 8 }, (_, i) => best.review(base + i * 10, () => i + 1)));
  assert.equal(ok.filter((r) => r === "awarded").length, 8);
  assert.equal(best.ledger.totalXp("u1"), best.rows.length, "платится ровно по числу строк, не больше");
});

test("повтор после сетевой ошибки: начисление, которое не дошло, выплатится при повторе один раз; повторная отмена уже удалённой оценки невозможна", async () => {
  const t = timeline();
  const at = Date.parse("2026-11-14T10:00:00Z");
  t.ledger.failNext = 1; // ответ RPC потерян: ничего не записано
  assert.equal(await t.review(at), "failed");
  assert.equal(t.ledger.totalXp("u1"), 0);
  // та же оценка в журнале осталась; клиент повторил начисление для ТОГО ЖЕ места → выплата ровно одна
  const slot = reviewSlotDay(MSK, new Date(at).toISOString());
  const ref = reviewSlotRef(slot.day, 1);
  const retries = await Promise.all([1, 2, 3].map(() => awardXp("u1", { source: "review_card", ref }, t.ledger.rpc)));
  assert.equal(retries.filter((r) => r.status === "awarded").length, 1);
  assert.equal(t.ledger.totalXp("u1"), 1);
  // отмена выполнена, ответ потерян, клиент повторяет ту же отмену: строки уже нет → «последняя оценка» — не она
  const removed = t.rows[t.rows.length - 1].id;
  assert.ok(t.undo(at + 1_000));
  const latestAfterUndo = t.rows[t.rows.length - 1]?.id ?? null;
  assert.equal(isUndoable(latestAfterUndo, removed), false, "повтор отмены не проходит");
  assert.equal(t.undo(at + 2_000), false, "и откатывать больше нечего");
});

test("повтор самого запроса оценки после сетевой ошибки — это ещё одна запись журнала и одно место: XP не больше числа строк", async () => {
  const t = timeline();
  const at = Date.parse("2026-11-14T10:00:00Z");
  await t.review(at);
  await t.review(at + 1_500); // клиент повторил оценку той же карточки
  assert.equal(t.rows.length, 2, "обе записи есть в журнале повторений");
  assert.equal(t.ledger.totalXp("u1"), 2);
  assert.ok(t.ledger.totalXp("u1") <= t.rows.length);
});
