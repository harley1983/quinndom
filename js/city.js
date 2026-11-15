/* City engine (PRD E5): the tile grid, placing buildings and roads, paying for them, and the Credit score.
   Pure functions on plain data, so they can be tested in Node (node city.test.js). The screen and the save call these.
   State shape: { size: 36, buildings: [{ type, x, y, level }] }. Roads are buildings of type 'road' (one tile each).
   Rule FR-5.6: nothing here ever removes a building. */
var City = (function () {
  var B = typeof Buildings !== 'undefined' ? Buildings : require('./buildings.js');
  var T = typeof Terrain !== 'undefined' ? Terrain : require('./terrain.js');
  var SIZE = T.SIZE;      // the island is up to 36 x 36 tiles of terrain (see js/terrain.js)
  var MAX_BUILDINGS = 400;

  /* can you build on this tile? Only clear grass: not water, path, forest, rock or off the island */
  function inside(x, y) { return Math.floor(x) === x && Math.floor(y) === y && T.buildable(x, y); }
  function tileCount() { var n = 0; for (var x = 0; x < SIZE; x++) for (var y = 0; y < SIZE; y++) if (inside(x, y)) n++; return n; }

  /* a new city is already a small community: civic buildings, a few homes and a solar array (v0.9) */
  var STARTER = [
    { type: 'hospital', x: 14, y: 13, level: 1 }, { type: 'market', x: 21, y: 14, level: 1 }, { type: 'corner-shop', x: 16, y: 14, level: 1 },
    { type: 'bamboo-home', x: 13, y: 17, level: 1 }, { type: 'bamboo-home', x: 15, y: 19, level: 1 }, { type: 'bamboo-home', x: 22, y: 17, level: 1 }, { type: 'bamboo-home', x: 24, y: 19, level: 1 },
    { type: 'solar-array', x: 20, y: 20, level: 1 }
  ];
  function emptyState() { return { size: SIZE, buildings: STARTER.map(function (b) { return { type: b.type, x: b.x, y: b.y, level: b.level }; }) }; }
  function cellsOf(b) {
    var t = B.get(b.type), out = [];
    if (!t) return out;
    for (var dx = 0; dx < t.w; dx++) for (var dy = 0; dy < t.d; dy++) out.push([b.x + dx, b.y + dy]);
    return out;
  }
  /* "x,y" -> index in state.buildings, for every tile that is covered */
  function occupancy(state) {
    var m = {};
    state.buildings.forEach(function (b, i) { cellsOf(b).forEach(function (c) { m[c[0] + ',' + c[1]] = i; }); });
    return m;
  }
  function at(state, x, y, occ) {
    var i = (occ || occupancy(state))[x + ',' + y];
    return i === undefined ? null : state.buildings[i];
  }

  /* can this building stand with its top corner tile at (x, y)? */
  function canPlace(state, type, x, y, occ) {
    var t = B.get(type);
    if (!t || t.civic) return { ok: false, reason: 'unknown' };
    occ = occ || occupancy(state);
    var taken = false, h0 = T.h(x, y);
    for (var dx = 0; dx < t.w; dx++) for (var dy = 0; dy < t.d; dy++) {
      if (!inside(x + dx, y + dy)) return { ok: false, reason: 'outside' };
      if (T.h(x + dx, y + dy) !== h0) return { ok: false, reason: 'uneven' };
      if (occ[(x + dx) + ',' + (y + dy)] !== undefined) taken = true;
    }
    return taken ? { ok: false, reason: 'taken' } : { ok: true };
  }

  /* what is still missing to pay for it: { stone: 3 } or null when the player can afford it */
  function missing(resources, type) {
    var t = B.get(type), out = {}, any = false;
    if (!t) return null;
    Object.keys(t.cost).forEach(function (k) {
      var have = (resources && resources[k]) || 0;
      if (have < t.cost[k]) { out[k] = t.cost[k] - have; any = true; }
    });
    return any ? out : null;
  }

  /* place one building. Returns new state and resources (the inputs are not changed), or { ok:false, reason, missing? } */
  function place(state, resources, type, x, y) {
    var c = canPlace(state, type, x, y);
    if (!c.ok) return c;
    var miss = missing(resources, type);
    if (miss) return { ok: false, reason: 'cost', missing: miss };
    var t = B.get(type), res = {};
    Object.keys(resources).forEach(function (k) { res[k] = resources[k]; });
    Object.keys(t.cost).forEach(function (k) { res[k] -= t.cost[k]; });
    var b = { type: type, x: x, y: y, level: 1 };
    return { ok: true, state: { size: state.size, buildings: state.buildings.concat([b]) }, resources: res, building: b };
  }

  /* Credit score = the sum of all building values (cost x level) */
  function creditScore(state) {
    var n = 0;
    state.buildings.forEach(function (b) { n += B.value(b.type, b.level); });
    return n;
  }
  function stats(state) {
    var roads = 0, built = 0;
    state.buildings.forEach(function (b) { if (b.type === 'road') roads++; else built++; });
    return { buildings: built, roads: roads, credit: creditScore(state), tiles: tileCount() };
  }

  /* which of the four neighbours are roads: 1 = +x, 2 = +y, 4 = -x, 8 = -y (on screen: SE, SW, NW, NE) */
  function roadMask(state, x, y, occ) {
    occ = occ || occupancy(state);
    function road(a, b) { var i = occ[a + ',' + b]; return i !== undefined && state.buildings[i].type === 'road'; }
    return (road(x + 1, y) ? 1 : 0) | (road(x, y + 1) ? 2 : 0) | (road(x - 1, y) ? 4 : 0) | (road(x, y - 1) ? 8 : 0);
  }

  /* make any saved city safe: known types, whole numbers, on the island, nothing overlapping (the first one wins) */
  function clean(raw) {
    var out = { size: SIZE, buildings: [] };
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.buildings)) return emptyState();
    var taken = {};
    raw.buildings.slice(0, MAX_BUILDINGS).forEach(function (b) {
      if (!b || typeof b.type !== 'string' || !B.get(b.type)) return;
      var x = Number(b.x), y = Number(b.y), lv = Math.floor(Number(b.level));
      if (!isFinite(x) || !isFinite(y) || Math.floor(x) !== x || Math.floor(y) !== y) return;
      var nb = { type: b.type, x: x, y: y, level: isFinite(lv) && lv >= 1 ? Math.min(lv, 10) : 1 };
      var cells = cellsOf(nb), h0 = T.h(nb.x, nb.y);
      for (var i = 0; i < cells.length; i++) { if (!inside(cells[i][0], cells[i][1]) || T.h(cells[i][0], cells[i][1]) !== h0 || taken[cells[i][0] + ',' + cells[i][1]]) return; }
      cells.forEach(function (c) { taken[c[0] + ',' + c[1]] = true; });
      out.buildings.push(nb);
    });
    // civic buildings always stand (FR-5.9): put back any that are missing
    STARTER.forEach(function (st) {
      if (!B.get(st.type).civic) return;
      if (out.buildings.some(function (b) { return b.type === st.type && b.x === st.x && b.y === st.y; })) return;
      var cells = cellsOf(st);
      if (cells.some(function (c) { return taken[c[0] + ',' + c[1]]; })) return;
      cells.forEach(function (c) { taken[c[0] + ',' + c[1]] = true; });
      out.buildings.push({ type: st.type, x: st.x, y: st.y, level: 1 });
    });
    return out;
  }

  return { SIZE: SIZE, inside: inside, tileCount: tileCount, emptyState: emptyState, cellsOf: cellsOf, occupancy: occupancy, at: at,
    STARTER: STARTER, canPlace: canPlace, missing: missing, place: place, creditScore: creditScore, stats: stats, roadMask: roadMask, clean: clean };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = City;
