/* Screens: welcome, home (placeholder for Release 1), settings. Plain DOM, no framework. */
var Screens = (function () {
  var root, current = null, previous = 'welcome', toastTimer = null;

  function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }
  function $(sel, scope) { return (scope || root).querySelector(sel); }

  function toast(text, plain) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = (plain ? '' : '\u266A ') + text;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1100);
  }

  function show(name) {
    if (current && current !== name && current !== 'settings') previous = current;
    var leaving = current && current !== name ? root.querySelector('#screen-' + current) : null;
    if (leaving && leaving.__leave) leaving.__leave();
    current = name;
    var screens = root.querySelectorAll('.screen');
    for (var i = 0; i < screens.length; i++) screens[i].classList.toggle('active', screens[i].id === 'screen-' + name);
    window.scrollTo(0, 0);
    if (name === 'settings') { var st = root.querySelector('#screen-settings'); if (st && st.__paint) st.__paint(); }
    var entering = root.querySelector('#screen-' + name); if (entering && entering.__enter) entering.__enter();
    var h = root.querySelector('#screen-' + name + ' [data-focus]');
    if (h) h.focus({ preventScroll: true });
  }

  function applySoundSettings() {
    var s = Save.get().settings;
    Sound.setConfig({ sfx: s.sfx, ambience: s.ambience, volume: s.volume });
  }

  /* ---------------- Welcome v3: pixel woodland lake ---------------- */
  var CITIES = ['Sunleaf Quarter', 'Mossbridge', 'Bamboo Landing', 'Kite Hill', 'Dawnfield', 'Snail Harbour'];
  var MOON_ICON = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M9 1a6 6 0 1 0 4 9 5 5 0 0 1-4-9z" fill="currentColor"/></svg>';

  function buildWelcome() {
    var node = el(
      '<section class="screen" id="screen-welcome" aria-label="Welcome"><div class="w3" data-sky="dawn" data-step="0">' +
        '<div class="w3-st" aria-hidden="true">' +
          '<div class="w3-l dawn"></div><div class="w3-l day"></div><div class="w3-l night"></div>' +
          '<div class="w3-l fr"></div><div class="w3-l frn"></div><div class="w3-l fa"></div><div class="w3-l fb"></div>' +
          '<div class="w3-sign" id="w-sign"></div>' +
        '</div>' +
        '<button class="w3-chip w3-moon" id="w-night" aria-pressed="false">' + MOON_ICON + '<span id="w-night-t">Night sky</span></button>' +
        '<div class="w3-c" id="w-step0">' +
          '<div class="w3-brand">' + Art.sprite('brain') + '<h1 data-focus tabindex="-1">QuinnDom</h1></div>' +
          '<p class="w3-tag">Make yourself at quest.</p>' +
          '<p class="w3-hello">The world is a lot. Here’s a tiny island.</p>' +
          '<p class="w3-body">Solve a puzzle. Build something lovely. Leave whenever you like. Your city will still be here, quietly photosynthesizing. No account, no ads, no streak-shaming.</p>' +
          '<button class="w3-go" id="w-go">Start Game</button>' +
          '<button class="w3-link" id="w-import">I already have a save file</button>' +
          '<p class="w3-err" id="w-err" role="alert"></p>' +
          '<button class="w3-chip" id="w-settings">Settings</button>' +
        '</div>' +
        '<div class="w3-c" id="w-step1" hidden>' +
          '<div class="w3-mini">' + Art.sprite('brain') + '<span>QuinnDom</span></div>' +
          '<h2 tabindex="-1" id="w-h2">Two small questions</h2>' +
          '<p class="w3-body">Three citizens are already waiting at the camp. They brought snacks. Your city lives in this browser like a snail in its shell, so export a save file now and then.</p>' +
          '<p class="w3-tag s">Fill in the boards on the shore.</p>' +
          '<p class="w3-err" id="w-err2" role="alert"></p>' +
          '<button class="w3-go" id="w-plant">Plant the first tower</button>' +
          '<button class="w3-link" id="w-back">Back</button>' +
        '</div>' +
        '<div class="w3-box a" id="w-boxa" hidden><label for="pname">What should citizens call you?</label>' +
          '<input id="pname" class="pin" type="text" maxlength="40" autocomplete="nickname" placeholder="Your name or a nickname">' +
          '<span class="tip">It will be painted on the sign by the lake.</span><div class="posts"><span></span><span></span></div></div>' +
        '<div class="w3-box b" id="w-boxb" hidden><label for="cname">And your first city?</label>' +
          '<input id="cname" class="pin" type="text" maxlength="40" value="Sunleaf Quarter">' +
          '<button class="w3-sm" id="w-shuffle">Surprise me</button><div class="posts"><span></span><span></span></div></div>' +
        '<input type="file" id="w-file" accept=".json,application/json" hidden>' +
      '</div></section>');
    root.appendChild(node);

    var w3 = $('.w3', node);
    var state = { step: 0, night: false, cityIdx: 0 };

    function paint() {
      w3.setAttribute('data-sky', state.night ? 'night' : (state.step === 0 ? 'dawn' : 'day'));
      w3.setAttribute('data-step', String(state.step));
      $('#w-step0', node).hidden = state.step !== 0;
      $('#w-step1', node).hidden = state.step !== 1;
      $('#w-boxa', node).hidden = state.step !== 1;
      $('#w-boxb', node).hidden = state.step !== 1;
      $('#w-night', node).setAttribute('aria-pressed', state.night ? 'true' : 'false');
      $('#w-night-t', node).textContent = state.night ? 'Back to day' : 'Night sky';
    }
    function setStep(n) {
      state.step = n; paint();
      var f = n === 0 ? $('#w-step0 h1', node) : $('#pname', node);
      if (f) f.focus({ preventScroll: true });
    }
    function syncSign() {
      var nm = $('#pname', node).value.trim() || 'You';
      var ct = $('#cname', node).value.trim().replace(/ Quarter$/, '') || 'Your city';
      $('#w-sign', node).textContent = nm + ' · ' + ct;
    }

    $('#w-go', node).addEventListener('click', function () { Sound.play('tap'); setStep(1); });
    $('#w-back', node).addEventListener('click', function () { setStep(0); });
    $('#w-night', node).addEventListener('click', function () { state.night = !state.night; Sound.play('tap'); paint(); });
    $('#w-settings', node).addEventListener('click', function () { show('settings'); });
    $('#pname', node).addEventListener('input', function () { $('#w-err2', node).textContent = ''; syncSign(); });
    $('#cname', node).addEventListener('input', syncSign);
    $('#w-shuffle', node).addEventListener('click', function () {
      state.cityIdx = (state.cityIdx + 1) % CITIES.length;
      $('#cname', node).value = CITIES[state.cityIdx]; syncSign();
    });
    $('#w-plant', node).addEventListener('click', function () {
      var name = $('#pname', node).value.trim(), city = $('#cname', node).value.trim();
      var err = $('#w-err2', node);
      if (!name) { err.textContent = 'Tell the citizens what to call you first.'; $('#pname', node).focus(); Sound.play('notquite'); return; }
      if (!city) { err.textContent = 'Your city needs a name. Try Surprise me.'; $('#cname', node).focus(); Sound.play('notquite'); return; }
      err.textContent = '';
      Save.update({ playerName: name, cityName: city, createdAt: new Date().toISOString() });
      Sound.play('stamp');
      Screens.refreshHome();
      show('home');
    });

    // import a save file
    var file = $('#w-file', node);
    $('#w-import', node).addEventListener('click', function () { file.click(); });
    file.addEventListener('change', function () {
      var f = file.files && file.files[0];
      if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        var res = Save.importText(String(rd.result));
        if (!res.ok) { $('#w-err', node).textContent = res.error; Sound.play('notquite'); }
        else { applySoundSettings(); Screens.refreshHome(); Sound.play('collect'); show('home'); }
        file.value = '';
      };
      rd.onerror = function () { $('#w-err', node).textContent = 'Could not read that file.'; };
      rd.readAsText(f);
    });

    syncSign(); paint();
    node.__reset = function () { state.step = 0; state.night = false; paint(); };
  }


  /* ---------------- Home (placeholder) ---------------- */
  function buildHome() {
    var node = el(
      '<section class="screen" id="screen-home" aria-label="Home"><div class="h-stage">' +
        '<div class="h-top"><div class="pxp name" id="h-city"></div><button class="pbtn light" id="h-settings">Settings</button></div>' +
        '<div class="pxp h-main">' +
          '<div class="h-clock"><span class="tag" id="h-day">DAY 1</span><span class="h-date" id="h-date"></span><span class="h-count" id="h-count" aria-label="Time until the new day"></span></div>' +
          '<h1 data-focus tabindex="-1" id="h-title"></h1>' +
          '<div class="h-streak" id="h-streak"></div>' +
          '<div class="pxp h-today"><h2>Today</h2><ol class="h-tasks" id="h-tasks"></ol></div>' +
          '<div class="pxp h-backup" id="h-backup" hidden></div>' +
          '<p class="h-note">Your save lives in this browser. Export a copy from Settings now and then.</p>' +
        '</div>' +
      '</div></section>');
    root.appendChild(node);
    node.__enter = function () { refreshHome(); checkinCard(); };
    $('#h-settings', node).addEventListener('click', function () { show('settings'); });
  }
  function refreshHome() {
    var s = Save.get();
    var dn = $('#h-day'); if (dn) dn.textContent = 'DAY ' + Clock.dayNumber(s.createdAt);
    var dt = $('#h-date'); if (dt) dt.textContent = Clock.formatDate() + ' \u00B7 Vietnam time';
    $('#h-city').textContent = s.cityName;
    var ps = $('#h-pass-s'); if (ps) { var sm = Passport.summary(); ps.textContent = sm.line + ' \u00B7 ' + sm.stamps + ' / ' + sm.total + ' stamps'; var pg = $('#h-pass-go'); if (pg) pg.textContent = sm.done ? 'View passport' : 'Open passport'; }
    $('#h-title').textContent = 'Welcome, ' + (s.playerName || 'traveller') + '.';
    paintToday(); paintBackup();
  }
  /* weekly export reminder: a small card, never a blocking popup */
  function paintBackup() {
    var box = $('#h-backup'); if (!box) return;
    var b = Save.backupDue(); box.hidden = !b.due; if (!b.due) return;
    var when = b.never ? 'No backup yet' : 'Last backup: ' + b.days + ' days ago';
    box.innerHTML = '<span class="bk-peek" aria-hidden="true">' + Art.sprite('blackcat') + '</span>' +
      '<div class="bk-top"><span class="bk-stripe"></span><button class="bk-x" id="bk-x" aria-label="Remind me later">\u00D7</button></div>' +
      '<div class="bk-body"><span class="bk-pic" aria-hidden="true">' + Art.sprite('cat') + '</span><div class="bk-tx"><span class="bk-tag">SYSTEM_NOTICE</span><b>Meow! Time to back up your game</b>' +
      '<p>Your stamps and streak live only in this browser, like a cat in a cardboard box. Clear the browser or change phone and the box is gone.</p>' +
      '<p><b>Export</b> saves a file you can keep in Drive or email. <b>Import</b> (in Settings) puts everything back.</p><small>' + when + '</small></div></div>' +
      '<div class="bk-bt"><button class="bkb go" id="bk-now">EXPORT NOW</button><button class="bkb" id="bk-later">LATER</button></div>';
    function later() { Save.snoozeBackup(); box.hidden = true; }
    $('#bk-now').addEventListener('click', function () { Save.download(); Sound.play('collect'); box.innerHTML = '<div class="bk-body"><span class="bk-pic" aria-hidden="true">' + Art.sprite('cat') + '</span><div class="bk-tx"><span class="bk-tag">SYSTEM_NOTICE</span><b>Purrfect, backup saved!</b><p>Keep the file somewhere safe. I will remind you again in a week.</p></div></div>'; setTimeout(function () { box.hidden = true; }, 5000); });
    $('#bk-later').addEventListener('click', later); $('#bk-x').addEventListener('click', later);
  }
  /* streak banner and the Today task list (PRD FR-1.5) */
  function paintToday() {
    var v = Daily.view(), sm = Passport.summary(), fr = '';
    for (var i = 0; i < Daily.FREEZE_MAX; i++) fr += '<span class="fz' + (i < v.freezes ? ' on' : '') + '" title="Streak freeze">' + Art.res('ice') + '</span>';
    var st = $('#h-streak'); if (!st) return;
    var nxt = v.nextMilestone ? (v.nextMilestone - v.streak) + ' days to the ' + v.nextMilestone + '-day milestone' : 'Every milestone reached';
    st.innerHTML = '<span class="fl">' + Art.res('flame') + '</span><div class="sn"><b>' + v.streak + '</b> day' + (v.streak === 1 ? '' : 's') + ' streak<small>' + nxt + (v.toFreeze ? ' \u00B7 freeze in ' + v.toFreeze : '') + '</small></div><div class="fzs" aria-label="' + v.freezes + ' streak freezes held">' + fr + '</div>';
    var tasks = [
      { done: v.checkedIn, label: 'Check in', sub: v.checkedIn ? 'Reward collected' : 'Reward waiting', go: null },
      { done: sm.done, label: 'Passport prompt', sub: sm.line + ' \u00B7 ' + sm.stamps + ' / ' + sm.total + ' stamps', go: 'passport' },
      { done: false, label: 'Puzzle', sub: 'Arrives in Release 2', soon: true },
      { done: false, label: 'Citizens and city', sub: 'Arrives in Releases 3 and 4', soon: true },
      { done: false, label: 'World-map boss', sub: 'Arrives in Release 5', soon: true }
    ];
    $('#h-tasks').innerHTML = tasks.map(function (t, i) {
      var box = '<span class="ck' + (t.done ? ' on' : '') + '" aria-hidden="true">' + (t.done ? '\u2713' : '') + '</span>';
      var body = '<span class="tx"><b>' + t.label + '</b><small>' + t.sub + '</small></span>';
      var act = t.go ? '<button class="pbtn' + (t.done ? ' light' : '') + '" data-go="' + t.go + '">' + (t.done ? 'View' : 'Open') + '</button>' : (t.soon ? '<span class="soon">SOON</span>' : '');
      return '<li class="' + (t.soon ? 'soon' : '') + (t.done ? ' done' : '') + '">' + box + body + act + '</li>';
    }).join('');
    [].forEach.call(document.querySelectorAll('#h-tasks [data-go]'), function (b) { b.addEventListener('click', function () { show(b.getAttribute('data-go')); }); });
  }
  /* the daily check-in card: shown once on the first visit of a day */
  function checkinCard() {
    if (!Save.hasCity()) return;
    var r = Daily.checkin(); if (!r) return;
    var home = document.getElementById('screen-home'); if (!home) return;
    var parts = '';
    function chip(k, n) { return '<span class="rwd" title="' + k + '">' + Art.res(k) + '<b>' + n + '</b></span>'; }
    var msg = '';
    if (r.notice && r.notice.type === 'freeze') msg = '<p class="ci-note good">You missed ' + (r.notice.n === 1 ? 'a day' : r.notice.n + ' days') + ', so ' + (r.notice.n === 1 ? 'a streak freeze was' : r.notice.n + ' streak freezes were') + ' used. Your streak is safe.</p>';
    else if (r.notice && r.notice.type === 'reset') msg = '<p class="ci-note">Your ' + r.notice.n + '-day streak took a rest while you were away. A new one starts with today\u2019s prompt. Welcome back.</p>';
    var card = el('<div class="ci-back" role="dialog" aria-modal="true" aria-labelledby="ci-h"><div class="pxp ci-card"><span class="tag">DAILY CHECK-IN</span><h2 id="ci-h" data-focus tabindex="-1">Good morning, ' + (Save.get().playerName || 'traveller') + '</h2>' +
      '<p>Day ' + Clock.dayNumber(Save.get().createdAt) + ' of your city. Here is today\u2019s reward.</p>' +
      '<div class="rewrow">' + chip('food', r.reward.food) + chip(r.reward.res, r.reward.amount) + '</div>' + msg +
      '<button class="pbtn" id="ci-ok">Collect</button></div></div>');
    home.appendChild(card);
    Sound.play('collect');
    var ok = card.querySelector('#ci-ok'); ok.focus();
    function close() { card.classList.add('out'); setTimeout(function () { card.remove(); refreshHome(); }, 260); }
    ok.addEventListener('click', function () { Sound.play('tap'); close(); });
    card.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    refreshHome();
  }

  /* ---------------- Settings ---------------- */
  function buildSettings() {
    var moments = Object.keys(Sound.moments), loops = Object.keys(Sound.loops);
    var momentBtns = moments.map(function (k) { return '<button class="pbtn light" data-m="' + k + '" title="' + Sound.moments[k].when + '">' + Sound.moments[k].label + '</button>'; }).join('');
    var loopBtns = loops.map(function (k) { return '<button class="pbtn light" data-l="' + k + '" aria-pressed="false" title="' + Sound.loops[k].desc + '">' + Sound.loops[k].label + '</button>'; }).join('');
    var node = el(
      '<section class="screen" id="screen-settings" aria-label="Settings"><div class="s-stage"><div class="pxp s-card">' +
        '<h1 data-focus tabindex="-1">Settings</h1>' +
        '<h2>Sound</h2>' +
        '<div class="s-row"><div class="txt"><b id="l-sfx">Sound effects</b><span>Taps, chimes and stamps. Off by default.</span></div>' +
          '<button class="pswitch" id="sw-sfx" role="switch" aria-checked="false" aria-labelledby="l-sfx"><span class="knob"></span><span class="lbl">OFF</span></button></div>' +
        '<div class="s-row"><div class="txt"><b id="l-amb">Puzzle ambience</b><span>A quiet loop while you think. Plays only while a puzzle is open.</span></div>' +
          '<button class="pswitch" id="sw-amb" role="switch" aria-checked="false" aria-labelledby="l-amb"><span class="knob"></span><span class="lbl">OFF</span></button></div>' +
        '<div class="s-row" style="align-items:stretch;flex-direction:column;gap:2px"><label for="vol" style="font-weight:700;font-size:18px">Volume</label>' +
          '<div class="s-vol"><input id="vol" class="prange" type="range" min="0" max="100" step="5"><span class="pct" id="vol-pct"></span></div></div>' +
        '<p class="s-hint" id="s-support"></p>' +
        '<div><b style="font-size:16px">Try the sounds</b><p class="s-hint">These play even while the switches are off, so you can hear what you are choosing.</p></div>' +
        '<div class="s-grid" id="s-moments">' + momentBtns + '</div>' +
        '<div class="s-grid" id="s-loops">' + loopBtns + '</div>' +
        '<div class="s-now" id="s-now" aria-live="polite"></div>' +
        '<hr class="s-hr">' +
        '<h2>Your save</h2>' +
        '<p class="s-hint" id="s-save"></p>' +
        '<div class="s-grid"><button class="pbtn" id="s-export">Export save file</button></div>' +
        '<hr class="s-hr">' +
        '<div class="s-grid"><button class="pbtn light" id="s-back">Back</button></div>' +
      '</div></div></section>');
    root.appendChild(node);

    function paintSwitch(btn, on) {
      btn.setAttribute('aria-checked', on ? 'true' : 'false');
      btn.querySelector('.lbl').textContent = on ? 'ON' : 'OFF';
    }
    function paint() {
      var s = Save.get().settings;
      paintSwitch($('#sw-sfx', node), s.sfx); paintSwitch($('#sw-amb', node), s.ambience);
      var pct = Math.round(s.volume * 100);
      $('#vol', node).value = pct; $('#vol-pct', node).textContent = pct + '%';
      $('#s-support', node).textContent = Sound.supported() ? '' : 'This browser cannot play generated sound, so the game will stay quiet. Everything else works.';
      var sv = Save.get();
      $('#s-save', node).textContent = sv.cityName ? sv.cityName + ' · ' + sv.playerName + '. Export a copy now and then, because clearing browser data erases the save.' : 'No city yet. Finish the welcome first, then you can export a save file here.';
      $('#s-export', node).disabled = !sv.cityName;
      $('#s-export', node).style.opacity = sv.cityName ? 1 : 0.5;
    }
    node.__paint = paint;

    $('#sw-sfx', node).addEventListener('click', function () {
      var on = Save.get().settings.sfx !== true;
      Save.update({ settings: { sfx: on } }); applySoundSettings(); paint();
      if (on) Sound.play('tap');
    });
    $('#sw-amb', node).addEventListener('click', function () {
      var on = Save.get().settings.ambience !== true;
      Save.update({ settings: { ambience: on } }); applySoundSettings(); paint();
      if (!on) { Sound.stopAmbience(); setLoopButtons(null); }
    });
    $('#vol', node).addEventListener('input', function (e) {
      var v = Number(e.target.value) / 100;
      Save.update({ settings: { volume: v } }); applySoundSettings();
      $('#vol-pct', node).textContent = e.target.value + '%';
    });
    $('#vol', node).addEventListener('change', function () { Sound.play('tap'); });
    var now = $('#s-now', node);
    $('#s-moments', node).addEventListener('click', function (e) {
      var b = e.target.closest('button[data-m]'); if (!b) return;
      var m = Sound.moments[b.getAttribute('data-m')];
      if (!Sound.preview(b.getAttribute('data-m'))) now.textContent = 'Sound could not start in this browser.';
      else now.textContent = m.label + ' · ' + m.when;
    });
    function setLoopButtons(key) {
      var bs = node.querySelectorAll('button[data-l]');
      for (var i = 0; i < bs.length; i++) bs[i].setAttribute('aria-pressed', bs[i].getAttribute('data-l') === key ? 'true' : 'false');
      for (var j = 0; j < bs.length; j++) bs[j].style.background = bs[j].getAttribute('aria-pressed') === 'true' ? 'var(--leaf)' : '';
    }
    $('#s-loops', node).addEventListener('click', function (e) {
      var b = e.target.closest('button[data-l]'); if (!b) return;
      var k = b.getAttribute('data-l');
      if (Sound.currentLoop() === k) { Sound.stopAmbience(); setLoopButtons(null); now.textContent = 'Ambience stopped'; return; }
      if (Sound.previewAmbience(k)) { setLoopButtons(k); now.textContent = Sound.loops[k].label + ' (looping) · ' + Sound.loops[k].desc; }
      else now.textContent = 'Sound could not start in this browser.';
    });
    $('#s-export', node).addEventListener('click', function () { Save.download(); Sound.play('collect'); now.textContent = 'Save file downloaded.'; });
    $('#s-back', node).addEventListener('click', function () {
      Sound.stopAmbience(); setLoopButtons(null); now.textContent = '';
      show(previous);
    });
  }

  function init() {
    root = document.getElementById('app');
    Save.load();
    applySoundSettings();
    Sound.onCue(toast);
    buildWelcome(); buildHome(); buildSettings();
    Passport.build(root, { el: el, show: show, sound: function (n) { Sound.play(n); }, refreshHome: refreshHome,
      startAmbience: function () { Sound.startAmbience('garden'); }, stopAmbience: function () { Sound.stopAmbience(); },
      isSfx: function () { return Save.get().settings.sfx === true; },
      toggleSfx: function () { var on = Save.get().settings.sfx !== true; Save.update({ settings: { sfx: on } }); applySoundSettings(); return on; } });
    document.addEventListener('click', function (e) {
      var b = e.target.closest('.pbtn, .plink, .stepb');
      if (b && !b.id.match(/^(w-s0|w-s1|sw-sfx)$/) && !b.closest('#s-moments')) Sound.play('tap');
    }, true);
    Clock.onTick(function (left) { var c = root.querySelector('#h-count'); if (c) c.textContent = 'NEW DAY IN ' + Clock.formatCountdown(left); });
    Clock.onNewDay(function () { refreshHome(); toast('A new day has started', true); var h = root.querySelector('#screen-home'); if (h && h.classList.contains('active')) checkinCard(); });
    Clock.start();
    refreshHome();
    show(Save.hasCity() ? 'home' : 'welcome');
  }

  return { init: init, refreshHome: refreshHome, show: function (n) { show(n); } };
})();
