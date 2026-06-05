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
  Dharm: [1,2,4,5,7,9,10],   // D harmonic minor: D E F G A Bb C#   (Stage 2)
  Fharm: [0,1,4,5,7,8,10],   // F harmonic minor: F G Ab Bb C Db E   (Stage 2 boss climax lift)
  Ehira: [0,4,6,7,11],       // E hirajoshi: E F# G B C   (Stage 3 road "Take-no-Komichi" — 和 pentatonic)
  Ein:   [0,4,5,9,11],       // E In / 都節 (Miyako-bushi): E F A B C   (Stage 3 boss "Mirror of Two Moons")
  Amaj:  [1,2,4,6,8,9,11],   // A major / D Lydian collection (3 sharps): A B C# D E F# G#   (Stage 4 road + boss — bright dawn)
  Fsharm:[1,2,5,6,8,9,11],   // F# harmonic minor: F# G# A B C# D E#   (Stage 4 midboss 山姥 — cold gate-keeper, aug-2nd D↔E#)
  Cmaj:  [0,2,4,5,7,9,11],   // C major   (Stage 4 boss daybreak key-lift, +3 from A major)
  Gdor:  [0,2,4,5,7,9,10],   // G Dorian: G A Bb C D E F   (Stage 5 road — modal, restless wind; bright IV=C is the Dorian colour)
  Bharm: [1,2,4,6,7,10,11],  // B harmonic minor: B C# D E F# G A#   (Stage 5 midboss 風神 — tense gatekeeper, aug-2nd G↔A#)
  Bphrygdom: [0,3,4,6,7,9,11], // B Phrygian dominant: B C D# E F# G A   (Stage 5 boss 須佐之男 — fierce exotic storm, b2=C menace)
  Ephrygdom: [0,2,4,5,8,9,11], // E Phrygian dominant: E F G# A B C D   (Stage 5 boss climax lift, +5 from B phryg-dom)
  Coct:  [0,1,3,4,6,7,9,10],    // C octatonic (half-whole): C Db Eb E F# G A Bb   (Stage 5 boss "Yamata Coils" — queasy 8-note serpent, shifting tonality, unlike anything else in-game)
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
    // ---- Stage 5 boss "Yamata Coils": a lurching, off-kilter 7-against-8 serpent pulse — kicks land unevenly, no straight backbeat ----
    case 'serpentLurch': [0,3,7,10,13].forEach(i=>k[i]=1); [5,11].forEach(i=>s[i]=1); h[2]=1; h[6]=2; h[9]=1; h[14]=2; break;
    case 'serpentCoil':  [0,2,5,8,10,13].forEach(i=>k[i]=1); [4,11].forEach(i=>s[i]=1); s[15]=1; for (let i=0;i<16;i++) h[i]=(i%3===0?2:1); break;
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
// "Tasokare's Lament" — D harmonic minor, key-lift to F harmonic minor, 164 BPM. An INDEPENDENT theme
// (not the Stage-1 boss reshaped): where that boss is warm and tuneful-stepwise, this hook is angular —
// wide 4th/5th leaps and the augmented-2nd — over a recurring descending lament cadence. Menacing, not pretty.
const B2_HOOK = [
  [0,74],[2,81],[4,82],[8,85],[10,82],[12,79],[14,77],   // D↑A Bb (leap) → C#6 Bb G F  — wide leaps, then fall
  [16,76],[18,74],[20,81],[24,82],[26,77],[28,76],[30,74], // E D A(leap) Bb F E D  — angular
];
const B2_CLOSE = [ [0,82],[4,81],[8,79],[12,77],[16,76],[20,74],[24,73],[28,74] ]; // descending lament: Bb A G F E D C# D
const B2_B = [ // dramatic lift, D harmonic minor
  [0,86],[6,82],[10,85],[16,81],[24,77],
  [32,79],[40,82],[48,85],[56,86],
  [64,85],[72,82],[80,79],[88,77],
  [96,81],[104,85],[112,82],[120,86],
];
const B2_BRIDGE = [ // sinking lament to A, then a leading-tone climb back
  [0,81],[8,77],[16,74],[24,70],
  [32,69],[40,73],[48,74],[56,77],
  [64,79],[72,82],[80,85],[88,82],
  [96,81],[104,77],[112,74],[120,73],
];
const B2_OUTRO = [ [0,74],[2,81],[6,85],[12,82],[16,79],[24,77],[32,74],[48,74] ];
const BOSS2 = {
  title: "Tasokare's Lament", keyName: 'D harmonic minor → F', bpm: 164, gain: 0.62,
  // DISTINCT timbre from the Stage 1 boss (which is warm triangle-led): a cold saw+hollow-square lead,
  // a sharp chiptune-ghost square arp, and a grittier bass. With a galloping bass + midGallop groove +
  // the faster tempo it reads as a relentless ghost-chase, not the Stage-1 boss's tuneful warm drive.
  voices: {
    lead: { layers:[ { type:'sawtooth', octave:0, detune:0, gain:0.9, filter:'lowpass', filterFreq:2600 }, { type:'square', octave:0, detune:8, gain:0.55, filter:'lowpass', filterFreq:2200 }, { type:'sawtooth', octave:1, detune:0, gain:0.2 } ], atk:0.004, dec:0.05, sus:0.45, rel:0.12, maxGate:6 },
    harm: { layers:[ { type:'sawtooth', octave:0, detune:-6, gain:1.0 } ], atk:0.006, dec:0.05, sus:0.42, rel:0.13, filter:'lowpass', filterFreq:2400, maxGate:6 },
    counter: { layers:[ { type:'square', octave:0, detune:0, gain:1.0, filter:'lowpass', filterFreq:1800 } ], atk:0.005, dec:0.05, sus:0.38, rel:0.11, maxGate:5 },
    arp: { layers:[ { type:'square', octave:0, detune:9, gain:1.0 } ], atk:0.002, dec:0.022, sus:0.13, rel:0.05, filter:'lowpass', filterFreq:3600, maxGate:1 },
    bass: { layers:[ { type:'sawtooth', octave:0, detune:0, gain:1.0 } ], atk:0.004, dec:0.05, sus:0.58, rel:0.08, filter:'lowpass', filterFreq:1050, maxGate:3 },
    pad: { octave:0, voices:3, detune:12, type:'sawtooth', atk:0.07, dec:0.12, sus:0.66, rel:0.4, filter:'lowpass', filterFreq:1300 } },
  gains: { lead:0.14, harm:0.075, counter:0.085, arp:0.065, bass:0.17, sub:0.14, pad:0.055, kick:1.1, snare:1.05, crash:1.05 },
  sections: {
    intro:  makeSection({ bars:8, scale:'Dharm', chords:['Dm','Dm','A7','A7','Gm','Gm','A7','A7'], lead:cat(B2_HOOK, off(64,B2_HOOK)), harm:true, bassStyle:'half', arpRate:2, groove:'fourLite', sub:true, crash:true }),
    A1:     makeSection({ bars:8, scale:'Dharm', chords:['Dm','Bb','F','A7','Dm','Bb','Gm','A7'], lead:cat(B2_HOOK, off(32,B2_HOOK), off(64,B2_HOOK), off(96,B2_CLOSE)), bassStyle:'gallop', arpRate:1, groove:'midGallop', sub:true, crash:true }),
    A2:     makeSection({ bars:8, scale:'Dharm', chords:['Dm','Bb','F','A7','Dm','Gm','A7','Dm'], lead:cat(B2_HOOK, off(32,B2_HOOK), off(64,B2_HOOK), off(96,B2_CLOSE)), harm:true, counter:true, bassStyle:'gallop', arpRate:1, groove:'midGallop', sub:true, crash:true }),
    B:      makeSection({ bars:8, scale:'Dharm', chords:['Bb','F','Gm','Dm','Bb','F','A7','Dm'], lead:B2_B, harm:true, counter:true, bassStyle:'pump8', arpRate:1, groove:'midGallop', sub:true, crash:true }),
    bridge: makeSection({ bars:8, scale:'Dharm', chords:['Gm','Gm','Dm','A7','Bb','Bb','A7','A7'], lead:B2_BRIDGE, bassStyle:'half', arpRate:2, groove:'bossBridge', sub:true }),
    climax: makeSection({ bars:8, scale:'Fharm', chords:['Fm','Db','Ab','C7','Fm','Db','Bbm','C7'], lead:cat(transpose(B2_HOOK,3), off(32,transpose(B2_HOOK,3)), off(64,transpose(B2_HOOK,3)), off(96,transpose(B2_CLOSE,3))), harm:true, counter:true, bassStyle:'gallop', arpRate:1, groove:'bossClimax', sub:true, crash:true }),
    A3:     makeSection({ bars:8, scale:'Dharm', chords:['Dm','Bb','F','A7','Dm','Gm','A7','Dm'], lead:cat(B2_HOOK, off(32,B2_HOOK), off(64,B2_HOOK), off(96,B2_CLOSE)), harm:true, counter:true, bassStyle:'gallop', arpRate:1, groove:'bossClimax', sub:true, crash:true }),
    outro:  makeSection({ bars:4, scale:'Dharm', chords:['Gm','A7','Dm','D'], lead:B2_OUTRO, bassStyle:'half', arpRate:2, groove:'midGallop', sub:true, crash:true }),
  },
  arrangement: ['intro','A1','A2','B','bridge','climax','A3','outro'],
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

// ================================================================ STAGE 4
// "First Light Road" (曙の道) — A major / D-Lydian collection, 118 BPM. An INDEPENDENT bright-dawn cruise.
// Motif = the "alt B" rework (adopted 2026-06-05): SYNCOPATED & SPACIOUS, built on a recurring RISING-SIXTH
// leap (D→B, E→C#) answered by a slow fall, with off-beat (step 2/10/6) sustained entries — deliberately NOT
// the busy-downbeat stepwise march of Stage 1 (which the first draft echoed). Reads as its own tune; the
// bright dawn TONE (timbre/key/tempo/groove) is unchanged.
const S4_HOOK = [
  [2,69],[4,74],[10,83],                 // anacrusis A, then the signature rising 6th D→B (held)
  [18,81],[22,78],[26,76],[28,74],       // answer falls: A F# E D
  [34,76],[40,85],                       // second leap E→C#6 (a 6th up), brighter
  [48,83],[52,81],[58,78],[60,74],       // long sigh back to the D tonic: B A F# D
];
const S4_HOOK2 = [ // variation — the leap inverts (falls a 6th), hangs open on E (half-cadence)
  [2,73],[4,78],[10,69],                 // C# F# … drop to A
  [18,76],[22,74],[26,73],[28,71],       // E D C# B
  [34,74],[40,66],                       // D … drop to low F#
  [48,76],[54,78],[60,76],               // E F# E — unresolved on E
];
const S4_B = [ // 8-bar lift — still spacious, the rising 6th climbs in sequence
  [0,76],[8,85],[14,83],                 // E … C#6 B
  [16,81],[24,86],[30,83],               // A … D6 B
  [34,81],[40,78],[48,76],[56,74],       // A F# E D — long descent breath
  [64,78],[72,88],[78,85],               // F# … E6 (top) C#
  [80,83],[88,81],[96,78],[104,76],      // B A F# E
  [112,74],[120,81],                     // D … leap back up to A to relaunch
];
const S4_BRIDGE = [ [0,76],[8,74],[16,73],[24,69],[32,78],[40,76],[48,74],[56,73] ];
const S4_OUTRO  = [ [0,81],[4,78],[8,76],[12,74],[16,73],[24,74],[32,76],[48,74] ];
const STAGE4 = {
  title: 'First Light Road', keyName: 'A major / D Lydian', bpm: 118, gain: 0.55,
  // bright airy timbre — a flute-ish triangle lead + soft sine octave shimmer + a faint saw body, a glassy
  // bell arp and a wide forward pad. Reads as a clear morning climb, distinct from the three earlier roads.
  voices: {
    lead: { layers:[ { type:'triangle', octave:0, detune:0, gain:1.0 }, { type:'sine', octave:1, detune:5, gain:0.34 }, { type:'sawtooth', octave:0, detune:-7, gain:0.22, filter:'lowpass', filterFreq:2100 } ], atk:0.005, dec:0.06, sus:0.55, rel:0.16, maxGate:6 },
    arp:  { layers:[ { type:'triangle', octave:1, detune:0, gain:1.0 } ], atk:0.002, dec:0.03, sus:0.13, rel:0.06, filter:'lowpass', filterFreq:3400, maxGate:1 },
    bass: { layers:[ { type:'sawtooth', octave:0, detune:0, gain:1.0 } ], atk:0.004, dec:0.06, sus:0.55, rel:0.1, filter:'lowpass', filterFreq:900, maxGate:3 },
    pad:  { octave:1, voices:3, detune:10, type:'sawtooth', atk:0.1, dec:0.14, sus:0.74, rel:0.42, filter:'lowpass', filterFreq:1850 } },
  gains: { lead:0.135, harm:0.07, counter:0.075, arp:0.055, bass:0.15, sub:0.12, pad:0.052 },
  sections: {
    intro: makeSection({ bars:4, scale:'Amaj', chords:['D','D','A','E'], bassStyle:'half', arpRate:2, groove:'introTick', sub:true, crash:true }),
    A:     makeSection({ bars:8, scale:'Amaj', chords:['D','A','Bm','E','D','A','E','D'], lead:cat(S4_HOOK, off(64,S4_HOOK2)), bassStyle:'pump8', arpRate:2, groove:'four', sub:true }),
    A2:    makeSection({ bars:8, scale:'Amaj', chords:['D','A','Bm','E','D','F#m','E','D'], lead:cat(S4_HOOK, off(64,S4_HOOK2)), harm:true, bassStyle:'pump8', arpRate:2, groove:'four', sub:true }),
    B:     makeSection({ bars:8, scale:'Amaj', chords:['Bm','F#m','A','E','D','A','E','E'], lead:S4_B, counter:true, bassStyle:'pump8', arpRate:1, groove:'four', sub:true, crash:true }),
    bridge:makeSection({ bars:4, scale:'Amaj', chords:['F#m','E','D','A'], lead:S4_BRIDGE, bassStyle:'half', arpRate:2, groove:'halfTime', sub:true }),
    A2b:   makeSection({ bars:8, scale:'Amaj', chords:['D','A','Bm','E','D','F#m','E','D'], lead:cat(S4_HOOK, off(64,S4_HOOK2)), harm:true, counter:true, bassStyle:'pump8', arpRate:1, groove:'four', sub:true, crash:true }),
    outro: makeSection({ bars:4, scale:'Amaj', chords:['D','A','E','D'], lead:S4_OUTRO, bassStyle:'pump8', arpRate:1, groove:'four', sub:true, crash:true }),
  },
  arrangement: ['intro','A','A2','B','bridge','A2b','outro'],
};

// ================================================================ STAGE 4 MIDBOSS
// "The Gatekeeper" (関の主) — F# harmonic minor, 128 BPM. The crone 山姥 who bars the pass. The ONLY dark
// track of the dawn stage: F# harmonic minor's augmented-2nd shimmer (b6 D ↔ #7 E#) gives a cold, exotic,
// circling menace — the relative minor of the road's A major, so it coheres tonally yet reads opposite in
// mood. An independent angular hook (no road march, no boss fanfare), a relentless gallop under it.
const M4_HOOK = [
  [0,66],[4,69],[6,68],[8,66],          // F# A G# F#       — a cold circling motif
  [16,73],[20,74],[24,77],[26,74],      // C# D E#(F) D     — the augmented-2nd shimmer D↔E#
  [32,71],[36,69],[40,68],[44,66],      // B A G# F#        — slow descent
  [48,73],[52,68],[56,66],              // C# G# F#         — cold cadence
];
const M4_HOOK2 = [
  [0,78],[4,81],[6,80],[8,78],
  [16,74],[20,77],[24,73],[28,74],
  [32,71],[36,73],[40,69],[44,68],
  [48,66],[52,69],[56,73],[60,66],
];
const M4_B = [
  [0,85],[8,86],[12,83],
  [16,81],[24,78],[28,80],
  [32,77],[40,78],[48,81],[56,85],
  [64,86],[72,83],[80,81],[88,78],
  [96,80],[104,81],[112,83],[120,85],
];
const M4_BRIDGE = [ [0,69],[8,74],[16,77],[24,74],[32,73],[40,69],[48,68],[56,66] ];
const M4_OUTRO  = [ [0,78],[8,74],[16,77],[24,73],[32,71],[40,69],[48,66] ];
const MIDBOSS4 = {
  title: 'The Gatekeeper', keyName: 'F# harmonic minor', bpm: 128, gain: 0.58,
  // cold timbre: a saw+hollow-square lead, a chiptune square counter, a gritty saw bass, a dark forward pad.
  voices: {
    lead: { layers:[ { type:'sawtooth', octave:0, detune:0, gain:0.9, filter:'lowpass', filterFreq:2500 }, { type:'square', octave:0, detune:7, gain:0.5, filter:'lowpass', filterFreq:2000 } ], atk:0.004, dec:0.05, sus:0.42, rel:0.12, maxGate:5 },
    counter: { layers:[ { type:'square', octave:0, detune:0, gain:1.0, filter:'lowpass', filterFreq:1900 } ], atk:0.005, dec:0.04, sus:0.36, rel:0.1, maxGate:4 },
    arp: { layers:[ { type:'square', octave:0, detune:7, gain:1.0 } ], atk:0.002, dec:0.025, sus:0.14, rel:0.05, filter:'lowpass', filterFreq:3000, maxGate:1 },
    bass: { layers:[ { type:'sawtooth', octave:0, detune:0, gain:1.0 } ], atk:0.004, dec:0.05, sus:0.55, rel:0.08, filter:'lowpass', filterFreq:880, maxGate:3 },
    pad: { octave:0, voices:3, detune:11, type:'sawtooth', atk:0.08, dec:0.13, sus:0.66, rel:0.38, filter:'lowpass', filterFreq:1400 } },
  gains: { lead:0.14, harm:0.075, counter:0.085, arp:0.06, bass:0.165, sub:0.12, pad:0.05, hat:1.05 },
  sections: {
    intro:  makeSection({ bars:4, scale:'Fsharm', chords:['F#m','F#m','D','C#'], bassStyle:'half', arpRate:1, groove:'introTick', sub:true, crash:true }),
    A:      makeSection({ bars:8, scale:'Fsharm', chords:['F#m','F#m','Bm','C#','F#m','D','C#','F#m'], lead:cat(M4_HOOK, off(32,M4_HOOK), off(64,M4_HOOK), off(96,M4_HOOK2)), counter:true, bassStyle:'walk8', arpRate:2, groove:'midGroove', sub:true }),
    A2:     makeSection({ bars:8, scale:'Fsharm', chords:['F#m','F#m','Bm','C#','F#m','D','C#7','F#m'], lead:cat(M4_HOOK, off(32,M4_HOOK), off(64,M4_HOOK), off(96,M4_HOOK2)), harm:true, counter:true, bassStyle:'gallop', arpRate:2, groove:'midGallop', sub:true, crash:true }),
    B:      makeSection({ bars:8, scale:'Fsharm', chords:['Bm','D','C#','F#m','Bm','D','C#','C#'], lead:M4_B, bassStyle:'pump8', arpRate:1, groove:'midGroove', sub:true, crash:true }),
    bridge: makeSection({ bars:4, scale:'Fsharm', chords:['Bm','C#','F#m','C#'], lead:M4_BRIDGE, bassStyle:'half', arpRate:2, groove:'halfTime', sub:true }),
    outro:  makeSection({ bars:4, scale:'Fsharm', chords:['Bm','C#','F#m','F#m'], lead:M4_OUTRO, bassStyle:'walk8', arpRate:1, groove:'introTick', sub:true }),
  },
  arrangement: ['intro','A','A2','B','bridge','A2','B','outro'],
};

// ================================================================ STAGE 4 BOSS
// "Daybreak" (曙光 / Yatagarasu) — A major, key-lift to C major (+3) at the climax, 150 BPM. The triumphant
// sunrise: a heroic fanfare hook of bright leaps in the 3-sharp major collection, driving hard, then the
// 御来光 modulation up to C major as the sun crests. The brightest, biggest track — an independent anthem,
// not the Stage-1 boss reshaped (that one is A harmonic minor and lifts to C *minor*; this lifts to C *major*).
const B4_HOOK = [
  [0,69],[2,73],[4,76],[8,81],[10,78],[12,76],[14,73],   // A C# E A  F# E C#   — a heroic fanfare rise
  [16,74],[18,78],[20,83],[24,81],[26,78],[28,76],        // D F# B  A F# E
];
const B4_CLOSE = [ [0,81],[4,78],[8,76],[12,74],[16,73],[20,74],[24,76],[28,73] ];   // A F# E D C# D E C#  — bright descent
const B4_B = [ // beauty lift, upper register
  [0,88],[4,86],[8,85],[12,83],[16,81],[24,78],
  [32,81],[40,83],[48,85],[56,88],
  [64,86],[72,83],[80,81],[88,78],
  [96,76],[104,81],[112,85],[120,88],
];
const B4_BRIDGE = [ // hush then a leading climb into the daybreak modulation
  [0,69],[8,73],[16,76],[24,73],
  [32,71],[40,69],[48,68],[56,69],
  [64,69],[72,71],[80,73],[88,74],
  [96,76],[104,78],[112,81],[120,83],
];
const B4_OUTRO = [ [0,69],[2,73],[6,78],[12,81],[16,78],[24,76],[32,74],[48,74] ];
const BOSS4 = {
  title: 'Daybreak', keyName: 'A major → C', bpm: 150, gain: 0.62,
  // bright powerful timbre: triangle+saw+octave lead, a triangle harm, a square counter, a square arp, driving
  // saw bass, a wide pad. The warm major answer to the three darker boss themes that came before.
  voices: {
    lead: { layers:[ { type:'triangle', octave:0, detune:0, gain:1.0 }, { type:'sawtooth', octave:0, detune:9, gain:0.5, filter:'lowpass', filterFreq:2600 }, { type:'triangle', octave:1, detune:0, gain:0.24 } ], atk:0.005, dec:0.05, sus:0.5, rel:0.13, maxGate:6 },
    harm: { layers:[ { type:'triangle', octave:0, detune:-4, gain:1.0 } ], atk:0.007, dec:0.05, sus:0.45, rel:0.14, filter:'lowpass', filterFreq:2700, maxGate:6 },
    counter: { layers:[ { type:'square', octave:0, detune:0, gain:1.0, filter:'lowpass', filterFreq:2000 } ], atk:0.006, dec:0.05, sus:0.4, rel:0.12, maxGate:5 },
    arp: { layers:[ { type:'square', octave:0, detune:7, gain:1.0 } ], atk:0.002, dec:0.025, sus:0.15, rel:0.05, filter:'lowpass', filterFreq:3400, maxGate:1 },
    bass: { layers:[ { type:'sawtooth', octave:0, detune:0, gain:1.0 } ], atk:0.004, dec:0.05, sus:0.6, rel:0.08, filter:'lowpass', filterFreq:1000, maxGate:3 },
    pad: { octave:0, voices:3, detune:11, type:'sawtooth', atk:0.08, dec:0.13, sus:0.7, rel:0.4, filter:'lowpass', filterFreq:1600 } },
  gains: { lead:0.145, harm:0.08, counter:0.085, arp:0.06, bass:0.17, sub:0.14, pad:0.058, kick:1.1, snare:1.05, crash:1.05 },
  sections: {
    intro:  makeSection({ bars:8, scale:'Amaj', chords:['A','A','E','E','D','D','E','E'], lead:cat(B4_HOOK, off(64,B4_HOOK)), harm:true, bassStyle:'half', arpRate:2, groove:'fourLite', sub:true, crash:true }),
    A1:     makeSection({ bars:8, scale:'Amaj', chords:['A','D','E','F#m','A','D','E','A'], lead:cat(B4_HOOK, off(32,B4_HOOK), off(64,B4_HOOK), off(96,B4_CLOSE)), bassStyle:'drive8', arpRate:1, groove:'bossDrive', sub:true, crash:true }),
    A2:     makeSection({ bars:8, scale:'Amaj', chords:['A','D','E','F#m','A','Bm','E','A'], lead:cat(B4_HOOK, off(32,B4_HOOK), off(64,B4_HOOK), off(96,B4_CLOSE)), harm:true, counter:true, bassStyle:'drive8', arpRate:1, groove:'bossDrive', sub:true, crash:true }),
    B:      makeSection({ bars:8, scale:'Amaj', chords:['D','A','E','C#m','D','A','E','A'], lead:B4_B, harm:true, counter:true, bassStyle:'pump8', arpRate:1, groove:'bossDrive', sub:true, crash:true }),
    bridge: makeSection({ bars:8, scale:null, chords:['F#m','F#m','D','A','Bm','Bm','E7','E7'], lead:B4_BRIDGE, bassStyle:'half', arpRate:2, groove:'bossBridge', sub:true }),
    climax: makeSection({ bars:8, scale:'Cmaj', chords:['C','F','G','Am','C','F','G7','C'], lead:cat(transpose(B4_HOOK,3), off(32,transpose(B4_HOOK,3)), off(64,transpose(B4_HOOK,3)), off(96,transpose(B4_CLOSE,3))), harm:true, counter:true, bassStyle:'drive8', arpRate:1, groove:'bossClimax', sub:true, crash:true }),
    A3:     makeSection({ bars:8, scale:'Amaj', chords:['A','D','E','F#m','A','D','E','A'], lead:cat(B4_HOOK, off(32,B4_HOOK), off(64,B4_HOOK), off(96,B4_CLOSE)), harm:true, counter:true, bassStyle:'drive8', arpRate:1, groove:'bossClimax', sub:true, crash:true }),
    outro:  makeSection({ bars:4, scale:null, chords:['D','E','A','A'], lead:B4_OUTRO, bassStyle:'half', arpRate:2, groove:'bossDrive', sub:true, crash:true }),
  },
  arrangement: ['intro','A1','A2','B','bridge','climax','A3','outro'],
};

// ================================================================ STAGE 5
// "Tempest Road" (高天原の道) — G Dorian, 132 BPM, gallop-driven. ADOPTED (was candidate A; chosen over the
// "Skyward Spiral" half-time draft on 2026-06-06). A windswept ascent across the cloud-sea: a tight 6-step
// CIRCLING-VORTEX ostinato (spins up, curls over the top, spirals back) in the lower octave, ANSWERED by a
// soaring high counter-melody that rides the gusts. Asymmetric midGallop groove + drive8 bass = a propulsive
// penultimate-stage climb, not the four/pump8 road mold. Modal Dorian (bright IV=C) for wind-blown motion.
const S5_VORTEX = [ // the spinning ostinato — repeats each bar, curling G→Bb→C→D→C→Bb
  [0,79],[2,82],[4,84],[6,86],[8,84],[10,82],[12,84],[14,86],   // G Bb C D | C Bb C D — orbit
];
const S5_VORTEX2 = [ // higher curl, hangs on the modal D
  [0,84],[2,86],[4,88],[6,89],[8,88],[10,86],[12,84],[14,86],   // C D E F | E D C D
];
const S5_SOAR = [ // soaring counter that answers across two bars (upper register)
  [4,91],[10,89],[14,88],            // (bar1) … D6 C6 Bb5-up wind gust
  [20,93],[26,91],[30,89],           // (bar2) E6 D6 C6
];
const S5_SOAR2 = [
  [4,89],[10,88],[14,86],
  [20,84],[26,86],[30,89],
];
const S5_B = [ // 8-bar lift, the vortex unwinds into a long soaring line
  [0,86],[4,89],[8,91],[12,93],[16,91],[24,88],
  [32,89],[40,91],[48,93],[56,96],
  [64,93],[72,91],[80,89],[88,88],
  [96,86],[104,89],[112,91],[120,93],
];
const S5_BRIDGE = [ [0,86],[8,84],[16,82],[24,81],[32,88],[40,86],[48,84],[56,82] ];
const S5_OUTRO  = [ [0,91],[4,89],[8,88],[12,86],[16,84],[20,82],[24,81],[28,79],[32,82],[40,79],[48,86],[56,84] ];
const STAGE5 = {
  title: 'Tempest Road', keyName: 'G Dorian — gallop', bpm: 132, gain: 0.55,
  voices: {
    lead: { layers:[ { type:'triangle', octave:0, detune:0, gain:1.0 }, { type:'sawtooth', octave:0, detune:8, gain:0.36, filter:'lowpass', filterFreq:2300 }, { type:'sine', octave:1, detune:0, gain:0.2 } ], atk:0.004, dec:0.05, sus:0.5, rel:0.14, maxGate:6 },
    counter: { layers:[ { type:'triangle', octave:0, detune:0, gain:1.0 }, { type:'sine', octave:0, detune:6, gain:0.4 } ], atk:0.006, dec:0.06, sus:0.5, rel:0.18, filter:'lowpass', filterFreq:2800, maxGate:6 },
    arp:  { layers:[ { type:'triangle', octave:1, detune:0, gain:1.0 } ], atk:0.002, dec:0.03, sus:0.13, rel:0.06, filter:'lowpass', filterFreq:3300, maxGate:1 },
    bass: { layers:[ { type:'sawtooth', octave:0, detune:0, gain:1.0 } ], atk:0.004, dec:0.06, sus:0.55, rel:0.1, filter:'lowpass', filterFreq:960, maxGate:3 },
    pad:  { octave:1, voices:3, detune:10, type:'sawtooth', atk:0.1, dec:0.14, sus:0.72, rel:0.42, filter:'lowpass', filterFreq:1800 } },
  gains: { lead:0.135, harm:0.07, counter:0.085, arp:0.055, bass:0.155, sub:0.12, pad:0.052, hat:1.0 },
  sections: {
    intro: makeSection({ bars:4, scale:'Gdor', chords:['Gm','Gm','Bb','C'], lead:cat(S5_VORTEX, off(32,S5_VORTEX)), bassStyle:'drive8', arpRate:2, groove:'introTick', sub:true, crash:true }),
    A:     makeSection({ bars:8, scale:'Gdor', chords:['Gm','Bb','C','Dm','Gm','F','Bb','C'], lead:cat(S5_VORTEX, off(32,S5_VORTEX2), off(64,S5_VORTEX), off(96,S5_VORTEX2)), counter:cat(S5_SOAR, off(64,S5_SOAR2)), bassStyle:'drive8', arpRate:2, groove:'midGallop', sub:true }),
    A2:    makeSection({ bars:8, scale:'Gdor', chords:['Gm','Bb','C','Dm','Gm','F','C','Dm'], lead:cat(S5_VORTEX, off(32,S5_VORTEX2), off(64,S5_VORTEX), off(96,S5_VORTEX2)), harm:true, counter:cat(S5_SOAR, off(64,S5_SOAR2)), bassStyle:'drive8', arpRate:2, groove:'midGallop', sub:true, crash:true }),
    B:     makeSection({ bars:8, scale:'Gdor', chords:['C','Dm','Bb','Gm','C','Dm','F','C'], lead:S5_B, counter:true, bassStyle:'drive8', arpRate:1, groove:'midGallop', sub:true, crash:true }),
    bridge:makeSection({ bars:4, scale:'Gdor', chords:['Dm','Bb','Gm','C'], lead:S5_BRIDGE, bassStyle:'half', arpRate:2, groove:'halfTime', sub:true }),
    A2b:   makeSection({ bars:8, scale:'Gdor', chords:['Gm','Bb','C','Dm','Gm','F','C','Dm'], lead:cat(S5_VORTEX, off(32,S5_VORTEX2), off(64,S5_VORTEX), off(96,S5_VORTEX2)), harm:true, counter:cat(S5_SOAR, off(64,S5_SOAR2)), bassStyle:'drive8', arpRate:1, groove:'midGallop', sub:true, crash:true }),
    outro: makeSection({ bars:4, scale:'Gdor', chords:['Gm','Bb','F','C'], lead:S5_OUTRO, bassStyle:'drive8', arpRate:1, groove:'midGallop', sub:true, crash:true }),
  },
  arrangement: ['intro','A','A2','B','bridge','A2b','outro'],
};

// ================================================================ STAGE 5 MIDBOSS
// "Wind Gate" (風の門) — B harmonic minor, 142 BPM, gusty stutter. ADOPTED (was candidate A; chosen over the
// "Whirlwind Jig" E-harm draft on 2026-06-06). The wind-bag gatekeeper 風神 who bars the way to the eye: a
// capricious wind-god whose STACCATO darting motif bursts in short flurries then leaves SUDDEN GUSTS OF SILENCE
// (long rests), only to dart back. Lighter & more playful than the S4 crone-gatekeeper — fast tripping 16ths,
// a teasing square counter that mimics it a beat late, a skipping gallop. The aug-2nd shimmer (b6 G ↔ #7 A#)
// gives it just enough edge to bite. A fresh root, distinct from S4's F#-minor gatekeeper.
const M5_GUST = [ // a short darting burst, then a long gust of rest
  [0,71],[1,73],[2,74],[3,73],[4,71],   // BB-flurry: B C# D C# B (fast stutter)
  [10,78],[11,79],[12,78],               // gust: F# G F# (sudden)
  // … long rest (steps 13-15 + into next entry) — the wind drops out
];
const M5_GUST2 = [
  [0,82],[1,79],[2,78],                   // A# G F# — high snap down
  [6,76],[7,74],[8,73],[9,71],            // E D C# B — tumbling
  [14,73],                                // C# — a teasing poke
];
const M5_GUST3 = [ // a longer dart that climbs the aug-2nd
  [0,71],[2,74],[4,76],[6,78],[8,79],[10,82],   // B D E F# G A# — climbing gust
  [12,79],[14,78],
];
const M5_B = [ // the gale rises — a continuous high whirl
  [0,86],[4,90],[8,91],[12,88],[16,86],[24,83],
  [32,85],[40,86],[48,90],[56,91],
  [64,90],[72,88],[80,86],[88,85],
  [96,83],[104,86],[112,88],[120,90],
];
const M5_BRIDGE = [ [0,74],[8,79],[16,82],[24,79],[32,78],[40,74],[48,73],[56,71] ];
const M5_OUTRO  = [ [0,83],[4,82],[8,79],[12,78],[16,76],[20,74],[24,73],[28,71],[40,74],[56,71] ];
const MIDBOSS5 = {
  title: 'Wind Gate', keyName: 'B harmonic minor — gusty', bpm: 142, gain: 0.58,
  voices: {
    lead: { layers:[ { type:'square', octave:0, detune:0, gain:0.9, filter:'lowpass', filterFreq:2700 }, { type:'triangle', octave:0, detune:6, gain:0.5 } ], atk:0.002, dec:0.04, sus:0.32, rel:0.08, maxGate:4 },
    counter: { layers:[ { type:'square', octave:0, detune:0, gain:1.0, filter:'lowpass', filterFreq:2100 } ], atk:0.003, dec:0.035, sus:0.3, rel:0.08, maxGate:3 },
    arp: { layers:[ { type:'square', octave:0, detune:7, gain:1.0 } ], atk:0.002, dec:0.022, sus:0.12, rel:0.04, filter:'lowpass', filterFreq:3200, maxGate:1 },
    bass: { layers:[ { type:'sawtooth', octave:0, detune:0, gain:1.0 } ], atk:0.004, dec:0.05, sus:0.5, rel:0.07, filter:'lowpass', filterFreq:900, maxGate:3 },
    pad: { octave:0, voices:3, detune:10, type:'sawtooth', atk:0.07, dec:0.12, sus:0.6, rel:0.34, filter:'lowpass', filterFreq:1450 } },
  gains: { lead:0.14, harm:0.075, counter:0.085, arp:0.062, bass:0.16, sub:0.12, pad:0.048, hat:1.1 },
  sections: {
    intro:  makeSection({ bars:4, scale:'Bharm', chords:['Bm','Bm','G','F#'], bassStyle:'half', arpRate:1, groove:'introTick', sub:true, crash:true }),
    A:      makeSection({ bars:8, scale:'Bharm', chords:['Bm','Em','G','F#','Bm','Em','F#','Bm'], lead:cat(M5_GUST, off(16,M5_GUST2), off(32,M5_GUST), off(48,M5_GUST3), off(64,M5_GUST), off(80,M5_GUST2), off(96,M5_GUST), off(112,M5_GUST3)), counter:true, bassStyle:'gallop', arpRate:2, groove:'midGallop', sub:true }),
    A2:     makeSection({ bars:8, scale:'Bharm', chords:['Bm','Em','G','F#','Bm','Em','F#7','Bm'], lead:cat(M5_GUST, off(16,M5_GUST2), off(32,M5_GUST), off(48,M5_GUST3), off(64,M5_GUST), off(80,M5_GUST2), off(96,M5_GUST), off(112,M5_GUST3)), harm:true, counter:true, bassStyle:'gallop', arpRate:2, groove:'midGallop', sub:true, crash:true }),
    B:      makeSection({ bars:8, scale:'Bharm', chords:['Em','G','F#','Bm','Em','G','F#','F#'], lead:M5_B, bassStyle:'pump8', arpRate:1, groove:'midGroove', sub:true, crash:true }),
    bridge: makeSection({ bars:4, scale:'Bharm', chords:['Em','F#','Bm','F#'], lead:M5_BRIDGE, bassStyle:'half', arpRate:2, groove:'halfTime', sub:true }),
    outro:  makeSection({ bars:4, scale:'Bharm', chords:['Em','F#','Bm','Bm'], lead:M5_OUTRO, bassStyle:'gallop', arpRate:1, groove:'introTick', sub:true }),
  },
  arrangement: ['intro','A','A2','B','bridge','A2','B','outro'],
};

// ================================================================ STAGE 5 BOSS
// "Yamata Coils" (八岐大蛇 / 須佐之男) — C octatonic (half-whole), 144 BPM. ADOPTED (was re-audition candidate C;
// chosen 2026-06-06 over the "Black Sky Dirge" C-Aeolian and "Whirlwind Rage" D-Phrygian-motorik drafts, and
// over the original "God of Storms" B-Phrygian-dominant anthem).
//   OCTATONIC UNEASE — a queasy, shifting 8-note diminished scale unlike ANY mode used elsewhere in the game
//   (it has no stable tonic, so the harmony slides restlessly). Structure = an ANTIPHONAL CALL-RESPONSE like
//   BOSS3 ("Mirror of Two Moons"), but COILED and menacing: the eight heads of Orochi answer each other in a
//   lurching, off-kilter serpent pulse (serpentLurch / serpentCoil) — no straight backbeat, no key-lift, no
//   taiko anthem. The diminished symmetry IS the unease.
const B5_CALL = [ // a coiling call that climbs the octatonic (C Db Eb E F# G A Bb), unsettling
  [0,60],[4,61],[8,63],[12,64],[16,66],[20,67],[24,69],[28,70],   // C Db Eb E | F# G A Bb — the serpent uncoils
];
const B5_ANS = [ // the answering head — an independent lower line in the rests (a real second voice)
  [2,55],[6,57],[10,58],[14,55],            // G(low) A Bb G — pc 7,9,10,7 (octatonic)
  [18,52],[22,54],[26,55],[30,52],          // E(low) F# G E
];
const B5_CALL2 = [
  [0,72],[4,70],[8,69],[12,67],[16,66],[20,64],[24,63],[28,61],   // C6 Bb A G | F# E Eb Db — the coil descends
];
const B5_ANS2 = [
  [2,67],[6,66],[10,64],[14,63],
  [18,61],[22,60],[26,58],[30,57],
];
const B5_UNI = [ // the heads strike together — a venomous unison stab figure
  [0,72],[2,76],[6,73],[8,70],[12,67],[16,66],[20,64],[24,60],[28,64],   // octatonic stabs
];
const B5_BRIDGE = [ // the coils gather — a slow rising diminished spiral, dread-building
  [0,60],[8,63],[16,66],[24,69],
  [32,70],[40,67],[48,64],[56,61],
  [64,67],[72,70],[80,73],[88,76],
  [96,73],[104,70],[112,67],[120,64],
];
const B5_OUTRO = [ [0,60],[4,63],[8,66],[16,67],[24,64],[32,61],[48,60] ];
const BOSS5 = {
  title: 'Yamata Coils', keyName: 'C octatonic — antiphonal serpent unease', bpm: 144, gain: 0.6,
  // venomous shifting timbre: a saw+square coiling lead, a triangle harm, a co-equal sine+triangle answer-counter (the second head), a glassy square arp, a saw bass, a cold dark pad.
  voices: {
    lead: { layers:[ { type:'sawtooth', octave:0, detune:0, gain:0.95, filter:'lowpass', filterFreq:2500 }, { type:'square', octave:0, detune:7, gain:0.4, filter:'lowpass', filterFreq:2200 } ], atk:0.004, dec:0.05, sus:0.42, rel:0.12, maxGate:5 },
    harm: { layers:[ { type:'triangle', octave:0, detune:-4, gain:1.0 } ], atk:0.006, dec:0.05, sus:0.42, rel:0.13, filter:'lowpass', filterFreq:2400, maxGate:5 },
    counter: { layers:[ { type:'sawtooth', octave:0, detune:0, gain:0.9, filter:'lowpass', filterFreq:2100 }, { type:'sine', octave:0, detune:6, gain:0.45 } ], atk:0.006, dec:0.06, sus:0.44, rel:0.15, maxGate:6 },
    arp: { layers:[ { type:'square', octave:0, detune:8, gain:1.0 } ], atk:0.002, dec:0.022, sus:0.13, rel:0.05, filter:'lowpass', filterFreq:3200, maxGate:1 },
    bass: { layers:[ { type:'sawtooth', octave:0, detune:0, gain:1.0 } ], atk:0.004, dec:0.05, sus:0.58, rel:0.08, filter:'lowpass', filterFreq:920, maxGate:3 },
    pad: { octave:0, voices:3, detune:12, type:'sawtooth', atk:0.1, dec:0.15, sus:0.7, rel:0.45, filter:'lowpass', filterFreq:1300 } },
  gains: { lead:0.14, harm:0.078, counter:0.098, arp:0.058, bass:0.17, sub:0.14, pad:0.058, kick:1.16, snare:1.02, crash:1.02 },
  sections: {
    intro:  makeSection({ bars:8, scale:'Coct', chords:['Cm','Cm','Eb','Eb','F#','F#','A','A'], lead:cat(B5_CALL, off(64,B5_CALL)), harm:true, bassStyle:'sparseRoot', arpRate:2, groove:'serpentLurch', sub:true, crash:true }),
    call:   makeSection({ bars:8, scale:'Coct', chords:['Cm','Cm','Eb','Eb','F#m','F#m','A','A'], lead:cat(B5_CALL, off(64,B5_CALL2)), counter:cat(B5_ANS, off(64,B5_ANS2)), bassStyle:'walk8', arpRate:2, groove:'serpentLurch', sub:true, crash:true }),
    callH:  makeSection({ bars:8, scale:'Coct', chords:['Cm','Eb','F#m','A','Cm','Eb','A','Cm'], lead:cat(B5_CALL, off(64,B5_CALL2)), harm:true, counter:cat(B5_ANS, off(64,B5_ANS2)), bassStyle:'walk8', arpRate:1, groove:'serpentCoil', sub:true, crash:true }),
    B:      makeSection({ bars:8, scale:'Coct', chords:['Eb','Cm','F#m','A','Eb','Cm','A','Cm'], lead:cat(B5_UNI, off(64,B5_UNI)), harm:true, counter:true, bassStyle:'pump8', arpRate:1, groove:'serpentCoil', sub:true, crash:true }),
    bridge: makeSection({ bars:8, scale:'Coct', chords:['Cm','Cm','Eb','Eb','F#m','F#m','A','A'], lead:B5_BRIDGE, bassStyle:'sparseRoot', arpRate:1, groove:'bossBridge', sub:true }),
    callF:  makeSection({ bars:8, scale:'Coct', chords:['Cm','Eb','F#m','A','Cm','Eb','A','Cm'], lead:cat(B5_CALL, off(64,B5_CALL2)), harm:true, counter:cat(B5_ANS, off(64,B5_ANS2)), bassStyle:'walk8', arpRate:1, groove:'serpentCoil', sub:true, crash:true }),
    outro:  makeSection({ bars:4, scale:'Coct', chords:['Eb','A','Cm','Cm'], lead:B5_OUTRO, bassStyle:'sparseRoot', arpRate:2, groove:'serpentLurch', sub:true, crash:true }),
  },
  arrangement: ['intro','call','callH','B','bridge','callF','outro'],
};

const TRACKS = { stage: STAGE, midboss: MIDBOSS, boss: BOSS, gameover: GAMEOVER, stage2: STAGE2, boss2: BOSS2, stage3: STAGE3, boss3: BOSS3, stage4: STAGE4, midboss4: MIDBOSS4, boss4: BOSS4, stage5: STAGE5, midboss5: MIDBOSS5, boss5: BOSS5 };

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
