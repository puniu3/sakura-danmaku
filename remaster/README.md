# Sakura Danmaku — Remaster

リマスター版。元の `../index.html` とは**完全分離**(元版・CI・golden には一切手を入れない)。
二つの実験の結論をそのまま実装したもの:

- **グラフィック** — `/home/puniu/procedural-i2i` の検証済み二層契約:
  **Diffuse(物体面)= ラスター**(手続き描画を参照画像にした i2i 生成、`assets/` から差し替え)/
  **Light(加算光: 弾・グロー・コロナ・レーザー・パーティクル)= 手続きのまま**。
  フレーム差し替えアニメは禁止(texture boil)— ラスターはリグ変換で動かす。
- **サウンド** — `/home/puniu/compose` の検証済みボイスレシピ(FM マレット/ファットソー弦/
  ビブラート管/Karplus ハープ/和太鼓・銅鑼/ホール+ピンポンディレイ/マスタリング)を
  **素の Web Audio に移植**した `bgm-engine2.js`。曲データ(`../design/bgm-tracks.js` の 18 曲)は
  共有のまま、`ORCH`(title キー)で全曲を楽器再編成。Tone.js 依存なし。

## ファイル

| Path | Role |
| --- | --- |
| `index.html` | リマスター本体(元版のコピー + RASTER 層 + ボスパーツリグ + engine2 スプライス済み) |
| `bgm-engine2.js` | リッチ楽器エンジン(compile/scheduleTrackStep 契約は旧エンジンと同一)。**スプライス元** |
| `build-remaster-bgm.js` | `bgm2-demo.html`(全曲試聴ハーネス、gitignored)を再構築 |
| `gen-assets.sh` / `gen-assets2.sh` | バッチ 1(Stage1+全域)/ バッチ 2(Stage4-6 ボスパーツ)の i2i 生成 |
| `i2i-prompts.md` | STYLE(アートディレクションの唯一のノブ)+ SUBJECT + CONSTRAINTS |
| `verify-gen.py` | 生成物のクロマ残渣/色相ゲート |
| `refs/` | 手続き描画の参照書き出し(`?ref=<name>&size=N`、gitignored、再生成可能) |
| `assets/gen/` | 生成ステージング(gitignored)。採用 = `assets/` へコピー |
| `assets/` | **採用済みラスター**。空ならゼロアセット = 元版と画素同一で動く |

## 不変条件

- ゼロアセット時のレンダリングは元版と**画素同一**(全スワップ点が `if(RASTER.x){blit}else{元コード}`)。
- シミュレーションは不変: `?golden=1` の `{bootRng, fpStage, fpEmitters}` は元版と完全一致。
- `/*BGM:GEN*/` リージョンは手編集禁止(元版と同じ)。再スプライス:
  `node design/build-game.js --index remaster/index.html --engine remaster/bgm-engine2.js`(`--check` でゲート)。
- トランスポート(playMusic 等の 1 行関数群)は元版とバイト同一。
  `node design/test-bgm-unlock.js remaster/index.html` が回帰ゲート。
- ラスターの inert-emissive 契約: 生成画像に発光を焼き込まない(光はエンジンが描く)。
  目・コアは暗部として生成。

## ワークフロー

```bash
python3 -m http.server 8000 --bind 0.0.0.0          # リポジトリルートで
#   http://<LAN-IP>:8000/remaster/index.html        # リマスター
#   http://<LAN-IP>:8000/index.html                 # 元版(A/B 比較)
#   .../remaster/index.html?ref=<name>&size=768     # 参照書き出しページ
#   remaster/bgm2-demo.html                          # 全 18 曲の試聴

bash remaster/gen-assets.sh [names…]                # 生成(codex image_gen、~2分/枚、冪等)
cp remaster/assets/gen/<name>.png remaster/assets/  # 採用(ステージングから手で昇格)
```

アートディレクション変更 = `gen-assets.sh` 冒頭の `STYLE` を書き換えて再実行(全セット一括再演出)。
`scenery_spring_ground.styleB.png` が代替スタイル(純木版)のデモ。

## 状態 (2026-06-10 初版完成)

- 基盤・リグ・エンジン: 完成、検証済み(golden 一致 / ゼロアセット AE=0 / 元版 CI green /
  test-bgm-unlock 4/4 両版)。BGM 全 18 曲オーケストレーション+レベルマッチ済み。
- ボス 11 体 = 全パーツリグ化(計 20 パーツ)、全パーツのラスター生成・採用済み。
- 採用済みアセット 31 点(`assets/*.webp` 計 332KB、.png 併置)。色相は数値アンカー+
  金箔帯保護の選択的回転ポストフィックスで補正(`gen-assets.sh` のプロンプト参照)。
- 未着手: Stage2,4,5,6 の情景(per-frame 描画でベイク継ぎ目がまだ無い)、bamboo fog
  (ref が透明すぎて生成不能)、ポートレート/カットイン(Zone A、HANDOFF が最有望と名指し)、
  mizuchi 脊柱の 1-D mesh-warp、stream の帯厚 WARN。
