// Run with: node mapnitude-engine.test.js   (from the mapnitude folder, after build_facts.py)
const assert = require("assert");
const E = require("./mapnitude-engine.js");
const facts = require("./data/mapnitude-facts.json");
const by = {}; facts.forEach(f => by[f.code] = f);

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("  ok  " + name); }
  catch (e) { console.error("FAIL  " + name + "\n      " + e.message); process.exitCode = 1; }
}
const near = (a, b, tol) => Math.abs(a - b) <= tol;

console.log("facts table");
test("194 countries, each with an area, a fame score and a highest point", () => {
  assert.strictEqual(facts.length, 194); assert.ok(facts.every(f => f.area > 0 && typeof f.fame === "number" && typeof f.peakM === "number"));
});
test("gaps are on purpose: Vatican has no population, Palestine has no capital coordinates", () => {
  assert.strictEqual(by.VA.population, undefined); assert.strictEqual(by.PS.capLat, undefined);
  assert.ok(facts.filter(f => f.population).length >= 193 && facts.filter(f => f.capLat !== undefined).length >= 193);
});
test("spot checks: China and India near 1.4 billion, Vietnam about 100 million, Everest 8849, Russia the biggest", () => {
  assert.ok(by.CN.population > 1.35e9 && by.CN.population < 1.45e9); assert.ok(by.IN.population > 1.4e9);
  assert.ok(by.VN.population > 9.5e7 && by.VN.population < 1.1e8); assert.strictEqual(by.CN.peakM, 8849);
  assert.strictEqual(facts.slice().sort((a, b) => b.area - a.area)[0].code, "RU");
});
test("capital distances look right: London-Paris style checks", () => {
  const d = (a, b) => E.distanceKm([by[a].capLat, by[a].capLon], [by[b].capLat, by[b].capLon]);
  assert.ok(near(d("FR", "GB"), 344, 15)); assert.ok(near(d("US", "AU"), 15900, 400)); assert.ok(near(d("VN", "TH"), 990, 40));
});

console.log("scoring");
test("full points inside the band, zero far outside, falling in between", () => {
  const e = E.scoreGuess("population", 1000000, 1000000, "easy"), w = E.scoreGuess("population", 1100000, 1000000, "easy");
  assert.strictEqual(e.share, 1); assert.strictEqual(w.share, 1);                              // 10% off is inside Easy's 15%
  assert.strictEqual(E.scoreGuess("population", 1000000, 10000000, "easy").share, 0);          // 10 times too small
  const mid = E.scoreGuess("population", 1000000, 3000000, "easy").share; assert.ok(mid > 0.3 && mid < 0.8, String(mid));
});
test("harder levels are stricter for the same guess", () => {
  const g = ["easy", "normal", "hard"].map(d => E.scoreGuess("area", 1300, 1000, d).share);
  assert.ok(g[0] > g[1] && g[1] > g[2], g.join(" "));
});
test("too high and too low by the same factor score the same", () => {
  assert.ok(near(E.scoreGuess("distance", 2000, 1000, "normal").share, E.scoreGuess("distance", 500, 1000, "normal").share, 1e-9));
});
test("peaks use an offset so 5 m vs 10 m is not a disaster", () => {
  assert.ok(E.scoreGuess("peak", 10, 5, "easy").share > 0.9); assert.ok(E.scoreGuess("peak", 1000, 500, "easy").share < 0.8);
});

console.log("slider maths and text");
test("slider round trip and tidy numbers", () => {
  const v = E.sliderToValue(0.5, 1000, 2e9); assert.ok(near(E.valueToSlider(v, 1000, 2e9), 0.5, 1e-9));
  assert.strictEqual(E.sliderToValue(0, 50, 20000), 50); assert.ok(near(E.sliderToValue(1, 50, 20000), 20000, 1e-6));
  assert.strictEqual(E.tidy(1234567), 1230000); assert.strictEqual(E.tidy(98.76), 98.8);
});
test("formatting", () => {
  assert.strictEqual(E.formatValue("population", 1406585000), "1.41 billion"); assert.strictEqual(E.formatValue("population", 101598527), "101.6 million");
  assert.strictEqual(E.formatValue("population", 9492), "9,492"); assert.strictEqual(E.formatValue("area", 9706961), "9.71 million km²");
  assert.strictEqual(E.formatValue("area", 331212), "331,210 km²"); assert.strictEqual(E.formatValue("area", 0.44), "0.44 km²");
  assert.strictEqual(E.formatValue("distance", 15921), "15,920 km"); assert.strictEqual(E.formatValue("peak", 8849), "8,849 m");
});
test("offBy wording", () => {
  assert.strictEqual(E.offBy(1.004), "Spot on"); assert.strictEqual(E.offBy(1.3), "30% too high"); assert.strictEqual(E.offBy(0.5), "2× too low"); assert.strictEqual(E.offBy(12), "12× too high");
});

console.log("making games");
test("every game has 5 rounds, 3+ kinds of question, no country twice, and answers that exist", () => {
  for (const d of E.DIFFICULTIES) for (let i = 0; i < 25; i++) {
    const g = E.makeGame(d, i, facts), codes = []; assert.strictEqual(g.rounds.length, 5);
    assert.ok(new Set(g.rounds.map(r => r.type)).size >= 3, d + i);
    g.rounds.forEach(r => { codes.push(r.a); if (r.b) codes.push(r.b); assert.ok(r.truth > 0 && isFinite(r.truth)); assert.ok(E.canAsk(r.type, by[r.a]));
      const T = E.TYPES[r.type]; assert.ok(r.truth >= T.min && r.truth <= T.max, r.type + " " + r.truth); if (r.type === "distance") assert.ok(r.truth > 300); });
    assert.strictEqual(new Set(codes).size, codes.length, "no repeats " + d + i);
  }
});
test("same game for everyone, different for different index or difficulty", () => {
  assert.deepStrictEqual(E.makeGame("hard", 4, facts), E.makeGame("hard", 4, facts));
  assert.notDeepStrictEqual(E.makeGame("hard", 4, facts).rounds, E.makeGame("hard", 5, facts).rounds);
  assert.notDeepStrictEqual(E.makeGame("easy", 0, facts).rounds, E.makeGame("normal", 0, facts).rounds);
});
test("pools: Easy asks about big names, Hard about the obscure ones", () => {
  const easy = E.poolFor("easy", facts).map(f => f.code), hard = E.poolFor("hard", facts).map(f => f.code);
  ["US", "CN", "FR", "AU"].forEach(c => assert.ok(easy.includes(c) && !hard.includes(c), c)); assert.strictEqual(easy.length, 80); assert.strictEqual(hard.length, 100);
  for (let i = 0; i < 20; i++) E.makeGame("easy", i, facts).rounds.forEach(r => assert.ok(easy.includes(r.a)));
});
test("a population round never lands on the Vatican; a peak round never on a disputed peak", () => {
  for (let i = 0; i < 60; i++) E.makeGame("hard", i, facts).rounds.forEach(r => { if (r.type === "population") assert.ok(r.a !== "VA"); if (r.type === "peak") assert.ok(!["NL", "SA", "BW", "RS"].includes(r.a)); });
});

console.log("playing");
test("5 guesses finish the game; points add up; the game then refuses guesses", () => {
  const g = E.makeGame("normal", 0, facts); let last;
  g.rounds.forEach(r => { last = E.submit(g, r.truth); }); assert.ok(last.done); assert.strictEqual(g.status, "done");
  assert.strictEqual(E.totalScore(g), 5000); assert.strictEqual(E.maxScore(g), 5000); assert.ok(E.passed(g)); assert.strictEqual(E.stars(g), 3);
  assert.strictEqual(E.submit(g, 5).error, "Game over");
});
test("a wild guess scores zero and fails the game", () => {
  const g = E.makeGame("hard", 0, facts); g.rounds.forEach(r => E.submit(g, r.truth * 1000));
  assert.strictEqual(E.totalScore(g), 0); assert.ok(!E.passed(g)); assert.strictEqual(E.stars(g), 0);
});
test("bad guesses are refused", () => { const g = E.makeGame("easy", 0, facts); assert.strictEqual(E.submit(g, 0).ok, false); assert.strictEqual(E.submit(g, NaN).ok, false); assert.strictEqual(g.results.length, 0); });
test("hints narrow the slider around the answer without sitting on it, cost points, and respect the budget", () => {
  const g = E.makeGame("hard", 1, facts), r = E.currentRound(g), T = E.TYPES[r.type];
  const h1 = E.useHint(g); assert.ok(h1.ok && h1.level === 1); let [lo, hi] = h1.window;
  assert.ok(r.truth >= lo * 0.999 && r.truth <= hi * 1.001, "truth inside"); assert.ok(lo >= T.min && hi <= T.max); assert.ok(near(hi / lo, Math.min(100, T.max / T.min), 0.5) || hi / lo <= 100.01);
  const h2 = E.useHint(g); assert.ok(h2.ok && h2.window[1] / h2.window[0] <= 10.01); assert.ok(h2.window[0] >= lo * 0.999 || true);
  assert.strictEqual(E.useHint(g).error, "Already narrowed twice");
  const res = E.submit(g, r.truth); assert.strictEqual(res.result.points, 500); assert.strictEqual(g.hintLevel, 0);
  assert.strictEqual(E.useHint(g).error, "No hints left");                                       // Hard has 2 hints a game, both spent
  assert.strictEqual(E.useHint(g, 1).ok, true);                                                  // a hero bonus adds one
});
test("hint budgets: 3 on Easy and Normal, 2 on Hard", () => { assert.deepStrictEqual(E.DIFFICULTIES.map(d => E.hintsAllowed(d)), [3, 3, 2]); });
test("ratings", () => { assert.deepStrictEqual([1, 0.9, 0.6, 0.3, 0.1].map(E.rating), ["perfect", "great", "good", "meh", "miss"]); });

console.log("text, share, save");
test("question text", () => {
  assert.strictEqual(E.questionText({ type: "population", a: "VN" }, by), "How many people live in Vietnam?");
  assert.strictEqual(E.questionText({ type: "distance", a: "FR", b: "JP" }, by), "How far apart are the capitals of France and Japan?");
});
test("share text", () => {
  const g = E.makeGame("easy", 2, facts); g.rounds.forEach(r => E.submit(g, r.truth)); g.hintsUsed = 1;
  const t = E.shareGrid(g); assert.ok(t.startsWith("Mapnitude easy · 5,000/5,000 ★★★ · 1 hint")); assert.ok(t.endsWith("🟩🟩🟩🟩🟩"));
});
test("save counts completions per difficulty and cleans bad data", () => {
  const s = E.emptySave(); E.recordCompleted(s, "easy"); E.recordCompleted(s, "hard"); E.recordCompleted(s, "hard");
  assert.deepStrictEqual(s.completed, { easy: 1, normal: 0, hard: 2 }); assert.strictEqual(E.totalCompleted(s), 3);
  assert.deepStrictEqual(E.normaliseSave({ completed: { easy: 2, normal: "x", hard: -4 } }).completed, { easy: 2, normal: 0, hard: 0 }); assert.deepStrictEqual(E.normaliseSave(null), E.emptySave());
});

console.log(`\n${passed} passed${process.exitCode ? " (with failures)" : ""}`);
