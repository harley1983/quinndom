/* Day clock. The game day runs on Vietnam time (UTC+7, no daylight saving) and rolls over at 00:00 there.
   Everyone gets the same date key, so everyone gets the same daily content.
   Test tip: open the game with ?now=2026-11-06T16:59:50Z to start the clock at that moment
   (that is 23:59:50 in Vietnam, so you can watch the day roll over). */
var Clock = (function () {
  var OFFSET = 7 * 3600 * 1000;            // Vietnam is UTC+7 all year
  var skew = 0;                              // only used by the ?now= test option
  var timer = null, lastKey = null, tickCbs = [], dayCbs = [];
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function now() { return Date.now() + skew; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function parts(ms) {
    var d = new Date((ms === undefined ? now() : ms) + OFFSET);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds(), wd: d.getUTCDay() };
  }
  /* 'YYYY-MM-DD' of the Vietnam calendar day. This is the key for all daily content. */
  function dayKey(ms) { var p = parts(ms); return p.y + '-' + pad(p.m) + '-' + pad(p.d); }
  function keyToDays(key) { var a = key.split('-'); return Math.round(Date.UTC(+a[0], +a[1] - 1, +a[2]) / 86400000); }
  function daysBetween(keyA, keyB) { return keyToDays(keyB) - keyToDays(keyA); }
  /* Milliseconds until the next 00:00 Vietnam time. */
  function msUntilNewDay(ms) {
    var t = ms === undefined ? now() : ms, p = parts(t);
    return Date.UTC(p.y, p.m - 1, p.d + 1) - OFFSET - t;
  }
  /* Day 1 is the day the city was founded (ISO time from the save). */
  function dayNumber(createdAtIso, ms) {
    var t = Date.parse(createdAtIso);
    if (!isFinite(t)) return 1;
    return Math.max(1, daysBetween(dayKey(t), dayKey(ms)) + 1);
  }
  function formatCountdown(msLeft) {
    var s = Math.max(0, Math.floor(msLeft / 1000));
    return pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60);
  }
  function formatDate(ms) { var p = parts(ms); return DAYS[p.wd] + ' ' + p.d + ' ' + MONTHS[p.m - 1] + ' ' + p.y; }

  function tick() {
    var key = dayKey(), left = msUntilNewDay();
    tickCbs.forEach(function (f) { try { f(left, key); } catch (e) {} });
    if (key !== lastKey) {
      var prev = lastKey; lastKey = key;
      if (prev !== null) dayCbs.forEach(function (f) { try { f(key, prev); } catch (e) {} });
    }
  }
  function start() {
    if (timer) return;
    lastKey = dayKey();
    timer = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) tick(); });
    tick();
  }
  function setStart(iso) { var t = Date.parse(iso); if (isFinite(t)) skew = t - Date.now(); }

  return {
    now: now, dayKey: dayKey, daysBetween: daysBetween, msUntilNewDay: msUntilNewDay, dayNumber: dayNumber,
    formatCountdown: formatCountdown, formatDate: formatDate, parts: parts, start: start, setStart: setStart,
    onTick: function (f) { tickCbs.push(f); }, onNewDay: function (f) { dayCbs.push(f); }
  };
})();
