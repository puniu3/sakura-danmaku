# Stage-3 BOSS music — replacement candidates (BOSS3_A / B / C)

Replacement **candidates** for the Stage-3 boss theme. The shipped `boss3` ("Twin Moons
Rising") **stays in place** — these are DEMO-ONLY tracks to audition, register under new
TRACKS keys, A/B-listen, and only then (if the user picks one) promote.

## Why the current BOSS3 is the defect

`BOSS3` is a structural clone of `BOSS` and `BOSS2`. All three share:
- the SAME arrangement `[intro, A1, A2, B, bridge, climax, A3, outro]`;
- the SAME climax trick — jump to the relative key a **minor 3rd up** (Charm / Fharm / Gharm)
  and replay `transpose(HOOK, 3)`;
- the SAME `gallop` bass + `midGallop`/`bossClimax`/`bossDrive`/`bossBridge` grooves;
- the SAME hook contour — **wide angular leaps then a stepwise fall** — over functional
  harmonic-minor `i–VI–III–V7`;
- the SAME "two-sisters" gesture done lazily: stack `harm = dShift(lead,-2)` + `counter =
  lead-12` on ONE hook. The "duet" is just the hook plus its own shadow.

Result: BOSS3 sounds like "the boss theme again, transposed." The three candidates below each
break a DIFFERENT set of those shared assumptions.

## Fiction the candidates must serve

Twin sisters fought at night in a lost bamboo grove (迷いの竹林) under twin moons: **宵 Yoi**
(dusk / indigo) and **暁 Akatsuki** (dawn / amber). Night, 和風, a duet / mirror, an arc from
dusk toward dawn. Each candidate dramatizes the twins differently.

---

## Lever matrix (each candidate uses a DIFFERENT combination)

| Lever | BOSS3 (current) | **A — Mirror of Two Moons** | **B — Twin Bamboo Pulse** | **C — Dusk Unto Dawn** |
| --- | --- | --- | --- | --- |
| Scale/mode | E harmonic-minor | **E In / 都節** `[0,4,5,9,11]` (和風 半音 colour) | **E hirajoshi** `[0,4,6,7,11]` (glittering 和 pentatonic) | **E Phrygian-dominant → A Dorian** (modal modulation) |
| Arrangement | stock 8-part | **antiphonal duet** (call → answer trades) | **stock 8-part shell KEPT** (same intro>A1>A2>B>bridge>climax>A3>outro as BOSS/BOSS2/BOSS3) — deliberately, to prove scale+groove+hook alone re-skin it | **through-composed dusk→dawn arc** |
| Climax device | min-3rd key lift + transposed hook | none — the *answer* is the climax | **SAME min-3rd-lift device** (`transpose(B_HOOK,3)`), recoloured to **G hirajoshi** (pentatonic, not functional harmonic-minor) — B's distinctiveness is scale+groove+ostinato, NOT the climax mechanism | **modulation UP a 4th into a BRIGHT mode** (dawn), not a min-3rd minor lift |
| Groove | gallop + bossClimax | **`taikoBoomBap` / `taikoCall`** (sparse 和太鼓) | **`skipDouble` / `skipClimax`** (double-time skip) | midGallop/bossDrive → **`fourFloor`** (radiant four-on-floor at dawn) |
| Hook contour | wide leap → fall | **sparse oscillating koto call**, sister answers it | **tight oscillating bell ostinato** | **chromatic creep** (dusk) → **radiant scalar rise** (dawn) |
| Two-sisters | harm+counter on one hook | **STRUCTURAL**: Akatsuki = a full INDEPENDENT answer phrase in the counter lane | unison-doubled "two bells", then trades | **STRUCTURAL** at dusk (independent counter), then sisters merge at dawn |
| BPM | 158 | **140** (spacious, ritual) | **170** (relentless) | **150** |

---

## Builder additions shared by these candidates

Two small, **backward-compatible** additions are required (they do not touch any existing
track, since they only fire on new option shapes / new groove names).

### 1. Independent-counter support in `makeSection` (needed by A and C)

The shipped builder only supports `counter:true` (the `lead-12` shadow echo). To make the duet
STRUCTURAL — Akatsuki carrying her **own** answer phrase, not Yoi's shadow — `makeSection` must
accept `counter` as an **array of `[step, midi]`** (same shape as `lead`). One-block change,
fully backward compatible (`counter:true` path is unchanged):

```js
// REPLACE the single counter block in makeSection with:
  const counter = new Array(L).fill(0);
  if (Array.isArray(spec.counter)) {                 // NEW: independent answer phrase
    for (const [st, n] of spec.counter) if (st >= 0 && st < L) counter[st] = n;
  } else if (spec.counter) {                          // unchanged: -12 shadow echo
    for (let i = 0; i < L; i++) { if (lead[i]) { const t = i + 2; if (t < L && !lead[t]) counter[t] = lead[i] - 12; } }
  }
```

NOTE on the validator: an array `counter` is key-checked just like `lead`/`harm`, so every
note in an answer phrase must be in the section's scale. (All answer phrases below were
hand-verified — see the bottom of this file.)

### 2. New SCALES entries

```js
// add to SCALES:
  Ein:      [0,4,5,9,11],          // E In/都節 (Miyako-bushi): E F A B C        (Candidate A)
  Ehira:    [0,4,6,7,11],          // E hirajoshi:              E F# G B C        (Candidate B)
  Ghira:    [2,3,7,9,10],          // G hirajoshi (= Ehira +3): G A Bb D Eb       (Candidate B climax lift)
  EphryDom: [0,2,4,5,8,9,11],      // E Phrygian-dominant:      E F G# A B C D     (Candidate C, dusk)
  Adorian:  [0,2,4,6,7,9,11],      // A Dorian:                 A B C D E F# G     (Candidate C, dawn lift)
```

### 3. New `bassBar` styles

```js
// add cases to bassBar's switch:
    case 'sparseRoot': a[0]=r; a[6]=r; a[10]=fifth; break;                              // A: breathing 和-feel
    case 'driveSku':   for (let i=0;i<16;i+=2) a[i]=r; a[3]=fifth; a[11]=fifth; a[14]=appr; break; // B: skip-driving 8ths + push
```

### 4. New `drumBar` grooves (exact 16-slot k / s / h patterns; h: 0 none, 1 closed, 2 open)

```js
// add cases to drumBar's switch:
    // ---- Candidate A: sparse 和太鼓 boom-bap (half-time ritual pulse) ----
    case 'taikoBoomBap': k[0]=1; k[10]=1; s[8]=1; h[4]=1; h[12]=2; break;
    // ---- Candidate A: fuller antiphonal "call" section (still 和-spacious, not a rock beat) ----
    case 'taikoCall':    k[0]=1; k[6]=1; k[10]=1; s[4]=1; s[12]=1; h[2]=1; h[8]=2; h[14]=1; break;
    // ---- Candidate B: double-time skip (kick on every quarter + skip pushes on the &-of-1 and &-of-3) ----
    case 'skipDouble':   [0,4,8,12].forEach(i=>k[i]=1); k[3]=1; k[11]=1; [4,12].forEach(i=>s[i]=1);
                         for (let i=0;i<16;i++) h[i] = (i%2===1?1:(i%4===0?2:1)); break;
    // ---- Candidate B: double-time skip CLIMAX (8th kicks + skip pushes, snare backbeat + ghost fills) ----
    case 'skipClimax':   for (let i=0;i<16;i+=2) k[i]=1; k[3]=1; k[11]=1; [4,12].forEach(i=>s[i]=1); s[7]=1; s[15]=1;
                         for (let i=0;i<16;i++) h[i]=1; break;
    // ---- Candidate C: radiant DAWN four-on-floor ----
    case 'fourFloor':    [0,4,8,12].forEach(i=>k[i]=1); [4,12].forEach(i=>s[i]=1);
                         for (let i=0;i<16;i+=2) h[i] = (i%4===2?2:1); break;
```

---

# BOSS3_A — "Mirror of Two Moons"

**(a) Identity pitch.** A slow, ritual antiphonal DUET in the **E In / 都節 (Miyako-bushi)** mode
— the most overtly 和風 of the three, its `b2` (F) and `b6` (C) half-steps giving a koto-and-incense
night-shrine air. The form is a literal call-and-answer: **Yoi** states a sparse oscillating
koto phrase in the lead; **Akatsuki** replies with her OWN independent phrase in the counter lane
(a real second melody, lower and consoling — not a `-12` shadow), so you hear two sisters trading
across the grove. *Vs BOSS / BOSS2:* no functional harmonic minor, no gallop, no min-3rd climax,
no leap-then-fall hook — it is spacious and modal where they are driving and tonal. *Vs B / C:* it
is the slowest (140 BPM), the only one with NO climax key-lift (the emotional peak is the unison
B-section, "two moons rise"), and the only one built on the In mode with 和太鼓 boom-bap.

**(b) Spec.** Key/mode: **E In / 都節** (`Ein = [0,4,5,9,11]`, E F A B C), no key change — the
contrast comes from texture, not modulation. **140 BPM**, `gain 0.6`. Arrangement: `intro · call ·
callH · B · bridge · callF · outro` (44 bars, ~75 s loop). Grooves: `introTick` → `taikoBoomBap`
(sparse) → `taikoCall` (fuller) → `halfTime` (bridge) → back. Texture: triangle+square-bell koto
lead; the **counter lane is a full co-equal voice** (its own gain bump to 0.10, doubled triangle+sine
for warmth = Akatsuki); a glassy bell arp; round sine bass with the breathing `sparseRoot` line.

**(c) Ready-to-paste JS.**

```js
// ===== BOSS3_A — "Mirror of Two Moons" — E In (都節), antiphonal duet =====
// Yoi calls (lead); Akatsuki answers with an INDEPENDENT phrase (counter lane).
const A_CALL  = [[0,76],[4,77],[6,76],[8,81],[12,83],[16,81],[20,84],[24,83],[28,81]];   // Yoi:   E F E A B | A C B A
const A_ANS   = [[0,69],[4,71],[8,72],[12,71],[16,72],[18,76],[24,71],[28,69]];          // Akatsuki answer:  A B C B | C E B A   (independent, lower)
const A_CALL2 = [[0,76],[4,81],[8,83],[12,84],[16,83],[20,81],[24,77],[28,76]];          // Yoi var
const A_ANS2  = [[0,72],[4,69],[8,71],[12,72],[16,76],[20,72],[24,71],[28,69]];          // Akatsuki answer var
const A_UNI   = [[0,84],[2,88],[6,84],[8,83],[12,81],[16,77],[20,76],[24,72],[28,76]];   // B: the sisters in unison — "two moons rise"
const A_BRIDGE= [[0,72],[8,69],[16,76],[24,72],[32,71],[40,69],[48,72],[56,76]];
const A_OUTRO = [[0,76],[6,77],[12,81],[20,83],[28,81],[40,76],[56,76]];
const BOSS3_A = {
  title:'Mirror of Two Moons', keyName:'E In (都節) — antiphonal', bpm:140, gain:0.6,
  voices:{
    lead:{ layers:[ {type:'triangle',octave:0,detune:0,gain:1.0}, {type:'square',octave:1,detune:0,gain:0.18,filter:'lowpass',filterFreq:3200}, {type:'sine',octave:0,detune:-4,gain:0.45} ], atk:0.004,dec:0.09,sus:0.34,rel:0.16,maxGate:5 },
    harm:{ layers:[ {type:'triangle',octave:0,detune:-5,gain:1.0} ], atk:0.006,dec:0.07,sus:0.4,rel:0.15,filter:'lowpass',filterFreq:2500,maxGate:5 },
    counter:{ layers:[ {type:'triangle',octave:0,detune:0,gain:1.0}, {type:'sine',octave:0,detune:6,gain:0.5} ], atk:0.006,dec:0.08,sus:0.42,rel:0.18,filter:'lowpass',filterFreq:2400,maxGate:6 },
    arp:{ layers:[ {type:'triangle',octave:1,detune:0,gain:1.0} ], atk:0.002,dec:0.04,sus:0.12,rel:0.07,filter:'lowpass',filterFreq:3200,maxGate:1 },
    bass:{ layers:[ {type:'sine',octave:0,detune:0,gain:1.0}, {type:'triangle',octave:0,detune:0,gain:0.4} ], atk:0.006,dec:0.07,sus:0.6,rel:0.12,filter:'lowpass',filterFreq:680,maxGate:5 },
    pad:{ octave:0,voices:3,detune:11,type:'sawtooth',atk:0.16,dec:0.2,sus:0.74,rel:0.6,filter:'lowpass',filterFreq:1150 } },
  gains:{ lead:0.14,harm:0.078,counter:0.10,arp:0.058,bass:0.16,sub:0.14,pad:0.066,kick:1.15,snare:1.0,crash:1.0 },
  sections:{
    intro: makeSection({bars:4,scale:'Ein',chords:['Em','Em','Am','B7'],lead:A_CALL,bassStyle:'sparseRoot',arpRate:2,groove:'introTick',sub:true,crash:true}),
    call:  makeSection({bars:8,scale:'Ein',chords:['Em','Em','Am','Am','C','C','B7','B7'],lead:cat(A_CALL,off(64,A_CALL2)),counter:cat(off(32,A_ANS),off(96,A_ANS2)),bassStyle:'sparseRoot',arpRate:2,groove:'taikoBoomBap',sub:true,crash:true}),
    callH: makeSection({bars:8,scale:'Ein',chords:['Em','Am','C','B7','Em','Am','B7','Em'],lead:cat(A_CALL,off(64,A_CALL2)),harm:true,counter:cat(off(32,A_ANS),off(96,A_ANS2)),bassStyle:'walk8',arpRate:2,groove:'taikoCall',sub:true,crash:true}),
    B:     makeSection({bars:8,scale:'Ein',chords:['Am','C','Em','B7','Am','C','B7','Em'],lead:cat(A_UNI,off(64,A_UNI)),harm:true,counter:true,bassStyle:'walk8',arpRate:1,groove:'taikoCall',sub:true,crash:true}),
    bridge:makeSection({bars:4,scale:'Ein',chords:['Am','B7','Em','B7'],lead:A_BRIDGE,bassStyle:'half',arpRate:2,groove:'halfTime',sub:true}),
    callF: makeSection({bars:8,scale:'Ein',chords:['Em','Am','C','B7','Em','Am','B7','Em'],lead:cat(A_CALL,off(64,A_CALL2)),harm:true,counter:cat(off(32,A_ANS),off(96,A_ANS2)),bassStyle:'walk8',arpRate:1,groove:'taikoCall',sub:true,crash:true}),
    outro: makeSection({bars:4,scale:'Ein',chords:['Am','C','Em','Em'],lead:A_OUTRO,bassStyle:'sparseRoot',arpRate:2,groove:'taikoBoomBap',sub:true,crash:true}),
  },
  arrangement:['intro','call','callH','B','bridge','callF','outro'],
};
```

---

# BOSS3_B — "Twin Bamboo Pulse"

**(a) Identity pitch.** A relentless, glittering chase in **E hirajoshi** built on a TIGHT
oscillating koto/bell ostinato (rapid 16th-step wobble around E–G–B–C) over a **double-time skip
beat** — bamboo clacking past at speed. The two sisters here are two BELLS: the lead is doubled an
octave up (square + triangle) so every figure rings as a pair, and the harm/counter shadow it
tightly. *Vs BOSS / BOSS2:* hirajoshi pentatonic (no leading-tone pull, no augmented-2nd), an
ostinato hook instead of leap-then-fall, and `skipDouble`/`skipClimax` instead of gallop. *Vs A:*
the opposite energy — fastest (170 BPM), dense, percussive, no spaces. *Vs C:* it never modulates
to a brighter mode — it stays nocturnal and driving end-to-end. **Honest distinctiveness caveat:**
B is the weakest of the three on structural novelty. It deliberately keeps BOTH the stock 8-part
boss shell AND the **same minor-3rd-up climax MECHANISM** — `transpose(B_HOOK,3)` into a key a
minor 3rd up — that BOSS, BOSS2 and the current BOSS3 all use. The only thing recoloured is the
*target scale* (G **hirajoshi**, a pentatonic-bright lift, rather than the stock functional
harmonic-minor of the boss family). B's genuine distance from the boss mold therefore comes NOT
from its climax but from its **scale (hirajoshi pentatonic — no leading-tone pull, no
augmented-2nd), its `skipDouble`/`skipClimax` groove, and its tight oscillating "two-bell"
ostinato** replacing the leap-then-fall hook. If a genuinely *different* climax is wanted, swap
`transpose(B_HOOK,3)` for a non-min-3rd device (see REVISION LOG); as written, B clears the
distinctiveness bar on texture, not on form.

**(b) Spec.** Key/mode: **E hirajoshi** (`Ehira = [0,4,6,7,11]`, E F# G B C), climax lifts to
**G hirajoshi** (`Ghira = [2,3,7,9,10]`) via the **same `transpose(B_HOOK,3)` min-3rd-up device the
boss family uses** — only the target scale is recoloured to pentatonic. **170 BPM**, `gain 0.62`.
Arrangement: keeps the boss 8-part shell `intro · A1 · A2 · B · bridge · climax · A3 · outro`
(60 bars, ~85 s) — deliberately, to show that even the stock shell + stock climax mechanism sound
new once the scale, hook, groove and bass change. Grooves:
`fourLite` → `skipDouble` → `bossBridge` → `skipClimax`. Texture: square-led chiptune "two-bell"
lead doubled +8va, square harm/counter, fast square arp, gritty saw bass on the `driveSku` push.

**(c) Ready-to-paste JS.**

```js
// ===== BOSS3_B — "Twin Bamboo Pulse" — E hirajoshi → G hirajoshi, double-time skip =====
// Tight oscillating "two-bell" ostinato; lead is octave-doubled so each figure rings as a pair.
const B_HOOK = [[0,76],[3,79],[6,76],[8,83],[10,84],[12,79],[14,76],[16,83],[19,84],[22,88],[24,84],[26,83],[28,79]];
const B_CLOSE= [[0,84],[4,83],[8,79],[12,76],[16,79],[20,76],[24,71],[28,76]];   // 71 = B4 (in-key), descending close
const B_B    = [[0,88],[6,84],[10,83],[16,84],[24,79],[32,78],[40,79],[48,84],[56,88],[64,90],[72,88],[80,84],[88,79],[96,83],[104,84],[112,88],[120,91]];
const B_BRIDGE=[[0,83],[8,79],[16,76],[24,72],[32,71],[40,76],[48,79],[56,83],[64,84],[72,88],[80,84],[88,79],[96,76],[104,79],[112,83],[120,84]];
const B_OUTRO= [[0,76],[3,79],[6,83],[10,84],[16,79],[24,76],[32,71],[48,76]];
const BOSS3_B = {
  title:'Twin Bamboo Pulse', keyName:'E hirajoshi → G hirajoshi', bpm:170, gain:0.62,
  voices:{
    lead:{ layers:[ {type:'square',octave:0,detune:0,gain:0.85,filter:'lowpass',filterFreq:2800}, {type:'triangle',octave:1,detune:0,gain:0.3}, {type:'square',octave:0,detune:9,gain:0.38,filter:'lowpass',filterFreq:2400} ], atk:0.003,dec:0.04,sus:0.32,rel:0.09,maxGate:4 },
    harm:{ layers:[ {type:'square',octave:0,detune:-5,gain:1.0,filter:'lowpass',filterFreq:2400} ], atk:0.004,dec:0.04,sus:0.34,rel:0.10,maxGate:4 },
    counter:{ layers:[ {type:'square',octave:0,detune:0,gain:1.0,filter:'lowpass',filterFreq:2000} ], atk:0.004,dec:0.04,sus:0.3,rel:0.09,maxGate:4 },
    arp:{ layers:[ {type:'square',octave:1,detune:7,gain:1.0} ], atk:0.002,dec:0.02,sus:0.12,rel:0.04,filter:'lowpass',filterFreq:3800,maxGate:1 },
    bass:{ layers:[ {type:'sawtooth',octave:0,detune:0,gain:1.0} ], atk:0.003,dec:0.045,sus:0.55,rel:0.07,filter:'lowpass',filterFreq:1100,maxGate:3 },
    pad:{ octave:0,voices:3,detune:12,type:'sawtooth',atk:0.06,dec:0.11,sus:0.64,rel:0.36,filter:'lowpass',filterFreq:1400 } },
  gains:{ lead:0.14,harm:0.078,counter:0.085,arp:0.07,bass:0.17,sub:0.14,pad:0.052,kick:1.12,snare:1.08,crash:1.05 },
  sections:{
    intro: makeSection({bars:8,scale:'Ehira',chords:['Em','Em','B7','B7','C','C','B7','B7'],lead:cat(B_HOOK,off(64,B_HOOK)),harm:true,bassStyle:'half',arpRate:2,groove:'fourLite',sub:true,crash:true}),
    A1:    makeSection({bars:8,scale:'Ehira',chords:['Em','C','G','B7','Em','C','Am','B7'],lead:cat(B_HOOK,off(32,B_HOOK),off(64,B_HOOK),off(96,B_CLOSE)),counter:true,bassStyle:'driveSku',arpRate:1,groove:'skipDouble',sub:true,crash:true}),
    A2:    makeSection({bars:8,scale:'Ehira',chords:['Em','C','G','B7','Em','Am','B7','Em'],lead:cat(B_HOOK,off(32,B_HOOK),off(64,B_HOOK),off(96,B_CLOSE)),harm:true,counter:true,bassStyle:'driveSku',arpRate:1,groove:'skipDouble',sub:true,crash:true}),
    B:     makeSection({bars:8,scale:'Ehira',chords:['C','G','Am','Em','C','G','B7','Em'],lead:B_B,harm:true,counter:true,bassStyle:'pump8',arpRate:1,groove:'skipDouble',sub:true,crash:true}),
    bridge:makeSection({bars:8,scale:'Ehira',chords:['Am','Am','Em','B7','C','C','B7','B7'],lead:B_BRIDGE,bassStyle:'half',arpRate:2,groove:'bossBridge',sub:true}),
    climax:makeSection({bars:8,scale:'Ghira',chords:['Gm','Eb','Bb','D7','Gm','Eb','Cm','D7'],lead:cat(transpose(B_HOOK,3),off(32,transpose(B_HOOK,3)),off(64,transpose(B_HOOK,3)),off(96,transpose(B_CLOSE,3))),harm:true,counter:true,bassStyle:'driveSku',arpRate:1,groove:'skipClimax',sub:true,crash:true}),
    A3:    makeSection({bars:8,scale:'Ehira',chords:['Em','C','G','B7','Em','Am','B7','Em'],lead:cat(B_HOOK,off(32,B_HOOK),off(64,B_HOOK),off(96,B_CLOSE)),harm:true,counter:true,bassStyle:'driveSku',arpRate:1,groove:'skipClimax',sub:true,crash:true}),
    outro: makeSection({bars:4,scale:'Ehira',chords:['Am','B7','Em','Em'],lead:B_OUTRO,bassStyle:'half',arpRate:2,groove:'skipDouble',sub:true,crash:true}),
  },
  arrangement:['intro','A1','A2','B','bridge','climax','A3','outro'],
};
```

> Note: `B_CLOSE` / `B_OUTRO` use B4 = MIDI 71 (in E hirajoshi) for the low close; do NOT
> use A (pc 9) or D#/Eb (pc 3) in any lead/harm/counter here — they are out of E hirajoshi
> and the validator will reject them (this was caught and fixed during hand-checking).

---

# BOSS3_C — "Dusk Unto Dawn"

**(a) Identity pitch.** A through-composed ARC that literally crosses from dusk to dawn. It opens
in **E Phrygian-dominant** — the darkest, most exotic colour (the `b2` F and major-3rd G# glint
give a tense, "between-worlds" twilight) — as a true antiphonal trade: **Yoi calls** a chromatic-creeping
phrase (lead, the 1st and 3rd two-bar blocks) and **Akatsuki answers** with her OWN independent lower
phrase (counter, the 2nd and 4th blocks, landing in Yoi's rests — never on top of her). At the
structural turn it does NOT use the stock minor-3rd
minor-key climax: instead it **modulates UP a fourth into A Dorian**, a genuinely BRIGHT minor
mode (natural 6th F#), and the music opens into a radiant scalar rise over a **four-on-the-floor**
beat — the dawn breaking, the sisters' lines merging. *Vs BOSS / BOSS2 / BOSS3:* the only
candidate whose climax brightens the mode rather than re-darkening it a min-3rd up — the arc
resolves toward light, fitting 暁 (dawn). *Vs A:* tonal and dramatic, not modal-ritual. *Vs B:*
through-composed and tonally moving, not an ostinato held in one nocturnal mode.

**(b) Spec.** Key/mode: **E Phrygian-dominant** (`EphryDom = [0,2,4,5,8,9,11]`, E F G# A B C D),
modulating UP a 4th to **A Dorian** (`Adorian = [0,2,4,6,7,9,11]`, A B C D E F# G). **150 BPM**,
`gain 0.62`. Arrangement (through-composed, no climax-replay): `intro · duskA · duskB · rise ·
dawn · dawn2 · outro` (52 bars, ~83 s) — note the absence of a literal `A3` recap; the loop
reseam is dawn→intro, reading as the night cycling back. Grooves: `fourLite` → `midGallop` →
`bossDrive` → `bossBridge` (rise) → **`fourFloor`** (dawn) → `bossClimax` (dawn2 peak). Texture:
saw+triangle lead (warmer than the BOSS-family cold saw); the **dusk counter is an independent
co-melody answering in Yoi's rests** (Akatsuki — call/answer, not a simultaneous parallel-harmony
voice) before the sisters unify into harm+counter doubling at dawn.

**(c) Ready-to-paste JS.**

```js
// ===== BOSS3_C — "Dusk Unto Dawn" — E Phrygian-dominant → A Dorian (modal dawn lift) =====
// Dusk: TRUE antiphony — Yoi calls (lead, blocks 0/2), Akatsuki answers (counter, blocks 1/3) in
// Yoi's rests; 0 same-step collisions, full 4-block coverage (mirrors Candidate A's verified trade).
// Dawn: the sisters merge — harm+counter doubling — into a radiant scalar rise in A Dorian over
// four-on-the-floor; not a minor-3rd minor lift.
const C_DUSK = [[0,76],[4,77],[8,80],[12,81],[16,80],[20,77],[24,74],[28,76]];   // Yoi CALL (block 0):   E F G# B | G# F D E
const C_DUSK2= [[0,80],[4,81],[8,84],[12,81],[16,80],[20,77],[24,76],[28,74]];   // Yoi CALL var (block 2)
const C_ANS  = [[0,69],[2,68],[6,65],[10,64],[16,72],[20,69],[24,68],[28,65]];   // Akatsuki ANSWER (block 1, in Yoi's rest): A G# F E | C A G# F
const C_ANS2 = [[0,72],[4,69],[8,68],[12,65],[16,64],[20,65],[24,68],[28,64]];   // Akatsuki ANSWER var (block 3):            C A G# F | E F G# E
const C_RISE = [[0,76],[8,80],[16,81],[24,84],[32,81],[40,80],[48,77],[56,80]];  // bridge: climbing out of dusk
const C_DAWN = [[0,81],[4,83],[8,84],[12,86],[16,88],[20,86],[24,84],[28,83],[32,81],[36,83],[40,86],[44,88],[48,90],[52,88],[56,86],[60,84]]; // A Dorian radiant rise
const C_DAWN2= [[0,88],[4,86],[8,84],[12,86],[16,88],[20,90],[24,88],[28,86],[32,84],[36,86],[40,88],[44,90],[48,93],[52,90],[56,88],[60,86]];
const C_OUTRO= [[0,81],[8,84],[16,88],[24,86],[32,84],[48,81]];
const BOSS3_C = {
  title:'Dusk Unto Dawn', keyName:'E Phrygian-dominant → A Dorian (dawn lift)', bpm:150, gain:0.62,
  voices:{
    lead:{ layers:[ {type:'sawtooth',octave:0,detune:0,gain:0.85,filter:'lowpass',filterFreq:2500}, {type:'triangle',octave:0,detune:0,gain:0.55}, {type:'triangle',octave:1,detune:0,gain:0.22} ], atk:0.005,dec:0.06,sus:0.46,rel:0.14,maxGate:6 },
    harm:{ layers:[ {type:'triangle',octave:0,detune:-5,gain:1.0} ], atk:0.007,dec:0.06,sus:0.44,rel:0.15,filter:'lowpass',filterFreq:2500,maxGate:6 },
    counter:{ layers:[ {type:'sawtooth',octave:0,detune:0,gain:0.9,filter:'lowpass',filterFreq:1800}, {type:'sine',octave:0,detune:0,gain:0.4} ], atk:0.006,dec:0.06,sus:0.42,rel:0.14,maxGate:6 },
    arp:{ layers:[ {type:'triangle',octave:0,detune:7,gain:1.0} ], atk:0.002,dec:0.025,sus:0.15,rel:0.05,filter:'lowpass',filterFreq:3300,maxGate:1 },
    bass:{ layers:[ {type:'sawtooth',octave:0,detune:0,gain:1.0} ], atk:0.004,dec:0.05,sus:0.6,rel:0.08,filter:'lowpass',filterFreq:980,maxGate:3 },
    pad:{ octave:0,voices:3,detune:11,type:'sawtooth',atk:0.1,dec:0.15,sus:0.7,rel:0.45,filter:'lowpass',filterFreq:1350 } },
  gains:{ lead:0.144,harm:0.08,counter:0.092,arp:0.06,bass:0.17,sub:0.14,pad:0.058,kick:1.1,snare:1.05,crash:1.05 },
  sections:{
    intro:  makeSection({bars:8,scale:'EphryDom',chords:['Em','Em','E7','E7','Am','Am','B7','B7'],lead:cat(C_DUSK,off(64,C_DUSK)),harm:true,bassStyle:'half',arpRate:2,groove:'fourLite',sub:true,crash:true}),
    duskA:  makeSection({bars:8,scale:'EphryDom',chords:['Em','F','Am','B7','Em','F','C','B7'],lead:cat(C_DUSK,off(64,C_DUSK2)),counter:cat(off(32,C_ANS),off(96,C_ANS2)),bassStyle:'gallop',arpRate:1,groove:'midGallop',sub:true,crash:true}),
    duskB:  makeSection({bars:8,scale:'EphryDom',chords:['Em','F','Am','B7','Em','C','B7','Em'],lead:cat(C_DUSK,off(64,C_DUSK2)),harm:true,counter:cat(off(32,C_ANS),off(96,C_ANS2)),bassStyle:'gallop',arpRate:1,groove:'bossDrive',sub:true,crash:true}),
    rise:   makeSection({bars:8,scale:'EphryDom',chords:['Am','Am','Em','B7','C','C','B7','B7'],lead:cat(C_RISE,off(64,C_RISE)),bassStyle:'half',arpRate:2,groove:'bossBridge',sub:true}),
    dawn:   makeSection({bars:8,scale:'Adorian',chords:['Am','D','G','Em','Am','D','F','Em'],lead:cat(C_DAWN,off(64,C_DAWN2)),harm:true,counter:true,bassStyle:'drive8',arpRate:1,groove:'fourFloor',sub:true,crash:true}),
    dawn2:  makeSection({bars:8,scale:'Adorian',chords:['Am','D','G','C','Am','F','Em','Am'],lead:cat(C_DAWN,off(64,C_DAWN2)),harm:true,counter:true,bassStyle:'drive8',arpRate:1,groove:'bossClimax',sub:true,crash:true}),
    outro:  makeSection({bars:4,scale:'Adorian',chords:['D','Em','Am','Am'],lead:C_OUTRO,bassStyle:'drive8',arpRate:2,groove:'fourFloor',sub:true,crash:true}),
  },
  arrangement:['intro','duskA','duskB','rise','dawn','dawn2','outro'],
};
```

---

## Integration notes

- These are **DEMO-ONLY candidates.** The real `boss3` ("Twin Moons Rising") **stays registered
  and shipped** until the user picks a replacement. Do NOT remove or overwrite it.
- To audition, apply the four **builder additions** above (independent-counter support, the
  SCALES entries `Ein/Ehira/Ghira/EphryDom/Adorian`, the two `bassBar` styles, the four `drumBar`
  grooves) to `design/bgm-tracks.js`, paste the three track objects, and register:

  ```js
  const TRACKS = { stage:STAGE, midboss:MIDBOSS, boss:BOSS, gameover:GAMEOVER,
                   stage2:STAGE2, boss2:BOSS2, stage3:STAGE3, boss3:BOSS3,
                   boss3a:BOSS3_A, boss3b:BOSS3_B, boss3c:BOSS3_C };   // <-- 3 demo keys
  ```

- Then `node design/bgm-tracks.js` (validates lanes + in-key for ALL tracks, including the new
  three) and `node design/build-bgm.js` to rebuild `bgm-demo.html` for A/B listening. `playMusic`
  already accepts any `trackOf(name)` key, so the demo harness can switch among `boss3a/b/c`
  without a whitelist edit.
- After a winner is chosen: rename the winner's consts/object to the canonical `BOSS3` /
  `B3_*` names, replace the shipped `boss3` body, fold its required SCALES / `bassBar` /
  `drumBar` additions in permanently, drop the other two candidate objects, then run the full
  pre-ship gate (`node design/bgm-tracks.js && node design/build-game.js --check &&
  node design/test-content.js && node design/test-bgm-unlock.js`) and re-inline via
  `design/build-game.js`. (No `index.html` change is needed merely to audition — these live in
  the tracks source + demo harness only.)

## Hand-check statement (done before writing this file)

I hand-checked, via a Node harness that mirrors the real `makeSection` + `validateTracks` (and
the `dShift(lead,-2)` harm rule and `counter = lead-12` echo rule), the following:

- **Per-candidate hook + answer + one full section**, confirming every `lead`, derived `harm`
  (`dShift(lead,-2)`), and `counter` note is a pitch-class IN the section's scale:
  - **A** (E In `[0,4,5,9,11]`): `A_CALL`, `A_ANS` (independent counter), `A_CALL2`, `A_ANS2`,
    `A_UNI` — all in-key for lead/harm/counter.
  - **B** (E hirajoshi `[0,4,6,7,11]`): `B_HOOK`, `B_CLOSE` in-key. The B-section lift originally
    had out-of-key notes (D#=pc3, A=pc9 are NOT in E hirajoshi) — **the validator caught them and
    I corrected `B_B`** to the version shown above (re-verified clean). Climax uses `Ghira`
    `[2,3,7,9,10]` via `transpose(B_HOOK,3)`.
  - **C** (E Phrygian-dominant `[0,2,4,5,8,9,11]` dusk; A Dorian `[0,2,4,6,7,9,11]` dawn):
    `C_DUSK`, `C_DUSK2` (Yoi calls) and `C_ANS`, `C_ANS2` (Akatsuki answers — independent counter)
    in-key for EphryDom; `C_DAWN`, `C_DAWN2`, `C_OUTRO` in-key for Adorian. **Antiphony re-verified
    post-revision:** in `duskA`/`duskB` the lead occupies only blocks 0/2 and the counter only
    blocks 1/3 → **0 same-step lead/counter collisions, full 4-block coverage** (lead 8/0/8/0,
    counter 0/8/0/8), mirroring Candidate A's `call` section. (The pre-revision C collided on 10
    steps and was silent for blocks 1/3 — fixed; see REVISION LOG.)
- **Full-track run** of all three through the validator clone: **44 / 60 / 52 bars**, loops
  **75.4 / 84.7 / 83.2 s**, all lane lengths correct, **1129 melodic notes checked, all in-key.**
- Pentatonic caveat verified: because `dShift` snaps to the scale's own index set, `harm =
  dShift(lead,-2)` and `counter = lead-12` stay in-key **provided the lead note is in-key** —
  which is exactly the failure mode the B-section error exposed and the fix resolved.

## REVISION LOG (2026-06-05 — adversarial review fixes)

A reviewer flagged three issues; all are fixed in place above and re-verified against a Node clone
of `makeSection` + `validateTracks` (with the four proposed builder additions applied).

1. **Candidate C — counter was NOT antiphonal (MUST-FIX / correctness).** As originally written,
   `duskA`/`duskB` had a full 4-block lead AND `counter:cat(C_ANS,off(64,C_ANS))`, which placed the
   counter on the SAME steps as the lead → **10 same-step collisions per dusk section** (steps
   0,16,20,24,28,64,80,84,88,92; intervals P5/m6/M6/M7 — a parallel-harmony stack, not an answer) and
   left blocks 1/3 with **zero counter** (coverage 8/0/8/0). The headline "STRUCTURAL independent
   counter" lever was undelivered. **Fix (mirrors Candidate A's verified true antiphony):** the lead
   (Yoi) now calls only in blocks 0/2 — `lead:cat(C_DUSK,off(64,C_DUSK2))` — and the counter
   (Akatsuki) answers only in blocks 1/3 — `counter:cat(off(32,C_ANS),off(96,C_ANS2))`. Added a new
   `C_ANS2` answer-variation phrase (C A G♯ F | E F G♯ E, all in EphryDom) for block 3, paralleling
   A's `A_ANS`/`A_ANS2`. **Re-verified: 0 same-step collisions, full 4-block coverage (lead 8/0/8/0,
   counter 0/8/0/8), all lead/harm/counter notes in-key for EphryDom; section still 8 bars, full
   track still 52 bars / 83.2 s loop — metrics unchanged.** Prose in the lever matrix, C's (a) pitch,
   C's (b) spec, the code-block header comment, and the hand-check statement all updated to describe
   true call/answer-in-the-rests antiphony.

2. **Candidate B — climax-distinctiveness overstatement (MUST-FIX honesty / distinctiveness).** The
   lever matrix said B's climax was "recoloured not functional," implying a different climax device.
   Mechanically B uses the **SAME `transpose(B_HOOK,3)` minor-3rd-up lift** that BOSS, BOSS2 and the
   current BOSS3 all use; only the target *scale* (G hirajoshi) is recoloured. **Fix (prose only — B
   validates clean and needs no code change):** the lever matrix's "Climax device" and "Arrangement"
   cells, B's (a) identity pitch, and B's (b) spec now state plainly that B keeps both the stock
   8-part shell AND the shared min-3rd climax mechanism, and that B's genuine distance from the boss
   mold comes from its **scale + `skipDouble`/`skipClimax` groove + two-bell ostinato**, not its
   climax. Added an explicit pointer: to make the climax genuinely different, swap `transpose(B_HOOK,3)`
   for a non-min-3rd device (e.g. an up-a-4th modal lift like Candidate C, or a same-key
   double-time intensification with no transposition).

3. **No code change required for A or B (verified).** A and B validate clean exactly as written
   (44/60 bars, 75.4/84.7 s, 207/548 in-key notes, 0 collisions). A is the cleanest delivery of its
   stated fiction; C is now an equally clean delivery of its (independent antiphonal counter) fiction.

Verification command used (clone harness applying the four builder additions, then extracting the
three `(c)` track objects straight out of this file): all three return **0 errors, 0 lead/counter
same-step collisions**; per-candidate bars/loops match the metrics quoted above.
