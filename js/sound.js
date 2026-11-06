/* Sound engine: every sound is made in the browser with Web Audio (no files, no licences).
   Spec: claude/quinndom-color-palette.md (approved 6 Nov 2026).
   Off by default. Effects and ambience have separate switches; one volume slider. */
var Sound = (function () {
  var C = 523.25, D = 587.33, E = 659.25, G = 783.99, A = 880, C2 = 1046.5, E2 = 1318.5;

  // notes: [frequency Hz, start seconds, length seconds, optional voice override]
  var MOMENTS = {
    tap:     { label: 'Tap',           when: 'Any button press',                            kind: 'wood',  notes: [[1400, 0, 0.03]] },
    collect: { label: 'Collect',       when: 'Check-in reward, resources added',            kind: 'drop',  notes: [[620, 0, 0.05], [820, 0.09, 0.05]] },
    correct: { label: 'Correct',       when: 'Right passport answer, puzzle step',          kind: 'chime', notes: [[E, 0, 0.1], [G, 0.12, 0.1], [C2, 0.24, 0.2]] },
    notquite:{ label: 'Not quite',     when: 'Wrong answer, attempt used (gentle)',         kind: 'chime', notes: [[A, 0, 0.12], [E, 0.16, 0.25]] },
    stamp:   { label: 'Stamp',         when: 'New passport stamp lands',                    kind: 'chime', notes: [[196, 0, 0.06, 'wood'], [D * 2, 0.08, 0.3]] },
    solved:  { label: 'Puzzle solved', when: 'Finishing any of the five puzzles',           kind: 'chime', notes: [[C, 0, 0.1], [D, 0.1, 0.1], [E, 0.2, 0.1], [G, 0.3, 0.1], [A, 0.4, 0.35]] },
    milestone:{label: 'Milestone',     when: 'Streak 7, 30, 100, 365; gold stamp',          kind: 'chime', notes: [[C, 0, 0.1], [E, 0.12, 0.1], [G, 0.24, 0.1], [C2, 0.36, 0.1], [E2, 0.48, 0.5], [G * 2, 0.62, 0.6]] },
    bossin:  { label: 'Boss appears',  when: 'Entering a night boss fight',                 kind: 'chip',  notes: [[110, 0, 0.5], [146.83, 0.28, 0.6]] },
    bosshit: { label: 'Boss hit',      when: 'Correct move during a boss fight',            kind: 'chip',  notes: [[G, 0, 0.05], [C2, 0.06, 0.08]] },
    bossend: { label: 'Boss defeated', when: 'Winning a boss fight',                        kind: 'chip',  notes: [[392, 0, 0.1], [C, 0.11, 0.1], [E, 0.22, 0.1], [G, 0.33, 0.1], [C2, 0.44, 0.5]] }
  };

  var LOOPS = {
    garden: { label: 'Garden breeze', desc: 'Soft wind and the odd chime. Day puzzles.' },
    rain:   { label: 'Rain on leaves', desc: 'Light rain and tiny drops. Day puzzles.' },
    night:  { label: 'Night hum',      desc: 'Low hum and slow pixel blips. Boss fights.' }
  };

  var cfg = { sfx: false, ambience: false, volume: 0.7 };
  var ctx = null, master = null;
  var loop = { key: null, bus: null, nodes: [], timer: null };
  var onCue = null; // visual cue hook: function (label)

  function audio() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = cfg.volume;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
    return ctx;
  }

  function tone(c, at, f, d, kind, peak, out) {
    var dest = out || master;
    var v = peak || 1;
    function voice(type, freq, p, len, tail, sweep) {
      var o = c.createOscillator(), g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, at);
      if (sweep) o.frequency.exponentialRampToValueAtTime(sweep, at + 0.09);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(p, at + 0.012);
      if (kind === 'chip') g.gain.setValueAtTime(p, at + len);
      g.gain.exponentialRampToValueAtTime(0.0001, at + len + tail);
      o.connect(g); g.connect(dest);
      o.start(at); o.stop(at + len + tail + 0.05);
    }
    if (kind === 'chime') { voice('sine', f, 0.16 * v, d, 1.1); voice('sine', f * 2.76, 0.03 * v, d, 0.5); }
    else if (kind === 'drop') { voice('sine', f, 0.16 * v, d, 0.18, f * 2.2); }
    else if (kind === 'wood') { voice('sine', f, 0.12 * v, d, 0.06, f * 0.6); }
    else { voice('square', f, 0.05 * v, d, 0.03); }
  }

  function cue(label) { if (onCue) { try { onCue(label); } catch (e) {} } }

  function playMoment(name, force) {
    var m = MOMENTS[name];
    if (!m || (!cfg.sfx && !force)) return false;
    try {
      var c = audio();
      if (!c) return false;
      var now = c.currentTime + 0.03;
      m.notes.forEach(function (n) { tone(c, now + n[1], n[0], n[2], n[3] || m.kind); });
      cue(m.label);
      return true;
    } catch (e) { return false; }
  }

  function noiseSource(c) {
    var len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    var src = c.createBufferSource();
    src.buffer = buf; src.loop = true;
    return src;
  }

  function clearLoopNodes() {
    if (loop.timer) { clearTimeout(loop.timer); loop.timer = null; }
    loop.nodes.forEach(function (n) {
      try { if (n.stop) n.stop(); } catch (e) {}
      try { n.disconnect(); } catch (e) {}
    });
    loop.nodes = []; loop.bus = null; loop.key = null;
  }

  /* Fade out over ~1.2 s, then free everything. */
  function stopAmbience(fast) {
    if (!loop.key) return;
    var oldNodes = loop.nodes, oldBus = loop.bus, oldTimer = loop.timer;
    loop.nodes = []; loop.bus = null; loop.key = null; loop.timer = null;
    if (oldTimer) clearTimeout(oldTimer);
    var wait = 0;
    if (oldBus && ctx && !fast) {
      try {
        oldBus.gain.cancelScheduledValues(ctx.currentTime);
        oldBus.gain.setValueAtTime(Math.max(oldBus.gain.value, 0.0001), ctx.currentTime);
        oldBus.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);
        wait = 1300;
      } catch (e) {}
    }
    setTimeout(function () {
      oldNodes.forEach(function (n) {
        try { if (n.stop) n.stop(); } catch (e) {}
        try { n.disconnect(); } catch (e) {}
      });
    }, wait);
  }

  /* Start one loop (only one plays at a time). Call when a puzzle opens. */
  function startAmbience(key, force) {
    if (!LOOPS[key] || (!cfg.ambience && !force)) return false;
    try {
      var c = audio();
      if (!c) return false;
      if (loop.key === key) return true;
      stopAmbience(true);
      var bus = c.createGain();
      bus.gain.setValueAtTime(0.0001, c.currentTime);
      bus.gain.exponentialRampToValueAtTime(1, c.currentTime + 1.2);
      bus.connect(master);
      loop.bus = bus; loop.key = key; loop.nodes = [bus];
      var pent = [C, D, E, G, A, C2];
      var pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };

      if (key === 'garden' || key === 'rain') {
        var src = noiseSource(c), filt = c.createBiquadFilter(), g = c.createGain();
        filt.type = key === 'garden' ? 'lowpass' : 'bandpass';
        filt.frequency.value = key === 'garden' ? 500 : 2600;
        filt.Q.value = 0.7;
        g.gain.value = key === 'garden' ? 0.05 : 0.035;
        src.connect(filt); filt.connect(g); g.connect(bus);
        src.start();
        loop.nodes.push(src, filt, g);
      }
      if (key === 'night') {
        [55, 82.41].forEach(function (f) {
          var o = c.createOscillator(), g = c.createGain();
          o.type = 'sine'; o.frequency.value = f; g.gain.value = 0.06;
          o.connect(g); g.connect(bus); o.start();
          loop.nodes.push(o, g);
        });
      }
      var myKey = key;
      (function tick() {
        if (loop.key !== myKey) return;
        var at = c.currentTime + 0.02, wait = 1000;
        if (myKey === 'garden') { tone(c, at, pick(pent), 0.2, 'chime', 0.45, bus); wait = 1600 + Math.random() * 2200; }
        else if (myKey === 'rain') { tone(c, at, 900 + Math.random() * 900, 0.03, 'drop', 0.18, bus); wait = 140 + Math.random() * 420; }
        else { tone(c, at, pick([110, 130.81, 164.81, 196]), 0.18, 'chip', 0.35, bus); wait = 520; }
        loop.timer = setTimeout(tick, wait);
      })();
      cue(LOOPS[key].label);
      return true;
    } catch (e) { return false; }
  }

  function setConfig(next) {
    if (typeof next.sfx === 'boolean') cfg.sfx = next.sfx;
    if (typeof next.volume === 'number') {
      cfg.volume = Math.min(1, Math.max(0, next.volume));
      if (master && ctx) master.gain.setTargetAtTime(cfg.volume, ctx.currentTime, 0.02);
    }
    if (typeof next.ambience === 'boolean') {
      cfg.ambience = next.ambience;
      if (!cfg.ambience) stopAmbience(false);
    }
  }

  return {
    moments: MOMENTS,
    loops: LOOPS,
    setConfig: setConfig,
    play: function (name) { return playMoment(name, false); },
    preview: function (name) { return playMoment(name, true); },
    startAmbience: function (key) { return startAmbience(key, false); },
    previewAmbience: function (key) { return startAmbience(key, true); },
    stopAmbience: function () { stopAmbience(false); },
    currentLoop: function () { return loop.key; },
    onCue: function (fn) { onCue = fn; },
    supported: function () { return !!(window.AudioContext || window.webkitAudioContext); }
  };
})();
