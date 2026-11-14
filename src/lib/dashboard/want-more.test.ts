import { test } from "node:test";
import assert from "node:assert/strict";
import { buildWantMore, type WantMoreHero } from "./want-more.ts";

const hero = (actionType: string): WantMoreHero => ({
  eyebrow: "Пора повторить",
  title: "18 к повторению",
  ctaLabel: "Повторить сейчас",
  href: "/brain/all/review",
  actionType,
});
const reading = { textId: "t-1", title: "The Last Lighthouse", percentRead: 64 };

test("buildWantMore(): главное действие всегда первое", () => {
  const items = buildWantMore({ hero: hero("review"), continueReading: null, dueCount: 0 });
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, "primary");
});

test("buildWantMore(): чтение добавляется, если главное действие — не чтение", () => {
  const items = buildWantMore({ hero: hero("mission"), continueReading: reading, dueCount: 0 });
  assert.deepEqual(
    items.map((i) => i.kind),
    ["primary", "reading"],
  );
  const r = items[1];
  assert.ok(r.kind === "reading");
  assert.equal(r.href, "/read/t-1");
  assert.equal(r.percentRead, 64);
});

test("buildWantMore(): повтор добавляется, если есть карточки и главное действие — не повтор", () => {
  const items = buildWantMore({ hero: hero("mission"), continueReading: null, dueCount: 7 });
  assert.deepEqual(
    items.map((i) => i.kind),
    ["primary", "review"],
  );
});

test("buildWantMore(): дублей нет — главное действие чтение или повтор не повторяется второй строкой", () => {
  const readingHero = buildWantMore({ hero: hero("continue_reading"), continueReading: reading, dueCount: 3 });
  assert.deepEqual(
    readingHero.map((i) => i.kind),
    ["primary", "review"],
  );
  const reviewHero = buildWantMore({ hero: hero("review"), continueReading: reading, dueCount: 3 });
  assert.deepEqual(
    reviewHero.map((i) => i.kind),
    ["primary", "reading"],
  );
});

test("buildWantMore(): все три источника — в порядке «главное, чтение, повтор»", () => {
  const items = buildWantMore({ hero: hero("add_material"), continueReading: reading, dueCount: 2 });
  assert.deepEqual(
    items.map((i) => i.kind),
    ["primary", "reading", "review"],
  );
});
