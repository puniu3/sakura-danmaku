// =====================================================================
// STAGE SCRIPT & SEQUENCING / ENEMIES
// Drives the whole stage via generator coroutines on a fixed STEP sim.
// Assumes globals: enemies[], player, game, rng, T, and sibling APIs
// (patterns, bullets, items, fx, audio, hud) per integrationNotes.
// =====================================================================

const PF_W = 432, PF_H = 576;
const SPAWN_MARGIN = 40, OFFSCREEN_PAD = 32;
const INTRO_FADE = 2.5, CALM_BEFORE_BOSS = 4.0, WAVE_GAP = 1.2;
const BOSS_ENTER = 2.2, SPELL_ANNOUNCE = 1.6, PHASE_HEAL = 0.5;
const HP_POP_LIGHT = 8, R_POP_LIGHT = 9;
const HP_POP_MED = 16, R_POP_MED = 11;
const HP_POP_HEAVY = 34, R_POP_HEAVY = 14;
const MIDBOSS_HP_NONSPELL = 1100, MIDBOSS_HP_SPELL = 1500;
const FB_SURVIVAL_TIME = 28;
const SLOWMO_DEFEAT = 0.35, SLOWMO_DEFEAT_DUR = 2.2;
const CANCEL_TO_ITEM = true;

const EASE = {
  linear: t => t,
  inOut:  t => t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2,2)/2,
  out:    t => 1 - (1-t)*(1-t),
  in:     t => t*t,
  outBack:t => { const c=1.70158; return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2); }
};

// ---------------------------------------------------------------------
// DIRECTOR : the coroutine scheduler. update(dt) once per sim-step.
// ---------------------------------------------------------------------
const Director = (function () {
  // each handle: { gen, sleep(sec remaining), owner, alive, root }
  let coros = [];
  let root = null;

  function _wrap(gen, owner, isRoot) {
    return { gen, sleep: 0, owner: owner || null, alive: true, root: !!isRoot };
  }

  function start(genFn) {
    clear();
    root = _wrap(genFn(), null, true);
    coros.push(root);
    return root;
  }
  function fork(genFn, owner) {
    const h = _wrap(genFn(), owner, false);
    coros.push(h);
    return h;
  }
  function kill(h) { if (h) h.alive = false; }
  function clear() { coros.length = 0; root = null; }

  // advance one coroutine by dt; returns false when it finishes/dies.
  function _step(h, dt) {
    if (!h.alive) return false;
    if (h.owner && !h.owner.alive) return false;     // owner died -> kill
    if (h.sleep > 0) {
      h.sleep -= dt;
      if (h.sleep > 0) return true;                  // still sleeping
      dt = 0;                                         // resume this step, no overshoot
    }
    let res;
    try { res = h.gen.next(); }
    catch (e) { console.error('coro error', e); return false; }
    if (res.done) return false;
    const y = res.value;
    if (typeof y === 'number') h.sleep = y;           // `yield 0.5` -> sleep 0.5s
    else if (y && typeof y === 'object' && 'sleep' in y) h.sleep = y.sleep;
    // undefined/null -> wait exactly one step (sleep stays 0)
    return true;
  }

  function update(dt) {
    // iterate a snapshot length; new forks created this frame run next frame
    const n = coros.length;
    let w = 0;
    for (let i = 0; i < coros.length; i++) {
      const h = coros[i];
      const keep = (i < n) ? _step(h, dt) : true;     // freshly-forked: defer to next frame
      if (keep && h.alive && !(h.owner && !h.owner.alive)) {
        coros[w++] = h;
      }
    }
    coros.length = w;
  }

  return { start, fork, kill, clear, update,
           get count(){ return coros.length; } };
})();

// ---------------------------------------------------------------------
// WAIT PRIMITIVES (generators -> use with `yield*`)
// ---------------------------------------------------------------------
function* waitT(sec) { yield sec; }                    // single sleep yield
function* waitUntil(pred) { while (!pred()) yield; }
function* waitClear(opts) {
  const minHp = (opts && opts.minHp) || 0;
  while (true) {
    let live = 0;
    for (let i = 0; i < enemies.length; i++)
      if (enemies[i].alive && !enemies[i].boss && enemies[i].hp > minHp) live++;
    if (live === 0) return;
    yield;
  }
}
// run fn(elapsed, dt) every step for `sec` seconds. Used by emitters.
function* forSec(sec, fn) {
  let t = 0;
  while (t < sec) {
    fn(t, 1/120);            // dt symbolic; emitters mostly key off cadence counters
    t += 1/120;
    yield;
  }
}
// convenience: do nothing for one step
function* nop() { yield; }

// run several generators concurrently, return when ALL done
function* parallel() {
  const gens = Array.prototype.slice.call(arguments).map(g => ({ g, done: false }));
  while (gens.some(o => !o.done)) {
    for (const o of gens) if (!o.done && o.g.next().done) o.done = true;
    yield;
  }
}

// ---------------------------------------------------------------------
// ENEMY OBJECT + SPAWN
// ---------------------------------------------------------------------
// spec: { x,y, hp, r, sprite, hue, boss?, score?, drops:[...],
//         coro: (e)=>generator,        // lifecycle / movement (required-ish)
//         onDeath: (e)=>void,          // extra death behavior
//         cancelOnDeath: number }      // 0..1 fraction of nearby bullets to cancel
function spawnEnemy(spec) {
  const e = {
    x: spec.x, y: spec.y,
    vx: 0, vy: 0,
    hp: spec.hp, maxHp: spec.hp,
    r: spec.r || R_POP_MED,
    sprite: spec.sprite || 'fairy',
    hue: spec.hue != null ? spec.hue : 200,
    boss: !!spec.boss,
    score: spec.score || 1000,
    drops: spec.drops || [],
    alive: true,
    invuln: false,            // set true during entrance / heal windows
    fireCoro: null,           // handle of forked firing coroutine (if any)
    born: T,
    _spec: spec
  };
  enemies.push(e);
  // movement/lifecycle coroutine; auto-killed when e.alive goes false
  if (spec.coro) Director.fork(() => spec.coro(e), e);
  return e;
}

// integrate position only if no coroutine is actively steering (coro sets x/y).
// The main loop should call this for every enemy each sim-step.
function enemyIntegrate(e, dt) {
  if (e._steered) { e._steered = false; return; }   // coro moved it this step
  e.x += e.vx * dt;
  e.y += e.vy * dt;
}

// apply damage; returns true if it killed.
function damageEnemy(e, dmg) {
  if (!e.alive || e.invuln) return false;
  e.hp -= dmg;
  if (e.hp <= 0 && !e.boss) { killEnemy(e); return true; }
  return false;
}

function killEnemy(e) {
  if (!e.alive) return;
  e.alive = false;                       // forked coros (fire/move) auto-die next step
  sfx('enemyDown');
  spawnDeathPuff(e.x, e.y, e.hue);
  if (e._spec && e._spec.cancelOnDeath) {
    cancelBullets({ x: e.x, y: e.y, radius: 70, frac: e._spec.cancelOnDeath, toItems: false });
  }
  for (const d of e.drops) dropItem(e.x + rng.range(-8,8), e.y + rng.range(-6,6), d);
  if (e._spec && e._spec.onDeath) e._spec.onDeath(e);
  // swap-remove from enemies[]
  const i = enemies.indexOf(e);
  if (i >= 0) { enemies[i] = enemies[enemies.length-1]; enemies.pop(); }
}

// ---------------------------------------------------------------------
// MOVEMENT HELPERS (generators)
// ---------------------------------------------------------------------
function* moveTo(e, tx, ty, dur, ease) {
  ease = ease || EASE.inOut;
  const sx = e.x, sy = e.y, t0 = T;
  if (dur <= 0) { e.x = tx; e.y = ty; e._steered = true; return; }
  while (true) {
    const k = Math.min(1, (T - t0) / dur);
    const u = ease(k);
    e.x = sx + (tx - sx) * u;
    e.y = sy + (ty - sy) * u;
    e._steered = true;
    if (k >= 1) return;
    yield;
  }
}
// cubic bezier from current pos -> through c1,c2 -> p3
function* moveBezier(e, c1, c2, p3, dur, ease) {
  ease = ease || EASE.inOut;
  const p0 = { x: e.x, y: e.y }, t0 = T;
  while (true) {
    const k = Math.min(1, (T - t0) / dur), u = ease(k), iu = 1 - u;
    const b0 = iu*iu*iu, b1 = 3*iu*iu*u, b2 = 3*iu*u*u, b3 = u*u*u;
    e.x = b0*p0.x + b1*c1.x + b2*c2.x + b3*p3.x;
    e.y = b0*p0.y + b1*c1.y + b2*c2.y + b3*p3.y;
    e._steered = true;
    if (k >= 1) return;
    yield;
  }
}
// run a firing coroutine for `sec` while holding current position
function* holdFire(e, fireGenFn, sec) {
  const fc = Director.fork(() => fireGenFn(e), e);
  yield* waitT(sec);
  Director.kill(fc);
}
// fly off in direction `dir` (radians) then die quietly (no drops/sfx)
function* exitOff(e, dir, speed) {
  speed = speed || 160;
  e.vx = Math.cos(dir) * speed; e.vy = Math.sin(dir) * speed;
  while (e.x > -OFFSCREEN_PAD && e.x < PF_W+OFFSCREEN_PAD &&
         e.y > -OFFSCREEN_PAD && e.y < PF_H+OFFSCREEN_PAD) {
    e.x += e.vx*(1/120); e.y += e.vy*(1/120); e._steered = true; yield;
  }
  // silent removal
  e.alive = false;
  const i = enemies.indexOf(e);
  if (i >= 0) { enemies[i] = enemies[enemies.length-1]; enemies.pop(); }
}

// ---------------------------------------------------------------------
// FIRING ROUTINES (thin wrappers over the patterns library, on cadence)
// Each is a generator(e). They call pattern fns which emit via spawnBullet.
// ---------------------------------------------------------------------
function* fireAimedBursts(e, opts) {
  const period = opts.period || 0.9, count = opts.count || 1, n = opts.n || 3;
  while (true) {
    for (let i = 0; i < count; i++) {
      aimedShot(e, { speed: opts.speed || 150, spread: opts.spread || 0.2,
                     n, hue: opts.hue != null ? opts.hue : e.hue, style: opts.style || 'mid' });
      yield* waitT(period / Math.max(1,count));
    }
  }
}
function* fireRings(e, opts) {
  const period = opts.period || 1.4;
  while (true) {
    ring(e, { count: opts.count || 16, speed: opts.speed || 120,
              hue: opts.hue != null ? opts.hue : e.hue, style: opts.style || 'mid',
              aim: opts.aim ? Math.atan2(player.y-e.y, player.x-e.x) : 0 });
    yield* waitT(period);
  }
}
function* fireSpiralTurret(e, opts) {
  const period = opts.period || 0.06, da = opts.da || 0.31;
  let a = opts.a0 || 0;
  while (true) {
    spiral(e, { angle: a, arms: opts.arms || 2, speed: opts.speed || 130,
                hue: (e.hue + (T*40)) % 360, style: opts.style || 'small' });
    a += da;
    yield* waitT(period);
  }
}

// ---------------------------------------------------------------------
// WAVE GENERATORS (formations). Each yields until its members are launched;
// pass through `yield* spawnWave(gen)` where spawnWave just runs it.
// ---------------------------------------------------------------------
function* spawnWave(gen) { yield* gen; }

// horizontal line entering one side, sweeping across, exiting the other.
function waveSideSweep(opts) {
  return (function* () {
    const n = opts.n || 6, side = opts.side || 'left';
    const y = opts.y || 90, gap = opts.gap || 36;
    const fromX = side === 'left' ? -SPAWN_MARGIN : PF_W + SPAWN_MARGIN;
    const toX   = side === 'left' ? PF_W + SPAWN_MARGIN : -SPAWN_MARGIN;
    for (let i = 0; i < n; i++) {
      spawnEnemy({
        x: fromX, y: y + (side==='left'? i*gap*0 : 0), hp: HP_POP_LIGHT, r: R_POP_LIGHT,
        sprite: 'fairyBlue', hue: 205, score: 800, drops: i % 3 === 0 ? ['power'] : [],
        coro: function* (e) {
          // ease in to sweep height, then drift across while firing aimed shots
          yield* moveTo(e, side==='left'? 40 : PF_W-40, y, 0.7, EASE.out);
          const fc = Director.fork(() => fireAimedBursts(e,
                       { period: 1.0, n: 1, speed: 150, hue: 205, style: 'mid' }), e);
          yield* moveTo(e, toX, y + 60, 3.2, EASE.linear);
          Director.kill(fc);
          killEnemy(e);            // counts as cleared even if it escaped
        }
      });
      yield* waitT(opts.spacing || 0.18);
    }
  })();
}

// V / echelon dive from the top center.
function waveVFormation(opts) {
  return (function* () {
    const half = opts.half || 4;            // wings per side
    const apexX = opts.apexX || PF_W/2, apexY = opts.apexY || 80;
    const dx = opts.dx || 30, dy = opts.dy || 26;
    for (let s = -1; s <= 1; s += 2) {
      for (let i = (s<0?half:0); s<0 ? i>=1 : i<=half; i += (s<0?-1:1)) {
        const tx = apexX + s * i * dx, ty = apexY + i * dy;
        spawnEnemy({
          x: apexX, y: -SPAWN_MARGIN, hp: HP_POP_MED, r: R_POP_MED,
          sprite: 'fairyRed', hue: 350, score: 1200, drops: ['power','point'],
          coro: function* (e) {
            yield* moveTo(e, tx, ty, 0.9, EASE.out);
            yield* holdFire(e, function* (en) {
              yield* fireRings(en, { period: 1.1, count: 12, speed: 110, hue: 350, aim: true });
            }, 2.4);
            yield* exitOff(e, Math.PI*0.5 + (s*0.25)); // dive down-and-out
          }
        });
        yield* waitT(0.08);
      }
    }
  })();
}

// steady trickle down a single column, light aimed fire.
function waveStream(opts) {
  return (function* () {
    const n = opts.n || 10, x = opts.x || PF_W*0.5;
    for (let i = 0; i < n; i++) {
      const cx = x + Math.sin(i*0.6) * (opts.amp || 60);
      spawnEnemy({
        x: cx, y: -SPAWN_MARGIN, hp: HP_POP_MED, r: R_POP_MED,
        sprite: 'fairyGreen', hue: 130, score: 900, drops: i%2 ? ['point'] : ['power'],
        coro: function* (e) {
          const fc = Director.fork(() => fireAimedBursts(e,
                       { period: 1.3, n: 3, spread: 0.25, speed: 140, hue: 130 }), e);
          yield* moveTo(e, cx + rng.range(-30,30), PF_H + SPAWN_MARGIN, 4.0, EASE.linear);
          Director.kill(fc); killEnemy(e);
        }
      });
      yield* waitT(opts.spacing || 0.45);
    }
  })();
}

// two stationary turrets that descend, hold, spiral-fire, then leave.
function waveTurrets(opts) {
  return (function* () {
    const xs = opts.xs || [PF_W*0.28, PF_W*0.72], y = opts.y || 130;
    for (let i = 0; i < xs.length; i++) {
      spawnEnemy({
        x: xs[i], y: -SPAWN_MARGIN, hp: HP_POP_HEAVY, r: R_POP_HEAVY,
        sprite: 'turret', hue: 280, score: 2500, drops: ['power','power','point'],
        cancelOnDeath: 0.4,
        coro: function* (e) {
          yield* moveTo(e, xs[i], y, 1.0, EASE.out);
          yield* holdFire(e, function* (en) {
            yield* fireSpiralTurret(en, { da: i? -0.33 : 0.33, period: 0.07,
                                          arms: 2, speed: 125, a0: i*Math.PI });
          }, opts.hold || 5.0);
          yield* exitOff(e, i ? Math.PI*0.85 : Math.PI*0.15, 140);
        }
      });
    }
    yield;
  })();
}

// ---------------------------------------------------------------------
// BOSS : descriptor-driven phase machine
// ---------------------------------------------------------------------
// bossSpec: {
//   name, sprite, hue, enterTo:{x,y}, drops:[...],
//   phases: [ phaseDesc, ... ]
// }
// phaseDesc: {
//   kind:'nonspell'|'spell', name?, hp?, survival?(sec), bonus?,
//   emitter: (boss)=>generator   // the bullet routine; runs until phase ends
//   onEnter?:(boss)=>void
// }
function makeBoss(spec) {
  const totalSegs = spec.phases.length;
  const b = spawnEnemy({
    x: spec.enterFrom ? spec.enterFrom.x : PF_W/2,
    y: spec.enterFrom ? spec.enterFrom.y : -60,
    hp: 1, r: spec.r || 18, sprite: spec.sprite || 'boss',
    hue: spec.hue != null ? spec.hue : 320, boss: true,
    score: spec.score || 50000, drops: [],
    coro: null
  });
  b.invuln = true;
  b.phaseTotal = totalSegs;
  b.phaseIndex = 0;          // for HUD pip rendering
  b._spec = spec;
  return b;
}

function* runBoss(spec) {
  const boss = makeBoss(spec);
  hud.setBoss(boss);
  // entrance
  yield* moveTo(boss, spec.enterTo.x, spec.enterTo.y, BOSS_ENTER, EASE.inOut);
  boss.invuln = false;

  for (let pi = 0; pi < spec.phases.length; pi++) {
    const ph = spec.phases[pi];
    boss.phaseIndex = pi;
    yield* runPhase(boss, ph, pi);
    // ----- phase clear: cancel + flash + heal-to-next -----
    sfx('cancel');
    cancelBullets({ all: true, toItems: CANCEL_TO_ITEM });
    screenFlash('#ffffff', 0.35);
    shake(6, 0.3);
    if (ph.kind === 'spell' && ph.bonus) addSpellBonus(ph.bonus, ph._captured);
    for (const d of (ph.drops || [])) dropItem(boss.x+rng.range(-20,20), boss.y+rng.range(-10,10), d);
    boss.invuln = true;
    yield* waitT(PHASE_HEAL);
    boss.invuln = false;
  }
  // ----- defeat sequence -----
  yield* bossDefeat(boss, spec);
}

function* runPhase(boss, ph, pi) {
  // announce
  if (ph.kind === 'spell') {
    sfx('spellStart');
    hud.setSpell(ph.name, ph.bonus || 0);
    banner(ph.name, ph.kind === 'spell' ? 'Spell Card' : '', SPELL_ANNOUNCE);
    boss.invuln = true;
    yield* waitT(SPELL_ANNOUNCE);
    boss.invuln = false;
  } else {
    hud.clearSpell();
  }
  // set HP / survival
  const survival = ph.survival || 0;
  boss.hp = boss.maxHp = ph.hp || 1;
  boss.phaseSurvival = survival;
  ph._captured = true;                    // assume capture; cleared on damage-while-survival? n/a
  // launch emitter as a forked coro so we can kill it precisely
  const em = Director.fork(() => ph.emitter(boss), boss);
  if (ph.onEnter) ph.onEnter(boss);

  const t0 = T;
  if (survival > 0) {
    // survival: player must endure; boss is invuln to damage during survival
    boss.invuln = true;
    boss.survivalEndsAt = T + survival;
    while (T - t0 < survival) yield;
  } else {
    // attrition: end when HP depleted (damageEnemy decrements boss.hp;
    // for bosses we DON'T auto-kill, we just watch hp here)
    while (boss.hp > 0) yield;
  }
  Director.kill(em);
  // leave the bullets on screen; caller (runBoss) does the cancel.
}

function* bossDefeat(boss, spec) {
  sfx('bossDown');
  boss.invuln = true;
  // dramatic cancel cascade in slow motion
  slowmo(SLOWMO_DEFEAT, SLOWMO_DEFEAT_DUR);
  shake(10, 1.4);
  // staggered radial cancel from boss outward
  for (let i = 0; i < 6; i++) {
    cancelBullets({ x: boss.x, y: boss.y, radius: 60 + i*60, frac: 1.0, toItems: true });
    spawnDeathPuff(boss.x + rng.range(-30,30), boss.y + rng.range(-20,20), (boss.hue + i*40)%360);
    yield* waitT(0.12);
  }
  screenFlash('#ffffff', 0.9);
  // big drops
  for (const d of (spec.drops || [])) dropItem(boss.x+rng.range(-40,40), boss.y+rng.range(-20,20), d);
  hud.clearBoss(); hud.clearSpell();
  // remove boss
  boss.alive = false;
  const i = enemies.indexOf(boss);
  if (i >= 0) { enemies[i] = enemies[enemies.length-1]; enemies.pop(); }
  yield* waitT(1.4);
}

// small helper the runBoss uses; defers to score subsystem if present
function addSpellBonus(base, captured) {
  if (typeof grantSpellBonus === 'function') grantSpellBonus(captured ? base : 0);
}

// =====================================================================
// THE STAGE TIMELINE  (the actual ordered content backbone)
// =====================================================================
function* stageScript() {
  // ---- 0. intro ----
  banner('Stage 1', 'Vernal Petal Lane', 2.0);
  yield* waitT(INTRO_FADE);

  // ---- 1. WAVE: blue side-sweep (left) ----
  yield* spawnWave(waveSideSweep({ n: 6, side: 'left', y: 90, spacing: 0.16 }));
  yield* waitT(2.4);

  // ---- 2. WAVE: blue side-sweep (right, lower) ----
  yield* spawnWave(waveSideSweep({ n: 6, side: 'right', y: 150, spacing: 0.16 }));
  yield* waitClear({ minHp: 0 });
  yield* waitT(WAVE_GAP);

  // ---- 3. WAVE: red V-formation dive ----
  yield* spawnWave(waveVFormation({ half: 4, apexX: PF_W/2, apexY: 80 }));
  yield* waitT(3.2);

  // ---- 4. WAVE: green stream (two interleaved columns) ----
  yield* parallel(
    waveStream({ n: 8, x: PF_W*0.33, amp: 50, spacing: 0.5 }),
    (function*(){ yield* waitT(0.25); yield* waveStream({ n: 8, x: PF_W*0.66, amp: 50, spacing: 0.5 }); })()
  );
  yield* waitClear();
  yield* waitT(WAVE_GAP);

  // ---- 5. WAVE: spiral turrets (the "wall") ----
  yield* spawnWave(waveTurrets({ xs: [PF_W*0.28, PF_W*0.72], y: 130, hold: 5.0 }));
  yield* waitClear({ minHp: 0 });
  yield* waitT(WAVE_GAP);

  // ---- 6. WAVE: fast crossers (last popcorn, denser) ----
  yield* spawnWave(waveSideSweep({ n: 8, side: 'left', y: 70, spacing: 0.10 }));
  yield* spawnWave(waveSideSweep({ n: 8, side: 'right', y: 110, spacing: 0.10 }));
  yield* waitClear();
  yield* waitT(1.5);

  // =================== MIDBOSS ===================
  banner('', 'enemy approaching', 1.2);
  sfx('warn');
  yield* runBoss({
    name: 'Mei-Ling, the Petal Sentinel',
    sprite: 'midboss', hue: 140,
    enterFrom: { x: PF_W/2, y: -60 }, enterTo: { x: PF_W/2, y: 150 },
    score: 80000,
    drops: ['bigpower','point','point','point','point','power'],
    phases: [
      { kind:'nonspell', hp: MIDBOSS_HP_NONSPELL,
        emitter: function* (b) {
          // alternating aimed fans + slow expanding rings, weaving boss
          Director.fork(function* () {
            while (true) {
              fan(b, { n: 7, spread: 0.7, speed: 150, aim: true, hue: 150, style: 'mid' });
              yield* waitT(0.85);
            }
          }, b);
          while (true) {
            ring(b, { count: 20, speed: 95, hue: 110, style: 'mid' });
            yield* waitT(1.5);
          }
        },
        onEnter: function (b) {
          Director.fork(function* () {        // gentle horizontal weave
            while (true) { yield* moveTo(b, PF_W*0.35, 150, 1.6, EASE.inOut);
                           yield* moveTo(b, PF_W*0.65, 150, 1.6, EASE.inOut); }
          }, b);
        }
      },
      { kind:'spell', name:'Verdant Sign "Petal Whirlpool"', hp: MIDBOSS_HP_SPELL, bonus: 250000,
        drops:['point','point','point','point','power'],
        emitter: function* (b) {
          // two counter-rotating spiral arms + periodic aimed dart wall
          let a = 0;
          Director.fork(function* () {
            while (true) {
              wall(b, { n: 9, gapAim: true, speed: 175, hue: 320, style: 'dart' });
              yield* waitT(2.0);
            }
          }, b);
          while (true) {
            spiral(b, { angle: a, arms: 3, speed: 120, hue: (140 + T*30)%360, style: 'small' });
            spiral(b, { angle: -a*1.3, arms: 3, speed: 120, hue: (170 + T*30)%360, style: 'small' });
            a += 0.27;
            yield* waitT(0.05);
          }
        }
      }
    ]
  });

  // =================== CALM ===================
  yield* waitT(CALM_BEFORE_BOSS);

  // =================== FINAL BOSS ===================
  banner('WARNING', 'final boss', 2.0);
  sfx('warn'); screenFlash('#ff3366', 0.4); shake(4, 0.6);
  yield* waitT(2.0);

  yield* runBoss({
    name: 'Sakuya Eternal',
    sprite: 'finalboss', hue: 300,
    enterFrom: { x: PF_W/2, y: -80 }, enterTo: { x: PF_W/2, y: 140 },
    score: 500000,
    drops: ['full','full','life','point','point','point','point','point','bigpower'],
    phases: [
      // ---- nonspell0 ----
      { kind:'nonspell', hp: 1800,
        emitter: function* (b) {
          while (true) {
            ring(b, { count: 24, speed: 110, hue: (300+T*20)%360, style:'mid' });
            yield* waitT(0.55);
            aimedShot(b, { n: 5, spread: 0.4, speed: 200, hue: 0, style:'dart' });
            yield* waitT(0.55);
          }
        }
      },
      // ---- spell1: Petal Storm ----
      { kind:'spell', name:'Spring Sign "Petal Storm"', hp: 2400, bonus: 1500000,
        drops:['point','point','point'],
        emitter: function* (b) {
          // dense slow falling petals (rain) + aimed gaps to dodge through
          Director.fork(function* () {
            while (true) { rain(b, { across: PF_W, count: 14, speed: 90, hue: 330, style:'petal' });
                           yield* waitT(0.4); }
          }, b);
          while (true) {
            fan(b, { n: 9, spread: 1.1, speed: 160, aim: true, hue: 290, style:'mid' });
            yield* waitT(1.1);
          }
        }
      },
      // ---- nonspell1 ----
      { kind:'nonspell', hp: 2000,
        emitter: function* (b) {
          let a = 0;
          Director.fork(function* () {
            while (true) { yield* moveTo(b, PF_W*0.3,140,1.4,EASE.inOut);
                           yield* moveTo(b, PF_W*0.7,140,1.4,EASE.inOut); }
          }, b);
          while (true) {
            spiral(b, { angle: a, arms: 4, speed: 135, hue:(300+T*40)%360, style:'small' });
            a += 0.4; yield* waitT(0.045);
          }
        }
      },
      // ---- spell2: Lunar Rain ----
      { kind:'spell', name:'Night Sign "Lunar Rain"', hp: 2800, bonus: 2000000,
        drops:['point','point','point'],
        emitter: function* (b) {
          // expanding ring waves that suddenly accelerate (handled by pattern accel)
          while (true) {
            for (let k = 0; k < 3; k++) {
              ring(b, { count: 32, speed: 70, accel: 90, hue:(220+k*30)%360, style:'orb' });
              yield* waitT(0.18);
            }
            // aimed cross to punish camping
            wall(b, { n: 13, gapAim: true, speed: 210, hue: 0, style:'dart' });
            yield* waitT(1.3);
          }
        }
      },
      // ---- spell3: Spiral Mandala ----
      { kind:'spell', name:'Time Sign "Spiral Mandala"', hp: 3200, bonus: 2500000,
        drops:['point','point','point'],
        emitter: function* (b) {
          // multi-arm twin spirals + slow rotating ring lattice
          let a = 0;
          Director.fork(function* () {
            while (true) { ring(b, { count: 18, speed: 105, hue:(280+T*15)%360, style:'mid',
                                     rot: T*0.4 }); yield* waitT(0.9); }
          }, b);
          while (true) {
            spiral(b, { angle:  a,      arms: 5, speed: 145, hue:(0 + T*50)%360, style:'small' });
            spiral(b, { angle: -a*1.6,  arms: 5, speed: 145, hue:(180+ T*50)%360, style:'small' });
            a += 0.23; yield* waitT(0.04);
          }
        }
      },
      // ---- final survival: Last Word ----
      { kind:'spell', name:'"Eternal Spring — Last Word"', survival: FB_SURVIVAL_TIME,
        bonus: 5000000, drops:[],
        emitter: function* (b) {
          // everything at once, escalating; boss is invuln (survival)
          let a = 0, wave = 0;
          Director.fork(function* () {
            while (true) { rain(b, { across: PF_W, count: 10, speed: 120, hue:(330+T*30)%360, style:'petal' });
                           yield* waitT(0.3); }
          }, b);
          Director.fork(function* () {
            while (true) { burst(b, { count: 40, speed: 130, hue:(T*60)%360, style:'orb' });
                           yield* waitT(2.2); }
          }, b);
          while (true) {
            spiral(b, { angle: a,     arms: 6, speed: 140 + wave*4, hue:(T*70)%360, style:'small' });
            spiral(b, { angle:-a*1.4, arms: 6, speed: 140 + wave*4, hue:(120+T*70)%360, style:'small' });
            a += 0.21; wave += 0.05; yield* waitT(0.035);
          }
        }
      }
    ]
  });

  // =================== STAGE CLEAR ===================
  screenFlash('#ffffff', 1.2);
  banner('STAGE CLEAR', '', 3.0);
  yield* waitT(3.0);
  game.state = 'cleared';      // hand back to the top-level state machine
}

// ---------------------------------------------------------------------
// PUBLIC ENTRY POINTS used by the main loop / game state machine
// ---------------------------------------------------------------------
function startStage() { Director.start(stageScript); }
function tickStage(dt) { Director.update(dt); }   // call once per sim-step
function abortStage() { Director.clear(); }        // on death-out / restart