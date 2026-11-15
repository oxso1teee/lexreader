import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { TranslationQuotaError, translateText } from "./translate.ts";
import {
  createStubTranslator,
  isTranslateStubEnabled,
  STUB_ERROR_TRIGGER,
  STUB_QUOTA_TRIGGER,
  TRANSLATE_STUB_FLAG,
} from "./translate-stub.ts";

describe("isTranslateStubEnabled", () => {
  it("is off unless the flag is exactly '1'", () => {
    assert.equal(isTranslateStubEnabled({}), false);
    assert.equal(isTranslateStubEnabled({ [TRANSLATE_STUB_FLAG]: "0" }), false);
    assert.equal(isTranslateStubEnabled({ [TRANSLATE_STUB_FLAG]: "true" }), false);
    assert.equal(isTranslateStubEnabled({ [TRANSLATE_STUB_FLAG]: "1" }), true);
  });

  it("is never on in Vercel production, even when the flag is set", () => {
    assert.equal(isTranslateStubEnabled({ [TRANSLATE_STUB_FLAG]: "1", VERCEL_ENV: "production" }), false);
    assert.equal(isTranslateStubEnabled({ [TRANSLATE_STUB_FLAG]: "1", VERCEL_ENV: "preview" }), true);
    assert.equal(isTranslateStubEnabled({ [TRANSLATE_STUB_FLAG]: "1", NODE_ENV: "production" }), true);
  });
});

describe("createStubTranslator", () => {
  it("numbers successful provider calls and echoes the text", () => {
    const stub = createStubTranslator();
    assert.deepEqual(stub.next("hello"), { kind: "ok", translation: "[stub#1] hello", call: 1 });
    assert.deepEqual(stub.next("world"), { kind: "ok", translation: "[stub#2] world", call: 2 });
    assert.equal(stub.calls, 2);
  });

  it("quota and error triggers do not count as provider calls", () => {
    const stub = createStubTranslator();
    assert.deepEqual(stub.next(`x ${STUB_QUOTA_TRIGGER} y`), { kind: "quota" });
    assert.deepEqual(stub.next(STUB_ERROR_TRIGGER), { kind: "error" });
    assert.equal(stub.calls, 0);
  });
});

describe("translateText with the stub flag", () => {
  const realFetch = globalThis.fetch;
  const savedFlag = process.env[TRANSLATE_STUB_FLAG];
  const savedVercel = process.env.VERCEL_ENV;

  afterEach(() => {
    globalThis.fetch = realFetch;
    if (savedFlag === undefined) delete process.env[TRANSLATE_STUB_FLAG];
    else process.env[TRANSLATE_STUB_FLAG] = savedFlag;
    if (savedVercel === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = savedVercel;
  });

  it("never touches the network when enabled", async () => {
    process.env[TRANSLATE_STUB_FLAG] = "1";
    delete process.env.VERCEL_ENV;
    globalThis.fetch = (() => {
      throw new Error("network must not be used in stub mode");
    }) as typeof fetch;

    const first = await translateText("td1-unit-word", "en", "ru");
    assert.match(first, /^\[stub#\d+\] td1-unit-word$/);
    const second = await translateText("td1-unit-word-2", "en", "ru");
    const n = (s: string) => Number(/#(\d+)\]/.exec(s)![1]);
    assert.equal(n(second), n(first) + 1);
  });

  it("maps the quota and error triggers to the provider's real error types", async () => {
    process.env[TRANSLATE_STUB_FLAG] = "1";
    delete process.env.VERCEL_ENV;
    await assert.rejects(translateText(STUB_QUOTA_TRIGGER, "en", "ru"), TranslationQuotaError);
    await assert.rejects(translateText(STUB_ERROR_TRIGGER, "en", "ru"), /stub translation failure/);
  });

  it("ignores the flag in production and goes to the real provider", async () => {
    process.env[TRANSLATE_STUB_FLAG] = "1";
    process.env.VERCEL_ENV = "production";
    let realProviderCalled = false;
    globalThis.fetch = (() => {
      realProviderCalled = true;
      throw new Error("real provider reached");
    }) as typeof fetch;

    await assert.rejects(translateText("hello", "en", "ru"), /real provider reached/);
    assert.equal(realProviderCalled, true);
  });
});
