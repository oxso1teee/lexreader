import { test } from "node:test";
import assert from "node:assert/strict";
import { computeFirstSteps, shouldShowFirstSteps, FIRST_STEPS_WORD_TARGET } from "./first-steps.ts";

test("computeFirstSteps(): пустой аккаунт — 0 из 3, первый шаг текущий, остальные следующие", () => {
  const s = computeFirstSteps({ hasRead: false, savedWords: 0, hasReviewed: false, dueCount: 0 });
  assert.equal(s.total, 3);
  assert.equal(s.doneCount, 0);
  assert.equal(s.allDone, false);
  assert.deepEqual(
    s.steps.map((x) => [x.key, x.status]),
    [
      ["read", "current"],
      ["save-words", "upcoming"],
      ["review", "upcoming"],
    ],
  );
  assert.equal(s.steps[0].href, "/library");
  assert.equal(s.steps[1].hint, `0 из ${FIRST_STEPS_WORD_TARGET}`);
});

test("computeFirstSteps(): прочитал страницу — текущим становится сохранение слов, прогресс виден", () => {
  const s = computeFirstSteps({ hasRead: true, savedWords: 3, hasReviewed: false, dueCount: 0 });
  assert.equal(s.doneCount, 1);
  assert.equal(s.steps[0].status, "done");
  assert.equal(s.steps[0].href, null);
  assert.equal(s.steps[1].status, "current");
  assert.equal(s.steps[1].hint, "3 из 5");
});

test("computeFirstSteps(): слова считаются выполненными с пятого; больше пяти не ломает подпись", () => {
  const four = computeFirstSteps({ hasRead: true, savedWords: 4, hasReviewed: false, dueCount: 0 });
  assert.equal(four.steps[1].status, "current");
  const five = computeFirstSteps({ hasRead: true, savedWords: 5, hasReviewed: false, dueCount: 0 });
  assert.equal(five.steps[1].status, "done");
  const many = computeFirstSteps({ hasRead: true, savedWords: 40, hasReviewed: false, dueCount: 0 });
  assert.equal(many.steps[1].status, "done");
  assert.equal(many.steps[1].hint, "Готово");
});

test("computeFirstSteps(): повторение недоступно без карточек к повтору и ведёт на повтор, когда они есть", () => {
  const none = computeFirstSteps({ hasRead: true, savedWords: 5, hasReviewed: false, dueCount: 0 });
  assert.equal(none.steps[2].status, "current");
  assert.equal(none.steps[2].href, null);
  assert.match(none.steps[2].hint, /Откроется/);

  const due = computeFirstSteps({ hasRead: true, savedWords: 5, hasReviewed: false, dueCount: 7 });
  assert.equal(due.steps[2].href, "/brain/all/review");
  assert.equal(due.steps[2].hint, "Карточек к повтору: 7");
});

test("computeFirstSteps(): всё выполнено — allDone, ни у одного шага нет ссылки", () => {
  const s = computeFirstSteps({ hasRead: true, savedWords: 9, hasReviewed: true, dueCount: 3 });
  assert.equal(s.allDone, true);
  assert.equal(s.doneCount, 3);
  assert.ok(s.steps.every((x) => x.status === "done" && x.href === null));
});

test("computeFirstSteps(): шаги независимы — повторение сделано раньше чтения не делает чтение выполненным", () => {
  const s = computeFirstSteps({ hasRead: false, savedWords: 0, hasReviewed: true, dueCount: 0 });
  assert.equal(s.doneCount, 1);
  assert.equal(s.steps[0].status, "current");
  assert.equal(s.steps[2].status, "done");
});

test("computeFirstSteps(): битые числа не дают NaN в подписях", () => {
  const s = computeFirstSteps({ hasRead: false, savedWords: Number.NaN, hasReviewed: false, dueCount: Number.NaN });
  assert.equal(s.steps[1].hint, "0 из 5");
  assert.equal(s.steps[2].href, null);
});

test("shouldShowFirstSteps(): виден только молодому аккаунту и пока шаги не закончены", () => {
  const open = computeFirstSteps({ hasRead: false, savedWords: 0, hasReviewed: false, dueCount: 0 });
  const finished = computeFirstSteps({ hasRead: true, savedWords: 5, hasReviewed: true, dueCount: 0 });
  assert.equal(shouldShowFirstSteps(open, 0), true);
  assert.equal(shouldShowFirstSteps(open, 6), true);
  assert.equal(shouldShowFirstSteps(open, 7), false, "через неделю чек-лист уходит");
  assert.equal(shouldShowFirstSteps(open, 400), false);
  assert.equal(shouldShowFirstSteps(finished, 1), false);
  assert.equal(shouldShowFirstSteps(open, -1), false, "дата создания в будущем — не показываем");
});
