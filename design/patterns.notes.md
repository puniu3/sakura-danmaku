# Danmaku Pattern Library — emitters, spell-card descriptors, and >=16 named patterns

## Overview
This subsystem is the visual heart of the game: a library of bullet emitters that spawn pooled bullets into `enemyBullets` from an origin, plus a spell-card / attack descriptor model the stage script drives over time.

Key design decisions:

1. EMITTER MODEL = pure spawn functions. Every pattern is `pat.name(origin, p)` where `origin={x,y}` (or any object with x/y, e.g. a boss) and `p` is a params object. The function reads from `p`, computes bullet kinematics, and calls the single low-level allocator `spawnBullet(o)`. Patterns never own state; any cadence/phase state lives on the emitter's caller (a spell card's `update`). This keeps patterns trivially composable and re-entrant — you can fire three different rings from one boss in one tick with no interference.

2. POLAR-FIRST. Almost all danmaku is naturally expressed as (angle, speed) at an origin. `polarVel(a,speed)` is the universal converter honoring the contract's clockwise/+y-down convention: `vx=cos(a)*speed, vy=sin(a)*speed`. Radial acceleration (expand/contract/accelerating rain) is just `ax=cos(a)*accel, ay=sin(a)*accel`.

3. CUSTOM UPDATE HOOK for non-ballistic bullets. The contract's bullet has an optional `update` fn. Three patterns need it: `bouncingBullets` (reflect off walls), `delayedTurn`/ghost (re-aim at born+delay), and `whipArc`/laser segments where we want a per-bullet behavior. `spawnBullet` stores `o.update` onto the bullet; the global integrator (in the bullet-update subsystem) is expected to call `b.update(b,dt)` if present BEFORE the default Euler integrate — or the pattern's update fully owns motion and the integrator skips default when `b.custom===true`. I document both hook shapes in integrationNotes so the bullet subsystem can pick.

4. HUE-PER-LAYER for ornateness. Multi-layer patterns (doubleRing, ringOfRings, roseCurve, spiral arms) offset hue per layer/arm so curtains read as structured color gradients, not noise. Helpers `hueShift` and `layerHue` centralize this.

5. SPELL CARD DESCRIPTOR. `makeSpell({name,hp,timeLimit,bonus,update,onStart,onEnd})` returns a descriptor. A tiny `Conductor` (also provided) runs the active card: ticks `update(boss,t,dt)` where `t` is seconds-since-card-start, tracks hp/timeLimit, and exposes `every(card, period)` / `phase(card,...)` cadence helpers so cards fire emitters on tick-based cooldowns without each card reinventing a counter. The stage script feeds a queue of cards to the Conductor.

6. DETERMINISM. All randomness goes through the global seeded `rng()`. No `Math.random`. This keeps replays/recordings stable and lets the difficulty layer reproduce scatter.

7. PERF. Patterns are allocation-light: they reuse the pool via `spawnBullet`, precompute trig in tight loops, and avoid closures in hot paths except where a per-bullet `update` is genuinely required. Firing a 200-bullet ring is ~200 pool writes and one loop. Targeting thousands of live bullets is the integrator's job; the library just keeps spawn cost O(count).

## Public API
// ---- Helpers ----
polarVel(a, speed) -> {vx,vy}            // clockwise, +y down
angleToPlayer(x, y) -> radians           // aim angle from (x,y) to player center
dist(ax,ay,bx,by) -> number
hueShift(hue, d) -> 0..360 wrapped
layerHue(baseHue, i, n, span) -> hue for layer i of n across span degrees
spawnBullet(o) -> bullet|null            // low-level pooled allocator; o may set x,y,vx,vy,ax,ay,r,style,hue,update,custom,plus pattern fields. Returns the bullet (or null if pool exhausted).

// ---- Pattern library: pat.<name>(origin, p) ----   (origin has .x .y; p is params)
pat.aimedShot(o,p)        // p:{speed,hue,style,r,jitter?}  one bullet toward player
pat.nWaySpread(o,p)       // p:{count,speed,baseAngle,spread,hue,style,r}  fan, spread=total radians
pat.aimedSpread(o,p)      // like nWaySpread but baseAngle auto = angleToPlayer
pat.ring(o,p)             // p:{count,speed,baseAngle?,hue,style,r}  even full circle
pat.evenRingOffset(o,p)   // ring + p.offset rotation (caller advances offset per tick)
pat.doubleRing(o,p)       // two concentric rings, p.speed & p.speed2, hue per layer
pat.spiral(o,p)           // p:{arms,speed,phase,hue,style,r,hueSpin?}  rotating multi-arm; caller advances phase
pat.expandingRing(o,p)    // p:{count,speed,accel,...} radial outward accel
pat.contractingRing(o,p)  // p:{count,speed,decel,...} radial inward accel (speed>0, accel toward center)
pat.whipArc(o,p)          // p:{count,speed,baseAngle,arc,t,duration,hue} sweeping arc keyed by t
pat.randomScatter(o,p)    // p:{count,speedMin,speedMax,baseAngle?,spread?,hue,jitterHue}
pat.roseCurve(o,p)        // p:{count,k,speed,phase,hue,style} r=cos(k*theta) -> speed modulated bullets
pat.flower(o,p)           // alias/variant of roseCurve with petalled speed bands
pat.acceleratingRain(o,p) // p:{count,xSpread,speed0,gravity,hue} slow drop then accelerate down
pat.bouncingBullets(o,p)  // p:{count,speed,baseAngle,spread,hue,bounces} reflect off walls (custom update)
pat.delayedTurn(o,p)      // p:{count,speed,baseAngle,spread,delay,turnTo|turnAim,speed2,hue} ghost re-aim
pat.straightLaser(o,p)    // p:{angle,length,gap,speed,hue,style} line of bullets fired as a beam
pat.lineOfBullets(o,p)    // p:{angle,count,gap,speed,hue} a rigid line (alias used by laser)
pat.ringOfRings(o,p)      // p:{clusters,perCluster,clusterSpeed,burstSpeed,hue} ring of mini-bursts

// ---- Spell-card / conductor ----
makeSpell(cfg) -> spell   // cfg:{name,hp,timeLimit,bonus?,update(boss,t,dt),onStart?,onEnd?}
Conductor(boss) -> {start(spell), update(dt), active, damage(n), finished}
every(card, period) -> bool   // true once per `period` seconds of card time (uses card._timers)
phase(t, segments) -> {i, lt} // pick a segment [{dur,...}] by elapsed card time t

## Constants
// Playfield (from contract)
const PF_W = 432, PF_H = 576;
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

// Bullet defaults
const DEFAULT_R = 4.5;            // default hit radius for medium round bullet
const BULLET_DESPAWN_MARGIN = 32; // matches contract despawn rule (integrator enforces)

// Visual style ids (the renderer subsystem maps these strings -> sprite/draw):
//   'orb'   medium round glow bullet (default)
//   'rice'  small elongated kunai (fast streams)
//   'pellet' tiny dot (dense fills)
//   'big'   large slow orb (boss centerpieces)
//   'star'  pointed star (rose/flower accents)
//   'arrow' arrowhead (lasers / lines)
//   'kite'  diamond (bouncing)
// Hue layering spans (degrees) tuned for "pastel danmaku curtain" reads:
const HUE_SPAN_RING   = 40;   // gentle gradient across a ring's index
const HUE_SPAN_LAYER  = 60;   // between stacked layers
const HUE_SPIN_PERTICK = 7;   // degrees the spiral rotates its hue each emit

// Cadence reference (seconds) — cards choose their own, these are sane danmaku tempos:
const T_STREAM = 0.05;  // aimed stream cadence
const T_RING   = 0.6;   // full-ring burst cadence
const T_SPIRAL = 1 / 30; // spiral emits ~ twice per visual frame for smooth arms

// Bounce
const MAX_BOUNCES_DEFAULT = 2;

## Integration Notes
HOOKS INTO THE LOOP

1. Pool contract. `spawnBullet(o)` gets a slot via `_poolGet()`, which tries, in order: `enemyBullets.spawn()`, `enemyBullets.alloc()`, then a cursor scan over `enemyBullets.list || enemyBullets` for `!alive`. Wire whichever your bullet-pool subsystem exposes; if it already has a `spawn()` returning a recycled dead object, you get O(1) allocation. If the pool is exhausted, `spawnBullet` returns null and the pattern silently drops that bullet (correct behavior for a hard cap — never throw in a spawn loop).

2. Fields stamped. `spawnBullet` writes exactly the canonical contract fields (x,y,vx,vy,ax,ay,r,style,hue,alive,born) plus pattern extras (speed,dir,av,accel) and behavior fields (update,custom,delay,turn,turnAbs,speed2,bounces,fired,phase). The pool's slot objects should be allocated once with all these keys present (monomorphic shape) so V8 keeps them as a single hidden class — do NOT create fresh `{}` per bullet. `born = T` uses the global sim clock; ensure `T` is updated before patterns fire each step.

3. Integrator coordination (IMPORTANT). The bullet-update subsystem must honor the custom hook:
   for each live bullet b:
     if (b.update) { b.update(b, dt); }            // custom owns motion when b.custom
     else { b.vx+=b.ax*dt; b.vy+=b.ay*dt; b.x+=b.vx*dt; b.y+=b.vy*dt; }
   The three provided updates (_updBounce, _updGhost, _updCurve) all fully integrate position themselves, so when `b.custom===true` the integrator MUST skip the default Euler step (else double integration). Simplest rule the integrator can adopt: `if (b.update){ b.update(b,dt); if(!b.custom){/*update only adjusted dir; still need default*/} } else default`. Since all shipped custom updates set custom=true and integrate fully, the clean rule is: "if b.update && b.custom -> call update, done; else default integrate (and optionally call a non-custom update first)." Pick one convention and keep it; I built the patterns around custom=true => update fully owns motion.

4. Despawn. The library does not despawn; the integrator enforces the contract's "32 units outside playfield" rule and flips `alive=false`. Bouncing bullets keep `bounces` and only leave after it hits 0 — they still despawn normally when finally off-field. Ghost bullets are normal once re-aimed.

5. angleToPlayer / player. Reads `player.x, player.y` in playfield-local coords. If your player hitbox center differs from its draw origin, point these at the hit center. aimed* patterns recompute aim at spawn time, so they track player motion between bursts (not within a burst — intentional).

6. rng. `randomScatter`, `acceleratingRain` jitter, and `aimedShot` jitter all call the global seeded `rng()` in [0,1). No `Math.random` anywhere — keeps the run deterministic for the difficulty/replay layers.

7. CONDUCTOR wiring (stage script). The stage subsystem builds an array of `makeSpell({...})` descriptors and drives them:
     const cond = Conductor(boss);
     cond.start(cards[0]);
     // each sim step, after T advances:
     cond.update(STEP);
     if (cond.finished) { award(cond.active.bonus * (cond.captured?1:0)); nextCard(); }
   Player shots call `cond.damage(dmg)` on hit. `every`/`everyN` use `card._dt` which the Conductor sets each tick — call emitters ONLY from inside a card's `update`, never outside, or `_dt` will be stale. Use `everyN(card,'key',period)` (named) when one card fires several independent cadences so their accumulators don't collide; bare `every(card,period)` keys purely on the period value and is fine when periods differ.

8. Cadence & fixed step. With STEP=1/120, `everyN(card,'spiral',1/30)` fires on every 4th sim step (smooth arms). Because the accumulator carries the remainder, cadence stays exact regardless of frame pacing. The `_tick` counter on the card increments each step and feeds `pat.spiral`'s `hueSpin*tick` for continuously rotating hue.

9. Style strings. Patterns emit style ids ('orb','rice','pellet','big','star','arrow','kite') that the RENDERER subsystem maps to draws/sprites. If the renderer doesn't know an id it should fall back to a hue-tinted circle of radius r — so unknown ids degrade gracefully rather than vanishing. Hue layering (layerHue/hueShift) assumes the renderer reads `b.hue` (0..360) and applies it as HSL/HSV; the soft-pastel feel comes from the renderer choosing high lightness + a brighter core, not from the library.

10. Ordering per step (recommended): advance T -> cond.update(dt) (which spawns this step's bullets via pat.*) -> integrate enemyBullets (honoring custom updates) -> collision/graze -> despawn off-field -> render. Spawning before integrate means new bullets get one integrate this same step (consistent with born=T).

11. Tuning knobs live in params, not code. Every pattern takes speed/count/hue/spread so the difficulty layer can scale `count` and `speed` per difficulty without touching the library. For "Lunatic", multiply counts and shrink ring step; the math holds because steps are derived from count.

12. whipArc and roseCurve are PHASE-DRIVEN: the card passes `t` (or a `phase`) it advances itself; the pattern is stateless. For a whip "crack", call whipArc every step over its `duration` window (e.g. `if (t<2) pat.whipArc(boss,{t,duration:2,...})`). Don't gate whipArc behind a coarse `every()` or the arc will look like discrete stairs instead of a sweep.
