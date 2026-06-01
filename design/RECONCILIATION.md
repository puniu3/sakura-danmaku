# RECONCILIATION

## Final Constants
AUTHORITATIVE CONSTANT TABLE (single source of truth — define ONCE at top of file, all subsystems reference these globals; delete the duplicate `const PF_W=...` lines that each spec re-declares).

— Playfield / canvas —
PF_W = 432, PF_H = 576            (all four specs agree)
HUD_W = 208
CANVAS_W = 640, CANVAS_H = 576
PF_X = 0, PF_Y = 0                (render's playfield screen offset; canvas root transform = setTransform(dpr,0,0,dpr,0,0), then translate(PF_X,PF_Y) + clip for playfield content)
DPR_CAP = 2

— Loop / time —
STEP = 1/120
MAX_FRAME_DT = 0.25
MAX_STEPS = 8
DEFAULT_SEED = 0x9e3779b9
FPS_SMOOTH = 0.92
T = 0                            (global sim clock, MUST be window.T so render/patterns read it)
renderAlpha = 0

— Pools (caps; engine is authoritative) —
ENEMYBULLET_CAP = 8192
PLAYERSHOT_CAP  = 1024
PARTICLE_CAP    = 4096
BULLET_DESPAWN_MARGIN = 32       (engine name) — alias stage's OFFSCREEN_PAD=32 and SPAWN_MARGIN top-spawn=40 are SEPARATE: keep SPAWN_MARGIN=40 (stage-only spawn-above-top) and despawn margin=32. No conflict, both kept.

— Player (systems is authoritative; engine/visual must adopt these) —
PLAYER_HIT_R = 2.4   (engine's PLAYER_HIT_R == systems' PLAYER_R — unify to PLAYER_R=2.4)
GRAZE_R = 14
PLAYER_SPEED = 200
PLAYER_FOCUS_MUL = 0.45
PLAYER_MARGIN = 10
PLAYER_START = {x:216, y:496}
FIRE_CADENCE = 0.055
SHOT_SPEED = 720  (vy NEGATIVE = up)
SHOT_DMG = 2, OPTION_DMG = 1.4
MUZZLE_PARTICLES = 2

— Power —
MAXPOWER = 400
POWER_BREAKS = [0,40,80,150,200,300,400]
POWER_PER_ITEM = 5, POWER_PER_BIG = 25

— Bomb / death —
START_BOMBS = 3, MAX_BOMBS = 8
BOMB_INVULN = 2.5, BOMB_BOSS_DPS = 140, BOMB_DOT_TIME = 2.2, BOMB_FLASH = 0.5
DEATHBOMB_FRAMES = 8, DEATHBOMB_TIME = 8/120
START_LIVES = 3, MAX_LIVES = 9
RESPAWN_INVULN = 3.0, RESPAWN_BLINK = 0.09
DEATH_CLEAR_R = 64, DEATH_POWER_DROP = 8

— Scoring / items —
GRAZE_SCORE = 50
EXTEND_THRESHOLDS = [1e6,3e6,6e6,1e7]
POINT_BASE = 10000, POINT_MIN = 2000
SPELL_CAPTURE_BONUS = 500000  (systems) — NOTE: stage's per-card `bonus` literal values still flow through; SPELL_CAPTURE_BONUS is only the systems fallback default. Card descriptors carry their own `bonus`.
ITEM_GRAV = 120, ITEM_TERMINAL = 180, ITEM_R = 10
ITEM_MAGNET_ACC = 900, ITEM_MAGNET_MAXSPD = 520
AUTO_COLLECT_Y = 64, POC_LINE_Y = 140

— Item kind: CANONICAL = STRING ids (resolves int-vs-string conflict). —
Item.kind ∈ 'power'|'point'|'bigpower'|'oneup'|'full'|'star'|'bomb'.
(systems' numeric ITEM_KIND is dropped as a public field; if systems internally wants ints it keeps a private map but the stored `item.kind` field and dropItem(x,y,type) arg are STRINGS. Stage's 'life' → renamed to 'oneup' everywhere; stage drop tables change 'life'→'oneup'.)
ITEM_HUE (by string key) = {power:15, point:205, bigpower:15, oneup:340, full:280, star:55, bomb:200}

— Math constants —
TAU = 6.283185307179586, HALFPI = 1.5707963267948986, DEG = Math.PI/180

— Bullet visual defaults (patterns + visual) —
DEFAULT_R = 4.5
Bullet style ids (canonical set the renderer maps): 'orb','rice','pellet','big','star','arrow','kite'. Render's extra aliases ('bigBall','ring','bubble','kunai','scale','bolt','needle') are OPTIONAL render-side synonyms; pattern library only emits the 7 canonical ids. Unknown id → render falls back to hue-tinted circle radius r.
HUE_BUCKET = 10 (render sprite cache quantization)
HUE_SPAN_RING=40, HUE_SPAN_LAYER=60, HUE_SPIN_PERTICK=7
SPRITE_PAD=3, GLOW_SOFTNESS=0.55, CORE_FRACTION=0.42, BULLET_SPRITE_PX_PER_UNIT=2.0

— Screen FX (render is authoritative) —
MAX_SHAKE=11, TRAUMA_DECAY=1.8, FLASH_DECAY=9.0, SPAWN_FADE=0.10
CANCEL_WAVE_SPEED=520, CANCEL_WAVE_LIFE=0.6, POPTEXT_LIFE=0.9
BOSS_AURA_SPIN=0.6, BANNER_SWEEP=0.9
PETAL_LAYERS = [{n:14,scale:0.55,vy:18,sway:10,alpha:0.55},{n:18,scale:0.8,vy:34,sway:16,alpha:0.8},{n:12,scale:1.15,vy:58,sway:24,alpha:1.0}]

— Stage timeline / HP (stage is authoritative, unchanged) —
INTRO_FADE=2.5, CALM_BEFORE_BOSS=4.0, WAVE_GAP=1.2, BOSS_ENTER=2.2, SPELL_ANNOUNCE=1.6, PHASE_HEAL=0.5
HP_POP_LIGHT=8/R=9, HP_POP_MED=16/R=11, HP_POP_HEAVY=34/R=14
MIDBOSS_HP_NONSPELL=1100, MIDBOSS_HP_SPELL=1500
FB_HP={nonspell0:1800,spell1:2400,nonspell1:2000,spell2:2800,spell3:3200}
FB_SURVIVAL_TIME=28
SLOWMO_DEFEAT=0.35, SLOWMO_DEFEAT_DUR=2.2

— Audio (unchanged, decoupled) —
MASTER_BASE_GAIN=0.42, LIMITER={threshold:-6,knee:0,ratio:20,attack:0.003,release:0.1}
SCHEDULE_AHEAD=0.10, PUMP_MS=25, MUSIC_FADE=0.18
MUSIC_GAIN_STAGE=0.55, MUSIC_GAIN_BOSS=0.62
STAGE_BPM=96, BOSS_BPM=138, SHOOT_MIN_GAP=0.045
LS keys: 'bh.muted','bh.vol' (audio), 'danmaku_hiscore_v1' (systems hi-score)

— FSM —
STATE={TITLE:0,PLAYING:1,PAUSED:2,GAMEOVER:3,STAGECLEAR:4}; GAMEOVER_AUTORET=8.0
GAME_KEYS = Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','KeyZ','KeyX','Escape','KeyP','Enter'])

## Public API Table
UNIFIED GLOBAL SINGLETONS + PUBLIC API (with renames). All attached to window (single-file, but be explicit for cross-references: window.T, window.game, window.player, window.enemyBullets, window.playerShots, window.enemies, window.items, window.particles, window.rng).

=== GLOBAL SINGLETONS (define before startEngine) ===
game   — state machine. MUST expose BOTH: game.state (STATE int, owned by systems FSM) AND game.paused (bool, derived: `game.paused = (game.state===STATE.PAUSED)`, kept in sync by setState). Plus render-read fields: game.score, game.hi, game.lives, game.bombs, game.power, game.powerMax, game.graze, game.boss, game.spellIntensity, game.flash, game.fullpower. getHUD() returns this model; render reads game.* directly (do NOT require render to call getHUD — expose fields ON game).
player — singleton struct (systems owns). CANONICAL fields (rename to satisfy all readers): player.x, player.y, player.focus(bool), player.power, player.options:[{x,y}] (NOT {dx,dy} — systems must write absolute x,y for render; keep dx/dy as internal if needed but expose .x/.y), player.dead(bool), player.invuln(seconds; ENGINE decrements; this is the ONE i-frame field — render's `iframe` and systems' state-timer both read player.invuln), player.itemR (magnet radius), player.state (systems lifecycle: 'alive'|'pendingdeath'|'dead'|'respawning').  RESOLUTION: kill render's separate `player.iframe` name → render reads player.invuln. kill `player.options[].dx/dy` → use .x/.y.
enemies[] — array, swap-remove. Each: {x,y,r,dead,invuln,hp,maxHp,bodyDamage,boss?,update(dt)} plus boss adds {phases[],phaseTotal,phaseIndex,survivalEndsAt,_spec}. ENGINE field `dead` is canonical; stage uses `alive` → RESOLUTION: stage adopts `dead` (engine swap-removes on e.dead; stage's `e.alive` renamed to `!e.dead`; fork ownership checks `!owner.dead`).
items[] — array, swap-remove. Each: {x,y,r,vy,vx,kind(string),dead,alive,update?}. (engine reads .dead; keep both dead+alive in sync or pick dead).
enemyBullets, playerShots, particles — Pools (see Pool API).
rng — callable seeded mulberry32 (engine owns).

=== POOL API (engine is authoritative; patterns/systems/visual adapt) ===
Canonical Pool: makePool(factory,n); pool.acquire()->obj(alive=true); pool.release(obj); pool.compact(); pool.count; pool.items[]; pool.forEachLive(fn); pool.clear().
RENAMES/ALIASES added to satisfy siblings (cheap one-liners on the pool object):
  pool.spawn()  = alias of pool.acquire()         [patterns _poolGet tries .spawn() first → works; systems calls playerShots.spawn() → works]
  pool.alloc()  = alias of pool.acquire()         [patterns fallback]
  pool.forEach(fn) = alias of pool.forEachLive(fn) [systems]
  pool.list = pool.items                          [patterns cursor-scan fallback; render reads pool.items]
Render supports `pool.items` (present) — OK. Patterns' `_poolGet` finds `.spawn()` first — O(1). No raw-array path needed.

=== spawnBullet — RESOLVE SIGNATURE CONFLICT ===
Engine spec: spawnBullet(x,y,vx,vy,opts). Patterns spec: spawnBullet(o) single object. THESE CANNOT COEXIST as one fn.
RESOLUTION: canonical low-level allocator = spawnBullet(o) (single options object, PATTERNS' shape — it's the one the 16+ patterns are built around). Engine's positional convenience renamed to spawnBulletXY(x,y,vx,vy,opts) (internal). spawnBullet(o) stamps the FULL canonical shape: x,y,vx,vy,ax,ay,r,style,hue,alive=true,born=T,grazed=false,fade=1, plus pattern extras speed,dir,av,accel and behavior update,custom,delay,turn,turnAbs,speed2,bounces,fired,phase. Returns bullet or null (pool exhausted → silent drop, never throw).
spawnShot(x,y,vx,vy,opts) and spawnParticle(x,y,vx,vy,opts) keep POSITIONAL form (engine) — systems calls spawnParticle(x,y,vx,vy,life,style,hue): RESOLUTION change spawnParticle signature to spawnParticle(x,y,vx,vy,opts) where opts={life,style/kind,hue,r}; systems updates its ~5 call sites to pass an opts object. Particle canonical fields: {x,y,vx,vy,r,age=0,life,maxLife,kind(string: 'spark'|'ring'|'sparkle'|'petalBurst'|'muzzle'|'death'|'graze'|'pickup'),hue,alive,born}. RESOLUTION on particle field naming: keep BOTH `age` and `life` (render fades by age/life; engine increments age each step, despawns when age>=life). Drop engine's `maxLife` (use `life` as the duration). render's `kind` == systems' `style` arg → call it `kind`.

=== PATTERN LIBRARY — RESOLVE NAMING (patterns vs stage) ===
Patterns exposes `pat.<name>(o,p)`; stage calls bare `aimedShot(src,opts)`,`ring`,`spiral`,`fan`,`wall`,`burst`,`rain`. RESOLUTION: keep `pat.*` as the library namespace AND add a thin bare-name adapter layer that maps stage's vocabulary onto pat.* with opts-key translation:
  aimedShot(src,o) -> pat.aimedShot(src,{speed:o.speed,hue:o.hue,style:o.style,r:o.r,jitter:o.jitter})
  ring(src,o)      -> pat.ring(src,{count:o.count||o.n,speed:o.speed,baseAngle:o.rot,hue:o.hue,style:o.style,r:o.r})
  spiral(src,o)    -> pat.spiral(src,{arms:o.arms,speed:o.speed,phase:o.rot||o.phase,hue:o.hue,style:o.style})
  fan(src,o)       -> pat.nWaySpread or pat.aimedSpread when o.aim (count:o.count||o.n, spread:o.spread, baseAngle:o.angle)
  wall(src,o)      -> pat.straightLaser/lineOfBullets (angle:o.angle,count:o.count,gap:o.gap,speed:o.speed,hue)
  burst(src,o)     -> pat.ringOfRings or pat.randomScatter
  rain(src,o)      -> pat.acceleratingRain(src,{count,xSpread:o.across,speed0:o.speed,gravity:o.accel,hue})
These ~7 adapters are the ONLY glue stage needs; if a key is wrong, fix only the adapter.

=== SCHEDULER OWNERSHIP — RESOLVE Director vs Conductor ===
Stage's `Director` (generator-coroutine scheduler) is the AUTHORITATIVE timeline driver for the whole stage including boss phases. Patterns' `Conductor`/`makeSpell`/`every`/`phase` is DEMOTED to an optional helper the stage MAY use inside a bossPhase coroutine, but the canonical path is stage's runBoss/bossPhase walking phases[]. To avoid two competing boss timers: USE Director only. `makeSpell` descriptor shape is reconciled with stage's phase descriptor: a phase desc = {name,hp,timeLimit/survival,bonus,update(boss,t,dt),onStart,onEnd,border}. Keep `every(card,period)`/`phase(t,segments)` as stateless cadence helpers callable from inside a phase's per-step emitter (they read card._timers/_dt which stage sets) — they don't drive the loop, Director does.
Director public API (authoritative): Director.start(genFn), Director.fork(genFn,owner), Director.kill(handle), Director.update(dt) [call once per sim step], Director.clear(). Entry: startStage(); teardown: abortStage()+Director.clear().

=== HOOKS THE ENGINE CALLS (define all or loop throws) ===
onPlayerHit(bulletOrNull, enemyOrNull) -> systems.onPlayerHit (systems' takes (srcBullet) only → widen to (bullet,enemy); systems ignores 2nd arg or uses for collision-damage source). Engine gates on player.invuln/dead.
onGraze(bullet) -> systems.onGraze (sets bullet.grazed once).
onEnemyHit(enemy, shot, dmg) -> RESOLVE: engine names it onEnemyHit; stage/systems use damageEnemy(e,amount,fromBomb). RESOLUTION: engine's collideShotsEnemies reads dmg from shot.dmg (systems sets shot.dmg) and calls onEnemyHit(enemy,shot,shot.dmg); define onEnemyHit = function(e,shot,dmg){ damageEnemy(e,dmg,false); } so both names exist, damageEnemy is the real impl (stage owns it: non-boss auto-kill at hp<=0, boss decrement only). applyBossDot calls damageEnemy(e,amt,true) directly.
onItemPickup(item) -> systems.collectItem(item) wrapper: onItemPickup=function(it){ collectItem(it); }.

=== RENDER PUBLIC API (authoritative names; stage's fx wrappers map to these) ===
Render.init(canvasEl), Render.resize(), Render.frame(now,alpha), Render.timeScale, Render.fps.
Render.flash(intensity,hue), Render.shake(amount), Render.cancelWave(x,y,hue,strength), Render.slowmo(scale,dur), Render.popText(x,y,text,hue), Render.banner(name,subtitle).
getBulletSprite(style,hue), getPlayerShotSprite(kind,hue).
STAGE fx-name adapters (stage calls these bare names → map to Render.*):
  screenFlash(color,dur) -> Render.flash(intensityFromColor, hueFromColor)
  slowmo(scale,dur)      -> Render.slowmo(scale,dur)
  shake(mag,dur)         -> Render.shake(mag)
  spawnDeathPuff(x,y,hue)-> spawnParticle(x,y,0,0,{life:0.4,kind:'petalBurst',hue}) (×N)
  cancelBullets({...})   -> bullets-side: clears enemyBullets, optionally spawns point items + Render.cancelWave + Render.flash
  banner(text,sub,dur)   -> Render.banner(text,sub)
Render reads drawEnemies(ctx,T,alpha) optional hook → stage/enemy subsystem defines it to draw non-boss enemies inside the clipped, shake-translated playfield (slot 6 in draw order).

=== AUDIO — RESOLVE window.Audio + call-shape conflict ===
Audio module sets window.Audio (object with Audio.sfxShoot() etc, Audio.playMusic, Audio.unlock...). Systems calls `sfx.shoot()`,`sfx.bomb()`,`sfx.item(kind)` (method-style on an `sfx` object). Stage calls `sfx('enemyDown')` (string-arg fn). RESOLUTION: keep window.Audio as the real module. Provide a thin `sfx` shim object that systems uses: sfx={shoot:Audio.sfxShoot, bomb:Audio.sfxBomb, deathbomb:Audio.sfxBomb, death:Audio.sfxPlayerDeath, graze:Audio.sfxGraze, item:(k)=>Audio.sfxItemGet(), powerup:Audio.sfxItemGet, extend:Audio.sfxExtend, capture:Audio.sfxSpellDeclare, start:()=>{}, pause:()=>{}, gameover:()=>{}, stageclear:()=>{}, enemyHit:Audio.sfxEnemyHit, enemyDeath:Audio.sfxEnemyDeath, spell:Audio.sfxSpellDeclare, warn:Audio.sfxBossWarn}. Stage's string-fn sfx(name): define sfx as a function too? CONFLICT (object vs fn). RESOLUTION: stage adopts the method form — replace stage's sfx('enemyDown')→sfx.enemyDeath(), sfx('bossDown')→Audio.sfxPlayerDeath()/a bossDown alias, sfx('spellStart')→sfx.capture(), sfx('warn')→sfx.warn(), sfx('cancel')→sfx.bomb(), sfx('charge')→Audio.sfxSpellDeclare(). All guard-checked: `sfx.x && sfx.x()`. Audio.unlock() wired to first keydown in attachInput.
window.Audio shadows native HTMLAudioElement — intentional, game uses only Web Audio. No other subsystem needs `new Audio()`.

=== MATH/RNG HELPERS (engine owns, global) ===
clamp,lerp,approach,dist2,hypot,normalizeAngle,angleTo,angleDiff,swapRemove,polarVel (patterns), TAU,HALFPI,DEG. Patterns' `dist(ax,ay,bx,by)` == engine's `hypot`-based dist → patterns uses engine hypot; keep one `dist`. patterns' angleToPlayer reads player.x/.y (hit center).

## Load Order
DEFINITION ORDER in the single file (top → bottom), then INIT order, then per-step slot order.

=== A. DEFINITION ORDER (script top→bottom) ===
1. CONSTANTS block (the one authoritative table — all PF_W/STEP/palette/etc. ONCE; remove every duplicate re-declaration the individual specs ship).
2. ENGINE core: rng (mulberry32), math helpers, swapRemove, makePool + the three pools (enemyBullets/playerShots/particles) with .spawn/.alloc/.forEach/.list aliases, spawnBullet(o)/spawnShot/spawnParticle, global T, collision fns, the main-loop driver (but DON'T start it yet).
3. AUDIO module (window.Audio) + the `sfx` shim object. (No ctx yet — lazy.)
4. RENDER layer: Render.init/resize/frame, sprite caches, palette, cam/petals/pops, fx setters (flash/shake/cancelWave/slowmo/popText/banner). Defines its render-owned pools. (Reads globals at frame time, so safe to define before they're populated.)
5. PATTERNS library: polarVel/hueShift/layerHue/angleToPlayer, pat.* (16+), the bare-name adapter layer (aimedShot/ring/spiral/fan/wall/burst/rain → pat.*), makeSpell/every/phase helpers.
6. SYSTEMS (player/game/scoring/items/FSM): game object, player struct, input (attachInput, keymap), playerUpdate/updateItems/scoring/bomb/death, setState/startGame, the engine hooks onPlayerHit/onGraze/onItemPickup, the `sfx` shim already from step 3.
7. STAGE/ENEMIES: Director scheduler, spawnEnemy, moveTo/bezier, waves, runBoss/makeBoss, damageEnemy, onEnemyHit wrapper, drawEnemies hook, cancelBullets, dropItem→spawnItem wrapper, startStage/abortStage, the stageScript() generator.
8. BOSS: per contract define `const BOSS={update:null}` (or the real boss object) — but with Director-owned timeline, BOSS.update stays null and Director drives phases; engine's simStep slot 3 calls BOSS.update only if non-null.
9. BOOT: build canvas el, Render.init(canvas), initGameSystems(), attachInput(window) (installs Audio.unlock on first keydown), setState(STATE.TITLE), then startEngine() LAST.

=== B. INIT ORDER (boot sequence, runs once) ===
Render.init(canvas) → initGameSystems() (builds player, loads hi-score, builds game model) → Director exists (empty) → attachInput(window) → setState(TITLE) → startEngine(). startStage() is NOT called at boot; it's called inside startGame() (TITLE→PLAYING). Audio.unlock() fires on first real keydown (Enter to start), before first playMusic('stage').

=== C. simStep(dt=STEP) SLOT ORDER (engine pipeline; dt is ALWAYS STEP) ===
  1. handleInput(STEP)                    [systems] promote key edges this step
  2. updateGameSystems(STEP)              [systems] dispatch by game.state; PLAYING → playerUpdate (movement, auto-fire→spawnShot, bomb/death timers, invuln decrement) + updateItems + applyBossDot
  3. tickStage(STEP) === Director.update(STEP)  [stage] advances stageScript, wave coros, enemy movement coros (set e._steered), boss phase coros (which call pat.* → spawnBullet). Replaces engine's separate enemies[i].update + BOSS.update slots: Director owns enemy/boss updates via coroutines. Engine STILL runs enemyIntegrate(e) for un-steered enemies after (see 4).
  4. for each enemy: enemyIntegrate(e,STEP) — integrate vx/vy ONLY if !e._steered; clear e._steered. (engine swap-removes e.dead enemies here.)
  5. integrateBullets()                   [engine] per bullet: if(b.update){b.update(b,STEP); if b.custom DONE} else default Euler (vx+=ax*dt;vy+=ay*dt;x+=vx*dt;y+=vy*dt; polar fast-path when b.av!=0). Despawn 32u outside PF.
  6. integrateShots()                     [engine] move playerShots up; despawn off-top.
  7. integrateParticles()                 [engine] age+=dt; despawn age>=life.
  8. items[i].update / item gravity       [systems updateItems already did economy in step 2; engine just despawns off-bottom/dead]  — NOTE: to avoid double-update, items move INSIDE updateItems (step 2). Engine slot 7 only swap-removes dead/off-bottom. Pick ONE mover = systems.updateItems.
  9. COLLISION pass [engine], fixed order: collideShotsEnemies() → collidePlayerBullets() (hit+graze) → collidePlayerEnemies() → collidePlayerItems(). (collision AFTER all movement so hits use this-tick positions.)
  10. enemyBullets.compact(); playerShots.compact(); particles.compact().
  11. T += STEP   (advance LAST; but patterns need born=T for THIS step's spawns — RESOLUTION: advance T at the TOP of simStep BEFORE step 1, OR set born=T where T is already this-step's value. Patterns spec says 'ensure T updated before patterns fire' and 'spawning before integrate'. DECISION: advance T at the very TOP of simStep (T+=STEP first), so all spawns this step stamp born=T-current and get one integrate this step. Move step 11 to step 0.)

=== D. renderFrame(now,alpha) SLOT ORDER (once per rAF; never advances sim) ===
Loop computes rawDt → acc += rawDt * Render.timeScale (slow-mo) → run 0..MAX_STEPS simSteps → renderAlpha = acc/STEP → Render.frame(now, renderAlpha).
Inside Render.frame, draw order (back→front), playfield-clipped except HUD:
  1 sky+clouds → 2 petals → 3 spell vortex/darken (×game.spellIntensity) → 4 items → 5 player shots → 6 boss body + drawEnemies() hook → 7 particles(additive) → 8 ENEMY BULLET CURTAIN(additive) → 9 player ship + focus hitbox(at PLAYER_R scale) → 10 cancel waves → 11 score pops → 12 spell banner → 13 vignette+scanlines → 14 HUD panel + boss HP bar.
When game.paused (game.state===PAUSED): loop still calls Render.frame(now,1); petals/clouds advance with dt*0 (frozen); pause overlay drawn by render branching on game.state.

## Conflicts
CONCRETE CONFLICTS + RESOLUTION (each: what clashes → the decision).

1. spawnBullet signature. engine=spawnBullet(x,y,vx,vy,opts); patterns=spawnBullet(o). → Canonical = spawnBullet(o) (single object, patterns' shape; 16 patterns depend on it). Engine's positional version renamed spawnBulletXY (internal). spawnShot/spawnParticle stay positional.

2. spawnParticle shape. engine=spawnParticle(x,y,vx,vy,opts); systems=spawnParticle(x,y,vx,vy,life,style,hue); visual reads {age,life,kind}. → spawnParticle(x,y,vx,vy,opts={life,kind,hue,r}); systems updates ~5 call sites to pass opts; particle field `style`→`kind`; keep `age`(engine increments)+`life`(duration); drop `maxLife`.

3. Pool API names. engine=acquire/forEachLive/items/count; patterns=spawn/alloc/list; systems=spawn/forEach/clear; visual=items|raw. → engine Pool gains aliases: spawn=acquire, alloc=acquire, forEach=forEachLive, list=items. Render uses pool.items. No raw-array path.

4. Pattern fn names. patterns=pat.aimedShot/ring/spiral...; stage calls bare aimedShot/ring/spiral/fan/wall/burst/rain with different opts keys (n,rot,across,aim,gapAim). → Keep pat.* lib; add 7 bare-name adapter fns translating stage opts→pat opts (see publicApiTable). Only adapters change if keys drift.

5. Two schedulers. stage=Director(coroutine); patterns=Conductor/makeSpell(cadence). Both claim boss timeline. → Director is the SOLE loop driver and owns boss phases via runBoss/bossPhase. Conductor demoted; every()/phase() kept as stateless cadence helpers usable inside a phase's emitter. `const BOSS={update:null}` stays null (Director drives), engine calls BOSS.update only if non-null.

6. Enemy alive flag. engine/systems/visual use e.dead; stage uses e.alive. → Canonical e.dead. Stage renames e.alive→!e.dead; fork-ownership checks !owner.dead; engine swap-removes on e.dead.

7. Enemy-damage hook. engine=onEnemyHit(enemy,shot,dmg); stage/systems=damageEnemy(e,amount,fromBomb). → damageEnemy is the real impl (stage owns: non-boss auto-kill, boss decrement-only, invuln early-out). Define onEnemyHit(e,shot,dmg)=>damageEnemy(e,dmg,false). collideShotsEnemies reads dmg from shot.dmg.

8. Item kind type. systems=int ITEM_KIND{POWER:0..}; visual+stage=string 'power'|'point'|'life'|'full'. → Canonical = STRING. systems' public item.kind field + dropItem arg are strings; numeric map is private-only. Stage's 'life'→'oneup' everywhere (drop tables too). ITEM_HUE re-keyed by string.

9. game.state vs game.paused. systems=game.state(int FSM); engine+visual read game.paused(bool) AND visual reads game.score/lives/boss/spellIntensity. → game carries BOTH: game.state(authoritative) and game.paused=(state===PAUSED) kept synced by setState. Expose score/hi/lives/bombs/power/graze/boss/spellIntensity/flash/fullpower as live fields ON game (not only via getHUD()).

10. Player i-frame name. engine=player.invuln(sec); visual=player.iframe(sec); systems=lifecycle timers. → ONE field player.invuln (seconds); engine decrements; render reads player.invuln for IFRAME_BLINK. Drop player.iframe.

11. Player options shape. visual reads player.options:[{x,y}]; systems writes player.options[i].dx/dy. → systems writes absolute .x/.y on each option (keep dx/dy internal). Render reads .x/.y.

12. Bullet cancel-fade field. visual reads b.fade (cancel fade-out alpha) + spawn fade from born; neither engine/systems define b.fade. → spawnBullet stamps fade=1 in canonical shape; cancelBullets sets b.fade ramp; render multiplies globalAlpha by b.fade and by spawn-fade(age<SPAWN_FADE).

13. Audio call shape. audio=window.Audio.sfxShoot(); systems=sfx.shoot(); stage=sfx('enemyDown'). → Real module window.Audio. `sfx` shim object maps systems' method names→Audio.*. Stage drops string-fn form, uses sfx.method()/Audio.* directly. All guarded (sfx.x && sfx.x()). Audio.unlock() on first keydown.

14. T globalness + timing. engine owns T; patterns need born=T this-step; visual reads window.T (falls back now/1000). → T is window.T. Advance T+=STEP at TOP of simStep (before any spawn) so born=T is this-step value and new bullets integrate once this step.

15. Despawn vs spawn margin. engine BULLET_DESPAWN_MARGIN=32; stage OFFSCREEN_PAD=32 (same) + SPAWN_MARGIN=40 (different purpose). → No real conflict: despawn=32 (one const), top-spawn-above=40 (stage-only). Keep both.

16. PLAYER_R name. engine=PLAYER_HIT_R; systems=PLAYER_R. → PLAYER_R=2.4 canonical; engine references PLAYER_R.

17. fx wrapper names. stage=screenFlash/slowmo/shake/spawnDeathPuff/cancelBullets/banner; render=Render.flash/slowmo/shake/cancelWave/popText/banner. → adapter fns map stage names→Render.* (see publicApiTable). cancelBullets lives on bullets/stage side (clears pool + Render.cancelWave + items).

18. Items mover double-update. systems.updateItems integrates gravity/magnet; engine slot 7 says items[i].update. → systems.updateItems is the sole mover; engine slot only swap-removes dead/off-bottom items (don't move them twice).

19. Conductor card descriptor vs stage phase descriptor. makeSpell{name,hp,timeLimit,bonus,update,onStart,onEnd} vs stage phase {name,hp,survival,bonus,border}. → Unify to {name,hp,timeLimit/survival,bonus,update(boss,t,dt),onStart,onEnd,border}; survival===timeLimit for survival cards; boss.invuln=true during survival, phase ends on timer.

20. graze flag reset on pool reuse. systems sets b.grazed=true; needs reset on recycle. → spawnBullet canonical stamp sets grazed=false every spawn (engine's spawn-resets-full-shape rule covers it).

## Build Checklist
ASSEMBLY CHECKLIST for the single HTML file (do in order; check each off).

[ ] 0. Skeleton: <!doctype html>, <meta viewport>, <style> (canvas letterbox CSS, body bg, no-scroll, -webkit-tap-highlight-color:transparent), single <canvas id=game>, then ONE <script>.

[ ] 1. CONSTANTS block FIRST — paste the single authoritative table from finalConstants. Delete every duplicate `const PF_W=...`/`TAU`/`STEP` the individual specs re-declare. Item kinds as STRINGS; ITEM_HUE keyed by string.

[ ] 2. ENGINE: rng(mulberry32, seeded DEFAULT_SEED, window.rng) → math helpers (clamp/lerp/approach/dist2/hypot/normalizeAngle/angleTo/angleDiff/swapRemove/polarVel) → makePool with aliases (spawn/alloc/forEach/list) → enemyBullets(8192)/playerShots(1024)/particles(4096) with monomorphic factory stamping FULL canonical shape (incl. grazed,fade,update,custom,delay,turn,turnAbs,speed2,bounces,fired,phase,age,life,kind) → spawnBullet(o)/spawnShot/spawnParticle(x,y,vx,vy,opts) → window.T → collision fns (collidePlayerBullets/collideShotsEnemies/collidePlayerEnemies/collidePlayerItems) reading shot.dmg → integrateBullets/Shots/Particles → main-loop driver (DON'T start). USE_GRID=false.

[ ] 3. AUDIO: window.Audio module (lazy ctx, masterGain→limiter→destination, suspend-mute, localStorage bh.muted/bh.vol, lookahead BGM pump, all sfx*). Then the `sfx` shim object mapping systems method-names→Audio.*. Confirm Audio.unlock idempotent.

[ ] 4. RENDER: PALETTE consts (exact hex) → Render.init/resize (setTransform dpr cap 2, letterbox, PF clip) → sprite caches getBulletSprite(style,hue 10°bucket)/getPlayerShotSprite → cam/petals(seeded from rng)/pops/banner → setters flash/shake/cancelWave/slowmo/popText/banner → Render.frame(now,alpha) with the 14-slot draw order. Reads game.*/player.*/pools directly. Hitbox dot drawn at PLAYER_R scale, reads player.invuln for blink, player.options[].x/.y, b.fade+spawn-fade for bullet alpha. drawEnemies hook optional.

[ ] 5. PATTERNS: helpers (polarVel/hueShift/layerHue/angleToPlayer reading player.x/.y) → all 16+ pat.* emitting only the 7 canonical style ids via spawnBullet(o) → the 3 custom updates (_updBounce/_updGhost/_updCurve) all set custom=true and fully integrate → bare-name adapters (aimedShot/ring/spiral/fan/wall/burst/rain→pat.*) → makeSpell/every/phase helpers (demoted, cadence-only).

[ ] 6. SYSTEMS: build game object (state+paused+score/hi/lives/bombs/power/graze/boss/spellIntensity/flash/fullpower) → player struct (x,y,focus,power,options[{x,y}],dead,invuln,itemR,state) → input keymap + attachInput(window) (preventDefault GAME_KEYS, install Audio.unlock on first keydown, fold ShiftRight→ShiftLeft/KeyP→Escape) + keyHeld/keyEdge → initGameSystems (load hi-score danmaku_hiscore_v1) → playerUpdate/playerFire(spawnShot, sets shot.dmg/style/hue)/tryBomb/doBomb/onPlayerHit(bullet,enemy)/finalizeDeath/addInvuln → scoring (addScore/onGraze/addGraze/grantExtend/onSpellCaptured) → items (spawnItem string-kind/dropItems/collectItem, updateItems sole mover) → power (addPower/shotLevel/optionCount/layoutOptions writing options[].x/.y) → FSM setState (syncs game.paused) /startGame(→startStage)/togglePause/onStageClear/getHUD → DEFINE engine hooks: onGraze, onPlayerHit, onItemPickup=collectItem.

[ ] 7. STAGE/ENEMIES: Director (coroutine stack, fork-by-!owner.dead, kill, update once/step, clear) → spawnEnemy(e.dead canonical) → moveTo/moveBezier/holdFire/exitOff → waves → makeBoss(.phases/.phaseTotal/.phaseIndex/.invuln/.survivalEndsAt)/runBoss/bossPhase → damageEnemy(e,amt,fromBomb) + onEnemyHit(e,shot,dmg)=>damageEnemy(e,dmg,false) → cancelBullets({all,x,y,radius,frac,toItems})→clears enemyBullets + Render.cancelWave + dropItem point items → dropItem(x,y,type)→spawnItem(type,x,y,...) → fx adapters (screenFlash/slowmo/shake/spawnDeathPuff/banner→Render.*) → drawEnemies(ctx,T,alpha) hook → startStage/abortStage/tickStage=Director.update → stageScript() generator (intro→6 waves→midboss→calm→final boss 6 phases→defeat). Wire music: playMusic('stage') on stage start, sfxBossWarn+playMusic('boss') on boss warn, playMusic('stage'/'none') on clear.

[ ] 8. const BOSS={update:null} (Director drives phases; engine slot 3 calls only if non-null).

[ ] 9. simStep(STEP) wiring — exact order: T+=STEP (top) → handleInput → updateGameSystems → Director.update → enemyIntegrate(!steered)+swap-remove dead → integrateBullets/Shots/Particles → updateItems already moved (engine just despawns) → collision (shots-enemies, player-bullets+graze, player-enemies, player-items) → compact 3 pools. Render decoupled: acc+=rawDt*Render.timeScale, run ≤MAX_STEPS steps, renderAlpha=acc/STEP, Render.frame(now,renderAlpha). game.paused freezes accumulation, still Render.frame(now,1).

[ ] 10. BOOT (last): create canvas, Render.init(canvas), initGameSystems(), attachInput(window), setState(STATE.TITLE), startEngine(). visibilitychange→Audio.suspendForHidden/resumeFromHidden. 'M' key→Audio.toggleMute.

[ ] 11. AUDIO UNLOCK verify: first Enter keydown calls Audio.unlock() BEFORE first playMusic('stage'); pre-unlock playMusic remembered in curTrack; pre-unlock sfx dropped (correct).

[ ] 12. VERIFY (open in browser per global note #19, server bound 0.0.0.0:8000 — `python -m http.server 8000 --bind 0.0.0.0`): TITLE/PAUSE/GAMEOVER/STAGECLEAR overlays (state-branched), focus reveals hitbox dot at PLAYER_R, graze pops, bullet curtain reads above ship, boss aura+HP bar+pips, spell banner cut-in, bomb flash+cancelWave, no console errors (all engine hooks defined: onPlayerHit/onGraze/onEnemyHit/onItemPickup), thousands of bullets hold 60fps.
