import assert from "node:assert/strict";
import test from "node:test";
import { pluralRu } from "./plural-ru.ts";

const form = (n: number) => pluralRu(n, "символ", "символа", "символов");

test("pluralRu(): 1, 21, 101 → единственное число", () => {
  for (const n of [1, 21, 101, 1001]) assert.equal(form(n), "символ", String(n));
});

test("pluralRu(): 2–4, 22–24 → «символа»", () => {
  for (const n of [2, 3, 4, 22, 24, 102]) assert.equal(form(n), "символа", String(n));
});

test("pluralRu(): 0, 5–20, 25–30 → «символов», включая «одиннадцать/двенадцать…»", () => {
  for (const n of [0, 5, 9, 10, 11, 12, 13, 14, 15, 20, 25, 111, 112, 114]) assert.equal(form(n), "символов", String(n));
});

test("pluralRu(): отрицательные и дробные числа не ломают выбор формы", () => {
  assert.equal(form(-1), "символ");
  assert.equal(form(2.9), "символа");
});
