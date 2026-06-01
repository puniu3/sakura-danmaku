# Player / Game Systems / UX State subsystem

## Overview
This subsystem owns everything between raw input and the rest of the danmaku sim: the player avatar, scoring economy, item economy, bomb/death/i-frame lifecycle, and the top-level game state machine (TITLE/PLAYING/PAUSED/GAMEOVER/STAGECLEAR). It is the "glue" layer — the other five subsystems (bullet pools, enemies/boss, particles, audio, render/HUD) are called by it through a thin documented API (sfx.*, render flash hook, enemy damage, particle spawners).

Key design decisions:
- All gameplay math is fixed-step (STEP=1/120s, update(dt) in seconds, angles radians clockwise, +y down) exactly per contract. Nothing here reads wall-clock time except hi-score persistence and the title attract clock.
- Input is sampled into a flat keymap with edge-trigger helpers. update() reads the keymap; nothing else touches the DOM event layer. preventDefault on game keys stops the iPad/desktop page from scrolling. We keep BOTH a held-state map (for move/fire) and a per-step "pressed this step" set (for bomb/pause/confirm edges), and we recompute edges once per sim step so a 120Hz sim never misses or double-fires a keypress that happened between steps.
- The player is a small struct, not a class, to match the pooled-object style; its lifecycle states (ALIVE / DEAD-respawning / bombing / invuln) are timers on that struct, advanced in playerUpdate(dt).
- POWER is the master progression axis (0..MAXPOWER=400, displayed as 0.00–4.00). Fire pattern, stream count, and option bits all derive from a small set of power breakpoints so leveling is data-driven and easy to retune.
- Bomb does four things atomically: deathbomb-or-real distinction, full enemyBullet clear→sparkle conversion, ~2.5s invuln, and a damage-over-time field on the boss; the screen flash is a hook the render subsystem reads.
- Death has an 8-frame (≈0.0667s) deathbomb grace: the hit is recorded as "pending death" and only finalized if X wasn't pressed within the window; otherwise it converts to a bomb retroactively. This is the canonical Touhou feel.
- Scoring: graze (small flat + builds a graze counter that feeds point-item value), point items whose value scales with collection Y (higher = worth more, capped at the Point-of-Collection line where they're worth max), spell-capture bonus pushed by the boss subsystem, and extends at score thresholds plus 1up items.
- Items have gravity, a top auto-collect line, and a magnet mode triggered either by full power or by the player crossing the Point-of-Collection (PoC) line. Collection is an animated fly-to-player with a small score pop.

Everything is allocation-light in the hot path: items use a plain array with swap-remove; the player is a singleton; bomb's bullet clear reuses the existing particle pool.

## Public API
// ---- lifecycle / loop ----
initGameSystems()            // build player singleton, load hi-score, reset HUD model. Call once at boot.
handleInput(dt)              // recompute per-step edge triggers from raw keymap. Call FIRST each sim step.
updateGameSystems(dt)        // master tick: dispatches by game.state; runs player, items, scoring decay, fsm timers.
playerUpdate(dt)             // ALIVE/DEAD/bomb/invuln timers + movement + auto-fire (called by updateGameSystems in PLAYING).
updateItems(dt)              // item gravity + auto-collect/magnet + collection -> scoring.

// ---- input (DOM side, attach once) ----
attachInput(targetEl)        // installs keydown/keyup; preventDefault on GAME_KEYS. targetEl defaults to window.
keyHeld(code)  -> bool       // is this key currently down (raw)
keyEdge(code)  -> bool       // was it pressed since last handleInput() (consumed-style edge)

// ---- player actions (also callable by debug) ----
playerFire(dt)               // hold-Z cadence + shot pattern by power; spawns into playerShots, muzzle particles.
tryBomb()      -> bool       // edge-trigger entry; returns true if a bomb actually fired.
doBomb(isDeathbomb)          // execute bomb effects (clear bullets, invuln, boss DoT, flash, sfx).
onPlayerHit(srcBullet)       // CALLED BY COLLISION subsystem when an enemyBullet/enemy overlaps player hitbox.
finalizeDeath()              // internal: spend life, drop items, respawn or -> GAMEOVER.
addInvuln(seconds)           // grant i-frames (max with current).

// ---- scoring ----
addScore(n)                  // add to score, check extends.
onGraze(bullet)              // CALLED BY COLLISION when bullet in graze ring but outside hit ring (once per bullet).
addGraze(n=1)                // bump graze counter + score + sfx.
grantExtend(reason)          // +1 life (capped), sfx, hud flash.
onSpellCaptured(bonus)       // CALLED BY BOSS subsystem on spell-card timeout/clear with capture flag.
saveHiScore()/loadHiScore()  // localStorage persistence.

// ---- items ----
spawnItem(kind,x,y,vx,vy)    // kind in ITEM.POWER/POINT/BIGPOWER/ONEUP/FULLPOWER/STAR; pushes to global items[].
dropItems(kind,count,x,y,spread) // burst of items (used on death + enemy death by enemy subsystem).
collectItem(it)              // apply item effect + score pop + sfx + particle.

// ---- power ----
addPower(p)                  // raise power, clamp MAXPOWER, fire "power up" feedback + maybe pattern change.
shotLevel()    -> int        // current discrete fire tier derived from player.power.

// ---- state machine ----
setState(s)                  // transition with enter/exit side-effects (TITLE/PLAYING/PAUSED/GAMEOVER/STAGECLEAR).
startGame()                  // TITLE -> PLAYING: reset run (score, lives, bombs, power, player).
togglePause()                // PLAYING <-> PAUSED.
onStageClear()               // CALLED BY STAGE/BOSS subsystem when final boss dies -> STAGECLEAR.
getHUD()       -> object     // returns the HUD data model the render subsystem reads each frame.

## Constants
// ---- playfield / player (contract) ----
PF_W=432, PF_H=576
PLAYER_R=2.4              // hit radius (tiny)
GRAZE_R=14               // graze ring radius
PLAYER_SPEED=200         // units/sec unfocused
PLAYER_FOCUS_MUL=0.45    // focus ~halves speed
PLAYER_MARGIN=10         // clamp inset from playfield edges
PLAYER_START={x:216,y:496}
// ---- fire ----
FIRE_CADENCE=0.055       // s between shot volleys when holding Z (~18/s)
SHOT_SPEED=720           // player bullet speed up the screen (vy negative)
SHOT_DMG=2               // damage per main shot bullet
OPTION_DMG=1.4
MUZZLE_PARTICLES=2
// ---- power tiers (power is 0..400, shown /100) ----
MAXPOWER=400
POWER_BREAKS=[0,40,80,150,200,300,400]   // tier thresholds
POWER_PER_ITEM=5         // small power item
POWER_PER_BIG=25         // bigpower item
// ---- bomb ----
START_BOMBS=3, MAX_BOMBS=8
BOMB_INVULN=2.5          // s
BOMB_BOSS_DPS=140        // damage/sec applied while bomb DoT field active
BOMB_DOT_TIME=2.2        // s of boss DoT
BOMB_FLASH=0.5           // render flash hook seconds
DEATHBOMB_FRAMES=8       // grace window (frames @120 -> 8/120 s)
DEATHBOMB_TIME=8/120     // 0.0667 s
// ---- death / respawn ----
START_LIVES=3, MAX_LIVES=9
RESPAWN_INVULN=3.0       // s i-frames after respawn
RESPAWN_BLINK=0.09       // s blink period
DEATH_CLEAR_R=64         // clear bullets within this radius on death
DEATH_POWER_DROP=8       // power items scattered on death (split)
// ---- scoring ----
GRAZE_SCORE=50
EXTEND_THRESHOLDS=[1e6, 3e6, 6e6, 1e7]   // score-based 1ups (each once)
POINT_BASE=10000         // value of a point item collected AT the PoC line / above auto-line
POINT_MIN=2000           // value when collected at the very bottom
SPELL_CAPTURE_BONUS=500000
// ---- items ----
ITEM_GRAV=120            // units/sec^2 downward
ITEM_TERMINAL=180        // max fall speed
ITEM_R=10                // collection radius vs player center
ITEM_MAGNET_ACC=900      // magnet accel toward player
ITEM_MAGNET_MAXSPD=520
AUTO_COLLECT_Y=64        // items above this line are auto-collected (sucked up)
POC_LINE_Y=140           // Point-of-Collection: player above this -> all items magnet + point items max value
ITEM_KIND={POWER:0,POINT:1,BIGPOWER:2,ONEUP:3,FULLPOWER:4,STAR:5}
// ---- item colors (hue used by render) ----
ITEM_HUE={0:15, 1:205, 2:15, 3:340, 4:280, 5:55}   // power=red,point=blue,big=red,1up=pink,full=violet,star=gold
// ---- fsm ----
STATE={TITLE:0,PLAYING:1,PAUSED:2,GAMEOVER:3,STAGECLEAR:4}
GAMEOVER_AUTORET=8.0     // s before GAMEOVER auto-returns to TITLE
// ---- input ----
GAME_KEYS=new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','KeyZ','KeyX','Escape','KeyP','Enter'])

## Integration Notes
LOOP ORDER (per sim step, inside the fixed-timestep accumulator):
1. handleInput(dt)            // promote latched key edges into this step
2. updateGameSystems(dt)      // dispatches by game.state; in PLAYING runs playerUpdate + updateItems + applyBossDot
3. [stage/wave subsystem] updateStage(dt) / spawn enemies — call AFTER player so this-step shots exist
4. [enemy/boss subsystem] update enemies + their bullet emitters
5. integrate enemyBullets, playerShots, particles (their own update)
6. COLLISION subsystem (see hooks below)
7. render reads getHUD() + draws

Call attachInput(window) once at boot, and initGameSystems() once. The DOM event layer is the ONLY place keys are read; everything else uses keyHeld/keyEdge/the move* helpers. preventDefault is applied to GAME_KEYS in both keydown/keyup so arrows/space-equivalents don't scroll the page (important for the iPad-over-SSH dev setup — page must not pan).

EDGE-TRIGGER CONTRACT: keyEdge(code) is CONSUMING — the first caller in a step that asks gets true, subsequent asks get false. Bomb (KeyX) and pause (Escape) are read via keyEdge inside playerUpdate so a single press = single action even at 120Hz. handleInput folds ShiftRight->ShiftLeft and KeyP->Escape so callers test one canonical code. If you add a UI that also wants the same edge in the same step, read it before playerUpdate or use keyHeld.

HOOKS THE COLLISION SUBSYSTEM MUST CALL (it knows geometry; we own consequences):
- onPlayerHit(bullet) when an enemyBullet OR enemy body overlaps the player hit circle (PLAYER_R). It self-guards on player.invuln and player.state, so collision may call it unconditionally on overlap. It starts the deathbomb grace; it does NOT immediately spend a life.
- onGraze(bullet) when a live enemyBullet is inside GRAZE_R but outside PLAYER_R AND bullet.grazed is falsy. We set bullet.grazed=true so reset it when the bullet is recycled by the pool (pool.spawn must clear grazed, or set b.grazed=false on alloc).
- For playerShots vs enemies, the enemy subsystem reads b.dmg off our shot objects (we set b.dmg, b.style 'main'|'option', b.hue) and calls its own damageEnemy(e,amount,fromBomb). We never decrement enemy HP directly except via applyBossDot which calls the global damageEnemy(e,amount,true).

HOOKS WE CALL ON OTHER SUBSYSTEMS (provide these or rename in one place):
- Pools: enemyBullets / playerShots expose .spawn() (returns a pooled obj), .forEach(cb), .clear(). If your pools use a different API, adapt fireShot()/clearBulletsToSparkles()/startGame(). playerShots.spawn() must zero/own the canonical fields; we set x,y,vx,vy,ax,ay,r,dmg,style,hue,alive,born.
- spawnParticle(x,y,vx,vy,life,style,hue): particle pool emitter. Styles used: 'muzzle','sparkle','death','graze','pickup'. If your particle API differs, wrap it.
- sfx.* (audio subsystem, all optional — every call is guard-checked with `sfx && sfx.x && sfx.x()`): shoot, bomb, deathbomb, death, graze, item(kind), powerup, extend, capture, start, pause, gameover, stageclear. Per global note #14/#15: audio context is lazily created on first user gesture — our first sfx call happens on a keypress (start/shoot), which satisfies autoplay policy.
- render.flash(seconds) optional; also game.flash (0..1) is decayed here each tick so a pure-data render can just read getHUD().flash and tint. Per note #7, render should drive the flash as a transition/opacity fade off game.flash, not a keyframe hold.
- Stage subsystem: startStage()/startStage already-named; we call startStage() in startGame(). Boss subsystem calls onStageClear() when the final boss dies, and onSpellCaptured(bonus) when a spell card ends with the capture flag (no death/no bomb during the card — the boss subsystem tracks that; we just award).
- damageEnemy(e,amount,fromBomb): enemy subsystem function used by applyBossDot for bomb DoT against e.isBoss enemies.

POWER / FIRE DEPENDENCIES: shotLevel()/optionCount() derive purely from player.power and POWER_BREAKS — retune patterns by editing those arrays only. layoutOptions() eases option offsets every player tick; render reads player.options[i].dx/dy for drawing the option bits. nearestEnemy() scans enemies[] (expects e.dead and e.x/e.y); cheap for a one-stage scope.

ITEM ECONOMY GOTCHAS:
- items[] is a plain global array; we swap-remove. dropItems is also called by the ENEMY subsystem on enemy death (power/point bursts) — same signature.
- Magnet turns on when game.fullpower OR player crosses above POC_LINE_Y (y<=140), matching Touhou PoC behavior; AUTO_COLLECT_Y (y<=64) sucks up any item that drifts to the top band regardless. Point-item value scales by collection Y via pointItemValue() and caps at POINT_BASE at/above the PoC line.
- collectItem requires player to be alive or in pendingdeath; dead/respawning players don't vacuum items (intentional — you "lose" items if you die in the burst).

DEATH/BOMB ORDERING: onPlayerHit -> state 'pendingdeath' for DEATHBOMB_TIME (8/120s). During that window playerUpdate checks keyEdge('KeyX'); if pressed AND bombs>0 it calls doBomb(true) and returns to 'alive'. Otherwise finalizeDeath() spends the life, drops power items, clears DEATH_CLEAR_R of bullets to sparkles, and either respawns (i-frames RESPAWN_INVULN with blink) or, at lives<0, sets STATE.GAMEOVER. doBomb clears ALL enemyBullets to score sparkles, grants 2.5s invuln, sets a 2.2s boss DoT field, and raises game.flash + render.flash. Because finalizeDeath also clears bullets locally, a player who whiffs the deathbomb still gets breathing room on respawn.

PERSISTENCE: hi-score in localStorage key 'danmaku_hiscore_v1', saved on GAMEOVER/STAGECLEAR enter and via saveHiScore(); loaded in initGameSystems. Wrapped in try/catch for private-mode browsers.

FSM: setState handles enter/exit side-effects; TITLE waits for Enter/Z -> startGame(); GAMEOVER auto-returns after GAMEOVER_AUTORET (8s) or Enter; PAUSED toggles on Escape/P. Render branches on getHUD().state for which screen to draw (note #19: verify TITLE/PAUSE/GAMEOVER overlays visually since they branch on state).
