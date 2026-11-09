/* Mapnitude engine: pure game logic, no DOM, no storage. Browser (window.MapnitudeEngine) and Node (module.exports).
 *
 * Rules (QuinnDom Release 2, FR-4.5): 3 to 4 rounds. Each round asks for one country fact (population, area, distance between two
 * capitals, or highest point) and the player sets a slider. The closer the guess, the more points (0 to 1000 a round).
 *  - The slider is logarithmic, so "10 thousand or 10 million?" matters more than "5.1 or 5.3 million".
 *  - Score = how many times too big or too small the guess is (not the difference): full points inside a band, then a straight
 *    fall to zero. Difficulty sets how wide that band is and which countries are asked about (Easy = well-known names).
 *  - Hints narrow the slider for the current round and cost 25% / 50% of that round's points. Easy and Normal have 3 hints a game, Hard 2.
 *  - Easy is 3 rounds, Normal and Hard 4. Full-points band: Easy +-5% (famous countries), Normal +-8%, Hard +-15% (obscure countries).
 *  - Games are generated from a seed: game N of a difficulty is the same for everyone. Save file keeps only how many games were completed.
 *  - facts = rows from data/mapnitude-facts.json: { code, name, capital, continent, population?, area, peakM?, peak?, peakNote?, capLat?, capLon?, fame }.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MapnitudeEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var DIFFICULTIES = ["easy", "normal", "hard"];
  var ROUNDS = { easy: 3, normal: 4, hard: 4 }, MAX_ROUND = 1000, PASS_PERCENT = 60;
  var SEED = 20261109;
  // Famous countries are held to a tighter band (you should know them); obscure ones get a generous one.
  // fullWithin: relative error that still earns full points (0.15 = 15%); zeroAt: "this many times too big or small" earns nothing
  var LEVELS = { easy: { fullWithin: 0.05, zeroAt: 10 }, normal: { fullWithin: 0.08, zeroAt: 6 }, hard: { fullWithin: 0.15, zeroAt: 4 } };
  var HINT_COST = [1, 0.75, 0.5];                          // share of the round's points left after 0, 1, 2 hints
  var HINT_SPAN = [Infinity, 100, 10];                     // slider window (highest / lowest) after 0, 1, 2 hints
  var HINTS = { easy: 3, normal: 3, hard: 2 };
  var TYPES = {
    population: { unit: "people",  min: 1000, max: 2e9,  offset: 0 },
    area:       { unit: "km²",     min: 0.1,  max: 2e7,  offset: 0 },
    distance:   { unit: "km",      min: 50,   max: 20000, offset: 0 },
    peak:       { unit: "m",       min: 1,    max: 10000, offset: 50 }     // offset keeps 5 m vs 10 m from being scored like 500 m vs 1,000 m
  };
  var TYPE_LIST = ["population", "area", "distance", "peak"];

  /* ---------- seeded random ---------- */
  function rng(seed) {
    var a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function shuffle(arr, rand) { for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(rand() * (i + 1)), t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }

  /* ---------- geography ---------- */
  function rad(d) { return d * Math.PI / 180; }
  function distanceKm(a, b) {
    var dLat = rad(b[0] - a[0]), dLon = rad(b[1] - a[1]);
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  /* ---------- which countries can be asked about ---------- */
  function canAsk(type, f) {
    if (type === "population") return typeof f.population === "number" && f.population > 0;
    if (type === "area") return typeof f.area === "number" && f.area > 0;
    if (type === "peak") return typeof f.peakM === "number" && !f.peakNote;
    if (type === "distance") return typeof f.capLat === "number";
    return false;
  }
  /** Country pool by how well known the name is. Easy: the 80 best known. Normal: ranks 40 to 150. Hard: the 100 least known. */
  function poolFor(difficulty, facts) {
    var sorted = facts.slice().sort(function (a, b) { return b.fame - a.fame || (a.code < b.code ? -1 : 1); }), n = sorted.length;
    if (difficulty === "easy") return sorted.slice(0, 80);
    if (difficulty === "normal") return sorted.slice(40, 150);
    return sorted.slice(n - 100);
  }

  /* ---------- building a game ---------- */
  function valueOf(round, byCode) {
    var a = byCode[round.a];
    if (round.type === "population") return a.population;
    if (round.type === "area") return a.area;
    if (round.type === "peak") return a.peakM;
    return distanceKm([a.capLat, a.capLon], [byCode[round.b].capLat, byCode[round.b].capLon]);
  }

  /** Game number `index` (0, 1, 2 ...) of a difficulty: 3 rounds (Easy) or 4 (Normal, Hard), every question of a different kind, no country twice. */
  function makeGame(difficulty, index, facts) {
    var rand = rng(SEED + DIFFICULTIES.indexOf(difficulty) * 1000003 + index * 7919), pool = poolFor(difficulty, facts), byCode = {};
    facts.forEach(function (f) { byCode[f.code] = f; });
    var types = shuffle(TYPE_LIST.slice(), rand).slice(0, ROUNDS[difficulty]);
    var used = {}, rounds = [];
    types.forEach(function (type, i) {
      var cands = shuffle(pool.filter(function (f) { return canAsk(type, f) && !used[f.code]; }), rand), a = cands[0], b = null;
      if (type === "distance") {
        var others = shuffle(pool.filter(function (f) { return canAsk(type, f) && f.code !== a.code && !used[f.code] && distanceKm([a.capLat, a.capLon], [f.capLat, f.capLon]) > 300; }), rand);
        b = others[0];
      }
      used[a.code] = true; if (b) used[b.code] = true;
      var round = { type: type, a: a.code, b: b ? b.code : null, seed: Math.floor(rand() * 1e9) };
      round.truth = valueOf(round, byCode);
      rounds.push(round);
    });
    return { difficulty: difficulty, index: index, rounds: rounds, results: [], hintsUsed: 0, hintLevel: 0, status: "playing" };
  }

  /* ---------- slider maths (logarithmic) ---------- */
  function sliderToValue(pos, lo, hi) { return lo * Math.pow(hi / lo, Math.min(1, Math.max(0, pos))); }
  function valueToSlider(v, lo, hi) { return Math.min(1, Math.max(0, Math.log(v / lo) / Math.log(hi / lo))); }
  /** Round to 3 significant figures, so the slider shows tidy numbers. */
  function tidy(v) { return v > 0 ? Number(v.toPrecision(3)) : 0; }

  function formatValue(type, v) {
    function num(n, d) { return n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: 0 }); }
    if (type === "population") {
      if (v >= 1e9) return num(v / 1e9, 2) + " billion"; if (v >= 1e6) return num(v / 1e6, v >= 1e7 ? 1 : 2) + " million";
      if (v >= 1e4) return num(Math.round(v / 100) * 100, 0); return num(Math.round(v), 0);
    }
    if (type === "area") {
      if (v >= 1e6) return num(v / 1e6, 2) + " million km²"; if (v >= 1000) return num(Math.round(v / 10) * 10, 0) + " km²";
      if (v >= 10) return num(Math.round(v), 0) + " km²"; return num(Math.round(v * 100) / 100, 2) + " km²";
    }
    if (type === "distance") return num(v >= 1000 ? Math.round(v / 10) * 10 : Math.round(v), 0) + " km";
    return num(Math.round(v), 0) + " m";
  }

  /* ---------- scoring ---------- */
  /** Points for a guess (0 to 1000), before any hint penalty. */
  function scoreGuess(type, guess, truth, difficulty) {
    var L = LEVELS[difficulty], off = TYPES[type].offset;
    var err = Math.abs(Math.log10((guess + off) / (truth + off)));
    var full = Math.log10(1 + L.fullWithin), zero = Math.log10(L.zeroAt);
    var share = err <= full ? 1 : Math.max(0, 1 - (err - full) / (zero - full));
    return { share: share, err: err, ratio: (guess + off) / (truth + off) };
  }

  /** The slider window after `level` hints: a stretch of the scale that holds the answer but does not sit on it. */
  function hintWindow(round, level) {
    var T = TYPES[round.type];
    if (!level) return [T.min, T.max];
    var span = HINT_SPAN[Math.min(level, 2)], u = 0.2 + 0.6 * rng(round.seed + level)(), truth = Math.min(T.max, Math.max(T.min, round.truth));
    var lo = truth / Math.pow(span, u), hi = lo * span;
    if (lo < T.min) { lo = T.min; hi = lo * span; } if (hi > T.max) { hi = T.max; lo = hi / span; }
    return [Math.max(T.min, lo), Math.min(T.max, hi)];
  }

  /* ---------- game state ---------- */
  function currentRound(game) { return game.rounds[game.results.length]; }
  function hintsAllowed(difficulty, bonus) { return HINTS[difficulty] + (bonus || 0); }
  /** Use a hint on the current round (up to 2 per round). Returns { ok, level, window }. */
  function useHint(game, bonus) {
    if (game.status !== "playing") return { ok: false, error: "Game over" };
    if (game.hintLevel >= 2) return { ok: false, error: "Already narrowed twice" };
    if (game.hintsUsed >= hintsAllowed(game.difficulty, bonus)) return { ok: false, error: "No hints left" };
    game.hintLevel++; game.hintsUsed++;
    return { ok: true, level: game.hintLevel, window: hintWindow(currentRound(game), game.hintLevel) };
  }
  /** Lock in a guess for the current round. Returns { ok, result } and moves to the next round (or finishes the game). */
  function submit(game, guess) {
    if (game.status !== "playing") return { ok: false, error: "Game over" };
    if (!(guess > 0) || !isFinite(guess)) return { ok: false, error: "Bad guess" };
    var round = currentRound(game), s = scoreGuess(round.type, guess, round.truth, game.difficulty);
    var points = Math.round(MAX_ROUND * s.share * HINT_COST[game.hintLevel]);
    var result = { type: round.type, a: round.a, b: round.b, guess: guess, truth: round.truth, points: points, share: s.share, ratio: s.ratio, hints: game.hintLevel, rating: rating(s.share) };
    game.results.push(result); game.hintLevel = 0;
    if (game.results.length >= game.rounds.length) game.status = "done";
    return { ok: true, result: result, done: game.status === "done" };
  }
  function rating(share) { return share >= 0.95 ? "perfect" : share >= 0.8 ? "great" : share >= 0.5 ? "good" : share >= 0.25 ? "meh" : "miss"; }
  function totalScore(game) { return game.results.reduce(function (a, r) { return a + r.points; }, 0); }
  function maxScore(game) { return MAX_ROUND * game.rounds.length; }
  function passed(game, passPercent) { return totalScore(game) >= maxScore(game) * (passPercent || PASS_PERCENT) / 100; }
  function stars(game) { var p = totalScore(game) / maxScore(game); return p >= 0.9 ? 3 : p >= 0.7 ? 2 : p >= 0.5 ? 1 : 0; }

  /* ---------- text ---------- */
  function questionText(round, byCode) {
    var a = byCode[round.a].name, b = round.b ? byCode[round.b].name : "";
    if (round.type === "population") return "How many people live in " + a + "?";
    if (round.type === "area") return "How big is " + a + " (total area)?";
    if (round.type === "peak") return "How high is the highest point of " + a + "?";
    return "How far apart are the capitals of " + a + " and " + b + "?";
  }
  function offBy(ratio) {
    var r = ratio >= 1 ? ratio : 1 / ratio, pct = Math.round((r - 1) * 100);
    if (pct < 1) return "Spot on";
    return r < 2 ? pct + "% " + (ratio > 1 ? "too high" : "too low") : (Math.round(r * 10) / 10) + "× " + (ratio > 1 ? "too high" : "too low");
  }
  function shareGrid(game) {
    var sq = { perfect: "🟩", great: "🟩", good: "🟨", meh: "🟧", miss: "🟥" };
    var s = stars(game);
    return "Mapnitude " + game.difficulty + " · " + totalScore(game).toLocaleString("en-US") + "/" + maxScore(game).toLocaleString("en-US") + " " + "★".repeat(s) + "☆".repeat(3 - s) +
      (game.hintsUsed ? " · " + game.hintsUsed + (game.hintsUsed === 1 ? " hint" : " hints") : "") + "\n\n" + game.results.map(function (r) { return sq[r.rating]; }).join("");
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
    DIFFICULTIES: DIFFICULTIES, ROUNDS: ROUNDS, MAX_ROUND: MAX_ROUND, PASS_PERCENT: PASS_PERCENT, LEVELS: LEVELS, TYPES: TYPES, HINTS: HINTS, HINT_COST: HINT_COST,
    distanceKm: distanceKm, canAsk: canAsk, poolFor: poolFor, makeGame: makeGame, sliderToValue: sliderToValue, valueToSlider: valueToSlider, tidy: tidy,
    formatValue: formatValue, scoreGuess: scoreGuess, hintWindow: hintWindow, currentRound: currentRound, hintsAllowed: hintsAllowed, useHint: useHint, submit: submit,
    rating: rating, totalScore: totalScore, maxScore: maxScore, passed: passed, stars: stars, questionText: questionText, offBy: offBy, shareGrid: shareGrid,
    emptySave: emptySave, recordCompleted: recordCompleted, normaliseSave: normaliseSave, totalCompleted: totalCompleted
  };
});
