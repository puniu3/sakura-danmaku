# Render / Visual Layer — Canvas2D danmaku renderer (sprite cache, background, particles, screen FX, boss, HUD)

## Overview
This is the entire Canvas2D presentation layer. It owns nothing about gameplay state — it READS the global singletons (player, enemyBullets, playerShots, enemies, particles, items, game) and DRAWS them. Sim never touches the canvas; render never mutates sim state except for two render-owned pools it manages itself (cherry petals and the screen-FX/camera struct).

KEY DESIGN DECISIONS:
1. PRE-RENDERED BULLET SPRITES. The single most important perf+look technique. Every bullet visual = a soft translucent colored radial-glow halo + a bright near-white core. Drawing that with a live radial gradient per bullet per frame is fatal at thousands of bullets. Instead getBulletSprite(style,hue) bakes the whole look into a tiny offscreen canvas ONCE per (style,hue) pair and caches it in a Map keyed by `style|hueBucket`. Hue is bucketed to 10° steps (36 buckets) so the cache stays ~8 styles × 36 = ~288 sprites max, each drawn thousands of times with a single ctx.drawImage. Sprites are drawn pre-multiplied with their glow already in the bitmap, so the bullet loop sets ctx.globalCompositeOperation='lighter' ONCE for the whole batch (the halo pixels are dark-on-transparent and add beautifully) — no per-bullet state churn. Rotating styles (kunai/star/scale/bolt) bake an UPRIGHT sprite and the loop rotates via setTransform.

2. EVERYTHING IS A FLAT BATCH with as few ctx state changes as possible. Draw order is fixed (see integrationNotes). Within the bullet batch we sort by nothing (order doesn't matter for additive glow) and never read back state. globalAlpha is the only per-bullet mutable (for spawn fade-in and cancel fade-out).

3. RESOLUTION. Logical canvas 640×576. Backing store = logical × devicePixelRatio (capped at 2 for perf). One root transform set in resize() via ctx.setTransform(dpr,0,0,dpr,0,0) establishes "logical pixels"; all draw code thinks in logical px. Playfield content is further translated by (PF_X, PF_Y) and clipped to the 432×576 playfield rect; HUD draws to the right in the 208-wide panel un-clipped.

4. PETALS are a render-only parallax system (3 depth layers) with their own pooled struct, updated from render dt (wall-clock-ish, paused with game) — purely decorative, seeded from rng so two runs match.

5. SCREEN FX via a single `cam` struct: trauma-based shake (trauma decays, shake = trauma²), white flash intensity, chromatic/cancel radial wave, and a slow-mo timeScale the LOOP reads. Render exposes setters the sim/event layer calls (Render.flash, Render.shake, Render.cancelWave, Render.slowmo).

6. BOSS gets a stylized procedural silhouette (no art assets): layered rotating auras (additive), a swirling spell-card background that darkens the playfield via a radial vortex + rotating spokes during spells, and a name-banner sweep animated by a render-owned timeline.

All color is from one PALETTE table (exact hex below). Additive ('lighter') is used for: all bullet glow, all particles, engine glow, boss aura, graze sparks, cancel wave, white flash — and is ALWAYS reset to 'source-over' at the end of each additive batch so nothing leaks.

## Public API
// ---- module-level constants (read by loop/other subsystems) ----
PF_W=432, PF_H=576, HUD_W=208, CANVAS_W=640, CANVAS_H=576, PF_X=0, PF_Y=0

// ---- lifecycle ----
Render.init(canvasEl)                  // grab ctx, build offscreen caches, seed petals, hook resize. Call once at boot.
Render.resize()                        // recompute dpr backing store + CSS letterbox scale. Call on window resize (auto-hooked).
Render.frame(now, alpha)               // THE draw entry. now=ms timestamp, alpha=[0,1] sim interpolation factor from the loop's accumulator. Draws one full frame. Does NOT advance sim.

// ---- sprite cache (also usable by other layers if they want the look) ----
getBulletSprite(style, hue) -> {canvas,cx,cy,rot}  // cached offscreen bitmap + its center + whether the loop should rotate it to bullet.dir
getPlayerShotSprite(kind, hue) -> canvas            // cached player-bullet bitmap

// ---- screen FX hooks (called by sim/event/collision layers) ----
Render.flash(intensity=1, hue=0)       // additive white(-ish) full-playfield flash, decays ~0.12s. bomb/boss-spawn.
Render.shake(amount=0.6)               // add trauma [0,1]; shake = trauma^2 * MAX_SHAKE px. clamps at 1.
Render.cancelWave(x,y,hue=200,strength=1) // expanding additive ring at playfield-local (x,y); for bomb / spell-clear bullet cancel.
Render.slowmo(scale=0.25, dur=0.5)     // request loop timeScale ramp (player-death hitstop). Loop reads Render.timeScale each frame.
Render.popText(x,y,text,hue=48)        // floating score/graze popup at playfield-local coords; render-owned, auto-expires.

// ---- state the loop reads ----
Render.timeScale     // number in (0,1]; loop multiplies its dt by this. 1 normally.
Render.fps           // smoothed fps for HUD/debug.

## Constants
// ===== EXACT PALETTE (hex) =====
// Sky / background
SKY_TOP      #ffd9ec  (pastel pink, drifts hue ±14° slowly)
SKY_MID      #cfe0ff  (periwinkle)
SKY_BOT      #bfeede  (mint)
CLOUD        rgba(255,255,255,0.42)
PETAL_LIGHT  #ffd5e6
PETAL_MID    #ffb3d1
PETAL_DEEP   #f58fb6
PETAL_EDGE   #ffe9f2  (rim highlight)
VIGNETTE     rgba(40,18,46,0.0 -> 0.55 at corners)
SCANLINE     rgba(0,0,0,0.05)
// Spell-card darken
SPELL_DARK   rgba(24,10,32,0.0 -> 0.62)
SPELL_SPOKE  rgba(180,120,255,0.10)
SPELL_VORTEX inner rgba(60,20,90,0.0) -> outer rgba(20,6,34,0.5)
// Player
SHIP_BODY    #f7fbff
SHIP_TRIM    #8fd0ff
ENGINE_GLOW  #6cf0ff  (additive)
HITBOX_RING  #ff3b6b  (focus reveal, additive core white #ffffff)
OPTION_BIT   #bff0ff
IFRAME_BLINK alpha pulse 0.35..1
// UI / HUD
HUD_BG       #160b22
HUD_PANEL    #241338
HUD_EDGE     #4b2d72
UI_TEXT      #ffe9fb
UI_DIM       #9d83c0
UI_GOLD      #ffd45e  (score / hi-score)
LIFE_ICON    #ff5d8f
BOMB_ICON    #74e0ff
POWER_FILL   #ffb347 -> #ffe08a (gradient)
POWER_BG     #2a1840
GRAZE_COLOR  #b9ff6a
// Boss
BOSS_BODY    #2a1030
BOSS_RIM     #ff7ae0
BOSS_AURA_A  #ff5ec4  (additive)
BOSS_AURA_B  #7a5cff  (additive)
HPBAR_FILL   #ff5e8a -> #ffd45e
HPBAR_BG     rgba(0,0,0,0.45)
TIMER_WARN   #ff4040  (countdown < 8s)
BANNER_FILL  rgba(20,6,34,0.78)
BANNER_TEXT  #ffe9fb

// ===== MAGIC NUMBERS =====
HUE_BUCKET      = 10      // deg, sprite-cache hue quantization (36 buckets)
DPR_CAP         = 2
MAX_SHAKE       = 11      // px at trauma=1
TRAUMA_DECAY    = 1.8     // /s
FLASH_DECAY     = 9.0     // /s (≈0.11s tail)
SPAWN_FADE      = 0.10    // s bullet alpha fade-in from born
PETAL_LAYERS    = [{n:14,scale:0.55,vy:18,sway:10,alpha:0.55},{n:18,scale:0.8,vy:34,sway:16,alpha:0.8},{n:12,scale:1.15,vy:58,sway:24,alpha:1.0}]
SPRITE_PAD      = 3       // px transparent pad around baked sprite so glow isn't clipped
GLOW_SOFTNESS   = 0.55    // inner-stop radius fraction for the halo gradient
CORE_FRACTION   = 0.42    // core radius / sprite radius
BULLET_SPRITE_PX_PER_UNIT = 2.0   // sprite baked at 2x bullet.r for crisp downscale
CANCEL_WAVE_SPEED = 520   // px/s ring expansion
CANCEL_WAVE_LIFE  = 0.6   // s
POPTEXT_LIFE      = 0.9   // s, rises 26px
BOSS_AURA_SPIN    = 0.6   // rad/s
BANNER_SWEEP      = 0.9   // s in, hold, out

## Integration Notes
HOOKING INTO THE LOOP
- Boot: call Render.init(canvasEl) once after the <canvas> exists.
- The main loop (fixed-timestep) calls Render.frame(now, alpha) ONCE per animation frame after running 0..N sim steps. `now` = the rAF timestamp (ms); `alpha` = accumulator/STEP in [0,1] for sub-step interpolation. frame() never advances the sim and never calls update().
- SLOW-MO: the loop must multiply its per-frame dt by Render.timeScale BEFORE feeding the accumulator (i.e. `acc += rawDt * Render.timeScale`). Render.slowmo(scale,dur) ramps timeScale down and back up; the loop reads Render.timeScale every frame. This is the player-death hitstop hook.
- Sim clock: render reads global `T` (window.T, seconds) for animation phases and bullet spawn-fade (age = T - bullet.born). If T isn't global, frame() falls back to now/1000 — but make T global per the contract for correct fade-in.

GLOBALS READ (per contract)
- player: {x,y,focus,iframe(seconds remaining),power,dead, options:[{x,y}...]}
- enemyBullets / playerShots: pools; render supports either `pool.items` (array) or the pool being a raw array. Bullet fields used: x,y,vx,vy,r,style,hue,alive,born; optional dir (rotation override), fade (cancel fade-out alpha). playerShots use {x,y,vx,vy,kind('needle'|'orb'),hue,alive}.
- particles: pool; fields {x,y,r,age,life,kind('spark'|'ring'|'sparkle'|'petalBurst'),hue,alive}. The sim/particle layer advances age; render only reads. (If your particle layer integrates motion itself, that's fine — render just draws current x,y.)
- items: array {x,y,kind('power'|'point'|'life'|'bomb'),alive}.
- game: {score,hi,lives,bombs,power,powerMax,graze,paused, boss, spellIntensity}. boss: {x,y,alive,hp,hpMax,phasesLeft,spellName,timer,inSpell}.
- rng: optional seeded rng with .next()->[0,1); petals use it so runs are deterministic. Falls back to Math.random.
- drawEnemies(ctx,T,alpha): OPTIONAL hook the enemy subsystem can define to draw non-boss enemies inside the shake-translated, clipped playfield. If absent it's skipped — render still draws boss + everything else.

CALLS OTHER SUBSYSTEMS MAKE INTO RENDER (event/collision/sim → render)
- On graze: Render.popText(b.x,b.y,'+1',95) and optionally a 'sparkle' particle (particle layer's job).
- On bomb fire: Render.flash(0.9,190); Render.shake(0.7); Render.cancelWave(player.x,player.y,200,1.4).
- On spell-card clear / bullet cancel: Render.cancelWave(boss.x,boss.y,hue,1.2) + Render.flash(0.5,hue).
- On boss spell start: Render.banner(name, subtitle) AND set game.boss.inSpell=true / game.spellIntensity ramps 0→1 (sim owns the ramp; render just multiplies the darken alpha by it). Render.flash(0.6, 300) for the cut-in pop.
- On player death: Render.slowmo(0.18,0.5); Render.shake(0.9); Render.flash(0.7,0).
- On enemy death: spawn 'petalBurst' particles + Render.popText(score). (Particle spawning is the particle subsystem's API, not render's.)

DRAW ORDER (back→front), all inside the playfield clip except HUD:
1 sky gradient + clouds  2 parallax petals  3 spell vortex/darken  4 items  5 player shots  6 boss body + drawEnemies hook  7 particles(additive)  8 ENEMY BULLET CURTAIN(additive, on top so curtains read clearly)  9 player ship + focus hitbox  10 cancel waves  11 score popups  12 spell-name banner  13 vignette+scanlines  14 HUD panel + boss HP bar overlay.
Rationale: bullets must sit ABOVE the player ship visually in Touhou (so you read the curtain), but the tiny player hitbox dot is drawn AFTER so it's never occluded. Particles below bullets so sparks don't wash the curtain; cancel waves/flash above bullets for impact.

PERF GOTCHAS
- The bullet batch is the hot loop. Non-rotating styles (orb/bigBall/ring/bubble) take the fast path: one setTransform per bullet is avoided by keeping a fixed base transform and using drawImage(x,y,w,h). Rotating styles (rice/kunai/star/scale/bolt) pay a setTransform+rotate; keep their share modest in pattern design. To squeeze more: bucket bullets by `spr.rot` and draw all non-rotating first under a single translate, then rotating — left as a micro-opt; current code already special-cases the two paths.
- globalCompositeOperation is set to 'lighter' ONCE per additive batch and reset to 'source-over' at batch end — never per bullet. globalAlpha is the only per-bullet mutable.
- Sprite cache is keyed (style,10°hue) → ~288 max bitmaps, each ≤ ~52px. Built lazily on first sighting; no per-frame allocation. If a pattern sweeps hue continuously, the 10° bucket prevents cache explosion.
- createRadialGradient/createLinearGradient appear in background, particles, items, player — these run a handful of times per frame (O(layers)), NOT per bullet. Bullets never create gradients at draw time (baked).
- dpr capped at 2: on a 3x phone the backing store stays ≤1280×1152, keeping fill cost sane while the CSS scale still fills the screen.

REDUCED-MOTION / TIMING
- Petals & clouds advance with render dt and freeze when game.paused (passed as dt*0). They are decorative; if you honor prefers-reduced-motion at the app level, gate petal/cloud motion but KEEP cancel waves / flashes (they convey state) per the global note about exempting meaningful flights.

THINGS RENDER DOES NOT OWN
- It does not move bullets, spawn particles, run collision, or manage lives. It reads. The only mutable render-owned state: cam (shake/flash/slowmo), waves[], pops[], petals[], _banner, and the two sprite caches. Clear nothing on turn-end — these self-expire — except if you reset a run you may want to call buildPetals() again for a clean deterministic field.
