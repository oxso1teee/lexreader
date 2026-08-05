import assert from "node:assert/strict";
import test from "node:test";
import { getPostHogInitConfig } from "./posthog-client.ts";

test("search query param is masked so pageview autocapture can't leak it", () => {
  const config = getPostHogInitConfig("https://eu.i.posthog.com");
  assert.equal(config.mask_personal_data_properties, true);
  assert.ok(config.custom_personal_data_properties.includes("q"));
});

test("pageview autocapture stays on (needed for library_viewed context) but without raw click autocapture", () => {
  const config = getPostHogInitConfig(undefined);
  assert.equal(config.capture_pageview, true);
  assert.equal(config.autocapture, false);
});

test("falls back to the US host when none is configured", () => {
  const config = getPostHogInitConfig(undefined);
  assert.equal(config.api_host, "https://us.i.posthog.com");
});
