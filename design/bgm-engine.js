// ===================== bgm-engine.js =====================
// High-quality procedural BGM engine for the danmaku game.
// Drop-in replacement for the simple 2-bar-loop tracks. Designed to be INLINED
// into both bgm-demo.html (audition harness) and index.html (live game).
//
// Assumes these already exist in the host scope (they do in index.html's Audio module):
//   ctx, musicGain, mtof(midi)->Hz, tone(opts), noise(opts), now()
// where tone/noise schedule one-shot self-cleaning voices on opts.dest at opts.t0.
//
// ---- DATA MODEL ----------------------------------------------------------
// A track is authored as SECTIONS (intro/A/B/bridge/...) plus an ARRANGEMENT
// (the order the sections play; it loops at the end). At first use the track is
// COMPILED: sections are concatenated in arrangement order into long per-lane
// arrays, note gate-lengths are precomputed (legato), pad chords get hold-lengths,
// and a flat drum map is built. The scheduler then just walks `step % totalSteps`.
//
// Lanes (each is an array of absolute MIDI numbers; 0 = rest):
//   lead    main melody (THE hook) — layered/detuned for body
//   harm    secondary harmony voice (3rd/6th under lead, softer)
//   counter counter-melody that answers in the lead's rests
//   arp     fast plucky arpeggio of the chord
//   bass    main bassline
//   sub     sine sub-octave on accents (optional)
//   chords  pad: non-null entry = chord (MIDI array) struck & held until next chord
//   kick/snare/hat/crash  drums. hat: 0 none, 1 closed, 2 open. crash: 0/1.
// Any lane may be omitted from a section (treated as all-rests of correct length).
// 1 bar = 16 sixteenth steps, 4/4.

// ---- per-lane default voice timbres (a track overrides via track.voices) ----
const DEFAULT_VOICES = {
  lead: {
    maxGate: 6,
    layers: [
      { type: 'triangle', octave: 0, detune: 0, gain: 1.00 },
      { type: 'triangle', octave: 0, detune: 7, gain: 0.45 },
      { type: 'sawtooth', octave: -1, detune: 0, gain: 0.30, filter: 'lowpass', filterFreq: 1900 },
    ],
    atk: 0.006, dec: 0.06, sus: 0.55, rel: 0.14,
  },
  harm: {
    maxGate: 6,
    layers: [{ type: 'triangle', octave: 0, detune: -5, gain: 1.0 }],
    atk: 0.008, dec: 0.06, sus: 0.5, rel: 0.16, filter: 'lowpass', filterFreq: 2400,
  },
  counter: {
    maxGate: 5,
    layers: [{ type: 'square', octave: 0, detune: 0, gain: 1.0, filter: 'lowpass', filterFreq: 2200 }],
    atk: 0.006, dec: 0.05, sus: 0.4, rel: 0.12,
  },
  arp: {
    maxGate: 1,
    layers: [{ type: 'triangle', octave: 0, detune: 0, gain: 1.0 }],
    atk: 0.002, dec: 0.03, sus: 0.18, rel: 0.06, filter: 'lowpass', filterFreq: 2800,
  },
  bass: {
    maxGate: 4,
    layers: [{ type: 'sawtooth', octave: 0, detune: 0, gain: 1.0 }],
    atk: 0.005, dec: 0.06, sus: 0.6, rel: 0.09, filter: 'lowpass', filterFreq: 720,
  },
  sub: {
    maxGate: 8,
    layers: [{ type: 'sine', octave: 0, detune: 0, gain: 1.0 }],
    atk: 0.006, dec: 0.08, sus: 0.7, rel: 0.12,
  },
  pad: {
    octave: 1, voices: 2, detune: 9, type: 'sawtooth',
    atk: 0.09, dec: 0.14, sus: 0.7, rel: 0.4, filter: 'lowpass', filterFreq: 1700,
  },
  drums: {
    kick:  { f0: 150, f1: 47, peak: 0.30, atk: 0.002, dec: 0.07, rel: 0.12, dur: 0.20, click: true },
    snare: { tone1: 190, tone2: 250, hp: 1500, peak: 0.20, rel: 0.13, dur: 0.15 },
    hatC:  { hp: 9000, peak: 0.055, rel: 0.028, dur: 0.032 },
    hatO:  { hp: 8000, peak: 0.05, rel: 0.13, dur: 0.16 },
    crash: { hp: 5500, peak: 0.12, rel: 0.5, dur: 0.6 },
  },
};

const DEFAULT_GAINS = {
  lead: 0.135, harm: 0.07, counter: 0.085, arp: 0.06, bass: 0.16, sub: 0.13, pad: 0.05,
  kick: 1, snare: 1, hat: 1, crash: 1, // drum gains baked into voice peaks; these scale them
};

// deep-ish merge of a track's partial voices over the defaults
function mergeVoices(over) {
  over = over || {};
  const out = {};
  for (const k in DEFAULT_VOICES) {
    const d = DEFAULT_VOICES[k], o = over[k];
    if (!o) { out[k] = d; continue; }
    if (k === 'drums') {
      out.drums = {};
      for (const dk in d) out.drums[dk] = Object.assign({}, d[dk], o[dk] || {});
    } else {
      out[k] = Object.assign({}, d, o);
      if (o.layers) out[k].layers = o.layers; // replace layers wholesale if given
    }
  }
  return out;
}

// ---- COMPILE -------------------------------------------------------------
// Concatenate sections (per arrangement) into flat lanes; precompute gates.
const MELODIC_LANES = ['lead', 'harm', 'counter', 'arp', 'bass', 'sub'];

function laneFromSections(track, lane) {
  const out = [];
  for (const secName of track.arrangement) {
    const sec = track.sections[secName];
    const len = sec.bars * 16;
    const a = sec[lane];
    for (let i = 0; i < len; i++) out.push((a && a[i]) ? a[i] : 0);
  }
  return out;
}

function drumFromSections(track, lane) {
  const out = [];
  for (const secName of track.arrangement) {
    const sec = track.sections[secName];
    const len = sec.bars * 16;
    const a = sec[lane];
    for (let i = 0; i < len; i++) out.push((a && a[i]) ? a[i] : 0);
  }
  return out;
}

// for each onset (note!=0) compute how many steps it sounds: to next onset, capped.
function computeGates(notes, maxGate) {
  const n = notes.length, gate = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    if (!notes[i]) continue;
    let d = 1;
    while (d < n && !notes[(i + d) % n]) d++;
    gate[i] = Math.min(d, maxGate);
  }
  return gate;
}

function compile(track) {
  if (track._compiled) return track._compiled;
  const voices = mergeVoices(track.voices);
  const gains = Object.assign({}, DEFAULT_GAINS, track.gains || {});
  const step16 = 60 / track.bpm / 4;

  const lanes = {};
  for (const ln of MELODIC_LANES) {
    const notes = laneFromSections(track, ln);
    lanes[ln] = { notes, gate: computeGates(notes, voices[ln].maxGate) };
  }
  const totalSteps = lanes.lead.notes.length;

  // pad chords: flatten, then hold each chord until the next non-null chord
  const padFlat = new Array(totalSteps).fill(null);
  {
    let w = 0;
    for (const secName of track.arrangement) {
      const sec = track.sections[secName];
      const len = sec.bars * 16;
      const c = sec.chords;
      for (let i = 0; i < len; i++) { padFlat[w++] = (c && c[i]) ? c[i] : null; }
    }
  }
  const pad = new Array(totalSteps).fill(null);
  for (let i = 0; i < totalSteps; i++) {
    if (!padFlat[i]) continue;
    let d = 1;
    while (d < totalSteps && !padFlat[(i + d) % totalSteps]) d++;
    pad[i] = { notes: padFlat[i], hold: d };
  }

  const drums = {
    kick: drumFromSections(track, 'kick'),
    snare: drumFromSections(track, 'snare'),
    hat: drumFromSections(track, 'hat'),
    crash: drumFromSections(track, 'crash'),
  };

  track._compiled = { totalSteps, step16, lanes, pad, drums, voices, gains };
  return track._compiled;
}

// ---- SYNTH ---------------------------------------------------------------
function playLaneNote(dst, when, midi, vcfg, gain, gateSteps, step16) {
  const dur = Math.max(0.05, gateSteps * step16 * 0.92);
  const layers = vcfg.layers || [{ type: vcfg.type || 'triangle', octave: 0, detune: 0, gain: 1 }];
  for (let i = 0; i < layers.length; i++) {
    const l = layers[i];
    tone({
      dest: dst, t0: when, type: l.type || vcfg.type || 'triangle',
      f0: mtof(midi + 12 * (l.octave || 0)), detune: l.detune || 0,
      peak: Math.max(0.0008, gain * (l.gain != null ? l.gain : 1)),
      atk: vcfg.atk, dec: vcfg.dec, sus: vcfg.sus, rel: vcfg.rel, dur: dur,
      filter: l.filter || vcfg.filter, filterFreq: l.filterFreq || vcfg.filterFreq,
      filterFreq1: l.filterFreq1 != null ? l.filterFreq1 : vcfg.filterFreq1,
    });
  }
}

function playPad(dst, when, chord, holdSteps, vcfg, gain, step16) {
  const dur = Math.max(0.2, holdSteps * step16 * 0.96);
  const nVoices = vcfg.voices || 1;
  for (let c = 0; c < chord.length; c++) {
    const base = chord[c] + 12 * (vcfg.octave || 0);
    for (let v = 0; v < nVoices; v++) {
      const det = nVoices > 1 ? (vcfg.detune || 9) * (v - (nVoices - 1) / 2) : 0;
      tone({
        dest: dst, t0: when, type: vcfg.type || 'sawtooth',
        f0: mtof(base), detune: det,
        peak: Math.max(0.0008, gain / Math.sqrt(chord.length * nVoices)),
        atk: vcfg.atk, dec: vcfg.dec, sus: vcfg.sus, rel: vcfg.rel, dur: dur,
        filter: vcfg.filter, filterFreq: vcfg.filterFreq, filterFreq1: vcfg.filterFreq1,
      });
    }
  }
}

function playKick(dst, when, d, g) {
  tone({ dest: dst, t0: when, type: 'sine', f0: d.f0, f1: d.f1, glideExp: true,
    peak: d.peak * g, atk: d.atk, dec: d.dec, sus: 0.3, rel: d.rel, dur: d.dur });
  if (d.click) noise({ dest: dst, t0: when, filter: 'bandpass', filterFreq: 2200, q: 0.8,
    peak: d.peak * 0.35 * g, atk: 0.0005, rel: 0.02, dur: 0.025 });
}
function playSnare(dst, when, d, g) {
  noise({ dest: dst, t0: when, filter: 'highpass', filterFreq: d.hp,
    peak: d.peak * g, atk: 0.001, rel: d.rel, dur: d.dur });
  tone({ dest: dst, t0: when, type: 'triangle', f0: d.tone1, peak: d.peak * 0.5 * g,
    atk: 0.001, dec: 0.02, sus: 0.2, rel: 0.06, dur: 0.07 });
  tone({ dest: dst, t0: when, type: 'triangle', f0: d.tone2, peak: d.peak * 0.35 * g,
    atk: 0.001, dec: 0.02, sus: 0.2, rel: 0.05, dur: 0.06 });
}
function playHat(dst, when, open, d, g) {
  const cfg = open ? d.hatO : d.hatC;
  noise({ dest: dst, t0: when, filter: 'highpass', filterFreq: cfg.hp,
    peak: cfg.peak * g, atk: 0.001, rel: cfg.rel, dur: cfg.dur });
}
function playCrash(dst, when, d, g) {
  noise({ dest: dst, t0: when, filter: 'highpass', filterFreq: d.crash.hp,
    peak: d.crash.peak * g, atk: 0.002, rel: d.crash.rel, dur: d.crash.dur });
}

// schedule one 16th step `s` of compiled track `C` at ctx time `when`
function scheduleTrackStep(C, dst, s, when) {
  // melodic lanes
  for (let li = 0; li < MELODIC_LANES.length; li++) {
    const ln = MELODIC_LANES[li];
    const L = C.lanes[ln];
    const note = L.notes[s];
    if (note) playLaneNote(dst, when, note, C.voices[ln], C.gains[ln], L.gate[s], C.step16);
  }
  // pad
  const p = C.pad[s];
  if (p) playPad(dst, when, p.notes, p.hold, C.voices.pad, C.gains.pad, C.step16);
  // drums
  const dv = C.voices.drums;
  if (C.drums.kick[s]) playKick(dst, when, dv.kick, C.gains.kick);
  if (C.drums.snare[s]) playSnare(dst, when, dv.snare, C.gains.snare);
  const h = C.drums.hat[s];
  if (h) playHat(dst, when, h === 2, dv, C.gains.hat);
  if (C.drums.crash[s]) playCrash(dst, when, dv, C.gains.crash);
}
