// Run with: node zame-engine.test.js
const assert = require("assert");
const E = require("./zame-engine.js");
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("FAIL  " + name + "\n      " + e.message); process.exitCode = 1; } }

console.log("mazes");
test("every cell is reachable and the maze is perfect (cells - 1 passages) for all sizes", () => {
  for (const d of E.DIFFICULTIES) for (let i = 0; i < 30; i++) {
    const m = E.mazeFor(d, i), n = m.w * m.h; assert.strictEqual(E.reachableCount(m), n, d + i);
    let open = 0; for (let c = 0; c < n; c++) for (const b of [E.N, E.E, E.S, E.W]) if (m.cells[c] & b) open++;
    assert.strictEqual(open / 2, n - 1, "perfect " + d + i);
  }
});
test("passages are two-way and never leave the grid", () => {
  const m = E.mazeFor("hard", 3);
  for (let c = 0; c < m.w * m.h; c++) for (const [b, o] of [[E.N, E.S], [E.E, E.W], [E.S, E.N], [E.W, E.E]]) if (m.cells[c] & b) { const n = E.neighbour(m, c, b); assert.ok(n >= 0); assert.ok(m.cells[n] & o); }
});
test("sizes, start in a corner, exit far away, par matches the route", () => {
  for (const d of E.DIFFICULTIES) { const m = E.mazeFor(d, 2); assert.strictEqual(m.w, E.SIZES[d][0]); assert.ok([0, m.w - 1, (m.h - 1) * m.w, m.w * m.h - 1].includes(m.start)); assert.ok(m.par >= m.w); assert.strictEqual(E.route(m, m.start, m.exit).length - 1, m.par); }
});
test("same maze for everyone; different for another index or difficulty", () => {
  assert.deepStrictEqual(E.mazeFor("normal", 5), E.mazeFor("normal", 5)); assert.notDeepStrictEqual(E.mazeFor("normal", 5).cells, E.mazeFor("normal", 6).cells);
  assert.notDeepStrictEqual(E.mazeFor("easy", 0).cells, E.mazeFor("normal", 0).cells);
});
test("par is long enough to be a puzzle (average par per size)", () => {
  for (const d of E.DIFFICULTIES) { let sum = 0; for (let i = 0; i < 20; i++) sum += E.mazeFor(d, i).par; const avg = sum / 20; console.log("        " + d + " average par " + avg.toFixed(0)); assert.ok(avg > E.SIZES[d][0] * 2.2, d + " " + avg); }
});

console.log("moving");
function walk(g, cells) { cells.forEach(c => { const from = g.pos, dx = c % g.maze.w - from % g.maze.w, dy = Math.floor(c / g.maze.w) - Math.floor(from / g.maze.w); const dir = dx === 1 ? "right" : dx === -1 ? "left" : dy === 1 ? "down" : "up"; assert.ok(E.move(g, dir).ok, "step"); }); }
test("walls block movement and do not count as steps", () => {
  const g = E.newGame("easy", 0); let bumped = 0;
  for (const d of ["up", "right", "down", "left"]) { const r = E.move(g, d); if (!r.ok) bumped++; }
  assert.ok(bumped >= 1); assert.strictEqual(g.steps, g.trail.length - 1);
});
test("walking the shortest route wins in exactly par steps with 3 stars", () => {
  for (const d of E.DIFFICULTIES) { const g = E.newGame(d, 1); walk(g, E.solution(g).slice(1)); assert.strictEqual(g.status, "won"); assert.strictEqual(g.steps, g.maze.par); assert.strictEqual(E.stars(g), 3); assert.deepStrictEqual(E.move(g, "up").error, "Game over"); }
});
test("running follows a corridor to a junction or dead end, and reaches the exit by running", () => {
  const g = E.newGame("normal", 2), sol = E.solution(g); let guard = 0;
  while (g.status === "playing" && guard++ < 500) {
    const from = g.pos, next = sol[sol.indexOf(from) + 1], dx = next % g.maze.w - from % g.maze.w, dy = Math.floor(next / g.maze.w) - Math.floor(from / g.maze.w);
    const r = E.run(g, dx === 1 ? "right" : dx === -1 ? "left" : dy === 1 ? "down" : "up"); assert.ok(r.ok);
    if (g.status === "playing") assert.notStrictEqual(E.openings(g.maze, g.pos), 2, "stops only at junctions or dead ends (or where it started)") ;
  }
  assert.strictEqual(g.status, "won");
});
test("stars drop with detours", () => {
  const g = E.newGame("easy", 0); g.status = "won"; g.steps = g.maze.par; assert.strictEqual(E.stars(g), 3);
  g.steps = Math.ceil(g.maze.par * 1.5); assert.strictEqual(E.stars(g), 2); g.steps = g.maze.par * 4; assert.strictEqual(E.stars(g), 1); g.status = "gaveup"; assert.strictEqual(E.stars(g), 0);
});

console.log("view, hints, time");
test("Easy and Normal show the whole maze; Hard shows only a few steps down the corridors and remembers where you have been", () => {
  assert.strictEqual(E.visibleCells(E.newGame("easy", 0)).length, 100); assert.strictEqual(E.visibleCells(E.newGame("normal", 0)).length, 225);
  const g = E.newGame("hard", 0), v = E.visibleCells(g); assert.ok(v.length < 40 && v.includes(g.maze.start));
  assert.ok(!g.explored[g.maze.exit]); const sol = E.solution(g); walk(g, sol.slice(1, 12));
  assert.ok(g.explored[sol[3]], "remembered"); assert.ok(Object.keys(g.explored).length > v.length);
});
test("a hint lights the next 8 cells of the route from where you stand, and the budget is 3/3/2", () => {
  const g = E.newGame("hard", 1), sol = E.solution(g), h = E.hint(g); assert.ok(h.ok); assert.deepStrictEqual(h.cells, sol.slice(1, 9));
  assert.ok(h.cells.every(c => g.explored[c]), "hinted cells show through the fog"); assert.ok(E.hint(g).ok); assert.strictEqual(E.hint(g).error, "No hints left"); assert.ok(E.hint(g, 1).ok);
  assert.deepStrictEqual(E.DIFFICULTIES.map(d => E.hintsAllowed(d)), [3, 3, 2]);
  const g2 = E.newGame("easy", 0); walk(g2, E.solution(g2).slice(1, 4)); assert.deepStrictEqual(E.hint(g2).cells, E.solution(g2).slice(4, 12));   // hints follow you, from your own cell
});
test("a hint from a wrong turn leads back out and on", () => {
  const g = E.newGame("easy", 4), sol = E.solution(g); let wrong = null;
  for (const b of [["up", E.N], ["right", E.E], ["down", E.S], ["left", E.W]]) { if ((g.maze.cells[g.pos] & b[1]) && E.neighbour(g.maze, g.pos, b[1]) !== sol[1]) wrong = b[0]; }
  if (wrong) { E.move(g, wrong); const h = E.hint(g); assert.strictEqual(h.cells[0], g.maze.start); }
});
test("time limits: none on Easy, generous on Normal, tighter on Hard, plus hero seconds", () => {
  assert.strictEqual(E.timeLimit("easy", 80), 0); assert.strictEqual(E.timeLimit("normal", 80), 150); assert.strictEqual(E.timeLimit("hard", 150), 210); assert.strictEqual(E.timeLimit("normal", 80, 30), 180);
  assert.strictEqual(E.formatTime(125), "2:05");
});
test("give up and time out end the game", () => { const a = E.newGame("easy", 0); E.giveUp(a); assert.strictEqual(a.status, "gaveup"); const b = E.newGame("normal", 0); E.expire(b); assert.strictEqual(b.status, "timeout"); assert.strictEqual(E.move(b, "up").ok, false); });
test("restore rebuilds position, steps and the fog map from the trail; a damaged trail restarts", () => {
  const g = E.newGame("hard", 2), sol = E.solution(g); walk(g, sol.slice(1, 15)); const r = E.restore("hard", 2, g.trail, 1);
  assert.strictEqual(r.pos, g.pos); assert.strictEqual(r.steps, g.steps); assert.deepStrictEqual(r.explored, g.explored); assert.strictEqual(r.hintsUsed, 1);
  assert.strictEqual(E.restore("hard", 2, [g.maze.start, g.maze.exit], 0).steps, 0);
});
test("share text", () => { const g = E.newGame("normal", 0); walk(g, E.solution(g).slice(1)); assert.ok(E.shareText(g, 102).startsWith("Zame normal · ★★★\n" + g.steps + " steps (par " + g.maze.par + ") · 1:42")); });
test("save counts completions and cleans bad data", () => {
  const s = E.emptySave(); E.recordCompleted(s, "hard"); E.recordCompleted(s, "hard"); assert.deepStrictEqual(s.completed, { easy: 0, normal: 0, hard: 2 }); assert.strictEqual(E.totalCompleted(s), 2);
  assert.deepStrictEqual(E.normaliseSave({ completed: { easy: 3, normal: "x", hard: -1 } }).completed, { easy: 3, normal: 0, hard: 0 });
});
console.log(`\n${passed} passed${process.exitCode ? " (with failures)" : ""}`);
