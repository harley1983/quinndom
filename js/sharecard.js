/* Passport share card: draws the neo-brutalist trading card (1080 x 1350) on a canvas and saves it as a PNG.
   Design: the "Passport share card" board on the QuinnDom visual board. No network, everything is drawn from the save. */
var ShareCard = (function () {
  var W = 1080, H = 1350, INK = '#111', CREAM = '#FFE9C7', YEL = '#FFE14D';
  var HEAD = '"Space Grotesk",system-ui,sans-serif', PIX = '"VT323",ui-monospace,monospace';
  var CONT = [['AF', '#FF8A2B'], ['AS', '#4F9BE3'], ['EU', '#B58CFF'], ['NA', '#B6E02B'], ['SA', '#FF5E8A'], ['OC', '#2EC4B6']];
  var MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  var URL_TXT = 'HARLEY1983.GITHUB.IO/QUINNDOM';
  // stamp slots inside the art window: x, y, size, rotation (degrees); the best stamps take the first slots
  var SLOTS = [[295, 24, 290, 4], [40, 50, 250, -6], [590, 50, 250, 7], [320, 290, 270, -4], [60, 300, 230, 5], [610, 295, 230, -7]];

  function img(svg, w, h) {
    return new Promise(function (ok) {
      if (!svg) return ok(null);
      svg = svg.replace(/<svg /, '<svg width="' + w + '" height="' + h + '" ' + (/xmlns=/.test(svg.slice(0, 200)) ? '' : 'xmlns="http://www.w3.org/2000/svg" '));
      var i = new Image();
      i.onload = function () { ok(i); }; i.onerror = function () { ok(null); };
      i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }

  function box(c, x, y, w, h, fill, bw, sh) {
    if (sh) { c.fillStyle = INK; c.fillRect(x + sh, y + sh, w, h); }
    c.fillStyle = INK; c.fillRect(x, y, w, h);
    c.fillStyle = fill; c.fillRect(x + bw, y + bw, w - 2 * bw, h - 2 * bw);
  }
  // text with manual letter spacing (works in every browser)
  function text(c, s, x, y, font, color, sp, align) {
    c.font = font; c.fillStyle = color; c.textBaseline = 'alphabetic'; c.textAlign = 'left';
    var wid = 0, i; for (i = 0; i < s.length; i++) wid += c.measureText(s[i]).width + sp;
    wid -= sp;
    var cx = align === 'right' ? x - wid : align === 'center' ? x - wid / 2 : x;
    for (i = 0; i < s.length; i++) { c.fillText(s[i], cx, y); cx += c.measureText(s[i]).width + sp; }
    return wid;
  }
  function dots(c, x, y, w, h, step, r, color) {
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.fillStyle = color;
    for (var yy = y; yy < y + h + step; yy += step) for (var xx = x; xx < x + w + step; xx += step) { c.beginPath(); c.arc(xx + step / 2, yy + step / 2, r, 0, 6.2832); c.fill(); }
    c.restore();
  }

  function data() {
    var s = Save.get(), st = s.passport.stamps, d = s.daily || {};
    var gold = st.filter(function (x) { return x.gold; });
    var order = gold.slice(-2).reverse().concat(st.filter(function (x) { return !x.gold; }).slice(-6).reverse()).slice(0, SLOTS.length);
    var per = CONT.map(function (k) {
      var total = Countries.all.filter(function (c) { return c.continent === k[0]; }).length;
      var have = st.filter(function (x) { var c = Countries.byCode(x.code); return c && c.continent === k[0]; }).length;
      return { k: k[0], color: k[1], have: have, total: total };
    });
    var p = Clock.dayKey().split('-');
    return { name: s.playerName || 'Explorer', city: s.cityName || 'Sunleaf', n: st.length, gold: gold.length, streak: d.streak || 0, best: d.best || 0,
      shown: order, per: per, year: p[0], date: (+p[2]) + ' ' + MON[+p[1] - 1] + ' ' + p[0] };
  }

  function make() {
    var D = data(), fontsReady = (document.fonts && document.fonts.load) ? Promise.all([document.fonts.load('700 100px "Space Grotesk"'), document.fonts.load('40px "VT323"')]).catch(function () {}) : Promise.resolve();
    var jobs = D.shown.map(function (st, i) { var c = Countries.byCode(st.code); return img(c ? Stamps.svg(c.name, st.gold) : '', SLOTS[i][2], SLOTS[i][2]); });
    return Promise.all([fontsReady, img(Art.sprite('brain'), 78, 78), img(Art.res('flame'), 34, 34)].concat(jobs)).then(function (r) {
      var brain = r[1], flame = r[2], stamps = r.slice(3);
      var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      var c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
      // background + card
      c.fillStyle = '#B6E02B'; c.fillRect(0, 0, W, H); dots(c, 0, 0, W, H, 14, 1.9, 'rgba(17,17,17,.7)');
      box(c, 52, 52, 976, 1246, CREAM, 8, 16);
      // progress bar + level tag
      box(c, 94, 97, 688, 44, CREAM, 4, 0);
      var fill = D.n ? Math.max(1, Math.round(D.n / Countries.count * 20)) : 0, bx = 101, bw = (688 - 14 - 19 * 4) / 20;
      for (var i = 0; i < 20; i++) {
        var x0 = bx + i * (bw + 4);
        c.save(); c.beginPath(); c.rect(101, 101, 674, 36); c.clip();
        c.fillStyle = i < fill ? INK : 'rgba(17,17,17,.18)';
        c.beginPath(); c.moveTo(x0 + 8, 104); c.lineTo(x0 + bw + 8, 104); c.lineTo(x0 + bw - 8, 134); c.lineTo(x0 - 8, 134); c.closePath();
        c.fill(); c.restore();
      }
      c.fillStyle = INK; c.fillRect(798, 94, 188, 50);
      text(c, 'LVL ' + D.n, 892, 133, '40px ' + PIX, YEL, 2, 'center');
      // art window
      box(c, 94, 164, 892, 576, '#FF8A2B', 6, 0);
      dots(c, 100, 170, 880, 564, 12, 1.5, 'rgba(17,17,17,.22)');
      c.save(); c.beginPath(); c.rect(100, 170, 880, 564); c.clip();
      stamps.forEach(function (im, i) {
        var s = SLOTS[i]; if (!im) return;
        c.save(); c.translate(100 + s[0] + s[2] / 2, 170 + s[1] + s[2] / 2); c.rotate(s[3] * Math.PI / 180);
        c.shadowColor = INK; c.shadowOffsetX = 6; c.shadowOffsetY = 6; c.shadowBlur = 0;
        c.drawImage(im, -s[2] / 2, -s[2] / 2, s[2], s[2]); c.restore();
      });
      if (!stamps.length) text(c, 'YOUR FIRST STAMP GOES HERE', 540, 470, '48px ' + PIX, INK, 3, 'center');
      c.restore();
      if (D.gold) {
        c.font = '30px ' + PIX; var gt = 'GOLD x' + D.gold, gw = c.measureText(gt).width + gt.length * 0 + 24 + 8;
        box(c, 966 - gw, 686, gw, 40, YEL, 4, 5); text(c, gt, 966 - gw / 2 + 0, 716, '30px ' + PIX, INK, 0, 'center');
      }
      // meta row + name
      text(c, 'QUINNDOM PASSPORT ' + D.year, 94, 777, '32px ' + PIX, INK, 2);
      text(c, D.n + '/' + Countries.count, 986, 777, '32px ' + PIX, INK, 2, 'right');
      var nm = D.name, fs = 112; c.font = '700 ' + fs + 'px ' + HEAD;
      while (fs > 56 && (c.measureText(nm).width - nm.length * 4) > 600) { fs -= 4; c.font = '700 ' + fs + 'px ' + HEAD; }
      text(c, nm, 94, 893, '700 ' + fs + 'px ' + HEAD, INK, -4);
      text(c, ('CITY OF ' + D.city + ' • ' + D.date).toUpperCase(), 94, 946, '34px ' + PIX, '#B3261E', 2);
      box(c, 878, 862, 108, 90, '#fff', 5, 6); if (brain) c.drawImage(brain, 893, 868, 78, 78);
      // stats
      [[D.n, 'COUNTRIES', YEL], [D.gold, 'GOLD', '#fff'], [D.streak, 'STREAK', '#fff'], [D.best, 'BEST', YEL]].forEach(function (s, i) {
        var x = 94 + i * 226; box(c, x, 973, 208, 112, s[2], 5, 6);
        var nw = (function () { c.font = '72px ' + PIX; return c.measureText(String(s[0])).width; })(), fw = i === 2 ? 34 + 6 : 0, sx = x + 104 - (nw + fw) / 2;
        if (i === 2 && flame) c.drawImage(flame, sx, 1000, 34, 34);
        text(c, String(s[0]), sx + fw, 1040, '72px ' + PIX, INK, 0);
        text(c, s[1], x + 104, 1068, '24px ' + PIX, INK, 1, 'center');
      });
      // continent bars
      var cw = (892 - 60) / 6;
      D.per.forEach(function (p, i) {
        var x = 94 + i * (cw + 12); box(c, x, 1105, cw, 24, '#fff', 3, 0);
        if (p.have) { c.fillStyle = p.color; c.fillRect(x + 3, 1108, (cw - 6) * p.have / p.total, 18); }
        text(c, p.k + ' ' + p.have + '/' + p.total, x + cw / 2, 1152, '22px ' + PIX, INK, 0, 'center');
      });
      // footer button
      box(c, 94, 1180, 892, 72, '#4F9BE3', 5, 8);
      text(c, 'PLAY DAILY', 122, 1228, '38px ' + PIX, '#fff', 2);
      c.font = '30px ' + PIX; var uw = c.measureText(URL_TXT).width + 24 + 8;
      box(c, 959 - uw, 1195, uw, 42, YEL, 4, 0); text(c, URL_TXT, 959 - uw / 2, 1226, '30px ' + PIX, INK, 0, 'center');
      return cv;
    });
  }

  function blobOf(cv) { return new Promise(function (ok) { if (cv.toBlob) cv.toBlob(ok, 'image/png'); else ok(null); }); }
  function fileName() { return 'quinndom-passport-' + Clock.dayKey() + '.png'; }

  /* Save as image: share sheet on phones that support sharing files, a normal download everywhere else. */
  function save() {
    return make().then(blobOf).then(function (blob) {
      if (!blob) return false;
      var file = null; try { file = new File([blob], fileName(), { type: 'image/png' }); } catch (e) {}
      if (file && navigator.canShare && navigator.canShare({ files: [file] }) && /Mobi|Android|iPhone|iPad/.test(navigator.userAgent)) {
        return navigator.share({ files: [file], title: 'My QuinnDom passport' }).then(function () { return true; }, function (e) { return e && e.name === 'AbortError' ? 'cancel' : download(blob); });
      }
      return download(blob);
    });
  }
  function download(blob) {
    var a = document.createElement('a'), u = URL.createObjectURL(blob);
    a.href = u; a.download = fileName(); document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 4000); return true;
  }

  /* Print: shows the card alone, full page, and opens the print dialog (css/passport.css hides everything else while printing). */
  function print() {
    return make().then(blobOf).then(function (blob) {
      if (!blob) return false;
      var u = URL.createObjectURL(blob), sheet = document.createElement('div'), im = new Image();
      sheet.id = 'print-sheet'; im.alt = 'My QuinnDom passport'; sheet.appendChild(im); document.body.appendChild(sheet);
      return new Promise(function (ok) {
        function go() {
          var done = function () { window.removeEventListener('afterprint', done); sheet.remove(); URL.revokeObjectURL(u); ok(true); };
          window.addEventListener('afterprint', done);
          setTimeout(function () { window.print(); if (!('onafterprint' in window)) done(); }, 50);
        }
        im.onload = go; im.onerror = function () { sheet.remove(); ok(false); }; im.src = u;
      });
    });
  }

  return { make: make, save: save, print: print, fileName: fileName };
})();
