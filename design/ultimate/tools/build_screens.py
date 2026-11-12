#!/usr/bin/env python3
"""Wraps src/<Name>.html fragments into dist/<Name>.dc.html and copies the hand-maintained core/*.dc.html.
Fragment = optional first-line  <!--meta {"title":"…","w":390,"h":844,"planned":false}-->
then optional <style>…</style>, then the <div class="app …">…</div> markup."""
import json, pathlib, re, sys
R = pathlib.Path(__file__).resolve().parent.parent
FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700;800&family=Unbounded:wght@500;600;700;800&family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;0,7..72,700;1,7..72,400&display=swap">'
n = 0
only = set(sys.argv[1:])
(R/'dist').mkdir(exist_ok=True)
for f in sorted((R/'src').glob('*.html')):
    name = f.stem
    if only and name not in only: continue
    s = f.read_text()
    meta = {}
    m = re.match(r'\s*<!--meta\s*(\{.*?\})\s*-->', s, re.S)
    if m: meta = json.loads(m.group(1)); s = s[m.end():]
    style = ''
    m = re.match(r'\s*<style>(.*?)</style>', s, re.S)
    if m: style = m.group(1).strip(); s = s[m.end():]
    body = s.strip()
    if meta.get('planned') and 'planned-tag' not in body:
        body = re.sub(r'(<div class="app[^"]*"[^>]*>)', r'\1\n<span class="planned-tag">Planned · концепт</span>', body, 1)
    w, h = meta.get('w', 390), meta.get('h', 844)
    html = f'''<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>LexReader — {meta.get('title', name)}</title></head>
<body>
<x-dc>
<helmet>
<script src="theme.js"></script>
{FONTS}
<link rel="stylesheet" href="design-system.css">
<link rel="stylesheet" href="lex-ui.css">
{('<style>' + chr(10) + style + chr(10) + '</style>') if style else ''}
</helmet>
{body}
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":{w},"height":{h}}}}}'>
class Component extends DCLogic {{
  renderVals() {{ return {{}}; }}
}}
</script>
</body>
</html>
'''
    (R/'dist'/f'{name}.dc.html').write_text(html); n += 1
if not only:
    import shutil
    for c in sorted((R/'core').glob('*.dc.html')):
        shutil.copyfile(c, R/'dist'/c.name); n += 1
print('built', n)
