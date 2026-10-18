import { test } from "node:test";
import assert from "node:assert/strict";
import { levelForXp, xpForLevel, levelProgress } from "./level.ts";

test("levelForXp(): 0 XP is level 1", () => {
  assert.equal(levelForXp(0), 1);
});

test("levelForXp(): exactly at a step boundary rounds up to the new level", () => {
  assert.equal(levelForXp(99), 1);
  assert.equal(levelForXp(100), 2);
  assert.equal(levelForXp(799), 8);
  assert.equal(levelForXp(800), 9);
});

test("levelForXp(): negative XP never produces a level below 1", () => {
  assert.equal(levelForXp(-50), 1);
});

test("xpForLevel(): inverse of levelForXp at each boundary", () => {
  assert.equal(xpForLevel(1), 0);
  assert.equal(xpForLevel(2), 100);
  assert.equal(xpForLevel(9), 800);
});

test("levelProgress(): midway through a level reports 50%", () => {
  const p = levelProgress(850);
  assert.equal(p.level, 9);
  assert.equal(p.xpIntoLevel, 50);
  assert.equal(p.xpForNextLevel, 100);
  assert.equal(p.progress, 0.5);
});

test("levelProgress(): right at a boundary reports 0% into the new level", () => {
  const p = levelProgress(800);
  assert.equal(p.level, 9);
  assert.equal(p.xpIntoLevel, 0);
  assert.equal(p.progress, 0);
});
