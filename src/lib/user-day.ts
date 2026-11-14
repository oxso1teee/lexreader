// Пользовательский календарный день. До Iteration 6 «сегодня» везде считалось
// по UTC (activity_days, цели, квесты, серия) — для пользователя в UTC+10 день
// «менялся» в 10 утра. Теперь день определяется IANA-поясом из profiles.timezone;
// пока пояс не известен (null), используется UTC — как и раньше, поведение для
// существующих аккаунтов не меняется.
//
// Чистые функции, без сети и без глобального времени: now передаётся явно, поэтому
// переходы через полночь, смена пояса и DST проверяются обычными unit-тестами.

export const DEFAULT_TIMEZONE = "UTC";
const MAX_TIMEZONE_LENGTH = 64;
const DAY_MS = 86_400_000;

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = dateFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    dateFormatters.set(timeZone, formatter);
  }
  return formatter;
}

// Только именованные IANA-пояса («Europe/Moscow», «UTC», «Etc/GMT+3»). Смещения вида
// «+03:00» среда выполнения принимает, но PostgreSQL читает их по POSIX — с обратным
// знаком, — и «сегодня» в SQL (award_xp) разошлось бы с «сегодня» в TS на 6 часов.
const IANA_NAME = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)*$/;

/** Строка — действительный именованный IANA-пояс (проверку имени делает сама среда выполнения). */
export function isValidTimezone(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_TIMEZONE_LENGTH) return false;
  if (!IANA_NAME.test(value)) return false;
  try {
    formatterFor(value);
    return true;
  } catch {
    return false;
  }
}

/** Неизвестный или испорченный пояс не ломает день — возвращается UTC. */
export function normalizeTimezone(value: string | null | undefined): string {
  return isValidTimezone(value) ? value : DEFAULT_TIMEZONE;
}

interface WallParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function wallParts(at: Date, timeZone: string): WallParts {
  const parts: Record<string, number> = {};
  for (const part of formatterFor(timeZone).formatToParts(at)) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour === 24 ? 0 : parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

/** Смещение пояса от UTC на момент `at`, в миллисекундах (с учётом DST). */
export function timezoneOffsetMs(at: Date, timeZone: string): number {
  const p = wallParts(at, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  // миллисекунды отбрасываем у обеих сторон, иначе смещение «плывёт» на доли секунды
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

function pad(value: number, width = 2): string {
  return String(value).padStart(width, "0");
}

/** Дата по часам пояса, «YYYY-MM-DD». */
export function localDate(now: Date, timeZone: string): string {
  const p = wallParts(now, normalizeTimezone(timeZone));
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}`;
}

/** «Настенные часы» пояса, закодированные как UTC: getUTCDay()/toISOString()
 *  у результата дают локальные день недели и дату. Так существующий код,
 *  считающий неделю и дату в UTC, получает пользовательские — без переписывания. */
export function wallClock(now: Date, timeZone: string): Date {
  return new Date(now.getTime() + timezoneOffsetMs(now, normalizeTimezone(timeZone)));
}

export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Понедельник недели, в которую входит `day` (ISO-неделя). */
export function isoWeekStartOfDay(day: string): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  const weekday = (date.getUTCDay() + 6) % 7; // пн = 0
  return addDays(day, -weekday);
}

/** Первый момент (UTC, мс), у которого локальная дата в поясе уже не меньше `day`.
 *  Не «полночь»: если часы переводят вперёд ровно в 00:00 (Гавана, Асунсьон, Бейрут),
 *  полуночи в этот день нет, и день начинается с 01:00. Поэтому ищем границу дат
 *  бинарным поиском по секундам, а не вычитаем смещение — так соседние дни всегда
 *  стыкуются без зазора и перекрытия, а любой момент внутри окна имеет именно эту
 *  локальную дату. Дата по времени не убывает во всех актуальных поясах; у исторических
 *  переводов «назад через полночь» (Бразилия до 2019) результат — первая такая граница. */
function firstInstantOfDay(day: string, timeZone: string): number {
  const utcMidnight = Date.parse(`${day}T00:00:00.000Z`);
  // Смещения поясов лежат в −12…+14 ч: на нижней границе дата заведомо раньше day, на верхней — не раньше.
  let lo = Math.floor((utcMidnight - 27 * 3_600_000) / 1000);
  let hi = Math.floor((utcMidnight + 15 * 3_600_000) / 1000);
  const reached = (seconds: number) => localDate(new Date(seconds * 1000), timeZone) >= day;
  while (hi - lo > 1) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (reached(mid)) hi = mid;
    else lo = mid;
  }
  return hi * 1000;
}

export interface DayWindow {
  /** Включительно. */
  startIso: string;
  /** Исключительно — полночь следующего дня. Запросы: gte(start).lt(end). */
  endIso: string;
}

export function dayWindow(day: string, timeZone: string): DayWindow {
  const tz = normalizeTimezone(timeZone);
  return {
    startIso: new Date(firstInstantOfDay(day, tz)).toISOString(),
    endIso: new Date(firstInstantOfDay(addDays(day, 1), tz)).toISOString(),
  };
}

export interface UserClock {
  timezone: string;
  today: string;
  yesterday: string;
  twoDaysAgo: string;
  /** Понедельник текущей недели по календарю пользователя. */
  weekStart: string;
  /** Локальное время как UTC-дата (см. wallClock). */
  wall: Date;
  todayWindow: DayWindow;
  now: Date;
}

export function userClock(timezone: string | null | undefined, now: Date = new Date()): UserClock {
  const tz = normalizeTimezone(timezone);
  const today = localDate(now, tz);
  return {
    timezone: tz,
    today,
    yesterday: addDays(today, -1),
    twoDaysAgo: addDays(today, -2),
    weekStart: isoWeekStartOfDay(today),
    wall: wallClock(now, tz),
    todayWindow: dayWindow(today, tz),
    now,
  };
}

/** Сколько миллисекунд осталось до ближайшей полуночи пользователя. */
export function msUntilNextDay(clock: Pick<UserClock, "todayWindow" | "now">): number {
  return Math.max(0, Date.parse(clock.todayWindow.endIso) - clock.now.getTime());
}

export const MS_PER_DAY = DAY_MS;
