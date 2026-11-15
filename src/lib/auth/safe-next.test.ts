import assert from "node:assert/strict";
import test from "node:test";
import { safeNextPath } from "./safe-next.ts";

test("safeNextPath(): обычные внутренние пути проходят, query сохраняется, хеш отбрасывается", () => {
  assert.equal(safeNextPath("/home"), "/home");
  assert.equal(safeNextPath("/read/abc-123"), "/read/abc-123");
  assert.equal(safeNextPath("/brain/deck-1/review?mode=type"), "/brain/deck-1/review?mode=type");
  assert.equal(safeNextPath("/library#top"), "/library");
  assert.equal(safeNextPath("  /home  "), "/home");
});

test("safeNextPath(): не строка / пусто / без ведущего слэша → null", () => {
  for (const bad of [undefined, null, 42, {}, "", "   ", "home", "read/1"]) {
    assert.equal(safeNextPath(bad), null, String(bad));
  }
});

test("safeNextPath(): open redirect — абсолютные, protocol-relative, обратный слэш, схемы → null", () => {
  for (const bad of [
    "https://evil.com",
    "//evil.com",
    "//evil.com/home",
    "/\\evil.com",
    "\\\\evil.com",
    "javascript:alert(1)",
    "/\t/evil.com",
    "/home\nSet-Cookie: x=1",
    "/home\0",
  ]) {
    assert.equal(safeNextPath(bad), null, JSON.stringify(bad));
  }
});

test("safeNextPath(): страницы аутентификации и API исключены (иначе петля после входа)", () => {
  for (const blocked of [
    "/login",
    "/login?mode=signup",
    "/auth/callback",
    "/auth/callback?code=1",
    "/api/export",
    "/reset-password",
    "/reset-password/confirm",
    "/onboarding",
    "/onboarding/placement",
  ]) {
    assert.equal(safeNextPath(blocked), null, blocked);
  }
});

test("safeNextPath(): нормализация не обходит блок-лист (../ и %2e%2e)", () => {
  assert.equal(safeNextPath("/a/../login"), null);
  assert.equal(safeNextPath("/a/%2e%2e/login"), null);
  assert.equal(safeNextPath("/a/../../auth/callback"), null);
});

test("safeNextPath(): блок-лист по сегментам — /loginx и /apidocs не задеты", () => {
  assert.equal(safeNextPath("/loginx"), "/loginx");
  assert.equal(safeNextPath("/apidocs"), "/apidocs");
});

test("safeNextPath(): слишком длинное значение → null", () => {
  assert.equal(safeNextPath(`/${"a".repeat(511)}`)?.length, 512);
  assert.equal(safeNextPath(`/${"a".repeat(512)}`), null);
});
