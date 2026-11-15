import assert from "node:assert/strict";
import test from "node:test";
import { isPlausibleEmail, mailProviderFor, maskEmail } from "./email.ts";

test("isPlausibleEmail(): нормальные адреса проходят, пробелы по краям игнорируются", () => {
  assert.equal(isPlausibleEmail("a@b.co"), true);
  assert.equal(isPlausibleEmail("  sergey@example.com "), true);
  assert.equal(isPlausibleEmail("first.last+tag@sub.example.org"), true);
});

test("isPlausibleEmail(): без домена, без @, с пробелом внутри, пустое → false", () => {
  for (const bad of ["", "a@b", "a@b.", "@b.co", "a b@c.de", "plain", "a@@b.co"]) {
    assert.equal(isPlausibleEmail(bad), false, bad);
  }
});

test("isPlausibleEmail(): длиннее 254 символов → false", () => {
  assert.equal(isPlausibleEmail(`${"a".repeat(250)}@b.co`), false);
});

test("maskEmail(): первая буква, фиксированное число точек, домен целиком", () => {
  assert.equal(maskEmail("sergey@gmail.com"), "s•••••@gmail.com");
  assert.equal(maskEmail("a@x.io"), "a•••••@x.io");
  assert.equal(maskEmail("ёж@почта.рф"), "ё•••••@почта.рф");
});

test("maskEmail(): длина локальной части не раскрывается", () => {
  assert.equal(maskEmail("ab@x.io").length - "x.io".length, maskEmail("abcdefghijkl@x.io").length - "x.io".length);
});

test("maskEmail(): не email → нейтральная заглушка, без исключений", () => {
  for (const input of ["", "no-at-sign", "@x.io"]) assert.equal(maskEmail(input), "•••", input);
});

test("mailProviderFor(): известные домены → веб-почта; регистр не важен", () => {
  assert.deepEqual(mailProviderFor("x@gmail.com"), { name: "Gmail", url: "https://mail.google.com/" });
  assert.equal(mailProviderFor("User@GMAIL.COM")?.name, "Gmail");
  assert.equal(mailProviderFor("x@yandex.ru")?.url, "https://mail.yandex.ru/");
  assert.equal(mailProviderFor("x@ya.ru")?.name, "Яндекс Почту");
  assert.equal(mailProviderFor("x@mail.ru")?.url, "https://e.mail.ru/");
  assert.equal(mailProviderFor("x@icloud.com")?.name, "iCloud Почту");
});

test("mailProviderFor(): неизвестный домен, поддомен и не-email → null (кнопку не показываем)", () => {
  assert.equal(mailProviderFor("x@corp.example"), null);
  assert.equal(mailProviderFor("x@sub.gmail.com"), null);
  assert.equal(mailProviderFor("no-at-sign"), null);
  assert.equal(mailProviderFor(""), null);
});

test("mailProviderFor(): все ссылки — https", () => {
  for (const domain of ["gmail.com", "yandex.ru", "mail.ru", "outlook.com", "icloud.com", "proton.me", "yahoo.com", "rambler.ru"]) {
    assert.match(mailProviderFor(`x@${domain}`)?.url ?? "", /^https:\/\//, domain);
  }
});
