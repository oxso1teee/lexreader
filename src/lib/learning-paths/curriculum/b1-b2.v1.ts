import type { LearningPath } from "../types";

// M3 Slice 8 — B1→B2. Several skills here honestly have no grammar-bank
// Knowledge Check yet (Perfect aspects share the coarse "tense" category
// signal but no curated question set; reported speech/discourse markers/
// phrasal verbs have no PatternCategory mapping at all) — disclosed in the
// plan doc §6, not silently hidden. Their `category`/`subTopic` reflect
// reality: null where nothing honest exists, "tense" (shared, coarse)
// where it does.
export const B1_B2_V1: LearningPath = {
  slug: "b1-b2",
  version: 1,
  title: "B1 → B2: Сложные конструкции и беглость",
  goal: "Продвинутая грамматика, естественные обороты речи и уверенное владение сложными текстами.",
  levelFrom: "B1",
  levelTo: "B2",
  kind: "grammar_foundation",
  stages: [
    {
      key: "advanced-tense-aspect",
      title: "Расширенные времена",
      description: "Perfect-времена и точные оттенки прошлого и будущего.",
      modules: [
        {
          key: "perfect-aspects",
          title: "Perfect-времена",
          skills: [
            {
              key: "grammar.present_perfect",
              title: "Present Perfect",
              category: "tense",
              // Deliberately a subTopic with no grammar-bank coverage yet
              // (disclosed plan doc §6) — this scopes Knowledge Check to
              // "honestly unavailable" instead of silently falling back to
              // the whole "tense" pool (present_simple/continuous/past_simple
              // questions, which would be actively wrong content here).
              subTopic: "present_perfect",
              lesson: {
                objective: "Различать Present Perfect и Past Simple.",
                explanation:
                  "Present Perfect (have/has + Participle) связывает прошлое с настоящим: результат важен сейчас. Past Simple — просто факт в прошлом, время указано или подразумевается.",
                examples: ["I have finished my homework. (важен результат сейчас)", "I finished my homework at 6 pm. (просто факт)"],
                commonMistakes: ["I have finished it yesterday (Present Perfect с конкретным временем в прошлом)"],
              },
            },
            {
              key: "grammar.past_perfect",
              title: "Past Perfect",
              category: "tense",
              subTopic: "past_perfect",
              lesson: {
                objective: "Использовать Past Perfect для действия, случившегося раньше другого прошлого действия.",
                explanation: "Past Perfect (had + Participle) — «прошлое до прошлого»: показывает, что одно событие случилось раньше другого.",
                examples: ["When I arrived, she had already left.", "I had never seen snow before that trip."],
                commonMistakes: ["Использовать Past Simple там, где важна последовательность двух прошлых событий"],
              },
            },
            {
              key: "grammar.future_forms",
              title: "Формы будущего времени",
              category: "tense",
              subTopic: "future_forms",
              lesson: {
                objective: "Выбирать между will, going to и Present Continuous для будущего.",
                explanation: "will — решение в момент речи или предсказание. going to — заранее спланированное намерение. Present Continuous — договорённость с конкретным временем.",
                examples: ["I think I'll call her later.", "I'm going to study medicine.", "We're meeting at 7 pm tomorrow."],
                commonMistakes: ["Использовать will для уже принятого заранее плана"],
              },
            },
          ],
        },
      ],
    },
    {
      key: "advanced-constructions",
      title: "Сложные конструкции",
      description: "Расширенный пассив, условные предложения и косвенная речь.",
      modules: [
        {
          key: "passive-conditionals-advanced",
          title: "Пассив и условные (продвинутый уровень)",
          skills: [
            {
              key: "grammar.passive_advanced",
              title: "Пассив в разных временах",
              category: "passive",
              lesson: {
                objective: "Строить пассив не только в Past Simple, но и в Perfect/Continuous формах.",
                explanation: "Пассив образуется от любого времени: is being built, has been written, will be sent — вспомогательные глаголы меняются, Past Participle остаётся.",
                examples: ["The report has been written.", "The house is being built.", "The email will be sent tomorrow."],
                commonMistakes: ["Терять Past Participle при усложнении времени"],
              },
            },
            {
              key: "grammar.reported_speech",
              title: "Косвенная речь",
              category: null,
              lesson: {
                objective: "Пересказывать чужие слова с правильным сдвигом времён.",
                explanation: "В косвенной речи время обычно сдвигается на шаг назад: «I am tired» → she said she was tired.",
                examples: ["She said, \"I am tired.\" → She said she was tired.", "He said, \"I will call you.\" → He said he would call me."],
                commonMistakes: ["Не менять время при пересказе"],
              },
            },
            {
              key: "grammar.conditionals_advanced",
              title: "Условные 2 и 3 типа",
              category: "conditional",
              lesson: {
                objective: "Уверенно использовать нереальные условные о настоящем и прошлом.",
                explanation: "2 тип — нереальное настоящее: if + Past Simple, would. 3 тип — нереальное прошлое: if + Past Perfect, would have + Participle.",
                examples: ["If I had known, I would have helped you.", "If she studied harder, she would pass."],
                commonMistakes: ["Смешивать времена внутри одного условного предложения"],
              },
            },
          ],
        },
      ],
    },
    {
      key: "natural-usage",
      title: "Естественная речь",
      description: "Коллокации, фразовые глаголы и связки — то, что делает речь звучащей естественно.",
      modules: [
        {
          key: "lexical-fluency",
          title: "Лексическая беглость",
          skills: [
            {
              key: "vocabulary.collocations_advanced",
              title: "Продвинутые коллокации",
              category: "collocation",
              lesson: {
                objective: "Расширить набор устойчивых сочетаний до уровня B2.",
                explanation: "На B2 важны более тонкие коллокации: raise a concern, reach a conclusion, address an issue.",
                examples: ["raise a concern", "reach a conclusion", "address an issue"],
                commonMistakes: ["Дословный перевод вместо устойчивого сочетания"],
              },
            },
            {
              key: "vocabulary.phrasal_verbs",
              title: "Фразовые глаголы",
              category: null,
              lesson: {
                objective: "Уверенно использовать частотные фразовые глаголы вместо однословных аналогов.",
                explanation: "Фразовые глаголы (give up, look into, come across) — обычная разговорная норма, не сленг. Значение часто не выводится из отдельных слов.",
                examples: ["give up (сдаться)", "look into (изучить)", "come across (случайно встретить)"],
                commonMistakes: ["Избегать фразовых глаголов там, где они звучат естественнее"],
              },
            },
            {
              key: "grammar.discourse_markers",
              title: "Связки и дискурсивные маркеры",
              category: null,
              lesson: {
                objective: "Связывать мысли через however/moreover/on the other hand.",
                explanation: "Дискурсивные маркеры показывают логику текста: however (противопоставление), moreover (добавление), therefore (следствие).",
                examples: ["I like the plan. However, the timing is tight.", "It's expensive; moreover, it's slow."],
                commonMistakes: ["Использовать «but» и «however» взаимозаменяемо в любом стиле"],
              },
            },
          ],
        },
      ],
    },
    {
      key: "fluency",
      title: "Беглость",
      description: "Расширенное чтение, письмо и активный словарь на уровне B2.",
      modules: [
        {
          key: "extended-practice",
          title: "Практика на уровне B2",
          skills: [
            { key: "reading.extended", title: "Расширенное чтение", category: null, lesson: {
              objective: "Читать более длинные и сложные тексты уровня B1-B2.",
              explanation: "На этом уровне полезно читать не только адаптированные, но и близкие к оригинальным тексты.",
              examples: ["Читать материалы уровня B1/B2 из библиотеки LexReader регулярно."],
              commonMistakes: ["Останавливаться только на текстах комфортного уровня"],
            }},
            { key: "writing.fluency", title: "Письменная беглость", category: null, lesson: {
              objective: "Писать более длинные связные тексты и проверять их через Correction Input.",
              explanation: "Регулярная письменная практика с проверкой закрепляет грамматику активнее, чем пассивное чтение правил.",
              examples: ["Написать короткий абзац на свободную тему и проверить его."],
              commonMistakes: ["Писать без последующей проверки"],
            }},
            { key: "vocabulary.active_recall_b2", title: "Активный словарь B2", category: "activation", lesson: {
              objective: "Продолжать переводить пассивный словарь в активный на более сложной лексике.",
              explanation: "Тот же принцип активации, что и на A2→B1, но на менее частотной, более специализированной лексике.",
              examples: ["Активировать слова, которые узнаются в тексте, но не вспоминаются самостоятельно."],
              commonMistakes: ["Останавливать активацию словаря после первого этапа пути"],
            }},
          ],
        },
      ],
    },
  ],
};
