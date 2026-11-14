import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";

// Граница клиент/сервер. Два класса ошибок, которые не ловят ни tsc, ни eslint, ни
// проверка по ARIA, а проявляются пустым местом на экране или лишним кодом в бандле:
//   1) клиентский компонент ("use client") импортирует серверный модуль целиком —
//      в браузерный бандл попадают Supabase-клиент, начисление XP и сервисная роль;
//   2) серверный модуль берёт значение (константу) из клиентского файла: оно приходит
//      как client reference, и `CONST[key]` даёт undefined (так иконки заданий
//      рендерились пустыми).

const SRC = resolve(import.meta.dirname, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const files = walk(SRC).map((path) => ({ path, text: readFileSync(path, "utf8") }));
const isClient = (text: string) => /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use client["']/.test(text);
const clientFiles = files.filter((f) => isClient(f.text));

/** Серверные модули: их нельзя тянуть в браузерный бандл. */
const SERVER_ONLY = [
  "lib/supabase/service",
  "lib/supabase/server",
  "lib/xp/award",
  "lib/daily-quests", // серверная часть; клиентам — lib/daily-quests-model
  "lib/achievements-actions",
  "lib/achievements-award",
  "lib/rewards/achievements-view",
  "lib/user-clock-server",
  "lib/goals/activity",
  "lib/xp/rollout", // фаза выкладки читается сервисной ролью
];

function importsOf(text: string): Array<{ spec: string; names: string[]; typeOnly: boolean }> {
  const result: Array<{ spec: string; names: string[]; typeOnly: boolean }> = [];
  const re = /import\s+(type\s+)?([\s\S]*?)\s+from\s+["']([^"']+)["']/g;
  for (const m of text.matchAll(re)) {
    const names = [...m[2].matchAll(/([A-Za-z_$][\w$]*)(?:\s+as\s+[\w$]+)?/g)].map((x) => x[1]).filter((n) => n !== "type");
    result.push({ spec: m[3], names, typeOnly: Boolean(m[1]) });
  }
  return result;
}

function resolveSpec(fromFile: string, spec: string): string | null {
  const base = spec.startsWith("@/") ? join(SRC, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(fromFile), spec) : null;
  return base ? base.replace(/\.(ts|tsx)$/, "") : null;
}

test("клиентские компоненты не импортируют серверные модули (кроме типов)", () => {
  const offenders: string[] = [];
  for (const file of clientFiles) {
    for (const imp of importsOf(file.text)) {
      if (imp.typeOnly) continue;
      const target = resolveSpec(file.path, imp.spec);
      if (!target) continue;
      const rel = relative(SRC, target).replaceAll("\\", "/");
      // import { type X } — тоже только тип, если значений нет
      const valueNames = imp.names.filter((n) => !new RegExp(`type\\s+${n}\\b`).test(file.text));
      if (SERVER_ONLY.includes(rel) && valueNames.length > 0) offenders.push(`${relative(SRC, file.path)} → ${rel} (${valueNames.join(", ")})`);
    }
  }
  assert.deepEqual(offenders, []);
});

test("серверные модули не берут константы из клиентских файлов", () => {
  // Константы, экспортируемые из "use client" файла (ВЕРХНИЙ_РЕГИСТР).
  const constExports = new Map<string, string[]>();
  for (const file of clientFiles) {
    const names = [...file.text.matchAll(/export\s+const\s+([A-Z][A-Z0-9_]+)\b/g)].map((m) => m[1]);
    if (names.length > 0) constExports.set(file.path.replace(/\.(ts|tsx)$/, ""), names);
  }
  const offenders: string[] = [];
  for (const file of files) {
    if (isClient(file.text)) continue;
    for (const imp of importsOf(file.text)) {
      const target = resolveSpec(file.path, imp.spec);
      const exported = target ? constExports.get(target) : undefined;
      if (!exported) continue;
      const used = imp.names.filter((n) => exported.includes(n));
      if (used.length > 0) offenders.push(`${relative(SRC, file.path)} → ${relative(SRC, target!)} (${used.join(", ")})`);
    }
  }
  assert.deepEqual(offenders, []);
});

test("проверка границы действительно видит клиентские файлы", () => {
  assert.ok(clientFiles.length > 20, `найдено клиентских файлов: ${clientFiles.length}`);
  assert.ok(clientFiles.some((f) => f.path.endsWith("daily-quests-card.tsx")));
});
