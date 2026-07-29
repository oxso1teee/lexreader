# LexReader — промт на реализацию плана вовлечённости (2026-07-28)

## 0. Контекст и статус

Источник: [`docs/PRODUCT_ENGAGEMENT_2026-07-28.html`](PRODUCT_ENGAGEMENT_2026-07-28.html) — план "часть 2" (без ИИ-чатов и переписок), который пользователь одобрил целиком. Это его прямая техническая расшифровка: семь направлений + быстрые улучшения, доведённые до уровня "что именно открыть и что именно написать".

Не путать с [`docs/PRODUCT_VISION_2026-07-28.html`](PRODUCT_VISION_2026-07-28.html) ("часть 1", ИИ-собеседник/дневник/лиги) — та часть плана пользователем **отклонена** ("не хочу пока лезть в эти все приколы с ИИ"). Ничего из части 1 в этом промте не реализуется.

Этот файл — рабочее задание для последующей реализации, не бэклог на почитать. Каждый раздел ниже написан так, чтобы его можно было превратить в задачи `TaskCreate` и делать по очереди, тем же способом, каким в этом проекте уже сделаны задачи #93–99.

## 1. Общие правила (не менять без явного запроса пользователя)

- **Цветовая палитра не меняется.** Тёплая кремовая/карамельная светлая тема и тёплая тёмная — как есть (`src/app/globals.css`). Всё ниже — про структуру и механику экранов, не про ребрендинг.
- **Английский — язык охвата контента по умолчанию.** Как и со стартовыми колодами (задача #97), новый контент для Библиотеки (раздел 3) пишется сначала для `target_language = "en"`; расширение на другие 14 языков — отдельная, более поздняя задача, явно не в этом промте.
- **Бесплатный тариф не трогаем этим планом.** Ничего здесь не обходит и не меняет `FREE_TEXT_LIMIT`/`FREE_DECK_LIMIT`/`FREE_FLASHCARD_LIMIT`/`FREE_DAILY_WORD_LIMIT` (`src/lib/subscription.ts`) — если где-то ниже создаётся новая запись (достижение, экран туториала), она не должна конкурировать с этими лимитами.
- **Только бесплатные инструменты.** Ничего в этом плане не требует нового платного API — все семь направлений реализуемы существующим стеком (Supabase, Next.js server actions, CSS/SVG, существующий `translateText`).
- **Порядок для каждой фичи одинаковый** (как во всех задачах #93–99 этой сессии):
  1. Прочитать текущий код перед правкой.
  2. Написать миграцию (если нужна) → применить к **локальному** Docker Supabase.
  3. Реализовать код.
  4. `npx tsc --noEmit` → `npx eslint <изменённые пути> --ext .ts,.tsx` — оба чистые.
  5. Живая проверка в браузере (dev-сервер, реальный логин тестовым пользователем `test@example.com` / `newtestpass456`), не только по коду.
  6. `npx playwright test` — 9 passed, 1 skipped (как сейчас), без регрессий.
  7. `git add` только изменённых файлов (не `git add -A`) → commit с `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
  8. Применить миграцию к **продакшн** Supabase через Management API (PAT уже был предоставлен пользователем в этой сессии).
  9. `git push origin main` → `npx vercel deploy --prod --yes`.
  10. Финальная проверка на `lexreader.vercel.app`.
- **Нумерация миграций продолжается с `0023`** (последняя существующая — `0022_vocabulary_favorite.sql`). Ниже каждой фиче присвоен конкретный номер — если по ходу реализации что-то из плана уже переделали иначе, номера сдвинуть, но не занимать задним числом уже применённый номер.

## 2. Рекомендованный порядок реализации

Не совпадает один-в-один с порядком показа в HTML-плане — учтена реальная зависимость данных: онбординг "первые 5 минут" опирается на контент из Библиотеки, поэтому Библиотеку делаем раньше онбординга, хотя в дорожной карте плана они были в разных фазах.

1. **Главная-дашборд** (раздел 3) — ноль зависимостей, только существующие данные.
2. **Библиотека: обложки + контент** (раздел 4) — контент нужен для пункта 6.
3. **Достижения, квест недели, заморозка стрика** (раздел 6).
4. **Отклик в Мозге и Тетради** (раздел 5).
5. **Иллюстрированные пустые состояния** (раздел 7).
6. **Первые 5 минут — онбординг с полным циклом** (раздел 2) — теперь есть из чего выбирать текст.
7. **Умные уведомления** (раздел 8).

---

## 3. Главная — приборная панель вместо ленты фактов

**Проблема.** `src/app/(app)/home/page.tsx` сейчас рендерит `AccountSummaryCard` → `LanguageBanner` → `PremiumCard` (только free) → `WelcomeCard` → **шесть статичных `InfoCard`** подряд (факты об Эббингаузе, Крашене, общие советы, плюс "Coming soon" с пунктом "💬 Практика разговора с ИИ" — этот пункт теперь **неправда**, раз ИИ-направление отклонено, и его тоже нужно убрать/переписать).

**Цель.** Одним взглядом видно: сколько слов сегодня, сколько карточек ждёт повторения, что дочитать. Все данные уже существуют в БД — это пересборка существующих запросов, не новая инфраструктура.

**Данные, которые нужно добавить в `Promise.all` на `home/page.tsx`:**
- Количество `vocabulary_items`, созданных **сегодня** (`created_at >= todayStartUtc`) — для кольца прогресса против `profile.daily_word_goal`. Копировать паттерн `todayStartUtc()`-подобного хелпера из `src/lib/vocabulary.ts`.
- `dueCount` — тот же запрос, что уже есть в `src/app/(app)/brain/page.tsx:29-34` (карточки к повторению, `srs_state.due_at <= now()`), просто продублировать (или вынести в `src/lib/srs-settings.ts`/новый `src/lib/brain-stats.ts` как переиспользуемую функцию `getDueCount(supabase, ownerId, language)` и вызвать из обоих мест — предпочтительно, чтобы не разъезжались).
- "Продолжить чтение" — самый недавний `text_progress` с `percent_read` между 5 и 95, джойн на `texts` для заголовка. Похожий паттерн уже есть в `src/app/(app)/library/page.tsx` (`progressByTextId`), но там для списка; здесь нужен один "самый свежий" — `order by last_read_at desc limit 1`.

**Новые компоненты:**
- `src/app/(app)/home/daily-goal-ring.tsx` — чистый презентационный SVG-компонент (`{current, goal}` в пропсах), кольцо прогресса как в макете плана (`stroke-dasharray`/`stroke-dashoffset`, `--color-caramel` как цвет заливки).
- `src/app/(app)/home/continue-reading-card.tsx` — карточка с названием текста, прогресс-баром, ссылкой на `/read/[textId]`.
- `src/app/(app)/home/stat-row.tsx` — три инлайн-числа (стрик/к повтору/новых сегодня), переиспользуя уже существующие иконки-паттерны (🔥/📇/＋) из макета.

**Что убрать/сократить.** Из шести `InfoCard` оставить максимум один ("совет дня"), остальные пять — удалить из основного потока Главной. Если жалко терять контент фактов — вынести в отдельный, не обязательный к посещению экран (например, ссылка "Почему это работает" в Настройках), но это уже отдельная, необязательная для этого промта задача — не блокирует пункт 3.

**Файлы:**
- `MODIFY src/app/(app)/home/page.tsx`
- `NEW src/app/(app)/home/daily-goal-ring.tsx`
- `NEW src/app/(app)/home/continue-reading-card.tsx`
- `NEW src/app/(app)/home/stat-row.tsx`
- `MODIFY src/app/(app)/home/info-card.tsx` (или удалить лишние вызовы `variant="fact"`/`"roadmap"` из `page.tsx`, сам компонент не трогать, если остаётся один вызов `variant="tip"`)
- Опционально: `NEW src/lib/brain-stats.ts` с `getDueCount()`, `MODIFY src/app/(app)/brain/page.tsx` — заменить инлайн-запрос на вызов общей функции.

**Критерии готовности:**
- На Главной без скролла видно: кольцо дневной цели, три числа (стрик/к повтору/новых), карточка "продолжить чтение" (если есть незаконченный текст) либо её отсутствие, если нечего продолжать.
- Цифры совпадают с тем, что показывают `/brain` и `/library` в тот же момент.
- Нет упоминания "практики разговора с ИИ" нигде на Главной.
- `tsc`/`eslint`/`e2e` зелёные, живая проверка в браузере (светлая и тёмная тема).

---

## 4. Библиотека — контент и обложки

**Проблема.** Раздел "Библиотека приложения" (`src/app/(app)/library/page.tsx`, `system` — тексты с `owner_id is null`) в текущей БД содержит буквально пару текстов ("A Walk in the Park", "The Coffee Shop on the Corner"). Обложек нет — `TextCard` (`src/app/(app)/library/text-card.tsx`) показывает только заголовок/счётчик слов/уровень текстом.

**Цель.** (а) Заметно больше готового контента, разного по темам и уровням A1–B2; (б) обложка у каждого системного текста — градиент, детерминированно вычисленный из заголовка, без единого файла-картинки и без ИИ-генерации; (в) "Текст дня" — один системный текст, меняющийся раз в сутки по детерминированному правилу (без крона).

### 4.1 Обложки — `src/lib/text-cover.ts` (NEW)

Чистая функция, без побочных эффектов:

```ts
const PALETTE: [string, string][] = [
  ["#2f5d50", "#1f3f37"], ["#a8451f", "#7a3016"], ["#9c7526", "#6f5518"],
  ["#4a4a6a", "#2e2e46"], ["#1f5750", "#163e39"], ["#8a3819", "#5e2610"],
];
const TOPIC_EMOJI: Record<string, string> = {
  coffee: "☕", city: "🏙️", travel: "✈️", house: "🏠", forest: "🌲",
  sea: "🌊", space: "🚀", letter: "✉️", mystery: "🔍",
  // расширять по мере добавления реальных заголовков контента (4.2)
};

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function coverGradient(title: string): [string, string] {
  return PALETTE[hashString(title) % PALETTE.length];
}
export function coverEmoji(title: string): string {
  const lower = title.toLowerCase();
  const key = Object.keys(TOPIC_EMOJI).find((k) => lower.includes(k));
  return key ? TOPIC_EMOJI[key] : "📄";
}
```

`MODIFY src/app/(app)/library/text-card.tsx` — для текстов без `owner_id` (системных) рендерить небольшую цветную плашку слева от заголовка (`linear-gradient(135deg, ${a}, ${b})` из `coverGradient(title)` + `coverEmoji(title)`), для собственных текстов пользователя — оставить как есть (не усложнять; обложки нужны там, где человек **выбирает** что читать, не там, где он уже сам добавил свой текст).

### 4.2 Контент — миграция `0024_seed_library_content.sql`

Нужно вручную написать (не сгенерировать автоматическим скрапингом — авторский контент, а не скрейпинг стороннего) **15–20 коротких системных текстов на английском**, распределённых по уровням:
- A1: 4–5 текстов, 80–150 слов, простые бытовые сюжеты (кофейня, прогулка, письмо другу).
- A2: 4–5 текстов, 150–250 слов.
- B1: 4–5 текстов, 200–350 слов, чуть более сложный сюжет (детектив-лайт, путешествие).
- B2: 3–4 текста, 300–450 слов.

Каждая строка — `insert into texts (owner_id, title, body, source_type, language, level_tag, word_count) values (null, ..., ..., 'manual', 'en', 'a1', ...)` (сверить точные значения `source_type`/колонки с `src/lib/types.ts` → `TextRow` и текущей `insertText()` в `src/app/(app)/library/actions.ts`, чтобы формат совпадал 1-в-1 с тем, что создаёт обычный ручной импорт).

**Важно:** это единственный пункт всего промта, где реализация — не только код, а ещё и авторский текст. Не тянуть контент из внешних источников без проверки лицензии.

### 4.3 "Текст дня"

`MODIFY src/app/(app)/library/page.tsx` — добавить вычисление:

```ts
const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD, стабильно весь день
const featuredIndex = hashString(today) % system.length;
const featured = system[featuredIndex];
```

(переиспользовать `hashString` из `text-cover.ts`, экспортировав её). Отрендерить `featured` отдельной, более крупной карточкой над обычным списком `system`, с меткой "Текст дня".

**Файлы:**
- `NEW src/lib/text-cover.ts`
- `MODIFY src/app/(app)/library/text-card.tsx`
- `MODIFY src/app/(app)/library/page.tsx`
- `NEW supabase/migrations/0024_seed_library_content.sql`

**Критерии готовности:**
- В `system`-текстах после миграции ≥ 15 записей, охватывающих все четыре уровня.
- Каждая карточка системного текста показывает разноцветную обложку без картинок.
- "Текст дня" виден один и тот же весь день, меняется на следующий день (проверить, подставив другую дату вручную в консоли/тесте).
- `tsc`/`eslint` чистые, живая проверка Библиотеки в светлой и тёмной теме.

---

## 5. Достижения, квест недели, заморозка стрика

**Проблема.** Единственная переменная мотивации — `profiles.streak_current`. Пропуск дня обнуляет её без подстраховки (`src/lib/streak.ts`, `touchStreak()`).

**Миграция `0025_engagement_layer.sql`:**

```sql
alter table profiles add column streak_freeze_available boolean not null default true;
alter table profiles add column streak_freeze_week date; -- начало ISO-недели, на которую заморозка уже посчитана

create table user_achievements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  achievement_id text not null,
  earned_at timestamptz not null default now(),
  unique (owner_id, achievement_id)
);
alter table user_achievements enable row level security;
create policy "user_achievements: owner select" on user_achievements
  for select using (owner_id = auth.uid());
create policy "user_achievements: owner insert" on user_achievements
  for insert with check (owner_id = auth.uid());
```

### 5.1 Заморозка стрика — `MODIFY src/lib/streak.ts`

Текущая логика: если `last_active_date` не сегодня и не вчера — стрик сбрасывается в 1. Новая логика: если пропущен ровно один день (позавчера, не сегодня и не вчера — т.е. разрыв ровно в 2 дня) **и** заморозка доступна на текущую ISO-неделю — не сбрасывать, пометить заморозку использованной, продолжить стрик как обычно (прибавить 1, как если бы пропуска не было). Заморозка обновляется на "доступна" в начале каждой новой ISO-недели (сравнение `streak_freeze_week` с текущим началом недели).

```ts
function isoWeekStart(d: Date): string {
  const day = (d.getUTCDay() + 6) % 7; // 0 = понедельник
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - day);
  return isoDate(monday);
}

// внутри touchStreak(), после загрузки profile:
const thisWeekStart = isoWeekStart(new Date());
const freezeAvailable = profile.streak_freeze_week !== thisWeekStart ? true : profile.streak_freeze_available;

const twoDaysAgo = isoDate(new Date(Date.now() - 2 * 86_400_000));
const gapIsOneMissedDay = profile.last_active_date === twoDaysAgo;

if (gapIsOneMissedDay && freezeAvailable) {
  await supabase.from("profiles").update({
    streak_current: profile.streak_current + 1,
    streak_longest: Math.max(profile.streak_current + 1, profile.streak_longest),
    last_active_date: today,
    streak_freeze_available: false,
    streak_freeze_week: thisWeekStart,
  }).eq("id", userId);
  return;
}
// иначе — существующая логика (продолжение/сброс), плюс не забыть
// выставить streak_freeze_available/streak_freeze_week в новую неделю,
// если freezeAvailable было true из-за смены недели.
```

### 5.2 Достижения — `NEW src/lib/achievements.ts`

```ts
export interface AchievementStats {
  totalWords: number;      // count(vocabulary_items) владельца
  finishedTexts: number;   // count(text_progress where percent_read >= 100)
  currentStreak: number;   // profiles.streak_current
  bestSessionCount: number; // из раздела 6 — если уже реализовано
}
export interface Achievement {
  id: string; icon: string; title: string; description: string;
  check: (s: AchievementStats) => boolean;
}
export const ACHIEVEMENTS: Achievement[] = [
  { id: "streak_7", icon: "🔥", title: "Неделя подряд", description: "7 дней подряд в приложении", check: (s) => s.currentStreak >= 7 },
  { id: "words_100", icon: "💯", title: "Сто слов", description: "100 сохранённых слов", check: (s) => s.totalWords >= 100 },
  { id: "first_book", icon: "📖", title: "Первая книга", description: "Дочитан первый текст до конца", check: (s) => s.finishedTexts >= 1 },
  { id: "perfect_session", icon: "⚡", title: "Идеальная сессия", description: "Личный рекорд повторения побит", check: (s) => s.bestSessionCount >= 20 },
];
```

`NEW src/lib/achievements-actions.ts` — `checkAndAwardAchievements(supabase, ownerId)`: считает `AchievementStats` одним `Promise.all` запросов, проходит по `ACHIEVEMENTS`, `insert ... on conflict (owner_id, achievement_id) do nothing` для тех, что уже выполняются и ещё не записаны. Вызывать из **одного** места, куда стекаются все "прогресс-меняющие" действия — проще всего добавить вызов в конец `saveVocabularyItem()` (`src/lib/vocabulary.ts`, уже общая точка для добавления слов из читалки/вручную/из Мозга-в-Тетрадь) и в конец `reviewWord()` (`src/app/(app)/brain/[deckId]/review/actions.ts`), не блокируя основной ответ (fire-and-forget, ошибки логировать, не бросать).

### 5.3 Квест недели

Без отдельной таблицы: считать `count(vocabulary_items where created_at >= <начало текущей ISO-недели>)` для владельца+языка, сравнивать с фиксированной целью (`WEEKLY_QUEST_TARGET = 20`, константа в `achievements.ts`). Если в будущем нужно несколько типов квестов — расширять тогда, не заранее.

### 5.4 UI

`NEW src/app/(app)/progress/achievements-shelf.tsx` — сетка бейджей (полученные — цветные, неполученные — `opacity-30 grayscale`, как в макете плана).
`MODIFY src/app/(app)/progress/page.tsx` — получить `user_achievements` владельца, посчитать квест недели, вызвать `<AchievementsShelf>` + карточку квеста с прогресс-баром + чип "❄️ Заморозка доступна"/"Заморозка использована на этой неделе" (на основе `streak_freeze_available`).

**Критерии готовности:**
- Добавление 100-го слова тут же (после следующего `revalidatePath("/progress")`) показывает бейдж "💯" разблокированным.
- Пропуск ровно одного дня при доступной заморозке не обнуляет `streak_current` — заморозка расходуется один раз в неделю.
- Квест недели показывает реальный прогресс, обнуляется в начале новой ISO-недели.
- `tsc`/`eslint`/`e2e` зелёные (расширить/добавить сценарий, напрямую манипулирующий `last_active_date` через service-role клиент — по аналогии с `restoreTestPassword()` в `e2e/helpers.ts`, чтобы протестировать заморозку без ожидания реальных суток).

---

## 6. Отклик в Мозге и Тетради

**Проблема.** `review-session.tsx` уже неплохо доработан в этой сессии (превью интервала, счётчик сессии, редактирование, отправка в тетрадь — задача #96), но переход между карточками мгновенный, без анимации и без сравнения с личным рекордом. `practice-session.tsx` (Тетрадь) — только кнопки, без свайпа.

**Миграция `0026_review_best.sql`:**
```sql
alter table profiles add column review_best_session_count int not null default 0;
```

### 6.1 Флип-анимация и цветовая вспышка — `MODIFY review-session.tsx`

- Обернуть блок вопрос/ответ в контейнер с `perspective`, переключать класс `rotate-y-180`-подобный (через инлайн `transform: rotateY(...)` и `transition-transform duration-300`) при смене `revealed`. Уважать `prefers-reduced-motion` — оборачивать анимацию в `@media (prefers-reduced-motion: no-preference)` (в Tailwind — через `motion-safe:` варианты классов).
- После `grade()` — на 400–600 мс показать полупрозрачный цветной оверлей (`bg-emerald-500/15` для "Помню"/"Легко", `bg-red-500/15` для "Не помню"/"Трудно") поверх карточки, снять через `setTimeout` перед переходом к следующей.

### 6.2 Личный рекорд

`MODIFY src/app/(app)/brain/[deckId]/review/page.tsx` — подгрузить `profiles.review_best_session_count`, передать в `<ReviewModeSwitcher>` → `<ReviewSession>` новым пропом `bestSessionCount`.
`MODIFY review-session.tsx` — во время сессии сравнивать текущий `tally`-счётчик (сумма всех значений) с `bestSessionCount`, показывать прогресс-бар "Сегодня X · рекорд Y" (как в макете). По завершении сессии (переход в `SessionComplete`) — если текущий счётчик больше сохранённого рекорда, вызвать новый экшен `updateReviewBest(count)` (`review/actions.ts`), который обновляет `profiles.review_best_session_count`, и передать флаг в `SessionComplete`, чтобы показать "Новый личный рекорд!".

### 6.3 Свайп в Тетради — `MODIFY practice-session.tsx`

Добавить к карточке `onPointerDown`/`onPointerMove`/`onPointerUp` (не `touch*`, чтобы работало и мышью, и пальцем): считать `deltaX`, визуально сдвигать карточку (`transform: translateX(...)`) во время движения, при `|deltaX| > 80` на отпускании — вызывать `mark(deltaX > 0)` (свайп вправо = "Знаю", как в макете), иначе — вернуть карточку на место анимацией. **Существующие кнопки не убирать** — свайп добавляется поверх, не вместо (доступность, мышь без свайпа, тестируемость).

**Файлы:**
- `NEW supabase/migrations/0026_review_best.sql`
- `MODIFY src/app/(app)/brain/[deckId]/review/review-session.tsx`
- `MODIFY src/app/(app)/brain/[deckId]/review/page.tsx`
- `MODIFY src/app/(app)/brain/[deckId]/review/actions.ts`
- `MODIFY src/app/(app)/brain/[deckId]/review/session-complete.tsx`
- `MODIFY src/app/(app)/notebook/practice-session.tsx`

**Критерии готовности:**
- Переворот виден визуально (или мгновенная, но окрашенная альтернатива при `prefers-reduced-motion`).
- Побитие личного рекорда сохраняется в БД и видно на экране завершения сессии.
- Свайп в Тетради работает мышью (`pointer` события) и пальцем, кнопки продолжают работать независимо.
- `tsc`/`eslint`/`e2e` зелёные — расширить `brain-notebook.spec.ts` явной проверкой, что программный `pointerdown`→`pointermove`→`pointerup` с достаточным смещением помечает слово так же, как клик по кнопке.

---

## 7. Иллюстрированные пустые состояния

**Проблема.** `src/app/(app)/library/page.tsx` и `src/app/(app)/library/collections/[id]/page.tsx` показывают голый текст ("Пока пусто — добавь свой первый текст" / "В этой коллекции пока нет текстов"). `src/app/(app)/notebook/empty-state.tsx` уже неплохой (эмодзи + текст) — эталон, к которому подтягивать остальные, а не переделывать с нуля.

**Задача.** Один переиспользуемый компонент вместо трёх+ разных мест с разным подходом.

`NEW src/components/empty-state.tsx`:
```tsx
export default function EmptyState({
  icon, title, body, action,
}: { icon: string; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
      <span className="text-6xl">{icon}</span>
      <p className="text-lg font-bold">{title}</p>
      <p className="max-w-xs text-sm text-black/50 dark:text-white/50">{body}</p>
      {action}
    </div>
  );
}
```

Применить (без придумывания новой визуальной системы — это тот же паттерн, что уже есть в Тетради, просто вынесенный и растиражированный):
- `MODIFY src/app/(app)/library/page.tsx` — пустое состояние своих текстов: иконка "📖✨", заголовок "Здесь появятся твои тексты", текст "Добавь первый — и начни читать", кнопка-действие (уже есть плавающая "+", можно продублировать ссылкой внутри пустого состояния).
- `MODIFY src/app/(app)/library/collections/[id]/page.tsx` — аналогично для пустой коллекции.
- `MODIFY src/app/(app)/brain/[deckId]/page.tsx` — пустая колода без карточек (сверить текущий текст, привести к общему виду).
- `MODIFY src/app/(app)/notebook/empty-state.tsx` — либо оставить как локальную обёртку над общим компонентом (`export default function EmptyState(props) { return <SharedEmptyState {...props} icon={...} /> }`), либо заменить импорт в `notebook/page.tsx` напрямую на общий компонент и удалить локальный файл — решить по месту, не ломая существующие пропы (`filtered?: boolean`).

**Критерии готовности:** ни одного "голого" однострочного пустого состояния в приложении — везде иконка + заголовок + тёплая формулировка. `tsc`/`eslint` чистые, живая проверка каждого затронутого экрана.

---

## 8. Первые 5 минут — онбординг с полным циклом

**Проблема.** `src/app/onboarding/actions.ts` → `completeOnboarding()` создаёт аккаунт и сразу `redirect("/home")` (строка 87). Человек оказывается в пустом приложении без единой подсказки, что делать дальше.

**Миграция `0023_first_win_flag.sql`** (делать первой по номеру, но реализовывать последней по порядку — см. раздел 2):
```sql
alter table profiles add column completed_first_win boolean not null default false;
-- существующие профили не должны увидеть туториал задним числом:
update profiles set completed_first_win = true;
alter table profiles alter column completed_first_win set default false;
```
(Порядок важен: сначала выставить `true` всем существующим, потом сменить дефолт на `false` — иначе `update` перезапишет дефолтом ещё до того, как встанет `alter column set default`.)

### 8.1 Редирект после регистрации

`MODIFY src/app/onboarding/actions.ts` — заменить `redirect("/home")` на `redirect("/onboarding/first-win")`.

### 8.2 Экран-мастер трёх шагов

`NEW src/app/(app)/onboarding/first-win/page.tsx` (server component) — если `profile.completed_first_win` уже `true` (защита от повторного захода по прямой ссылке), сразу `redirect("/home")`. Иначе — подтянуть 3–4 самых коротких системных текста (`order by word_count asc limit 4`, из пула, созданного в разделе 4) и передать в клиентский компонент.

`NEW src/app/(app)/onboarding/first-win/first-win-flow.tsx` (client component), локальный `step` state:

- **Шаг A — выбор текста.** Плитки 3–4 коротких текстов (переиспользовать стиль обложек из `text-cover.ts`). Клик → переход к шагу B с `textId`.
- **Шаг B — мини-чтение.** Переиспользовать существующий ридер (`/read/[textId]` уже умеет тап-по-слову-в-словарь) **или**, чтобы не тащить туда специальный туториальный режим — встроить упрощённую версию прямо в `first-win-flow.tsx`: показать текст статично, разрешить тап по словам (та же логика сохранения, что в читалке, дернуть тот же server action сохранения слова), с плашкой-прогрессом "0/3 слова сохранено" сверху, авто-переход на шаг C по достижении 3.
- **Шаг C — одна карточка.** Взять последнее из трёх только что сохранённых `vocabulary_items`, показать как одиночную "карточку" (не через полноценный `srs_state`/`flashcards` — это же слово из Тетради, не колода Мозга; достаточно локального UI: слово → "Показать перевод" → одна кнопка "Понял(а)", без записи в SRS, это чисто демонстрационный шаг).
- **Шаг D — праздник.** "🎉 Ты прошёл весь цикл!" + краткое "Вот что ты только что сделал: прочитал, сохранил слово, повторил его" + кнопка "На Главную", вызывающая новый экшен `completeFirstWin()` (`src/app/(app)/onboarding/first-win/actions.ts`, `"use server"`, выставляет `profiles.completed_first_win = true`), затем `router.push("/home")`.

**Важно:** этот флоу физически находится в группе `(app)` (требует активной сессии — аккаунт к этому моменту уже создан на шаге 5 обычного визарда), а не в `src/app/onboarding/` (та часть — до создания аккаунта). Свериться с `src/middleware.ts`/схемой роутинга, как разграничены группы `(app)` и `onboarding`, прежде чем создавать файл — по описанию сессии, `(app)` группа уже требует `requireProfile()`, что здесь и нужно.

**Файлы:**
- `NEW supabase/migrations/0023_first_win_flag.sql`
- `MODIFY src/app/onboarding/actions.ts`
- `NEW src/app/(app)/onboarding/first-win/page.tsx`
- `NEW src/app/(app)/onboarding/first-win/first-win-flow.tsx`
- `NEW src/app/(app)/onboarding/first-win/actions.ts`

**Критерии готовности:**
- Свежая регистрация → сразу на `/onboarding/first-win`, не на `/home`.
- Прямой заход на `/onboarding/first-win` уже прошедшим его пользователем → мгновенный редирект на `/home`.
- Полный цикл (текст → 3 слова → 1 карточка → праздник) проходится без ошибок и заканчивается на `/home`.
- Существующие (созданные до этой миграции) пользователи не видят туториал при следующем логине.
- `tsc`/`eslint`/`e2e` зелёные + новый `e2e/onboarding-first-win.spec.ts`, полностью проходящий флоу от регистрации до `/home`.

---

## 9. Умные уведомления

**Проблема.** `src/app/api/cron/push-reminders/route.ts` шлёт один из двух одинаковых текстов всем подписчикам разом, по расписанию из `vercel.json` (сверить текущее расписание перед правкой — если крон сейчас ежедневный, менять на ежечасный, см. ниже).

**Миграция `0027_notify_hour.sql`:**
```sql
alter table profiles add column preferred_notify_hour smallint; -- null = ещё не посчитано, использовать дефолт
```

### 9.1 Вычисление предпочитаемого часа

`NEW src/lib/notify-timing.ts`:
```ts
export async function computePreferredHour(supabase: SupabaseServerClient, ownerId: string): Promise<number> {
  const { data } = await supabase
    .from("review_log")
    .select("created_at, flashcards!inner(owner_id)")
    .eq("flashcards.owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (!data || data.length < 10) return 19; // дефолт, пока данных мало
  const buckets = new Array(24).fill(0);
  for (const row of data) buckets[new Date(row.created_at).getUTCHours()]++;
  return buckets.indexOf(Math.max(...buckets));
}
```
Пересчитывать раз в неделю (внутри самого крона, лениво: если `preferred_notify_hour is null` или прошло 7+ дней с последнего пересчёта — посчитать и сохранить; отдельный `preferred_notify_hour_updated_at` можно не заводить, если пересчёт достаточно дешёвый, чтобы гонять его каждый прогон крона для активных пользователей — решить по факту нагрузки).

### 9.2 Расписание и фильтрация

`MODIFY vercel.json` (или где сейчас настроен cron) — расписание с ежедневного на ежечасное (`0 * * * *`).
`MODIFY src/app/api/cron/push-reminders/route.ts` — для каждого `ownerId` сначала проверить `preferred_notify_hour` (или дефолт 19), пропускать пользователя, если текущий UTC-час не совпадает — **и только тогда** выполнять существующие запросы (due-count/streak), чтобы не увеличивать нагрузку на БД впустую для всех остальных 23 часов.

### 9.3 Более тёплый текст

Перед отправкой due-count-уведомления — проверить, есть ли `text_progress` с `percent_read` между 5 и 95 (как в разделе 3), и если есть — использовать "«{title}» ждёт — осталось {100-percent}%" вместо текущего generic "У тебя N карточек к повторению". Приоритет остаётся прежним: due-cards важнее стрика, стрик важнее чтения (не отправлять больше одного пуша за прогон).

**Файлы:**
- `NEW supabase/migrations/0027_notify_hour.sql`
- `NEW src/lib/notify-timing.ts`
- `MODIFY src/app/api/cron/push-reminders/route.ts`
- `MODIFY vercel.json` (расписание крона)

**Критерии готовности:**
- Крон, запущенный вручную (или через `vercel dev`/тестовый вызов) в определённый час, шлёт только пользователям с совпадающим `preferred_notify_hour` (или дефолтным 19, если данных недостаточно).
- Текст уведомления упоминает конкретное название текста, когда есть незаконченное чтение.
- `tsc`/`eslint` чистые; ручная проверка через прямой вызов эндпоинта с `CRON_SECRET` (как уже делалось раньше в этой сессии для верификации крона).

---

## 10. Финальная проверка после ВСЕХ разделов

Не деплоить по одному разделу в продакшн, если только пользователь явно не попросит поэтапный деплой — по умолчанию: реализовать всё по порядку из раздела 2 внутри одной рабочей сессии (как задачи #93–99), затем одним финальным проходом:

1. `npx tsc --noEmit` — весь проект.
2. `npx eslint src --ext .ts,.tsx` — весь проект.
3. Живой обход в браузере: регистрация нового пользователя от начала до `/home` через новый онбординг, Главная, Библиотека (обложки + текст дня), одна сессия повторения в Мозге (флип + рекорд), Тетрадь (свайп), Достижения/квест/заморозка, пустые состояния — каждое лично посмотреть, не только по коду.
4. `npx playwright test` — 9+ passed (с учётом новых спеков), 1 skipped, без регрессий.
5. `git add` только изменённых файлов → commit(ы) с понятными сообщениями по каждому направлению (можно один большой коммит на весь план или семь отдельных — решить по объёму диффа, предпочтительно отдельные коммиты на раздел, как делалось для задач #93–99).
6. Применить миграции `0023`–`0027` к продакшн Supabase по порядку через Management API.
7. `git push origin main`.
8. `npx vercel deploy --prod --yes`.
9. Финальная проверка на `lexreader.vercel.app` живым пользователем (не тестовым скриптом) — минимум: онбординг, Главная, одна сессия повторения.

## 11. Явно вне рамок этого промта

- Всё из части 1 (ИИ-собеседник, ИИ-дневник, лиги, друзья) — отклонено пользователем, не реализовывать.
- Контент Библиотеки на языках, отличных от английского — отдельная задача после того, как английский пул (раздел 4) себя оправдает.
- Полноценная система множества квестов разных типов — раздел 6.3 сознательно ограничен одним типом квеста ("слов за неделю"), не строить общий "движок квестов" заранее.
