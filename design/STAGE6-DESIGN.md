# Stage 6 設計：「天岩戸 / The Heavenly Rock Cave」— 終幕

> **設計＋実装 完了文書。** 設計確定 2026-06-06 / **実装完了 2026-06-06**（同セッション、ultracode workflow）。S4↔S5↔S6 の神話弧を閉じる**最終ステージ**。
> **2026-06-06 フィードバック pass 1 で3点改修済**（§以下の「置き弾幕」「中ボス」記述は当初設計で、実装では下記に進化）:
> (1) **置き弾幕→「留まる弾」(`spawnLinger`/`_updLinger`)**: 静止配置 lamp は「プレイヤーが行かない位置＝無駄」というユーザ指摘で全廃。**発射→減速→停留→resume/fade** に置換（固定軌道/自機狙い/緩い追尾）＝撃ち出すから当たる所に飛んで停まる。fade末期の不可視致命は `collidePlayerBullets` を `b.fade<0.2` でgate（golden不変）。
> (2) **道中編隊を全新規**: 斜線陣(wisplight)/市松→flank(checkerSplit)/複列横陣 交互(rowsAlt)/密集→散開(clusterBurst)。drifters/sideSweep/swoop の再利用撤去。
> (3) **中ボス＝土蜘蛛(Tsuchigumo)**: 「背負った humanoid は既出」指摘で 禍津日(cowled)→大地蜘蛛(非humanoid, 8脚)。web/silk＝lingering糸と直結。P2=卵嚢 egg-sac。
> **実装済の要点**: 置き弾幕(`spawnLamp`/`_updPlaced`)＋弾生成(`spawnSeed`/`_updSeed`)＝既存 `enemyBullets`+`b.update` だけ（新プール/simStep/collide/doBomb 配線ゼロ）/ 弾 style `lamp`(source-over)/`ember`/`lightpetal` / `THEMES.iwato`＋暗洞 scenery(`buildIwatoScenery`/`drawSceneryIwato`)＋`_iwatoLight` 0→1 暗→光 / `BOSS_DESIGNS.tokoyo`(黒い日輪)+`magatsuhi` / 中ボス `MAGATSUHI_SPEC`(2ph撃破) / ボス `TOKOYO_SPEC`(8ph 拡張フィナーレ, P8 で `_iwatoLight` ramp + lightpetal) / road `waveWisplight`+`waveSeedfall` / `STAGES[5]`＋S5`{stageEnd}`化＋ALL CLEAR overlay分岐＋bossDefeat の暗→光 snap(activeTheme.iwato guard) / BGM stage6/midboss6/boss6(ドラフト, audition待ち)。**検証**: golden Stage1/boot byte-identical、全 boss phase 弾数 headless ≤309(breeder 1世代有界)、5次元 adversarial review(confirmed=1[P8 dawn fast-kill freeze]→修正済 / refuted=10)、?dev/?stage=6 で road/両ボス/暗→光/ALL CLEAR を視認。**残**: BGM audition + well-less の placed-lattice の難度フィール playtest(レビューが「ゲーム帯より上で gap 強制が緩い」と指摘=balance softness, 非bug)。
> 併読: `CLAUDE.md`（§index.html architecture, §golden, §BGM pipeline）、
> `design/ARCHITECTURE-V2.md`（forward roadmap）、`design/STAGE5-DESIGN.md`（直前の同型文書＝well 系統の実装例）、
> `design/STAGE4-DESIGN.md`（lasers 系統＝実体プールの実例）、
> メモリ [[v2-architecture-plan]] [[stage-difficulty-power-gap]] [[bgm-build-pipeline]] [[power-economy-and-poc]]。

---

## 0. サマリ / ステータス

- **Stage 6 = 終幕。「天岩戸（あまのいわと）」＝陽が隠れ、世界が常夜に沈み、取り戻す物語。** ゲーム全体（光の循環）のクライマックス。
- **新ギミック＝置き弾幕 ＋ 弾を生む弾**（S4=予告レーザー+巨大弾, S5=螺旋+重力場 の合意配分の3枚目＝最後の1枚）。
  - **重要な構造的事実: この2ギミックは新しいエンジンシステムを要らない。** S4 のレーザー（`lasers` プール＋`integrateLasers`＋`collidePlayerLasers`＋`drawEnemyLasers`）や S5 の well（`wells` プール＋`integrateWells`＋`applyGravity`＋`collidePlayerWells`）と違い、**S6 は既存の `enemyBullets` プール ＋ `b.update`/`custom` シーム（`_updSun`/`_updBounce` が前例）だけで成立する**。新プール無し・新 simStep パス無し・新 collide パス無し・新 doBomb 配線無し（理由は §3）。**終幕の新規性は danmaku オーサリング（custom update fn ＋ 数個の弾 style）であってエンジン配管ではない**。
- **ユーザ確定の2大判断（2026-06-06）**:
  1. **大ボス＝常夜の闇（トコヨ系）。** 太陽神アマテラスは**戦う相手でなく『救う対象』**。**闇そのものを討つ→岩戸が開き陽が戻る**。暗い舞台＝置き弾幕／弾生成が最も映えるキャンバス。
  2. **終幕は標準7フェーズの型を破る『拡張フィナーレ』。** 岩戸＝闇のフェーズ（黒背景に映える置き弾幕・弾生成）で進み、撃破直前に**『暗→光』の変身**＝陽が氾濫する**真・最終フェーズ**へ。ゲーム最大の見せ場。
- **明るさ戦略は S4/S5 の真逆（重要）**: S4/S5 は**明るい場で輝度が脅威**だった（プレイ帯を中トーンに抑え輝度を horizon/陽/雷に集約）。**S6 は暗い場で弾が発光する**＝視認性ルールが反転（場を暗く、置き弾/種火/glyph は bounded な冷光で光らせ、黒に対し最大可読）。暗→光の氾濫は**ramp で入れて自機が白飛びに飲まれないこと**。
- **登場人物（案①）**:
  - **大ボス＝常夜（Tokoyo / 常夜の闇）。** 形なき闇＝**黒い日輪（皆既日食盤）**として描く＝S4 八咫烏／日輪の**暗黒の鏡像**（anti-Amaterasu）。暗い場でも黒盤＋冷光リムで一発で読める。8フェーズ（拡張フィナーレ）。
  - **中ボス＝禍津日（Magatsuhi）。** 災いの眷属・岩戸の前の番。**撃破（retreat でない＝S4 山姥/S5 風神型 `bossDefeat`）**、2フェーズ。**置き弾幕＋種火を低密度で導入する慣らし場**（S4 小烏がレーザーを、S5 雲童が well を慣らしたのと同型）。
- **BGM＝専用3トラック**: `stage6`（岩戸への道・暗く張り詰める）/ `midboss6`（禍津日）/ `boss6`（常夜→御来光）。**boss6 は二部構成で『暗→光』に key-lift を当てる＝この lift だけは全ステージ通して正当**（前面は安易な lift を避けてきたが、終幕の『光が literal に戻る』瞬間は lift の全目的そのもの）。
- **ステージ連結**: 現状 S5 が `{stageClear}` terminal → **S5 を `{stageEnd}`→S6** に、**S6 を `{stageClear}` terminal**（真の ALL CLEAR）に。送りは必ず `run._advanceTo` 経路。S6 の clear＝ゲーム全クリア（finale 専用テキスト＝§12）。
- **着手順**: §8。各段 `?golden=1` で **Stage 1 + boot が byte-identical**（stage h=3188712340 / boot-rng=0.19207037752494216）を回帰確認（golden は1面/boot のみカバー＝2面以降は golden に出ない。出たら事故）。プレビューは `?stage=6`。

---

## 1. コンセプト / 物語 — 光の循環が一巡して閉じる

- **光の循環の終点**: 春昼(S1)→彼岸黄昏(S2)→夜の竹林(S3)→山の曙(S4＝八咫烏＝陽が昇る)→高天原の嵐(S5＝須佐之男＝嵐が天を荒らす)→**S6 陽が隠れ、世界が常夜に沈み、取り戻す（天岩戸）**。一巡して**最も明るい(S1春昼/S4曙) と 最も暗い(S6常夜) の対比で締める**。
- **神話順で正位置**: 須佐之男(S5)が高天原で暴れ尽くした**結果**、アマテラスが岩戸に隠れる。よって S5→S6 は神話の因果がそのまま一本の弧。
  ```
  S4 陽が昇る(八咫烏) → S5 嵐が天を荒らす(須佐之男) → S6 陽が隠れ常夜に沈み、取り戻す(天岩戸)
  ```
- **舞台＝天岩戸の前、常夜に沈んだ世界**: アマテラスが岩戸に籠もり、世界は闇（常夜）に覆われた。八百万の神々（＝プレイヤー側）が岩戸の前に篝火を焚き、陽を呼び戻そうとする。だが闇＝常夜が実体化して阻む。**プレイヤーは常夜を討ち、岩戸を開いて陽（アマテラス）を取り戻す**。
- **感情のレジスター＝『闇と、その向こうの夜明け』**: S6 の脅威は「光が読めない眩しさ」(S4)でも「渦に巻かれる」(S5)でもなく、**『闇の中に置かれた危険を読み、生まれ続ける弾の先を読む』**こと。静かで張り詰めた暗→撃破で**陽が氾濫する圧倒的カタルシス**。
- **置き弾幕／弾生成と舞台の噛み合い（強い）**: 闇＝陽が隠れた世界 ＝ **黒いキャンバス**。そこに**置き弾幕＝冷たい光の glyph／常夜の燭**が灯り、**弾を生む弾＝種火が闇に湧いては芽吹く**。黒地だから置き弾も種火も最大に読める。撃破＝**置かれた闇の glyph が陽光の花びら(S1 桜の callback)に上書きされて散る**＝暗→光の劇的回復で全曲を閉じる。

---

## 2. テーマ（新 `THEMES.iwato`）＋ 暗→光 の変身

`THEMES` に `iwato` を追記（spring/dusk/bamboo/summit/storm の隣）。`setTheme('iwato')` で petal 再bake＋scenery 再構築。

- **空／場（前半＝常夜）**: プレイ帯は**ほぼ黒〜深い藍墨**（洞内）。S4/S5 と真逆で**暗いほど弾が映える**。輝度は**置き弾の冷光・種火・篝火・遠景の岩戸の隙間光**にだけ宿す。
- **scenery（道なし分岐の6例目）**: `iwato:true` を立て `buildScenery`/`drawScenery` を `buildIwatoScenery`/`drawSceneryIwato` へ分岐（`ghost`/`bamboo`/`summit`/`storm` と同型＝道はないが流れる＝既存 `bgScroll` 共有でボス到達 hover ease が無料）。要素＝**そびえる岩壁・鍾乳の影・八百万の神が焚く篝火（worldY 固定で流れる）・漂う火の粉**。遠景に**巨大な天岩戸（岩の扉）**が迫り、近づくと隙間から細い陽光が漏れる。
- **petal**: 火の粉／灰／冷たい光の粒（篝火に煽られ昇る。`petalShape` シーム＝S5 `'streak'` の前例で `'ember'` 等を足せる。`buildPetals` の rng 消費は不変に保つ＝golden 安全）。
- **★ 暗→光 の変身（ゲーム最大の見せ場・新規 scenery 作業）**: 真・最終フェーズ(P8)の頭で発火。`iwato` テーマに `lightReturn` ステート（0→1 を数秒で ramp する係数）を持たせ、`drawSceneryIwato` が**洞の黒から夜明けの暖色へパレットを補間**＝岩戸が割れ陽光が画面に氾濫。
  - 実装案: テーマに `dawn{ sky, glow, ray }` の到達パレットを持たせ、`lightReturn` で literal 補間（あるいは `setTheme('dawn')` の対パレットを用意して**そちらは ramp なしの即時切替を避け**、係数で混ぜる）。**一フレーム白飛びを避け数秒で立ち上げる**（S4 教訓: 速い strobe 禁止／輝度は bounded）。自機スプライトが**最も忙しい瞬間に光に飲まれない**よう、氾濫させつつ自機・弾は読めるコントラストを残す（god-ray は背面、弾は前面の冷→暖光で）。
- **アクセント色を外出し**（S3 `bamboo.grove`/S5 `storm.tempest` の手法）: `THEMES.iwato.night{ ink, lamp, ember, brazier, slit }` ＋ `iwato.dawn{ sky, glow, ray }` 等にして後でデモ調整を楽に（既定値＝literal 再現で見た目不変）。
- **⚠ 視認性 caveat（反転版・最重要）**: 暗い場＝`'lighter'` 加算は**黒地ではむしろ正しい**（S4/S5 の白飛び問題は明るい場ゆえ）。ただし**置き弾の密な lattice は加算で滲んで一枚の光の壁に潰れ得る**＝glow 半径を bounded に、placed glyph は点として分離して読めること。**暗→光 の氾濫だけは別**＝そこで初めて輝度が出るので、自機/弾を飲まないよう ramp＋前面コントラスト確保。
- **未決定（次セッションで詰める）**: 具体 hex 一式（night/dawn 両パレット）、岩戸 scenery の draw、火の粉、`lightReturn` ramp の出し方・秒数。

---

## 3. 新ギミック ＝ 置き弾幕 ＋ 弾を生む弾【既存 `enemyBullets`＋`b.update` だけで成立】

> **S4(レーザー)/S5(well) との本質的な違い**: あれらは『新しいハザード実体』だったので新プール＋integrate＋collide＋draw＋clear＋doBomb を要した。**S6 のギミックは『普通の敵弾の、振る舞いの拡張』**＝既存 `enemyBullets` プールに、自分の寿命を回す `b.update` を持った弾を撒くだけ。前例＝`_updSun`（巨大弾＝rise→cross の scripted ライフサイクル）／`_updBounce`（反射弾）。**新規エンジン配管はゼロ**＝golden は自動で byte-identical（既存 `integrateBullets` の `if(b.update)` 分岐は既に全弾で走る。S6 は単にその分岐を使う弾を足すだけ＝Stage 1 では一切 spawn されない）。

### (a) 弾を生む弾（種火 / breeder seed）

- **実体**: `spawnBullet({ …, custom:true, update:_updSeed })`。`_updSeed(b,dt)` が**親弾を進めつつ内部タイマーを刻み、周期的に `spawnBullet` で子弾を産む**。前例 `_updSun` を雛形に（custom-update 弾は既に動いている）。
  - 親は**漂う／置かれる／落ちる**いずれでも可。子は**通常の直進弾**（`av:0`、リング/扇/狙い）。黒地に種火が湧いては芽吹く絵。
- **設計フィールドは既に存在**: `newBullet()` の `delay/turn/turnAbs/speed2/bounces/fired/phase/_spr` は scripted ライフサイクル弾用＝種火の世代・発火回数・周期を持たせるのに流用可。新フィールドが要れば `_xxx` 命名で足す（spawnBullet 後にコルーチン/spawn 側で代入＝`_updSun` の `b._y0` 等と同じ流儀）。
- **⚠ 最重要の安全策＝指数増殖を断つ**: 種火が種火を産むと指数爆発。**世代を有界化**せよ:
  - 既定＝**種火は『不活性な直進弾』だけを産む（子は二度と breeder にならない）**＝1世代で止める。
  - もしくは**子-per-種火 と 種火寿命を固定キャップ**＋総数を headless で実測（S5 well 同様 `captureEmitter` で全 well-phase の弾数有界を実証した手順を踏襲）。
  - `enemyBullets` プールは**枯渇時 grow（shrink は明示 API）**＝有界化を怠ると**メモリが膨らむ**。**これがこの面唯一の実エンジンリスク＝必ず headless で全 breeder phase の弾数有界を実証**（S5 と同じ検証手順）。
- **ボム交互作用は自動**: 種火（親）は普通の `enemyBullets`＝**`doBomb` の `clearBulletsToSparkles(…,1e9)` が画面全弾を消す＝親も消える＝増殖も止まる**。S4 lasers/S5 wells のような**専用 doBomb 分岐は不要**（パニックボタン契約が無料で成立）。

### (b) 置き弾幕（常夜の燭 / placed lattice）

- **実体**: **その場に置かれ動かない弾**で glyph/格子/星座を成す。黒地に冷光の壁＝『流れを避ける』でなく『**読んで縫う**』danmaku。
- **⚠ 置き弾は『不死』＝必ず自己消滅させること（engine fact 確認済）**: `integrateBullets` の despawn は**画面外に出た弾だけ**を殺す。**静止弾（vx=vy=0, av=0, update 無し）は画面外に出ないので永遠に残る**。さらに **`runPhase` は phase 末に `lasers.clear()`/`wells.clear()` はするが `enemyBullets` は clear しない**（index.html:3234 で確認）＝置き弾は**フェーズを跨いで蓄積する**。
  - **解＝置き弾も custom-update 弾にして寿命を内蔵**（`_updPlaced(b,dt)`: `hold` 秒その場に留まり→任意で bloom（リング/扇を spawn）→`b.alive=false` か加速離脱）。**これで engine に手を入れず golden も自明に安全**（新たな phase-clear を足さない）。⚠ **純静止弾（update 無し）を撒くなら**、撒いた phase の終わりに**明示的に reap する仕掛けが要る**（runPhase が enemyBullets を消さない＝専用処理が要る）＝**寿命内蔵の方が圧倒的に安全＝そちらを既定とせよ**。
- **ボム交互作用は自動**: 置き弾も `enemyBullets`＝`doBomb` が消す（パニックボタン無料）。
- **置き弾の読み**: 置く時に**冷光の予告**（一瞬薄く点いてから致命化＝S4/S5 の breathe 予告の弾版。速い strobe 禁止）を入れると「ここに壁ができる」が読める。`_updPlaced` の前半 `warn` 区間で薄く、後半で致命に。

### (c) 弾 style（描画）

- 黒地に映える新 style を `getBulletSprite`（style+hue でスプライト bake）に足す＋ `drawEnemyBullets` に draw 分岐:
  - `'lamp'`（置き弾＝冷たい白青の glyph／燭。bounded glow）
  - `'ember'`（種火＝親。芯＋ゆらぐ冷暖光、子と区別できる固有見た目）
  - `'lightpetal'`（ACT II＝陽光の花びら。S1 桜の暖色 callback＝暗→光で置き glyph を上書きして散らす radiant 弾）
- **⚠ 加算 vs source-over**: §2 caveat。置き弾の密 lattice は glow を bounded に（潰れ防止）。暗→光 の radiant 弾は氾濫するので前面コントラストを保つ。

---

## 4. ボス：常夜（Tokoyo / 常夜の闇）— 拡張フィナーレ（型を破る）

- **意匠**: 新 `BOSS_DESIGNS.tokoyo`（`{ draw:drawBossTokoyo, scale, hitR, hitShapes? }`）＋ `drawBossTokoyo`（RENDER）。**形なき闇＝『黒い日輪（皆既日食盤）』**＝黒い円盤＋細い冷光のコロナ＋冷たい複眼の光。**S4 八咫烏／日輪（暖かい陽）の暗黒の鏡像＝anti-Amaterasu**。
  - **暗い場で暗いボスは見えない問題の解**: 黒盤が**背景を occlude し冷光リムで縁取られる**＝洞の闇に対し『陽でない円盤』として一発で読める。蛇/少女/双子/烏/老婆/嵐神/風神 と完全非重複（円盤＝日食は唯一）。
  - **当たり判定**: コロナ/触手で非円形なら S4 の **`BOSS_DESIGNS[design].hitShapes:[{dx,dy,r},…]`**（design ローカル座標、`collideShotsEnemies` が `scale` 倍して追加円。null=no-op＝golden 不変）で張り出しに当たり円を足す。基本は body core で足り、必要時のみ。
- **8フェーズ（拡張フィナーレ＝2幕構成。ACT I 常夜 → 変身 → ACT II 御来光）**: 標準 nonspell3/spell3/survival1（=7）を意図的に超え、**真・最終 P8 を増設＋幕間に暗→光の変身**を置く。

  | # | 幕 | 種別 | 名（案） | 主ギミック |
  | --- | --- | --- | --- | --- |
  | P1 | I | nonspell | 宵闇の置き火（導入） | 疎な置き glyph＋狙い |
  | P2 | I | spell | **常夜の燭台 / Lampstand of Eternal Night** | **置き弾幕 看板1**（冷光 glyph の壁を縫う） |
  | P3 | I | nonspell | 禍の苗（導入） | **弾を生む弾 導入**（低 breed） |
  | P4 | I | spell | **禍津の苗代 / Seedbed of Calamity** | **弾を生む弾 看板**（漂う種火がリングを芽吹く） |
  | P5 | I | nonspell | 常闇の帳 | 置き lattice ＋ 種火 少数（複合） |
  | P6 | I | spell | **常夜の檻 / Cage of Eternal Night**（ACT I 山場） | **置き弾幕 × 弾を生む弾 融合**（回転する glyph の檻＋内側で種火が芽吹く。**ボス中央**＝回転理不尽回避） |
  | P7 | — | survival | **夜明け前 / Before the Dawn**（最暗・~26s） | 置き弾＋種火が全画面。耐久終了で**変身トリガ** |
  | **P8** | **II** | **真・最終** | **天岩戸開 / The Cave Opens（陽が還る）** | **暗→光 氾濫**。黒い日輪が還る陽光に蝕まれ、置いた闇の glyph が**陽光の花びら(S1桜 callback)に上書きされて散る**。今度は**照らされて読める** radiant ラスワ |

  - **ACT 境界 = 暗→光 の変身（P7 survival 終了 → P8 頭）**: §2 の `lightReturn` ramp 発火。岩戸が割れ夜明けが氾濫＝**ゲーム最大のカタルシス**。P8 クリア → 常夜が砕け陽が完全に戻る → ALL CLEAR（§12）。
- **S4/S5 から効くスペル設計の教訓**:
  - **回転 vs 緩め**: 回転する檻(P6)はプレイヤーに回転運動を強いる＝**ボス中央**に据え、ばら撒きは**楽にすり抜けられる密度**に、回転を**遅→速ランプ**（S4/S5 教訓）。**置き弾は『安地が消える』のは可、`warn` 無しで突然致命は不可**（予告必須）。
  - **種火の公平性**: 種火の芽吹く**位置と先を読ませる**＝breed は周期的・予告付き・**指数増殖させない**（§3a）。安地が**動く**のは可、**消滅して詰む**のは不可（密度キャップ）。
  - **last word ランプ**（S4/S5 で全 last word に後付け済の手法）: P8 radiant ラスワも `lerp(easy,現行,k)` で残り数秒に全開＝終幕に相応しい山。
- **HP**: 実プレイは power=max 進入＝[[stage-difficulty-power-gap]] に従い DPS 比でスケール。**最終ボス＝最上位 HP 帯（S5 須佐之男のさらに上）**。8 フェーズ分、各フェーズを設定（survival P7 と真・最終 P8 は timer/HP 配分に注意）。
- **BGM 切替**: 常夜登場で `boss6`。**P8 の暗→光で boss6 内が dark mode → 御来光 lift へ転調**（§7）。

---

## 5. 中ボス：禍津日（Magatsuhi）— **撃破**（retreat でない）＝ギミック慣らし場

- **意匠**: 新 `BOSS_DESIGNS.magatsuhi` ＋ `drawBossMagatsuhi`。**災いの眷属＝岩戸の前の番**、常夜（主）の先触れ。蛇・少女・双子・烏・老婆・嵐神・風神・常夜 のどれとも非重複（**蠢く影＋冷光の灯を提げた禍つ霊**等）。
- **撃破挙動**: S2/3 の retreat ではなく**通常 `bossDefeat`**（死亡爆発＋drops）＝S4 山姥/S5 風神型。利点＝手応え＋**death 爆発と drop が power/score 源**。物語＝**岩戸の前の禍を討って、奥の常夜の闇へ至る**（中ボス撃破→大ボスの導線）。
- **フェーズ**: 2フェーズ（1 nonspell ＋ 1 spell）→ 死亡。
- **固有弾＝ギミックの慣らし（S4 小烏=レーザー / S5 雲童=well と同型＝『道中/中ボスで弱く導入→ボスで本番』）**:
  - P1 nonspell＝**疎な置き弾＋狙い**（置き弾幕を低密度で初体験）。
  - P2 spell＝**少数の種火が低 breed**（弾を生む弾を初体験）。
  - ボス本番(常夜)が両ギミックを**全開・融合**で出す前の地ならし。**新規システム不要**＝§3 の `_updPlaced`/`_updSeed` を弱パラメータで。
- **BGM**: 専用 `midboss6` に切替（Stage 1/4/5 に倣う＝道中曲流用でない）。

---

## 6. 道中（road / 中道）

- **アイデンティティ**: 常夜の小妖（迷い火／禍の雛）が**一瞬の置き弾（冷光の灯）を点しては、自分の撒き弾で挟む**＝置き弾の予告→縫いの慣らし場（§3b の `_updPlaced` を弱く。短命・疎）。**種火も道中に1〜2粒**（芽吹きの読みを慣らす）＝**道中で弱く両ギミック導入**（S4 道中=予告レーザー慣らし／S5 道中=弱 well 慣らし と同型）。
- **モーション**: 闇の洞＋篝火＋火の粉（§2 scenery）。岩戸が遠景で迫る。
- **陣形ポリシー（[[v2-architecture-plan]] のユーザ方針を厳守）**: 横一列 curtain を嫌う。**複数編隊・時間差・離れた位置・縦方向（深さ）も使った 2D 陣形**（`waveDrifters` の `speed/speedJit/drift/band`、`waveSideSweep` の `yStep` echelon、S5 で作った `waveVortexRing`/`waveSwoopDive` も再利用可。中央収束 drift は逆効果＝薙ぎ易くなる）。
- **power 源**: 神々／烏天狗の V 字編隊（既存 `waveVFormation` 流用、`halvePower` 等の既定維持フラグ可）。総数は power economy 維持（[[power-economy-and-poc]]）。
- **配置**: `WAVES` に「置き弾を点す迷い火 wave」「種火を1粒落とす wave」を追加。
- **未決定**: 道中に置き弾/種火をどれだけ出すか（出し過ぎ＝重い・五月雨で読めない。1〜2粒・短命に）。

---

## 7. BGM（専用3トラック ＝ Stage 1/4/5 に倣う）＋ 暗→光 の earned key-lift

`design/bgm-tracks.js` の `TRACKS` に **3曲**追加 → audition → `build-game.js` で `/*BGM:GEN*/` 再インライン。

- `stage6`（岩戸への道＝暗く張り詰める・静かな畏れ）/ `midboss6`（禍津日）/ `boss6`（常夜→御来光）。
- **全て独立した曲**（既存5面の reskin にしない＝記憶の教訓。**メロディ＝モチーフの輪郭・リズム DNA を別物に**）。[[bgm-build-pipeline]] [[boss2-bgm-audition]]
- **★ boss6 ＝二部構成で『暗→光』に key-lift（この lift だけは全曲通して正当）**: 前半 ACT I＝**暗い旋法**（Locrian/octatonic/aeolian 等、常夜の重さ）。P7→P8 の変身で**radiant な長調へ転調＝陽が literal に戻る瞬間に lift の全目的が一致**。前面（S4 boss）で安易な lift を避けてきたのは「物語的接続のない lift は安い」から。**終幕＝光が物理的に戻る＝lift がここで初めて意味を持つ**。
  - 実装: `boss6` を1曲の中で section が暗→明へ進む構成にするか、`boss6` と `boss6dawn` の2キーにして P8 頭で `playMusic('boss6dawn')` 切替（`playMusic` は `trackOf(name)` で任意キー＝ホワイトリスト編集不要）。**前面 pass4 で『ボス出現前 BGM フェード』が playtest で却下された**点に注意＝ここでは**フェードでなく『変身に同期した転調 or 切替』**（暗→光は唐突さでなくクライマックス＝切替が映える）。[[v2-architecture-plan]]
- **旋法**: 既存（S1 Am, S2 Dharm, S3 Ehira/E In, S4 Amaj/D Lydian/F#harm/C, S5 Ador/Bharm/Coct）と被らない選択。`SCALES` に追記。
- **切替点**: 道中＝`stage6`、禍津日登場＝`midboss6`、常夜登場＝`boss6`、P8 変身＝`boss6`(転調) or `boss6dawn`。
- **pipeline**（CLAUDE.md §BGM）:
  ```bash
  # design/bgm-tracks.js に stage6/midboss6/boss6(+dawn?) を追加
  node design/bgm-tracks.js        # lane/in-key 検証
  node design/build-bgm.js         # bgm-demo.html 再生成 → A/B 試聴（要ユーザ）
  node design/build-game.js        # /*BGM:GEN*/ を index.html に再インライン
  node design/build-game.js --check
  node design/test-bgm-unlock.js
  ```
- **未決定**: 各曲 key/BPM/モチーフ、boss6 の暗→明構成（1曲内転調 or 2キー）、`SCALES` 追加。audition でユーザ確定。

---

## 8. 実装ビルド順（各段 `?golden=1` で Stage 1+boot 不変を確認）

> S6 のギミックは新エンジン配管ゼロ（§3）＝**最初の山は『custom update fn 2種＋弾 style』**、最大の山は**暗→光の変身演出**と**8フェーズのオーサリング**。

1. **`_updSeed`（弾を生む弾）＋ `_updPlaced`（置き弾＝寿命内蔵）** を `?stage=6` デバッグ起動で**最小プロトタイプ**として差し込む（`_updSun` を雛形に）。**指数増殖を断つ有界化**を最初に固める＝**headless `captureEmitter` で弾数有界を実証**（S5 well と同じ手順）。弾 style `'lamp'`/`'ember'` を `getBulletSprite`＋`drawEnemyBullets` に。**空＝Stage 1 で一切 spawn されない＝golden 自明に不変**。
2. **`THEMES.iwato`（常夜パレット）＋ iwato scenery**（§2、視認性 caveat 反転版。playwright で自分の目で＝global note #19）。
3. **暗→光 の変身**（`lightReturn` ramp ＋ `dawn` 到達パレット ＋ `'lightpetal'` style）。**ゲーム最大の見せ場＝必ず自分の目で**（ramp 秒数・白飛び・自機可読性）。
4. **道中 WAVES ＋ 中ボス禍津日**（§6・§5。撃破＝`bossDefeat`、2ph、ギミック慣らし）。
5. **ボス常夜 8フェーズ**を `STAGES[5]` timeline に（§4）。ACT I（P1–P6）→ survival P7 → 変身 → 真・最終 P8。
6. **BGM `stage6`/`midboss6`/`boss6`(+dawn)**（§7、暗→光 lift）。
7. 難度スケール（[[stage-difficulty-power-gap]]・power=max 進入）・実プレイ調整（置き弾の予告秒・種火の breed 周期/総数＝この面の公平性の核）。
8. **ステージ連結**: S5 を `{stageClear}`→`{stageEnd}`（index.html:3739 のコメントが既に予告）、S6 を `{stageClear}` terminal に。次面送りは `run._advanceTo` 経路。**S6 clear＝ゲーム全クリア**（finale 専用テキスト＝§12）。

---

## 9. index.html 配置（CLAUDE.md §architecture 参照。行番号はドリフト＝banner/symbol で辿る）

| 置く所 | 追加物 |
| --- | --- |
| **THEMES** | `THEMES.iwato`（night/dawn パレット外出し）＋ `iwato:true` scenery 分岐（`buildIwatoScenery`/`drawSceneryIwato`）＋ `lightReturn` ステート＋ `petalShape:'ember'` 可 |
| **BOSS_DESIGNS** | `tokoyo`（黒い日輪／日食盤）・`magatsuhi`（draw fn は RENDER に `drawBossTokoyo`/`drawBossMagatsuhi`。非円形なら `hitShapes`） |
| **弾 style** | `getBulletSprite` に `'lamp'`/`'ember'`/`'lightpetal'` の bake、`drawEnemyBullets` に draw 分岐（glow bounded） |
| **custom update fn** | `_updSeed`（breeder＝有界化必須）・`_updPlaced`（置き弾＝寿命内蔵）。`_updSun`/`_updBounce` の隣に。**新プール・新 simStep パス・新 collide・新 doBomb 配線は不要**（§3） |
| **PATTERNS** | 置き弾／種火は §3 の custom 弾。子弾・檻の格子は既存 `pat.ring`/`nWaySpread`/`spiral` 流用（`av:0` 直進） |
| **SPELL REGISTRY** | 看板スペル（燭台/苗代/檻/天岩戸開）が3カード以上で再利用されたら motif 昇格（基本は `raw:function*`） |
| **WAVES** | 置き弾を点す迷い火 wave・種火 wave・V 字編隊（S5 `waveVortexRing`/`waveSwoopDive` も再利用可） |
| **BOSSES** | `magatsuhi`（中ボス, 2ph, 撃破）・`tokoyo`（8ph, 拡張フィナーレ） |
| **STAGES[]** | `STAGES[5]` timeline（道中→中ボス禍津日(撃破)→道中→山場→常夜8ph→暗→光→`{stageClear}`）／S5 を `{stageEnd}` 化／送りは `run._advanceTo` 経路 |
| **暗→光 演出** | `drawSceneryIwato` の `lightReturn` 補間、`screenFlash`/`Render.flash` の氾濫、`'lightpetal'` の上書き散らし |
| **finale clear（§12）** | `STATE.STAGECLEAR` overlay（drawOverlays, index.html:2383）を **`run.stage===STAGES.length-1` で『ALL CLEAR / 全機クリア』分岐**＋光の循環 callback |
| **BGM** | `design/bgm-tracks.js` に3曲(+dawn)＋`SCALES`、pipeline で再インライン |

---

## 10. 留意（既存の教訓を適用）

- **golden は1面/boot のみカバー**。S6 を足しても Stage 1 + boot が byte-identical なら回帰なし（stage h=3188712340 / boot-rng=0.19207037752494216 / 全 emitter）。**各段で再捕捉して cmp**。プレビュー `?stage=6`。**S6 はそもそも新 simStep パスを足さない＝golden 不変は S4/S5 よりさらに自明**。
- **再利用できる既存シーム**（S2–S5 で実装済）: 道なし scenery 分岐（§2）／deferred stage-advance `run._advanceTo`（次面送り必須経路）／`{stageEnd}` verb／`BOSS_DESIGNS[].hitShapes`（当たり判定の見た目一致）／custom-update 弾 `_updSun`/`_updBounce`（§3 の雛形）／S5 `waveVortexRing`/`waveSwoopDive`（道中編隊）。**well/laser/retreat/共有HP twin は今回不要**（単体ボス・新ハザード無し）。
- **このギミックは『既存弾の振る舞い拡張』＝新ハザード実体でない**。新規作業の核は**有界な breeder（指数増殖を断つ）と 寿命内蔵の置き弾（不死を避ける）**、そして**暗→光 の演出**。
- **⚠ 唯一の実エンジンリスク＝breeder の指数増殖**: 種火が種火を産むと `enemyBullets` プールが grow-only で膨らむ。**世代を有界化（既定: 子は不活性直進弾）＋ headless で全 breeder phase の弾数有界を実証**（S5 well の検証手順を踏襲）。
- **⚠ 置き弾は不死（engine fact）**: `integrateBullets` は画面外弾しか殺さず `runPhase` は `enemyBullets` を clear しない（index.html:3234 確認）＝**置き弾は寿命内蔵（`_updPlaced`）にして自己消滅させよ**（純静止弾を撒くなら撒いた phase で明示 reap が要る＝寿命内蔵が安全）。
- **ボムは自動でギミックを無効化**: 置き弾も種火も普通の `enemyBullets`＝`doBomb` が `clearBulletsToSparkles(…,1e9)` で全消し＝**専用 doBomb 分岐不要**（S4 lasers/S5 wells と違いパニックボタン無料）。
- **視認性は反転**（§2 caveat）: 暗い場では `'lighter'` 加算が正しいが、置き弾の密 lattice は glow を bounded に。暗→光 氾濫だけは ramp＋前面コントラスト。
- **power gap**: 実プレイは power=max 進入。最終ボス HP・道中数を DPS 比でスケール（[[stage-difficulty-power-gap]]）。
- **honest constants**: 隠れたグローバル ×k を入れず係数は source 値に畳む（[[honest-constants-no-global-multipliers]]）。
- **⚠ 1行関数のインラインコメントは必ず `/* */`**（`//` は行末まで＝閉じ括弧を巻込み "Unexpected end of input"。S4 で踏んだ）。
- **公平性チューニングがこの面の核**: 置き弾の予告短すぎ＝突然致命で理不尽、種火の breed 過多＝詰む、暗→光 速すぎ＝白飛びで自機ロスト。予告 breathe（速い strobe 禁止）＋breed 周期/総数キャップ＋ramp 演出＋密度キャップ＋（ボムは無料）の合わせ技で「読めて避けられる闇」に。playwright で自分の目で。

---

## 11. 未決定リスト（次セッションで詰める）

- [ ] `THEMES.iwato` 具体 hex（night＋dawn 両パレット）＋ iwato scenery（岩壁・篝火・火の粉・遠景の岩戸）の draw、`night{}`/`dawn{}` アクセント色
- [ ] **暗→光 の変身**: `lightReturn` ramp の出し方・秒数、`'lightpetal'` の上書き散らし、白飛び回避＋自機可読性（**ゲーム最大の見せ場＝最優先で自分の目で**）
- [ ] 弾 style `'lamp'`/`'ember'`/`'lightpetal'` の見た目（黒地で映え・互いに区別・glow bounded）
- [ ] `_updSeed` の有界化方式（子は不活性直進弾で1世代止め？ or 子-per-種火＋寿命キャップ）＋ headless 弾数有界の実証
- [ ] `_updPlaced` の `warn`/`hold`/bloom 仕様（置き弾の予告→致命→消滅）
- [ ] `drawBossTokoyo`（黒い日輪／日食盤）/ `drawBossMagatsuhi`（禍つ霊）の意匠、`hitShapes` 要否
- [ ] BGM `stage6`/`midboss6`/`boss6`(+dawn) の旋法・key・BPM・モチーフ、boss6 の暗→明構成（1曲内転調 or 2キー切替）（audition でユーザ確定）
- [ ] 道中に置き弾/種火をどれだけ（1〜2粒・短命）
- [ ] 8フェーズ・中ボス・スペルの最終 HP / 数値（power gap スケール後）、survival P7 の秒数、真・最終 P8 の長さ
- [ ] スペル名最終化（常夜の燭台 / 禍津の苗代 / 常夜の檻 / 夜明け前 / 天岩戸開 / 禍津日スペル名）
- [ ] finale の ALL CLEAR / ending 表現の最終形（§12。Phase 8 の RESULTS/ALLCLEAR と擦り合わせ）

---

## 12. 終幕としての特別扱い（finale）

- **S6 の clear ＝ ゲーム全クリア（6面 itch.io 版の最終地点）。** `advanceStage`（index.html:2714）は最終ステージで `onStageClear()`→`STATE.STAGECLEAR`。**最終面はここで『STAGE CLEAR』でなく『ALL CLEAR / 全機クリア＋光の循環の締め』を出したい**＝`drawOverlays` の STAGECLEAR overlay（index.html:2383）を **`run.stage===STAGES.length-1` で finale 分岐**（小改修：テキスト＋ congratulations＋春昼に還る callback）。
- **本格的な RESULTS / ALL CLEAR 画面は Phase 8（延期分）**: per-stage 内訳＋total＋graze＋continues＋clear rank＋NAME_ENTRY。**ロードマップ上 Phase 8 は最後**＝S6 出荷時は**暫定の finale 分岐テキスト**で締め、正式 ALLCLEAR/results は Phase 8 で配線（予約 STATE `RESULTS`/`NAME_ENTRY` 上に）。[[v2-architecture-plan]]（§ARCHITECTURE-V2 Phase 8）
- **暗→光 ＝ 全曲の締め**: P8 で陽が氾濫し常夜が砕ける＝**光の循環（春昼→…→常夜→還る陽）が一巡して閉じる**。ALL CLEAR の背景は**還った夜明け（dawn パレット）**＝終幕の余韻。
- **6面化の完了**: S6 landing で V2 ロードマップの **Phase 11（Stage 3–6）が完了**。残りは Phase 12（perf＆仕上げ＝弾プールスループット profiling／results）→ Phase 8（延期メニュー画面）。[[v2-architecture-plan]]
</content>
</invoke>
