import { test } from "node:test";
import assert from "node:assert/strict";
import { awardXp } from "./xp/award.ts";
import { MemoryLedger } from "./xp/testing/memory-ledger.ts";
import { XP_SOURCES } from "./xp/sources.ts";
import { localDate } from "./user-day.ts";

// Оценка политики часовых поясов с точки зрения «фарма дневных наград» (Iteration 6).
// Тесты не защищают поведение, а фиксируют ФАКТЫ, на которых строится решение:
//   1) сколько разных календарных дат одновременно существует на планете;
//   2) сколько дневных лимитов может набрать тот, кто «прыгает» между поясами, по сравнению
//      с честным пользователем (на настоящей семантике award_xp, проверенной на PostgreSQL).
// Симуляция берёт сильнейшего нападающего: он меняет пояс КАК УГОДНО часто (в базе действует антидребезг
// в час — реальный нападающий слабее), поэтому границы «не больше двух лишних лимитов» и «не больше
// двух за 24 часа» от политики смены не зависят — их обеспечивают скользящий лимит и ключи по дате.

const HOUR = 3_600_000;
const T0 = Date.parse("2026-11-01T00:00:00Z");

test("факт 1: в любой момент на планете существует не больше трёх разных календарных дат", () => {
  const zones = Intl.supportedValuesOf("timeZone");
  assert.ok(zones.length > 300);
  let worst = 0;
  for (let h = 0; h < 72; h++) {
    const dates = new Set(zones.map((tz) => localDate(new Date(T0 + h * HOUR), tz)));
    worst = Math.max(worst, dates.size);
    assert.ok(dates.size <= 3, `в момент +${h} ч дат: ${dates.size}`);
  }
  assert.equal(worst, 3, "три даты бывают (UTC−12…UTC+14 охватывают 26 часов)");
});

const CAP = XP_SOURCES.review_card.dailyCap!;

/** Тратит review_card до дневного/скользящего лимита; возвращает, сколько начислено. */
async function drain(ledger: MemoryLedger, tag: string): Promise<number> {
  let earned = 0;
  for (let i = 0; i < CAP + 5; i++) {
    const outcome = await awardXp("u", { source: "review_card", ref: `${tag}-${i}` }, ledger.rpc);
    if (outcome.status !== "awarded") break;
    earned += outcome.result.awarded;
  }
  return earned;
}

async function simulate(days: number, strategy: "honest" | "hopper"): Promise<{ total: number; worstWindow: number }> {
  const ledger = new MemoryLedger();
  let now = T0;
  ledger.now = () => now;
  ledger.addProfile("u", { today: "2026-11-01" });
  const zones = ["Pacific/Pago_Pago", "UTC", "Pacific/Kiritimati"]; // UTC−11, UTC, UTC+14: максимум разных дат
  const events: Array<{ at: number; amount: number }> = [];
  let total = 0;
  for (let h = 0; h < days * 24; h++) {
    now = T0 + h * HOUR;
    const candidates = strategy === "honest" ? ["UTC"] : zones;
    for (const tz of candidates) {
      ledger.profiles.get("u")!.today = localDate(new Date(now), tz);
      const earned = await drain(ledger, `${h}-${tz}`);
      if (earned > 0) events.push({ at: now, amount: earned });
      total += earned;
    }
  }
  // самое большое начисление за любые 24 часа
  let worstWindow = 0;
  for (const e of events) worstWindow = Math.max(worstWindow, events.filter((x) => x.at >= e.at && x.at < e.at + 24 * HOUR).reduce((s, x) => s + x.amount, 0));
  return { total, worstWindow };
}

test("факт 2: «прыгая» между поясами, можно набрать не больше двух лишних дневных лимитов за всё время — и не больше двух за любые 24 часа", async () => {
  const days = 14;
  const honest = await simulate(days, "honest");
  const hopper = await simulate(days, "hopper");
  assert.equal(honest.total, days * CAP, "честный пользователь: лимит в день");
  assert.ok(hopper.total >= honest.total, "прыгун не хуже честного");
  assert.ok(hopper.total <= honest.total + 2 * CAP, `прыгун получил ${hopper.total}, честный ${honest.total}: разница больше двух лимитов`);
  assert.ok(hopper.worstWindow <= 2 * CAP, `за 24 часа ${hopper.worstWindow} > ${2 * CAP}`);
  assert.ok(honest.worstWindow <= CAP, "честному на ровном дне больше лимита не набрать");
  // эти же числа — в отчёт
  console.log(`# за ${days} дн.: честный ${honest.total}, прыгун ${hopper.total} (+${hopper.total - honest.total}); максимум за 24 ч: ${hopper.worstWindow} из ${2 * CAP}`);
});

test("факт 3: выигрыш от прыжков разовый — он не растёт со сроком (14 и 60 дней дают одну и ту же разницу)", async () => {
  const gain = async (days: number) => (await simulate(days, "hopper")).total - (await simulate(days, "honest")).total;
  const short = await gain(14);
  const long = await gain(60);
  assert.ok(short <= 2 * CAP && long <= 2 * CAP, `разница ${short} и ${long}`);
  assert.equal(short, long, "разница не накапливается");
});
