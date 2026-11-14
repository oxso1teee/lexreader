import { test } from "node:test";
import assert from "node:assert/strict";
import { firstNameFromMetadata, learningGoalLabel } from "./identity.ts";

test("firstNameFromMetadata(): берёт первое слово из given_name / full_name / name в этом порядке", () => {
  assert.equal(firstNameFromMetadata({ given_name: "Сергей", full_name: "Сергей Пучков" }), "Сергей");
  assert.equal(firstNameFromMetadata({ full_name: "  Anna  Maria Lee " }), "Anna");
  assert.equal(firstNameFromMetadata({ name: "Max" }), "Max");
  assert.equal(firstNameFromMetadata({ given_name: "   ", name: "Lena Ivanova" }), "Lena");
});

test("firstNameFromMetadata(): нет имени, пустые и нестроковые значения — null", () => {
  assert.equal(firstNameFromMetadata({}), null);
  assert.equal(firstNameFromMetadata(null), null);
  assert.equal(firstNameFromMetadata(undefined), null);
  assert.equal(firstNameFromMetadata("строка"), null);
  assert.equal(firstNameFromMetadata({ given_name: 42, full_name: "", name: null }), null);
});

test("firstNameFromMetadata(): email в метаданных за имя не принимается", () => {
  assert.equal(firstNameFromMetadata({ email: "someone@example.com" }), null);
});

test("learningGoalLabel(): известные цели онбординга получают русскую подпись", () => {
  assert.equal(learningGoalLabel("travel"), "Путешествия");
  assert.equal(learningGoalLabel("work_it"), "Работа / IT");
  assert.equal(learningGoalLabel("general"), "Просто улучшить английский");
});

test("learningGoalLabel(): пусто или неизвестное значение — null, подпись не выдумываем", () => {
  assert.equal(learningGoalLabel(null), null);
  assert.equal(learningGoalLabel(undefined), null);
  assert.equal(learningGoalLabel(""), null);
  assert.equal(learningGoalLabel("something_else"), null);
});
