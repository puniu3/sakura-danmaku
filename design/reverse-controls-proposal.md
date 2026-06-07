# Reverse-grip controls (逆手操作) — IMPLEMENTED (roadmap E)

> Shipped in `index.html` 2026-06-07. Pure additive input-layer change → **golden byte-identical**
> (headless golden uses no input; verified `GOLDEN_MATCH: true`). Nothing in `/*BGM:GEN*/` touched.

## The problem (precise)

Default Touhou hand-split = RIGHT hand on the arrow cluster (bottom-right) + LEFT hand on Z/X/Shift
(bottom-left). The reversed / left-handed style is LEFT hand on **WASD** + RIGHT hand on actions — but the
only fire (`KeyZ`) and bomb (`KeyX`) keys sit under the LEFT hand, so with WASD held there is nothing to
fire/bomb with. **Focus already has a right-hand key (`ShiftRight`).** The gap was exactly a right-hand
**FIRE (held)** and right-hand **BOMB (tap)**.

## Final scheme — "RightShift + its 2 left-neighbour keys", gap-free on every layout

| action | code(s) | notes |
| --- | --- | --- |
| focus (held) | `ShiftRight` *(already bound)* | pinky |
| fire (held) | `Period` **and** `IntlRo` | both share the fire role |
| bomb (tap) | `Slash` | |

Bound by `KeyboardEvent.code` = *physical* key position (layout-independent by position; only printed
labels drift). The subtlety the naive "Slash beside RightShift" mirror missed: **JIS and Brazilian ABNT2
insert the `IntlRo` (`ろ`) key between `Slash` and `RightShift`**, so `Slash` is no longer adjacent to
RightShift there. The fix: give `IntlRo` the **same role as `Period` (fire)**, not a separate bomb role —
then the immediate 3-key cluster `RightShift + 2 left neighbours` always covers focus+fire+bomb with **no
gap (no 飛び地)**:

```
ANSI / ISO / Chinese / Korean :  [ Period(fire)  Slash(bomb)  RShift(focus) ]      (IntlRo absent)
JIS / Brazil ABNT2            :  [ Slash(bomb)   IntlRo(fire) RShift(focus) ]      (Period = outer fire alias)
```

This needs **no `navigator.keyboard` layout detection** (which is Chromium-only — Firefox/Safari lack it),
so it's more robust than runtime detection: the shared fire role makes whichever key lands next to
RightShift do the right thing.

### Cross-layout audit (per owner request: CN/KR/etc.)
- **Chinese** (PRC simplified + Taiwan traditional): physically ANSI 104 — IME sits on top, bottom-right
  row standard → `Slash` adjacent to RightShift. Same as ANSI. ✓
- **Korean** (KS X 5002 / 106-key): the extra 한/영 (`Lang1`) + 한자 (`Lang2`) keys split the **spacebar**,
  not the bottom-right alpha row → standard bottom-right. Same as ANSI. ✓
- **JIS / Brazilian ABNT2**: insert `IntlRo` next to RightShift → handled by IntlRo=fire. ✓
- **AZERTY / Dvorak**: layout (not geometry); `code` is physical, positions stable, labels differ. ✓

## What shipped (3 additive edits, all match existing patterns)

1. **`GAME_KEYS`** (`index.html` ~`:139`) — added `'Period','Slash','IntlRo'` so keydown/keyup
   `preventDefault` fires (critical: `/` is Firefox/Chrome quick-find). Comment records the cross-layout
   reasoning.
2. **`fireHeld`** — `||!!rawKeys['Period']||!!rawKeys['IntlRo']` (held fire, like `KeyZ`).
3. **`handleInput`** — `if(stepEdge['Slash']) stepEdge['KeyX']=true;` next to the existing
   `ShiftRight→ShiftLeft` / `KeyP→Escape` edge aliases (routes a `Slash` tap through both `keyEdge('KeyX')`
   call sites — tryBomb + death-bomb — with correct per-frame consume-once; `stepEdge` is cleared every
   frame so the tap can't repeat).

`held2`/`focusHeld` untouched (focus already = `held2('ShiftLeft','ShiftRight')`). Gamepad/touch paths
write `rawKeys['KeyZ']`/`edgeKeys['KeyX']` directly and are undisturbed. Existing `KeyZ`/`KeyX` stay fully
intact (pure additive).

## Verified
- Golden byte-identical (sim untouched). CI gate green.
- In-browser: `Period`=fire (triggered shooting → graze-power laser), `IntlRo`=fire (shot stream), `Slash`
  bomb (clear burst), via synthetic `KeyboardEvent`s with the respective `code`s. No real console errors.

## Rejected alternatives
- **IntlRo = bomb** (first attempt): on JIS makes the RightShift+2 grip `focus·bomb·bomb` with fire exiled
  to a 3rd key → 飛び地. Replaced by IntlRo=fire.
- **`navigator.keyboard.getLayoutMap()` detection**: Chromium-only; the shared-fire-role trick achieves the
  same gap-free grip on all browsers without it.
- **Home-row (KeyL/Semicolon)**: focus+bomb both lean on the pinky → cramped death-bomb-while-firing.
- **Numpad aliases**: can't hold focus(`ShiftRight`) + rest on the numpad island one-handed; absent on
  TKL/60%/laptop boards.
