#!/usr/bin/env bash
# Batch-generate the Sakura Danmaku remaster BATCH-2 raster set (Stage 4-6 boss parts) via codex's
# built-in image_gen. Mirrors remaster/i2i-prompts.md "BATCH 2". STAGING ONLY: writes
# remaster/assets/gen/ — NEVER remaster/assets/.
#
# Usage:
#   remaster/gen-assets2.sh                            # everything missing (idempotent per name)
#   remaster/gen-assets2.sh boss_yamauba_body          # just those
#   FORCE=1 remaster/gen-assets2.sh boss_tokoyo_disc   # re-gen even if present
#
# Refs come from remaster/refs/<name>.ref.png (exported via index.html?ref=<name>&size=768).
# Alpha subjects are generated on flat #00ff00 and stripped locally (remove_chroma_key.py).
# Each asset lands at its FINAL in-engine size: parts = 4x ext (square).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"                       # remaster/
IMGGEN="/home/puniu/procedural-i2i/tools/imggen.sh"
REMOVE_KEY="${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py"
REF_DIR="$ROOT/refs"
OUT_DIR="${OUT_DIR:-$ROOT/assets/gen}"
RAW_DIR="$OUT_DIR/.raw"                                     # keyed model outputs kept for inspection/re-slice
mkdir -p "$OUT_DIR" "$RAW_DIR"

# ── STYLE v1: the one re-art-direction knob (verbatim from i2i-prompts.md / gen-assets.sh).
STYLE=$(cat <<'EOF'
Japanese folklore dark-fantasy game art in a refined ukiyo-e-inspired painterly style: muted jewel-tone color fields over deep indigo darkness, subtle washi-paper grain, fine dark ink contour lines, soft bokashi gradient shading, restrained gold-leaf accents. Matte non-emissive surfaces, crisp painterly silhouettes. No text, no lettering, no watermark.
EOF
)

CONSTRAINTS_KEY=$(cat <<'EOF'
Keep the reference's exact silhouette, proportions, pose, framing, scale and centred position — the reference defines the composition. Render soft baked form shading only; no scene lighting, no cast shadows. ABSOLUTELY NO emissive light: no glow, halo, flame, beam, spark, lens flare, or glowing parts — the engine draws all light separately. Place the subject on a PERFECTLY FLAT SOLID #00ff00 chroma-key background: one uniform green, no gradient, no texture, no shadows, no reflections. Never use #00ff00 anywhere on the subject. No scene, no ground plane, no border, no frame, no text, no UI. Single centred subject filling the same area as the reference, crisp edges.
EOF
)

# ── SUBJECTS (verbatim from i2i-prompts.md BATCH 2) ─────────────────────────
SUBJ_yamauba_body=$(cat <<'EOF'
A mountain crone seen front-on: a wide torn mantle of dark bark-fiber weave falling to a ragged three-pointed hem, coarse woven texture with loose frayed strands, and above it a small gaunt bone-white face — hollow dark sunken eye recesses and a thin inert dark mouth (the engine draws all eye light). Aged, withered, quiet. Keep the reference's exact silhouette: the small round head overlapping the mantle's top edge, the broad shoulders, the jagged ripped hem.
EOF
)
SUBJ_yata_body=$(cat <<'EOF'
The wingless body of a three-legged sun-crow seen front-on: a round head with a short beak pointing to the RIGHT — do not reorient — a plump rounded breast, a fan of layered tail feathers spreading below, and THREE slender legs with spread claw toes between the tail feathers. Lacquered gold-leaf plumage: layered matte gold feathers with darker antique-gold shading and fine dark ink feather contours — matte gilded surface, NOT glowing. Keep the reference's exact layout: head on top with the beak pointing to the RIGHT, body centre, tail fan and three legs below. No wings.
EOF
)
# wingL/wingR: TWO separate gens of the SAME right-pointing geometry (engine mirrors wingL at blit);
# same SUBJECT for both — keep them near-identical in material.
SUBJ_yata_wing=$(cat <<'EOF'
ONE layered feather wing of a gilded sun-crow, pointing to the RIGHT exactly as the reference: the wing root at the inner left end, broad layered gold-leaf feather vanes sweeping right and tapering to jagged separated primary tips at the right edge. Matte lacquered gold-leaf plumage with darker antique-gold shading toward the trailing edge and fine dark ink feather contours — matte gilding, NOT glowing. Keep the reference's exact off-centre placement, sweep angle and jagged tip silhouette (the wing joint must stay where the reference puts it).
EOF
)
SUBJ_fujin_body=$(cat <<'EOF'
A wind-god seen front-on: a great billowing wind-bag of rough pale grey-teal cloth arching over the shoulders from end to end — woven hemp texture, soft cloth folds along the arc — with a knotted tie bobble at each end; beneath it a dark jade-green robe with a ragged pointed hem, and a small grey-green head with two short pale horns and a fierce inert face of dark recesses (no drawn light — the engine draws the eyes). Keep the reference's exact composition: the wide arc of the bag above, the ties at its ends, the horned head at the centre, the robe below.
EOF
)
SUBJ_susanoo_body=$(cat <<'EOF'
A storm-god's armored torso seen front-on: broad lacquered pauldrons sweeping out to each side, a heavy armored chest tapering to a jagged armor-skirt hem, and a round steel war-helm above. Everything in dark steel-blue lacquered plate: matte indigo-steel armor with deep near-black recess lines between the plates and a faint cold sheen baked as form shading only. ABSOLUTELY NO gold: no gold edging, no gold trim, no bright rims anywhere — the engine draws the gold lightning rims as light over this body. Keep the reference's exact silhouette and plate layout.
EOF
)
SUBJ_susanoo_sword=$(cat <<'EOF'
A long straight tachi sword pointing straight UP, exactly at the reference's position (blade in the upper half of the frame, hilt below the centre): a slender dark-steel blade with a single fine ridge line down its length, a simple small rectangular guard, and a dark wrapped grip with a subtle criss-cross binding pattern. Matte darkened steel — no gleam, no lightning, no edge glow (the engine draws the gold lightning edge as light). Keep the reference's exact length, width, placement and upward orientation.
EOF
)
SUBJ_tsuchi_abdomen=$(cat <<'EOF'
The bulbous abdomen of a giant earth-spider, seen from above: a rounded oval of dark chitin in the reference's muted violet-purple, with a faint paler earthen mottled marking where the reference places its lighter oval patch, fine sparse short hairs along the rim, matte shell with only soft baked form shading. Keep the reference's exact oval silhouette, patch placement and off-centre framing.
EOF
)
SUBJ_tsuchi_ceph=$(cat <<'EOF'
The cephalothorax of a giant earth-spider seen from above: a wide rounded carapace plate of dark violet-purple chitin with a paler rim, and two folded fangs tucked under the lower edge in slightly paler aged bone-chitin. Matte shell, faint earthen mottling. Keep the reference's exact silhouette: the broad rounded plate and the two downward fang lobes at the bottom.
EOF
)
SUBJ_tsuchi_leg=$(cat <<'EOF'
ONE jointed leg of a giant earth-spider: from its root at the reference's inner left end, a slender femur segment extending to the RIGHT, a knee joint, then a thin tapering tibia segment angling slightly UP and to the right to a fine tip at the frame edge. The whole leg is SLENDER and stroke-like, exactly as thin as the reference draws it — do not thicken it. Dark violet-purple chitin with fine short hairs along the segments and a paler joint ring at the knee. Matte shell. Keep the reference's exact segment angles, thinness, shallow bend, off-centre placement and reach.
EOF
)
SUBJ_tokoyo_disc=$(cat <<'EOF'
The black sun: one perfect circle filling the frame as the reference does — a matte near-black obsidian disc with only the faintest dark stone grain, uniformly near-black from centre to rim, crisp circular edge. ABSOLUTELY no corona, no rim light, no halo, no edge brightening, no highlights of any kind — this disc occludes light in-engine and must stay near-black matte to the very rim.
EOF
)
# OPTIONAL fog tiles (only run by explicit name; refs may be near-invisible — see i2i-prompts.md).
SUBJ_bamboo_fog=$(cat <<'EOF'
A wide horizontal band of faint drifting night mist between bamboo: a few soft pale sage-green fog puffs, extremely translucent and quiet, dissolving to nothing at every edge. Matte painterly haze in the bokashi manner — no light, no glow. Keep the reference's exact puff placement and the band's full-width framing.
EOF
)

# ── final sizes: parts = 4x ext (square); fog tiles = native 432x120 ────────
final_size() { case "$1" in
  boss_yamauba_body)        echo 176x176 ;;   # ext 44
  boss_yatagarasu_body)     echo 208x208 ;;   # ext 52
  boss_yatagarasu_wingL|boss_yatagarasu_wingR) echo 368x368 ;;   # ext 92
  boss_fujin_body)          echo 320x320 ;;   # ext 80
  boss_susanoo_body)        echo 216x216 ;;   # ext 54
  boss_susanoo_sword)       echo 272x272 ;;   # ext 68
  boss_tsuchigumo_abdomen)  echo 224x224 ;;   # ext 56
  boss_tsuchigumo_ceph)     echo 96x96 ;;     # ext 24
  boss_tsuchigumo_leg)      echo 192x192 ;;   # ext 48
  boss_tokoyo_disc)         echo 192x192 ;;   # ext 48
  scenery_bamboo_fog0|scenery_bamboo_fog1|scenery_bamboo_fog2) echo 432x120 ;;
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

run_one() { case "$1" in
  boss_yamauba_body)        gen_alpha "$1" "$SUBJ_yamauba_body" ;;
  boss_yatagarasu_body)     gen_alpha "$1" "$SUBJ_yata_body" ;;
  boss_yatagarasu_wingL|boss_yatagarasu_wingR) gen_alpha "$1" "$SUBJ_yata_wing" ;;
  boss_fujin_body)          gen_alpha "$1" "$SUBJ_fujin_body" ;;
  boss_susanoo_body)        gen_alpha "$1" "$SUBJ_susanoo_body" ;;
  boss_susanoo_sword)       gen_alpha "$1" "$SUBJ_susanoo_sword" ;;
  boss_tsuchigumo_abdomen)  gen_alpha "$1" "$SUBJ_tsuchi_abdomen" ;;
  boss_tsuchigumo_ceph)     gen_alpha "$1" "$SUBJ_tsuchi_ceph" ;;
  boss_tsuchigumo_leg)      gen_alpha "$1" "$SUBJ_tsuchi_leg" ;;
  boss_tokoyo_disc)         gen_alpha "$1" "$SUBJ_tokoyo_disc" ;;
  scenery_bamboo_fog0|scenery_bamboo_fog1|scenery_bamboo_fog2)
                            gen_alpha "$1" "$SUBJ_bamboo_fog" ;;   # OPTIONAL — by explicit name only
  *) echo "!! unknown asset: $1" >&2; return 1 ;; esac; }

ALL=(boss_yamauba_body boss_yatagarasu_body boss_yatagarasu_wingL boss_yatagarasu_wingR
     boss_fujin_body boss_susanoo_body boss_susanoo_sword
     boss_tsuchigumo_abdomen boss_tsuchigumo_ceph boss_tsuchigumo_leg boss_tokoyo_disc)
ASSETS=("$@"); [ ${#ASSETS[@]} -eq 0 ] && ASSETS=("${ALL[@]}")

echo "=== gen-assets2 (remaster batch 2): ${ASSETS[*]} -> $OUT_DIR @ $(date -u +%H:%M:%S) ==="
FAILED=()
for a in "${ASSETS[@]}"; do run_one "$a" || FAILED+=("$a"); done
echo "=== done @ $(date -u +%H:%M:%S) ==="
[ ${#FAILED[@]} -gt 0 ] && { echo "FAILED: ${FAILED[*]}" >&2; exit 1; }
ls -la "$OUT_DIR"
