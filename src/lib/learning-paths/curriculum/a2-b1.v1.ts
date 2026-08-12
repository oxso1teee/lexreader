import type { LearningPath } from "../types";

// M3 Slice 8 — flagship path. Approved outline (audit + brief): 4 stages,
// 18 skills. Every grammar skill here has real grammar-bank.ts Knowledge
// Check coverage (see PatternCategory extension, migration 0039).
export const A2_B1_V1: LearningPath = {
  slug: "a2-b1",
  version: 1,
  title: "A2 → B1: Прочный фундамент",
  goal: "Уверенный intermediate-фундамент: времена, повседневная грамматика, связная речь, активный словарь.",
  levelFrom: "A2",
  levelTo: "B1",
  kind: "grammar_foundation",
  stages: [
    {
      key: "core-sentence-building",
      title: "Основы предложения",
      description: "Базовые времена и порядок слов — то, без чего не строится ни одно предложение.",
      modules: [
        {
          key: "present-past-basics",
          title: "Настоящее и прошлое",
          skills: [
            {
              key: "grammar.present_simple",
              title: "Present Simple",
              category: "tense",
              subTopic: "present_simple",
              lesson: {
                objective: "Уверенно использовать Present Simple для привычек, фактов и расписаний.",
                explanation:
                  "Present Simple описывает привычные действия и факты. С he/she/it глагол получает окончание «-s»: she works. Отрицание и вопрос строятся через do/does.",
                examples: ["I work every day.", "She works from home.", "Do you like coffee?", "Water boils at 100°C."],
                commonMistakes: ["She work (без -s)", "I am work (лишний be)", "Does she works? (лишний -s после does)"],
              },
            },
            {
              key: "grammar.present_continuous",
              title: "Present Continuous",
              category: "tense",
              subTopic: "present_continuous",
              lesson: {
                objective: "Правильно использовать be + -ing для действий прямо сейчас.",
                explanation:
                  "Present Continuous описывает действие в процессе прямо сейчас. Обязательно нужен вспомогательный глагол be (am/is/are) перед формой на -ing.",
                examples: ["I am cleaning my room.", "She is studying English.", "They are playing football."],
                commonMistakes: ["I cleaning my room (пропущен am)", "She working (пропущен is)"],
              },
            },
            {
              key: "grammar.past_simple",
              title: "Past Simple",
              category: "tense",
              subTopic: "past_simple",
              lesson: {
                objective: "Уверенно рассказывать о завершённых действиях в прошлом.",
                explanation:
                  "Past Simple — законченное действие в прошлом. Правильные глаголы получают «-ed» (finished), неправильные меняют форму полностью (go → went). Вопрос и отрицание — через did.",
                examples: ["I went to the cinema yesterday.", "She finished her homework.", "Did you see that movie?"],
                commonMistakes: ["I goed (неправильный глагол через -ed)", "Did you saw? (did + прошедшая форма вместо базовой)"],
              },
            },
          ],
        },
        {
          key: "sentence-mechanics",
          title: "Строение предложения",
          skills: [
            {
              key: "grammar.questions",
              title: "Вопросы",
              category: "question_formation",
              lesson: {
                objective: "Строить вопросы в правильном порядке слов.",
                explanation:
                  "Обычный вопрос: вопросительное слово (если есть) + вспомогательный глагол + подлежащее + смысловой глагол. «You are from where?» звучит неестественно — правильно «Where are you from?».",
                examples: ["Where do you live?", "What is your name?", "How many books did you read?"],
                commonMistakes: ["You are from where? (неверный порядок)", "Where you live? (пропущен do)"],
              },
            },
            {
              key: "grammar.word_order",
              title: "Порядок слов",
              category: "word_order",
              lesson: {
                objective: "Ставить обстоятельства и наречия частотности на правильное место.",
                explanation:
                  "Базовый порядок: подлежащее + сказуемое + дополнение. Наречия частотности (always, never) стоят перед смысловым глаголом, после подлежащего — не в начале предложения.",
                examples: ["I always drink coffee in the morning.", "She gave a gift to me.", "I have never been to Japan."],
                commonMistakes: ["Always I drink coffee (наречие в начале)", "I saw yesterday him (дополнение после обстоятельства)"],
              },
            },
          ],
        },
      ],
    },
    {
      key: "everyday-grammar",
      title: "Грамматика на каждый день",
      description: "Артикли, предлоги, сравнения и модальные глаголы — то, что встречается в любой обычной речи.",
      modules: [
        {
          key: "articles-prepositions",
          title: "Артикли и предлоги",
          skills: [
            {
              key: "grammar.articles",
              title: "Артикли",
              category: "article",
              lesson: {
                objective: "Выбирать a/an, the или нулевой артикль без раздумий.",
                explanation:
                  "a/an — впервые упомянутый исчисляемый объект. the — когда собеседник понимает, о чём речь. Неисчисляемые и общие утверждения — часто без артикля.",
                examples: ["I saw a dog in the park.", "The dog was friendly.", "Water is essential for life."],
                commonMistakes: ["I need an advice (неисчисляемое с артиклем)", "She bought a apple (a вместо an перед гласной)"],
              },
            },
            {
              key: "grammar.prepositions",
              title: "Предлоги",
              category: "preposition",
              lesson: {
                objective: "Использовать устойчивые сочетания глагол/прилагательное + предлог.",
                explanation:
                  "Многие английские предлоги не переводятся дословно с русского — их нужно запоминать вместе со словом: depend on, interested in, married to, afraid of, good at.",
                examples: ["She is interested in art.", "It depends on the weather.", "He is married to a doctor."],
                commonMistakes: ["It depends of the weather (of вместо on)", "married with (with вместо to)"],
              },
            },
          ],
        },
        {
          key: "describing-modality",
          title: "Сравнения и модальность",
          skills: [
            {
              key: "grammar.comparatives",
              title: "Сравнительная степень",
              category: "comparative",
              lesson: {
                objective: "Правильно образовывать сравнительную и превосходную степень.",
                explanation:
                  "Короткие прилагательные (1 слог) — через «-er»/«-est»: fast → faster → fastest. Длинные — через more/most: interesting → more interesting. Неправильные формы (good → better → best) запоминаются отдельно.",
                examples: ["My car is faster than yours.", "This book is more interesting than that one.", "She is the best student."],
                commonMistakes: ["more faster (двойная сравнительная степень)", "goodest (вместо best)"],
              },
            },
            {
              key: "grammar.modals",
              title: "Модальные глаголы",
              category: "modal",
              lesson: {
                objective: "Использовать can/must/should без лишней частицы «to».",
                explanation:
                  "После модальных глаголов (can, must, should, could, would, might, may) сразу идёт смысловой глагol без «to» и без «-s» в 3-м лице.",
                examples: ["You must see a doctor.", "Can you help me?", "She can speak three languages."],
                commonMistakes: ["must to see (лишнее to)", "she cans (лишнее -s)"],
              },
            },
          ],
        },
      ],
    },
    {
      key: "connected-english",
      title: "Связная речь",
      description: "Пассивный залог, придаточные, условные предложения и gerund/infinitive — для более сложных мыслей.",
      modules: [
        {
          key: "passive-clauses",
          title: "Пассив и придаточные",
          skills: [
            {
              key: "grammar.passive",
              title: "Пассивный залог",
              category: "passive",
              lesson: {
                objective: "Строить пассивные конструкции с правильной формой Past Participle.",
                explanation:
                  "Пассив: be + Past Participle. После was/were нужна именно форма Past Participle (written), а не Past Simple (wrote).",
                examples: ["The book was written by him.", "This house was built in 1990.", "The cake was made by my mother."],
                commonMistakes: ["was wrote (Past Simple вместо Participle)", "is write (нет формы Participle)"],
              },
            },
            {
              key: "grammar.relative_clauses",
              title: "Придаточные предложения",
              category: "relative_clause",
              lesson: {
                objective: "Выбирать правильное относительное местоимение: who/which/where/whose.",
                explanation:
                  "who — для людей, which/that — для предметов, where — для места, whose — для принадлежности. После относительного местоимения не нужно повторять местоимение-дублёр.",
                examples: ["The woman who lives next door is a doctor.", "The book which I bought is great.", "This is the house where I grew up."],
                commonMistakes: ["the man which (which вместо who для людей)", "the book which I bought it (лишнее it)"],
              },
            },
          ],
        },
        {
          key: "conditionals-patterns",
          title: "Условные и глагольные конструкции",
          skills: [
            {
              key: "grammar.conditionals",
              title: "Условные предложения",
              category: "conditional",
              lesson: {
                objective: "Различать нулевой, первый и второй тип условных предложений.",
                explanation:
                  "Нулевой тип (общие истины): if + Present Simple, Present Simple. Первый (реальное будущее): if + Present Simple, will. Второй (нереальное настоящее): if + Past Simple, would — «if I were» для всех лиц.",
                examples: ["If it rains, I will stay home.", "If I were rich, I would travel the world.", "If you heat water, it boils."],
                commonMistakes: ["If I was rich (was вместо were во 2 типе)", "If it rains, I stay home (пропущен will)"],
              },
            },
            {
              key: "grammar.gerund_infinitive",
              title: "Gerund / Infinitive",
              category: "gerund_infinitive",
              lesson: {
                objective: "Выбирать -ing или to + глагол после конкретных глаголов.",
                explanation:
                  "После enjoy/avoid/finish идёт герундий (-ing): enjoy reading. После want/decide/hope идёт инфинитив (to + глагол): want to go. Это нужно запоминать по конкретному глаголу, не по правилу.",
                examples: ["I enjoy reading books.", "She wants to go home.", "He avoids eating junk food."],
                commonMistakes: ["enjoy to read (инфинитив вместо герундия)", "want going (герундий вместо инфинитива)"],
              },
            },
          ],
        },
      ],
    },
    {
      key: "active-english",
      title: "Активный английский",
      description: "От пассивного узнавания — к активному использованию слов, фраз и текстов.",
      modules: [
        {
          key: "vocabulary-in-action",
          title: "Словарь в действии",
          skills: [
            {
              key: "vocabulary.active_recall",
              title: "Активация словаря",
              category: "activation",
              lesson: {
                objective: "Переводить пассивно узнаваемые слова в активный словарный запас.",
                explanation:
                  "Слово, которое ты узнаёшь при чтении, но не можешь вспомнить самостоятельно — это пассивный словарь. Регулярное активное вспоминание (без подсказки) переводит его в активный.",
                examples: ["Узнаю слово «achieve» в тексте, но не вспоминаю его сам — целевой сигнал для активации."],
                commonMistakes: ["Считать, что слово выучено, если оно просто узнаётся при чтении"],
              },
            },
            {
              key: "vocabulary.collocations",
              title: "Коллокации",
              category: "collocation",
              lesson: {
                objective: "Использовать устойчивые сочетания слов вместо дословного перевода.",
                explanation:
                  "Многие сочетания в английском фиксированы и не переводятся дословно: make a decision (не «take»), heavy rain (не «strong»), take a photo.",
                examples: ["make a decision", "heavy rain", "take a photo", "do homework"],
                commonMistakes: ["take a decision (калька с других языков)", "strong rain (вместо heavy rain)"],
              },
            },
            {
              key: "vocabulary.phrase_building",
              title: "Построение фраз",
              category: null,
              missionTypeHint: "phrase_activation",
              lesson: {
                objective: "Закреплять сохранённые в Reader фразы до уверенного использования.",
                explanation:
                  "Фраза, сохранённая при чтении, закрепляется так же, как и слово — через регулярное повторение в реальном контексте, не разовое узнавание.",
                examples: ["Сохранённая фраза «make up your mind» — практика до уверенного узнавания и использования."],
                commonMistakes: ["Сохранить фразу и не возвращаться к ней"],
              },
            },
          ],
        },
        {
          key: "reading-writing",
          title: "Чтение и письмо",
          skills: [
            {
              key: "reading.general",
              title: "Чтение",
              category: null,
              lesson: {
                objective: "Регулярно читать материалы на уровне B1 с опорой на контекст.",
                explanation:
                  "Чтение на чуть выше комфортного уровня (i+1) — лучший способ встречать новую грамматику и лексику в естественном контексте.",
                examples: ["Читать короткие тексты уровня B1 из библиотеки LexReader, отмечая незнакомые слова."],
                commonMistakes: ["Останавливаться на каждом незнакомом слове вместо чтения по контексту"],
              },
            },
            {
              key: "writing.correction",
              title: "Письмо",
              category: null,
              lesson: {
                objective: "Проверять собственные предложения через Correction Input.",
                explanation:
                  "Written practice закрепляет грамматику активнее, чем просто чтение правил. Correction Input проверяет предложение по известным паттернам без ИИ.",
                examples: ["Написать 2-3 предложения о своём дне и проверить их в Correction Input."],
                commonMistakes: ["Не проверять написанное вообще"],
              },
            },
          ],
        },
      ],
    },
  ],
};
