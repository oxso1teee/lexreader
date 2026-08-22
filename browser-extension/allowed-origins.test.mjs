import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// RC bridge-handshake bug (M3 Slice 12 RC): background.mjs's ALLOWED_APP_ORIGINS and
// lexreader-bridge.js's ALLOWED_ORIGINS were fixed for a new Preview origin in one file
// but not the other -- the content script self-gates on `window.location.origin` before
// ever sending a PING, so the page silently never sees "Bridge подключён" and the import
// button never enables. Root cause: two independently-maintained duplicates of the same
// allowlist (content scripts can't `import` a shared module in MV3, only the background
// service worker can). This test parses both real source files and fails the moment they
// drift, instead of only failing at runtime in a real browser.

const dir = path.dirname(fileURLToPath(import.meta.url));

globalThis.chrome = {
  runtime: { onMessage: { addListener: () => {} } },
};
const { ALLOWED_APP_ORIGINS } = await import("./background.mjs");

function extractBridgeOrigins() {
  const source = readFileSync(path.join(dir, "lexreader-bridge.js"), "utf8");
  const match = source.match(/const ALLOWED_ORIGINS = new Set\(\[([\s\S]*?)\]\);/);
  assert.ok(match, "lexreader-bridge.js must define `const ALLOWED_ORIGINS = new Set([...])`");
  const origins = [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(origins.length > 0, "parsed zero origins out of lexreader-bridge.js -- regex is stale");
  return new Set(origins);
}

function extractManifestBridgeMatches() {
  const manifest = JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf8"));
  const bridgeEntry = manifest.content_scripts.find((c) => c.js.includes("lexreader-bridge.js"));
  assert.ok(bridgeEntry, "manifest.json must declare a content_scripts entry running lexreader-bridge.js");
  return new Set(bridgeEntry.matches.map((m) => m.replace(/\/\*$/, "")));
}

test("lexreader-bridge.js's ALLOWED_ORIGINS matches background.mjs's ALLOWED_APP_ORIGINS exactly", () => {
  const bridgeOrigins = extractBridgeOrigins();
  assert.deepEqual(
    [...bridgeOrigins].sort(),
    [...ALLOWED_APP_ORIGINS].sort(),
    "lexreader-bridge.js and background.mjs must trust the exact same origin set",
  );
});

test("manifest.json's content_scripts match patterns cover every allowed origin", () => {
  const manifestOrigins = extractManifestBridgeMatches();
  for (const origin of ALLOWED_APP_ORIGINS) {
    assert.ok(
      manifestOrigins.has(origin),
      `manifest.json content_scripts is missing a match pattern for ${origin} -- the bridge script would never even get injected there`,
    );
  }
});

test("every allowed origin is a well-formed http/https origin (no path, no trailing slash)", () => {
  for (const origin of ALLOWED_APP_ORIGINS) {
    const url = new URL(origin);
    assert.equal(url.origin, origin, `${origin} is not a bare origin`);
    assert.ok(url.protocol === "http:" || url.protocol === "https:", `${origin} has an unexpected protocol`);
  }
});
