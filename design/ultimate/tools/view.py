#!/usr/bin/env python3
"""python3 tools/view.py <tag> Name1 Name2 ...  -> builds the fragments, audits them (light+dark),
prints objective issues, and writes build/shots/<tag>/view-N.png (light|dark pairs, max 3 screens per image) to look at."""
import json, subprocess, sys, pathlib
from PIL import Image
R = pathlib.Path(__file__).resolve().parent.parent
tag, names = sys.argv[1], sys.argv[2:]
subprocess.run([sys.executable, str(R/'tools/build_screens.py'), *names], check=True)
subprocess.run(['node', str(R/'tools/audit.mjs'), 'dist', f'build/shots/{tag}', ','.join(names)], check=True, cwd=R)
rep = json.load(open(R/f'build/shots/{tag}/report.json'))
for n in names:
    for t in ('light', 'dark'):
        x = rep[n][t]; iss = {k: x[k] for k in ('clipped', 'contrast', 'small', 'tap', 'dead', 'hex', 'errors', 'http') if x.get(k)}
        if x.get('hscroll'): iss['hscroll'] = True
        print(f'{n} [{t}]:', iss or 'OK')
for i in range(0, len(names), 3):
    ims = [Image.open(R/f'build/shots/{tag}/{t}/{n}.png').convert('RGB') for n in names[i:i+3] for t in ('light', 'dark')]
    gap = 12; W = sum(im.width for im in ims) + gap * (len(ims) + 1); H = max(im.height for im in ims) + 2 * gap
    sheet = Image.new('RGB', (W, H), (110, 110, 110)); x = gap
    for im in ims: sheet.paste(im, (x, gap)); x += im.width + gap
    if W > 2400: sheet = sheet.resize((2400, int(H * 2400 / W)), Image.LANCZOS)
    out = R/f'build/shots/{tag}/view-{i//3}.png'; sheet.save(out); print('look at:', out)
