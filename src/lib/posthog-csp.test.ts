import assert from "node:assert/strict";
import test from "node:test";
import { getPostHogCspHosts } from "./posthog-csp.ts";

test("undefined host falls back to the same default as posthog-client.ts/posthog-server.ts", () => {
  const { apiHost, assetsHost } = getPostHogCspHosts(undefined);
  assert.equal(apiHost, "https://us.i.posthog.com");
  assert.equal(assetsHost, "https://us-assets.i.posthog.com");
});

test("empty string host falls back to the default host", () => {
  const { apiHost } = getPostHogCspHosts("");
  assert.equal(apiHost, "https://us.i.posthog.com");
});

test("eu cloud host maps to the eu assets subdomain", () => {
  const { apiHost, assetsHost } = getPostHogCspHosts("https://eu.i.posthog.com");
  assert.equal(apiHost, "https://eu.i.posthog.com");
  assert.equal(assetsHost, "https://eu-assets.i.posthog.com");
});

test("us cloud host maps to the us assets subdomain", () => {
  const { apiHost, assetsHost } = getPostHogCspHosts("https://us.i.posthog.com");
  assert.equal(apiHost, "https://us.i.posthog.com");
  assert.equal(assetsHost, "https://us-assets.i.posthog.com");
});

test("trailing slash on the configured host is trimmed", () => {
  const { apiHost } = getPostHogCspHosts("https://eu.i.posthog.com/");
  assert.equal(apiHost, "https://eu.i.posthog.com");
});

test("self-hosted/custom host serves assets from the same origin (matches SDK's own region=custom branch)", () => {
  const { apiHost, assetsHost } = getPostHogCspHosts("https://posthog.example.com");
  assert.equal(apiHost, "https://posthog.example.com");
  assert.equal(assetsHost, "https://posthog.example.com");
});

test("outputs are bare https origins — never widen to wildcards or CSP keywords", () => {
  for (const host of [undefined, "https://eu.i.posthog.com", "https://posthog.example.com"]) {
    const { apiHost, assetsHost } = getPostHogCspHosts(host);
    for (const value of [apiHost, assetsHost]) {
      assert.match(value, /^https:\/\/[a-z0-9.-]+$/);
      assert.doesNotMatch(value, /\*|unsafe-eval|unsafe-inline/);
    }
  }
});
