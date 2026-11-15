/* City art (v1.0): the village, drawn in code on a canvas (no image files), in the classic pixel-game look:
   a 3/4 top-down view where you see rooftops, building fronts, cliffs face-on and winding paths.
   One tile is 24 x 24 pixels; everything is drawn at this small size and the screen scales it up by whole numbers, so edges stay crisp.
   How it is built:
   - The ground is painted pixel by pixel from the terrain map (js/terrain.js). Each tile type is a blob that spreads a little into
     its neighbours, with noise, so paths wind, ponds are round and the forest edge is ragged instead of square.
   - A height step lifts a tile by 16 pixels; the space it leaves below its front edge is drawn as a cliff, with stairs where a path
     climbs and a waterfall where water runs off an edge. The rocky underside hangs below the island.
   - Houses, trees and props are small sprites drawn once, given a 1px outline and a soft ground shadow, then stamped on top.
   Looks: day and night (dawn and dusk come later). A look tints every colour and lights the windows. */
var CityArt = (function () {
  var T = 24, LV = 16, HEAD = 80, SKIRT = 100;
  var MW = Terrain.W * T, MH = Terrain.H * T, CW = MW, CH = HEAD + MH + SKIRT;
  var BW = 128, BH = 128, AX = 40, AY = 84;                 // building sprite: (AX, AY) is the top-left corner of its footprint
  var DW = 56, DH = 64, DAX = 28, DAY = 56;                 // tree / prop sprite: (DAX, DAY) is the point it stands on

  var LOOKS = {
    day:   { id: 'day',   label: 'Day',   sky: ['#4F9BE3', '#7DB9EC', '#A9D3F0', '#D7E8E4', '#F1EDCF'], mix: null, lit: false, cloud: '#FFFFFF', cloudA: 0.92, stars: false, ink: [34, 44, 38] },
    night: { id: 'night', label: 'Night', sky: ['#0B1530', '#12224A', '#1B3366', '#274A82', '#3A5E96'], mix: ['#1D3557', 0.45], lit: true, cloud: '#7F9CCB', cloudA: 0.4, stars: true, ink: [8, 14, 28] }
  };
  function skyCss(look) {                                   // one smooth top-to-bottom gradient (no hard bands)
    var s = look.sky, stops = [];
    for (var i = 0; i < s.length; i++) stops.push(s[i] + ' ' + Math.round(i * 100 / (s.length - 1)) + '%');
    return 'linear-gradient(to bottom,' + stops.join(',') + ')';
  }

  /* ---------- colour helpers ---------- */
  function rgb(h) { h = h.replace('#', ''); return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)]; }
  function hex(r, g, b) { function p(n) { n = Math.max(0, Math.min(255, Math.round(n))); return (n < 16 ? '0' : '') + n.toString(16); } return '#' + p(r) + p(g) + p(b); }
  var mixMemo = {};
  function mix(a, b, t) {
    var k = a + b + t; if (mixMemo[k]) return mixMemo[k];
    var A = rgb(a), B = rgb(b);
    return (mixMemo[k] = hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t));
  }
  /* five tones from one base colour: warm and bright where the light hits, cool and deep in the shade */
  var rampMemo = {};
  function ramp(base) {
    return rampMemo[base] || (rampMemo[base] = { hi: mix(base, '#FFF4B8', 0.5), lt: mix(base, '#FFF1B0', 0.22), md: base, dk: mix(base, '#2B3A6E', 0.3), xd: mix(base, '#1A2144', 0.55) });
  }
  function hash(a, b) { var h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; }
  function nz(x, y, scale, seed) {                           // smooth noise 0..1
    var fx = x / scale, fy = y / scale, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
    tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
    function r(a, b) { return (hash(a + seed * 977, b) % 1000) / 1000; }
    var a = r(ix, iy), b = r(ix + 1, iy), c = r(ix, iy + 1), d = r(ix + 1, iy + 1);
    return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
  }
  function tint(h, look) { return look.mix ? mix(h, look.mix[0], look.mix[1]) : h; }

  var G = ramp('#79BE45'), F = ramp('#3F8F45'), PA = ramp('#D4B47C'), WA = ramp('#4FAEE2'), RK = ramp('#B9B4A8'), ER = ramp('#9C6A44'), FA1 = ramp('#8DBB3C'), FA2 = ramp('#B6D14A'), FA3 = ramp('#EDC133');
  var SAND = '#DBC78F', INK_BANK = '#3E7A38';

  /* ---------- the ground: which kind of ground is each pixel? ---------- */
  var C = { VOID: 0, GR: 1, FO: 2, FA: 3, PA: 4, WA: 5 }, CLS = null;
  function classOf(t) { return t === 'f' ? C.FO : t === 'a' ? C.FA : t === 'p' ? C.PA : (t === 'w' || t === 'b') ? C.WA : C.GR; }
  var BIAS = [0, -0.02, 0, 0.02, 0.04, 0.07];
  function classes() {
    if (CLS) return CLS;
    CLS = new Uint8Array(MW * MH);
    var score = [0, 0, 0, 0, 0, 0], wx, wy, k;
    for (wy = 0; wy < MH; wy++) for (wx = 0; wx < MW; wx++) {
      var tx = (wx / T) | 0, ty = (wy / T) | 0, tile = Terrain.at(tx, ty);
      var u = (wx + 0.5) / T - 0.5, v = (wy + 0.5) / T - 0.5, i0 = Math.floor(u), j0 = Math.floor(v), fu = u - i0, fv = v - j0, own = tile ? classOf(tile.t) : C.VOID;
      for (k = 0; k < 6; k++) score[k] = 0;
      for (var di = 0; di < 2; di++) for (var dj = 0; dj < 2; dj++) {
        var nt = Terrain.at(i0 + di, j0 + dj), wgt = (di ? fu : 1 - fu) * (dj ? fv : 1 - fv), c;
        if (!nt) c = C.VOID; else if (tile && nt.h !== tile.h) c = own; else c = classOf(nt.t);
        if (!tile) { if (c === C.VOID) c = C.VOID; }
        score[c] += wgt;
      }
      if (!tile) { CLS[wy * MW + wx] = C.VOID; continue; }
      var best = own, bs = -9;
      for (k = 0; k < 6; k++) { if (!score[k]) continue; var s = score[k] + BIAS[k] + 0.3 * (nz(wx, wy, 6, k + 1) - 0.5) + 0.12 * ((hash(wx, wy + k) % 100) / 100 - 0.5); if (s > bs) { bs = s; best = k; } }
      CLS[wy * MW + wx] = best;
    }
    return CLS;
  }

  /* ---------- the ground: colours ---------- */
  function grassCol(wx, wy) {
    var big = nz(wx, wy, 13, 3), n = hash(wx >> 1, wy >> 1) % 100, base = big < 0.4 ? G.dk : big > 0.7 ? G.lt : G.md;
    if (n < 6) return base === G.md ? G.lt : G.md;
    if (n > 95) return base === G.lt ? G.md : G.dk;
    var h = hash(wx * 7 + 1, wy * 13) % 71;
    if (h === 0) return G.hi; if (h === 1) return G.xd;
    return base;
  }
  function forestCol(wx, wy) { var n = nz(wx, wy, 5, 4), h = hash(wx, wy) % 29; if (h === 0) return F.lt; if (h === 1) return F.xd; return n < 0.4 ? F.dk : n > 0.74 ? F.lt : F.md; }
  function pathCol(wx, wy) { var h = hash(wx, wy) % 97; if (h < 4) return PA.lt; if (h < 7) return PA.dk; if (h === 8 || h === 9) return '#B8B2A6'; return nz(wx, wy, 7, 5) < 0.35 ? PA.dk === PA.md ? PA.md : mix(PA.md, PA.dk, 0.4) : PA.md; }
  function fieldCol(wx, wy, tx, ty) {
    var kind = hash(tx >> 1, ty >> 1) % 4, row = (wy + (kind & 1)) % 6;
    if (row === 5) return '#5E8A2A';
    var base = kind === 0 ? FA1 : kind === 1 ? FA2 : kind === 2 ? FA3 : FA1;
    if (kind === 3) return row < 3 ? '#A7C93E' : '#7FAE34';
    var h = hash(wx, wy) % 9;
    return h === 0 ? base.lt : row < 3 ? base.md : base.dk;
  }
  function waterCol(wx, wy) {
    var r = (wx + (wy >> 2) * 7) % 13; if (r < 3 && wy % 4 === 0) return WA.lt; if (r === 7 && wy % 4 === 2) return WA.hi;
    if (hash(wx, wy) % 331 === 0) return '#FFFFFF';
    return nz(wx, wy, 9, 6) > 0.62 ? WA.lt : nz(wx, wy, 9, 6) < 0.3 ? WA.dk : WA.md;
  }
  var FLOWERS = ['#FFFFFF', '#FFE066', '#FF9CC2', '#C9A7F5'];

  /* ---------- the island canvas ---------- */
  var islandCache = {};
  function island(look) {
    if (islandCache[look.id]) return islandCache[look.id];
    var cls = classes(), cv = document.createElement('canvas'); cv.width = CW; cv.height = CH;
    var ctx = cv.getContext('2d'), img = ctx.createImageData(CW, CH), buf = new Uint32Array(img.data.buffer), pk = {};
    function pack(h) { var v = pk[h]; if (v === undefined) { var c = rgb(tint(h, look)); v = pk[h] = (255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]; } return v; }
    function put(x, y, h) { if (x >= 0 && y >= 0 && x < CW && y < CH) buf[y * CW + x] = pack(h); }
    function rect(x, y, w, hh, h) { for (var j = 0; j < hh; j++) for (var i = 0; i < w; i++) put(x + i, y + j, h); }
    function get(x, y) { return (x < 0 || y < 0 || x >= CW || y >= CH) ? 0 : buf[y * CW + x] >>> 24; }
    function shade(h, f) { return mix(h, '#1A2144', f); }
    var tiles = Terrain.list(), x, y, u, v;
    tiles.sort(function (a, b) { return a.y - b.y || a.x - b.x; });

    // ground, tile by tile from back to front
    tiles.forEach(function (t) {
      var tx = t.x, ty = t.y, h = t.h, Yt = HEAD + ty * T - (h - 2) * LV, hN = Terrain.h(tx, ty - 1), hE = Terrain.h(tx + 1, ty), hW = Terrain.h(tx - 1, ty);
      var wx, wy, c;
      function nb(dx, dy) {
        var nx = wx + dx, ny = wy + dy; if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) return c;
        if (((nx / T) | 0) !== tx || ((ny / T) | 0) !== ty) { if (Terrain.h((nx / T) | 0, (ny / T) | 0) !== h) return c; }
        return cls[ny * MW + nx];
      }
      for (v = 0; v < T; v++) for (u = 0; u < T; u++) {
        wx = tx * T + u; wy = ty * T + v; c = cls[wy * MW + wx];
        if (c === C.VOID) continue;
        var col, nU = nb(0, -1), nD = nb(0, 1), nL = nb(-1, 0), nR = nb(1, 0);
        if (c === C.WA) {
          col = waterCol(wx, wy);
          if ((nU !== C.WA && nU !== C.VOID) || (nL !== C.WA && nL !== C.VOID)) col = '#C7EBF8';
          else if ((nD !== C.WA && nD !== C.VOID) || (nR !== C.WA && nR !== C.VOID)) col = WA.dk;
        } else {
          col = c === C.GR ? grassCol(wx, wy) : c === C.FO ? forestCol(wx, wy) : c === C.PA ? pathCol(wx, wy) : fieldCol(wx, wy, tx, ty);
          if (c === C.GR && t.t === 'g' && h === 2 && hash(wx >> 2, wy >> 2) % 53 === 0 && (wx & 3) < 2 && (wy & 3) < 2) col = FLOWERS[hash(wx >> 2, wy >> 2) % 4];
          if (nU === C.WA || nD === C.WA || nL === C.WA || nR === C.WA) col = c === C.FO ? F.xd : (hash(wx, wy) % 5 === 0 ? G.dk : SAND);
          else if (c === C.PA && (nU === C.GR || nD === C.GR || nL === C.GR || nR === C.GR || nU === C.FO || nD === C.FO || nL === C.FO || nR === C.FO || nU === C.FA || nD === C.FA || nL === C.FA || nR === C.FA)) col = hash(wx, wy) % 3 === 0 ? PA.dk : mix(PA.md, PA.dk, 0.55);
          else if (c === C.GR && (nU === C.PA || nL === C.PA || nD === C.PA || nR === C.PA) && hash(wx, wy) % 3 === 0) col = G.lt;
          else if (c === C.FA && (nU !== C.FA || nD !== C.FA || nL !== C.FA || nR !== C.FA)) col = '#5E8A2A';
        }
        if (hN > h && v < 5) col = shade(col, 0.34 * (1 - v / 5));                 // the cliff above throws a soft shadow
        if (u >= T - 2 && (hE < h)) col = u === T - 1 ? RK.xd : RK.md;               // the side of a raised tile
        else if (u < 2 && (hW < h)) col = u === 0 ? RK.xd : RK.dk;
        put(wx, Yt + v, col);
      }
      // cliff below the front edge, column by column so rounded corners keep a clean line
      var hs = Terrain.h(tx, ty + 1);
      if (hs < h) {
        var Hf = hs ? (h - hs) * LV : (h - 1) * LV, fall = t.t === 'w', stairs = t.t === 'p' && Terrain.type(tx, ty + 1) === 'p' && hs === h - 1;
        for (u = 0; u < T; u++) {
          var wx2 = tx * T + u, last = -1;
          for (v = T - 1; v >= 0; v--) if (cls[(ty * T + v) * MW + wx2] !== C.VOID) { last = v; break; }
          if (last < 0) continue;
          var top = Yt + last + 1;
          for (var d = 0; d < Hf; d++) {
            var col2;
            if (fall && u >= 2 && u < T - 2) {
              var s = hash(wx2 >> 1, 5) % 6;
              col2 = d < 1 ? WA.lt : (s === 0 || (s === 1 && hash(wx2, d >> 2) % 2 === 0)) ? '#FFFFFF' : s < 3 ? WA.hi : (hash(wx2 >> 1, d >> 2) % 5 === 0 ? WA.dk : WA.lt);
            } else if (stairs && u >= 5 && u < T - 5) {
              var step = d % 4; col2 = step === 0 ? PA.hi : step === 1 ? PA.lt : step === 2 ? PA.dk : PA.xd;
            } else {
              var lip = 2 + (hash(wx2, ty) % 3);
              if (d < lip) col2 = d === 0 ? G.hi : d === lip - 1 ? G.dk : G.md;
              else {
                var band = Math.floor((d + hash(wx2 >> 3, 2) % 4) / 5), cr = hash(wx2 >> 1, band + ty * 3) % 11 === 0;
                col2 = band % 2 ? RK.md : RK.lt; if (cr) col2 = RK.dk; if (hash(wx2, d) % 31 === 0) col2 = RK.hi; if (hash(wx2 >> 1, d >> 1) % 89 === 0) col2 = '#8A8579';
                if (u > T * 0.66) col2 = mix(col2, '#4A3A30', 0.25); else if (u < 4) col2 = mix(col2, '#FFF4D0', 0.12);
                if (d >= Hf - 2 && hs) col2 = shade(col2, 0.3);
              }
            }
            put(wx2, top + d, col2);
          }
          if (fall && u >= 2 && u < T - 2 && hs) for (var m = 0; m < 5; m++) { if (hash(wx2, m) % 3) put(wx2, top + Hf + m - 2, '#EAF7FF'); }   // mist
        }
      }
      // bridges: planks across the water with rails
      if (t.t === 'b') {
        var horiz = (Terrain.type(tx - 1, ty) === 'p' || Terrain.type(tx + 1, ty) === 'p' || Terrain.type(tx - 1, ty) === 'b' || Terrain.type(tx + 1, ty) === 'b');
        var W0 = ramp('#B9824B');
        for (v = 0; v < T; v++) for (u = 0; u < T; u++) {
          var a = horiz ? u : v, b = horiz ? v : u;      // a runs along the bridge, b across it
          if (b < 4 || b > T - 5) continue;
          put(tx * T + u, Yt + v, (a % 4 === 3) ? W0.xd : (b === 4 || b === T - 5) ? W0.dk : hash(a >> 2, b) % 7 === 0 ? W0.lt : W0.md);
        }
        for (var q = 0; q < T; q += 6) {
          var pa = horiz ? [tx * T + q, Yt + 2] : [tx * T + 2, Yt + q], pb = horiz ? [tx * T + q, Yt + T - 3] : [tx * T + T - 3, Yt + q];
          rect(pa[0], pa[1] - 4, 2, 6, W0.dk); rect(pb[0], pb[1] - 4, 2, 6, W0.md);
        }
        if (horiz) { rect(tx * T, Yt + 2, T, 1, W0.lt); rect(tx * T, Yt + T - 3, T, 1, W0.md); }
        else { rect(tx * T + 2, Yt, 1, T, W0.lt); rect(tx * T + T - 3, Yt, 1, T, W0.md); }
      }
      // a fence along the edge of a field
      if (t.t === 'a') {
        var fr = ramp('#B07A45');
        [[0, -1, 'N'], [0, 1, 'S'], [-1, 0, 'W'], [1, 0, 'E']].forEach(function (d2) {
          var ntp = Terrain.type(tx + d2[0], ty + d2[1]); if (ntp === 'a' || ntp === 'w' || ntp === 'b' || ntp === 'p' || !ntp) return;
          if (d2[2] === 'N' || d2[2] === 'S') { var fy = Yt + (d2[2] === 'N' ? 1 : T - 3); rect(tx * T, fy, T, 1, fr.md); rect(tx * T, fy + 2, T, 1, fr.dk); for (var p2 = 1; p2 < T; p2 += 8) rect(tx * T + p2, fy - 3, 2, 6, fr.lt); }
          else { var fx = tx * T + (d2[2] === 'W' ? 1 : T - 3); rect(fx, Yt, 1, T, fr.md); for (var p3 = 2; p3 < T; p3 += 8) rect(fx - 1, Yt + p3, 3, 2, fr.lt); }
        });
      }
    });

    // the underside: rock and earth tapering to a point, with a few hanging roots
    var bottom = [], xmin = CW, xmax = 0;
    for (x = 0; x < CW; x++) { var lo = -1; for (y = CH - SKIRT; y >= 0; y--) if (get(x, y)) { lo = y; break; } bottom.push(lo); if (lo >= 0) { if (x < xmin) xmin = x; if (x > xmax) xmax = x; } }
    var xc = (xmin + xmax) / 2, half = (xmax - xmin) / 2 || 1;
    for (x = xmin; x <= xmax; x++) {
      if (bottom[x] < 0) continue;
      var tt = Math.abs(x - xc) / half, root = hash(x, 7) % 23 === 0;
      var depth = Math.round(8 + 60 * Math.pow(Math.max(0, 1 - tt * tt), 1.05) + 3 * Math.sin(x * 0.21) + 2 * Math.sin(x * 0.67 + 1));
      if (root) depth += 8 + hash(x, 3) % 8;
      for (var dy = 0; dy < depth; dy++) {
        var col3, band2 = Math.floor((dy + 3 * Math.sin(x * 0.17) + hash(x >> 2, 1) % 3) / 5);
        if (root && dy > depth - 10) col3 = dy % 3 ? '#5A3E2A' : '#4B8F4A';
        else { var base = dy < 14 ? RK : ER; col3 = band2 % 3 === 0 ? base.lt : band2 % 3 === 1 ? base.md : base.dk; if (dy > 40) col3 = ER.xd; }
        if (hash(x, dy) % 47 === 0) col3 = ER.hi; if (hash(x >> 1, dy >> 1) % 89 === 0) col3 = '#C6C0B4';
        if (x > xc) col3 = mix(col3, '#2A1A12', 0.24);
        put(x, bottom[x] + 1 + dy, col3);
      }
    }
    ctx.putImageData(img, 0, 0);
    outlineCanvas(ctx, CW, CH, look.ink);
    return (islandCache[look.id] = { canvas: cv, ox: 0, oy: HEAD });
  }
  function outlineCanvas(ctx, w, h, ink) {
    var im = ctx.getImageData(0, 0, w, h), d = im.data, mark = [], x, y;
    function on(i) { return d[i + 3] > 40; }
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      var i = (y * w + x) * 4;
      if (d[i + 3] > 40) continue;
      if ((x > 0 && on(i - 4)) || (x < w - 1 && on(i + 4)) || (y > 0 && on(i - w * 4)) || (y < h - 1 && on(i + w * 4))) mark.push(i);
    }
    mark.forEach(function (i) { d[i] = ink[0]; d[i + 1] = ink[1]; d[i + 2] = ink[2]; d[i + 3] = 255; });
    ctx.putImageData(im, 0, 0);
  }

  /* ---------- sprites ---------- */
  function newCanvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  /* a painter with its own origin: (ox, oy) is where (0, 0) lands on the canvas */
  function P(ctx, look, ox, oy) {
    var memo = {};
    function c(h) { if (!look.mix) return h; return memo[h] || (memo[h] = mix(h, look.mix[0], look.mix[1])); }
    var p = {
      lit: look.lit, ctx: ctx, c: c,
      R: function (x, y, w, h, col, raw) { ctx.fillStyle = raw ? col : c(col); ctx.fillRect(Math.round(ox + x), Math.round(oy + y), w, h); },
      D: function (cx, cy, rx, ry, col, raw) {                       // a filled ellipse, pixel by pixel
        ctx.fillStyle = raw ? col : c(col);
        for (var dy = -Math.round(ry); dy <= Math.round(ry); dy++) {
          var k = Math.sqrt(Math.max(0, 1 - (dy * dy) / ((ry + 0.5) * (ry + 0.5)))), half = Math.round(rx * k);
          ctx.fillRect(Math.round(ox + cx) - half, Math.round(oy + cy) + dy, half * 2 + 1, 1);
        }
      },
      shadow: function (x, y, w, h) { ctx.globalAlpha = 0.26; p.D(x + w / 2 + 2, y + h / 2 + 1, w / 2 + 1, h / 2, '#1F4A2E', true); ctx.globalAlpha = 1; }
    };
    return p;
  }
  var spriteCache = {};

  function roofFill(p, x, y, w, h, kind, col, back) {
    var r = ramp(col), backH = back, row, i, c;
    for (row = 0; row < h; row++) {
      var inset = row < 1 || row >= h - 0 ? 0 : 0, isBack = row < backH, x0 = x + (row < 2 ? 2 - row : 0), x1 = x + w - (row < 2 ? 2 - row : 0);
      for (i = x0; i < x1; i++) {
        var a = i - x, b = row;
        if (kind === 'solar') {
          var fr = (a % 7 === 0) || (b % 5 === 0), gl = ((a + b * 2) % 17 === 0 && (b % 5) > 1);
          c = fr ? '#CFE3F8' : gl ? '#7FB4F2' : isBack ? '#2B5CA8' : '#3A7BD5';
        } else if (kind === 'green') {
          var hh = hash(a, b) % 13; c = hh === 0 ? '#FFE066' : hh === 1 ? '#FF9CC2' : hh < 5 ? '#8FD36B' : isBack ? '#3E8F45' : '#5DB059';
          if (row >= h - 1) c = '#6B4A30';
        } else if (kind === 'thatch') {
          c = hash(a >> 1, b >> 1) % 4 === 0 ? r.dk : hash(a, b) % 9 === 0 ? r.hi : isBack ? r.dk : r.md; if (b % 4 === 3) c = r.dk;
        } else {                                                           // clay tiles in courses
          var course = Math.floor(b / 3), off = (course & 1) * 3, jx = (a + off) % 6;
          c = (b % 3 === 2) ? r.dk : (jx === 0 && b % 3 < 2) ? r.dk : (b % 3 === 0 ? (isBack ? r.md : r.lt) : (isBack ? r.dk : r.md));
        }
        p.R(i, y + row, 1, 1, c);
      }
    }
    p.R(x + 2, y + backH, w - 4, 1, mix(col, '#FFF4B8', 0.55));            // the ridge catches the light
    p.R(x, y + h - 1, w, 1, r.xd);                                         // eave edge
  }
  function winGlass(p, x, y, w, h) {
    if (p.lit) { p.ctx.globalAlpha = 0.28; p.R(x - 2, y - 2, w + 4, h + 4, '#FFC24A', true); p.ctx.globalAlpha = 0.18; p.R(x - 3, y - 3, w + 6, h + 6, '#FFC24A', true); p.ctx.globalAlpha = 1; p.R(x, y, w, h, '#FFE48A', true); }
    else p.R(x, y, w, h, '#6FA6D8');
    if (!p.lit) { p.R(x, y, 1, 1, '#CFE8FF'); } p.R(x + (w >> 1), y, 1, h, p.lit ? '#C98A2A' : '#3E6C9A');
  }
  function door(p, x, y, w, h, col) {                                      // bottom-left corner at (x, y)
    var d = ramp(col || '#8A5A3A');
    p.R(x, y - h, w, h, d.dk); p.R(x + 1, y - h + 1, w - 2, h - 1, d.md); p.R(x + 1, y - h + 1, 1, h - 1, d.lt); p.R(x + w - 2, y - h / 2, 1, 1, '#FFD76A', true);
    p.R(x + 1, y - h - 1, w - 2, 1, d.dk);
  }
  function flowerBox(p, x, y, w, cols) { p.R(x, y, w, 2, '#8A5A3A'); for (var i = 0; i < w; i += 2) p.R(x + i, y - 1, 1, 1, cols[(i >> 1) % cols.length]); }
  /* a small house seen from the front: wall, roof, door, windows. W and D are the footprint in pixels. */
  function cottage(p, W, D, o) {
    var wh = o.wh || 11, rh = o.rh || 14, wc = ramp(o.wall || '#F0E4C8'), wallTop = D - wh, i;
    p.R(0, wallTop, W, wh, wc.md); p.R(0, wallTop, W, 3, wc.dk); p.R(0, wallTop, 1, wh, wc.lt); p.R(W - 2, wallTop, 2, wh, wc.dk);
    for (i = 0; i < W; i += 3) if (hash(i, o.seed | 0) % 5 === 0) p.R(i, wallTop + 3 + hash(i, 4) % (wh - 5), 1, 1, wc.dk);
    p.R(0, D - 2, W, 2, '#9A9488'); p.R(0, D - 2, W, 1, '#B6B0A4');
    if (o.timber) { p.R(0, wallTop + 3, W, 1, '#7A4A2C'); p.R(W >> 1, wallTop + 3, 1, wh - 5, '#7A4A2C'); }
    roofFill(p, -2, wallTop - rh + 3, W + 4, rh, o.roofKind || 'tile', o.roof || '#C2573A', Math.round(rh * 0.38));
    if (o.solar) { roofFill(p, W * 0.12, wallTop - rh + 5 + 2, W * 0.5, Math.round(rh * 0.5), 'solar', '#3A7BD5', 0); }
    if (o.chimney) { p.R(W - 7, wallTop - rh + 1, 4, 6, '#B5533C'); p.R(W - 7, wallTop - rh + 1, 4, 1, '#8A3A28'); p.R(W - 7, wallTop - rh - 1, 4, 2, '#6E3A2A'); }
    var dx = o.doorX !== undefined ? o.doorX : (W >> 1) - 3;
    door(p, dx, D - 2, 6, 9, o.door);
    if (W >= 22) { var wx = dx > W / 2 ? 3 : W - 8; p.R(wx - 1, wallTop + 3, 6, 6, '#FFFFFF'); winGlass(p, wx, wallTop + 4, 4, 4); flowerBox(p, wx - 1, wallTop + 9, 6, ['#FF7AAE', '#FFE066', '#FFFFFF']); }
    p.R(dx - 2, D - 3, 1, 1, '#4F9F4A', true); p.R(dx + 7, D - 4, 2, 2, '#4F9F4A', true);
  }
  function awning(p, x, y, w, h, c1, c2) { for (var i = 0; i < w; i += 3) p.R(x + i, y, Math.min(3, w - i), h, (i / 3) % 2 ? c2 : c1); p.R(x, y + h, w, 1, '#1A2144', true); }

  /* ---- trees and rocks: DAX/DAY is the foot ---- */
  var TR = { oak: ramp('#3FA25A'), oak2: ramp('#78B84A'), pine: ramp('#2C7A55'), birch: ramp('#8CCB6A'), blossom: ramp('#F08AB5'), bush: ramp('#3FA25A') };
  function canopy(p, cx, cy, r, rp, seed) {
    var lobes = [[-0.6, 0.15], [0, -0.5], [0.6, 0.1], [-0.25, 0.5], [0.4, 0.5], [0, 0.05], [-0.4, -0.3], [0.4, -0.25]], i, l;
    for (i = 0; i < lobes.length; i++) { l = lobes[i]; p.D(cx + l[0] * r + 1, cy + l[1] * r * 0.85 + 2, r * 0.52, r * 0.47, rp.xd); }
    for (i = 0; i < lobes.length; i++) { l = lobes[i]; p.D(cx + l[0] * r, cy + l[1] * r * 0.85, r * 0.52, r * 0.47, rp.dk); }
    for (i = 0; i < lobes.length; i++) { l = lobes[i]; p.D(cx + l[0] * r - 1, cy + l[1] * r * 0.85 - 1, r * 0.4, r * 0.36, rp.md); }
    for (i = 0; i < lobes.length; i++) { l = lobes[i]; if (l[0] <= 0.1 && l[1] <= 0.3) p.D(cx + l[0] * r - 2, cy + l[1] * r * 0.85 - 2, r * 0.22, r * 0.18, rp.lt); }
    p.R(cx - r * 0.4, cy - r * 0.6, 2, 1, rp.hi);
    for (i = 0; i < Math.round(r * 1.6); i++) { var h = hash(i + (seed | 0), 17), ang = (h % 628) / 100, rad = ((h >>> 9) % 100) / 100 * r * 0.8; var px = cx + Math.cos(ang) * rad, py = cy + Math.sin(ang) * rad * 0.78; p.R(px, py, 2, 1, (px < cx && py < cy) ? rp.hi : (px > cx && py > cy ? rp.xd : rp.lt)); }
  }
  var DECOR = {
    oak: function (p) { p.R(-2, -9, 4, 9, '#7A4A2C'); p.R(-2, -9, 1, 9, '#A8723F'); p.R(1, -9, 1, 9, '#5A3A22'); canopy(p, 0, -17, 9.5, TR.oak, 1); },
    oak2: function (p) { p.R(-2, -8, 4, 8, '#7A4A2C'); p.R(-2, -8, 1, 8, '#A8723F'); canopy(p, 0, -15, 8, TR.oak2, 9); },
    birch: function (p) { p.R(-1, -12, 3, 12, '#EDE8DC'); p.R(0, -8, 2, 1, '#2A2A30'); p.R(-1, -4, 2, 1, '#2A2A30'); canopy(p, 0, -17, 7.5, TR.birch, 3); },
    blossom: function (p) { p.R(-2, -8, 4, 8, '#6B4B30'); canopy(p, 0, -16, 9, TR.blossom, 5); },
    pine: function (p) {
      var rp = TR.pine; p.R(-1, -5, 3, 5, '#7A4A2C');
      [[8, 9, 13], [7, 15, 10], [5.5, 21, 8], [3.5, 26, 7]].forEach(function (t, i) { var y = -t[1] + 6, hw = Math.round(t[0]); for (var r = 0; r < t[2]; r++) { var w2 = Math.round(hw * (r + 1) / t[2]); p.R(-w2, y - t[2] + r + 1, w2 * 2, 1, r < 3 ? rp.lt : r < t[2] - 2 ? rp.md : rp.dk); p.R(w2 - 2, y - t[2] + r + 1, 2, 1, rp.dk); } p.R(-hw, y, hw * 2, 1, rp.xd); });
    },
    bush: function (p) { canopy(p, 0, -4, 5.5, TR.bush, 4); },
    bushflower: function (p) { canopy(p, 0, -4, 5.5, TR.bush, 4); [[-3, -7, '#FFFFFF'], [2, -9, '#FFAFCC'], [3, -4, '#FFE066'], [-1, -3, '#FFFFFF']].forEach(function (f) { p.R(f[0], f[1], 2, 2, f[2]); }); },
    rock: function (p) {
      var r = ramp('#A4A8B0'); p.D(0, -4, 8, 5, r.dk); p.D(-1, -5, 7, 4, r.md); p.D(-2, -7, 4, 2, r.lt); p.R(-3, -9, 2, 1, r.hi); p.R(-5, -6, 3, 1, '#6BBF6B'); p.R(1, -1, 5, 1, r.xd);
    },
    rocks: function (p) { DECOR.rock(p); p.D(8, -2, 4, 3, '#8E98A4'); p.D(7, -3, 3, 2, '#B7BDC6'); },
    stump: function (p) { var r = ramp('#8A5A3A'); p.R(-5, -6, 10, 6, r.md); p.R(-5, -6, 2, 6, r.lt); p.R(3, -6, 2, 6, r.dk); p.D(0, -6, 5, 2, r.lt); p.D(0, -6, 3, 1, '#E3B77A'); },
    /* props on the village paths */
    well: function (p) { var s = ramp('#B9B4A8'); p.D(0, -2, 8, 4, s.dk); p.D(0, -4, 7, 3, s.md); p.D(0, -5, 5, 2, '#3F8FC8'); p.R(-8, -3, 16, 3, s.md); p.R(-8, -3, 16, 1, s.lt); p.R(-6, -14, 2, 11, '#7A4A2C'); p.R(5, -14, 2, 11, '#7A4A2C'); p.R(-8, -17, 16, 3, '#C2573A'); p.R(-8, -17, 16, 1, '#E27A55'); p.R(-1, -12, 1, 5, '#2A2A30'); p.R(-2, -8, 3, 3, '#8A5A3A'); },
    lamp: function (p) {                                                    // slim iron post with a small glass lantern
      if (p.lit) { p.ctx.globalAlpha = 0.16; p.D(0, -1, 17, 9, '#FFD76A', true); p.ctx.globalAlpha = 0.2; p.D(0, -1, 11, 6, '#FFD76A', true); p.ctx.globalAlpha = 0.28; p.D(0, -1, 6, 3, '#FFE9A0', true); p.ctx.globalAlpha = 1; }
      p.R(-2, -2, 4, 2, '#3B4450');                                         // base
      p.R(-1, -15, 2, 13, '#4A5560'); p.R(-1, -15, 1, 13, '#6C7A88');       // post
      p.R(-3, -16, 6, 1, '#3B4450');                                        // lantern floor
      p.R(-2, -21, 4, 5, p.lit ? '#FFE48A' : '#F3E7BC', true); p.R(-2, -21, 1, 5, p.lit ? '#FFF6C8' : '#FFFFFF', true);
      p.R(-3, -23, 6, 2, '#3B4450'); p.R(-1, -24, 2, 1, '#3B4450');         // cap
      if (p.lit) { p.ctx.globalAlpha = 0.3; p.D(0, -19, 5, 5, '#FFD76A', true); p.ctx.globalAlpha = 1; }
    },
    bench: function (p) { p.R(-7, -7, 14, 2, '#A8723F'); p.R(-7, -4, 14, 2, '#C98A5A'); p.R(-6, -3, 2, 3, '#6B4B30'); p.R(4, -3, 2, 3, '#6B4B30'); p.R(-7, -8, 14, 1, '#6B4B30'); },
    sign: function (p) { p.R(-1, -12, 2, 12, '#7A4A2C'); p.R(-7, -16, 14, 6, '#C98A5A'); p.R(-7, -16, 14, 1, '#E3B77A'); p.R(-5, -14, 10, 1, '#6B4B30'); p.R(-5, -12, 6, 1, '#6B4B30'); },
    flowers: function (p) { [[-6, -2], [-1, -4], [4, -2], [-3, 0], [2, 1]].forEach(function (f, i) { p.R(f[0], f[1] - 2, 1, 3, '#3F8F45'); p.R(f[0] - 1, f[1] - 4, 3, 2, ['#FF9CC2', '#FFE066', '#FFFFFF', '#C9A7F5', '#FF8F6B'][i]); p.R(f[0], f[1] - 3, 1, 1, '#FFD76A'); }); },
    barrel: function (p) { p.R(-4, -8, 8, 8, '#8A5A3A'); p.R(-4, -8, 2, 8, '#B07A45'); p.R(-4, -6, 8, 1, '#4A3220'); p.R(-4, -2, 8, 1, '#4A3220'); },
    haystack: function (p) { var h = ramp('#E3C25A'); p.D(0, -5, 9, 6, h.dk); p.D(-1, -6, 8, 5, h.md); p.D(-2, -9, 4, 2, h.lt); p.R(-5, -3, 1, 3, h.xd); },
    scarecrow: function (p) { p.R(-1, -16, 2, 16, '#7A4A2C'); p.R(-8, -12, 16, 2, '#7A4A2C'); p.R(-4, -11, 8, 6, '#3A7BD5'); p.D(0, -18, 3, 3, '#E3B77A'); p.R(-4, -21, 8, 2, '#C98A5A'); p.R(-2, -24, 4, 3, '#C98A5A'); },
    bambooclump: function (p) { [[-6, 0, 22], [-3, 2, 28], [0, 0, 20], [3, 2, 26], [6, 1, 18]].forEach(function (s) { p.R(s[0], -s[2] + s[1], 2, s[2], '#8CC152'); p.R(s[0], -s[2] + s[1], 1, s[2], '#B7DB78'); for (var n = 4; n < s[2]; n += 7) p.R(s[0], s[1] - n, 2, 1, '#5D8F34'); p.R(s[0] - 3, -s[2] + s[1] + 2, 4, 1, '#4FA262'); p.R(s[0] + 2, -s[2] + s[1] + 5, 4, 1, '#4FA262'); }); }
  };

  /* ---- villagers: 4 outfits x 4 directions (d, u, l, r) x 2 walking frames. kind names look like 'cit2l1'. Feet at (0, 0). ---- */
  var CIT = [['#3FA2A0', '#4A5568', '#5A3A22', '#F0C7A0'], ['#D9534F', '#6B4B30', '#2A2A30', '#C98E66'], ['#F2C94C', '#3A5BA0', '#B5651D', '#F0C7A0'], ['#8E6BBF', '#35503A', '#D8B45A', '#E3B48A']];
  CIT.forEach(function (c, o) {
    'dulr'.split('').forEach(function (d) {
      [0, 1].forEach(function (f) {
        DECOR['cit' + o + d + f] = function (p) {                                         // about 13px tall: shorter than a door frame
          var sh = ramp(c[0]).dk, bob = f ? -1 : 0, a = f ? 1 : 0, side = d === 'l' || d === 'r', dir = d === 'l' ? -1 : 1;
          p.R(-2, -3 + (f ? 0 : 1), 2, 3 - (f ? 0 : 1), c[1]); p.R(0, -3 + (f ? 1 : 0), 2, 3 - (f ? 1 : 0), c[1]);        // legs swap each frame
          p.R(-3, -8 + bob, 6, 5, c[0]); p.R(2, -8 + bob, 1, 5, sh); p.R(-3, -4 + bob, 6, 1, sh);                          // body
          if (side) p.R(-1 - a * dir, -7 + bob, 2, 3, sh); else { p.R(-4, -7 + bob + a, 1, 3, sh); p.R(3, -7 + bob - a, 1, 3, sh); }
          p.R(-2, -13 + bob, 5, 5, c[3]);                                                                                    // head
          if (d === 'd') { p.R(-2, -13 + bob, 5, 2, c[2]); p.R(-2, -11 + bob, 1, 1, c[2]); p.R(2, -11 + bob, 1, 1, c[2]); p.R(-1, -10 + bob, 1, 1, '#222'); p.R(1, -10 + bob, 1, 1, '#222'); }
          else if (d === 'u') p.R(-2, -13 + bob, 5, 4, c[2]);
          else { p.R(-2, -13 + bob, 5, 2, c[2]); p.R(dir > 0 ? -2 : 1, -11 + bob, 2, 3, c[2]); p.R(dir > 0 ? 1 : -1, -10 + bob, 1, 1, '#222'); }
        };
      });
    });
  });

  /* ---- buildings: (0, 0) is the top-left corner of the footprint ---- */
  var SPR = {};
  SPR['bamboo-home'] = function (p, W, D) {
    cottage(p, W, D, { wall: '#E8D98F', roofKind: 'thatch', roof: '#8CAF4A', wh: 13, rh: 15, door: '#6B4B30', solar: true, chimney: true, seed: 1 });
    var i; for (i = 1; i < W - 2; i += 3) { p.R(i, D - 1, 2, 4, '#F4EFE0'); p.R(i, D - 1, 1, 4, '#FFFFFF'); }          // picket fence along the front
    p.R(0, D + 1, W, 1, '#C9C2B0');
    p.R(2, D + 2, 3, 2, '#FF7AAE'); p.R(W - 6, D + 2, 3, 2, '#FFE066');                                              // garden flowers
    DECOR.bambooclump(shift(p, W + 2, D - 2));
  };
  SPR['corner-shop'] = function (p, W, D) {
    cottage(p, W, D, { wall: '#F4EAD0', roofKind: 'tile', roof: '#3FA2A0', wh: 11, rh: 13, door: '#6B4B30', doorX: 4, timber: true, seed: 2 });
    awning(p, 2, D - 14, 13, 3, '#D9342B', '#F4EFE0'); p.R(15, D - 17, 7, 5, '#7A4A2C'); p.R(16, D - 16, 5, 3, '#FFE066'); p.R(18, D - 15, 1, 1, '#D9342B');
    p.R(16, D - 6, 5, 4, '#A8723F'); p.R(17, D - 8, 3, 2, '#6BBF6B');
  };
  SPR['hospital'] = function (p, W, D) {
    var wc = ramp('#F2F6F2'), wt = D - 18;
    p.R(0, wt, W, 18, wc.md); p.R(0, wt, W, 3, wc.dk); p.R(0, wt, 1, 18, '#FFFFFF'); p.R(W - 2, wt, 2, 18, wc.dk); p.R(0, D - 2, W, 2, '#9A9488');
    roofFill(p, -2, wt - 17, W + 4, 18, 'tile', '#E9EEE9', 6);
    roofFill(p, 3, wt - 12, 17, 10, 'solar', '#3A7BD5', 0); roofFill(p, W - 22, wt - 12, 17, 10, 'green', '#5DB059', 0);
    p.R(W / 2 - 7, wt - 28, 14, 14, '#F2F6F2'); p.R(W / 2 - 7, wt - 28, 14, 2, '#E9EEE9'); p.R(W / 2 - 1, wt - 26, 3, 10, '#D9342B'); p.R(W / 2 - 5, wt - 23, 11, 3, '#D9342B');
    p.R(W / 2 - 8, wt - 29, 16, 1, '#8FA0B0');
    p.R(W / 2 - 7, wt + 2, 14, 16, '#2F4858'); p.R(W / 2 - 6, wt + 3, 12, 15, '#9BDCCB'); p.R(W / 2, wt + 3, 1, 15, '#2F4858'); p.R(W / 2 - 6, wt + 3, 4, 1, '#E7FBF5');
    awning(p, W / 2 - 10, wt - 1, 20, 3, '#2FA38F', '#F4F8F4');
    [4, 12, W - 16, W - 8].forEach(function (x) { p.R(x - 1, wt + 6, 6, 7, '#FFFFFF'); winGlass(p, x, wt + 7, 4, 5); });
    p.R(4, D - 4, 6, 2, '#C98A5A'); p.R(W - 12, D - 4, 6, 2, '#C98A5A');
  };
  SPR['market'] = function (p, W, D) {
    [[0, '#D9342B', '#F4EFE0'], [W / 2, '#2FA38F', '#F4EFE0']].forEach(function (s, i) {
      var x = s[0] + 1, w = W / 2 - 2;
      p.R(x, D - 9, w, 9, '#A8723F'); p.R(x, D - 9, w, 2, '#C98A5A'); p.R(x, D - 3, w, 1, '#6B4B30');
      [['#E8654A', 2], ['#FFE066', 7], ['#6BBF6B', 12]].forEach(function (f) { p.R(x + f[1], D - 12, 4, 3, f[0]); p.R(x + f[1], D - 12, 4, 1, '#FFF4C4'); });
      p.R(x + 1, D - 22, 2, 14, '#7A4A2C'); p.R(x + w - 3, D - 22, 2, 14, '#7A4A2C');
      awning(p, x - 1, D - 27, w + 2, 8, s[1], s[2]); p.R(x - 1, D - 19, w + 2, 2, mix(s[1], '#1A2144', 0.3));
    });
    p.R(W / 2 - 1, D - 36, 1, 14, '#2A2A30'); p.R(W / 2, D - 36, 8, 5, '#FFE066'); p.R(W / 2 + 1, D - 34, 4, 1, '#D9342B');
    p.R(W / 2 - 4, D - 5, 4, 5, '#A8723F'); p.R(W / 2 - 4, D - 7, 4, 2, '#6BBF6B');
  };
  SPR['solar-array'] = function (p, W, D) {
    [0, 1].forEach(function (i) {
      var x = 2 + i * (W / 2), w = W / 2 - 4;
      p.R(x + 3, D - 6, 2, 6, '#8FA0B0'); p.R(x + w - 5, D - 6, 2, 6, '#8FA0B0');
      for (var r = 0; r < 12; r++) { var row = D - 18 + r, sh = r / 12; for (var c = 0; c < w; c++) { var frame = (c % 6 === 0) || (r % 4 === 0); p.R(x + c, row, 1, 1, frame ? '#CFE3F8' : ((c + r) % 9 === 0 ? '#7FB4F2' : (r < 5 ? '#2B5CA8' : '#3A7BD5'))); } }
      p.R(x, D - 6, w, 1, '#5D6B78'); p.R(x, D - 18, w, 1, '#CFE3F8');
    });
    p.R(W - 5, D - 9, 4, 6, '#DDE3E8'); p.R(W - 4, D - 7, 2, 1, '#6BFF9E', true);
  };
  SPR['vertical-farm'] = function (p, W, D) {
    p.R(1, D - 24, W - 2, 24, '#BFE8DC'); p.R(1, D - 24, W - 2, 2, '#E7FBF5');
    for (var r = 0; r < 4; r++) for (var c = 0; c < 3; c++) { p.R(3 + c * 6, D - 22 + r * 5, 5, 4, '#6FC25A'); p.R(3 + c * 6, D - 22 + r * 5, 5, 1, '#A8E08A'); p.R(3 + c * 6, D - 19 + r * 5, 5, 1, '#3F8F45'); }
    roofFill(p, -1, D - 34, W + 2, 11, 'solar', '#3A7BD5', 3);
    p.R(0, D - 2, W, 2, '#8FA0B0'); door(p, W / 2 - 3, D - 2, 6, 8, '#EEF3F8');
    if (p.lit) p.R(W - 3, D - 18, 2, 10, '#FF7AC8', true);
  };
  SPR['mimosa-garden'] = function (p, W, D) {
    p.R(1, D - 14, W - 2, 12, '#6FB84A'); p.R(1, D - 14, W - 2, 1, '#9AD36B'); p.R(0, D - 3, W, 2, '#8A5A3A'); p.R(0, D - 16, W, 2, '#8A5A3A');
    DECOR.blossom(shift(p, 7, D - 5)); DECOR.blossom(shift(p, 17, D - 3));
    [[3, 8], [12, 5], [19, 8], [10, 10]].forEach(function (f, i) { p.R(f[0], D - f[1], 3, 3, i % 2 ? '#FF9CC2' : '#FFE066'); p.R(f[0] + 1, D - f[1] + 1, 1, 1, '#FFFFFF'); });
    DECOR.bench(shift(p, W - 6, D - 1));
  };
  SPR['mycelium-lab'] = function (p, W, D) {
    cottage(p, W, D, { wall: '#C9B6DE', roofKind: 'tile', roof: '#8E75C4', wh: 10, rh: 11, door: '#5A4A70', seed: 3 });
    var pr = ramp('#7C62B8'); p.D(W / 2, D - 20, 9, 6, pr.dk); p.D(W / 2 - 1, D - 21, 8, 5, pr.md); p.D(W / 2 - 3, D - 23, 3, 1, pr.lt); p.R(W / 2 - 4, D - 21, 1, 1, '#FFFFFF'); p.R(W / 2 + 2, D - 20, 1, 1, '#8EF9F3', true);
    [[3, D - 3], [W - 5, D - 2]].forEach(function (m) { p.R(m[0], m[1] - 3, 1, 3, '#F1E6CF'); p.D(m[0], m[1] - 4, 3, 2, '#8E75C4'); p.R(m[0] - 1, m[1] - 5, 1, 1, '#FFFFFF'); });
  };
  SPR['timber-grove'] = function (p, W, D) {
    DECOR.pine(shift(p, 7, D - 8)); DECOR.oak(shift(p, 17, D - 4)); DECOR.birch(shift(p, 12, D - 1));
    [[0, 0], [4, 0], [8, 0], [2, -3], [6, -3]].forEach(function (l) { p.D(W - 12 + l[0], D - 3 + l[1], 2.5, 2, '#9C6A3A'); p.D(W - 12 + l[0], D - 3 + l[1], 1.5, 1, '#E3B77A'); });
  };
  SPR['quarry'] = function (p, W, D) {
    p.R(0, D - 18, W, 18, '#8A8579'); p.R(2, D - 16, W - 4, 14, '#6E6A60');
    [[3, 6, 8], [11, 9, 11], [16, 5, 7]].forEach(function (b, i) { var r = ramp(i % 2 ? '#B9B4A8' : '#A4A8B0'); p.R(b[0], D - b[1] - b[2] + 4, 7, b[2], r.md); p.R(b[0], D - b[1] - b[2] + 4, 7, 2, r.lt); p.R(b[0] + 5, D - b[1] - b[2] + 4, 2, b[2], r.dk); });
    p.R(W - 7, D - 27, 2, 20, '#7A4A2C'); p.R(W - 16, D - 27, 11, 2, '#A8723F'); p.R(W - 16, D - 25, 1, 6, '#2A2A30'); p.R(W - 18, D - 19, 5, 4, '#6B4B30');
  };
  SPR['recycling-foundry'] = function (p, W, D) {
    p.R(0, D - 16, W, 16, '#8FA8BD'); p.R(0, D - 16, W, 3, '#C9D8E6'); p.R(0, D - 16, 1, 16, '#E1ECF6'); p.R(W - 2, D - 16, 2, 16, '#5E7A92');
    for (var i = 4; i < W; i += 5) p.R(i, D - 13, 1, 11, '#7391A8');
    roofFill(p, -2, D - 28, W + 4, 13, 'tile', '#6E86A0', 5);
    p.R(W - 8, D - 38, 5, 14, '#B5533C'); p.R(W - 8, D - 38, 5, 2, '#8A3A28');
    p.D(W - 5, D - 42, 3, 2, '#E8ECEF'); p.D(W - 3, D - 46, 3, 2, '#CBD3DA');
    p.R(W / 2 - 5, D - 9, 10, 9, '#2A2A30'); p.R(W / 2 - 4, D - 8, 8, 7, p.lit ? '#FFC36B' : '#E8854A'); p.R(W / 2 - 2, D - 6, 4, 3, '#FFF1B0');
    p.R(3, D - 11, 5, 5, '#EEF3F8'); p.R(4, D - 10, 3, 3, '#8FA8BD');
  };
  SPR['barracks'] = function (p, W, D) {
    cottage(p, W, D, { wall: '#CFC6B4', roofKind: 'tile', roof: '#5C7FC8', wh: 12, rh: 13, door: '#6B4B30', doorX: 4, seed: 4 });
    p.R(W - 7, -9, 1, 12, '#2A2A30'); p.R(W - 6, -9, 7, 5, '#D9342B'); p.R(W - 5, -8, 4, 1, '#FFE066');
    p.R(W - 5, D - 11, 2, 9, '#7A4A2C'); p.D(W - 4, D - 13, 3, 3, '#D9B36A'); p.R(W - 8, D - 9, 8, 1, '#7A4A2C');
  };
  SPR['armory'] = function (p, W, D) {
    cottage(p, W, D, { wall: '#9AA0AA', roofKind: 'tile', roof: '#5A6470', wh: 12, rh: 12, door: '#4A3A30', doorX: 4, chimney: true, seed: 5 });
    p.R(W - 9, D - 17, 7, 9, '#C9A227'); p.R(W - 8, D - 16, 5, 7, '#E3C25A'); p.R(W - 6, D - 15, 1, 5, '#FFF3C4');
    p.R(2, D - 5, 7, 2, '#3A3F46'); p.R(3, D - 7, 5, 2, '#5D6B78');
  };
  SPR['sky-garden-plaza'] = function (p, W, D) {
    p.R(0, 0, W, D, '#CFC6B4'); for (var yy = 2; yy < D - 2; yy += 6) for (var xx = 2; xx < W - 2; xx += 6) p.R(xx, yy, 5, 5, ((xx + yy) / 6) % 2 ? '#EFE7D2' : '#E3D9C0');
    p.R(0, 0, W, 2, '#A8A090'); p.R(0, D - 2, W, 2, '#A8A090'); p.R(0, 0, 2, D, '#B6AE9E'); p.R(W - 2, 0, 2, D, '#A8A090');
    var cx = W / 2, cy = D / 2 + 2; p.D(cx, cy, 11, 6, '#8E96A0'); p.D(cx, cy - 1, 9, 5, '#B9C2CC'); p.D(cx, cy - 1, 7, 4, '#5CB8E6'); p.D(cx - 2, cy - 2, 3, 1, '#9ADCF6'); p.R(cx - 1, cy - 12, 3, 10, '#D5DCE3'); p.D(cx, cy - 12, 4, 2, '#9ADCF6');
    DECOR.blossom(shift(p, 8, 14)); DECOR.blossom(shift(p, W - 8, 16));
    [[8, D - 8], [W - 10, D - 9], [14, 8], [W - 14, 9]].forEach(function (f, i) { p.D(f[0], f[1], 4, 2, i % 2 ? '#FF9CC2' : '#FFE066'); p.R(f[0] - 2, f[1] - 2, 2, 1, '#FFFFFF'); });
  };
  SPR['hero-hall'] = function (p, W, D) {
    p.R(0, D - 3, W, 3, '#CFC6B4');
    function tower(x) { p.R(x, D - 34, 12, 32, '#B3AA9B'); p.R(x, D - 34, 2, 32, '#D6CDBC'); p.R(x + 10, D - 34, 2, 32, '#8A8272'); roofFill(p, x - 2, D - 46, 16, 12, 'tile', '#5C7FC8', 4); p.R(x + 4, D - 24, 4, 6, '#6FA6D8'); p.R(x + 5, D - 56, 1, 10, '#2A2A30'); p.R(x + 6, D - 56, 6, 4, '#FFE066'); }
    tower(2); tower(W - 14);
    p.R(14, D - 28, W - 28, 26, '#B3AA9B'); p.R(14, D - 28, W - 28, 3, '#8A8272'); p.R(14, D - 28, 2, 26, '#D6CDBC');
    roofFill(p, 12, D - 46, W - 24, 20, 'tile', '#5C7FC8', 7);
    p.R(W / 2 - 7, D - 15, 14, 13, '#2A2A30'); p.R(W / 2 - 6, D - 14, 12, 12, '#7A4A2C'); p.R(W / 2, D - 14, 1, 12, '#2A2A30'); p.R(W / 2 - 3, D - 8, 1, 1, '#FFE066');
    [W / 2 - 14, W / 2 + 11].forEach(function (x) { p.R(x, D - 24, 3, 9, '#D9342B'); p.R(x, D - 16, 1, 2, '#D9342B'); p.R(x + 2, D - 16, 1, 2, '#D9342B'); p.R(x + 1, D - 22, 1, 3, '#FFE066'); });
    p.R(W / 2 - 1, D - 58, 1, 14, '#2A2A30'); p.R(W / 2, D - 58, 9, 5, '#FFE066'); p.R(W / 2 + 2, D - 56, 5, 1, '#D9342B');
  };
  function shift(p, dx, dy) { var q = {}, k; for (k in p) q[k] = p[k]; q.R = function (x, y, w, h, c, r) { p.R(x + dx, y + dy, w, h, c, r); }; q.D = function (x, y, rx, ry, c, r) { p.D(x + dx, y + dy, rx, ry, c, r); }; return q; }

  /* roads you lay: a dirt-and-flagstone path that joins the road tiles next to it (mask: 1 east, 2 south, 4 west, 8 north) */
  function roadSprite(p, mask) {
    var ctx = p.ctx, cx = 12, cy = 12;
    function cover(x, y) {
      var dx = Math.abs(x - 11.5), dy = Math.abs(y - 11.5), r = 6.4;
      if (dx * dx + dy * dy <= r * r + 4) return 2;
      if ((mask & 1) && x > 11 && dy <= 5.5) return 1; if ((mask & 4) && x <= 11 && dy <= 5.5) return 1;
      if ((mask & 2) && y > 11 && dx <= 5.5) return 1; if ((mask & 8) && y <= 11 && dx <= 5.5) return 1;
      return 0;
    }
    for (var y = 0; y < T; y++) for (var x = 0; x < T; x++) {
      if (!cover(x, y)) continue;
      var edge = !cover(x - 1, y) || !cover(x + 1, y) || !cover(x, y - 1) || !cover(x, y + 1);
      var gy = Math.floor(y / 4), jx = (x + (gy & 1) * 4) % 8, col;
      if (edge) col = PA.xd; else if (y % 4 === 0 || jx === 0) col = PA.dk; else col = hash(x >> 2, gy) % 5 === 0 ? PA.hi : hash(x >> 2, gy) % 3 === 0 ? PA.lt : '#C9B58A';
      p.R(x, y, 1, 1, col);
    }
  }

  /* kind is a building id, 'road0'..'road15' or a tree / prop id */
  function sprite(kind, look) {
    var key = kind + '|' + look.id;
    if (spriteCache[key]) return spriteCache[key];
    var res;
    if (kind.indexOf('road') === 0) {
      var out = newCanvas(T, T), p = P(out.getContext('2d'), look, 0, 0); roadSprite(p, parseInt(kind.slice(4), 10) || 0);
      res = { canvas: out, ax: 0, ay: 0 };
    } else if (SPR[kind]) {
      var t = Buildings.get(kind), W = t.w * T, D = t.d * T, o2 = newCanvas(BW, BH), octx = o2.getContext('2d'), body = newCanvas(BW, BH), bctx = body.getContext('2d');
      var sp = P(octx, look, AX, AY); sp.shadow(3, D - 12, W - 2, 12);
      SPR[kind](P(bctx, look, AX, AY), W, D);
      outlineCanvas(bctx, BW, BH, look.ink); octx.drawImage(body, 0, 0);
      res = { canvas: o2, ax: AX, ay: AY };
    } else if (DECOR[kind]) {
      var o3 = newCanvas(DW, DH), c3 = o3.getContext('2d'), b3 = newCanvas(DW, DH), bc3 = b3.getContext('2d');
      P(c3, look, DAX, DAY).shadow(-7, -2, 16, 5);
      DECOR[kind](P(bc3, look, DAX, DAY));
      outlineCanvas(bc3, DW, DH, look.ink); c3.drawImage(b3, 0, 0);
      res = { canvas: o3, ax: DAX, ay: DAY };
    } else res = { canvas: newCanvas(1, 1), ax: 0, ay: 0 };
    return (spriteCache[key] = res);
  }
  /* stamp a sprite: (X, Y) is its anchor on screen (a building's top-left footprint corner, or a tree's foot); z lifts it onto a hill */
  function drawItem(ctx, kind, look, X, Y, z) { var s = sprite(kind, look); ctx.drawImage(s.canvas, Math.round(X) - s.ax, Math.round(Y - (z || 0)) - s.ay); }

  /* ---------- scenery: trees on the forest tiles, props along the paths ---------- */
  function zOf(h) { return (h - 2) * LV; }
  function vh(x, y) { return Terrain.h(x, y); }
  var SCENERY = (function () {
    var out = [];
    Terrain.list().forEach(function (t) {
      var hh = hash(t.x * 5, t.y * 11), x0 = t.x * T, y0 = t.y * T;
      function tree(i, bx, by) {
        var r = hash(hh + i * 7, i + 3) % 14, kind = r < 5 ? 'oak' : r < 8 ? 'pine' : r < 9 ? 'birch' : r < 11 ? 'oak2' : r < 12 ? 'bushflower' : r < 13 ? 'blossom' : 'bush';
        out.push({ px: x0 + bx, py: y0 + by, kind: kind, z: zOf(t.h) });
      }
      if (t.t === 'f') { tree(0, 6 + hh % 6, 10 + (hh >>> 4) % 5); tree(1, 15 + (hh >>> 8) % 6, 20 + (hh >>> 12) % 3); if (hh % 3 === 0) tree(2, 20 + hh % 3, 9 + (hh >>> 6) % 4); if (hh % 4 === 1) tree(3, 4 + hh % 4, 22); }
      else if (t.t === 'r') out.push({ px: x0 + 12, py: y0 + 17, kind: hh % 2 ? 'rocks' : 'rock', z: zOf(t.h) });
      else if (t.t === 'a' && hh % 17 === 0) out.push({ px: x0 + 12, py: y0 + 16, kind: 'scarecrow', z: zOf(t.h) });
      else if (t.t === 'a' && hh % 17 === 3) out.push({ px: x0 + 12, py: y0 + 18, kind: 'haystack', z: zOf(t.h) });
    });
    return out;
  })();
  /* props placed by hand (tile coordinates, fractions allowed) */
  var PROPS = [
    { kind: 'well', tx: 18.5, ty: 16.6 }, { kind: 'lamp', tx: 17.3, ty: 15.5 }, { kind: 'lamp', tx: 19.7, ty: 15.5 }, { kind: 'lamp', tx: 17.3, ty: 17.7 }, { kind: 'lamp', tx: 19.7, ty: 17.7 },
    { kind: 'bench', tx: 17.7, ty: 17.9 }, { kind: 'bench', tx: 19.3, ty: 17.9 }, { kind: 'flowers', tx: 17.4, ty: 16.4 }, { kind: 'flowers', tx: 19.6, ty: 16.5 },
    { kind: 'sign', tx: 20.4, ty: 15.9 }, { kind: 'lamp', tx: 18.3, ty: 12.8 }, { kind: 'lamp', tx: 18.3, ty: 9.8 }, { kind: 'lamp', tx: 22.8, ty: 16.2 }, { kind: 'lamp', tx: 13.6, ty: 16.2 },
    { kind: 'barrel', tx: 21.2, ty: 15.3 }
  ].map(function (q) { var h = Terrain.h(Math.floor(q.tx), Math.floor(q.ty)) || 2; return { px: q.tx * T, py: q.ty * T, kind: q.kind, z: zOf(h) }; });
  SCENERY = SCENERY.concat(PROPS);

  /* ---------- sky: drifting clouds by day, stars at night (drawn in screen space, behind the island) ---------- */
  var CLOUDS = [[0.08, 0.1, 30, 0.6], [0.55, 0.06, 40, 0.45], [0.82, 0.22, 26, 0.8], [0.3, 0.3, 22, 0.35], [0.68, 0.4, 32, 0.55]];
  function drawSky(ctx, w, h, look, t) {
    var i;
    if (look.stars) {
      ctx.fillStyle = '#EEEEEE';
      for (i = 0; i < 40; i++) { var hh = hash(i, 91); if (hh % 3 === 0 && (hh >>> 5) % 5 === 0) continue; ctx.fillRect((hh >>> 3) % Math.max(1, w), (hh >>> 11) % Math.max(1, Math.floor(h * 0.6)), 1, 1); }
    }
    ctx.globalAlpha = look.cloudA; ctx.fillStyle = look.cloud;
    CLOUDS.forEach(function (c) {
      var span = w + c[2] + 20, cx = ((c[0] * w + t * c[3] * 1.5) % span) - c[2], cy = Math.round(c[1] * h);
      ctx.fillRect(Math.round(cx), cy, c[2], 4); ctx.fillRect(Math.round(cx) + 5, cy - 3, Math.round(c[2] * 0.5), 3); ctx.fillRect(Math.round(cx) + 3, cy + 4, c[2] - 8, 1);
    });
    ctx.globalAlpha = 1;
  }
  /* ---------- moving water: sparkles and drifting ripples on every water tile, and streaks down the waterfalls ---------- */
  var WATER = Terrain.list().filter(function (t) { return t.t === 'w'; }).map(function (t) {
    var inner = ['w', 'b'].indexOf(Terrain.type(t.x - 1, t.y)) >= 0 && ['w', 'b'].indexOf(Terrain.type(t.x + 1, t.y)) >= 0 && ['w', 'b'].indexOf(Terrain.type(t.x, t.y - 1)) >= 0 && ['w', 'b'].indexOf(Terrain.type(t.x, t.y + 1)) >= 0;
    var drop = Terrain.type(t.x, t.y + 1) === 'w' ? t.h - Terrain.h(t.x, t.y + 1) : 0;
    return { x: t.x, y: t.y, z: (t.h - 2) * LV, inner: inner, drop: Math.max(0, drop) };
  });
  function drawWater(ctx, ox, oy, look, t) {
    var hi = look.stars ? '#A9C6F2' : '#FFFFFF', lo = look.stars ? '#5C86C6' : '#7FC3F0';
    WATER.forEach(function (w) {
      var x0 = ox + w.x * T, y0 = oy + w.y * T - w.z, i, m = w.inner ? 3 : 7, span = T - m * 2;
      for (i = 0; i < 3; i++) {                                           // ripples drift to the right and wrap
        var hh = hash(w.x * 31 + i, w.y * 17 + 5), rx = (hh % span + Math.floor(t * (5 + i * 2))) % span, ry = m + (hh >>> 8) % span;
        ctx.globalAlpha = 0.55; ctx.fillStyle = lo; ctx.fillRect(Math.round(x0 + m + rx), Math.round(y0 + ry), 4, 1);
        ctx.globalAlpha = 0.9; ctx.fillStyle = hi; ctx.fillRect(Math.round(x0 + m + rx), Math.round(y0 + ry) - 1, 3, 1);
      }
      for (i = 0; i < 2; i++) {                                           // twinkles
        var h2 = hash(w.x * 13 + i, w.y * 29 + 9), ph = (t * 0.6 + (h2 % 100) / 100) % 1;
        if (ph < 0.18) { ctx.globalAlpha = 1; ctx.fillStyle = hi; ctx.fillRect(Math.round(x0 + m + h2 % span), Math.round(y0 + m + (h2 >>> 7) % span), ph < 0.09 ? 1 : 2, 1); }
      }
      ctx.globalAlpha = 1;
      if (w.drop) {                                                       // a waterfall: white streaks slide down the cliff face, mist at the foot
        var fh = w.drop * LV, fy = y0 + T, c;
        for (c = 3; c < T - 2; c += 4) {
          var sy = (Math.floor(t * 34) + c * 7) % fh;
          ctx.fillStyle = hi; ctx.fillRect(Math.round(x0 + c), Math.round(fy + sy), 1, Math.min(6, fh - sy));
          ctx.fillRect(Math.round(x0 + c + 2), Math.round(fy + (sy + fh / 2) % fh), 1, Math.min(4, fh - (sy + fh / 2) % fh));
        }
        ctx.globalAlpha = 0.5 + 0.2 * Math.sin(t * 5); ctx.fillStyle = hi;
        ctx.fillRect(Math.round(x0 + 2), Math.round(fy + fh - 2), T - 4, 3); ctx.fillRect(Math.round(x0 + 5), Math.round(fy + fh - 5), T - 10, 2); ctx.globalAlpha = 1;
      }
    });
  }
  /* ---------- puffy pixel clouds in the world (they float around and under the island) ---------- */
  var WCLOUDS = [   // [x, y, size, speed, in front?]  in world pixels, relative to the island's top-left
    [-250, 40, 2.8, 2.0, 0], [MW - 40, -20, 2.2, 1.4, 0], [MW + 80, 330, 3.2, 1.8, 0], [-200, 430, 2.4, 1.2, 0], [220, -150, 2.6, 1.6, 0], [660, -140, 2.0, 2.2, 0],
    [-80, HEAD + MH + 0, 3.4, 1.5, 1], [MW * 0.5, HEAD + MH + 50, 4.0, 1.0, 1], [MW - 180, HEAD + MH - 10, 2.6, 1.8, 1]
  ];
  function cloud(ctx, x, y, k, col, shade, a) {
    var blobs = [[0, 0, 22, 9], [-18, 3, 14, 7], [20, 3, 15, 7], [-6, -6, 13, 9], [10, -5, 11, 8]], i, b;
    ctx.globalAlpha = a;
    ctx.fillStyle = shade; for (i = 0; i < blobs.length; i++) { b = blobs[i]; ctx.fillRect(Math.round(x + (b[0] - b[2]) * k), Math.round(y + (b[1] - b[3] + 3) * k), Math.round(b[2] * 2 * k), Math.round(b[3] * 2 * k)); }
    ctx.fillStyle = col;   for (i = 0; i < blobs.length; i++) { b = blobs[i]; ctx.fillRect(Math.round(x + (b[0] - b[2]) * k), Math.round(y + (b[1] - b[3]) * k), Math.round(b[2] * 2 * k), Math.round(b[3] * 2 * k - 3 * k)); }
    ctx.globalAlpha = 1;
  }
  function drawWorldClouds(ctx, ox, oy, look, t, front) {
    var span = MW + 1000, shade = look.stars ? '#4C6694' : '#C9DDEE';
    WCLOUDS.forEach(function (c) {
      if ((c[4] === 1) !== !!front) return;
      var x = ((c[0] + 500 + t * c[3] * 3) % span + span) % span - 500;
      cloud(ctx, ox + x, oy + c[1], c[2], look.cloud, shade, front ? look.cloudA * 0.9 : look.cloudA);
    });
  }
  /* ---------- the cloud doors: two banks of cloud that close the screen, then slide apart (p: 0 = closed, 1 = open) ---------- */
  function drawCloudDoors(ctx, w, h, look, p) {
    var col = look.stars ? '#8FABD4' : '#FFFFFF', shade = look.stars ? '#566F9E' : '#C9DDEE', mid = Math.round(w / 2), off = Math.round(p * (mid + 150)), y, side, edge, dy, r, hw, i;
    function puff(cx, cy, rad, c) { for (dy = -rad; dy <= rad; dy += 2) { hw = Math.round(Math.sqrt(rad * rad - dy * dy)); ctx.fillStyle = c; ctx.fillRect(cx - hw, cy + dy, hw * 2, 2); } }
    for (side = -1; side <= 1; side += 2) {
      edge = mid + side * off;                                           // the puffy edge of this bank (it closes at the middle)
      ctx.fillStyle = shade; if (side < 0) ctx.fillRect(-300, 0, edge + 300 - 6, h); else ctx.fillRect(edge + 6, 0, w - edge, h);
      ctx.fillStyle = col;   if (side < 0) ctx.fillRect(-300, 0, edge + 300 - 10, h); else ctx.fillRect(edge + 10, 0, w - edge, h);
      for (y = -30; y < h + 50; y += 20) { r = 22 + hash(y, 7) % 14; var ex = edge - side * (hash(y, 3) % 16); puff(ex + side * 4, y + 6, r, shade); puff(ex, y, r, col); }
      for (i = 0; i < 14; i++) {                                         // soft darker patches inside, so the bank is not a flat wall
        var px = (hash(i, 21) % Math.max(1, Math.floor(w / 2 - 60))), py = hash(i, 22) % h;
        ctx.globalAlpha = 0.35; ctx.fillStyle = shade; ctx.fillRect(side < 0 ? edge - 70 - px : edge + 70 + px, py, 40 + hash(i, 23) % 50, 8); ctx.globalAlpha = 1;
      }
    }
  }
  /* a crisp 1-pixel rectangle outline on any canvas, for the build cursor */
  function frame(ctx, x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h); }

  return { LOOKS: LOOKS, skyCss: skyCss, island: island, sprite: sprite, drawItem: drawItem, SCENERY: SCENERY, drawSky: drawSky, drawWorldClouds: drawWorldClouds, drawWater: drawWater, drawCloudDoors: drawCloudDoors, frame: frame,
    T: T, LV: LV, HEAD: HEAD, MW: MW, MH: MH, CW: CW, CH: CH, zOf: zOf, vh: vh };
})();
