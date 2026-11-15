/* The store (Release 3). Rules, decided by Harley on 12 and 15 Nov:
   - Coins buy only Mimosa and Psilocybe (speed-ups wait until something takes build time, Release 4).
   - Basic resources trade at fixed ratios: 1 Wood = 1 Stone (either way) and 20 Stone = 1 Metal. Nothing is sold for coins and nothing turns into coins.
   - The stock rotates every day and is the same for every player: today's limits come from the Vietnam day key, with no server.
   Every function here is pure: it takes the current resources and the day's purchases and returns the new ones (or an error), so it can be tested in Node. */
var Store = (function () {
  var PRICES = { mimosa: 5, psilocybe: 8 };
  var STOCK_RANGE = { mimosa: [2, 4], psilocybe: [1, 2] };    // units for sale per day, min and max
  var TRADES = [
    { id: 'wood-stone', give: 'wood', get: 'stone', rate: 1, name: 'Wood for Stone' },
    { id: 'stone-wood', give: 'stone', get: 'wood', rate: 1, name: 'Stone for Wood' },
    { id: 'stone-metal', give: 'stone', get: 'metal', rate: 20, name: 'Stone for Metal' }
  ];                                                          // rate = how many you give for one you get

  function hash(text) { var h = 2166136261; for (var i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  /* how many of each rare item are for sale on this day (same for everyone) */
  function stock(day) {
    var out = {};
    Object.keys(PRICES).forEach(function (k) { var r = STOCK_RANGE[k]; out[k] = r[0] + hash(day + ':' + k) % (r[1] - r[0] + 1); });
    return out;
  }
  function boughtToday(store, day) { return store && store.day === day ? store.bought : { mimosa: 0, psilocybe: 0 }; }
  function left(store, day) { var s = stock(day), b = boughtToday(store, day), out = {}; Object.keys(s).forEach(function (k) { out[k] = Math.max(0, s[k] - (b[k] || 0)); }); return out; }

  /* buy one Mimosa or Psilocybe with coins */
  function buy(resources, store, item, day) {
    if (!PRICES[item]) return { ok: false, error: 'That is not for sale.' };
    if (left(store, day)[item] < 1) return { ok: false, error: 'Sold out for today. The stock changes at midnight, Vietnam time.' };
    if ((resources.coins || 0) < PRICES[item]) return { ok: false, error: 'You need ' + PRICES[item] + ' coins. Coins come from the Journey.' };
    var res = Object.assign({}, resources), b = Object.assign({ mimosa: 0, psilocybe: 0 }, boughtToday(store, day));
    res.coins -= PRICES[item]; res[item] = (res[item] || 0) + 1; b[item] += 1;
    return { ok: true, resources: res, store: { day: day, bought: b } };
  }

  /* trade `times` lots at a fixed ratio */
  function trade(resources, id, times) {
    var t = TRADES.filter(function (x) { return x.id === id; })[0];
    times = Math.floor(Number(times));
    if (!t || !(times >= 1)) return { ok: false, error: 'That trade does not exist.' };
    var cost = t.rate * times;
    if ((resources[t.give] || 0) < cost) return { ok: false, error: 'You need ' + cost + ' ' + t.give + '.' };
    var res = Object.assign({}, resources); res[t.give] -= cost; res[t.get] = (res[t.get] || 0) + times;
    return { ok: true, resources: res };
  }

  return { PRICES: PRICES, TRADES: TRADES, stock: stock, left: left, buy: buy, trade: trade, boughtToday: boughtToday };
})();
if (typeof module !== 'undefined') module.exports = Store;
