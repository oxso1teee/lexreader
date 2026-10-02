import assert from "node:assert/strict";
import test from "node:test";
import { getSupabaseRealtimeCspOrigin } from "./supabase-csp.ts";

test("production https Supabase URL maps to the same host over wss", () => {
  assert.equal(getSupabaseRealtimeCspOrigin("https://abcd1234.supabase.co"), "wss://abcd1234.supabase.co");
});

test("local http Supabase URL maps to ws, mirroring supabase-js's own scheme swap", () => {
  assert.equal(getSupabaseRealtimeCspOrigin("http://127.0.0.1:54321"), "ws://127.0.0.1:54321");
});

test("trailing slash and whitespace are normalized", () => {
  assert.equal(getSupabaseRealtimeCspOrigin(" https://abcd1234.supabase.co/ "), "wss://abcd1234.supabase.co");
});

test("missing or non-http URL yields no source at all (never a bare ws:/wss: scheme)", () => {
  assert.equal(getSupabaseRealtimeCspOrigin(undefined), "");
  assert.equal(getSupabaseRealtimeCspOrigin(""), "");
  assert.equal(getSupabaseRealtimeCspOrigin("abcd1234.supabase.co"), "");
});
