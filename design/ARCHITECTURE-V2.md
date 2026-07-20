# 桜花弾幕 — 6ステージ拡張アーキテクチャ（現況 + 今後）

> **Phases 0–9 は実装済み**（`master`, commits `cf9c7d2..8029964`, 挙動保持・構造 golden 検証済み）。
> この文書は (1) 何が landed したかの要約と (2) **以後の作業計画**（デバッグモード → 10 → 11 → 12 → 8）
> を保持する。Phase 0–9 の詳細プランは役目を終えたので削除した（真実はコードと `CLAUDE.md`）。
> 設計の根拠・批評の経緯は git 履歴と各 commit メッセージにある。

---

## 0. 不変の制約（変えてはいけない）

画面サイズ（`PF 432×576` + `HUD 208` → `640×576`）／プラットフォーム=Web／Canvas2D（WebGL 不可）／
Web Audio（音声ファイル0・全合成）／単人 + 4方向+shot+bomb+focus + life+bomb+graze／対応入力（KB+pad+touch
3方式）／**出荷物は単一 `index.html`**（ダブルクリック起動・itch に1ファイル・SharedArrayBuffer/COOP は OFF）。

**変えてよい**: ステージ追加(1→6)／数値調整／音色／音楽／グラフィック／タイトル。

## 1. 採用アーキテクチャ（landed）

「出荷物は単一 `index.html` を死守し、スケールは“ファイル増”でなく“**宣言増**”で得る」。詳細な節構成・
シンボルは `CLAUDE.md`（§index.html architecture）にある。要点だけ:

- **レジストリ群**: `THEMES`（パレット）・`BOSS_DESIGNS`（draw/scale/hitR）・`WAVES`（name→factory）・
  `SPELLS`+`compileSpell`（弾幕は id 参照 generator；`body:'raw'` が主流、再利用 motif だけ昇格）・`BOSSES`。
- **ステージ＝1データオブジェクト** `STAGES[i]` を `runStage()` が既存 Director コルーチンへコンパイル。
- **進行スパイン**: `run` + `startRun(diff,fromStage)` / `enterStage(i)` / `advanceStage()`。
- **難易度**: `BALANCE.difficulties` を `resolveWave`/`resolveBoss` が掛ける。**normal は恒等**（同一参照を
  返し base を変更しない）。
- **永続化**: `danmaku_save_v2`（`hiByDiff` 他）。`migrateSave` が旧 v1 int を `hiByDiff.normal` へ
  read-old-before-write-new + never-lower で吸い上げ（v1 キーは1リリース保持）。
- **検証**: 構造 golden ハーネス（`?golden=1` の `window.__dbg`）。frame-exact は不採用（T依存・Math.random
  リーク）。手順は `CLAUDE.md`（§Verifying behaviour preservation）。
- **アセットパイプライン**: BGM は `bgm-tracks.js`→`build-game.js`（`/*BGM:GEN*/` 領域を再 inline、`--check`
  で round-trip 検証）。theme/sfx/balance の3 audition harness は `build-*-demo.js`。

---

## 2. 以後の作業計画（2026-06-03 再シーケンス：デバッグモード → 10 → 11 → 12 → 8）

### Step A — デバッグ「途中の面から開始」モード ✅ DONE（2026-06-04）
`boot()` 末尾で `?stage=N`（1-indexed）+ 任意 `?diff=easy|normal|hard|lunatic` を解釈し、範囲内なら
title を飛ばして `startRun(diff, N-1)`。`?golden` 下では無効（ハーネスがクロックを所有）。範囲外Nは無視。
これは**ステージ単位**の開始（ボス内中間フェーズ直行 §3/#1 とは別物・未実装）。

### Phase 10 — Stage 2 フルオーサリング ✅ DONE（2026-06-04, golden 1面バイト一致維持）
"Twilight Petal Lane"（宵闇）。実装物:
- `THEMES.dusk`（藍→菫→薔薇の夕暮れ）／`BOSS_DESIGNS.phantom` + `drawBossPhantom`（大型の亡霊「Tasokare」）。
- `WAVES.drifters`（正弦漂移の幽霊）+ `WAVES.wraith`（重敵＝追尾ソウルオーブ環。道中の特徴＋3体トリオの山場）。
  既存 wave 4種は `opts.hue` を後付け（既定値維持で 1面不変）。
- `BOSSES.tasokareIntro`（中ボス枠で出現・通常1+スペル1で**撤退**）+ `BOSSES.tasokare`（再登場・5フェーズ、
  耐久ラスワ含む）。同 design/hue/name で同一キャラ。第1スペルは中ボス版の使い回しを避け複雑化版に。
- **新エンジンシーム（汎用・Stage 3–6 で再利用）**:
  - `bossRetreat` + `runBoss` の `spec.retreat` 分岐（撤退＝爆散せず飛び去る。撤退中も `game.boss` を生かし描画継続）。
  - **遅延ステージ送り** `run._advanceTo` を `simStep` が `tickStage` 直後に処理。コルーチン内 `Director.start`
    再入で新ステージのコルーチンが `update()` 圧縮に落ちる不具合を回避（直接 `enterStage` を呼ばない）。
  - `{stageEnd}` timeline verb（中継。1面終端を terminal な `{stageClear}` から分離）。
- **新 BGM 2本** "Yoiyami Lane"(stage2) / "Tasokare's Lament"(boss2) を D harmonic minor で**独立した曲**として
  作曲（音色/グルーヴ/テンポ/モチーフを 1面から分離。`SCALES` に `Dharm`/`Fharm` 追加）。**中ボス戦は道中BGMのまま**
  進行し、boss2 への切替は最終ボスのみ。`bgm-tracks.js`→audition→`build-game.js` で `/*BGM:GEN*/` 再 inline。

### Phase 11 — Stage 3–6（1ステージずつ）
各 = `STAGES[N]` データ + 1テーマ + 1–2 BGM。`?stage=N` で個別プレビュー。各追加後に出荷可能。
practice/stage-select 解禁は `save.furthestStage`（Phase 8 でスキーマ用意）に gate。
**Stage 3–6 すべて実装済 → Phase 11 完了**（竹林/双子・曙の嶺/八咫烏・高天原の嵐/須佐之男・**天岩戸/常夜＝黒い日輪・禍津日 撃破**）。
Stage 6（終幕）＝`design/STAGE6-DESIGN.md`：新ギミック＝置き弾幕+弾生成〔既存 `enemyBullets`+`b.update` だけ＝**新エンジン配管ゼロ**〕、
拡張フィナーレ8ph＝**暗→光の変身**（`_iwatoLight` 0→1 で岩戸開き）、`THEMES.iwato` 暗洞 scenery、BGM 3曲（boss6 に暗→光 key-lift・ドラフト=audition待ち）。
golden で Stage1/boot byte-identical 維持、全 boss phase 弾数 headless 有界（≤309）、5次元 adversarial review クリア。S6 撃破→ALL CLEAR（陽が還る）で光の循環が一巡して閉じる。

### Phase 12 — パフォーマンス & 仕上げ
真の山は衝突でなく**弾プールの integrate + compact + draw スループット**（`collidePlayerBullets` は自機1点
O(n)、grid 無効）。dev の bullet-count/frame-time HUD で worst Lunatic カードを profiling し、density が
噛む前に **cap 強制・画面外 culling・draw batching・compact 低コスト化**を投入、worst frame < 66ms で
`MAX_STEPS=8` slow-mo トラップを回避。`STAGE_INTERMISSION` で `pool.shrink`。results/all-clear 仕上げ。

### Phase 8（延期分）— インタラクティブ画面 ※最後
Phase 8 は**構造スパイン + 予約 STATE 定数のみ**実装済み。残りの画面群を最後に配線する（「現在の挙動を保つ」
と衝突するため後回しにした）:
- 予約済み STATE: `DIFFICULTY_SELECT` / `STAGE_INTERMISSION` / `CONTINUE` / `RESULTS` / `NAME_ENTRY`。
- 再利用 **menu cursor コンポーネント**（index/up-down/confirm/back）を KB+pad+touch 3方式へ配線。
  現タイトルは confirm edge 1個しか読まないので新規構築。**touch「どこでもタップ＝確定」を撤廃**しナビ可能に。
- `DIFFICULTY_SELECT`: Easy/Normal/Hard/Lunatic（`run.difficulty` を選択 → `resolve*` が効く）。
- `STAGE_INTERMISSION`: ステージ間（`run` を carry）。ここで `pool.shrink`。
- `CONTINUE`: `finalizeDeath`(lives<0) → Yes は同ステージ復帰・No は GAMEOVER。`run.continuesUsed`。
- `RESULTS`/`ALLCLEAR`: per-stage 内訳 + total + graze + continues + clear rank。
- `NAME_ENTRY`: ハイスコア記名 → `save.lastName`。
- セーブ拡張: `save.furthestStage` / `save.clears`（per diff: noContinue/noMiss）を埋める。
- **`enterStage` の二義性に注意**: campaign は carry、practice は固定 loadout。引数で分ける
  （`enterStage(i, loadout /* null=carry, obj=fixed */)`）。carry 対象（score/lives/bombs/power）と
  reset 対象（spawn/pools）を取り違えないこと。

---

## 3. 未解決リスク（着手時に再確認）

1. **中間フェーズ直行（`?stage=N&phase=M`）は free param ではない** — `runBoss` は phase 0 からしか
   入らない。中間開始は `boss.hp`/`survivalActive`/前 phase drop skip/`beginGroup` epoch の seek+heal が要る。
   Step A の「面開始」とは別。必要になったら Phase 11/12 で seek 機能として実装。
2. **perf 照準は弾プールスループット**（衝突 grid は no-op なので不採用）。Phase 12。
3. **BGM track 成長はスプライサに coupling**: `TRACKS` が `/*BGM:GEN*/` 領域内なので track 追加は
   `build-game.js` での再 inline 必須（`--check` がドリフトを検出）。
4. **単一ファイル肥大**（12 BGM + 6テーマ + ~12ボスで 4–6k 行）: friction であって buckling ではない。
   BGM データは terse 生成物、`src/` ミラー（任意・未作成）で per-file 編集も可。
5. **touch での後半高密度 danmaku UX** は Mobile Friendly 公開前に実機検証。
6. **`cutinHue`** 機構は実装済みだが未使用（暗転のまま）。ステージごとに hue を付けたい時は spec に
   `cutinHue:` を足すだけ（drawCutin が薄色を乗せる、画像0）。

主要参照: `/home/puniu/archive/bullet/CLAUDE.md`（節構成・規約・検証手順）、`index.html`（真実）、
`design/bgm-tracks.js`（音楽）、`design/build-game.js`（スプライサ）、`design/test-content.js`（CIゲート）。
