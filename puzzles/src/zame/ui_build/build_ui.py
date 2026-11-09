"""Assemble zame.html: one self-contained file (fonts, sound module and engine inlined).
Run from the zame folder:  python3 ui_build/build_ui.py <quinndom repo path>
Needs ui_build/node_modules/@fontsource (npm i @fontsource/space-grotesk @fontsource/nunito-sans @fontsource/vt323)
"""
import base64, json, pathlib, sys

root = pathlib.Path(__file__).resolve().parent.parent
build = root / "ui_build"
repo = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else root.parent / "harley1983/quinndom")
fonts_dir = build / "node_modules/@fontsource"

FONTS = [
    ("Space Grotesk", 500, "space-grotesk/files/space-grotesk-latin-500-normal.woff2"),
    ("Space Grotesk", 700, "space-grotesk/files/space-grotesk-latin-700-normal.woff2"),
    ("Nunito Sans", 400, "nunito-sans/files/nunito-sans-latin-400-normal.woff2"),
    ("Nunito Sans", 700, "nunito-sans/files/nunito-sans-latin-700-normal.woff2"),
    ("VT323", 400, "vt323/files/vt323-latin-400-normal.woff2"),
]
css = []
for family, weight, rel in FONTS:
    b64 = base64.b64encode((fonts_dir / rel).read_bytes()).decode()
    css.append(f'@font-face{{font-family:"{family}";font-weight:{weight};font-style:normal;font-display:swap;'
               f'src:url(data:font/woff2;base64,{b64}) format("woff2")}}')

read = lambda p: p.read_text(encoding="utf-8")

html = read(build / "zame.template.html")
for marker, text in [
    ("/*FONTS*/", "\n".join(css)),
    ("/*SOUND*/", read(repo / "js/sound.js")),
    ("/*ENGINE*/", read(root / "zame-engine.js")),
]:
    assert marker in html, marker
    html = html.replace(marker, text)

out = root / "zame.html"
out.write_text(html, encoding="utf-8")
print(f"wrote {out} ({out.stat().st_size/1024:.0f} KB)")
