# LexReader — Ultimate Design System (исходники)

Источник истины для макетов: 186 экранов в 19 разделах, светлая и тёмная тема, mobile / tablet / desktop.
Опубликованная версия — Artifact «LexReader — Ultimate Design System»
(<https://claude.ai/code/artifact/4c6ee007-9b1f-4b28-b7dd-87395937c892>). Документация:
[`docs/product/lexreader-ultimate-design-system.md`](../../docs/product/lexreader-ultimate-design-system.md),
реестр экранов — [`docs/product/lexreader-ultimate-screen-registry.md`](../../docs/product/lexreader-ultimate-screen-registry.md),
перенос в приложение — [`docs/product/lexreader-phase2-plan.md`](../../docs/product/lexreader-phase2-plan.md).

## Что здесь лежит

| Путь | Что | В git |
|---|---|---|
| `src/` | 140 экранов-фрагментов (`<!--meta {...}-->` + `<style>` + `<div class="app">`) — редактируются руками | да |
| `core/` | 46 экранов ядра (`*.dc.html`) с сохранённой композицией — редактируются руками, генератора у них нет | да |
| `ds/` | `tokens-v9.css`, `ui-core.css` (компоненты), `palette-v8.css` (утверждённая палитра), `theme.js`, `icon-names.txt` | да |
| `tools/` | сборка, аудит, ссылки, галерея, справочник, генерация документов | да |
| `specs/`, `BRIEF.md` | бриф и спецификации по пачкам экранов (исторические; пути актуализированы) | да |
| `cats.json`, `registry.json` | порядок разделов; реестр экранов (статус «реально/частично/planned», маршрут, состояния) — **данные, правятся руками** | да |
| `dist/` | результат сборки (то, что публикуется в Artifact) | **нет** (генерируется) |
| `build/` | отчёты аудита, скриншоты, граф ссылок | **нет** (генерируется) |

Скриншоты, устаревшие версии (v7/v8), генераторы прежних этапов и временные файлы в репозиторий намеренно не включены.

## Как работать (из корня репозитория)

```bash
npm run design:build            # dist/: токены+компоненты → экраны → галерея → справочник
npm run design:serve            # статика на http://127.0.0.1:8742 (в отдельном терминале)
node design/ultimate/tools/audit.mjs                 # все 186 экранов × 2 темы → build/shots/final + report.json
node design/ultimate/tools/audit.mjs dist build/shots/x Login,Signup
python3 design/ultimate/tools/view.py <тег> Name1 Name2   # собрать + проверить + контактный лист
python3 design/ultimate/tools/linkcheck.py           # битые ссылки, сироты, тупики → build/navgraph.json
python3 design/ultimate/tools/build_docs.py          # регенерировать docs/product/lexreader-ultimate-*.md
```

Аудит (`audit.mjs`) проверяет в обеих темах: текст за пределами кадра, контраст WCAG AA по каждому узлу, текст < 11 px, зоны нажатия, горизонтальную прокрутку, JS-ошибки/404, ссылки `#` и на несуществующие экраны, зашитые hex-цвета. Зависимость: Playwright из корневого `node_modules`, Chromium (`npx playwright install chromium`), Pillow для листов (`view.py`, `sheets.py`).

## Правила

1. Только токены и классы кита `ds/ui-core.css`; hex допустимы только `#fff`/`#1a1a1a` на сплошной заливке. Белый текст — только на `--fill-*`; цветной — только `--*-text`.
2. Данные в макетах — вымышленный, но согласованный «мир продукта» (Сергей, B1, стрик 12, 842 слова). Реальных персональных данных (email, имена людей) в файлах быть не должно — используйте `@example.com`.
3. Статус функциональности в `registry.json` честный: `PLANNED` — backend отсутствует; такие экраны помечаются `"planned": true` в `meta` и не переносятся в приложение как рабочие.
4. Меняете экран ядра — правьте `core/<Name>.dc.html`; остальные — `src/<Name>.html`; затем `design:build` и `audit.mjs`.

## Публикация в Artifact

`dist/index.html` публикуется инструментом Artifact с `url` = ссылка выше (иначе создастся новый артефакт), `root` = `design/ultimate/dist`, `files` — объект-карта всех файлов `dist/` кроме `index.html` (не массив: массив ограничен 64 файлами, а их ~190).
