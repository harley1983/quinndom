// Renders the Welcome scene layers to small pixel PNGs in assets/welcome/.
// Run:  node tools/welcome/render.js   (needs playwright installed)
const path = require('path'), fs = require('fs');
const { scene, extras } = require('./scene.js');
const lay = require('./layouts.js');
const OUT = path.join(__dirname, '../../assets/welcome');
fs.mkdirSync(OUT, { recursive: true });
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for (const [k, seed] of [['desk', 7], ['phone', 11]]) {
    const L = lay[k];
    const ex = extras(L.W, L.H, L);
    const flies = ex.match(/<rect class="ff"[^>]*>/g) || [];
    const moonRefl = ex.replace(/<rect class="ff"[^>]*>/g, '');
    const fl = (arr) => arr.map(s => s.replace(/class="ff" style="[^"]*"/, '')).join('');
    const layers = {
      dawn: scene(L.W, L.H, L, seed, 'dawn'),
      day: scene(L.W, L.H, L, seed, 'day'),
      night: scene(L.W, L.H, L, seed, 'night'),
      front: scene(L.W, L.H, L, seed, 'front'),
      frontnight: scene(L.W, L.H, L, seed, 'frontnight') + moonRefl,
      fliesa: fl(flies.filter((_, i) => i % 2 === 0)),
      fliesb: fl(flies.filter((_, i) => i % 2 === 1))
    };
    for (const name in layers) {
      const p = await b.newPage({ viewport: { width: L.W, height: L.H }, deviceScaleFactor: 1 });
      await p.setContent('<body style="margin:0;background:transparent"><svg width="' + L.W + '" height="' + L.H + '" viewBox="0 0 ' + L.W + ' ' + L.H + '" shape-rendering="crispEdges" style="display:block">' + layers[name] + '</svg></body>');
      await p.screenshot({ path: path.join(OUT, k + '-' + name + '.png'), omitBackground: true });
      await p.close();
    }
  }
  await b.close();
})();
