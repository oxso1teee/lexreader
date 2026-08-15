import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";

const dir = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(dir, "youtube-page-capture.js"), "utf8");

test("DOM-only mode does not install fetch or XHR timedtext acquisition hooks", () => {
  const originalFetch = async () => ({ ok: true });
  function FakeXhr() {}
  const originalOpen = function open() {};
  const originalSend = function send() {};
  FakeXhr.prototype.open = originalOpen;
  FakeXhr.prototype.send = originalSend;

  const context = {
    console: { debug() {} },
    location: { hash: "#lexreader-extraction-dom-only", href: "https://www.youtube.com/watch?v=PolmvqSxnbc" },
    window: null,
    document: {
      dispatchEvent() {},
      querySelector() { return null; },
    },
    XMLHttpRequest: FakeXhr,
    CustomEvent: class CustomEvent {
      constructor(type, options) {
        this.type = type;
        this.detail = options?.detail;
      }
    },
    URL,
    setInterval() { return 1; },
    clearInterval() {},
    setTimeout() { return 1; },
  };
  context.window = context;
  context.window.fetch = originalFetch;

  vm.runInNewContext(source, context, { filename: "youtube-page-capture.js" });

  assert.equal(context.window.fetch, originalFetch, "fetch must remain untouched in DOM-only mode");
  assert.equal(FakeXhr.prototype.open, originalOpen, "XHR.open must remain untouched in DOM-only mode");
  assert.equal(FakeXhr.prototype.send, originalSend, "XHR.send must remain untouched in DOM-only mode");
});

test("temporary extraction tabs disable autoplay and continuously pause the video", () => {
  function FakeXhr() {}
  FakeXhr.prototype.open = function open() {};
  FakeXhr.prototype.send = function send() {};
  const videoListeners = new Map();
  let pauseCalls = 0;
  let autoplayToggleClicks = 0;
  let guardTick;
  const video = {
    paused: false,
    autoplay: true,
    pause() {
      pauseCalls += 1;
      this.paused = true;
    },
    addEventListener(type, listener) {
      videoListeners.set(type, listener);
    },
  };

  const context = {
    console: { debug() {} },
    location: { hash: "#lexreader-extraction-dom-only", href: "https://www.youtube.com/watch?v=jNQXAC9IVRw" },
    window: null,
    document: {
      dispatchEvent() {},
      querySelector(selector) {
        if (selector === "video") return video;
        if (selector.includes("autonav") || selector.includes("Autoplay is on")) {
          return { click() { autoplayToggleClicks += 1; } };
        }
        return null;
      },
    },
    XMLHttpRequest: FakeXhr,
    CustomEvent: class CustomEvent {},
    URL,
    setInterval(callback) {
      guardTick ??= callback;
      return 1;
    },
    clearInterval() {},
    setTimeout() { return 1; },
  };
  context.window = context;
  context.window.fetch = async () => ({ ok: true });

  vm.runInNewContext(source, context, { filename: "youtube-page-capture.js" });

  assert.equal(video.autoplay, false);
  assert.ok(pauseCalls >= 1);
  assert.equal(autoplayToggleClicks, 1);
  video.paused = false;
  videoListeners.get("play")();
  assert.equal(video.paused, true);
  video.paused = false;
  guardTick();
  assert.equal(video.paused, true);
  assert.equal(autoplayToggleClicks, 1, "autoplay toggle must not be clicked repeatedly and flipped back on");
});
