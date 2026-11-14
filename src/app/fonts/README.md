# Self-hosted fonts

These files are loaded with `next/font/local` (`src/app/layout.tsx`, `src/app/read/[textId]/page.tsx`).
They replace `next/font/google`, which fetched Google Fonts at build time. Google intermittently answers
with extension-less `https://fonts.gstatic.com/l/font?kit=…&skey=…&v=…` URLs; Turbopack
(`next/font/google queries have exactly one entry`) and webpack (`Cannot read properties of null
(reading '1')`) both reject them, so `next build` failed at random (CI `e2e` job, Vercel deploys).
Committed files make the build independent of the network. ESLint (`no-restricted-imports`) now forbids
`next/font/google`.

| File | Family | CSS variable | Declared weights | Size |
|---|---|---|---|---|
| `Onest-Variable.woff2` | Onest 2.001 | `--font-onest` | 400, 600, 700 | 80 KB |
| `Unbounded-Variable.woff2` | Unbounded 1.701 | `--font-unbounded` | 700, 900 | 242 KB |
| `GeistMono-Variable.woff2` | Geist Mono 1.701 | `--font-geist-mono` | 100–900 | 58 KB |
| `ReadingSerif4-Variable.woff2` | Source Serif 4.004 (renamed) | `--font-reading` | 200–900 | 170 KB |

## Licenses (SIL Open Font License 1.1)

Each family keeps its upstream copyright and license text next to the binary: `OFL-Onest.txt`,
`OFL-Unbounded.txt`, `OFL-GeistMono.txt`, `OFL-SourceSerif4.txt`. The copyright (`name` ID 0) and license
(IDs 13/14) strings are preserved inside the woff2 files. The OFL allows bundling and redistribution with
software; the fonts are not sold on their own.
`OFL-SourceSerif4.txt` is Adobe's original `LICENSE.md` from `adobe-fonts/source-serif`, byte for byte
(it carries the copyright line with the Reserved Font Name and Adobe's trademark statement).
The other three files are the `OFL.txt` copies from `google/fonts`.

**Reserved Font Name.** Onest, Unbounded and Geist Mono declare none. **Source Serif 4 declares the
Reserved Font Name "Source"** and claims "Source" as a trademark. The subset is a Modified Version (OFL 1.1:
deleting components and changing formats both count), and section 3 forbids a Modified Version to use the
Reserved Font Name as its primary font name, so `ReadingSerif4-Variable.woff2` is renamed *Reading Serif 4*:
family (1, 16, 21), unique ID (3), full name (4), PostScript name (6) and the variations PostScript prefix (25).
`scripts/fonts/build_fonts.py` fails if any other name record still contains "Source". The word stays only in
the copyright notice (0) and Adobe's trademark statement (7) — they must stay. The JS identifier (and thus
the generated CSS family name) is `readingSerif`. Do not call this file "Source Serif" anywhere user-visible,
and do not use the authors' names to promote the product (OFL section 4; naming the origin as an acknowledgement is allowed).

### OFL 1.1 requirements — status of this repository

| Requirement | Status |
|---|---|
| 1. Fonts not sold by themselves | Bundled in the app only. |
| 2. Copyright notice + license accompany every copy | Embedded in each woff2 (name IDs 0, 13, 14) and as a stand-alone file next to it. |
| 3. No Modified Version under the Reserved Font Name | Done for the primary and all identifying name records (see above). Only Source Serif 4 has an RFN. |
| 4. No promotion with the authors' names | Credits only. |
| 5. Distributed entirely under the OFL | The repository has no root license file; these files are covered by the OFL texts above. If a repo-wide license is ever added, exclude `src/app/fonts/`. |
| Trademark ("Source", Adobe) | Not licensed by the OFL; the name is not used as a mark here. No trademark search was done for "Reading Serif". |
| Official OFL FAQ (subsetting, web fonts) | **Not checked against the primary source** (not reachable when this was written). |

This is a technical review against the license text, not legal advice. Whether the rename is sufficient
for the product is a decision for the owner (or counsel); the safest alternatives are written permission
from Adobe, or an OFL serif without a Reserved Font Name.

## What was done to the upstream files

* **Axes.** Full `wght` axes are kept (Onest 100–900, Unbounded 200–900, Geist Mono 100–900). Limiting the
  range re-rounds the variation deltas, which changes outlines by fractions of a unit and shows up as
  sub-pixel anti-aliasing noise. Source Serif 4 has its `opsz` axis pinned at 14 (`wght` 200–900 kept),
  which is exactly the instance Google Fonts served.
* **Glyph coverage.** Subset to the **union of every unicode-range Google served** (latin, latin-ext,
  cyrillic, cyrillic-ext, vietnamese, greek, math/symbols where present — `scripts/fonts/unicode-ranges.json`),
  so no glyph that rendered before is lost. `next/font/local` cannot attach a `unicode-range` to a file,
  hence one file per family. All OpenType layout features are kept; hinting is dropped (variable fonts are
  served unhinted).

## Verification against the files Google served (all subsets, all code points)

* Onest, Unbounded, Geist Mono: 7 495 glyph outlines at the declared weights are **exactly equal**
  (tolerance 0.001 unit); every code point is present; OpenType feature tags and vertical metrics are equal.
  Rendering the same strings with both sets in Chromium (Latin, Cyrillic, spaces, mixed, digits; 16/32 px;
  all declared weights) is pixel-identical for Onest; for Unbounded it is identical except as described below.
* Reading Serif 4: weight 400 is exactly equal (855/855); at 500–900 the deviation is ≤ 0.7 unit/1000 em
  (rounding of the pinned `opsz` instance); at weights ≤ 300 six H-shaped glyphs (H, Н, Η, Ĥ, Ḥ, Ḫ) deviate
  by up to 6 units — this difference is already between Google's file and the upstream source. The app does
  not use those weights.
* **One known rendering difference: kerning across former file boundaries.** Google split each family into
  per-script files. Space and punctuation (`latin` file) were shaped in a separate run from Cyrillic letters
  (`cyrillic` file), so kern pairs "Cyrillic letter + space/punctuation" (`, . : ; « » — „ “ ”` …) never
  applied. In a single file they do — that is what the font designers intended. Measured on 33 Cyrillic
  letters × 13 common punctuation/space characters, both orders:
  Onest 3 % of lowercase and 7 % of capital pairs (typically 30–40 units/1000 em ≈ 0.5–0.6 px at 16 px, max
  100); Unbounded ≈ 25 % (median ≈ 30, max 148); Reading Serif 4 ≈ 20 % (median 15–20 ≈ 0.3 px, max 159);
  Geist Mono none. Latin-only text, digits, and Cyrillic next to digits or Latin letters are unchanged.
  Real pages (login, offline, reset-password) render pixel-identical to the Google-font build in light/dark
  and desktop/mobile; long Cyrillic prose (privacy, terms) differs in 0.03–0.2 % of pixels, all at such
  letter/punctuation pairs. To restore the old pairing exactly, the cross-script kern pairs would have to be
  stripped from the GPOS table (not done: it makes typography worse).
* Fallback faces (`size-adjust` etc., used only while the font loads) are recomputed by next/font/local from
  the files; they differ slightly from the Google-derived ones (e.g. Onest 106.1 % vs 105.2 %).

## Rebuild

```sh
python3 -m venv /tmp/fontenv && /tmp/fontenv/bin/pip install fonttools brotli
# put the upstream TTFs in one directory (names as below), then:
/tmp/fontenv/bin/python scripts/fonts/build_fonts.py <dir-with-ttfs>
```

The result is functionally equivalent, but not byte-identical between runs (timestamps, glyph order inside
the subsetter). Compare outlines, not hashes.

| Upstream file (`https://raw.githubusercontent.com/google/fonts/main/ofl/…`) | sha256 used for the current build |
|---|---|
| `onest/Onest[wght].ttf` → `Onest-wght.ttf` | `966c5c29b4755da84b6854d5c21dd4eaa2420225d0e9874de602de176d4a9f31` |
| `unbounded/Unbounded[wght].ttf` → `Unbounded-wght.ttf` | `323b511be380c8d474ef030686b71aedde501f8d9cd46da558b7c40454372c3f` |
| `geistmono/GeistMono[wght].ttf` → `GeistMono-wght.ttf` | `d00e590b8eb3a59acc329b2d044fd143ae935090b7da33199ebee27cc7de8196` |
| `sourceserif4/SourceSerif4[opsz,wght].ttf` → `SourceSerif4-opsz-wght.ttf` | `97b2d4da6e3cb494b5a1e66ae176914d852ccabef49e0c02c0df25f3e39aca0b` |

## Cost

One file per family is preloaded in full. Before, only the latin + cyrillic subset files were (layout
≈ 155 KB, reader route +88 KB); now layout ≈ 380 KB and the reader route +170 KB (hashed, immutable-cached).
Unbounded's `latin-ext` alone is ≈ 133 KB of its 242 KB. If that matters, remove `latin-ext` from the
`unbounded` entry in `unicode-ranges.json` and rebuild: those glyphs (Polish, Turkish, Czech, … letters)
then fall back to Onest, the next family in the heading stack.
