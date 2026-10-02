import assert from "node:assert/strict";
import test from "node:test";
import { reviewSrsState, isLearned, DEFAULT_SRS_PARAMS, type SrsState } from "./srs.ts";

// Базовая линия поведения текущего SM-2-подобного алгоритма (src/lib/srs.ts)
// перед возможной будущей миграцией на ts-fsrs. Значения ниже получены
// прогоном самой reviewSrsState(), не подобраны вручную — при осознанном
// изменении алгоритма эти тесты должны быть пересчитаны, а не подогнаны.
//
// easeFactor сравнивается с допуском — это результат чисел с плавающей
// точкой (например 2.5 + (0.1 - 3 * 0.14) в JS даёт 2.1799999999999997,
// не ровно 2.18), допуск отражает саму природу float-арифметики, а не
// неопределённость поведения функции.
const EASE_EPSILON = 1e-9;

function assertEaseClose(actual: number, expected: number) {
  assert.ok(
    Math.abs(actual - expected) < EASE_EPSILON,
    `easeFactor ${actual} не совпадает с ожидаемым ${expected}`,
  );
}

// Состояние по умолчанию для новой карточки — совпадает с DEFAULT в
// supabase/migrations/0004_decks.sql (ease_factor 2.5, interval_days 0,
// repetitions 0), не выдумано для теста.
const NEW_CARD: SrsState = { easeFactor: 2.5, intervalDays: 0, repetitions: 0 };

test("возвращает ровно три поля состояния, без даты — due_at считается не здесь", () => {
  const result = reviewSrsState(NEW_CARD, 2);
  assert.deepEqual(Object.keys(result).sort(), ["easeFactor", "intervalDays", "repetitions"]);
});

test("grade=0 (не помню): сбрасывает repetitions и ставит interval=1", () => {
  const result = reviewSrsState({ easeFactor: 2.5, intervalDays: 10, repetitions: 3 }, 0);
  assert.equal(result.repetitions, 0);
  assert.equal(result.intervalDays, 1);
  assertEaseClose(result.easeFactor, 2.18);
});

test("grade=0: ease factor не опускается ниже минимума 1.3, даже если уже на границе", () => {
  const result = reviewSrsState({ easeFactor: 1.3, intervalDays: 5, repetitions: 2 }, 0);
  assert.equal(result.repetitions, 0);
  assert.equal(result.intervalDays, 1);
  assertEaseClose(result.easeFactor, 1.3);
});

test("первое успешное повторение (grade=2, Помню): repetitions растёт, interval = graduatingIntervalDays", () => {
  const result = reviewSrsState(NEW_CARD, 2);
  assert.equal(result.repetitions, 1);
  assert.equal(result.intervalDays, 1); // DEFAULT_SRS_PARAMS.graduatingIntervalDays
  assertEaseClose(result.easeFactor, 2.5);
  assert.ok(result.intervalDays > 0, "интервал должен быть в будущем (положительный)");
});

test("первое успешное повторение (grade=3, Легко): interval = easyIntervalDays, а не graduatingIntervalDays", () => {
  const result = reviewSrsState(NEW_CARD, 3);
  assert.equal(result.repetitions, 1);
  assert.equal(result.intervalDays, 4); // DEFAULT_SRS_PARAMS.easyIntervalDays
  assertEaseClose(result.easeFactor, 2.6);
});

test("первое успешное повторение (grade=1, Трудно): тоже засчитывается как успех, но снижает ease", () => {
  const result = reviewSrsState(NEW_CARD, 1);
  assert.equal(result.repetitions, 1);
  assert.equal(result.intervalDays, 1); // graduatingIntervalDays — формула не различает grade 1 и 2 на первом шаге
  assertEaseClose(result.easeFactor, 2.36);
});

test("второе повторение (repetitions=1): фиксированный интервал 6 дней, не формула ease*interval", () => {
  const result = reviewSrsState({ easeFactor: 2.5, intervalDays: 1, repetitions: 1 }, 2);
  assert.equal(result.repetitions, 2);
  assert.equal(result.intervalDays, 6);
  assertEaseClose(result.easeFactor, 2.5);
});

test("третье+ повторение (repetitions>=2): interval = round(interval * ease * intervalModifier)", () => {
  // Единственная ветка, где интервал реально считается формулой ease*interval,
  // а не фиксированным значением. Из {ease 2.5, interval 6, reps 2} + grade 2:
  // 6 * 2.5 * 1.0 = 15, без бонуса, без обрезки maxInterval.
  const result = reviewSrsState({ easeFactor: 2.5, intervalDays: 6, repetitions: 2 }, 2);
  assert.equal(result.repetitions, 3);
  assert.equal(result.intervalDays, 15);
  assertEaseClose(result.easeFactor, 2.5);
});

test("третье+ повторение с grade=3 (Легко): к формуле применяется easyBonus (1.3)", () => {
  // Из {ease 2.5, interval 6, reps 2} + grade 3: 6 * 2.5 * 1.0 = 15,
  // затем * easyBonus 1.3 = 19.5, round -> 20. easeFactor растёт до 2.6.
  const result = reviewSrsState({ easeFactor: 2.5, intervalDays: 6, repetitions: 2 }, 3);
  assert.equal(result.intervalDays, 20);
  assertEaseClose(result.easeFactor, 2.6);
});

test("минимальный ease factor: повторные grade=0 стабилизируются на 1.3, не уходят ниже", () => {
  let state: SrsState = { easeFactor: 2.5, intervalDays: 10, repetitions: 3 };
  for (let i = 0; i < 10; i++) {
    state = reviewSrsState(state, 0);
    assert.ok(state.easeFactor >= 1.3, `итерация ${i}: easeFactor ${state.easeFactor} ниже минимума 1.3`);
  }
  assertEaseClose(state.easeFactor, 1.3);
});

test("максимальный interval: результат не превышает maxIntervalDays (36500), даже если формула даёт больше", () => {
  // 40000 * 2.5 = 100000 без ограничения — проверяем, что реальный результат
  // обрезан до params.maxIntervalDays, а не просто "большое число".
  const result = reviewSrsState({ easeFactor: 2.5, intervalDays: 40000, repetitions: 5 }, 2);
  assert.equal(result.intervalDays, 36500);
  assert.equal(result.repetitions, 6);
});

test("максимальный interval применяется и при grade=3 (Легко) с бонусом", () => {
  const result = reviewSrsState({ easeFactor: 2.5, intervalDays: 40000, repetitions: 5 }, 3);
  assert.equal(result.intervalDays, 36500);
});

test("кастомные params переопределяют дефолты (Study Settings в разделе «Мозг»)", () => {
  const params = { ...DEFAULT_SRS_PARAMS, graduatingIntervalDays: 2, easyIntervalDays: 7, intervalModifier: 2.0 };
  assert.equal(reviewSrsState(NEW_CARD, 2, params).intervalDays, 2);
  assert.equal(reviewSrsState(NEW_CARD, 3, params).intervalDays, 7);
  // intervalModifier применяется к фиксированному 6-дневному второму повтору:
  // round(6 * 2.0) = 12.
  assert.equal(reviewSrsState({ easeFactor: 2.5, intervalDays: 2, repetitions: 1 }, 2, params).intervalDays, 12);
});

test("isLearned: карточка считается выученной только при intervalDays>=21 И repetitions>=3", () => {
  // Контракт используется в src/lib/vocabulary-list.ts для вывода
  // status 'known' vs 'learning' — регрессия здесь меняет статистику прогресса.
  assert.equal(isLearned({ easeFactor: 2.5, intervalDays: 21, repetitions: 3 }), true);
  assert.equal(isLearned({ easeFactor: 2.5, intervalDays: 20, repetitions: 3 }), false);
  assert.equal(isLearned({ easeFactor: 2.5, intervalDays: 21, repetitions: 2 }), false);
});
