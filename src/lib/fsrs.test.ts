import assert from "node:assert/strict";
import test from "node:test";
import { reviewFsrsCard, isFsrsEnabled, type FsrsStateRow } from "./fsrs.ts";

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
