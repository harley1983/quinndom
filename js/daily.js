/* Daily core: check-in reward, streak, freezes and milestones (PRD FR-1.3, FR-2.6 to FR-2.8).
   Everything is keyed by the Vietnam day key from Clock, so it works with no server.
   Rules: a day counts when the passport prompt is answered with a valid country (new stamp or repeat).
   A missed day spends one freeze automatically; with too few freezes the streak resets (freezes are kept).
   One freeze is earned at every 14-day mark, holding at most 2. Milestones at 7, 30, 100, 365 pay 100 mixed resources and one extra streak freeze (if fewer than 2 are held). */
var Daily = (function () {
  var MILESTONES = [7, 30, 100, 365], FREEZE_EVERY = 14, FREEZE_MAX = 2, CHECKIN_FOOD = 10, CHECKIN_RES = 5, MILESTONE_EACH = 25;

  function get() { return Save.get().daily; }
  function put(d, resources) { var p = { daily: d }; if (resources) p.resources = resources; Save.update(p); }
  function copy(d) { return JSON.parse(JSON.stringify(d)); }
  function addDays(key, n) { var a = key.split('-'), t = new Date(Date.UTC(+a[0], +a[1] - 1, +a[2] + n)); return t.getUTCFullYear() + '-' + ('0' + (t.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + t.getUTCDate()).slice(-2); }

  /* Run once per day on opening: settles any missed days against the freezes. */
  function sync() {
    var day = Clock.dayKey(), d = copy(get());
    if (d.syncedDay === day) return;
    if (d.lastCounted && d.streak > 0) {
      var gap = Clock.daysBetween(d.lastCounted, day) - 1;
      if (gap > 0) {
        if (d.freezes >= gap) { d.freezes -= gap; d.lastCounted = addDays(day, -1); d.notice = { type: 'freeze', n: gap }; }
        else { d.notice = { type: 'reset', n: d.streak }; d.streak = 0; d.lastCounted = null; }
      }
    }
    d.syncedDay = day; put(d);
  }

  /* The first visit of a day gives the check-in reward once. Returns it, or null when already collected. */
  function checkin() {
    sync();
    var day = Clock.dayKey(), d = copy(get());
    if (d.checkinDay === day) return null;
    var kinds = ['wood', 'stone', 'metal'], r = { food: CHECKIN_FOOD, res: kinds[Math.floor(Math.random() * 3)], amount: CHECKIN_RES };
    var res = Object.assign({}, Save.get().resources); res.food += r.food; res[r.res] += r.amount;
    d.checkinDay = day; d.checkin = r;
    var notice = d.notice; d.notice = null;
    put(d, res);
    return { reward: r, notice: notice, streak: d.streak, freezes: d.freezes };
  }

  /* Called when today's prompt is answered with a valid country. Returns what happened, for the screen to show. */
  function countToday() {
    sync();
    var day = Clock.dayKey(), d = copy(get()), out = { counted: false, streak: d.streak, freezeEarned: false, milestone: null };
    if (d.lastCounted === day) return out;
    d.streak += 1; d.best = Math.max(d.best, d.streak); d.lastCounted = day; out.counted = true;
    if (d.streak % FREEZE_EVERY === 0 && d.freezes < FREEZE_MAX) { d.freezes += 1; out.freezeEarned = true; }
    var res = null;
    if (MILESTONES.indexOf(d.streak) >= 0 && !d.milestones.some(function (m) { return m.days === d.streak; })) {
      d.milestones.push({ days: d.streak, date: day });
      res = Object.assign({}, Save.get().resources);
      ['wood', 'stone', 'metal', 'food'].forEach(function (k) { res[k] += MILESTONE_EACH; });
      var gotFreeze = d.freezes < FREEZE_MAX; if (gotFreeze) d.freezes += 1;
      out.milestone = { days: d.streak, each: MILESTONE_EACH, freeze: gotFreeze };
    }
    out.streak = d.streak; out.freezes = d.freezes;
    put(d, res);
    return out;
  }

  /* Read-only view for the home screen. */
  function view() {
    var d = get(), day = Clock.dayKey(), next = MILESTONES.filter(function (m) { return m > d.streak; })[0] || null;
    return { streak: d.streak, best: d.best, freezes: d.freezes, checkedIn: d.checkinDay === day, countedToday: d.lastCounted === day, nextMilestone: next, milestones: d.milestones,
      toFreeze: d.freezes >= FREEZE_MAX ? null : FREEZE_EVERY - (d.streak % FREEZE_EVERY) };
  }
  return { sync: sync, checkin: checkin, countToday: countToday, view: view, MILESTONES: MILESTONES, FREEZE_MAX: FREEZE_MAX };
})();
