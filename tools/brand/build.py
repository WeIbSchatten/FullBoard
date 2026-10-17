"""Builds the FullBoard logo SVGs (mark + outlined Inter Display wordmark).

Run: python3 tools/brand/build.py  (needs fontTools and InterDisplay-Bold.otf).
PNG icons are rendered from these SVGs by frontend/scripts/render-brand.mjs.
"""
import os
import sys

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "media", "brand")
FONT = os.environ.get("FB_LOGO_FONT", "/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf")

INK, PAPER = "#0b0b0c", "#ffffff"


def mark(tile, rail, x=0, y=0, size=64):
    s = size / 32
    def r(rx, ry, w, h, rr, fill):
        return f'<rect x="{x + rx * s:.2f}" y="{y + ry * s:.2f}" width="{w * s:.2f}" height="{h * s:.2f}" rx="{rr * s:.2f}" fill="{fill}"/>'
    return "".join([
        r(0, 0, 32, 32, 9, tile),
        r(8, 8.5, 16, 3.4, 1.7, rail),
        r(8, 14.3, 11.5, 3.4, 1.7, rail),
        r(8, 20.1, 7, 3.4, 1.7, rail),
        f'<circle cx="{x + 22 * s:.2f}" cy="{y + 21.8 * s:.2f}" r="{2.3 * s:.2f}" fill="{rail}"/>',
    ])


def wordmark(text, x, baseline, px, fill, tracking=-0.02):
    font = TTFont(FONT)
    gs = font.getGlyphSet()
    cmap = font.getBestCmap()
    upm = font["head"].unitsPerEm
    scale = px / upm
    paths, cursor = [], 0.0
    for ch in text:
        name = cmap[ord(ch)]
        pen = SVGPathPen(gs)
        tp = TransformPen(pen, (scale, 0, 0, -scale, x + cursor, baseline))
        gs[name].draw(tp)
        paths.append(pen.getCommands())
        cursor += gs[name].width * scale + tracking * px
    return f'<path fill="{fill}" d="{" ".join(paths)}"/>', cursor


def logo(tile, rail, ink):
    word, width = wordmark("FullBoard", 82, 47, 44, ink)
    w = 82 + width + 4
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} 64" width="{w:.0f}" height="64">{mark(tile, rail)}{word}</svg>\n'


def main():
    os.makedirs(OUT, exist_ok=True)
    files = {
        "fullboard-mark.svg": f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">{mark(INK, PAPER)}</svg>\n',
        "fullboard-mark-inverse.svg": f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">{mark(PAPER, INK)}</svg>\n',
        "fullboard-logo-light.svg": logo(INK, PAPER, INK),
        "fullboard-logo-dark.svg": logo(PAPER, INK, PAPER),
    }
    for name, svg in files.items():
        with open(os.path.join(OUT, name), "w") as f:
            f.write(svg)
    print("wrote", ", ".join(files), "to", OUT, file=sys.stderr)


if __name__ == "__main__":
    main()
