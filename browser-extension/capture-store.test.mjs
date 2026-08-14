import test from "node:test";
import assert from "node:assert/strict";
import { createCaptureStore } from "./capture-store.mjs";

test("capture-store: exact language match wins", () => {
  const store = createCaptureStore();
  store.set({ lang: "en", kind: null, bodyText: "{}" });
  store.set({ lang: "ru", kind: null, bodyText: "{}" });
  assert.equal(store.find("ru").lang, "ru");
});

test("capture-store: base-language match (en-US matches en)", () => {
  const store = createCaptureStore();
  store.set({ lang: "en", kind: null, bodyText: "{}" });
  assert.equal(store.find("en-US").lang, "en");
});

test("capture-store: no match falls back to whatever was captured first, never invents data", () => {
  const store = createCaptureStore();
  store.set({ lang: "ru", kind: "asr", bodyText: "{}" });
  const found = store.find("fr");
  assert.equal(found.lang, "ru");
});

test("capture-store: empty timedtext body is rejected, never stored", () => {
  const store = createCaptureStore();
  const stored = store.set({ lang: "en", kind: null, bodyText: "" });
  assert.equal(stored, false);
  assert.equal(store.size, 0);
  assert.equal(store.find("en"), null);
});

test("capture-store: a later non-empty capture for the same key succeeds after an earlier miss", () => {
  const store = createCaptureStore();
  assert.equal(store.find("en"), null);
  store.set({ lang: "en", kind: null, bodyText: "{\"events\":[]}" });
  assert.equal(store.find("en").bodyText, "{\"events\":[]}");
});

test("capture-store: find on an empty store returns null, not a thrown error", () => {
  const store = createCaptureStore();
  assert.equal(store.find("en"), null);
});

test("capture-store: distinct lang+kind pairs are stored as separate entries", () => {
  const store = createCaptureStore();
  store.set({ lang: "en", kind: null, bodyText: "manual" });
  store.set({ lang: "en", kind: "asr", bodyText: "auto" });
  assert.equal(store.size, 2);
});
