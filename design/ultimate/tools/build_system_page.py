#!/usr/bin/env python3
"""dist/system.html — living design-system reference built on the real kit."""
import pathlib, re
R = pathlib.Path(__file__).resolve().parent.parent
icons = (R/'ds/icon-names.txt').read_text().split('\n')[0].split()
filled = (R/'ds/icon-names.txt').read_text().split('filled: ')[1].split()
FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700;800&family=Unbounded:wght@500;600;700;800&family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;0,7..72,700;1,7..72,400&display=swap">'
def sw(var, label, fg='var(--text-1)'):
    return f'<div class="tok"><span class="chipc" style="background:var({var});color:{fg}">Aa</span><b>{label}</b><code>{var}</code></div>'
surfaces = ''.join(sw(v,l) for v,l in [('--surface-canvas','Canvas'),('--surface-app','App'),('--surface-card','Card'),('--surface-sunken','Sunken'),('--surface-raised','Raised'),('--surface-overlay','Overlay')])
fills = ''.join(sw(v,l,'#fff') for v,l in [('--fill-leaf','Leaf · главное'),('--fill-sky','Sky · память'),('--fill-ember','Ember · стрик'),('--fill-red','Red · ошибка'),('--fill-ink','Ink · ИИ/planned'),('--fill-teal','Teal')]) + sw('--fill-sun','Sun · награды','#1a1a1a')
tints = ''.join(sw(v,l,t) for v,l,t in [('--green-100','Green tint','var(--green-text)'),('--blue-100','Blue tint','var(--blue-text)'),('--gold-100','Gold tint','var(--gold-text)'),('--gold-150','Orange tint','var(--orange-text)'),('--red-100','Red tint','var(--red-text)')])
texts = ''.join(f'<div class="tok"><span class="chipc" style="background:var(--surface-card);color:var({v})">Aa</span><b>{l}</b><code>{v}</code></div>' for v,l in [('--text-1','Основной'),('--text-2','Вторичный'),('--text-3','Подписи'),('--text-disabled','Disabled'),('--green-text','Green text'),('--blue-text','Blue text'),('--orange-text','Orange text'),('--red-text','Red text')])
space = ''.join(f'<div class="sp"><i style="width:var(--sp-{k})"></i><code>--sp-{k} · {v}px</code></div>' for k,v in [(1,4),(2,8),(3,12),(4,16),(5,20),(6,24),(8,32),(10,40),(12,48)])
radii = ''.join(f'<div class="rd" style="border-radius:var(--r-{k})"><code>--r-{k}</code></div>' for k in ['xs','sm','md','lg','xl','2xl'])
icon_html = ''.join(f'<div class="icn"><i class="ic ic-{n} s24"></i><span>{n}</span></div>' for n in icons) + ''.join(f'<div class="icn"><i class="ic ic-{n} s24"></i><span>{n}</span></div>' for n in filled)
moods = ''.join(f'<div class="icn"><i class="lex {m} s56"></i><span>{m}</span></div>' for m in ['happy','wink','joy','sad','sleep','think','wow','cool']) + '<div class="icn" style="background:var(--fill-leaf)"><i class="lex happy pale s56"></i><span style="color:#fff">pale</span></div><div class="icn"><i class="lex ghost s56"></i><span>ghost</span></div>'
page = f'''<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>LexReader — Design System Reference</title><script src="theme.js"></script>{FONTS}
<link rel="stylesheet" href="design-system.css"><link rel="stylesheet" href="lex-ui.css">
<style>
*,*::before,*::after{{box-sizing:border-box}}
body{{display:block;background:var(--surface-canvas);color:var(--text-1);font-family:var(--font-body)}}
.wrap{{max-width:1160px;margin:0 auto;padding:40px 24px 96px}}
@media (max-width:600px){{.wrap{{padding:28px 16px 72px}}.wrap h1{{font-size:28px}}}}
.demo .panel .rowx.wrap{{align-content:flex-start}}
.wrap>header{{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:flex-start;margin-bottom:28px}}
.wrap h1{{font:700 34px/1.1 var(--font-display);margin:0}}
.wrap h2{{font:700 13px/1 var(--font-body);letter-spacing:.1em;text-transform:uppercase;color:var(--text-3);margin:44px 0 14px}}
.wrap p.lead{{max-width:72ch}}
.panel{{background:var(--surface-app);border:var(--stroke-soft);border-radius:var(--r-xl);padding:20px}}
.toks{{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px}}
.tok{{display:flex;flex-direction:column;gap:4px;font-size:13px}}
.tok .chipc{{height:64px;border-radius:14px;border:var(--stroke-soft);display:flex;align-items:flex-end;padding:8px 10px;font:700 18px/1 var(--font-display)}}
.tok code,.sp code,.rd code{{font:500 11.5px/1.3 var(--font-mono);color:var(--text-3)}}
.typ>div{{display:flex;align-items:baseline;gap:20px;padding:10px 0;border-bottom:var(--stroke-soft)}}
.typ>div{{flex-wrap:wrap}}.typ code{{width:200px;flex:none;font:500 12px var(--font-mono);color:var(--text-3)}}
.sp{{display:flex;align-items:center;gap:12px;margin:6px 0}}.sp i{{height:14px;background:var(--fill-leaf);border-radius:3px;display:block}}
.rds{{display:flex;gap:12px;flex-wrap:wrap}}.rd{{width:104px;height:72px;background:var(--surface-card);border:var(--stroke);display:flex;align-items:flex-end;padding:8px}}
.demo{{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(320px,100%),1fr));gap:16px}}
.demo .panel{{display:flex;flex-direction:column;gap:12px;position:relative;overflow:hidden}}
.demo .panel>h3{{font:700 13px/1 var(--font-body);margin:0;color:var(--text-2)}}
.icons{{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:8px}}
.icn{{display:flex;flex-direction:column;align-items:center;gap:8px;padding:12px 4px;border-radius:12px;background:var(--surface-card);border:var(--stroke-soft)}}
.icn span{{font:500 11px/1.2 var(--font-mono);color:var(--text-3);text-align:center;word-break:break-all}}
.rules{{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(260px,100%),1fr));gap:12px}}
.rules .card b{{display:block;margin-bottom:4px}}
.themeswitch{{display:flex;gap:6px}}
</style></head><body><div class="wrap">
<header><div><p class="eyebrow" style="margin-bottom:8px">LexReader · v9 · справочник</p><h1>Design System</h1>
<p class="lead muted" style="margin-top:10px">Токены и компоненты, на которых собраны все экраны библиотеки. Всё ниже — живые классы <code>lex-ui.css</code>; переключи тему, чтобы увидеть тёмную систему поверхностей.</p></div>
<div class="seg" role="radiogroup" aria-label="Тема" id="ts" style="width:min(300px,100%)"><button data-t="light">Светлая</button><button data-t="dark">Тёмная</button><button data-t="system">Системная</button></div></header>
<a class="linkc" href="index.html">← К экранам</a>

<h2>Принципы</h2>
<div class="rules">
<div class="card"><b>Чтение — в центре</b><span class="sm muted">Английский текст набирается Literata; интерфейс — Onest; заголовки и числа — Unbounded.</span></div>
<div class="card"><b>Плоско, но «пухло»</b><span class="sm muted">Карточки — рамка 2px. Нажимаемое — нижняя грань 4px. Тени — только у оверлеев.</span></div>
<div class="card"><b>Цвет = смысл</b><span class="sm muted">Зелёный — прогресс и главное действие; синий — память и SRS; оранжево-красный — стрик; жёлтый — награды и Plus; красный — ошибка; ink — ИИ/planned.</span></div>
<div class="card"><b>Тёмная тема — не инверсия</b><span class="sm muted">Свои уровни поверхностей, отдельные «text-safe» оттенки акцентов и глубокие заливки под белый текст в обеих темах.</span></div>
<div class="card"><b>Честный статус</b><span class="sm muted">Нереализованное помечено меткой «Planned · концепт» и тёмным ink-языком.</span></div>
<div class="card"><b>Доступность</b><span class="sm muted">Контраст текста ≥ 4.5:1 в обеих темах (проверено скриптом), зона нажатия ≥ 44px, текст ≥ 11px.</span></div>
</div>

<h2>Поверхности</h2><div class="panel toks">{surfaces}</div>
<h2>Заливки под текст</h2><div class="panel toks">{fills}</div>
<h2>Тинты и акцентный текст</h2><div class="panel toks">{tints}{texts}</div>

<h2>Типографика</h2>
<div class="panel typ">
<div><code>display · Unbounded 44</code><span class="num xl">1 240</span></div>
<div><code>h1 · Unbounded 24</code><span class="h1">Доброе утро, Сергей</span></div>
<div><code>h2 · Unbounded 20</code><span class="h2">Колоды</span></div>
<div><code>h3 · Onest 16 bold</code><span class="h3">The Last Lighthouse</span></div>
<div><code>body · Onest 15</code><span>Одно короткое занятие сохранит серию.</span></div>
<div><code>sm · Onest 13.5</code><span class="sm muted">438 слов · пополняется сама</span></div>
<div><code>eyebrow · 11.5 caps</code><span class="eyebrow">Повторение на сегодня</span></div>
<div><code>read · Literata 18</code><span class="read">She was <mark>reluctant</mark> to leave the lighthouse.</span></div>
</div>

<h2>Отступы и радиусы</h2>
<div class="demo"><div class="panel">{space}</div><div class="panel"><div class="rds">{radii}</div></div></div>

<h2>Кнопки</h2>
<div class="demo">
<div class="panel"><h3>Варианты</h3><a class="btn b-leaf">Начать занятие</a><a class="btn b-sky">Повторить 47 карточек</a><a class="btn b-ember">Спасти стрик · 3 мин</a><a class="btn b-sun">Оформить Plus</a><a class="btn b-red">Удалить навсегда</a></div>
<div class="panel"><h3>Вторичные и состояния</h3><a class="btn b-ghost">Не могу слушать</a><a class="btn b-leaf" disabled>Проверить (disabled)</a><a class="btn b-leaf loading"><span class="spin sm" style="border-top-color:#fff"></span>Сохраняем…</a><div class="rowx"><a class="btn b-leaf sm fit">Small</a><button class="iconbtn box" aria-label="Иконка"><i class="ic ic-volume"></i></button></div><a class="link2">Не сейчас</a></div>
<div class="panel" style="background:var(--fill-leaf)"><h3 style="color:#fff">На цветном фоне</h3><a class="btn b-white">Начать занятие</a><a class="link2" style="color:#fff!important">Позже</a></div>
</div>

<h2>Поля и выбор</h2>
<div class="demo">
<div class="panel"><h3>Поля</h3><div><label class="label">Email</label><div class="field"><span class="ph">you@example.com</span></div></div><div><label class="label">Пароль</label><div class="field focus caret">newtest</div><p class="hint">Не меньше 8 символов</p></div><div><div class="field err">qwerty</div><p class="hint err">Неверный email или пароль</p></div><div class="field dis">Недоступно</div></div>
<div class="panel"><h3>Варианты ответа</h3><div class="opt"><span class="k">1</span>неохотный</div><div class="opt on"><span class="k">2</span>уверенный</div><div class="opt ok"><span class="k">3</span>убежище</div><div class="opt bad"><span class="k">4</span>берег</div></div>
<div class="panel"><h3>Переключатели</h3><div class="rowx between"><span>Напоминания</span><button class="toggle on" aria-label="вкл"></button></div><div class="rowx between"><span>Письма</span><button class="toggle" aria-label="выкл"></button></div><div class="rowx"><span class="radio on"></span>Год <span class="radio"></span>Месяц</div><div class="rowx"><span class="check on"></span>Карточки <span class="check"></span>Диктант</div><div class="seg"><button class="on">Неделя</button><button>Месяц</button><button>Год</button></div><div class="rowx wrap s8"><span class="chip on">Всё</span><span class="chip">Тексты</span><span class="chip word">reluctant</span></div></div>
</div>

<h2>Карточки, списки, метки</h2>
<div class="demo">
<div class="panel"><h3>Hero</h3><div class="hero"><p class="eyebrow">Занятие на сегодня</p><div class="h2" style="margin-top:6px">Слова из «The Last Lighthouse»</div><p class="sm" style="margin:6px 0 0">12 заданий · ~5 мин</p></div><div class="hero ink"><p class="eyebrow" style="color:#ffd43d">ИИ · planned</p><div class="h3" style="margin-top:6px">Репетитор Lex</div></div></div>
<div class="panel"><h3>Список</h3><div class="list"><div class="row"><span class="sw s-blue"><i class="ic ic-book"></i></span><div class="f1"><div class="t">Из чтения</div><div class="s">438 слов</div></div><span class="badge orange">18 сегодня</span></div><div class="row"><span class="sw gold"><i class="ic ic-compass"></i></span><div class="f1"><div class="t">Путешествия</div><div class="s">64 карточки</div></div><i class="ic ic-chev faint"></i></div><div class="row danger"><span class="sw red"><i class="ic ic-trash"></i></span><div class="f1"><div class="t">Удалить колоду</div></div></div></div></div>
<div class="panel" style="justify-content:flex-start"><h3>Метки и статы</h3><div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center"><span class="badge green">Знаю</span><span class="badge blue">Учу</span><span class="badge gold">+20 XP</span><span class="badge orange">Горит</span><span class="badge red">Ошибка</span><span class="badge plus">Plus</span><span class="badge soon">Скоро</span><span class="cefr">B1</span><span class="count">3</span></div><div class="rowx s8"><span class="pill streak"><i class="ic ic-flame-f s16"></i>12</span><span class="pill xp"><i class="ic ic-bolt-f s16"></i>1 240</span></div><div class="grid3"><div class="stat"><b class="num c-green">612</b><span>выучено</span></div><div class="stat t-blue"><b class="num c-blue">204</b><span>в работе</span></div><div class="stat t-orange"><b class="num c-orange">6</b><span>трудных</span></div></div><div class="rowx s6"><span class="avatar me sm">С</span><span class="avatar a1 sm">А</span><span class="avatar a2 sm">М</span><span class="avatar a3 sm">Л</span><span class="avatar a4 sm">Д</span></div></div>
</div>

<h2>Прогресс, загрузка, обратная связь</h2>
<div class="demo">
<div class="panel"><h3>Прогресс</h3><div class="bar"><i style="width:64%"></i></div><div class="bar lg gold"><i style="width:40%"></i></div><div class="bar blue sm"><i style="width:26%"></i></div><div class="steps"><i class="on"></i><i class="on"></i><i></i><i></i></div><div class="rowx"><span class="dots"><i class="on"></i><i class="on"></i><i class="on"></i><i></i></span><span class="spin"></span></div></div>
<div class="panel"><h3>Loading / skeleton</h3><div class="skel" style="height:56px"></div><div class="grid2"><div class="skel" style="height:72px"></div><div class="skel" style="height:72px"></div></div><div class="skel" style="height:14px;width:60%"></div></div>
<div class="panel"><h3>Баннеры</h3><div class="banner info"><i class="ic ic-info"></i><div><b>Импорт идёт</b>Пришлём уведомление.</div></div><div class="banner ok"><i class="ic ic-check"></i><div><b>Сохранено</b>5 слов добавлено.</div></div><div class="banner warn"><i class="ic ic-alert"></i><div><b>Лимит Free</b>2 из 3 текстов.</div></div><div class="banner err"><i class="ic ic-wifi-off"></i><div><b>Нет сети</b>Прогресс отправим позже.</div></div></div>
<div class="panel" style="min-height:220px"><h3>Toast и feedback</h3><div class="toast" style="position:relative;top:auto;left:auto;right:auto"><i class="ic ic-check"></i>Слово добавлено в «Мозг»<a>Отменить</a></div><div class="feedback ok" style="border-radius:16px;padding-bottom:16px"><div class="h"><span class="ok-dot"></span>В точку!</div></div><div class="feedback bad" style="border-radius:16px;padding-bottom:16px"><div class="h"><i class="ic ic-close s24"></i>Правильный ответ: refuge</div></div></div>
<div class="panel"><h3>Empty / Error</h3><div class="empty"><i class="lex think s56"></i><div class="h3">Колода пуста</div><p class="sm muted" style="margin:0">Слова из чтения попадают сюда сами.</p><a class="btn b-leaf sm fit">Открыть библиотеку</a></div></div>
<div class="panel" style="min-height:260px;padding:0"><div style="padding:20px"><h3>Sheet / modal</h3><p class="sm muted">Шит снизу — для контекстных действий; модалка — для подтверждений.</p></div><div class="scrim" style="position:absolute"></div><div class="sheet" style="position:absolute"><div class="h3">Лимит: 3 текста из 3</div><a class="btn b-sun sm">Открыть Plus</a></div></div>
</div>

<h2>Навигация</h2>
<div class="demo">
<div class="panel" style="padding:0;background:var(--surface-app)"><div style="padding:16px 16px 0"><h3>Mobile · таббар</h3></div><nav class="tabbar" style="margin:16px"><a class="tab on"><i class="ic ic-home"></i>Сегодня</a><a class="tab"><i class="ic ic-library"></i>Библиотека</a><a class="tab"><i class="ic ic-cards"></i>Практика<span class="count">47</span></a><a class="tab"><i class="ic ic-chart"></i>Прогресс</a><a class="tab"><i class="ic ic-user"></i>Профиль</a></nav></div>
<div class="panel" style="padding:0"><div style="padding:16px 16px 0"><h3>Шапки</h3></div><header class="hdr" style="padding-top:12px;min-height:0"><a class="iconbtn"><i class="ic ic-back s24"></i></a><div class="ttl">Путешествия<small>64 карточки</small></div><a class="iconbtn"><i class="ic ic-more"></i></a></header><header class="lessonbar" style="padding-top:4px"><a class="iconbtn"><i class="ic ic-close s24"></i></a><div class="bar lg"><i style="width:40%"></i></div><span class="b sm c-orange">5</span></header></div>
<div class="panel"><h3>Desktop · сайдбар</h3><div class="side" style="width:100%;border:var(--stroke-soft);border-radius:16px;padding:14px"><div class="logo"><i class="lex happy s40"></i>LexReader</div><a class="on"><i class="ic ic-home"></i>Сегодня</a><a><i class="ic ic-library"></i>Библиотека</a><a><i class="ic ic-cards"></i>Практика</a></div></div>
</div>

<h2>Маскот Lex</h2><div class="icons">{moods}</div>
<h2>Иконки · {len(icons)+len(filled)}</h2><div class="icons">{icon_html}</div>
</div>
<script>(function(){{var ts=document.getElementById('ts');function p(){{var m=LexTheme.get();ts.querySelectorAll('button').forEach(function(b){{b.classList.toggle('on',b.dataset.t===m)}})}}ts.addEventListener('click',function(e){{var b=e.target.closest('button');if(!b)return;LexTheme.set(b.dataset.t);p()}});p()}})();</script>
</body></html>'''
(R/'dist/system.html').write_text(page); print('system.html', len(page))
