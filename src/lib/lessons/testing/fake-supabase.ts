// Минимальная имитация supabase-js (PostgREST) поверх массива строк — для
// тестов supabase-store.ts. Фильтры eq/is/not вычисляются по-настоящему, так что
// опечатка в колонке или условии даст другой результат, чем ожидает тест.
// Ограничения БД воспроизводятся там, где на них опирается код: два частичных
// уникальных индекса из миграции 0058 (23505). Это не замена проверке на
// Postgres (она выполнена отдельно), а способ прогнать TypeScript-код хранилища.

type Row = Record<string, unknown>;
type Filter = (row: Row) => boolean;

export interface FakeError {
  message: string;
  code?: string;
}

interface Result {
  data: Row | Row[] | null;
  error: FakeError | null;
  count?: number | null;
}

class Query implements PromiseLike<Result> {
  private filters: Filter[] = [];
  private action: "select" | "insert" | "update" = "select";
  private payload: Row = {};
  private head = false;
  private wantCount = false;
  private single: "none" | "maybe" | "one" = "none";
  private readonly db: FakeDb;
  private readonly table: string;

  constructor(db: FakeDb, table: string) {
    this.db = db;
    this.table = table;
  }

  select(_columns?: string, options?: { count?: "exact"; head?: boolean }): this {
    // После insert/update `.select()` лишь просит вернуть строки — действие прежнее.
    if (options?.count) this.wantCount = true;
    if (options?.head) this.head = true;
    return this;
  }

  insert(payload: Row): this {
    this.action = "insert";
    this.payload = payload;
    return this;
  }

  update(payload: Row): this {
    this.action = "update";
    this.payload = payload;
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  is(column: string, value: null): this {
    this.filters.push((row) => (value === null ? row[column] === null || row[column] === undefined : row[column] === value));
    return this;
  }

  not(column: string, operator: string, value: null): this {
    if (operator !== "is") throw new Error(`fake: unsupported not-operator ${operator}`);
    this.filters.push((row) => !(value === null ? row[column] === null || row[column] === undefined : row[column] === value));
    return this;
  }

  private orderBy: { column: string; ascending: boolean } | null = null;
  private limitTo: number | null = null;

  order(column: string, options?: { ascending?: boolean }): this {
    this.orderBy = { column, ascending: options?.ascending ?? true };
    return this;
  }

  limit(count: number): this {
    this.limitTo = count;
    return this;
  }

  maybeSingle(): this {
    this.single = "maybe";
    return this;
  }

  // `.single()` после insert/update: возвращает возвращённую строку.
  singleRow(): this {
    this.single = "one";
    return this;
  }

  then<R1 = Result, R2 = never>(
    onfulfilled?: ((value: Result) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }

  private run(): Result {
    const injected = this.db.takeInjected(this.table, this.action);
    if (injected) return { data: null, error: injected };

    const rows = this.db.rows(this.table);
    if (this.action === "insert") {
      const violation = this.db.checkInsert(this.table, this.payload);
      if (violation) return { data: null, error: violation };
      const row = this.db.materialize(this.table, this.payload);
      rows.push(row);
      return this.finish([row]);
    }
    const matched = rows.filter((row) => this.filters.every((f) => f(row)));
    if (this.action === "update") {
      const snapshot = matched.map((row) => ({ ...row }));
      for (const row of matched) Object.assign(row, this.payload);
      const violation = this.db.checkUnique(this.table);
      if (violation) {
        // откат: ограничение нарушено — строки возвращаются в прежнее состояние
        matched.forEach((row, i) => Object.assign(row, snapshot[i]));
        return { data: null, error: violation };
      }
      return this.finish(matched);
    }
    return this.finish(matched);
  }

  private finish(rows: Row[]): Result {
    let ordered = rows;
    if (this.orderBy) {
      const { column, ascending } = this.orderBy;
      ordered = [...rows].sort((a, b) => String(a[column] ?? "").localeCompare(String(b[column] ?? "")) * (ascending ? 1 : -1));
    }
    if (this.limitTo !== null) ordered = ordered.slice(0, this.limitTo);
    const copy = ordered.map((r) => structuredClone(r));
    const count = this.wantCount ? copy.length : undefined;
    if (this.head) return { data: null, error: null, count };
    if (this.single === "maybe" || this.single === "one") {
      if (copy.length > 1) return { data: null, error: { message: "multiple rows returned" } };
      if (copy.length === 0 && this.single === "one") return { data: null, error: { message: "no rows", code: "PGRST116" } };
      return { data: copy[0] ?? null, error: null, count };
    }
    return { data: copy, error: null, count };
  }
}

export class FakeDb {
  private tables = new Map<string, Row[]>();
  private injectedErrors: Array<{ table: string; action: string; error: FakeError }> = [];
  private seq = 0;
  /** Журнал запросов: какие действия и по каким таблицам выполнялись. */
  readonly log: Array<{ table: string; action: string }> = [];

  rows(table: string): Row[] {
    let rows = this.tables.get(table);
    if (!rows) {
      rows = [];
      this.tables.set(table, rows);
    }
    return rows;
  }

  injectError(table: string, action: "select" | "insert" | "update", error: FakeError): void {
    this.injectedErrors.push({ table, action, error });
  }

  takeInjected(table: string, action: string): FakeError | null {
    this.log.push({ table, action });
    const index = this.injectedErrors.findIndex((e) => e.table === table && e.action === action);
    if (index < 0) return null;
    return this.injectedErrors.splice(index, 1)[0].error;
  }

  materialize(table: string, payload: Row): Row {
    const now = "2026-01-01T00:00:00.000Z";
    if (table !== "lesson_attempts") return { id: `row-${++this.seq}`, ...payload };
    return {
      id: `00000000-0000-0000-0000-${String(++this.seq).padStart(12, "0")}`,
      path_version: 1,
      status: "in_progress",
      step_index: 0,
      answers: [],
      correct_count: 0,
      incorrect_count: 0,
      passed: null,
      score_ratio: null,
      xp_awarded: 0,
      xp_claimed_at: null,
      started_at: now,
      last_activity_at: now,
      completed_at: null,
      finalized_at: null,
      ...payload,
    };
  }

  checkInsert(table: string, payload: Row): FakeError | null {
    if (table !== "lesson_attempts") return null;
    const candidate = this.materialize(table, payload);
    this.seq--; // materialize увеличил счётчик, а строка ещё не вставлена
    return this.uniqueViolation([...this.rows(table), candidate]);
  }

  checkUnique(table: string): FakeError | null {
    return table === "lesson_attempts" ? this.uniqueViolation(this.rows(table)) : null;
  }

  // lesson_attempts_one_open_idx и lesson_attempts_one_xp_claim_idx
  private uniqueViolation(rows: Row[]): FakeError | null {
    const seenOpen = new Set<string>();
    const seenClaim = new Set<string>();
    for (const row of rows) {
      if (row.status === "in_progress") {
        const key = [row.user_id, row.path_slug, row.path_version, row.skill_key, row.mode].join("|");
        if (seenOpen.has(key)) return { code: "23505", message: 'duplicate key value violates unique constraint "lesson_attempts_one_open_idx"' };
        seenOpen.add(key);
      }
      if (row.xp_claimed_at !== null && row.xp_claimed_at !== undefined) {
        const key = [row.user_id, row.path_slug, row.path_version, row.skill_key].join("|");
        if (seenClaim.has(key)) return { code: "23505", message: 'duplicate key value violates unique constraint "lesson_attempts_one_xp_claim_idx"' };
        seenClaim.add(key);
      }
    }
    return null;
  }

  client() {
    return {
      from: (table: string) => {
        const query = new Query(this, table);
        // supabase-js: `.single()` доступен после select/insert/update
        return Object.assign(query, { single: () => query.singleRow() });
      },
    };
  }
}
