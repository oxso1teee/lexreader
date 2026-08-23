import { test } from "node:test";
import assert from "node:assert/strict";
import { growthStage } from "./growth.ts";

test("growthStage(): mirrors behavioral-level.ts's exact vocabulary thresholds (15/500/1500/3000)", () => {
  assert.equal(growthStage(0), 0);
  assert.equal(growthStage(14), 0);
  assert.equal(growthStage(15), 1);
  assert.equal(growthStage(499), 1);
  assert.equal(growthStage(500), 2);
  assert.equal(growthStage(1499), 2);
  assert.equal(growthStage(1500), 3);
  assert.equal(growthStage(2999), 3);
  assert.equal(growthStage(3000), 4);
  assert.equal(growthStage(10000), 4);
});

test("growthStage(): monotonically non-decreasing as vocabulary grows", () => {
  const samples = [0, 5, 15, 100, 499, 500, 900, 1499, 1500, 2000, 2999, 3000, 5000];
  let prev = -1;
  for (const v of samples) {
    const stage = growthStage(v);
    assert.ok(stage >= prev, `growthStage(${v})=${stage} regressed below previous stage ${prev}`);
    prev = stage;
  }
});
