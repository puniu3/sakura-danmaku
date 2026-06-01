# Audio subsystem: lazy Web Audio SFX + procedural BGM (stage/boss), brick-wall limited, suspend-mute

## Overview
Self-contained audio module exposing a single global `Audio` object. Hard-won constraints baked in:

- LAZY context: `let ctx = null`. The `AudioContext` is created only inside `unlock()`, which must be called from a real user gesture (keydown/pointerdown). Nothing touches `ctx` before that; every `sfxX()` and the scheduler no-op silently if `ctx` is null, so calling SFX before unlock never throws and never creates a suspended-at-load context.
- GRAPH: every voice/cue routes its own `GainNode` -> `masterGain` -> `limiter` (DynamicsCompressorNode configured as a brick-wall: threshold -6, ratio 20, knee 0, attack 0.003, release 0.1) -> `destination`. Per-cue gains are never scaled to "avoid clipping" — the limiter is the clip guard, so stacked win-fanfare oscillators and overlapping cues (e.g. itemGet during spellDeclare) sum safely.
- MUTE = `ctx.suspend()` / `ctx.resume()`, NOT gain=0, so already-scheduled oscillator tails freeze instantly instead of decaying audibly after the mute press. Mute state persists in `localStorage` under `bh.muted` and is re-applied on the first `unlock()`.
- SFX are fully procedural: short oscillator/noise voices with envelope helpers. Each schedules its own nodes and self-disconnects on `onended`, so nothing accumulates. A small per-cue rate-limiter (sfxShoot especially) prevents voice spam when the player holds Z.
- BGM is a lookahead scheduler: a `setTimeout(..., 25)` pump that schedules every note whose time is within `T_now + SCHEDULE_AHEAD (0.1s)` using sample-accurate `osc.start(when)` / `.stop(when)`. Two themes (gentle anime stage: lead arp + bass + soft saw pad + light hat/kick; more intense boss: faster arp, driving bass, brighter pad, kick+snare backbeat). `playMusic('stage'|'boss'|'none')` does a short gain crossfade-out of the current music bus before swapping the pattern, so transitions aren't hard cuts.

Two music buses (`musicGainA`/`musicGainB`)? — kept simple: a single `musicGain` with a scheduled fade; the lookahead loop reads the active track descriptor, so switching is just "fade musicGain to 0 over ~0.18s, then on the next pump start emitting the new track and fade back up." This avoids dangling oscillators from the old track since each note is short and self-terminating.

Design decisions: all timing is in AudioContext time (`ctx.currentTime`), independent of the game's fixed-timestep sim clock T — audio must not stutter when the sim hitches. Tempo/notes are data tables (`STAGE_TRACK`, `BOSS_TRACK`) so re-theming is a table edit. A seeded-ish but here just `Math.random`-based slight detune gives SFX life without needing the game's `rng` (kept decoupled so audio has zero gameplay-determinism impact).

## Public API
Single global object `Audio` (attach to window). Signatures:

Audio.unlock() -> void
  Call once from the first user gesture (keydown/pointerdown/Enter on title). Creates ctx+graph if absent, resumes it, re-applies persisted mute, and (if not muted) lets music play. Idempotent.

Audio.isReady() -> bool
  True once ctx exists (i.e. unlock() has run at least once).

Audio.toggleMute() -> bool
  Flip mute. Suspends or resumes ctx, persists to localStorage, returns the NEW muted state (true=muted).

Audio.setMuted(m) -> void
  Force mute state to bool m (used to sync a HUD toggle/localStorage at boot).

Audio.isMuted() -> bool
  Current mute state (valid even before unlock — read from localStorage).

Audio.setMasterVolume(v) -> void / Audio.getMasterVolume() -> number
  0..1 user volume (multiplies into masterGain). Persisted under bh.vol.

SFX (all no-op if !ctx; all safe to spam):
  Audio.sfxShoot()        soft pluck/tick, +-pitch variance, rate-limited
  Audio.sfxEnemyHit()     short dull tick
  Audio.sfxEnemyDeath()   filtered noise burst + falling tone
  Audio.sfxGraze()        bright short blip
  Audio.sfxBomb()         downward sweep + noise wash
  Audio.sfxPlayerDeath()  low boom + descending detuned tone
  Audio.sfxSpellDeclare() bright minor-chord stab + shimmer
  Audio.sfxItemGet()      coin/up-blip (two quick rising notes)
  Audio.sfxExtend()       1-up jingle (4-note arpeggio)
  Audio.sfxBossWarn()     two-tone alarm (repeat-ish)

MUSIC:
  Audio.playMusic('stage'|'boss'|'none') -> void
    Crossfade-out current, switch active track table, fade back in. 'none' fades out and stops the scheduler pump.
  Audio.getMusic() -> 'stage'|'boss'|'none'

Audio.suspendForHidden() / Audio.resumeFromHidden() -> void
  Optional hooks for document visibilitychange (pause audio when tab hidden) WITHOUT touching the user mute flag.

## Constants
// Graph / limiter
MASTER_BASE_GAIN = 0.42          // headroom below the limiter
LIMITER = { threshold:-6, knee:0, ratio:20, attack:0.003, release:0.1 }

// Scheduler
SCHEDULE_AHEAD = 0.10            // seconds of notes to schedule each pump
PUMP_MS = 25                    // setTimeout interval for the lookahead pump
MUSIC_FADE = 0.18              // seconds for crossfade between tracks
MUSIC_GAIN_STAGE = 0.55         // music bus target gain, stage
MUSIC_GAIN_BOSS  = 0.62         // music bus target gain, boss

// Tempo (seconds per 16th step)
STAGE_BPM = 96   -> step16 = 60/STAGE_BPM/4  ~= 0.15625 s
BOSS_BPM  = 138  -> step16 = 60/BOSS_BPM/4   ~= 0.10870 s

// SFX rate limit
SHOOT_MIN_GAP = 0.045           // s; player can hold Z, cap voices ~22/s

// localStorage keys
LS_MUTE = 'bh.muted'   LS_VOL = 'bh.vol'

// Musical material (MIDI note numbers -> Hz via 440*2^((n-69)/12))
// Stage: A-minor pentatonic-ish, gentle. Lead arp notes, bass roots, pad triads.
// Boss:  A-minor harmonic, faster, darker. See tables in code.
// Hi-hat = highpassed white noise ~7kHz, very short. Kick = sine 120->45Hz pitch drop.
// Snare = noise burst + 180Hz body.

## Integration Notes
WIRING (who calls what, and ordering):

1) UNLOCK on first gesture. In the input subsystem's first keydown/pointerdown handler (e.g. the title screen's Enter-to-start, or any global `keydown` once), call `Audio.unlock()`. Do it BEFORE the first `playMusic` so the ctx exists. Safe to call every keydown — it's idempotent. Recommended: a one-time global listener installed at boot:
   addEventListener('keydown', function once(e){ Audio.unlock(); }, {once:false});
   (left non-once so a browser that ignored the first resume retries; the function is cheap when ctx already running.)

2) MUSIC state transitions, driven by the game state machine (`game`):
   - Enter STAGE / waves        -> Audio.playMusic('stage')
   - Boss warn flash begins      -> Audio.sfxBossWarn()  then  Audio.playMusic('boss')
   - Boss defeated / stage clear -> Audio.playMusic('stage')  (or 'none' on results screen)
   - Pause (Esc/P)               -> nothing needed for music (the pump keeps running but you may call Audio.suspendForHidden()-style pause; simplest: leave music playing during pause, or add a dedicated pauseMusic by calling ctx.suspend() — but that also kills SFX. Recommended: leave running.)
   - Game over / title           -> Audio.playMusic('none')
   `playMusic` is decoupled from the sim clock T; it uses ctx.currentTime, so a paused sim does not desync the BGM. If you DO want music to freeze on pause, route it through the mute/suspend path instead.

3) SFX call sites (sensible names from the contract's singletons):
   - Player firing (playerShots spawn, in the shoot cadence gate): Audio.sfxShoot(). The module self-rate-limits to ~22/s, so calling it every spawned shot frame is fine; you do NOT need to gate it yourself.
   - Enemy takes damage (in the playerShots-vs-enemies collision when hp survives): Audio.sfxEnemyHit().
   - Enemy hp<=0 / removed from `enemies` (swap-remove): Audio.sfxEnemyDeath().
   - Graze detection (bullet within graze radius ~14 of player, first-touch flag set on the bullet): Audio.sfxGraze(). Gate on the per-bullet "grazed" flag you already set so it fires once per bullet, not every frame.
   - Bomb activated (X, on the frame the bomb fires, not per damage tick): Audio.sfxBomb().
   - Player hit (player hit radius ~2.4 collision -> life lost): Audio.sfxPlayerDeath().
   - Spell card declared (boss enters a named phase): Audio.sfxSpellDeclare(). Pair with playMusic('boss') already active.
   - Item pickup (point/power item collected from `items`): Audio.sfxItemGet().
   - Extra life threshold crossed: Audio.sfxExtend().

4) STACKING is safe by design: spellDeclare (8 voices) overlapping itemGet/extend, or a bomb over enemyDeath bursts, all sum through `masterGain` (base 0.42 * userVol) into the brick-wall limiter (-6/20/knee0/3ms/100ms). Do NOT lower individual sfx peaks to "make room" — that defeats the limiter and dulls quiet moments. If overall loudness feels low, raise MASTER_BASE_GAIN, not per-cue gains.

5) MUTE: wire the HUD mute toggle / an 'M' key to `Audio.toggleMute()`; render the icon from `Audio.isMuted()`. Mute calls ctx.suspend(), which freezes ALL scheduled tails instantly (the whole point). On boot, the persisted mute is read from localStorage before ctx exists, so `Audio.isMuted()` is correct for the initial HUD icon; the actual suspend is applied inside the first `unlock()`.

6) VOLUME: optional slider -> `Audio.setMasterVolume(0..1)`; persisted. Multiplies the base headroom.

7) VISIBILITY (recommended): 
   document.addEventListener('visibilitychange', function(){
     if (document.hidden) Audio.suspendForHidden(); else Audio.resumeFromHidden();
   });
   This pauses audio when the tab is backgrounded WITHOUT flipping the user mute flag, and respects an explicit mute (won't resume if muted).

8) GLOBAL NAME COLLISION: the module does `window.Audio = Audio`, shadowing the built-in `HTMLAudioElement` constructor (`new Audio()`). The game uses only Web Audio, so this is intentional and harmless. If any other subsystem or library needs the legacy constructor, rename this module's export to `window.GameAudio` and update the ~12 call sites — purely mechanical. The internal references use the closure variable, not window.Audio, so renaming only affects external callers.

9) PERF: SFX voices and BGM notes are one-shot and self-disconnect on `onended`, so there is no node accumulation even across thousands of shots — only the shared `noiseBuf` and the fixed graph persist. The scheduler is a single setTimeout pump (25ms), independent of the rAF render loop and the fixed-timestep sim, so audio never stutters when the bullet update spikes. No coupling to `rng` (audio uses Math.random for detune) so audio has zero effect on gameplay determinism/replays.

10) ORDERING GOTCHA: call `Audio.unlock()` at least once before the FIRST `playMusic`/sfx that you actually want heard. If `playMusic('stage')` is called pre-unlock, the module remembers the request in `curTrack` and starts it inside `unlock()` — so a pre-unlock playMusic is fine, but pre-unlock SFX are dropped (no ctx yet), which is correct since there's been no user gesture.
