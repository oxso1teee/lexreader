import type { LearningPath } from "../types";

// M3 Slice 8 — topic-first, same shape as everyday.v1.ts. All skills map
// to "activation" — this path is about professional vocabulary, not new
// grammar categories.
export const IT_ENGLISH_V1: LearningPath = {
  slug: "it-english",
  version: 1,
  title: "Английский для IT",
  goal: "Уверенно обсуждать код, баги, требования и работать в международной команде на английском.",
  levelFrom: "A2",
  levelTo: "B1",
  kind: "topic",
  stages: [
    {
      key: "describing-work",
      title: "Описание работы",
      description: "Рассказывать о задачах, багах и изменениях в коде.",
      modules: [
        {
          key: "describing-work-module",
          title: "Работа и баги",
          skills: [
            { key: "topic.describing_bugs", title: "Описание багов", category: "activation", lesson: {
              objective: "Чётко описывать баг: что ожидалось и что произошло.",
              explanation: "Стандартная структура описания бага: steps to reproduce, expected result, actual result.",
              examples: ["Steps to reproduce: ...", "Expected: the button is disabled.", "Actual: the button stays active."],
              commonMistakes: ["Описывать баг без шагов воспроизведения"],
            }},
            { key: "topic.explaining_code_changes", title: "Объяснение изменений в коде", category: "activation", lesson: {
              objective: "Кратко объяснять, что и зачем изменено в коде.",
              explanation: "Лексика для описания изменений: fix, refactor, add, remove, update.",
              examples: ["This PR fixes a race condition.", "Refactored the auth flow for clarity."],
              commonMistakes: ["Смешивать fix и feature в одном расплывчатом описании"],
            }},
            { key: "topic.code_review_language", title: "Код-ревью", category: "activation", lesson: {
              objective: "Давать и получать обратную связь по коду вежливо и по делу.",
              explanation: "Формулы для код-ревью: предложения, а не приказы; вопросы вместо утверждений.",
              examples: ["Could we extract this into a separate function?", "Nit: minor naming suggestion."],
              commonMistakes: ["Слишком резкие формулировки замечаний"],
            }},
          ],
        },
      ],
    },
    {
      key: "collaboration",
      title: "Совместная работа",
      description: "Git/GitHub, созвоны и асинхронное общение в команде.",
      modules: [
        {
          key: "collaboration-module",
          title: "Инструменты и созвоны",
          skills: [
            { key: "topic.git_github_vocabulary", title: "Git и GitHub", category: "activation", lesson: {
              objective: "Уверенно использовать стандартную терминологию Git/GitHub.",
              explanation: "Базовый набор терминов: branch, merge, pull request, commit, revert.",
              examples: ["I opened a pull request.", "Can you review my branch?"],
              commonMistakes: ["Путать merge и rebase в описании действия"],
            }},
            { key: "topic.meetings_standups", title: "Созвоны и стендапы", category: "activation", lesson: {
              objective: "Кратко отчитываться на стендапе и участвовать в обсуждениях.",
              explanation: "Формат стендапа: что сделано, что планируется, есть ли блокеры.",
              examples: ["Yesterday I finished the API integration.", "I'm blocked on the design review."],
              commonMistakes: ["Слишком длинный, неструктурированный отчёт"],
            }},
            { key: "topic.async_communication", title: "Асинхронное общение", category: "activation", lesson: {
              objective: "Писать понятные асинхронные сообщения без созвона.",
              explanation: "Чёткая структура письменного сообщения: контекст, вопрос, срок ответа.",
              examples: ["Quick question — no rush.", "Context: ...  Question: ...  Deadline: ..."],
              commonMistakes: ["Сообщение без контекста, требующее уточнений"],
            }},
          ],
        },
      ],
    },
    {
      key: "documentation",
      title: "Документация",
      description: "Требования, спецификации и технические вопросы.",
      modules: [
        {
          key: "documentation-module",
          title: "Документы и требования",
          skills: [
            { key: "topic.writing_docs", title: "Написание документации", category: "activation", lesson: {
              objective: "Писать понятную техническую документацию.",
              explanation: "Ясность важнее сложных конструкций: короткие предложения, конкретные примеры.",
              examples: ["This endpoint returns a list of users.", "See the example below."],
              commonMistakes: ["Слишком общие формулировки без примеров"],
            }},
            { key: "topic.requirements_specs", title: "Требования и спецификации", category: "activation", lesson: {
              objective: "Обсуждать и уточнять требования к задаче.",
              explanation: "Лексика для уточнения scope и границ задачи.",
              examples: ["Is this in scope for this sprint?", "What's the expected behavior here?"],
              commonMistakes: ["Додумывать требования вместо уточняющих вопросов"],
            }},
            { key: "topic.technical_questions", title: "Технические вопросы", category: "activation", lesson: {
              objective: "Формулировать точные технические вопросы коллегам.",
              explanation: "Хороший технический вопрос содержит контекст и то, что уже попробовано.",
              examples: ["I tried X and got Y — any idea why?", "Is there a reason we use A instead of B here?"],
              commonMistakes: ["Вопрос без контекста: «It doesn't work, help»"],
            }},
          ],
        },
      ],
    },
    {
      key: "professional-communication",
      title: "Профессиональное общение",
      description: "Презентации, собеседования и удалённая коммуникация.",
      modules: [
        {
          key: "professional-communication-module",
          title: "Презентации и собеседования",
          skills: [
            { key: "topic.presenting_projects", title: "Презентация проекта", category: "activation", lesson: {
              objective: "Кратко и уверенно презентовать проект команде.",
              explanation: "Структура короткой презентации: проблема, решение, результат.",
              examples: ["The problem we solved was...", "As a result, we reduced load time by 30%."],
              commonMistakes: ["Начинать с деталей реализации вместо проблемы"],
            }},
            { key: "topic.interviews", title: "Собеседования", category: "activation", lesson: {
              objective: "Уверенно отвечать на типичные вопросы технического собеседования.",
              explanation: "Стандартные форматы ответов: STAR (Situation, Task, Action, Result) для поведенческих вопросов.",
              examples: ["Tell me about a challenging bug you fixed.", "Why do you want to join this team?"],
              commonMistakes: ["Слишком короткие ответы без конкретных примеров"],
            }},
            { key: "topic.remote_communication", title: "Удалённая коммуникация", category: "activation", lesson: {
              objective: "Эффективно общаться в распределённой команде.",
              explanation: "Внимание к часовым поясам, письменной ясности и избыточной документации решений.",
              examples: ["Let's find a time that works across time zones.", "I've documented the decision here for reference."],
              commonMistakes: ["Полагаться только на устные договорённости без записи"],
            }},
          ],
        },
      ],
    },
  ],
};
