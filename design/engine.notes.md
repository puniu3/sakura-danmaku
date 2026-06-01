# ENGINE CORE — fixed-timestep loop, pools, collision, RNG, math

## Overview
ENGINE CORE is the substrate every other subsystem runs on. It owns five concerns and nothing else (no gameplay logic, no rendering of entities, no spell-card scripting):

1. MAIN LOOP. A single requestAnimationFrame driver with a fixed-timestep accumulator. STEP = 1/120 s. Each animation frame we measure wall-clock dt, clamp it to <= 0.25 s (so a tab-switch / GC stall can never trigger a multi-second "spiral of death" of catch-up steps), add it to an accumulator, and run update(STEP) as many whole steps as fit. Leftover accumulator becomes an interpolation alpha (0..1) handed to render() so motion stays smooth even though sim ticks at a coarser-than-display rate when the monitor is >120 Hz. The global sim clock T advances by exactly STEP per tick — it is the authoritative time used by bullet `born`, pattern timers, spell-card scripts. Render is decoupled: it runs once per animation frame regardless of how many sim steps happened. Pause freezes the accumulator (we keep sampling rAF so we can still draw the pause overlay and keep dpr/resize correct, but we don't accumulate or step). An FPS sampler keeps a rolling average of real frame cadence and a separate "sim steps/sec" counter for the HUD/debug.

Design decisions: (a) We deliberately do NOT pass real dt into update — update always receives STEP. This is the whole point of a fixed step: deterministic physics + replayable RNG given a seed. dt-as-seconds is honored at the call boundary, and all velocities/accels are per-second, so a pattern author writes `vx = cos(a)*speed` once and it behaves identically at 60/120/144 Hz. (b) We clamp, never drop, but we also cap the number of catch-up steps per frame (MAX_STEPS) as a second safety net. (c) The accumulator and T are the only mutable time state; everything else reads T.

2. POOLS. A generic Pool<T> with preallocate, acquire(), release(obj), and an in-place alive-compaction sweep. Bullets/particles are pooled PLAIN OBJECTS (not classes) to keep them in fast monomorphic shape and avoid GC. acquire() returns a recycled object with `alive=true`; if the pool is exhausted it grows (rare; sized up front for thousands). The pool keeps a dense `items` array; per frame, compact() swaps dead entries to the tail and shrinks the live count, so iteration is over a tight live prefix with no holes — this is what keeps thousands of bullets at 60fps. Concrete pools: enemyBullets (8192), playerShots (1024), particles (4096). Each is created with a factory that stamps the canonical field shape so V8 sees one hidden class.

3. COLLISION. All circle-circle with squared distance and an early reject; dead entries skipped via the dense live prefix. Five checks: (a) player tiny hitbox (r≈2.4) vs every live enemy bullet — on hit, call onPlayerHit(bullet). (b) GRAZE: a near-miss ring — bullet within GRAZE_R (≈14) of player center but NOT yet a body hit, marked `grazed=true` once so each bullet grazes at most once; calls onGraze(bullet). (c) playerShots vs enemies (enemy has its own larger radius). (d) player vs items (collect / magnet trigger). (e) player vs enemy bodies (collision damage to player). Brute force with squared-dist + dead-skip is the default and is fine. We ALSO ship an optional uniform spatial grid for enemyBullets (toggle USE_GRID) that buckets bullets by cell and only tests the player's cell + neighbors — useful if a future stage pushes bullet counts so high the per-frame O(N) player test matters; for a single player query it's a clear win, and the grid is cheap to rebuild each step.

4. RNG. mulberry32 — a tiny, fast, well-distributed 32-bit PRNG seeded once for determinism. Exposed as a callable `rng()` returning [0,1), with helpers .range(a,b), .int(n), .pick(arr), .sign(), .bool(p), .angle(), plus .reseed(s) and .state()/.setState() so we can snapshot/restore (replays, deterministic boss patterns).

5. MATH. Free functions: hypot/dist2, clamp, lerp, approach (move-toward with cap), normalizeAngle (wrap to [-π,π)), angleTo, angleDiff, vec-from-polar, plus swap-remove for plain arrays (enemies, items). TAU/HALFPI constants. These are the vocabulary every pattern and AI uses.

The file exports a single `Engine`-flavored set of globals matching the contract (T, rng, the pools, helper fns) and a `mainLoop` you start once. Other subsystems plug their update() and render() bodies into the clearly-marked slots in `simStep()` and `renderFrame()`.

## Public API
// ---- time / loop ----
startEngine()                         // wire canvas, begin rAF; call once after all systems define their update/render hooks
let T = 0                             // global sim clock, seconds; advances by STEP per sim tick (read-only to others)
const STEP = 1/120                    // fixed timestep seconds
let renderAlpha = 0                   // 0..1 interpolation fraction for render() (accumulator leftover / STEP)
game.paused : bool                    // loop reads this; when true, no accumulation/stepping (game state machine owns it)
fps.frame : number                    // rolling avg real FPS (display)
fps.sim   : number                    // sim steps per second (debug)

// ---- pools (generic) ----
makePool(factory, n) -> Pool          // factory()=>fresh object; preallocates n
pool.acquire() -> obj                 // recycled obj, alive=true; grows if exhausted
pool.release(obj)                     // marks alive=false (compacted next sweep)
pool.compact()                        // swap-remove dead from dense live prefix; updates pool.count
pool.count : number                   // # live (iterate items[0..count) )
pool.items : Array                    // dense backing store; live entries are [0,count)
pool.forEachLive(fn)                  // fn(obj,i) over live prefix
pool.clear()                          // release all

// ---- concrete pools (globals per contract) ----
enemyBullets : Pool                   // cap 8192, canonical bullet shape
playerShots  : Pool                   // cap 1024
particles    : Pool                   // cap 4096
spawnBullet(x,y,vx,vy,opts)->b        // convenience: acquire enemyBullets, stamp fields, return
spawnShot(x,y,vx,vy,opts)->b          // acquire playerShots
spawnParticle(x,y,vx,vy,opts)->p      // acquire particles

// ---- collision (called from simStep in fixed order) ----
collidePlayerBullets()                // player-hit + graze vs enemyBullets; calls onPlayerHit(b)/onGraze(b)
collideShotsEnemies()                 // playerShots vs enemies; calls onEnemyHit(enemy,shot,dmg)
collidePlayerItems()                  // player vs items; calls onItemPickup(item)
collidePlayerEnemies()                // player body vs enemy bodies; calls onPlayerHit(null,enemy)
const USE_GRID = false                // toggle uniform grid path for player-vs-bullet
grid.rebuild(pool) / grid.queryInto(x,y,r,out)  // optional broadphase

// hooks the engine CALLS (other subsystems define these):
onPlayerHit(bulletOrNull, enemyOrNull?)   // collision/game subsystem
onGraze(bullet)                            // scoring subsystem
onEnemyHit(enemy, shot, dmg)               // enemy subsystem
onItemPickup(item)                         // items/scoring subsystem

// ---- rng (callable) ----
rng() -> [0,1)
rng.range(a,b) / rng.int(n) / rng.pick(arr) / rng.sign() / rng.bool(p=0.5) / rng.angle()
rng.reseed(uint32) / rng.state() -> uint32 / rng.setState(uint32)

// ---- math / array helpers ----
clamp(v,lo,hi) / lerp(a,b,t) / approach(cur,tgt,maxDelta)
dist2(ax,ay,bx,by) / hypot(dx,dy)
normalizeAngle(a) / angleTo(ax,ay,bx,by) / angleDiff(a,b)
swapRemove(arr,i)                     // O(1) remove for enemies/items
const TAU = Math.PI*2 / HALFPI = Math.PI/2

## Constants
STEP = 1/120                // fixed sim timestep (s)
MAX_FRAME_DT = 0.25         // clamp wall dt before accumulating (anti spiral-of-death)
MAX_STEPS = 8               // hard cap on catch-up steps per frame (second safety net)
PF_W = 432, PF_H = 576      // playfield logical rect (from contract)
HUD_W = 208                 // hud panel width to the right
CANVAS_W = 640, CANVAS_H = 576   // total logical canvas
BULLET_DESPAWN_MARGIN = 32  // bullets die this far outside playfield
ENEMYBULLET_CAP = 8192
PLAYERSHOT_CAP  = 1024
PARTICLE_CAP    = 4096
PLAYER_HIT_R = 2.4          // tiny player hitbox radius
GRAZE_R = 14                // near-miss ring radius
GRID_CELL = 32              // uniform grid cell size (units) for optional broadphase
GRID_COLS = Math.ceil(PF_W/GRID_CELL)  // 14
GRID_ROWS = Math.ceil(PF_H/GRID_CELL)  // 18
FPS_SMOOTH = 0.92           // EMA factor for fps.frame display
DEFAULT_SEED = 0x9e3779b9   // golden-ratio seed if none supplied
TAU = 6.283185307179586, HALFPI = 1.5707963267948966

## Integration Notes
CALL ORDER / OWNERSHIP. The engine owns the loop and the canonical sim pipeline in `simStep(dt)`. Every other subsystem plugs into named slots; do NOT reorder these without thinking — collision runs AFTER all movement so hits use this tick's positions, and pool compaction runs AFTER collision so a bullet killed this tick is still testable this tick:
  1. player.update(dt)            [PLAYER subsystem] — reads input, moves, sets player.focus, calls spawnShot() on its own cadence. Must maintain: player.x, player.y (playfield-local), player.dead(bool), player.invuln(seconds, engine decrements it), player.itemR (item magnet radius). player.focus toggles slow-move + hitbox reveal (engine doesn't care, RENDER does).
  2. enemies[i].update(dt)        [ENEMY subsystem] — AI + emitters call spawnBullet(). Each enemy needs {x,y,r,dead,invuln,bodyDamage,update(dt)}. Engine swap-removes dead enemies.
  3. BOSS.update(dt)              [SPELLCARD subsystem] — optional global `BOSS` object with .update; runs boss timeline/phase scripts which themselves spawn bullets. If you don't have a boss object, define `const BOSS={update:null}`.
  4-6. integrateBullets/Shots/Particles — ENGINE owns these. A pattern may set b.update=fn for custom motion; else default integrate (ax/ay then x/y), with a polar-curve fast path when b.av!=0 (rotates b.dir, re-derives vx/vy from b.speed). Bullets despawn 32u outside PF.
  7. items[i].update              [ITEMS subsystem] — array of plain {x,y,r,vy,dead,update?}. Engine swap-removes off-bottom/dead.
  8. collision pass — engine calls collideShotsEnemies, collidePlayerBullets, collidePlayerEnemies, collidePlayerItems.
  9. compact() the three pools; advance T.

HOOKS THE ENGINE CALLS — you MUST define these globals or the loop throws:
  - onPlayerHit(bulletOrNull, enemyOrNull) — [GAME/COLLISION-consumer] handle death/deathbomb window; engine only detects, doesn't decide. It already gates on player.invuln/player.dead so you won't get double-hits during i-frames.
  - onGraze(bullet) — [SCORING] bullet.grazed already set true (each bullet grazes once); bump graze count / play sfx.
  - onEnemyHit(enemy, shot, dmg) — [ENEMY/SCORING] subtract enemy.hp; set enemy.dead when killed; spawn score items. Engine consumes the shot unless shot.pierce>0.
  - onItemPickup(item) — [ITEMS/SCORING] apply effect, set item.dead.

GLOBALS THE ENGINE READS (must exist before startEngine): game (with .paused bool), player, enemies[], items[], plus the RENDER object (engine sets RENDER.ctx/.dpr/.canvas and calls RENDER.draw(alpha)). Pools/rng/T/STEP/helpers are exported BY the engine — other files just reference them.

DETERMINISM. Because update always gets STEP (never real dt) and rng is seeded mulberry32, a given seed + input sequence replays identically. If you record inputs for replays, snapshot rng.state() at run start and restore with rng.setState(). Pattern authors: use T for all timing (e.g. `if ((T*2|0) !== ((T-STEP)*2|0)) fireRing()`), never wall-clock.

PAUSE. game.paused=true freezes accumulation and T; the loop still runs rAF and calls RENDER.draw(1) so the pause menu animates and resize keeps working. Unpausing resumes cleanly because _lastMs was updated every frame (no dt spike). The MAX_FRAME_DT clamp also absorbs the first frame after a long pause/tab-switch.

RENDER INTERP. renderFrame gets alpha in [0,1). If RENDER wants smooth motion above the sim rate, store prevX/prevY on entities and draw at lerp(prev,cur,alpha). The engine doesn't store prev positions (keeps the hot pool shape minimal) — if you want interpolation, RENDER adds prevX/prevY fields and updates them at the top of each entity's update. At 120Hz sim vs 60Hz display this is unnecessary (sim is finer than display); it only matters on >120Hz monitors, so it's optional.

PERF / GOTCHAS. (a) Pools iterate items[0..count) — never index past count, and never hold a reference to a pooled object across compact() (the swap may move it; use the live-prefix index instead). (b) release() only sets alive=false; the object is physically retained until the next compact(), so collision in the same tick still sees it (intended). (c) USE_GRID rebuilds the grid every player-bullet pass; only flip it on if profiling shows the O(N) player scan is hot — for one player query at 8k bullets brute force is typically fine, the grid mainly pays off if you later add multiplayer/option-pods doing many point queries. (d) Bullet `update` fns and `av` curving bypass ax/ay; pattern subsystem must pick one motion model per bullet. (e) Particles use life/maxLife; RENDER fades by p.life/p.maxLife. (f) spawnBullet/spawnShot/spawnParticle reset the FULL canonical shape before applying opts, so a recycled object never leaks stale fields (e.g. a previous bullet's update fn) — always spawn through these, don't acquire() raw unless you re-init every field yourself.

DESPAWN MARGIN is shared (BULLET_DESPAWN_MARGIN=32) per contract. Collision radii: PLAYER_HIT_R=2.4, GRAZE_R=14 — RENDER should draw the focus-dot at PLAYER_HIT_R scale so the visible hitbox matches the real one.
