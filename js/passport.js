/* Passport screen (Release 1): a world-map stage on a wooden desk, a side panel with the prompt, and a passport book.
   Rules:
   - one prompt per day, same for everyone, picked from the Vietnam date key
   - 3 tries; a wrong answer shows why; after the 3rd miss the valid answers are shown
   - a valid country already in the passport is accepted but earns no new stamp
   - a new stamp pays 10 of each building resource; gold stamps pay double
   Built by Screens.init() through Passport.build(root, helpers). */
var Passport = (function () {
  var REWARD = 10, MAX_TRIES = 3, STRIDE = 7;   // 7 is coprime with 30, so 30 days cover all 30 prompts in a mixed order
  var CONT_ORDER = ['AF', 'AS', 'EU', 'NA', 'OC', 'SA'];
  var CONT_COLOR = { AF: '#C8693D', AS: '#1D3557', EU: '#6E54A3', NA: '#1B5E20', SA: '#237A43', OC: '#00796B' };
  var CONT_BOX = { AF: [-20, -36, 52, 38], AS: [25, -11, 150, 56], EU: [-12, 34, 62, 72], NA: [-170, 6, -50, 72], OC: [108, -48, 180, 2], SA: [-83, -57, -33, 13] };
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var h = null, node = null, mv = null;
  var S = { busy: false, pane: '', sel: null, selCode: null, ghost: null, sug: [], sugI: -1, cont: null, filter: 'all', answers: false };

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function $(sel) { return node.querySelector(sel); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, reduce ? 0 : ms); }); }
  function cap(s) { return s.charAt(0).toLowerCase() + s.slice(1); }

  /* ---- today's prompt ---- */
  function dayIndex(key) { var a = key.split('-'); return Math.round(Date.UTC(+a[0], +a[1] - 1, +a[2]) / 86400000); }
  function promptFor(key) { var n = Prompts.length, i = ((dayIndex(key) * STRIDE) % n + n) % n; return { p: Prompts[i], no: i + 1 }; }
  function promptById(id) { for (var i = 0; i < Prompts.length; i++) if (Prompts[i].id === id) return Prompts[i]; return null; }

  /* ---- data ---- */
  function todayRec() { var s = Save.get(); return s.passport.days[Clock.dayKey()] || { tries: [], answer: null, result: null }; }
  function stampFor(code) { var l = Save.get().passport.stamps; for (var i = 0; i < l.length; i++) if (l[i].code === code) return l[i]; return null; }

  function submit(c) {
    var key = Clock.dayKey(), cur = Save.get(), cp = promptFor(key).p;
    var rec = cur.passport.days[key] || { tries: [], answer: null, result: null };
    if (rec.result) return { ok: false, msg: 'Today’s prompt is finished. Come back tomorrow.' };
    if (rec.tries.indexOf(c.code) >= 0) return { ok: false, msg: 'You already pinned ' + c.name + ' today. Try a different country.' };
    var valid = cp.answers.indexOf(c.code) >= 0;
    var days = Object.assign({}, cur.passport.days), stamps = cur.passport.stamps.slice(), res = Object.assign({}, cur.resources);
    var next = { tries: rec.tries.concat(c.code), answer: null, result: null }, outcome, amt = 0;
    if (valid) {
      next.answer = c.code;
      if (stampFor(c.code)) { next.result = 'repeat'; outcome = 'repeat'; }
      else {
        next.result = 'stamp'; outcome = 'stamp';
        stamps.push({ code: c.code, date: key, promptId: cp.id, gold: c.gold });
        amt = REWARD * (c.gold ? 2 : 1);
        ['wood', 'stone', 'metal', 'food'].forEach(function (k) { res[k] = (res[k] || 0) + amt; });
      }
    } else {
      outcome = 'wrong';
      if (next.tries.length >= MAX_TRIES) next.result = 'missed';
    }
    days[key] = next;
    Save.update({ passport: { stamps: stamps, days: days }, resources: res });
    var dl = valid ? Daily.countToday() : null;
    return { ok: true, outcome: outcome, country: c, amount: amt, daily: dl };
  }

  /* ---- art: postcards (one per prompt family) and stamps ---- */
  function postcard(family) {
    var base = '<rect width="120" height="150" fill="#BFE0F0"/><rect y="104" width="120" height="46" fill="#8CCB86"/><rect y="104" width="120" height="4" fill="#6FB46C"/>';
    var art = {
      'People': '<g><circle cx="30" cy="84" r="9" fill="#F2C9A0"/><rect x="21" y="93" width="18" height="30" fill="#C0392B"/><circle cx="60" cy="76" r="9" fill="#D9A978"/><rect x="51" y="85" width="18" height="38" fill="#2541B2"/><circle cx="90" cy="84" r="9" fill="#8D5A3B"/><rect x="81" y="93" width="18" height="30" fill="#F7C948"/></g>',
      'Size and shape': '<g><rect x="22" y="38" width="76" height="76" fill="none" stroke="#1B5E20" stroke-width="5"/><rect x="38" y="78" width="22" height="22" fill="#C8693D"/><path d="M22 128h76M22 124v8M98 124v8" stroke="#14261B" stroke-width="3"/></g>',
      'Neighbours': '<g><rect x="12" y="78" width="40" height="36" fill="#E9C46A"/><path d="M8 78l24-26 24 26z" fill="#C8693D"/><rect x="68" y="70" width="40" height="44" fill="#B392AC"/><path d="M64 70l24-26 24 26z" fill="#2541B2"/><path d="M60 62v52" stroke="#14261B" stroke-width="3" stroke-dasharray="6 5"/></g>',
      'Location': '<g><circle cx="60" cy="72" r="36" fill="#4F9BE3" stroke="#14261B" stroke-width="3"/><path d="M24 72h72M60 36v72M32 52h56M32 92h56" stroke="#fff" stroke-width="1.5" opacity=".6"/><path d="M60 40c-9 0-15 6-15 14 0 10 15 24 15 24s15-14 15-24c0-8-6-14-15-14z" fill="#C0392B" stroke="#14261B" stroke-width="3"/><circle cx="60" cy="54" r="5" fill="#fff"/></g>',
      'Symbols': '<g><rect x="30" y="30" width="5" height="90" fill="#6B4B00"/><circle cx="32.5" cy="28" r="5" fill="#F7C948"/><path d="M35 36l62 6-6 20 6 20-62-6z" fill="#fff" stroke="#14261B" stroke-width="2"/><path d="M35 36l21 2v40l-21-2z" fill="#2541B2"/><path d="M77 40l20 2-6 20 6 20-20-2z" fill="#C0392B"/></g>',
      'History': '<g><path d="M18 56l42-24 42 24z" fill="#E9D8A6" stroke="#14261B" stroke-width="3"/><g fill="#F3F7EA" stroke="#14261B" stroke-width="2.5"><rect x="26" y="60" width="12" height="46"/><rect x="46" y="60" width="12" height="46"/><rect x="66" y="60" width="12" height="46"/><rect x="86" y="60" width="12" height="46"/></g><rect x="16" y="106" width="88" height="8" fill="#D9CBA0" stroke="#14261B" stroke-width="2.5"/><circle cx="100" cy="22" r="9" fill="#F7C948"/></g>',
      'Wordplay': '<g font-family="monospace" font-weight="700" font-size="30" text-anchor="middle"><rect x="8" y="64" width="30" height="36" fill="#FFF3C4" stroke="#14261B" stroke-width="3"/><text x="23" y="91" fill="#14261B">A</text><rect x="45" y="64" width="30" height="36" fill="#F7C948" stroke="#14261B" stroke-width="3"/><text x="60" y="91" fill="#14261B">?</text><rect x="82" y="64" width="30" height="36" fill="#FFF3C4" stroke="#14261B" stroke-width="3"/><text x="97" y="91" fill="#14261B">A</text></g>'
    };
    return '<svg viewBox="0 0 120 150" aria-hidden="true">' + base + (art[family] || art['Location']) + '</svg>';
  }
  /* a reward line with icons: +10 [wood] +10 [stone] ... (the number can count up) */
  function rewardRow(amount, counted) {
    return ['wood', 'stone', 'metal', 'food'].map(function (k) {
      return '<span class="rwd" title="' + k + '">' + Art.res(k) + '<b' + (counted ? ' class="cu"' : '') + '>' + (counted ? '0' : amount) + '</b></span>';
    }).join('');
  }
  /* streak line: flame + days, freeze icons, and any freeze or milestone just earned */
  function streakBlock(dl) {
    var v = Daily.view(), fr = '';
    for (var i = 0; i < Daily.FREEZE_MAX; i++) fr += '<span class="fz' + (i < v.freezes ? ' on' : '') + '">' + Art.res('ice') + '</span>';
    var extra = '';
    if (dl && dl.freezeEarned) extra += '<p class="note">You earned a streak freeze. It protects one missed day.</p>';
    if (dl && dl.milestone) extra += '<div class="ms"><b>' + dl.milestone.days + '-DAY MILESTONE</b><div class="rewrow">' + rewardRow(dl.milestone.each, false) + '</div>' + (dl.milestone.freeze ? '<div class="mfz"><span class="fz on">' + Art.res('ice') + '</span><span>+1 streak freeze</span></div>' : '<p class="note">Your freezes are full, so no extra freeze this time.</p>') + '</div>';
    return '<div class="streak"><span class="fl">' + Art.res('flame') + '</span><span class="sn"><b>' + v.streak + '</b> day' + (v.streak === 1 ? '' : 's') + ' streak</span><span class="fzs" title="Streak freezes">' + fr + '</span></div>' + extra;
  }
  function stampTile(st, big) {
    var c = Countries.byCode(st.code); if (!c) return '';
    var rot = ((st.code.charCodeAt(0) * 7 + st.code.charCodeAt(1) * 13) % 9) - 4;
    return '<div class="pp-stamp' + (st.gold ? ' gold' : '') + (big ? ' big' : '') + '" style="--rot:' + rot + 'deg">' +
      '<span class="disc">' + Stamps.svg(c.name, st.gold) + '</span><span class="dt">' + esc(st.date) + '</span></div>';
  }
  /* ---- the compass: a real rose (10-degree ticks, N/E/S/W), a needle that points to true north, and the live coordinates under the middle of the map ---- */
  function compassSVG() {
    var t = '', i, a, r, x1, y1, x2, y2, big;
    for (i = 0; i < 36; i++) {
      a = i * 10 * Math.PI / 180; big = i % 3 === 0; r = big ? 38 : 41;
      x1 = 50 + Math.sin(a) * 44.5; y1 = 50 - Math.cos(a) * 44.5; x2 = 50 + Math.sin(a) * r; y2 = 50 - Math.cos(a) * r;
      t += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="#14261B" stroke-width="' + (big ? 2 : 1.2) + '"/>';
    }
    return '<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="48" fill="#FBF7EA" stroke="#14261B" stroke-width="3"/><circle cx="50" cy="50" r="46" fill="none" stroke="#C9A227" stroke-width="1.5"/>' + t +
      '<path d="M50 20L56 44L80 50L56 56L50 80L44 56L20 50L44 44Z" fill="#E9D8A6" stroke="#14261B" stroke-width="1"/>' +
      '<g font-family="VT323,monospace" font-size="15" text-anchor="middle" fill="#14261B"><text x="50" y="22" fill="#B3261E" font-size="17">N</text><text x="84" y="55">E</text><text x="50" y="87">S</text><text x="16" y="55">W</text></g>' +
      '<g class="needle" id="pp-needle"><path d="M50 14L55.5 50L44.5 50Z" fill="#B3261E" stroke="#14261B" stroke-width="1.5" stroke-linejoin="round"/><path d="M50 86L55.5 50L44.5 50Z" fill="#FBF7EA" stroke="#14261B" stroke-width="1.5" stroke-linejoin="round"/><circle cx="50" cy="50" r="3.6" fill="#C9A227" stroke="#14261B" stroke-width="1.5"/></g></svg>';
  }
  function fmtCoord(lon, lat) {
    function f(v, p, n) { return Math.abs(v).toFixed(1) + '°' + (v >= 0 ? p : n); }
    return f(lat, 'N', 'S') + ' ' + f(lon, 'E', 'W');
  }
  function swingNeedle() {                            // a damped swing that settles on north, like a real needle
    var n = $('#pp-needle'); if (!n || reduce || !n.animate) return;
    n.animate([{ transform: 'rotate(26deg)' }, { transform: 'rotate(-17deg)' }, { transform: 'rotate(10deg)' }, { transform: 'rotate(-5deg)' }, { transform: 'rotate(2deg)' }, { transform: 'rotate(0deg)' }], { duration: 1500, easing: 'ease-out' });
  }
  function tag(word, kind) { return '<span class="tagstamp ' + kind + '">' + word + '</span>'; }
  function countUp(el, to, ms) {
    if (reduce || !to) { el.textContent = to; return; }
    var t0 = performance.now();
    (function step(now) { var k = Math.min(1, (now - t0) / ms); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); })(t0);
  }
  function issue(iso) { var a = iso.split('-'); var M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; return a.length === 3 ? (+a[2]) + ' ' + M[+a[1] - 1] + ' ' + a[0] : iso; }

  /* ---- panes ---- */
  function showPane(name, dir) {
    var panes = node.querySelectorAll('.pane'), from = S.pane;
    for (var i = 0; i < panes.length; i++) {
      var on = panes[i].id === 'pane-' + name;
      if (on && dir === 'back' && !panes[i].classList.contains('on')) {   // come in from the left when going back
        panes[i].style.transition = 'none'; panes[i].style.transform = 'translateX(-30px)'; void panes[i].offsetWidth;
        panes[i].style.transition = ''; panes[i].style.transform = '';
      }
      panes[i].classList.toggle('on', on);
      panes[i].setAttribute('aria-hidden', on ? 'false' : 'true');
      if (on) panes[i].scrollTop = 0;
    }
    S.pane = name;
    if (from && from !== name) h.sound('pageflip');
    var dayTitle = Clock.formatDate().replace(/^\w+ (\d+ \w+).*$/, '$1');
    $('#pp-kicker').textContent = { play: 'TODAY’S PASSPORT', after: 'TODAY’S PASSPORT', done: 'TODAY’S PASSPORT', book: 'YOUR PASSPORT', list: 'YOUR PASSPORT', detail: 'YOUR PASSPORT' }[name];
    $('#pp-title').textContent = { play: dayTitle, after: dayTitle, done: 'Complete', book: 'Stamps', list: S.cont ? Countries.continents[S.cont] : '', detail: 'Stamp' }[name];
    mv.host.classList.toggle('dim', name === 'book' || name === 'list' || name === 'detail');
    setTimeout(function () { var f = node.querySelector('#pane-' + name + ' [data-focus]'); if (f && !S.busy) f.focus({ preventScroll: true }); }, reduce ? 0 : 320);
  }

  function paintTries() {
    var rec = todayRec(), out = '';
    for (var i = 0; i < MAX_TRIES; i++) {
      var code = rec.tries[i], cls = !code ? '' : (rec.answer === code ? 'hit' : 'miss');
      out += '<i class="' + cls + '"></i>';
    }
    var el = $('#pp-tries'); el.innerHTML = out;
    el.setAttribute('aria-label', rec.result ? 'Prompt finished' : (MAX_TRIES - rec.tries.length) + ' of ' + MAX_TRIES + ' tries left');
  }

  /* ---- play pane ---- */
  function paintPlay() {
    var pr = promptFor(Clock.dayKey()), p = pr.p, rec = todayRec();
    $('#pp-kick').textContent = 'PROMPT ' + pr.no + ' OF ' + Prompts.length + ' · ' + p.family.toUpperCase();
    $('#pp-prompt').textContent = cap(p.text);
    var lv = $('#pp-level'); lv.textContent = p.level.toUpperCase(); lv.setAttribute('data-level', p.level);
    $('#pp-postcard').innerHTML = postcard(p.family);
    var miss = rec.tries.some(function (c) { return rec.answer !== c; });
    var rl = $('#pp-rule'); rl.hidden = !miss; rl.innerHTML = '<b>THE RULE</b>' + esc(p.rule);
    var lg = $('#pp-ledger');
    lg.innerHTML = rec.tries.map(function (c) { var cc = Countries.byCode(c); return '<li>' + tag('MISS', 'miss') + '<span>' + esc(cc ? cc.name : c) + '</span></li>'; }).join('');
    lg.hidden = !rec.tries.length;
    var left = MAX_TRIES - rec.tries.length;
    $('#pp-left').textContent = left + (left === 1 ? ' try left' : ' tries left');
    setSel(null); $('#pp-in').value = ''; msg('');
  }
  function stateOf(code) {
    var rec = todayRec(), s = stampFor(code);
    if (rec.tries.indexOf(code) >= 0) return rec.answer === code ? (s && s.gold ? 'st-gold' : 'st-hit') : 'st-miss';
    return '';
  }
  function setSel(c) {
    S.sel = c;
    var el = $('#pp-sel');
    if (c) { el.textContent = c.name; el.classList.add('has'); } else { el.textContent = 'type a name or tap the map'; el.classList.remove('has'); }
    if (S.ghost) { mv.removePin(S.ghost); S.ghost = null; }
    if (S.selCode) mv.state(S.selCode, stateOf(S.selCode));
    S.selCode = null;
    if (c && !S.busy) { S.ghost = mv.pin(c.code, { kind: 'ghost' }); S.selCode = c.code; if (!stateOf(c.code)) mv.state(c.code, 'st-sel'); }
  }
  function msg(text, bad) { var m = $('#pp-msg'); m.textContent = text || ''; m.className = 'pp-msg' + (bad ? ' bad' : ''); }

  /* suggestions open upwards, because the input sits at the bottom of the panel */
  function paintSuggest() {
    var box = $('#pp-sug'), input = $('#pp-in'), rec = todayRec();
    var list = Countries.suggest(input.value, 6).filter(function (c) { return rec.tries.indexOf(c.code) < 0; });
    S.sug = list;
    if (!input.value.trim() || !list.length) { box.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); S.sugI = -1; return; }
    if (S.sugI >= list.length) S.sugI = list.length - 1;
    box.innerHTML = list.map(function (c, i) { return '<li role="option" id="pp-o' + i + '" data-i="' + i + '" aria-selected="' + (i === S.sugI) + '"><b>' + esc(c.name) + '</b><span>' + esc(c.continentName) + '</span></li>'; }).join('');
    box.hidden = false; input.setAttribute('aria-expanded', 'true');
    if (S.sugI >= 0) input.setAttribute('aria-activedescendant', 'pp-o' + S.sugI); else input.removeAttribute('aria-activedescendant');
  }
  function closeSuggest() { var b = $('#pp-sug'); if (b) b.hidden = true; var i = $('#pp-in'); if (i) i.setAttribute('aria-expanded', 'false'); S.sugI = -1; }
  function choose(c) {
    $('#pp-in').value = c.name; closeSuggest(); setSel(c); msg('');
    h.sound('tap');
    mv.fly(c.code, 700, 5);   // a gentle look at the place before you commit
  }

  /* ---- one guess, animated ---- */
  function guess() {
    if (S.busy) return;
    var raw = $('#pp-in').value, c = S.sel && S.sel.name === raw ? S.sel : Countries.find(raw);
    if (!raw.trim()) { msg('Type a country, or tap one on the map.', true); return; }
    if (!c) { msg('I do not know “' + raw.trim() + '” yet. Pick a country from the list that appears as you type.', true); h.sound('miss'); return; }
    var r = submit(c);
    if (!r.ok) { msg(r.msg, true); h.sound('tap'); return; }
    S.busy = true; closeSuggest(); msg(''); setSel(null);
    var rec = todayRec(), n = rec.tries.length, kind = r.outcome === 'wrong' ? 'miss' : (c.gold ? 'gold' : 'hit');
    h.refreshHome(); paintTries();
    $('#pp-in').blur();
    h.sound('whoosh');
    swingNeedle(); mv.fly(c.code, 1100, 2.6).then(function () {
      mv.state(c.code, 'st-' + kind);
      mv.pin(c.code, { kind: kind, drop: true, ring: true, num: n });
      return wait(430).then(function () { h.sound('pindrop'); return wait(520); });
    }).then(function () {
      var word = r.outcome === 'wrong' ? 'MISS' : (r.outcome === 'repeat' ? 'HIT' : (c.gold ? 'GOLD' : 'NEW'));
      showCard(c, n, word, kind);
      if (r.outcome === 'wrong') h.sound('miss');
      else if (r.outcome === 'repeat') h.sound('hit');
      else { h.sound('stampslam'); setTimeout(function () { h.sound(c.gold ? 'milestone' : 'hit'); }, 300); }
      fillAfter(c, r);
      var live = $('#pp-live'); live.textContent = r.outcome === 'wrong' ? (rec.result === 'missed' ? 'Not a match. Out of tries.' : 'Not a match. ' + (MAX_TRIES - n) + ' tries left.') : (r.outcome === 'stamp' ? 'New stamp: ' + c.name : 'Correct. Already in your passport.');
      return wait(420);
    }).then(function () {
      S.busy = false;
      showPane('after');
    });
  }
  function showCard(c, n, word, kind) {
    var card = $('#pp-card');
    card.innerHTML = '<span class="k">PIN ' + n + ' OF ' + MAX_TRIES + '</span><b class="nm">' + esc(c.name.toUpperCase()) + '</b><span class="cap">Capital · ' + esc(c.capital) + ' · ' + esc(c.continentName) + '</span>' + tag(word, kind + ' big');
    card.hidden = false; card.classList.remove('in'); void card.offsetWidth; card.classList.add('in');
  }
  function hideCard() { var card = $('#pp-card'); card.classList.remove('in'); card.hidden = true; }

  function fillAfter(c, r) {
    var rec = todayRec(), p = promptFor(Clock.dayKey()).p, el = $('#pane-after .inner'), html;
    var left = MAX_TRIES - rec.tries.length;
    if (r.outcome === 'wrong') {
      html = tag('MISS', 'miss big') + '<h2>“' + esc(c.name) + '”</h2><p class="why">Not on today’s list.</p><p class="rulebox"><b>THE RULE</b>' + esc(p.rule) + '</p>' +
        (rec.result === 'missed' ? '<p class="note">That was your last try. Next you will see what fits, so you can learn it.</p>' : '<p class="note">' + left + (left === 1 ? ' try' : ' tries') + ' left. Look at where you pinned and think again.</p>');
      $('#pp-next').textContent = rec.result === 'missed' ? 'SEE RESULTS ▲' : 'NEXT TRY ▲';
    } else if (r.outcome === 'repeat') {
      html = tag('HIT', 'hit big') + '<h2>“' + esc(c.name) + '”</h2><p class="why">Right answer, old friend.</p><p class="note">It is already in your passport, so no new stamp today. Try a different country on a later day to grow the book.</p>' + streakBlock(r.daily);
      $('#pp-next').textContent = 'SEE RESULTS ▲';
    } else {
      var st = stampFor(c.code);
      html = '<div class="stampwrap pop">' + stampTile(st, true) + '</div><h2>' + (c.gold ? 'Gold stamp!' : 'New stamp!') + '</h2><p class="why">' + esc(c.name) + ' is in your passport.' + (c.gold ? ' A rare country, so the reward is doubled.' : '') + '</p>' +
        '<div class="rewrow" aria-label="Reward">' + rewardRow(r.amount, false) + '</div>' + streakBlock(r.daily);
      $('#pp-next').textContent = 'SEE RESULTS ▲';
    }
    el.innerHTML = html;
  }

  function afterNext() {
    if (S.busy) return;
    var rec = todayRec();
    hideCard();
    if (rec.result) { enterDone(); return; }
    S.busy = true; h.sound('whoosh');
    paintPlay();
    showPane('play', 'back');
    mv.home(950).then(function () { S.busy = false; $('#pp-in').focus({ preventScroll: true }); });
  }

  /* ---- finished view ---- */
  function enterDone() {
    var rec = todayRec(), p = promptFor(Clock.dayKey()).p;
    S.answers = false; S.busy = true;
    var rows = '';
    for (var i = 0; i < MAX_TRIES; i++) {
      var code = rec.tries[i];
      if (!code) { rows += '<li class="skip"><span class="n">' + (i + 1) + '</span><span class="c">unused</span></li>'; continue; }
      var cc = Countries.byCode(code), good = rec.answer === code;
      rows += '<li><span class="n">' + (i + 1) + '</span>' + tag(good ? 'HIT' : 'MISS', good ? 'hit' : 'miss') + '<span class="c">' + esc(cc.name) + '</span></li>';
    }
    var st = rec.result === 'stamp' ? stampFor(rec.answer) : null;
    var head = rec.result === 'stamp' ? (st.gold ? 'Gold stamp earned' : 'New stamp earned') : rec.result === 'repeat' ? 'Solved, no new stamp' : 'No stamp today';
    var sub = rec.result === 'missed' ? 'Out of tries. Tomorrow is a fresh prompt.' : rec.result === 'repeat' ? 'That country was already in your passport.' : esc(Countries.byCode(rec.answer).name) + ' joins your passport.';
    var amt = st ? REWARD * (st.gold ? 2 : 1) : 0, n = Save.get().passport.stamps.length;
    var answers = p.answers.map(function (c) { return Countries.byCode(c); }).filter(Boolean).map(function (c) { return '<li>' + esc(c.name) + '</li>'; }).join('');
    $('#pane-done .inner').innerHTML =
      '<div class="sumbox"><ol class="sumlist">' + rows + '</ol><div class="sumart">' + (st ? stampTile(st, false) : '<div class="postcard small">' + postcard(p.family) + '</div>') + '</div></div>' +
      '<h2 data-focus tabindex="-1">' + head + '</h2><p class="why">' + sub + '</p>' +
      (amt ? '<div class="rewrow" aria-label="Reward">' + rewardRow(amt, true) + '</div>' : '') +
      (rec.result === 'missed' ? '' : streakBlock(null)) +
      '<div class="tiles"><button class="tile" id="pp-open-book"><b>PASSPORT</b><span>' + n + ' of ' + Countries.count + ' countries</span></button><button class="tile" id="pp-open-ans" aria-pressed="false" aria-controls="pp-anslist"><b>ANSWERS</b><span>' + p.answers.length + ' fit today</span></button></div>' +
      '<div class="anslist" id="pp-anslist" hidden><p class="rulebox"><b>THE RULE</b>' + esc(p.rule) + '</p><ul>' + answers + '</ul></div>' +
      '<div class="nextin"><span class="cnt" id="pp-count2"></span><span>until tomorrow’s prompt</span></div>' +
      '<button class="pbtn light wide" id="pp-home2">RETURN HOME</button>';
    [].forEach.call(node.querySelectorAll('#pane-done .cu'), function (el) { countUp(el, amt, 1000); });
    paintMapDone();
    showPane('done');
    h.sound('whoosh');
    mv.flyBox(rec.tries, 1200).then(function () { S.busy = false; });
    $('#pp-open-book').addEventListener('click', openBook);
    $('#pp-home2').addEventListener('click', function () { h.show('home'); });
    $('#pp-open-ans').addEventListener('click', function (e) {
      S.answers = !S.answers; e.currentTarget.setAttribute('aria-pressed', S.answers);
      $('#pp-anslist').hidden = !S.answers; h.sound('tap'); paintMapDone();
      mv.flyBox(S.answers ? p.answers.concat(rec.tries) : rec.tries, 1100);
    });
  }
  function paintMapDone() {
    var rec = todayRec(), p = promptFor(Clock.dayKey()).p;
    mv.clearStates(); mv.clearPins();
    if (S.answers) p.answers.forEach(function (c) { mv.state(c, 'st-ans'); });
    rec.tries.forEach(function (c, i) {
      var good = rec.answer === c, s = stampFor(c), kind = good ? (s && s.gold ? 'gold' : 'hit') : 'miss';
      mv.state(c, 'st-' + kind); mv.pin(c, { kind: kind, drop: true, num: i + 1 });
    });
  }

  /* ---- passport book ---- */
  function openBook() { if (S.busy) return; paintBook(); showPane('book'); paintMapBook(); mv.home(1000); h.sound('whoosh'); }
  function paintMapBook() {
    mv.clearStates(); mv.clearPins();
    Save.get().passport.stamps.forEach(function (s) { mv.state(s.code, s.gold ? 'st-gold' : 'st-own'); });
  }
  function contStamps(k) { return Save.get().passport.stamps.filter(function (s) { var c = Countries.byCode(s.code); return c && c.continent === k; }).length; }
  function miniMap(k) {
    var b = CONT_BOX[k], p1 = WorldMap.project(b[0], b[3]), p2 = WorldMap.project(b[2], b[1]);
    var own = {}; Save.get().passport.stamps.forEach(function (s) { own[s.code] = s.gold ? 'gold' : 'own'; });
    var uses = Countries.all.filter(function (c) { return c.continent === k && WorldMap.land[c.code]; }).map(function (c) { return '<use href="#p-' + c.code + '" class="' + (own[c.code] || '') + '"/>'; }).join('');
    return '<svg viewBox="' + p1[0].toFixed(0) + ' ' + p1[1].toFixed(0) + ' ' + (p2[0] - p1[0]).toFixed(0) + ' ' + (p2[1] - p1[1]).toFixed(0) + '" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' + uses + '</svg>';
  }
  function paintBook() {
    var s = Save.get(), st = s.passport.stamps, gold = st.filter(function (x) { return x.gold; }).length;
    var played = Object.keys(s.passport.days).filter(function (k) { return s.passport.days[k].result; }).length;
    var last = st.length ? issue(st[st.length - 1].date) : '–', issued = s.createdAt ? issue(s.createdAt.slice(0, 10)) : '–';
    var grid = CONT_ORDER.map(function (k) {
      var total = Countries.all.filter(function (c) { return c.continent === k; }).length, have = contStamps(k);
      return '<button class="cont" data-k="' + k + '" style="--cc:' + CONT_COLOR[k] + '"><span class="cn">' + Countries.continents[k].toUpperCase() + '</span><span class="mm">' + miniMap(k) + '</span><span class="ct">' + have + ' / ' + total + '</span></button>';
    }).join('');
    $('#pane-book .inner').innerHTML =
      '<p class="kick">' + st.length + ' OF ' + Countries.count + ' STAMPED</p><h1 data-focus tabindex="-1">Passport</h1>' +
      '<div class="issue"><span class="logo">' + Art.sprite('brain') + '</span><div><span class="kick">ISSUED</span><b>' + issued + '</b><span class="kick">LAST STAMPED</span><b>' + last + '</b></div></div>' +
      '<div class="contgrid">' + grid + '</div>' +
      '<div class="stats"><div><b>' + st.length + '</b><span>countries</span></div><div><b class="g">' + gold + '</b><span>gold</span></div><div><b>' + played + '</b><span>days played</span></div></div>' +
      (st.length ? '' : '<p class="note">Your passport is empty. One right answer earns your first stamp.</p>');
    [].forEach.call(node.querySelectorAll('#pane-book .cont'), function (b) { b.addEventListener('click', function () { openList(b.getAttribute('data-k')); }); });
  }
  function openList(k) {
    S.cont = k; S.filter = 'all'; paintList(); showPane('list');
    mv.flyBox(Countries.all.filter(function (c) { return c.continent === k && WorldMap.box[c.code]; }).map(function (c) { return c.code; }), 1100); h.sound('whoosh');
  }
  function paintList() {
    var k = S.cont, own = {}; Save.get().passport.stamps.forEach(function (s) { own[s.code] = s; });
    var all = Countries.all.filter(function (c) { return c.continent === k; }), have = all.filter(function (c) { return own[c.code]; }).length;
    var rows = all.filter(function (c) { return S.filter === 'all' || (S.filter === 'found' ? own[c.code] : !own[c.code]); }).map(function (c) {
      var s = own[c.code];
      return s ? '<li><button class="row got" data-c="' + c.code + '"><b>' + esc(c.name) + '</b>' + (s.gold ? tag('RARE', 'gold') : tag('STAMPED', 'hit')) + '</button></li>'
               : '<li><span class="row"><b>' + esc(c.name) + '</b><span class="dots">· · ·</span></span></li>';
    }).join('');
    $('#pane-list .inner').innerHTML =
      '<p class="kick">' + have + ' OF ' + all.length + ' STAMPED</p><h1 data-focus tabindex="-1">' + esc(Countries.continents[k]) + '</h1>' +
      '<div class="chips" role="group" aria-label="Filter"><button data-f="all" aria-pressed="' + (S.filter === 'all') + '">ALL ' + all.length + '</button><button data-f="found" aria-pressed="' + (S.filter === 'found') + '">FOUND ' + have + '</button><button data-f="missing" aria-pressed="' + (S.filter === 'missing') + '">MISSING ' + (all.length - have) + '</button></div>' +
      '<ul class="clist">' + rows + '</ul>';
    [].forEach.call(node.querySelectorAll('#pane-list .chips button'), function (b) { b.addEventListener('click', function () { S.filter = b.getAttribute('data-f'); h.sound('tap'); paintList(); }); });
    [].forEach.call(node.querySelectorAll('#pane-list .row.got'), function (b) { b.addEventListener('click', function () { openDetail(b.getAttribute('data-c')); }); });
  }
  function openDetail(code) {
    var c = Countries.byCode(code), s = stampFor(code); if (!c || !s) return;
    var pr = promptById(s.promptId);
    $('#pane-detail .inner').innerHTML =
      '<p class="kick">' + esc(c.continentName.toUpperCase()) + (s.gold ? ' · RARE' : '') + '</p><h1 data-focus tabindex="-1">' + esc(c.name) + '</h1>' +
      '<div class="stampwrap pop">' + stampTile(s, true) + '</div>' +
      '<dl class="facts"><div><dt>Capital</dt><dd>' + esc(c.capital) + '</dd></div><div><dt>Stamped</dt><dd>' + issue(s.date) + '</dd></div>' + (pr ? '<div><dt>Earned by answering</dt><dd>“Name a country that ' + esc(cap(pr.text)) + '”</dd></div>' : '') + (s.gold ? '<div><dt>Reward</dt><dd>Double, because it is a rare country</dd></div>' : '') + '</dl>';
    showPane('detail'); mv.fly(code, 1000, 3); h.sound('tap');
  }

  function goBack() {
    if (S.busy) return;
    var p = S.pane;
    if (p === 'detail') { paintList(); showPane('list', 'back'); return; }
    if (p === 'list') { paintBook(); showPane('book', 'back'); mv.home(900); return; }
    if (p === 'book') {
      if (todayRec().result) { enterDone(); return; }
      mv.clearStates(); mv.clearPins(); restorePlayMap(); paintPlay(); showPane('play', 'back'); mv.home(900); return;
    }
    h.show('home');
  }
  function restorePlayMap() {
    var rec = todayRec();
    rec.tries.forEach(function (c, i) { var s = stampFor(c), good = rec.answer === c, kind = good ? (s && s.gold ? 'gold' : 'hit') : 'miss'; mv.state(c, 'st-' + kind); mv.pin(c, { kind: 'past ' + kind, num: i + 1 }); });
  }

  /* ---- build ---- */
  function build(root, helpers) {
    h = helpers;
    node = h.el(
      '<section class="screen" id="screen-passport" aria-label="Passport"><div class="pp-desk"><div class="pp-frame">' +
        '<i class="stud tl"></i><i class="stud tr"></i><i class="stud bl"></i><i class="stud br"></i>' +
        '<div class="pp-mapwrap"><div class="pp-map" id="pp-map"></div>' +
          '<div class="mv-ui pp-zoom"><button id="pp-zin" aria-label="Zoom in">+</button><button id="pp-zout" aria-label="Zoom out">−</button></div>' +
          '<button class="mv-ui pp-compass" id="pp-compass" aria-label="Compass: north is up. Press to see the whole world">' + compassSVG() + '<span class="cc" id="pp-coord"></span></button>' +
          '<div class="pp-pincard" id="pp-card" hidden></div></div>' +
        '<aside class="pp-side">' +
          '<header class="pp-bar"><button class="barbtn" id="pp-back" aria-label="Back">←</button><div class="bart"><span class="kick" id="pp-kicker"></span><b id="pp-title"></b></div>' +
            '<div class="tries" id="pp-tries" role="img"></div><button class="barbtn" id="pp-snd" aria-label="Sound effects" aria-pressed="false"></button></header>' +
          '<div class="pp-panes">' +
            '<div class="pane" id="pane-play"><div class="inner">' +
              '<p class="kick" id="pp-kick"></p>' +
              '<h1 data-focus tabindex="-1" id="pp-prompt-h"><span class="lead">Name a country that</span> <span id="pp-prompt"></span></h1><span class="lvl" id="pp-level"></span>' +
              '<div class="postcard" id="pp-postcard"></div>' +
              '<p class="rulebox" id="pp-rule" hidden></p><ul class="ledger" id="pp-ledger" hidden></ul>' +
            '</div><form class="pp-drop" id="pp-form" autocomplete="off" novalidate>' +
              '<div class="pinline"><span>PIN</span><b id="pp-sel"></b><span class="left" id="pp-left"></span></div>' +
              '<div class="combo"><label for="pp-in" class="sr-only">Country</label><input class="pin" id="pp-in" type="text" role="combobox" aria-expanded="false" aria-controls="pp-sug" aria-autocomplete="list" placeholder="Type a country…" autocapitalize="words" spellcheck="false" enterkeyhint="go"><ul id="pp-sug" class="pp-sug" role="listbox" hidden></ul></div>' +
              '<button class="dropbtn" type="submit" id="pp-go">DROP PIN</button><p class="pp-msg" id="pp-msg" role="alert"></p></form></div>' +
            '<div class="pane" id="pane-after"><div class="inner"></div><div class="pp-foot"><button class="darkbtn" id="pp-next">NEXT TRY ▲</button></div></div>' +
            '<div class="pane" id="pane-done"><div class="inner"></div></div>' +
            '<div class="pane" id="pane-book"><div class="inner"></div></div>' +
            '<div class="pane" id="pane-list"><div class="inner"></div></div>' +
            '<div class="pane" id="pane-detail"><div class="inner"></div></div>' +
          '</div><p class="sr-only" id="pp-live" role="status" aria-live="polite"></p>' +
        '</aside>' +
      '</div></div></section>');
    root.appendChild(node);

    var input = $('#pp-in');
    input.addEventListener('input', function () { S.sugI = -1; msg(''); var c = Countries.find(input.value); if (c) setSel(c); else if (S.sel) setSel(null); paintSuggest(); });
    input.addEventListener('keydown', function (e) {
      var n = S.sug.length, open = !$('#pp-sug').hidden;
      if (e.key === 'ArrowDown' && n) { e.preventDefault(); S.sugI = (S.sugI + 1) % n; paintSuggest(); }
      else if (e.key === 'ArrowUp' && n) { e.preventDefault(); S.sugI = (S.sugI - 1 + n) % n; paintSuggest(); }
      else if (e.key === 'Escape') closeSuggest();
      else if (e.key === 'Enter' && open && S.sugI >= 0) { e.preventDefault(); choose(S.sug[S.sugI]); }
    });
    $('#pp-sug').addEventListener('mousedown', function (e) { e.preventDefault(); });
    $('#pp-sug').addEventListener('click', function (e) { var li = e.target.closest('li[data-i]'); if (li) choose(S.sug[+li.getAttribute('data-i')]); });
    input.addEventListener('blur', function () { setTimeout(closeSuggest, 120); });
    $('#pp-form').addEventListener('submit', function (e) { e.preventDefault(); guess(); });
    $('#pp-next').addEventListener('click', afterNext);
    $('#pp-back').addEventListener('click', goBack);
    $('#pp-snd').addEventListener('click', function () { var on = h.toggleSfx(); paintSnd(); if (on) h.sound('tap'); });
    $('#pp-compass').addEventListener('click', function () { if (mv) { mv.home(900); swingNeedle(); h.sound('tap'); } });
    $('#pp-zin').addEventListener('click', function () { if (mv) mv.zoom(0.55); h.sound('tap'); });
    $('#pp-zout').addEventListener('click', function () { if (mv) mv.zoom(1.8); h.sound('tap'); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && node.classList.contains('active') && S.pane !== 'play' && e.target === document.body) goBack(); });

    Clock.onTick(function (left) { var c = node.querySelector('#pp-count2'); if (c) c.textContent = Clock.formatCountdown(left); });
    Clock.onNewDay(function () { if (node.classList.contains('active')) enter(); });
    node.__enter = enter;
    node.__leave = function () { h.stopAmbience(); closeSuggest(); };
  }
  function paintSnd() {
    var on = h.isSfx(), b = $('#pp-snd');
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M3 9h4l5-4v14l-5-4H3z" fill="#14261B"/>' + (on ? '<path d="M15 8c2 2 2 6 0 8M18 5c4 4 4 10 0 14" stroke="#14261B" stroke-width="2" fill="none"/>' : '<path d="M16 9l6 6M22 9l-6 6" stroke="#C0392B" stroke-width="2.4"/>') + '</svg>';
  }

  function enter() {
    if (!mv) {
      mv = MapView.create($('#pp-map'));
      mv.onMove(function () { var c = mv.center(); $('#pp-coord').textContent = fmtCoord(c[0], c[1]); });
      mv.onPick(function (code) {
        if (S.pane === 'book' || S.pane === 'list') { if (stampFor(code)) openDetail(code); return; }
        if (S.pane !== 'play' || S.busy) return;
        var c = Countries.byCode(code); if (c) { $('#pp-in').value = c.name; closeSuggest(); setSel(c); msg(''); h.sound('tap'); }
      });
    }
    mv.resize(); paintSnd(); paintTries(); S.busy = false; S.answers = false; S.pane = '';
    mv.clearStates(); mv.clearPins(); hideCard();
    var rec = todayRec();
    swingNeedle(); mv.settle();   // the map eases out from a close view, so the screen never snaps in
    if (rec.result) enterDone();
    else { paintPlay(); restorePlayMap(); showPane('play'); h.startAmbience(); }
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
