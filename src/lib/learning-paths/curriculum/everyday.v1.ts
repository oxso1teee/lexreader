import type { LearningPath } from "../types";

// M3 Slice 8 — topic-first path. Every skill maps to "activation" (real
// Language Twin category, real vocab_activation/phrase_activation Mission
// coverage) rather than grammar categories — matches the audit's finding
// that Everyday English should be vocabulary/topic-first, not grammar-first.
export const EVERYDAY_V1: LearningPath = {
  slug: "everyday",
  version: 1,
  title: "Английский для жизни",
  goal: "Уверенно общаться в повседневных ситуациях: знакомства, покупки, транспорт, здоровье, путешествия.",
  levelFrom: "A2",
  levelTo: "B1",
  kind: "topic",
  stages: [
    {
      key: "meeting-people",
      title: "Знакомства и общение",
      description: "Первые фразы для знакомства и лёгкой беседы.",
      modules: [
        {
          key: "introductions",
          title: "Знакомства",
          skills: [
            { key: "topic.greetings_introductions", title: "Приветствия и знакомство", category: "activation", lesson: {
              objective: "Уверенно представляться и знакомиться на английском.",
              explanation: "Базовый набор фраз для знакомства: имя, откуда ты, чем занимаешься.",
              examples: ["Nice to meet you.", "What do you do?", "Where are you from?"],
              commonMistakes: ["How do you do? как ответ на How are you? (разные фразы)"],
            }},
            { key: "topic.small_talk", title: "Лёгкая беседа (small talk)", category: "activation", lesson: {
              objective: "Поддерживать короткий разговор о погоде, планах, общих темах.",
              explanation: "Small talk — короткие безопасные темы: погода, выходные, общие впечатления.",
              examples: ["Nice weather, isn't it?", "Any plans for the weekend?"],
              commonMistakes: ["Слишком личные вопросы при первом знакомстве"],
            }},
            { key: "topic.asking_about_people", title: "Вопросы о людях", category: "activation", lesson: {
              objective: "Расспрашивать о семье, работе, интересах собеседника.",
              explanation: "Вежливые вопросы о жизни собеседника без излишней прямоты.",
              examples: ["Do you have any siblings?", "What do you do in your free time?"],
              commonMistakes: ["Слишком прямые вопросы о зарплате/возрасте"],
            }},
          ],
        },
      ],
    },
    {
      key: "shopping-transport-housing",
      title: "Покупки, транспорт, жильё",
      description: "Практическая лексика для повседневных дел.",
      modules: [
        {
          key: "daily-errands",
          title: "Повседневные дела",
          skills: [
            { key: "topic.shopping_money", title: "Покупки и деньги", category: "activation", lesson: {
              objective: "Уверенно делать покупки и обсуждать цены.",
              explanation: "Фразы для магазина, кассы, обмена и возврата товара.",
              examples: ["How much is this?", "Can I pay by card?", "I'd like to return this."],
              commonMistakes: ["How much cost this? (неверный порядок слов)"],
            }},
            { key: "topic.getting_around", title: "Транспорт и дорога", category: "activation", lesson: {
              objective: "Спрашивать дорогу и пользоваться общественным транспортом.",
              explanation: "Базовая лексика для транспорта: билеты, направления, расписание.",
              examples: ["How do I get to the station?", "Is this the right platform?"],
              commonMistakes: ["Where is here the bus stop? (неверный порядок)"],
            }},
            { key: "topic.home_housing", title: "Дом и жильё", category: "activation", lesson: {
              objective: "Обсуждать жильё, аренду, бытовые проблемы дома.",
              explanation: "Лексика для аренды, соседей, поломок в доме.",
              examples: ["The heating isn't working.", "How much is the rent?"],
              commonMistakes: ["Путать rent (аренда) и rental (прилагательное)"],
            }},
          ],
        },
      ],
    },
    {
      key: "health-travel",
      title: "Здоровье и путешествия",
      description: "Что сказать врачу и как путешествовать без стресса.",
      modules: [
        {
          key: "health-travel-module",
          title: "Здоровье и поездки",
          skills: [
            { key: "topic.at_the_doctor", title: "У врача", category: "activation", lesson: {
              objective: "Описывать симптомы и понимать рекомендации врача.",
              explanation: "Базовая медицинская лексика: симптомы, части тела, назначения.",
              examples: ["I have a headache.", "How often should I take this?"],
              commonMistakes: ["I have pain in my head вместо I have a headache"],
            }},
            { key: "topic.travel_directions", title: "Путешествия и направления", category: "activation", lesson: {
              objective: "Ориентироваться в незнакомом городе и на транспорте.",
              explanation: "Лексика для аэропорта, гостиницы, ориентирования на местности.",
              examples: ["Where is the check-in desk?", "Turn left at the corner."],
              commonMistakes: ["Turn to left вместо turn left"],
            }},
            { key: "topic.emergencies", title: "Экстренные ситуации", category: "activation", lesson: {
              objective: "Знать ключевые фразы для нештатных ситуаций.",
              explanation: "Короткий, но критичный набор фраз для экстренных случаев.",
              examples: ["Call an ambulance!", "I need help.", "Where is the nearest hospital?"],
              commonMistakes: ["Помнить только отдельные слова, а не готовые фразы"],
            }},
          ],
        },
      ],
    },
    {
      key: "friends-everyday-life",
      title: "Друзья и быт",
      description: "Общение с друзьями, звонки, сообщения, бытовые вопросы.",
      modules: [
        {
          key: "friends-communication",
          title: "Общение и планы",
          skills: [
            { key: "topic.calls_messages", title: "Звонки и сообщения", category: "activation", lesson: {
              objective: "Уверенно звонить и переписываться на английском.",
              explanation: "Разговорные формулы для звонков и сообщений — короче и проще, чем письменная речь.",
              examples: ["Can I call you back?", "Sorry, I missed your call."],
              commonMistakes: ["Использовать формальные письменные обороты в переписке"],
            }},
            { key: "topic.making_plans", title: "Планы и договорённости", category: "activation", lesson: {
              objective: "Договариваться о встречах и планах.",
              explanation: "Фразы для предложений, согласия, переноса встреч.",
              examples: ["Are you free on Friday?", "Can we reschedule?"],
              commonMistakes: ["Are you free at Friday? (неверный предлог)"],
            }},
            { key: "topic.everyday_problems", title: "Бытовые проблемы", category: "activation", lesson: {
              objective: "Описывать и решать небольшие бытовые проблемы словами.",
              explanation: "Лексика для жалоб, объяснения проблем, поиска решений.",
              examples: ["My phone stopped working.", "Something's wrong with the wifi."],
              commonMistakes: ["Слишком общие описания без конкретики"],
            }},
          ],
        },
      ],
    },
  ],
};
