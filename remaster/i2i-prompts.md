# i2i prompts — Sakura Danmaku remaster, batch 1 (Stage-1 spring set + Stage 1–3 boss parts)

Prompts to turn each **procedural reference** (exported via `remaster/index.html?ref=<name>&size=768`,
captured into `remaster/refs/<name>.ref.png`) into a raster asset through codex's built-in `image_gen`
(`/home/puniu/procedural-i2i/tools/imggen.sh`). One prompt + one reference per gen; the reference
carries the composition, the prompt carries material + exclusions. Executable mirror:
`remaster/gen-assets.sh` (writes to `remaster/assets/gen/` only — staging; never `remaster/assets/`).

## The contract these prompts enforce

**Diffuse/albedo = raster (generated) · additive light = procedural (engine).** Every prompt produces
only the solid body with soft baked form shading and **excludes all emissive light** — glow, halo,
flame, beam, spark, lens flare. The engine's light layer (boss glows, hitodama, engine exhaust,
lantern bloom, title breath) draws on top at runtime; a baked glow would double with it.

Alpha-subject refs are exported on flat `#00ff00` by design (the built-in tool has no alpha); results
are stripped locally with `remove_chroma_key.py --auto-key border --soft-matte --despill --force`.

---

## STYLE block  ← the ONE re-art-direction knob (v1, shared verbatim by every asset)

> Japanese folklore dark-fantasy game art in a refined ukiyo-e-inspired painterly style: muted
> jewel-tone color fields over deep indigo darkness, subtle washi-paper grain, fine dark ink contour
> lines, soft bokashi gradient shading, restrained gold-leaf accents. Matte non-emissive surfaces,
> crisp painterly silhouettes. No text, no lettering, no watermark.

### STYLE B (demo only — `scenery_spring_ground.styleB.png`, the comparison knob)

> Japanese woodblock-print game art in a pure flat-color ukiyo-e style: completely flat solid color
> fields with no gradients, bold carved dark ink outlines, a limited muted palette over deep indigo
> darkness, visible washi-paper texture, decorative flat stylization like an Edo-period print.
> No text, no lettering, no watermark.

## CONSTRAINTS block — alpha/chroma assets (shared verbatim)

> Keep the reference's exact silhouette, proportions, pose, framing, scale and centred position —
> the reference defines the composition. Render soft baked form shading only; no scene lighting, no
> cast shadows. ABSOLUTELY NO emissive light: no glow, halo, flame, beam, spark, lens flare, or
> glowing parts — the engine draws all light separately. Place the subject on a PERFECTLY FLAT SOLID
> #00ff00 chroma-key background: one uniform green, no gradient, no texture, no shadows, no
> reflections. Never use #00ff00 anywhere on the subject. No scene, no ground plane, no border, no
> frame, no text, no UI. Single centred subject filling the same area as the reference, crisp edges.

## CONSTRAINTS block — OPAQUE assets (ground tile, title; chroma clause dropped)

> Keep the reference's exact composition, layout, framing and proportions — the reference defines
> the composition. Render soft baked form shading only; no scene lighting, no cast shadows.
> ABSOLUTELY NO emissive light: no glow, halo, flame, beam, spark, lens flare — the engine draws all
> light separately. Fill the whole frame edge-to-edge, fully opaque. Keep it DARK and LOW-CONTRAST
> overall — this sits under gameplay seen through a dark veil and bright bullets must read on top.
> No border, no frame ornament beyond the reference's own, no added text, no UI, no watermark.

---

## Per-asset SUBJECT lines (final prompt = STYLE + SUBJECT + CONSTRAINTS)

Final in-engine sizes (the script downscales): parts = 4× their ext; tiles/sheets/title = native
registry dims.

### `scenery_spring_ground` — opaque tile · final 432×608
A ground tile for a vertical scrolling playfield seen from directly above: a soft spring meadow lane,
an irregular patchwork of mossy grass fields and worn earth patches with faint stone seams, drifts of
fallen pale-pink sakura petals scattered between the patches. Keep the reference's exact patch layout
and palette placement, only enriched with painterly texture. CRITICAL: the image must tile seamlessly
in the vertical direction — the TOP edge must continue perfectly into the BOTTOM edge with no visible
seam. Even, quiet, low-contrast, no focal point, no objects, no creatures.

### `scenery_spring_canopy0` / `canopy1` / `canopy2` — alpha parts · final 46×46 each
A single sakura cherry-tree crown seen from directly above: a round blossom canopy of layered petal
clusters in muted rose-pink, lobed cluster mounds around a denser centre, painterly washi-silk petal
texture, soft irregular outer edge. *(one material word varies per variant:)*
- canopy0: **young pale blossoms just opening, a hint of fresh green leaves between the clusters**
- canopy1: **full dense peak bloom, pure layered rose-pink petals**
- canopy2: **deeper dusk-rose shaded blossoms, slightly darker and heavier clusters**
Keep the reference's round top-down silhouette and lobed cluster placement exactly.

### `scenery_spring_lantern` — alpha part · final 16×16
A small roadside stone lantern (ishidoro) seen from directly above: the round weathered grey stone
roof cap with a pale cream paper window ring and a small warm-amber centre painted as flat matte
color — NOT glowing, no halo, no rays (the warm centre is paint, not light). Mossy aged stone rim.
Keep the reference's tiny round top-down silhouette exactly.

### `scenery_spring_stream` — alpha tile (wide band) · final 572×96
A horizontal stream of spring water crossing the full width, seen from directly above: a wide soft
ribbon of pale blue-cyan water with a faint diagonal painted current streak (matte paint, not a light
glint), soft feathered top and bottom edges that dissolve away to nothing. Painterly flat water in
the bokashi manner, muted, calm. Keep the reference's band placement, thickness and the diagonal
current direction exactly.

### `player_free` + `player_focus` — JOINT SHEET (one gen, sliced) · final 56×56 each
Sheet ref = `refs/player_sheet.ref.png` (= `player_free.ref` | `player_focus.ref`, `+append`).
A sprite sheet with exactly TWO cells side by side on one flat #00ff00 field, each cell the SAME
small origami-crane spirit-ship of crisply folded white-and-rose paper, seen from directly above with
the folded beak nose pointing straight UP — do not reorient. Faceted paper folds: bright white upper
facets, soft cool-shaded under-folds, a rose-pink folded beak tip. LEFT cell: wings spread WIDE.
RIGHT cell: wings folded NARROW (focus pose). Both cells are the same craft in the same paper
material and palette — only the wing spread differs. Keep each cell's exact silhouette, scale and
position from the reference. Inert matte paper only — no engine flame, no exhaust, no glow (the
engine draws those).

### `enemy_body` — alpha part · final 68×68 · GENERATE AT THE REF'S STEEL-BLUE (hue ≈200)
A small moth-spirit familiar seen from directly above: two soft rounded wings spread to the sides in
pale translucent steel-blue washi paper, a plump pale round body between them, and a smaller darker
steel-blue head bead toward the top. Muted STEEL-BLUE palette exactly as the reference (the engine
derives every other enemy color from this hue by rotation — do not shift it toward another hue).
Painterly, soft, slightly ghostly. Keep the reference's wing angle, body and head placement exactly.

### `items` — alpha SHEET 3×2 (used as a sheet — cell registration EXACT) · final 768×512
A sprite sheet of six small talisman charms in a 3-column by 2-row grid on one flat #00ff00 field,
each cell a rounded-square lacquered omamori plaque with a near-black outer rim, a softly graded
jewel-tone face, a subtle paper-sheen band at the top, and its white glyph kept EXACTLY as drawn in
the reference (these six glyphs are an allowed exception to the no-lettering rule — reproduce them,
do not restyle them). Cells, left to right, top row: a vermilion-red "P" charm; a larger
vermilion-red "P" charm; an azure-blue star charm. Bottom row: a rose-pink heart charm; a violet "F"
charm; a jade-teal "B" charm. Keep every cell's exact hue from the reference. CRITICAL: keep the grid
registration exact — every plaque stays at its reference position, size and spacing; do not move,
merge, resize or decorate between cells.

### `title` — OPAQUE full-canvas lockup · final 432×576
A vertical game title screen. Reproduce the reference's lockup EXACTLY as composed: the slim cream
hairline rectangular frame with small inner corner ticks in the upper-middle band; the small
five-petal sakura blossom seated in the gap of the frame's top edge; the large Japanese calligraphy
桜花弾幕 as the hero text (cream fading to deep rose); the fine gold hairline rule with twin gold
lozenges beneath it; and the small wide-tracked roman lettering "SAKURA DANMAKU" below. Reproduce
every glyph stroke-for-stroke at its exact reference position and size — these existing letterforms
are the one allowed exception to the no-text rule; do NOT redesign, restyle, re-letter or add any
text. Replace the flat green placeholder background with deep indigo-black night darkness, with a
few faint drifting sakura petals and the quietest washi-paper grain — very dark and empty so the
lockup carries the frame. Fallback if glyphs mangle: generate only frame/blossom/background and
composite the reference's text band back over.

### `boss_wisp_disc` — alpha part · ext 72 · final 288×288
Five soft petals orbiting a small pale core, seen from directly above: each petal a folded blossom
petal of layered washi paper and silk in muted jade-green, arranged exactly as the reference (their
sizes differ around the orbit — keep each petal's position, tilt and size), around a small plain
ivory-paper disc core. Inert matte paper and silk only — the core is plain pale paper, NOT a light
(the engine draws the green glow). Crisp painterly petal silhouettes.

### `boss_mandala_ring0..ring4` — alpha parts · ext 93/73/55/39/27 · final 372/292/220/156/108
A single ring of carved petals radiating outward from an empty centre, seen flat-on: each petal a
slender sakura-petal blade of deep-rose lacquered shrine carving with fine gold-leaf inlay veins
along the midrib and edges, lacquer grading lighter toward the tip. Keep the reference's EXACT petal
count, length, width and radial arrangement, and keep the centre empty. Matte lacquer and gold leaf,
no glow. *(per ring:)*
- ring0: twelve long petals, deep rose lacquer
- ring1: ten petals, rose-magenta lacquer
- ring2: eight petals, warm magenta-pink lacquer
- ring3: six petals, bright pink lacquer
- ring4: five short petals, pale GOLD lacquer with gold leaf (the reference's warm gold ring)
*(keep each ring's hue exactly as its reference — the rings stack concentrically in-engine)*

### `boss_mandala_core` — alpha part · ext 12 · final 48×48
A small round shrine-jewel core: a pale ivory lacquer disc holding a centred rose-pink gem cabochon,
a fine gold-leaf rim line, carved-ornament precision. Matte lacquer and stone — the gem is polished
but NOT glowing.

### `boss_mizuchi_head` — alpha part · ext 30 · final 120×120
A small water-serpent skull seen from above, snout up: pale weathered bone with a cool jade-green
tint, a bony ridged snout curving up, two slender curved horns sweeping UPWARD from the brow —
keep the reference's horn curves exactly. Fine dark ink contour lines, aged bone texture, jade
patina in the recesses. Eye sockets dark and inert (the engine draws the eye light). No glow.

### `boss_twin_body` — alpha part · ext 40 · final 160×160 · GENERATE AT INDIGO (ref hue 265)
A slender spirit maiden's robed figure seen front-on, upright: an almond/cocoon silhouette of a pale
wisteria-lavender INDIGO kimono in layered washi-silk, with a deeper indigo obi sash band across the
waist. Keep the INDIGO palette exactly as the reference — the engine derives the twin sister's amber
robe from this indigo by hue rotation; do not warm or shift it. No face, no eyes, no hands — a calm
faceless robed silhouette (the engine draws the eyes and all spirit light). Soft bokashi shading down
the robe, fine ink contour. Keep the reference's exact almond silhouette and obi placement.

### `scenery_spring_ground.styleB` — STYLE-KNOB DEMO (opaque tile, STYLE B + same subject/constraints)
Same SUBJECT and opaque CONSTRAINTS as `scenery_spring_ground`, with the STYLE B block instead of v1.
Output staged as `assets/gen/scenery_spring_ground.styleB.png` for later art-direction comparison —
never auto-adopted.

---

## Verification per asset (gen-assets.sh + manual)

- distinct sha256 across all gens (stale-image trap, digest §3.6 #6/#8);
- chroma-strip clean: no green fringe (1px alpha erosion if needed);
- alpha-bbox sanity vs the procedural ref (the engine re-normalizes parts at load; reject only
  unrecognizable/ignored-silhouette gens);
- hue check for `enemy_body` (≈200) and `boss_twin_body` (≈265) — the tint ladders rotate FROM these;
- eyeball a 2× upscaled crop montage of every asset.

---

# BATCH 2 — Stage 4–6 boss parts (executable mirror: `remaster/gen-assets2.sh`)

Same STYLE v1 + alpha CONSTRAINTS blocks as batch 1, verbatim (the chroma-key contract is
unchanged). All eleven assets are alpha parts (`kind:'part'`, final = 4× ext, square). Eyes, cores,
mouths and every "expressive" feature are generated as DARK INERT RECESSES — the engine draws all
light (eye glow, coronas, gold lightning rims, vortex, hair strands, wind curls) over the blit.

### `boss_yamauba_body` — alpha part · ext 44 · final 176×176
A mountain crone seen front-on: a wide torn mantle of dark bark-fiber weave falling to a ragged
three-pointed hem, coarse woven texture with loose frayed strands, and above it a small gaunt
bone-white face — hollow dark sunken eye recesses and a thin inert dark mouth (the engine draws all
eye light). Aged, withered, quiet. Keep the reference's exact silhouette: the small round head
overlapping the mantle's top edge, the broad shoulders, the jagged ripped hem.

### `boss_yatagarasu_body` — alpha part · ext 52 · final 208×208 · WINGLESS (wings are separate parts)
The wingless body of a three-legged sun-crow seen front-on: a round head with a short beak pointing
to the RIGHT — do not reorient — a plump rounded breast, a fan of layered tail feathers spreading
below, and THREE slender legs with spread claw toes between the tail feathers. Lacquered gold-leaf
plumage: layered matte gold feathers with darker antique-gold shading and fine dark ink feather
contours — matte gilded surface, NOT glowing. Keep the reference's exact layout: head on top with
the beak pointing to the RIGHT, body centre, tail fan and three legs below. No wings.

### `boss_yatagarasu_wingL` / `wingR` — alpha parts · ext 92 · final 368×368 each
**Two separate gens of the SAME right-pointing geometry** (the engine mirrors wingL at blit via the
enclosing flip) — keep them near-identical in material and palette. Same SUBJECT for both:
ONE layered feather wing of a gilded sun-crow, pointing to the RIGHT exactly as the reference: the
wing root at the inner left end, broad layered gold-leaf feather vanes sweeping right and tapering
to jagged separated primary tips at the right edge. Matte lacquered gold-leaf plumage with darker
antique-gold shading toward the trailing edge and fine dark ink feather contours — matte gilding,
NOT glowing. Keep the reference's exact off-centre placement, sweep angle and jagged tip silhouette
(the wing joint must stay where the reference puts it).

### `boss_fujin_body` — alpha part · ext 80 · final 320×320
A wind-god seen front-on: a great billowing wind-bag of rough pale grey-teal cloth arching over the
shoulders from end to end — woven hemp texture, soft cloth folds along the arc — with a knotted tie
bobble at each end; beneath it a dark jade-green robe with a ragged pointed hem, and a small
grey-green head with two short pale horns and a fierce inert face of dark recesses (no drawn light —
the engine draws the eyes). Keep the reference's exact composition: the wide arc of the bag above,
the ties at its ends, the horned head at the centre, the robe below.

### `boss_susanoo_body` — alpha part · ext 54 · final 216×216 · NO GOLD ANYWHERE (rims = engine light)
A storm-god's armored torso seen front-on: broad lacquered pauldrons sweeping out to each side, a
heavy armored chest tapering to a jagged armor-skirt hem, and a round steel war-helm above.
Everything in dark steel-blue lacquered plate: matte indigo-steel armor with deep near-black recess
lines between the plates and a faint cold sheen baked as form shading only. ABSOLUTELY NO gold: no
gold edging, no gold trim, no bright rims anywhere — the engine draws the gold lightning rims as
light over this body. Keep the reference's exact silhouette and plate layout.

### `boss_susanoo_sword` — alpha part · ext 68 · final 272×272
A long straight tachi sword pointing straight UP, exactly at the reference's position (blade in the
upper half of the frame, hilt below the centre): a slender dark-steel blade with a single fine ridge
line down its length, a simple small rectangular guard, and a dark wrapped grip with a subtle
criss-cross binding pattern. Matte darkened steel — no gleam, no lightning, no edge glow (the
engine draws the gold lightning edge as light). Keep the reference's exact length, width, placement
and upward orientation.

### `boss_tsuchigumo_abdomen` — alpha part · ext 56 · final 224×224
The bulbous abdomen of a giant earth-spider, seen from above: a rounded oval of dark chitin in the
reference's muted violet-purple, with a faint paler earthen mottled marking where the reference
places its lighter oval patch, fine sparse short hairs along the rim, matte shell with only soft
baked form shading. Keep the reference's exact oval silhouette, patch placement and off-centre
framing.

### `boss_tsuchigumo_ceph` — alpha part · ext 24 · final 96×96
The cephalothorax of a giant earth-spider seen from above: a wide rounded carapace plate of dark
violet-purple chitin with a paler rim, and two folded fangs tucked under the lower edge in slightly
paler aged bone-chitin. Matte shell, faint earthen mottling. Keep the reference's exact silhouette:
the broad rounded plate and the two downward fang lobes at the bottom.

### `boss_tsuchigumo_leg` — alpha part · ext 48 · final 192×192 · ONE canonical leg (instanced 8× in-engine)
ONE jointed leg of a giant earth-spider: from its root at the reference's inner left end, a slender
femur segment extending to the RIGHT, a knee joint, then a thin tapering tibia segment angling
slightly UP and to the right to a fine tip at the frame edge. The whole leg is SLENDER and
stroke-like, exactly as thin as the reference draws it — do not thicken it. Dark violet-purple
chitin with fine short hairs along the segments and a paler joint ring at the knee. Matte shell.
Keep the reference's exact segment angles, thinness, shallow bend, off-centre placement and reach.

### `boss_tokoyo_disc` — alpha part · ext 48 · final 192×192 · HARD OCCLUDER (source-over blit)
The black sun: one perfect circle filling the frame as the reference does — a matte near-black
obsidian disc with only the faintest dark stone grain, uniformly near-black from centre to rim,
crisp circular edge. ABSOLUTELY no corona, no rim light, no halo, no edge brightening, no highlights
of any kind — this disc occludes light in-engine and must stay near-black matte to the very rim.

### `scenery_bamboo_fog0..2` — OPTIONAL alpha tiles · native 432×120 each
Procedural source = 4 radial fog puffs at ≤0.15 alpha — G1 warned such faint translucent sprites
export near-invisible refs. Export refs first; if a ref shows <5% subject pixels, SKIP (noted in the
batch report rather than forced).
