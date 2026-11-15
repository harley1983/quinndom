/* Building data (PRD FR-5.2): the 13 placeable things from the GDD table, kept in one file so costs and effects can be tuned.
   Release 3 step 1 uses footprint, cost, group and the effect text. `produce` is read by daily production in a later step.
   w and d are the footprint in tiles (w along x, d along y). h is the drawn height in pixels (only used to click tall buildings). */
var Buildings = (function () {
  var GROUPS = [
    { id: 'infrastructure', name: 'Infrastructure' },
    { id: 'housing', name: 'Housing' },
    { id: 'production', name: 'Production' },
    { id: 'attraction', name: 'Attraction' },
    { id: 'military', name: 'Military' },
    { id: 'civic', name: 'Civic' }
  ];
  var COST_KEYS = ['wood', 'stone', 'metal', 'food'];

  var LIST = [
    { id: 'road', name: 'Road tile', group: 'infrastructure', w: 1, d: 1, h: 0, road: true, cost: { stone: 2 }, effect: 'Connects buildings; visitors need roads' },
    { id: 'bamboo-home', name: 'Bamboo home', group: 'housing', w: 1, d: 1, h: 18, cost: { wood: 10, stone: 5 }, effect: 'Houses 4 citizens', houses: 4 },
    { id: 'timber-grove', name: 'Timber grove', group: 'production', w: 1, d: 1, h: 20, cost: { wood: 8, stone: 4 }, effect: '+5 Wood per day', produce: { wood: 5 } },
    { id: 'quarry', name: 'Quarry', group: 'production', w: 1, d: 1, h: 14, cost: { wood: 12 }, effect: '+5 Stone per day', produce: { stone: 5 } },
    { id: 'recycling-foundry', name: 'Recycling foundry', group: 'production', w: 1, d: 1, h: 26, cost: { wood: 10, stone: 15 }, effect: '+3 Metal per day', produce: { metal: 3 } },
    { id: 'vertical-farm', name: 'Vertical farm', group: 'production', w: 1, d: 1, h: 28, cost: { wood: 10, stone: 10, metal: 2 }, effect: '+8 Food per day', produce: { food: 8 } },
    { id: 'mimosa-garden', name: 'Mimosa garden', group: 'production', w: 1, d: 1, h: 10, cost: { wood: 15, stone: 5 }, effect: '+1 Mimosa per day', produce: { mimosa: 1 } },
    { id: 'mycelium-lab', name: 'Mycelium lab', group: 'production', w: 1, d: 1, h: 18, cost: { stone: 10, metal: 5 }, effect: '+1 Psilocybe per day', produce: { psilocybe: 1 } },
    { id: 'solar-array', name: 'Solar array', group: 'infrastructure', w: 2, d: 1, h: 12, cost: { stone: 5, metal: 8 }, effect: 'Powers 6 buildings; unlocks upgrades' },
    { id: 'sky-garden-plaza', name: 'Sky garden plaza', group: 'attraction', w: 2, d: 2, h: 14, cost: { wood: 20, stone: 20, metal: 5 }, effect: 'Draws visitors; +Credit bonus' },
    { id: 'barracks', name: 'Barracks', group: 'military', w: 1, d: 1, h: 24, cost: { wood: 15, stone: 15 }, effect: 'Trains troops with Food' },
    { id: 'armory', name: 'Armory', group: 'military', w: 1, d: 1, h: 22, cost: { stone: 10, metal: 10 }, effect: 'Forges armor with Metal' },
    { id: 'hero-hall', name: 'Hero hall', group: 'military', w: 2, d: 2, h: 36, cost: { stone: 20, metal: 10 }, effect: 'Houses heroes; unlocks hero levels' }
  ];
  /* Civic buildings (v0.9): the hospital and stores a new city already has. They are free, cannot be bought, moved or removed,
     are not in the build tray, and are worth 0 Credit (no cost x level). */
  var CIVIC = [
    { id: 'hospital', name: 'Hospital', group: 'civic', civic: true, w: 2, d: 2, h: 40, cost: {}, effect: 'Cares for citizens (services come in a later release)' },
    { id: 'market', name: 'Market', group: 'civic', civic: true, w: 2, d: 1, h: 26, cost: {}, effect: 'Market stalls; the store opens here in a later step' },
    { id: 'corner-shop', name: 'Corner shop', group: 'civic', civic: true, w: 1, d: 1, h: 24, cost: {}, effect: 'A friendly neighbourhood shop' }
  ];
  var BY_ID = {};
  LIST.forEach(function (b) { BY_ID[b.id] = b; });
  CIVIC.forEach(function (b) { BY_ID[b.id] = b; });

  function get(id) { return Object.prototype.hasOwnProperty.call(BY_ID, id) ? BY_ID[id] : null; }
  /* total construction cost: the sum of every resource in the cost */
  function totalCost(id) { var b = get(id), n = 0; if (!b) return 0; Object.keys(b.cost).forEach(function (k) { n += b.cost[k]; }); return n; }
  /* a building's value = its total construction cost x its level (GDD "City and Credit score") */
  function value(id, level) { return totalCost(id) * Math.max(1, Math.floor(level || 1)); }

  return { GROUPS: GROUPS, LIST: LIST, CIVIC: CIVIC, COST_KEYS: COST_KEYS, get: get, totalCost: totalCost, value: value };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Buildings;
