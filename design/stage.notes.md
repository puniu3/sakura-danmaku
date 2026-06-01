# Stage Script &amp; Sequencing / Enemies Subsystem

## Overview
A generator-coroutine scheduler drives the entire stage as a single linear script, with sub-coroutines for waves and boss phases. Core design decisions:

1. COROUTINE MODEL. The stage is one JS generator `stageScript()` that `yield`s control back to the scheduler each sim-step. Helper primitives — `waitT(seconds)`, `waitUntil(predFn)`, `waitClear()` (no enemies left), `spawnWave(gen)`, `parallel(...)`, `bossPhase(desc)` — are themselves generators the script delegates to via `yield*`. This makes the timeline read top-to-bottom like a screenplay while staying frame-accurate against the fixed STEP=1/120 sim. A coroutine "frame" is one sim-step, so all `waitT` math is in sim-time T (seconds), independent of render rate.

2. SCHEDULER ENGINE. `Director` holds a stack of active coroutines (the main script plus any `fork()`ed ones for enemy AI / boss emitters). Each step it advances every live coroutine once. A coroutine yields one of: `undefined`/`null` (wait one step), a number (sleep that many seconds — sugar that the runner converts to an internal countdown), or `{wait:...}` directive objects. Forked coroutines (enemy `update`, boss emitter loops) run independently and are auto-killed when their owner dies. This means an enemy's flight path AND its firing cadence are each just a small generator — no per-enemy state machines by hand.

3. ENEMIES are plain pooled-ish objects with a `coro` (movement/lifecycle generator) and an optional `fireCoro` (independent firing generator), both driven by Director. `update(dt)` only integrates position if no coro is steering. `onDeath` spawns drops + a death puff + optional partial bullet-cancel. Paths are expressed as generators using `moveTo(e, x, y, dur, ease)` and bezier helpers, so "ease in, hold & fire, ease out" is literally three `yield*` lines.

4. BOSS PHASE MACHINE. A boss is a special enemy carrying an ordered `phases[]` of spell-card descriptors. `runBoss()` walks them: announce → run emitter coro until HP<=0 or survival timer expires → bullet-cancel + screen flash + heal-to-next → repeat. HP-bar segments map 1:1 to remaining phases so the HUD agent can render pips. Non-spells and spells share the descriptor shape; spells additionally carry `name`, `bonus`, optional `survival` time-limit, and a `border` (timeout-for-capture) flag.

5. CONCRETE TIMELINE. Intro fade (2.5s) → 6 popcorn waves (side-sweep blues, V-formation reds, descending stream, twin spiral turrets, fast crossers, heavy gunners) → MIDBOSS (entrance, nonspell + 1 named spell, drops, cancel) → 4s calm → FINAL BOSS warning + 6 phases (nonspell0, spell1 "Petal Storm", nonspell1, spell2 "Lunar Rain", spell3 "Spiral Mandala", final survival "Last Word — Eternal Spring") → defeat sequence (slow-mo cancel cascade, white-out, stage-clear). All HP, durations, speeds, spawn counts, and drop tables are concrete numbers below.

## Public API
// ---- Director (scheduler singleton) ----
Director.start(genFn)            // begin/replace the root coroutine; returns the root handle
Director.fork(genFn, owner?)     // spawn an independent coroutine; auto-killed when owner.alive===false; returns handle
Director.kill(handle)            // stop a coroutine immediately
Director.update(dt)              // call ONCE per sim-step from the main loop; advances all live coroutines by dt
Director.clear()                 // kill everything (used on game over / restart)

// ---- coroutine wait primitives (use as `yield* X` or `yield n`) ----
waitT(sec)                       // sleep sec seconds of sim-time
waitUntil(predFn)                // sleep until predFn() truthy (checked each step)
waitClear(opts?)                 // sleep until enemies.length===0 (opts.minHp ignores tiny stragglers)
forSec(sec, eachStepFn)          // run eachStepFn(t,dt) every step for sec seconds (great for emitters)

// ---- enemy spawning / movement ----
spawnEnemy(spec)                 // create+register an enemy from a spec object; returns the enemy
moveTo(e, x, y, dur, ease)       // *generator*: glide e to (x,y) over dur sec with ease fn
moveBezier(e, p1, p2, p3, dur, ease) // *generator*: cubic bezier from current pos through control pts to p3
holdFire(e, fireGen, sec)        // *generator*: run e.fireCoro=fireGen for sec sec while staying put
exitOff(e, dir, speed?)          // *generator*: fly off-screen in dir (radians) then despawn

// ---- waves / formations (each a *generator*, run via yield* spawnWave(...)) ----
waveSideSweep(opts)              // line of enemies enters one edge, sweeps across, exits
waveVFormation(opts)             // V/echelon dive from top
waveStream(opts)                 // steady trickle down a column
waveTurrets(opts)                // 2 stationary turrets that hold & fire then leave

// ---- boss ----
runBoss(bossSpec)                // *generator*: full boss lifecycle (entrance -> phases -> defeat)
makeBoss(spec)                   // build a boss enemy with .phases[] and HP-bar metadata

// ---- expects from sibling subsystems (called, not defined here) ----
// patterns:  aimedShot(src,opts) ring(src,opts) spiral(src,opts) fan(src,opts) wall(src,opts) burst(src,opts) rain(src,opts)
// bullets:   spawnBullet(o) / freeBullet(b) / cancelBullets(opts) / forEachEnemyBullet(fn)
// items:     dropItem(x,y,type)  (type: 'power'|'point'|'bigpower'|'life'|'bomb'|'full')
// fx:        spawnDeathPuff(x,y,hue) screenFlash(color,dur) slowmo(scale,dur) shake(mag,dur)
// audio:     sfx(name)   (names: 'enemyDown','bossDown','spellStart','warn','cancel','charge')
// hud:       hud.setBoss(boss) hud.clearBoss() hud.setSpell(name,bonus) hud.clearSpell() banner(text,sub,dur)
// player:    player.x player.y  game.state  rng.range(a,b)/pick(arr)  T (sim clock)  enemies[]

## Constants
// ---- playfield ----
const PF_W = 432, PF_H = 576;
const SPAWN_MARGIN = 40;               // spawn this far outside top edge
const OFFSCREEN_PAD = 32;              // matches bullet despawn pad

// ---- timeline durations (seconds, sim-time) ----
const INTRO_FADE   = 2.5;
const CALM_BEFORE_BOSS = 4.0;
const WAVE_GAP     = 1.2;              // breathing room between waves when not waitClear
const BOSS_ENTER   = 2.2;
const SPELL_ANNOUNCE = 1.6;            // banner hold before a spell's bullets start
const PHASE_HEAL   = 0.5;              // white-flash + heal window between phases

// ---- enemy archetype HP / radius / drops ----
const HP_POP_LIGHT = 8,   R_POP_LIGHT = 9;     // sweepers/crossers
const HP_POP_MED   = 16,  R_POP_MED   = 11;    // V-formation, stream
const HP_POP_HEAVY = 34,  R_POP_HEAVY = 14;    // gunners, turrets
const DROP_LIGHT   = ['power'];
const DROP_MED     = ['power','point'];
const DROP_HEAVY   = ['power','power','point'];

// ---- midboss ----
const MIDBOSS_HP_NONSPELL = 1100;
const MIDBOSS_HP_SPELL    = 1500;
const MIDBOSS_DROP        = ['bigpower','point','point','point','point'];

// ---- final boss phase HP / time limits ----
const FB_HP = { nonspell0:1800, spell1:2400, nonspell1:2000, spell2:2800, spell3:3200 };
const FB_SURVIVAL_TIME = 28;           // "Last Word" survival seconds
const FB_DROP_PHASE = ['point','point','point'];          // per captured spell
const FB_DROP_FINAL = ['full','full','life','point','point','point','point','point'];

// ---- pacing / feel ----
const SPELL_BORDER_TIME = 0;           // 0 = no capture-bonus timeout (set >0 to enable)
const CANCEL_TO_ITEM = true;           // canceled bullets become point items on phase clear
const SLOWMO_DEFEAT = 0.35;            // time scale during final defeat
const SLOWMO_DEFEAT_DUR = 2.2;

// ---- ease fns ----
const EASE = {
  linear: t => t,
  inOut:  t => t<0.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2,
  out:    t => 1-(1-t)*(1-t),
  in:     t => t*t,
  outBack:t => { const c=1.70158; return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2); }
};

## Integration Notes
MAIN-LOOP WIRING (order matters):
1. On entering the play state, call `startStage()` once. This is the only entry point; everything else is driven by coroutines.
2. Inside the fixed-STEP sim loop, EACH sim-step (STEP=1/120), in this order:
   a. read input / update player
   b. `tickStage(dt)`  — advances Director: stage script, wave coros, enemy movement coros, boss emitter coros. Movement coros write enemy x/y and set `e._steered=true`.
   c. for each enemy: `enemyIntegrate(e, dt)` (only integrates vx/vy if a coro did NOT steer it this step — the `_steered` flag prevents double-moving steered enemies).
   d. update enemyBullets / playerShots / particles / items (sibling pools).
   e. collisions: player-shot vs enemy -> call `damageEnemy(e, dmg)`. For non-boss enemies it auto-kills at hp<=0; for bosses it only decrements hp (runPhase watches `boss.hp` to advance). Do NOT call killEnemy on a boss — boss removal happens in bossDefeat.
   f. dt is the per-step dt the loop hands in (1/120). `forSec`/emitter cadence uses `waitT` sleeps that the Director converts to per-step countdowns, so they stay frame-accurate regardless of render fps.
3. On player death-bombing out / restart: `abortStage()` then `Director.clear()` (clear is idempotent) and reset enemies/pools.

SLEEP SEMANTICS / GOTCHA: a coroutine `yield n` (number) or `yield* waitT(n)` sleeps n seconds; the Director subtracts dt each step and resumes on the step the sleep crosses 0 WITHOUT overshoot accumulation (it zeroes dt on the resume step). A bare `yield` / `yield* nop()` waits exactly one sim-step. This is why emitters that want "fire every 0.05s" use `yield* waitT(0.05)` and get the same cadence at any framerate.

FORK OWNERSHIP: `Director.fork(genFn, ownerEnemy)` ties a coroutine's life to `owner.alive`. When `killEnemy`/`bossDefeat` sets `e.alive=false`, every forked fire/move coro owned by it is auto-pruned next Director step — no manual teardown of an enemy's firing loop is needed. Boss emitters are additionally `Director.kill(em)`-ed at phase end so they stop instantly (before the inter-phase cancel) rather than waiting for boss death.

CALLS INTO SIBLING SUBSYSTEMS (by assumed name — adjust to real signatures):
- patterns: `aimedShot(src,opts)`, `ring(src,opts)`, `spiral(src,opts)`, `fan(src,opts)`, `wall(src,opts)`, `burst(src,opts)`, `rain(src,opts)`. `src` is any {x,y} (enemy or boss). opts I pass: speed, count/n, spread, hue, style, aim(bool→aim at player), accel, rot, arms, angle, across, gapAim. These are the names the patterns agent should define; the `opts` keys are the contract between us — if their names differ, only the wrapper fns (fireAimedBursts/fireRings/fireSpiralTurret) and the emitter closures need editing, not the scheduler.
- bullets: `cancelBullets({all?,x?,y?,radius?,frac?,toItems?})` — clears all or a radius of enemyBullets, optionally converting to point items. `spawnBullet`/`freeBullet` are used indirectly through pattern fns. I rely on the pool despawning bullets OFFSCREEN_PAD(32) outside PF.
- items: `dropItem(x,y,type)` with types 'power'|'point'|'bigpower'|'life'|'bomb'|'full'. Drop tables are concrete per archetype (see constants/drops in specs).
- fx: `spawnDeathPuff(x,y,hue)`, `screenFlash(color,dur)`, `slowmo(scale,dur)`, `shake(mag,dur)`.
- audio: `sfx(name)` with names 'enemyDown','bossDown','spellStart','warn','cancel','charge'.
- hud: `hud.setBoss(boss)` reads boss.hp/maxHp/phaseIndex/phaseTotal/_spec.name for the bar+pip render; `hud.clearBoss()`, `hud.setSpell(name,bonus)`/`hud.clearSpell()`, and top-level `banner(text,sub,dur)` for centered announcements. The boss object exposes `phaseTotal` and `phaseIndex` precisely so the HUD can draw one pip per remaining phase.
- score: optional `grantSpellBonus(amount)` (guarded by typeof check) — spell capture bonus on clean phase clear.

HUD/BOSS DATA CONTRACT: a boss is an enemy with `.boss=true`, `.phases[]`, `.phaseTotal`, `.phaseIndex`, `.maxHp` reset per phase, `.invuln` (true during entrance/announce/heal/survival), and `.survivalEndsAt` (sim-time) during survival phases so the HUD can draw a countdown ring. During survival the boss is invuln; the phase ends purely on the timer.

COLLISION CONTRACT: enemies expose `.r` (hit radius) and `.x/.y`; player shots test circle-vs-circle against it. `damageEnemy` early-outs when `e.invuln`. Graze/player-hitbox logic lives in player + bullets subsystems; this subsystem never touches enemyBullets directly except via `cancelBullets`.

TUNING HOOKS: all HP/durations/spawn counts/drop tables are top-of-file consts or literal opts — balance by editing those. To enable spell capture-timeout borders, set `SPELL_BORDER_TIME>0` and have runPhase compare elapsed against it (left at 0 = no timeout). `CANCEL_TO_ITEM` toggles whether phase-clear cancels rain point items. The whole timeline is one readable `stageScript()` generator — reorder/insert waves there.

PERF: the scheduler holds only O(active coroutines) — a handful of waves + one boss + a few emitter forks, never per-bullet. Per-step cost is one `.next()` per live coro. Bullets (the thousands) are owned/integrated by the bullets subsystem, not here, so this stays cheap.
