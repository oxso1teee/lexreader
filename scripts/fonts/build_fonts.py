#!/usr/bin/env python3
"""Rebuild the self-hosted fonts in src/app/fonts/ from the upstream variable TTFs.

Why this exists: next/font/google downloads fonts from fonts.googleapis.com at *build* time.
Google intermittently answers with extension-less `.../l/font?kit=...&skey=...` URLs which both
Turbopack ("next/font/google queries have exactly one entry") and webpack ("Cannot read properties
of null (reading '1')") reject, so `next build` failed at random (CI e2e job, Vercel deploys).
The fonts are therefore committed as woff2 and loaded with next/font/local.

For every family the script:
  1. takes the upstream variable TTF (google/fonts, SIL OFL 1.1; sha256 in src/app/fonts/README.md),
  2. keeps the full variation axes (limiting the wght range re-rounds the deltas: outlines then differ from
     Google's by fractions of a unit, which shows up as sub-pixel anti-aliasing noise); only Source Serif 4's
     `opsz` is pinned at 14, exactly like Google Fonts serves it,
  3. subsets it to the UNION of the unicode-ranges Google Fonts served at the time of the migration
     (scripts/fonts/unicode-ranges.json) so no glyph that rendered before is lost,
  4. writes a single woff2 (next/font/local cannot express a per-file unicode-range).

Source Serif 4 declares the Reserved Font Name "Source" -> the subset is a Modified Version and is
renamed "Reading Serif 4" (OFL 1.1, section 3). The other three families declare no RFN.

Requires: pip install fonttools brotli
Usage:    python3 scripts/fonts/build_fonts.py <dir-with-upstream-ttfs> [<out-dir, default src/app/fonts>]
"""
import io
import json
import os
import sys

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, "..", "..", "src", "app", "fonts")

# key (unicode-ranges.json) -> (upstream ttf, output woff2, axis limits, rename away from the RFN?)
FAMILIES = {
    "onest": ("Onest-wght.ttf", "Onest-Variable.woff2", {}, False),
    "unbounded": ("Unbounded-wght.ttf", "Unbounded-Variable.woff2", {}, False),
    "geistmono": ("GeistMono-wght.ttf", "GeistMono-Variable.woff2", {}, False),
    # Google serves Source Serif 4 with opsz pinned at 14 (outlines verified identical to this instance).
    "sourceserif4": ("SourceSerif4-opsz-wght.ttf", "ReadingSerif4-Variable.woff2", {"opsz": 14}, True),
}

with open(os.path.join(HERE, "unicode-ranges.json"), encoding="utf-8") as fh:
    RANGES = json.load(fh)


def union_codepoints(key):
    cps = set()
    for rng in RANGES[key].values():
        for part in rng.split(","):
            part = part.strip().upper().replace("U+", "")
            if "-" in part:
                a, b = part.split("-")
                cps.update(range(int(a, 16), int(b, 16) + 1))
            else:
                cps.add(int(part, 16))
    return sorted(cps)


def rename_without_rfn(font):
    """Family / full / PostScript / unique names must not contain the Reserved Font Name 'Source'."""
    repl = [("Source Serif 4", "Reading Serif 4"), ("SourceSerif4", "ReadingSerif4"), ("SourceSerif", "ReadingSerif")]
    for rec in font["name"].names:
        if rec.nameID in (1, 3, 4, 6, 16, 21):
            text = rec.toUnicode()
            for old, new in repl:
                text = text.replace(old, new)
            rec.string = text


os.makedirs(OUT, exist_ok=True)
for key, (ttf, outname, limits, rename) in FAMILIES.items():
    font = TTFont(os.path.join(SRC, ttf))
    if limits:
        font = instancer.instantiateVariableFont(font, limits, inplace=False)
        buf = io.BytesIO()
        font.save(buf)
        buf.seek(0)
        font = TTFont(buf)  # round-trip: normalises gvar for glyphs without deltas
    opts = subset.Options()
    opts.layout_features = ["*"]  # keep kern/liga/ccmp/locl/... exactly like Google's subsets
    opts.name_IDs = ["*"]  # keep copyright (0) and license (13/14) strings: required by the OFL
    opts.name_languages = ["*"]
    opts.notdef_outline = True
    opts.glyph_names = False
    opts.hinting = False  # variable fonts are served unhinted
    opts.legacy_kern = False
    opts.drop_tables += ["DSIG"]
    opts.flavor = "woff2"
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=union_codepoints(key))
    sub.subset(font)
    if rename:
        rename_without_rfn(font)
    path = os.path.join(OUT, outname)
    font.flavor = "woff2"
    font.save(path)
    print(f"{key:13} -> {outname:30} {os.path.getsize(path):7} B  glyphs={len(font.getGlyphOrder())}")
