import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { awardXp } from "./xp/award.ts";
import { checkAndAwardAchievements, loadAchievementStats } from "./achievements-actions.ts";
import { STAT_KEYS } from "./achievements-catalog.ts";
import { claimDailyQuestChest, getDailyQuestsSnapshot, getOrGenerateDailyQuests, getRecentQuestDays } from "./daily-quests.ts";
import { supabaseGoalSyncPorts } from "./goals/goal-sync-server.ts";
import { loadAchievementViews, loadRecentAchievements } from "./rewards/achievements-view.ts";
import { loadXpHistory } from "./rewards/history.ts";
import { createRecorder, type RecordedRequest, type Responder } from "./testing/postgrest-recorder.ts";
import { splitTopLevel, validateLogicalTree, validateRequest, validateSelect } from "./testing/postgrest-grammar.ts";
import { readSchema, type Schema } from "./testing/sql-schema.ts";
import { updateTimezoneIfChanged } from "./user-timezone.ts";
import { loadPendingXp } from "./xp/rollout.ts";
import { userClock } from "./user-day.ts";
import { touchStreak } from "./streak.ts";
import { countReviewsInWindow, loadAwardedRefs, loadLatestReviewId, loadRecentReviews, RECENT_LIMIT } from "./xp/review-bonuses.ts";

// Запросы Iteration 6 к PostgREST, проверенные настоящим клиентом supabase-js.
//
// ЧТО ПРОВЕРЯЕТСЯ: клиентская библиотека строит HTTP-запрос — путь, query-строку, Prefer,
// тело; тест перехватывает его и сверяет (1) с документированной грамматикой PostgREST
// (.or / .is / .neq / .in / .not / !inner / on_conflict / order / limit), (2) со схемой,
// восстановленной из миграций (таблицы, колонки, параметры RPC), (3) с точным ожидаемым
// видом самых важных запросов.
//
// ЧЕГО НЕ ПРОВЕРЯЕТСЯ: живой PostgREST и живой Supabase. Как сервер разберёт запрос и какой
// SQL выполнит — здесь не проверено; SQL-часть (функции, триггеры, права, RLS) отдельно
// проверена на временном PostgreSQL. Ответы в тестах заготовлены вручную.

const schema: Schema = readSchema(resolve(import.meta.dirname, "../../supabase/migrations"));
const U = "00000000-0000-4000-8000-000000000001";

// ---------- проверка схемы ----------

function columnsOf(table: string, problems: string[], where: string): Set<string> {
  const columns = schema.tables.get(table);
  if (!columns) problems.push(`${where}: нет таблицы «${table}» в миграциях`);
  return columns ?? new Set();
}

function checkSelect(select: string, table: string, problems: string[], where: string): void {
  const columns = columnsOf(table, problems, where);
  for (const item of splitTopLevel(select) ?? []) {
    if (item === "*") continue;
    const embedded = /^(?:\w+:)?(\w+)(?:![\w]+)*\(([\s\S]*)\)$/.exec(item);
    if (embedded) {
      checkSelect(embedded[2], embedded[1], problems, `${where}→${embedded[1]}`);
      continue;
    }
    const name = /^(?:\w+:)?(\w+)/.exec(item)?.[1];
    if (name && !columns.has(name)) problems.push(`${where}: нет колонки ${table}.${name}`);
  }
}

function conformanceProblems(request: RecordedRequest): string[] {
  const problems: string[] = [];
  const where = `${request.method} ${request.table ?? `rpc/${request.rpc}`}`;
  if (request.rpc) {
    const params = schema.functions.get(request.rpc);
    if (!params) return [`${where}: функции нет в миграциях`];
    const body = (request.body ?? {}) as Record<string, unknown>;
    for (const key of Object.keys(body)) if (!params.includes(key)) problems.push(`${where}: нет параметра ${key} (есть: ${params.join(", ")})`);
    return problems;
  }
  const table = request.table!;
  const columns = columnsOf(table, problems, where);
  if (columns.size === 0) return problems;
  const select = request.query.get("select");
  if (select) checkSelect(select, table, problems, `${where} select`);

  const embeddedTables = new Set<string>();
  for (const m of (select ?? "").matchAll(/(\w+)(?:![\w]+)*\(/g)) embeddedTables.add(m[1]);
  const checkColumn = (ref: string, label: string) => {
    const parts = ref.split(".");
    if (parts.length === 2) {
      if (!embeddedTables.has(parts[0])) problems.push(`${where} ${label}: «${parts[0]}» не встроен в select`);
      else if (!columnsOf(parts[0], problems, where).has(parts[1])) problems.push(`${where} ${label}: нет колонки ${parts[0]}.${parts[1]}`);
    } else if (!columns.has(ref)) problems.push(`${where} ${label}: нет колонки ${table}.${ref}`);
  };

  for (const [key, value] of request.query) {
    if (key === "select" || key === "limit" || key === "offset") continue;
    if (key === "order") for (const item of value.split(",")) checkColumn(item.split(".")[0], "order");
    else if (key === "on_conflict") for (const c of value.split(",")) checkColumn(c, "on_conflict");
    else if (key === "columns") for (const c of value.split(",")) checkColumn(c.replace(/"/g, ""), "columns");
    else if (key === "or" || key === "and") for (const m of value.matchAll(/(?:^|[(,])((?:\w+\.)?\w+)\.(?:not\.)?(?:eq|neq|is|in|gt|gte|lt|lte)\./g)) checkColumn(m[1], key);
    else checkColumn(key, "filter");
  }
  const rows = Array.isArray(request.body) ? request.body : request.body ? [request.body] : [];
  for (const row of rows as Array<Record<string, unknown>>) for (const key of Object.keys(row)) checkColumn(key, "body");
  return problems;
}

function assertAllValid(requests: readonly RecordedRequest[], label: string): void {
  assert.ok(requests.length > 0, `${label}: запросов не было`);
  const problems = requests.flatMap((r) => [...validateRequest(r), ...conformanceProblems(r)]);
  assert.deepEqual(problems, [], `${label}`);
}

const find = (requests: readonly RecordedRequest[], method: string, table: string, nth = 0) =>
  requests.filter((r) => r.method === method && (r.table === table || r.rpc === table))[nth];

// ---------- сами проверки валидатора (чтобы он не был послушным) ----------

test("валидатор грамматики: корректные формы проходят, поломанные отклоняются", () => {
  const ok = [
    "(a.is.null,a.neq.2026-11-14)",
    "(a.eq.1,and(b.gte.2,b.lt.5))",
    "(a.in.(1,2,3),not.or(b.is.true,c.eq.x))",
    "(user_a.eq.u1,user_b.eq.u1)",
  ];
  for (const value of ok) assert.deepEqual(validateLogicalTree(value, "or"), [], value);
  const bad = [
    "a.is.null,a.neq.x", // без скобок
    "(a.is.maybe)", // is с чужим значением
    "(a.in.1,2)", // in без скобок
    "(a.foo.1)", // неизвестный оператор
    "(a.eq.1,,b.eq.2)", // пустой элемент
    "(a.eq.1", // не закрыта
    "(a)", // не условие
  ];
  for (const value of bad) assert.notDeepEqual(validateLogicalTree(value, "or"), [], value);

  assert.deepEqual(validateSelect("id,grade,flashcards!inner(owner_id,language)"), []);
  assert.deepEqual(validateSelect("count:id,a:b,texts!inner(title)"), []);
  for (const bad of ["id,,grade", "id grade", "flashcards!inner(owner_id", "id,flashcards!inner()", "1abc"]) assert.notDeepEqual(validateSelect(bad), [], bad);
});

test("схема из миграций: новые таблицы, колонки и параметры функций на месте", () => {
  assert.ok(schema.tables.get("xp_events")?.has("base_amount"));
  assert.ok(schema.tables.get("profiles")?.has("timezone_changed_at"));
  assert.ok(schema.tables.get("profiles")?.has("daily_goal_type"));
  assert.deepEqual(schema.functions.get("award_xp"), ["p_user", "p_source", "p_ref", "p_amount", "p_daily_cap"]);
  assert.deepEqual(schema.functions.get("mark_goal_met"), ["p_user", "p_day"]);
  // схема ловит опечатку
  const fake = { method: "GET", url: new URL("http://x/rest/v1/profiles?select=timezoen"), table: "profiles", rpc: null, query: new URL("http://x/rest/v1/profiles?select=timezoen").searchParams, rawSearch: "", headers: {}, body: undefined } as RecordedRequest;
  assert.notDeepEqual(conformanceProblems(fake), []);
});

// ---------- смена часового пояса ----------

const LIVE = async () => "live" as const;

test("updateTimezoneIfChanged: условное обновление .or(is.null, neq) и кодирование имени пояса", async () => {
  const { client, requests } = createRecorder((r) => (r.method === "PATCH" ? { body: [{ id: U }] } : undefined));
  assert.equal(await updateTimezoneIfChanged(client, U, "Etc/GMT+3", LIVE), "changed");
  const patch = requests[0];
  assertAllValid(requests, "timezone");
  assert.equal(patch.method, "PATCH");
  assert.equal(patch.table, "profiles");
  assert.equal(patch.query.get("id"), `eq.${U}`);
  assert.equal(patch.query.get("or"), "(timezone.is.null,timezone.neq.Etc/GMT+3)");
  assert.equal(patch.query.get("select"), "id");
  assert.deepEqual(patch.body, { timezone: "Etc/GMT+3" });
  assert.match(patch.headers["prefer"] ?? "", /return=representation/);
  assert.match(patch.rawSearch, /Etc%2FGMT%2B3/, "«+» закодирован: иначе сервер прочёл бы пробел");
});

test("updateTimezoneIfChanged: исходы — без строк, отказ по частоте, имя не из базы, чужие значения не уходят", async () => {
  const unchanged = createRecorder(() => ({ body: [] }));
  assert.equal(await updateTimezoneIfChanged(unchanged.client, U, "Europe/Moscow", LIVE), "unchanged");
  const refused = createRecorder(() => ({ status: 400, body: { code: "55000", message: "timezone_change_too_frequent", details: null, hint: null } }));
  assert.equal(await updateTimezoneIfChanged(refused.client, U, "Europe/Moscow", LIVE), "refused");
  const unknown = createRecorder(() => ({ status: 400, body: { code: "22023", message: "invalid_timezone", details: null, hint: null } }));
  assert.equal(await updateTimezoneIfChanged(unknown.client, U, "Europe/Moscow", LIVE), "invalid");
  const broken = createRecorder(() => ({ status: 500, body: { code: "XX000", message: "boom", details: null, hint: null } }));
  assert.equal(await updateTimezoneIfChanged(broken.client, U, "Europe/Moscow", LIVE), "error");
  const local = createRecorder();
  for (const bad of ["+03:00", "Europe/Moscow,or.id.eq.1", "x)", 42, null]) assert.equal(await updateTimezoneIfChanged(local.client, U, bad, LIVE), "invalid");
  assert.equal(local.requests.length, 0, "невалидное имя до запроса не доходит — инъекция в or() невозможна");
});

// ---------- задания дня и сундук ----------

const DEFS = [
  { quest_type: "read_minutes", target: 10 },
  { quest_type: "review_words", target: 15 },
  { quest_type: "combo_streak", target: 5 },
];
const reviews = Array.from({ length: 20 }, (_, i) => ({ flashcard_id: `f${i}`, grade: 3, reviewed_at: `2026-11-14T09:${String(i).padStart(2, "0")}:00Z` }));

const chestResponder: Responder = (r) => {
  if (r.rpc === "award_xp") return { body: { status: "awarded", event_id: "e1", awarded: 30, base: 30, boosted: false, goal: 50, day: "2026-11-14", total_before: 100, total_after: 130, today_before: 60, today_after: 90 } };
  if (r.table === "profiles" && r.method === "GET") return { body: [{ daily_quest_chest_claimed_date: null, target_language: "en", timezone: "Europe/Moscow" }] };
  if (r.table === "profiles" && r.method === "PATCH") return { body: [{ id: U }] };
  if (r.table === "daily_quests") return { body: DEFS };
  if (r.table === "activity_days") return { body: [{ xp: 80 }] };
  if (r.table === "reading_sessions") return { body: [{ started_at: "2026-11-14T08:00:00Z", ended_at: "2026-11-14T08:12:00Z" }] };
  if (r.table === "review_log") return { body: reviews };
  return undefined;
};

test("getOrGenerateDailyQuests: чтение, upsert с ignore-duplicates и on_conflict по уникальному ключу, повторное чтение", async () => {
  const { client, requests } = createRecorder((r) => (r.method === "GET" && requests.filter((x) => x.method === "GET").length === 1 ? { body: [] } : r.method === "GET" ? { body: DEFS } : undefined));
  const defs = await getOrGenerateDailyQuests(client, U, "2026-11-14", "en", "live");
  assert.equal(defs.length, 3);
  assertAllValid(requests, "daily_quests");
  assert.deepEqual(requests.map((r) => r.method), ["GET", "POST", "GET"]);
  const read = requests[0];
  assert.equal(read.query.get("select"), "quest_type, target".replace(/\s/g, ""));
  assert.equal(read.query.get("owner_id"), `eq.${U}`);
  assert.equal(read.query.get("day"), "eq.2026-11-14");
  const upsert = requests[1];
  assert.equal(upsert.query.get("on_conflict"), "owner_id,day,quest_type");
  assert.match(upsert.headers["prefer"] ?? "", /resolution=ignore-duplicates/);
  const rows = upsert.body as Array<Record<string, unknown>>;
  assert.equal(rows.length, 3);
  for (const row of rows) assert.deepEqual(Object.keys(row).sort(), ["day", "owner_id", "quest_type", "target"]);
});

test("claimDailyQuestChest: порядок и вид запросов; награда — RPC с точными параметрами; отметка — условный PATCH", async () => {
  const { client, requests, install } = createRecorder(chestResponder);
  const restore = install();
  try {
    const result = await claimDailyQuestChest(client, U, new Date("2026-11-14T12:00:00Z"), "live");
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.xpAwarded, 30);
  } finally {
    restore();
  }
  assertAllValid(requests, "chest");

  const rpc = find(requests, "POST", "award_xp");
  assert.deepEqual(rpc.body, { p_user: U, p_source: "quest_chest", p_ref: "2026-11-14", p_amount: 30, p_daily_cap: null });

  const patch = find(requests, "PATCH", "profiles");
  assert.equal(patch.query.get("id"), `eq.${U}`);
  assert.equal(patch.query.get("or"), "(daily_quest_chest_claimed_date.is.null,daily_quest_chest_claimed_date.neq.2026-11-14)");
  assert.equal(patch.query.get("select"), "id");
  assert.deepEqual(Object.keys(patch.body as object).sort(), ["daily_quest_chest_claimed_date", "streak_freeze_available", "xp_boost_until"]);
  assert.match(patch.headers["prefer"] ?? "", /return=representation/);
  // запись наград — сервисным ключом, не пользовательским
  assert.equal(patch.headers["apikey"], "test-service-key");
  assert.equal(rpc.headers["apikey"], "test-service-key");
  // порядок: сначала проверки, потом начисление, потом отметка
  const order = requests.map((r) => `${r.method} ${r.table ?? r.rpc}`);
  assert.ok(order.indexOf("POST award_xp") > order.lastIndexOf("GET reading_sessions"));
  assert.ok(order.indexOf("PATCH profiles") > order.indexOf("POST award_xp"));
});

test("claimDailyQuestChest: отказ в отметке (другая вкладка успела) — награда не выдаётся второй раз", async () => {
  const { client, install } = createRecorder((r) => (r.method === "PATCH" ? { body: [] } : chestResponder(r)));
  const restore = install();
  try {
    const result = await claimDailyQuestChest(client, U, new Date("2026-11-14T12:00:00Z"), "live");
    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /уже открыт/);
  } finally {
    restore();
  }
});

test("getDailyQuestsSnapshot и getRecentQuestDays: фильтры in(...), окна дня, выборка событий сундука", async () => {
  const snap = createRecorder((r) => (r.table === "xp_events" ? { body: [{ ref: "2026-11-14" }] } : chestResponder(r)));
  const clock = userClock("Europe/Moscow", new Date("2026-11-14T12:00:00Z"));
  const snapshot = await getDailyQuestsSnapshot(snap.client, U, "en", { clock, phase: "live" });
  assert.equal(snapshot.chestClaimedToday, true);
  assertAllValid(snap.requests, "snapshot");
  const events = find(snap.requests, "GET", "xp_events");
  assert.equal(events.query.get("ref"), "in.(2026-11-14)");
  assert.equal(events.query.get("source"), "eq.quest_chest");
  assert.equal(events.query.get("user_id"), `eq.${U}`);

  const past = createRecorder((r) => (r.table === "daily_quests" ? { body: DEFS.map((d) => ({ ...d, day: "2026-11-13" })) } : chestResponder(r)));
  const days = await getRecentQuestDays(past.client, U, "en", clock, 3, "live");
  assert.equal(days.length, 1);
  assertAllValid(past.requests, "past quests");
  assert.equal(find(past.requests, "GET", "daily_quests").query.get("day"), "in.(2026-11-13,2026-11-12,2026-11-11)");
});

test("loadDailyActivity (через снимок): окна по локальному дню — gte/lt в ISO, встроенный фильтр flashcards.owner_id", async () => {
  const { client, requests } = createRecorder(chestResponder);
  const clock = userClock("Europe/Moscow", new Date("2026-11-14T12:00:00Z"));
  await getDailyQuestsSnapshot(client, U, "en", { clock, phase: "live" });
  const sessions = find(requests, "GET", "reading_sessions");
  // два условия на одну колонку — два параметра started_at, а не один
  assert.deepEqual(sessions.query.getAll("started_at"), ["gte.2026-11-13T21:00:00.000Z", "lt.2026-11-14T21:00:00.000Z"]);
  const log = find(requests, "GET", "review_log");
  assert.equal(log.query.get("select"), "flashcard_id,grade,reviewed_at,flashcards!inner(owner_id,language)");
  assert.equal(log.query.get("flashcards.owner_id"), `eq.${U}`);
  assert.equal(log.query.get("flashcards.language"), "eq.en");
  assert.equal(log.query.get("order"), "reviewed_at.asc");
  const attempts = find(requests, "GET", "lesson_attempts");
  assert.equal(attempts.query.get("status"), "eq.completed");
  assert.deepEqual(attempts.query.getAll("completed_at"), ["gte.2026-11-13T21:00:00.000Z", "lt.2026-11-14T21:00:00.000Z"]);
  assert.equal(find(requests, "GET", "activity_days").query.get("day"), "eq.2026-11-14");
});

// ---------- достижения ----------

test("loadAchievementStats: все показатели — HEAD-счётчики с Prefer count=exact, not.is.null, встроенные фильтры", async () => {
  const { client, requests } = createRecorder((r) =>
    r.table === "profiles"
      ? { body: [{ xp: 10, streak_current: 1, streak_longest: 4, review_best_session_count: 2, perfect_week_awarded_week: null, daily_quest_chest_claimed_date: null }] }
      : r.method === "HEAD"
        ? { count: 7 }
        : undefined,
  );
  const stats = await loadAchievementStats(client, U, "en", STAT_KEYS, "live");
  assert.equal(stats.totalWords, 7);
  assert.equal(stats.bestStreak, 4);
  assertAllValid(requests, "achievement stats");
  const heads = requests.filter((r) => r.method === "HEAD");
  assert.ok(heads.length >= 6);
  for (const head of heads) assert.match(head.headers["prefer"] ?? "", /count=exact/);
  assert.equal(find(requests, "HEAD", "user_skill_progress").query.get("content_completed_at"), "not.is.null");
  const texts = find(requests, "HEAD", "text_progress");
  assert.equal(texts.query.get("select"), "text_id,texts!inner(owner_id,language)");
  assert.equal(texts.query.get("texts.language"), "eq.en");
  assert.equal(texts.query.get("percent_read"), "gte.100");
  assert.equal(find(requests, "HEAD", "activity_days").query.get("goal_met"), "eq.true");
  assert.deepEqual(requests.filter((r) => r.table === "xp_events").map((r) => r.query.get("source")).sort(), ["eq.perfect_week", "eq.quest_chest"]);
});

test("checkAndAwardAchievements: запись — upsert ignore-duplicates + on_conflict, сервисным ключом", async () => {
  const { client, requests, install } = createRecorder((r) => {
    if (r.table === "user_achievements" && r.method === "GET") return { body: [] };
    if (r.table === "profiles") return { body: [{ xp: 1200, streak_current: 0, streak_longest: 0, review_best_session_count: 0, perfect_week_awarded_week: null, daily_quest_chest_claimed_date: null }] };
    if (r.method === "HEAD") return { count: 0 };
    if (r.table === "user_achievements" && r.method === "POST") return { body: (r.body as Array<{ achievement_id: string }>).map((row) => ({ achievement_id: row.achievement_id })) };
    return undefined;
  });
  const restore = install();
  let ids: string[];
  try {
    ids = await checkAndAwardAchievements(client, U, "en", "live");
  } finally {
    restore();
  }
  assert.deepEqual(ids.sort(), ["xp_100", "xp_1000", "xp_500"]);
  assertAllValid(requests, "achievements");
  const insert = find(requests, "POST", "user_achievements");
  assert.equal(insert.query.get("on_conflict"), "owner_id,achievement_id");
  assert.match(insert.headers["prefer"] ?? "", /resolution=ignore-duplicates/);
  assert.equal(insert.query.get("select"), "achievement_id");
  assert.equal(insert.headers["apikey"], "test-service-key");
  assert.deepEqual((insert.body as Array<Record<string, unknown>>).map((r) => Object.keys(r).sort().join()), ["achievement_id,owner_id", "achievement_id,owner_id", "achievement_id,owner_id"]);
});

test("витрина достижений и последние достижения", async () => {
  const views = createRecorder((r) => (r.table === "user_achievements" ? { body: [{ achievement_id: "xp_100", earned_at: "2026-11-01T10:00:00Z" }] } : r.table === "profiles" ? { body: [{ xp: 150, streak_current: 0, streak_longest: 0, review_best_session_count: 0, perfect_week_awarded_week: null, daily_quest_chest_claimed_date: null }] } : r.method === "HEAD" ? { count: 0 } : undefined));
  const list = await loadAchievementViews(views.client, U, "en");
  assert.equal(list.find((v) => v.id === "xp_100")?.status, "earned");
  assertAllValid(views.requests, "achievement views");

  const recent = createRecorder((r) => (r.table === "user_achievements" ? { body: [{ achievement_id: "xp_100", earned_at: "2026-11-01T10:00:00Z" }] } : undefined));
  assert.deepEqual(await loadRecentAchievements(recent.client, U, 3), [{ id: "xp_100", earnedAt: "2026-11-01T10:00:00Z" }]);
  assertAllValid(recent.requests, "recent achievements");
  const req = recent.requests[0];
  assert.equal(req.query.get("order"), "earned_at.desc");
  assert.equal(req.query.get("limit"), "3");
});

// ---------- журнал XP ----------

test("loadXpHistory: порядок и лимит", async () => {
  const { client, requests } = createRecorder(() => ({ body: [{ id: "e1", source: "lesson_complete", amount: 20, boosted: false, day: "2026-11-14", created_at: "2026-11-14T10:00:00Z" }] }));
  const days = await loadXpHistory(client, U);
  assert.equal(days[0].total, 20);
  assertAllValid(requests, "xp history");
  assert.equal(requests[0].query.get("order"), "created_at.desc");
  assert.equal(requests[0].query.get("limit"), "40");
  assert.equal(requests[0].query.get("select"), "id,source,amount,boosted,day,created_at");
});

test("бонусы повторения: последние оценки (новые первыми, лимит), счёт мест за день, последняя оценка, выплаченные ключи", async () => {
  const now = new Date("2026-11-14T12:00:00Z");
  const { client, requests } = createRecorder((r) => {
    if (r.table === "xp_events") return { body: [{ ref: "a:5" }, { ref: "a:10" }] };
    if (r.method === "HEAD") return { count: 7 };
    // порядок убывания, как просит запрос
    return { body: [{ id: "b", grade: 3, reviewed_at: "2026-11-14T11:59:50Z" }, { id: "a", grade: 2, reviewed_at: "2026-11-14T11:59:30Z" }] };
  });
  const recent = await loadRecentReviews(client, U, now);
  assert.deepEqual(recent.rows.map((r) => r.id), ["a", "b"], "строки приведены к порядку по возрастанию");
  assert.equal(recent.truncated, false);
  const clock = userClock("Asia/Tokyo", now);
  assert.equal(await countReviewsInWindow(client, U, clock.todayWindow), 7);
  assert.equal(await loadLatestReviewId(client, U), "b");
  assert.deepEqual([...(await loadAwardedRefs(client, U, "combo_bonus", ["a:5", "a:10", "a:15"]))].sort(), ["a:10", "a:5"]);
  assert.equal((await loadAwardedRefs(client, U, "combo_bonus", [])).size, 0, "без ключей запроса нет");
  assertAllValid(requests, "review bonuses");

  const [recentReq, countReq, latestReq, refsReq] = requests;
  assert.equal(recentReq.query.get("select"), "id,grade,reviewed_at,flashcards!inner(owner_id)");
  assert.equal(recentReq.query.get("flashcards.owner_id"), `eq.${U}`);
  assert.equal(recentReq.query.get("reviewed_at"), "gte.2026-11-13T12:00:00.000Z", "окно — 24 часа назад, а не локальный день");
  assert.equal(recentReq.query.get("order"), "reviewed_at.desc");
  assert.equal(recentReq.query.get("limit"), String(RECENT_LIMIT));
  assert.equal(countReq.method, "HEAD");
  assert.deepEqual(countReq.query.getAll("reviewed_at"), ["gte.2026-11-13T15:00:00.000Z", "lt.2026-11-14T15:00:00.000Z"], "окно локального дня пользователя (в Токио 21:00 14-го)");
  assert.equal(latestReq.query.get("order"), "reviewed_at.desc");
  assert.equal(latestReq.query.get("limit"), "1");
  assert.equal(latestReq.query.get("flashcards.owner_id"), `eq.${U}`, "последняя оценка ПОЛЬЗОВАТЕЛЯ, а не карточки");
  assert.equal(refsReq.query.get("ref"), "in.(a:5,a:10,a:15)");
  assert.equal(refsReq.query.get("source"), "eq.combo_bonus");
});

test("loadRecentReviews: ответ ровно в размер лимита помечается как обрезанный", async () => {
  const body = Array.from({ length: RECENT_LIMIT }, (_, i) => ({ id: `r${i}`, grade: 3, reviewed_at: new Date(Date.parse("2026-11-14T11:00:00Z") + (RECENT_LIMIT - i) * 1000).toISOString() }));
  const { client } = createRecorder(() => ({ body }));
  assert.equal((await loadRecentReviews(client, U, new Date("2026-11-14T12:00:00Z"))).truncated, true);
});

test("awardXp: RPC award_xp — параметры совпадают с SQL-функцией, ключ сервисный", async () => {
  const { requests, install } = createRecorder(() => ({ body: { status: "duplicate", awarded: 20, day: "2026-11-14" } }));
  const restore = install();
  try {
    const outcome = await awardXp(U, { source: "lesson_complete", ref: "attempt-1", amount: 20 });
    assert.equal(outcome.status, "duplicate");
  } finally {
    restore();
  }
  assertAllValid(requests, "award_xp");
  assert.equal(requests[0].url.pathname, "/rest/v1/rpc/award_xp");
  assert.deepEqual(Object.keys(requests[0].body as object), schema.functions.get("award_xp"), "имена и порядок параметров как в create function");
  assert.equal(requests[0].headers["apikey"], "test-service-key");
});

// ---------- синхронизация цели ----------

test("supabaseGoalSyncPorts: профиль, проверка отметки, mark_goal_met через RPC", async () => {
  const { client, requests, install } = createRecorder((r) => {
    if (r.table === "profiles") return { body: [{ timezone: "Europe/Moscow", target_language: "en", daily_xp_goal: 50, daily_goal_type: "lessons", daily_goal_target: 2 }] };
    if (r.table === "activity_days") return { body: [{ goal_met: false }] };
    if (r.rpc === "mark_goal_met") return { body: true };
    return undefined;
  });
  const restore = install();
  try {
    const ports = supabaseGoalSyncPorts(client);
    assert.equal((await ports.loadProfile(U))?.daily_goal_type, "lessons");
    assert.equal(await ports.isGoalMet(U, "2026-11-14"), false);
    assert.equal(await ports.markGoalMet(U, "2026-11-14"), true);
  } finally {
    restore();
  }
  assertAllValid(requests, "goal sync");
  assert.deepEqual(find(requests, "POST", "mark_goal_met").body, { p_user: U, p_day: "2026-11-14" });
  assert.equal(find(requests, "GET", "profiles").query.get("select"), "timezone,target_language,daily_xp_goal,daily_goal_type,daily_goal_target");
  assert.equal(find(requests, "GET", "activity_days").query.get("select"), "goal_met");
});

// ---------- барьер выкладки: фаза overlap ----------

test("loadPendingXp (overlap): запрос неприменённых событий — корректный PostgREST, только по своему пользователю", async () => {
  const { client, requests } = createRecorder((r) => (r.table === "xp_events" ? { body: [{ day: "2026-11-14", amount: 5 }, { day: "2026-11-14", amount: 7 }] } : undefined));
  const pending = await loadPendingXp(client, U, "overlap");
  assert.equal(pending.total, 12);
  assertAllValid(requests, "pending xp");
  assert.equal(requests.length, 1);
  const read = requests[0];
  assert.equal(read.table, "xp_events");
  assert.equal(read.query.get("select"), "day,amount");
  assert.equal(read.query.get("user_id"), `eq.${U}`);
  assert.equal(read.query.get("applied"), "eq.false");
});

test("loadDailyActivity (overlap): XP дня = activity_days.xp + неприменённые события этого дня", async () => {
  const { client, requests } = createRecorder((r) => {
    if (r.table === "xp_events") return { body: [{ day: "2026-11-14", amount: 30 }, { day: "2026-11-13", amount: 99 }] };
    return chestResponder(r);
  });
  const clock = userClock(null, new Date("2026-11-14T12:00:00Z"));
  const snapshot = await getDailyQuestsSnapshot(client, U, "en", { clock, phase: "overlap" });
  assert.equal(snapshot.activity.xp, 80 + 30, "80 в счётчике дня + 30 в журнале; вчерашнее не примешивается");
  assertAllValid(requests, "overlap activity");
  assert.ok(requests.some((r) => r.table === "xp_events" && r.query.get("applied") === "eq.false"));
  // в live поправки нет и запроса нет
  const live = createRecorder(chestResponder);
  await getDailyQuestsSnapshot(live.client, U, "en", { clock, phase: "live" });
  assert.ok(!live.requests.some((r) => r.table === "xp_events" && r.query.get("applied")), "в live неприменённых нет — запрос не делается");
});

test("getOrGenerateDailyQuests (overlap): пишутся только прежние типы; лишняя четвёртая строка (гонка на стыке фаз) отбрасывается", async () => {
  const empty = createRecorder((r) => (r.method === "GET" && r.table === "daily_quests" ? { body: [] } : undefined));
  await getOrGenerateDailyQuests(empty.client, U, "2026-11-14", "en", "overlap");
  const upsert = empty.requests.find((r) => r.method === "POST" && r.table === "daily_quests");
  assert.ok(upsert, "набор записан");
  for (const row of upsert.body as Array<{ quest_type: string }>) assert.ok(["read_minutes", "review_words", "combo_streak"].includes(row.quest_type), row.quest_type);

  const raced = [...DEFS, { quest_type: "earn_xp", target: 40 }];
  const rows = createRecorder((r) => (r.method === "GET" ? { body: raced } : undefined));
  const defs = await getOrGenerateDailyQuests(rows.client, U, "2026-11-14", "en", "live");
  assert.deepEqual(defs.map((d) => d.questType), ["read_minutes", "review_words", "combo_streak"], "четвёртая строка не показывается");
});

test("updateTimezoneIfChanged: в overlap запроса нет (paused); отказ базы timezone_sync_paused тоже paused", async () => {
  const local = createRecorder();
  assert.equal(await updateTimezoneIfChanged(local.client, U, "Europe/Moscow", async () => "overlap"), "paused");
  assert.equal(local.requests.length, 0, "пока живы старые инстансы, пояс не пишется");
  assert.equal(await updateTimezoneIfChanged(local.client, U, "+03:00", async () => "overlap"), "invalid", "невалидное имя отсеивается раньше паузы");
  const refused = createRecorder(() => ({ status: 400, body: { code: "55000", message: "timezone_sync_paused", details: null, hint: null } }));
  assert.equal(await updateTimezoneIfChanged(refused.client, U, "Europe/Moscow", LIVE), "paused", "приложение решило, что live, а база ещё нет — не ошибка");
});

// ---------- серия и заморозка: запись только сервисной ролью ----------

test("touchStreak: поля серии и заморозки пишутся сервисным ключом; клиент пользователя только читает", async () => {
  const clock = userClock(null);
  const profile = {
    streak_current: 3,
    streak_longest: 5,
    last_active_date: clock.yesterday,
    streak_freeze_available: true,
    streak_freeze_week: null,
    streak_before_break: null,
    streak_repair_until: null,
    timezone: null,
  };
  const { client, requests, install } = createRecorder((r) => {
    if (r.table === "profiles" && r.method === "GET") return { body: profile };
    if (r.table === "profiles" && r.method === "PATCH") return { body: [] };
    if (r.rpc === "touch_friend_streaks") return { body: [] };
    return undefined;
  });
  const restore = install();
  let transition;
  try {
    transition = await touchStreak(client, U);
  } finally {
    restore();
  }
  assert.equal(transition?.before, 3);
  assert.equal(transition?.after, 4, "вчера была активность — серия растёт");
  assertAllValid(requests, "touchStreak");

  const patch = requests.find((r) => r.method === "PATCH" && r.table === "profiles");
  assert.ok(patch, "серия записана");
  assert.equal(patch.headers["apikey"], "test-service-key", "запись — сервисным ключом: клиентской роли поля серии закрыты (0060)");
  assert.deepEqual(Object.keys(patch.body as object).sort(), [
    "last_active_date", "streak_before_break", "streak_current", "streak_freeze_available", "streak_freeze_week", "streak_longest", "streak_repair_until",
  ]);
  assert.equal(patch.query.get("id"), `eq.${U}`);
  const userWrites = requests.filter((r) => r.headers["apikey"] !== "test-service-key" && r.method !== "GET" && !r.rpc);
  assert.deepEqual(userWrites.map((r) => `${r.method} ${r.table}`), [], "клиент пользователя ничего не пишет");
});

test("touchStreak: сохранённая неделя заморозки и отметка спасённого дня пишутся сервисной ролью", async () => {
  const clock = userClock(null);
  // пропущен один день, заморозка доступна — день спасается и отмечается в activity_days
  const profile = {
    streak_current: 7,
    streak_longest: 7,
    last_active_date: clock.twoDaysAgo,
    streak_freeze_available: true,
    streak_freeze_week: null,
    streak_before_break: null,
    streak_repair_until: null,
    timezone: null,
  };
  const { client, requests, install } = createRecorder((r) => {
    if (r.table === "profiles" && r.method === "GET") return { body: profile };
    if (r.table === "profiles" && r.method === "PATCH") return { body: [] };
    if (r.table === "activity_days") return { body: [] };
    if (r.rpc === "touch_friend_streaks") return { body: [] };
    return undefined;
  });
  const restore = install();
  try {
    const transition = await touchStreak(client, U);
    assert.equal(transition?.usedFreeze, true);
  } finally {
    restore();
  }
  const writes = requests.filter((r) => r.method !== "GET" && !r.rpc);
  assert.ok(writes.length >= 2);
  for (const write of writes) assert.equal(write.headers["apikey"], "test-service-key", `${write.method} ${write.table}`);
  const frozen = writes.find((r) => r.table === "activity_days");
  assert.ok(frozen);
  assert.equal((frozen.body as { freeze_used: boolean }).freeze_used, true);
});
