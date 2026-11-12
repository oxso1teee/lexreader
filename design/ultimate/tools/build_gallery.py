#!/usr/bin/env python3
"""Builds dist/index.html (the Artifact page) from cats.json + registry.json."""
import json, pathlib, html
R = pathlib.Path(__file__).resolve().parent.parent
cats = json.load(open(R/'cats.json'))
reg = {r['name']: r for r in json.load(open(R/'registry.json'))}
have = {p.stem.replace('.dc','') for p in (R/'dist').glob('*.dc.html')}
STATUS = {'IMPLEMENTED': ('Реально', 'ok'), 'PARTIAL': ('Частично', 'part'), 'PLANNED': ('Planned', 'plan')}
groups, total = [], 0
for cat, names in cats:
    cards = []
    for n in names:
        if n not in have: continue
        r = reg.get(n, {}); st = r.get('status', 'IMPLEMENTED'); lab, cls = STATUS[st]
        w, h = r.get('w', 390), r.get('h', 844)
        size = 'desk' if w > 1000 else ('tab' if w > 600 else '')
        cards.append(f'<a class="card {size}" href="{n}.dc.html" data-status="{st}"><span class="frame"><iframe src="{n}.dc.html" tabindex="-1" loading="lazy" title="{html.escape(r.get("title", n))}"></iframe></span><span class="cap"><b>{html.escape(r.get("title", n))}</b><span class="meta"><i class="st {cls}">{lab}</i>{html.escape(r.get("route", "") or "")}</span></span></a>')
        total += 1
    groups.append(f'<section class="group" id="g{len(groups)+1}"><h2><span class="count">{len(cards):02d}</span>{html.escape(cat)}</h2><div class="grid">{"".join(cards)}</div></section>')
nav = ''.join(f'<a href="#g{i+1}">{html.escape(c)}<span>{sum(1 for n in ns if n in have)}</span></a>' for i, (c, ns) in enumerate(cats))
impl = sum(1 for n in have if reg.get(n, {}).get('status', 'IMPLEMENTED') == 'IMPLEMENTED'); part = sum(1 for n in have if reg.get(n, {}).get('status') == 'PARTIAL'); plan = sum(1 for n in have if reg.get(n, {}).get('status') == 'PLANNED')
page = f'''<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>LexReader — Ultimate Design System</title>
<script src="theme.js"></script>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700;800&family=Unbounded:wght@500;600;700;800&display=swap">
<link rel="stylesheet" href="design-system.css">
<style>
:root{{--gallery-gold:#a9780a;--card-shadow:rgba(26,22,14,.14)}}
@media (prefers-color-scheme:dark){{:root:not([data-theme="light"]){{--gallery-gold:#f0b429;--card-shadow:rgba(0,0,0,.45)}}}}
:root[data-theme="dark"]{{--gallery-gold:#f0b429;--card-shadow:rgba(0,0,0,.45)}}
*{{box-sizing:border-box}}html,body{{margin:0}}html{{overflow-x:clip}}.frame{{contain:paint}}
body{{background:var(--bg);color:var(--text-primary);font-family:var(--font-body);-webkit-font-smoothing:antialiased}}
a{{color:var(--accent)}}
a:focus-visible,.card:focus-visible{{outline:3px solid var(--gold-500);outline-offset:3px;border-radius:10px}}
.page{{max-width:1240px;margin:0 auto;padding:48px 28px 96px}}
.masthead{{display:flex;flex-direction:column;gap:14px;padding-bottom:28px;border-bottom:1px solid var(--border-soft);margin-bottom:28px}}
.masthead .top{{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;flex-wrap:wrap}}
.eyebrow{{font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--gallery-gold);margin:0 0 8px}}
h1{{font:700 clamp(28px,4vw,44px)/1.1 var(--font-display);margin:0;letter-spacing:-.01em}}
.masthead p{{font-size:15px;line-height:1.6;color:var(--text-secondary);max-width:70ch;margin:0}}
.kpis{{display:flex;gap:10px;flex-wrap:wrap;margin-top:6px}}
.kpi{{background:var(--surface);border:1px solid var(--border-soft);border-radius:14px;padding:10px 14px;min-width:120px}}
.kpi b{{display:block;font:700 22px/1 var(--font-display)}}.kpi span{{font-size:12px;color:var(--text-secondary)}}
.themeswitch{{display:flex;gap:6px;flex:none}}
.themeswitch button{{font-size:12.5px;font-weight:600;padding:8px 14px;border-radius:999px;border:1px solid var(--border);background:var(--surface);color:var(--text-secondary);cursor:pointer;font-family:inherit}}
.themeswitch button.on{{border-color:var(--accent);background:var(--nav-active-bg);color:var(--nav-active-fg)}}
.toc{{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 36px}}
.toc a{{font-size:12.5px;font-weight:600;color:var(--text-primary);text-decoration:none;background:var(--surface);border:1px solid var(--border-soft);border-radius:999px;padding:6px 12px;display:inline-flex;gap:6px;align-items:center}}
.toc a span{{color:var(--accent);font-variant-numeric:tabular-nums}}
.filters{{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 28px;align-items:center;font-size:12.5px;color:var(--text-secondary)}}
.filters button{{font:600 12.5px/1 var(--font-body);padding:7px 12px;border-radius:999px;border:1px solid var(--border);background:var(--surface);color:var(--text-secondary);cursor:pointer}}
.filters button.on{{border-color:var(--accent);background:var(--nav-active-bg);color:var(--nav-active-fg)}}
.group{{margin-bottom:48px;scroll-margin-top:24px}}
.group h2{{display:flex;align-items:baseline;gap:12px;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin:0 0 18px}}
.group h2 .count{{font-variant-numeric:tabular-nums;color:var(--accent);background:var(--green-100);border-radius:6px;padding:2px 7px;font-size:12px}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,168px);gap:22px 18px}}
.card{{display:flex;flex-direction:column;gap:9px;text-decoration:none;color:var(--text-primary);width:168px}}
.card .frame{{display:block;width:168px;height:363px;border-radius:20px;overflow:hidden;background:var(--surface);box-shadow:0 1px 2px var(--card-shadow),0 10px 24px -14px var(--card-shadow);border:1px solid var(--border-soft);transition:transform .15s ease,box-shadow .15s ease;position:relative}}
.card:hover .frame,.card:focus-visible .frame{{transform:translateY(-3px);box-shadow:0 2px 4px var(--card-shadow),0 18px 32px -16px var(--card-shadow)}}
.card iframe{{width:390px;height:844px;border:0;transform:scale(.4307);transform-origin:top left;pointer-events:none}}
.card.tab{{width:352px}}.card.tab .frame{{width:352px;height:469px;border-radius:16px}}.card.tab iframe{{width:834px;height:1112px;transform:scale(.4221)}}
.card.desk{{width:354px}}.card.desk .frame{{width:354px;height:221px;border-radius:12px}}.card.desk iframe{{width:1280px;height:800px;transform:scale(.2766)}}
.grid:has(.desk),.grid:has(.tab){{grid-template-columns:repeat(auto-fill,354px)}}
.card .cap{{font-size:13px;line-height:1.35;color:var(--text-primary);display:flex;flex-direction:column;gap:3px}}
.card .cap b{{font-weight:700}}
.card .meta{{display:flex;gap:6px;align-items:flex-start;font-size:11px;color:var(--text-secondary);font-family:ui-monospace,monospace;min-width:0;flex-wrap:wrap;overflow-wrap:anywhere;word-break:break-word}}.card .cap{{min-width:0}}
.st{{font:700 10px/1 var(--font-body);letter-spacing:.06em;text-transform:uppercase;padding:3px 6px;border-radius:5px;font-style:normal}}
.st.ok{{background:var(--green-100);color:var(--green-700)}}.st.part{{background:var(--blue-100);color:var(--blue-700)}}.st.plan{{background:#1f2a22;color:#ffd43d}}
body[data-filter="IMPLEMENTED"] .card:not([data-status="IMPLEMENTED"]),body[data-filter="PLANNED"] .card:not([data-status="PLANNED"]),body[data-filter="PARTIAL"] .card:not([data-status="PARTIAL"]){{display:none}}
footer{{margin-top:64px;padding-top:22px;border-top:1px solid var(--border-soft);font-size:12.5px;color:var(--text-secondary);line-height:1.6}}
@media (max-width:480px){{.page{{padding:32px 16px 72px}}.grid{{grid-template-columns:repeat(auto-fill,140px);gap:16px 14px}}.card,.card .frame{{width:140px}}.card .frame{{height:302px}}.card iframe{{transform:scale(.359)}}.card.desk,.card.tab{{width:100%}}.card.desk .frame{{width:100%;height:auto;aspect-ratio:1280/800}}.card.tab .frame{{width:100%;height:auto;aspect-ratio:834/1112}}}}
</style>
</head>
<body>
<div class="page">
<header class="masthead">
<div class="top">
<div>
<p class="eyebrow">Design system · {total} экранов · {len(cats)} разделов · light &amp; dark · mobile / tablet / desktop</p>
<h1>LexReader — Ultimate Design System</h1>
</div>
<div class="themeswitch" role="radiogroup" aria-label="Тема оформления" id="gallery-themeswitch">
<button type="button" data-theme-choice="light" role="radio" aria-checked="false">Светлая</button>
<button type="button" data-theme-choice="dark" role="radio" aria-checked="false">Тёмная</button>
<button type="button" data-theme-choice="system" role="radio" aria-checked="true">Системная</button>
</div>
</div>
<p>Единый источник истины для интерфейса LexReader: все экраны собраны на одном ките (<code>design-system.css</code> + <code>lex-ui.css</code>), одном наборе токенов и одних данных «мира продукта». Светлая тема — тёплая молочная палитра; тёмная — отдельная система поверхностей, не инверсия. Статус у каждого экрана честный: <b>Реально</b> — функция есть в коде, <b>Частично</b> — часть сценария, <b>Planned</b> — концепт без backend. Документация: <code>docs/product/lexreader-ultimate-design-system.md</code>, реестр: <code>docs/product/lexreader-ultimate-screen-registry.md</code>.</p>
<div class="kpis"><div class="kpi"><b>{total}</b><span>экранов</span></div><div class="kpi"><b>{impl}</b><span>реальные функции</span></div><div class="kpi"><b>{part}</b><span>частично</span></div><div class="kpi"><b>{plan}</b><span>planned-концепты</span></div><div class="kpi"><b>{len(cats)}</b><span>разделов</span></div></div>
</header>
<nav class="toc" aria-label="Разделы"><a href="system.html" style="background:var(--fill-leaf);color:#fff;border-color:transparent">Дизайн-система · токены и компоненты</a>{nav}</nav>
<div class="filters" role="group" aria-label="Фильтр по статусу"><span>Показать:</span><button type="button" data-filter="" class="on">Все</button><button type="button" data-filter="IMPLEMENTED">Реальные</button><button type="button" data-filter="PARTIAL">Частично</button><button type="button" data-filter="PLANNED">Planned</button></div>
{"".join(groups)}
<footer>LexReader — Ultimate Design System · {total} экранов · собрано из <code>design/ultimate/src</code> и <code>design/ultimate/core</code> · шрифты Unbounded / Onest / Literata · иконки — CSS-маски в <code>lex-ui.css</code>.</footer>
</div>
<script>
(function(){{var sw=document.getElementById('gallery-themeswitch');function paint(){{var m=window.LexTheme.get();sw.querySelectorAll('button').forEach(function(b){{var on=b.dataset.themeChoice===m;b.classList.toggle('on',on);b.setAttribute('aria-checked',on?'true':'false')}})}}sw.addEventListener('click',function(e){{var b=e.target.closest('button');if(!b)return;window.LexTheme.set(b.dataset.themeChoice);paint();document.querySelectorAll('iframe').forEach(function(f){{try{{f.contentWindow.LexTheme&&f.contentWindow.LexTheme.set(b.dataset.themeChoice)}}catch(x){{}}}})}});paint();
var fl=document.querySelector('.filters');fl.addEventListener('click',function(e){{var b=e.target.closest('button');if(!b)return;fl.querySelectorAll('button').forEach(function(x){{x.classList.toggle('on',x===b)}});document.body.dataset.filter=b.dataset.filter}});}})();
</script>
</body>
</html>'''
(R/'dist/index.html').write_text(page)
print('index.html:', total, 'screens;', impl, 'impl', part, 'partial', plan, 'planned')
