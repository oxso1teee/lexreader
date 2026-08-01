import assert from "node:assert/strict";
import test from "node:test";
import { getFsrsFlags } from "./fsrs-flags.ts";

function withEnv(vars: Record<string, string | undefined>, run: () => void) {
  const originals: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) originals[key] = process.env[key];
  try {
    for (const [key, value] of Object.entries(vars)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    run();
  } finally {
    for (const [key, value] of Object.entries(originals)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

// FSRS Schema Compatibility Hotfix: getFsrsFlags() — единственное место, где
// комбинируются FSRS_SCHEMA_READY и FSRS_ENABLED. Сценарии ниже — ровно те,
// что перечислены в задании (1-4).

test("getFsrsFlags(): обе переменные отсутствуют -> schemaReady=false, enabled=false, shadowEnabled=false (legacy path)", () => {
  withEnv({ FSRS_SCHEMA_READY: undefined, FSRS_ENABLED: undefined }, () => {
    const flags = getFsrsFlags();
    assert.deepEqual(flags, { schemaReady: false, enabled: false, shadowEnabled: false });
  });
});

test("getFsrsFlags(): FSRS_ENABLED=true, но FSRS_SCHEMA_READY отсутствует -> enabled=false (опасная конфигурация игнорируется)", () => {
  withEnv({ FSRS_SCHEMA_READY: undefined, FSRS_ENABLED: "true" }, () => {
    const flags = getFsrsFlags();
    assert.equal(flags.schemaReady, false);
    assert.equal(flags.enabled, false, "FSRS_ENABLED=true без подтверждённой миграции не должен активировать FSRS");
    assert.equal(flags.shadowEnabled, false);
  });
});

test("getFsrsFlags(): FSRS_SCHEMA_READY=true, FSRS_ENABLED=false -> shadow mode (due_at остаётся legacy, FSRS-поля можно сохранять)", () => {
  withEnv({ FSRS_SCHEMA_READY: "true", FSRS_ENABLED: "false" }, () => {
    const flags = getFsrsFlags();
    assert.deepEqual(flags, { schemaReady: true, enabled: false, shadowEnabled: true });
  });
});

test("getFsrsFlags(): обе переменные true -> FSRS полностью авторитетен", () => {
  withEnv({ FSRS_SCHEMA_READY: "true", FSRS_ENABLED: "true" }, () => {
    const flags = getFsrsFlags();
    assert.deepEqual(flags, { schemaReady: true, enabled: true, shadowEnabled: true });
  });
});

test("getFsrsFlags(): небезопасная конфигурация логируется без приватных данных", () => {
  const originalWarn = console.warn;
  let loggedArgs: unknown[] | null = null;
  console.warn = (...args: unknown[]) => {
    loggedArgs = args;
  };
  try {
    withEnv({ FSRS_SCHEMA_READY: undefined, FSRS_ENABLED: "true" }, () => {
      getFsrsFlags();
    });
    assert.ok(loggedArgs, "небезопасная конфигурация (FSRS_ENABLED=true без schemaReady) должна логироваться");
    const loggedText = (loggedArgs as unknown[]).map(String).join(" ");
    assert.ok(!loggedText.includes("flashcard"));
    assert.ok(!loggedText.includes("srs_state"));
  } finally {
    console.warn = originalWarn;
  }
});

test("getFsrsFlags(): безопасная конфигурация (или обе false, или FSRS_ENABLED уже false) не логирует предупреждение", () => {
  const originalWarn = console.warn;
  let warnCalled = false;
  console.warn = () => {
    warnCalled = true;
  };
  try {
    withEnv({ FSRS_SCHEMA_READY: undefined, FSRS_ENABLED: undefined }, () => {
      getFsrsFlags();
    });
    assert.equal(warnCalled, false);
    withEnv({ FSRS_SCHEMA_READY: "true", FSRS_ENABLED: "true" }, () => {
      getFsrsFlags();
    });
    assert.equal(warnCalled, false);
  } finally {
    console.warn = originalWarn;
  }
});
