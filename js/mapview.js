/* MapView: a pannable, zoomable world map drawn from WorldMap (js/worldmap.js).
   The camera glides with an eased tween, pins are HTML so they keep one size at any zoom,
   and countries can be tinted (hit, miss, owned, gold, answer). No libraries. */
var MapView = (function () {
  var NS = 'http://www.w3.org/2000/svg';
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  function create(host) {
    var W = WorldMap.W, H = WorldMap.H, codes = Object.keys(WorldMap.land);
    var defs = '', halo = '', land = '';
    codes.forEach(function (c) {
      defs += '<path id="p-' + c + '" d="' + WorldMap.land[c] + '"/>';
      halo += '<use href="#p-' + c + '"/>';
      land += '<use href="#p-' + c + '" class="land" data-c="' + c + '"/>';
    });
    var grid = '';
    for (var lon = -165; lon <= 180; lon += 15) { var gx = WorldMap.project(lon, 0)[0]; grid += 'M' + gx.toFixed(1) + ' 0V' + H; }
    for (var lat = -45; lat <= 75; lat += 15) { var gy = WorldMap.project(0, lat)[1]; grid += 'M0 ' + gy.toFixed(1) + 'H' + W; }
    var micro = '';
    Object.keys(WorldMap.micro).forEach(function (c) { var p = WorldMap.project(WorldMap.micro[c][0], WorldMap.micro[c][1]); micro += '<circle class="land microdot" data-c="' + c + '" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="2.4"/>'; });
    host.classList.add('mv');
    host.innerHTML =
      '<svg class="mv-svg" preserveAspectRatio="none" aria-hidden="true"><defs>' + defs + '</defs>' +
      '<path class="mv-grid" d="' + grid + '"/><g class="mv-halo">' + halo + '</g><g class="mv-land">' + land + '</g>' +
      '<path class="mv-borders" d="' + WorldMap.borders + '"/><g class="mv-micro">' + micro + '</g></svg>' +
      '<div class="mv-lat" aria-hidden="true"></div><div class="mv-lon" aria-hidden="true"></div><div class="mv-pins"></div>';
    var svg = host.querySelector('.mv-svg'), pinsEl = host.querySelector('.mv-pins'), latEl = host.querySelector('.mv-lat'), lonEl = host.querySelector('.mv-lon');
    var lands = {};
    [].forEach.call(host.querySelectorAll('.land'), function (u) { lands[u.getAttribute('data-c')] = u; });

    var cw = host.clientWidth || 800, ch = host.clientHeight || 500;
    var view = { cx: W * 0.55, cy: H * 0.42, w: W };
    var pins = [], tween = null, pickCb = null, onMove = null, labelKey = '';

    function aspect() { return cw / ch; }
    function fitW() { var a = aspect(); return Math.min(W, H * a); }
    function clampView(v) {
      var a = aspect(), w = Math.min(Math.max(v.w, 45), fitW()), h = w / a;
      var cx = Math.min(Math.max(v.cx, w / 2), W - w / 2), cy = h >= H ? H / 2 : Math.min(Math.max(v.cy, h / 2), H - h / 2);
      return { cx: cx, cy: cy, w: w };
    }
    function toScreen(x, y) { var h = view.w / aspect(); return [(x - (view.cx - view.w / 2)) / view.w * cw, (y - (view.cy - h / 2)) / h * ch]; }
    function toWorld(sx, sy) { var h = view.w / aspect(); return [(view.cx - view.w / 2) + sx / cw * view.w, (view.cy - h / 2) + sy / ch * h]; }

    function labels() {
      var h = view.w / aspect(), x0 = view.cx - view.w / 2, y0 = view.cy - h / 2;
      var degPerPx = 360 / W * view.w / cw, step = degPerPx * 150 > 30 ? 30 : degPerPx * 150 > 10 ? 10 : degPerPx * 150 > 4 ? 5 : degPerPx * 150 > 1.5 ? 2 : 1;
      var key = step + ':' + Math.round(x0 / 40) + ':' + Math.round(y0 / 40) + ':' + Math.round(view.w / 8);
      if (key === labelKey) return; labelKey = key;
      var lo = '', la = '', lonMin = x0 / W * 360 - 180, lonMax = (x0 + view.w) / W * 360 - 180;
      for (var l = Math.ceil(lonMin / step) * step; l <= lonMax; l += step) { var sx = (l + 180) / 360 * W; lo += '<span style="left:' + ((sx - x0) / view.w * cw).toFixed(0) + 'px">' + Math.abs(l) + '°' + (l < 0 ? 'W' : l > 0 ? 'E' : '') + '</span>'; }
      for (var t = -60; t <= 80; t += step) { var p = WorldMap.project(0, t)[1]; var py = (p - y0) / h * ch; if (py > 18 && py < ch - 26) la += '<span style="top:' + py.toFixed(0) + 'px">' + Math.abs(t) + '°' + (t < 0 ? 'S' : t > 0 ? 'N' : '') + '</span>'; }
      lonEl.innerHTML = lo; latEl.innerHTML = la;
    }
    function apply() {
      var h = view.w / aspect();
      svg.style.setProperty('--u', (view.w / cw).toFixed(4));   // one screen pixel in map units, so outlines keep a constant thickness
      svg.setAttribute('viewBox', (view.cx - view.w / 2).toFixed(2) + ' ' + (view.cy - h / 2).toFixed(2) + ' ' + view.w.toFixed(2) + ' ' + h.toFixed(2));
      pins.forEach(function (p) { var s = toScreen(p.x, p.y); p.el.style.transform = 'translate3d(' + s[0].toFixed(1) + 'px,' + s[1].toFixed(1) + 'px,0)'; });
      labels();
      if (onMove) onMove(view);
    }

    function animateTo(target, ms) {
      target = clampView(target);
      if (tween) { cancelAnimationFrame(tween.raf); tween.done(); tween = null; }
      if (reduce || !ms) { view = target; apply(); return Promise.resolve(); }
      return new Promise(function (resolve) {
        var from = { cx: view.cx, cy: view.cy, lw: Math.log(view.w) }, to = { cx: target.cx, cy: target.cy, lw: Math.log(target.w) }, t0 = performance.now();
        var tw = { done: resolve, raf: 0 };
        function step(now) {
          var k = Math.min(1, (now - t0) / ms), e = ease(k);
          view = { cx: from.cx + (to.cx - from.cx) * e, cy: from.cy + (to.cy - from.cy) * e, w: Math.exp(from.lw + (to.lw - from.lw) * e) };
          apply();
          if (k < 1) tw.raf = requestAnimationFrame(step); else { tween = null; resolve(); }
        }
        tween = tw; tw.raf = requestAnimationFrame(step);
      });
    }

    function targetFor(code, padding) {
      var b = WorldMap.box[code]; if (!b) return null;
      var bw = b[2] - b[0], bh = b[3] - b[1], a = aspect();
      var w = Math.max(bw * (padding || 2.1), bh * (padding || 2.1) * a, 120);
      return { cx: (b[0] + b[2]) / 2, cy: (b[1] + b[3]) / 2, w: w };
    }
    function worldTarget() { return { cx: W * 0.52, cy: H * 0.42, w: fitW() }; }

    /* ---- input: drag, wheel, pinch, click ---- */
    var ptrs = {}, drag = null, pinch = null, moved = 0;
    host.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.mv-ui')) return;
      ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
      host.setPointerCapture && host.setPointerCapture(e.pointerId);
      var ids = Object.keys(ptrs);
      if (ids.length === 1) { drag = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy }; moved = 0; if (tween) { cancelAnimationFrame(tween.raf); tween.done(); tween = null; } }
      else if (ids.length === 2) { var a = ptrs[ids[0]], b = ptrs[ids[1]]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), w: view.w }; drag = null; }
    });
    host.addEventListener('pointermove', function (e) {
      if (!ptrs[e.pointerId]) return; ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (pinch) { var ids = Object.keys(ptrs); if (ids.length === 2) { var a = ptrs[ids[0]], b = ptrs[ids[1]]; var d = Math.hypot(a.x - b.x, a.y - b.y); view = clampView({ cx: view.cx, cy: view.cy, w: pinch.w * pinch.d / Math.max(d, 1) }); apply(); } return; }
      if (!drag) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y; moved = Math.max(moved, Math.hypot(dx, dy));
      if (moved < 5) return;
      var unit = view.w / cw; view = clampView({ cx: drag.cx - dx * unit, cy: drag.cy - dy * unit, w: view.w }); apply(); host.classList.add('dragging');
    });
    function up(e) {
      var was = ptrs[e.pointerId]; delete ptrs[e.pointerId]; host.classList.remove('dragging');
      if (Object.keys(ptrs).length < 2) pinch = null;
      if (was && drag && moved < 5 && pickCb) {
        var el = document.elementFromPoint(e.clientX, e.clientY);
        if (el && el.getAttribute && el.getAttribute('data-c') && host.contains(el)) pickCb(el.getAttribute('data-c'));
      }
      if (!Object.keys(ptrs).length) drag = null;
    }
    host.addEventListener('pointerup', up); host.addEventListener('pointercancel', up);
    host.addEventListener('wheel', function (e) {
      e.preventDefault();
      var r = host.getBoundingClientRect(), before = toWorld(e.clientX - r.left, e.clientY - r.top);
      var nw = Math.min(Math.max(view.w * Math.pow(1.0016, e.deltaY), 45), fitW());
      var h = nw / aspect(), nx = before[0] - (e.clientX - r.left) / cw * nw, ny = before[1] - (e.clientY - r.top) / ch * h;
      view = clampView({ cx: nx + nw / 2, cy: ny + h / 2, w: nw }); apply();
    }, { passive: false });

    var ro = window.ResizeObserver ? new ResizeObserver(function () { cw = host.clientWidth || cw; ch = host.clientHeight || ch; labelKey = ''; view = clampView(view); apply(); }) : null;
    if (ro) ro.observe(host);

    var api = {
      host: host,
      resize: function () { cw = host.clientWidth || cw; ch = host.clientHeight || ch; labelKey = ''; view = clampView(view); apply(); },
      home: function (ms) { return animateTo(worldTarget(), ms === undefined ? 900 : ms); },
      settle: function () { view = clampView({ cx: W * 0.52, cy: H * 0.42, w: fitW() * 0.62 }); apply(); return animateTo(worldTarget(), 1600); },
      jumpHome: function () { view = clampView(worldTarget()); apply(); },
      fly: function (code, ms, padding) { var t = targetFor(code, padding); return t ? animateTo(t, ms === undefined ? 1000 : ms) : Promise.resolve(); },
      flyBox: function (codes, ms) {
        var b = [1e9, 1e9, -1e9, -1e9]; codes.forEach(function (c) { var x = WorldMap.box[c]; if (x) b = [Math.min(b[0], x[0]), Math.min(b[1], x[1]), Math.max(b[2], x[2]), Math.max(b[3], x[3])]; });
        if (b[0] > b[2]) return api.home(ms);
        var a = aspect(), w = Math.max((b[2] - b[0]) * 1.35, (b[3] - b[1]) * 1.35 * a, 160);
        return animateTo({ cx: (b[0] + b[2]) / 2, cy: (b[1] + b[3]) / 2, w: w }, ms === undefined ? 1000 : ms);
      },
      zoom: function (f) { return animateTo({ cx: view.cx, cy: view.cy, w: view.w * f }, 320); },
      state: function (code, cls) { var u = lands[code]; if (!u) return; u.setAttribute('class', 'land' + (u.classList.contains('microdot') ? ' microdot' : '') + (cls ? ' ' + cls : '')); },
      clearStates: function () { Object.keys(lands).forEach(function (c) { api.state(c, ''); }); },
      pin: function (code, o) {
        o = o || {}; var p = WorldMap.pt[code]; if (!p) return null;
        var el = document.createElement('div'); el.className = 'mpin ' + (o.kind || '') + (o.drop ? ' drop' : '') + (o.ring ? ' ring' : '');
        el.innerHTML = '<span class="ringfx"></span><svg class="px" viewBox="0 0 12 17" width="30" height="42" aria-hidden="true"><g fill="#2A1F18"><rect x="3" y="0" width="6" height="1"/><rect x="1" y="1" width="2" height="1"/><rect x="9" y="1" width="2" height="1"/><rect x="0" y="2" width="1" height="6"/><rect x="11" y="2" width="1" height="6"/><rect x="1" y="8" width="2" height="1"/><rect x="9" y="8" width="2" height="1"/><rect x="2" y="9" width="2" height="1"/><rect x="8" y="9" width="2" height="1"/><rect x="3" y="10" width="2" height="2"/><rect x="7" y="10" width="2" height="2"/><rect x="4" y="12" width="4" height="2"/><rect x="5" y="14" width="2" height="3"/></g><g class="pf"><rect x="3" y="1" width="6" height="1"/><rect x="1" y="2" width="10" height="6"/><rect x="2" y="8" width="8" height="1"/><rect x="4" y="9" width="4" height="2"/><rect x="5" y="11" width="2" height="2"/></g><rect x="5" y="3" width="2" height="2" fill="#fff"/><rect x="2" y="3" width="2" height="1" fill="#fff" opacity=".55"/></svg>' + (o.num ? '<b class="pn">' + o.num + '</b>' : '');
        pinsEl.appendChild(el); var rec = { x: p[0], y: p[1], el: el, code: code }; pins.push(rec); apply(); return el;
      },
      removePin: function (el) { pins = pins.filter(function (p) { if (p.el === el) { el.remove(); return false; } return true; }); },
      clearPins: function () { pins.forEach(function (p) { p.el.remove(); }); pins = []; },
      onPick: function (fn) { pickCb = fn; },
      point: function (code) { var p = WorldMap.pt[code]; return p ? toScreen(p[0], p[1]) : null; },
      get view() { return view; }
    };
    view = clampView(worldTarget()); apply();
    return api;
  }

  return { create: create };
})();
