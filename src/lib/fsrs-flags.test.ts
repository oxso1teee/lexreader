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

// FSRS Controlled Activation (Phase D prep): account-level allowlist через
// FSRS_ENABLED_USER_IDS — сценарии из задания "FSRS CONTROLLED ACTIVATION —
// PHASE D PREPARATION", пункты 1-7 и 10 (8-9 — scheduler_type/due_at —
// гарантируются ПОСТРОЕНИЕМ в actions.ts из уже протестированного здесь
// flags.enabled: `scheduler_type: fsrsAuthoritative ? "fsrs" : "sm2"`,
// `dueAt: fsrsAuthoritative ? fsrsResult.dueAt : legacyDueAt`, где
// `fsrsAuthoritative = flags.enabled && fsrsResult !== null` — actions.ts
// не тестируется напрямую в этом наборе тем же способом, что и раньше
// (требует Supabase/Next server mocking, которого в проекте нет).
const TEST_USER_ID = "eee0e646-56c4-470b-b60f-aea90212ca86";
const OTHER_USER_ID = "11111111-1111-1111-1111-111111111111";

test("getFsrsFlags(userId): FSRS_SCHEMA_READY отсутствует -> legacy, даже если userId в allowlist'е (пункт 1)", () => {
  withEnv(
    { FSRS_SCHEMA_READY: undefined, FSRS_ENABLED: undefined, FSRS_ENABLED_USER_IDS: TEST_USER_ID },
    () => {
      const flags = getFsrsFlags(TEST_USER_ID);
      assert.deepEqual(flags, { schemaReady: false, enabled: false, shadowEnabled: false });
    },
  );
});

test("getFsrsFlags(userId): schema ready, allowlist пуст -> legacy authoritative + shadow (пункт 2)", () => {
  withEnv(
    { FSRS_SCHEMA_READY: "true", FSRS_ENABLED: "false", FSRS_ENABLED_USER_IDS: undefined },
    () => {
      const flags = getFsrsFlags(TEST_USER_ID);
      assert.deepEqual(flags, { schemaReady: true, enabled: false, shadowEnabled: true });
    },
  );
});

test("getFsrsFlags(userId): schema ready, userId в allowlist'е -> FSRS authoritative для ЭТОГО пользователя (пункт 3)", () => {
  withEnv(
    { FSRS_SCHEMA_READY: "true", FSRS_ENABLED: "false", FSRS_ENABLED_USER_IDS: TEST_USER_ID },
    () => {
      const flags = getFsrsFlags(TEST_USER_ID);
      assert.deepEqual(flags, { schemaReady: true, enabled: true, shadowEnabled: true });
    },
  );
});

test("getFsrsFlags(userId): schema ready, allowlist непустой, но ДРУГОЙ пользователь -> остаётся legacy + shadow", () => {
  withEnv(
    { FSRS_SCHEMA_READY: "true", FSRS_ENABLED: "false", FSRS_ENABLED_USER_IDS: TEST_USER_ID },
    () => {
      const flags = getFsrsFlags(OTHER_USER_ID);
      assert.deepEqual(flags, { schemaReady: true, enabled: false, shadowEnabled: true });
    },
  );
});

test("getFsrsFlags(): глобальный FSRS_ENABLED=true -> FSRS authoritative для ВСЕХ, allowlist не нужен (пункт 4)", () => {
  withEnv(
    { FSRS_SCHEMA_READY: "true", FSRS_ENABLED: "true", FSRS_ENABLED_USER_IDS: undefined },
    () => {
      assert.equal(getFsrsFlags(OTHER_USER_ID).enabled, true);
      assert.equal(getFsrsFlags(undefined).enabled, true);
    },
  );
});

test("getFsrsFlags(userId): 'мусорный' allowlist (только запятые/пробелы) не включает никого (пункт 5)", () => {
  withEnv(
    { FSRS_SCHEMA_READY: "true", FSRS_ENABLED: "false", FSRS_ENABLED_USER_IDS: " , , ,," },
    () => {
      assert.equal(getFsrsFlags(TEST_USER_ID).enabled, false);
    },
  );
});

test("getFsrsFlags(userId): пробелы и дубликаты в allowlist'е обрабатываются безопасно (пункт 6)", () => {
  withEnv(
    {
      FSRS_SCHEMA_READY: "true",
      FSRS_ENABLED: "false",
      FSRS_ENABLED_USER_IDS: `  ${TEST_USER_ID} , ${TEST_USER_ID}  ,${OTHER_USER_ID}`,
    },
    () => {
      assert.equal(getFsrsFlags(TEST_USER_ID).enabled, true);
      assert.equal(getFsrsFlags(OTHER_USER_ID).enabled, true);
    },
  );
});

test("getFsrsFlags(): возвращаемая форма не содержит allowlist/userId — клиент получает только boolean'ы (пункт 7)", () => {
  withEnv(
    { FSRS_SCHEMA_READY: "true", FSRS_ENABLED: "false", FSRS_ENABLED_USER_IDS: TEST_USER_ID },
    () => {
      const flags = getFsrsFlags(TEST_USER_ID);
      assert.deepEqual(Object.keys(flags).sort(), ["enabled", "schemaReady", "shadowEnabled"]);
    },
  );
});

test("getFsrsFlags(userId): rollback — удаление из allowlist'а немедленно возвращает legacy, схема/shadow не страдают (пункт 10)", () => {
  withEnv(
    { FSRS_SCHEMA_READY: "true", FSRS_ENABLED: "false", FSRS_ENABLED_USER_IDS: TEST_USER_ID },
    () => {
      assert.equal(getFsrsFlags(TEST_USER_ID).enabled, true, "до отката — allowlisted");
    },
  );
  withEnv(
    { FSRS_SCHEMA_READY: "true", FSRS_ENABLED: "false", FSRS_ENABLED_USER_IDS: undefined },
    () => {
      const flags = getFsrsFlags(TEST_USER_ID);
      assert.equal(flags.enabled, false, "после отката — снова legacy authoritative");
      assert.equal(flags.schemaReady, true, "откат не трогает schemaReady");
      assert.equal(flags.shadowEnabled, true, "откат не трогает shadow — история FSRS не теряется");
    },
  );
});
