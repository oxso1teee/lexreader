import assert from "node:assert/strict";
import test from "node:test";
import nextConfig from "./next.config.ts";

async function getCsp(): Promise<string> {
  const headerGroups = await nextConfig.headers!();
  const cspHeader = headerGroups[0]?.headers.find((h) => h.key === "Content-Security-Policy");
  assert.ok(cspHeader, "Content-Security-Policy header must be present");
  return cspHeader.value;
}

function directive(csp: string, name: string): string {
  const found = csp.split("; ").find((d) => d.startsWith(name + " "));
  assert.ok(found, `missing directive: ${name}`);
  return found;
}

// В тестовом окружении NEXT_PUBLIC_POSTHOG_HOST не задан — CSP должна
// подставить тот же дефолтный хост, что и posthog-client.ts/posthog-server.ts
// (см. src/lib/posthog-csp.test.ts за покрытием других хостов/регионов).
test("script-src allows the PostHog assets domain", async () => {
  const scriptSrc = directive(await getCsp(), "script-src");
  assert.ok(scriptSrc.includes("https://us-assets.i.posthog.com"), scriptSrc);
});

test("connect-src allows the PostHog api domain", async () => {
  const connectSrc = directive(await getCsp(), "connect-src");
  assert.ok(connectSrc.includes("https://us.i.posthog.com"), connectSrc);
});

test("script-src has no wildcard source", async () => {
  const scriptSrc = directive(await getCsp(), "script-src");
  assert.doesNotMatch(scriptSrc, /(^|\s)\*(\s|$)/);
  assert.doesNotMatch(scriptSrc, /(^|\s)https:(\s|$)/);
});

test("connect-src has no wildcard source", async () => {
  const connectSrc = directive(await getCsp(), "connect-src");
  assert.doesNotMatch(connectSrc, /(^|\s)\*(\s|$)/);
  assert.doesNotMatch(connectSrc, /(^|\s)https:(\s|$)/);
});

test("other production security headers are preserved", async () => {
  const headerGroups = await nextConfig.headers!();
  const keys = headerGroups[0]?.headers.map((h) => h.key) ?? [];
  for (const required of [
    "X-Frame-Options",
    "X-Content-Type-Options",
    "Referrer-Policy",
    "Permissions-Policy",
    "Strict-Transport-Security",
    "Content-Security-Policy",
  ]) {
    assert.ok(keys.includes(required), `missing header: ${required}`);
  }
});

test("pre-existing CSP directives unrelated to PostHog are untouched", async () => {
  const csp = await getCsp();
  assert.ok(directive(csp, "default-src").includes("'self'"));
  assert.ok(directive(csp, "worker-src").includes("https://cdn.jsdelivr.net"));
  assert.ok(directive(csp, "frame-src").includes("https://www.youtube.com"));
  // preserves the pre-existing OCR/YouTube script sources alongside the new PostHog one
  const scriptSrc = directive(csp, "script-src");
  assert.ok(scriptSrc.includes("https://cdn.jsdelivr.net"));
  assert.ok(scriptSrc.includes("https://www.youtube.com"));
});
