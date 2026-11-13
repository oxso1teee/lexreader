// node pageshot.mjs <url> <out.png> <width> <theme> [fullPage=1]
import { chromium } from '../../../node_modules/playwright/index.mjs';
const [url, out, w, theme, full] = process.argv.slice(2);
const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: +w || 1280, height: 900 }, colorScheme: theme || 'light' });
await c.addInitScript(t => { try { localStorage.setItem('lexreader-theme', t); } catch (e) {} }, theme || 'light');
const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('response', r => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });
await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); await p.waitForTimeout(4000); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(1500);
const hs = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
await p.screenshot({ path: out, fullPage: full !== '0' });
console.log(JSON.stringify({ errs, hscroll: hs })); await b.close();
