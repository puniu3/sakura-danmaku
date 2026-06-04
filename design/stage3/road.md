# Stage 3 ROAD redesign — 迷いの竹林 / Grove of the Lost

Proposal only. Does NOT edit `index.html`. Ready-to-paste JS below. Touches the Stage 3 ROAD beats
only — the midboss `yoiIntro`, the final `twins`, and Stages 1/2 are untouched. New waves are
registered in `WAVES` so `test-content.js` registry-presence stays green.

---

## IDENTITY PITCH

Stage 2's road is a **ghost lane**: horizontal sheared cascades and a heavy *wraith* lobbing
homing soul-orb rings (`pat.delayedTurn`). Stage 3's grove instead reads as a **maze you are lost
inside**: bullets that **ricochet off the bamboo walls** (`pat.bouncingBullets`), **stalk-files
that rain straight down like falling culms** (`pat.lineOfBullets`), and **lantern-cluster bursts**
(`pat.ringOfRings`) — and every formation is **vertical or mirror-symmetric** (descending columns,
flank pincers, left/right twin sentinels) rather than horizontal sweeps, **foreshadowing the twin
sisters**. The 山場 enemy is no longer the wraith but a new **Kodama** that fires *crossing
flower-rosettes + a wall-bouncing scatter* — the grove's own danmaku signature, distinct from the
ghost road's homing rings.

---

## NEW MECHANICS / ENEMIES / FORMATIONS

- **`waveLantern` (NEW enemy — bobbing 提灯)**: descends to a hover band, **bobs vertically** in place,
  and lobs **wall-bouncing bullets** (`pat.bouncingBullets`, lantern-gold `kite` bullets that ricochet
  off both side walls — the "trapped in the maze" feel) interleaved with a **straight-down stalk-file**
  (`pat.lineOfBullets`, falling-culm column). Spawns as a **mirror pair** by default (left+right
  symmetric) to foreshadow the twins. Tanky-ish, drops well. Pure NEW firing vocabulary — none of
  Stage 2's homing rings or aimed lobs.
- **`waveStalkColumn` (NEW formation — descending bamboo files)**: light sprites fall in **vertical
  columns** (files), each column a tight train descending its own lane, firing short **straight
  `lineOfBullets` darts downward** (a bamboo-stalk segment dropping). Columns can be placed as an
  **X-cross** (two diagonal files crossing) or as **evenly-spaced vertical stalks**. Replaces Stage 2's
  horizontal `sideSweep`/`drifters` cascade as the opener's spatial idea: down-the-grove, not across it.
- **`waveKodama` (NEW 山場 enemy — REPLACES the wraith as the road climax)**: a darting wood-spirit that
  weaves between two hover anchors and fires the grove's signature: **crossing leaf-rosettes**
  (`pat.roseCurve`/`pat.flower`, two opposing-`k` rosettes that cross) plus a periodic
  **wall-bouncing scatter** (`pat.bouncingBullets`) and an occasional **cluster-burst ring**
  (`pat.ringOfRings`, kept low-count to avoid flooding). This is the road's OWN danmaku identity —
  no `pat.delayedTurn` homing orbs anywhere on the Stage 3 road.
- **PINCER formation** (timeline-level, via `waveStalkColumn` placement + a mirror `waveLantern`): files
  press in from both flanks and close toward centre, instead of one edge-to-edge sweep.
- **MIRROR-PAIR spawning** (`waveLantern` `mirror:true`, `waveKodama` symmetric anchors): every heavy
  beat is left/right symmetric — the visual promise of 宵 & 暁.

Bullet-budget note: `ringOfRings` is `clusters*(perCluster+1)` bullets/call. Kodama uses
`clusters:6, perCluster:4` → 30 bullets/call on a **~2.0 s** cadence, and only 4–6 Kodama live at the
peak — far below the wraith octet's overlapping homing rings. No perf bomb, no unfair wall.

---

## NEW WAVE FACTORIES (ready-to-paste)

Paste these immediately **after** `waveWraith` (line ~2153) and **before** the `const WAVES = …`
line. They follow the `waveDrifters`/`waveWraith` structure exactly: `opts -> generator`, looped
`spawnEnemy({...,coro})` with `waitT` pacing; manual integrate loops set `e._steered=true` every tick
they write position; firing is forked via `Director.fork(()=>fn(e),e)` (owner-tied → auto-killed on
death) or `holdFire`; `despawnEnemy(e)`/`exitOff` on the way out. They honour `opts.hue`,
`opts.halvePower`, `opts.sparse`.

```js
// ---- Stage 3 (grove) wave generators ----
// Grove vocabulary, distinct from Stage 2's ghost road: NO homing soul-orb rings (pat.delayedTurn).
// Instead: wall-bouncing ricochets (pat.bouncingBullets), straight stalk-files (pat.lineOfBullets),
// crossing leaf-rosettes (pat.roseCurve/flower) and low-count cluster bursts (pat.ringOfRings).

// waveStalkColumn — light sprites fall in VERTICAL FILES (descending bamboo stalks). Each of opts.cols
// columns is a tight train of opts.per sprites down its own lane; sprites drop a short straight
// lineOfBullets dart-file as they pass. opts.cross (bool) slants alternating columns into an X.
// Manual integrate loop sets _steered each tick (the #1 trap). Fire fork is owner-tied (auto-kill on death).
function waveStalkColumn(opts){ return (function*(){
  const cols=opts.cols||3, per=opts.per||5, hue=opts.hue!=null?opts.hue:140,
        spd=opts.speed||90, gap=opts.gap||0.42, colGap=opts.colGap||0.0,
        cross=!!opts.cross, halveP=!!opts.halvePower, sparse=!!opts.sparse,
        x0=opts.x0!=null?opts.x0:PF_W*0.18, x1=opts.x1!=null?opts.x1:PF_W*0.82;
  for(let c=0;c<cols;c++){
    const cx=cols>1?(x0+(x1-x0)*(c/(cols-1))):PF_W*0.5;
    const drift=cross?((c%2===0)?34:-34):0;   // alternate columns slant → crossing X over time
    for(let i=0;i<per;i++){
      const idx=c*per+i;
      spawnEnemy({ x:cx, y:-SPAWN_MARGIN-i*8, hp:HP_POP_LIGHT, r:R_POP_LIGHT, hue:hue, score:400,
        drops:(sparse&&idx%2!==0)?[]:((idx%3===0&&(!halveP||idx%6===0))?['power']:['point']),
        coro:function*(e){
          const baseX=e.x, t0=T;
          const fc=Director.fork(function*(){ while(true){
            pat.lineOfBullets(e,{count:4,gap:13,angle:HALFPI,speed:150,startGap:10,hue:hue,style:'arrow'});
            yield* waitT(1.1);
          } },e);
          while(e.y<PF_H+SPAWN_MARGIN){ e.y+=spd*STEP; e.x=baseX+drift*(T-t0); e._steered=true; yield; }
          Director.kill(fc); despawnEnemy(e);
        } });
      yield* waitT(gap);
    }
    if(colGap) yield* waitT(colGap);
  }
})(); }

// waveLantern — bobbing 提灯. Descends to a hover band, BOBS vertically in place, and lobs
// wall-BOUNCING bullets (pat.bouncingBullets — ricochet off the side walls) interleaved with a
// straight stalk-file (pat.lineOfBullets). opts.mirror (default true) spawns a left+right symmetric
// PAIR per index → foreshadows the twins. opts.n = number of lanterns PER SIDE.
// The body coro owns the bob (manual loop, sets _steered every tick); firing is a separate owner-tied fork.
function waveLantern(opts){ return (function*(){
  const n=opts.n||3, hue=opts.hue!=null?opts.hue:45, y=opts.y||118, hold=opts.hold||6.0,
        mirror=opts.mirror!==false, halveP=!!opts.halvePower,
        bob=opts.bob||26, span=opts.span!=null?opts.span:PF_W*0.30, cx=PF_W*0.5;
  function makeOne(targetX, side){
    spawnEnemy({ x:targetX, y:-SPAWN_MARGIN, hp:HP_POP_HEAVY, r:R_POP_HEAVY, hue:hue, score:1300,
      drops:halveP?['power','point','point']:['power','power','point'], cancelOnDeath:0.4,
      coro:function*(e){
        yield* moveTo(e,targetX,y,1.0,EASE.out);
        // BOB in place + fire, both as forks so the body coro can time the hold window cleanly.
        const bobFork=Director.fork(function*(){ const y0=e.y, t0=T; while(true){ e.y=y0+Math.sin((T-t0)*1.8)*bob; e.x=targetX; e._steered=true; yield; } },e);
        const fireFork=Director.fork(function*(){ let k=0; while(true){
          // wall-bouncing ricochet fan (the maze feel) — kite bullets that bounce off the side walls
          pat.bouncingBullets(e,{count:5,spread:1.0,baseAngle:HALFPI+(side*0.22),speed:120,hue:hue,style:'kite',bounces:2});
          yield* waitT(0.9);
          if(k%2===1){ // a straight downward stalk-file between ricochet volleys
            pat.lineOfBullets(e,{count:5,gap:14,angle:HALFPI,speed:140,startGap:12,hue:hueShift(hue,18),style:'arrow'});
          }
          k++; yield* waitT(0.7);
        } },e);
        yield* waitT(hold);
        Director.kill(bobFork); Director.kill(fireFork);
        yield* exitOff(e,(side<0)?Math.PI*0.85:Math.PI*0.15,150);
      } });
  }
  for(let i=0;i<n;i++){
    const off=(i+1)/(n+1)*span;     // symmetric offset from centre
    if(mirror){ makeOne(cx-off,-1); makeOne(cx+off,+1); }
    else { makeOne(cx + ((i%2===0)?-off:off), (i%2===0)?-1:+1); }
    yield* waitT(opts.spacing!=null?opts.spacing:0.6);
  }
})(); }

// waveKodama — the grove's 山場 enemy (REPLACES the wraith as the road climax). A wood-spirit that
// WEAVES between two hover anchors (manual integrate, sets _steered) and fires the grove signature:
// crossing leaf-ROSETTES (pat.roseCurve, opposing k) + a periodic wall-BOUNCING scatter + an occasional
// low-count cluster-burst ring (pat.ringOfRings). NO homing orbs. Spawn 4–6 to overlap (the 山場).
function waveKodama(opts){ return (function*(){
  const xs=opts.xs||[PF_W*0.5], y=opts.y||120, hold=opts.hold||7.0,
        hue=opts.hue!=null?opts.hue:148, halveP=!!opts.halvePower, weave=opts.weave||34;
  for(let i=0;i<xs.length;i++){
    spawnEnemy({ x:xs[i], y:-SPAWN_MARGIN, hp:HP_POP_HEAVY*1.35, r:R_POP_HEAVY+1, hue:hue, score:1500,
      drops:halveP?['power','point','point']:['power','power','point'], cancelOnDeath:0.5,
      coro:function*(e){
        yield* moveTo(e,xs[i],y,1.1,EASE.out);
        // gentle horizontal weave around the anchor (sets _steered every tick) as a fork
        const weaveFork=Director.fork(function*(){ const x0=xs[i], t0=T; while(true){ e.x=x0+Math.sin((T-t0)*1.1+i)*weave; e.y=y; e._steered=true; yield; } },e);
        yield* holdFire(e,function*(en){ let k=0; while(true){
          // crossing leaf-rosettes — two opposing-k rosettes that interleave into a lattice
          pat.roseCurve(en,{count:18,k:5,speed:120,phase:T*0.5,hue:hue,style:'star'});
          pat.roseCurve(en,{count:18,k:4,speed:104,phase:-T*0.5,hue:hueShift(hue,30),style:'star'});
          yield* waitT(1.2);
          // wall-bouncing scatter (the maze ricochet)
          pat.bouncingBullets(en,{count:7,spread:1.4,baseAngle:HALFPI,speed:118,hue:hueShift(hue,-20),style:'kite',bounces:2});
          yield* waitT(0.8);
          if(k%2===1){ // occasional cluster-burst ring — kept LOW count (6*(4+1)=30 bullets) to avoid flooding
            pat.ringOfRings(en,{clusters:6,perCluster:4,baseAngle:T*0.4,burstSpeed:96,burstSpread:0.7,clusterSpeed:60,hue:hueShift(hue,12),style:'pellet'});
            yield* waitT(0.9);
          }
          k++;
        } },hold);
        Director.kill(weaveFork);
        yield* exitOff(e,(i%2)?Math.PI*0.85:Math.PI*0.15,150);
      } });
    yield* waitT(opts.spacing!=null?opts.spacing:0.45);
  }
})(); }
```

### WAVES registry — exact additions

Change the existing registry line:

```js
const WAVES = { sideSweep:waveSideSweep, vFormation:waveVFormation, stream:waveStream, turrets:waveTurrets, drifters:waveDrifters, wraith:waveWraith };
```

to:

```js
const WAVES = { sideSweep:waveSideSweep, vFormation:waveVFormation, stream:waveStream, turrets:waveTurrets, drifters:waveDrifters, wraith:waveWraith, stalkColumn:waveStalkColumn, lantern:waveLantern, kodama:waveKodama };
```

(Stages 1 & 2 reference only the original six names → unchanged. `resolveWave` is NOT touched; the new
factories read `opts` exactly like the others and are identity-at-normal because nothing in them mutates
the passed `opts`.)

---

## REBUILT STAGES[2] (Stage 3) timeline (ready-to-paste)

Replace the whole `STAGES[2]` object (`{ id:3, title:'Stage 3', theme:'bamboo', … }`, lines ~2389–2424).
Spine is unchanged: road → 山場 → midboss `yoiIntro` (no music switch) → road → 山場 → final `twins`
(the one music switch to `boss3`). Only the ROAD beats are rewritten; every `banner`/`sfx`/`flash`/
`shake`/`music`/`wait` verb around the bosses is preserved verbatim.

```js
  // STAGE 3 — "Grove of the Lost" (迷いの竹林). Spine mirrors Stage 2: road → 山場 → MIDBOSS (宵 alone,
  // 2 phases → retreat, on the 道中 BGM) → more road → 山場 → the 2体同時出現 twin boss (宵 & 暁, shared HP).
  // The ROAD has its OWN identity (vs Stage 2's ghost lane): vertical stalk-files, bobbing lanterns that
  // RICOCHET bullets off the walls, and a Kodama 山場 firing crossing leaf-rosettes — no homing soul-orbs.
  // Mirror-paired / symmetric heavy beats foreshadow the twins. Counts sized for the power=max real entry.
  { id:3, title:'Stage 3', theme:'bamboo',
    music:{ stage:'stage3', boss:'boss3' },     // NO midboss track — 宵's solo appearance underscores on the 道中 (stage3)
    timeline:[
      {banner:'Stage 3'}, {wait:INTRO_FADE},
      // opening: a DESCENT THROUGH THE GROVE — vertical bamboo-stalk files fall down their own lanes
      // (not a horizontal cascade). An X-cross of jade files crosses while two flanking indigo files
      // press the edges (a soft pincer). Total ~30 light sprites; halvePower+sparse keep the drop count down.
      {parallel:[ {wave:'stalkColumn', opts:{cols:3,per:6,x0:PF_W*0.24,x1:PF_W*0.76,cross:true,speed:92,gap:0.40,hue:140,halvePower:true,sparse:true}},
                  {wave:'stalkColumn', opts:{cols:2,per:5,x0:PF_W*0.10,x1:PF_W*0.90,cross:false,speed:84,gap:0.46,hue:265,halvePower:true,sparse:true}, delay:1.4} ]}, {waitClear:true}, {wait:WAVE_GAP},
      // a MIRROR PAIR of lantern-gold 提灯 hovers and lobs wall-bouncing ricochets + stalk-files
      // (left+right symmetric — first foreshadow of the twins), a jade trail filling behind them.
      {parallel:[ {wave:'lantern',  opts:{n:2,y:120,hold:5.5,hue:45,span:PF_W*0.34,halvePower:true}},
                  {wave:'drifters', opts:{n:7,x:PF_W*0.5,band:PF_W*0.22,amp:26,spacing:0.5,speed:52,speedJit:0.9,hue:152,halvePower:true,sparse:true}, delay:1.4} ]}, {waitClear:true}, {wait:WAVE_GAP},
      // a turret pair (lantern-gold) braced by a tight jade stalk-file column — vertical pressure, not a sweep
      {parallel:[ {wave:'turrets',     opts:{xs:[PF_W*0.28,PF_W*0.72],y:124,hold:5.0,hue:45}},
                  {wave:'stalkColumn', opts:{cols:1,per:6,cross:false,speed:96,gap:0.5,hue:140,halvePower:true,sparse:true}, delay:0.8} ]}, {waitClear:true}, {wait:WAVE_GAP},
      // ── 山場 (pre-midboss) ── a Kodama SEXTET weaves centre + flanks: crossing leaf-rosettes + wall ricochets.
      // This is the grove's signature climax (REPLACES the Stage 2 wraith sextet).
      {wave:'kodama', opts:{xs:[PF_W*0.40,PF_W*0.60,PF_W*0.25,PF_W*0.75,PF_W*0.12,PF_W*0.88],y:116,hold:6.0,spacing:0.42,hue:148,halvePower:true}}, {waitClear:true}, {wait:1.4},
      // ── MIDBOSS ── only 宵 (Yoi) appears, 2 phases, then retreats. NO music switch (stays on the 道中 track).
      {banner:'WARNING'}, {sfx:'warn'},
      {boss:'yoiIntro'},
      {wait:CALM_BEFORE_BOSS},
      // ── post-midboss road ── a heavier PINCER: lanterns press from both flanks (mirror) while an
      // X-cross of stalk-files crosses the centre — the maze tightens. Indigo + gold + jade.
      {parallel:[ {wave:'lantern',     opts:{n:2,y:112,hold:6.0,hue:45,span:PF_W*0.42,bob:30,halvePower:true}},
                  {wave:'stalkColumn', opts:{cols:4,per:6,x0:PF_W*0.20,x1:PF_W*0.80,cross:true,speed:96,gap:0.34,hue:140,halvePower:true,sparse:true}, delay:1.2},
                  {wave:'drifters',    opts:{n:10,x:PF_W*0.5,band:PF_W*0.5,amp:28,spacing:0.36,speed:54,speedJit:0.8,hue:265,halvePower:true,sparse:true}, delay:3.2} ]}, {waitClear:true}, {wait:WAVE_GAP},
      // a lantern-gold V-formation presses down the centre while a jade trail fills behind it (kept from
      // the prior draft as a contrasting CENTRE-push beat between the two flank-pincer beats)
      {parallel:[ {wave:'vFormation', opts:{half:5,apexX:PF_W/2,apexY:74,hue:45,halvePower:true}},
                  {wave:'drifters',   opts:{n:8,x:PF_W*0.5,band:PF_W*0.5,amp:30,spacing:0.42,speed:52,speedJit:0.9,hue:152,halvePower:true,sparse:true}, delay:1.6} ]}, {waitClear:true}, {wait:WAVE_GAP},
      // ── 山場 (pre-final) ── a Kodama OCTET holds centre + flanks: the road's true peak (mirror-symmetric
      // anchors — the strongest foreshadow of the two-sister fight that follows).
      {wave:'kodama', opts:{xs:[PF_W*0.44,PF_W*0.56,PF_W*0.31,PF_W*0.69,PF_W*0.18,PF_W*0.82,PF_W*0.08,PF_W*0.92],y:114,hold:7.0,spacing:0.40,hue:148,halvePower:true}}, {waitClear:true}, {wait:1.6},
      // ── FINAL BOSS ── the full twin-sister fight (2体同時出現, shared HP). The one music switch to boss3.
      {banner:'WARNING'}, {sfx:'warn'}, {flash:{color:'#7ad7a0',i:0.4}}, {shake:{mag:4,dur:0.6}}, {music:'boss'}, {wait:2.0},
      {boss:'twins'},
      {stageClear:true},
    ] },
```

---

## BEAT-BY-BEAT: how each Stage-3 road beat now DIFFERS from Stage 2

| Beat (spine slot) | Stage 2 (ghost lane) | Stage 3 OLD (recolor) | Stage 3 NEW (grove) | Why it differs |
| --- | --- | --- | --- | --- |
| **Opening descent** | 4× `drifters`+`sideSweep`, horizontal sheared cascades + echelon sweep + centre trail | Same waves, recolored jade/gold/indigo | **`stalkColumn` X-cross (jade) + flanking `stalkColumn` files (indigo)** | Vertical falling FILES + soft pincer, not horizontal cascades; new factory + `pat.lineOfBullets` dart-files |
| **Heavy beat #1** | wraith sextet (homing soul-orb rings) | turret pair (gold) + twin stream | **`lantern` MIRROR PAIR (gold) — wall-bouncing ricochets + stalk-files — + jade `drifters` trail** | Left/right symmetric lanterns; bullets RICOCHET off walls (`pat.bouncingBullets`); first twin foreshadow |
| **Build beat** | (folded into the alternating assault) | twin `stream` (jade/indigo) | **turret pair (gold) braced by a tight jade `stalkColumn` file** | Vertical pressure (a file) instead of a horizontal stream pair |
| **山場 (pre-midboss)** | wraith sextet — homing rings | wraith sextet recolored | **`kodama` SEXTET — crossing leaf-rosettes + wall ricochets + low cluster-bursts** | NEW signature enemy/danmaku; NO `pat.delayedTurn` homing orbs anywhere |
| **MIDBOSS** | `tasokareIntro`, no music switch | `yoiIntro`, no music switch | `yoiIntro`, no music switch — **unchanged** | Spine preserved |
| **Post-midboss road** | 2 sheared cascades + 2 echelon sweeps (crossing X) | same, recolored | **`lantern` flank PINCER (mirror) + `stalkColumn` X-cross + jade `drifters` trail** | Pincer of bobbing wall-bouncers + crossing files; maze tightens; second twin foreshadow |
| **Centre-push beat** | — | gold V-formation + jade trail | **gold `vFormation` + jade `drifters` trail** (kept) — sits between two flank-pincer beats as contrast | Reused, but now framed as the lone CENTRE push amid flank pincers |
| **山場 (pre-final)** | wraith octet — homing rings | wraith octet recolored | **`kodama` OCTET (mirror-symmetric anchors) — the rosette/ricochet peak** | NEW signature; symmetric anchors = strongest twin foreshadow |
| **FINAL BOSS** | `tasokare` → boss2 | `twins` → boss3 | `twins` → boss3 — **unchanged** | Spine preserved |

The road's **signature enemy + danmaku is now wholly its own**: zero `waveWraith`, zero
`pat.delayedTurn` homing soul-orbs on the Stage 3 road. The grove speaks in ricochets, stalk-files,
and crossing rosettes.

---

## CORRECTNESS TRACE (the conventions that bite)

**`e._steered=true` (the #1 trap — set it every tick a coro writes `e.x/e.y`):**

- `waveStalkColumn` body coro: descent loop writes `e.y`/`e.x` then `e._steered=true; yield;` every
  iteration. ✓ The `lineOfBullets` fire fork never touches `e.x/e.y` (it only spawns bullets), so it
  does not need `_steered`. While the fork runs, the body coro is the only position writer. ✓
- `waveLantern`: `moveTo` (entry) sets `_steered` internally. ✓ The **bob fork** writes
  `e.y`/`e.x` then `e._steered=true; yield;` every tick. ✓ The fire fork never writes position. ✓
  `exitOff` (exit) sets `_steered` internally. ✓ During the hold window the body coro is `yield*
  waitT(hold)` (no position write), and the bob fork is the sole writer — so `enemyIntegrate` always
  sees `_steered` set and never double-moves. Enemy `vx/vy` stay 0 (spawn default) until `exitOff`
  assigns them, so no stray drift even on a tick the bob fork hasn't run (it runs every tick). ✓
- `waveKodama`: `moveTo` (entry) and `exitOff` (exit) set `_steered`. ✓ The **weave fork** writes
  `e.x`/`e.y` then `e._steered=true; yield;` each tick. ✓ `holdFire`'s fire gen only spawns bullets,
  never moves the enemy. ✓ Same single-writer invariant as the lantern. ✓

**Fork lifetime (owner-tied → auto-killed on `e.dead`):**

- Every `Director.fork(...)` in the three factories passes `e` (or `en`) as the **owner** → when the
  enemy dies (killed by the player or `despawnEnemy`/`exitOff` sets `e.dead`), the wrapped coro is
  reaped. ✓
- `waveStalkColumn` explicitly `Director.kill(fc)` before `despawnEnemy(e)` (mirrors `waveDrifters`). ✓
- `waveLantern` `Director.kill(bobFork); Director.kill(fireFork);` before `exitOff` so the bob/fire
  stop the instant the hold ends, then it flies off. ✓ (Even if omitted, owner-tie would reap them on
  `e.dead` at exit's end — explicit kill is the clean stop.)
- `waveKodama` uses `holdFire` (which forks+kills its own fire gen) and explicitly kills the weave
  fork before `exitOff`. ✓
- These are ROAD enemies (not boss phases), so the `beginGroup`/`endGroup` epoch teardown does not
  apply — owner-tie is the correct and only lifetime mechanism, same as the existing road waves. ✓

**`rng` for randomness:** none of the new factories call `Math.random()` or `rng` — all motion is
deterministic (`Math.sin` of `T`, fixed offsets), so the golden harness stays deterministic and the
opening is reproducible. (The existing `drifters`/`stream` already use `rng`; the new waves
deliberately avoid it so they add zero rng-consumption drift.) ✓

**`resolveWave` identity-at-normal:** the new factories only **read** `opts` (never mutate it), so a
`normal`-difficulty `resolveWave` returning the same object is safe. `resolveWave` itself is
untouched. ✓

**Bullet budget:** Kodama octet peak = 8 enemies, each on a ~3 s rosette/ricochet/cluster cycle. The
two `roseCurve(count:18)` = 36 bullets/cycle, `bouncingBullets(count:7)` = 7, `ringOfRings(6×(4+1))`
= 30 every other cycle. Staggered spawns (`spacing:0.40`) desync their cadences, so peak concurrent
spawn-rate stays comfortably under the Stage 2 wraith octet's overlapping homing rings. `bounces:2`
caps ricochet lifetime; bullets despawn past `BULLET_DESPAWN_MARGIN`. No flood, no unfair wall. ✓

**Registry / CI:** the three names (`stalkColumn`, `lantern`, `kodama`) are added to `WAVES` →
`test-content.js` registry-presence passes. The BGM region, save migration, and resolve-identity are
untouched. The `stage3`/`boss3` music keys are already referenced by the existing Stage 3 object and
resolved by `playMusic(trackOf(...))` — no whitelist edit needed (they must exist in `TRACKS`, which
is the separate Stage-3 BGM task, not this road task). ✓
