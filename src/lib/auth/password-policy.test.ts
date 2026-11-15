import assert from "node:assert/strict";
import test from "node:test";
import {
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
  passwordLength,
  passwordRules,
  passwordStrength,
  validatePassword,
} from "./password-policy.ts";

test("passwordLength(): считает символы, а не UTF-16 единицы — эмодзи это один символ", () => {
  assert.equal(passwordLength("abc"), 3);
  assert.equal(passwordLength("😀😀"), 2);
  assert.equal(passwordLength(""), 0);
});

test("passwordRules(): длина и цифра оцениваются независимо", () => {
  const met = (password: string) => passwordRules(password).map((r) => [r.id, r.met]);
  assert.deepEqual(met(""), [["length", false], ["digit", false]]);
  assert.deepEqual(met("abcdefgh"), [["length", true], ["digit", false]]);
  assert.deepEqual(met("abc1"), [["length", false], ["digit", true]]);
  assert.deepEqual(met("abcdefg1"), [["length", true], ["digit", true]]);
});

test("passwordRules(): подписи берут порог из PASSWORD_MIN_LENGTH, а не хардкод", () => {
  assert.ok(passwordRules("")[0].label.includes(String(PASSWORD_MIN_LENGTH)));
});

test("passwordStrength(): пустое поле — нейтральная подсказка, шкала не горит", () => {
  const s = passwordStrength("");
  assert.equal(s.level, 0);
  assert.equal(s.label, "");
  assert.ok(s.hint.length > 0);
});

test("passwordStrength(): слабый — говорит, что именно добавить (с правильным числом)", () => {
  assert.deepEqual(passwordStrength("abc"), { level: 1, label: "Слабый", hint: "добавь ещё 5 символов и цифру" });
  assert.equal(passwordStrength("abcdefg").hint, "добавь ещё 1 символ и цифру");
  assert.equal(passwordStrength("abcdef").hint, "добавь ещё 2 символа и цифру");
  assert.equal(passwordStrength("abcdefgh").hint, "добавь цифру");
  assert.equal(passwordStrength("abc1").hint, "добавь ещё 4 символа");
});

test("passwordStrength(): правила выполнены, но пароль короткий и однородный — средний", () => {
  assert.equal(passwordStrength("abcdefg1").level, 2);
  assert.equal(passwordStrength("abcdefg1").label, "Средний");
});

test("passwordStrength(): надёжный — от 12 символов или три класса символов", () => {
  assert.equal(passwordStrength("abcdefghij12").level, 3);
  assert.equal(passwordStrength("lighthouse2026").level, 3);
  assert.equal(passwordStrength("abcdefg1X").level, 3);
  assert.equal(passwordStrength("Абвгдеж1!").level, 3);
});

test("validatePassword(): короткий пароль отклоняется с указанием порога", () => {
  const result = validatePassword("abc1");
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, new RegExp(String(PASSWORD_MIN_LENGTH)));
});

test("validatePassword(): без цифры отклоняется", () => {
  const result = validatePassword("abcdefghij");
  assert.deepEqual(result, { ok: false, error: "Добавь в пароль хотя бы одну цифру." });
});

test("validatePassword(): длина считается в БАЙТАХ — кириллица занимает по два (лимит bcrypt 72)", () => {
  assert.equal(validatePassword("a".repeat(PASSWORD_MAX_BYTES - 1) + "1").ok, true);
  assert.equal(validatePassword("a".repeat(PASSWORD_MAX_BYTES) + "1").ok, false);
  assert.equal(validatePassword("я".repeat(PASSWORD_MAX_BYTES / 2) + "1").ok, false);
  assert.equal(validatePassword("я".repeat(30) + "1").ok, true);
});

test("validatePassword(): повтор проверяется только когда передан", () => {
  assert.equal(validatePassword("lighthouse2026").ok, true);
  assert.equal(validatePassword("lighthouse2026", "lighthouse2026").ok, true);
  assert.deepEqual(validatePassword("lighthouse2026", "lighthouse2025"), { ok: false, error: "Пароли не совпадают." });
  assert.deepEqual(validatePassword("lighthouse2026", ""), { ok: false, error: "Пароли не совпадают." });
});
