# 桜花弾幕 — Sakura Danmaku

A single-file, Touhou-style vertical **bullet-hell (danmaku)** shoot-'em-up that runs in any
modern browser. Open `index.html` and play — there is no build step, no framework, and no
asset files. Everything is drawn with Canvas2D, and every sound — all SFX plus a three-track
adaptive soundtrack (stage → midboss → boss) — is **synthesised live with the Web Audio API**.
There are no `.png`, `.mp3`, or `.wav` files anywhere in the repository.

---

## What this actually is

This project is a **technology demonstration of Claude Opus 4.8 running in "ultracode" mode** —
Claude Code's most autonomous, multi-agent setting. The game was built **almost entirely
hands-off**: a human supplied direction and taste, and Claude did essentially all of the design,
implementation, music composition, and integration.

The interesting part is *how* it was built, not just *that* it was built. Instead of writing one
monolithic program top-to-bottom, Claude used a **"design in isolation, then reconcile"**
workflow:

1. **Six subsystems were designed independently and in parallel** — engine, bullet patterns,
   stage/boss scripting, game systems, rendering, and audio. Each arrived as a standalone
   reference implementation plus design notes (`design/*.code.js` + `design/*.notes.md`), with
   **no shared agreement between them**. Predictably, they collided: clashing function names and
   signatures, incompatible data shapes, duplicate constants with different values, and two
   different ideas of who owns the game loop.

2. **The conflicts were resolved in one explicit integration pass.** `design/RECONCILIATION.md`
   is the master spec that adjudicates every clash, assigns exactly one authoritative owner to
   each shared concern, and fixes a single source of truth for every constant.

3. **The reconciled pieces were assembled into one shipping `index.html`** — roughly 1,300 lines
   of dense JavaScript implementing a deterministic fixed-timestep simulation, GC-free bullet
   pools, generator-coroutine stage scripting, a descriptor-driven boss phase machine, and a
   fully procedural audio engine.

That parallel-design-then-reconcile methodology is the headline of the demo. It is a way of
working that a single human could not run by hand at this speed — and it is what the multi-agent
ultracode setting makes possible.

---

## Play

The fastest way: just open `index.html` in a browser. To serve it (recommended, and required for
some audio-autoplay policies):

```bash
python -m http.server 8000   # then open http://localhost:8000/
```

**Controls**

| Action | Keys |
| --- | --- |
| Move | Arrow keys (WASD also works) |
| Shoot | **Z** (hold) |
| Bomb | **X** |
| Focus (slow, precise, reveals the tiny hitbox) | **Shift** |
| Start | **Z** / **Enter** |
| Pause | **P** / **Esc** |
| Mute | **M** |

Graze bullets (skim them without being hit) for score, collect **P** power-ups to level up your
shot, and gather **•** point items — worth the most when collected near the top of the screen.
The single stage runs intro → enemy waves → a midboss → a six-phase final boss.

---

## Repository layout

| Path | What it is |
| --- | --- |
| `index.html` | **The entire shipping game.** One HTML file, one `<script>`. This is the live artifact. |
| `design/` | The six subsystem designs (`*.code.js` + `*.notes.md`), the reconciliation spec, and the BGM build pipeline. |
| `design/RECONCILIATION.md` | The master integration spec — authoritative constant table and conflict resolutions. |
| `CLAUDE.md` | Architecture map and working rules for future coding sessions (start here if you're editing the code). |

For the full architecture, build pipeline, and the rules that keep the codebase coherent, see
[`CLAUDE.md`](./CLAUDE.md).

---

*Built with [Claude Code](https://claude.com/claude-code) (Opus 4.8, ultracode).*
