import type { RecordedRequest } from "./postgrest-recorder.ts";

// Строгая проверка запроса по документированной грамматике PostgREST (horizontal/vertical
// filtering, logical operators, embedding, Prefer). Возвращает список нарушений; пустой —
// запрос синтаксически корректен. Это проверка по документации, а не по живому серверу.

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const OPERATORS = new Set([
  "eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "match", "imatch", "in", "is", "isdistinct",
  "fts", "plfts", "phfts", "wfts", "cs", "cd", "ov", "sl", "sr", "nxr", "nxl", "adj",
]);
const IS_VALUES = new Set(["null", "true", "false", "unknown"]);
const RESERVED_PARAMS = new Set(["select", "order", "limit", "offset", "on_conflict", "columns", "and", "or"]);

/** Делит строку по запятым верхнего уровня (вне скобок и кавычек). */
export function splitTopLevel(value: string): string[] | null {
  const parts: string[] = [];
  let depth = 0;
  let quoted = false;
  let current = "";
  for (const ch of value) {
    if (ch === '"') quoted = !quoted;
    if (!quoted) {
      if (ch === "(") depth++;
      if (ch === ")") {
        depth--;
        if (depth < 0) return null;
      }
      if (ch === "," && depth === 0) {
        parts.push(current);
        current = "";
        continue;
      }
    }
    current += ch;
  }
  if (depth !== 0 || quoted) return null;
  parts.push(current);
  return parts;
}

export function validateSelect(value: string, where = "select"): string[] {
  const problems: string[] = [];
  if (/\s/.test(value)) problems.push(`${where}: пробелы в списке колонок`);
  const items = splitTopLevel(value);
  if (!items) return [...problems, `${where}: несбалансированные скобки`];
  for (const item of items) {
    if (item === "") {
      problems.push(`${where}: пустой элемент`);
      continue;
    }
    if (item === "*") continue;
    const embedded = /^(?:([A-Za-z_][A-Za-z0-9_]*):)?([A-Za-z_][A-Za-z0-9_]*)(?:![A-Za-z_][A-Za-z0-9_]*)*\(([\s\S]*)\)$/.exec(item);
    if (embedded) {
      problems.push(...validateSelect(embedded[3], `${where}.${embedded[2]}`));
      continue;
    }
    const column = /^(?:([A-Za-z_][A-Za-z0-9_]*):)?([A-Za-z_][A-Za-z0-9_]*)(?:::[A-Za-z_][A-Za-z0-9_ ]*)?$/.exec(item);
    if (!column) problems.push(`${where}: недопустимый элемент «${item}»`);
  }
  return problems;
}

function validateOperatorValue(op: string, value: string, where: string): string[] {
  if (!OPERATORS.has(op)) return [`${where}: неизвестный оператор «${op}»`];
  if (op === "is") return IS_VALUES.has(value) ? [] : [`${where}: is.${value} — допустимы null/true/false/unknown`];
  if (op === "in") {
    if (!/^\([\s\S]*\)$/.test(value)) return [`${where}: in требует скобки, получено «${value}»`];
    const items = splitTopLevel(value.slice(1, -1));
    return items && items.length > 0 && items.every((i) => i !== "") ? [] : [`${where}: пустой или битый список in`];
  }
  if (value === "") return [`${where}: ${op} с пустым значением`];
  return [];
}

/** `col.op.value`, `col.not.op.value`, вложенные and(...)/or(...)/not.and(...)/not.or(...). */
function validateLogicalItem(item: string, where: string): string[] {
  const nested = /^(not\.)?(and|or)\(([\s\S]*)\)$/.exec(item);
  if (nested) return validateLogicalTree(`(${nested[3]})`, `${where}.${nested[2]}`);
  const m = /^([A-Za-z_][A-Za-z0-9_.]*)\.(not\.)?([a-z]+)\.([\s\S]*)$/.exec(item);
  if (!m) return [`${where}: не условие «${item}»`];
  return validateOperatorValue(m[3], m[4], `${where}.${m[1]}`);
}

export function validateLogicalTree(value: string, where: string): string[] {
  if (!/^\([\s\S]*\)$/.test(value)) return [`${where}: логическое выражение должно быть в скобках, получено «${value}»`];
  const items = splitTopLevel(value.slice(1, -1));
  if (!items || items.length === 0 || items.some((i) => i === "")) return [`${where}: пустой или битый список условий`];
  return items.flatMap((item) => validateLogicalItem(item, where));
}

function validateOrder(value: string): string[] {
  const items = splitTopLevel(value);
  if (!items) return ["order: битая строка"];
  return items.flatMap((item) =>
    /^[A-Za-z_][A-Za-z0-9_]*(\.(asc|desc))?(\.(nullsfirst|nullslast))?$/.test(item) ? [] : [`order: недопустимый элемент «${item}»`],
  );
}

const PREFER_TOKENS: Record<string, readonly string[]> = {
  return: ["minimal", "representation", "headers-only"],
  resolution: ["merge-duplicates", "ignore-duplicates"],
  count: ["exact", "planned", "estimated"],
  missing: ["default", "null"],
};

function validatePrefer(header: string): string[] {
  const problems: string[] = [];
  for (const token of header.split(",").map((t) => t.trim())) {
    const [name, value] = token.split("=");
    const allowed = PREFER_TOKENS[name ?? ""];
    if (!allowed) problems.push(`Prefer: неизвестный токен «${token}»`);
    else if (!allowed.includes(value ?? "")) problems.push(`Prefer: ${name}=${value}`);
  }
  return problems;
}

export function validateRequest(request: RecordedRequest): string[] {
  const where = `${request.method} ${request.table ?? `rpc/${request.rpc}`}`;
  const problems: string[] = [];
  const target = request.table ?? request.rpc;
  if (!target || !IDENT.test(target)) problems.push(`${where}: недопустимое имя в пути ${request.url.pathname}`);

  const verbs = request.table ? ["GET", "HEAD", "POST", "PATCH", "DELETE"] : ["POST", "GET"];
  if (!verbs.includes(request.method)) problems.push(`${where}: метод не подходит`);

  for (const [key, value] of request.query) {
    if (key === "select") problems.push(...validateSelect(value).map((p) => `${where}: ${p}`));
    else if (key === "order") problems.push(...validateOrder(value).map((p) => `${where}: ${p}`));
    else if (key === "limit" || key === "offset") {
      if (!/^\d+$/.test(value)) problems.push(`${where}: ${key}=${value}`);
    } else if (key === "on_conflict") {
      if (!/^[A-Za-z_][A-Za-z0-9_]*(,[A-Za-z_][A-Za-z0-9_]*)*$/.test(value)) problems.push(`${where}: on_conflict=${value}`);
      if (request.method !== "POST") problems.push(`${where}: on_conflict только у POST`);
    } else if (key === "columns") {
      if (!/^"?[A-Za-z_][A-Za-z0-9_"]*(,"?[A-Za-z_][A-Za-z0-9_"]*)*$/.test(value)) problems.push(`${where}: columns=${value}`);
    } else if (key === "or" || key === "and") {
      problems.push(...validateLogicalTree(value, `${where}.${key}`));
    } else if (!RESERVED_PARAMS.has(key)) {
      // фильтр по колонке: col=op.value или встроенный ресурс rel.col=op.value
      if (!/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$/.test(key)) {
        problems.push(`${where}: недопустимый ключ фильтра «${key}»`);
        continue;
      }
      const m = /^(not\.)?([a-z]+)\.([\s\S]*)$/.exec(value);
      if (!m) problems.push(`${where}: фильтр ${key}=${value} не в форме op.value`);
      else problems.push(...validateOperatorValue(m[2], m[3], `${where}.${key}`));
    }
  }

  const prefer = request.headers["prefer"];
  if (prefer) problems.push(...validatePrefer(prefer).map((p) => `${where}: ${p}`));
  if (request.method === "HEAD" && !/count=/.test(prefer ?? "")) {
    // head-запрос без count бессмыслен: supabase-js ставит Prefer: count=... только при { count } в select
    problems.push(`${where}: HEAD без Prefer: count=…`);
  }
  if ((request.method === "PATCH" || request.method === "DELETE") && ![...request.query.keys()].some((k) => !RESERVED_PARAMS.has(k) || k === "or" || k === "and")) {
    problems.push(`${where}: изменение без фильтра затронет все строки`);
  }
  if (request.body !== undefined && request.method !== "GET") {
    const rows = Array.isArray(request.body) ? request.body : [request.body];
    if (!request.rpc && !rows.every((r) => typeof r === "object" && r !== null && Object.keys(r).every((k) => IDENT.test(k)))) {
      problems.push(`${where}: тело — не объект(ы) с именами колонок`);
    }
  }
  return problems;
}
