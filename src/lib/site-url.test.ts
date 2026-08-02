import assert from "node:assert/strict";
import test from "node:test";
import { siteUrl } from "./site-url.ts";

const ENV_KEYS = ["NEXT_PUBLIC_SITE_URL", "VERCEL_URL", "NODE_ENV"] as const;

// NODE_ENV is typed read-only (Next.js narrows it to a fixed union) — tests
// still need to flip it to exercise each branch, so go through a mutable view.
const env = process.env as Record<string, string | undefined>;

function withEnv(overrides: Partial<Record<(typeof ENV_KEYS)[number], string>>, run: () => void) {
  const saved: Record<string, string | undefined> = {};
  for (const key of ENV_KEYS) saved[key] = env[key];
  for (const key of ENV_KEYS) {
    const value = overrides[key];
    if (value === undefined) delete env[key];
    else env[key] = value;
  }

  try {
    run();
  } finally {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete env[key];
      else env[key] = saved[key];
    }
  }
}

test("explicit NEXT_PUBLIC_SITE_URL wins in production, even when VERCEL_URL is also set", () => {
  withEnv(
    { NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://lexreader.app", VERCEL_URL: "lexreader-abc123.vercel.app" },
    () => assert.equal(siteUrl(), "https://lexreader.app"),
  );
});

test("explicit NEXT_PUBLIC_SITE_URL has its trailing slash trimmed (no double slash downstream)", () => {
  withEnv({ NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://lexreader.app/" }, () =>
    assert.equal(siteUrl(), "https://lexreader.app"),
  );
});

test("Preview: falls back to https://VERCEL_URL when NEXT_PUBLIC_SITE_URL is absent", () => {
  withEnv(
    { NODE_ENV: "production", VERCEL_URL: "lexreader-git-feature-unified-ui-shell-today-meeeee4.vercel.app" },
    () => assert.equal(siteUrl(), "https://lexreader-git-feature-unified-ui-shell-today-meeeee4.vercel.app"),
  );
});

test("production with neither NEXT_PUBLIC_SITE_URL nor VERCEL_URL still fails loudly (does not silently return localhost)", () => {
  withEnv({ NODE_ENV: "production" }, () => assert.throws(() => siteUrl(), /NEXT_PUBLIC_SITE_URL/));
});

test("development: localhost fallback is only used when both env vars are absent", () => {
  withEnv({ NODE_ENV: "development" }, () => assert.equal(siteUrl(), "http://localhost:3000"));
});

test("development: VERCEL_URL still takes priority over the localhost default if somehow present", () => {
  withEnv({ NODE_ENV: "development", VERCEL_URL: "lexreader-preview.vercel.app" }, () =>
    assert.equal(siteUrl(), "https://lexreader-preview.vercel.app"),
  );
});
