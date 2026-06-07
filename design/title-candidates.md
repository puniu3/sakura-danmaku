# Title candidates (roadmap F)

> Proposal only. Incumbent favorite = **Sakura Danmaku** (owner already likes it). CJK-free policy:
> the readable *name* must be romaji/English; `桜花弾幕` may stay as decorative art only.
> Current title screen hard-codes 52px `桜花弾幕` + 13px romaji subtitle at `index.html:2724`.

## Ranked shortlist (critic scores, 0–10)

| # | name | score | one-line verdict | collision |
| --- | --- | --- | --- | --- |
| 1 | **Sakura Danmaku** | 7.5 | Pragmatic winner: self-tags the exact niche (`sakura` = top JP loanword + `danmaku` = the search tag). Moderate brandability, near-max theme/genre signal, already built. | genre-term dilution, no dominant clash |
| 1= | **Petalfall** | 7.5 | Only candidate that out-brands the incumbent: coined compound, petals-falling = bullet *curtain* double meaning, trademark-clean, worldwide-pronounceable. Loses only on genre signal → needs a `danmaku` subtitle. | none known |
| 3 | Sakura Veil | 6.5 | Best `Sakura + X` hybrid: "Veil" = veil of petals / the *curtain* in bullet-curtain / dusk. Elegant, easy. Held back by `Sakura + noun` crowding; pun invisible to newcomers. | "Veil" diluted in fantasy titles |
| 4 | Sakura Requiem | 5.5 | Elegiac dusk→dawn register, pronounceable. But "Requiem" is one of the most over-used title words, and it drops the explicit bullet-hell signal. | "… Requiem" everywhere |
| 5 | Hanabira | 4.5 | "flower petal", authentic + ownable in search. Pays the indie memorability tax: 4 syllables most Westerners won't retain/say; no genre signal. | none known |
| 6 | Yoiyami | 4.0 | Asset tie-in ("Yoiyami Lane" is an in-game BGM title) but opaque to Western players; signals neither sakura nor shmup; carries no petal image. | none known |
| 7 | Akegata | 3.5 | Most thematically precise (names the dawn destination) but weakest on every selling metric; over-claims an asset tie (dawn tracks are "First Light Road"/"Daybreak", no "Akegata" asset). | none known |
| 8 | Dusk to Dawn Petals | 3.0 | Honest description of the 6-stage spine, but clumsy 3-word lockup and the strong off-theme "From Dusk Till Dawn" (vampire franchise) pull. Subtitle material, not a title. | "From Dusk Till Dawn" film/franchise |

## Recommendation

**Keep "Sakura Danmaku" as the primary title.** For an unmarketed itch.io game found via tags/search,
discoverability beats elegance — it's the only name that simultaneously self-classifies into the
Touhou-like niche (`danmaku`) and uses the highest-recognition Japanese aesthetic word (`sakura`), and it's
already a built asset. No challenger clears it decisively.

If you ever want to A/B one alternative: **Petalfall** is the standout coinage (would need a `danmaku`
subtitle to do the incumbent's genre-signalling job); **Sakura Veil** is the safest pure refinement.

## CJK handling on the title screen

Keep `桜花弾幕` as **decorative art only**, demoted from the nameplate:

1. Promote the romaji **SAKURA DANMAKU** to the large hero lockup (today it's the reverse: 52px kanji +
   13px romaji subtitle).
2. Render `桜花弾幕` as a softer subordinate flourish — faint watermark / vertical side-stamp / glowing
   accent beneath the English — clearly art, not the title.
3. Set the HTML `<title>` + any storefront metadata to pure romaji "Sakura Danmaku" (current
   `<title>桜花弾幕 — Sakura Danmaku</title>` should lead with romaji or drop the kanji for clean tab/SEO).

Net: drop CJK from anything that *functions as* the name (HTML title, store listing, what the eye reads
first); keep CJK only as deliberate decoration. Fully-CJK-free fallback: drop the kanji entirely, replace
with a romaji-English hero lockup + a sakura-petal motif.
