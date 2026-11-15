/* City screen (Release 3, step 1): the floating island on an isometric grid, where you place buildings and roads.
   Layout follows the City view v2 board: top bar, side panel, island with a build tray along the bottom.
   Drawing is in js/cityart.js, the rules are in js/city.js, the saved city lives in Save (field "city").
   Controls: mouse click or tap to place; drag across free tiles to lay a road; arrow keys move a cursor, Enter places, Esc cancels;
   wheel or +/- to zoom; right-button drag (or drag in Select mode) to pan. */
var CityView = (function () {
  var T = CityArt.T;
  var RES = ['food', 'wood', 'stone', 'metal'];
  var NAMES = { food: 'Food', wood: 'Wood', stone: 'Stone', metal: 'Metal' };

  var node, cv, ctx2d, stage, tray, host;
  var S = { look: 'day', tool: 'build', building: null, selected: null, hover: null, cursor: null, pending: null, zoomDelta: 0, cam: { x: 0, y: 0 }, flash: null };
  var W = 0, H = 0, zoom = 3, fit = 3, O = { x: 0, y: 0 }, reserve = 140;
  var raf = 0, ambTimer = null, active = false, drag = null, t0 = Date.now(), lastCursorKey = '';
  var folk = null, folkSig = '', lastFrame = 0, lastTick = 0, looping = false;           // the walking villagers
  var reduced = false, trans = null;                                 // trans: the cloud-opening transition that plays when you step into the town
  try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  function q(sel) { return node.querySelector(sel); }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function fmt(n) { return Number(n).toLocaleString('en-US'); }
  function city() { return Save.get().city; }
  function bname(id) { var b = Buildings.get(id); return b ? b.name : id; }

  /* ---------------- small pieces of markup ---------------- */
  function costHtml(type, resources) {
    var b = Buildings.get(type), out = '';
    Object.keys(b.cost).forEach(function (k) {
      var lack = (resources[k] || 0) < b.cost[k];
      out += '<span class="cost' + (lack ? ' lack' : '') + '" title="' + NAMES[k] + (lack ? ': you have ' + (resources[k] || 0) : '') + '">' + Art.res(k) + b.cost[k] + '</span>';
    });
    return out;
  }
  function sizeText(b) { return b.w + 'x' + b.d; }

  /* ---------------- top bar, name card, tray ---------------- */
  function paintBar() {
    var s = Save.get(), html = '';
    RES.forEach(function (k) { html += '<span class="c-chip" title="' + NAMES[k] + '">' + Art.res(k) + '<b>' + fmt(s.resources[k] || 0) + '</b></span>'; });
    html += '<span class="c-chip" title="Coins (earned on the Journey)">' + Art.res('coin') + '<b>' + fmt(s.resources.coins || 0) + '</b></span>';
    q('#c-res').innerHTML = html;
    q('#c-credit').innerHTML = Art.res('credit') + '<b>' + fmt(City.creditScore(s.city)) + '</b>';
    var v = Daily.view();
    q('#c-streak').innerHTML = Art.res('flame') + '<b>' + v.streak + '</b>';
    q('#c-streak').title = 'Streak: ' + v.streak + (v.streak === 1 ? ' day' : ' days');
    q('#c-day').textContent = 'DAY ' + Clock.dayNumber(s.createdAt);
    q('#c-sandbox').hidden = !Save.isSandbox();
  }
  function paintName() {
    var s = Save.get(), st = City.stats(s.city);
    q('#c-cname').textContent = s.cityName;
    q('#c-cstat').textContent = st.buildings + (st.buildings === 1 ? ' building' : ' buildings') + ' · ' + st.roads + (st.roads === 1 ? ' road tile' : ' road tiles');
  }
  function paintTiles() {
    var res = Save.get().resources;
    q('#c-tiles').innerHTML = Buildings.LIST.map(function (b) {
      return '<button class="c-tile' + (S.building === b.id ? ' on' : '') + '" data-id="' + b.id + '" aria-pressed="' + (S.building === b.id ? 'true' : 'false') + '" title="' + b.effect + '">' +
        '<span class="tn"><span>' + b.name + '</span><span class="sz">' + sizeText(b) + '</span></span><span class="cs">' + costHtml(b.id, res) + '</span></button>';
    }).join('');
  }
  function paintTools() {
    var tb = node.querySelectorAll('.c-tool');
    for (var i = 0; i < tb.length; i++) { var on = tb[i].getAttribute('data-tool') === S.tool; tb[i].classList.toggle('on', on); tb[i].setAttribute('aria-pressed', on ? 'true' : 'false'); }
    q('#c-tiles').hidden = S.tool !== 'build';
    q('#c-all').hidden = S.tool !== 'build';
    q('#c-hint-select').hidden = S.tool === 'build';
    cv.style.cursor = S.tool === 'build' && S.building ? 'cell' : 'grab';
  }
  /* the line under the tray: what to do now, or what just happened; touch players get a Place / Cancel pair */
  function setStatus(text, kind, extra) {
    var el = q('#c-status');
    el.className = 'c-status' + (kind ? ' ' + kind : '');
    el.innerHTML = '';
    var sp = document.createElement('span'); sp.textContent = text; el.appendChild(sp);
    if (extra === 'confirm') {
      var ok = document.createElement('button'); ok.className = 'pbtn'; ok.id = 'c-place'; ok.textContent = 'Place here';
      var no = document.createElement('button'); no.className = 'pbtn light'; no.id = 'c-cancel'; no.textContent = 'Cancel';
      el.appendChild(ok); el.appendChild(no);
    }
  }
  function defaultStatus() {
    if (S.pending) { setStatus('Place ' + bname(S.building) + ' here?', '', 'confirm'); return; }
    var empty = false;
    if (S.tool === 'build') {
      if (S.building) setStatus((Buildings.get(S.building).road ? 'Click a free tile, or drag, to lay road.' : 'Click a free tile to place ' + bname(S.building) + '.') + ' Esc to stop.');
      else setStatus(empty ? 'Your island is empty. Pick a building below, then click the grass.' : 'Pick a building below, then click a free tile.');
    } else setStatus(empty ? 'Nothing built yet. Switch to Build to start.' : 'Click a building to see what it does.');
  }
  function paintInfo() {
    var box = q('#c-info'), b = S.selected !== null ? city().buildings[S.selected] : null;
    if (!b || S.tool !== 'select') { box.hidden = true; return; }
    var t = Buildings.get(b.type);
    box.hidden = false;
    box.innerHTML = '<span class="tag">' + groupName(t.group) + ' · ' + sizeText(t) + '</span><b>' + t.name + '</b><p>' + t.effect + '</p>' +
      (t.civic ? '<small>Part of your starting town. It stays here.</small>' + (b.type === 'market' ? '<button class="pbtn" id="c-info-store">Open the store</button>' : '') : '<div class="irow"><span>Level ' + b.level + '</span><span>' + Art.res('credit') + Buildings.value(b.type, b.level) + ' Credit</span></div><small>Upgrades with Metal come in a later step.</small>') + '<button class="pbtn light" id="c-info-x">Close</button>';
  }
  /* ---------------- the store (tap the Market) ---------------- */
  function openStore(msg) {
    var old = node.querySelector('.c-modal.store'); if (old) old.remove();
    var s = Save.get(), res = s.resources, day = Clock.dayKey(), left = Store.left(s.store, day), stock = Store.stock(day);
    function chip(k, n) { return '<span class="cost">' + Art.res(k) + n + '</span>'; }
    var html = '<div class="st-bal" aria-label="You have">' + ['coins', 'mimosa', 'psilocybe', 'wood', 'stone', 'metal'].map(function (k) { return '<span class="c-chip" title="' + k + '">' + Art.res(k === 'coins' ? 'coin' : k) + '<b>' + fmt(res[k] || 0) + '</b></span>'; }).join('') + '</div>';
    if (msg) html += '<p class="st-msg ' + msg.kind + '" role="status">' + msg.text + '</p>';
    html += '<h3>Today\u2019s stock</h3><p class="st-note">Coins come from the Journey road. The stock is the same for everyone and changes at midnight, Vietnam time.</p>';
    [['mimosa', 'Mimosa', 'One-day hero boost: an extra hint in every puzzle.'], ['psilocybe', 'Psilocybe', 'Needed to pass hero level milestones.']].forEach(function (it) {
      var k = it[0], n = left[k], can = n > 0 && (res.coins || 0) >= Store.PRICES[k];
      html += '<div class="st-row"><span class="st-ic">' + Art.res(k) + '</span><span class="st-nm"><b>' + it[1] + '</b><small>' + it[2] + '</small></span><span class="st-left">' + n + ' of ' + stock[k] + ' left</span>' +
        '<button class="pbtn" data-buy="' + k + '"' + (can ? '' : ' disabled') + '>' + Art.res('coin') + Store.PRICES[k] + '</button></div>';
    });
    html += '<h3>Trade</h3><p class="st-note">Fixed prices. Nothing here sells for coins.</p>';
    Store.TRADES.forEach(function (t) {
      var can = (res[t.give] || 0) >= t.rate;
      html += '<div class="st-row"><span class="st-nm"><b>' + t.name + '</b><small>' + t.rate + ' ' + NAMES[t.give] + ' = 1 ' + NAMES[t.get] + '</small></span><span class="st-left">' + Art.res(t.give) + t.rate + ' \u2192 ' + Art.res(t.get) + '1</span>' +
        '<button class="pbtn light" data-trade="' + t.id + '" data-n="1"' + (can ? '' : ' disabled') + '>Trade 1</button>' +
        (t.rate === 1 ? '<button class="pbtn light" data-trade="' + t.id + '" data-n="10"' + ((res[t.give] || 0) >= 10 ? '' : ' disabled') + '>Trade 10</button>' : '') + '</div>';
    });
    var m = host.el('<div class="c-modal store" role="dialog" aria-modal="true" aria-labelledby="c-s-h"><div class="pxp c-mcard"><div class="mh"><h2 id="c-s-h" tabindex="-1" data-mfocus>Market store</h2><button class="pbtn light" id="c-s-x">Close</button></div><div class="mb">' + html + '</div></div></div>');
    node.appendChild(m);
    function close() { m.remove(); cv.focus({ preventScroll: true }); }
    m.addEventListener('click', function (e) {
      if (e.target === m || e.target.id === 's-x' || e.target.id === 'c-s-x') { close(); return; }
      var b = e.target.closest('[data-buy]'), t = e.target.closest('[data-trade]'), r, cur = Save.get();
      if (b) {
        r = Store.buy(cur.resources, cur.store, b.getAttribute('data-buy'), Clock.dayKey());
        if (r.ok) { Save.update({ resources: r.resources, store: r.store }); host.sound('collect'); paintBar(); openStore({ kind: 'ok', text: 'Bought 1 ' + b.getAttribute('data-buy') + '.' }); }
        else openStore({ kind: 'bad', text: r.error });
      } else if (t) {
        r = Store.trade(cur.resources, t.getAttribute('data-trade'), t.getAttribute('data-n'));
        if (r.ok) { Save.update({ resources: r.resources }); host.sound('collect'); paintBar(); paintTiles(); openStore({ kind: 'ok', text: 'Traded.' }); }
        else openStore({ kind: 'bad', text: r.error });
      }
    });
    m.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    var f = m.querySelector('[data-mfocus]'); if (f) f.focus();
  }
  function groupName(id) { for (var i = 0; i < Buildings.GROUPS.length; i++) if (Buildings.GROUPS[i].id === id) return Buildings.GROUPS[i].name; return id; }
  /* a plain list for screen readers (the canvas itself cannot be read) */
  function paintList() {
    var items = city().buildings.map(function (b) { return '<li>' + bname(b.type) + ' at column ' + (b.x + 1) + ', row ' + (b.y + 1) + '</li>'; });
    q('#c-list').innerHTML = items.length ? items.join('') : '<li>No buildings yet</li>';
  }
  function refreshAll() { paintBar(); paintName(); paintTiles(); paintTools(); paintInfo(); paintList(); defaultStatus(); }

  /* ---------------- layout, camera and picking ---------------- */
  function layout() {
    W = stage.clientWidth; H = stage.clientHeight;
    if (!W || !H) return false;
    reserve = tray.offsetHeight + 18;
    stage.style.setProperty('--tray-h', tray.offsetHeight + 'px');
    // whole-number zoom keeps pixels square. The earth below the island and the unbuildable south corner may hide behind the tray.
    fit = clamp(Math.floor(W / 290), 2, 4);                         // a cosy close-up: about 12 tiles across on a laptop
    S.zoomDelta = clamp(S.zoomDelta, 0.5 - fit, 2);                 // the smallest step, 0.5, is the whole-island overview
    zoom = fit + S.zoomDelta;
    var lw = Math.ceil(W / zoom), lh = Math.ceil(H / zoom);
    if (cv.width !== lw || cv.height !== lh) { cv.width = lw; cv.height = lh; }
    cv.style.width = (lw * zoom) + 'px'; cv.style.height = (lh * zoom) + 'px';
    ctx2d = cv.getContext('2d'); ctx2d.imageSmoothingEnabled = false;
    setOrigin();
    return true;
  }
  function setOrigin() {
    // cam is how far the island is shifted from having the village square in the middle of the view
    S.cam.x = clamp(S.cam.x, -CityArt.MW / 2, CityArt.MW / 2); S.cam.y = clamp(S.cam.y, -CityArt.MH / 2, CityArt.MH / 2);
    O.x = Math.round(cv.width / 2 - (Terrain.CENTRE.x + 0.5) * T + S.cam.x);
    O.y = Math.round(((H - reserve) / zoom) / 2 - (Terrain.CENTRE.y + 0.5) * T + S.cam.y);
  }
  function toLogical(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom }; }
  /* the tile under a point on screen, allowing for hills: try the highest ground first */
  function tileAt(p) {
    var dx = p.x - O.x, dy = p.y - O.y, h, x, y;
    for (h = 4; h >= 1; h--) {
      x = Math.floor(dx / T); y = Math.floor((dy + CityArt.zOf(h)) / T);
      if (CityArt.vh(x, y) === h) return { x: x, y: y };
    }
    return { x: Math.floor(dx / T), y: Math.floor((dy + CityArt.zOf(2)) / T) };
  }
  function zAt(x, y) { var h = CityArt.vh(x, y); return CityArt.zOf(h || 2); }
  /* the building under a tile, allowing for tall buildings that cover tiles behind them */
  function pickBuilding(t) {
    var c = city(), o = City.occupancy(c);
    for (var k = 0; k <= 3; k++) {
      var b = City.at(c, t.x, t.y + k, o);
      if (b) { var bt = Buildings.get(b.type); if (k === 0 || bt.h > k * 16) return b; }
    }
    return null;
  }
  /* where a building lands when the pointer is on tile t: the pointer sits on its front tile */
  function anchor(t) {
    var b = S.building ? Buildings.get(S.building) : null;
    return b ? { x: t.x - (b.w - 1), y: t.y - (b.d - 1) } : t;
  }

  /* ---------------- villagers: they stroll along the connected paths and roads, pausing now and then ---------------- */
  var DIRS = [[1, 0, 'r'], [-1, 0, 'l'], [0, 1, 'd'], [0, -1, 'u']];
  function isPath(x, y, roads) { var t = Terrain.type(x, y); return t === 'p' || t === 'b' || roads[x + ',' + y]; }
  function folkUpdate(c, dt) {
    var roads = {}, sig = c.buildings.length + ':' + c.buildings.filter(function (b) { return b.type === 'road'; }).length, i;
    c.buildings.forEach(function (b) { if (b.type === 'road') roads[b.x + ',' + b.y] = 1; });
    if (!folk) {                                                            // first time: stand them on spread-out path tiles
      var tiles = Terrain.list().filter(function (t) { return t.t === 'p' || t.t === 'b'; });
      folk = [];
      for (i = 0; i < 8; i++) { var tl = tiles[(i * 53 + 7) % tiles.length]; folk.push({ o: i % 4, x: tl.x, y: tl.y, nx: tl.x, ny: tl.y, u: 1, d: 'd', lane: ((i * 5) % 7) - 3, wait: (i % 3) * 0.7, ph: i * 0.37, pdx: 0, pdy: 0 }); }
    }
    folkSig = sig;
    folk.forEach(function (f) {
      if (f.wait > 0) { f.wait -= dt; return; }
      if (f.u >= 1) {                                                       // arrived: choose the next tile (keep going straight when we can)
        f.x = f.nx; f.y = f.ny;
        var opts = DIRS.filter(function (d) { return isPath(f.x + d[0], f.y + d[1], roads); }), fwd = opts.filter(function (d) { return d[0] === f.pdx && d[1] === f.pdy; }), nb = opts.filter(function (d) { return !(d[0] === -f.pdx && d[1] === -f.pdy); }), pick;
        if (!opts.length) { f.wait = 2; return; }
        pick = fwd.length && Math.random() < 0.65 ? fwd[0] : (nb.length ? nb[Math.floor(Math.random() * nb.length)] : opts[0]);
        f.pdx = pick[0]; f.pdy = pick[1]; f.nx = f.x + pick[0]; f.ny = f.y + pick[1]; f.d = pick[2]; f.u = 0;
        if (Math.random() < 0.12) f.wait = 1 + Math.random() * 2.5;
      }
      f.u = Math.min(1, f.u + dt * 0.85); f.ph += dt * 5;
    });
  }
  function folkItems(list) {
    if (!folk) return;
    folk.forEach(function (f) {
      var u = f.u, px = (f.x + (f.nx - f.x) * u) * T + T / 2, py = (f.y + (f.ny - f.y) * u) * T + T / 2 + 5, h0 = Terrain.h(f.x, f.y) || 2, h1 = Terrain.h(f.nx, f.ny) || h0, z = CityArt.zOf(h0) + (CityArt.zOf(h1) - CityArt.zOf(h0)) * u;
      if (f.d === 'u' || f.d === 'd') px += f.lane; else py += f.lane / 2;
      list.push({ kind: 'cit' + f.o + f.d + ((f.wait > 0 || f.u >= 1) ? 0 : (Math.floor(f.ph) % 2)), px: px, py: py, key: py, i: -1, z: z });
    });
  }

  /* ---------------- drawing ---------------- */
  function requestRender() { if (!raf && active) raf = requestAnimationFrame(render); }
  function loop() { if (active && !reduced && !document.hidden) { var n = Date.now(); if (n - lastFrame >= 33) { lastFrame = n; requestRender(); } } if (active) setTimeout(loop, 33); else looping = false; }
  function render() {
    raf = 0;
    if (!active || !ctx2d) return;
    var look = CityArt.LOOKS[S.look], c = city(), occ = City.occupancy(c), lw = cv.width, lh = cv.height;
    var now = (Date.now() - t0) / 1000, ox = O.x, oy = O.y;
    folkUpdate(c, reduced || !lastTick ? 0 : Math.min(0.1, now - lastTick)); lastTick = now;
    ctx2d.clearRect(0, 0, lw, lh);
    CityArt.drawSky(ctx2d, lw, lh, look, reduced ? 0 : now);
    CityArt.drawWorldClouds(ctx2d, ox, oy, look, reduced ? 0 : now, false);
    var isl = CityArt.island(look);
    ctx2d.drawImage(isl.canvas, ox - isl.ox, oy - isl.oy);
    CityArt.drawWater(ctx2d, ox, oy, look, reduced ? 0 : now);
    function gp(z) {                                                        // a tiny painter for cursors: rectangles on a tile lifted by z
      return { flat: function (x, y, w, d, zz, col) { ctx2d.fillStyle = col; ctx2d.fillRect(Math.round(ox + x * T), Math.round(oy + y * T - z), Math.round(w * T), Math.round(d * T)); },
        outline: function (x, y, w, d, zz, col) { CityArt.frame(ctx2d, Math.round(ox + x * T), Math.round(oy + y * T - z), Math.round(w * T), Math.round(d * T), col); } };
    }
    var g = gp(0);
    var placing = S.tool === 'build' && S.building;
    if (placing) drawGrid(g, c);

    var list = [];
    c.buildings.forEach(function (b, i) {
      if (b.type === 'road') CityArt.drawItem(ctx2d, 'road' + City.roadMask(c, b.x, b.y, occ), look, ox + b.x * T, oy + b.y * T, zAt(b.x, b.y));
      else { var t = Buildings.get(b.type); list.push({ kind: b.type, x: b.x, y: b.y, key: (b.y + t.d) * T, i: i }); }
    });
    folkItems(list);
    CityArt.SCENERY.forEach(function (s) { list.push({ kind: s.kind, px: s.px, py: s.py, key: s.py, i: -1, z: s.z }); });
    list.sort(function (a, b) { return a.key - b.key || (a.x === undefined ? a.px / T : a.x) - (b.x === undefined ? b.px / T : b.x); });
    list.forEach(function (it) { if (it.px !== undefined) CityArt.drawItem(ctx2d, it.kind, look, ox + it.px, oy + it.py, it.z); else CityArt.drawItem(ctx2d, it.kind, look, ox + it.x * T, oy + it.y * T, zAt(it.x, it.y)); });
    CityArt.drawWorldClouds(ctx2d, ox, oy, look, reduced ? 0 : now, true);
    if (trans) {                                                            // cloud doors: closed for a beat, then slide apart (a plain fade if motion is reduced)
      var tp = (Date.now() - trans) / (reduced ? 500 : 1500);
      if (tp >= 1) trans = null;
      else if (reduced) { ctx2d.globalAlpha = 1 - tp; ctx2d.fillStyle = look.stars ? '#4C6694' : '#FFFFFF'; ctx2d.fillRect(0, 0, lw, lh); ctx2d.globalAlpha = 1; }
      else { var e = clamp((tp - 0.15) / 0.85, 0, 1); e = e < 0.5 ? 4 * e * e * e : 1 - Math.pow(-2 * e + 2, 3) / 2; CityArt.drawCloudDoors(ctx2d, lw, lh, look, e); }
      if (trans) raf = requestAnimationFrame(render);
    }

    // the ghost of what is about to be placed
    var tgt = S.pending || (S.hover ? anchor(S.hover) : null);
    if (placing && tgt) {
      var bt = Buildings.get(S.building), ok = City.canPlace(c, S.building, tgt.x, tgt.y, occ).ok && !City.missing(Save.get().resources, S.building);
      var gz = gp(zAt(tgt.x, tgt.y));
      ctx2d.globalAlpha = 0.4;
      gz.flat(tgt.x, tgt.y, bt.w, bt.d, 0, ok ? '#FFFFFF' : '#D9342B');
      ctx2d.globalAlpha = 1;
      if (ok) {
        ctx2d.globalAlpha = 0.72;
        CityArt.drawItem(ctx2d, bt.road ? 'road' + City.roadMask(c, tgt.x, tgt.y, occ) : S.building, look, ox + tgt.x * T, oy + tgt.y * T, zAt(tgt.x, tgt.y));
        ctx2d.globalAlpha = 1;
      }
      gz.outline(tgt.x, tgt.y, bt.w, bt.d, 0, ok ? '#FFFFFF' : '#FF6B5E', true);
    }
    function lift(x, y) { return gp(zAt(x, y)); }
    // hover and selection in Select mode
    if (!placing) {
      if (S.hover) { var hb = pickBuilding(S.hover); if (hb) { var ht = Buildings.get(hb.type); lift(hb.x, hb.y).outline(hb.x, hb.y, ht.w, ht.d, 0, '#FFF3C4', true); } else lift(S.hover.x, S.hover.y).outline(S.hover.x, S.hover.y, 1, 1, 0, '#FFF3C4', true); }
      if (S.selected !== null && c.buildings[S.selected]) { var sb = c.buildings[S.selected], st = Buildings.get(sb.type); var gl = lift(sb.x, sb.y); gl.outline(sb.x, sb.y, st.w, st.d, 0, '#F7C948', true); gl.outline(sb.x - 0.04, sb.y - 0.04, st.w + 0.08, st.d + 0.08, 0, '#F7C948', true); }
    }
    // a short flash where something was just placed
    if (S.flash) {
      var left = S.flash.until - Date.now();
      if (left > 0) { ctx2d.globalAlpha = Math.min(1, left / 400); var gf = lift(S.flash.x, S.flash.y); gf.outline(S.flash.x, S.flash.y, S.flash.w, S.flash.d, 0, '#F7C948', true); gf.outline(S.flash.x - 0.06, S.flash.y - 0.06, S.flash.w + 0.12, S.flash.d + 0.12, 0, '#FFFFFF', true); ctx2d.globalAlpha = 1; requestRender(); }
      else S.flash = null;
    }
  }
  /* faint lines round every tile you can build on, while building */
  function drawGrid(g, c) {
    var look = CityArt.LOOKS[S.look];
    ctx2d.globalAlpha = 0.3;
    Terrain.list().forEach(function (t) {
      if (t.t !== 'g') return;
      CityArt.frame(ctx2d, O.x + t.x * T, O.y + t.y * T - CityArt.zOf(t.h), T, T, '#FFFFFF');
    });
    ctx2d.globalAlpha = 1;
  }

  /* ---------------- placing ---------------- */
  function missingText(miss) {
    var parts = Object.keys(miss).map(function (k) { return miss[k] + ' more ' + NAMES[k]; });
    return 'Not enough resources: you need ' + parts.join(' and ') + '.';
  }
  /* returns true when something was built */
  function tryPlace(type, x, y, quiet) {
    var sv = Save.get(), r = City.place(sv.city, sv.resources, type, x, y);
    if (!r.ok) {
      if (quiet && r.reason !== 'cost') return false;
      if (r.reason === 'cost') setStatus(missingText(r.missing), 'bad');
      else if (r.reason === 'taken') setStatus('That spot is taken.', 'bad');
      else if (r.reason === 'uneven') setStatus('The ground is not flat enough there.', 'bad');
      else setStatus('You can only build on clear grass.', 'bad');
      if (!quiet || r.reason === 'cost') Sound.play('notquite');
      return r.reason === 'cost' ? 'stop' : false;
    }
    Save.update({ city: r.state, resources: r.resources });
    var t = Buildings.get(type);
    S.flash = { x: x, y: y, w: t.w, d: t.d, until: Date.now() + 500 };
    S.pending = null;
    paintBar(); paintName(); paintTiles(); paintList();
    setStatus('Placed ' + t.name + '. Credit score +' + Buildings.value(type, 1) + '.', 'good');
    if (!quiet) Sound.play('stamp');
    requestRender();
    return true;
  }
  function chooseBuilding(id) {
    S.building = S.building === id ? null : id;
    S.tool = 'build'; S.pending = null; S.selected = null;
    paintTiles(); paintTools(); paintInfo(); defaultStatus(); requestRender();
  }
  function setTool(tool) {
    S.tool = tool; S.pending = null;
    if (tool === 'select') S.building = null; else S.selected = null;
    paintTiles(); paintTools(); paintInfo(); defaultStatus(); requestRender();
  }
  function selectAt(t) {
    var b = City.inside(t.x, t.y) ? pickBuilding(t) : null;
    S.selected = b ? city().buildings.indexOf(b) : null;
    if (S.tool !== 'select' && b) { S.tool = 'select'; S.building = null; paintTiles(); paintTools(); }
    paintInfo(); defaultStatus();
    if (b) { Sound.play('tap'); announce(bname(b.type) + ', column ' + (b.x + 1) + ', row ' + (b.y + 1)); }
    requestRender();
  }
  function cancel() {
    if (S.pending) { S.pending = null; defaultStatus(); }
    else if (S.building) { S.building = null; paintTiles(); paintTools(); defaultStatus(); }
    else if (S.selected !== null) { S.selected = null; paintInfo(); }
    requestRender();
  }
  function announce(text) { var el = q('#c-sr'); if (el) el.textContent = text; }
  function describe(t) {
    if (!Terrain.at(t.x, t.y)) return 'Off the island';
    var b = City.at(city(), t.x, t.y);
    return 'Column ' + (t.x + 1) + ', row ' + (t.y + 1) + ': ' + (b ? bname(b.type) : Terrain.buildable(t.x, t.y) ? 'free grass' : 'not buildable');
  }

  /* ---------------- zoom and look ---------------- */
  function doZoom(d) { var z = zoom + d; if (z < 1) z = 0.5; if (zoom === 0.5 && d > 0) z = 1; S.zoomDelta = z - fit; layout(); requestRender(); }
  function centre() { S.cam.x = 0; S.cam.y = 0; S.zoomDelta = 0; layout(); requestRender(); }
  function setLook(name) {
    S.look = name;
    stage.style.background = CityArt.skyCss(CityArt.LOOKS[name]);
    var b = q('#c-night'), night = name === 'night';
    b.setAttribute('aria-pressed', night ? 'true' : 'false');
    b.setAttribute('aria-label', night ? 'Switch to day mode' : 'Switch to night mode');
    b.innerHTML = Art.sprite(night ? 'sun' : 'moon');
    requestRender();
  }

  /* ---------------- pointer and keyboard ---------------- */
  function onDown(e) {
    var p = toLogical(e), t = tileAt(p), placing = S.tool === 'build' && S.building;
    cv.focus({ preventScroll: true });
    if (e.button === 2 || e.button === 1 || !placing) {
      drag = { mode: 'pan', sx: e.clientX, sy: e.clientY, cx: S.cam.x, cy: S.cam.y, moved: false, click: e.button === 0 };
      try { cv.setPointerCapture(e.pointerId); } catch (x) {}
      cv.style.cursor = 'grabbing';
      return;
    }
    if (e.button !== 0) return;
    try { cv.setPointerCapture(e.pointerId); } catch (x) {}
    S.hover = City.inside(t.x, t.y) ? t : null;
    if (Buildings.get(S.building).road) {
      drag = { mode: 'paint', count: 0, stopped: false };
      paintAt(t);
    } else if (e.pointerType === 'mouse') {
      var a = anchor(t); tryPlace(S.building, a.x, a.y);
    } else {
      var a2 = anchor(t);
      if (S.pending && S.pending.x === a2.x && S.pending.y === a2.y) tryPlace(S.building, a2.x, a2.y);
      else { S.pending = a2; defaultStatus(); }
    }
    requestRender();
  }
  function paintAt(t) {
    if (!drag || drag.mode !== 'paint' || drag.stopped || !City.inside(t.x, t.y)) return;
    var r = tryPlace('road', t.x, t.y, true);
    if (r === true) drag.count++; else if (r === 'stop') drag.stopped = true;
  }
  function onMove(e) {
    var t = tileAt(toLogical(e));
    if (drag && drag.mode === 'pan') {
      var dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true;
      if (drag.moved) { S.cam.x = drag.cx + dx / zoom; S.cam.y = drag.cy + dy / zoom; setOrigin(); requestRender(); }
      return;
    }
    if (drag && drag.mode === 'paint') paintAt(t);
    if (e.pointerType === 'mouse' || drag) {
      var h = City.inside(t.x, t.y) ? t : null, key = h ? h.x + ',' + h.y : '';
      if (key !== lastCursorKey) { lastCursorKey = key; S.hover = h; requestRender(); }
    }
  }
  function onUp(e) {
    if (!drag) return;
    var d = drag; drag = null;
    try { cv.releasePointerCapture(e.pointerId); } catch (x) {}
    paintTools();
    if (d.mode === 'pan' && !d.moved && d.click) selectAt(tileAt(toLogical(e)));
    if (d.mode === 'paint' && d.count > 0) { Sound.play('stamp'); setStatus('Laid ' + d.count + (d.count === 1 ? ' road tile.' : ' road tiles.'), 'good'); }
  }
  function onKey(e) {
    var k = e.key, step = null;
    if (k === 'ArrowUp') step = [-1, -1]; else if (k === 'ArrowDown') step = [1, 1]; else if (k === 'ArrowLeft') step = [-1, 1]; else if (k === 'ArrowRight') step = [1, -1];
    if (step) {
      e.preventDefault();
      var cur = S.cursor || { x: 18, y: 16 }, nx = cur.x + step[0], ny = cur.y + step[1];
      if (!S.cursor) { nx = cur.x; ny = cur.y; }
      if (Terrain.at(nx, ny)) { S.cursor = { x: nx, y: ny }; S.hover = S.cursor; announce(describe(S.cursor)); requestRender(); }
    } else if (k === 'Enter' || k === ' ') {
      e.preventDefault();
      var c = S.cursor; if (!c) { S.cursor = { x: 18, y: 16 }; S.hover = S.cursor; announce(describe(S.cursor)); requestRender(); return; }
      if (S.tool === 'build' && S.building) { var a = anchor(c); tryPlace(S.building, a.x, a.y); } else selectAt(c);
    } else if (k === 'Escape') { cancel(); }
    else if (k === '+' || k === '=') doZoom(1);
    else if (k === '-' || k === '_') doZoom(-1);
    else if (k === '0') centre();
    else if ('wasdWASD'.indexOf(k) >= 0 && k.length === 1) { var pk = k.toLowerCase(); S.cam.x += (pk === 'a' ? 24 : pk === 'd' ? -24 : 0); S.cam.y += (pk === 'w' ? 24 : pk === 's' ? -24 : 0); setOrigin(); requestRender(); }
  }

  /* ---------------- the "All 13" list ---------------- */
  function openAll() {
    var res = Save.get().resources, html = '';
    Buildings.GROUPS.forEach(function (gr) {
      var rows = Buildings.LIST.filter(function (b) { return b.group === gr.id; });
      if (!rows.length) return;
      html += '<h3>' + gr.name + '</h3>';
      rows.forEach(function (b) {
        html += '<button class="c-row" data-id="' + b.id + '"><span class="rn"><b>' + b.name + '</b><span class="sz">' + sizeText(b) + '</span></span><span class="re">' + b.effect + '</span><span class="cs">' + costHtml(b.id, res) + '</span></button>';
      });
    });
    var m = host.el('<div class="c-modal" role="dialog" aria-modal="true" aria-labelledby="c-m-h"><div class="pxp c-mcard"><div class="mh"><h2 id="c-m-h" data-mfocus tabindex="-1">All buildings</h2><button class="pbtn light" id="c-m-x">Close</button></div><div class="mb">' + html + '</div></div></div>');
    node.appendChild(m);
    function close() { m.remove(); q('#c-all').focus(); }
    m.addEventListener('click', function (e) {
      var row = e.target.closest('.c-row');
      if (row) { m.remove(); host.sound('tap'); chooseBuilding(row.getAttribute('data-id')); cv.focus({ preventScroll: true }); return; }
      if (e.target === m || e.target.id === 'c-m-x') close();
    });
    m.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    m.querySelector('[data-mfocus]').focus();
  }

  /* ---------------- build the screen ---------------- */
  function build(root, h) {
    host = h;
    node = h.el(
      '<section class="screen" id="screen-city" aria-label="City"><div class="c-wrap">' +
        '<header class="c-top">' +
          '<div class="c-brand"><button class="pbtn light c-homebtn" id="c-home">Home</button><span class="c-logo" aria-hidden="true">' + Art.sprite('brain') + '</span>' +
            '<div class="c-title"><b>QuinnDom</b><span id="c-day">DAY 1</span></div></div>' +
          '<div class="c-chips" id="c-res"></div>' +
          '<div class="c-right"><span class="c-tag" id="c-sandbox" hidden>SANDBOX</span>' +
            '<span class="c-chip credit" id="c-credit" title="Credit score: the value of everything you have built"></span>' +
            '<span class="c-chip streak" id="c-streak"></span>' +
            '<button class="c-iconbtn" id="c-night" aria-pressed="false" aria-label="Switch to night mode"></button>' +
            '<button class="pbtn light c-setbtn" id="c-settings">Settings</button></div>' +
        '</header>' +
        '<div class="c-body">' +
          '<aside class="c-side"><nav class="c-nav" aria-label="Main">' +
            '<button class="c-navb" data-go="home">Home</button><button class="c-navb on" aria-current="page">City</button>' +
            '<button class="c-navb" data-go="passport">Passport</button><a class="c-navb" href="puzzles/">Puzzles</a>' +
            '<span class="c-navb soon">World map <em>SOON</em></span><span class="c-navb soon">Heroes &amp; Army <em>SOON</em></span></nav>' +
            '<div class="c-count"><span>New day in</span><b id="c-count">--:--:--</b><small>Midnight, Vietnam time</small></div></aside>' +
          '<div class="c-stage" id="c-stage">' +
            '<canvas id="c-cv" tabindex="0" role="application" aria-label="Your city: an isometric grid. Arrow keys move the cursor, Enter places or selects, Escape cancels, plus and minus zoom." aria-describedby="c-list"></canvas>' +
            '<h1 class="sr-only" data-focus tabindex="-1">City</h1>' +
            '<div class="pxp c-name"><b id="c-cname"></b><span id="c-cstat"></span></div>' +
            '<div class="pxp c-info" id="c-info" hidden></div>' +
            '<div class="c-zoom"><button class="pbtn light" id="c-zin" aria-label="Zoom in">+</button><button class="pbtn light" id="c-zout" aria-label="Zoom out">−</button><button class="pbtn light" id="c-centre" aria-label="Centre the city">◎</button></div>' +
            '<div class="pxp c-tray" id="c-tray">' +
              '<div class="c-row1"><div class="c-tools" role="group" aria-label="Tool"><button class="c-tool" data-tool="select">Select</button><button class="c-tool on" data-tool="build">Build</button></div>' +
                '<div class="c-tiles" id="c-tiles" role="group" aria-label="Buildings"></div><span class="c-hintsel" id="c-hint-select" hidden>Click a building on the island to see what it does.</span>' +
                '<button class="pbtn" id="c-all">All 13</button></div>' +
              '<div class="c-status" id="c-status" role="status"></div>' +
            '</div>' +
            '<div class="sr-only" id="c-sr" aria-live="polite"></div>' +
            '<ul class="sr-only" id="c-list"></ul>' +
          '</div>' +
        '</div></div></section>');
    root.appendChild(node);
    cv = q('#c-cv'); stage = q('#c-stage'); tray = q('#c-tray');

    q('#c-home').addEventListener('click', function () { host.show('home'); });
    q('#c-settings').addEventListener('click', function () { host.show('settings'); });
    [].forEach.call(node.querySelectorAll('[data-go]'), function (b) { b.addEventListener('click', function () { host.show(b.getAttribute('data-go')); }); });
    q('#c-night').addEventListener('click', function () { setLook(S.look === 'day' ? 'night' : 'day'); host.sound('tap'); });
    q('#c-zin').addEventListener('click', function () { doZoom(1); });
    q('#c-zout').addEventListener('click', function () { doZoom(-1); });
    q('#c-centre').addEventListener('click', centre);
    q('#c-all').addEventListener('click', openAll);
    [].forEach.call(node.querySelectorAll('.c-tool'), function (b) { b.addEventListener('click', function () { host.sound('tap'); setTool(b.getAttribute('data-tool')); }); });
    q('#c-tiles').addEventListener('click', function (e) { var b = e.target.closest('.c-tile'); if (b) { host.sound('tap'); chooseBuilding(b.getAttribute('data-id')); } });
    q('#c-status').addEventListener('click', function (e) {
      if (e.target.id === 'c-place' && S.pending) { var p = S.pending; tryPlace(S.building, p.x, p.y); }
      else if (e.target.id === 'c-cancel') { S.pending = null; defaultStatus(); requestRender(); }
    });
    q('#c-info').addEventListener('click', function (e) { if (e.target.id === 'c-info-store') { host.sound('tap'); openStore(); return; } if (e.target.id === 'c-info-x') { S.selected = null; paintInfo(); requestRender(); } });

    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', function () { drag = null; paintTools(); });
    cv.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && !drag) { S.hover = S.cursor; lastCursorKey = ''; requestRender(); } });
    cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    cv.addEventListener('wheel', function (e) { e.preventDefault(); doZoom(e.deltaY < 0 ? 1 : -1); }, { passive: false });
    cv.addEventListener('keydown', onKey);
    window.addEventListener('keydown', function (e) { if (active && e.key === 'Escape' && document.activeElement !== cv && !node.querySelector('.c-modal')) cancel(); });

    if (window.ResizeObserver) new ResizeObserver(function () { if (active && layout()) requestRender(); }).observe(stage);
    else window.addEventListener('resize', function () { if (active && layout()) requestRender(); });
    Clock.onTick(function (left) { var c = node.querySelector('#c-count'); if (c) c.textContent = Clock.formatCountdown(left); });

    setLook('day');
    node.__enter = function () {
      active = true; S.selected = null; S.pending = null; S.hover = S.cursor;
      if (!/notransition/.test(location.search)) trans = Date.now();
      refreshAll();
      if (layout()) requestRender();
      clearInterval(ambTimer);
      lastTick = 0; if (!looping) { looping = true; setTimeout(loop, 33); }
    };
    node.__leave = function () { active = false; clearInterval(ambTimer); ambTimer = null; };
  }

  /* for tests: where a tile's centre is on the page */
  function tileClient(x, y) { var r = cv.getBoundingClientRect(); return { x: r.left + (O.x + x * T + T / 2) * zoom, y: r.top + (O.y + y * T + T / 2 - zAt(x, y)) * zoom }; }
  function debugState() { return { zoom: zoom, fit: fit, tool: S.tool, building: S.building, selected: S.selected, W: W, H: H }; }

  return { build: build, tileClient: tileClient, debug: debugState };
})();
