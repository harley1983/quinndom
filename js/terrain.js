/* Terrain (Release 3, v1.0): the shape of the floating island. A designed map (placed by hand, finished with a little seeded noise),
   so the village always looks settled and the same for everyone. Pure data and lookups (Node-compatible), shared by the rules
   (js/city.js) and the drawing (js/cityart.js).
   Tiles are x (right) and y (down). Each tile has a height h (2 is the village level, 3 a terrace, 4 the high ground; 1 is spare)
   and a type t:
     g grass clearing (you can build here)   f forest   a farmland   r rock   p path   w water   b bridge
   One height step is a cliff on screen, so tiles only ever differ by one step from their neighbours. */
var Terrain = (function () {
  var W = 36, H = 30, SIZE = 36, LV = 16;
  var tiles = {};           // "x,y" -> { h, t }

  function hash(a, b) { var h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; }
  function key(x, y) { return x + ',' + y; }
  function rnd(a, b) { return (hash(a, b) % 1000) / 1000; }
  function smooth(t) { return t * t * (3 - 2 * t); }
  /* smooth value noise in 0..1; scale = size of the blobs in tiles */
  function vn(x, y, scale, seed) {
    var fx = x / scale, fy = y / scale, ix = Math.floor(fx), iy = Math.floor(fy), tx = smooth(fx - ix), ty = smooth(fy - iy);
    var a = rnd(ix + seed * 101, iy), b = rnd(ix + 1 + seed * 101, iy), c = rnd(ix + seed * 101, iy + 1), d = rnd(ix + 1 + seed * 101, iy + 1);
    return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
  }
  function ell(cx, cy, rx, ry, x, y, wob, seed) {
    var nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
    return Math.sqrt(nx * nx + ny * ny) + (wob || 0) * (vn(x, y, 4, seed || 1) - 0.5) * 2;
  }
  function get(x, y) { return tiles[key(x, y)]; }
  function set(x, y, h, t) { var o = tiles[key(x, y)]; if (!o) return; if (h) o.h = h; if (t) o.t = t; }
  var x, y;

  // 1. the island: a lopsided oval with a bulge in the south-west and a cove in the south-east
  for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
    var r = ell(18, 15, 17.4, 13.6, x, y, 0.2, 1);
    var bulge = ell(8, 24.5, 4.6, 3.4, x, y, 0.2, 2), cove = ell(29, 27, 4, 3.2, x, y, 0.15, 3);
    if ((r <= 1 || bulge <= 1) && cove > 1) tiles[key(x, y)] = { h: 2, t: 'g' };
  }
  // 2. heights: the high ground at the back, a wide terrace below it
  for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
    if (!get(x, y)) continue;
    if (ell(18, 7, 12.5, 6, x, y, 0.16, 4) <= 1) set(x, y, 3);
    if (ell(18, 4.4, 7.2, 3.3, x, y, 0.14, 5) <= 1) set(x, y, 4);
  }
  // no cliff taller than one step: lower anything that stands two above a neighbour
  var again = true, guard = 0;
  while (again && guard++ < 20) {
    again = false;
    Object.keys(tiles).forEach(function (k) {
      var p = k.split(','), px = +p[0], py = +p[1], t = tiles[k];
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var n = get(px + d[0], py + d[1]); if (n && t.h - n.h > 1) { t.h = n.h + 1; again = true; } });
    });
  }
  // 3. farmland in the east, forest on the rim and in patches, a few rocks
  for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
    var t = get(x, y); if (!t) continue;
    var edge = 99, d;
    for (d = 1; d <= 3; d++) if (!get(x - d, y) || !get(x + d, y) || !get(x, y - d) || !get(x, y + d)) { edge = d; break; }
    var n = vn(x, y, 3.2, 7);
    if (edge <= 2 && n > 0.28) t.t = 'f';
    else if (edge === 3 && n > 0.62) t.t = 'f';
    else if (t.h === 3 && n > 0.8) t.t = 'f';
    else if (t.h === 2 && n > 0.74) t.t = 'f';
    else if (t.h === 4 && n > 0.72) t.t = 'f';
  }
  for (y = 0; y < H; y++) for (x = 0; x < W; x++) if (get(x, y) && get(x, y).h === 2 && ell(31, 19.5, 4.6, 3.6, x, y, 0.2, 8) <= 1) set(x, y, 0, 'a');
  // 4. clearings: keep the neighbourhood sites free of forest
  [[18, 16, 4], [12, 16, 3], [23, 19, 3], [18, 11, 3], [9, 11, 3], [26, 11, 2.5], [18, 3, 2.5], [14, 22, 2.5], [22, 23, 2.5], [10, 19, 2.4], [27, 16, 2]].forEach(function (c) {
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) if (get(x, y) && get(x, y).t === 'f' && Math.hypot(x + 0.5 - c[0], y + 0.5 - c[1]) <= c[2]) set(x, y, 0, 'g');
  });
  // 5. water: a spring on the terrace, a stream that drops off the terrace edge and runs out of the east side, a pond in the west
  function line(pts, fn) {
    for (var i = 0; i + 1 < pts.length; i++) {
      var a = pts[i], b = pts[i + 1], px = a[0], py = a[1], step = 0;
      fn(px, py);
      while (px !== b[0] || py !== b[1]) {
        var dx = b[0] - px, dy = b[1] - py, horiz = Math.abs(dx) > Math.abs(dy) ? true : Math.abs(dx) < Math.abs(dy) ? false : hash(px, py) % 2 === 0;
        if (Math.abs(dx) > 0 && Math.abs(dy) > 0 && hash(px + step, py * 3) % 4 === 0) horiz = !horiz;   // a little wander
        if (horiz && dx !== 0) px += dx > 0 ? 1 : -1; else if (dy !== 0) py += dy > 0 ? 1 : -1; else px += dx > 0 ? 1 : -1;
        fn(px, py); step++;
      }
    }
  }
  var STREAM = [[24, 8], [24, 13], [25, 14], [31, 14], [35, 15]];
  line(STREAM, function (px, py) { if (get(px, py)) { set(px, py, 0, 'w'); } });
  line([[24, 8], [23, 8]], function (px, py) { set(px, py, 0, 'w'); });
  for (y = 0; y < H; y++) for (x = 0; x < W; x++) if (get(x, y) && get(x, y).h === 2 && ell(7, 21.5, 3.0, 2.2, x, y, 0.25, 9) <= 1) set(x, y, 0, 'w');
  line([[7, 23], [6, 25], [5, 27]], function (px, py) { if (get(px, py)) set(px, py, 0, 'w'); });
  // 6. paths: the main street from the high ground to the square, streets out to the west, east and south, a bridge over the stream
  var PATHS = [
    [[18, 3], [18, 8], [19, 12], [18, 15]],                   // main street, from the summit clearing down to the square
    [[18, 8], [13, 9], [9, 10]], [[19, 8], [23, 9]],           // along the terrace, to the spring
    [[18, 15], [12, 16], [10, 17]], [[12, 16], [11, 20]],       // west street, and a track down towards the pond
    [[18, 15], [27, 16]], [[27, 16], [27, 9]],                 // east street, then north over the bridge
    [[27, 16], [30, 16], [31, 18]],                            // out to the farm
    [[18, 15], [18, 22], [15, 26]], [[18, 22], [23, 23]]       // south street
  ];
  PATHS.forEach(function (pts) { line(pts, function (px, py) { var t = get(px, py); if (!t) return; if (t.t === 'w') t.t = 'b'; else if (t.t !== 'b') t.t = 'p'; }); });
  for (y = 15; y <= 17; y++) for (x = 17; x <= 19; x++) { var sq = get(x, y); if (sq && sq.t !== 'b') sq.t = 'p'; }   // the village square
  // paths run on level ground or on one-step slopes: make the square and the street ends flat where it matters
  // 7. a few rocks on open ground, away from paths
  for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
    var rt = get(x, y);
    if (rt && rt.t === 'g' && hash(x * 3, y * 5) % 23 === 0) {
      var near = false; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (dd) { var nn = get(x + dd[0], y + dd[1]); if (nn && (nn.t === 'p' || nn.t === 'b')) near = true; });
      if (!near) rt.t = 'r';
    }
  }
  set(23, 8, 0, 'r');                                         // the spring stone

  function at(x, y) { return tiles[key(x, y)] || null; }
  function h(x, y) { var t = tiles[key(x, y)]; return t ? t.h : 0; }
  function type(x, y) { var t = tiles[key(x, y)]; return t ? t.t : ''; }
  function buildable(x, y) { var t = tiles[key(x, y)]; return !!t && t.t === 'g'; }
  function list() { return Object.keys(tiles).map(function (k) { var p = k.split(','); return { x: +p[0], y: +p[1], h: tiles[k].h, t: tiles[k].t }; }); }
  function ascii() {
    var rows = [], yy, xx;
    for (yy = 0; yy < H; yy++) {
      var s = '';
      for (xx = 0; xx < W; xx++) { var t = tiles[key(xx, yy)]; s += !t ? ' ' : t.t === 'g' ? (t.h === 2 ? '.' : String(t.h)) : t.t === 'p' ? (t.h === 2 ? 'p' : t.h === 3 ? 'q' : 'Q') : t.t === 'f' ? (t.h === 2 ? 'f' : 'F') : t.t; }
      rows.push(s);
    }
    return rows.join('\n');
  }

  return { W: W, H: H, SIZE: SIZE, LV: LV, at: at, h: h, type: type, buildable: buildable, list: list, ascii: ascii, CENTRE: { x: 18, y: 16 } };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Terrain;
