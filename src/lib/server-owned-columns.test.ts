import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

// Поля профиля, которые принадлежат серверу: награды, серия, заморозка, рекорд сессии, отметка идеальной
// недели. Клиентской роли запись в них закрыта триггером profiles_guard_rewards (миграция 0060); этот тест
// держит приложение в согласии с триггером: (1) список колонок в коде и в триггере один и тот же;
// (2) всякая запись этих колонок из кода — сервисной ролью; (3) новый писатель не появится незаметно.

const SRC = resolve(import.meta.dirname, "..");
const MIGRATION = readFileSync(resolve(SRC, "../supabase/migrations/0060_xp_rewards_lockdown.sql"), "utf8");

// Поля профиля, принадлежащие серверу (награды, серия, заморозка, рекорд, дуэли).
const SERVER_OWNED = [
  "xp",
  "xp_boost_until",
  "daily_quest_chest_claimed_date",
  "timezone_changed_at",
  "streak_current",
  "streak_longest",
  "last_active_date",
  "streak_freeze_available",
  "streak_freeze_week",
  "streak_before_break",
  "streak_repair_until",
  "review_best_session_count",
  "perfect_week_awarded_week",
  "duel_win_streak", // серию побед в дуэлях меняет только claim_duel_result() (security definer)
] as const;

/** Файлы, которым разрешено писать серверные колонки профиля (все — сервисной ролью). Новый файл — осознанное решение. */
const KNOWN_WRITERS = [
  "app/(app)/brain/[deckId]/review/actions.ts", // updateReviewBest
  "lib/daily-quests.ts", // сундук: заморозка, Double-XP, отметка
  "lib/moments/perfect-week-award.ts", // отметка идеальной недели
  "lib/streak.ts", // серия и заморозка
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Текст аргумента вызова: от открывающей скобки до парной закрывающей. */
function argumentText(text: string, openParen: number): string {
  let depth = 0;
  for (let i = openParen; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(") depth++;
    else if (ch === ")" && --depth === 0) return text.slice(openParen + 1, i);
  }
  return text.slice(openParen + 1);
}

/** Ключи объектного литерала верхнего уровня, в том числе у переменной `patch`, на которую ссылается аргумент. */
function writtenKeys(text: string, arg: string): string[] {
  const trimmed = arg.trim();
  const source = /^[A-Za-z_$][\w$]*$/.test(trimmed)
    ? [...text.matchAll(new RegExp(`(?:const|let)\\s+${trimmed}\\b[^=]*=([\\s\\S]*?);\\n`, "g"))].map((m) => m[1]).join("\n")
    : trimmed;
  return [...source.matchAll(/(?:^|[{,\s])([a-z_][a-z0-9_]*)\s*:/g)].map((m) => m[1]);
}

interface Write {
  file: string;
  keys: string[];
  viaService: boolean;
}

function findProfileWrites(): Write[] {
  const writes: Write[] = [];
  for (const path of walk(SRC)) {
    const text = readFileSync(path, "utf8");
    for (const m of text.matchAll(/\.from\((["'])profiles\1\)([\s\S]{0,160}?)\.(update|upsert|insert)\(/g)) {
      if (m[2].includes(";")) continue; // это уже другая инструкция
      const open = (m.index ?? 0) + m[0].length - 1;
      const keys = writtenKeys(text, argumentText(text, open)).filter((k) => (SERVER_OWNED as readonly string[]).includes(k));
      if (keys.length === 0) continue;
      const before = text.slice(Math.max(0, (m.index ?? 0) - 120), m.index ?? 0);
      writes.push({ file: relative(SRC, path), keys, viaService: /createServiceClient\(\)\s*$|\bservice\s*$/.test(before.trimEnd()) });
    }
  }
  return writes;
}

test("список серверных колонок в коде совпадает со списком в триггере profiles_guard_rewards", () => {
  const trigger = /create trigger profiles_guard_rewards\s+before insert or update of([\s\S]*?)\son profiles/.exec(MIGRATION);
  assert.ok(trigger, "триггер найден в 0060");
  const columns = trigger[1].split(",").map((c) => c.trim()).filter(Boolean).sort();
  assert.deepEqual(columns, [...SERVER_OWNED].sort());
  // и функция-страж сравнивает каждую из них
  for (const column of SERVER_OWNED) assert.ok(new RegExp(`new\\.${column} (is distinct from old\\.${column}|<> 0|is not null|is distinct from true)`).test(MIGRATION), `страж проверяет ${column}`);
});

test("запись серверных колонок профиля — только сервисной ролью и только из известных мест", () => {
  const writes = findProfileWrites();
  assert.ok(writes.length >= 4, `писатели найдены (${writes.length})`);
  for (const write of writes) assert.ok(write.viaService, `${write.file}: запись ${write.keys.join(", ")} клиентской ролью — её отклонит база (0060)`);
  assert.deepEqual([...new Set(writes.map((w) => w.file))].sort(), [...KNOWN_WRITERS].sort(), "новый писатель серверных колонок требует осознанного решения");
});

test("клиентские пути не пишут серверные колонки: настройки, цель, онбординг, часовой пояс остаются за пользователем", () => {
  // колонки, которые пользователь по-прежнему меняет сам, не попали в защищаемый список по ошибке
  for (const own of ["daily_xp_goal", "daily_word_goal", "daily_goal_type", "daily_goal_target", "timezone", "streak_goal_days", "leaderboard_opt_in", "preferred_notify_hour", "reader_settings", "completed_first_win", "last_rate_prompt_at"]) {
    assert.ok(!(SERVER_OWNED as readonly string[]).includes(own), own);
  }
});

test("updateReviewBest: без аргументов, размер сессии из журнала на сервере, рекорд только растёт, запись сервисной ролью", () => {
  const actions = readFileSync(resolve(SRC, "app/(app)/brain/[deckId]/review/actions.ts"), "utf8");
  const start = actions.indexOf("export async function updateReviewBest(");
  const body = actions.slice(start, actions.indexOf("\nexport ", start + 10));
  assert.match(body, /updateReviewBest\(\): Promise<\{ isNewRecord: boolean \}>/, "число от клиента не принимается");
  assert.match(body, /loadRecentReviews\(supabase, user\.id\)/);
  assert.match(body, /safeSession\(recent\)/);
  assert.match(body, /createServiceClient\(\)\s*\.from\("profiles"\)\s*\.update\(\{ review_best_session_count: session\.length \}\)/);
  assert.match(body, /\.lt\("review_best_session_count", session\.length\)/, "условное обновление: значение не уменьшается");
  const client = readFileSync(resolve(SRC, "app/(app)/brain/[deckId]/review/review-session.tsx"), "utf8");
  assert.match(client, /await updateReviewBest\(\)/);
  assert.doesNotMatch(client, /updateReviewBest\([^)]/, "клиент не передаёт размер сессии");
});

test("поиск писателей не слепой: на заведомо клиентской записи он срабатывает", () => {
  // самопроверка регэкспов: искусственный пример с клиентской записью серверной колонки
  const sample = `async function f(supabase) {\n  await supabase.from("profiles").update({ streak_current: 99 }).eq("id", u);\n}`;
  const m = /\.from\((["'])profiles\1\)([\s\S]{0,160}?)\.(update|upsert|insert)\(/.exec(sample);
  assert.ok(m);
  const open = (m.index ?? 0) + m[0].length - 1;
  assert.deepEqual(writtenKeys(sample, argumentText(sample, open)), ["streak_current"]);
  const withPatch = `const patch = cond ? { daily_goal_type: "xp", streak_current: 1 } : { daily_goal_type: "x" };\nawait s.from("profiles").update(patch)`;
  const p = /\.from\((["'])profiles\1\)([\s\S]{0,160}?)\.(update|upsert|insert)\(/.exec(withPatch)!;
  assert.ok(writtenKeys(withPatch, argumentText(withPatch, (p.index ?? 0) + p[0].length - 1)).includes("streak_current"), "ключи переменной patch учитываются");
});
