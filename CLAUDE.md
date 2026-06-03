# CLAUDE.md — 桜花弾幕 / Sakura Danmaku

Working notes for coding sessions on this repo. Read this before editing; it captures the
non-obvious architecture and the rules that keep the single-file game coherent.

## What this is

A Touhou-style vertical bullet-hell shmup shipped as **one file: `index.html`** (~1,833 lines,
one `<script>`). Canvas2D rendering, fully procedural Web Audio (SFX + 3-track BGM), **no assets,
no build step to play**. Originally assembled from six reconciled subsystems (see
`design/RECONCILIATION.md` for the original assembly), it has since been refactored to a
**6-stage-ready architecture (V2, Phases 0–9 landed; see *V2 status & roadmap* below)**: registries
+ declarative stage data, while staying a single double-click-to-run file.

## Golden rules

1. **`index.html` is the live artifact. Edit it directly for game logic.** It was *assembled* from
   `design/*.code.js`; those are **superseded provenance** — never copy from them into `index.html`.
   `design/RECONCILIATION.md` holds the original resolved constant table (note: difficulty-scaled
   tuning now also lives in `BALANCE`, and per-phase numbers in the stage specs).
2. **Never hand-edit the generated BGM region** in `index.html` — the block between
   `/*BGM:GEN*/` and `/*END:BGM:GEN*/` (after the `// ---- BGM ENGINE (generated …) ----` marker).
   It is `design/bgm-engine.js` + `design/bgm-tracks.js`, re-inlined by `design/build-game.js`. The
   transport (`trackOf`/`pump`/`playMusic`/…) lives **outside** the anchors and is hand-written.
3. **Preserve behaviour with the structural-golden harness.** Any change meant to be
   behaviour-preserving MUST be checked against the golden — see *Verifying behaviour preservation*.
   Determinism is a design goal but not fully achieved: sim runs at fixed `STEP = 1/120`s with a
   seeded `rng` (mulberry32, `DEFAULT_SEED`); `Math.random()` still leaks in camera shake + audio
   detune (both inert headless, so the golden is deterministic). `simStep` always gets `STEP`.
4. **Verify UI/visual changes in a browser** (Playwright MCP is available) — see global notes #19.

## File map

| Path | Role |
| --- | --- |
| `index.html` | **The whole game.** The only file that ships/runs (itch.io = this 1 file). |
| `design/ARCHITECTURE-V2.md` | The V2 design + **forward roadmap** (debug-mode → 10 → 11 → 12 → 8). Read for what's next. |
| `design/RECONCILIATION.md` | Original assembly spec (constant table, ownership, ordering). Provenance. |
| `design/{engine,patterns,stage,systems,visual,audio}.code.js` | 6 subsystem reference impls. Superseded provenance — don't copy in. |
| `design/bgm-tracks.js` | **Source of truth for music data** (`TRACKS`: stage/midboss/boss). Self-validates in Node. |
| `design/bgm-engine.js` | Procedural BGM engine (compile + scheduler). Assumes host `ctx/musicGain/mtof/tone/noise/now`. |
| `design/build-bgm.js` → `bgm-demo.html` | Audition harness for the music itself (A/B listen). |
| `design/build-game.js` | **Re-inlines the `/*BGM:GEN*/` region into `index.html`** (`--check` = round-trip gate). Replaces the retired `integrate-game.js` (now a deprecation tombstone). Writes `index.html.bak`. |
| `design/test-content.js` | **CI gate**: BGM splice round-trip, save-migration unit test, registry presence, resolve-identity. |
| `design/test-bgm-unlock.js` | Regression test for the "holding shoot restarts BGM" bug. |
| `design/build-{theme,sfx,balance}-demo.js` → `*-demo.html` | Authoring harnesses (gitignored output). theme/sfx inline the real game behind `window.__DEMO`; balance is self-contained. |
| `720hz.txt` | A *pending, not-implemented* proposal to move the sim to 720 Hz. |

## `index.html` architecture

Single `<script>`, sectioned by banner comments (line numbers drift — navigate by banner/symbol):

| Section | Contents |
| --- | --- |
| **CONSTANTS** | Single source for engine/economy tuning. `STEP=1/120`, `MAX_STEPS=8`, pool caps, `STATE` enum (incl. **reserved slots** `DIFFICULTY_SELECT`…`NAME_ENTRY` for the deferred Phase 8 screens). |
| **ENGINE CORE** | math · seeded `makeRng`/`rng` · `makePool` dense-prefix pool (+ **`shrink(toCap)`**) · `spawnBullet`/`spawnShot`/`spawnParticle` · `integrate*` · `collide*` · **`simStep`/`frame`** loop. |
| **AUDIO** | `const Audio` IIFE (lazy `AudioContext`). **Generated BGM region** `/*BGM:GEN*/`…`/*END:BGM:GEN*/` = engine+tracks; transport (`trackOf`/`pump`/`playMusic`) is hand-written *after* the anchor; `sfx` facade. |
| **THEMES** | `THEMES` (per-stage sky/petal/ground colours) + `activeTheme` + `bakePetals()` + `setTheme(key)`; **`BOSS_DESIGNS`** registry (`{draw,scale,hitR}` per design id). |
| **PATTERNS** | `pat.*` emitter library + bare adapters (`ring`/`spiral`/`fan`/`wall`/`burst`/`rain`/`aimedShot`). |
| **SPELL REGISTRY** | `SPELLS` motif registry + **`compileSpell(ph)`** (resolves a phase to its emitter generator-fn: `body:'raw'`+`raw:` mainstream, or `body:'<motif>'`+`params:`). |
| **CONTENT DATA** | `/*BUILD:CONTENT*/`…`/*END:CONTENT*/` → **`BALANCE`** (difficulty knobs; per-phase base numbers stay in the specs). |
| **INTERP** | **`resolveWave(opts,diff)`** / **`resolveBoss(spec,diff)`** — scale by difficulty; **identity at normal** (return the same object; clone only off-normal, never mutate the base). |
| **SYSTEMS** | input (edge-triggered) · `player`/`game`/**`run`** structs · `startRun(diff,fromStage)` / `enterStage(i)` / `advanceStage()` (campaign spine) · scoring/items/power/bombs/death · versioned save (`migrateSave`/`danmaku_save_v2`) · `setState`. |
| **STAGE / ENEMIES** | `Director` coro scheduler · wave factories + **`WAVES`** registry · `delayed()` · `MIDBOSS_SPEC`/`FINALBOSS_SPEC` + **`BOSSES`** registry · **`STAGES[]`** data + **`runStage(stage)`** interpreter · `runBoss`/`runPhase`/`makeBoss`/`damageEnemy`. |
| **DEV/TEST HOOK** | `window.__dbg` (arms only with `?dev=1`/`?golden=1`/`window.__DEMO`; inert in ship). Golden harness + authoring exports. |
| **BOOT** | `boot()` IIFE → `Render.init` → `initGameSystems` → `attachInput` → `setState(TITLE)` → rAF (skipped under `?golden=1`). |

### Core loop
`frame(nowMs)`: clamp `dt` to `MAX_FRAME_DT`, scale by `Render.timeScale`, accumulate, run
`simStep(STEP)` up to `MAX_STEPS=8` times (spiral guard), render with `alpha=acc/STEP`. `simStep`:
`T += STEP` first, then input → `updateGameSystems` → (PLAYING) `Director.update` → enemy integrate
→ bullets/shots → collisions → particles → **compact pools last**.

### Campaign flow (V2)
`startGame()` → `startRun('normal',0)` (fresh loadout from `BALANCE.difficulties[diff]`) →
`enterStage(i)` (per-stage spawn reset, `Director.start(()=>runStage(STAGES[run.stage]))`). `runStage`
walks `STAGES[i].timeline` (waves via `WAVES`+`resolveWave`, bosses via `BOSSES`+`resolveBoss`,
parallel+`delayed`, music indirection, banner/sfx/flash/shake). `{stageClear}` → `advanceStage()`:
next stage, or (last stage) `onStageClear()` → `STATE.STAGECLEAR`.

### Conventions that bite (verify before editing)
- **`Director`** runs JS generators; a coro `yield`s a number (sleep secs) or `undefined` (one tick).
  `fork(gen,owner)` auto-kills when `owner.dead`. `beginGroup`/`endGroup` epoch-tag emitters so a boss
  phase tears them all down. `compileSpell(ph)(boss)` must satisfy this contract (boss arg; inner
  forks inherit the phase epoch; survival/timer untouched).
- **Movement coros must set `e._steered=true`** each tick they write `x/y`, else `enemyIntegrate` double-moves.
- **Bosses are never auto-killed** (`damageEnemy` only decrements `boss.hp`; removal in `bossDefeat`).
- **Enemy "dead" is `e.dead`**. **`keyEdge(code)` is consuming**. Keep gameplay randomness on `rng`.
- **Pool caps are soft** (grow on exhaustion; `shrink(toCap)` releases capacity, never below live count).
- **`resolveWave`/`resolveBoss` return the SAME object at `normal`** (identity short-circuit) — don't
  "optimise" that away or you change default play. They clone (never mutate) only off-normal.
- **`buildPetals` consumes the global `rng` at boot** (~352 calls); `buildScenery` uses its own
  `srng`. Changing petal-position rng usage shifts every stage pattern.

## BGM pipeline

Music is data + synthesis (no files). Workflow:

```bash
#   edit design/bgm-tracks.js (notes/chords/arrangement) or design/bgm-engine.js (synth, rarely)
node design/bgm-tracks.js        # validate lanes + in-key (non-zero on error; keep the "validation (Node only)" marker)
node design/build-bgm.js         # rebuild bgm-demo.html → A/B listen
node design/build-game.js        # re-inline the /*BGM:GEN*/ region into index.html (writes index.html.bak)
node design/build-game.js --check  # assert the region is in sync (used by test-content.js)
node design/test-bgm-unlock.js   # transport state-machine regression
```

Adding a track: add to `bgm-tracks.js`'s `TRACKS` (e.g. `boss2`), audition, then `build-game.js`
re-inlines it. `playMusic` already accepts any `trackOf(name)` key (no whitelist edit needed).
`test-bgm-unlock.js` parses transport fns as **single-line** definitions — keep them one-liners.

## Verifying behaviour preservation (the golden harness)

The dev/test hook arms only with `?dev=1` / `?golden=1` / `window.__DEMO` (inert in ship). `?golden=1`
freezes the rAF loop so `window.__dbg` owns the sim clock deterministically:

- `__dbg.fpStage(ticks)` — no-input, player-invulnerable run of the stage opening (reaches the
  midboss); fingerprint = bullet count + enemy count + order-independent (pos/style/hue) checksum.
- `__dbg.fpEmitters(ticks)` — every boss-phase emitter captured in isolation (`captureEmitter`).
- `__dbg.peekRng()` — boot-time gameplay-rng probe (catches `buildPetals` consumption drift).

**To check a behaviour-preserving change:** serve, open `index.html?golden=1`, capture
`{bootRng:__dbg.peekRng(), stage:__dbg.fpStage(5400), emitters:__dbg.fpEmitters(1200)}`, and diff
against a baseline captured the same way from a known-good commit. Caveat: the golden is **blind** to
player-interaction paths, the post-midboss timeline (midboss never dies headless), rendering, and
audio — verify those by reading the diff / a live `?dev=1` session / screenshots.

**Full pre-ship gate:** `node design/bgm-tracks.js && node design/build-game.js --check && node design/test-content.js && node design/test-bgm-unlock.js`.

## V2 status & forward roadmap

**DONE — Phases 0–9** (on `master`, commits `cf9c7d2..8029964`, behaviour-preserving / golden-verified):
THEMES, BOSS_DESIGNS, WAVES, SPELLS+`compileSpell` (+`cutinHue` mechanism, unused so cut-in stays
dim-only), `playMusic` trackOf-whitelist + `build-game.js` splicer, STAGES+`runStage`, the `run`
campaign spine + versioned save + `DIFFICULTY`→`BALANCE` + `pool.shrink`, and `resolveWave`/`resolveBoss`
+ 3 demo harnesses.

**Phase 8's interactive SCREENS were deferred by plan** (the structural spine + reserved STATE slots
exist; the UIs do not).

**NEXT (resequenced 2026-06-03), in this order:**
1. **Debug "start from any stage" mode** (do this first — makes authoring 2–6 fast). Seam is ready:
   `startRun(diff, fromStage)` takes a 0-indexed start stage. Implement: at boot, parse `?stage=N`
   (1-indexed) + optional `?diff=`; if present, skip the title and `startRun(diff, N-1)`. Works with
   whatever `STAGES` entries exist. This is **stage** entry only — mid-**phase** seek/heal (within a
   boss) is a separate, harder feature (ARCHITECTURE-V2 §11/#11) and not needed.
2. **Phase 10 — Stage 2** full authoring: new `THEMES` entry + 2 BGM tracks (bgm-tracks → audition →
   `build-game.js`) + a boss from the spell library + `STAGES[1]`.
3. **Phase 11 — Stages 3–6**, one at a time (each = `STAGES[N]` + theme + 1–2 BGM), previewed via the
   debug `?stage=N` mode.
4. **Phase 12 — perf & polish**: dev bullet-count/frame-time HUD; on worst Lunatic card cap-enforce /
   off-screen cull / draw-batch / cheaper compact; `STAGE_INTERMISSION` `pool.shrink`; results/all-clear.
5. **Phase 8 (deferred) LAST**: difficulty-select / continue / results / name-entry screens +
   reusable menu-cursor + touch-menu nav, wired onto the reserved STATE slots and the `run` spine.

## Dev / preview (this machine)

WSL box reached from an iPad over SSH — bind dev servers to all interfaces on port 8000:

```bash
python -m http.server 8000 --bind 0.0.0.0   # then http://<LAN-IP>:8000/index.html  (hostname -I → 192.168.x.x)
```

Playwright MCP is available machine-wide for self-verifying visual changes.

## Pending / proposed (not implemented)

- **720 Hz fixed timestep** (`720hz.txt`): raise the sim tick from `1/120` to 720 Hz with carried
  fractional remainder, normalising elapsed-time mechanics. **Current reality: `STEP = 1/120`.**
