"""Assemble journey.html: one self-contained prototype (fonts, sound, engine and the five embedded puzzles).
Run from the journey folder:  python3 ui_build/build_ui.py <quinndom repo path>
Needs ui_build/node_modules/@fontsource and the five built puzzles in <repo>/puzzles/ (wxrdie, elmundo, kuduso, mapnitude, zame .html).
The puzzles are embedded as JSON strings and opened in an iframe (srcdoc), so the shell can reach each game's hooks: window.<Game>.start / config / onFinish.
"""
import base64, json, pathlib, sys

root = pathlib.Path(__file__).resolve().parent.parent
build = root / "ui_build"
repo = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else root.parent / "harley1983/quinndom")
fonts_dir = build / "node_modules/@fontsource"
FONTS = [("Space Grotesk", 500, "space-grotesk/files/space-grotesk-latin-500-normal.woff2"), ("Space Grotesk", 700, "space-grotesk/files/space-grotesk-latin-700-normal.woff2"),
         ("Nunito Sans", 400, "nunito-sans/files/nunito-sans-latin-400-normal.woff2"), ("Nunito Sans", 700, "nunito-sans/files/nunito-sans-latin-700-normal.woff2"),
         ("VT323", 400, "vt323/files/vt323-latin-400-normal.woff2")]
css = []
for family, weight, rel in FONTS:
    b64 = base64.b64encode((fonts_dir / rel).read_bytes()).decode()
    css.append(f'@font-face{{font-family:"{family}";font-weight:{weight};font-style:normal;font-display:swap;src:url(data:font/woff2;base64,{b64}) format("woff2")}}')
read = lambda p: p.read_text(encoding="utf-8")
head = read(build / "head.part").replace("/*FONTS*/", "\n".join(css))
html = head + read(build / "css.part") + read(build / "body.part") + read(build / "js.part")
html = html.replace("/*SOUND*/", read(repo / "js/sound.js")).replace("/*ENGINE*/", read(root / "journey-engine.js"))
puz = ""
for p in ["elmundo", "wxrdie", "mapnitude", "kuduso", "zame"]:
    s = json.dumps(read(repo / "puzzles" / f"{p}.html")).replace("</", "<\\/")
    puz += f'<script type="application/json" id="puz-{p}">{s}</script>\n'
html = html.replace("<script>\n/*SOUND*/", puz + "<script>\n" + read(repo / "js/sound.js"), 1) if False else html
html = html.replace("</body>", puz + "</body>")
out = root / "journey.html"
out.write_text(html, encoding="utf-8"); print(f"wrote {out} ({out.stat().st_size/1024:.0f} KB)")
