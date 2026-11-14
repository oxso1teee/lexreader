import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { CURRICULA, findSkill } from "../src/lib/learning-paths/curriculum/index.ts";
import { buildLessonPlan } from "../src/lib/lessons/plan.ts";
import type { LessonPlan, ServerExercise } from "../src/lib/lessons/types.ts";

// Phase 2, итерация 5 — плеер уроков на галерее /dev/screens (без Supabase и
// логина). Интерактивные экраны Player-* — настоящий LessonPlayer поверх
// НАСТОЯЩЕГО service.ts с хранилищем в памяти (src/app/dev/screens/lesson-
// gallery.tsx): проверка ответов, шаги, завершение и идемпотентность XP
// исполняются тем же кодом, что и на сервере. Правильные ответы тест берёт из
// того же плана, что строит сервис; браузер их не знает — как и пользователь.
//
// Запуск: npm run test:ui-kit (поднимает next dev на :3100).

const A2 = CURRICULA["a2-b1"];
const presentSimple = findSkill(A2, "grammar.present_simple")!;
const LESSON_PLAN = buildLessonPlan(presentSimple, "lesson")!; // 3 материала + 5 вопросов + 2 «собери» = 10
const CHECK_PLAN = buildLessonPlan(presentSimple, "check")!; // 5 вопросов
const TOPIC_PLAN = buildLessonPlan(findSkill(CURRICULA.everyday, "topic.small_talk")!, "lesson")!;
const READING_PLAN = buildLessonPlan(findSkill(A2, "vocabulary.active_recall")!, "lesson")!;

async function open(page: Page, screen: string, theme: "light" | "dark" = "light") {
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: theme });
  await page.addInitScript((t) => {
    if (localStorage.getItem("lexreader_theme") === null) localStorage.setItem("lexreader_theme", t);
  }, theme);
  await page.goto(`/dev/screens?s=${screen}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

const status = (page: Page) => page.getByTestId("harness-status");
const primary = (page: Page) => page.locator(".ls-actions .btn").last();
const counter = (page: Page, n: number, total: number) => page.getByText(`Шаг ${n} из ${total}`, { exact: true });

function optionOf(exercise: ServerExercise, index: number): string {
  return exercise.type === "sentence_build" ? exercise.solution[index] : exercise.options[index];
}

/** Выбрать вариант (по тексту) или собрать предложение, не нажимая «Проверить». */
async function fill(page: Page, exercise: ServerExercise, correct: boolean) {
  if (exercise.type === "sentence_build") {
    const tiles = correct ? exercise.solution : [...exercise.solution].reverse();
    const bank = page.getByRole("list", { name: "Слова для предложения" });
    for (const tile of tiles) await bank.getByRole("button", { name: tile, exact: true }).first().click();
    return;
  }
  const index = correct ? exercise.correctIndex : (exercise.correctIndex + 1) % exercise.options.length;
  await page.getByRole("radio", { name: optionOf(exercise, index), exact: true }).check();
}

async function answer(page: Page, exercise: ServerExercise, correct: boolean) {
  await fill(page, exercise, correct);
  await primary(page).click();
  await expect(page.getByRole("status").filter({ hasText: correct ? "Верно!" : "Неверно" })).toBeVisible();
}

/** Пройти материал (нажимать главную кнопку на каждом шаге с содержимым). */
async function readContent(page: Page, plan: LessonPlan) {
  for (const step of plan.steps) {
    if (step.kind !== "content") break;
    await primary(page).click();
  }
}

/** Пройти упражнения; wrongAt — индексы упражнений, на которые отвечаем неверно. */
async function playExercises(page: Page, plan: LessonPlan, wrongAt: number[] = []) {
  const ids = plan.exerciseOrder;
  for (let i = 0; i < ids.length; i++) {
    await answer(page, plan.exercises[ids[i]], !wrongAt.includes(i));
    await primary(page).click(); // «Далее» либо «Завершить урок» на последнем
  }
}

async function finishLesson(page: Page, plan: LessonPlan, wrongAt: number[] = []) {
  await readContent(page, plan);
  await playExercises(page, plan, wrongAt);
}

test.describe("прохождение урока", () => {
  test("полный урок без ошибок: введение → материал → ошибки → задания → результат, XP один раз", async ({ page }) => {
    await open(page, "Player-lesson");
    await expect(page.getByRole("heading", { level: 1, name: presentSimple.lesson.objective })).toBeVisible();
    await expect(counter(page, 1, 10)).toBeVisible();
    await expect(page.getByRole("progressbar").first()).toHaveAttribute("aria-valuenow", "0");

    await primary(page).click(); // «Начать»
    await expect(page.getByRole("heading", { level: 1, name: "Разберём тему" })).toBeVisible();
    await expect(page.getByText(presentSimple.lesson.explanation)).toBeVisible();
    await expect(page.getByRole("progressbar").first()).toHaveAttribute("aria-valuenow", "10");

    await primary(page).click();
    await expect(page.getByRole("heading", { level: 1, name: "Частые ошибки" })).toBeVisible();
    await expect(primary(page)).toHaveText("К упражнениям");
    await primary(page).click();
    await expect(page.getByText("Задание 1 из 7", { exact: true })).toBeVisible();

    await playExercises(page, LESSON_PLAN);

    await expect(page.getByRole("heading", { level: 1, name: "Без единой ошибки!" })).toBeVisible();
    const stats = page.getByRole("list", { name: "Итоги" }).or(page.locator("dl.ls-stats"));
    await expect(stats.getByText("Верно", { exact: true })).toBeVisible();
    await expect(stats.locator(".ls-stat", { hasText: "Верно" }).locator("dd")).toHaveText("7");
    await expect(stats.locator(".ls-stat", { hasText: "Ошибок" }).locator("dd")).toHaveText("0");
    await expect(stats.locator(".ls-stat", { hasText: "Результат" }).locator("dd")).toHaveText("100%");
    await expect(stats.locator(".ls-stat", { hasText: "XP" }).locator("dd")).toHaveText("+20");
    await expect(page.getByRole("link", { name: "Дальше: Present Continuous" })).toHaveAttribute("href", /grammar\.present_continuous$/);
    await expect(page.getByRole("link", { name: "К пути" })).toBeVisible();
    await expect(status(page)).toContainText("status=completed");
    await expect(status(page)).toContainText("xpGrants=20");
    await expect(page.getByRole("progressbar").first()).toHaveAttribute("aria-valuenow", "100");
  });

  test("неверный ответ: правильный ответ и объяснение появляются только после проверки", async ({ page }) => {
    await open(page, "Player-lesson");
    await readContent(page, LESSON_PLAN);
    const first = LESSON_PLAN.exercises[LESSON_PLAN.exerciseOrder[0]];
    if (first.type === "sentence_build") throw new Error("первым идёт вопрос банка");

    await expect(page.getByText(first.explanation, { exact: true })).toHaveCount(0);
    await expect(page.getByText("Правильный ответ:")).toHaveCount(0);

    await answer(page, first, false);
    await expect(page.getByText("Правильный ответ:")).toBeVisible();
    await expect(page.getByText(first.explanation, { exact: true })).toBeVisible();
    // верная карточка подсвечена словом «Верно», выбранная неверная — «Неверно» (не только цветом)
    const correctCard = page.locator(".choice-card", { has: page.getByRole("radio", { name: first.options[first.correctIndex], exact: true }) });
    await expect(correctCard).toContainText("Верно");
    await expect(correctCard).toHaveAttribute("data-state", "correct");
    await expect(page.locator('.choice-card[data-state="incorrect"]')).toContainText("Неверно");
    // после ответа выбор заблокирован, главная кнопка — «Далее»
    await expect(page.getByRole("radio").first()).toBeDisabled();
    await expect(primary(page)).toHaveText("Далее");
    await expect(status(page)).toContainText("incorrect=1");
  });

  test("«Проверить» недоступна без выбора и объясняет почему; цифры выбирают вариант, Enter проверяет", async ({ page }) => {
    await open(page, "Player-lesson");
    await readContent(page, LESSON_PLAN);
    await expect(primary(page)).toBeDisabled();
    await expect(page.getByText("Выбери ответ, чтобы проверить.")).toBeVisible();

    const first = LESSON_PLAN.exercises[LESSON_PLAN.exerciseOrder[0]];
    if (first.type === "sentence_build") throw new Error("первым идёт вопрос банка");
    await page.getByRole("radio").first().focus();
    await page.keyboard.press(String(first.correctIndex + 1));
    await expect(page.getByRole("radio", { name: first.options[first.correctIndex], exact: true })).toBeChecked();
    await expect(primary(page)).toBeEnabled();

    await page.keyboard.press("Enter");
    await expect(page.getByRole("status").filter({ hasText: "Верно!" })).toBeVisible();
    // фокус переехал на «Далее»: Enter ведёт дальше
    await expect(primary(page)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Задание 2 из 7", { exact: true })).toBeVisible();
  });

  test("пропуск в предложении: выбранный вариант встаёт на место", async ({ page }) => {
    await open(page, "Player-lesson");
    await readContent(page, LESSON_PLAN);
    // присутствует хотя бы один fill_blank среди вопросов этого урока
    const ids = LESSON_PLAN.exerciseOrder;
    const index = ids.findIndex((id) => LESSON_PLAN.exercises[id].type === "fill_blank");
    expect(index).toBeGreaterThanOrEqual(0);
    for (let i = 0; i < index; i++) {
      await answer(page, LESSON_PLAN.exercises[ids[i]], true);
      await primary(page).click();
    }
    const blank = LESSON_PLAN.exercises[ids[index]];
    if (blank.type !== "fill_blank") throw new Error("ожидали fill_blank");
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading.locator(".ls-blank")).toHaveText("пропуск");
    await page.getByRole("radio", { name: blank.options[blank.correctIndex], exact: true }).check();
    await expect(heading.locator(".ls-blank")).toHaveText(blank.options[blank.correctIndex]);
  });

  test("«собери предложение»: тайлы, сброс, проверка верного и неверного порядка", async ({ page }) => {
    await open(page, "Player-lesson");
    await readContent(page, LESSON_PLAN);
    const ids = LESSON_PLAN.exerciseOrder;
    const firstBuild = ids.findIndex((id) => LESSON_PLAN.exercises[id].type === "sentence_build");
    for (let i = 0; i < firstBuild; i++) {
      await answer(page, LESSON_PLAN.exercises[ids[i]], true);
      await primary(page).click();
    }
    const build = LESSON_PLAN.exercises[ids[firstBuild]];
    if (build.type !== "sentence_build") throw new Error("ожидали sentence_build");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Собери предложение");
    await expect(primary(page)).toBeDisabled();
    await expect(page.getByText("Собери предложение, чтобы проверить.")).toBeVisible();

    const bank = page.getByRole("list", { name: "Слова для предложения" });
    await bank.getByRole("button", { name: build.solution[0], exact: true }).first().click();
    await expect(primary(page)).toBeEnabled();
    await expect(page.getByRole("group", { name: "Твой ответ" }).getByRole("button")).toHaveCount(1);
    // слово из ответа можно вернуть
    await page.getByRole("group", { name: "Твой ответ" }).getByRole("button", { name: `${build.solution[0]} — убрать из ответа` }).click();
    await expect(primary(page)).toBeDisabled();
    // «Сбросить» очищает всё
    await bank.getByRole("button", { name: build.solution[0], exact: true }).first().click();
    await bank.getByRole("button", { name: build.solution[1], exact: true }).first().click();
    await page.getByRole("button", { name: "Сбросить" }).click();
    await expect(page.getByRole("group", { name: "Твой ответ" }).getByRole("button")).toHaveCount(0);

    await answer(page, build, false);
    await expect(page.getByText("Правильный ответ:")).toBeVisible();
    await expect(page.getByText(build.solution.join(" "), { exact: true })).toBeVisible();
    await expect(page.locator('.sb-line[data-state="incorrect"]')).toBeVisible();
  });
});

test.describe("надёжность", () => {
  test("двойной клик не отправляет шаг и ответ дважды", async ({ page }) => {
    await open(page, "Player-lesson");
    await expect(status(page)).toContainText("calls=1/0/0/0");
    await primary(page).dblclick(); // «Начать»
    await expect(counter(page, 2, 10)).toBeVisible();
    await expect(status(page)).toContainText("calls=1/1/0/0");
    await expect(status(page)).toContainText("stepIndex=1");

    await primary(page).click();
    await primary(page).click();
    await expect(counter(page, 4, 10)).toBeVisible();
    const first = LESSON_PLAN.exercises[LESSON_PLAN.exerciseOrder[0]];
    await fill(page, first, true);
    await primary(page).dblclick(); // «Проверить»
    await expect(page.getByRole("status").filter({ hasText: "Верно!" })).toBeVisible();
    await expect(status(page)).toContainText("calls=1/3/1/0");
    await expect(status(page)).toContainText("answers=1");
  });

  test("возврат назад: пройденное доступно для просмотра, вперёд — только до принятого шага", async ({ page }) => {
    await open(page, "Player-lesson");
    await expect(page.getByRole("button", { name: "Назад к предыдущему шагу" })).toHaveCount(0);
    await readContent(page, LESSON_PLAN);
    const first = LESSON_PLAN.exercises[LESSON_PLAN.exerciseOrder[0]];
    await answer(page, first, false);
    await primary(page).click();
    await expect(counter(page, 5, 10)).toBeVisible();

    const back = page.getByRole("button", { name: "Назад к предыдущему шагу" });
    await back.click();
    // пройденное упражнение — в режиме просмотра: ответ и разбор на месте, менять нельзя
    await expect(counter(page, 4, 10)).toBeVisible();
    await expect(page.getByText("Правильный ответ:")).toBeVisible();
    await expect(page.getByRole("radio").first()).toBeDisabled();
    await expect(primary(page)).toHaveText("Далее");
    await back.click();
    await expect(page.getByRole("heading", { level: 1, name: "Частые ошибки" })).toBeVisible();
    await expect(primary(page)).toHaveText("Далее");
    // «Далее» при просмотре не обращается к серверу
    const callsBefore = await status(page).textContent();
    await primary(page).click();
    await expect(counter(page, 4, 10)).toBeVisible();
    expect(await status(page).textContent()).toBe(callsBefore);
    // прогресс сохранён на принятом шаге, а не откатился
    await expect(page.getByRole("progressbar").first()).toHaveAttribute("aria-valuenow", "40");
  });

  test("выход: Esc открывает подтверждение; «Остаться» закрывает, «Выйти» ведёт на страницу урока", async ({ page }) => {
    await open(page, "Player-lesson");
    await primary(page).click();
    await expect(counter(page, 2, 10)).toBeVisible();

    await page.keyboard.press("Escape");
    const dialog = page.getByRole("dialog", { name: "Выйти из урока?" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Прогресс сохранён")).toBeVisible();
    await dialog.getByRole("button", { name: "Остаться" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(counter(page, 2, 10)).toBeVisible();

    await page.getByRole("button", { name: "Выйти из урока" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Выйти", exact: true }).click();
    await expect(page).toHaveURL(/\/dev\/screens\?s=Lesson-current/);
  });

  test("выход из нетронутого урока — сразу, без подтверждения", async ({ page }) => {
    await open(page, "Player-lesson");
    await page.getByRole("button", { name: "Выйти из урока" }).click();
    await expect(page).toHaveURL(/\/dev\/screens\?s=Lesson-current/);
  });

  test("восстановление: после закрытия и повторного открытия урок продолжается с сохранённого шага", async ({ page }) => {
    await open(page, "Player-lesson");
    await readContent(page, LESSON_PLAN);
    const [a, b] = LESSON_PLAN.exerciseOrder.map((id) => LESSON_PLAN.exercises[id]);
    await answer(page, a, true);
    await primary(page).click();
    await answer(page, b, false);
    await expect(status(page)).toContainText("stepIndex=5");

    await page.getByRole("button", { name: "Закрыть и открыть заново" }).click();
    await expect(counter(page, 6, 10)).toBeVisible();
    await expect(status(page)).toContainText("attempts=1");
    await expect(page.getByRole("progressbar").first()).toHaveAttribute("aria-valuenow", "50");
    // ответ на второе упражнение не потерян и не засчитывается заново: ответ виден при возврате
    await page.getByRole("button", { name: "Назад к предыдущему шагу" }).click();
    await expect(page.getByText("Неверно", { exact: true }).first()).toBeVisible();
    await expect(status(page)).toContainText("correct=1");
    await expect(status(page)).toContainText("incorrect=1");
  });

  test("ошибка сохранения: понятное сообщение, шаг не потерян, повтор проходит", async ({ page }) => {
    await open(page, "Player-lesson");
    await page.getByRole("button", { name: "Сбой записи" }).click();
    await primary(page).click();
    await expect(page.getByRole("alert").filter({ hasText: "Не удалось сохранить прогресс" })).toBeVisible();
    await expect(counter(page, 1, 10)).toBeVisible();
    await expect(primary(page)).toBeEnabled();
    await primary(page).click();
    await expect(counter(page, 2, 10)).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "Не удалось сохранить прогресс" })).toHaveCount(0);
  });

  test("потеря соединения: сообщение, кнопка остаётся рабочей", async ({ page }) => {
    await open(page, "Player-lesson");
    await readContent(page, LESSON_PLAN);
    const first = LESSON_PLAN.exercises[LESSON_PLAN.exerciseOrder[0]];
    await fill(page, first, true);
    await page.getByRole("button", { name: "Обрыв сети" }).click();
    await primary(page).click();
    await expect(page.getByRole("alert").filter({ hasText: "Не удалось связаться с сервером" })).toBeVisible();
    await expect(status(page)).toContainText("answers=0");
    await primary(page).click();
    await expect(page.getByRole("status").filter({ hasText: "Верно!" })).toBeVisible();
    await expect(status(page)).toContainText("answers=1");
  });

  test("закрытый урок: экран ошибки с выходом, без бесконечной загрузки", async ({ page }) => {
    await open(page, "Player-locked");
    await expect(page.getByText("Урок пока закрыт")).toBeVisible();
    await expect(page.getByRole("link", { name: "Вернуться к уроку" })).toHaveAttribute("href", /Lesson-current/);
    await expect(page.getByRole("status")).toHaveCount(0);
  });
});

test.describe("завершение и повторы", () => {
  test("слабый результат: урок не засчитан, XP нет; «Попробовать ещё раз» начинает новую попытку, после зачёта XP выдаётся один раз", async ({ page }) => {
    await open(page, "Player-lesson");
    const all = LESSON_PLAN.exerciseOrder.map((_, i) => i);
    await finishLesson(page, LESSON_PLAN, all);
    await expect(page.getByRole("heading", { level: 1, name: "Пока рано закрывать тему" })).toBeVisible();
    await expect(page.locator(".ls-stat", { hasText: "XP" }).locator("dd")).toHaveText("не начислено");
    await expect(page.getByRole("link", { name: "К материалу" })).toHaveAttribute("href", /Lesson-current/);
    await expect(page.getByRole("link", { name: /^Дальше:/ })).toHaveCount(0);
    await expect(status(page)).toContainText("xpGrants=-");

    await page.getByRole("button", { name: "Попробовать ещё раз" }).click();
    await expect(page.getByRole("heading", { level: 1, name: presentSimple.lesson.objective })).toBeVisible();
    await expect(status(page)).toContainText("attempts=2");
    await finishLesson(page, LESSON_PLAN);
    await expect(page.getByRole("heading", { level: 1, name: "Без единой ошибки!" })).toBeVisible();
    await expect(status(page)).toContainText("xpGrants=20");
  });

  test("повторное завершение той же попытки: те же цифры, XP не начисляется второй раз, моментов нет", async ({ page }) => {
    await open(page, "Player-lesson");
    await finishLesson(page, LESSON_PLAN, [0]);
    await expect(page.getByRole("heading", { level: 1, name: "Урок пройден!" })).toBeVisible();
    await expect(page.locator(".ls-stat", { hasText: "XP" }).locator("dd")).toHaveText("+15");
    await expect(status(page)).toContainText("xpGrants=15");

    for (let i = 0; i < 2; i++) {
      await page.getByRole("button", { name: "Завершить ещё раз" }).click();
      await expect(page.getByTestId("harness-replay")).toHaveText(/ok finalizedNow=false xp=15 correct=6 moments=0/);
    }
    await expect(status(page)).toContainText("xpGrants=15");
  });

  test("сбой начисления XP: урок засчитан, экран честно просит повторить, повтор начисляет ровно один раз", async ({ page }) => {
    await open(page, "Player-lesson");
    await page.getByRole("button", { name: "Сбой начисления XP" }).click();
    await finishLesson(page, LESSON_PLAN);

    await expect(page.getByRole("heading", { level: 1, name: "Без единой ошибки!" })).toBeVisible();
    const alert = page.getByRole("status").filter({ hasText: "XP пока не начислен" });
    await expect(alert).toBeVisible();
    await expect(page.locator(".ls-stat", { hasText: "XP" }).locator("dd")).toHaveText("ожидает");
    await expect(page.getByText("уже получено")).toHaveCount(0);
    await expect(status(page)).toContainText("xpGrants=-");
    await expect(status(page)).toContainText("xpFailed=1");
    await expect(status(page)).toContainText("claimed=0");
    // прогресс по курсу при этом сохранён
    await expect(page.getByRole("link", { name: "Дальше: Present Continuous" })).toBeVisible();

    await alert.getByRole("button", { name: "Повторить начисление" }).click();
    await expect(page.getByText("XP пока не начислен")).toHaveCount(0);
    await expect(page.locator(".ls-stat", { hasText: "XP" }).locator("dd")).toHaveText("+20");
    await expect(status(page)).toContainText("xpGrants=20");
    await expect(status(page)).toContainText("claimed=1");
  });

  test("повторное прохождение уже зачтённого урока — практика: XP не начисляется", async ({ page }) => {
    await open(page, "Player-lesson");
    await finishLesson(page, LESSON_PLAN);
    await expect(status(page)).toContainText("xpGrants=20");

    await page.getByRole("button", { name: "Закрыть и открыть заново" }).click();
    await expect(page.getByRole("heading", { level: 1, name: presentSimple.lesson.objective })).toBeVisible();
    await finishLesson(page, LESSON_PLAN);
    await expect(page.getByRole("heading", { level: 1, name: "Без единой ошибки!" })).toBeVisible();
    await expect(page.locator(".ls-stat", { hasText: "XP" }).locator("dd")).toHaveText("уже получено");
    await expect(status(page)).toContainText("attempts=2");
    await expect(status(page)).toContainText("xpGrants=20");
  });
});

test.describe("другие виды уроков", () => {
  test("быстрая проверка: только вопросы, без материала; 5 из 5 засчитывает", async ({ page }) => {
    await open(page, "Player-check");
    await expect(counter(page, 1, 5)).toBeVisible();
    await expect(page.getByText("Задание 1 из 5", { exact: true })).toBeVisible();
    await expect(page.getByText("Проверка знаний · Present Simple")).toBeVisible();
    await playExercises(page, CHECK_PLAN);
    await expect(page.getByRole("heading", { level: 1, name: "Без единой ошибки!" })).toBeVisible();
    await expect(page.getByText("Проверка знаний · Present Simple").first()).toBeVisible();
    await expect(status(page)).toContainText("xpGrants=20");
  });

  test("быстрая проверка: 3 из 5 (60%) не засчитывает урок", async ({ page }) => {
    await open(page, "Player-check");
    await playExercises(page, CHECK_PLAN, [3, 4]);
    await expect(page.getByRole("heading", { level: 1, name: "Проверка не засчитана" })).toBeVisible();
    await expect(page.getByText("Для зачёта нужно от 80%", { exact: false }).first()).toBeVisible();
    await expect(page.locator(".ls-stat", { hasText: "Результат" }).locator("dd")).toHaveText("60%");
    await expect(status(page)).toContainText("xpGrants=-");
  });

  test("тематический урок без вопросов банка: практика из его собственных примеров", async ({ page }) => {
    await open(page, "Player-topic");
    const total = TOPIC_PLAN.steps.length;
    await expect(counter(page, 1, total)).toBeVisible();
    await readContent(page, TOPIC_PLAN);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Собери предложение");
    await playExercises(page, TOPIC_PLAN);
    await expect(page.getByRole("heading", { level: 1, name: "Без единой ошибки!" })).toBeVisible();
  });

  test("читательский урок без упражнений: последний шаг сразу завершает урок, оценки нет", async ({ page }) => {
    await open(page, "Player-reading");
    expect(READING_PLAN.exerciseOrder).toHaveLength(0);
    await expect(page.getByText("Упражнения:")).toHaveCount(0);
    for (let i = 0; i < READING_PLAN.steps.length; i++) await primary(page).click();
    await expect(page.getByRole("heading", { level: 1, name: "Урок пройден!" })).toBeVisible();
    await expect(page.locator(".ls-stat", { hasText: "Верно" })).toHaveCount(0);
    await expect(page.locator(".ls-stat", { hasText: "XP" }).locator("dd")).toHaveText("+15");
  });
});

// ---- статичные состояния и адаптивность ----

const STATIC_SCREENS = [
  "Player-loading",
  "Player-fatal",
  "Player-fatal-auth",
  "Complete-passed",
  "Complete-perfect",
  "Complete-failed",
  "Complete-check-failed",
  "Complete-first-win",
  "Complete-xp-pending",
  "Complete-xp-via-lesson",
  "Complete-xp-via-check",
  "Start-card-new",
  "Start-card-resume",
  "Start-card-done",
  "Start-card-done-check",
] as const;

test.describe("статичные состояния", () => {
  test("загрузка: скелет с role=status, а не пустой экран", async ({ page }) => {
    await open(page, "Player-loading");
    await expect(page.getByRole("status")).toHaveAttribute("aria-busy", "true");
    await expect(page.getByText("Загружаем урок…")).toBeAttached();
  });

  test("ошибка: «Попробовать снова» только там, где повтор может помочь; при истёкшей сессии — «Войти»", async ({ page }) => {
    await open(page, "Player-fatal");
    await expect(page.getByRole("button", { name: "Попробовать снова" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Вернуться к уроку" })).toBeVisible();
    await open(page, "Player-fatal-auth");
    await expect(page.getByRole("link", { name: "Войти" })).toHaveAttribute("href", "/login");
    await expect(page.getByRole("button", { name: "Попробовать снова" })).toHaveCount(0);
  });

  test("результат: первая победа ведёт в Today; карточки входа показывают «Начать / Продолжить · шаг / Пройти ещё раз»", async ({ page }) => {
    await open(page, "Complete-first-win");
    await expect(page.getByRole("link", { name: "Перейти в Today" })).toHaveAttribute("href", "/home");
    await open(page, "Start-card-new");
    await expect(page.getByRole("link", { name: "Начать урок" })).toHaveAttribute("href", /Player-lesson/);
    await open(page, "Start-card-resume");
    await expect(page.getByRole("link", { name: "Продолжить · шаг 5 из 10" })).toBeVisible();
    await open(page, "Start-card-done");
    await expect(page.getByRole("link", { name: "Пройти ещё раз" })).toBeVisible();
    await expect(page.getByText("XP за этот навык уже получен за урок — повторное прохождение это практика.")).toBeVisible();
    await expect(page.getByText("Последний результат: 6 из 7 верно.")).toBeVisible();
    await open(page, "Start-card-new");
    await expect(page.getByText(/Награда за навык одна — её можно получить за урок или за проверку знаний\./)).toBeVisible();
  });

  test("награда за навык одна: экраны говорят, чем она получена — уроком или проверкой знаний", async ({ page }) => {
    await open(page, "Start-card-done-check");
    await expect(page.getByText("XP за этот навык уже получен за проверку знаний — награда одна на навык, урок можно пройти как практику.")).toBeVisible();
    await expect(page.getByText("XP за этот навык уже получен за урок")).toHaveCount(0);

    await open(page, "Complete-xp-via-check");
    await expect(page.locator(".ls-stat", { hasText: "XP" }).locator("dd")).toHaveText("уже получено");
    await expect(page.getByTestId("xp-source-note")).toHaveText("Награда за этот навык уже получена за проверку знаний — она одна на навык.");

    await open(page, "Complete-xp-via-lesson");
    await expect(page.getByTestId("xp-source-note")).toHaveText("Награда за этот навык уже получена за урок — она одна на навык.");

    // когда XP начислен только что, пояснение не нужно
    await open(page, "Complete-perfect");
    await expect(page.getByTestId("xp-source-note")).toHaveCount(0);
  });
});

async function expectAccessible(page: Page, label: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${label}: горизонтальная прокрутка`).toBeLessThanOrEqual(1);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(
    results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(" ")).slice(0, 3) })),
    `${label}: axe`,
  ).toEqual([]);
}

async function reachStates(page: Page, theme: "light" | "dark", check: (label: string) => Promise<void>) {
  await open(page, "Player-lesson", theme);
  await check("введение");
  await primary(page).click();
  await check("материал");
  await primary(page).click();
  await check("частые ошибки");
  await primary(page).click();
  await check("вопрос");
  const ids = LESSON_PLAN.exerciseOrder;
  await answer(page, LESSON_PLAN.exercises[ids[0]], false);
  await check("вопрос: неверно + разбор");
  await primary(page).click();
  await answer(page, LESSON_PLAN.exercises[ids[1]], true);
  await check("вопрос: верно + разбор");
  await primary(page).click();
  for (let i = 2; i < ids.length; i++) {
    const exercise = LESSON_PLAN.exercises[ids[i]];
    if (exercise.type === "sentence_build") {
      await fill(page, exercise, true);
      await check("собери предложение: собрано");
      await primary(page).click();
      await expect(page.getByRole("status").filter({ hasText: "Верно!" })).toBeVisible();
      await check("собери предложение: разбор");
      await primary(page).click();
    } else {
      await answer(page, exercise, true);
      await primary(page).click();
    }
  }
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Урок пройден|Без единой ошибки/);
  await check("результат");
}

test.describe("адаптивность и доступность", () => {
  for (const theme of ["light", "dark"] as const) {
    for (const width of [360, 768, 1280]) {
      test(`${theme}, ${width}px: интерактивные состояния без переполнения и нарушений axe`, async ({ page }) => {
        test.setTimeout(240_000);
        await page.setViewportSize({ width, height: 3200 });
        await reachStates(page, theme, (label) => expectAccessible(page, `${theme}/${width}/${label}`));
      });

      test(`${theme}, ${width}px: статичные состояния без переполнения и нарушений axe`, async ({ page }) => {
        test.setTimeout(240_000);
        await page.setViewportSize({ width, height: 3200 });
        for (const screen of STATIC_SCREENS) {
          await open(page, screen, theme);
          await expectAccessible(page, `${theme}/${width}/${screen}`);
        }
      });
    }
  }
});
