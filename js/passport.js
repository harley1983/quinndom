/* Passport screen (Release 1). A printed-chart look: cream sheet, ruled border, a title cartouche for today's prompt,
   red pins for tries, and a stamp book. Rules:
   - one prompt per day, same for everyone, picked from the Vietnam date key
   - 3 tries; a wrong answer shows why; after the 3rd miss the valid answers are shown
   - a valid country already in the passport is accepted but earns no new stamp
   - a new stamp pays 10 of each building resource; gold stamps pay double
   Built by Screens.init() through Passport.build(root, helpers). */
var Passport = (function () {
  var REWARD = 10, MAX_TRIES = 3, STRIDE = 7;   // 7 is coprime with 30, so 30 days cover all 30 prompts in a mixed order
  var CONT_COLOR = { AF: '#C8693D', AS: '#1D3557', EU: '#6E54A3', NA: '#1B5E20', SA: '#237A43', OC: '#00796B' };
  var h = null, node = null, state = { sel: -1, list: [] };

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function $(sel) { return node.querySelector(sel); }

  /* ---- today's prompt ---- */
  function dayIndex(key) { var a = key.split('-'); return Math.round(Date.UTC(+a[0], +a[1] - 1, +a[2]) / 86400000); }
  function promptFor(key) {
    var n = Prompts.length, i = ((dayIndex(key) * STRIDE) % n + n) % n;
    return { p: Prompts[i], no: i + 1 };
  }

  /* ---- art ---- */
  function pin(color, label) {
    return '<svg class="px pp-pin" viewBox="0 0 10 14" aria-hidden="true" style="color:' + color + '"' + (label ? ' data-l="' + label + '"' : '') + '>' +
      '<g fill="#14261B"><rect x="2" y="0" width="6" height="1"/><rect x="1" y="1" width="1" height="1"/><rect x="8" y="1" width="1" height="1"/><rect x="0" y="2" width="1" height="4"/><rect x="9" y="2" width="1" height="4"/><rect x="1" y="6" width="1" height="1"/><rect x="8" y="6" width="1" height="1"/><rect x="2" y="7" width="6" height="1"/><rect x="4" y="8" width="2" height="6"/></g>' +
      '<g fill="currentColor"><rect x="2" y="1" width="6" height="1"/><rect x="1" y="2" width="8" height="4"/><rect x="2" y="6" width="6" height="1"/></g>' +
      '<rect x="2" y="2" width="2" height="1" fill="#fff" opacity=".65"/></svg>';
  }
  function emptyPin() {
    return '<svg class="px pp-pin ghost" viewBox="0 0 10 14" aria-hidden="true"><g fill="none" stroke="#14261B" stroke-width=".6" stroke-dasharray="1 1"><rect x="1" y="1" width="8" height="6"/><rect x="4" y="8" width="2" height="5"/></g></svg>';
  }
  function spark() { return '<svg class="px" viewBox="0 0 7 7" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M3 0h1v2h2v1h-2v1h2v1h-2v2h-1v-2h-2v-1h2v-1h-2v-1h2z" opacity="0"/><path fill="currentColor" d="M3 0h1v3h3v1h-3v3h-1v-3h-3v-1h3z"/></svg>'; }

  function stampTile(st, opts) {
    var c = Countries.byCode(st.code); if (!c) return '';
    var rot = ((st.code.charCodeAt(0) * 7 + st.code.charCodeAt(1) * 13) % 7) - 3;
    var col = CONT_COLOR[c.continent] || '#14261B';
    var big = opts && opts.big;
    return '<li class="pp-stamp' + (st.gold ? ' gold' : '') + (big ? ' big' : '') + '" style="--rot:' + rot + 'deg;--ink-c:' + col + '" title="' + esc(c.name + ' · ' + st.date) + '">' +
      '<span class="band">' + esc(c.continentName.toUpperCase()) + '</span>' +
      '<span class="code">' + esc(st.code) + '</span>' +
      '<span class="nm">' + esc(c.name) + '</span>' +
      '<span class="dt">' + esc(st.date) + '</span>' +
      (st.gold ? '<span class="gem" aria-label="Gold stamp">' + spark() + '</span>' : '') +
      '</li>';
  }

  /* ---- data ---- */
  function todayRec() { var s = Save.get(); return s.passport.days[Clock.dayKey()] || { tries: [], answer: null, result: null }; }
  function hasStamp(code) { return Save.get().passport.stamps.some(function (s) { return s.code === code; }); }
  function stampFor(code) { var l = Save.get().passport.stamps; for (var i = 0; i < l.length; i++) if (l[i].code === code) return l[i]; return null; }

  function submit(c) {
    var key = Clock.dayKey(), cur = Save.get(), cp = promptFor(key).p;
    var rec = cur.passport.days[key] || { tries: [], answer: null, result: null };
    if (rec.result) return { ok: false, msg: 'Today’s prompt is finished. Come back tomorrow.' };
    if (rec.tries.indexOf(c.code) >= 0) return { ok: false, msg: 'You already pinned ' + c.name + ' today. Try a different country.' };
    var valid = cp.answers.indexOf(c.code) >= 0;
    var days = Object.assign({}, cur.passport.days), stamps = cur.passport.stamps.slice(), res = Object.assign({}, cur.resources);
    var next = { tries: rec.tries.concat(c.code), answer: null, result: null }, outcome;
    if (valid) {
      next.answer = c.code;
      if (hasStamp(c.code)) { next.result = 'repeat'; outcome = 'repeat'; }
      else {
        next.result = 'stamp'; outcome = 'stamp';
        stamps.push({ code: c.code, date: key, promptId: cp.id, gold: c.gold });
        var amt = REWARD * (c.gold ? 2 : 1);
        ['wood', 'stone', 'metal', 'food'].forEach(function (k) { res[k] = (res[k] || 0) + amt; });
      }
    } else {
      outcome = 'wrong';
      if (next.tries.length >= MAX_TRIES) next.result = 'missed';
    }
    days[key] = next;
    Save.update({ passport: { stamps: stamps, days: days }, resources: res });
    return { ok: true, outcome: outcome, country: c };
  }

  /* ---- rendering ---- */
  function render(fresh) {
    var key = Clock.dayKey(), pr = promptFor(key), p = pr.p, rec = todayRec(), s = Save.get();
    var done = !!rec.result;
    $('#pp-date').textContent = Clock.formatDate() + ' · Vietnam time';
    $('#pp-no').textContent = 'No. ' + pr.no + ' of ' + Prompts.length;
    $('#pp-fam').textContent = p.family;
    var lv = $('#pp-level'); lv.textContent = p.level; lv.setAttribute('data-level', p.level);
    $('#pp-prompt').textContent = p.text.charAt(0).toLowerCase() + p.text.slice(1);

    // pins = tries
    var pins = '';
    for (var i = 0; i < MAX_TRIES; i++) {
      var code = rec.tries[i];
      if (!code) pins += '<li>' + emptyPin() + '<span>try ' + (i + 1) + '</span></li>';
      else {
        var good = rec.answer === code;
        pins += '<li class="set">' + pin(good ? (rec.result === 'stamp' && stampFor(code) && stampFor(code).gold ? '#C9A227' : '#237A43') : '#C0392B') + '<span>' + (good ? 'hit' : 'miss') + '</span></li>';
      }
    }
    $('#pp-pins').innerHTML = pins;
    var left = MAX_TRIES - rec.tries.length;
    $('#pp-left').textContent = done ? '' : left + (left === 1 ? ' try left' : ' tries left');

    // ledger
    var rows = rec.tries.map(function (code) {
      var c = Countries.byCode(code), ok = rec.answer === code;
      var why = ok
        ? (rec.result === 'repeat' ? 'Valid, and already in your passport. No new stamp.' : 'Fits the prompt.')
        : 'Not on today’s list. The rule: ' + p.rule;
      return '<li class="' + (ok ? 'ok' : 'no') + '"><span class="mk" aria-hidden="true">' + (ok ? '✓' : '✗') + '</span><div><b>' + esc(c ? c.name : code) +
        '</b><span class="sr-only">' + (ok ? ', correct' : ', not a match') + '</span><span class="why">' + esc(why) + '</span></div></li>';
    }).join('');
    $('#pp-ledger').innerHTML = rows;
    $('#pp-ledger').hidden = !rows;
    var miss = rec.tries.some(function (c) { return rec.answer !== c; });
    var rl = $('#pp-rule'); rl.hidden = !miss; rl.innerHTML = '<b>The rule</b>' + esc(p.rule);

    // input vs result panel
    $('#pp-form').hidden = done;
    var res = $('#pp-result');
    res.hidden = !done;
    if (done) {
      var html = '';
      if (rec.result === 'stamp') {
        var st = stampFor(rec.answer), amt = REWARD * (st && st.gold ? 2 : 1);
        html += '<div class="pp-hero"><ul class="pp-stamps one">' + stampTile(st, { big: true }) + '</ul><div class="pp-hero-t">' +
          '<h2>' + (st && st.gold ? 'Gold stamp!' : 'New stamp!') + '</h2>' +
          '<p>' + esc(Countries.byCode(rec.answer).name) + ' is in your passport.' + (st && st.gold ? ' A rare country, so the reward is doubled.' : '') + '</p>' +
          '<p class="rew">+' + amt + ' wood · +' + amt + ' stone · +' + amt + ' metal · +' + amt + ' food</p></div></div>';
      } else if (rec.result === 'repeat') {
        html += '<div class="pp-hero"><div class="pp-hero-t"><h2>Right answer, old friend</h2><p>' + esc(Countries.byCode(rec.answer).name) + ' fits, but it is already in your passport. No new stamp today. Try a different country on a later day to grow the book.</p></div></div>';
      } else {
        var pool = p.answers.map(function (c) { return Countries.byCode(c); }).filter(Boolean).map(function (c) { return c.name; });
        var shown = pool.slice(0, 18), more = pool.length - shown.length;
        html += '<div class="pp-hero"><div class="pp-hero-t"><h2>Out of tries</h2><p>No stamp today, and that is fine. Here are some countries that fit (' + pool.length + ' in total):</p>' +
          '<ul class="pp-chips">' + shown.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + (more > 0 ? '<li class="more">+' + more + ' more</li>' : '') + '</ul></div></div>';
      }
      html += '<div class="pp-next"><span class="pp-cnt" id="pp-count2"></span><span>until tomorrow’s prompt</span></div>';
      res.innerHTML = html;
      if (fresh && rec.result === 'stamp') { var t = res.querySelector('.pp-stamp'); if (t) { t.classList.add('slam'); } }
    }

    // stamp book
    var stamps = s.passport.stamps, gold = stamps.filter(function (x) { return x.gold; }).length;
    $('#pp-total').textContent = stamps.length + ' / ' + Countries.count;
    $('#pp-gold').textContent = gold + ' gold';
    var list = stamps.slice().reverse().map(function (x) { return stampTile(x); }).join('');
    var ghosts = '';
    for (var g = stamps.length; g < Math.min(stamps.length + 4, 8) && stamps.length < 8; g++) ghosts += '<li class="pp-ghost" aria-hidden="true"><span>?</span></li>';
    $('#pp-book').innerHTML = list + ghosts;
    $('#pp-empty').hidden = stamps.length > 0;
    // continent progress
    var per = {}; Object.keys(Countries.continents).forEach(function (k) { per[k] = { have: 0, all: 0 }; });
    Countries.all.forEach(function (c) { per[c.continent].all++; });
    stamps.forEach(function (x) { var c = Countries.byCode(x.code); if (c) per[c.continent].have++; });
    $('#pp-cont').innerHTML = Object.keys(per).map(function (k) {
      var v = per[k], w = Math.round(v.have / v.all * 100);
      return '<li><span class="cn">' + Countries.continents[k] + '</span><span class="bar"><i style="width:' + w + '%;background:' + CONT_COLOR[k] + '"></i></span><span class="cv">' + v.have + '/' + v.all + '</span></li>';
    }).join('');
  }

  /* ---- suggestions ---- */
  function paintSuggest() {
    var box = $('#pp-sug'), input = $('#pp-in');
    var rec = todayRec();
    var list = Countries.suggest(input.value, 7).filter(function (c) { return rec.tries.indexOf(c.code) < 0; });
    state.list = list;
    if (!input.value.trim() || !list.length) { box.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); state.sel = -1; return; }
    if (state.sel >= list.length) state.sel = list.length - 1;
    box.innerHTML = list.map(function (c, i) {
      return '<li role="option" id="pp-o' + i + '" data-i="' + i + '" aria-selected="' + (i === state.sel) + '"><b>' + esc(c.name) + '</b><span>' + esc(c.continentName) + '</span></li>';
    }).join('');
    box.hidden = false; input.setAttribute('aria-expanded', 'true');
    if (state.sel >= 0) input.setAttribute('aria-activedescendant', 'pp-o' + state.sel); else input.removeAttribute('aria-activedescendant');
  }
  function closeSuggest() { var b = $('#pp-sug'); if (b) b.hidden = true; $('#pp-in').setAttribute('aria-expanded', 'false'); state.sel = -1; }

  function msg(text, bad) { var m = $('#pp-msg'); m.textContent = text || ''; m.className = 'pp-msg' + (bad ? ' bad' : ''); }

  function guess(raw) {
    var c = Countries.find(raw);
    if (!c) { msg('I do not know “' + raw.trim() + '” yet. Pick a country from the list that appears as you type.', true); h.sound('notquite'); return; }
    var r = submit(c);
    if (!r.ok) { msg(r.msg, true); h.sound('tap'); return; }
    $('#pp-in').value = ''; closeSuggest(); msg('');
    render(true);
    if (r.outcome === 'stamp') { h.sound('stamp'); if (r.country.gold) setTimeout(function () { h.sound('milestone'); }, 450); }
    else if (r.outcome === 'repeat') h.sound('correct');
    else h.sound('notquite');
    h.refreshHome();
    var rec = todayRec();
    if (!rec.result) $('#pp-in').focus();
    else { var hd = node.querySelector('#pp-result h2'); if (hd) { hd.setAttribute('tabindex', '-1'); hd.focus({ preventScroll: true }); } }
    var live = $('#pp-live'); live.textContent = r.outcome === 'wrong' ? (rec.result === 'missed' ? 'Not a match. Out of tries.' : 'Not a match. ' + (MAX_TRIES - rec.tries.length) + ' tries left.') : (r.outcome === 'stamp' ? 'New stamp: ' + r.country.name : 'Correct. Already in your passport.');
  }

  /* ---- build ---- */
  function build(root, helpers) {
    h = helpers;
    node = h.el(
      '<section class="screen" id="screen-passport" aria-label="Passport"><div class="pp-stage">' +
        '<div class="pp-top"><button class="pbtn light" id="pp-back">← Home</button><span class="pp-top-t">PASSPORT</span><button class="pbtn light" id="pp-settings">Settings</button></div>' +
        '<div class="pp-grid">' +
          '<div class="pp-chart" role="region" aria-label="Today’s prompt">' +
            '<i class="tick tl"></i><i class="tick tr"></i><i class="tick bl"></i><i class="tick br"></i>' +
            '<div class="pp-meta"><span id="pp-date"></span><span id="pp-no"></span></div>' +
            '<div class="pp-cartouche"><span class="rib l"></span><div class="pp-ct"><div class="pp-tags"><span class="pp-fam" id="pp-fam"></span><span class="pp-lvl" id="pp-level"></span></div>' +
              '<h1 data-focus tabindex="-1" id="pp-prompt-h"><span class="pp-lead">Name a country that</span> <span id="pp-prompt"></span></h1></div><span class="rib r"></span></div>' +
            '<div class="pp-pinrow"><ul class="pp-pins" id="pp-pins" aria-label="Your tries"></ul><span class="pp-left" id="pp-left" aria-hidden="true"></span></div>' +
            '<form class="pp-form" id="pp-form" autocomplete="off" novalidate>' +
              '<label for="pp-in" class="sr-only">Country</label>' +
              '<div class="pp-combo"><input class="pin" id="pp-in" type="text" role="combobox" aria-expanded="false" aria-controls="pp-sug" aria-autocomplete="list" placeholder="Type a country…" autocapitalize="words" spellcheck="false" enterkeyhint="go">' +
              '<ul id="pp-sug" class="pp-sug pxp" role="listbox" hidden></ul></div>' +
              '<button class="pbtn" type="submit" id="pp-go">Pin it</button></form>' +
            '<p class="pp-msg" id="pp-msg" role="alert"></p>' +
            '<p class="pp-rule" id="pp-rule" hidden></p><ul class="pp-ledger" id="pp-ledger" hidden></ul>' +
            '<div class="pp-result" id="pp-result" hidden></div>' +
            '<p class="sr-only" id="pp-live" role="status" aria-live="polite"></p>' +
          '</div>' +
          '<aside class="pp-book-wrap" aria-label="Your passport">' +
            '<div class="pp-cover"><div class="pp-covt"><h2>Passport</h2><span class="pp-sub">QuinnDom</span></div><div class="pp-nums"><span id="pp-total">0 / 0</span><span class="g" id="pp-gold"></span></div></div>' +
            '<div class="pp-pages">' +
              '<p class="pp-empty" id="pp-empty">Your passport is empty. One right answer earns your first stamp.</p>' +
              '<ul class="pp-stamps" id="pp-book"></ul>' +
              '<h3>By continent</h3><ul class="pp-cont" id="pp-cont"></ul>' +
            '</div>' +
          '</aside>' +
        '</div>' +
      '</div></section>');
    root.appendChild(node);

    var input = $('#pp-in');
    input.addEventListener('input', function () { state.sel = -1; msg(''); paintSuggest(); });
    input.addEventListener('keydown', function (e) {
      var n = state.list.length, open = !$('#pp-sug').hidden;
      if (e.key === 'ArrowDown' && n) { e.preventDefault(); state.sel = (state.sel + 1) % n; paintSuggest(); }
      else if (e.key === 'ArrowUp' && n) { e.preventDefault(); state.sel = (state.sel - 1 + n) % n; paintSuggest(); }
      else if (e.key === 'Escape') { closeSuggest(); }
      else if (e.key === 'Enter' && open && state.sel >= 0) { e.preventDefault(); input.value = state.list[state.sel].name; closeSuggest(); }
    });
    $('#pp-sug').addEventListener('mousedown', function (e) { e.preventDefault(); });
    $('#pp-sug').addEventListener('click', function (e) {
      var li = e.target.closest('li[data-i]'); if (!li) return;
      input.value = state.list[+li.getAttribute('data-i')].name; closeSuggest(); h.sound('tap'); input.focus();
    });
    input.addEventListener('blur', function () { setTimeout(closeSuggest, 120); });
    $('#pp-form').addEventListener('submit', function (e) {
      e.preventDefault();
      if (!input.value.trim()) { msg('Type a country first.', true); return; }
      guess(input.value);
    });
    $('#pp-back').addEventListener('click', function () { h.show('home'); });
    $('#pp-settings').addEventListener('click', function () { h.show('settings'); });

    Clock.onTick(function (left) { var c = node.querySelector('#pp-count2'); if (c) c.textContent = Clock.formatCountdown(left); });
    Clock.onNewDay(function () { render(false); });
    node.__enter = function () { render(false); h.startAmbience(); };
    node.__leave = function () { h.stopAmbience(); closeSuggest(); };
    render(false);
  }

  /* one-line status for the home card */
  function summary() {
    var rec = todayRec(), n = Save.get().passport.stamps.length;
    var line = !rec.result ? (rec.tries.length ? (MAX_TRIES - rec.tries.length) + ' tries left today' : 'Today’s prompt is waiting')
      : rec.result === 'stamp' ? 'Stamped today' : rec.result === 'repeat' ? 'Solved today (no new stamp)' : 'Done for today';
    return { line: line, done: !!rec.result, stamps: n, total: Countries.count };
  }

  return { build: build, summary: summary, promptFor: promptFor };
})();
