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

test("capture-store (lifecycle bug #3): a capture for a different video is rejected, never stored", () => {
  const store = createCaptureStore("videoA");
  const stored = store.set({ videoId: "videoB", lang: "en", kind: null, bodyText: "wrong video" });
  assert.equal(stored, false);
  assert.equal(store.size, 0);
});

test("capture-store (lifecycle bug #3): a same-key capture from an unrelated video (e.g. YouTube's own autoplay prefetch) cannot overwrite or masquerade as the expected video's capture", () => {
  const store = createCaptureStore("videoA");
  store.set({ videoId: "videoA", lang: "en", kind: null, bodyText: "real transcript for videoA" });
  store.set({ videoId: "videoB", lang: "en", kind: null, bodyText: "unrelated prefetch for videoB" });
  assert.equal(store.find("en").bodyText, "real transcript for videoA");
  assert.equal(store.size, 1);
});

test("capture-store (lifecycle bug #3): with no matching-language capture for the expected video, the fallback never reaches into an unrelated video's data", () => {
  const store = createCaptureStore("videoA");
  store.set({ videoId: "videoB", lang: "ru", kind: "asr", bodyText: "unrelated prefetch for videoB" });
  assert.equal(store.find("en"), null);
  assert.equal(store.size, 0);
});

test("capture-store: without an expectedVideoId, behavior is unchanged (backwards compatible)", () => {
  const store = createCaptureStore();
  store.set({ videoId: "anything", lang: "en", kind: null, bodyText: "{}" });
  assert.equal(store.find("en").bodyText, "{}");
});
