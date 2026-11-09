/* Zame engine: pure game logic, no DOM, no storage. Browser (window.ZameEngine) and Node (module.exports).
 *
 * Rules (QuinnDom Release 2, FR-4.4): find the exit of a generated maze. Every cell is reachable (a "perfect" maze: exactly one route between any two cells).
 *  - Easy 10x10, whole maze visible, no timer. Normal 15x15, whole maze visible, countdown timer. Hard 20x20, you only see 3 steps down the corridors around you
 *    (what you have walked past stays on the map), tighter timer.
 *  - Time limit = 30 s + par x seconds-per-step (par = length of the shortest route). The clock starts on the first move.
 *  - Arrow keys / swipes "run": you keep going along a corridor until a junction, a dead end or the exit.
 *  - A hint lights up the next 8 cells of the shortest route from where you stand. 3 hints on Easy and Normal, 2 on Hard (+ hero bonus).
 *  - Stars: by steps taken compared with par (every step counts, backtracking included). Reaching the exit in time is a win.
 *  - Game N of a difficulty is seeded, so it is the same maze for everyone. Save file keeps only how many mazes were completed.
 *  Cells are numbered row by row (cell = y * w + x). Passages are a bitmask per cell: N=1, E=2, S=4, W=8.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ZameEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var DIFFICULTIES = ["easy", "normal", "hard"];
  var SEED = 20261109;
  var SIZES = { easy: [10, 10], normal: [15, 15], hard: [20, 20] };
  var VIEW = { easy: 0, normal: 0, hard: 3 };                    // 0 = whole maze visible, otherwise how many steps down a corridor you can see
  var SECONDS_PER_STEP = { easy: 0, normal: 1.5, hard: 1.2 };     // 0 = no timer
  var HINTS = { easy: 3, normal: 3, hard: 2 };
  var HINT_CELLS = 8;
  var STAR_AT = { easy: [1.15, 1.8], normal: [1.3, 2.2], hard: [1.8, 3.2] };   // steps / par at or under which you earn 3 and 2 stars
  var N = 1, E = 2, S = 4, W = 8, DIRS = { up: N, right: E, down: S, left: W };
  var DX = {}, DY = {}, OPP = {}; DX[N] = 0; DY[N] = -1; DX[E] = 1; DY[E] = 0; DX[S] = 0; DY[S] = 1; DX[W] = -1; DY[W] = 0; OPP[N] = S; OPP[S] = N; OPP[E] = W; OPP[W] = E;
  var BITS = [N, E, S, W];

  /* ---------- seeded random ---------- */
  function rng(seed) {
    var a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  /* ---------- maze ---------- */
  function neighbour(maze, cell, bit) {
    var x = cell % maze.w, y = (cell - x) / maze.w, nx = x + DX[bit], ny = y + DY[bit];
    return nx < 0 || ny < 0 || nx >= maze.w || ny >= maze.h ? -1 : ny * maze.w + nx;
  }
  /** Shortest route between two cells, as a list of cells from `from` to `to` (inclusive). In a perfect maze it is the only simple route. */
  function route(maze, from, to) {
    var prev = new Int32Array(maze.w * maze.h).fill(-2), queue = [from]; prev[from] = -1;
    for (var qi = 0; qi < queue.length; qi++) {
      var c = queue[qi]; if (c === to) break;
      for (var i = 0; i < 4; i++) { var bit = BITS[i]; if (!(maze.cells[c] & bit)) continue; var n = neighbour(maze, c, bit); if (n >= 0 && prev[n] === -2) { prev[n] = c; queue.push(n); } }
    }
    var out = []; for (var p = to; p !== -1; p = prev[p]) out.push(p); return out.reverse();
  }
  /** Depth-first "recursive backtracker" maze: long winding corridors and few branches. The exit is the cell farthest from the start. */
  function makeMaze(w, h, seed) {
    var rand = rng(seed), cells = new Array(w * h).fill(0), seen = new Array(w * h).fill(false), maze = { w: w, h: h, cells: cells };
    var corners = [0, w - 1, (h - 1) * w, h * w - 1], start = corners[Math.floor(rand() * 4)], stack = [start]; seen[start] = true;
    while (stack.length) {
      var c = stack[stack.length - 1], opts = [];
      for (var i = 0; i < 4; i++) { var n = neighbour(maze, c, BITS[i]); if (n >= 0 && !seen[n]) opts.push([BITS[i], n]); }
      if (!opts.length) { stack.pop(); continue; }
      var pick = opts[Math.floor(rand() * opts.length)]; cells[c] |= pick[0]; cells[pick[1]] |= OPP[pick[0]]; seen[pick[1]] = true; stack.push(pick[1]);
    }
    var dist = new Int32Array(w * h).fill(-1), queue = [start], far = start; dist[start] = 0;
    for (var qi = 0; qi < queue.length; qi++) {
      var cc = queue[qi]; if (dist[cc] > dist[far]) far = cc;
      for (var j = 0; j < 4; j++) { if (!(cells[cc] & BITS[j])) continue; var nn = neighbour(maze, cc, BITS[j]); if (nn >= 0 && dist[nn] < 0) { dist[nn] = dist[cc] + 1; queue.push(nn); } }
    }
    maze.start = start; maze.exit = far; maze.par = dist[far];
    return maze;
  }
  function mazeFor(difficulty, index) {
    var s = SIZES[difficulty]; return makeMaze(s[0], s[1], SEED + DIFFICULTIES.indexOf(difficulty) * 1000003 + index * 7919);
  }
  function reachableCount(maze) {
    var seen = new Uint8Array(maze.w * maze.h), stack = [maze.start], n = 0; seen[maze.start] = 1;
    while (stack.length) { var c = stack.pop(); n++; for (var i = 0; i < 4; i++) { if (!(maze.cells[c] & BITS[i])) continue; var nb = neighbour(maze, c, BITS[i]); if (nb >= 0 && !seen[nb]) { seen[nb] = 1; stack.push(nb); } } }
    return n;
  }
  function openings(maze, cell) { var k = 0; for (var i = 0; i < 4; i++) if (maze.cells[cell] & BITS[i]) k++; return k; }

  /* ---------- game state ---------- */
  function newGame(difficulty, index) {
    var maze = mazeFor(difficulty, index);
    var g = { difficulty: difficulty, index: index, maze: maze, pos: maze.start, trail: [maze.start], steps: 0, hintsUsed: 0, hintCells: [], explored: {}, status: "playing" };
    reveal(g); return g;
  }
  /** Cells you can see from where you stand: all of them when the view is unlimited, otherwise those within `VIEW` steps through open passages. */
  function visibleCells(g) {
    var r = VIEW[g.difficulty], maze = g.maze, out = [];
    if (!r) { for (var a = 0; a < maze.w * maze.h; a++) out.push(a); return out; }
    var depth = {}; depth[g.pos] = 0; var queue = [g.pos];
    for (var qi = 0; qi < queue.length; qi++) {
      var c = queue[qi]; out.push(c); if (depth[c] >= r) continue;
      for (var i = 0; i < 4; i++) { if (!(maze.cells[c] & BITS[i])) continue; var n = neighbour(maze, c, BITS[i]); if (n >= 0 && depth[n] === undefined) { depth[n] = depth[c] + 1; queue.push(n); } }
    }
    return out;
  }
  function reveal(g) { visibleCells(g).forEach(function (c) { g.explored[c] = true; }); }
  function stepTo(g, bit) {
    var n = (g.maze.cells[g.pos] & bit) ? neighbour(g.maze, g.pos, bit) : -1;
    if (n < 0) return -1;
    g.pos = n; g.trail.push(n); g.steps++; reveal(g);
    if (n === g.maze.exit) g.status = "won";
    return n;
  }
  /** One step. Returns { ok, cells } (cells = the cells entered). */
  function move(g, dir) {
    if (g.status !== "playing") return { ok: false, cells: [], error: "Game over" };
    var n = stepTo(g, DIRS[dir]); if (n < 0) return { ok: false, cells: [] };
    g.hintCells = g.hintCells.filter(function (c) { return c !== n; });
    return { ok: true, cells: [n], reached: g.status === "won" };
  }
  /** Step, then keep going along the corridor until a junction, a dead end or the exit. */
  function run(g, dir) {
    if (g.status !== "playing") return { ok: false, cells: [], error: "Game over" };
    var bit = DIRS[dir], cells = [];
    for (var guard = 0; guard < 1000; guard++) {
      var n = stepTo(g, bit); if (n < 0) break;
      cells.push(n);
      if (g.status !== "playing") break;
      var from = OPP[bit], forward = [];
      for (var i = 0; i < 4; i++) if ((g.maze.cells[n] & BITS[i]) && BITS[i] !== from) forward.push(BITS[i]);
      if (forward.length !== 1) break;
      bit = forward[0];
    }
    g.hintCells = g.hintCells.filter(function (c) { return cells.indexOf(c) < 0; });
    return { ok: cells.length > 0, cells: cells, reached: g.status === "won" };
  }
  function hintsAllowed(difficulty, bonus) { return HINTS[difficulty] + (bonus || 0); }
  /** Light up the next HINT_CELLS cells of the shortest route from where you stand. */
  function hint(g, bonus) {
    if (g.status !== "playing") return { ok: false, error: "Game over" };
    if (g.hintsUsed >= hintsAllowed(g.difficulty, bonus)) return { ok: false, error: "No hints left" };
    var r = route(g.maze, g.pos, g.maze.exit).slice(1, 1 + HINT_CELLS);
    g.hintsUsed++; g.hintCells = r; r.forEach(function (c) { g.explored[c] = true; });
    return { ok: true, cells: r };
  }
  function giveUp(g) { if (g.status === "playing") g.status = "gaveup"; return g; }
  function expire(g) { if (g.status === "playing") g.status = "timeout"; return g; }
  function solution(g) { return route(g.maze, g.maze.start, g.maze.exit); }

  /* ---------- time, stars, text ---------- */
  /** Seconds allowed, or 0 for no timer. `bonus` = extra seconds from a hero. */
  function timeLimit(difficulty, par, bonus) { var k = SECONDS_PER_STEP[difficulty]; return k ? Math.round(30 + par * k) + (bonus || 0) : 0; }
  function stars(g) {
    if (g.status !== "won") return 0;
    var ratio = g.steps / g.maze.par, t = STAR_AT[g.difficulty]; return ratio <= t[0] ? 3 : ratio <= t[1] ? 2 : 1;
  }
  function formatTime(sec) { sec = Math.max(0, Math.round(sec)); return Math.floor(sec / 60) + ":" + (sec % 60 < 10 ? "0" : "") + (sec % 60); }
  function shareText(g, seconds) {
    var s = stars(g);
    return "Zame " + g.difficulty + " · " + "★".repeat(s) + "☆".repeat(3 - s) + "\n" + g.steps + " steps (par " + g.maze.par + ") · " + formatTime(seconds) + (g.hintsUsed ? " · " + g.hintsUsed + (g.hintsUsed === 1 ? " hint" : " hints") : "");
  }
  /** Rebuild a game from its saved route (the list of cells visited), so a reload keeps your place and your map. */
  function restore(difficulty, index, trail, hintsUsed) {
    var g = newGame(difficulty, index);
    for (var i = 1; i < trail.length; i++) {
      var from = g.pos, dx = (trail[i] % g.maze.w) - (from % g.maze.w), dy = Math.floor(trail[i] / g.maze.w) - Math.floor(from / g.maze.w);
      var bit = dx === 1 ? E : dx === -1 ? W : dy === 1 ? S : dy === -1 ? N : 0;
      if (!bit || stepTo(g, bit) < 0) return newGame(difficulty, index);     // damaged save: start the maze again
    }
    g.hintsUsed = Math.max(0, hintsUsed || 0); return g;
  }

  /* ---------- save ---------- */
  function emptySave() { return { completed: { easy: 0, normal: 0, hard: 0 } }; }
  function recordCompleted(save, difficulty) { save.completed = save.completed || emptySave().completed; save.completed[difficulty] = (save.completed[difficulty] || 0) + 1; return save; }
  function normaliseSave(save) {
    var out = emptySave();
    if (save && save.completed && typeof save.completed === "object") DIFFICULTIES.forEach(function (d) { var n = save.completed[d]; if (typeof n === "number" && n >= 0 && isFinite(n)) out.completed[d] = Math.floor(n); });
    return out;
  }
  function totalCompleted(save) { return DIFFICULTIES.reduce(function (a, d) { return a + save.completed[d]; }, 0); }

  return {
    DIFFICULTIES: DIFFICULTIES, SIZES: SIZES, VIEW: VIEW, HINTS: HINTS, HINT_CELLS: HINT_CELLS, STAR_AT: STAR_AT, N: N, E: E, S: S, W: W,
    rng: rng, neighbour: neighbour, route: route, makeMaze: makeMaze, mazeFor: mazeFor, reachableCount: reachableCount, openings: openings,
    newGame: newGame, visibleCells: visibleCells, move: move, run: run, hintsAllowed: hintsAllowed, hint: hint, giveUp: giveUp, expire: expire, solution: solution,
    timeLimit: timeLimit, stars: stars, formatTime: formatTime, shareText: shareText, restore: restore,
    emptySave: emptySave, recordCompleted: recordCompleted, normaliseSave: normaliseSave, totalCompleted: totalCompleted
  };
});
