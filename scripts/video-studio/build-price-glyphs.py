"""Outlines from the same bundled fonts used by registered price labels."""
import json
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
root = Path(__file__).resolve().parents[2]
result = {}
for key, name in [('barlow', 'Barlow-ExtraBold.ttf'), ('condensed', 'BarlowCondensed-ExtraBold.ttf')]:
    font = TTFont(root / 'public/art-studio/fonts' / name)
    glyphs, cmap = font.getGlyphSet(), font.getBestCmap()
    table = {}
    for code in range(32, 256):
        if code not in cmap or not chr(code).isprintable():
            continue
        glyph = glyphs[cmap[code]]
        pen = SVGPathPen(glyphs)
        glyph.draw(pen)
        table[chr(code)] = {'advance': glyph.width, 'path': pen.getCommands()}
    result[key] = {'units': font['head'].unitsPerEm, 'glyphs': table}
(root / 'shared/video-studio/price-glyphs.json').write_text(json.dumps(result, separators=(',', ':')))
print('Price glyphs:', sum(len(v['glyphs']) for v in result.values()))
