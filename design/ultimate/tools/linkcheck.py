#!/usr/bin/env python3
"""Navigation integrity over dist: dead links, '#'-links, orphans (no inbound), dead-ends (no outbound)."""
import re, json, pathlib, collections, sys
R = pathlib.Path(__file__).resolve().parent.parent
cats = json.load(open(R/'cats.json')); names = [n for c, ns in cats for n in ns]
have = {p.name[:-8] for p in (R/'dist').glob('*.dc.html')}
out, inb, dead, hashes = {}, collections.defaultdict(set), [], []
for n in names:
    if n not in have: continue
    s = (R/'dist'/f'{n}.dc.html').read_text()
    hrefs = re.findall(r'href="([^"]*)"', s)
    tgt = set()
    for h in hrefs:
        if h in ('#', ''): hashes.append(n); continue
        m = re.match(r'([A-Za-z0-9-]+)\.dc\.html', h)
        if m:
            t = m.group(1)
            if t not in have: dead.append((n, t))
            else: tgt.add(t); inb[t].add(n)
    out[n] = sorted(tgt)
missing = [n for n in names if n not in have]
orph = [n for n in names if n in have and not inb[n] and n not in ('Splash',)]
ends = [n for n in names if n in have and not out[n]]
rep = dict(screens=len(have & set(names)), missing=missing, dead=dead, hash_links=sorted(set(hashes)), orphans=orph, dead_ends=ends,
           edges=sum(len(v) for v in out.values()))
(R/'build').mkdir(exist_ok=True)
json.dump(dict(rep, graph=out), open(R/'build/navgraph.json', 'w'), ensure_ascii=False, indent=1)
for k, v in rep.items(): print(k, ':', v if not isinstance(v, list) else f'{len(v)} {v[:40]}')
