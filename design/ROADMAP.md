# 桜花弾幕 — 今後の展望（コンテンツ完成後ロードマップ）

> 6ステージ全オーサリング完了（ARCHITECTURE-V2 Phase 11 = 全面実装済み）後の、**プロダクト方針**ロードマップ。
> 技術フェーズの詳細は `design/ARCHITECTURE-V2.md §2`（Phase 12 perf / Phase 8 画面群）が真実。本書はそれを
> 「体験の核」基準で再評価・再優先順位づけし、何を・何をしない・どの順で、を決める上位ドキュメント。
> 数値・座標・関数名は着手時にコードで再確認すること（行番号はドリフトする）。

---

## 0. 現在地

- **コンテンツは完成している。** 6ステージ・12+ボス・テーマ・BGM 全landed。campaign spine（`startRun`/
  `enterStage`/`advanceStage`/`runStage`）、難度スケール（`BALANCE.difficulties`+`resolveWave`/`resolveBoss`）、
  versioned save（`danmaku_save_v2`/`hiByDiff`）、再利用シーム多数が既に稼働。
- つまり残作業は **「遊び続ける理由（エンドゲーム）」「動作の滑らかさ」「見た目/操作のパーソナライズ」「整理」** の4領域。
  新しいルール・面・敵種を足す段階ではない（§2 のガードレール参照）。

- **★仕様凍結 2026-06-08。** A（2周目）まで含め全機能 landed。最適化フェーズの実測（`?golden=1` の __dbg ハーネスで
  `captureEmitter` の densest emitter を計時）で **sim は最悪密度（~550 弾）でも ≈0.1ms/tick・弾数に線形**＝律速でない
  ことを確認。したがって **B-2（SoA / pool 固定長化 / 画面外 cull / 衝突 grid）は実装しない**——B-1（弾ごと
  `createRadialGradient` → bake スプライト）で唯一の実 FPS 犯人は既に解消済みで、残りは「リスクのみ・実測リワードなし」
  （"honest constants" 方針）。同フェーズで C（整理）の機会的1パスも実施：デッドコード6件（`hypot`/`waitUntil`/
  `moveBezier`/`waveStormSprite`+WAVES登録/`pat.doubleRing`/`pat.contractingRing`）削除、由来史コメントの刈り込み12件、
  `drawSpellLabel` 抽出（render-only dedup）。**golden byte-identical / CI 4/4 green / HUD ラベル実描画を pixel 検証。**

---

## 1. 体験の核（すべての判断のレンズ）

このゲームが何であるかの定義。機能の採否・実装方法はここに照らして決める。

1. **準備なし・説明なし・ゼロフリクション。** ボタン一つで始まる。説明書・メニュー・設定・モード選択を挟まない。
   web 配信と合わせ「無名のゲームは開始前に1秒も要求できない」。
   → **新規 UI は原則すべてこの原則と衝突する。** UI を足すなら「何か押す＝即開始」を壊さない形に設計し直すのが必須条件。
2. **システム・リソース寄りの弾幕。** 弾避け技量より、上部アイテム回収（残機大量増加）と powerup（強弾幕スキップ）
   で攻略する流儀。
   → 難度を上げる時も**弾速で殺すのでなく「固さ＋弾数＋リソース管理の綱引き」で上げる**（既存の難度スケールが
   count+HP のみで弾速を触らないのと一致。"honest constants" 方針とも一致）。

---

## 2. ガードレール（変える / 変えない）

**変えてよい：** 数値調整／個別プロシージャルアセット差し替え／文言差し替え／（核を守る範囲の）UI クローム。
**変えない：** ルール／面構成／弾・敵・アイテムの種類。

→ **採否フィルタ：** ウィッシュリスト各項目が「数値・アセット・文言・核を壊さない UI」だけで表現できるか。
できないなら設計を見直すか却下する。後述する全項目はこのフィルタを通過する（理由は §3 各項）。

---

## 3. ウィッシュリスト精査

各項目を「価値 / 既存の再利用 / 真に新規な部分 / コスト / 設計上の注意」で評価。

### A. 高難度2周目（New Game+）— ★ 本命・エンドゲーム ＜コード実装 DONE 2026-06-07・残=数値プレイテスト調整＞

> **実装後追記（プレイテスト反映）：** 下記プランは「countMul/hpMul を上げる」想定だったが、実プレイで
> **ボスHP増は楽しくない**と判明 → 2周目の難度は **HP でなく弾数**（`loopN` 全アダプタ ×1.4／HP据え置き、
> 例外＝2周目1面の雑魚 HP のみ）に再設計。詳細は §4 の項目 3。以下の原文は設計経緯として残す。

- **価値（最大）：** コンテンツ完成済みの本作に「真エンディングまで遊び続ける理由」を与える唯一の項目。
  難度選択画面を**作らずに**難度カーブを提供する（＝核①ゼロフリクションを守ったまま難度の幅を出す）。
- **既存の再利用がほぼ全部：**
  - 難度スケールは既に `resolveWave`（spawn count）/`resolveBoss`（phase HP）が difficulty 係数で適用。
    `normal` は identity。**「敵が固く・弾が多く」は countMul/hpMul を上げるだけ**で表現でき、弾速は触らない（核②）。
  - **アイテムは wave spec 側にあり resolve は触らない** → 「得られるアイテムは同じ」が自動的に満たされる。
    アーキテクチャが既に正しい knob を分離している。
  - **状態引き継ぎは実質タダ。** `player` はモジュール変数で `makePlayer` は `startRun` でしか呼ばれない。
    全クリア後に `enterStage(0)` を `startRun` を**通さず**呼べば score/lives/bombs/power がそのまま 1面へ。
  - **last-word 無敵中タイマー凍結は seam が既にある。** `holdTimerWhileInvuln`（現状 Tokoyo の "Before the Dawn"
    のみ）。**2周目のみ** boss 1–5 の last word にも適用（`run.loop===1` で gate）。1周目は現状維持＝Tokoyo のみ・
    boss 1–5 はボムゴリ押しを許す。pierce 突破は常に開いたまま。
- **真に新規な部分（小さい）：**
  1. `run.loop`（0/1 の **2周固定**＝cave の系譜）。全クリア handoff（`STATE.STAGECLEAR`→現状 `TITLE`。
     index.html:3035）を分岐：1周目クリアなら `loop=1` で `enterStage(0)` の carry ループバック、
     **2周目クリアで真エンディング**。
     ※ ARCHITECTURE-V2 §2 が警告する `enterStage` の二義性（campaign=carry / practice=fixed）に注意。
  2. **周回スケール曲線。** difficulty を player が選ぶ5番目の枠にするのではなく、`run.loop` で active 係数を
     乗算する設計を推奨（核①「難度選択の代わり」と一致／将来の難度追加とも合成可能）。
  3. **1面の固さチューニング。** 2周目1面は power≈4 想定で始まるので、自火力の伸びを織り込んでもなお実質的に
     固くなるよう countMul/hpMul を設定（純粋な数値調整＝ガードレール内）。
  4. 真エンディング：save にループクリアフラグ＋ALL CLEAR 演出の分岐（文言＋既存フィナーレの再利用）。
  5. **ノーミス・ノーボム イースターエッグ（Super Metroid 方式）。** `run.perfect`（死＝`finalizeDeath` /
     ボム＝`doBomb` で false 化、**1-2周目通算**＝ループバックでリセットしない）が真エンディング到達時に
     立っていればエンディング中に隠し演出。完走条件に紐づくクリア報酬。
     ※ no-bomb 完走では loop2 の last-word 凍結（上記）は自然に発火しない＝両仕様は無衝突。
- **コスト：** 中の下。コード量は小さいが「2周目1面の体感」のプレイテスト調整に時間がかかる。
- **依存：** 弾数が countMul 倍（最大2×）に増える。powerup の実 FPS 犯人は step 2（B-1）で解消済みなので **A は着手可能**。
  残りの perf（B-2 cap凍結/SoA/cull）は逆に **A の後**＝最終密度が確定してから当てる。
- **決定済み：** last-word 凍結は **2周目のみ**（上記）。難度は player に選ばせず `run.loop` で active 係数を
  乗算する（難度選択を作らない＝核①）。

### B. パフォーマンス最適化 — B-1（powerup render）DONE / B-2（残り）は2周目後

- **価値（高）：** iPad 実機での体感を守る。worst frame < 66ms を割ると `MAX_STEPS=8` の slow-mo トラップに
  落ちる。**B-1（powerup render）は A の前提として先に完了。** B-2（残り）は逆に A が最終密度を決めてから。
- **★B-1 DONE（2026-06-07, step 2）— powerup ホットパス解消：** dev HUD 実測で **TOT（全エンティティ）~350 の最大でも
  FPS 影響なし＝エンティティ数は律速でない**（下の「弾プール throughput」仮説は棄却寄り）。**単一障害点は powerup mode**。
  実ブラウザプロファイル（使い捨て index-perf.html ＋ Playwright）で真因を切り分けた結果、**犯人は sim でなく render の
  「弾ごと `createRadialGradient` を毎フレーム生成」**だった。当初最有力視した `nearestHomingTarget` の O(homing×敵) は無罪
  （58発×敵30 でも 0.05ms/tick）。fix＝既存 `getBulletSprite`/`getPlayerShotSprite` と同じ **bake-once スプライト**化を3経路に:
  - `drawPlayerShots` homing グロー → `getHomingSprite`（exact-hue）: 5.5→2.0ms
  - `drawLaserBulletContrast` ダークブロブ → `getContrastBlob`（単位blob×`globalAlpha`で旧 alpha-in-stops を厳密再現）: 2.8→1.8ms
  - `drawParticles` 既定kind → `getParticleSprite`（hueKey バケット, 全シーン共通）
  → **最悪 L2-focus 14.4→9.6ms（−33%）**。golden byte-identical（render専用＝sim不変）/ CI 4/4 / 3経路 A/B 視覚一致 /
  4-agent 敵対レビュー全 pass。残コストは fill-rate 律速（見た目維持で縮小不可）＋ honest な `drawEnemyBullets` O(n)。
- **B-2（残りの perf：cap凍結 / SoA / 画面外 cull / draw batch）は 2周目（A）の後・仕様凍結後に回す。** 理由：これらは
  **最終的なエンティティ密度とデータ構造に依存**する。2周目で弾数が countMul 倍（最大 **2×**）になり最悪密度が決まるまで
  pool 上限の固定長化も SoA の hot-field 選定も確定できない（早く凍結すると 2× 密度で上限を踏み抜く）。B-1 で実 FPS の
  犯人は潰したので B-2 は**低優先**＝A の density を盛った後に1度だけ実 worst を計測し、`drawEnemyBullets` O(n) が問題化した
  ときだけ着手。`collidePlayerBullets` は自機1点 O(n)、grid は no-op なので**作らない**（§5）。
- **owner 方針（最適化フェーズの前提）：** 数 MB のメモリ無駄遣いは**完全に許容**。最適化に入った段階で
  **エンティティ数上限を凍結してよい**（pool を soft-grow から**固定長**へ＝現状の "soft caps grow on exhaustion"
  不変条件を最適化時に意図的に破る。これで `pool.shrink`／`STAGE_INTERMISSION` の縮退は不要化）。
  **後からデータ構造が増えることはない → SoA（Structure of Arrays）が候補**（弾プールの hot field を並列配列化し
  integrate/draw を cache 効率化）。
- **コスト：** 中。挙動非変更が建前 → golden で検証可能。
- **順序の根拠：** B-1（powerup render）は density 非依存だったので step 2 で先に完了。B-2（cap凍結/SoA/cull）は density
  依存＝**2周目（A）で最終 worst が確定してから**当てる（早く凍結すると 2× 密度で上限を踏み抜く）。

### C. コード整理（デッドコード・コメント・共通抽出）— 土台（境界を切ること）

- **価値：** プレイヤー価値ゼロだが以降全作業のコストを下げる。ユーザのウィッシュリストでは最後＝優先度は低め。
- **方針：** **大規模な構造リファクタはしない**（単一ファイルは出荷要件。`src/` ミラーは任意・未着手）。
  デッドコード削除＋コメント整理（MEMORY のコメント方針：非自明な仕様/不変条件のみ残す）＋明白な重複の抽出に
  **境界を切った1パス**に留める。スコープクリープ最大の罠。
- **順序：** B の直前に**軽い1パス**だけ（hot path をきれいにしてから perf を当てる）。以降は機会的に継続。
- **検証：** 挙動保持必須 → golden 必須。golden は Stage1 のみ・midboss 以降と interaction には盲目なので、
  共有コードは golden、ステージ固有コードは `captureEmitter` 前後比較で担保。

### D. 自機デザイン — owner 選定の単一アセット（UI なし）

- **方針転換：プレイヤーには選ばせない。** 候補デモを生成 → **owner が1つ選び**、ゲーム全体で**ただ1つ**の
  自機アセットとして使う。→ 選択 UI は不要＝**核①との衝突は消滅。menu-cursor も不要。**
- **価値：** 中。第一印象とトーン。現状のシンプル三角形（`drawPlayer`）も passable だが改善余地あり。
- **ガードレール内：** 自機スプライトは Canvas 描画＝プロシージャルアセット（`drawPlayer`/`PALETTE.ship` 周辺）。
  「個別プロシージャルアセット差し替え」＝変えてよい領域。
- **作業：** visual-4choice 流の候補デモ（複数の自機 draw を1軸に散らして A/B）→ owner 採択 → 勝者1つを
  `drawPlayer` に反映。
- **コスト：** 小〜中（アセット作業のみ・ゲーム配線ゼロ）。**依存なし＝いつでも・並行可。**

### E. 逆手操作（左手移動の救済）— キーコンフィグの代替（UI なし）

- **キーコンフィグは諦める**（UI 侵襲が大きく核①と衝突）。代わりに **dual binding で逆手操作を成立させる。**
- **問題：** 現状 WASD 移動は実装済みだが shot が Z のみ＝右手側にアクションキーが無く、左手移動が**実質死んでいる**。
- **作業：** 右手側にも shot/bomb/focus を割り当て、左手 WASD 移動＋右手アクションを成立させる（既存 KB 入力層の
  binding 追加のみ・ゲームルール不変＝ガードレール内・**画面 UI なし**）。
- **要・工夫：** 右 Shift + 周辺キーへ素直に割り当てると**キーレイアウト差**（配列/ロケール）で破綻する。
  物理位置に依存しすぎない方式（`KeyboardEvent.code` の物理キー＋レイアウト横断で安定なキー群の選定）で堅牢化。
- **コスト：** 小。**依存なし＝いつでも・並行可。**

### F. タイトル（CJK 回避）— 既存名 "Sakura Danmaku" が有力

- **価値：** ブランディング。MEMORY のプレイヤー向け文言 CJK-free 方針と一致（現タイトル「桜花弾幕／SAKURA
  DANMAKU」は drawOverlays index.html:2695 にハードコード）。
- **現状：** **owner は "Sakura Danmaku" をそれなりに気に入っている**＝これが既定。他に良候補があれば差し替え。
- **作業：** （任意）代替候補をいくつか提案 → owner 採択 → 文言差し替え（＋表示から CJK「桜花弾幕」の扱いを決定）。
- **コスト：** 極小。**依存なし＝いつでも・並行可。**

---

## 4. 推奨順序

依存（B は A を支える）と価値で決定。D/E/F は依存なし・UI なしで完全独立。

**主系列（依存があるもの）：**
1. ~~**C（軽い整理）＋ dev HUD**~~ — **DONE 2026-06-07**。土台＋以降の perf 計器。
2. ~~**B-1（powerup render perf）**~~ — **DONE 2026-06-07（step 2）**。弾ごと `createRadialGradient` → bake-once スプライト化で
   powerup mode の実 FPS 犯人を解消（最悪 −33%、真因は render not sim）。詳細 §3 B。
3. ~~**A（2周目 + 真エンディング + ノーミス/ノーボム イースターエッグ）**~~ — **コード実装 DONE 2026-06-07**（master 未コミット）。
   golden byte-identical（loop0 normal 不変）／ CI 4/4 green ／ 敵対レビュー confirmed=0（2 回：初版 8 agent ＋ 体験再設計 後）。
   **スパイン**：`run.loop`(0/1 の2周固定)＋`run.perfect`(1-2周通算)、`onStageClear` 分岐（1周目クリア→loadout carry の
   `enterStage(0)` ループバック／2周目クリア→真 ALL CLEAR）、2周目のみ全 last-word に `holdTimerWhileInvuln`、
   真エンディングの perfect 隠し演出（tokoyoFinale プリズム＋ALL CLEAR の NO MISS·NO BOMB 行）、`save.loopClears/perfectClears`、
   HUD「LOOP II」バッジ、「THE DREAM DEEPENS」ループ遷移バナー。
   **難度＝プレイテストで再設計（HP→弾）**：「ボスHP増は楽しくない」との実プレイ判定で、2周目の難度は**固さでなく弾の多さ**に変更。
   `resolveWave/resolveBoss` は純粋な難度リゾルバに戻し（loop は HP も spawn 数も触らない）、新 `loopN()` が全弾幕アダプタ
   （ring/fan/spiral/wall/burst/rain/aimedShot）の弾数を `BALANCE.loop.bulletMul`(=1.4) 倍（ボスも道中も／loop0=恒等＝golden不変／弾速不変）。
   **唯一の HP 変更**＝2周目1面の雑魚のみ `_enemyHpMul`(=`s1EnemyHpMul` 2.2) で固く（full power carry に即蒸発しない）。
   **観戦用デバッグ**（"自力突破不可" 対応）：`?god=1`(不死)＋`?melt=1`(即死弾)。`?stage=6&god=1&melt=1&loop=0`＝1周目クリア→
   ループバック／`&loop=1`＝2周目 真END／`&loop=1`＋道中ノーボム＝perfect 演出。
   **残（凍結前の唯一の作業）＝ `BALANCE.loop`(bulletMul/s1EnemyHpMul) の人手プレイテスト調整**。`?stage=N&loop=1&god=1` でプレビュー。
   **ストレッチ**：弾幕パターン自体の変奏（単なる弾数増より体験良の可能性）。**調整が済んだら仕様凍結 → B-2 perf へ。**
4. **B-2（残りの perf：エンティティ上限の凍結＋SoA＋画面外 cull/draw batch）** — **A の後・仕様凍結後**に当てる。最終密度と
   データ構造が固まって初めて pool 固定長化／SoA が確定できる。B-1 で実 FPS は確保済みなので低優先＝A 完了後に実 worst を
   1度計測し、`drawEnemyBullets` O(n) 等が問題化したときだけ着手。

**独立・並行（依存なし・いつでも）：** D（自機 owner 選定）・E（逆手操作）・F（タイトル）。
**この3つがすべて UI 不要になったため、menu-cursor／Phase 8 の予約画面群は一切作らない。**
→ **本作は最後までメニューを持たない**（核①ゼロフリクション完全保持）。

**順序の核心：** powerup の実 FPS 犯人は step 2（B-1）で先に潰した（render gradient-alloc）。残る perf（B-2）は
**最終密度依存**なので、本命の A（2周目）を実装し**仕様凍結してから**当てる。D/E/F は配線が軽く独立なので主系列の
合間に随時。C は以降も機会的に継続。

---

## 5. やらないこと（スコープガード）

- **メニュー／画面 UI を一切作らない。** 難度選択（DIFFICULTY_SELECT）・キーコンフィグ画面・自機選択 UI・
  menu-cursor・Phase 8 の予約 STATE 画面群、すべて不要（A=2周目が難度の役を、D=owner 選定が自機を、
  E=dual binding が操作を、いずれも UI なしで担う）。→ 核①ゼロフリクション完全保持。
- **NAME_ENTRY / オンラインランキングを作らない**（ローカル hi-score で十分。望めば別途）。
- **3周目以降を作らない**（2周固定＝cave の系譜。真エンディングは2周目クリア）。
- **index.html の大規模マルチファイル化リファクタをしない**（単一ファイルは出荷要件。整理は境界つき1パス）。
- **衝突 grid を作らない**（no-op。perf 照準は弾プールスループット）。
- **ルール／面構成／弾・敵・アイテムの種類を変えない**（全機能を数値・アセット・文言・UI 不要の入力/描画で表現）。
- **弾速で難度を上げない**（count+HP+リソース綱引きで上げる）。

---

## 6. 検証

- 挙動保持を意図する変更（B/C）は **golden harness 必須**（`?golden=1` + `__dbg.fpStage/fpEmitters/peekRng`）。
  golden は Stage1・boot のみ＝ステージ固有/対話/描画/音には盲目。Stage2–6 ボス弾幕は `captureEmitter` 前後 sum 比較。
- A は意図的に挙動を変える（数値スケール）→ golden は「Stage1 byte-identical（loop0 normal）」の回帰だけ守り、
  2周目側は実プレイ＋ `?stage`/`?practice` デバッグモードで体感調整。
- 見た目の変わる変更（D 自機描画）は Playwright で自検証（グローバルノート #19）。E（逆手操作）は実機キー入力で、
  F（文言差し替え）は目視で確認。いずれも画面 UI は増えない。
- 出荷ゲート：`node design/bgm-tracks.js && node design/build-game.js --check && node design/test-content.js && node design/test-bgm-unlock.js`。

---

## 7. 一覧

| 項目 | 価値 | コスト | 主な再利用 | 真に新規 | 順 |
| --- | --- | --- | --- | --- | --- |
| A 2周目+真END+EE | ★最大 | 中の下 | resolve*/campaign spine/holdTimerWhileInvuln/save | run.loop(2周固定)・1面再調整・END分岐・perfect追跡・隠し演出 | 3 ✓実装(残=数値調整) |
| B-1 powerup render perf | 高 | 中 | getBulletSprite系 bake | 弾ごと createRadialGradient→bake スプライト（真因=render not sim）**DONE** | 2✓ |
| B-2 残り perf(cap凍結/SoA/cull) | — | — | dev HUD/golden | **実測で不要と判断（2026-06-08）**: sim ≈0.1ms/最悪密度=律速でない | ✗不要 |
| C 整理 + dev HUD | 低(土台) | 小〜中 | golden/captureEmitter | （境界つき1パス）**DONE** | 1✓ |
| D 自機(owner選定) | 中 | 小〜中 | drawPlayer/PALETTE | 候補デモ→単一アセット採択（UI 無） | 並行 |
| E 逆手操作 | 中の下 | 小 | 既存 KB 入力層 | 右手 dual binding・レイアウト堅牢化（UI 無） | 並行 |
| F タイトル | 中 | 極小 | drawOverlays | 候補提案（"Sakura Danmaku" 有力・UI 無） | 並行 |
