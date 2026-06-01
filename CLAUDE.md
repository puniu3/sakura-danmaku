# CLAUDE.md — 桜花弾幕 / Sakura Danmaku

Working notes for coding sessions on this repo. Read this before editing; it captures the
non-obvious architecture and the rules that keep the single-file game coherent.

## What this is

A Touhou-style vertical bullet-hell shmup shipped as **one file: `index.html`** (~1,300 lines,
one `<script>`). Canvas2D rendering, fully procedural Web Audio (SFX + 3-track BGM), **no assets,
no build step to play**. It was assembled from six independently-designed subsystems (engine,
patterns, stage, systems, visual, audio) that were then reconciled — see
`design/RECONCILIATION.md`. This project is a tech demo of Opus 4.8 "ultracode"; the methodology
(design-in-isolation → reconcile → assemble) is described in `README.md`.

## Golden rules

1. **`index.html` is the live artifact. Edit it directly for game logic.** It was *assembled* from
   `design/*.code.js`, but those sources are **superseded provenance** — they each re-declare
   conflicting constants/signatures/field-names and are NOT spliced back in. Never copy code from
   `design/*.code.js` into `index.html`. When a value is contested, `design/RECONCILIATION.md` is
   the source of truth for the canonical resolved form.
2. **Never hand-edit the inlined BGM block** in `index.html` (the region after
   `// ---- BGM ENGINE (generated …) ----`, ~L261–L818). It is generated from
   `design/bgm-engine.js` + `design/bgm-tracks.js`. Edit those and rebuild (see *BGM pipeline*).
   ⚠️ But note the integration script's anchors are currently stale — read that section before
   relying on it.
3. **Determinism is a design goal but not fully achieved.** Sim runs at a fixed `STEP = 1/120`s
   with a seeded `rng` (mulberry32, `DEFAULT_SEED`). Some effects still use `Math.random()`
   (camera shake, audio detune). `simStep` always receives `STEP`, never wall-dt.
4. **Verify UI/visual changes in a browser** (Playwright MCP is available) — see global notes #19.
   When you can't predict the rendered result, open it and look.

## File map

| Path | Role |
| --- | --- |
| `index.html` | **The whole game.** The only file that ships/runs. |
| `design/RECONCILIATION.md` | Master integration spec: authoritative constant table, 20 conflict resolutions, ownership model, load/init/per-step ordering, assembly checklist. **Consult before changing constants.** |
| `design/{engine,patterns,stage,systems,visual,audio}.code.js` | The 6 subsystem reference implementations. Superseded provenance — read for intent, don't copy into `index.html`. |
| `design/*.notes.md` | Design rationale + public-API contracts for each subsystem. |
| `design/bgm-tracks.js` | **Source of truth for the music data** (3 tracks: stage/midboss/boss). Pure data + music-theory builders; runs in Node to self-validate. |
| `design/bgm-engine.js` | Source for the procedural BGM playback engine (compile + scheduler). Assumes host scope provides `ctx, musicGain, mtof, tone, noise, now`. |
| `design/bgm-demo.tpl.html` | Template for the standalone audition harness. |
| `design/build-bgm.js` | Inlines engine+tracks into the template → writes `bgm-demo.html` (audition). |
| `design/integrate-game.js` | Splices engine+tracks into `index.html` (see caveat below). Writes `design/index.html.bak` first. |
| `design/test-bgm-unlock.js` | Regression test for the "holding shoot restarts the BGM" bug. |
| `design/index.html.bak` | Pre-integration backup (gitignored). Not a canonical source. |
| `bgm-demo.html` | Generated audition harness (gitignored-ish; regenerate with `build-bgm.js`). Currently absent. |
| `720hz.txt` | A *pending, not-yet-implemented* proposal to move the sim to a 720 Hz timestep. |

## `index.html` architecture

Single `<script>`, sectioned by banner comments (line numbers approximate — they drift):

| ~Line | Section | Contents |
| --- | --- | --- |
| L26 | **CONSTANTS** | The single source of truth for all tuning. `STEP=1/120`, `MAX_STEPS=8`, pool caps, player/score/item constants. |
| L69 | **ENGINE CORE** | math (L70) · seeded RNG `makeRng`/`rng` (L83) · generic `makePool` dense-prefix pool (L98) · canonical `spawnBullet`/`spawnShot`/`spawnParticle` (L127) · `integrate*` (L152) · `collide*` (L175) · FPS + **`simStep`/`frame`** main loop (L197). |
| L236 | **AUDIO** | IIFE → script-scoped `const Audio` (shadows native `window.Audio`). Lazy `AudioContext` on first gesture. **Inlined/generated BGM engine + track data** (L261–L818). `sfx` facade after. |
| L830 | **RENDER** | `Render` object, pre-baked bullet sprite cache (L862), background/petals, boss/banner, particles, screen-FX `cam`, HUD, overlays, `RenderFrame` master draw (L962). |
| L973 | **PATTERNS** | Low-level `pat.*` emitter library + stage-vocabulary adapters (L999) mapping friendly names (`ring`/`spiral`/`fan`/…) onto `pat.*`. |
| L1009 | **SYSTEMS** | Input (edge-triggered), player struct, fire/power leveling, bombs, death + deathbomb, scoring/extends, item economy, FSM (`setState`/`startGame`). |
| L1119 | **STAGE / ENEMIES** | `Director` coroutine scheduler (L1140), wait/movement/firing/wave helpers, boss phase machine (L1189), and `stageScript()` — the whole Stage-1 timeline (L1213). |
| L1252 | **BOOT** | `boot()` IIFE: `Render.init` → `initGameSystems` → `attachInput` → `setState(TITLE)` → `requestAnimationFrame(frame)`. |

### Core loop
`frame(nowMs)` is the rAF driver: clamps `dt` to `MAX_FRAME_DT`, scales by `Render.timeScale`
(slow-mo), accumulates, runs `simStep(STEP)` up to `MAX_STEPS=8` times (spiral-of-death guard),
then renders with `alpha = acc/STEP` for sub-step interpolation. `simStep` advances global sim
clock `T += STEP` **at the top**, then: input → `updateGameSystems` → (if PLAYING) `Director.update`
→ enemy integrate → bullets/shots → collisions → particles → **compact pools last** (so a bullet
killed this tick is still collidable this tick).

### Ownership model (who owns what — from RECONCILIATION.md)
- **engine** — pools, `T`, collision passes, the sim step.
- **systems** — `player` struct, `game`/FSM (`STATE.{TITLE,PLAYING,PAUSED,GAMEOVER,STAGECLEAR}`),
  scoring, items, power, bombs, input.
- **stage** — the `Director` (generator-coroutine scheduler) as the **sole** timeline driver,
  including boss phases; `damageEnemy`.
- **visual** — screen FX (`cam`: shake/flash/slow-mo) + the back-to-front draw order.
- **patterns** — the `spawnBullet(o)` single-object shape + the canonical bullet style ids.
- **audio** — decoupled module reached via a thin `sfx` shim.

State is shared via globals (`game`, `player`, `enemyBullets`, `playerShots`, `enemies`, `items`,
`particles`, `rng`, `T`).

### Conventions that bite (verify before editing)
- **`Director`** runs JS generators; a coro `yield`s a number (sleep seconds) or `undefined` (one
  tick). Sleeps have no overshoot. `fork(gen, owner)` auto-kills when `owner.dead`. `beginGroup`/
  `endGroup` tag emitters with an epoch so a boss phase can tear all of them down at once.
- **Movement coros must set `e._steered = true`** each tick they write `x/y`, or `enemyIntegrate`
  double-moves the enemy (coro displacement + `vx/vy`).
- **Bosses are never auto-killed.** `damageEnemy` only decrements `boss.hp`; `runPhase` watches hp
  / survival timer; removal happens in `bossDefeat`. Auto-kill at `hp<=0` is gated on non-boss.
- **Enemy "dead" is `e.dead`** (not `e.alive`).
- **`keyEdge(code)` is consuming** — first reader per step gets `true`. `Math.random` vs `rng`:
  keep gameplay randomness on `rng`.
- **Pool caps are soft** — `makePool` grows its backing array on exhaustion; the `CAP` constants
  are initial sizes, not hard limits.

## BGM pipeline

Music is authored as data and synthesised; there are no audio files. Intended workflow:

```bash
# 1. Edit the music
#    design/bgm-tracks.js   (notes / chords / arrangement — the "art")
#    design/bgm-engine.js   (synth + scheduler — rarely)

node design/bgm-tracks.js      # 2. validate: lane lengths + in-key (exits non-zero on error)
node design/build-bgm.js       # 3. rebuild bgm-demo.html (the audition harness)
# open bgm-demo.html to A/B listen   (serve, then http://<LAN-IP>:8000/bgm-demo.html)

node design/integrate-game.js  # 4. splice into index.html  ⚠️ SEE CAVEAT
node design/test-bgm-unlock.js # 5. regression-test the transport state machine
```

⚠️ **`integrate-game.js` anchors are currently stale.** It splices on the unique text
`  const STAGE_TRACK={`, which existed in the *old* (pre-multi-section) `index.html` but is **gone
from the current file** (the present BGM is already the multi-section build). Re-running it as-is
throws `start anchor not found`. It was a one-shot migration tool. To push a *new* track edit into
`index.html` today you must either: (a) update the start/end anchors in `integrate-game.js` to
bracket the current generated region (between the `// ---- BGM ENGINE (generated …) ----` marker
and the transport functions), or (b) re-integrate from a pre-multi-section base. The **audition
path (`build-bgm.js` → `bgm-demo.html`) is unaffected** and is the right place to iterate on the
music itself. Both build scripts cut the Node-only validation tail at the
`// ---- … validation (Node only)` marker — don't rename it.

`test-bgm-unlock.js` parses transport functions out of `index.html` with a regex that assumes each
is a **single-line definition** (`startPump`/`stopPump`/`rampMusic`/`playMusic`/`applyMuteToCtx`/
`unlock`). Keep them one-liners or the test throws "function not found".

## Dev / preview (this machine)

Per the global notes: this WSL box is reached from an iPad over SSH, so bind dev servers to all
interfaces on port 8000 and hand over the LAN URL:

```bash
python -m http.server 8000 --bind 0.0.0.0    # then http://<LAN-IP>:8000/index.html
```

`hostname -I` lists candidate IPs (the `192.168.x.x` LAN address usually works). Playwright MCP is
available machine-wide for self-verifying visual changes.

## Pending / proposed (not implemented)

- **720 Hz fixed timestep** (`720hz.txt`): proposal to raise the sim tick from `1/120` to 720 Hz,
  with `frame` running an integer number of `simStep`s from elapsed time + carried fractional
  remainder, and normalising elapsed-time-dependent mechanics (e.g. graze). Goal: identical 60 Hz
  behaviour, no perf regression. **Current reality: `STEP = 1/120` (L32).** The `720` literals
  already in the file (`SHOT_SPEED=720`, an audio filter freq) are unrelated.
