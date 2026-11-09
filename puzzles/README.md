# QuinnDom Release 2 test build

Open `index.html` to reach all six pages: Wxrdie, El Mundo, Kuduso, Mapnitude, Zame and the Journey road prototype.

- Every page is one self-contained HTML file (fonts, sound and, for Journey, the five puzzles are embedded). It works from a double-click and from GitHub Pages.
- Sources: `src/<game>/` (engine, tests, template and build script). Rebuild with the `build_ui.py` in each folder.
- Shell contract each puzzle exposes: `window.<Game> = { config, getSave, loadSave, start({difficulty,index,locked}), onFinish(info) }`.
- Journey code: `src/journey/` (`journey-engine.js` is the city/army engine for later; the current page is the road prototype).
- Test saves live in the browser's localStorage; use the gear icon in Journey to reset.
