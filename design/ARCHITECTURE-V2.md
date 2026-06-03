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

### Step A — デバッグ「途中の面から開始」モード（最優先）
ステージ 2–6 のオーサリングを高速に試すための dev アフォーダンス。**シームは既に存在**:
`startRun(diff, fromStage)` は 0-indexed の開始ステージを受ける。実装は boot で `?stage=N`（1-indexed）と
任意の `?diff=` を解釈し、あれば title を飛ばして `startRun(diff, N-1)` を呼ぶだけ。定義済みの `STAGES`
エントリにジャンプ（6面揃う前から機能）。
- これは**ステージ単位**の開始。ボス内の**中間フェーズ直行**（seek/heal, §3/#1）は別物で不要。
- 出荷で URL ハックを嫌うなら `?dev` 配下に gate してよい（任意）。`__dbg` ハーネスとは独立の通常プレイ機能。

### Phase 10 — Stage 2 フルオーサリング
新 `THEMES` エントリ + **新 BGM 2本**（`bgm-tracks.js` の `TRACKS` に `stage2`/`boss2` を追記 → audition →
`node build-game.js` で `/*BGM:GEN*/` 再 inline）+ spell library から新ボス + `STAGES[1]`。`playMusic` は
`trackOf` 経由なので新トラックキーを自動許可（whitelist 変更不要）。デバッグモードで `?stage=2` 即確認。

### Phase 11 — Stage 3–6（1ステージずつ）
各 = `STAGES[N]` データ + 1テーマ + 1–2 BGM。`?stage=N` で個別プレビュー。各追加後に出荷可能。
practice/stage-select 解禁は `save.furthestStage`（Phase 8 でスキーマ用意）に gate。

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

主要参照: `/home/puniu/bullet/CLAUDE.md`（節構成・規約・検証手順）、`index.html`（真実）、
`design/bgm-tracks.js`（音楽）、`design/build-game.js`（スプライサ）、`design/test-content.js`（CIゲート）。
