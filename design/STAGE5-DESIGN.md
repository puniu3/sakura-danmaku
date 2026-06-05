# Stage 5 設計：「高天原の嵐 / Tempest of the High Plain」

> **次セッションへの引き継ぎ文書。** これ一枚で実装に入れるようにまとめてある。
> 設計確定: 2026-06-05 / **実装完了: 2026-06-06**（gravity well 系統＋storm theme/scenery＋須佐之男7ph＋風神2ph(撃破)
> ＋STAGES[4]＋S4`{stageEnd}`→S5`{stageClear}`。Stage1+boot golden byte-identical 維持／全 well-phase の弾数有界を
> headless 検証済。5次元 adversarial review クリア。**残: BGM 3曲はドラフト＝ユーザ audition 待ち（bgm-demo.html）**＋
> well 公平性チューニング(`R`/`strength`/`swirl`/予告秒)の実機調整＋致命コア(coreR>0)は未使用の tuning レバー）。
> 併読: `CLAUDE.md`（§index.html architecture, §golden, §BGM pipeline）、
> `design/ARCHITECTURE-V2.md`（forward roadmap）、`design/STAGE4-DESIGN.md`（直前の同型文書・シーム実装の実例）、
> メモリ [[v2-architecture-plan]] [[stage-difficulty-power-gap]] [[bgm-build-pipeline]] [[power-economy-and-poc]]。

---

## 0. サマリ / ステータス

- **Stage 5 = 雲上の大嵐（高天原）。** 中盤を越えた、終幕一歩手前。新ギミック＝**全方位螺旋 ＋ 重力場弾（well）**を初投入する面。
- **「重力＝天体」では浮く → 「嵐／台風」に再フレーム**（2026-06-05 のユーザ判断）。吸い込み・渦巻きは気象として完全に自然になり、"明るい天上に重力が浮く"問題が消える。**well＝回転する旋風／嵐の目**、**全方位螺旋＝台風の渦状腕（rainband）**。同じ"渦"の言語で絵が一枚岩になる。
- **明るさは保持**（S2/3 の夜には戻さない）: **雷光に照らされた雲＋「嵐の目」の晴れ間**で高コントラストの bright-turbulent。S4（崇高・低い陽の眩しさ＝脅威）と被らない別レジスター＝**乱・渦・荒ぶり**。
- **ギミック配分（合意済・3面分。S4文書から継続）**:
  | Stage | 新ギミック |
  | --- | --- |
  | 4 曙の嶺 | 予告レーザー ＋ 巨大弾（**実装済**） |
  | **5 高天原の嵐** | **全方位螺旋 ＋ 周囲の敵弾を吸う重力場弾（well）** |
  | 6（未設計） | 置き弾幕 ＋ 弾を生む弾 |
  - 1面に詰め込まない方針。Stage 5 は「最重量の新規システム(重力場 well)1本＋全方位螺旋(既存 `pat.spiral` 流用＝ほぼ無料)」。
- **登場人物（案①確定）**:
  - **大ボス＝須佐之男（Susanoo）** 嵐神。7フェーズ。well＝荒魂の渦。
  - **中ボス＝風神（Fūjin）** 雲上の門番。**撃破（retreat ではない＝S4 山姥型）**、2フェーズ。風壁（既存パターン、wellは出さない）。
- **well の挙動＝湾曲・周回（レンズ）確定**: 弾を渦に巻き込み→周回→外へ振り飛ばす（致命の塊を作らない）。詳細 §3。
- **BGM＝専用3トラック（Stage 1/4 に倣う）**: `stage5` / `midboss5` / `boss5`。中ボスにも専用曲。全て独立曲。
- **着手順**: 重力場 well 系統（最重量）から。各段 `?golden=1` で **Stage 1 + boot が byte-identical**（stage h=3188712340 / boot-rng=0.19207037752494216）を回帰確認（golden は1面/boot のみカバー。2面以降は golden に出ない＝出たら事故）。

---

## 1. コンセプト / 物語 — S4↔S5↔S6 の三幕が神話順で噛み合う

- **光の循環の続き**: 春昼(S1)→彼岸黄昏(S2)→夜の竹林(S3)→**山の曙(S4＝八咫烏＝陽)**。一日が一巡し、S4 で陽が稜線を越えた**その先＝地上を離れた上昇**。
- **舞台＝高天原（たかまがはら）**: 文字どおり「高い天の原」＝雲上の神々の地。そこに大嵐が荒れる。
- **アマテラス(陽)↔スサノオ(嵐)の姉弟神話で S4 と直結**:
  ```
  S4 陽が昇る（八咫烏）→ S5 嵐が天を荒らす（須佐之男）→ S6 陽が隠れ、取り戻す（天岩戸＝終幕候補）
  ```
  神話順＝**スサノオが高天原で暴れる→（その結果）アマテラスが岩戸に隠れる**。よって **S5＝須佐之男の嵐は神話順でも正位置**、S6 の岩戸（陽が隠れ取り戻す終幕）へ一本の弧で渡せる。須佐之男は"最終一歩手前"格＝**6面中5面のボスにサイズが合う**（S6終幕と食い合わない）。
- **感情のレジスター**: S4（崇高・低い陽の眩しさ＝脅威）と被らないよう、S5 は**乱・渦・荒ぶり**。脅威は「光」でなく「**渦に巻かれて軌道が読めなくなる**」こと。
- **ボスアリーナ＝「嵐の目」の中**にできる（強い演出案）: 中心は静かで明るく、周囲の壁を弾の渦が回る。主が danmaku を目へ吸い込む＝well 機構そのものが舞台演出になる。

---

## 2. テーマ（新 `THEMES.storm`）

`THEMES` セクションに `storm` を追記（spring/dusk/bamboo/summit の隣）。`setTheme('storm')` で petal 再bake＋scenery 再構築。

- **空**: プレイ帯は **storm grey-blue の中トーン**（弾の視認性を守る）。輝度は **雷光・嵐の目の晴れ間・渦のコア・horizon の雲壁の発光**に集約。
- **scenery（道なし分岐の5例目）**: `storm:true` を立て、`buildScenery`/`drawScenery` を storm 分岐へ（`buildStormScenery`/`drawSceneryStorm`）。**眼下に雲海が流れ、そびえる嵐雲の壁＋周期的な雷光、奥の「目」へ螺旋状に近づく前方クルーズ**。`ghost`/`bamboo`/`summit` と同型（道はないが流れる＝既存 `bgScroll` 共有でボス到達 hover ease が無料で付く）。
- **petal**: 風に流れる雨条／光の粒（嵐に煽られる。`petalAlpha` で輝度帯の下に沈める）。
- **⚠ 視認性 caveat（最重要・S4から継続）**: 明るい空＋雷光＋明るい弾＋渦コアは**洗い流し合う**。対策＝プレイ帯の空を中トーンに抑え、白〜白金の輝度を**雷光／嵐の目／渦コア／horizon**に集約。渦（well）も画面を白飛びさせない（コア以外の輝度を抑える、`drawEnemyBullets` の 'lighter' 累積に注意）。
- **アクセント色を外出し**（S3 `THEMES.bamboo.grove` の手法）: `THEMES.storm.tempest{ hue, glow, bolt, eye, fog }` 等にして後でデモ調整を楽にする（既定値＝literal 再現で見た目不変）。
- **未決定（次セッションで詰める）**: 具体 hex 一式、storm scenery の draw 実装、雷光フラッシュの出し方（worldY固定の雲壁＋周期 flash、雲海を深度投影で下へ流す等）。

---

## 3. 新エンジンシーム（このステージで作る本体）

### (a) 重力場 well 系統 ＝ 渦／嵐の目　【L・最重量・S5 の看板】

> **レーザー(S4)との本質的な違い**: レーザーは「それ自体が新ハザード」だったが、**well は『既に飛んでいる普通の弾』の軌道を曲げるフィールド効果**。よって弾そのものは通常の `spawnBullet`（直進）で撒き、**新規エンジン作業の核は『重力適用パス』**になる。実体プールの作り（pool / integrate / draw / verb / 各種 clear）は **S4 のレーザー(`lasers=makePool(newLaser,24)`)の配線をそのまま雛形にできる**。

- **実体**（小プール、同時 ≤ ~4。perf 理由は §3末）:
  ```
  newWell(): { x, y, R, strength, swirl, coreR, hue, state, t, follow }
            state ∈ WARN → ACTIVE → FADE
  ```
  - `R`=影響半径、`strength`=引力係数、`swirl`=接線（回転）係数、`coreR`=致命コア半径（**0=純レンズ＝無害**）、`follow`=ボス追従するか。
  - `warnDur`（予告 ~0.8–1.2s）→ `activeDur`（作用）→ `fadeDur`（残 ~0.3s）。値は tuning 課題。
- **ライフサイクル**（新 `integrateWells(dt)` を simStep に追加、lasers/bullets/particles と並ぶ）:
  - `WARN`: 渦のコア＋**影響リングがゆっくり広がる予告**（無害・breathe で脈動。⚠ 速い strobe 禁止＝S4 教訓、`t*11` 程度の緩い呼吸）。「ここに渦ができる／どこまで巻く」が読める。
  - `ACTIVE`: 重力適用（下記）。コア `coreR>0` なら FIRE 相当の自機衝突あり。
  - `FADE`: 残光（alpha ramp、引力 off）。
  - `follow`=true なら毎tick `x,y` をボスから更新。コルーチンが `well.x/y` を毎tick書き換え＝漂流（lasers の `.ang` 掃射と同じ流儀）。
- **重力適用パス**（**この面の新規作業の核**）: `applyGravity(dt)` を `integrateBullets` の直前に置く。`if(wells.count)` でガードし、**0個なら完全 no-op → S1–4 byte-identical**。
  - 各 `ACTIVE` well について、影響半径 `R` 内の**直進弾**（`b.av===0` かつ `b.update` 無し＝integrateBullets の branch 3）に Δv を加える:
    - 径方向（吸い込み）: `a_r = strength / (d + k)`（**非特異化**＝`1/d²` の singularity を避け、吸い込みでなく滑らかに湾曲。クランプ必須）、中心へ向ける。
    - 接線方向（回転）: `a_t = swirl * (1/(d+k))`、中心まわりに直交。**接線成分があるから弾は1点に潰れず周回して抜ける**＝死の塊を作らない（公平性の核）。
    - `b.vx += (a_r*ux + a_t*(-uy))*dt; b.vy += (a_r*uy + a_t*ux)*dt;`（ux,uy=中心方向単位ベクトル）。
  - ⚠ **被重力弾は直進弾で撒くこと**: 極座標カーブ弾（`b.av!==0`＝branch 2）は毎tick `vx,vy` を `dir/speed` から再計算するので**重力を無視する**。S5 の螺旋・撒き弾は **`av:0`（直進）**で出す（仕様として明記）。`b.update` を持つ特殊弾も対象外。
  - **対象は `enemyBullets` のみ**（自機 `playerShots` は別プール・別 integrate＝触らない）。※自機ホーミングを曲げる遊びは可能だが明瞭さのため当面 out（任意拡張）。
- **衝突**（`coreR>0` の時だけ、`ACTIVE` 中。`collidePlayer*` に1パス、lasers と同型）: 自機 (px,py) と well 中心の距離 d。`d < coreR + PLAYER_R` → `onPlayerHit`、`d < coreR + GRAZE_R` → `onGraze`（graze 経済に乗る、per-well cooldown で flood 抑制＝S4 `LASER_GRAZE_CD` に倣う）。
  - **まず純レンズ（`coreR=0`＝無害）で identity 確立**。致命コアは後半カード(P6/P7)で**小さく・予告付き**で足す（任意・tuning）。
- **描画**（`drawWells`）: 回転する渦／嵐の目のスプライト（緩く回す）＋**薄い影響リング**（巻く範囲を読ませる）。レイヤは**弾の下**（巻かれて曲がる弾を上に残して読ませる）。⚠ §2 caveat: コアの輝度は bounded に（白飛び回避）。`'lighter'` 累積で渦同士が真っ白に潰れないよう、渦コアは source-over 寄りで描く（S4 の `sun` 弾の教訓）。
- **発火 verb**: `placeWell({x,y,R,strength,swirl,coreR,warn,active,hue,follow})` を spell コルーチンから呼ぶ。
  - 1個＝中央に1呼び。N個＝stagger 呼び＋coro が `well.x/y` を漂流。
- **ボム交互作用**（S4 のパニックボタン契約に倣う＝消さず無効化）: `doBomb` で `ACTIVE` well を一時 `FADE`/休眠（引力 off）にして場を緩める。スペルを壊さず、ボム後に再生成 or 再 ACTIVE。`lasers.forEachLive(L=>{if(L.state==='fire'){L.state='warn';L.t=0;}})` と同じ発想。
- **プール clear 必須箇所**（S4 lasers と同じ。漏れると次フェーズに渦が残る）: `enterStage` / `setState(TITLE/GAMEOVER/STAGECLEAR)` / `bossDefeat` / **`runPhase` 末尾（`Director.endGroup` 直後）** / `freshState`。
- **perf**: 各 `ACTIVE` well は影響半径内の弾を走査＝O(wells × bullets)。**同時 well を ≤ ~4 にキャップ**（P6 マンダラが最大）。worst Lunatic の高密度は Phase 12 で profiling（cull/batch）。空間 grid は現状 no-op なので、当面はキャップと `R` の妥当化で抑える。

### (b) 全方位螺旋（既存流用 ＝ ほぼ無料）

- 既存 `pat.spiral` / `spiral()` をそのまま使う（**`av:0` の直進弾で**＝重力で曲がるように）。反転二重螺旋は `spiral(angle:a)` ＋ `spiral(angle:-a*k)` の2呼び（S1 ラスワに前例）。
- well と組むと螺旋弾が渦に巻かれて**回る銀河腕／渦の川**になる＝この面の絵。コスト ~0。

---

## 4. ボス：須佐之男（Susanoo）— 嵐神

- **意匠**: 新 `BOSS_DESIGNS.susanoo`（`{ draw:drawBossSusanoo, scale, hitR }`）＋ `drawBossSusanoo`（RENDER）。**荒ぶる長髪＋十拳剣、雷光のリム**。大型で既出（サクヤ/蛟蛇/双子巫女/八咫烏/山姥）と完全非重複。`hitR` は胴中心。
  - **当たり判定の見た目一致**: 流れる髪・剣・荒魂オーラで非円形なら、S4 で作った **`BOSS_DESIGNS[design].hitShapes:[{dx,dy,r},…]`**（design ローカル座標、`collideShotsEnemies` が `scale` 倍して追加円判定。null=no-op＝golden 不変）で翼/剣/髪の張り出しに当たり円を足す。基本は body core で足り、必要時のみ。
- **理由**: 嵐神＝荒魂の渦が本体なので、well（渦）と主題が完全一致。
- **7フェーズ**（escalation: nonspell 3 / spell 3 / survival 1。3スペルが渦1/渦2/渦群の別の顔＝S4 の静/巨大/掃射と同型の三段）:

  | # | 種別 | 内容 | 主ギミック |
  | --- | --- | --- | --- |
  | P1 | nonspell | 自機狙いの突風扇 ＋ ゆるい全方位螺旋（well なし導入） | 螺旋(素) |
  | P2 | spell「嵐の目」 | **渦1つ**中央。全方位螺旋弾が周回環に巻かれる＝「空間が曲がる」を教える | **well初出(1・無害レンズ)** |
  | P3 | nonspell | 反転する二重全方位螺旋（双 rainband） | 螺旋(双) |
  | P4 | spell「双つ巴」 | **渦2つ**漂流。弾が8の字/レムニスケートの川で両渦を縫う | **well×2** |
  | P5 | nonspell | 十拳剣の薙ぎ＝剣閃リボン壁 ＋ 狙い（well休み・圧の局面） | (well休) |
  | P6 | spell「八雲立つ」**看板** | **渦3–4**を回転マンダラ配置、全方位螺旋が巻かれ**回る銀河**に。**ボスは中央に据える**（回転スペルの理不尽回避＝S4教訓） | **well群＋螺旋** |
  | P7 | survival「天叢雲」 | 漂う渦群の周回河が全画面、~28s 耐久。致命コアを小さく解禁可 | 全部 |

- **S4 から効くスペル設計の教訓**:
  - **回転 vs 緩め**: 回転マンダラ(P6)はプレイヤーに回転運動を強いるので **ボスを中央**に据え、ばら撒き螺旋は**楽にすり抜けられる密度**に抑え、回転速度を**遅→速にランプ**する。**「緩め」の局面**＝渦を周期的に弱める(下を撃たせる relief)で 2スペルを差別化（跨ぎレーザーの well 版）。
  - **予告は緩い breathe**（速い strobe 禁止）。
  - **致命の塊を作らない**: §3(a) の接線 swirl で弾は周回して抜ける。安地が**動く**のは可、**消える**のは不可（密度キャップ）。
- **HP**: 実プレイは power=max 進入なので [[stage-difficulty-power-gap]] に従い DPS 比でスケール（max ≈ 2×power1）。S3 双子（単体ボス 1340–1720 級）/ S4 八咫烏 を参考に各フェーズ設定。
- **BGM 切替**: 須佐之男登場で `boss5` に切替（中ボスは `midboss5`、§7）。

---

## 5. 中ボス：風神（Fūjin）— **撃破**（retreat ではない）

- **意匠**: 新 `BOSS_DESIGNS.fujin` ＋ `drawBossFujin`。**風袋を負う雲上の門番**、荒神の眷属。須佐之男(嵐の主)の先触れ。蛇・少女・烏・老婆・嵐神のどれとも非重複。
- **撃破挙動**: S2/3 の `spec.retreat`→`bossRetreat` ではなく**通常の `bossDefeat`**（死亡爆発＋drops）＝S4 山姥型。
  - 利点: 「ちゃんと倒した手応え」＋ **death 爆発と drop が power/score 源**。撤退は0点死蔵だった。
  - 物語: 「**嵐の門を守る風神を討って、奥の『嵐の目』の主（須佐之男）へ至る**」。中ボス撃破→大ボスの導線（ユーザ指定）。
- **フェーズ**: 2フェーズ（1 nonspell ＋ 1 spell）→ 死亡。
- **固有弾＝風（**新規システム不要・well は出さない＝well はボス専売を保つ**）**:
  - **突風の薙ぎ壁**: `waveSideSweep`/wall 系の baseAngle を coro で薙ぐ（広いカーブ風壁が画面を掃く）。
  - **つむじ風の渦巻き撒き**: `pat.spiral` を太め低速で（渦の"気配"だけ見せて本番ボスへ繋ぐ。ただし重力は付けない＝見た目の螺旋のみ）。
  - 視覚＝「掃く風」で、主の放射状の渦と差別化。
- **BGM**: **専用 `midboss5` に切替**（Stage 1/4 に倣う。S2/3 のように道中曲を流用しない）。

---

## 6. 道中（road / 中道）

- **アイデンティティ**: 雲上の小妖（つむじ／雲童）が**弱い渦を一瞬置いて自分の撒き弾を曲げる**＝周回読みの慣らし場（well の予告→周回を慣らす。S4 で小烏がレーザーを慣らしたのと同型＝**道中は弱い well 可、中ボスは well なし**）。well 本体は §3(a) を使い、`R` 小・`strength` 弱・`coreR=0` 無害で。
- **モーション**: 嵐雲の流れ＋雷光（§2 scenery）。
- **power 源**: 雲精／烏天狗の V字編隊（既存 `waveVFormation` 流用、`halvePower` 等の既定維持フラグも利用可）。
- **陣形ポリシー（[[v2-architecture-plan]] のユーザ方針を厳守）**: 横一列 curtain を嫌う。**複数編隊・時間差・離れた位置・縦方向（深さ）も使った2D陣形**にする（`waveDrifters` の `speed`/`speedJit`/`drift`/`band`、`waveSideSweep` の `yStep` echelon を活用、ただし中央収束 drift は逆効果＝薙ぎ易くなる）。
- **配置**: `WAVES` レジストリに「弱 well を置く雲妖 wave」を追加。総数は power economy 維持で設定（[[power-economy-and-poc]]）。
- **未決定**: 道中に渦をどれだけ出すか（出し過ぎると重い・うるさい。1個ずつ・短命に）。

---

## 7. BGM（専用3トラック ＝ Stage 1/4 に倣う）

`design/bgm-tracks.js` の `TRACKS` に **3曲**追加 → audition → `build-game.js` で `/*BGM:GEN*/` 領域を再インライン。

- `stage5`（道中）/ `midboss5`（風神）/ `boss5`（須佐之男）。
- **全て独立した曲**（1/2/3/4面の reskin にしない＝記憶の教訓。音色/グルーヴ/テンポだけでなく**メロディ＝モチーフの輪郭・リズムDNA**を別物に）。[[bgm-build-pipeline]]
  - ⚠ **S4 とのモチーフ被りに特に注意**（S4 boss はかつて heroic-stepwise で道中と被り、6カードデモで alt-B に差し替えた）。S5 は嵐＝**駆動的・乱流的なリズム**で、S4 の輪郭を避ける。「**回るオスティナート／周回アルペジオ**」を motif フックにすると「重力で回る渦」を音に映せる。
- **旋法**: 嵐＝明るいが甘くない。既存 key（S1 Am, S2 Dharm, S3 Ehira/E In, S4 Amaj/D Lydian/F# harm/C）と被らない選択を。`SCALES` に追記。
- **切替点**: 道中＝`stage5`、風神登場＝`midboss5`、須佐之男登場＝`boss5`。`playMusic` は `trackOf(name)` で任意キーを受けるのでホワイトリスト編集不要。
- **pipeline**（CLAUDE.md §BGM）:
  ```bash
  # design/bgm-tracks.js に stage5/midboss5/boss5 を追加
  node design/bgm-tracks.js        # lane/in-key 検証
  node design/build-bgm.js         # bgm-demo.html 再生成 → A/B 試聴（要ユーザ）
  node design/build-game.js        # /*BGM:GEN*/ を index.html に再インライン
  node design/build-game.js --check
  node design/test-bgm-unlock.js
  ```
- **未決定**: 各曲の key/BPM/モチーフ、SCALES の具体追加。audition でユーザ確定。

---

## 8. 実装ビルド順（各段 `?golden=1` で Stage 1+boot 不変を確認）

1. **重力場 well 系統 (a)** を `?stage=5` デバッグ起動で動く**最小プロトタイプ**として差し込む（最重量・看板）。実体プール＋`integrateWells`＋**`applyGravity` パス**＋（coreR>0なら）collide＋弾の下に draw＋`placeWell` verb。**S4 lasers の配線を雛形に**。空プール時 no-op＝golden 不変を確認。
2. **全方位螺旋 (b)** を well の上で確認（既存 `spiral` を `av:0` で、渦に巻かれる絵）。
3. **`THEMES.storm` ＋ storm scenery**（§2、視認性 caveat 厳守。playwright で自分の目で確認＝global note #19）。
4. **道中 WAVES ＋ 中ボス風神**（§6・§5。撃破＝`bossDefeat`、2ph）。
5. **ボス須佐之男 7フェーズ**を `STAGES[4]` timeline に（§4）。
6. **BGM `stage5`/`midboss5`/`boss5`**（§7）。
7. 難度スケール（[[stage-difficulty-power-gap]]）・実プレイ調整（well の `R`/`strength`/`swirl`/予告秒の公平性チューニング＝この面の核）。
8. **ステージ連結**: 現状 S4 が `{stageClear}` terminal → **S4 を `{stageEnd}`→S5** に、**S5 を `{stageClear}` terminal** に（S6 実装時にまた送る）。次面送りは必ず `run._advanceTo` 経路（コルーチン内 `Director.start` 再入禁止＝S2 の deferred stage-advance シーム）。

---

## 9. index.html 配置（CLAUDE.md §architecture 参照。行番号はドリフトするので banner/symbol で辿る）

| 置く所 | 追加物 |
| --- | --- |
| **THEMES** | `THEMES.storm` ＋ `storm:true` scenery 分岐（`buildStormScenery`/`drawSceneryStorm`）＋ アクセント色 `tempest{…}` 外出し |
| **BOSS_DESIGNS** | `susanoo`・`fujin`（draw fn は RENDER に `drawBossSusanoo`/`drawBossFujin`。非円形なら `hitShapes`） |
| **重力場 well 系統（新規）** | 実体プール `wells=makePool(newWell,…)`＋`integrateWells`＋**`applyGravity(dt)`**＋`placeWell` verb（PATTERNS 近辺 or 新 section、**S4 lasers 節の隣に**）／（coreR>0時）`collidePlayer*` に1パス／RenderFrame に**弾の下** draw／`doBomb` に well 休眠／各 clear 箇所 |
| **ENGINE CORE** | `applyGravity` を `simStep` の `integrateBullets` 直前に（`if(wells.count)` ガードで no-op 保証） |
| **PATTERNS** | 全方位螺旋は既存 `spiral` 流用（`av:0`）／風神の風壁は既存 `waveSideSweep`/wall 流用 |
| **SPELL REGISTRY** | 看板スペルが3カード以上で再利用されたら motif 昇格（基本は `raw:function*`） |
| **WAVES** | 弱 well を置く雲妖 wave・V字編隊 |
| **BOSSES** | `fujin`（中ボス, 2ph, 撃破）・`susanoo`（7ph） |
| **STAGES[]** | `STAGES[4]` timeline（道中→中ボス風神(撃破)→道中→山場→須佐之男7ph→`{stageClear}`）／S4 を `{stageEnd}` 化／次面送りは `run._advanceTo` 経路 |
| **BGM** | `design/bgm-tracks.js` に3曲＋`SCALES`、pipeline で再インライン |

---

## 10. 留意（既存の教訓を適用）

- **golden は1面/boot のみカバー**。Stage 5 を足しても Stage 1 + boot が byte-identical なら回帰なし（stage h=3188712340 / boot-rng=0.19207037752494216 / 全 emitter）。**各段で再捕捉して cmp**。プレビューは `?stage=5`。
- **再利用できる既存シーム**（S2/3/4 で実装済）: 道なし scenery 分岐（§2）／deferred stage-advance `run._advanceTo`（次面送りはこの経路必須）／`{stageEnd}` verb／`BOSS_DESIGNS[].hitShapes`（当たり判定の見た目一致）／**S4 lasers 系統の実体プール配線（well の雛形）**。**撤退 retreat は今回不使用**（中ボスは撃破）。共有HP twin（S3）は今回不要（単体ボス）。
- **well は『既存弾を曲げる』＝レーザー(新ハザード)とは別物**。新規作業の核は `applyGravity` パスであって、撒く弾は通常の直進弾。
- **power gap**: 実プレイは power=max 進入。boss HP・道中数を DPS 比でスケール（[[stage-difficulty-power-gap]]）。
- **honest constants**: 隠れたグローバル ×k を入れず、係数は source 値に畳む（ユーザ方針 [[honest-constants-no-global-multipliers]]）。
- **視認性**（§2 caveat）は明るい面の生命線。渦コア/雷光/螺旋/明るい空が白飛びで潰し合わないこと。`'lighter'` 累積に注意（渦コアは source-over 寄り）。
- **⚠ 1行関数のインラインコメントは必ず `/* */`**（`//` は行末まで＝閉じ括弧を巻込み "Unexpected end of input"。S4 で踏んだ）。
- **公平性チューニングがこの面の核**: well の `strength` 過大＝吸い込み理不尽、`swirl` 過小＝1点に潰れて死の塊、予告短すぎ＝読めない。`R` 可視化＋接線 swirl＋クランプ＋緩い breathe 予告＋密度キャップ＋ボム休眠の合わせ技で「読めて避けられる渦」にする。playwright で自分の目で確認。

---

## 11. 未決定リスト（次セッションで詰める）

- [ ] `THEMES.storm` 具体 hex 一式 ＋ storm scenery（雲海＋嵐雲壁＋雷光）の draw、`tempest{}` アクセント色
- [ ] well の `R` / `strength` / `swirl` / `coreR` / warn・active・fade 秒（**tuning＝公平性の核**）
- [ ] 致命コアを付けるフェーズ（P6/P7 のみ？ or 純レンズで通す？）
- [ ] `drawBossSusanoo`（嵐神・長髪＋十拳剣）/ `drawBossFujin`（風袋の門番）の意匠、`hitShapes` 要否
- [ ] BGM `stage5`/`midboss5`/`boss5` の旋法・key・BPM・モチーフ（audition でユーザ確定。S4 被り回避が要）
- [ ] 道中に渦をどれだけ出すか（1個ずつ・短命）
- [ ] 各ボスフェーズ・中ボス・スペルの最終 HP / 数値（power gap スケール後）
- [ ] スペル名最終化（嵐の目 / 双つ巴 / 八雲立つ / 天叢雲 / 風神スペル名）
- [ ] 自機ホーミングを well で曲げるか（当面 out＝enemyBullets のみ。任意拡張）

---

## 12. S6 への申し送り（弧を閉じる）

- **S6＝終幕候補＝天岩戸**: S4 陽が昇る → S5 嵐が荒らす → **S6 陽が隠れ、取り戻す**。神話順で一本。
- S6 の新ギミック（合意済）＝**置き弾幕 ＋ 弾を生む弾**。岩戸＝「闇／陽が隠れる」と「置いた弾が生み続ける」が噛みやすい（暗→光の劇的回復で終幕）。
- 須佐之男(S5)を倒した先に岩戸（S6）が来る筋なので、**S5 を倒し切る（terminal でなく `{stageEnd}` で S6 へ）構成に最終的に組み替える**（S6 実装時）。S5 単体出荷時は `{stageClear}` terminal でよい。
