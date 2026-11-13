// Usage: node tools/audit.mjs <screensDir=dist> <outDir=build/shots/final> [name,name,...]   (run from design/ultimate)
// Needs a static server on DESIGN_BASE (default http://127.0.0.1:8742) serving design/ultimate:
//   python3 -m http.server 8742 --bind 127.0.0.1 --directory design/ultimate   (npm run design:serve)
// Screenshots every screen in light+dark at 390x844 and collects objective defects.
import { chromium } from '../../../node_modules/playwright/index.mjs';
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const DESIGN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [dirArg, outArg, only] = process.argv.slice(2);
const dir = dirArg || 'dist', out = outArg || 'build/shots/final';
const base = (process.env.DESIGN_BASE || 'http://127.0.0.1:8742') + '/' + dir + '/';
const root = path.join(DESIGN_ROOT, dir);
let names = fs.readdirSync(root).filter(f => f.endsWith('.dc.html')).map(f => f.replace('.dc.html', ''));
if (only) names = only.split(',');
const outRoot = path.join(DESIGN_ROOT, out);
for (const t of ['light', 'dark']) fs.mkdirSync(path.join(outRoot, t), { recursive: true });
const browser = await chromium.launch();
const report = {};
const probe = () => {
  const res = { clipped: [], contrast: [], small: [], tap: [], hscroll: false, fonts: [] };
  const app = document.querySelector('.app'); if (!app) return res;
  const W = app.clientWidth, H = app.clientHeight;
  const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[, /]+/).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const over = (fg, bg) => { const a = fg[3]; return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1]; };
  const bgOf = el => { const st = []; let e = el, grad = false; while (e && e.nodeType === 1) { const cs = getComputedStyle(e); if (cs.backgroundImage && cs.backgroundImage !== 'none') grad = true; const c = parse(cs.backgroundColor); if (c && c[3] > 0) { st.push(c); if (c[3] === 1) break; } e = e.parentElement; } let b = [255, 255, 255, 1]; for (let i = st.length - 1; i >= 0; i--) b = over(st[i], b); return { b, grad }; };
  const scrollable = el => { let e = el.parentElement; while (e && e !== app.parentElement) { const cs = getComputedStyle(e); if (/(auto|scroll)/.test(cs.overflowY + cs.overflowX)) return true; e = e.parentElement; } return false; };
  const label = el => (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  const ar = app.getBoundingClientRect();
  const walker = document.createTreeWalker(app, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  while (walker.nextNode()) {
    const n = walker.currentNode; if (!n.nodeValue.trim()) continue; const el = n.parentElement; if (seen.has(el)) continue; seen.add(el); if (el.closest('[aria-hidden="true"],[data-decor]')) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
    const r = document.createRange(); r.selectNodeContents(n); const rc = r.getBoundingClientRect(); if (!rc.width || !rc.height) continue;
    const fs_ = parseFloat(cs.fontSize);
    if (!scrollable(el) && (rc.bottom > ar.top + H + 1 || rc.right > ar.left + W + 1 || rc.left < ar.left - 1 || rc.top < ar.top - 1)) res.clipped.push(label(el) + ` @${Math.round(rc.left)},${Math.round(rc.top)}-${Math.round(rc.right)},${Math.round(rc.bottom)}`);
    if (rc.top > ar.top + H || rc.bottom < ar.top) continue;
    if (fs_ < 11) res.small.push(fs_ + 'px ' + label(el));
    const fg0 = parse(cs.color); if (!fg0) continue; const { b, grad } = bgOf(el); if (grad) continue;
    let op = 1, e = el; while (e && e !== app) { op *= +getComputedStyle(e).opacity; e = e.parentElement; }
    const fg = over([fg0[0], fg0[1], fg0[2], fg0[3] * op], b);
    const L1 = lum(fg), L2 = lum(b); const ratio = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
    const big = fs_ >= 24 || (fs_ >= 18.5 && +cs.fontWeight >= 700);
    if (ratio < (big ? 3 : 4.5)) res.contrast.push(ratio.toFixed(2) + ' ' + fs_ + 'px ' + label(el));
  }
  app.querySelectorAll('a,button,[role=button],input,select').forEach(el => { const r = el.getBoundingClientRect(); if (!r.width) return; if (r.top > ar.top + H) return; const cs = getComputedStyle(el); if (cs.display === 'inline') return; if (r.width < 40 || r.height < 40) res.tap.push(`${Math.round(r.width)}x${Math.round(r.height)} ` + (label(el) || el.getAttribute('aria-label') || el.className)); });
  res.hscroll = document.documentElement.scrollWidth > innerWidth + 1;
  res.fonts = [...new Set([...document.fonts].filter(f => f.status === 'loaded').map(f => f.family))];
  return res;
};
for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: theme, deviceScaleFactor: 1 });
  await ctx.addInitScript(t => { try { localStorage.setItem('lexreader-theme', t); } catch (e) {} }, theme);
  const page = await ctx.newPage();
  for (const n of names) {
    const errs = []; const onErr = e => errs.push(String(e).slice(0, 120)); page.on('pageerror', onErr);
    const bad = []; const onResp = r => { if (r.status() >= 400) bad.push(r.url().split('/').pop()); }; page.on('response', onResp);
    { const src0 = fs.readFileSync(path.join(root, n + '.dc.html'), 'utf8'); const mm = src0.match(/"width":(\d+),"height":(\d+)/); await page.setViewportSize(mm ? { width: +mm[1], height: +mm[2] } : { width: 390, height: 844 }); }
    await page.goto(base + n + '.dc.html', { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => document.getAnimations().forEach(a => { try { a.finish(); } catch (e) { try { a.currentTime = 0; a.pause(); } catch (e2) {} } }));
    await page.waitForTimeout(60);
    await page.screenshot({ path: path.join(outRoot, theme, n + '.png') });
    const r = await page.evaluate(probe);
    if (theme === 'light') {
      const src = fs.readFileSync(path.join(root, n + '.dc.html'), 'utf8');
      const hrefs = [...src.matchAll(/href="([^"]*)"/g)].map(m => m[1]);
      r.dead = hrefs.filter(h => h === '#' || h === '' || (/\.html/.test(h) && !/^https?:/.test(h) && !fs.existsSync(path.join(root, h.split('#')[0].split('?')[0]))));
      r.nolink = hrefs.filter(h => /\.dc\.html/.test(h)).length === 0;
      const body = src.replace(/<script[\s\S]*?<\/script>/g, '');
      r.hex = [...new Set([...body.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map(m => m[0].toLowerCase()))].filter(h => !['#fff', '#ffffff'].includes(h));
    }
    r.errors = errs; r.http = bad; page.off('pageerror', onErr); page.off('response', onResp);
    report[n] = report[n] || {}; report[n][theme] = r;
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(outRoot, 'report.json'), JSON.stringify(report, null, 1));
let tot = { clipped: 0, contrastL: 0, contrastD: 0, small: 0, tap: 0, dead: 0, hex: 0, nolink: 0 };
for (const n in report) { const L = report[n].light, D = report[n].dark; tot.clipped += L.clipped.length ? 1 : 0; tot.contrastL += L.contrast.length ? 1 : 0; tot.contrastD += D.contrast.length ? 1 : 0; tot.small += L.small.length ? 1 : 0; tot.tap += L.tap.length ? 1 : 0; tot.dead += L.dead.length ? 1 : 0; tot.hex += L.hex.length ? 1 : 0; tot.nolink += L.nolink ? 1 : 0; }
console.log(names.length, 'screens; screens with issue:', JSON.stringify(tot));
