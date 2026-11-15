import assert from "node:assert/strict";
import test from "node:test";
import { attemptsLeftAfterFailure, authAttemptKey, authRateLimitConfig } from "./auth-rate-limit-config.ts";

const env = process.env as Record<string, string | undefined>;

function withEnv(overrides: Record<string, string | undefined>, run: () => void) {
  const keys = ["AUTH_RATE_LIMIT_MAX_ATTEMPTS", "AUTH_RATE_LIMIT_WINDOW_MS"];
  const saved: Record<string, string | undefined> = {};
  for (const key of keys) saved[key] = env[key];
  for (const key of keys) {
    const value = overrides[key];
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
  try {
    run();
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete env[key];
      else env[key] = saved[key];
    }
  }
}

test("authAttemptKey(): same identifier gets a different key per action (bucket separation)", () => {
  const email = "test@example.com";
  const loginKey = authAttemptKey("login", email);
  const signupKey = authAttemptKey("signup", email);
  const resetKey = authAttemptKey("reset-password", email);

  assert.notEqual(loginKey, signupKey);
  assert.notEqual(loginKey, resetKey);
  assert.notEqual(signupKey, resetKey);
});

test("authAttemptKey(): normalizes case/whitespace so 'A@B.com' and ' a@b.com ' collide within the same action", () => {
  assert.equal(authAttemptKey("login", "A@B.com"), authAttemptKey("login", " a@b.com "));
});

test("authAttemptKey(): empty/whitespace-only identifier is rejected (never becomes a bare 'login:' key)", () => {
  assert.equal(authAttemptKey("login", ""), null);
  assert.equal(authAttemptKey("login", "   "), null);
});

test("authRateLimitConfig(): Production-safe defaults when no override env is set", () => {
  withEnv({ AUTH_RATE_LIMIT_MAX_ATTEMPTS: undefined, AUTH_RATE_LIMIT_WINDOW_MS: undefined }, () => {
    const config = authRateLimitConfig();
    assert.equal(config.maxAttempts, 5);
    assert.equal(config.windowMs, 15 * 60_000);
  });
});

test("authRateLimitConfig(): Preview QA override only takes effect when explicitly set, and Production is never forced to read it", () => {
  withEnv({ AUTH_RATE_LIMIT_MAX_ATTEMPTS: "2", AUTH_RATE_LIMIT_WINDOW_MS: "5000" }, () => {
    const config = authRateLimitConfig();
    assert.equal(config.maxAttempts, 2);
    assert.equal(config.windowMs, 5000);
  });

  // Same call, override removed — falls straight back to the exact same
  // defaults Production has always used, byte for byte.
  withEnv({ AUTH_RATE_LIMIT_MAX_ATTEMPTS: undefined, AUTH_RATE_LIMIT_WINDOW_MS: undefined }, () => {
    const config = authRateLimitConfig();
    assert.equal(config.maxAttempts, 5);
    assert.equal(config.windowMs, 15 * 60_000);
  });
});

test("authRateLimitConfig(): invalid/non-positive overrides fall back to defaults instead of disabling the limiter", () => {
  withEnv({ AUTH_RATE_LIMIT_MAX_ATTEMPTS: "0", AUTH_RATE_LIMIT_WINDOW_MS: "not-a-number" }, () => {
    const config = authRateLimitConfig();
    assert.equal(config.maxAttempts, 5);
    assert.equal(config.windowMs, 15 * 60_000);
  });

  withEnv({ AUTH_RATE_LIMIT_MAX_ATTEMPTS: "-3" }, () => {
    assert.equal(authRateLimitConfig().maxAttempts, 5);
  });
});

test("authAttemptKey(): вход по ссылке получает свой бакет и не съедает попытки входа/сброса", () => {
  const email = "test@example.com";
  const magicKey = authAttemptKey("magic-link", email);
  assert.equal(magicKey, "magic-link:test@example.com");
  assert.notEqual(magicKey, authAttemptKey("login", email));
  assert.notEqual(magicKey, authAttemptKey("reset-password", email));
});

test("attemptsLeftAfterFailure(): после k-й неудачи осталось limit − k; 0 — следующая попытка заблокирована", () => {
  // Лимит 5: в окне уже 0 неудач → эта первая → осталось 4 (как в макете Login).
  assert.equal(attemptsLeftAfterFailure(5, 0), 4);
  assert.equal(attemptsLeftAfterFailure(5, 1), 3);
  assert.equal(attemptsLeftAfterFailure(5, 3), 1);
  assert.equal(attemptsLeftAfterFailure(5, 4), 0);
});

test("attemptsLeftAfterFailure(): никогда не уходит в минус (счётчик уже за лимитом)", () => {
  assert.equal(attemptsLeftAfterFailure(5, 5), 0);
  assert.equal(attemptsLeftAfterFailure(5, 99), 0);
});

test("attemptsLeftAfterFailure(): согласован с условием блокировки isAuthAttemptAllowed (count >= limit)", () => {
  const limit = authRateLimitConfig().maxAttempts;
  for (let failuresBefore = 0; failuresBefore < limit; failuresBefore++) {
    const left = attemptsLeftAfterFailure(limit, failuresBefore);
    // Блокировка включается ровно тогда, когда после неудачи count (= before+1) достиг limit.
    assert.equal(left === 0, failuresBefore + 1 >= limit, `failuresBefore=${failuresBefore}`);
  }
});
