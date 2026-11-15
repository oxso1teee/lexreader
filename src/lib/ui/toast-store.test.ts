import assert from "node:assert/strict";
import { test } from "node:test";
import { createToastStore, DEFAULT_TOAST_DURATION, MAX_VISIBLE_TOASTS } from "./toast-store.ts";

function store() {
  let n = 0;
  return createToastStore({ genId: () => `t${++n}` });
}

test("add: assigns id, tone default info, duration by tone", () => {
  const s = store();
  const id = s.add({ title: "Привет" });
  assert.equal(id, "t1");
  const [t] = s.getSnapshot();
  assert.equal(t.tone, "info");
  assert.equal(t.duration, DEFAULT_TOAST_DURATION.info);
  assert.equal(t.dismissible, true);
});

test("error and warning live longer than success; loading is sticky", () => {
  assert.ok(DEFAULT_TOAST_DURATION.error > DEFAULT_TOAST_DURATION.success);
  assert.ok(DEFAULT_TOAST_DURATION.warning > DEFAULT_TOAST_DURATION.success);
  assert.equal(DEFAULT_TOAST_DURATION.loading, Number.POSITIVE_INFINITY);
});

test("add with an existing id updates in place and bumps revision (timer restarts)", () => {
  const s = store();
  s.add({ id: "x", tone: "info", title: "A" });
  s.add({ id: "x", tone: "error", title: "B" });
  const items = s.getSnapshot();
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "B");
  assert.equal(items[0].tone, "error");
  assert.equal(items[0].revision, 1);
});

test("update: loading → success picks the success duration, keeps id and position", () => {
  const s = store();
  const id = s.add({ tone: "loading", title: "Сохраняем…" });
  s.add({ tone: "info", title: "Другое" });
  s.update(id, { tone: "success", title: "Сохранено" });
  const [first] = s.getSnapshot();
  assert.equal(first.id, id);
  assert.equal(first.tone, "success");
  assert.equal(first.duration, DEFAULT_TOAST_DURATION.success);
  assert.equal(first.title, "Сохранено");
});

test("update of an unknown id is a no-op and does not notify", () => {
  const s = store();
  let calls = 0;
  s.subscribe(() => calls++);
  s.update("nope", { title: "x" });
  assert.equal(calls, 0);
});

test("dismiss one / all; snapshot identity changes only on real changes", () => {
  const s = store();
  const a = s.add({ title: "a" });
  s.add({ title: "b" });
  const before = s.getSnapshot();
  s.dismiss("missing");
  assert.equal(s.getSnapshot(), before);
  s.dismiss(a);
  assert.deepEqual(s.getSnapshot().map((t) => t.title), ["b"]);
  s.dismiss();
  assert.equal(s.getSnapshot().length, 0);
});

test("max visible: oldest auto-closing toast is evicted, sticky ones survive", () => {
  const s = store();
  s.add({ id: "offline", tone: "warning", title: "Нет сети", duration: Number.POSITIVE_INFINITY });
  for (let i = 0; i < MAX_VISIBLE_TOASTS + 2; i++) s.add({ title: `n${i}` });
  const items = s.getSnapshot();
  assert.equal(items.length, MAX_VISIBLE_TOASTS);
  assert.ok(items.some((t) => t.id === "offline"));
  assert.equal(items.at(-1)?.title, `n${MAX_VISIBLE_TOASTS + 1}`);
});

test("subscribe/unsubscribe", () => {
  const s = store();
  let calls = 0;
  const off = s.subscribe(() => calls++);
  s.add({ title: "a" });
  off();
  s.add({ title: "b" });
  assert.equal(calls, 1);
});
