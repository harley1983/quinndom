/* Journey engine: pure game logic for the QuinnDom city <-> puzzles <-> road loop. No DOM, no storage, no clock (time is passed in).
 *
 *  CITY     Nine buildings. Five of them are tied to a puzzle: upgrading the building to level 2 unlocks the puzzle (the UI shows a "play now" popup).
 *           Hero hall levels heroes, Barracks trains troops (Food), Armory forges armor (Metal), Hospital heals the army (one short rest).
 *  PUZZLES  A solved puzzle pays resources (once a day per puzzle) and one march point. Heroes add hints / seconds in the puzzles they specialise in.
 *  ARMY     The army is the heroes' health. Max health = 40 + 2 x troops + Credit score / 10 + 30 x citizen wellbeing + 5 per boss trophy.
 *           Fights on the road drain it; nothing is ever lost, and a short rest at the Hospital heals it.
 *  ROAD     A winding road of nodes. One march point moves one node. Crates and pickups (Mimosa, Psilocybe, Food...) are collected on arrival; creatures,
 *           enemy armies and mini-bosses are fought automatically from army strength (no puzzle); each region ends with a big boss that is one of the five puzzles.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.JourneyEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var RES = ["wood", "stone", "metal", "food", "mimosa", "psilocybe"];
  var HEROES = { navigator: { name: "The Navigator", puzzles: ["elmundo", "zame"] }, scholar: { name: "The Scholar", puzzles: ["wxrdie", "mapnitude"] }, engineer: { name: "The Engineer", puzzles: ["kuduso", "zame"] } };
  var PUZZLES = {
    elmundo:   { name: "El Mundo",  main: "food",  blurb: "Find the hidden country." },
    wxrdie:    { name: "Wxrdie",    main: "wood",  blurb: "Guess the word in six tries." },
    mapnitude: { name: "Mapnitude", main: "stone", blurb: "Estimate the facts on a slider." },
    kuduso:    { name: "Kuduso",    main: "metal", blurb: "Fill the 9x9 grid." },
    zame:      { name: "Zame",      main: "metal", blurb: "Find the way out of the maze." }
  };
  var PUZZLE_ORDER = ["elmundo", "wxrdie", "mapnitude", "kuduso", "zame"];
  var BUILDINGS = {
    bamboo:   { name: "Bamboo home",    group: "Housing",        cost: { wood: 10, stone: 5 },           puzzle: "elmundo",   note: "Houses 4 citizens a level" },
    timber:   { name: "Timber grove",   group: "Production",     cost: { wood: 8, stone: 4 },            puzzle: "wxrdie",    produce: { wood: 5 },     note: "+5 Wood a day" },
    quarry:   { name: "Quarry",         group: "Production",     cost: { wood: 12 },                     puzzle: "mapnitude", produce: { stone: 5 },    note: "+5 Stone a day" },
    mycelium: { name: "Mycelium lab",   group: "Production",     cost: { stone: 10, metal: 5 },          puzzle: "kuduso",    produce: { psilocybe: 1 }, note: "+1 Psilocybe a day" },
    solar:    { name: "Solar array",    group: "Infrastructure", cost: { stone: 5, metal: 8 },            puzzle: "zame",      note: "Powers the city" },
    herohall: { name: "Hero hall",      group: "Military",       cost: { stone: 20, metal: 10 },                                note: "Levels heroes with Food" },
    barracks: { name: "Barracks",       group: "Military",       cost: { wood: 15, stone: 15 },                                 note: "Trains troops with Food" },
    armory:   { name: "Armory",         group: "Military",       cost: { stone: 10, metal: 10 },                                note: "Forges armor with Metal" },
    hospital: { name: "Hospital",       group: "Care",           cost: { wood: 12, stone: 8, food: 5 },                         note: "One short rest heals the army" }
  };
  var BUILDING_ORDER = ["bamboo", "timber", "quarry", "mycelium", "solar", "herohall", "barracks", "armory", "hospital"];
  var MAX_LEVEL = 3, PUZZLE_UNLOCK_LEVEL = 2;
  var REWARD_BASE = { easy: 8, normal: 14, hard: 20 };
  var START = { wood: 40, stone: 30, metal: 12, food: 40, mimosa: 0, psilocybe: 0 };
  var MARCH_PER_DAY = 3, MARCH_CAP = 9;
  var TROOPS_PER_TRAIN = 5, TRAIN_FOOD = 10, ARMOR_METAL = 3, TROOP_CAP_PER_LEVEL = 20, ARMOR_CAP_PER_LEVEL = 5, ARMOR_REDUCTION = 0.03, ARMOR_REDUCTION_MAX = 0.4;
  var REST_SECONDS = [90, 60, 40];            // Hospital level 1, 2, 3. Prototype values: the real game would use a short real-world wait.
  var BOSS_MORALE_SECONDS = 30;               // a fully healthy army adds up to this many seconds in a boss fight
  var HERO_MAX = 5, GATE_LEVEL = 5;

  /* ---------- road ---------- */
  var ROAD = [
    { id: 0,  type: "start",    country: "VN", name: "Hanoi Gate",             text: "The heroes set out from the city gate." },
    { id: 1,  type: "creature", country: "VN", name: "Paddy rats",             enemy: { power: 10, weak: "scholar" },   loot: { food: 4 } },
    { id: 2,  type: "crate",    country: "VN", name: "Lucky crate",            give: { wood: 12 } },
    { id: 3,  type: "creature", country: "LA", name: "Giant leeches",          enemy: { power: 15, weak: "engineer" },  loot: { food: 5 } },
    { id: 4,  type: "army",     country: "LA", name: "Timber poachers",        enemy: { power: 24, weak: "navigator" }, loot: { stone: 12, wood: 6 } },
    { id: 5,  type: "crate",    country: "LA", name: "Mimosa blossom",         give: { mimosa: 1 } },
    { id: 6,  type: "town",     country: "LA", name: "Luang Prabang market",   text: "A safe stop. If the army falls, it retreats here." },
    { id: 7,  type: "creature", country: "KH", name: "Cave bats",              enemy: { power: 22, weak: "engineer" },  loot: { food: 6 } },
    { id: 8,  type: "mini",     country: "KH", name: "King cobra",             enemy: { power: 36, weak: "scholar" },   loot: { psilocybe: 1, food: 10 } },
    { id: 9,  type: "boss",     country: "KH", name: "Indochinese tiger",      boss: "tiger" },
    { id: 10, type: "town",     country: "TH", name: "Bangkok dock",           text: "Boats, noodles and a safe place to regroup." },
    { id: 11, type: "creature", country: "TH", name: "River monitors",         enemy: { power: 30, weak: "navigator" }, loot: { food: 6 } },
    { id: 12, type: "crate",    country: "TH", name: "Metal crate",            give: { metal: 5 } },
    { id: 13, type: "army",     country: "MY", name: "Smugglers' convoy",      enemy: { power: 42, weak: "engineer" },  loot: { metal: 6, stone: 10 } },
    { id: 14, type: "crate",    country: "MY", name: "Shroom ring",            give: { psilocybe: 1 } },
    { id: 15, type: "creature", country: "ID", name: "Reef crabs",             enemy: { power: 36, weak: "scholar" },   loot: { food: 8 } },
    { id: 16, type: "army",     country: "ID", name: "Pirate skiffs",          enemy: { power: 54, weak: "navigator" }, loot: { wood: 12, metal: 6 } },
    { id: 17, type: "crate",    country: "ID", name: "Mimosa grove",           give: { mimosa: 1, food: 10 } },
    { id: 18, type: "mini",     country: "ID", name: "Blue-ringed octopus",    enemy: { power: 62, weak: "engineer" },  loot: { psilocybe: 1, metal: 8 } },
    { id: 19, type: "boss",     country: "ID", name: "Komodo dragon",          boss: "komodo" },
    { id: 20, type: "end",      country: "ID", name: "End of region 1",        text: "Region 2 is on its way." }
  ];
  var BOSSES = {
    tiger:  { name: "Indochinese tiger", home: "Mekong forests", puzzle: "wxrdie", difficulty: "normal", index: 7,  seconds: 240, tier: "Common", fact: "A stealth hunter of the deep forest: it rarely shows itself before it strikes.",
              reward: { wood: 30, stone: 15, mimosa: 1 }, trophy: "Tiger's claw", loseDamage: 0.2 },
    komodo: { name: "Komodo dragon",     home: "Indonesia",      puzzle: "zame",   difficulty: "normal", index: 4,  seconds: 0,   tier: "Common", fact: "The largest living lizard. Its bite is venomous.",
              reward: { metal: 30, food: 15, psilocybe: 1 }, trophy: "Dragon scale", loseDamage: 0.25 }
  };
  var BOSS_SECONDS = { wxrdie: 240, elmundo: 300, kuduso: 600, mapnitude: 240, zame: 0 };   // shell-enforced timers; Zame has its own

  /* ---------- state ---------- */
  function newState() {
    var s = { day: 1, res: {}, buildings: {}, troops: 0, armor: 0, heroes: { navigator: 1, scholar: 1, engineer: 1 }, hp: 0, march: MARCH_PER_DAY,
      node: 0, checkpoint: 0, mimosaDay: 0, cleared: {}, bossTry: {}, trophies: [], playedToday: {}, solved: { elmundo: 0, wxrdie: 0, mapnitude: 0, kuduso: 0, zame: 0 }, rest: null, log: [] };
    RES.forEach(function (r) { s.res[r] = START[r]; });
    BUILDING_ORDER.forEach(function (b) { s.buildings[b] = 0; });
    s.hp = maxHp(s); return s;
  }
  function addRes(s, gain, events) { Object.keys(gain).forEach(function (r) { if (gain[r]) { s.res[r] = (s.res[r] || 0) + gain[r]; } }); return gain; }
  function canAfford(s, cost) { return Object.keys(cost).every(function (r) { return (s.res[r] || 0) >= cost[r]; }); }
  function pay(s, cost) { Object.keys(cost).forEach(function (r) { s.res[r] -= cost[r]; }); }
  function costOf(base) { return Object.keys(base).reduce(function (a, r) { return a + base[r]; }, 0); }

  /* ---------- city ---------- */
  function upgradeCost(id, level) {              // cost to go from `level` to level + 1 (level 0 = build)
    var b = BUILDINGS[id]; if (level === 0) return Object.assign({}, b.cost);
    var c = {}; Object.keys(b.cost).forEach(function (r) { c[r] = Math.ceil(b.cost[r] * (level + 1) * 0.6); }); c.metal = (c.metal || 0) + 3 * level; return c;
  }
  function credit(s) { return BUILDING_ORDER.reduce(function (a, id) { return a + costOf(BUILDINGS[id].cost) * s.buildings[id]; }, 0); }
  function citizens(s) { return Math.min(40, 3 * s.day); }
  function housing(s) { return 4 * s.buildings.bamboo; }
  /** 0.3 (everyone in a camp) up to 1 (everyone housed). Placeholder until the Citizens release brings real citizens. */
  function wellbeing(s) { return Math.min(1, 0.3 + 0.7 * Math.min(1, housing(s) / citizens(s))); }
  function build(s, id) { return upgrade(s, id); }
  /** Build (level 0 -> 1) or upgrade. Returns { ok, events }. */
  function upgrade(s, id) {
    var b = BUILDINGS[id]; if (!b) return { ok: false, error: "Unknown building" };
    var lv = s.buildings[id]; if (lv >= MAX_LEVEL) return { ok: false, error: "Already at the top level" };
    var cost = upgradeCost(id, lv); if (!canAfford(s, cost)) return { ok: false, error: "Not enough resources", cost: cost };
    pay(s, cost); s.buildings[id] = lv + 1; var ev = [{ type: lv === 0 ? "built" : "upgraded", building: id, level: lv + 1 }];
    if (b.puzzle && lv + 1 === PUZZLE_UNLOCK_LEVEL) ev.push({ type: "unlock", puzzle: b.puzzle, building: id });
    var oldMax = s.hp; void oldMax; return { ok: true, events: ev, cost: cost };
  }
  function puzzleUnlocked(s, puzzle) { var id = BUILDING_ORDER.filter(function (k) { return BUILDINGS[k].puzzle === puzzle; })[0]; return !!id && s.buildings[id] >= PUZZLE_UNLOCK_LEVEL; }
  function puzzleBuilding(puzzle) { return BUILDING_ORDER.filter(function (k) { return BUILDINGS[k].puzzle === puzzle; })[0]; }
  function unlockedPuzzles(s) { return PUZZLE_ORDER.filter(function (p) { return puzzleUnlocked(s, p); }); }

  /* ---------- army ---------- */
  function maxHp(s) { return 40 + 2 * s.troops + Math.floor(credit(s) / 10) + Math.round(30 * wellbeing(s)) + 5 * s.trophies.length; }
  function heroTotal(s) { return s.heroes.navigator + s.heroes.scholar + s.heroes.engineer; }
  function attackPower(s) { return 10 + s.troops + 2 * s.armor + 4 * heroTotal(s); }
  function armorReduction(s) { return Math.min(ARMOR_REDUCTION_MAX, s.armor * ARMOR_REDUCTION); }
  function troopCap(s) { return TROOP_CAP_PER_LEVEL * s.buildings.barracks; }
  function armorCap(s) { return ARMOR_CAP_PER_LEVEL * s.buildings.armory; }
  function trainTroops(s) {
    if (!s.buildings.barracks) return { ok: false, error: "Build the Barracks first" };
    if (s.troops + TROOPS_PER_TRAIN > troopCap(s)) return { ok: false, error: "Barracks is full: upgrade it" };
    if (s.res.food < TRAIN_FOOD) return { ok: false, error: "Not enough Food" };
    s.res.food -= TRAIN_FOOD; s.troops += TROOPS_PER_TRAIN; return { ok: true };
  }
  function forgeArmor(s) {
    if (!s.buildings.armory) return { ok: false, error: "Build the Armory first" };
    if (s.armor + 1 > armorCap(s)) return { ok: false, error: "Armory is full: upgrade it" };
    if (s.res.metal < ARMOR_METAL) return { ok: false, error: "Not enough Metal" };
    s.res.metal -= ARMOR_METAL; s.armor += 1; return { ok: true };
  }
  function heroMaxLevel(s) { return s.buildings.herohall ? 2 + s.buildings.herohall : 1; }
  function heroCost(s, hero) { return 15 * s.heroes[hero]; }
  function levelHero(s, hero) {
    if (!HEROES[hero]) return { ok: false, error: "Unknown hero" };
    if (!s.buildings.herohall) return { ok: false, error: "Build the Hero hall first" };
    if (s.heroes[hero] >= heroMaxLevel(s)) return { ok: false, error: "Upgrade the Hero hall to level further" };
    var c = heroCost(s, hero); if (s.res.food < c) return { ok: false, error: "Not enough Food" };
    var gate = s.heroes[hero] + 1 === GATE_LEVEL;                               // the level-5 milestone needs one Psilocybe, spent automatically
    if (gate && s.res.psilocybe < 1) return { ok: false, error: "Level " + GATE_LEVEL + " needs 1 Psilocybe", gate: true };
    s.res.food -= c; if (gate) s.res.psilocybe -= 1; s.heroes[hero]++; return { ok: true, gate: gate };
  }
  /** Extra hints and seconds a puzzle gets from the heroes that specialise in it. Level 1: +1 hint. Level 3: +30 seconds. */
  function heroBonus(s, puzzle) {
    var lv = 0; Object.keys(HEROES).forEach(function (h) { if (HEROES[h].puzzles.indexOf(puzzle) >= 0) lv = Math.max(lv, s.heroes[h]); });
    return { hints: (lv >= 1 ? 1 : 0) + (s.mimosaDay === s.day ? 1 : 0), seconds: lv >= 3 ? 30 : 0, level: lv, mimosa: s.mimosaDay === s.day };
  }
  /** Mimosa: one extra hint in every puzzle for the rest of today. */
  function useMimosa(s) {
    if (s.mimosaDay === s.day) return { ok: false, error: "Mimosa is already active today" };
    if (s.res.mimosa < 1) return { ok: false, error: "No Mimosa. Find some on the road." };
    s.res.mimosa -= 1; s.mimosaDay = s.day; return { ok: true };
  }
  function moraleSeconds(s) { return Math.round(BOSS_MORALE_SECONDS * Math.max(0, s.hp) / maxHp(s)); }

  /* ---------- hospital ---------- */
  function restSeconds(s) { return s.buildings.hospital ? REST_SECONDS[s.buildings.hospital - 1] : 0; }
  function startRest(s, now) {
    if (!s.buildings.hospital) return { ok: false, error: "Build the Hospital first" };
    if (s.rest) return { ok: false, error: "The army is already resting" };
    if (s.hp >= maxHp(s)) return { ok: false, error: "The army is already at full health" };
    s.rest = { end: now + restSeconds(s) * 1000 }; return { ok: true, seconds: restSeconds(s) };
  }
  function restLeft(s, now) { return s.rest ? Math.max(0, Math.ceil((s.rest.end - now) / 1000)) : 0; }
  /** Call regularly: when the rest is over, health is full. Returns true when it just finished. */
  function tickRest(s, now) { if (s.rest && now >= s.rest.end) { s.rest = null; s.hp = maxHp(s); return true; } return false; }

  /* ---------- day, puzzle rewards ---------- */
  function nextDay(s) {
    s.day++; s.march = Math.min(MARCH_CAP, s.march + MARCH_PER_DAY); s.playedToday = {};
    var got = {}; BUILDING_ORDER.forEach(function (id) { var b = BUILDINGS[id]; if (b.produce && s.buildings[id]) Object.keys(b.produce).forEach(function (r) { var n = b.produce[r] * s.buildings[id]; got[r] = (got[r] || 0) + n; }); });
    addRes(s, got); return { ok: true, produced: got, march: MARCH_PER_DAY };
  }
  /** Resources for one solved puzzle: 60% in the puzzle's own resource, the rest in Wood, Stone and Food. Level 3 buildings pay x1.25. */
  function puzzleReward(s, puzzle, difficulty) {
    var total = REWARD_BASE[difficulty] * (s.buildings[puzzleBuilding(puzzle)] >= 3 ? 1.25 : 1), main = Math.round(total * 0.6), rest = Math.round(total) - main, out = {};
    out[PUZZLES[puzzle].main] = main; var others = ["wood", "stone", "food"].filter(function (r) { return r !== PUZZLES[puzzle].main; });
    others.forEach(function (r, i) { out[r] = (out[r] || 0) + Math.floor(rest / others.length) + (i < rest % others.length ? 1 : 0); }); return out;
  }
  /** A puzzle was finished. A win pays once a day per puzzle and gives one march point. */
  function puzzleDone(s, puzzle, difficulty, won) {
    if (!puzzleUnlocked(s, puzzle)) return { ok: false, error: "Puzzle is locked" };
    if (!won) return { ok: true, paid: false, reward: {}, march: 0 };
    s.solved[puzzle]++; if (s.playedToday[puzzle]) return { ok: true, paid: false, reward: {}, march: 0, repeat: true };
    s.playedToday[puzzle] = true; var r = puzzleReward(s, puzzle, difficulty); addRes(s, r); s.march = Math.min(MARCH_CAP, s.march + 1); return { ok: true, paid: true, reward: r, march: 1 };
  }
  function suggestedDifficulty(s) { var c = credit(s); return c < 80 ? "easy" : c < 200 ? "normal" : "hard"; }

  /* ---------- road ---------- */
  function nodeAt(i) { return ROAD[i]; }
  function pending(s) { var n = ROAD[s.node]; return n && !s.cleared[n.id] && (n.enemy || n.boss) ? n : null; }
  function enemyAttack(s, node) { return attackPower(s) + 4 * s.heroes[node.enemy.weak]; }      // the hero the enemy is weak to adds extra
  /** What a fight against this node's enemy would look like: win or not, and the health it would cost. */
  function odds(s, node) {
    var atk = enemyAttack(s, node), e = node.enemy.power, r = atk / e, win = r >= 0.8, dmg = Math.max(1, Math.round(e * 0.5 / Math.max(0.5, r) * (win ? 1 : 1.2) * (1 - armorReduction(s))));
    return { attack: atk, enemy: e, ratio: r, win: win, damage: dmg, verdict: r >= 1.4 ? "easy" : r >= 0.8 ? "risky" : "too strong" };
  }
  function march(s) {
    if (s.rest) return { ok: false, error: "The army is resting" };
    var cur = ROAD[s.node]; if (pending(s)) return { ok: false, error: "Something blocks the road" };
    if (cur.type === "end") return { ok: false, error: "End of the road" };
    if (s.march < 1) return { ok: false, error: "No march points left. Solve a puzzle or start a new day." };
    if (s.hp <= 0) return { ok: false, error: "The army has no health left. Rest at the Hospital." };
    s.march--; s.node++; var n = ROAD[s.node], ev = [{ type: "arrive", node: n.id }];
    if (n.type === "town") { s.checkpoint = n.id; s.cleared[n.id] = true; }
    if (n.type === "crate" && !s.cleared[n.id]) { s.cleared[n.id] = true; addRes(s, n.give); ev.push({ type: "pickup", give: n.give }); }
    if (n.type === "end") s.cleared[n.id] = true;
    return { ok: true, events: ev, node: n };
  }
  /** Fight the enemy blocking the road. A win takes the loot; a loss costs health and sends the army back to the last town. */
  function fight(s) {
    var n = pending(s); if (!n || !n.enemy) return { ok: false, error: "No enemy here" };
    var o = odds(s, n); s.hp = Math.max(0, s.hp - o.damage);
    if (o.win) { s.cleared[n.id] = true; addRes(s, n.loot); if (s.hp === 0) s.hp = 1; return { ok: true, won: true, damage: o.damage, loot: n.loot, odds: o }; }
    s.node = s.checkpoint; s.hp = Math.max(1, Math.round(maxHp(s) * 0.1)); return { ok: true, won: false, damage: o.damage, retreatTo: s.checkpoint, odds: o };
  }

  /* ---------- big bosses ---------- */
  function bossFor(s) { var n = ROAD[s.node]; return n && n.boss ? BOSSES[n.boss] : null; }
  function bossCanTry(s) { var n = ROAD[s.node]; return !!(n && n.boss && !s.cleared[n.id] && s.bossTry[n.boss] !== s.day); }
  /** What to hand to the puzzle: its seed, difficulty, locked UI, plus the hero hints/seconds and the army-morale seconds. */
  function bossConfig(s) {
    var n = ROAD[s.node], b = n && n.boss ? BOSSES[n.boss] : null; if (!b) return null;
    var hb = heroBonus(s, b.puzzle), morale = moraleSeconds(s), base = BOSS_SECONDS[b.puzzle] || 0;
    return { boss: n.boss, puzzle: b.puzzle, difficulty: b.difficulty, index: b.index, locked: true, bonusHints: hb.hints, heroSeconds: hb.seconds, moraleSeconds: morale,
      seconds: base ? base + hb.seconds + morale : 0, zameBonusSeconds: base ? 0 : hb.seconds + morale, unlocked: puzzleUnlocked(s, b.puzzle) };
  }
  function bossFinish(s, won) {
    var n = ROAD[s.node], b = n && n.boss ? BOSSES[n.boss] : null; if (!b || s.cleared[n.id]) return { ok: false, error: "No boss here" };
    s.bossTry[n.boss] = s.day;
    if (won) { s.cleared[n.id] = true; addRes(s, b.reward); s.trophies.push(b.trophy); return { ok: true, won: true, reward: b.reward, trophy: b.trophy }; }
    var dmg = Math.max(1, Math.round(maxHp(s) * b.loseDamage * (1 - armorReduction(s)))); s.hp = Math.max(1, s.hp - dmg); return { ok: true, won: false, damage: dmg };
  }
  function recommendedPower(s) { var n = ROAD[Math.min(s.node + 1, ROAD.length - 1)]; return n && n.enemy ? n.enemy.power : 0; }

  /* ---------- save ---------- */
  function normaliseState(raw) {
    var s = newState(); if (!raw || typeof raw !== "object") return s;
    var num = function (v, d) { return typeof v === "number" && isFinite(v) && v >= 0 ? Math.floor(v) : d; };
    s.day = Math.max(1, num(raw.day, 1)); RES.forEach(function (r) { s.res[r] = num(raw.res && raw.res[r], START[r]); });
    BUILDING_ORDER.forEach(function (b) { s.buildings[b] = Math.min(MAX_LEVEL, num(raw.buildings && raw.buildings[b], 0)); });
    s.troops = num(raw.troops, 0); s.armor = num(raw.armor, 0); Object.keys(HEROES).forEach(function (h) { s.heroes[h] = Math.min(HERO_MAX, Math.max(1, num(raw.heroes && raw.heroes[h], 1))); });
    s.mimosaDay = num(raw.mimosaDay, 0); s.march = Math.min(MARCH_CAP, num(raw.march, MARCH_PER_DAY)); s.node = Math.min(ROAD.length - 1, num(raw.node, 0)); s.checkpoint = Math.min(s.node, num(raw.checkpoint, 0));
    s.cleared = raw.cleared && typeof raw.cleared === "object" ? raw.cleared : {}; s.bossTry = raw.bossTry && typeof raw.bossTry === "object" ? raw.bossTry : {};
    s.trophies = Array.isArray(raw.trophies) ? raw.trophies.filter(function (t) { return typeof t === "string"; }) : []; s.playedToday = raw.playedToday && typeof raw.playedToday === "object" ? raw.playedToday : {};
    PUZZLE_ORDER.forEach(function (p) { s.solved[p] = num(raw.solved && raw.solved[p], 0); }); s.rest = raw.rest && typeof raw.rest.end === "number" ? { end: raw.rest.end } : null;
    s.hp = Math.min(maxHp(s), num(raw.hp, maxHp(s))); return s;
  }

  return {
    RES: RES, HEROES: HEROES, PUZZLES: PUZZLES, PUZZLE_ORDER: PUZZLE_ORDER, BUILDINGS: BUILDINGS, BUILDING_ORDER: BUILDING_ORDER, MAX_LEVEL: MAX_LEVEL, PUZZLE_UNLOCK_LEVEL: PUZZLE_UNLOCK_LEVEL,
    ROAD: ROAD, BOSSES: BOSSES, REWARD_BASE: REWARD_BASE, REST_SECONDS: REST_SECONDS, TRAIN_FOOD: TRAIN_FOOD, TROOPS_PER_TRAIN: TROOPS_PER_TRAIN, ARMOR_METAL: ARMOR_METAL, HERO_MAX: HERO_MAX,
    newState: newState, canAfford: canAfford, upgradeCost: upgradeCost, credit: credit, citizens: citizens, housing: housing, wellbeing: wellbeing, build: build, upgrade: upgrade,
    puzzleUnlocked: puzzleUnlocked, puzzleBuilding: puzzleBuilding, unlockedPuzzles: unlockedPuzzles, maxHp: maxHp, attackPower: attackPower, armorReduction: armorReduction,
    troopCap: troopCap, armorCap: armorCap, trainTroops: trainTroops, forgeArmor: forgeArmor, heroMaxLevel: heroMaxLevel, heroCost: heroCost, levelHero: levelHero, heroBonus: heroBonus,
    moraleSeconds: moraleSeconds, useMimosa: useMimosa, GATE_LEVEL: GATE_LEVEL, restSeconds: restSeconds, startRest: startRest, restLeft: restLeft, tickRest: tickRest, nextDay: nextDay, puzzleReward: puzzleReward, puzzleDone: puzzleDone,
    suggestedDifficulty: suggestedDifficulty, nodeAt: nodeAt, pending: pending, odds: odds, march: march, fight: fight, bossFor: bossFor, bossCanTry: bossCanTry, bossConfig: bossConfig,
    bossFinish: bossFinish, recommendedPower: recommendedPower, normaliseState: normaliseState
  };
});
