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
      resources: { wood: 0, stone: 0, metal: 0, food: 0 },
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
    ['wood', 'stone', 'metal', 'food'].forEach(function (k) { var n = Number(r[k]); d.resources[k] = isFinite(n) && n > 0 ? Math.floor(n) : 0; });
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

  function download() {
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

  return { load: load, get: get, update: update, hasCity: hasCity, importText: importText, download: download, exportText: exportText };
})();
