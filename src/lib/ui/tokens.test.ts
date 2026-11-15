// Контракт дизайн-токенов: (1) каждый токен макетов, у которого есть
// эквивалент, реально определён в приложении, а «темизируемые» — переопределены
// в тёмной теме; (2) контраст текста и контролов в светлой И тёмной теме
// считается по формуле WCAG 2.x из самих CSS-файлов — смена цвета в
// tokens.css, ломающая AA, роняет этот тест, а не выясняется глазами.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { TOKEN_MAP } from "./token-map.ts";

const tokensCss = readFileSync(new URL("../../styles/tokens.css", import.meta.url), "utf8");
const globalsCss = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");

type Vars = Map<string, string>;

function stripComments(css: string) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Объявления `--name: value;` внутри блока с данным селектором (первый @theme/@layer не учитываем). */
function declarations(css: string, selector: string): Vars {
  const vars: Vars = new Map();
  const clean = stripComments(css);
  const re = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`, "g");
  for (const m of clean.matchAll(re)) {
    for (const d of m[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars.set(d[1], d[2].trim());
  }
  return vars;
}

const light: Vars = new Map([
  ...declarations(globalsCss, "@theme inline"),
  ...declarations(globalsCss, ":root"),
  ...declarations(tokensCss, ":root"),
]);
const darkOverrides: Vars = new Map([
  ...declarations(globalsCss, ':root[data-theme="dark"]'),
  ...declarations(tokensCss, ':root[data-theme="dark"]'),
]);
const dark: Vars = new Map([...light, ...darkOverrides]);

type RGBA = [number, number, number, number];

function parseColor(value: string): RGBA {
  const v = value.trim();
  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join("") : hex[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  }
  const rgba = v.match(/^rgba?\(([^)]+)\)$/i);
  if (rgba) {
    const p = rgba[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  }
  throw new Error(`cannot parse color: ${value}`);
}

function resolve(vars: Vars, name: string, depth = 0): RGBA {
  const raw = vars.get(name);
  if (raw === undefined) throw new Error(`token not defined: ${name}`);
  const alias = raw.match(/^var\((--[\w-]+)\)$/);
  if (alias) {
    if (depth > 8) throw new Error(`alias loop at ${name}`);
    return resolve(vars, alias[1], depth + 1);
  }
  return parseColor(raw);
}

function over(fg: RGBA, bg: RGBA): RGBA {
  const a = fg[3];
  return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1];
}

function luminance([r, g, b]: RGBA) {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function ratio(fg: RGBA, bg: RGBA) {
  const solidBg: RGBA = [bg[0], bg[1], bg[2], 1];
  const L1 = luminance(over(fg, solidBg));
  const L2 = luminance(solidBg);
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
}

const WHITE: RGBA = [255, 255, 255, 1];
const DARK_LABEL: RGBA = [26, 26, 26, 1];

const themes = { light, dark } as const;

// Тексты, которые читают на этих фонах (4.5:1, WCAG 1.4.3).
const SURFACES = ["--background", "--surface", "--surface-muted", "--surface-elevated"];
const TEXT_ON_SURFACES = ["--foreground", "--text-secondary"];
const COLOR_TEXT_PAIRS: [text: string, onTokens: string[]][] = [
  ["--leaf-text", ["--background", "--surface", "--leaf-tint"]],
  ["--sky-text", ["--background", "--surface", "--sky-tint"]],
  ["--ember-text", ["--background", "--surface", "--ember-tint"]],
  ["--sun-text", ["--surface", "--sun-tint"]],
  ["--danger-text", ["--background", "--surface", "--danger-tint"]],
  ["--ink-fill-text", ["--ink-fill"]],
];
// Заливки под белый текст — кнопки, бейджи, hero, аватары.
const WHITE_ON_FILLS = ["--leaf", "--sky-fill", "--ember-fill", "--danger", "--ink-fill"];

for (const [theme, vars] of Object.entries(themes)) {
  test(`[${theme}] primary and secondary text reach AA on every surface`, () => {
    for (const text of TEXT_ON_SURFACES) {
      for (const surface of SURFACES) {
        const r = ratio(resolve(vars, text), resolve(vars, surface));
        assert.ok(r >= 4.5, `${text} on ${surface}: ${r.toFixed(2)}:1 < 4.5`);
      }
    }
  });

  test(`[${theme}] tertiary text (captions) reaches AA on page and card`, () => {
    for (const surface of ["--background", "--surface", "--surface-elevated"]) {
      const r = ratio(resolve(vars, "--text-tertiary"), resolve(vars, surface));
      assert.ok(r >= 4.5, `--text-tertiary on ${surface}: ${r.toFixed(2)}:1 < 4.5`);
    }
  });

  test(`[${theme}] coloured text is readable on its tint and on surfaces`, () => {
    for (const [text, backgrounds] of COLOR_TEXT_PAIRS) {
      for (const bg of backgrounds) {
        const r = ratio(resolve(vars, text), resolve(vars, bg));
        assert.ok(r >= 4.5, `${text} on ${bg}: ${r.toFixed(2)}:1 < 4.5`);
      }
    }
  });

  test(`[${theme}] white label on solid fills (buttons, badges, avatars) reaches AA`, () => {
    for (const fill of WHITE_ON_FILLS) {
      const r = ratio(WHITE, resolve(vars, fill));
      assert.ok(r >= 4.5, `white on ${fill}: ${r.toFixed(2)}:1 < 4.5`);
    }
    const sun = ratio(DARK_LABEL, resolve(vars, "--sun"));
    assert.ok(sun >= 4.5, `#1a1a1a on --sun: ${sun.toFixed(2)}:1 < 4.5`);
  });

  test(`[${theme}] form-control borders and focus ring reach 3:1 against surfaces (WCAG 1.4.11)`, () => {
    for (const surface of ["--background", "--surface", "--surface-elevated"]) {
      const border = ratio(resolve(vars, "--border-input"), resolve(vars, surface));
      assert.ok(border >= 3, `--border-input on ${surface}: ${border.toFixed(2)}:1 < 3`);
    }
    for (const surface of ["--background", "--surface", "--surface-elevated"]) {
      const focus = ratio(resolve(vars, "--focus-ring"), resolve(vars, surface));
      assert.ok(focus >= 3, `focus ring on ${surface}: ${focus.toFixed(2)}:1 < 3`);
    }
  });
}

test("dark theme is a separate system: surface ladder is strictly ordered by lightness", () => {
  const order = ["--background", "--surface", "--surface-muted", "--surface-elevated"].map((t) => luminance(resolve(dark, t)));
  for (let i = 1; i < order.length; i++) assert.ok(order[i] > order[i - 1], `dark surface ${i} must be lighter than ${i - 1}`);
  // и не равна инверсии светлой: светлый --surface (#fff) ≠ тёмный
  assert.notEqual(dark.get("--card"), light.get("--card"));
});

test("token map: every mapped app token exists; themed ones are overridden for dark", () => {
  const isDefined = (name: string) => light.has(name) || tokensCss.includes(`${name}:`);
  for (const entry of TOKEN_MAP) {
    if (entry.app === null) {
      assert.ok(entry.note, `${entry.mockup}: unmapped tokens must explain why`);
      continue;
    }
    assert.ok(isDefined(entry.app), `${entry.mockup} → ${entry.app}: token is not defined in tokens.css/globals.css`);
    if (entry.themed) {
      const target = entry.app === "--surface" ? "--card" : entry.app === "--background" || entry.app === "--foreground" ? entry.app : entry.app;
      const defined = darkOverrides.has(target) || light.get(entry.app)?.startsWith("var(") === true;
      assert.ok(defined, `${entry.mockup} → ${entry.app}: themed token has no dark override`);
    }
  }
});

test("token map has no duplicate mockup names", () => {
  const names = TOKEN_MAP.map((t) => t.mockup);
  assert.equal(new Set(names).size, names.length);
});
