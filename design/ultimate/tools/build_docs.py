#!/usr/bin/env python3
"""Generates docs/product/lexreader-ultimate-screen-registry.md and lexreader-ultimate-design-system.md
from registry.json, build/navgraph.json and build/shots/final/report.json (produced by linkcheck.py / audit.mjs)."""
import json, pathlib, collections, datetime
R = pathlib.Path(__file__).resolve().parent.parent; D = R.parent.parent/'docs/product'
reg = json.load(open(R/'registry.json')); nav = json.load(open(R/'build/navgraph.json'))
rep = json.load(open(R/'build/shots/final/report.json')) if (R/'build/shots/final/report.json').exists() else {}
cats = json.load(open(R/'cats.json'))
C = collections.Counter
st = C(r['status'] for r in reg); wk = C(r['work'] for r in reg)
ST = {'IMPLEMENTED':'Реально','PARTIAL':'Частично','PLANNED':'PLANNED'}
URL = 'https://claude.ai/code/artifact/4c6ee007-9b1f-4b28-b7dd-87395937c892'
# ---------- registry ----------
L = [f'# LexReader — Ultimate Screen Registry', '',
 f'Дата: {datetime.date.today():%Y-%m-%d} · Artifact: [LexReader — Ultimate Design System]({URL}) · экранов: **{len(reg)}** · разделов: **{len(cats)}**', '',
 'Источник каждого экрана: `design/ultimate/src/<Name>.html` (переработанные и новые; собираются `tools/build_screens.py`) либо `design/ultimate/core/<Name>.dc.html` (сохранённые исходные с исправлениями токенов/контраста). Статус функциональности сверен с кодом (маршруты `src/app`, миграции Supabase) — см. «Реальные и запланированные функции» в `lexreader-ultimate-design-system.md`.', '',
 '**Статусы:** «Реально» — сценарий работает в коде; «Частично» — данные/логика есть, экрана 1:1 или части действия нет; «PLANNED» — концепт, backend отсутствует (на экране метка «Planned · концепт»).', '',
 f'Итого: Реально {st["IMPLEMENTED"]} · Частично {st["PARTIAL"]} · PLANNED {st["PLANNED"]}. Новых {wk["новый"]}, переработано {wk["переработан"]}, сохранено с исправлениями {wk["сохранён (контраст/токены исправлены)"]}.', '']
for cat, names in cats:
    rows = [r for r in reg if r['category'] == cat]
    L += [f'## {cat} ({len(rows)})', '', '| ID | Экран | Название | Назначение | Маршрут | Статус | Работа | Темы | Состояния | Размер |', '|---|---|---|---|---|---|---|---|---|---|']
    for r in rows:
        L.append(f"| {r['id']} | `{r['name']}` | {r['title']} | {r['purpose']} | `{r['route']}` | {ST[r['status']]} | {r['work']} | {r['themes']} | {r['states']} | {r['w']}×{r['h']} |")
    L.append('')
(D/'lexreader-ultimate-screen-registry.md').write_text('\n'.join(L))
print('registry md', len(reg))

# ---------- design system doc ----------
fin = rep
def cnt(k, th): return sum(1 for v in fin.values() if v.get(th, {}).get(k))
aud = dict(n=len(fin), cl=cnt('clipped','light'), cL=cnt('contrast','light'), cD=cnt('contrast','dark'), sm=cnt('small','light'), tap=cnt('tap','light'),
           err=sum(1 for v in fin.values() if v['light'].get('errors') or v['dark'].get('errors')), hs=sum(1 for v in fin.values() if v['light'].get('hscroll')))
new = [r for r in reg if r['work'] == 'новый']; red = [r for r in reg if r['work'] == 'переработан']; kept = [r for r in reg if r['work'].startswith('сохран')]
planned = [r for r in reg if r['status'] == 'PLANNED']; partial = [r for r in reg if r['status'] == 'PARTIAL']
def lst(rows): return ', '.join(f"`{r['name']}`" for r in rows)
bycat = '\n'.join(f"| {c} | {len(ns)} | {sum(1 for r in reg if r['category']==c and r['work']=='новый')} | {sum(1 for r in reg if r['category']==c and r['work']=='переработан')} |" for c, ns in cats)
out = open(R/'tools/ds_doc_template.md').read().format(
  date=f'{datetime.date.today():%Y-%m-%d}', url=URL, total=len(reg), ncat=len(cats), nnew=len(new), nred=len(red), nkept=len(kept),
  impl=st['IMPLEMENTED'], part=st['PARTIAL'], plan=st['PLANNED'], new_list=lst(new), red_list=lst(red), kept_list=lst(kept),
  planned_list=lst(planned), partial_list=lst(partial), bycat=bycat, edges=nav.get('edges', 0), dead=len(nav.get('dead', [])),
  hashes=len(nav.get('hash_links', [])), orphans=', '.join(f'`{o}`' for o in nav.get('orphans', [])) or '—',
  dead_ends=', '.join(f'`{o}`' for o in nav.get('dead_ends', [])) or '—', **aud)
(D/'lexreader-ultimate-design-system.md').write_text(out)
print('design-system md written')
