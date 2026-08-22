import { test } from "node:test";
import assert from "node:assert/strict";
import { isThemePreference, resolveTheme } from "./theme.ts";

test("resolveTheme: explicit light/dark ignore system", () => {
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("light", false), "light");
  assert.equal(resolveTheme("dark", true), "dark");
  assert.equal(resolveTheme("dark", false), "dark");
});

test("resolveTheme: system follows the OS media query", () => {
  assert.equal(resolveTheme("system", true), "dark");
  assert.equal(resolveTheme("system", false), "light");
});

test("isThemePreference: accepts only the three known values", () => {
  assert.equal(isThemePreference("light"), true);
  assert.equal(isThemePreference("dark"), true);
  assert.equal(isThemePreference("system"), true);
  assert.equal(isThemePreference(null), false);
  assert.equal(isThemePreference(""), false);
  // Защита от порчи localStorage — старое/чужое/битое значение не должно
  // пройти как валидная тема.
  assert.equal(isThemePreference("dark "), false);
  assert.equal(isThemePreference("SYSTEM"), false);
});
