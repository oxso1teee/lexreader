import test from "node:test";
import assert from "node:assert/strict";
import { deliverResultAndRestoreOrigin } from "./post-success-lifecycle.mjs";

function context(overrides = {}) {
  return {
    requestId: "req-1",
    videoId: "PolmvqSxnbc",
    originTabId: 10,
    originWindowId: 100,
    youtubeTabId: 20,
    youtubeWindowId: 200,
    createdByLexReader: true,
    ...overrides,
  };
}

function chromeMock({ acknowledgement, sendError, activationError, removeError } = {}) {
  const calls = [];
  return {
    calls,
    api: {
      tabs: {
        async sendMessage(tabId, message) {
          calls.push(["send", tabId, message.type, message.requestId]);
          if (sendError) throw sendError;
          return acknowledgement ?? { ok: true, requestId: message.requestId };
        },
        async update(tabId, changes) {
          calls.push(["activate", tabId, changes]);
          if (activationError) throw activationError;
        },
        async remove(tabId) {
          calls.push(["remove", tabId]);
          if (removeError) throw removeError;
        },
      },
      windows: {
        async update(windowId, changes) {
          calls.push(["focus", windowId, changes]);
        },
      },
    },
  };
}

test("successful transcript -> origin ACK -> activate/focus origin -> close owned temporary tab", async () => {
  const mock = chromeMock();
  const events = [];
  const result = await deliverResultAndRestoreOrigin(context(), { ok: true }, {
    chromeApi: mock.api,
    onEvent: (event) => events.push(event),
  });

  assert.equal(result.ok, true);
  assert.equal(result.acknowledged, true);
  assert.equal(result.activated, true);
  assert.equal(result.temporaryTabClosed, true);
  assert.deepEqual(mock.calls.map((call) => call[0]), ["send", "activate", "focus", "remove"]);
  assert.deepEqual(events, [
    "background_deliver_started",
    "origin_tab_message_sent",
    "origin_tab_message_acknowledged",
    "origin_tab_activate_started",
    "origin_tab_activated",
    "temporary_tab_close_started",
    "temporary_tab_closed",
  ]);
});

test("origin delivery failure preserves the successful payload tab and does not activate or close", async () => {
  const mock = chromeMock({ sendError: new Error("receiving end missing") });
  const result = await deliverResultAndRestoreOrigin(context(), { ok: true }, { chromeApi: mock.api });

  assert.equal(result.error, "origin_delivery_failed");
  assert.equal(result.acknowledged, false);
  assert.equal(result.temporaryTabClosed, false);
  assert.deepEqual(mock.calls.map((call) => call[0]), ["send"]);
});

test("invalid origin acknowledgement is a delivery failure and preserves the temporary tab", async () => {
  const mock = chromeMock({ acknowledgement: { ok: true, requestId: "stale-request" } });
  const result = await deliverResultAndRestoreOrigin(context(), { ok: true }, { chromeApi: mock.api });

  assert.equal(result.error, "origin_delivery_failed");
  assert.equal(result.internalReason, "invalid_origin_acknowledgement");
  assert.deepEqual(mock.calls.map((call) => call[0]), ["send"]);
});

test("a pre-existing YouTube tab is never closed after acknowledged delivery", async () => {
  const mock = chromeMock();
  const result = await deliverResultAndRestoreOrigin(
    context({ createdByLexReader: false }),
    { ok: true },
    { chromeApi: mock.api },
  );

  assert.equal(result.ok, true);
  assert.equal(result.closeSkipped, true);
  assert.equal(result.temporaryTabClosed, false);
  assert.deepEqual(mock.calls.map((call) => call[0]), ["send", "activate", "focus"]);
});

test("an extraction-created YouTube tab is closed exactly once", async () => {
  const mock = chromeMock();
  await deliverResultAndRestoreOrigin(context(), { ok: true }, { chromeApi: mock.api });
  assert.deepEqual(mock.calls.filter((call) => call[0] === "remove"), [["remove", 20]]);
});

test("origin activation failure is surfaced and prevents temporary-tab close", async () => {
  const mock = chromeMock({ activationError: new Error("tab no longer exists") });
  const events = [];
  const result = await deliverResultAndRestoreOrigin(context(), { ok: true }, {
    chromeApi: mock.api,
    onEvent: (event, _metadata, extra) => events.push([event, extra]),
  });

  assert.equal(result.error, "origin_activation_failed");
  assert.equal(result.acknowledged, true);
  assert.equal(result.activated, false);
  assert.equal(result.temporaryTabClosed, false);
  assert.deepEqual(mock.calls.map((call) => call[0]), ["send", "activate"]);
  assert.equal(events.at(-1)[0], "origin_tab_activation_failed");
});

test("two requests retain independent origin/youtube ownership", async () => {
  const firstMock = chromeMock();
  const secondMock = chromeMock();
  const first = context({ requestId: "req-A", originTabId: 11, youtubeTabId: 21 });
  const second = context({ requestId: "req-B", originTabId: 12, youtubeTabId: 22 });

  const [firstResult, secondResult] = await Promise.all([
    deliverResultAndRestoreOrigin(first, { ok: true }, { chromeApi: firstMock.api }),
    deliverResultAndRestoreOrigin(second, { ok: true }, { chromeApi: secondMock.api }),
  ]);

  assert.equal(firstResult.requestId, "req-A");
  assert.equal(secondResult.requestId, "req-B");
  assert.deepEqual(firstMock.calls.filter((call) => call[0] === "remove"), [["remove", 21]]);
  assert.deepEqual(secondMock.calls.filter((call) => call[0] === "remove"), [["remove", 22]]);
});
