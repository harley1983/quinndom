// Run with: node journey-engine.test.js
const assert = require("assert");
const J = require("./journey-engine.js");
let passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("FAIL  " + name + "\n      " + e.message); process.exitCode = 1; } }
const rich = s => { for (const r of J.RES) s.res[r] = 500; return s; };

console.log("city and puzzle unlocks");
test("each of the five puzzles hangs off one building, unlocked at level 2 with an unlock event", () => {
  assert.deepStrictEqual(J.PUZZLE_ORDER.map(p => J.puzzleBuilding(p)), ["bamboo", "quarry", "mycelium", "solar", "timber"].sort((a, b) => ["elmundo", "wxrdie", "mapnitude", "kuduso", "zame"].indexOf(J.BUILDINGS[a].puzzle) - ["elmundo", "wxrdie", "mapnitude", "kuduso", "zame"].indexOf(J.BUILDINGS[b].puzzle)));
  const s = rich(J.newState()); let r = J.upgrade(s, "mycelium"); assert.ok(r.ok && !r.events.some(e => e.type === "unlock")); assert.ok(!J.puzzleUnlocked(s, "kuduso"));
  r = J.upgrade(s, "mycelium"); assert.ok(r.events.some(e => e.type === "unlock" && e.puzzle === "kuduso")); assert.ok(J.puzzleUnlocked(s, "kuduso"));
  r = J.upgrade(s, "mycelium"); assert.ok(r.ok && !r.events.some(e => e.type === "unlock")); assert.strictEqual(J.upgrade(s, "mycelium").error, "Already at the top level");
});
test("building costs resources, refuses when poor, and Credit score = cost x level", () => {
  const s = J.newState(); s.res.wood = 0; assert.strictEqual(J.upgrade(s, "quarry").error, "Not enough resources");
  const t = J.newState(); const w = t.res.wood; J.upgrade(t, "quarry"); assert.strictEqual(t.res.wood, w - 12); assert.strictEqual(J.credit(t), 12);
  J.upgrade(t, "quarry"); assert.strictEqual(J.credit(t), 24);
});
test("upgrade costs rise and ask for Metal", () => { assert.ok(J.upgradeCost("timber", 1).metal >= 3); assert.ok(J.upgradeCost("timber", 2).wood > J.upgradeCost("timber", 1).wood); });
test("the starting stock can pay for the first building and its upgrade", () => { const s = J.newState(); assert.ok(J.upgrade(s, "timber").ok); assert.ok(J.upgrade(s, "timber").ok); assert.ok(J.puzzleUnlocked(s, "wxrdie")); });

console.log("puzzle rewards, days, march");
test("a win pays once a day per puzzle in the puzzle's own resource, plus one march point; a loss pays nothing", () => {
  const s = rich(J.newState()); J.upgrade(s, "quarry"); J.upgrade(s, "quarry"); s.march = 0; const stone = s.res.stone;
  assert.strictEqual(J.puzzleDone(s, "wxrdie", "easy", true).error, "Puzzle is locked");
  let r = J.puzzleDone(s, "mapnitude", "normal", true); assert.ok(r.paid); assert.strictEqual(r.reward.stone, 8); assert.strictEqual(Object.keys(r.reward).filter(k => k !== "coins").reduce((a, k) => a + r.reward[k], 0), 14); assert.strictEqual(r.reward.coins, 5); assert.strictEqual(s.march, 1); assert.strictEqual(s.res.stone, stone + 8);
  r = J.puzzleDone(s, "mapnitude", "normal", true); assert.ok(!r.paid && r.repeat); assert.strictEqual(s.march, 1);
  assert.ok(!J.puzzleDone(s, "mapnitude", "hard", false).paid);
  J.nextDay(s); assert.ok(J.puzzleDone(s, "mapnitude", "easy", true).paid);
});
test("new day: +3 march (capped), buildings produce", () => {
  const s = rich(J.newState()); J.upgrade(s, "timber"); J.upgrade(s, "mycelium"); const w = s.res.wood, p = s.res.psilocybe; s.march = 8; const r = J.nextDay(s);
  assert.strictEqual(s.march, 9); assert.strictEqual(s.res.wood, w + 5); assert.strictEqual(s.res.psilocybe, p + 1); assert.strictEqual(s.day, 2);
});
test("a solved puzzle pays coins on top of resources, and coins start at zero", () => {
  assert.strictEqual(J.newState().res.coins, 0); const s = rich(J.newState());
  ["easy", "normal", "hard"].forEach((d) => { const r = J.puzzleReward(s, "elmundo", d); assert.strictEqual(r.coins, J.COIN_BASE[d]); });
  assert.ok(J.puzzleReward(s, "elmundo", "hard").coins > J.puzzleReward(s, "elmundo", "easy").coins);
});
test("level 3 buildings pay a bigger puzzle reward", () => { const s = rich(J.newState()); for (let i = 0; i < 3; i++) J.upgrade(s, "bamboo"); assert.ok(Object.values(J.puzzleReward(s, "elmundo", "hard")).reduce((a, b) => a + b, 0) >= 25); });

console.log("army health");
test("max health grows with troops, Credit score and citizen wellbeing, and with trophies", () => {
  const s = rich(J.newState()); const base = J.maxHp(s);
  J.upgrade(s, "barracks"); J.trainTroops(s); const t = J.maxHp(s); assert.ok(t > base);
  const w0 = J.wellbeing(s); J.upgrade(s, "bamboo"); assert.ok(J.wellbeing(s) > w0); assert.ok(J.maxHp(s) > t);
  const m = J.maxHp(s); s.trophies.push("x"); assert.strictEqual(J.maxHp(s), m + 5);
});
test("troops need the Barracks, Food and room; armor needs the Armory, Metal and room", () => {
  const s = J.newState(); assert.strictEqual(J.trainTroops(s).error, "Build the Barracks first"); rich(s); J.upgrade(s, "barracks");
  for (let i = 0; i < 4; i++) assert.ok(J.trainTroops(s).ok); assert.strictEqual(J.trainTroops(s).error, "Barracks is full: upgrade it"); assert.strictEqual(s.troops, 20);
  assert.strictEqual(J.forgeArmor(s).error, "Build the Armory first"); J.upgrade(s, "armory"); for (let i = 0; i < 5; i++) assert.ok(J.forgeArmor(s).ok); assert.strictEqual(J.forgeArmor(s).error, "Armory is full: upgrade it");
  assert.ok(Math.abs(J.armorReduction(s) - 0.15) < 1e-9);
});
test("heroes level with Food at the Hero hall, up to a cap that rises with the hall; levels give hints and seconds", () => {
  const s = rich(J.newState()); s.res.mimosa = 0; assert.strictEqual(J.levelHero(s, "navigator").error, "Build the Hero hall first"); J.upgrade(s, "herohall");
  assert.ok(J.levelHero(s, "navigator").ok); assert.ok(J.levelHero(s, "navigator").ok); assert.strictEqual(J.levelHero(s, "navigator").error, "Upgrade the Hero hall to level further");
  assert.deepStrictEqual(J.heroBonus(s, "zame"), { hints: 1, seconds: 30, level: 3, mimosa: false }); assert.deepStrictEqual(J.heroBonus(s, "wxrdie"), { hints: 1, seconds: 0, level: 1, mimosa: false });
});
test("Psilocybe is spent automatically at the level-5 gate; Mimosa adds a hint for the day", () => {
  const s = rich(J.newState()); for (let i = 0; i < 3; i++) J.upgrade(s, "herohall"); s.heroes.scholar = 4; s.res.psilocybe = 0;
  const r = J.levelHero(s, "scholar"); assert.ok(!r.ok && r.gate); s.res.psilocybe = 2; const ok = J.levelHero(s, "scholar"); assert.ok(ok.ok && ok.gate); assert.strictEqual(s.res.psilocybe, 1); assert.strictEqual(s.heroes.scholar, 5);
  assert.strictEqual(J.heroBonus(s, "wxrdie").hints, 1); assert.ok(J.useMimosa(s).ok); assert.strictEqual(J.heroBonus(s, "wxrdie").hints, 2); assert.strictEqual(J.heroBonus(s, "kuduso").hints, 2);
  assert.strictEqual(J.useMimosa(s).error, "Mimosa is already active today"); J.nextDay(s); assert.strictEqual(J.heroBonus(s, "wxrdie").hints, 1);
  s.res.mimosa = 0; assert.ok(/No Mimosa/.test(J.useMimosa(s).error));
});
test("Hospital: one short rest heals fully, can't start without a hospital or at full health, level shortens it", () => {
  const s = rich(J.newState()); s.hp = 10; assert.strictEqual(J.startRest(s, 0).error, "Build the Hospital first"); J.upgrade(s, "hospital");
  assert.ok(J.startRest(s, 1000).ok); assert.strictEqual(J.startRest(s, 1000).error, "The army is already resting"); assert.strictEqual(J.restLeft(s, 1000), 90);
  assert.ok(!J.tickRest(s, 50000)); assert.ok(J.tickRest(s, 91000)); assert.strictEqual(s.hp, J.maxHp(s)); assert.strictEqual(J.startRest(s, 92000).error, "The army is already at full health");
  J.upgrade(s, "hospital"); assert.strictEqual(J.restSeconds(s), 60);
});

console.log("road");
function toNode(s, id) { while (s.node < id) { s.march = 9; const r = J.march(s); assert.ok(r.ok, r.error); const p = J.pending(s); if (p) return p; } }
test("marching costs a march point, collects crates (Mimosa and Psilocybe on the way), and stops at enemies", () => {
  const s = J.newState(); assert.ok(J.march(s).ok); assert.strictEqual(s.march, 2); assert.ok(J.pending(s)); assert.strictEqual(J.march(s).error, "Something blocks the road");
  assert.ok(J.fight(s).won); const w = s.res.wood; J.march(s); assert.strictEqual(s.res.wood, w + 12);
  const t = J.newState(); rich(t); t.march = 9; t.node = 4; t.cleared[4] = true; J.march(t); assert.strictEqual(t.res.mimosa, 501);
  const u = J.newState(); u.march = 0; assert.ok(/No march points/.test(J.march(u).error));
});
test("a fight is a visible bet: odds say win or lose, damage is armor-reduced, a win takes loot, a loss retreats to the last town at 10% health", () => {
  const s = J.newState(); toNode(s, 1); const o = J.odds(s, J.nodeAt(1)); assert.ok(o.win && o.verdict === "easy"); const hp = s.hp, r = J.fight(s); assert.ok(r.won); assert.strictEqual(s.hp, hp - o.damage);
  const t = J.newState(); t.node = 8; t.checkpoint = 6; t.cleared[6] = true; const o2 = J.odds(t, J.nodeAt(8)); assert.ok(!o2.win && o2.verdict === "too strong");
  const f = J.fight(t); assert.ok(!f.won); assert.strictEqual(t.node, 6); assert.strictEqual(t.hp, Math.round(J.maxHp(t) * 0.1));
  const a = J.newState(); a.armor = 10; assert.ok(J.odds(a, J.nodeAt(8)).damage < J.odds(J.newState(), J.nodeAt(8)).damage);
});
test("a stronger army turns the mini-boss into a win", () => {
  const s = rich(J.newState()); J.upgrade(s, "barracks"); J.upgrade(s, "barracks"); for (let i = 0; i < 8; i++) J.trainTroops(s); J.upgrade(s, "armory"); for (let i = 0; i < 5; i++) J.forgeArmor(s); J.upgrade(s, "herohall"); ["navigator", "scholar", "engineer"].forEach(h => J.levelHero(s, h));
  assert.ok(J.odds(s, J.nodeAt(8)).win, JSON.stringify(J.odds(s, J.nodeAt(8))));
});
test("towns set the checkpoint; no marching while resting or at 0 health", () => {
  const s = J.newState(); s.node = 5; s.march = 5; s.cleared[5] = true; J.march(s); assert.strictEqual(s.checkpoint, 6); s.rest = { end: 1 }; assert.strictEqual(J.march(s).error, "The army is resting");
});
test("full road walk with a strong army reaches the first boss at node 9", () => {
  const s = rich(J.newState()); J.upgrade(s, "barracks"); J.upgrade(s, "barracks"); for (let i = 0; i < 8; i++) J.trainTroops(s); s.armor = 8; for (const h of ["navigator", "scholar", "engineer"]) s.heroes[h] = 3; s.hp = J.maxHp(s);
  for (let guard = 0; guard < 30 && s.node < 9; guard++) { s.march = 9; const r = J.march(s); assert.ok(r.ok, r.error); if (J.pending(s) && J.nodeAt(s.node).enemy) { const f = J.fight(s); assert.ok(f.won, J.nodeAt(s.node).name); s.hp = J.maxHp(s); } }
  assert.strictEqual(s.node, 9); assert.ok(J.bossCanTry(s));
});

console.log("bosses");
test("a boss hands its puzzle a fixed seed, locked UI, hero hints and seconds, plus army morale seconds", () => {
  const s = rich(J.newState()); s.node = 9; s.heroes.scholar = 3; const c = J.bossConfig(s); assert.strictEqual(c.puzzle, "wxrdie"); assert.ok(c.locked && c.index === 7); assert.strictEqual(c.bonusHints, 1);
  assert.strictEqual(c.heroSeconds, 30); assert.strictEqual(c.moraleSeconds, 30); assert.strictEqual(c.seconds, 240 + 30 + 30); assert.ok(!c.unlocked);
  s.hp = Math.round(J.maxHp(s) / 2); assert.strictEqual(J.bossConfig(s).moraleSeconds, 15); s.node = 19; const z = J.bossConfig(s); assert.strictEqual(z.seconds, 0); assert.ok(z.zameBonusSeconds >= 0);
});
test("winning clears the node with loot and a trophy (+5 max health); losing costs health and the boss waits until tomorrow", () => {
  const s = rich(J.newState()); s.node = 9; const m = J.maxHp(s), hp = s.hp; let r = J.bossFinish(s, false); assert.ok(!r.won && s.hp < hp); assert.ok(!J.bossCanTry(s)); J.nextDay(s); assert.ok(J.bossCanTry(s));
  const m2 = J.maxHp(s); r = J.bossFinish(s, true); assert.ok(r.won && r.trophy === "Tiger's claw"); assert.strictEqual(J.maxHp(s), m2 + 5); assert.ok(s.cleared[9]); assert.ok(J.march(s).ok);
});

console.log("save");
test("normaliseState keeps good data and repairs bad data", () => {
  const s = rich(J.newState()); J.upgrade(s, "timber"); s.troops = 7; s.node = 3; const back = J.normaliseState(JSON.parse(JSON.stringify(s))); assert.deepStrictEqual(back, s);
  const bad = J.normaliseState({ day: -3, res: { wood: "x", stone: 9 }, buildings: { timber: 99 }, node: 999, hp: 99999, heroes: { navigator: 0 } }); assert.strictEqual(bad.day, 1); assert.strictEqual(bad.res.stone, 9); assert.strictEqual(bad.res.wood, 40);
  assert.strictEqual(bad.buildings.timber, 3); assert.strictEqual(bad.node, J.ROAD.length - 1); assert.ok(bad.hp <= J.maxHp(bad)); assert.strictEqual(bad.heroes.navigator, 1); assert.deepStrictEqual(J.normaliseState(null), J.newState());
});
console.log(`\n${passed} passed${process.exitCode ? " (with failures)" : ""}`);
