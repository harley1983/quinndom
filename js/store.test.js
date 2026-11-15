// Run with: node js/store.test.js
const assert = require("assert");
const S = require("./store.js");
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("FAIL  " + name + "\n      " + e.message); process.exitCode = 1; } }
const R = (o) => Object.assign({ wood: 0, stone: 0, metal: 0, food: 0, coins: 0, mimosa: 0, psilocybe: 0 }, o);
const D = "2026-11-15";

test("prices are 5 coins for Mimosa and 8 for Psilocybe", () => { assert.strictEqual(S.PRICES.mimosa, 5); assert.strictEqual(S.PRICES.psilocybe, 8); });
test("the stock is the same for everyone on a day and stays in range", () => {
  assert.deepStrictEqual(S.stock(D), S.stock(D));
  for (let d = 1; d <= 28; d++) { const s = S.stock("2026-11-" + (d < 10 ? "0" : "") + d); assert.ok(s.mimosa >= 2 && s.mimosa <= 4); assert.ok(s.psilocybe >= 1 && s.psilocybe <= 2); }
});
test("the stock changes from day to day", () => {
  const seen = new Set(); for (let d = 1; d <= 28; d++) seen.add(JSON.stringify(S.stock("2026-11-" + (d < 10 ? "0" : "") + d))); assert.ok(seen.size > 1);
});
test("buying takes coins and gives the item", () => {
  const r = S.buy(R({ coins: 20 }), null, "mimosa", D);
  assert.ok(r.ok); assert.strictEqual(r.resources.coins, 15); assert.strictEqual(r.resources.mimosa, 1); assert.strictEqual(r.store.bought.mimosa, 1);
});
test("you cannot buy without enough coins, and nothing changes", () => {
  const res = R({ coins: 4 }), r = S.buy(res, null, "mimosa", D); assert.ok(!r.ok); assert.strictEqual(res.coins, 4);
});
test("the daily stock runs out", () => {
  let res = R({ coins: 1000 }), st = null, n = 0;
  while (true) { const r = S.buy(res, st, "psilocybe", D); if (!r.ok) break; res = r.resources; st = r.store; n++; }
  assert.strictEqual(n, S.stock(D).psilocybe); assert.strictEqual(S.left(st, D).psilocybe, 0);
});
test("a new day brings the stock back", () => {
  let res = R({ coins: 1000 }), st = null;
  for (let i = 0; i < 10; i++) { const r = S.buy(res, st, "mimosa", D); if (!r.ok) break; res = r.resources; st = r.store; }
  assert.deepStrictEqual(S.left(st, "2026-11-16"), S.stock("2026-11-16"));
});
test("only Mimosa and Psilocybe are sold for coins", () => { assert.ok(!S.buy(R({ coins: 99 }), null, "metal", D).ok); assert.ok(!S.buy(R({ coins: 99 }), null, "wood", D).ok); });
test("1 Wood trades for 1 Stone, and back", () => {
  let r = S.trade(R({ wood: 10 }), "wood-stone", 4); assert.ok(r.ok); assert.strictEqual(r.resources.wood, 6); assert.strictEqual(r.resources.stone, 4);
  r = S.trade(r.resources, "stone-wood", 4); assert.strictEqual(r.resources.wood, 10); assert.strictEqual(r.resources.stone, 0);
});
test("20 Stone trade for 1 Metal", () => {
  const r = S.trade(R({ stone: 45 }), "stone-metal", 2); assert.ok(r.ok); assert.strictEqual(r.resources.stone, 5); assert.strictEqual(r.resources.metal, 2);
  assert.ok(!S.trade(R({ stone: 19 }), "stone-metal", 1).ok);
});
test("no trade pays coins and none takes them", () => { S.TRADES.forEach((t) => { assert.notStrictEqual(t.give, "coins"); assert.notStrictEqual(t.get, "coins"); }); });
test("bad trades are refused", () => { assert.ok(!S.trade(R({ wood: 5 }), "wood-metal", 1).ok); assert.ok(!S.trade(R({ wood: 5 }), "wood-stone", 0).ok); assert.ok(!S.trade(R({ wood: 5 }), "wood-stone", 6).ok); });
console.log("\n" + passed + " passed");
