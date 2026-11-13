# LexReader — Ultimate Design System · бриф для авторов экранов

> **Исторический документ** (бриф авторам экранов, Ultimate-проход 2026-11-12). Пути приведены к `design/ultimate/`; упоминаемые эталонные скриншоты (`shots/…`, `screens-v8/…`) в git не хранятся — их можно пересоздать `tools/audit.mjs`. Актуальное описание процесса — `README.md`.

Ты — senior product designer. Задача: довести назначенную пачку экранов LexReader (мобильное приложение для изучения английского через чтение) до уровня лучших экранов библиотеки. Интерфейс на русском, учебный контент на английском.

## Эталон качества
Утверждённые эталоны (не редактировать, только смотреть): `design/ultimate/shots/v9a/light/Main.png`, `Library.png`, `Reader.png`, `Progress.png`, `Lesson-choice.png`, `Result.png`, `Streak-calendar.png`, `Review-due.png`, `Profile.png`. Экраны на новом ките (образцы кода + скриншоты): `src/Brain-home.html`, `src/Flashcard-answer.html`, `src/AI-tutor-chat.html` → `shots/t1/light/*.png`, `shots/t1/dark/*.png`. **Обязательно открой 4–5 эталонных PNG и все три образца кода до начала работы.**
Старые версии твоих экранов (то, что надо превзойти): `shots/v8/light/<Name>.png`, исходник `screens-v8/<Name>.dc.html`. Они полупустые, с эмодзи, без иерархии — это НЕ ориентир по качеству, только источник контента.

Что отличает эталон: плотная, но воздушная композиция на всю высоту 844px (нет пустой нижней половины); один явный визуальный фокус; «пухлые» кнопки с нижней гранью; карточки с рамкой 2px; маскот-капля Lex в ключевых моментах; заголовки Unbounded, текст Onest, английский текст для чтения — Literata; реальные правдоподобные данные; понятное главное действие внизу.

## Формат файла
Пиши ФРАГМЕНТ в `design/ultimate/src/<Name>.html` (через Bash heredoc `cat > … <<'EOF'`, не через Write — так быстрее):
```
<!--meta {"title":"Человеческое название"}-->        (для PLANNED: {"title":"…","planned":true}; desktop: {"title":"…","w":1280,"h":800}; tablet: {"w":834,"h":1112})
<style> …только уникальные для экрана правила (иллюстрация, особая сетка)… </style>   (необязательно)
<div class="app"> … </div>
```
Обёртку (head, шрифты, CSS, theme.js) добавляет сборщик. Не пиши `<html>`, `<head>`, `<script>`.

## Цикл работы (обязателен для КАЖДОГО экрана)
```
cd design/ultimate
python3 tools/view.py <ТВОЙ_ТЕГ> Name1 Name2 Name3      # собирает, проверяет, печатает дефекты, пишет shots/<тег>/view-N.png
```
Затем **открой view-N.png через Read и посмотри глазами** светлую и тёмную версии. Исправь всё, что нашёл скрипт (`clipped`, `contrast`, `small`, `tap`, `hex`, `hscroll`) и всё, что видишь сам (пустоты, наезды, обрезанный текст, слабая иерархия, кривые переносы). Повторяй до чистого результата. `dead` на экраны из списка «Допустимые ссылки» — норма (их делает другой автор). Работай пачками по 3 экрана.

## Каркас экрана (flex-колонка, ничего не позиционируй абсолютом, кроме оверлеев)
```
<div class="app">
  <header class="hdr"> <a class="iconbtn" href="X.dc.html" aria-label="Назад"><i class="ic ic-back s24"></i></a> <div class="ttl">Заголовок<small>подзаголовок</small></div> <a class="iconbtn" …>…</a> ИЛИ <span class="gap"></span> </header>
  <main class="body"> …контент, gap 12px, скроллится… </main>
  <footer class="dock"> <a class="btn b-leaf" href="…">Главное действие</a> <a class="link2" href="…">Вторичное</a> </footer>
  ИЛИ <nav class="tabbar">…</nav> (только на 5 корневых экранах и их прямых списках)
</div>
```
Варианты шапки: `.pagehead` (крупный h1 слева + действия справа — корневые экраны), `.hdr` (назад + заголовок по центру), `.lessonbar` (крестик + прогресс — упражнения), `.top` (свободная).
Высота фиксирована 844px: `.body` — единственная прокручиваемая зона. Первый экран (без прокрутки) должен быть цельной композицией. Если контента мало — увеличивай главный блок/иллюстрацию и используй `.grow`, а не оставляй пустоту; если много — пусть уходит в прокрутку, но dock/tabbar всегда видны.

Таббар (копируй дословно, меняй только `on`):
```
<nav class="tabbar" aria-label="Основная навигация">
  <a class="tab" href="Main.dc.html"><i class="ic ic-home"></i>Сегодня</a>
  <a class="tab" href="Library.dc.html"><i class="ic ic-library"></i>Библиотека</a>
  <a class="tab" href="Brain-home.dc.html"><i class="ic ic-cards"></i>Практика</a>
  <a class="tab" href="Progress.dc.html"><i class="ic ic-chart"></i>Прогресс</a>
  <a class="tab" href="Profile.dc.html"><i class="ic ic-user"></i>Профиль</a>
</nav>
```
Активная вкладка: `class="tab on" aria-current="page"`.

## Кит (lex-ui.css) — используй ТОЛЬКО эти классы и токены
Полный источник: `design/ultimate/ds/ui-core.css` (прочитай целиком — 200 строк) и `ds/tokens-v9.css`.
- Раскладка: `.stack(.s4/.s8/.s16)`, `.rowx(.s6/.s8/.top/.between/.wrap)`, `.grid2/.grid3/.grid4`, `.hscroll`, `.f1`, `.grow`, `.center`, `.mla`, `.mta`.
- Текст: `.h1 .h2 .h3 .lead .sm .xs .b .sb .muted .faint .num(.xl/.lg/.sm) .eyebrow .sect .read .en .mono .strike .hl/.hl-g/.hl-b/.hl-r`, цветной текст `.c-green .c-blue .c-gold .c-orange .c-red`.
- Кнопки: `.btn` + `.b-leaf` (главное), `.b-sky` (повторение/SRS), `.b-ember` (стрик/срочное), `.b-sun` (награды/Plus), `.b-red` (ошибка/удаление), `.b-ink`, `.b-ghost` (вторичное), `.b-white` (на цветном фоне); `.sm`, `.fit`, `[disabled]`; `.link2`; `.iconbtn(.box)`; `.fab`.
- Поверхности: `.card(.p0/.lg/.sm/.press/.on/.dash/.sunk/.t-green/.t-blue/.t-gold/.t-orange/.t-red)`, `.hero(.sky/.ember/.sun/.ink)`, `.list > .row` (внутри `.t` заголовок, `.s` подпись, `.v` значение), `.sw` иконка-плашка (`.green .blue .gold .orange .red`, сплошные `.s-green .s-blue .s-gold .s-ember .s-ink`, `.lg .sm .round`), `.stat(.t-green…)`, `.cover(.md/.lg/.c-gold/.c-green/.c-sky/.c-ember/.c-ink/.c-sand/.c-teal/.video)`, `.avatar(.sm/.lg/.xl/.a1…a6/.me)`.
- Метки: `.chip(.on/.sm/.word)`, `.seg > .on`, `.badge(.green/.blue/.gold/.orange/.red/.solid/.ink/.soon/.plus)`, `.count`, `.pill(.streak/.xp)`, `.dots > i.on`, `.cefr`.
- Формы: `.label`, `.field(.focus/.err/.ok/.area/.dis)` + `.ph` плейсхолдер + `.caret`, `.hint(.err/.ok)`, `.toggle(.on)`, `.radio(.on)`, `.check(.on)`, `.opt(.on/.ok/.bad/.dim)` с `.k`, `.tile(.slot)`.
- Прогресс: `.bar(.lg/.sm/.gold/.blue/.red/.ember) > i[style=width]`, `.steps > i.on`, `.spin(.sm)`, `.skel`.
- Оверлеи: `.scrim` + `.sheet` / `.modal`, `.toast(.bottom)`, `.banner(.info/.ok/.warn/.err/.ai)`, `.feedback(.ok/.bad)`, `.empty`, `.bubble(.me)`, `.say`.
- Иконки (маска, цвет = currentColor): `<i class="ic ic-NAME s24"></i>`, размеры s14 s16 s18 (20 по умолчанию) s24 s28 s32 s40 s48. Имена — в `ds/icon-names.txt`. Других иконок нет; inline-SVG — только для иллюстраций/графиков.
- Маскот: `<i class="lex happy"></i>` — настроения `happy wink joy sad sleep think wow cool`, `pale` (светлый, для цветного фона), `ghost` (серый); размеры `s40 s56 s88 s120 s160`; `bob` — покачивание.
- Полноцветный экран: `<div class="app on-leaf|on-sky|on-ember|on-sun|on-night">` — только для праздничных/ключевых моментов.
- Цвет: только токены (`var(--green-400)`, `var(--fill-sky)`, `var(--text-2)`, `var(--surface-card)`…). **Никаких hex в разметке и в `<style>`**, кроме `#fff`/`#1a1a1a` для текста на сплошной заливке. Сплошной фон под белый текст — только `--fill-leaf/--fill-sky/--fill-ember/--fill-red/--fill-ink` (под тёмный текст — `--fill-sun`). Фиолетового нет вообще. Эмодзи запрещены.
- Смысл цвета: зелёный — основное/прогресс/успех; синий — повторение, память, информация; оранжево-красный — стрик, срочность; жёлтый — XP, награды, Plus; красный — ошибки/опасные действия; тёмно-зелёный «ink» + жёлтая искра — ИИ/PLANNED.

## Правила качества
1. Мин. размер текста 11px; подписи 12–13.5px; основной 15px. Контраст ≥ 4.5:1 в ОБЕИХ темах (скрипт проверяет).
2. Любой кликабельный элемент ≥ 44px по высоте (чипы 36 допустимы).
3. Каждый экран: понятно где я (заголовок), что главное (одно первичное действие), как уйти (назад/закрыть ведёт на логичный родительский экран).
4. Все `href` — только на `<Name>.dc.html` из списка ниже. Никаких `#`. Некликабельное оформляй `<div>/<span>/<button>`.
5. Данные согласованы между экранами (см. «Мир продукта»). Никаких Lorem/placeholder.
6. Состояния показывай внутри экрана там, где уместно (выбранный чип, поле с ошибкой, disabled-кнопка, частично заполненный прогресс, locked-элемент с `.lock` + `ic-lock`).
7. PLANNED-экраны: `"planned":true` в meta (сборщик добавит метку) — и НЕ изображай функцию как уже работающую в тексте документации; сам UI рисуй полноценно.
8. Не копируй композицию «шапка + три строки + пустота». Используй сильный первый блок (hero/иллюстрация/число), затем вторичные секции с `.sect`-заголовками.
9. Доступность: `aria-label` у иконок-кнопок, `aria-current` у активной вкладки, осмысленные `alt/role` у графиков (`role="img" aria-label="…"`).

## Мир продукта (держи согласованность)
Пользователь: Сергей, уровень B1, учит английский, родной русский. Стрик 12 дней (рекорд 21), 1 240 XP всего, цель дня 50 XP, уровень аккаунта 7. Знает 842 слова; на повторении сегодня 47 карточек. Читает «The Last Lighthouse» (глава 3 из 5, 64%), видео «Life in London». Другие материалы: Treasure Island (B1), Travel English Basics (A2–B1), Tech News Weekly (B1–B2), A Week in Kyoto, Lost in Lisbon. Слова-примеры: reluctant, refuge, spiral, restless, beacon, gale, shore. Слабая тема: Present Perfect vs Past Simple. Друзья: Аня (общий стрик 9 дней), Макс, Лена, Дима. Лига недели: 4 место, 310 XP. Тариф: Free (3 текста, лимиты) / LexReader Plus 399 ₽/мес или 299 ₽/мес при оплате за год (3 588 ₽).

## Честность про функциональность (важно)
- РЕАЛЬНО в коде: чтение текстов и YouTube-видео с субтитрами (локальный Whisper), перевод слов (MyMemory), словарь и SRS-карточки (FSRS) «Мозг», учебные пути, миссии, стрик/заморозки, XP/уровни/достижения, дневные задания и сундук, недельный рейтинг, дуэли 1-на-1 по ссылке (Realtime), общий стрик с другом по ссылке-приглашению, «Мой английский» (Language Twin — правила, БЕЗ ИИ), Stripe-подписка, push-напоминания, браузерное расширение, экспорт данных.
- НЕТ в коде (PLANNED): любой LLM/ИИ-репетитор, распознавание речи/произношение, список друзей/поиск людей/группы/лента, магазин/валюта/косметика маскота/сезонный пропуск, жанры и каталог с избранными текстами, командные испытания.
В «Мой английский» всегда подчёркивай: оценка по правилам, без ИИ и без отправки текстов наружу.

## Допустимые ссылки (все экраны библиотеки)
- **Онбординг и вход**: Splash, Onboarding-why, Interests-pick, Goal-pick, Placement-question, Placement-result, First-text, Signup, Login, Magic-link-sent, Reset-password, Reset-password-confirm
- **Сегодня**: Main, Today-evening, Today-new, Today-done, Welcome-back, Week-recap
- **Библиотека и контент**: Library, Library-empty, Catalog, Genre, Text-detail, Search-results, Collections, Collection-detail, Favorites, Reading-history, Reading-goal, Import-hub, Import-text, Import-youtube, Import-processing
- **Чтение и видео**: Reader, Reader-phrase, Reader-settings, Watch, Chapter-done
- **Занятие**: Lesson-start, Lesson-choice, Lesson-build, Lesson-listen, Combo, Halfway, Mistakes, Quit-confirm, Result, Perfect, Goal-done
- **Упражнения и грамматика**: Grammar-hub, Grammar-lesson, Match-pairs, Fill-blank, Listening-exercise, Writing-exercise, Speaking-exercise
- **Учебная программа**: Curriculum, Unit-overview, Level-map, Study-plan, Course-pick, Skill-check, Unit-done, Mission-detail, Mission-history
- **Мозг · словарь и SRS**: Brain-home, Deck-detail, Deck-import, Card-edit, Flashcard-review, Flashcard-answer, Flashcard-mc, Flashcard-type, Review-modes, Review-done, Brain-caught-up, Review-due, Hard-words, Word-detail, Word-mastered, Words-learned, Brain-stats, Brain-settings
- **Мой английский · Language Twin**: Twin-home, Twin-empty, Twin-diagnostic, Twin-correction, Twin-patterns, Twin-pattern-detail, Twin-evidence, Twin-timeline, Twin-recommendations, Twin-settings, Twin-insight
- **ИИ-репетитор · PLANNED**: AI-hub, AI-tutor-chat, AI-explain, AI-writing-check, AI-writing-result, AI-speaking, AI-speaking-result, AI-pronunciation, AI-generate, AI-recommend
- **Стрик**: Streak-up, Streak-30, Streak-calendar, Streak-commit, Freeze-used, Earn-back, Perfect-week
- **Награды и задания**: Level-up, Achievement, Achievements-gallery, Achievement-detail, Milestones, Daily-quests, Quest-board, Chest, Double-XP, Goal-edit
- **Лиги и экономика**: Weekly-rank, Overtaken, League-table, League-result, Season-pass, Shop, Mascot-closet, Challenge-weekly
- **Друзья и дуэли**: Friends-list, Add-friends, Friend-profile, Friend-invite-share, Friend-invite-accept, Friend-streak, Activity-feed, Groups-hub, Group-detail, Duel-create, Duel-invite, Duel-live, Duel-won, Duel-lost, Share-card
- **Прогресс и аналитика**: Progress, Stats-detail, Skill-breakdown, Learning-history, Weekly-report, Time-spent
- **Профиль и настройки**: Profile, Profile-edit, Account-settings, Notification-settings, Data-privacy, Extension-connect, Help-support, Help-article, Whats-new, Delete-account
- **Подписка**: Pricing-plans, Paywall-offer, Limit-reached, Subscription, Purchase-success, Payment-failed, Cancel-subscription
- **Система и состояния**: Loading-state, Empty-state, Error-state, Offline, Not-found, Session-expired, Notify-ask, Rate-app
- **Desktop и Tablet**: D-Today, D-Library, D-Reader, D-Watch, D-Practice, D-Lesson, D-Progress, D-Settings, T-Today, T-Library, T-Reader

Ссылка = `<Name>.dc.html`.
