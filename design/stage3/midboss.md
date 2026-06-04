# Stage-3 MIDBOSS redesign — 宵 (Yoi), solo prelude of the Moonlit Lattice

Replaces the current `YOI_INTRO_SPEC` in `index.html`. **Design + ready-to-paste JS only — do
not edit `index.html` from this doc.**

---

## The problem (verified by diff)

`YOI_INTRO_SPEC.phases[1]` ("Nightfall Pursuit") is a near-clone of `TASOKARE_INTRO_SPEC.phases[1]`
("Twilight Pursuit"):

| | Tasokare intro spell | 宵 intro spell (current) |
| --- | --- | --- |
| core emitter | `pat.delayedTurn` FULL-RING (`spread:TAU`), drift→home soul-orbs | **same** `pat.delayedTurn` FULL-RING |
| speed / delay / speed2 | 88 / 0.9 / 165 | **88 / 0.9 / 165** (identical) |
| hue | **205** (ghost-blue) | **205** (ghost-blue) — *the tell* |
| second beat | `pat.aimedSpread` pellet fan | `pat.aimedSpread` pellet fan |
| only difference | — | one extra slow `ring` fork |

Both nonspells are also the same shape (forked aimed-fan over a slow swaying base ring). The shared
**ghost-blue 205 + delayedTurn full-ring pursuit** makes 宵 read as "Tasokare, again" — she does not
foreshadow her own final fight at all.

---

## The redesign — what twin motif it shares, and how it is a solo prelude

The Stage-3 FINAL boss (`TWINS_SPEC`) has three signature cards. The clearest, most recognizable, and
most adaptable to a single body is **phase 2, "Moonlit Lattice": counter-rotating MIRRORED spirals**
(宵 spins arms `+a`, 暁 spins `-a`; indigo ↔ amber; the two opposing spins interleave into a woven
lattice).

**宵's midboss shares the Moonlit-Lattice motif and plays it as a SOLO PRELUDE.** She is alone here
(ordinary single-boss `runBoss` path — no `b._twin`), so she cannot mirror-duet with a partner.
Instead **she weaves BOTH halves of the lattice from her own single body**: every tick she fires
*two* spirals — one turning `+a`, one turning `−a` — the clockwise + counter-clockwise arms that, in
the final fight, will be split across two sisters. One body previewing the weave that later takes two.

Reading: **"I am one of two. Watch me trace both arms of the lattice — later there will be a mirror
of me to take the other side."** To make the absent 暁 *felt*, the counter-clockwise arm (the side
暁 will own in the duet) is tinted with a **single amber accent** (hue ~38) against 宵's dominant
**indigo** (hue ~263); the clockwise arm she keeps. The crescent-moon halo she already wears
(`drawBossTwin`: `c.arc(...)` crescent) is echoed in a **slow crescent-ARC sweep** — a short arc of
soul-orbs, not a full ring — that drifts then homes (the family's drift→home soul-orb DNA, kept, but
re-cast as a swept ARC instead of Tasokare's full ring, and re-hued to indigo). The lattice is the
star; the crescent arc is the recognizable soul-orb thread under it.

So the spell carries **two** twin signatures (lattice + crescent soul-orb), both in 宵-indigo with
one amber whisper — and zero of Tasokare's ghost-blue full-ring.

### Nonspell (phase 1)

Also re-aimed away from Tasokare and toward the twins. Instead of "aimed fan over a slow base ring,"
it becomes a **slow counter-rotating double ring** (the lattice idea in its simplest, telegraphed
form — two rings, one rotating each way) with an aimed indigo fan punctuating it. Same midboss
pressure, but it already whispers "two opposing spins." Hues: indigo 263 + a single amber-32 accent
ring; the aimed fan is indigo, **not** the old hue-285 violet (which read as Tasokare's pellet
colour).

---

## Before / after contrast vs Tasokare-intro

| Axis | Tasokare intro | 宵 intro (NEW) |
| --- | --- | --- |
| **Hue** | ghost-blue **205** (+ violet 280/285 accents) | **indigo 262–266** dominant + **one amber 32–38** accent (the absent 暁) — never 205 |
| **Spell core mechanic** | one `delayedTurn` **full ring** that homes (pursuit) | **counter-rotating mirrored spirals** (`+a` & `−a` from one body) weaving a **lattice** + a **crescent-arc** soul-orb sweep that drifts→homes |
| **What it foreshadows** | nothing (it *is* Tasokare's own card) | the FINAL boss's "Moonlit Lattice" + "Crossing Hitodama" — solo-played |
| **Feel** | "ghost throws a homing net at you" | "a moon-spirit traces both halves of a weave — eerie, woven, off-balance because one side is missing" |
| **Nonspell shape** | forked aimed-fan over slow swaying base ring | counter-rotating **double** ring + aimed indigo fan (lattice-in-miniature) |
| **Soul-orb thread** | full-ring `delayedTurn`, ghost-blue | **arc-only** `delayedTurn` (`spread≈0.9π` crescent), indigo, swept by her sway |

The soul-orb drift→home DNA is *retained* (it is the family's connective tissue across Stages 2–3),
but everything that read as Tasokare — the hue 205, the full-ring shape, the plain `delayedTurn`-ring
+ `aimedSpread` structure — is gone, replaced by the lattice + crescent-arc that point at the twins.

---

## The complete new `YOI_INTRO_SPEC` (ready to paste)

Drop-in replacement for the current `const YOI_INTRO_SPEC = {...}` block (the one immediately above
`const BOSSES = {...}`). Keeps name 宵, `design:'twinYoi'`, indigo hue 265, the same
`enterFrom`/`enterTo`, `score:95000`, `retreat:true`, `retreatDrops:['bomb']`, TWO phases
(nonspell hp 1180 + spell hp 1480), and `cutinHue:265`. HP unchanged.

```js
// STAGE 3 MIDBOSS — only ONE of the sisters, 宵 (Yoi, indigo), appears solo to test the player: a single
// body (NO twin → the ordinary single-boss runBoss path), 2 phases (1 nonspell + 1 spell), then RETREATS
// (spec.retreat → bossRetreat, same seam as Stage 2's Tasokare intro) to return WITH 暁 for the full fight.
// Plays over the 道中 (stage3) BGM — there is NO dedicated midboss track.
// 宵's solo card is a PRELUDE OF THE TWINS, not a Tasokare reskin: she weaves the final boss's
// "Moonlit Lattice" ALONE — firing BOTH the clockwise (+a) AND counter-rotating (−a) spiral arms from her
// single body (the two arms that LATER split across the two sisters), plus a crescent-ARC of drift→home
// soul-orbs (the "Crossing Hitodama" thread, re-cast solo). 宵-INDIGO (hue ~263) throughout, with a SINGLE
// amber accent (hue ~38) on the −a arm hinting at the absent 暁. NO ghost-blue 205, no full-ring pursuit.
const YOI_INTRO_SPEC = { name:'宵', design:'twinYoi', hue:265, enterFrom:{x:PF_W/2,y:-70}, enterTo:{x:PF_W/2,y:144}, score:95000, retreat:true, retreatDrops:['bomb'],
    phases:[
      // 1 — nonspell: the lattice in miniature — a slow COUNTER-ROTATING double ring (one ring spinning each
      // way, the +/− idea telegraphed plainly) punctuated by an aimed indigo fan. One amber accent ring.
      { kind:'nonspell', hp:1180, body:'raw', raw:function*(b){
          Director.fork(function*(){ while(true){ fan(b,{n:5,spread:0.6,speed:142,aim:true,hue:263,style:'mid'}); yield* waitT(1.05); } },b);
          let rot=0; while(true){ ring(b,{count:16,speed:96,hue:263,style:'orb',rot:rot}); ring(b,{count:16,speed:96,hue:38,style:'pellet',rot:-rot+0.2}); rot+=0.18; yield* waitT(1.4); } },
        onEnter:_sway(PF_W*0.35,PF_W*0.65,144,2.0) },
      // 2 — spell: SOLO Moonlit Lattice. She fires BOTH spiral arms herself (+a indigo, −a amber = 暁's
      // future side), weaving the counter-rotating lattice from one body. A forked crescent-ARC of
      // drift→home soul-orbs (spread≈0.9π, NOT a full ring) sweeps under it — the soul-orb family thread,
      // re-hued indigo and re-shaped to an arc so it never reads as Tasokare's ghost-blue ring.
      { kind:'spell', name:'宵 Sign "Moonlit Prelude"', hp:1480, drops:['point','point','point','power'], cutinHue:265, body:'raw', raw:function*(b){ let a=0;
          Director.fork(function*(){ while(true){
            pat.delayedTurn(b,{count:9,spread:Math.PI*0.9,baseAngle:HALFPI,speed:92,delay:0.85,turnAim:true,speed2:150,hue:263,style:'orb'});
            yield* waitT(1.6); } },b);
          while(true){ spiral(b,{angle:a,arms:3,speed:120,hue:263,style:'small'}); spiral(b,{angle:-a,arms:3,speed:120,hue:38,style:'small'}); a+=0.16; yield* waitT(0.05); } } }
    ] };
```

---

## Coro contract trace (confirmed)

Walked each generator against CLAUDE.md "Conventions that bite":

- **Phase 1 nonspell `raw:function*(b)`.** Forks one aimed-fan sub-coro via `Director.fork(fn,b)` →
  auto-killed when `b.dead`, and (because it is forked from inside the phase coro) inherits the phase
  epoch via `beginGroup`/`endGroup` in `runPhase`, so it tears down at phase end. The main loop fires
  two counter-rotating `ring`s (indigo `+rot`, amber `−rot`), bumps `rot`, then `yield* waitT(1.4)`.
  Standard "spawn, advance state, wait" loop. **No manual `b.x/b.y` writes** in the body — movement is
  delegated to `onEnter:_sway(...)`, which forks its own `moveTo` glide; `moveTo` sets `e._steered`
  every tick, so `enemyIntegrate` does **not** double-move. ✔
- **Phase 2 spell `raw:function*(b)`.** Forks the crescent-arc soul-orb coro (`pat.delayedTurn`,
  `spread:Math.PI*0.9` = a ~162° arc, **not** `TAU`), waiting 1.6 s between sweeps — auto-killed +
  epoch-scoped exactly like above. The main loop is the lattice: two `spiral` calls per tick (`+a` and
  `−a`), `a+=0.16`, `yield* waitT(0.05)` (≈ the cadence of `TWINS_SPEC` Moonlit Lattice and the Flower
  King mandala — both use `0.04–0.05`). **No manual boss movement** → `onEnter` is intentionally
  omitted on the spell (the boss holds centre while she weaves, like `TWINS_SPEC` phase 2 which only
  drifts via `_twinSway`); if a gentle glide is wanted, add `onEnter:_sway(PF_W*0.40,PF_W*0.60,140,2.6)`
  — `_sway` is the same epoch-safe, `_steered`-setting helper used elsewhere. ✔
- **`compileSpell(ph)`** returns `ph.raw` (body `'raw'`), and `runPhase` runs it as
  `Director.fork(()=>compileSpell(ph)(boss),boss)` → the body receives `boss` as `b` and lives inside
  the phase group. Both phases match this contract. ✔
- **Randomness:** none introduced beyond the engine's existing `pat.*` internals (no `Math.random`,
  no new `rng` calls) → golden-neutral for these new cards (they are new content, not a
  behaviour-preserving edit of Stage 1; the Stage-1 fingerprint is untouched). ✔
- **HP / scale / retreat:** unchanged from spec constraints (1180 / 1480, `retreat:true`,
  `retreatDrops:['bomb']`, `score:95000`, `cutinHue:265`). The retreat seam (`spec.retreat` →
  `bossRetreat`) is untouched — she still flees to return with 暁. ✔

### Signature signatures used (all verified against the pattern library)

- `spiral(src,{angle,arms,speed,hue,style})` → `pat.spiral` (line 1729): `angle` maps to `phase`,
  `style:'small'`→`'pellet'`. Counter-rotation by passing `+a` then `−a`. ✔
- `ring(src,{count,speed,hue,style,rot})` → `pat.ring` (line 1728): `rot` adds to `baseAngle`.
  Counter-rotation via `+rot` / `−rot`. ✔
- `fan(src,{n,spread,speed,aim:true,hue,style})` → `pat.aimedSpread` (line 1730). ✔
- `pat.delayedTurn(b,{count,spread,baseAngle,speed,delay,turnAim:true,speed2,hue,style})` (line 1721):
  drift→home soul-orbs; `spread:Math.PI*0.9` makes the **crescent arc** (vs Tasokare's `spread:TAU`
  full ring). `baseAngle:HALFPI` aims it downward at the play area; `turnAim:true` makes them home. ✔
- `HALFPI`, `Math.PI`, `PF_W`, `_sway`, `waitT`, `EASE`, `Director.fork` — all in scope at this site. ✔

---

## INTEGRATION NOTES

- **Symbol to replace:** the entire `const YOI_INTRO_SPEC = { … };` block in `index.html`
  (currently the block ending the line just above `const BOSSES = {...}`; search **`YOI_INTRO_SPEC`**
  / banner **`STAGE 3 MIDBOSS`**). Replace it verbatim with the block above (comment header included).
- **No other edits required.** `BOSSES.yoiIntro` already points at `YOI_INTRO_SPEC`; the Stage-3
  timeline already references `yoiIntro`; `cutinHue:265` is preserved; the `retreat`/`retreatDrops`
  seam is unchanged. `_sway`, `pat.*`, the bare adapters, and `HALFPI` are all defined earlier in the
  same `<script>`.
- **Spell name change:** `"Nightfall Pursuit"` → `"宵 Sign "Moonlit Prelude""` (it is now a prelude of
  "Moonlit Lattice", not a pursuit). Purely a HUD/banner string; no code depends on the literal.
- **Not a SPELLS motif:** kept as a `body:'raw'` generator per the "promote to `SPELLS` only when 3+
  cards reuse it" rule. The solo-lattice weave is unique to this card (the twins use the *two-body*
  form via `b._twin`), so a raw body is correct; do not factor it into `SPELLS`.
- **Verify (post-paste):** preview live with `?stage=3` (debug stage-start) and watch the midboss —
  confirm (a) the spell visibly weaves two opposite-spinning spiral arms (indigo + one amber arm),
  (b) a crescent arc of soul-orbs drifts then homes, (c) **no** ghost-blue 205 anywhere. Then run the
  pre-ship gate (`node design/build-game.js --check && node design/test-content.js && …`); the
  Stage-1 golden fingerprint must remain byte-identical (this change touches only Stage-3 content).
```
