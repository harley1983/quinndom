// QuinnDom passport-prompt engine.
// Deterministic by date (Vietnam midnight boundary): everyone opening the game on
// the same day sees the same prompt family, generated from quinndom-countries.js.
// No server: the "random" pick is a seeded hash of the date string.

(function (global) {
  'use strict';

  // ---- date & seeded RNG -------------------------------------------------

  // The game day boundary is midnight Vietnam time (UTC+7).
  function gameDateString(d) {
    d = d || new Date();
    var vn = new Date(d.getTime() + (7 * 60 - d.getTimezoneOffset()) * 60000);
    return vn.getFullYear() + '-' + String(vn.getMonth() + 1).padStart(2, '0') + '-' + String(vn.getDate()).padStart(2, '0');
  }

  function hashSeed(str) {
    var h = 1779033703 ^ str.length;
    for (var i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= h >>> 16;
      return (h >>> 0) / 4294967296;
    };
  }

  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

  // ---- prompt families -----------------------------------------------
  // Each family: id, text, family (for grouping), difficulty, test(country)->bool.
  // Countries whose field is unknown (null/undefined) never satisfy a test.

  var FAMILIES = [
    { id: 'pop100m', text: 'Has over 100 million people', group: 'People', diff: 'Easy',
      test: function (c) { return c.pop >= 100000000; } },
    { id: 'multiLang', text: 'Has more than one official language', group: 'People', diff: 'Easy',
      test: function (c) { return c.lang > 1; } },
    { id: 'landlocked', text: 'Is landlocked', group: 'Size and shape', diff: 'Easy',
      test: function (c) { return c.lkd === true; } },
    { id: 'bigCountry', text: 'Is larger than 1 million km²', group: 'Size and shape', diff: 'Easy',
      test: function (c) { return c.area >= 1000000; } },
    { id: 'bordersChina', text: 'Borders China', group: 'Neighbours', diff: 'Easy',
      test: function (c) { return CHINA_BORDERS.indexOf(c.n) !== -1; } },
    { id: 'africaMed', text: 'Is in Africa and on the Mediterranean Sea', group: 'Location', diff: 'Easy',
      test: function (c) { return c.cont === 'AF' && MED_AFRICA.indexOf(c.n) !== -1; } },
    { id: 'flagStar', text: 'Has a star on its flag', group: 'Symbols', diff: 'Easy',
      test: function (c) { return c.star === true; } },
    { id: 'usesEuro', text: 'Uses the euro', group: 'Symbols', diff: 'Easy',
      test: function (c) { return c.euro === true; } },
    { id: 'hostedOlympics', text: 'Has hosted the Summer Olympics', group: 'History', diff: 'Easy',
      test: function (c) { return c.olym === true; } },
    { id: 'hostedWorldCup', text: 'Has hosted a FIFA World Cup', group: 'History', diff: 'Easy',
      test: function (c) { return c.wc === true; } },
    { id: 'under1m', text: 'Has fewer than 1 million people', group: 'People', diff: 'Medium',
      test: function (c) { return c.pop > 0 && c.pop < 1000000; } },
    { id: 'capNotLargest', text: "Has a capital that is not its largest city", group: 'People', diff: 'Medium',
      test: function (c) { return c.capNL === true; } },
    { id: 'border5', text: 'Borders at least 5 countries', group: 'Neighbours', diff: 'Medium',
      test: function (c) { return c.bord >= 5; } },
    { id: 'crossesEquator', text: 'Crosses the Equator', group: 'Location', diff: 'Medium',
      test: function (c) { return c.eq === true; } },
    { id: 'southernOnly', text: 'Lies entirely in the Southern Hemisphere', group: 'Location', diff: 'Medium',
      test: function (c) { return c.south === true; } },
    { id: 'noRedFlag', text: 'Has a flag with no red', group: 'Symbols', diff: 'Medium',
      test: function (c) { return c.noRed === true; } },
    { id: 'drivesLeft', text: 'Drives on the left', group: 'Symbols', diff: 'Medium',
      test: function (c) { return c.left === true; } },
    { id: 'indepAfter1950', text: 'Gained independence after 1950', group: 'History', diff: 'Medium',
      test: function (c) { return typeof c.indep === 'number' && c.indep > 1950; } },
    { id: 'exOttoman', text: 'Was once part of the Ottoman Empire', group: 'History', diff: 'Medium',
      test: function (c) { return c.ottoman === true; } },
    { id: 'exFrench', text: 'Was a French colony or protectorate', group: 'History', diff: 'Medium',
      test: function (c) { return c.french === true; } },
    { id: 'exSoviet', text: 'Was part of the Soviet Union', group: 'History', diff: 'Medium',
      test: function (c) { return c.ussr === true; } },
    { id: 'monarchy', text: 'Is a monarchy today', group: 'History', diff: 'Medium',
      test: function (c) { return c.mon === true; } },
    { id: 'twoOceans', text: 'Has coastlines on two different oceans', group: 'Size and shape', diff: 'Hard',
      test: function (c) { return c.twoOc === true; } },
    { id: 'border1', text: 'Borders exactly one country', group: 'Neighbours', diff: 'Hard',
      test: function (c) { return c.bord === 1; } },
    { id: 'twoContinents', text: 'Has territory on two continents', group: 'Location', diff: 'Hard',
      test: function (c) { return c.twoCont === true; } },
    { id: 'flagAnimal', text: 'Has an animal on its flag', group: 'Symbols', diff: 'Hard',
      test: function (c) { return c.animal === true; } },
    { id: 'neverColonised', text: 'Was never colonised by a European power', group: 'History', diff: 'Hard',
      test: function (c) { return c.free === true; } },
    { id: 'capitalMovedAfter1950', text: 'Moved its capital to a new city after 1950', group: 'History', diff: 'Hard',
      test: function (c) { return CAPITAL_MOVED.indexOf(c.n) !== -1; } },
  ];

  // Small supplementary lookup tables for facts not in the per-country data.
  var CHINA_BORDERS = ['Vietnam', 'Laos', 'Myanmar', 'India', 'Nepal', 'Bhutan', 'Pakistan', 'Afghanistan',
    'Tajikistan', 'Kyrgyzstan', 'Kazakhstan', 'Mongolia', 'Russia', 'North Korea'];
  var MED_AFRICA = ['Egypt', 'Libya', 'Tunisia', 'Algeria', 'Morocco'];
  var CAPITAL_MOVED = ['Brazil', 'Nigeria', 'Myanmar', 'Kazakhstan', 'Tanzania', "Côte d'Ivoire"];

  // ---- public API ---------------------------------------------------

  function validAnswers(family, countries) {
    return countries.filter(family.test).map(function (c) { return c.n; });
  }

  // Pick today's prompt: a family whose valid-answer count is reasonable (3-60),
  // and a gold-worthy flag for countries outside a "well-known" shortlist.
  var WELL_KNOWN = ['United States', 'United Kingdom', 'France', 'Germany', 'Italy', 'Spain', 'China',
    'Japan', 'India', 'Brazil', 'Russia', 'Canada', 'Australia', 'Mexico', 'Vietnam', 'Thailand',
    'South Korea', 'Egypt', 'South Africa', 'Nigeria', 'Turkey', 'Greece', 'Netherlands', 'Switzerland',
    'Sweden', 'Argentina', 'Indonesia', 'Philippines', 'Singapore', 'New Zealand', 'Portugal', 'Ireland'];

  function todaysPrompt(countries, dateStr) {
    dateStr = dateStr || gameDateString();
    var rng = hashSeed('quinndom-passport-' + dateStr);
    var candidates = FAMILIES.map(function (f) {
      return { family: f, answers: validAnswers(f, countries) };
    }).filter(function (x) { return x.answers.length >= 3 && x.answers.length <= 60; });
    var choice = pick(rng, candidates);
    return {
      date: dateStr,
      id: choice.family.id,
      text: 'Choose a country that ' + choice.family.text.charAt(0).toLowerCase() + choice.family.text.slice(1),
      group: choice.family.group,
      difficulty: choice.family.diff,
      validAnswers: choice.answers.slice().sort(),
    };
  }

  function checkAnswer(prompt, countryName, countries) {
    var c = countries.filter(function (x) { return x.n === countryName; })[0];
    if (!c) return { ok: false, reason: 'Not a country in this game.' };
    var ok = prompt.validAnswers.indexOf(countryName) !== -1;
    var gold = ok && WELL_KNOWN.indexOf(countryName) === -1;
    return { ok: ok, gold: gold, country: c, reason: ok ? null : explainWhyNot(prompt, c) };
  }

  function explainWhyNot(prompt, c) {
    switch (prompt.id) {
      case 'pop100m': return c.n + ' has ' + (c.pop ? Math.round(c.pop / 1e6) + ' million' : 'an unknown number of') + ' people.';
      case 'under1m': return c.n + ' has ' + (c.pop ? Math.round(c.pop / 1e3) + ' thousand' : 'an unknown number of') + ' people.';
      case 'bigCountry': return c.n + ' is about ' + (c.area ? Math.round(c.area).toLocaleString() + ' km²' : 'of unknown size') + '.';
      case 'landlocked': return c.n + ' has a coastline.';
      case 'border5': return c.n + ' borders ' + c.bord + ' countries.';
      case 'border1': return c.n + ' borders ' + c.bord + ' countries.';
      default: return c.n + " doesn't match today's prompt.";
    }
  }

  global.QuinnDomPassport = {
    gameDateString: gameDateString,
    hashSeed: hashSeed,
    FAMILIES: FAMILIES,
    validAnswers: validAnswers,
    todaysPrompt: todaysPrompt,
    checkAnswer: checkAnswer,
  };
})(typeof window !== 'undefined' ? window : global);
