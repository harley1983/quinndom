/* Tests for the Wxrdie hint logic (Remove letters, Reveal a letter).
 * The engine lives inside puzzles/wxrdie.html, so this file pulls it out of the page and runs it in Node.
 * Run from the repo root:  node puzzles/src/wxrdie/wxrdie-hints.test.js */
"use strict";
const assert = require("assert"), fs = require("fs"), path = require("path"), vm = require("vm");
const html = fs.readFileSync(path.join(__dirname, "../../wxrdie.html"), "utf8");
const m = html.match(/<script>\n\/\* Wxrdie engine[\s\S]*?<\/script>/);
if (!m) throw new Error("Could not find the Wxrdie engine in wxrdie.html");
const sandbox = { module: { exports: {} } }; vm.runInNewContext(m[0].slice(8, -9), sandbox);
const E = sandbox.module.exports;

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { failed++; console.log("FAIL  " + name + "\n      " + e.message); } }
const mk = (ans) => { const g = E.newGame(ans.length, ans); g.gone = []; g.revealed = []; return g; };
const seeded = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

test("Remove letters never removes a letter of the answer and picks 5 different letters", () => {
  for (let i = 1; i < 200; i++) { const g = mk("plant"), r = E.hintEliminate(g, seeded(i)); assert.ok(r.ok); assert.strictEqual(new Set(r.letters).size, 5); r.letters.forEach((c) => assert.ok(!"plant".includes(c))); }
});
test("a second Remove letters gives 5 new letters", () => {
  const g = mk("plant"), a = E.hintEliminate(g, Math.random).letters, b = E.hintEliminate(g, Math.random).letters;
  assert.ok(!a.some((c) => b.includes(c))); assert.strictEqual(g.gone.length, 10);
});
test("letters the player already guessed are not offered", () => {
  const g = mk("plant"); E.submitGuess(g, "crisp", new Set(["crisp"]));
  const pool = E.eliminationCandidates(g); "crisp".split("").forEach((c) => assert.ok(!pool.includes(c)));
});
test("Remove letters fails cleanly when nothing is left to remove", () => {
  const g = mk("plant"); g.gone = "bcdefghijklmnopqrstuvwxyz".split("").filter((c) => !"plant".includes(c));
  const r = E.hintEliminate(g, Math.random); assert.strictEqual(r.ok, false); assert.ok(r.error);
});
test("Reveal gives the right letter in the right spot", () => {
  for (let i = 1; i < 100; i++) { const g = mk("plant"), r = E.hintReveal(g, seeded(i)); assert.ok(r.ok); assert.strictEqual("plant"[r.index], r.letter); assert.deepStrictEqual(g.revealed, [r.index]); }
});
test("Reveal never repeats a spot and runs out after every spot is known", () => {
  const g = mk("plant"), seen = new Set();
  for (let i = 0; i < 5; i++) { const r = E.hintReveal(g, Math.random); assert.ok(r.ok); assert.ok(!seen.has(r.index)); seen.add(r.index); }
  assert.strictEqual(E.hintReveal(g, Math.random).ok, false);
});
test("Reveal skips spots that are already green", () => {
  const g = mk("plant"); E.submitGuess(g, "pleat", new Set(["pleat"]));   // p, l and t are green
  const pool = E.revealCandidates(g); [0, 1, 4].forEach((i) => assert.ok(!pool.includes(i))); assert.strictEqual(pool.length, 2);
});
test("6-letter words work", () => { const g = mk("garden"); assert.strictEqual(E.revealCandidates(g).length, 6); assert.ok(E.hintReveal(g, Math.random).ok); });

console.log("\n" + passed + " passed" + (failed ? ", " + failed + " FAILED" : ""));
process.exit(failed ? 1 : 0);
