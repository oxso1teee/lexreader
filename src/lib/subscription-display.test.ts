import assert from "node:assert/strict";
import test from "node:test";
import { formatDate, planLabel, subscriptionPeriodInfo, showPastDueWarning } from "./subscription-display.ts";

test("formatDate(): zero-padded DD.MM.YYYY", () => {
  assert.equal(formatDate("2026-03-05T12:00:00.000Z"), "05.03.2026");
});

test("formatDate(): double-digit day/month unaffected", () => {
  assert.equal(formatDate("2026-11-23T00:00:00.000Z"), "23.11.2026");
});

test("planLabel(): maps every Plan value to a distinct Russian label", () => {
  assert.equal(planLabel("free"), "Бесплатный");
  assert.equal(planLabel("premium_monthly"), "Premium (месяц)");
  assert.equal(planLabel("premium_yearly"), "Premium (год)");
});

test("subscriptionPeriodInfo(): free plan never shows a period, even with a stale current_period_end", () => {
  assert.equal(subscriptionPeriodInfo("free", null, "2026-09-01T00:00:00.000Z"), null);
  assert.equal(subscriptionPeriodInfo("free", "past_due", "2026-09-01T00:00:00.000Z"), null);
});

test("subscriptionPeriodInfo(): active paid plan shows 'Продление'", () => {
  const info = subscriptionPeriodInfo("premium_monthly", "active", "2026-09-01T00:00:00.000Z");
  assert.deepEqual(info, { label: "Продление", formattedDate: "01.09.2026" });
});

test("subscriptionPeriodInfo(): past_due paid plan shows 'Доступ до' instead", () => {
  const info = subscriptionPeriodInfo("premium_yearly", "past_due", "2026-09-01T00:00:00.000Z");
  assert.equal(info?.label, "Доступ до");
});

test("subscriptionPeriodInfo(): paid plan without a period end returns null (nothing to show)", () => {
  assert.equal(subscriptionPeriodInfo("premium_monthly", "active", null), null);
});

test("showPastDueWarning(): only true for a past_due paid plan, never for free", () => {
  assert.equal(showPastDueWarning("premium_monthly", "past_due"), true);
  assert.equal(showPastDueWarning("free", "past_due"), false);
  assert.equal(showPastDueWarning("premium_monthly", "active"), false);
});
