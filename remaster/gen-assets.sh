#!/usr/bin/env bash
# Batch-generate the Sakura Danmaku remaster batch-1 raster set via codex's built-in image_gen.
# Mirrors remaster/i2i-prompts.md. STAGING ONLY: writes remaster/assets/gen/ — NEVER remaster/assets/.
#
# Usage:
#   remaster/gen-assets.sh                       # everything missing (idempotent per name)
#   remaster/gen-assets.sh enemy_body title      # just those
#   FORCE=1 remaster/gen-assets.sh enemy_body    # re-gen even if present
#
# Refs come from remaster/refs/<name>.ref.png (exported via index.html?ref=<name>&size=768).
# Alpha subjects are generated on flat #00ff00 and stripped locally (remove_chroma_key.py).
# Each asset lands at its FINAL in-engine size: parts = 4x ext, tiles/sheets/title = native dims.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"                       # remaster/
IMGGEN="/home/puniu/procedural-i2i/tools/imggen.sh"
REMOVE_KEY="${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py"
REF_DIR="$ROOT/refs"
OUT_DIR="${OUT_DIR:-$ROOT/assets/gen}"
RAW_DIR="$OUT_DIR/.raw"                                     # keyed model outputs kept for inspection/re-slice
mkdir -p "$OUT_DIR" "$RAW_DIR"

# ── STYLE v1: the one re-art-direction knob (see i2i-prompts.md).
STYLE=$(cat <<'EOF'
Japanese folklore dark-fantasy game art in a refined ukiyo-e-inspired painterly style: muted jewel-tone color fields over deep indigo darkness, subtle washi-paper grain, fine dark ink contour lines, soft bokashi gradient shading, restrained gold-leaf accents. Matte non-emissive surfaces, crisp painterly silhouettes. No text, no lettering, no watermark.
EOF
)
# STYLE B — flat woodblock demo (only used for scenery_spring_ground.styleB).
STYLE_B=$(cat <<'EOF'
Japanese woodblock-print game art in a pure flat-color ukiyo-e style: completely flat solid color fields with no gradients, bold carved dark ink outlines, a limited muted palette over deep indigo darkness, visible washi-paper texture, decorative flat stylization like an Edo-period print. No text, no lettering, no watermark.
EOF
)

CONSTRAINTS_KEY=$(cat <<'EOF'
Keep the reference's exact silhouette, proportions, pose, framing, scale and centred position — the reference defines the composition. Render soft baked form shading only; no scene lighting, no cast shadows. ABSOLUTELY NO emissive light: no glow, halo, flame, beam, spark, lens flare, or glowing parts — the engine draws all light separately. Place the subject on a PERFECTLY FLAT SOLID #00ff00 chroma-key background: one uniform green, no gradient, no texture, no shadows, no reflections. Never use #00ff00 anywhere on the subject. No scene, no ground plane, no border, no frame, no text, no UI. Single centred subject filling the same area as the reference, crisp edges.
EOF
)
CONSTRAINTS_OPAQUE=$(cat <<'EOF'
Keep the reference's exact composition, layout, framing and proportions — the reference defines the composition. Render soft baked form shading only; no scene lighting, no cast shadows. ABSOLUTELY NO emissive light: no glow, halo, flame, beam, spark, lens flare — the engine draws all light separately. Fill the whole frame edge-to-edge, fully opaque. Keep it DARK and LOW-CONTRAST overall — this sits under gameplay seen through a dark veil and bright bullets must read on top. No border, no frame ornament beyond the reference's own, no added text, no UI, no watermark.
EOF
)

# ── SUBJECTS (verbatim from i2i-prompts.md) ─────────────────────────────────
SUBJ_ground=$(cat <<'EOF'
A ground tile for a vertical scrolling playfield seen from directly above: a soft spring meadow lane, an irregular patchwork of mossy grass fields and worn earth patches with faint stone seams, drifts of fallen pale-pink sakura petals scattered between the patches. Keep the reference's exact patch layout and palette placement, only enriched with painterly texture. CRITICAL: the image must tile seamlessly in the vertical direction — the TOP edge must continue perfectly into the BOTTOM edge with no visible seam; design the patch layout so no slab, stone or petal drift is cut off at the top or bottom edge (a wrap-seam post-fix exists, but author for the wrap). Even, quiet, low-contrast, no focal point, no objects, no creatures.
EOF
)
canopy_mat() { case "$1" in
  scenery_spring_canopy0) echo "young pale blossoms just opening, a hint of fresh green leaves between the clusters" ;;
  scenery_spring_canopy1) echo "full dense peak bloom, pure layered rose-pink petals" ;;
  scenery_spring_canopy2) echo "deeper dusk-rose shaded blossoms, slightly darker and heavier clusters" ;; esac; }
SUBJ_canopy=$(cat <<'EOF'
A single sakura cherry-tree crown seen from directly above: a round blossom canopy of layered petal clusters in muted rose-pink — %MAT% — lobed cluster mounds around a denser centre, painterly washi-silk petal texture, soft irregular outer edge. Keep the reference's round top-down silhouette and lobed cluster placement exactly.
EOF
)
SUBJ_lantern=$(cat <<'EOF'
A small roadside stone lantern (ishidoro) seen from directly above: the round weathered grey stone roof cap with a pale cream paper window ring and a small warm-amber centre painted as flat matte color — NOT glowing, no halo, no rays (the warm centre is paint, not light). Mossy aged stone rim. Keep the reference's tiny round top-down silhouette exactly.
EOF
)
SUBJ_stream=$(cat <<'EOF'
A horizontal stream of spring water crossing the full width, seen from directly above: a wide soft ribbon of pale blue-cyan water with a faint diagonal painted current streak (matte paint, not a light glint), soft feathered top and bottom edges that dissolve away to nothing. Painterly flat water in the bokashi manner, muted, calm. Keep the reference's band placement, thickness and the diagonal current direction exactly.
EOF
)
SUBJ_player_sheet=$(cat <<'EOF'
A sprite sheet with exactly TWO cells side by side on one flat #00ff00 field, each cell the SAME small origami-crane spirit-ship of crisply folded white-and-rose paper, seen from directly above with the folded beak nose pointing straight UP — do not reorient. Faceted paper folds: bright white upper facets, soft cool-shaded under-folds, a rose-pink folded beak tip. LEFT cell: wings spread WIDE. RIGHT cell: wings folded NARROW (focus pose). Both cells are the same craft in the same paper material and palette — only the wing spread differs. Keep each cell's exact silhouette, scale and position from the reference. Inert matte paper only — no engine flame, no exhaust, no glow (the engine draws those).
EOF
)
SUBJ_enemy=$(cat <<'EOF'
A small moth-spirit familiar seen from directly above: two soft rounded wings spread to the sides in pale translucent steel-blue washi paper, a plump pale round body between them, and a smaller darker steel-blue head bead toward the top. Muted STEEL-BLUE palette exactly as the reference (the engine derives every other enemy color from this hue by rotation — do not shift it toward another hue). Painterly, soft, slightly ghostly. Keep the reference's wing angle, body and head placement exactly.
EOF
)
SUBJ_items=$(cat <<'EOF'
A sprite sheet of six small talisman charms in a 3-column by 2-row grid on one flat #00ff00 field, each cell a rounded-square lacquered omamori plaque with a near-black outer rim, a softly graded jewel-tone face, a subtle paper-sheen band at the top, and its white glyph kept EXACTLY as drawn in the reference (these six glyphs are an allowed exception to the no-lettering rule — reproduce them, do not restyle them). Cells, left to right, top row: a vermilion-red "P" charm; a larger vermilion-red "P" charm; an azure-blue star charm. Bottom row: a rose-pink heart charm; a violet "F" charm; a jade-teal "B" charm. Keep every cell's exact hue from the reference. CRITICAL: keep the grid registration exact — every plaque stays at its reference position, size and spacing; do not move, merge, resize or decorate between cells.
EOF
)
SUBJ_title=$(cat <<'EOF'
A vertical game title screen. Reproduce the reference's lockup EXACTLY as composed: the slim cream hairline rectangular frame with small inner corner ticks in the upper-middle band; the small five-petal sakura blossom seated in the gap of the frame's top edge; the large Japanese calligraphy 桜花弾幕 as the hero text (cream fading to deep rose); the fine gold hairline rule with twin gold lozenges beneath it; and the small wide-tracked roman lettering "SAKURA DANMAKU" below. Reproduce every glyph stroke-for-stroke at its exact reference position and size — these existing letterforms are the one allowed exception to the no-text rule; do NOT redesign, restyle, re-letter or add any text. Replace the flat green placeholder background with deep indigo-black night darkness, with a few faint small drifting sakura petals and the quietest washi-paper grain — very dark and EMPTY so the lockup carries the frame. The background must contain NOTHING else: no moon, no sun, no light source, no figures, no people, no animals, no fox, no architecture, no torii, no trees, no flowers, no scenery of any kind — only darkness, faint petals, paper grain.
EOF
)
SUBJ_wisp=$(cat <<'EOF'
Five soft petals orbiting a small pale core, seen from directly above: each petal a folded blossom petal of layered washi paper and silk in muted JADE-GREEN (HSV hue ≈148 degrees, clearly green, exactly the reference's green — do NOT desaturate it, do NOT shift it toward blue, grey or metal tones), arranged exactly as the reference (their sizes differ around the orbit — keep each petal's position, tilt and size), around a small plain ivory-paper disc core. Soft matte paper and silk ONLY — no metalwork, no filigree, no gold veins; the core is plain pale paper, NOT a light (the engine draws the green glow). Crisp painterly petal silhouettes.
EOF
)
ring_desc() { case "$1" in
  boss_mandala_ring0) echo "twelve long petals, deep ROSE-PINK lacquer (HSV hue ≈333 degrees — pink, NOT red, NOT crimson; match the reference hue exactly)" ;;
  boss_mandala_ring1) echo "ten petals, MAGENTA lacquer (HSV hue ≈317 degrees — magenta-pink, NOT coral, NOT red; match the reference hue exactly)" ;;
  boss_mandala_ring2) echo "eight petals, ORCHID-VIOLET-PINK lacquer (HSV hue ≈300 degrees — orchid, NOT raspberry, NOT red; match the reference hue exactly)" ;;
  boss_mandala_ring3) echo "six petals, bright VIOLET-PINK lacquer (HSV hue ≈288 degrees — violet-leaning pink, NOT warm pink, NOT red; match the reference hue exactly)" ;;
  boss_mandala_ring4) echo "five short petals, pale GOLD lacquer with gold leaf (the reference's warm gold ring); keep the reference's smooth notch-tipped sakura-petal shape — do NOT redraw them as pointed veined leaves" ;; esac; }
SUBJ_ring=$(cat <<'EOF'
A single ring of carved petals radiating outward from an empty centre, seen flat-on: %DESC%. Each petal a slender sakura-petal blade of lacquered shrine carving with fine gold-leaf inlay veins along the midrib and edges, lacquer grading lighter toward the tip. Keep the reference's EXACT petal count, length, width, radial arrangement and hue, and keep the centre empty (the rings stack concentrically in-engine). Matte lacquer and gold leaf, no glow.
EOF
)
SUBJ_mcore=$(cat <<'EOF'
A small round shrine-jewel core: a pale ivory lacquer disc holding a centred rose-pink gem cabochon, a fine gold-leaf rim line, carved-ornament precision. Matte lacquer and stone — the gem is polished but NOT glowing.
EOF
)
SUBJ_mizuchi=$(cat <<'EOF'
A small water-serpent skull seen from above, snout up: pale weathered bone with a cool jade-green tint, a bony ridged snout curving up, two slender curved horns sweeping UPWARD from the brow — keep the reference's horn curves exactly. Fine dark ink contour lines, aged bone texture, jade patina in the recesses. Eye sockets dark and inert (the engine draws the eye light). No glow.
EOF
)
SUBJ_twin=$(cat <<'EOF'
A slender spirit maiden's robed figure seen front-on, upright: an almond/cocoon silhouette of a pale wisteria-lavender INDIGO kimono in layered washi-silk, with a deeper indigo obi sash band across the waist. Keep the INDIGO palette exactly as the reference — the engine derives the twin sister's amber robe from this indigo by hue rotation; do not warm or shift it. No face, no eyes, no hands — a calm faceless robed silhouette (the engine draws the eyes and all spirit light). Soft bokashi shading down the robe, fine ink contour. Keep the reference's exact almond silhouette and obi placement.
EOF
)

# ── final sizes: parts = 4x ext (square); tiles/sheets/title = native registry dims ─────
final_size() { case "$1" in
  player_free|player_focus)       echo 56x56 ;;     # ext 14
  enemy_body)                     echo 68x68 ;;     # ext 17
  boss_wisp_disc)                 echo 288x288 ;;   # ext 72
  boss_mandala_ring0)             echo 372x372 ;;   # ext 93
  boss_mandala_ring1)             echo 292x292 ;;   # ext 73
  boss_mandala_ring2)             echo 220x220 ;;   # ext 55
  boss_mandala_ring3)             echo 156x156 ;;   # ext 39
  boss_mandala_ring4)             echo 108x108 ;;   # ext 27
  boss_mandala_core)              echo 48x48 ;;     # ext 12
  boss_mizuchi_head)              echo 120x120 ;;   # ext 30
  boss_twin_body)                 echo 160x160 ;;   # ext 40
  scenery_spring_canopy0|scenery_spring_canopy1|scenery_spring_canopy2) echo 46x46 ;;
  scenery_spring_lantern)         echo 16x16 ;;
  scenery_spring_stream)          echo 572x96 ;;
  scenery_spring_ground|scenery_spring_ground.styleB) echo 432x608 ;;
  items)                          echo 768x512 ;;
  title)                          echo 432x576 ;;
  *) echo "" ;; esac; }

have() { [ -z "${FORCE:-}" ] && [ -f "$OUT_DIR/$1.png" ]; }
strip_key() { # keyed.png out.png  — chroma → alpha (soft matte + despill)
  python3 "$REMOVE_KEY" --input "$1" --out "$2" \
    --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill --force
}

# Generate one alpha part/tile: chroma-key gen -> strip -> downscale to final size.
gen_alpha() { # name subject [extra_trim]
  local name="$1" subject="$2" trim="${3:-}"
  local ref="$REF_DIR/$name.ref.png"
  have "$name" && { echo "=== $name: exists, skip (FORCE=1 to regen)"; return 0; }
  [ -f "$ref" ] || { echo "!! $name: missing ref $ref" >&2; return 1; }
  local prompt="${STYLE}"$'\n\n'"${subject}"$'\n\n'"${CONSTRAINTS_KEY}"
  local keyed="$RAW_DIR/$name.keyed.png" sz; sz="$(final_size "$name")"
  echo "=== $name (alpha, ref=$(basename "$ref"), final $sz)"
  "$IMGGEN" "$prompt" "$keyed" "" "$ref"
  strip_key "$keyed" "$OUT_DIR/$name.png"
  if [ "$trim" = "trim" ]; then convert "$OUT_DIR/$name.png" -trim +repage "$OUT_DIR/$name.png"; fi
  convert "$OUT_DIR/$name.png" -resize "${sz}!" "$OUT_DIR/$name.png"
  echo "    -> $OUT_DIR/$name.png ($(identify -format '%wx%h' "$OUT_DIR/$name.png"))"
}

# Generate one opaque asset (ground tile / title / styleB demo): direct, stretch to final dims.
gen_opaque() { # name refname subject style
  local name="$1" ref="$REF_DIR/$2" subject="$3" style="$4"
  have "$name" && { echo "=== $name: exists, skip"; return 0; }
  [ -f "$ref" ] || { echo "!! $name: missing ref $ref" >&2; return 1; }
  local prompt="${style}"$'\n\n'"${subject}"$'\n\n'"${CONSTRAINTS_OPAQUE}"
  local sz; sz="$(final_size "$name")"
  echo "=== $name (opaque, ref=$(basename "$ref"), final $sz)"
  "$IMGGEN" "$prompt" "$RAW_DIR/$name.raw.png" "" "$ref"
  convert "$RAW_DIR/$name.raw.png" -resize "${sz}!" "$OUT_DIR/$name.png"
  echo "    -> $OUT_DIR/$name.png ($(identify -format '%wx%h' "$OUT_DIR/$name.png"))"
}

# Player JOINT SHEET: one gen over the 2-cell montage ref, slice halves, per-cell trim+square-pad.
# (Multi-frame consistency rule: never generate the two wing states separately.)
gen_player() {
  if have player_free && have player_focus; then echo "=== player: both exist, skip"; return 0; fi
  local ref="$REF_DIR/player_sheet.ref.png"
  [ -f "$ref" ] || { echo "!! player: missing joint-sheet ref $ref (montage player_free + player_focus)" >&2; return 1; }
  local prompt="${STYLE}"$'\n\n'"${SUBJ_player_sheet}"$'\n\n'"${CONSTRAINTS_KEY}"
  local keyed="$RAW_DIR/player_sheet.keyed.png" stripped="$RAW_DIR/player_sheet.alpha.png"
  echo "=== player_free + player_focus (JOINT sheet, one gen)"
  "$IMGGEN" "$prompt" "$keyed" "" "$ref"
  strip_key "$keyed" "$stripped"
  convert "$stripped" -crop 50%x100% +repage "$RAW_DIR/psheet_cell_%d.png"
  local cells=(player_free player_focus) i
  for i in 0 1; do
    local n="${cells[$i]}"
    convert "$RAW_DIR/psheet_cell_$i.png" -trim +repage -resize 52x52 \
            -background none -gravity center -extent 56x56 "$OUT_DIR/$n.png"
    echo "    -> $OUT_DIR/$n.png ($(identify -format '%wx%h' "$OUT_DIR/$n.png"))"
  done
}

run_one() { case "$1" in
  scenery_spring_ground)        gen_opaque "$1" scenery_spring_ground.ref.png "$SUBJ_ground" "$STYLE" ;;
  scenery_spring_ground.styleB) gen_opaque "$1" scenery_spring_ground.ref.png "$SUBJ_ground" "$STYLE_B" ;;
  scenery_spring_canopy0|scenery_spring_canopy1|scenery_spring_canopy2)
                                gen_alpha "$1" "${SUBJ_canopy/\%MAT\%/$(canopy_mat "$1")}" ;;
  scenery_spring_lantern)       gen_alpha "$1" "$SUBJ_lantern" ;;
  scenery_spring_stream)        gen_alpha "$1" "$SUBJ_stream" trim ;;
  player)                       gen_player ;;
  enemy_body)                   gen_alpha "$1" "$SUBJ_enemy" ;;
  items)                        gen_alpha "$1" "$SUBJ_items" ;;
  title)                        gen_opaque "$1" title.ref.png "$SUBJ_title" "$STYLE" ;;
  boss_wisp_disc)               gen_alpha "$1" "$SUBJ_wisp" ;;
  boss_mandala_ring0|boss_mandala_ring1|boss_mandala_ring2|boss_mandala_ring3|boss_mandala_ring4)
                                gen_alpha "$1" "${SUBJ_ring/\%DESC\%/$(ring_desc "$1")}" ;;
  boss_mandala_core)            gen_alpha "$1" "$SUBJ_mcore" ;;
  boss_mizuchi_head)            gen_alpha "$1" "$SUBJ_mizuchi" ;;
  boss_twin_body)               gen_alpha "$1" "$SUBJ_twin" ;;
  *) echo "!! unknown asset: $1" >&2; return 1 ;; esac; }

ALL=(scenery_spring_ground scenery_spring_canopy0 scenery_spring_canopy1 scenery_spring_canopy2
     scenery_spring_lantern scenery_spring_stream player enemy_body items title
     boss_wisp_disc boss_mandala_ring0 boss_mandala_ring1 boss_mandala_ring2 boss_mandala_ring3
     boss_mandala_ring4 boss_mandala_core boss_mizuchi_head boss_twin_body scenery_spring_ground.styleB)
ASSETS=("$@"); [ ${#ASSETS[@]} -eq 0 ] && ASSETS=("${ALL[@]}")

echo "=== gen-assets (remaster batch 1): ${ASSETS[*]} -> $OUT_DIR @ $(date -u +%H:%M:%S) ==="
FAILED=()
for a in "${ASSETS[@]}"; do run_one "$a" || FAILED+=("$a"); done
echo "=== done @ $(date -u +%H:%M:%S) ==="
[ ${#FAILED[@]} -gt 0 ] && { echo "FAILED: ${FAILED[*]}" >&2; exit 1; }
ls -la "$OUT_DIR"
