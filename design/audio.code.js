// ===================== audio.js  (global `Audio` object) =====================
// Web Audio SFX + procedural BGM for the danmaku game.
// LAZY ctx (created on first user gesture via Audio.unlock()).
// Graph: per-voice gain -> masterGain -> limiter(DynamicsCompressor) -> destination.
// Mute = ctx.suspend()/resume(), persisted in localStorage. Never gain=0 for mute.

const Audio = (function () {
  'use strict';

  // ---- persisted state (readable before ctx exists) ----
  let muted = (function () {
    try { return localStorage.getItem('bh.muted') === '1'; } catch (e) { return false; }
  })();
  let masterVol = (function () {
    try { var v = parseFloat(localStorage.getItem('bh.vol')); return isFinite(v) ? Math.min(1, Math.max(0, v)) : 1; }
    catch (e) { return 1; }
  })();

  // ---- graph nodes (null until unlock) ----
  let ctx = null;
  let masterGain = null;     // user volume * base headroom
  let limiter = null;        // brick-wall compressor
  let musicGain = null;      // dedicated bus for BGM (fade target)
  let sfxGain = null;        // bus for all one-shot SFX
  let noiseBuf = null;       // shared white-noise buffer

  // ---- music scheduler state ----
  let curTrack = 'none';     // 'stage' | 'boss' | 'none'
  let pendingTrack = null;   // track to switch to after fade-out
  let pumpTimer = 0;         // setTimeout handle
  let nextNoteTime = 0;      // ctx time of next 16th step to schedule
  let stepIndex = 0;         // running 16th-step counter for current pattern

  // ---- SFX rate limiting ----
  let lastShoot = 0;

  const MASTER_BASE_GAIN = 0.42;
  const SCHEDULE_AHEAD = 0.10;
  const PUMP_MS = 25;
  const MUSIC_FADE = 0.18;
  const SHOOT_MIN_GAP = 0.045;

  // ---------------------------------------------------------------- utils
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function now() { return ctx ? ctx.currentTime : 0; }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  // Create a short white-noise buffer once (1s, mono).
  function makeNoiseBuffer() {
    var len = (ctx.sampleRate * 1) | 0;
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // Envelope helper: ramp a gain param attack->sustain->release, auto-cleanup.
  // Returns the gain node already connected to `dest`.
  function envGain(dest, t0, peak, atk, dec, sus, rel, holdAt) {
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + atk);
    var sustainLevel = Math.max(0.0002, peak * sus);
    g.gain.exponentialRampToValueAtTime(sustainLevel, t0 + atk + dec);
    var relStart = (holdAt != null) ? holdAt : (t0 + atk + dec);
    g.gain.setValueAtTime(sustainLevel, relStart);
    g.gain.exponentialRampToValueAtTime(0.0001, relStart + rel);
    g.connect(dest);
    return g;
  }

  // One-shot oscillator voice. Connects osc->gain->dest, auto stop+disconnect.
  function tone(opts) {
    if (!ctx) return null;
    var dest = opts.dest || sfxGain;
    var t0 = opts.t0 != null ? opts.t0 : now();
    var type = opts.type || 'sine';
    var f0 = opts.f0;
    var f1 = opts.f1 != null ? opts.f1 : f0;
    var peak = opts.peak != null ? opts.peak : 0.3;
    var atk = opts.atk != null ? opts.atk : 0.004;
    var dec = opts.dec != null ? opts.dec : 0.02;
    var sus = opts.sus != null ? opts.sus : 0.4;
    var rel = opts.rel != null ? opts.rel : 0.08;
    var dur = opts.dur != null ? opts.dur : (atk + dec + rel);
    var detune = opts.detune || 0;

    var osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) {
      if (opts.glideExp) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
      else osc.frequency.linearRampToValueAtTime(f1, t0 + dur);
    }
    if (detune) osc.detune.setValueAtTime(detune, t0);

    var holdAt = t0 + Math.max(atk + dec, dur - rel);
    var g = envGain(dest, t0, peak, atk, dec, sus, rel, holdAt);

    var src = osc;
    if (opts.filter) {
      var bq = ctx.createBiquadFilter();
      bq.type = opts.filter;
      bq.frequency.setValueAtTime(opts.filterFreq || 1200, t0);
      if (opts.filterFreq1 != null) bq.frequency.linearRampToValueAtTime(opts.filterFreq1, t0 + dur);
      if (opts.q != null) bq.Q.value = opts.q;
      osc.connect(bq); bq.connect(g);
    } else {
      osc.connect(g);
    }

    var stopAt = holdAt + rel + 0.02;
    osc.start(t0);
    osc.stop(stopAt);
    osc.onended = function () {
      try { osc.disconnect(); g.disconnect(); } catch (e) {}
    };
    return src;
  }

  // One-shot noise voice (filtered). Auto-cleanup.
  function noise(opts) {
    if (!ctx) return;
    var dest = opts.dest || sfxGain;
    var t0 = opts.t0 != null ? opts.t0 : now();
    var peak = opts.peak != null ? opts.peak : 0.25;
    var atk = opts.atk != null ? opts.atk : 0.002;
    var rel = opts.rel != null ? opts.rel : 0.12;
    var dur = opts.dur != null ? opts.dur : (atk + rel);

    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;

    var node = src;
    if (opts.filter) {
      var bq = ctx.createBiquadFilter();
      bq.type = opts.filter;
      bq.frequency.setValueAtTime(opts.filterFreq || 2000, t0);
      if (opts.filterFreq1 != null) bq.frequency.exponentialRampToValueAtTime(Math.max(60, opts.filterFreq1), t0 + dur);
      if (opts.q != null) bq.Q.value = opts.q;
      src.connect(bq); node = bq;
    }
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    node.connect(g); g.connect(dest);

    src.start(t0);
    src.stop(t0 + dur + 0.02);
    src.onended = function () { try { src.disconnect(); g.disconnect(); } catch (e) {} };
  }

  // ---------------------------------------------------------------- graph build
  function build() {
    var AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();

    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.1;
    limiter.connect(ctx.destination);

    masterGain = ctx.createGain();
    masterGain.gain.value = MASTER_BASE_GAIN * masterVol;
    masterGain.connect(limiter);

    musicGain = ctx.createGain();
    musicGain.gain.value = 0.0001; // ramps up when a track plays
    musicGain.connect(masterGain);

    sfxGain = ctx.createGain();
    sfxGain.gain.value = 1.0;
    sfxGain.connect(masterGain);

    noiseBuf = makeNoiseBuffer();
  }

  // ---------------------------------------------------------------- SFX
  function sfxShoot() {
    if (!ctx) return;
    var t = now();
    if (t - lastShoot < SHOOT_MIN_GAP) return;
    lastShoot = t;
    var base = 880 * Math.pow(2, rnd(-0.12, 0.12));
    tone({ type: 'triangle', f0: base * 1.5, f1: base, glideExp: true,
      peak: 0.16, atk: 0.001, dec: 0.01, sus: 0.2, rel: 0.05, dur: 0.06 });
    // tiny click body
    noise({ filter: 'bandpass', filterFreq: base * 2, q: 6, peak: 0.05, atk: 0.0005, rel: 0.02, dur: 0.025 });
  }

  function sfxEnemyHit() {
    if (!ctx) return;
    tone({ type: 'square', f0: rnd(300, 360), f1: 180, glideExp: true,
      peak: 0.10, atk: 0.001, dec: 0.015, sus: 0.1, rel: 0.04, dur: 0.05,
      filter: 'lowpass', filterFreq: 1400 });
  }

  function sfxEnemyDeath() {
    if (!ctx) return;
    var t = now();
    noise({ t0: t, filter: 'bandpass', filterFreq: 2400, filterFreq1: 300, q: 1.2,
      peak: 0.22, atk: 0.002, rel: 0.22, dur: 0.26 });
    tone({ t0: t, type: 'sawtooth', f0: rnd(420, 500), f1: 90, glideExp: true,
      peak: 0.16, atk: 0.002, dec: 0.04, sus: 0.3, rel: 0.18, dur: 0.26,
      filter: 'lowpass', filterFreq: 2000, filterFreq1: 500 });
  }

  function sfxGraze() {
    if (!ctx) return;
    var t = now();
    tone({ t0: t, type: 'sine', f0: 1760, f1: 2640, peak: 0.12,
      atk: 0.001, dec: 0.01, sus: 0.5, rel: 0.05, dur: 0.07 });
    tone({ t0: t + 0.005, type: 'sine', f0: 2640, peak: 0.06,
      atk: 0.001, dec: 0.005, sus: 0.4, rel: 0.04, dur: 0.05 });
  }

  function sfxBomb() {
    if (!ctx) return;
    var t = now();
    // downward sweep
    tone({ t0: t, type: 'sawtooth', f0: 1200, f1: 80, glideExp: true,
      peak: 0.30, atk: 0.005, dec: 0.1, sus: 0.6, rel: 0.5, dur: 0.85,
      filter: 'lowpass', filterFreq: 3000, filterFreq1: 400 });
    // sub thump
    tone({ t0: t, type: 'sine', f0: 160, f1: 50, glideExp: true,
      peak: 0.34, atk: 0.005, dec: 0.1, sus: 0.5, rel: 0.5, dur: 0.8 });
    // noise wash
    noise({ t0: t, filter: 'lowpass', filterFreq: 6000, filterFreq1: 300,
      peak: 0.26, atk: 0.01, rel: 0.7, dur: 0.8 });
  }

  function sfxPlayerDeath() {
    if (!ctx) return;
    var t = now();
    noise({ t0: t, filter: 'lowpass', filterFreq: 4000, filterFreq1: 200,
      peak: 0.30, atk: 0.002, rel: 0.5, dur: 0.55 });
    tone({ t0: t, type: 'triangle', f0: 440, f1: 70, glideExp: true,
      peak: 0.26, atk: 0.004, dec: 0.08, sus: 0.5, rel: 0.45, dur: 0.7 });
    tone({ t0: t + 0.02, type: 'triangle', f0: 437, f1: 68, glideExp: true,
      detune: -14, peak: 0.18, atk: 0.004, dec: 0.08, sus: 0.5, rel: 0.45, dur: 0.7 });
    tone({ t0: t, type: 'sine', f0: 120, f1: 40, glideExp: true,
      peak: 0.30, atk: 0.004, dec: 0.1, sus: 0.5, rel: 0.4, dur: 0.6 });
  }

  function sfxSpellDeclare() {
    if (!ctx) return;
    var t = now();
    // minor chord stab: root, minor3rd, 5th (A3 minor: A3 C4 E4) + octave shimmer
    var chord = [57, 60, 64, 69]; // A3 C4 E4 A4
    for (var i = 0; i < chord.length; i++) {
      tone({ t0: t, type: 'sawtooth', f0: mtof(chord[i]), peak: 0.12,
        atk: 0.004, dec: 0.06, sus: 0.5, rel: 0.5, dur: 0.7,
        filter: 'lowpass', filterFreq: 3500, filterFreq1: 1400 });
    }
    // shimmer: quick high arpeggio
    var shim = [76, 79, 83, 88];
    for (var j = 0; j < shim.length; j++) {
      tone({ t0: t + 0.04 + j * 0.05, type: 'triangle', f0: mtof(shim[j]),
        peak: 0.09, atk: 0.002, dec: 0.02, sus: 0.3, rel: 0.18, dur: 0.22 });
    }
  }

  function sfxItemGet() {
    if (!ctx) return;
    var t = now();
    tone({ t0: t, type: 'square', f0: mtof(84), peak: 0.12,
      atk: 0.001, dec: 0.02, sus: 0.3, rel: 0.06, dur: 0.09 });
    tone({ t0: t + 0.06, type: 'square', f0: mtof(91), peak: 0.12,
      atk: 0.001, dec: 0.02, sus: 0.3, rel: 0.08, dur: 0.12 });
  }

  function sfxExtend() {
    if (!ctx) return;
    var t = now();
    var notes = [72, 76, 79, 84]; // C E G C
    for (var i = 0; i < notes.length; i++) {
      tone({ t0: t + i * 0.11, type: 'triangle', f0: mtof(notes[i]), peak: 0.16,
        atk: 0.002, dec: 0.03, sus: 0.4, rel: 0.18, dur: 0.26 });
      tone({ t0: t + i * 0.11, type: 'square', f0: mtof(notes[i] - 12), peak: 0.05,
        atk: 0.002, dec: 0.03, sus: 0.3, rel: 0.12, dur: 0.2 });
    }
  }

  function sfxBossWarn() {
    if (!ctx) return;
    var t = now();
    for (var k = 0; k < 2; k++) {
      var tt = t + k * 0.28;
      tone({ t0: tt, type: 'sawtooth', f0: mtof(69), peak: 0.18,
        atk: 0.01, dec: 0.02, sus: 0.7, rel: 0.06, dur: 0.18,
        filter: 'bandpass', filterFreq: 900, q: 3 });
      tone({ t0: tt + 0.14, type: 'sawtooth', f0: mtof(65), peak: 0.18,
        atk: 0.01, dec: 0.02, sus: 0.7, rel: 0.06, dur: 0.14,
        filter: 'bandpass', filterFreq: 900, q: 3 });
    }
  }

  // ---------------------------------------------------------------- BGM tracks
  // Each track: { bpm, len(16th steps), lead[], bass[], pad[](triads per bar),
  //   hat:fn(step), kick:fn(step), snare:fn(step) }. Note value 0/null = rest.
  // Notes are MIDI numbers. Patterns loop on `len`.

  function patHat(step, every) { return (step % every) === (every - 1); }

  const STAGE_TRACK = {
    bpm: 96, len: 32, padGain: 0.10, leadGain: 0.13, bassGain: 0.16,
    // gentle A-minor pentatonic lead arpeggio (16th grid, lots of space)
    lead: [
      69, 0, 72, 0, 76, 0, 72, 0, 74, 0, 72, 0, 69, 0, 67, 0,
      69, 0, 72, 0, 76, 79, 76, 0, 74, 0, 72, 0, 71, 0, 0, 0
    ],
    bass: [
      45, 0, 0, 0, 45, 0, 0, 0, 41, 0, 0, 0, 41, 0, 0, 0,
      43, 0, 0, 0, 43, 0, 0, 0, 40, 0, 0, 0, 40, 0, 43, 0
    ],
    // soft pad triad changes per 8 steps (half bar)
    pad: [
      [57, 60, 64], null, null, null, null, null, null, null,
      [53, 57, 60], null, null, null, null, null, null, null,
      [55, 59, 62], null, null, null, null, null, null, null,
      [52, 55, 59], null, null, null, null, null, null, null
    ],
    hat: function (s) { return (s % 2) === 1; },
    kick: function (s) { return (s % 8) === 0; },
    snare: function (s) { return false; }
  };

  const BOSS_TRACK = {
    bpm: 138, len: 32, padGain: 0.10, leadGain: 0.14, bassGain: 0.18,
    // faster, darker A harmonic-minor lead
    lead: [
      69, 71, 72, 71, 69, 68, 69, 72, 76, 72, 69, 68, 69, 71, 72, 74,
      76, 75, 76, 79, 76, 74, 72, 71, 69, 68, 69, 71, 72, 74, 76, 79
    ],
    bass: [
      33, 0, 33, 33, 0, 33, 33, 0, 33, 0, 33, 33, 0, 33, 33, 0,
      29, 0, 29, 29, 0, 29, 29, 0, 31, 0, 31, 31, 0, 28, 28, 0
    ],
    pad: [
      [57, 60, 64], null, null, null, null, null, null, null,
      [57, 60, 64], null, null, null, null, null, null, null,
      [53, 56, 60], null, null, null, null, null, null, null,
      [52, 56, 59], null, null, null, null, null, null, null
    ],
    hat: function (s) { return true; },           // 16th-note driving hats
    kick: function (s) { return (s % 4) === 0; },  // four-on-floor
    snare: function (s) { return (s % 8) === 4; }  // backbeat
  };

  function trackOf(name) {
    return name === 'boss' ? BOSS_TRACK : (name === 'stage' ? STAGE_TRACK : null);
  }

  // schedule one 16th step of the active track at ctx time `when`
  function scheduleStep(trk, step, when) {
    var s = step % trk.len;
    var dst = musicGain;

    // lead
    var ln = trk.lead[s];
    if (ln) {
      tone({ dest: dst, t0: when, type: 'triangle', f0: mtof(ln),
        peak: trk.leadGain, atk: 0.004, dec: 0.04, sus: 0.4, rel: 0.12, dur: 0.16 });
    }
    // bass
    var bn = trk.bass[s];
    if (bn) {
      tone({ dest: dst, t0: when, type: 'sawtooth', f0: mtof(bn),
        peak: trk.bassGain, atk: 0.004, dec: 0.05, sus: 0.5, rel: 0.08, dur: 0.16,
        filter: 'lowpass', filterFreq: 700 });
    }
    // pad (sustained triad; only fired on change steps, held ~ half bar)
    var chord = trk.pad[s];
    if (chord) {
      var step16 = 60 / trk.bpm / 4;
      var hold = step16 * 8 * 0.95;
      for (var i = 0; i < chord.length; i++) {
        tone({ dest: dst, t0: when, type: 'sawtooth', f0: mtof(chord[i] + 12),
          peak: trk.padGain * 0.5, atk: 0.06, dec: 0.1, sus: 0.7, rel: 0.3, dur: hold,
          filter: 'lowpass', filterFreq: 1600 });
      }
    }
    // drums
    if (trk.kick(s)) {
      tone({ dest: dst, t0: when, type: 'sine', f0: 120, f1: 45, glideExp: true,
        peak: 0.22, atk: 0.002, dec: 0.06, sus: 0.3, rel: 0.1, dur: 0.16 });
    }
    if (trk.snare(s)) {
      noise({ dest: dst, t0: when, filter: 'highpass', filterFreq: 1200,
        peak: 0.14, atk: 0.001, rel: 0.1, dur: 0.12 });
      tone({ dest: dst, t0: when, type: 'triangle', f0: 180, peak: 0.08,
        atk: 0.001, dec: 0.02, sus: 0.2, rel: 0.06, dur: 0.08 });
    }
    if (trk.hat(s)) {
      noise({ dest: dst, t0: when, filter: 'highpass', filterFreq: 7000,
        peak: 0.05, atk: 0.001, rel: 0.03, dur: 0.035 });
    }
  }

  function pump() {
    if (!ctx) return;
    var trk = trackOf(curTrack);
    if (trk) {
      var step16 = 60 / trk.bpm / 4;
      while (nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD) {
        scheduleStep(trk, stepIndex, nextNoteTime);
        stepIndex++;
        nextNoteTime += step16;
      }
    }
    pumpTimer = setTimeout(pump, PUMP_MS);
  }

  function startPump() {
    if (pumpTimer) return;
    if (!ctx) return;
    nextNoteTime = ctx.currentTime + 0.06;
    pump();
  }
  function stopPump() {
    if (pumpTimer) { clearTimeout(pumpTimer); pumpTimer = 0; }
  }

  function rampMusic(target, dur) {
    if (!musicGain) return;
    var t = now();
    musicGain.gain.cancelScheduledValues(t);
    musicGain.gain.setValueAtTime(Math.max(0.0001, musicGain.gain.value), t);
    musicGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, target), t + dur);
  }

  function playMusic(name) {
    if (name !== 'stage' && name !== 'boss' && name !== 'none') return;
    if (!ctx) { curTrack = name; return; } // remember; unlock() will start it
    if (name === curTrack) return;

    if (name === 'none') {
      rampMusic(0.0001, MUSIC_FADE);
      // stop the pump shortly after fade so tails finish
      setTimeout(function () { if (curTrack === 'none') { stopPump(); } }, (MUSIC_FADE + 0.3) * 1000);
      curTrack = 'none';
      return;
    }

    // fade current out, then swap pattern & fade in
    var target = (name === 'boss') ? 0.62 : 0.55;
    if (curTrack === 'none') {
      curTrack = name; stepIndex = 0; startPump();
      rampMusic(target, MUSIC_FADE);
    } else {
      rampMusic(0.0001, MUSIC_FADE);
      setTimeout(function () {
        curTrack = name; stepIndex = 0;
        if (ctx) { nextNoteTime = ctx.currentTime + 0.04; }
        rampMusic(target, MUSIC_FADE);
      }, MUSIC_FADE * 1000);
    }
  }

  // ---------------------------------------------------------------- mute / vol
  function applyMuteToCtx() {
    if (!ctx) return;
    if (muted) { if (ctx.state === 'running') ctx.suspend(); }
    else { if (ctx.state === 'suspended') ctx.resume(); }
  }

  function setMuted(m) {
    muted = !!m;
    try { localStorage.setItem('bh.muted', muted ? '1' : '0'); } catch (e) {}
    applyMuteToCtx();
  }
  function toggleMute() { setMuted(!muted); return muted; }
  function isMuted() { return muted; }

  function setMasterVolume(v) {
    masterVol = Math.min(1, Math.max(0, v));
    try { localStorage.setItem('bh.vol', String(masterVol)); } catch (e) {}
    if (masterGain) masterGain.gain.setTargetAtTime(MASTER_BASE_GAIN * masterVol, now(), 0.02);
  }
  function getMasterVolume() { return masterVol; }

  // ---------------------------------------------------------------- unlock
  function unlock() {
    if (!ctx) {
      try { build(); } catch (e) { ctx = null; return; }
    }
    // resume unless user explicitly muted
    if (!muted && ctx.state === 'suspended') { ctx.resume(); }
    applyMuteToCtx();
    // if a track was requested before ctx existed, start it now
    if (curTrack !== 'none') {
      var want = curTrack; curTrack = 'none';
      playMusic(want);
    }
  }
  function isReady() { return !!ctx; }

  // ---------------------------------------------------------------- visibility
  let hiddenPaused = false;
  function suspendForHidden() {
    if (ctx && ctx.state === 'running' && !muted) { ctx.suspend(); hiddenPaused = true; }
  }
  function resumeFromHidden() {
    if (ctx && hiddenPaused && !muted) { ctx.resume(); }
    hiddenPaused = false;
  }

  return {
    unlock: unlock,
    isReady: isReady,
    toggleMute: toggleMute,
    setMuted: setMuted,
    isMuted: isMuted,
    setMasterVolume: setMasterVolume,
    getMasterVolume: getMasterVolume,
    sfxShoot: sfxShoot,
    sfxEnemyHit: sfxEnemyHit,
    sfxEnemyDeath: sfxEnemyDeath,
    sfxGraze: sfxGraze,
    sfxBomb: sfxBomb,
    sfxPlayerDeath: sfxPlayerDeath,
    sfxSpellDeclare: sfxSpellDeclare,
    sfxItemGet: sfxItemGet,
    sfxExtend: sfxExtend,
    sfxBossWarn: sfxBossWarn,
    playMusic: playMusic,
    getMusic: function () { return curTrack; },
    suspendForHidden: suspendForHidden,
    resumeFromHidden: resumeFromHidden
  };
})();

// expose globally
window.Audio = Audio;  // NOTE: shadows the legacy HTMLAudioElement constructor on
                       // window; the game never uses `new Audio()`, so this is fine.
                       // If you prefer, rename to `window.GameAudio` and update callers.