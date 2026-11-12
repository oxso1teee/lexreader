import assert from "node:assert/strict";
import { test } from "node:test";
import { FALLBACK_ERROR_MESSAGE, getErrorMessage, isNetworkError, NETWORK_ERROR_MESSAGE } from "./errors.ts";

test("strings and { error } results are shown as they are (server actions return user-facing text)", () => {
  assert.equal(getErrorMessage("Слово уже есть в колоде"), "Слово уже есть в колоде");
  assert.equal(getErrorMessage({ ok: false, error: "  Колода не найдена " }), "Колода не найдена");
});

test("empty values fall back", () => {
  assert.equal(getErrorMessage(""), FALLBACK_ERROR_MESSAGE);
  assert.equal(getErrorMessage({ ok: false, error: "  " }), FALLBACK_ERROR_MESSAGE);
  assert.equal(getErrorMessage(undefined), FALLBACK_ERROR_MESSAGE);
  assert.equal(getErrorMessage(null, "Не вышло"), "Не вышло");
});

test("network failures are recognised across browsers and get a human message", () => {
  for (const m of ["Failed to fetch", "NetworkError when attempting to fetch resource.", "Load failed", "fetch failed"]) {
    assert.equal(isNetworkError(new TypeError(m)), true, m);
    assert.equal(getErrorMessage(new TypeError(m)), NETWORK_ERROR_MESSAGE);
  }
});

test("internals never leak: arbitrary Error text is replaced by the fallback", () => {
  const err = new Error('relation "profiles" does not exist (SQLSTATE 42P01)');
  assert.equal(getErrorMessage(err), FALLBACK_ERROR_MESSAGE);
  assert.equal(isNetworkError(err), false);
});
