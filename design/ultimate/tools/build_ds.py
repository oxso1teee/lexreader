#!/usr/bin/env python3
"""Builds dist/design-system.css (v8 colour ramps + v9 scales), dist/lex-ui.css
(component kit + mask icons + mascot) and copies ds/theme.js to dist/."""
import json, pathlib, urllib.parse
R = pathlib.Path(__file__).resolve().parent.parent
ic = json.load(open(R/'tools/icons-src.json'))
ic.update({
 'home':'<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
 'library':'<path d="M2 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2z"/><path d="M22 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z"/>',
 'cards':'<rect x="3" y="6" width="14" height="14" rx="2"/><path d="M7 2h12a2 2 0 0 1 2 2v12"/>',
 'chart':'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
 'back':'<path d="M15 18l-6-6 6-6"/>','chev':'<path d="M9 6l6 6-6 6"/>','chev-down':'<path d="M6 9l6 6 6-6"/>','chev-up':'<path d="M6 15l6-6 6 6"/>',
 'close':'<path d="M6 6l12 12M18 6 6 18"/>','plus':'<path d="M12 5v14M5 12h14"/>','minus':'<path d="M5 12h14"/>','check':'<path d="M5 12l5 5L20 7"/>',
 'more':'<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
 'settings':'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
 'trash':'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
 'send':'<path d="M21 3 10 14"/><path d="M21 3l-7 18-4-7-7-4z"/>',
 'sun':'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
 'bolt':'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
 'snow':'<path d="M12 2v20M3.3 7l17.4 10M20.7 7 3.3 17M9 4l3 3 3-3M9 20l3-3 3 3M4 12.5l1.2-4 4 1.2M20 11.5l-1.2 4-4-1.2"/>',
 'eye':'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
 'eye-off':'<path d="M3 3l18 18M10.6 5.1A10.9 10.9 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.5 6.6A16.600 16.600 0 0 0 2 12s3.6 7 10 7a10.300 10.300 0 0 0 4.300-.9M9.900 9.900a3 3 0 0 0 4.200 4.200"/>',
 'copy':'<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
 'external':'<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
 'refresh':'<path d="M20 11a8 8 0 0 0-14.500-4M4 4v4h4M4 13a8 8 0 0 0 14.500 4M20 20v-4h-4"/>',
 'pause':'<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
 'stop':'<rect x="6" y="6" width="12" height="12" rx="2"/>',
 'type':'<path d="M4 7V5h16v2M9 19h6M12 5v14"/>',
 'bookmark':'<path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/>',
 'list':'<path d="M8 6h13M8 12h13M8 18h13M3.500 6h.01M3.500 12h.01M3.500 18h.01"/>',
 'grid':'<rect x="3" y="3" width="7" height="7" rx="1.500"/><rect x="14" y="3" width="7" height="7" rx="1.500"/><rect x="3" y="14" width="7" height="7" rx="1.500"/><rect x="14" y="14" width="7" height="7" rx="1.500"/>',
 'info':'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.500h.01"/>',
 'wifi-off':'<path d="M3 3l18 18M8.500 16.400a5 5 0 0 1 7 0M5 12.900a10 10 0 0 1 3.300-2.200M19 12.900a10 10 0 0 0-5.300-2.800M2 9a15 15 0 0 1 4-2.700M22 9a15 15 0 0 0-11-3.900M12 20h.01"/>',
 'card-pay':'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
 'sliders':'<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
 'timer':'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.500 2M9 2h6"/>',
 'medal':'<circle cx="12" cy="15" r="6"/><path d="M8.500 9.500 5 3h5l2 4 2-4h5l-3.500 6.500M12 12.500l.9 1.800 2 .3-1.450 1.400.350 2-1.800-.950-1.800.950.350-2L9.100 14.600l2-.3z"/>',
 'swords':'<path d="M14.500 17.500 3 6V3h3l11.500 11.500M13 19l6-6M16 16l4 4M19 21l2-2M9.500 6.500 13 3h3v3l-3.500 3.500M5 14l4 4M7 17l-3 3M3 19l2 2"/>',
 'layers':'<path d="M12 3 2 8l10 5 10-5zM2 12.500l10 5 10-5M2 17l10 5 10-5"/>',
 'image':'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.500" cy="9.500" r="1.500"/><path d="M21 15l-5-5L5 20"/>',
 'repeat':'<path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/>',
 'undo':'<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
 'arrow-right':'<path d="M5 12h14M13 6l6 6-6 6"/>','arrow-up':'<path d="M12 19V5M6 11l6-6 6 6"/>','arrow-down':'<path d="M12 5v14M6 13l6 6 6-6"/>',
 'bulb':'<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.500c.7.700 1 1.500 1 2.500h6c0-1 .3-1.800 1-2.500A6 6 0 0 0 12 3z"/>',
 'tag':'<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><path d="M7.500 7.500h.01"/>',
 'history':'<path d="M3 12a9 9 0 1 0 3-6.700L3 8M3 3v5h5M12 7.500V12l3 2"/>',
 'volume':'<path d="M11 5 6 9H3v6h3l5 4zM15.500 8.500a5 5 0 0 1 0 7M18.500 5.500a9 9 0 0 1 0 13"/>',
 'tv':'<rect x="2" y="5" width="20" height="13" rx="2"/><path d="M8 21h8M10 9.500l5 2.500-5 2.500z"/>',
 'text':'<path d="M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8 9h8M8 13h8M8 17h5"/>',
 'subtitles':'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 14h4M13 14h5M6 10.500h8M17 10.500h1"/>',
 'paste':'<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2M8 12h8M8 16h5"/>',
 'phone':'<rect x="6" y="2" width="12" height="20" rx="2.500"/><path d="M11 18h2"/>',
 'laptop':'<rect x="4" y="4" width="16" height="11" rx="1.500"/><path d="M2 19h20"/>',
 'award':'<circle cx="12" cy="9" r="6"/><path d="M8.500 14 7 22l5-3 5 3-1.500-8"/>',
 'thumb':'<path d="M7 11v9H4v-9zM7 11l4-8a2.500 2.500 0 0 1 2.500 2.500V9H19a2 2 0 0 1 2 2.300l-1.200 7A2 2 0 0 1 17.800 20H7"/>',
 'at':'<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>',
 'user-plus':'<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3.500-6 7-6 1.500 0 3 .4 4.200 1M19 14v6M16 17h6"/>',
 'door':'<path d="M13 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5M4 20V5.500L13 3v18l-9-1zM9.500 12h.01"/>',
 'qr':'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20v.01M17 20h4v-3"/>',
 'cloud':'<path d="M7 18a5 5 0 1 1 1.300-9.800A6 6 0 0 1 20 10.500 3.800 3.800 0 0 1 18.500 18z"/>',
 'cloud-off':'<path d="M3 3l18 18M7 18a5 5 0 0 1-1.500-9.800M10 5.300A6 6 0 0 1 20 10.500a3.800 3.800 0 0 1 1 6.500M17 18H7"/>',
 'spark2':'<path d="M12 3l1.800 5.200L19 10l-5.200 1.800L12 17l-1.800-5.200L5 10l5.200-1.800zM19 15l.800 2.200L22 18l-2.200.800L19 21l-.800-2.200L16 18l2.200-.800z"/>',
 'quote':'<path d="M4 17c2 0 4-1.500 4-5V7H3v5h3M14 17c2 0 4-1.500 4-5V7h-5v5h3"/>',
 'scale':'<path d="M12 4v16M7 20h10M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>',
 'pin':'<path d="M12 21s7-6.200 7-11.500A7 7 0 0 0 5 9.500C5 14.800 12 21 12 21z"/><circle cx="12" cy="9.500" r="2.500"/>',
 'coins':'<circle cx="9" cy="9" r="6"/><path d="M15.500 9.200A6 6 0 1 1 9.200 15.500"/>',
 'hat':'<path d="M2 9l10-5 10 5-10 5zM6 11.500V16c0 1.500 3 3 6 3s6-1.500 6-3v-4.500M22 9v6"/>',
 'leaf':'<path d="M20 4c0 9-4 15-12 15a4 4 0 0 1-4-4C4 8 11 4 20 4zM4 20c2-6 6-10 11-12"/>',
})
def norm(p):
    import re
    return re.sub(r'(\d)\.(\d)00\b', r'\1.\2', p.replace('></path>','/>').replace('></rect>','/>').replace('></circle>','/>').replace('></ellipse>','/>'))
def uri(svg): return "url(\"data:image/svg+xml," + urllib.parse.quote(svg, safe="/:=' ,.-()") + "\")"
css = ["\n/* ---------- icons: CSS-mask, coloured by currentColor. <i class=\"ic ic-book\"></i> ---------- */",
 ".ic{display:inline-block;width:20px;height:20px;flex:none;background:currentColor;-webkit-mask:var(--i) center/contain no-repeat;mask:var(--i) center/contain no-repeat;vertical-align:-.2em}",
 ".ic.s14{width:14px;height:14px}.ic.s16{width:16px;height:16px}.ic.s18{width:18px;height:18px}.ic.s24{width:24px;height:24px}.ic.s28{width:28px;height:28px}.ic.s32{width:32px;height:32px}.ic.s40{width:40px;height:40px}.ic.s48{width:48px;height:48px}"]
for k in sorted(ic):
    svg = f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>{norm(ic[k]).replace(chr(34),chr(39))}</svg>"
    css.append(f".ic-{k}{{--i:{uri(svg)}}}")
# filled glyphs
fill = {
 'flame-f':"<path d='M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 0 2 1 3 2 3 0-3-1-5 1-8z' fill='black'/>",
 'bolt-f':"<path d='M13 2 4 14h7l-1 8 9-12h-7z' fill='black'/>",
 'star-f':"<path d='M12 2.500l2.900 6 6.600.900-4.800 4.600 1.200 6.500L12 17.400 6.100 20.500l1.200-6.500L2.500 9.400l6.600-.900z' fill='black'/>",
 'heart-f':"<path d='M12 21s-8-5.300-8-11a4.500 4.500 0 0 1 8-2.800A4.500 4.500 0 0 1 20 10c0 5.700-8 11-8 11z' fill='black'/>",
 'play-f':"<path d='M8 5l12 7-12 7z' fill='black'/>",
 'check-f':"<circle cx='12' cy='12' r='10' fill='black'/><path d='M7.500 12.300l3 3 6-6.300' stroke='white' stroke-width='2.600' fill='none' stroke-linecap='round' stroke-linejoin='round'/>",
 'lock-f':"<rect x='4' y='10.500' width='16' height='10.500' rx='2.500' fill='black'/><path d='M8 10.500V7a4 4 0 0 1 8 0v3.500' stroke='black' stroke-width='2.400' fill='none'/>",
 'crown-f':"<path d='M3 18h18l1.500-10-5.500 4-5-7-5 7-5.500-4z' fill='black'/>",
}
for k,v in fill.items():
    css.append(f".ic-{k}{{--i:{uri(f'''<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>{norm(v)}</svg>''')}}}")
css.append("/* check-f keeps its white tick only as a mask hole; use .ok-dot for the two-tone version */")
css.append(".ok-dot{width:24px;height:24px;border-radius:50%;background:var(--green-400) center/14px no-repeat;flex:none;display:inline-block;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23fff' stroke-width='3.500' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 12l5 5L20 7'/%3E%3C/svg%3E\")}.ok-dot.lg{width:40px;height:40px;background-size:22px}.ok-dot.sm{width:18px;height:18px;background-size:11px}".replace('3.500','3.5'))
# ---- mascot Lex (fixed brand colours; works on any surface) ----
def lex(face, body='#2b820f', belly='#e3f6d3', ink='#1c540a', extra=''):
    return (f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 150'><ellipse cx='64' cy='134' rx='34' ry='8' fill='rgba(0,0,0,.10)'/>"
            f"<path d='M64 8C78 26 100 44 92 72C87 92 66 104 48 90C32 78 32 54 48 40C58 31 60 20 64 8Z' fill='{body}'/>"
            f"<path d='M60 46C70 58 76 68 68 82C63 90 50 90 44 81C39 73 43 61 51 53C55 50 57 48 60 46Z' fill='{belly}' opacity='.92'/>"
            f"{face.replace('INK',ink)}"
            f"<ellipse cx='90' cy='100' rx='19' ry='12' fill='#ff9500' transform='rotate(-28 90 100)'/><ellipse cx='94' cy='96' rx='8' ry='5' fill='#ffc700' transform='rotate(-28 94 96)' opacity='.85'/>{extra}</svg>")
eyes="<ellipse cx='54' cy='62' rx='3.200' ry='4.400' fill='INK'/><ellipse cx='66' cy='62' rx='3.200' ry='4.400' fill='INK'/>"
faces={
 'happy': eyes+"<path d='M53 71q7 7 14 0' fill='none' stroke='INK' stroke-width='2.400' stroke-linecap='round'/>",
 'wink': "<ellipse cx='54' cy='62' rx='3.200' ry='4.400' fill='INK'/><path d='M62 62q4-3 8 0' fill='none' stroke='INK' stroke-width='2.400' stroke-linecap='round'/><path d='M53 70q7 8 14 0' fill='none' stroke='INK' stroke-width='2.400' stroke-linecap='round'/>",
 'joy': "<path d='M50 63q4-5 8 0M62 63q4-5 8 0' fill='none' stroke='INK' stroke-width='2.400' stroke-linecap='round'/><path d='M52 70q8 10 16 0z' fill='INK'/>",
 'sad': eyes+"<path d='M54 75q6-5 12 0' fill='none' stroke='INK' stroke-width='2.400' stroke-linecap='round'/><path d='M49 55l7 2M71 55l-7 2' stroke='INK' stroke-width='2' stroke-linecap='round'/>",
 'sleep': "<path d='M50 63q4 3 8 0M62 63q4 3 8 0' fill='none' stroke='INK' stroke-width='2.400' stroke-linecap='round'/><path d='M56 72h8' stroke='INK' stroke-width='2.400' stroke-linecap='round'/>",
 'think': "<ellipse cx='55' cy='60' rx='3.200' ry='4.400' fill='INK'/><ellipse cx='67' cy='60' rx='3.200' ry='4.400' fill='INK'/><path d='M55 73h9' stroke='INK' stroke-width='2.400' stroke-linecap='round'/><path d='M49 53l8-2' stroke='INK' stroke-width='2' stroke-linecap='round'/>",
 'wow': eyes+"<ellipse cx='60' cy='74' rx='3.600' ry='4.400' fill='INK'/>",
 'cool': "<path d='M47 58h26v5a6 6 0 0 1-12 0 6 6 0 0 1-12 0z' fill='INK'/><path d='M54 72q6 5 12 0' fill='none' stroke='INK' stroke-width='2.400' stroke-linecap='round'/>",
}
css.append("\n/* ---------- mascot Lex. <i class=\"lex happy\"></i> sizes: s40 s56 (default 64) s88 s120 s160 ---------- */")
css.append(".lex{display:inline-block;width:64px;aspect-ratio:128/150;background:var(--m) center/contain no-repeat;flex:none}.lex.s40{width:40px}.lex.s56{width:56px}.lex.s88{width:88px}.lex.s120{width:120px}.lex.s160{width:160px}")
for k,f in faces.items():
    css.append(f".lex.{k}{{--m:{uri(norm(lex(f)))}}}")
    css.append(f".lex.{k}.pale{{--m:{uri(norm(lex(f,body='#e3f6d3',belly='#ffffff',ink='#1c540a')))}}}")
css.append(".lex.ghost{--m:"+uri(norm(lex(faces['sleep'],body='#b9b3a6',belly='#e9e4da',ink='#5c5648')))+"}")
ui = open(R/'ds/ui-core.css').read() + "\n".join(css) + "\n"
(R/'dist').mkdir(exist_ok=True)
(R/'dist/lex-ui.css').write_text(ui)
(R/'dist/theme.js').write_text(open(R/'ds/theme.js').read())
ds = open(R/'ds/palette-v8.css').read() + open(R/'ds/tokens-v9.css').read()
(R/'dist/design-system.css').write_text(ds)
print('lex-ui.css', len(ui), 'bytes;', len(ic), 'stroke icons,', len(fill), 'filled; design-system.css', len(ds))
(R/'ds/icon-names.txt').write_text(' '.join(sorted(ic))+'\nfilled: '+' '.join(fill))
