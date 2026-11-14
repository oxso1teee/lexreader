import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  dayWindow,
  isValidTimezone,
  isoWeekStartOfDay,
  localDate,
  msUntilNextDay,
  normalizeTimezone,
  timezoneOffsetMs,
  userClock,
  wallClock,
} from "./user-day.ts";

const at = (iso: string) => new Date(iso);

test("isValidTimezone/normalizeTimezone: только настоящие IANA-пояса, остальное — UTC", () => {
  for (const tz of ["UTC", "Europe/Moscow", "America/Los_Angeles", "Asia/Kolkata", "Pacific/Kiritimati"]) {
    assert.equal(isValidTimezone(tz), true, tz);
  }
  for (const bad of ["", "Mars/Olympus", "UTC+3 ", "../etc/passwd", "x".repeat(65), 42, null, undefined, {}]) {
    assert.equal(isValidTimezone(bad), false, String(bad));
  }
  assert.equal(normalizeTimezone(null), "UTC");
  assert.equal(normalizeTimezone("garbage"), "UTC");
  assert.equal(normalizeTimezone("Europe/Moscow"), "Europe/Moscow");
});

test("isValidTimezone: смещения «+03:00» не принимаются (в PostgreSQL знак был бы обратным)", () => {
  for (const offset of ["+03:00", "-05:00", "+0300", "+3", "-12", "UTC+3", "GMT+3", "Z"]) assert.equal(isValidTimezone(offset), false, offset);
  for (const named of ["Etc/GMT+3", "Etc/GMT-14", "EST5EDT", "America/Argentina/Buenos_Aires", "UTC"]) assert.equal(isValidTimezone(named), true, named);
  assert.equal(normalizeTimezone("+03:00"), "UTC");
});

test("localDate: тот же момент — разные календарные дни в разных поясах", () => {
  const moment = at("2026-03-10T22:30:00Z");
  assert.equal(localDate(moment, "UTC"), "2026-03-10");
  assert.equal(localDate(moment, "Asia/Tokyo"), "2026-03-11"); // UTC+9
  assert.equal(localDate(moment, "America/Los_Angeles"), "2026-03-10"); // UTC-7 (DST)
  assert.equal(localDate(moment, "Pacific/Kiritimati"), "2026-03-11"); // UTC+14
  assert.equal(localDate(moment, "Pacific/Pago_Pago"), "2026-03-10"); // UTC-11
});

test("localDate: граница полуночи — на секунду раньше и ровно в полночь", () => {
  assert.equal(localDate(at("2026-06-14T20:59:59Z"), "Europe/Moscow"), "2026-06-14");
  assert.equal(localDate(at("2026-06-14T21:00:00Z"), "Europe/Moscow"), "2026-06-15");
});

test("localDate: некорректный пояс не бросает, а считает по UTC", () => {
  assert.equal(localDate(at("2026-06-14T23:59:00Z"), "nope"), "2026-06-14");
});

test("timezoneOffsetMs: учитывает DST (Лос-Анджелес зимой −8, летом −7)", () => {
  assert.equal(timezoneOffsetMs(at("2026-01-15T12:00:00Z"), "America/Los_Angeles"), -8 * 3_600_000);
  assert.equal(timezoneOffsetMs(at("2026-07-15T12:00:00Z"), "America/Los_Angeles"), -7 * 3_600_000);
  assert.equal(timezoneOffsetMs(at("2026-07-15T12:00:00Z"), "Asia/Kolkata"), 5.5 * 3_600_000);
});

test("wallClock: UTC-поля результата — локальные дата и время", () => {
  const wall = wallClock(at("2026-03-10T22:30:00Z"), "Asia/Tokyo");
  assert.equal(wall.toISOString(), "2026-03-11T07:30:00.000Z");
  assert.equal(wall.getUTCDay(), 3); // среда
});

test("addDays/isoWeekStartOfDay: через границы месяца и года, понедельник недели", () => {
  assert.equal(addDays("2026-02-28", 1), "2026-03-01");
  assert.equal(addDays("2026-01-01", -1), "2025-12-31");
  assert.equal(isoWeekStartOfDay("2026-11-14"), "2026-11-09"); // суббота → понедельник
  assert.equal(isoWeekStartOfDay("2026-11-09"), "2026-11-09");
  assert.equal(isoWeekStartOfDay("2026-11-15"), "2026-11-09"); // воскресенье
  assert.equal(isoWeekStartOfDay("2026-01-01"), "2025-12-29");
});

test("dayWindow: окно локальных суток в моментах UTC, конец исключительный", () => {
  assert.deepEqual(dayWindow("2026-06-15", "Europe/Moscow"), {
    startIso: "2026-06-14T21:00:00.000Z",
    endIso: "2026-06-15T21:00:00.000Z",
  });
  assert.deepEqual(dayWindow("2026-06-15", "UTC"), {
    startIso: "2026-06-15T00:00:00.000Z",
    endIso: "2026-06-16T00:00:00.000Z",
  });
  assert.deepEqual(dayWindow("2026-06-15", "Asia/Kolkata"), {
    startIso: "2026-06-14T18:30:00.000Z",
    endIso: "2026-06-15T18:30:00.000Z",
  });
});

test("dayWindow: день перехода на летнее время — 23 часа, на зимнее — 25", () => {
  const spring = dayWindow("2026-03-08", "America/Los_Angeles");
  assert.equal(Date.parse(spring.endIso) - Date.parse(spring.startIso), 23 * 3_600_000);
  const autumn = dayWindow("2026-11-01", "America/Los_Angeles");
  assert.equal(Date.parse(autumn.endIso) - Date.parse(autumn.startIso), 25 * 3_600_000);
  // обычный день — ровно 24 часа
  const plain = dayWindow("2026-05-05", "America/Los_Angeles");
  assert.equal(Date.parse(plain.endIso) - Date.parse(plain.startIso), 24 * 3_600_000);
});

test("dayWindow: соседние дни стыкуются без зазора и перекрытия", () => {
  for (const tz of ["Europe/Moscow", "America/Los_Angeles", "Pacific/Kiritimati", "UTC", "Asia/Kolkata"]) {
    for (const day of ["2026-03-07", "2026-03-08", "2026-10-31", "2026-11-01"]) {
      assert.equal(dayWindow(day, tz).endIso, dayWindow(addDays(day, 1), tz).startIso, `${tz} ${day}`);
    }
  }
});

test("dayWindow: момент внутри окна дня имеет именно эту локальную дату (согласованность localDate и окна)", () => {
  for (const tz of ["Europe/Moscow", "America/Los_Angeles", "Pacific/Kiritimati", "Pacific/Pago_Pago", "Australia/Lord_Howe"]) {
    for (const iso of ["2026-03-08T07:59:59Z", "2026-03-08T08:00:00Z", "2026-11-01T08:59:59Z", "2026-12-31T23:59:59Z", "2026-01-01T00:00:00Z"]) {
      const moment = at(iso);
      const day = localDate(moment, tz);
      const { startIso, endIso } = dayWindow(day, tz);
      assert.ok(moment >= new Date(startIso) && moment < new Date(endIso), `${tz} ${iso} → ${day}`);
    }
  }
});

test("userClock: сегодня/вчера/позавчера/неделя по поясу пользователя", () => {
  const clock = userClock("Asia/Tokyo", at("2026-11-14T20:00:00Z")); // в Токио уже воскресенье 15-го, 05:00
  assert.equal(clock.today, "2026-11-15");
  assert.equal(clock.yesterday, "2026-11-14");
  assert.equal(clock.twoDaysAgo, "2026-11-13");
  assert.equal(clock.weekStart, "2026-11-09");
  assert.equal(clock.timezone, "Asia/Tokyo");
  assert.equal(clock.todayWindow.startIso, "2026-11-14T15:00:00.000Z");
});

test("userClock: без пояса — UTC (поведение существующих аккаунтов не меняется)", () => {
  const clock = userClock(null, at("2026-11-14T23:30:00Z"));
  assert.equal(clock.timezone, "UTC");
  assert.equal(clock.today, "2026-11-14");
});

test("userClock: переход через полночь между двумя вызовами меняет день ровно один раз", () => {
  const before = userClock("Europe/Moscow", at("2026-06-14T20:59:59Z"));
  const after = userClock("Europe/Moscow", at("2026-06-14T21:00:00Z"));
  assert.equal(before.today, "2026-06-14");
  assert.equal(after.today, "2026-06-15");
  assert.equal(after.yesterday, before.today);
});

test("userClock: смена пояса при том же моменте даёт другой «сегодня» (например, перелёт)", () => {
  const moment = at("2026-11-14T23:00:00Z");
  assert.equal(userClock("UTC", moment).today, "2026-11-14");
  assert.equal(userClock("Asia/Tokyo", moment).today, "2026-11-15");
  assert.equal(userClock("America/Los_Angeles", moment).today, "2026-11-14");
});

test("msUntilNextDay: сколько осталось до полуночи пользователя", () => {
  const clock = userClock("Europe/Moscow", at("2026-06-14T20:00:00Z"));
  assert.equal(msUntilNextDay(clock), 3_600_000);
  assert.equal(msUntilNextDay({ todayWindow: clock.todayWindow, now: at("2026-06-15T05:00:00Z") }), 0);
});

test("dayWindow: часы переводят вперёд ровно в полночь — день начинается с 01:00, а не на час раньше", () => {
  // Гавана: 2026-03-08 00:00 → 01:00 (UTC−5 → UTC−4). Полуночи в этот день нет.
  const havana = dayWindow("2026-03-08", "America/Havana");
  assert.deepEqual(havana, { startIso: "2026-03-08T05:00:00.000Z", endIso: "2026-03-09T04:00:00.000Z" });
  assert.equal(Date.parse(havana.endIso) - Date.parse(havana.startIso), 23 * 3_600_000);
  assert.equal(localDate(new Date("2026-03-08T04:59:59Z"), "America/Havana"), "2026-03-07", "последняя секунда предыдущего дня не попадает в окно");
  assert.equal(localDate(new Date("2026-03-08T05:00:00Z"), "America/Havana"), "2026-03-08");
  // Асунсьон 2024-10-06 и Бейрут 2026-03-29 — тот же класс
  assert.equal(dayWindow("2024-10-06", "America/Asuncion").startIso, "2024-10-06T04:00:00.000Z");
  const beirut = dayWindow("2026-03-29", "Asia/Beirut");
  assert.equal(Date.parse(beirut.endIso) - Date.parse(beirut.startIso), 23 * 3_600_000);
});

test("dayWindow: перевод назад — день длится 25 часов, пропущенный календарный день (Самоа 2011-12-30) пуст", () => {
  const santiago = dayWindow("2026-04-04", "America/Santiago"); // DST заканчивается в 24:00 субботы
  assert.equal(Date.parse(santiago.endIso) - Date.parse(santiago.startIso), 25 * 3_600_000);
  const skipped = dayWindow("2011-12-30", "Pacific/Apia");
  assert.equal(skipped.startIso, skipped.endIso, "такого дня в календаре Самоа не было");
  assert.equal(dayWindow("2011-12-29", "Pacific/Apia").endIso, skipped.startIso);
  assert.equal(skipped.endIso, dayWindow("2011-12-31", "Pacific/Apia").startIso);
});

test("dayWindow: на сезонных границах окна стыкуются, длятся 0–25 ч, а момент внутри окна имеет именно эту дату", () => {
  const zones = [
    "America/Havana", "America/Asuncion", "America/Santiago", "America/Los_Angeles", "America/New_York", "Europe/Moscow", "Europe/London",
    "Asia/Beirut", "Asia/Tehran", "Australia/Lord_Howe", "Australia/Sydney", "Pacific/Auckland", "Pacific/Kiritimati", "Pacific/Pago_Pago",
  ];
  const months = ["2026-03", "2026-04", "2026-09", "2026-10", "2026-11", "2024-10"];
  for (const tz of zones) {
    for (const month of months) {
      for (let d = 1; d <= 31; d++) {
        const day = `${month}-${String(d).padStart(2, "0")}`;
        if (Number.isNaN(Date.parse(`${day}T00:00:00Z`)) || new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day) continue;
        const w = dayWindow(day, tz);
        const next = dayWindow(addDays(day, 1), tz);
        const hours = (Date.parse(w.endIso) - Date.parse(w.startIso)) / 3_600_000;
        assert.equal(w.endIso, next.startIso, `${tz} ${day}: стык`);
        assert.ok(hours >= 0 && hours <= 25, `${tz} ${day}: длина ${hours} ч`);
        if (hours > 0) {
          assert.equal(localDate(new Date(w.startIso), tz), day, `${tz} ${day}: начало окна`);
          assert.equal(localDate(new Date(Date.parse(w.endIso) - 1000), tz), day, `${tz} ${day}: конец окна`);
          assert.notEqual(localDate(new Date(Date.parse(w.startIso) - 1000), tz), day, `${tz} ${day}: секунда до окна`);
        }
      }
    }
  }
});
