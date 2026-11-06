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

  /* ---------------- Welcome ---------------- */
  var SKIES = [
    ['#3B4A8C', '#6A5CA0', '#A56FAA', '#E58BA0', '#F7AE8A', '#FFD08A', '#FFE7B0'],
    ['#4F9BE3', '#6FB3EA', '#8EC6EE', '#B0D8EE', '#D3E6E2', '#F1EDCF', '#FFF2CF'],
    ['#0A1330', '#0F1D45', '#17295A', '#213A70', '#2C4A82', '#36588F', '#40669A']
  ];
  function grad(st) {
    var parts = [st[0] + ' 0%', st[0] + ' 10%'];
    for (var i = 1; i < 7; i++) parts.push(st[i] + ' ' + (10 + i * 11.7).toFixed(1) + '%');
    parts.push(st[6] + ' 100%');
    return 'linear-gradient(to bottom, ' + parts.join(', ') + ')';
  }
  var CITIES = ['Sunleaf Quarter', 'Mossbridge', 'Bamboo Landing', 'Kite Hill', 'Dawnfield', 'Snail Harbour'];
  var EGGS = [
    { id: 'sun', sprite: 'sun', pos: 'right:40px;top:40px', label: 'A floating sun', note: 'Good morning! The real sun is about 150 million km away. Your city only needs a little of it.' },
    { id: 'moon', sprite: 'moon', pos: 'right:116px;top:40px', label: 'A floating moon', note: 'Shhh. The city is asleep and the solar panels are dreaming of tomorrow. Poke again for morning.' },
    { id: 'mushroom', sprite: 'mushroom', pos: 'right:34%;bottom:12%', label: 'A floating violet mushroom', note: 'Violet mushrooms are rare. One shows up only when a hero is ready to level up. No pressure, mushroom.' },
    { id: 'mimosa', sprite: 'mimosa', pos: 'left:calc(50% - 40px);bottom:40px', label: 'A floating pink flower', note: 'Mimosa gives you one extra hint for a day. The real plant folds its leaves when touched, so be gentle.' },
    { id: 'flame', sprite: 'flame', pos: 'right:30%;top:46%', label: 'A floating flame', note: 'Streak tip: missing one day is fine. A freeze catches you, like a very small trampoline.' }
  ];

  function buildWelcome() {
    var node = el(
      '<section class="screen" id="screen-welcome" aria-label="Welcome"><div class="w-stage">' +
        '<div class="sky" data-sky="0"></div><div class="sky" data-sky="1"></div><div class="sky" data-sky="2"></div>' +
        '<div class="sign" id="w-sign"><div class="board" id="w-sign-text"></div><div class="legs"><span></span><span></span></div></div>' +
        '<div id="w-eggs"></div>' +
        '<div class="pxp secrets"><div class="hd"><span>PSST, SECRETS</span><span id="w-count">0 / 5</span></div><span class="note" id="w-note" aria-live="polite">Five little secrets are hiding on this page. Poke the floating things.</span></div>' +
        '<div class="w-wrap"><div class="pxp w-card">' +
          '<div role="group" aria-label="Progress" style="display:flex;gap:12px">' +
            '<button class="stepb" id="w-s0" aria-label="Hello">1</button><button class="stepb" id="w-s1" aria-label="Name your city">2</button></div>' +
          '<div class="col" id="w-step0">' +
            '<div class="brand">' + Art.sprite('brain') + '<h1 data-focus tabindex="-1">QuinnDom</h1></div>' +
            '<p class="hello">The world is a lot. Here’s a tiny island.</p>' +
            '<p class="body">Solve a puzzle. Build something lovely. Leave whenever you like. Your city will still be here, quietly photosynthesizing. No account, no ads, no streak-shaming.</p>' +
            '<div class="row"><button class="pbtn" id="w-go">Let’s go</button><button class="plink" id="w-import">I already have a save file</button></div>' +
            '<p class="err" id="w-err" role="alert"></p>' +
            '<div class="row" style="padding:0"><button class="plink" id="w-settings">Sound &amp; settings</button></div>' +
            '<p class="psst">(psst: the floating things around the page are poke-able)</p>' +
          '</div>' +
          '<div class="col tight" id="w-step1" hidden>' +
            '<h2 tabindex="-1" id="w-h2">Two small questions</h2>' +
            '<div class="field"><label for="pname">What should citizens call you?</label><input id="pname" class="pin" type="text" maxlength="40" autocomplete="nickname" placeholder="Your name or a nickname"></div>' +
            '<div class="field"><label for="cname">And your first city?</label><div class="row nowrap"><input id="cname" class="pin" type="text" maxlength="40" value="Sunleaf Quarter"><button class="pbtn light" id="w-shuffle" style="flex:0 0 auto">Surprise me</button></div></div>' +
            '<p class="err" id="w-err2" role="alert"></p>' +
            '<p class="small">Three citizens are already waiting at the camp. They brought snacks. Your city lives in this browser like a snail in its shell, so export a save file now and then.</p>' +
            '<div class="row"><button class="pbtn" id="w-plant">Plant the first tower</button><button class="plink" id="w-back">Back</button></div>' +
          '</div>' +
        '</div></div>' +
        '<input type="file" id="w-file" accept=".json,application/json" hidden>' +
      '</div></section>');
    root.appendChild(node);

    var state = { step: 0, night: false, found: [], cityIdx: 0 };
    var skies = node.querySelectorAll('.sky');
    skies[0].style.background = grad(SKIES[0]); skies[0].innerHTML = Art.island('dawn');
    skies[1].style.background = grad(SKIES[1]); skies[1].innerHTML = Art.island('day');
    skies[2].style.background = grad(SKIES[2]); skies[2].innerHTML = Art.island('night');

    function paint() {
      var layer = state.night ? 2 : state.step;
      for (var i = 0; i < 3; i++) skies[i].classList.toggle('on', i === layer);
      $('#w-step0', node).hidden = state.step !== 0;
      $('#w-step1', node).hidden = state.step !== 1;
      $('#w-sign', node).classList.toggle('on', state.step === 1);
      var s0 = $('#w-s0', node), s1 = $('#w-s1', node);
      s0.style.background = state.step > 0 ? 'var(--canopy)' : 'var(--sun)';
      s1.style.background = state.step === 1 ? 'var(--sun)' : 'var(--parchment)';
      s0.setAttribute('aria-current', state.step === 0 ? 'step' : 'false');
      s1.setAttribute('aria-current', state.step === 1 ? 'step' : 'false');
      s0.style.color = state.step > 0 ? 'var(--mist)' : 'var(--ink)';
    }
    function setStep(n) {
      state.step = n; paint();
      var f = n === 0 ? $('#w-step0 h1', node) : $('#pname', node);
      if (f) f.focus({ preventScroll: true });
    }
    function syncSign() { $('#w-sign-text', node).textContent = $('#cname', node).value || 'Your city'; }

    // secrets
    var eggBox = $('#w-eggs', node);
    EGGS.forEach(function (e) {
      var b = document.createElement('button');
      b.className = 'egg'; b.style.cssText = e.pos; b.setAttribute('aria-label', e.label);
      b.innerHTML = Art.sprite(e.sprite);
      b.addEventListener('click', function () {
        var isNew = state.found.indexOf(e.id) < 0;
        if (isNew) state.found.push(e.id);
        b.classList.add('found'); b.setAttribute('aria-label', e.label + ', found');
        state.night = e.id === 'moon' ? !state.night : false;
        $('#w-note', node).textContent = (isNew && state.found.length === 5) ? 'All 5 found. You are officially a snoop of the highest rank. Welcome to QuinnDom!' : e.note;
        $('#w-count', node).textContent = state.found.length + ' / 5';
        paint();
        if (isNew) { if (state.found.length === 5) Sound.play('milestone'); else Sound.play('collect'); }
      });
      eggBox.appendChild(b);
    });

    $('#w-go', node).addEventListener('click', function () { setStep(1); });
    $('#w-s0', node).addEventListener('click', function () { Sound.play('tap'); setStep(0); });
    $('#w-s1', node).addEventListener('click', function () { Sound.play('tap'); setStep(1); });
    $('#w-back', node).addEventListener('click', function () { setStep(0); });
    $('#w-settings', node).addEventListener('click', function () { show('settings'); });
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
    $('#pname', node).addEventListener('input', function () { $('#w-err2', node).textContent = ''; });

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
    paintToday();
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
