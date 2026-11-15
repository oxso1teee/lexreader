import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Схема БД, восстановленная из миграций supabase/migrations: таблицы с колонками и параметры
// функций. Нужна тестам запросов — чтобы опечатка в имени колонки или параметра RPC ловилась
// до выката, а не ответом 400 от PostgREST. Читает только текст миграций (простой разбор
// create table / alter table add|drop|rename column / create function), поэтому
// для нетривиального DDL (динамический SQL, DO-блоки) его нужно дополнять.

export interface Schema {
  tables: Map<string, Set<string>>;
  functions: Map<string, string[]>;
}

function stripComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

function splitTopLevel(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of body) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** Текст внутри скобки, открытой на позиции `open` (включительно), до парной закрывающей. */
function balanced(sql: string, open: number): string {
  let depth = 0;
  for (let i = open; i < sql.length; i++) {
    if (sql[i] === "(") depth++;
    if (sql[i] === ")") {
      depth--;
      if (depth === 0) return sql.slice(open + 1, i);
    }
  }
  throw new Error("несбалансированные скобки в миграции");
}

const CONSTRAINT_START = /^(primary|unique|check|foreign|constraint|exclude|like)\b/i;
const table = (name: string) => name.replace(/^public\./i, "").replace(/"/g, "").toLowerCase();

export function readSchema(dir: string): Schema {
  const tables = new Map<string, Set<string>>();
  const functions = new Map<string, string[]>();
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    const sql = stripComments(readFileSync(join(dir, file), "utf8"));

    for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?([\w."]+)\s*\(/gi)) {
      const body = balanced(sql, m.index! + m[0].length - 1);
      const columns = new Set<string>();
      for (const element of splitTopLevel(body)) {
        if (CONSTRAINT_START.test(element)) continue;
        const name = /^"?([A-Za-z_][A-Za-z0-9_]*)"?/.exec(element)?.[1];
        if (name) columns.add(name.toLowerCase());
      }
      tables.set(table(m[1]), columns);
    }

    for (const m of sql.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?([\w."]+)\s+([^;]+);/gi)) {
      const columns = tables.get(table(m[1]));
      if (!columns) continue;
      for (const action of splitTopLevel(m[2])) {
        const add = /^add\s+column\s+(?:if\s+not\s+exists\s+)?"?([A-Za-z_][A-Za-z0-9_]*)"?/i.exec(action);
        if (add) columns.add(add[1].toLowerCase());
        const drop = /^drop\s+column\s+(?:if\s+exists\s+)?"?([A-Za-z_][A-Za-z0-9_]*)"?/i.exec(action);
        if (drop) columns.delete(drop[1].toLowerCase());
        const rename = /^rename\s+column\s+"?(\w+)"?\s+to\s+"?(\w+)"?/i.exec(action);
        if (rename) {
          columns.delete(rename[1].toLowerCase());
          columns.add(rename[2].toLowerCase());
        }
      }
    }

    for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?(\w+)\s*\(/gi)) {
      const args = balanced(sql, m.index! + m[0].length - 1);
      const names = splitTopLevel(args)
        .map((a) => /^"?([A-Za-z_][A-Za-z0-9_]*)"?/.exec(a)?.[1])
        .filter((n): n is string => Boolean(n));
      functions.set(m[1].toLowerCase(), names);
    }
  }
  return { tables, functions };
}
