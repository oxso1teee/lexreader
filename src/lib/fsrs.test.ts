import assert from "node:assert/strict";
import test from "node:test";
import {
  reviewFsrsCard,
  isFsrsEnabled,
  isFsrsEnabledForUser,
  isFsrsSchemaReady,
  computeFsrsShadowSafe,
  isMissingFsrsColumnsError,
  selectWithFsrsSchemaFallback,
  type FsrsStateRow,
} from "./fsrs.ts";

// Значения ниже получены прогоном самой reviewFsrsCard() с фиксированным
// `now`, не подобраны вручную — точная арифметика FSRS (веса модели,
// формулы stability/difficulty) не то, что стоит пересчитывать в уме.
// При намеренном изменении параметров (generatorParameters внутри fsrs.ts)
// эти тесты нужно пересчитать тем же способом, а не подогнать под старое
// поведение.
const NOW = new Date("2026-08-01T12:00:00.000Z");
const MAX_INTERVAL_DEFAULT = 36500;

const EMPTY_ROW: FsrsStateRow = {
  fsrsStability: null,
  fsrsDifficulty: null,
  fsrsState: null,
  fsrsLapses: 0,
  fsrsReps: 0,
  fsrsScheduledDays: 0,
  dueAt: NOW.toISOString(),
  lastReviewedAt: null,
};

test("возвращает форму FsrsReviewResult целиком, включая previous/next state карточки", () => {
  const result = reviewFsrsCard(EMPTY_ROW, 2, MAX_INTERVAL_DEFAULT, NOW);
  assert.deepEqual(
    Object.keys(result).sort(),
    [
      "dueAt",
      "fsrsDifficulty",
      "fsrsLapses",
      "fsrsReps",
      "fsrsScheduledDays",
      "fsrsStability",
      "fsrsState",
      "nextState",
      "previousState",
    ].sort(),
  );
  // Новая карточка (fsrsStability=null) стартует с ts-fsrs State.New (0).
  assert.equal(result.previousState.state, 0);
});

test("Again (grade=0) на новой карточке: короткий интервал, состояние переходит в Review", () => {
  const result = reviewFsrsCard(EMPTY_ROW, 0, MAX_INTERVAL_DEFAULT, NOW);
  assert.equal(result.fsrsScheduledDays, 1);
  assert.equal(result.fsrsReps, 1);
  assert.equal(result.fsrsLapses, 0); // первый провал новой карточки — это не "повторный провал", лапс не считается
  assert.equal(result.fsrsState, 2); // State.Review — при enable_short_term=false Learning-состояние пропускается
  assert.equal(result.dueAt, "2026-08-02T12:00:00.000Z");
});

test("Hard (grade=1) на новой карточке: интервал больше, чем у Again, ease/difficulty выше", () => {
  const result = reviewFsrsCard(EMPTY_ROW, 1, MAX_INTERVAL_DEFAULT, NOW);
  assert.equal(result.fsrsScheduledDays, 2);
  assert.equal(result.fsrsReps, 1);
  assert.equal(result.dueAt, "2026-08-03T12:00:00.000Z");
});

test("первое успешное повторение — Good (grade=2): repetitions=1, положительный интервал в будущем", () => {
  const result = reviewFsrsCard(EMPTY_ROW, 2, MAX_INTERVAL_DEFAULT, NOW);
  assert.equal(result.fsrsReps, 1);
  assert.equal(result.fsrsScheduledDays, 3);
  assert.ok(new Date(result.dueAt).getTime() > NOW.getTime(), "due date должна быть в будущем");
  assert.equal(result.dueAt, "2026-08-04T12:00:00.000Z");
});

test("Easy (grade=3) на новой карточке: интервал больше, чем у Good", () => {
  const easy = reviewFsrsCard(EMPTY_ROW, 3, MAX_INTERVAL_DEFAULT, NOW);
  const good = reviewFsrsCard(EMPTY_ROW, 2, MAX_INTERVAL_DEFAULT, NOW);
  assert.ok(easy.fsrsScheduledDays > good.fsrsScheduledDays);
  assert.equal(easy.fsrsScheduledDays, 8);
  assert.equal(easy.dueAt, "2026-08-09T12:00:00.000Z");
});

test("второе повторение после успешного первого: интервал растёт, reps увеличивается", () => {
  const first = reviewFsrsCard(EMPTY_ROW, 2, MAX_INTERVAL_DEFAULT, NOW);
  const rowAfterFirst: FsrsStateRow = {
    fsrsStability: first.fsrsStability,
    fsrsDifficulty: first.fsrsDifficulty,
    fsrsState: first.fsrsState,
    fsrsLapses: first.fsrsLapses,
    fsrsReps: first.fsrsReps,
    fsrsScheduledDays: first.fsrsScheduledDays,
    dueAt: first.dueAt,
    lastReviewedAt: NOW.toISOString(),
  };
  const laterNow = new Date(first.dueAt);
  const second = reviewFsrsCard(rowAfterFirst, 2, MAX_INTERVAL_DEFAULT, laterNow);
  assert.equal(second.fsrsReps, 2);
  assert.ok(second.fsrsScheduledDays > first.fsrsScheduledDays);
  assert.equal(second.fsrsScheduledDays, 16);
});

test("забытая карточка при повторном ревью (Again): fsrsLapses увеличивается, интервал резко падает", () => {
  const first = reviewFsrsCard(EMPTY_ROW, 2, MAX_INTERVAL_DEFAULT, NOW);
  const rowAfterFirst: FsrsStateRow = {
    fsrsStability: first.fsrsStability,
    fsrsDifficulty: first.fsrsDifficulty,
    fsrsState: first.fsrsState,
    fsrsLapses: first.fsrsLapses,
    fsrsReps: first.fsrsReps,
    fsrsScheduledDays: first.fsrsScheduledDays,
    dueAt: first.dueAt,
    lastReviewedAt: NOW.toISOString(),
  };
  const laterNow = new Date(first.dueAt);
  const lapsed = reviewFsrsCard(rowAfterFirst, 0, MAX_INTERVAL_DEFAULT, laterNow);
  assert.equal(lapsed.fsrsLapses, 1);
  assert.ok(lapsed.fsrsScheduledDays < first.fsrsScheduledDays);
});

test("максимальный interval: результат не превышает maxIntervalDays, даже если stability даёт больше", () => {
  const highStabilityRow: FsrsStateRow = {
    fsrsStability: 5000,
    fsrsDifficulty: 3,
    fsrsState: 2,
    fsrsLapses: 0,
    fsrsReps: 10,
    fsrsScheduledDays: 3000,
    dueAt: NOW.toISOString(),
    lastReviewedAt: new Date(NOW.getTime() - 3000 * 86_400_000).toISOString(),
  };
  const cappedTiny = reviewFsrsCard(highStabilityRow, 3, 30, NOW);
  assert.equal(cappedTiny.fsrsScheduledDays, 30);

  const cappedDefault = reviewFsrsCard(highStabilityRow, 3, MAX_INTERVAL_DEFAULT, NOW);
  assert.ok(cappedDefault.fsrsScheduledDays <= MAX_INTERVAL_DEFAULT);
});

test("isFsrsEnabled(): по умолчанию (без FSRS_ENABLED в окружении) — false, безопасный откат", () => {
  const original = process.env.FSRS_ENABLED;
  delete process.env.FSRS_ENABLED;
  try {
    assert.equal(isFsrsEnabled(), false);
  } finally {
    if (original === undefined) delete process.env.FSRS_ENABLED;
    else process.env.FSRS_ENABLED = original;
  }
});

test("computeFsrsShadowSafe(): при валидной строке ведёт себя как reviewFsrsCard (совпадающий результат)", () => {
  const safe = computeFsrsShadowSafe(EMPTY_ROW, 2, MAX_INTERVAL_DEFAULT, NOW);
  const direct = reviewFsrsCard(EMPTY_ROW, 2, MAX_INTERVAL_DEFAULT, NOW);
  assert.deepEqual(safe, direct);
});

// FSRS Release Review (Шаг 5): критическое требование — при падении
// shadow-расчёта (например, из-за повреждённой/неожиданной строки БД)
// вызывающий код (reviewWord) не должен получить исключение, иначе старое
// SM-2-повторение сломается вместе с новым FSRS-кодом. `row: null as any`
// здесь имитирует именно такой сбой — не то, что actions.ts передаёт в
// норме, а то, что должно быть безопасно перехвачено, если форма данных
// когда-нибудь окажется не той, что ожидает rowToCard().
test("computeFsrsShadowSafe(): не бросает исключение и возвращает null, если reviewFsrsCard упал", () => {
  const originalConsoleError = console.error;
  let loggedArgs: unknown[] | null = null;
  console.error = (...args: unknown[]) => {
    loggedArgs = args;
  };
  try {
    const result = computeFsrsShadowSafe(null as unknown as FsrsStateRow, 2, MAX_INTERVAL_DEFAULT, NOW);
    assert.equal(result, null);
    assert.ok(loggedArgs, "ошибка должна быть залогирована, а не проглочена молча");
    const loggedText = (loggedArgs as unknown[]).map(String).join(" ");
    // Приватные данные (текст карточки, id пользователя, содержимое строки
    // srs_state) не должны попадать в лог — только текст самой ошибки.
    assert.ok(!loggedText.includes("srs_state"));
  } finally {
    console.error = originalConsoleError;
  }
});

test("isFsrsEnabled(): true только при точном значении строки 'true'", () => {
  const original = process.env.FSRS_ENABLED;
  try {
    process.env.FSRS_ENABLED = "true";
    assert.equal(isFsrsEnabled(), true);
    process.env.FSRS_ENABLED = "1";
    assert.equal(isFsrsEnabled(), false); // не булево приведение — точное сравнение строк
    process.env.FSRS_ENABLED = "false";
    assert.equal(isFsrsEnabled(), false);
  } finally {
    if (original === undefined) delete process.env.FSRS_ENABLED;
    else process.env.FSRS_ENABLED = original;
  }
});

// Production Rollout Phase 1, инцидент 2026-08-01: код и migration 0032
// могут быть задеплоены раздельно — reviewWord()/review-страница используют
// isMissingFsrsColumnsError() на error от Supabase-select, чтобы откатиться
// на легаси-select вместо падения всего запроса.
test("isMissingFsrsColumnsError(): true для Postgres 42703 (undefined_column)", () => {
  assert.equal(isMissingFsrsColumnsError({ code: "42703" }), true);
});

test("isMissingFsrsColumnsError(): false для других кодов ошибок и для null/undefined", () => {
  assert.equal(isMissingFsrsColumnsError({ code: "23505" }), false); // unique_violation, для примера
  assert.equal(isMissingFsrsColumnsError({}), false);
  assert.equal(isMissingFsrsColumnsError(null), false);
  assert.equal(isMissingFsrsColumnsError(undefined), false);
});

// FSRS Schema Compatibility Hotfix: FSRS_SCHEMA_READY — отдельный от
// FSRS_ENABLED флаг, подтверждающий, что migration 0032 применена.
test("isFsrsSchemaReady(): true только при точном значении строки 'true'", () => {
  const original = process.env.FSRS_SCHEMA_READY;
  try {
    process.env.FSRS_SCHEMA_READY = "true";
    assert.equal(isFsrsSchemaReady(), true);
    process.env.FSRS_SCHEMA_READY = "1";
    assert.equal(isFsrsSchemaReady(), false);
    delete process.env.FSRS_SCHEMA_READY;
    assert.equal(isFsrsSchemaReady(), false);
  } finally {
    if (original === undefined) delete process.env.FSRS_SCHEMA_READY;
    else process.env.FSRS_SCHEMA_READY = original;
  }
});

// FSRS Controlled Activation: account-level allowlist до глобального
// FSRS_ENABLED=true — server-side only (FSRS_ENABLED_USER_IDS, не
// NEXT_PUBLIC_), сравнивается с auth.uid(), не с email.
function withAllowlist(value: string | undefined, run: () => void) {
  const original = process.env.FSRS_ENABLED_USER_IDS;
  try {
    if (value === undefined) delete process.env.FSRS_ENABLED_USER_IDS;
    else process.env.FSRS_ENABLED_USER_IDS = value;
    run();
  } finally {
    if (original === undefined) delete process.env.FSRS_ENABLED_USER_IDS;
    else process.env.FSRS_ENABLED_USER_IDS = original;
  }
}

test("isFsrsEnabledForUser(): переменная не задана -> никто не включён", () => {
  withAllowlist(undefined, () => {
    assert.equal(isFsrsEnabledForUser("eee0e646-56c4-470b-b60f-aea90212ca86"), false);
  });
});

test("isFsrsEnabledForUser(): userId в списке -> true", () => {
  withAllowlist("aaaa,eee0e646-56c4-470b-b60f-aea90212ca86,bbbb", () => {
    assert.equal(isFsrsEnabledForUser("eee0e646-56c4-470b-b60f-aea90212ca86"), true);
  });
});

test("isFsrsEnabledForUser(): userId не в списке -> false", () => {
  withAllowlist("aaaa,bbbb", () => {
    assert.equal(isFsrsEnabledForUser("eee0e646-56c4-470b-b60f-aea90212ca86"), false);
  });
});

test("isFsrsEnabledForUser(): userId не передан (undefined) -> всегда false, даже если список непустой", () => {
  withAllowlist("aaaa,bbbb", () => {
    assert.equal(isFsrsEnabledForUser(undefined), false);
  });
});

test("isFsrsEnabledForUser(): whitespace вокруг элементов обрабатывается безопасно", () => {
  withAllowlist("  aaaa , eee0e646-56c4-470b-b60f-aea90212ca86 ,bbbb  ", () => {
    assert.equal(isFsrsEnabledForUser("eee0e646-56c4-470b-b60f-aea90212ca86"), true);
  });
});

test("isFsrsEnabledForUser(): дубликаты в списке не ломают проверку", () => {
  withAllowlist("eee0e646-56c4-470b-b60f-aea90212ca86,eee0e646-56c4-470b-b60f-aea90212ca86", () => {
    assert.equal(isFsrsEnabledForUser("eee0e646-56c4-470b-b60f-aea90212ca86"), true);
  });
});

test("isFsrsEnabledForUser(): 'мусорный' список (пустая строка, только запятые/пробелы) не включает никого", () => {
  withAllowlist("", () => {
    assert.equal(isFsrsEnabledForUser("eee0e646-56c4-470b-b60f-aea90212ca86"), false);
  });
  withAllowlist(" , , ,  ,", () => {
    assert.equal(isFsrsEnabledForUser("eee0e646-56c4-470b-b60f-aea90212ca86"), false);
    // Мусорный список не должен случайно совпасть и с пустой строкой как id.
    assert.equal(isFsrsEnabledForUser(""), false);
  });
});

test("isFsrsEnabledForUser(): сравнение точное, не подстрокой (частичное совпадение id не включает)", () => {
  withAllowlist("eee0e646-56c4-470b-b60f-aea90212ca86", () => {
    assert.equal(isFsrsEnabledForUser("eee0e646"), false);
    assert.equal(isFsrsEnabledForUser("eee0e646-56c4-470b-b60f-aea90212ca86-extra"), false);
  });
});

// selectWithFsrsSchemaFallback: решает ДО запроса (schemaReady), плюс
// defense-in-depth откат на легаси при 42703, если флаг всё же выставлен
// раньше реальной миграции. Проверяется на простых мок-функциях — реальная
// проверка select()-строк на настоящей pre-0032 схеме сделана отдельно
// (см. docs/learning/fsrs-schema-compatibility.md, "Проверка против
// pre-0032 схемы").
test("selectWithFsrsSchemaFallback(): schemaReady=false — легаси-запрос вызывается, FSRS-запрос не вызывается вообще", async () => {
  let fsrsCalled = false;
  const result = await selectWithFsrsSchemaFallback(
    false,
    async () => {
      fsrsCalled = true;
      return { data: { fsrs_stability: 1 }, error: null };
    },
    async () => ({ data: { legacy: true }, error: null }),
  );
  assert.equal(fsrsCalled, false, "при schemaReady=false FSRS-запрос не должен даже отправляться");
  assert.equal(result.usedFsrsColumns, false);
  assert.deepEqual(result.data, { legacy: true });
});

test("selectWithFsrsSchemaFallback(): schemaReady=true, FSRS-запрос успешен — легаси не вызывается", async () => {
  let legacyCalled = false;
  const result = await selectWithFsrsSchemaFallback(
    true,
    async () => ({ data: { fsrs_stability: 1 }, error: null }),
    async () => {
      legacyCalled = true;
      return { data: { legacy: true }, error: null };
    },
  );
  assert.equal(legacyCalled, false);
  assert.equal(result.usedFsrsColumns, true);
  assert.deepEqual(result.data, { fsrs_stability: 1 });
});

test("selectWithFsrsSchemaFallback(): schemaReady=true, но колонок ещё нет (42703) — откатывается на легаси", async () => {
  const result = await selectWithFsrsSchemaFallback(
    true,
    async () => ({ data: null, error: { code: "42703" } }),
    async () => ({ data: { legacy: true }, error: null }),
  );
  assert.equal(result.usedFsrsColumns, false);
  assert.deepEqual(result.data, { legacy: true });
  assert.equal(result.error, null);
});

test("selectWithFsrsSchemaFallback(): schemaReady=true, ошибка НЕ 42703 — не откатывается, отдаёт реальную ошибку как есть", async () => {
  let legacyCalled = false;
  const result = await selectWithFsrsSchemaFallback(
    true,
    async () => ({ data: null, error: { code: "PGRST116" } }), // "no rows", например
    async () => {
      legacyCalled = true;
      return { data: { legacy: true }, error: null };
    },
  );
  assert.equal(legacyCalled, false, "не 42703-ошибки не должны маскироваться откатом на легаси");
  assert.equal(result.usedFsrsColumns, true);
  assert.deepEqual(result.error, { code: "PGRST116" });
});
