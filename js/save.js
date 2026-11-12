/* Save module: one JSON save in localStorage, with export/import as the backup.
   Falls back to memory if the browser blocks storage. */
var Save = (function () {
  var KEY = 'quinndom.save.v1';
  var memory = null;

  function defaults() {
    return {
      version: 1,
      playerName: '',
      cityName: '',
      createdAt: null,
      settings: { sfx: false, ambience: false, volume: 0.7 }, // sound is off by default
      resources: { wood: 0, stone: 0, metal: 0, food: 0, coins: 0 },
      daily: { checkinDay: null, checkin: null, streak: 0, best: 0, freezes: 0, lastCounted: null, syncedDay: null, notice: null, milestones: [] },
      backup: { lastExport: null, snoozedOn: null },
      passport: { stamps: [], days: {} }   // stamps: [{code, date, promptId, gold}]; days: {dayKey: {tries: [codes], answer, result}}
    };
  }

  function clean(raw) {
    var d = defaults();
    if (!raw || typeof raw !== 'object') return null;
    if (typeof raw.playerName !== 'string' || typeof raw.cityName !== 'string') return null;
    d.playerName = raw.playerName.slice(0, 40);
    d.cityName = raw.cityName.slice(0, 40);
    d.createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : null;
    var s = raw.settings || {};
    d.settings.sfx = s.sfx === true;
    d.settings.ambience = s.ambience === true;
    var v = Number(s.volume);
    d.settings.volume = isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.7;
    var r = raw.resources || {};
    ['wood', 'stone', 'metal', 'food', 'coins'].forEach(function (k) { var n = Number(r[k]); d.resources[k] = isFinite(n) && n > 0 ? Math.floor(n) : 0; });
    var dl = raw.daily || {}, key = /^\d{4}-\d{2}-\d{2}$/;
    function whole(n) { n = Math.floor(Number(n)); return isFinite(n) && n > 0 ? n : 0; }
    d.daily.checkinDay = key.test(dl.checkinDay) ? dl.checkinDay : null;
    if (dl.checkin && typeof dl.checkin === 'object') d.daily.checkin = { food: whole(dl.checkin.food), res: ['wood', 'stone', 'metal'].indexOf(dl.checkin.res) >= 0 ? dl.checkin.res : 'wood', amount: whole(dl.checkin.amount) };
    d.daily.streak = whole(dl.streak); d.daily.best = Math.max(d.daily.streak, whole(dl.best));
    d.daily.freezes = Math.min(2, whole(dl.freezes));
    d.daily.lastCounted = key.test(dl.lastCounted) ? dl.lastCounted : null;
    d.daily.syncedDay = key.test(dl.syncedDay) ? dl.syncedDay : null;
    if (dl.notice && (dl.notice.type === 'freeze' || dl.notice.type === 'reset')) d.daily.notice = { type: dl.notice.type, n: whole(dl.notice.n) };
    if (Array.isArray(dl.milestones)) d.daily.milestones = dl.milestones.filter(function (m) { return m && [7, 30, 100, 365].indexOf(m.days) >= 0 && key.test(m.date); }).map(function (m) { return { days: m.days, date: m.date }; });
    var bk = raw.backup || {};
    d.backup.lastExport = key.test(bk.lastExport) ? bk.lastExport : null;
    d.backup.snoozedOn = key.test(bk.snoozedOn) ? bk.snoozedOn : null;
    var pp = raw.passport || {};
    if (Array.isArray(pp.stamps)) d.passport.stamps = pp.stamps.filter(function (st) {
      return st && typeof st.code === 'string' && /^[A-Z]{2}$/.test(st.code) && typeof st.date === 'string';
    }).map(function (st) { return { code: st.code, date: st.date, promptId: String(st.promptId || ''), gold: st.gold === true }; });
    if (pp.days && typeof pp.days === 'object') Object.keys(pp.days).forEach(function (k) {
      var day = pp.days[k];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !day || typeof day !== 'object') return;
      d.passport.days[k] = {
        tries: Array.isArray(day.tries) ? day.tries.filter(function (c) { return typeof c === 'string'; }).slice(0, 3) : [],
        answer: typeof day.answer === 'string' ? day.answer : null,
        result: ['stamp', 'repeat', 'missed'].indexOf(day.result) >= 0 ? day.result : null
      };
    });
    return d;
  }

  function load() {
    var text = null;
    try { text = window.localStorage.getItem(KEY); } catch (e) { text = null; }
    if (text) {
      try { var c = clean(JSON.parse(text)); if (c) { memory = c; return c; } } catch (e) {}
    }
    if (!memory) memory = defaults();
    return memory;
  }

  function write(data) {
    memory = data;
    try { window.localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch (e) { return false; }
  }

  function get() { return memory || load(); }

  function update(patch) {
    var cur = get();
    var next = clean({
      playerName: patch.playerName !== undefined ? patch.playerName : cur.playerName,
      cityName: patch.cityName !== undefined ? patch.cityName : cur.cityName,
      createdAt: patch.createdAt !== undefined ? patch.createdAt : cur.createdAt,
      settings: patch.settings ? Object.assign({}, cur.settings, patch.settings) : cur.settings,
      resources: patch.resources || cur.resources,
      daily: patch.daily || cur.daily,
      backup: patch.backup ? Object.assign({}, cur.backup, patch.backup) : cur.backup,
      passport: patch.passport || cur.passport
    });
    write(next);
    return next;
  }

  function hasCity() { var s = get(); return !!(s.playerName && s.cityName); }

  function exportText() { return JSON.stringify(get(), null, 2); }

  function importText(text) {
    var parsed;
    try { parsed = JSON.parse(text); } catch (e) { return { ok: false, error: 'That file is not a QuinnDom save (it is not valid JSON).' }; }
    var c = clean(parsed);
    if (!c || !c.playerName || !c.cityName) return { ok: false, error: 'That file is missing a player name or city name, so it cannot be a QuinnDom save.' };
    write(c);
    return { ok: true };
  }

  /* weekly export reminder (PRD FR-3.5): due when the last export (or, if never exported, the first day) is 7 or more days ago,
     the player has something to lose, and the reminder was not put off in the last 2 days */
  var BACKUP_EVERY = 7, SNOOZE_DAYS = 2;
  function backupDue() {
    var s = get(), today = Clock.dayKey();
    if (!hasCity() || !(s.passport.stamps.length || s.daily.streak)) return { due: false };
    var base = s.backup.lastExport || (s.createdAt ? s.createdAt.slice(0, 10) : today);
    var days = Clock.daysBetween(base, today);
    var snoozed = s.backup.snoozedOn && Clock.daysBetween(s.backup.snoozedOn, today) < SNOOZE_DAYS;
    return { due: days >= BACKUP_EVERY && !snoozed, days: days, never: !s.backup.lastExport };
  }
  function snoozeBackup() { update({ backup: { snoozedOn: Clock.dayKey() } }); }

  function download() {
    update({ backup: { lastExport: Clock.dayKey(), snoozedOn: null } });
    var d = new Date();
    var stamp = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    var blob = new Blob([exportText()], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'quinndom-save-' + stamp + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  return { load: load, get: get, update: update, hasCity: hasCity, importText: importText, download: download, backupDue: backupDue, snoozeBackup: snoozeBackup, exportText: exportText };
})();
