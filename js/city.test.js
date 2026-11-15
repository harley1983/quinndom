// Run with: node js/city.test.js
const assert = require("assert");
const B = require("./buildings.js");
const City = require("./city.js");
const T = require("./terrain.js");
const bare = () => ({ size: 36, buildings: [] });
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("FAIL  " + name + "\n      " + e.message); process.exitCode = 1; } }
const rich = () => ({ wood: 500, stone: 500, metal: 500, food: 500, coins: 0 });

console.log("building data");
test("there are 13 buildings you can build (the road is one of them) and every one has a name, group, footprint and cost", () => {
  assert.strictEqual(B.LIST.length, 13);
  const groups = B.GROUPS.map(g => g.id);
  B.LIST.forEach(b => { assert.ok(b.name && groups.includes(b.group) && b.w >= 1 && b.d >= 1 && Object.keys(b.cost).length > 0, b.id); Object.keys(b.cost).forEach(k => assert.ok(B.COST_KEYS.includes(k), b.id + " " + k)); });
  assert.strictEqual(new Set(B.LIST.map(b => b.id)).size, 13);
});
test("costs match the GDD table", () => {
  assert.deepStrictEqual(B.get("road").cost, { stone: 2 });
  assert.deepStrictEqual(B.get("bamboo-home").cost, { wood: 10, stone: 5 });
  assert.deepStrictEqual(B.get("vertical-farm").cost, { wood: 10, stone: 10, metal: 2 });
  assert.deepStrictEqual(B.get("hero-hall").cost, { stone: 20, metal: 10 });
  assert.deepStrictEqual([B.get("solar-array").w, B.get("solar-array").d], [2, 1]);
  assert.strictEqual(B.get("nope"), null);
});
test("a building's value is its total cost times its level", () => {
  assert.strictEqual(B.value("bamboo-home", 1), 15);
  assert.strictEqual(B.value("bamboo-home", 3), 45);
  assert.strictEqual(B.value("road", 1), 2);
});

console.log("terrain and grid");
test("the island has terrain: heights, water, paths and plenty of buildable ground", () => {
  assert.strictEqual(T.SIZE, 36);
  assert.ok(City.tileCount() >= 300, "buildable " + City.tileCount());
  assert.strictEqual(T.type(24, 14), "w"); assert.strictEqual(T.h(24, 14), 2);
  assert.strictEqual(T.type(27, 14), "b");
  assert.strictEqual(T.type(18, 14), "p");
  assert.strictEqual(T.h(17, 2), 4); assert.strictEqual(T.h(23, 10), 3); assert.strictEqual(T.h(18, 14), 2);
  assert.strictEqual(T.h(-1, 3), 0); assert.strictEqual(T.at(0, 0), null);
});
test("you can only build on clear grass: not water, paths, forest, rock or off the island", () => {
  assert.ok(City.inside(7, 13));
  [[24, 14], [18, 14], [27, 14], [17, 2], [0, 0], [-1, 5], [36, 5], [2.5, 5], [8, 1]].forEach(p => assert.ok(!City.inside(p[0], p[1]), p.join(",")));
  assert.ok(T.list().some(t => t.t === "f") && T.list().some(t => t.t === "r"));
});
test("a building can stand on a free tile, not off the grass and not on another building", () => {
  let s = bare();
  assert.ok(City.canPlace(s, "bamboo-home", 7, 13).ok);
  assert.strictEqual(City.canPlace(s, "bamboo-home", 24, 14).reason, "outside");     // water
  assert.strictEqual(City.canPlace(s, "bamboo-home", 18, 14).reason, "outside");     // path
  assert.strictEqual(City.canPlace(s, "nope", 7, 13).reason, "unknown");
  s = City.place(s, rich(), "bamboo-home", 7, 13).state;
  assert.strictEqual(City.canPlace(s, "road", 7, 13).reason, "taken");
  assert.ok(City.canPlace(s, "road", 6, 13).ok);
});
test("a 2 x 2 building needs four free, flat tiles", () => {
  let s = City.place(bare(), rich(), "road", 9, 18).state;
  assert.strictEqual(City.canPlace(s, "sky-garden-plaza", 8, 17).reason, "taken");
  assert.ok(City.canPlace(bare(), "sky-garden-plaza", 8, 17).ok);
  assert.strictEqual(City.canPlace(bare(), "sky-garden-plaza", 11, 5).reason, "uneven");  // two tiles on one level, two on the next
  assert.strictEqual(City.canPlace(bare(), "sky-garden-plaza", 35, 5).reason, "outside");
  assert.ok(City.canPlace(bare(), "hero-hall", 12, 3).ok);                                   // the summit clearing
});
test("a 2 x 1 solar array covers x and x+1 on the same row", () => {
  const r = City.place(bare(), rich(), "solar-array", 7, 13);
  assert.deepStrictEqual(City.cellsOf(r.building), [[7, 13], [8, 13]]);
  assert.ok(City.at(r.state, 8, 13));
  assert.strictEqual(City.at(r.state, 7, 14), null);
});

console.log("starter town");
test("a new city already has civic buildings, homes and a solar array, all on valid ground", () => {
  const s = City.emptyState(), types = s.buildings.map(b => b.type);
  ["hospital", "market", "corner-shop", "bamboo-home", "solar-array"].forEach(t => assert.ok(types.includes(t), t));
  assert.deepStrictEqual(City.clean(s), s);
  const occ = City.occupancy(s); assert.strictEqual(Object.keys(occ).length, s.buildings.reduce((n, b) => n + City.cellsOf(b).length, 0));
});
test("civic buildings are free, worth no Credit, and cannot be built from the tray", () => {
  ["hospital", "market", "corner-shop"].forEach(id => { assert.ok(B.get(id).civic); assert.strictEqual(B.value(id, 5), 0); assert.strictEqual(City.canPlace(bare(), id, 7, 13).reason, "unknown"); });
  assert.ok(!B.LIST.some(b => b.civic));
  assert.strictEqual(City.creditScore(City.emptyState()), 4 * 15 + 13);
});

console.log("paying");
test("placing takes the cost out of the resources and leaves the inputs untouched", () => {
  const s0 = bare(), r0 = { wood: 12, stone: 6, metal: 0, food: 3, coins: 7 };
  const r = City.place(s0, r0, "bamboo-home", 7, 13);
  assert.ok(r.ok);
  assert.deepStrictEqual(r.resources, { wood: 2, stone: 1, metal: 0, food: 3, coins: 7 });
  assert.deepStrictEqual(r0, { wood: 12, stone: 6, metal: 0, food: 3, coins: 7 });
  assert.strictEqual(s0.buildings.length, 0);
  assert.deepStrictEqual(r.state.buildings[0], { type: "bamboo-home", x: 7, y: 13, level: 1 });
});
test("not enough resources: nothing is placed and the shortfall is reported", () => {
  const r = City.place(bare(), { wood: 10, stone: 1, metal: 0, food: 0, coins: 0 }, "bamboo-home", 7, 13);
  assert.strictEqual(r.ok, false); assert.strictEqual(r.reason, "cost"); assert.deepStrictEqual(r.missing, { stone: 4 });
  assert.strictEqual(City.missing({ wood: 99, stone: 99, metal: 99 }, "hero-hall"), null);
  assert.deepStrictEqual(City.missing({}, "road"), { stone: 2 });
});
test("a blocked tile is refused before any resource is taken", () => {
  const s = City.place(bare(), rich(), "road", 7, 13).state;
  assert.strictEqual(City.place(s, { wood: 0, stone: 0, metal: 0, food: 0 }, "road", 7, 13).reason, "taken");
});

console.log("credit score and roads");
test("credit score is the sum of cost x level; the city never shrinks", () => {
  let s = bare(), res = rich();
  assert.strictEqual(City.creditScore(s), 0);
  s = City.place(s, res, "bamboo-home", 7, 13).state;   // 15
  s = City.place(s, res, "road", 6, 13).state;          // 2
  s = City.place(s, res, "hero-hall", 12, 3).state;     // 30
  assert.strictEqual(City.creditScore(s), 47);
  s.buildings[0].level = 2;
  assert.strictEqual(City.creditScore(s), 62);
  assert.deepStrictEqual(City.stats(s), { buildings: 2, roads: 1, credit: 62, tiles: City.tileCount() });
});
test("road mask tells which neighbours are roads", () => {
  let s = bare(), res = rich();
  [[6, 13], [7, 13], [6, 14], [5, 13]].forEach(p => { s = City.place(s, res, "road", p[0], p[1]).state; });
  assert.strictEqual(City.roadMask(s, 6, 13), 1 | 2 | 4);
  assert.strictEqual(City.roadMask(s, 7, 13), 4);
  assert.strictEqual(City.roadMask(s, 13, 13), 0);
  s = City.place(s, res, "bamboo-home", 7, 12).state;   // a building is not a road
  assert.strictEqual(City.roadMask(s, 7, 13), 4);
});

console.log("saved cities");
test("clean keeps good buildings and drops unknown types, bad tiles and overlaps", () => {
  const c = City.clean({ size: 99, buildings: [
    { type: "bamboo-home", x: 7, y: 13, level: 2 },
    { type: "nope", x: 5, y: 7 },
    { type: "road", x: 0, y: 0 },              // not on the island
    { type: "road", x: 24, y: 14 },            // water
    { type: "road", x: 7, y: 13 },             // overlaps the home
    { type: "road", x: "7", y: 7.5 },          // not a whole number
    { type: "solar-array", x: 8, y: 14, level: 0 },
    null, "x"
  ] });
  assert.strictEqual(c.size, 36);
  const mine = c.buildings.filter(b => !B.get(b.type).civic && !City.emptyState().buildings.some(s => s.type === b.type && s.x === b.x && s.y === b.y));
  assert.deepStrictEqual(mine, [{ type: "bamboo-home", x: 7, y: 13, level: 2 }, { type: "solar-array", x: 8, y: 14, level: 1 }]);
});
test("civic buildings always come back, even if a save lost them", () => {
  const c = City.clean({ buildings: [{ type: "bamboo-home", x: 4, y: 6, level: 1 }] });
  ["hospital", "market", "corner-shop"].forEach(t => assert.ok(c.buildings.some(b => b.type === t), t));
});
test("anything that is not a city becomes the starter town", () => {
  [undefined, null, 5, "x", {}, { buildings: "no" }].forEach(v => assert.deepStrictEqual(City.clean(v), City.emptyState()));
});
test("a city that comes back from JSON stays the same", () => {
  let s = City.emptyState(); const res = rich();
  s = City.place(s, res, "hero-hall", 12, 3).state; s = City.place(s, res, "road", 6, 13).state;
  assert.deepStrictEqual(City.clean(JSON.parse(JSON.stringify(s))), s);
});

console.log("\n" + passed + " passed" + (process.exitCode ? ", some FAILED" : ""));
