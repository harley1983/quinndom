/* Small pixel art made from code (no image files). Placeholder island until the real pixel art is added. */
var Art = (function () {
  var PAL = {
    o: '#14261B', w: '#B392AC', l: '#CDB4DB', g: '#7BC67A', f: '#237A43',
    y: '#F7C948', Y: '#E9C46A', r: '#C8693D', v: '#6E54A3', V: '#8E75C4', p: '#D9638F', q: '#FFAFCC',
    k: '#4A1620', P: '#EFB3B0', R: '#D9737B', B: '#B3261E', Q: '#E58B93', m: '#EEEEEE', n: '#B9C2CC', s: '#F3F7EA', b: '#3A7BD5', t: '#E9D8A6'
  };

  function sprite(rows, cls, pal) {
    pal = pal || PAL;
    var h = rows.length, w = rows[0].length, out = '';
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var ch = rows[y].charAt(x);
      if (ch !== '.' && pal[ch]) out += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + pal[ch] + '"/>';
    }
    return '<svg class="px ' + (cls || '') + '" viewBox="0 0 ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" shape-rendering="crispEdges">' + out + '</svg>';
  }

  var BRAIN_PAL = {'o': '#4A1A24', 'p': '#EFA3AC', 'h': '#F9C9CE', 'd': '#D9798A', 'f': '#C4647A', 'k': '#8E3550', 'v': '#D32F2F', 'b': '#D9798A', 's': '#E08C9A', 'g': '#7BC67A', 'n': '#237A43'};

  var SPRITES = {
    // the logo: a pink brain (folds, cerebellum, brainstem, red blood vessels) with a sprout growing out of it
    brain: [
      '........................................',
      '...............gg.......................',
      '..............gggg....ggg...............',
      '................ggg.nggggg..............',
      '.................ggn.ggg................',
      '..................nnn...................',
      '..............ooooono...................',
      '...........oooppfffppoooooo.............',
      '.........ooffppfhppfppfpfffoo...........',
      '......ooopfpppfpfffpppfpfvpffo..........',
      '....ooffpfppffffpffphfpppvppppoo........',
      '...oppffpffvfppppffppfhpffvpffffoo......',
      '...opfffppfpvhffppppvpppppvvvppfppo.....',
      '..oppffpppfppvfffpffvpfppvpppvvpppfo....',
      '..oppfhpfpppfvffpfpppvpffvpfpppvpfpfo...',
      '.offpppfhfppppvpppphfvppvfppffffvfppfo..',
      '.ofpfpfffpppfvvpfpppppvppvfpppppfvppfpo.',
      '.offfffppppvvffvvfppfffvfvpffpppppfffpo.',
      '.oppfpppfpvppppffvpfpffpfpvpfppvppfppppo',
      '.ofppppppvppppppppvpfpppfppfppppvvpppppo',
      '.offffffpffffppfpfvfpppfpppppppppfvpfppo',
      '.opfpppfkkkppppfkkkvpffppffpfpfpppvfpfo.',
      '.opfppppfppkkkkkppppkkpppkkkfppfppfvfo..',
      '..ofpppfppfppppppfffppkkkfppfpfffffvo...',
      '...ofppfvvfppvvvfffppffppppfpppppfffo...',
      '....offppfvvvppfffppfppffppfppppddddoo..',
      '....opppfpppfpppppppfppfffppfffdddddoo..',
      '....oppfppfppfppppfppfffffppfffffffffo..',
      '.....opfpfpfppffffpfpppoddddddddddddoo..',
      '......opfpppfppppposssssoddddddddddoo...',
      '.......oooooooooooosssssooffffffffoo....',
      '...................osssssooooooooo......',
      '...................ossssso..............',
      '...................ossssso..............'
    ],
    sun: ['..oooo..', '.oyyyyo.', 'oyyyyyyo', 'oyyyyyyo', 'oyyyyyyo', 'oyyyyyyo', '.oyyyyo.', '..oooo..'],
    moon: ['..ooo...', '.omm.o..', 'omm.....', 'omm.....', 'omm.....', 'omnm..o.', '.ommmmo.', '..oooo..'],
    mushroom: ['..oooo..', '.ovVVvo.', 'ovVsVVvo', 'ovvVVsvo', '.oooooo.', '..otto..', '..otto..', '..oooo..'],
    mimosa: ['..oqqo..', '.oqqqqo.', 'oqqyyqqo', 'oqqyyqqo', '.oqqqqo.', '..oqqo.f', '....f.ff', '...ff...'],
    flame: ['...o....', '..orr...', '..orro..', '.orryro.', 'orryyyro', 'orryyyro', '.orrrro.', '..oooo..']
  };

  /* A floating island: grass top, tapering earth, a few towers, trees and solar panels. */
  function island(mode) {
    var night = mode === 'night';
    var wall = night ? '#2C4A82' : '#E9D8A6';
    var roof = night ? '#17295A' : '#237A43';
    var win = night ? '#F7C948' : '#3A7BD5';
    var grass = night ? '#2F6B3E' : '#7BC67A';
    var grass2 = night ? '#255434' : '#4A7C59';
    var out = '';
    function r(x, y, w, h, c) { out += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + c + '"/>'; }
    // earth underside, stepping in
    var earth = [[8, 80], [10, 76], [14, 68], [18, 60], [22, 52], [26, 44], [30, 36], [34, 28], [38, 20], [42, 12]];
    earth.forEach(function (e, i) { r(e[0] + 4, 38 + i * 2, 88 - e[0] * 1 - 8 - (i * 0), 2, i % 2 ? '#6B4B30' : '#8A5E3C'); });
    for (var i = 0; i < 10; i++) {
      var inset = 4 + i * 4;
      r(inset, 36 + i * 2, 96 - inset * 2 + 0, 2, i % 3 === 0 ? '#6B4B30' : '#8A5E3C');
    }
    // grass top
    r(2, 30, 92, 6, grass);
    r(2, 34, 92, 2, grass2);
    r(6, 28, 84, 2, grass);
    // towers
    function tower(x, h, w) {
      r(x, 28 - h, w, h, wall);
      r(x - 1, 27 - h, w + 2, 2, roof);
      for (var yy = 28 - h + 3; yy < 26; yy += 5) { r(x + 2, yy, 2, 2, win); if (w > 8) r(x + w - 4, yy, 2, 2, win); }
    }
    tower(24, 26, 10); tower(38, 36, 10); tower(52, 20, 12); tower(68, 14, 8);
    r(37, 28 - 36 - 5, 1, 4, '#14261B'); r(37, 28 - 36 - 5, 4, 2, '#7BC67A');
    // solar panels
    r(14, 25, 8, 2, '#3A7BD5'); r(14, 27, 8, 1, '#1D3557');
    r(78, 25, 10, 2, '#3A7BD5'); r(78, 27, 10, 1, '#1D3557');
    // trees
    [[8, 22], [44, 24], [64, 23], [90, 22]].forEach(function (t) { r(t[0], t[1], 6, 5, night ? '#255434' : '#237A43'); r(t[0] + 1, t[1] - 2, 4, 3, night ? '#2F6B3E' : '#7BC67A'); r(t[0] + 2, t[1] + 5, 2, 3, '#6B4B30'); });
    // clouds
    if (!night) { r(6, 6, 14, 3, 'rgba(255,255,255,.85)'); r(10, 4, 8, 2, 'rgba(255,255,255,.85)'); r(70, 12, 16, 3, 'rgba(255,255,255,.8)'); r(74, 10, 8, 2, 'rgba(255,255,255,.8)'); }
    else { [[10, 8], [30, 4], [60, 6], [82, 10], [90, 3]].forEach(function (s) { r(s[0], s[1], 1, 1, '#EEEEEE'); }); }
    return '<svg class="px island" viewBox="0 0 96 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A floating pixel island city" shape-rendering="crispEdges">' + out + '</svg>';
  }


  /* resource icons, 12 x 12 pixels: wood log, stone, metal ingot, food (wheat); aria-label carries the name */
  var RES = {
    wood: { pal: { o: '#14261B', b: '#A8673F', B: '#C98A5A', r: '#E9D8A6', d: '#7A4A2B' }, rows: [
      '............', '............', '..oooooooo..', '.obBBBBBBdo.', 'orrooBBBBBdo', 'orroorBBBBdo', 'orroorBBBBdo', 'orrooBBBBBdo', '.obBBBBBBdo.', '..oooooooo..', '............', '............'] },
    stone: { pal: { o: '#14261B', s: '#B9C2CC', S: '#8A94A0', h: '#EEEEEE' }, rows: [
      '............', '............', '....oooo....', '..ooshhsoo..', '.oshhsssSSo.', '.oshssssSSo.', 'ossssssSSSSo', 'osssssSSSSSo', 'oSSSSSSSSSSo', '.ooSSSSSSoo.', '...oooooo...', '............'] },
    metal: { pal: { o: '#14261B', m: '#8FA3B5', M: '#5D6B78', h: '#EEF3F8' }, rows: [
      '............', '............', '...oooooooo.', '..ohhhhhhmo.', '.ohhhhhhmmMo', 'ommmmmmmmMMo', 'ommmmmmmMMMo', 'oMMMMMMMMMo.', '.ooooooooo..', '............', '............', '............'] },
    food: { pal: { o: '#14261B', g: '#7BC67A', f: '#237A43', y: '#F7C948', Y: '#E9C46A' }, rows: [
      '.....oo.....', '....oyyo....', '...oyYYyo...', '..oyyYYyyo..', '..oYyyyyYo..', '...oyYYyo...', '....oyyo.oo.', '..oo.oYo.ffo', '.offo.oo.fgo', '.ofgfo..ofo.', '..ofgfoofo..', '...oooooo...'] }
  };
  function resIcon(k, cls) {
    var d = RES[k]; if (!d) return '';
    var s = sprite(d.rows, 'resi ' + (cls || ''), d.pal);
    return s.replace('aria-hidden="true"', 'role="img" aria-label="' + k + '"');
  }
  return { res: resIcon, sprite: function (name, cls) { return sprite(SPRITES[name], cls, name === 'brain' ? BRAIN_PAL : null); }, island: island };
})();
