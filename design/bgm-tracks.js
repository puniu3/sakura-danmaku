// ===================== bgm-tracks.js =====================
// The three composed BGM tracks (stage / midboss / boss), built from the
// theory-verified blueprints. Authored via a small music-theory builder so the
// source stays compact and correct; melodies (the lead/counter "art") are
// hand-placed from the verified motifs, while pad/bass/arp/drums are generated
// from chord-per-bar progressions.
//
// Pure data + builders — NO audio API used here, so it runs in Node for
// validation (`node design/bgm-tracks.js`): checks lane lengths and in-key.
// Inlined (with bgm-engine.js) into bgm-demo.html and index.html.

// ---------------------------------------------------------------- theory
const PC = { C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11 };
const SCALES = {
  Amin:  [0,2,4,5,7,9,11],   // A natural minor: A B C D E F G
  Aharm: [0,2,4,5,8,9,11],   // A harmonic minor: A B C D E F G#
  Charm: [0,2,3,5,7,8,11],   // C harmonic minor: C D Eb F G Ab B
  Dharm: [1,2,4,5,7,9,10],   // D harmonic minor: D E F G A Bb C#   (Stage 2 road)
  Dphryg:[0,2,3,5,7,9,10],   // D Phrygian: D Eb F G A Bb C   (Stage 2 boss "Threshold Pursuit" — b2, no leading tone)
  Ehira: [0,4,6,7,11],       // E hirajoshi: E F# G B C   (Stage 3 road "Take-no-Komichi" — 和 pentatonic)
  Ein:   [0,4,5,9,11],       // E In / 都節 (Miyako-bushi): E F A B C   (Stage 3 boss "Mirror of Two Moons")
};
function parseChord(sym) {
  let bass = null, s = sym;
  const sl = s.indexOf('/'); if (sl >= 0) { bass = PC[s.slice(sl + 1)]; s = s.slice(0, sl); }
  const m = s.match(/^([A-G][#b]?)(.*)$/); const root = PC[m[1]]; const q = m[2];
  let iv;
  if (q === '' || q === 'maj') iv = [0,4,7];
  else if (q === 'm' || q === 'min') iv = [0,3,7];
  else if (q === 'dim' || q === 'o' || q === '°') iv = [0,3,6];
  else if (q === 'aug' || q === '+') iv = [0,4,8];
  else if (q === '7') iv = [0,4,7,10];
  else if (q === 'maj7') iv = [0,4,7,11];
  else if (q === 'm7') iv = [0,3,7,10];
  else if (q === 'sus4' || q === 'sus') iv = [0,5,7];
  else if (q === 'sus2') iv = [0,2,7];
  else if (q === '6') iv = [0,4,7,9];
  else if (q === 'm6') iv = [0,3,7,9];
  else if (q === 'dim7') iv = [0,3,6,9];
  else iv = [0,4,7];
  return { triad: iv.map(i => (root + i) % 12), root: root, bass: bass == null ? root : bass };
}
// pad voicing: cluster chord tones into a tight mid register (MIDI ~55-67) so
// supersaw pads glide smoothly; the bass carries the actual root low.
function voicePad(sym) {
  return parseChord(sym).triad.map(pc => { let n = pc + 48; if (n < 55) n += 12; return n; });
}
function bassRoot(sym) { return parseChord(sym).bass + 36; } // octave 2: A2=45
// ascending arp tones: root, 3rd, 5th (+octave) from a chord, around MIDI 60-84
function arpAsc(sym) {
  const tri = parseChord(sym).triad; let prev = -1; const t = [];
  for (let j = 0; j < 3; j++) { let n = tri[j % tri.length] + 60; while (n <= prev) n += 12; t.push(n); prev = n; }
  t.push(t[0] + 12); return t;
}
// move `deg` diatonic scale-degrees from a MIDI note within `scalePcs`
function dShift(midi, scalePcs, deg) {
  const pc = ((midi % 12) + 12) % 12;
  let idx = scalePcs.indexOf(pc);
  if (idx < 0) { let bd = 99; for (let i = 0; i < scalePcs.length; i++) { const d = Math.abs(scalePcs[i] - pc); if (d < bd) { bd = d; idx = i; } } }
  const oct = Math.floor(midi / 12);
  let ni = idx + deg, no = oct;
  while (ni < 0) { ni += scalePcs.length; no--; }
  while (ni >= scalePcs.length) { ni -= scalePcs.length; no++; }
  return no * 12 + scalePcs[ni];
}

// ---------------------------------------------------------------- patterns
function bassBar(sym, nextSym, style) {
  const r = bassRoot(sym), fifth = r + 7, oct = r + 12, nr = bassRoot(nextSym), appr = nr - 1;
  const a = new Array(16).fill(0);
  switch (style) {
    case 'whole': a[0] = r; break;
    case 'half': a[0] = r; a[8] = r; break;
    case 'pumpQ': a[0] = r; a[4] = fifth; a[8] = r; a[12] = fifth; break;
    case 'pump8': for (let i = 0; i < 16; i += 2) a[i] = ((i % 4) === 0) ? r : fifth; a[14] = appr; break;
    case 'walk8': a[0]=r; a[2]=r; a[4]=fifth; a[6]=r; a[8]=oct; a[10]=fifth; a[12]=r; a[14]=appr; break;
    case 'gallop': [0,4,8,12].forEach(b => { a[b]=r; a[b+2]=r; a[b+3]=(b===12?appr:r); }); break;
    case 'drive8': for (let i = 0; i < 16; i += 2) a[i] = r; a[8] = oct; a[14] = appr; break;
    case 'sparseRoot': a[0]=r; a[6]=r; a[10]=fifth; break;   // breathing 和-feel (Stage 3 boss "Mirror of Two Moons")
    case 'motorPedal': for (let i = 0; i < 16; i += 2) a[i] = r; a[8] = oct; break;   // relentless straight-8th root pedal (Stage 2 boss "Threshold Pursuit")
    default: a[0] = r; a[8] = r;
  }
  return a;
}
function drumBar(g) {
  const k = new Array(16).fill(0), s = new Array(16).fill(0), h = new Array(16).fill(0);
  switch (g) {
    case 'none': break;
    case 'introTick': k[0] = 1; [0,4,8,12].forEach(i => h[i] = 1); break;
    case 'four': [0,4,8,12].forEach(i => k[i]=1); [4,12].forEach(i => s[i]=1); for (let i=0;i<16;i++) h[i] = (i%4===2)?2:(i%2===0?1:0); break;
    case 'fourLite': [0,8].forEach(i => k[i]=1); [4,12].forEach(i => s[i]=1); for (let i=0;i<16;i+=2) h[i] = (i%4===2)?2:1; break;
    case 'halfTime': [0,8].forEach(i => k[i]=1); s[8]=1; for (let i=0;i<16;i+=4) h[i]=1; break;
    case 'midGroove': [0,8].forEach(i => k[i]=1); k[15]=1; [4,12].forEach(i => s[i]=1); for (let i=0;i<16;i++) h[i] = (i%4===2)?2:1; break;
    case 'midGallop': [0,3,8,11].forEach(i => k[i]=1); [4,12].forEach(i => s[i]=1); for (let i=0;i<16;i++) h[i] = (i===14?2:1); break;
    case 'bossDrive': [0,6,8,14].forEach(i => k[i]=1); [4,12].forEach(i => s[i]=1); for (let i=0;i<16;i++) h[i] = (i===14?2:1); break;
    case 'bossClimax': for (let i=0;i<16;i+=2) k[i]=1; [4,12].forEach(i => s[i]=1); s[15]=1; for (let i=0;i<16;i++) h[i]=1; break;
    case 'bossBridge': [0,8].forEach(i => k[i]=1); [4,12].forEach(i => s[i]=1); break;
    // ---- Stage 3 boss "Mirror of Two Moons": sparse 和太鼓 boom-bap (half-time ritual pulse) ----
    case 'taikoBoomBap': k[0]=1; k[10]=1; s[8]=1; h[4]=1; h[12]=2; break;
    // ---- its fuller antiphonal "call" section (still 和-spacious, not a rock beat) ----
    case 'taikoCall':    k[0]=1; k[6]=1; k[10]=1; s[4]=1; s[12]=1; h[2]=1; h[8]=2; h[14]=1; break;
    // ---- Stage 2 boss "Threshold Pursuit": relentless motorik (four-on-floor + straight-8th hats) ----
    case 'motorik':       [0,4,8,12].forEach(i=>k[i]=1); k[10]=1; [4,12].forEach(i=>s[i]=1); for (let i=0;i<16;i+=2) h[i]=1; break;
    case 'motorikClimax': for (let i=0;i<16;i+=2) k[i]=1; [4,12].forEach(i=>s[i]=1); s[7]=1; s[15]=1; for (let i=0;i<16;i++) h[i]=1; break;
    default: break;
  }
  return { k, s, h };
}

// ---------------------------------------------------------------- assembler
// makeSection({ bars, chords:[..bars], scale, lead:[[step,midi]..], harm, counter,
//   bassStyle, arpRate(0=off), groove, crash, sub, padPerBar })
function makeSection(spec) {
  const bars = spec.bars, L = bars * 16, chords = spec.chords;
  const chordsLane = new Array(L).fill(null);
  for (let b = 0; b < bars; b++) {
    if (spec.padPerBar || b === 0 || chords[b] !== chords[b - 1]) chordsLane[b * 16] = voicePad(chords[b]);
  }
  const bass = new Array(L).fill(0), sub = new Array(L).fill(0);
  for (let b = 0; b < bars; b++) {
    const bb = bassBar(chords[b], chords[(b + 1) % bars], spec.bassStyle || 'half');
    for (let i = 0; i < 16; i++) if (bb[i]) bass[b * 16 + i] = bb[i];
    if (spec.sub) sub[b * 16] = bassRoot(chords[b]) - 12;
  }
  const arp = new Array(L).fill(0);
  if (spec.arpRate) {
    for (let b = 0; b < bars; b++) {
      const tones = arpAsc(chords[b]);
      const cyc = [tones[0], tones[1], tones[2], tones[3], tones[2], tones[1]];
      let k = 0;
      for (let i = 0; i < 16; i += spec.arpRate) { arp[b * 16 + i] = cyc[k % cyc.length]; k++; }
    }
  }
  const lead = new Array(L).fill(0);
  if (spec.lead) for (const [st, n] of spec.lead) if (st >= 0 && st < L) lead[st] = n;
  const harm = new Array(L).fill(0);
  if (spec.harm && spec.scale) for (let i = 0; i < L; i++) if (lead[i]) harm[i] = dShift(lead[i], SCALES[spec.scale], -2);
  const counter = new Array(L).fill(0);
  if (Array.isArray(spec.counter)) { for (const [st, n] of spec.counter) if (st >= 0 && st < L) counter[st] = n; }   // independent answer phrase (key-checked like lead) — the antiphonal Stage-3 boss "duet"
  else if (spec.counter) for (let i = 0; i < L; i++) { if (lead[i]) { const t = i + 2; if (t < L && !lead[t]) counter[t] = lead[i] - 12; } }
  const kick = new Array(L).fill(0), snare = new Array(L).fill(0), hat = new Array(L).fill(0), crash = new Array(L).fill(0);
  for (let b = 0; b < bars; b++) {
    const d = drumBar(spec.groove || 'none');
    for (let i = 0; i < 16; i++) { if (d.k[i]) kick[b*16+i]=1; if (d.s[i]) snare[b*16+i]=1; if (d.h[i]) hat[b*16+i]=d.h[i]; }
  }
  if (spec.crash) crash[0] = 1;
  return { bars, chords: chordsLane, bass, sub, arp, lead, harm, counter, kick, snare, hat, crash, _scale: spec.scale || null };
}
function off(base, list) { return list.map(([s, n]) => [base + s, n]); }
function cat() { const out = []; for (let i = 0; i < arguments.length; i++) out.push.apply(out, arguments[i]); return out; }

// ================================================================ STAGE
// "Sunny Petal March" — A natural minor (+ relative C lift), 112 BPM.
const STAGE_HOOK = [
  [0,69],[4,71],[6,72],[8,76],[12,74],[14,72],
  [16,69],[20,67],[24,72],
  [32,77],[36,76],[38,74],[40,72],[42,71],[44,69],
  [48,76],[50,79],[52,77],[54,76],[56,74],[58,72],[60,69],
];
const STAGE_HOOK2 = [ // variation tail, hangs on E for the half-cadence
  [0,69],[4,71],[6,72],[8,76],[12,74],[14,72],
  [16,69],[24,72],
  [32,77],[36,76],[40,72],[44,69],
  [48,72],[52,74],[56,76],[60,76],
];
const STAGE_B = [ // 8-bar soaring lift, upper register, A natural minor
  [0,84],[4,83],[6,81],[8,79],[12,76],
  [16,79],[20,81],[24,83],[28,84],
  [32,81],[36,79],[40,76],[44,72],
  [48,76],[52,79],[56,76],[60,74],
  [64,77],[68,76],[72,74],[76,72],
  [80,72],[84,76],[88,79],[92,84],
  [96,74],[100,76],[104,77],[108,76],
  [112,79],[116,76],[120,72],[124,69],
];
const STAGE_BRIDGE = [ [0,72],[8,71],[16,69],[32,76],[40,74],[48,76],[56,76] ];
const STAGE_OUTRO = [
  [0,81],[4,79],[8,77],[12,76],[16,74],[20,72],[24,71],[28,69],
  [32,72],[40,69],[48,76],[56,76],
];
const STAGE = {
  title: 'Sunny Petal March', keyName: 'A minor', bpm: 112, gain: 0.55,
  voices: { lead: { layers: [
      { type:'triangle', octave:0, detune:0, gain:1.0 },
      { type:'triangle', octave:0, detune:8, gain:0.45 },
      { type:'sawtooth', octave:-1, detune:0, gain:0.28, filter:'lowpass', filterFreq:1900 } ],
      atk:0.006, dec:0.06, sus:0.55, rel:0.15, maxGate:6 },
    pad: { octave:1, voices:2, detune:9, type:'sawtooth', atk:0.10, dec:0.14, sus:0.72, rel:0.4, filter:'lowpass', filterFreq:1700 } },
  gains: { lead:0.135, harm:0.07, counter:0.08, arp:0.055, bass:0.155, sub:0.12, pad:0.05 },
  sections: {
    intro: makeSection({ bars:4, scale:'Amin', chords:['Am','Am','F','G'], bassStyle:'half', arpRate:2, groove:'introTick', sub:true, crash:true }),
    A:     makeSection({ bars:8, scale:'Amin', chords:['Am','F','C','G','Am','F','Dm','E'], lead:cat(STAGE_HOOK, off(64,STAGE_HOOK2)), bassStyle:'pump8', arpRate:2, groove:'four', sub:true }),
    A2:    makeSection({ bars:8, scale:'Amin', chords:['Am','F','C','G','Am','Dm','Esus4','E'], lead:cat(STAGE_HOOK, off(64,STAGE_HOOK2)), harm:true, bassStyle:'pump8', arpRate:2, groove:'four', sub:true }),
    B:     makeSection({ bars:8, scale:'Amin', chords:['C','G','Am','Em','F','C','Dm','G'], lead:STAGE_B, counter:true, bassStyle:'pump8', arpRate:1, groove:'four', sub:true, crash:true }),
    bridge:makeSection({ bars:4, scale:'Amin', chords:['Dm','E','Am','E'], lead:STAGE_BRIDGE, bassStyle:'half', arpRate:2, groove:'halfTime', sub:true }),
    A2b:   makeSection({ bars:8, scale:'Amin', chords:['Am','F','C','G','Am','Dm','Esus4','E'], lead:cat(STAGE_HOOK, off(64,STAGE_HOOK2)), harm:true, counter:true, bassStyle:'pump8', arpRate:1, groove:'four', sub:true, crash:true }),
    outro: makeSection({ bars:4, scale:'Amin', chords:['Am','F','Dm','E'], lead:STAGE_OUTRO, bassStyle:'pump8', arpRate:1, groove:'four', sub:true, crash:true }),
  },
  arrangement: ['intro','A','A2','B','bridge','A2b','outro'],
};

// ================================================================ MIDBOSS
// "Trickster's Waltz of Knives" — A harmonic minor, 134 BPM.
const MID_HOOK = [
  [2,69],[3,72],[4,71],[5,69],[6,68],[7,69],[11,76],[14,69],
  [16,71],[17,72],[18,71],[19,68],[20,69],[22,76],[24,74],[26,72],[27,71],[28,69],[29,68],[30,69],
];
const MID_CLOSE = [ [0,72],[2,71],[4,69],[6,68],[8,69],[12,76],[16,68],[20,69],[24,72],[28,71] ];
const MID_B = [ // brighter lift — A natural minor
  [0,76],[4,77],[8,79],[12,81],[16,79],[24,76],
  [32,79],[40,81],[48,83],[56,84],
  [64,77],[72,76],[80,74],[88,72],
  [96,76],[104,79],[112,76],[120,72],
];
const MID_BRIDGE = [ // D harmonic-minor tilt (scale check skipped)
  [0,74],[8,77],[16,79],[24,77],
  [32,74],[40,69],[48,73],[56,74],
  [64,77],[72,79],[80,82],[88,81],
  [96,77],[104,74],[112,68],[120,69],
];
const MID_OUTRO = [ [0,76],[8,69],[16,72],[24,71],[32,69],[40,68],[48,69],[56,76] ];
function midHookExclaim() { const h = MID_HOOK.slice(); h[h.length-1] = [30,81]; return h; } // A5 exclamation
const MIDBOSS = {
  title: "Trickster's Waltz of Knives", keyName: 'A harmonic minor', bpm: 134, gain: 0.58,
  voices: { lead: { layers: [
      { type:'triangle', octave:0, detune:0, gain:1.0 },
      { type:'sawtooth', octave:0, detune:7, gain:0.42, filter:'lowpass', filterFreq:2600 } ],
      atk:0.004, dec:0.05, sus:0.4, rel:0.11, maxGate:5 },
    counter: { layers:[{ type:'square', octave:0, detune:0, gain:1.0, filter:'lowpass', filterFreq:2000 }], atk:0.005, dec:0.04, sus:0.35, rel:0.1, maxGate:4 },
    arp: { layers:[{ type:'triangle', octave:0, detune:6, gain:1.0 }], atk:0.002, dec:0.025, sus:0.16, rel:0.05, filter:'lowpass', filterFreq:3000, maxGate:1 },
    bass: { layers:[{ type:'sawtooth', octave:0, detune:0, gain:1.0 }], atk:0.004, dec:0.05, sus:0.55, rel:0.08, filter:'lowpass', filterFreq:820, maxGate:3 },
    pad: { octave:1, voices:3, detune:10, type:'sawtooth', atk:0.07, dec:0.12, sus:0.65, rel:0.35, filter:'lowpass', filterFreq:1600 } },
  gains: { lead:0.14, harm:0.075, counter:0.085, arp:0.06, bass:0.165, sub:0.12, pad:0.046, hat:1.05 },
  sections: {
    intro:  makeSection({ bars:4, scale:'Aharm', chords:['Am','Am/G','F','E'], bassStyle:'half', arpRate:1, groove:'introTick', sub:true, crash:true }),
    A:      makeSection({ bars:8, scale:'Aharm', chords:['Am','Am','Dm','E7','Am','F','Bdim','E7'], lead:cat(MID_HOOK, off(32,MID_HOOK), off(64,MID_HOOK), off(96,MID_CLOSE)), counter:true, bassStyle:'walk8', arpRate:2, groove:'midGroove', sub:true }),
    A2:     makeSection({ bars:8, scale:'Aharm', chords:['Am','Am','Dm','E7','Am','F','E7','Am'], lead:cat(MID_HOOK, off(32,MID_HOOK), off(64,MID_HOOK), off(96,midHookExclaim())), harm:true, counter:true, bassStyle:'gallop', arpRate:2, groove:'midGallop', sub:true, crash:true }),
    B:      makeSection({ bars:8, scale:'Amin', chords:['F','G','Em','Am','F','G','E7','E7'], lead:MID_B, bassStyle:'pump8', arpRate:1, groove:'midGroove', sub:true, crash:true }),
    bridge: makeSection({ bars:8, scale:null, chords:['Gm','Gm','Dm','A7','Gm','Bb','A7','E7'], lead:MID_BRIDGE, counter:true, bassStyle:'half', arpRate:2, groove:'halfTime', sub:true }),
    outro:  makeSection({ bars:4, scale:'Aharm', chords:['Am','E7','Am','E7'], lead:MID_OUTRO, bassStyle:'walk8', arpRate:1, groove:'introTick', sub:true }),
  },
  arrangement: ['intro','A','A2','B','bridge','A2','B','outro'],
};

// ================================================================ BOSS
// "Sakuya Eternal" — A harmonic minor, key-lift to C harmonic minor, 152 BPM.
const BOSS_HOOK = [
  [2,69],[4,76],[8,77],[10,76],[12,74],[14,72],[15,71],
  [16,72],[18,76],[20,81],[24,80],[26,83],[28,81],[29,80],[30,77],[31,76],
];
const BOSS_CLOSE = [ [0,69],[4,72],[8,76],[12,74],[16,72],[20,71],[24,69],[28,68] ];
function transpose(list, n) { return list.map(([s, m]) => [s, m + n]); }
const BOSS_B = [ // beauty flip, A natural minor, upper register
  [0,84],[4,83],[8,81],[12,79],[16,77],[24,76],
  [32,79],[40,81],[48,83],[56,84],
  [64,81],[72,79],[80,77],[88,76],
  [96,72],[104,76],[112,79],[120,84],
];
const BOSS_BRIDGE = [ // lament + tension build (scale check skipped)
  [0,69],[8,72],[16,76],[24,72],
  [32,69],[40,68],[48,65],[56,69],
  [64,69],[72,71],[80,72],[88,74],
  [96,75],[104,77],[112,80],[120,83],
];
const BOSS_OUTRO = [ [0,69],[4,76],[8,77],[12,76],[16,74],[24,72],[32,69],[48,69] ];
const BOSS = {
  title: 'Sakuya Eternal', keyName: 'A harmonic minor → C', bpm: 152, gain: 0.62,
  voices: { lead: { layers: [
      { type:'triangle', octave:0, detune:0, gain:1.0 },
      { type:'sawtooth', octave:0, detune:9, gain:0.5, filter:'lowpass', filterFreq:2400 },
      { type:'triangle', octave:1, detune:0, gain:0.22 } ],
      atk:0.005, dec:0.05, sus:0.5, rel:0.13, maxGate:6 },
    harm: { layers:[{ type:'triangle', octave:0, detune:-4, gain:1.0 }], atk:0.007, dec:0.05, sus:0.45, rel:0.14, filter:'lowpass', filterFreq:2600, maxGate:6 },
    counter: { layers:[{ type:'square', octave:0, detune:0, gain:1.0, filter:'lowpass', filterFreq:1900 }], atk:0.006, dec:0.05, sus:0.4, rel:0.12, maxGate:5 },
    arp: { layers:[{ type:'square', octave:0, detune:7, gain:1.0 }], atk:0.002, dec:0.025, sus:0.15, rel:0.05, filter:'lowpass', filterFreq:3200, maxGate:1 },
    bass: { layers:[{ type:'sawtooth', octave:0, detune:0, gain:1.0 }], atk:0.004, dec:0.05, sus:0.6, rel:0.08, filter:'lowpass', filterFreq:950, maxGate:3 },
    pad: { octave:0, voices:3, detune:11, type:'sawtooth', atk:0.08, dec:0.13, sus:0.7, rel:0.4, filter:'lowpass', filterFreq:1450 } },
  gains: { lead:0.145, harm:0.08, counter:0.085, arp:0.06, bass:0.17, sub:0.14, pad:0.058, kick:1.1, snare:1.05, crash:1.05 },
  sections: {
    intro:  makeSection({ bars:8, scale:'Aharm', chords:['Am','Am','E7','E7','Dm','Dm','E7','E7'], lead:cat(BOSS_HOOK, off(64,BOSS_HOOK)), harm:true, bassStyle:'half', arpRate:2, groove:'fourLite', sub:true, crash:true }),
    A1:     makeSection({ bars:8, scale:'Aharm', chords:['Am','F','C','E7','Am','F','Dm','E7'], lead:cat(BOSS_HOOK, off(32,BOSS_HOOK), off(64,BOSS_HOOK), off(96,BOSS_CLOSE)), bassStyle:'drive8', arpRate:1, groove:'bossDrive', sub:true, crash:true }),
    A2:     makeSection({ bars:8, scale:'Aharm', chords:['Am','F','C','E7','Am','Dm','E7','Am'], lead:cat(BOSS_HOOK, off(32,BOSS_HOOK), off(64,BOSS_HOOK), off(96,BOSS_CLOSE)), harm:true, counter:true, bassStyle:'drive8', arpRate:1, groove:'bossDrive', sub:true, crash:true }),
    B:      makeSection({ bars:8, scale:'Amin', chords:['C','G','F','C','F','G','E7','Am'], lead:BOSS_B, harm:true, counter:true, bassStyle:'pump8', arpRate:1, groove:'bossDrive', sub:true, crash:true }),
    bridge: makeSection({ bars:8, scale:null, chords:['Am','Am/G','F','Am/E','Bb','Bb','G#dim','E7'], lead:BOSS_BRIDGE, bassStyle:'half', arpRate:2, groove:'bossBridge', sub:true }),
    climax: makeSection({ bars:8, scale:'Charm', chords:['Cm','Ab','Eb','G7','Cm','Ab','Fm','G7'], lead:cat(transpose(BOSS_HOOK,3), off(32,transpose(BOSS_HOOK,3)), off(64,transpose(BOSS_HOOK,3)), off(96,transpose(BOSS_CLOSE,3))), harm:true, counter:true, bassStyle:'drive8', arpRate:1, groove:'bossClimax', sub:true, crash:true }),
    A3:     makeSection({ bars:8, scale:'Aharm', chords:['Am','F','C','E7','Am','F','Dm','E7'], lead:cat(BOSS_HOOK, off(32,BOSS_HOOK), off(64,BOSS_HOOK), off(96,BOSS_CLOSE)), harm:true, counter:true, bassStyle:'drive8', arpRate:1, groove:'bossClimax', sub:true, crash:true }),
    outro:  makeSection({ bars:4, scale:null, chords:['Dm','E7','Am','A'], lead:BOSS_OUTRO, bassStyle:'half', arpRate:2, groove:'bossDrive', sub:true, crash:true }),
  },
  arrangement: ['intro','A1','A2','B','bridge','climax','A3','outro'],
};

// ================================================================ GAME OVER
// "Falling Petals" — A natural minor, 80 BPM. A short, conclusive lament played
// on the GAME OVER screen: a slow stepwise octave descent (A5→A4) over a soft
// i–VI–iv–V (Am–F–Dm–E7). The descent resolves onto A4 at the final half-bar
// (~10.5s of content); the screen consumes this as a ONE-SHOT — it fades the tail
// to silence and auto-returns at ~11.6s, before the 4-bar loop seam (12.0s) would
// re-attack A5, so the seamless-loop scaffolding (E7→Am) is never actually heard.
// Drumless and dim; the saw layers and drive grooves of the gameplay tracks are
// deliberately stripped back to bare longing.
const GO_LAMENT = [ // stepwise descent, one note per half-bar, all natural-minor
  [0,81],[8,79],     // Am: A5 → G5
  [16,77],[24,76],   // F : F5 → E5
  [32,74],[40,72],   // Dm: D5 → C5
  [48,71],[56,69],   // E7: B4 → A4  (final resolution; the screen fades out here)
];
const GAMEOVER = {
  title: 'Falling Petals', keyName: 'A minor', bpm: 80, gain: 0.42,
  voices: { lead: { layers: [
      { type:'triangle', octave:0, detune:0, gain:1.0 },
      { type:'triangle', octave:1, detune:5, gain:0.16 } ],   // soft octave shimmer, no saw bite
      atk:0.02, dec:0.12, sus:0.6, rel:0.38, maxGate:6 },
    harm: { layers:[{ type:'triangle', octave:0, detune:-4, gain:1.0 }], atk:0.02, dec:0.1, sus:0.5, rel:0.34, filter:'lowpass', filterFreq:1900, maxGate:6 },
    bass: { layers:[{ type:'sine', octave:0, detune:0, gain:1.0 }], atk:0.012, dec:0.09, sus:0.7, rel:0.22, filter:'lowpass', filterFreq:560, maxGate:8 },
    pad: { octave:0, voices:3, detune:8, type:'sawtooth', atk:0.2, dec:0.22, sus:0.7, rel:0.8, filter:'lowpass', filterFreq:1150 } },
  gains: { lead:0.13, harm:0.075, bass:0.15, sub:0.12, pad:0.062 },
  sections: {
    A: makeSection({ bars:4, scale:'Amin', chords:['Am','F','Dm','E7'], lead:GO_LAMENT, harm:true, bassStyle:'half', arpRate:0, groove:'none', sub:true }),
  },
  arrangement: ['A'],
};

// ================================================================ STAGE 2
// "Yoiyami Lane" — D harmonic minor, 108 BPM. An INDEPENDENT tune (not a Stage-1 reskin): where the
// Stage-1 hook is a busy downbeat stepwise march, this motif breathes — syncopated off-beat entries,
// sustained notes, and the harmonic-minor augmented-2nd shimmer (b6 Bb ↔ #7 C#) for a twilight colour.
const S2_HOOK = [
  [0,74],[6,77],[10,76],            // D … F E  — a sighing off-beat fall
  [16,81],[22,82],[26,85],[28,82],  // A → Bb → C#6 → Bb  (the augmented-2nd shimmer)
  [32,79],[40,77],[44,76],          // G F E  — slow, spacious descent
  [48,74],[54,73],[58,74],          // D → C# → D  (leading-tone resolution)
];
const S2_HOOK2 = [ // variation tail, hangs on A (the V) for the half-cadence
  [0,74],[6,77],[10,79],
  [16,82],[20,85],[28,82],
  [32,81],[40,77],
  [48,79],[56,81],[60,81],
];
const S2_B = [ // 8-bar contrasting lift — lyrical and breathing, not a run
  [0,85],[8,86],[12,82],
  [16,81],[24,77],[28,79],
  [32,76],[40,77],[48,81],[56,85],
  [64,86],[72,82],[80,79],[88,77],
  [96,79],[104,81],[112,82],[120,85],
];
const S2_BRIDGE = [ [0,69],[8,74],[16,77],[24,82],[32,85],[40,82],[48,79],[56,77] ];
const S2_OUTRO = [ [0,82],[8,81],[16,79],[24,77],[32,76],[40,74],[48,74] ];
const STAGE2 = {
  title: 'Yoiyami Lane', keyName: 'D harmonic minor', bpm: 108, gain: 0.55,
  // DISTINCT timbre from Stage 1 (no saw bite on the lead): a cool sine-shimmer lead, a lush dark
  // slow pad pushed forward, a music-box bell arp, and a round sine bass. With midGroove + a walking
  // bass + the slower tempo this reads as a floating twilight piece, not the bright Stage-1 march.
  voices: {
    lead: { layers:[ { type:'triangle', octave:0, detune:0, gain:1.0 }, { type:'sine', octave:1, detune:4, gain:0.4 }, { type:'sine', octave:0, detune:-6, gain:0.5 } ], atk:0.014, dec:0.11, sus:0.5, rel:0.24, maxGate:6 },
    arp:  { layers:[ { type:'triangle', octave:1, detune:0, gain:1.0 } ], atk:0.002, dec:0.04, sus:0.12, rel:0.08, filter:'lowpass', filterFreq:3400, maxGate:1 },
    bass: { layers:[ { type:'sine', octave:0, detune:0, gain:1.0 }, { type:'triangle', octave:0, detune:0, gain:0.4 } ], atk:0.006, dec:0.07, sus:0.62, rel:0.12, filter:'lowpass', filterFreq:620, maxGate:4 },
    pad:  { octave:0, voices:3, detune:13, type:'sawtooth', atk:0.22, dec:0.22, sus:0.8, rel:0.7, filter:'lowpass', filterFreq:1050 } },
  gains: { lead:0.125, harm:0.065, counter:0.07, arp:0.055, bass:0.15, sub:0.13, pad:0.08 },
  sections: {
    intro: makeSection({ bars:4, scale:'Dharm', chords:['Dm','Dm','Bb','A7'], bassStyle:'half', arpRate:2, groove:'introTick', sub:true, crash:true }),
    A:     makeSection({ bars:8, scale:'Dharm', chords:['Dm','Bb','F','A7','Dm','Gm','A7','Dm'], lead:cat(S2_HOOK, off(64,S2_HOOK2)), bassStyle:'walk8', arpRate:2, groove:'midGroove', sub:true }),
    A2:    makeSection({ bars:8, scale:'Dharm', chords:['Dm','Bb','F','A7','Dm','Gm','A7','Dm'], lead:cat(S2_HOOK, off(64,S2_HOOK2)), harm:true, bassStyle:'walk8', arpRate:2, groove:'midGroove', sub:true }),
    B:     makeSection({ bars:8, scale:'Dharm', chords:['Bb','F','Gm','Dm','Bb','F','A7','A7'], lead:S2_B, counter:true, bassStyle:'walk8', arpRate:1, groove:'midGroove', sub:true, crash:true }),
    bridge:makeSection({ bars:4, scale:'Dharm', chords:['Gm','A7','Dm','A7'], lead:S2_BRIDGE, bassStyle:'half', arpRate:2, groove:'halfTime', sub:true }),
    A2b:   makeSection({ bars:8, scale:'Dharm', chords:['Dm','Bb','F','A7','Dm','Gm','A7','Dm'], lead:cat(S2_HOOK, off(64,S2_HOOK2)), harm:true, counter:true, bassStyle:'walk8', arpRate:1, groove:'midGroove', sub:true, crash:true }),
    outro: makeSection({ bars:4, scale:'Dharm', chords:['Dm','Bb','Gm','A7'], lead:S2_OUTRO, bassStyle:'walk8', arpRate:1, groove:'midGroove', sub:true, crash:true }),
  },
  arrangement: ['intro','A','A2','B','bridge','A2b','outro'],
};

// ================================================================ STAGE 2 BOSS
// "Threshold Pursuit" — D Phrygian, 150 BPM. An INDEPENDENT theme that ESCAPES the Stage-1-boss mold
// (8-part shell + min-3rd-up climax + gallop + leap-then-fall hook) on three different axes: a cold
// MOTORIK machine-chase on a hypnotic pedal-D ostinato riff (NOT a leap-fall hook), in modal D PHRYGIAN
// (b2 Eb stabs; no leading tone, no functional V7→i), with NO key-lift — the climax intensifies in the
// SAME key via the motorikClimax beat. Tasokare (黄昏) as an inexorable force closing on the threshold (彼岸).
const B2_RIFF  = [[0,74],[2,74],[3,75],[4,74],[6,77],[8,74],[10,75],[11,74],[12,79],[14,77]];   // D D Eb D F D Eb D G F  (b2 Eb stabs)
const B2_RIFF2 = [[0,81],[2,81],[3,82],[4,81],[6,84],[8,81],[10,82],[11,81],[12,86],[14,84]];   // A A Bb A C A Bb A D C  (riff a 5th up)
const B2_LOOM  = [[0,82],[8,81],[16,79],[24,77],[32,75],[40,77],[48,79],[56,81],[64,82],[72,84],[80,82],[88,79],[96,77],[104,75],[112,74],[120,75]]; // descending Phrygian loom
const B2_OUTRO = [[0,74],[2,75],[6,77],[8,74],[16,79],[24,77],[32,75],[48,74]];
const BOSS2 = {
  title: 'Threshold Pursuit', keyName: 'D Phrygian (no key-lift)', bpm: 150, gain: 0.62,
  // Cold motorik timbre: a hollow square+saw lead, a sharp square arp, a gritty driving saw bass on the
  // straight-8th motorPedal, dark cold pad. Relentless straight-pulse, no swing — a machine bearing down.
  voices: {
    lead: { layers:[ { type:'square', octave:0, detune:0, gain:0.8, filter:'lowpass', filterFreq:2600 }, { type:'sawtooth', octave:0, detune:0, gain:0.5, filter:'lowpass', filterFreq:2400 }, { type:'square', octave:1, detune:0, gain:0.18 } ], atk:0.003, dec:0.04, sus:0.4, rel:0.09, maxGate:4 },
    harm: { layers:[ { type:'square', octave:0, detune:-5, gain:1.0, filter:'lowpass', filterFreq:2200 } ], atk:0.004, dec:0.04, sus:0.38, rel:0.1, maxGate:4 },
    counter: { layers:[ { type:'sawtooth', octave:0, detune:0, gain:1.0, filter:'lowpass', filterFreq:1900 } ], atk:0.004, dec:0.04, sus:0.36, rel:0.09, maxGate:4 },
    arp: { layers:[ { type:'square', octave:0, detune:7, gain:1.0 } ], atk:0.002, dec:0.02, sus:0.12, rel:0.04, filter:'lowpass', filterFreq:3400, maxGate:1 },
    bass: { layers:[ { type:'sawtooth', octave:0, detune:0, gain:1.0 } ], atk:0.003, dec:0.04, sus:0.55, rel:0.07, filter:'lowpass', filterFreq:1100, maxGate:3 },
    pad: { octave:0, voices:3, detune:10, type:'sawtooth', atk:0.05, dec:0.1, sus:0.6, rel:0.3, filter:'lowpass', filterFreq:1250 } },
  gains: { lead:0.135, harm:0.07, counter:0.08, arp:0.06, bass:0.175, sub:0.14, pad:0.05, kick:1.15, snare:1.08, crash:1.05 },
  sections: {
    intro:  makeSection({ bars:4, scale:'Dphryg', chords:['Dm','Dm','Eb','Eb'], lead:cat(B2_RIFF, off(32,B2_RIFF)), bassStyle:'motorPedal', arpRate:2, groove:'introTick', sub:true, crash:true }),
    A1:     makeSection({ bars:8, scale:'Dphryg', chords:['Dm','Dm','Eb','Dm','Dm','Dm','Eb','Eb'], lead:cat(B2_RIFF, off(16,B2_RIFF), off(32,B2_RIFF), off(48,B2_RIFF), off(64,B2_RIFF2), off(80,B2_RIFF2), off(96,B2_RIFF2), off(112,B2_RIFF2)), bassStyle:'motorPedal', arpRate:1, groove:'motorik', sub:true }),
    A2:     makeSection({ bars:8, scale:'Dphryg', chords:['Dm','Eb','Dm','Cm','Dm','Eb','Bb','Dm'], lead:cat(B2_RIFF, off(16,B2_RIFF), off(32,B2_RIFF2), off(48,B2_RIFF2), off(64,B2_RIFF), off(80,B2_RIFF), off(96,B2_RIFF2), off(112,B2_RIFF2)), harm:true, bassStyle:'motorPedal', arpRate:1, groove:'motorik', sub:true }),
    loom:   makeSection({ bars:8, scale:'Dphryg', chords:['Bb','Cm','Dm','Eb','Bb','Gm','Eb','Dm'], lead:B2_LOOM, bassStyle:'motorPedal', arpRate:0, groove:'motorik', sub:true, crash:true }),
    climax: makeSection({ bars:8, scale:'Dphryg', chords:['Dm','Eb','Dm','Eb','Dm','Cm','Eb','Dm'], lead:cat(B2_RIFF2, off(16,B2_RIFF2), off(32,B2_RIFF), off(48,B2_RIFF), off(64,B2_RIFF2), off(80,B2_RIFF2), off(96,B2_RIFF), off(112,B2_RIFF)), harm:true, counter:true, bassStyle:'motorPedal', arpRate:1, groove:'motorikClimax', sub:true, crash:true }),
    outro:  makeSection({ bars:4, scale:'Dphryg', chords:['Eb','Cm','Dm','Dm'], lead:B2_OUTRO, bassStyle:'motorPedal', arpRate:1, groove:'motorik', sub:true }),
  },
  arrangement: ['intro','A1','A2','loom','climax','outro'],
};

// ================================================================ STAGE 3
// "Take-no-Komichi" (竹の小径) — E hirajoshi (和 pentatonic), 116 BPM. An INDEPENDENT tune that ESCAPES the
// Stage-2-road mold (the shared "off-beat + harmonic-minor augmented-2nd shimmer b6↔#7" hook over walk8/
// midGroove): a gentle koto-plucked wander in the DARK 和 PENTATONIC. Hirajoshi has NO leading tone and NO
// augmented 2nd, so the shared road-hook device is structurally impossible — that is the break. Ties the
// lost bamboo grove 和-wise to its 都節 boss while staying road-distinct (hirajoshi ≠ 都節). Pure Em/C harmony.
const S3_HOOK = [ [0,71],[4,72],[8,76],[12,79],[16,78],[20,76],[24,72],[28,71] ];   // B C E G | F# E C B
const S3_HOOK2 = [ [0,76],[4,79],[8,83],[12,84],[16,83],[20,79],[24,78],[28,76] ];  // E G B C | B G F# E
const S3_CLOSE = [ [0,79],[8,78],[16,76],[24,72] ];                                 // G F# E C
const S3_B = [ // 8-bar contrasting lift — lyrical, upper register
  [0,84],[8,88],[16,83],[24,79],
  [32,78],[40,83],[48,84],[56,88],
  [64,90],[72,88],[80,84],[88,83],
  [96,84],[104,88],[112,83],[120,79],
];
const S3_BRIDGE = [ [0,72],[8,76],[16,79],[24,83],[32,84],[40,83],[48,79],[56,78] ];
const S3_OUTRO = [ [0,83],[8,79],[16,78],[24,76],[32,72],[40,71],[48,76] ];
const STAGE3 = {
  title: 'Take-no-Komichi', keyName: 'E hirajoshi (和 pentatonic)', bpm: 116, gain: 0.55,
  // DISTINCT timbre: a koto-plucked lead (triangle + a faint square bell octave-up, short sustain), a round
  // sine bass, a glassy bell arp, and a forward dark pad — a wandering night-grove piece, the strongest
  // scale-break against the Stage-2 road's functional harmonic minor.
  voices: {
    lead: { layers:[ { type:'triangle', octave:0, detune:0, gain:1.0 }, { type:'square', octave:1, detune:0, gain:0.14, filter:'lowpass', filterFreq:2800 }, { type:'sine', octave:0, detune:-5, gain:0.4 } ], atk:0.003, dec:0.08, sus:0.28, rel:0.16, maxGate:5 },
    arp:  { layers:[ { type:'triangle', octave:1, detune:0, gain:1.0 } ], atk:0.002, dec:0.04, sus:0.12, rel:0.07, filter:'lowpass', filterFreq:3200, maxGate:1 },
    bass: { layers:[ { type:'sine', octave:0, detune:0, gain:1.0 }, { type:'triangle', octave:0, detune:0, gain:0.35 } ], atk:0.006, dec:0.07, sus:0.6, rel:0.12, filter:'lowpass', filterFreq:640, maxGate:4 },
    pad:  { octave:0, voices:3, detune:11, type:'sawtooth', atk:0.18, dec:0.2, sus:0.76, rel:0.6, filter:'lowpass', filterFreq:1100 } },
  gains: { lead:0.13, harm:0.07, counter:0.07, arp:0.058, bass:0.15, sub:0.13, pad:0.072 },
  sections: {
    intro: makeSection({ bars:4, scale:'Ehira', chords:['Em','Em','C','Em'], bassStyle:'walk8', arpRate:2, groove:'introTick', sub:true, crash:true }),
    A:     makeSection({ bars:8, scale:'Ehira', chords:['Em','Em','C','C','Em','Em','C','Em'], lead:cat(S3_HOOK, off(32,S3_HOOK2), off(64,S3_HOOK), off(96,S3_CLOSE)), bassStyle:'walk8', arpRate:2, groove:'fourLite', sub:true }),
    A2:    makeSection({ bars:8, scale:'Ehira', chords:['Em','Em','C','C','Em','Em','C','Em'], lead:cat(S3_HOOK, off(32,S3_HOOK2), off(64,S3_HOOK), off(96,S3_CLOSE)), harm:true, bassStyle:'walk8', arpRate:2, groove:'fourLite', sub:true }),
    B:     makeSection({ bars:8, scale:'Ehira', chords:['C','Em','Em','C','Em','Em','C','Em'], lead:S3_B, counter:true, bassStyle:'walk8', arpRate:1, groove:'midGroove', sub:true, crash:true }),
    bridge:makeSection({ bars:4, scale:'Ehira', chords:['C','Em','Em','Em'], lead:S3_BRIDGE, bassStyle:'half', arpRate:2, groove:'halfTime', sub:true }),
    A2b:   makeSection({ bars:8, scale:'Ehira', chords:['Em','Em','C','C','Em','Em','C','Em'], lead:cat(S3_HOOK, off(32,S3_HOOK2), off(64,S3_HOOK), off(96,S3_CLOSE)), harm:true, counter:true, bassStyle:'walk8', arpRate:1, groove:'fourLite', sub:true, crash:true }),
    outro: makeSection({ bars:4, scale:'Ehira', chords:['Em','C','C','Em'], lead:S3_OUTRO, bassStyle:'walk8', arpRate:1, groove:'fourLite', sub:true, crash:true }),
  },
  arrangement: ['intro','A','A2','B','bridge','A2b','outro'],
};

// ================================================================ STAGE 3 BOSS
// "Mirror of Two Moons" — E In / 都節 (Miyako-bushi), 140 BPM. A slow, ritual ANTIPHONAL DUET for the twin
// sisters: 宵 (Yoi) states a sparse oscillating koto call in the lead; 暁 (Akatsuki) ANSWERS with her OWN
// independent phrase in the counter lane (a real second melody in 宵's rests, not a -12 shadow), so the two
// trade across the grove. The 都節 mode's b2 (F) + b6 (C) half-steps give a koto-and-incense night-shrine
// air. Deliberately NOT the boss-family mold: no functional harmonic minor, no gallop, NO minor-3rd climax
// key-lift — the peak is the unison B-section ("two moons rise"). Sparse 和太鼓 boom-bap, no modulation.
const B3_CALL  = [[0,76],[4,77],[6,76],[8,81],[12,83],[16,81],[20,84],[24,83],[28,81]];   // 宵 calls:  E F E A B | A C B A
const B3_ANS   = [[0,69],[4,71],[8,72],[12,71],[16,72],[18,76],[24,71],[28,69]];          // 暁 answers (independent, lower): A B C B | C E B A
const B3_CALL2 = [[0,76],[4,81],[8,83],[12,84],[16,83],[20,81],[24,77],[28,76]];          // 宵 call var
const B3_ANS2  = [[0,72],[4,69],[8,71],[12,72],[16,76],[20,72],[24,71],[28,69]];          // 暁 answer var
const B3_UNI   = [[0,84],[2,88],[6,84],[8,83],[12,81],[16,77],[20,76],[24,72],[28,76]];   // B: the sisters in unison — "two moons rise"
const B3_BRIDGE= [[0,72],[8,69],[16,76],[24,72],[32,71],[40,69],[48,72],[56,76]];
const B3_OUTRO = [[0,76],[6,77],[12,81],[20,83],[28,81],[40,76],[56,76]];
const BOSS3 = {
  title: 'Mirror of Two Moons', keyName: 'E In (都節) — antiphonal', bpm: 140, gain: 0.6,
  // 都節/In-mode duet timbre: a triangle+square-bell koto lead; the COUNTER lane is a full co-equal voice
  // (doubled triangle+sine = 暁, with its own gain bump); a glassy bell arp; a round sine bass on the
  // breathing sparseRoot line.
  voices: {
    lead: { layers:[ { type:'triangle', octave:0, detune:0, gain:1.0 }, { type:'square', octave:1, detune:0, gain:0.18, filter:'lowpass', filterFreq:3200 }, { type:'sine', octave:0, detune:-4, gain:0.45 } ], atk:0.004, dec:0.09, sus:0.34, rel:0.16, maxGate:5 },
    harm: { layers:[ { type:'triangle', octave:0, detune:-5, gain:1.0 } ], atk:0.006, dec:0.07, sus:0.4, rel:0.15, filter:'lowpass', filterFreq:2500, maxGate:5 },
    counter: { layers:[ { type:'triangle', octave:0, detune:0, gain:1.0 }, { type:'sine', octave:0, detune:6, gain:0.5 } ], atk:0.006, dec:0.08, sus:0.42, rel:0.18, filter:'lowpass', filterFreq:2400, maxGate:6 },
    arp: { layers:[ { type:'triangle', octave:1, detune:0, gain:1.0 } ], atk:0.002, dec:0.04, sus:0.12, rel:0.07, filter:'lowpass', filterFreq:3200, maxGate:1 },
    bass: { layers:[ { type:'sine', octave:0, detune:0, gain:1.0 }, { type:'triangle', octave:0, detune:0, gain:0.4 } ], atk:0.006, dec:0.07, sus:0.6, rel:0.12, filter:'lowpass', filterFreq:680, maxGate:5 },
    pad: { octave:0, voices:3, detune:11, type:'sawtooth', atk:0.16, dec:0.2, sus:0.74, rel:0.6, filter:'lowpass', filterFreq:1150 } },
  gains: { lead:0.14, harm:0.078, counter:0.10, arp:0.058, bass:0.16, sub:0.14, pad:0.066, kick:1.15, snare:1.0, crash:1.0 },
  sections: {
    intro: makeSection({ bars:4, scale:'Ein', chords:['Em','Em','Am','B7'], lead:B3_CALL, bassStyle:'sparseRoot', arpRate:2, groove:'introTick', sub:true, crash:true }),
    call:  makeSection({ bars:8, scale:'Ein', chords:['Em','Em','Am','Am','C','C','B7','B7'], lead:cat(B3_CALL, off(64,B3_CALL2)), counter:cat(off(32,B3_ANS), off(96,B3_ANS2)), bassStyle:'sparseRoot', arpRate:2, groove:'taikoBoomBap', sub:true, crash:true }),
    callH: makeSection({ bars:8, scale:'Ein', chords:['Em','Am','C','B7','Em','Am','B7','Em'], lead:cat(B3_CALL, off(64,B3_CALL2)), harm:true, counter:cat(off(32,B3_ANS), off(96,B3_ANS2)), bassStyle:'walk8', arpRate:2, groove:'taikoCall', sub:true, crash:true }),
    B:     makeSection({ bars:8, scale:'Ein', chords:['Am','C','Em','B7','Am','C','B7','Em'], lead:cat(B3_UNI, off(64,B3_UNI)), harm:true, counter:true, bassStyle:'walk8', arpRate:1, groove:'taikoCall', sub:true, crash:true }),
    bridge:makeSection({ bars:4, scale:'Ein', chords:['Am','B7','Em','B7'], lead:B3_BRIDGE, bassStyle:'half', arpRate:2, groove:'halfTime', sub:true }),
    callF: makeSection({ bars:8, scale:'Ein', chords:['Em','Am','C','B7','Em','Am','B7','Em'], lead:cat(B3_CALL, off(64,B3_CALL2)), harm:true, counter:cat(off(32,B3_ANS), off(96,B3_ANS2)), bassStyle:'walk8', arpRate:1, groove:'taikoCall', sub:true, crash:true }),
    outro: makeSection({ bars:4, scale:'Ein', chords:['Am','C','Em','Em'], lead:B3_OUTRO, bassStyle:'sparseRoot', arpRate:2, groove:'taikoBoomBap', sub:true, crash:true }),
  },
  arrangement: ['intro','call','callH','B','bridge','callF','outro'],
};

const TRACKS = { stage: STAGE, midboss: MIDBOSS, boss: BOSS, gameover: GAMEOVER, stage2: STAGE2, boss2: BOSS2, stage3: STAGE3, boss3: BOSS3 };

// ---------------------------------------------------------------- validation (Node only)
function validateTracks() {
  let errs = 0, notes = 0;
  for (const name in TRACKS) {
    const t = TRACKS[name];
    let total = 0;
    for (const sn of t.arrangement) {
      const sec = t.sections[sn];
      if (!sec) { console.log('  ERR ' + name + ': missing section ' + sn); errs++; continue; }
      const L = sec.bars * 16; total += sec.bars;
      for (const lane of ['lead','harm','counter','arp','bass','sub','chords','kick','snare','hat','crash']) {
        if (!sec[lane] || sec[lane].length !== L) { console.log('  ERR ' + name + '/' + sn + ': lane ' + lane + ' length ' + (sec[lane]?sec[lane].length:'undef') + ' != ' + L); errs++; }
      }
      const scale = sec._scale ? SCALES[sec._scale] : null;
      if (scale) {
        for (const lane of ['lead','harm','counter']) {
          for (let i = 0; i < L; i++) {
            const m = sec[lane][i]; if (!m) continue; notes++;
            const pc = ((m % 12) + 12) % 12;
            if (scale.indexOf(pc) < 0) { console.log('  OUT-OF-KEY ' + name + '/' + sn + ' ' + lane + ' step ' + i + ' midi ' + m + ' (pc ' + pc + ') not in ' + sec._scale); errs++; }
          }
        }
      }
    }
    const loopSec = (total * 16) * (60 / t.bpm / 4);
    console.log('  ' + name.padEnd(8) + ' "' + t.title + '" — ' + t.bpm + ' BPM, ' + t.arrangement.length + ' sections, ' + total + ' bars, loop ' + loopSec.toFixed(1) + 's');
  }
  console.log(errs === 0 ? ('OK — ' + notes + ' melodic notes checked, all in-key, all lane lengths correct.') : ('FAILED with ' + errs + ' error(s).'));
  return errs;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TRACKS, SCALES, parseChord, voicePad, validateTracks };
  if (require.main === module) process.exit(validateTracks());
}
if (typeof window !== 'undefined') { window.TRACKS = TRACKS; }
