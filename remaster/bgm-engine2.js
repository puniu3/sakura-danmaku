// ===================== bgm-engine2.js (REMASTER) =====================
// Rich-instrument BGM engine — drop-in replacement for design/bgm-engine.js.
// External contract is unchanged: compile(track) -> C (must expose totalSteps +
// step16 for the hand-written transport), and scheduleTrackStep(C, dst, s, when).
// Consumes only host symbols: ctx (LAZY — null until the first user gesture),
// mtof(midi)->Hz, noise(opts), now(). Every audio node is created lazily on the
// first scheduleTrackStep call; output routing is rebuilt whenever `dst` changes
// identity (restartMusic REPLACES the musicGain node).
//
// Voice recipes ported from /home/puniu/compose live/voices.mjs (Tone.js synth
// param sets -> raw Web Audio). Orchestration of 'Sunny Petal March' and
// 'Mirror of Two Moons' ported from compose live/variants/v1.mjs / vm.mjs.
//
// Internal chain (≈unity; the transport still ramps musicGain to track.gain):
//   voice strips -> expr (per-section dB arc) -> EQ -> glue comp -> trim -> dst
//   sends: hall = ConvolverNode w/ procedural noise-decay IR; ping-pong delay.
// Karplus-Strong plucks are rendered into cached AudioBuffers in pure JS: a
// realtime DelayNode feedback cycle is clamped to one render quantum (~2.9ms),
// which caps loop pitch at ~344Hz — buffer rendering keeps exact pitch.

// ---- compile: TRACKS data -> flat per-step lanes (same data model as v1 engine)
const MELODIC_LANES = ['lead', 'harm', 'counter', 'arp', 'bass', 'sub'];
const GATE_CAPS = { lead: 6, harm: 6, counter: 5, arp: 2, bass: 4, sub: 8 };

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

// for each onset (note!=0): steps it sounds = distance to next onset (wrapping), capped
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

// ---- voice recipes (compose live/voices.mjs -> raw Web Audio param sets) ----
// kind 'fm'   : carrier+modulator sine pair. h=harmonicity, mi=mod index
//               (deviation = mi * carrier Hz, enveloped by menv).
// kind 'osc'  : subtractive single/fat osc. count/spread = detuned unison,
//               fenv = lowpass filter envelope, vib = pitch LFO.
// kind 'ks'   : Karplus-Strong pluck (buffer-rendered, cached per pitch).
// kind 'mem'  : MembraneSynth-style pitch-glide drum (start = f*2^oct -> f over pd).
// kind 'noise': filtered noise hit via the host noise() primitive.
// env/menv = [atk, dec, sus, rel]. Strip params: vol(dB) pan rev dly,
// flt = static insert filter, chorus = LFO-modulated delay insert.
const VOICE_DEFS = {
  // ---- orchestral ----
  box:     { kind: 'fm', h: 3.01, mi: 6,  env: [0.001, 1.3, 0, 1.2],   menv: [0.001, 0.6, 0, 0.3],  vol: -7,  pan: 0.04,  rev: 0.55, dly: 0.12 },
  glock:   { kind: 'fm', h: 5.2,  mi: 9,  env: [0.001, 0.7, 0, 0.6],   menv: [0.001, 0.3, 0, 0.2],  vol: -10, pan: 0.1,   rev: 0.5,  dly: 0.1 },
  harp:    { kind: 'ks', aN: 0.6, damp: 3600, res: 0.96,                                            vol: -7,  pan: -0.18, rev: 0.4 },
  strSus:  { kind: 'osc', type: 'sawtooth', count: 3, spread: 22, env: [0.42, 0.5, 0.85, 1.6],      vol: -16, rev: 0.5, chorus: { f: 0.5, ms: 5, depth: 0.6, wet: 0.4 } },
  strMel:  { kind: 'osc', type: 'sawtooth', count: 2, spread: 16, env: [0.09, 0.2, 0.85, 0.4],
             fenv: { a: 0.12, d: 0.2, s: 0.8, r: 0.4, base: 600, oct: 2.6, q: 0.8 }, vib: { f: 5.4, d: 0.07 }, vol: -12, pan: 0.06, rev: 0.32 },
  flute:   { kind: 'osc', type: 'sine', env: [0.05, 0.1, 0.88, 0.22],
             fenv: { a: 0.06, d: 0.1, s: 0.9, r: 0.3, base: 1200, oct: 1.5, q: 0.4 }, vib: { f: 4.8, d: 0.11 }, vol: -10, pan: -0.05, rev: 0.38, dly: 0.1 },
  oboe:    { kind: 'osc', type: 'sawtooth', env: [0.04, 0.1, 0.85, 0.2],
             fenv: { a: 0.05, d: 0.1, s: 0.8, r: 0.25, base: 1100, oct: 1.3, q: 1.4 }, vib: { f: 5, d: 0.09 }, vol: -15, pan: 0.14, rev: 0.34 },
  clar:    { kind: 'osc', type: 'square', env: [0.04, 0.12, 0.8, 0.2],
             fenv: { a: 0.05, d: 0.12, s: 0.7, r: 0.25, base: 700, oct: 1.6, q: 0.6 }, vol: -19, pan: -0.26, rev: 0.3 },
  horn:    { kind: 'osc', type: 'sawtooth', env: [0.06, 0.2, 0.8, 0.35],
             fenv: { a: 0.08, d: 0.2, s: 0.7, r: 0.35, base: 500, oct: 1.8, q: 0.7 }, vol: -17, pan: 0.2, rev: 0.34 },
  brass:   { kind: 'osc', type: 'sawtooth', env: [0.03, 0.18, 0.7, 0.25],
             fenv: { a: 0.04, d: 0.18, s: 0.6, r: 0.3, base: 600, oct: 2.4, q: 1 }, vol: -18, pan: 0.1, rev: 0.28 },
  pizz:    { kind: 'osc', type: 'triangle', env: [0.002, 0.18, 0, 0.12], flt: { type: 'lowpass', f: 2200 }, vol: -9, pan: -0.05, rev: 0.22 },
  arco:    { kind: 'osc', type: 'sawtooth', env: [0.08, 0.2, 0.8, 0.3],
             fenv: { a: 0.1, d: 0.2, s: 0.6, r: 0.3, base: 200, oct: 1.8, q: 0.6 }, vol: -13, rev: 0.12 },
  timp:    { kind: 'mem', pd: 0.08, oct: 3, env: [0.001, 0.5, 0, 0.4], vol: -12, pan: -0.1, rev: 0.3 },
  swell:   { kind: 'noise', env: [0.6, 0.5, 0, 0.4], flt: { type: 'highpass', f: 6000 }, vol: -22, pan: 0.1, rev: 0.5 },
  // ---- synth / band ----
  pad:     { kind: 'osc', type: 'sawtooth', count: 3, spread: 40, env: [0.3, 0.5, 0.8, 1.4], flt: { type: 'lowpass', f: 2200 }, vol: -19, rev: 0.45 },
  warmpad: { kind: 'osc', type: 'triangle', env: [0.5, 0.6, 0.85, 1.8], chorus: { f: 0.6, ms: 4, depth: 0.5, wet: 0.4 }, vol: -18, rev: 0.5 },
  epiano:  { kind: 'fm', h: 3,   mi: 8,  env: [0.005, 1.0, 0.18, 0.9], menv: [0.004, 0.35, 0.1, 0.3], vol: -15, pan: -0.18, rev: 0.18, dly: 0.08 },
  bell:    { kind: 'fm', h: 6.5, mi: 10, env: [0.002, 1.5, 0, 1.2],   menv: [0.002, 0.5, 0, 0.4],   vol: -18, pan: 0.26, rev: 0.45, dly: 0.2 },
  choir:   { kind: 'osc', type: 'triangle', env: [0.5, 0.5, 0.8, 1.6], chorus: { f: 0.8, ms: 4, depth: 0.7, wet: 0.5 }, vol: -21, pan: 0.12, rev: 0.6 },
  sawlead: { kind: 'osc', type: 'sawtooth', count: 2, spread: 14, env: [0.01, 0.18, 0.6, 0.2],
             fenv: { a: 0.02, d: 0.15, s: 0.55, r: 0.3, base: 700, oct: 3.4, q: 2 }, vib: { f: 5.2, d: 0.08 }, vol: -13, pan: 0.04, rev: 0.16, dly: 0.16 },
  sqlead:  { kind: 'osc', type: 'square', env: [0.008, 0.12, 0.6, 0.18],
             fenv: { a: 0.01, d: 0.12, s: 0.6, r: 0.2, base: 900, oct: 2.6, q: 1.5 }, vol: -16, pan: 0.06, rev: 0.16, dly: 0.18 },
  sub:     { kind: 'osc', type: 'sine', env: [0.01, 0.1, 0.85, 0.14], vol: -13 },
  bass:    { kind: 'osc', type: 'sawtooth', env: [0.006, 0.16, 0.55, 0.1],
             fenv: { a: 0.008, d: 0.12, s: 0.3, r: 0.15, base: 130, oct: 2.6, q: 1.2 }, vol: -11, rev: 0.02 },
  marimba: { kind: 'fm', h: 3.01, mi: 5, env: [0.002, 0.5, 0, 0.4], menv: [0.002, 0.18, 0, 0.2], vol: -13, pan: -0.3, rev: 0.22 },
  organ:   { kind: 'osc', type: 'sine', count: 3, spread: 8, env: [0.02, 0.1, 0.9, 0.2], vol: -18, rev: 0.3 },
  // ---- kit ----
  kick:    { kind: 'mem', pd: 0.045, oct: 7, env: [0.001, 0.32, 0, 0.12], vol: -6 },
  snare:   { kind: 'noise', env: [0.001, 0.16, 0, 0.04], flt: { type: 'highpass', f: 1600 }, vol: -14, rev: 0.12 },
  hatC:    { kind: 'noise', env: [0.001, 0.03, 0, 0.02], flt: { type: 'highpass', f: 8800 }, vol: -22, pan: 0.16 },
  hatO:    { kind: 'noise', env: [0.001, 0.18, 0, 0.1], flt: { type: 'highpass', f: 8200 }, vol: -24, pan: 0.18, rev: 0.06 },
  ride:    { kind: 'fm', h: 5.1, mi: 32, env: [0.001, 0.3, 0, 0.2], menv: [0.001, 0.3, 0, 0.2], flt: { type: 'highpass', f: 5000 }, vol: -30, pan: 0.25, rev: 0.18 },
  crash:   { kind: 'noise', env: [0.002, 0.5, 0, 0.45], flt: { type: 'highpass', f: 5500 }, vol: -16, pan: 0.2, rev: 0.25 },
  clap:    { kind: 'noise', env: [0.001, 0.14, 0, 0.05], flt: { type: 'bandpass', f: 1200, q: 1 }, vol: -14, pan: 0.1, rev: 0.16 },
  // ---- 和 percussion (kit:'taiko' maps the drum lanes onto these) ----
  taiko:   { kind: 'mem', pd: 0.09, oct: 2.2, env: [0.001, 0.55, 0, 0.45], vol: -9, pan: -0.06, rev: 0.35 },
  rim:     { kind: 'noise', env: [0.001, 0.07, 0, 0.03], flt: { type: 'bandpass', f: 1900, q: 1 }, vol: -16, pan: 0.12, rev: 0.2 },
  tick:    { kind: 'noise', env: [0.001, 0.035, 0, 0.02], flt: { type: 'bandpass', f: 3400, q: 1 }, vol: -20, pan: 0.22, rev: 0.12 },
  gong:    { kind: 'fm', h: 1.41, mi: 14, env: [0.004, 3.0, 0, 2.5], menv: [0.004, 1.4, 0, 1.0], vol: -16, pan: -0.14, rev: 0.6 },
};

// ---- ORCHESTRATION: per-track (keyed on track.title), per-section voice routing.
// Routing value = 'name' | {n,oct,g} | array of those (doublings). Section keys:
// kit (true | 'taiko' | absent=drum lanes silent), db (section dynamic, dB on the
// expr bus), swell/gong (section-gate hits), timp ('soft'|'build'), sparkle
// (box +1oct doubles long lead notes). bassStyle/arpRate/groove of the compose
// variants are already baked into the TRACKS lanes — only routing is ported.
// Design intent: roads = chamber (winds/harp/box/pizz, mostly drumless);
// midbosses = tight & edgy (reeds/mallets/staccato bass + kit); bosses = full
// section + drive; 和 tracks ride the taiko set; Motorik Dawn = synth band.
// On kit:'taiko' sections the crash lane already maps to gong — gong:true is
// only added where there is no crash to avoid a doubled (phase-stacked) strike.
// db values are LEVEL-MATCHED across all 18 tracks by offline-render RMS at
// dst.gain=track.gain (body sections within ~1.7x of the median, abs peak <0.8
// pre-limiter, gameover lament intentionally lowest); retune by measurement,
// not by ear-balancing one track in isolation. Note the BG_DRIVE->glue comp
// stage compresses ~1dB per 2dB of db change at forte levels.
const ORCH = {
  // -------- Stage 1 road (compose v1.mjs) — "music box -> orchestral bloom"
  'Sunny Petal March': {
    intro: { arp: 'box', bass: { n: 'pizz', g: 0.5 }, db: -10 },
    A:     { lead: 'flute', arp: 'box', bass: 'pizz', db: -5 },
    A2:    { lead: 'flute', harm: 'clar', arp: 'harp', pad: 'strSus', bass: 'pizz', db: -2 },
    B:     { lead: ['strMel', { n: 'horn', oct: -1, g: 0.8 }], counter: 'flute', arp: ['harp', { n: 'box', oct: 1, g: 0.5 }],
             pad: 'strSus', bass: 'arco', db: 1, swell: true, timp: 'build', sparkle: true },
    bridge:{ lead: 'strMel', arp: 'harp', pad: { n: 'strSus', g: 0.6 }, bass: { n: 'arco', g: 0.7 }, db: -8 },
    A2b:   { lead: ['flute', { n: 'strMel', g: 0.7 }], harm: 'clar', counter: { n: 'horn', oct: -1, g: 0.7 },
             arp: ['harp', { n: 'box', oct: 1, g: 0.45 }], pad: 'strSus', bass: 'arco', db: 0, swell: true, timp: 'build' },
    outro: { lead: 'flute', arp: 'box', pad: { n: 'strSus', g: 0.6 }, bass: { n: 'arco', g: 0.6 }, db: -11 },
  },
  // -------- Stage 1 midboss — glinting knives: sly oboe, music-box circus, pizz waltz
  "Trickster's Waltz of Knives": {
    intro: { arp: 'box', bass: { n: 'pizz', g: 0.7 }, kit: true, db: -7 },
    A:     { lead: 'oboe', counter: 'clar', arp: { n: 'box', g: 0.6 }, bass: 'pizz', kit: true, db: -2 },
    A2:    { lead: ['oboe', { n: 'glock', oct: 1, g: 0.35 }], harm: { n: 'clar', g: 0.85 }, counter: { n: 'pizz', g: 1.2 },
             arp: { n: 'box', g: 0.55 }, bass: { n: 'arco', g: 0.9 }, kit: true, db: 0 },
    B:     { lead: 'strMel', counter: 'flute', arp: 'box', pad: { n: 'strSus', g: 0.7 }, bass: 'arco', kit: true, swell: true, db: 1 },
    bridge:{ lead: 'clar', counter: { n: 'box', g: 0.6 }, arp: { n: 'glock', g: 0.4 }, pad: { n: 'warmpad', g: 0.6 },
             bass: { n: 'pizz', g: 0.6 }, db: -7 },
    outro: { lead: 'oboe', arp: { n: 'box', g: 0.5 }, bass: 'pizz', kit: true, db: -6 },
  },
  // -------- Stage 1 boss — full orchestra + drive; brass/choir saved for the C-minor climax
  'Sakuya Eternal': {
    intro: { lead: 'strMel', harm: { n: 'clar', g: 0.9 }, arp: 'harp', pad: { n: 'strSus', g: 0.7 }, bass: 'arco', kit: true, db: -5 },
    A1:    { lead: ['strMel', { n: 'horn', oct: -1, g: 0.7 }], arp: 'harp', pad: 'strSus', bass: 'arco', sub: { n: 'sub', g: 0.8 },
             kit: true, timp: 'soft', db: -1 },
    A2:    { lead: ['strMel', { n: 'horn', oct: -1, g: 0.7 }], harm: { n: 'clar', g: 0.9 }, counter: 'flute', arp: 'harp',
             pad: 'strSus', bass: 'arco', sub: { n: 'sub', g: 0.8 }, kit: true, timp: 'soft', swell: true, db: 1 },
    B:     { lead: ['strMel', { n: 'horn', oct: -1, g: 0.6 }], harm: { n: 'oboe', g: 0.8 }, counter: 'flute', arp: 'harp',
             pad: 'strSus', bass: 'arco', sub: { n: 'sub', g: 0.8 }, kit: true, timp: 'build', swell: true, db: 2 },
    bridge:{ lead: 'oboe', arp: { n: 'harp', g: 0.7 }, pad: { n: 'warmpad', g: 0.8 }, bass: { n: 'arco', g: 0.7 }, kit: true, db: -7 },
    climax:{ lead: ['brass', { n: 'strMel', g: 0.8 }], harm: 'horn', counter: { n: 'flute', g: 0.9 },
             arp: ['harp', { n: 'box', oct: 1, g: 0.4 }], pad: ['strSus', { n: 'choir', g: 0.8 }], bass: 'arco',
             sub: { n: 'sub', g: 0.85 }, kit: true, timp: 'build', swell: true, db: 3 },
    A3:    { lead: ['strMel', { n: 'horn', oct: -1, g: 0.7 }], harm: { n: 'clar', g: 0.9 }, counter: 'flute', arp: 'harp',
             pad: 'strSus', bass: 'arco', sub: { n: 'sub', g: 0.8 }, kit: true, timp: 'build', db: 2 },
    outro: { lead: 'strMel', arp: { n: 'harp', g: 0.6 }, pad: { n: 'strSus', g: 0.6 }, bass: { n: 'arco', g: 0.7 }, kit: true, db: -3 },
  },
  // -------- GAME OVER lament — music box carries, strings shadow; bare
  'Falling Petals': {
    A: { lead: ['box', { n: 'strMel', g: 0.55 }], harm: { n: 'clar', g: 0.7 }, pad: { n: 'strSus', g: 0.8 },
         bass: { n: 'arco', g: 0.7 }, sub: { n: 'sub', g: 0.6 }, db: -2 },
  },
  // -------- Stage 2 road — dusk nocturne: plaintive oboe, harp ripple, walking pizz, no kit
  'Yoiyami Lane': {
    intro: { arp: 'harp', pad: { n: 'warmpad', g: 0.8 }, bass: { n: 'pizz', g: 0.6 }, db: -6 },
    A:     { lead: 'oboe', arp: 'harp', pad: { n: 'warmpad', g: 0.7 }, bass: 'pizz', db: -2 },
    A2:    { lead: 'oboe', harm: { n: 'clar', g: 0.9 }, arp: 'harp', pad: 'warmpad', bass: 'pizz', sub: { n: 'sub', g: 0.6 }, db: -1 },
    B:     { lead: 'strMel', counter: 'flute', arp: ['harp', { n: 'box', oct: 1, g: 0.4 }],
             pad: ['warmpad', { n: 'strSus', g: 0.6 }], bass: 'arco', sub: { n: 'sub', g: 0.7 }, swell: true, db: 1 },
    bridge:{ lead: 'flute', arp: { n: 'harp', g: 0.7 }, pad: { n: 'warmpad', g: 0.6 }, bass: { n: 'pizz', g: 0.5 }, db: -8 },
    A2b:   { lead: ['oboe', { n: 'strMel', g: 0.6 }], harm: { n: 'clar', g: 0.9 }, counter: { n: 'flute', g: 0.9 }, arp: 'harp',
             pad: 'warmpad', bass: 'arco', sub: { n: 'sub', g: 0.7 }, swell: true, db: 0 },
    outro: { lead: 'oboe', arp: { n: 'harp', g: 0.6 }, pad: { n: 'warmpad', g: 0.6 }, bass: { n: 'pizz', g: 0.6 }, db: -7 },
  },
  // -------- Stage 2 boss — surging strings: harp = rushing water, arco undertow, horn crest
  'Tidal Surge / 潮の奔流': {
    intro: { arp: 'harp', pad: { n: 'strSus', g: 0.8 }, bass: 'arco', sub: { n: 'sub', g: 0.7 }, kit: true, db: -6 },
    A:     { lead: 'strMel', arp: 'harp', pad: 'strSus', bass: 'arco', sub: { n: 'sub', g: 0.75 }, kit: true, timp: 'soft', db: -2 },
    B:     { lead: ['strMel', { n: 'horn', oct: -1, g: 0.75 }], counter: 'flute', arp: ['harp', { n: 'box', oct: 1, g: 0.35 }],
             pad: 'strSus', bass: 'arco', sub: { n: 'sub', g: 0.8 }, kit: true, timp: 'build', swell: true, db: 2 },
    A2:    { lead: ['strMel', { n: 'brass', g: 0.6 }], harm: { n: 'horn', g: 0.9 }, counter: { n: 'clar', g: 1.1 }, arp: 'harp',
             pad: ['strSus', { n: 'choir', g: 0.7 }], bass: 'arco', sub: { n: 'sub', g: 0.8 }, kit: true, timp: 'build', swell: true, db: 3 },
    outro: { lead: 'strMel', arp: { n: 'harp', g: 0.7 }, pad: { n: 'strSus', g: 0.7 }, bass: { n: 'arco', g: 0.8 }, kit: true, db: -2 },
  },
  // -------- Stage 3 road — 和 grove: harp-as-koto lead, marimba, taiko set, gong entries
  'Take-no-Komichi': {
    intro: { arp: 'harp', pad: { n: 'warmpad', g: 0.7 }, bass: { n: 'pizz', g: 0.6 }, kit: 'taiko', gong: true, db: -6 },
    A:     { lead: 'harp', arp: { n: 'box', g: 0.5 }, bass: 'pizz', kit: 'taiko', db: -1 },
    A2:    { lead: 'harp', harm: { n: 'marimba', g: 0.6 }, arp: { n: 'box', g: 0.5 }, pad: { n: 'warmpad', g: 0.7 },
             bass: 'pizz', sub: { n: 'sub', g: 0.6 }, kit: 'taiko', db: 0 },
    B:     { lead: ['harp', 'flute'], counter: { n: 'marimba', g: 0.9 }, arp: { n: 'box', g: 0.45 }, pad: 'warmpad',
             bass: 'pizz', sub: { n: 'sub', g: 0.7 }, kit: 'taiko', swell: true, db: 1 },
    bridge:{ lead: 'flute', arp: { n: 'harp', g: 0.6 }, pad: { n: 'warmpad', g: 0.6 }, bass: { n: 'pizz', g: 0.5 }, kit: 'taiko', db: -8 },
    A2b:   { lead: ['harp', { n: 'flute', g: 0.7 }], harm: { n: 'marimba', g: 0.6 }, counter: { n: 'box', g: 0.7 },
             arp: { n: 'box', g: 0.45 }, pad: 'warmpad', bass: 'pizz', sub: { n: 'sub', g: 0.7 }, kit: 'taiko', db: 0 },
    outro: { lead: 'harp', arp: { n: 'box', g: 0.5 }, pad: { n: 'warmpad', g: 0.6 }, bass: { n: 'pizz', g: 0.6 }, kit: 'taiko', db: -7 },
  },
  // -------- Stage 3 boss (compose vm.mjs) — 宵=harp pluck, 暁=flute breath, mirror=struck metal
  'Mirror of Two Moons': {
    intro: { lead: 'harp', arp: { n: 'glock', g: 0.5 }, pad: { n: 'warmpad', g: 0.7 }, bass: { n: 'pizz', g: 0.6 }, kit: 'taiko', gong: true, db: -9 },
    call:  { lead: 'harp', counter: 'flute', arp: { n: 'glock', g: 0.6 }, pad: 'warmpad', bass: 'pizz', kit: 'taiko', db: -3 },
    callH: { lead: 'harp', harm: { n: 'marimba', g: 0.55 }, counter: 'flute', arp: { n: 'glock', g: 0.6 }, pad: 'warmpad',
             bass: ['pizz', { n: 'sub', g: 0.7 }], kit: 'taiko', db: -1 },
    B:     { lead: ['harp', 'flute'], harm: { n: 'marimba', g: 0.5 }, counter: { n: 'bell', g: 0.8 }, arp: { n: 'glock', g: 0.45 },
             pad: ['warmpad', { n: 'choir', g: 0.9 }], bass: ['pizz', { n: 'sub', g: 0.8 }], kit: 'taiko', gong: true, swell: true, db: 1 },
    bridge:{ lead: 'harp', arp: { n: 'glock', g: 0.4 }, pad: { n: 'warmpad', g: 0.6 }, bass: { n: 'pizz', g: 0.5 }, db: -8 },
    callF: { lead: 'harp', harm: { n: 'marimba', g: 0.55 }, counter: 'flute', arp: { n: 'glock', g: 0.6 }, pad: 'warmpad',
             bass: ['pizz', { n: 'sub', g: 0.7 }], kit: 'taiko', gong: true, swell: true, db: 0 },
    outro: { lead: 'flute', arp: { n: 'glock', g: 0.5 }, pad: { n: 'warmpad', g: 0.7 }, bass: { n: 'pizz', g: 0.5 }, kit: 'taiko', gong: true, db: -7 },
  },
  // -------- Stage 4 road — string-led morning (vs S1's flute road): strMel + glock glints, no kit
  'First Light Road': {
    intro: { arp: 'glock', pad: { n: 'strSus', g: 0.7 }, bass: { n: 'pizz', g: 0.6 }, db: -5 },
    A:     { lead: 'strMel', arp: 'glock', pad: { n: 'strSus', g: 0.65 }, bass: 'pizz', db: -2 },
    A2:    { lead: 'strMel', harm: { n: 'clar', g: 0.9 }, arp: 'glock', pad: 'strSus', bass: 'pizz', sub: { n: 'sub', g: 0.6 }, db: -1 },
    B:     { lead: ['strMel', { n: 'horn', oct: -1, g: 0.7 }], counter: 'flute', arp: 'glock', pad: 'strSus', bass: 'arco',
             sub: { n: 'sub', g: 0.7 }, swell: true, timp: 'build', sparkle: true, db: 1 },
    bridge:{ lead: 'flute', arp: { n: 'glock', g: 0.6 }, pad: { n: 'strSus', g: 0.6 }, bass: { n: 'pizz', g: 0.5 }, db: -7 },
    A2b:   { lead: ['strMel', { n: 'flute', g: 0.8 }], harm: { n: 'clar', g: 0.9 }, counter: { n: 'horn', oct: -1, g: 0.7 },
             arp: 'glock', pad: 'strSus', bass: 'arco', sub: { n: 'sub', g: 0.7 }, swell: true, timp: 'build', db: 0 },
    outro: { lead: 'strMel', arp: { n: 'glock', g: 0.6 }, pad: { n: 'strSus', g: 0.6 }, bass: { n: 'arco', g: 0.7 }, db: -6 },
  },
  // -------- Stage 4 midboss — cold crone: hollow clar lead, marimba ticks, pizz-bone echo
  'The Gatekeeper': {
    intro: { arp: 'marimba', pad: { n: 'pad', g: 0.8 }, bass: { n: 'arco', g: 0.8 }, kit: true, db: -6 },
    A:     { lead: 'clar', counter: { n: 'pizz', g: 1.1 }, arp: { n: 'marimba', g: 0.7 }, pad: { n: 'pad', g: 0.7 },
             bass: 'arco', kit: true, db: -3 },
    A2:    { lead: ['clar', { n: 'oboe', g: 0.7 }], harm: { n: 'horn', g: 0.8 }, counter: { n: 'pizz', g: 1.1 },
             arp: 'marimba', pad: 'pad', bass: 'arco', sub: { n: 'sub', g: 0.6 }, kit: true, swell: true, db: 0 },
    B:     { lead: 'strMel', arp: { n: 'marimba', g: 0.7 }, pad: ['pad', { n: 'strSus', g: 0.6 }], bass: 'arco',
             sub: { n: 'sub', g: 0.7 }, kit: true, swell: true, db: 1 },
    bridge:{ lead: 'oboe', arp: { n: 'marimba', g: 0.6 }, pad: { n: 'warmpad', g: 0.6 }, bass: { n: 'arco', g: 0.7 }, db: -7 },
    outro: { lead: 'clar', arp: { n: 'marimba', g: 0.6 }, bass: { n: 'arco', g: 0.8 }, kit: true, db: -5 },
  },
  // -------- Stage 4 boss — sunrise anthem: brass + strings, choir floods the C-major climax
  'Daybreak': {
    intro: { lead: ['horn', { n: 'strMel', g: 0.7 }], harm: { n: 'clar', g: 0.9 }, arp: 'glock', pad: { n: 'strSus', g: 0.7 },
             bass: 'arco', sub: { n: 'sub', g: 0.7 }, kit: true, db: -4 },
    A1:    { lead: ['brass', { n: 'strMel', g: 0.8 }], arp: 'glock', pad: 'strSus', bass: 'arco', sub: { n: 'sub', g: 0.8 },
             kit: true, timp: 'soft', db: 0 },
    A2:    { lead: ['brass', { n: 'strMel', g: 0.8 }], harm: { n: 'horn', g: 0.9 }, counter: 'flute', arp: 'glock',
             pad: 'strSus', bass: 'arco', sub: { n: 'sub', g: 0.8 }, kit: true, timp: 'soft', swell: true, db: 1 },
    B:     { lead: ['strMel', { n: 'horn', oct: -1, g: 0.7 }], harm: { n: 'oboe', g: 0.8 }, counter: 'flute', arp: 'glock',
             pad: ['strSus', { n: 'choir', g: 0.6 }], bass: 'arco', sub: { n: 'sub', g: 0.8 }, kit: true, timp: 'build',
             swell: true, sparkle: true, db: 2 },
    bridge:{ lead: 'oboe', arp: { n: 'glock', g: 0.5 }, pad: { n: 'warmpad', g: 0.8 }, bass: { n: 'arco', g: 0.7 }, kit: true, db: -7 },
    climax:{ lead: ['brass', { n: 'strMel', g: 0.85 }], harm: 'horn', counter: { n: 'flute', g: 1.0 },
             arp: ['glock', { n: 'box', oct: 1, g: 0.4 }], pad: ['strSus', { n: 'choir', g: 0.85 }], bass: 'arco',
             sub: { n: 'sub', g: 0.85 }, kit: true, timp: 'build', swell: true, db: 3 },
    A3:    { lead: ['brass', { n: 'strMel', g: 0.8 }], harm: 'horn', counter: 'flute', arp: 'glock', pad: 'strSus',
             bass: 'arco', sub: { n: 'sub', g: 0.8 }, kit: true, timp: 'build', db: 2 },
    outro: { lead: ['horn', { n: 'strMel', g: 0.7 }], arp: { n: 'glock', g: 0.6 }, pad: { n: 'strSus', g: 0.7 },
             bass: { n: 'arco', g: 0.8 }, kit: true, db: -2 },
  },
  // -------- Stage 5 road — the storm road (only road with a kit): clar vortex, flute soar, brass gusts
  'Tempest Road': {
    intro: { lead: 'clar', arp: { n: 'harp', g: 0.8 }, pad: { n: 'strSus', g: 0.6 }, bass: 'arco', kit: true, db: -6 },
    A:     { lead: ['clar', { n: 'strMel', g: 0.55 }], counter: 'flute', arp: { n: 'harp', g: 0.8 }, pad: { n: 'strSus', g: 0.7 },
             bass: 'arco', sub: { n: 'sub', g: 0.6 }, kit: true, db: -3 },
    A2:    { lead: ['strMel', { n: 'clar', g: 0.7 }], harm: { n: 'horn', g: 0.8 }, counter: 'flute', arp: 'harp',
             pad: 'strSus', bass: 'arco', sub: { n: 'sub', g: 0.7 }, kit: true, swell: true, db: -1 },
    B:     { lead: ['strMel', { n: 'horn', oct: -1, g: 0.75 }], counter: { n: 'flute', g: 1.0 }, arp: { n: 'harp', g: 0.7 },
             pad: ['strSus', { n: 'choir', g: 0.5 }], bass: 'arco', sub: { n: 'sub', g: 0.75 }, kit: true, timp: 'build', swell: true, db: 1 },
    bridge:{ lead: 'oboe', arp: { n: 'harp', g: 0.6 }, pad: { n: 'warmpad', g: 0.7 }, bass: { n: 'arco', g: 0.7 }, db: -7 },
    A2b:   { lead: ['strMel', { n: 'clar', g: 0.7 }], harm: { n: 'horn', g: 0.8 }, counter: { n: 'flute', g: 1.0 }, arp: 'harp',
             pad: 'strSus', bass: 'arco', sub: { n: 'sub', g: 0.7 }, kit: true, timp: 'build', swell: true, db: 0 },
    outro: { lead: 'clar', arp: { n: 'harp', g: 0.7 }, pad: { n: 'strSus', g: 0.6 }, bass: { n: 'arco', g: 0.8 }, kit: true, db: -4 },
  },
  // -------- Stage 5 midboss — gusty stutter: darting oboe, teasing clar mimic, staccato pizz
  'Wind Gate': {
    intro: { arp: 'box', pad: { n: 'pad', g: 0.7 }, bass: { n: 'pizz', g: 0.9 }, kit: true, db: -6 },
    A:     { lead: 'oboe', counter: { n: 'clar', g: 1.1 }, arp: { n: 'box', g: 0.6 }, pad: { n: 'pad', g: 0.6 },
             bass: 'pizz', sub: { n: 'sub', g: 0.5 }, kit: true, db: -3 },
    A2:    { lead: ['oboe', { n: 'flute', g: 0.6 }], harm: { n: 'clar', g: 0.85 }, counter: { n: 'clar', g: 1.0 },
             arp: 'box', pad: 'pad', bass: 'arco', sub: { n: 'sub', g: 0.6 }, kit: true, swell: true, db: -1 },
    B:     { lead: ['flute', { n: 'strMel', g: 0.7 }], arp: { n: 'box', g: 0.6 }, pad: ['pad', { n: 'strSus', g: 0.55 }],
             bass: 'arco', sub: { n: 'sub', g: 0.7 }, kit: true, swell: true, db: 1 },
    bridge:{ lead: 'clar', arp: { n: 'box', g: 0.5 }, pad: { n: 'warmpad', g: 0.6 }, bass: { n: 'pizz', g: 0.6 }, db: -7 },
    outro: { lead: 'oboe', arp: { n: 'box', g: 0.5 }, bass: { n: 'pizz', g: 0.8 }, kit: true, db: -5 },
  },
  // -------- Stage 5 boss — storm brass + low strings; oboe = the answering serpent head; gong = Orochi
  'Yamata Coils': {
    intro: { lead: 'horn', harm: { n: 'clar', g: 0.9 }, arp: 'marimba', pad: { n: 'pad', g: 0.8 }, bass: 'arco',
             sub: { n: 'sub', g: 0.7 }, kit: true, gong: true, db: -4 },
    call:  { lead: 'brass', counter: 'oboe', arp: { n: 'marimba', g: 0.8 }, pad: { n: 'pad', g: 0.7 }, bass: 'arco',
             sub: { n: 'sub', g: 0.7 }, kit: true, db: -2 },
    callH: { lead: ['brass', { n: 'strMel', g: 0.6 }], harm: { n: 'horn', g: 0.85 }, counter: 'oboe', arp: 'marimba',
             pad: 'pad', bass: 'arco', sub: { n: 'sub', g: 0.8 }, kit: true, swell: true, db: 0 },
    B:     { lead: ['brass', { n: 'horn', oct: -1, g: 0.8 }], harm: { n: 'strMel', g: 0.7 }, counter: { n: 'clar', g: 1.0 },
             arp: { n: 'marimba', g: 0.7 }, pad: ['pad', { n: 'choir', g: 0.6 }], bass: 'arco', sub: { n: 'sub', g: 0.8 },
             kit: true, gong: true, swell: true, timp: 'build', db: 2 },
    bridge:{ lead: { n: 'horn', g: 0.9 }, arp: { n: 'marimba', g: 0.6 }, pad: { n: 'pad', g: 0.7 }, bass: { n: 'arco', g: 0.7 },
             sub: { n: 'sub', g: 0.6 }, kit: true, db: -6 },
    callF: { lead: ['brass', { n: 'strMel', g: 0.7 }], harm: { n: 'horn', g: 0.85 }, counter: 'oboe', arp: 'marimba',
             pad: 'pad', bass: 'arco', sub: { n: 'sub', g: 0.8 }, kit: true, gong: true, swell: true, timp: 'build', db: 1 },
    outro: { lead: 'horn', arp: { n: 'marimba', g: 0.6 }, pad: { n: 'pad', g: 0.6 }, bass: { n: 'arco', g: 0.8 }, kit: true, gong: true, db: -3 },
  },
  // -------- Stage 6 road — hushed eternal night: breathy flute, bell braziers, choir dark, sparse taiko
  'Tokoyo Road': {
    intro: { arp: { n: 'bell', g: 0.6 }, pad: { n: 'warmpad', g: 0.9 }, bass: { n: 'arco', g: 0.6 }, sub: { n: 'sub', g: 0.7 }, gong: true, db: -10 },
    A:     { lead: 'flute', arp: { n: 'bell', g: 0.55 }, pad: ['warmpad', { n: 'choir', g: 0.6 }], bass: { n: 'arco', g: 0.7 },
             sub: { n: 'sub', g: 0.8 }, kit: 'taiko', db: -7 },
    A2:    { lead: 'flute', harm: { n: 'clar', g: 0.8 }, arp: { n: 'bell', g: 0.55 }, pad: ['warmpad', { n: 'choir', g: 0.6 }],
             bass: { n: 'arco', g: 0.7 }, sub: { n: 'sub', g: 0.8 }, kit: 'taiko', db: -6 },
    B:     { lead: ['flute', { n: 'strMel', g: 0.6 }], counter: { n: 'horn', g: 0.8 }, arp: { n: 'bell', g: 0.5 },
             pad: ['warmpad', { n: 'choir', g: 0.7 }], bass: 'arco', sub: { n: 'sub', g: 0.85 }, kit: 'taiko', swell: true, db: -3 },
    bridge:{ lead: 'flute', arp: { n: 'bell', g: 0.5 }, pad: { n: 'warmpad', g: 0.8 }, bass: { n: 'arco', g: 0.6 }, db: -9 },
    A2b:   { lead: ['flute', { n: 'clar', g: 0.6 }], harm: { n: 'clar', g: 0.8 }, counter: { n: 'horn', g: 0.7 },
             arp: { n: 'bell', g: 0.55 }, pad: ['warmpad', { n: 'choir', g: 0.7 }], bass: 'arco', sub: { n: 'sub', g: 0.8 },
             kit: 'taiko', db: -5 },
    outro: { lead: 'flute', arp: { n: 'bell', g: 0.5 }, pad: { n: 'warmpad', g: 0.8 }, bass: { n: 'arco', g: 0.6 }, db: -9 },
  },
  // -------- Stage 6 midboss — the spider: marimba legs, plucked echo, dark supersaw cave
  'Chromatic Crawl': {
    intro: { arp: 'marimba', pad: { n: 'pad', g: 0.8 }, bass: 'arco', sub: { n: 'sub', g: 0.6 }, kit: true, db: -6 },
    A:     { lead: ['marimba', { n: 'clar', g: 0.7 }], counter: { n: 'pizz', g: 1.2 }, arp: { n: 'box', g: 0.5 },
             pad: { n: 'pad', g: 0.7 }, bass: 'arco', sub: { n: 'sub', g: 0.6 }, kit: true, db: -3 },
    A2:    { lead: ['marimba', { n: 'clar', g: 0.7 }], harm: { n: 'oboe', g: 0.75 }, counter: { n: 'pizz', g: 1.2 },
             arp: { n: 'box', g: 0.5 }, pad: 'pad', bass: 'arco', sub: { n: 'sub', g: 0.65 }, kit: true, swell: true, db: -1 },
    B:     { lead: ['strMel', { n: 'marimba', g: 0.6 }], arp: { n: 'box', g: 0.5 }, pad: ['pad', { n: 'strSus', g: 0.5 }],
             bass: 'arco', sub: { n: 'sub', g: 0.7 }, kit: true, swell: true, db: 0 },
    bridge:{ lead: 'clar', arp: { n: 'marimba', g: 0.6 }, pad: { n: 'pad', g: 0.6 }, bass: { n: 'arco', g: 0.7 }, db: -7 },
    outro: { lead: ['marimba', { n: 'clar', g: 0.6 }], arp: { n: 'box', g: 0.5 }, bass: { n: 'arco', g: 0.8 }, kit: true, db: -4 },
  },
  // -------- Stage 6 boss ACT I — krautrock night chase: synth band, Rhodes echoes, square motor
  'Motorik Dawn (ACT I — Night)': {
    intro: { lead: 'sawlead', harm: { n: 'epiano', g: 0.8 }, arp: { n: 'sqlead', g: 0.75 }, pad: { n: 'pad', g: 0.8 },
             bass: 'bass', sub: { n: 'sub', g: 0.85 }, kit: true, db: -4 },
    A1:    { lead: 'sawlead', arp: { n: 'sqlead', g: 0.75 }, pad: 'pad', bass: 'bass', sub: { n: 'sub', g: 0.9 },
             kit: true, db: -1 },
    A2:    { lead: 'sawlead', harm: { n: 'epiano', g: 0.7 }, counter: { n: 'epiano', g: 1.0 }, arp: { n: 'sqlead', g: 0.75 },
             pad: 'pad', bass: 'bass', sub: { n: 'sub', g: 0.9 }, kit: true, swell: true, db: 0 },
    B:     { lead: ['sawlead', { n: 'sqlead', g: 0.5 }], harm: { n: 'epiano', g: 0.7 }, counter: { n: 'epiano', g: 1.0 },
             arp: { n: 'sqlead', g: 0.75 }, pad: ['pad', { n: 'warmpad', g: 0.5 }], bass: 'bass', sub: { n: 'sub', g: 0.9 },
             kit: true, db: 1 },
  },
  // -------- Stage 6 boss ACT II — the same engine flooded with light: bells/glock/choir join
  'Motorik Dawn (ACT II — Sunrise)': {
    bridge:{ lead: 'sawlead', arp: { n: 'sqlead', g: 0.7 }, pad: { n: 'warmpad', g: 0.8 }, bass: 'bass',
             sub: { n: 'sub', g: 0.8 }, kit: true, db: -4 },
    climax:{ lead: ['sawlead', { n: 'bell', oct: 1, g: 0.3 }], harm: { n: 'epiano', g: 0.75 }, counter: { n: 'sqlead', g: 0.95 },
             arp: ['sqlead', { n: 'glock', g: 0.5 }], pad: ['pad', { n: 'choir', g: 0.8 }], bass: 'bass',
             sub: { n: 'sub', g: 0.95 }, kit: true, swell: true, db: 2 },
    A3:    { lead: ['sawlead', { n: 'bell', oct: 1, g: 0.25 }], harm: { n: 'epiano', g: 0.75 }, counter: { n: 'sqlead', g: 0.9 },
             arp: { n: 'sqlead', g: 0.75 }, pad: ['pad', { n: 'choir', g: 0.6 }], bass: 'bass', sub: { n: 'sub', g: 0.9 },
             kit: true, db: 1 },
    outro: { lead: ['sawlead', { n: 'glock', oct: 1, g: 0.4 }], arp: { n: 'sqlead', g: 0.6 }, pad: ['pad', { n: 'choir', g: 0.5 }],
             bass: { n: 'bass', g: 0.9 }, sub: { n: 'sub', g: 0.8 }, kit: true, swell: true, db: 0 },
  },
};
// tracks without an ORCH entry: neutral synth-band mapping for every section
const ORCH_FALLBACK = {
  lead: 'sawlead', harm: { n: 'horn', g: 0.9 }, counter: { n: 'clar', g: 1.25 }, arp: { n: 'marimba', g: 0.9 },
  bass: 'bass', sub: { n: 'sub', g: 0.85 }, pad: 'pad', kit: true, db: 0,
};

function normRoute(r) {
  if (r == null) return null;
  const a = Array.isArray(r) ? r : [r];
  const out = [];
  for (let i = 0; i < a.length; i++) {
    const e = a[i];
    out.push(typeof e === 'string' ? { n: e, oct: 0, g: 1 } : { n: e.n, oct: e.oct || 0, g: e.g == null ? 1 : e.g });
  }
  return out.length ? out : null;
}
function normSec(src) {
  return {
    lead: normRoute(src.lead), harm: normRoute(src.harm), counter: normRoute(src.counter), arp: normRoute(src.arp),
    bass: normRoute(src.bass), sub: normRoute(src.sub), pad: normRoute(src.pad),
    kit: src.kit || false, db: src.db != null ? src.db : 0,
    swell: !!src.swell, gong: !!src.gong, timp: src.timp || null, sparkle: !!src.sparkle,
  };
}

function compile(track) {
  if (track._compiled) return track._compiled;
  const step16 = 60 / track.bpm / 4;

  const lanes = {};
  for (const ln of MELODIC_LANES) {
    const notes = laneFromSections(track, ln);
    lanes[ln] = { notes, gate: computeGates(notes, GATE_CAPS[ln]) };
  }
  const totalSteps = lanes.lead.notes.length;

  // pad chords: flatten, then hold each chord until the next non-null chord (wrapping)
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
    kick: laneFromSections(track, 'kick'),
    snare: laneFromSections(track, 'snare'),
    hat: laneFromSections(track, 'hat'),
    crash: laneFromSections(track, 'crash'),
  };

  // resolve orchestration per arrangement slot -> per-step section objects
  const table = ORCH[track.title] || null;
  const orchByName = {};
  const secOf = new Array(totalSteps);
  const secStarts = new Map();
  {
    let w = 0;
    for (const secName of track.arrangement) {
      const len = track.sections[secName].bars * 16;
      if (!orchByName[secName]) orchByName[secName] = normSec((table && (table[secName] || table['*'])) || ORCH_FALLBACK);
      secStarts.set(w, orchByName[secName]);
      for (let i = 0; i < len; i++) secOf[w++] = orchByName[secName];
    }
  }

  track._compiled = { totalSteps, step16, bpm: track.bpm, lanes, pad, drums, secOf, secStarts };
  return track._compiled;
}

// ---- lazy node graph (master chain, sends, strips) -------------------------
let bgG = null;          /* graph singleton; rebuilt if ctx identity ever changes */
let bgStrips = null;
let bgLastDst = null, bgLastC = null, bgLastBass = 45;
// calibration (A/B-measured vs the v1 engine at the demo analyser): DRIVE pushes
// the bus into the glue comp like compose's near-full-scale chain; TRIM lands the
// final level ≈ old-engine loudness into musicGain.
const BG_DRIVE = 3.0, BG_TRIM = 0.65;

function dbLin(db) { return Math.pow(10, db / 20); }

// procedural hall IR: stereo noise burst with smooth power decay, slight predelay
function bgMakeIR(seconds) {
  const rate = ctx.sampleRate, pre = (rate * 0.03) | 0, len = (rate * seconds) | 0;
  const buf = ctx.createBuffer(2, len, rate);
  for (let chn = 0; chn < 2; chn++) {
    const d = buf.getChannelData(chn);
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / (len - pre);
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.8);
    }
  }
  return buf;
}

function bgGraph() {
  if (bgG && bgG.ctx === ctx) return bgG;
  // expr bus: per-section dynamics arc rides this gain (dB from ORCH db)
  const expr = ctx.createGain(); expr.gain.value = 1;
  const eqLo = ctx.createBiquadFilter(); eqLo.type = 'lowshelf'; eqLo.frequency.value = 200; eqLo.gain.value = 1;
  const eqMid = ctx.createBiquadFilter(); eqMid.type = 'peaking'; eqMid.frequency.value = 1200; eqMid.Q.value = 0.7; eqMid.gain.value = -1;
  const eqHi = ctx.createBiquadFilter(); eqHi.type = 'highshelf'; eqHi.frequency.value = 3400; eqHi.gain.value = 1.5;
  const glue = ctx.createDynamicsCompressor();
  glue.threshold.value = -20; glue.knee.value = 12; glue.ratio.value = 2.2; glue.attack.value = 0.02; glue.release.value = 0.25;
  const pre = ctx.createGain(); pre.gain.value = BG_DRIVE;
  const out = ctx.createGain(); out.gain.value = BG_TRIM;
  expr.connect(eqLo); eqLo.connect(eqMid); eqMid.connect(eqHi); eqHi.connect(pre); pre.connect(glue); glue.connect(out);
  // hall reverb send (IR built once per ctx)
  const hallIn = ctx.createGain(); hallIn.gain.value = 1;
  const conv = ctx.createConvolver(); conv.buffer = bgMakeIR(2.9);
  const hallOut = ctx.createGain(); hallOut.gain.value = 1;
  hallIn.connect(conv); conv.connect(hallOut); hallOut.connect(expr);
  // ping-pong delay send (two cross-fed delays, fb 0.22; time set per track bpm)
  const dlyIn = ctx.createGain(); dlyIn.gain.value = 1;
  const dL = ctx.createDelay(2.0), dR = ctx.createDelay(2.0);
  dL.delayTime.value = 0.4; dR.delayTime.value = 0.4;
  const fbL = ctx.createGain(), fbR = ctx.createGain(); fbL.gain.value = 0.22; fbR.gain.value = 0.22;
  dlyIn.connect(dL); dL.connect(fbL); fbL.connect(dR); dR.connect(fbR); fbR.connect(dL);
  const pnL = ctx.createStereoPanner(), pnR = ctx.createStereoPanner(); pnL.pan.value = -0.55; pnR.pan.value = 0.55;
  const dlyOut = ctx.createGain(); dlyOut.gain.value = 0.9;
  dL.connect(pnL); pnL.connect(dlyOut); dR.connect(pnR); pnR.connect(dlyOut); dlyOut.connect(expr);
  // own noise buffer for KS excitation (host noiseBuf is not a contract symbol)
  const ksBuf = ctx.createBuffer(1, (ctx.sampleRate * 0.5) | 0, ctx.sampleRate);
  { const d = ksBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  bgStrips = {};
  bgLastDst = null; bgLastC = null;
  bgG = { ctx, expr, out, hallIn, dlyIn, dL, dR, ksBuf, ksCache: {} };
  return bgG;
}

// per-voice channel strip: in -> [chorus] -> [static filter] -> pan -> vol -> expr (+ sends)
function bgStrip(name) {
  const G = bgGraph();
  let st = bgStrips[name];
  if (st) return st;
  const d = VOICE_DEFS[name];
  const inG = ctx.createGain(); inG.gain.value = 1;
  let head = inG;
  if (d.chorus) {
    const c = d.chorus;
    const mix = ctx.createGain();
    const dry = ctx.createGain(); dry.gain.value = 1 - c.wet;
    const wet = ctx.createGain(); wet.gain.value = c.wet;
    const dl = ctx.createDelay(0.05); dl.delayTime.value = c.ms / 1000;
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = c.f;
    const lg = ctx.createGain(); lg.gain.value = (c.ms / 1000) * c.depth * 0.45;
    lfo.connect(lg); lg.connect(dl.delayTime); lfo.start();
    head.connect(dry); dry.connect(mix);
    head.connect(dl); dl.connect(wet); wet.connect(mix);
    head = mix;
  }
  if (d.flt) {
    const bq = ctx.createBiquadFilter();
    bq.type = d.flt.type; bq.frequency.value = d.flt.f;
    if (d.flt.q != null) bq.Q.value = d.flt.q;
    head.connect(bq); head = bq;
  }
  const pan = ctx.createStereoPanner(); pan.pan.value = d.pan || 0;
  const vol = ctx.createGain(); vol.gain.value = dbLin(d.vol || 0);
  head.connect(pan); pan.connect(vol); vol.connect(G.expr);
  if (d.rev) { const rg = ctx.createGain(); rg.gain.value = d.rev; vol.connect(rg); rg.connect(G.hallIn); }
  if (d.dly) { const dg = ctx.createGain(); dg.gain.value = d.dly; vol.connect(dg); dg.connect(G.dlyIn); }
  st = { in: inG };
  bgStrips[name] = st;
  return st;
}

// exp ADSR on an AudioParam; returns the time the voice may be stopped.
// sus≈0 -> pure strike (peak then full exp decay, dur ignored, Tone-style).
function bgEnv(param, t0, peak, e, dur) {
  const a = e[0], dc = e[1], s = e[2], r = e[3], FL = 0.0001;
  peak = Math.max(0.0002, peak);
  param.setValueAtTime(FL, t0);
  param.exponentialRampToValueAtTime(peak, t0 + a);
  if (s < 0.005) {
    param.exponentialRampToValueAtTime(FL, t0 + a + dc);
    return t0 + a + dc + 0.03;
  }
  const sl = Math.max(0.0002, peak * s);
  param.exponentialRampToValueAtTime(sl, t0 + a + dc);
  const relAt = Math.max(t0 + a + dc, t0 + (dur != null ? dur : a + dc));
  param.setValueAtTime(sl, relAt);
  param.exponentialRampToValueAtTime(FL, relAt + r);
  return relAt + r + 0.03;
}

// ---- note players per kind -------------------------------------------------
function bgFM(d, freq, dur, t0, vel, st) {
  const car = ctx.createOscillator(); car.type = 'sine'; car.frequency.value = freq;
  const mod = ctx.createOscillator(); mod.type = 'sine'; mod.frequency.value = freq * d.h;
  const mg = ctx.createGain();
  bgEnv(mg.gain, t0, freq * d.mi, d.menv, dur);
  mod.connect(mg); mg.connect(car.frequency);
  const amp = ctx.createGain();
  const stop = bgEnv(amp.gain, t0, vel, d.env, dur);
  car.connect(amp); amp.connect(st.in);
  car.start(t0); mod.start(t0); car.stop(stop); mod.stop(stop);
  car.onended = function () { try { mod.disconnect(); mg.disconnect(); car.disconnect(); amp.disconnect(); } catch (e) {} };
}

function bgOsc(d, freq, dur, t0, vel, st) {
  const cnt = d.count || 1, spread = d.spread || 0;
  const amp = ctx.createGain();
  const stop = bgEnv(amp.gain, t0, vel / cnt, d.env, dur);
  let dest = amp, bq = null;
  if (d.fenv) {
    const fe = d.fenv;
    bq = ctx.createBiquadFilter(); bq.type = 'lowpass';
    if (fe.q != null) bq.Q.value = fe.q;
    const top = fe.base * Math.pow(2, fe.oct), sus = fe.base * Math.pow(2, fe.oct * fe.s);
    bq.frequency.setValueAtTime(fe.base, t0);
    bq.frequency.exponentialRampToValueAtTime(top, t0 + fe.a);
    bq.frequency.exponentialRampToValueAtTime(Math.max(50, sus), t0 + fe.a + fe.d);
    const relAt = Math.max(t0 + fe.a + fe.d, t0 + (dur != null ? dur : 0));
    bq.frequency.setValueAtTime(Math.max(50, sus), relAt);
    bq.frequency.exponentialRampToValueAtTime(Math.max(50, fe.base), relAt + fe.r);
    bq.connect(amp); dest = bq;
  }
  let vib = null, vg = null;
  if (d.vib) {
    vib = ctx.createOscillator(); vib.type = 'sine'; vib.frequency.value = d.vib.f;
    vg = ctx.createGain(); vg.gain.value = d.vib.d * 180; /* Tone depth -> cents */
    vib.connect(vg); vib.start(t0); vib.stop(stop);
  }
  const oscs = [];
  for (let i = 0; i < cnt; i++) {
    const o = ctx.createOscillator(); o.type = d.type; o.frequency.value = freq;
    if (cnt > 1) o.detune.value = -spread / 2 + spread * (i / (cnt - 1));
    if (vg) vg.connect(o.detune);
    o.connect(dest); o.start(t0); o.stop(stop);
    oscs.push(o);
  }
  amp.connect(st.in);
  oscs[0].onended = function () {
    try {
      for (let i = 0; i < oscs.length; i++) oscs[i].disconnect();
      if (vib) { vib.disconnect(); vg.disconnect(); }
      if (bq) bq.disconnect();
      amp.disconnect();
    } catch (e) {}
  };
}

// Karplus-Strong rendered offline in JS (exact pitch — a realtime DelayNode
// cycle is clamped to one render quantum), cached per (voice, pitch).
function bgKSRender(d, freq) {
  const rate = ctx.sampleRate, per = 1 / freq;
  const ring = Math.min(2.4, 0.18 + 190 * per);
  const len = (rate * ring) | 0;
  const buf = ctx.createBuffer(1, len, rate);
  const o = buf.getChannelData(0);
  const N = Math.max(2, Math.round(rate / freq));
  const r = new Float32Array(N);
  const amp0 = 0.45 + 0.85 * d.aN;
  for (let i = 0; i < N; i++) r[i] = (Math.random() * 2 - 1) * amp0;
  const a = 1 - Math.exp(-6.2832 * d.damp / rate);
  let lpS = 0, idx = 0;
  for (let i = 0; i < len; i++) {
    const x = r[idx];
    lpS += a * (x - lpS);
    r[idx] = lpS * d.res;
    o[i] = x;
    idx = (idx + 1) % N;
  }
  return buf;
}
function bgKS(name, d, freq, dur, t0, vel, st) {
  const G = bgGraph();
  const key = name + '|' + Math.round(freq * 8);
  let buf = G.ksCache[key];
  if (!buf) buf = G.ksCache[key] = bgKSRender(d, freq);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const g = ctx.createGain(); g.gain.value = vel;
  src.connect(g); g.connect(st.in);
  src.start(t0);
  src.onended = function () { try { src.disconnect(); g.disconnect(); } catch (e) {} };
}

function bgMem(d, freq, dur, t0, vel, st) {
  const o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(Math.max(30, freq) * Math.pow(2, d.oct), t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(25, freq), t0 + d.pd);
  const amp = ctx.createGain();
  const stop = bgEnv(amp.gain, t0, vel, d.env, dur);
  o.connect(amp); amp.connect(st.in);
  o.start(t0); o.stop(stop);
  o.onended = function () { try { o.disconnect(); amp.disconnect(); } catch (e) {} };
}

function bgNoiseHit(d, t0, vel, st) { noise({ dest: st.in, t0: t0, peak: vel, atk: d.env[0], dur: d.env[0] + d.env[1] }); }

function bgPlay(name, freq, dur, t0, vel) {
  if (!ctx) return;
  const d = VOICE_DEFS[name];
  if (!d) return;
  const st = bgStrip(name);
  if (d.kind === 'fm') bgFM(d, freq, dur, t0, vel, st);
  else if (d.kind === 'osc') bgOsc(d, freq, dur, t0, vel, st);
  else if (d.kind === 'ks') bgKS(name, d, freq, dur, t0, vel, st);
  else if (d.kind === 'mem') bgMem(d, freq, dur, t0, vel, st);
  else if (d.kind === 'noise') bgNoiseHit(d, t0, vel, st);
}

function bgRoute(r, midi, du, t0, vel) {
  if (!r) return;
  for (let i = 0; i < r.length; i++) { const e = r[i]; bgPlay(e.n, mtof(midi + 12 * e.oct), du, t0, vel * e.g); }
}
function bgRoutePad(r, notes, du, t0, vel) {
  if (!r) return;
  const n = Math.min(4, notes.length); /* pad polyphony cap (iPad target) */
  for (let i = 0; i < r.length; i++) {
    const e = r[i];
    for (let k = 0; k < n; k++) bgPlay(e.n, mtof(notes[k] + 12 * e.oct), du, t0, vel * e.g);
  }
}

function bgSectionEnter(sec, when) {
  const G = bgGraph();
  G.expr.gain.setTargetAtTime(dbLin(sec.db), when, 0.45);
  if (sec.swell) bgPlay('swell', 0, 1.4, when, 0.5);
  if (sec.gong) bgPlay('gong', mtof(40), 3.5, when, 0.6);
}

// ---- the scheduler: one 16th step `s` of compiled track `C` at ctx time `when`
function scheduleTrackStep(C, dst, s, when) {
  if (!ctx) return;
  const G = bgGraph();
  if (dst !== bgLastDst) {
    try { G.out.disconnect(); } catch (e) {}
    G.out.connect(dst);
    if (bgLastDst) {
      // restartMusic replaced musicGain: dip our output so ringing tails of the
      // old bus epoch don't bleed into the fresh one (new notes start >= +0.08s)
      const t = now();
      G.out.gain.cancelScheduledValues(t);
      G.out.gain.setValueAtTime(0.0001, t);
      G.out.gain.exponentialRampToValueAtTime(BG_TRIM, t + 0.06);
    }
    bgLastDst = dst;
  }
  if (C !== bgLastC) {
    const dt = Math.min(1.9, 1.5 * 60 / C.bpm); /* dotted-quarter ping-pong */
    G.dL.delayTime.setTargetAtTime(dt, now(), 0.05);
    G.dR.delayTime.setTargetAtTime(dt, now(), 0.05);
    bgLastC = C;
  }
  const secStart = C.secStarts.get(s);
  if (secStart) bgSectionEnter(secStart, when);
  const O = C.secOf[s], st16 = C.step16;
  if (s & 1) when += st16 * 0.05; /* light swing on off-16ths (compose feel) */

  const p = C.pad[s];
  if (p && O.pad) bgRoutePad(O.pad, p.notes, Math.max(0.04, p.hold * st16 * 0.98), when, 0.42);

  const bN = C.lanes.bass.notes[s];
  if (bN) {
    bgLastBass = bN;
    if (O.bass) bgRoute(O.bass, bN, Math.max(0.04, C.lanes.bass.gate[s] * st16 * 0.9), when, s % 16 === 0 ? 0.9 : (s % 4 === 0 ? 0.8 : 0.68));
  }
  const sN = C.lanes.sub.notes[s];
  if (sN && O.sub) bgRoute(O.sub, sN, Math.max(0.04, C.lanes.sub.gate[s] * st16 * 0.95), when, 0.75);

  const aN = C.lanes.arp.notes[s];
  if (aN && O.arp) bgRoute(O.arp, aN, Math.max(0.04, C.lanes.arp.gate[s] * st16 * 0.7), when, 0.42 + (s % 4 === 0 ? 0.06 : 0));

  const lN = C.lanes.lead.notes[s], lG = C.lanes.lead.gate[s];
  if (lN && O.lead) {
    const v = 0.6 + (s % 16 === 0 ? 0.22 : (s % 4 === 0 ? 0.12 : 0)) + (lG >= 4 ? 0.05 : 0);
    bgRoute(O.lead, lN, Math.max(0.04, lG * st16 * 0.95), when, v);
    if (O.sparkle && lG >= 5) bgPlay('box', mtof(lN + 12), 1.0, when, 0.3);
  }
  const hN = C.lanes.harm.notes[s];
  if (hN && O.harm) bgRoute(O.harm, hN, Math.max(0.04, C.lanes.harm.gate[s] * st16 * 0.92), when, 0.4);
  const cN = C.lanes.counter.notes[s];
  if (cN && O.counter) bgRoute(O.counter, cN, Math.max(0.04, C.lanes.counter.gate[s] * st16 * 0.92), when, 0.42);

  if (O.timp && s % 16 === 0) {
    const every = O.timp === 'build' ? 1 : 2;
    if (Math.floor(s / 16) % every === 0) bgPlay('timp', mtof(bgLastBass - 12), 0.4, when, s % 32 === 0 ? 0.7 : 0.5);
  }

  if (O.kit === 'taiko') {
    if (C.drums.kick[s]) bgPlay('taiko', mtof(31), 0.6, when, s % 16 === 0 ? 1 : 0.8);
    if (C.drums.snare[s]) bgPlay('rim', 0, 0.12, when, 0.75);
    const h = C.drums.hat[s];
    if (h) bgPlay('tick', 0, 0.05, when, h === 2 ? 0.6 : 0.42);
    if (C.drums.crash[s]) bgPlay('gong', mtof(40), 3.5, when, 0.5);
  } else if (O.kit) {
    if (C.drums.kick[s]) bgPlay('kick', mtof(36), 0.3, when, s % 16 === 0 ? 1 : 0.85);
    if (C.drums.snare[s]) bgPlay('snare', 0, 0.2, when, 0.8);
    const h = C.drums.hat[s];
    if (h === 2) bgPlay('hatO', 0, 0.18, when, 0.5);
    else if (h === 1) bgPlay('hatC', 0, 0.05, when, s % 4 === 2 ? 0.5 : 0.42);
    if (C.drums.crash[s]) bgPlay('crash', 0, 0.6, when, 0.6);
  }
}
