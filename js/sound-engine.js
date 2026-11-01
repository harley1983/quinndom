// QuinnDom sound engine. Every sound is synthesised with Web Audio — no
// audio files, no licences. Off by default; players turn it on in Settings.
// Day moments use soft nature chimes/drops/wood-taps; night boss fights use
// pixel "chip" tones. Source of truth for the sound rules: the palette doc.
//
// Usage:
//   QuinnDomSound.play('correct')          // one-shot effect
//   QuinnDomSound.startLoop('garden')      // ambience loop: 'garden' | 'rain' | 'night'
//   QuinnDomSound.stopLoop()
//   QuinnDomSound.setEnabled(true/false)   // effects on/off (persisted)
//   QuinnDomSound.setAmbienceEnabled(true/false)
//   QuinnDomSound.setVolume(0..1)

(function (global) {
  'use strict';

  var PREF_KEY = 'quinndom-sound-v1';

  function loadPrefs() {
    try {
      var p = JSON.parse(localStorage.getItem(PREF_KEY));
      if (p && typeof p === 'object') {
        return {
          enabled: !!p.enabled,
          ambienceEnabled: !!p.ambienceEnabled,
          volume: typeof p.volume === 'number' ? p.volume : 1
        };
      }
    } catch (e) {}
    return { enabled: false, ambienceEnabled: false, volume: 1 }; // off by default
  }
  function savePrefs(p) {
    try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch (e) {}
  }

  var prefs = loadPrefs();
  var ctx = null;
  var loopNodes = [];
  var loopTimer = null;
  var currentLoop = null;

  function audio() {
    if (!prefs.enabled && !prefs.ambienceEnabled) return null;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.resume) ctx.resume();
    return ctx;
  }

  // Core tone synthesiser: 'chime' (day), 'drop', 'wood', 'chip' (night).
  function tone(c, at, f, d, kind, peak, out) {
    var dest = out || c.destination;
    var v = peak || 1;
    function env(g, p, len, tail) {
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(p * prefs.volume, at + 0.012);
      if (kind === 'chip') g.gain.setValueAtTime(p * prefs.volume, at + len);
      g.gain.exponentialRampToValueAtTime(0.0001, at + len + tail);
    }
    function voice(type, freq, p, len, tail, sweep) {
      var o = c.createOscillator();
      var g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, at);
      if (sweep) o.frequency.exponentialRampToValueAtTime(sweep, at + 0.09);
      env(g, p, len, tail);
      o.connect(g); g.connect(dest);
      o.start(at); o.stop(at + len + tail + 0.05);
    }
    if (kind === 'chime') { voice('sine', f, 0.16 * v, d, 1.1); voice('sine', f * 2.76, 0.03 * v, d, 0.5); }
    else if (kind === 'drop') { voice('sine', f, 0.16 * v, d, 0.18, f * 2.2); }
    else if (kind === 'wood') { voice('sine', f, 0.12 * v, d, 0.06, f * 0.6); }
    else { voice('square', f, 0.05 * v, d, 0.03); }
  }

  // Note shorthand.
  var C = 523.25, D = 587.33, E = 659.25, G = 783.99, A = 880, C2 = 1046.5, E2 = 1318.5;

  // One-shot effect library: name -> { kind, notes: [[freq, delay, dur, kindOverride?], ...] }
  var EFFECTS = {
    tap:          { kind: 'wood',  notes: [[1400, 0, 0.03]] },
    collect:      { kind: 'drop',  notes: [[620, 0, 0.05], [820, 0.09, 0.05]] },
    correct:      { kind: 'chime', notes: [[E, 0, 0.1], [G, 0.12, 0.1], [C2, 0.24, 0.2]] },
    wrong:        { kind: 'chime', notes: [[A, 0, 0.12], [E, 0.16, 0.25]] },
    stamp:        { kind: 'chime', notes: [[196, 0, 0.06, 'wood'], [D * 2, 0.08, 0.3]] },
    puzzleSolved: { kind: 'chime', notes: [[C, 0, 0.1], [D, 0.1, 0.1], [E, 0.2, 0.1], [G, 0.3, 0.1], [A, 0.4, 0.35]] },
    milestone:    { kind: 'chime', notes: [[C, 0, 0.1], [E, 0.12, 0.1], [G, 0.24, 0.1], [C2, 0.36, 0.1], [E2, 0.48, 0.5], [G * 2, 0.62, 0.6]] },
    bossAppears:  { kind: 'chip',  notes: [[110, 0, 0.5], [146.83, 0.28, 0.6]] },
    bossHit:      { kind: 'chip',  notes: [[G, 0, 0.05], [C2, 0.06, 0.08]] },
    bossDefeated: { kind: 'chip',  notes: [[392, 0, 0.1], [C, 0.11, 0.1], [E, 0.22, 0.1], [G, 0.33, 0.1], [C2, 0.44, 0.5]] }
  };

  function play(name) {
    if (!prefs.enabled) return;
    var it = EFFECTS[name];
    if (!it) return;
    try {
      var c = audio();
      if (!c) return;
      var now = c.currentTime + 0.03;
      it.notes.forEach(function (n) { tone(c, now + n[1], n[0], n[2], n[3] || it.kind); });
    } catch (e) {}
  }

  function noise(c) {
    var len = c.sampleRate * 2;
    var buf = c.createBuffer(1, len, c.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    var src = c.createBufferSource();
    src.buffer = buf; src.loop = true;
    return src;
  }

  function stopLoop() {
    if (loopTimer) { clearTimeout(loopTimer); loopTimer = null; }
    loopNodes.forEach(function (n) {
      try { if (n.stop) n.stop(); } catch (e) {}
      try { n.disconnect(); } catch (e) {}
    });
    loopNodes = [];
    currentLoop = null;
  }

  function startLoop(key) {
    if (!prefs.ambienceEnabled) return;
    var c = audio();
    if (!c) return;
    stopLoop();
    var master = c.createGain();
    master.gain.setValueAtTime(0.0001, c.currentTime);
    master.gain.exponentialRampToValueAtTime(prefs.volume, c.currentTime + 1.2);
    master.connect(c.destination);
    loopNodes.push(master);
    var pent = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    if (key === 'garden' || key === 'rain') {
      var src = noise(c);
      var filt = c.createBiquadFilter();
      filt.type = key === 'garden' ? 'lowpass' : 'bandpass';
      filt.frequency.value = key === 'garden' ? 500 : 2600;
      filt.Q.value = 0.7;
      var g = c.createGain();
      g.gain.value = key === 'garden' ? 0.05 : 0.035;
      src.connect(filt); filt.connect(g); g.connect(master);
      src.start();
      loopNodes.push(src, filt, g);
    }
    if (key === 'night') {
      [55, 82.41].forEach(function (f) {
        var o = c.createOscillator();
        var g2 = c.createGain();
        o.type = 'sine'; o.frequency.value = f; g2.gain.value = 0.06;
        o.connect(g2); g2.connect(master); o.start();
        loopNodes.push(o, g2);
      });
    }
    function tick() {
      var at = c.currentTime + 0.02;
      var wait = 1000;
      if (key === 'garden') { tone(c, at, pick(pent), 0.2, 'chime', 0.45, master); wait = 1600 + Math.random() * 2200; }
      else if (key === 'rain') { tone(c, at, 900 + Math.random() * 900, 0.03, 'drop', 0.18, master); wait = 140 + Math.random() * 420; }
      else { tone(c, at, pick([110, 130.81, 164.81, 196]), 0.18, 'chip', 0.35, master); wait = 520; }
      loopTimer = setTimeout(tick, wait);
    }
    tick();
    currentLoop = key;
  }

  function setEnabled(on) { prefs.enabled = !!on; savePrefs(prefs); }
  function setAmbienceEnabled(on) {
    prefs.ambienceEnabled = !!on;
    savePrefs(prefs);
    if (!on) stopLoop();
  }
  function setVolume(v) { prefs.volume = Math.max(0, Math.min(1, v)); savePrefs(prefs); }

  global.QuinnDomSound = {
    play: play,
    startLoop: startLoop,
    stopLoop: stopLoop,
    setEnabled: setEnabled,
    setAmbienceEnabled: setAmbienceEnabled,
    setVolume: setVolume,
    isEnabled: function () { return prefs.enabled; },
    isAmbienceEnabled: function () { return prefs.ambienceEnabled; },
    getVolume: function () { return prefs.volume; },
    currentLoop: function () { return currentLoop; }
  };
})(typeof window !== 'undefined' ? window : this);
