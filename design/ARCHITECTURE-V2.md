# 桜花弾幕 — 6ステージ拡張アーキテクチャ設計書（最終版）

> 本版は批評で指摘された11項目を全件反映している。各指摘はコードベース（`index.html` 1658行、`design/bgm-tracks.js`、`design/build-bgm.js`、`design/integrate-game.js`）に照合して検証済み。誇大な「データ駆動」「pixel-identical golden」「whitelist 撤廃で transport ゼロ変更」「uniform-grid で衝突救済」といった主張は、実装現実に合わせて**再フレーミング**した（どこをどう直したかは各節と §11 で明示）。

---

## 1. 設計思想 / 結論

**「出荷物は今まで通り単一の `index.html`（ダブルクリックで動く）を死守し、内部だけをセクション分割＋レジストリ化する。スケールは“ファイルが増える”ではなく“宣言が増える”で得る」**を核に据える。

ただし重要な訂正（批評#1）として、本設計は**「コンテンツを純データにする」とは主張しない**。ステージ進行・テーマ・ボス記述子・バランス数値は確かに宣言的データにできる。しかし**スペルカードの弾幕本体（`emitter`）はデータにならない** — 既存8 phase を実コードで確認すると、ほぼ全てが `let a=0`/`wave+=0.05` の閉包状態、複数 `Director.fork` 子コロ、`(140+T*30)%360` のグローバル sim クロック参照を持つ**密な generator 関数**だ。よってスペル層は**「generator を id で引く薄いレジストリ＋パラメータ化可能なものだけ動詞コンパイラに乗せる」**ものとして正直に位置づける。「ステージ追加＝ただのデータ」という言い方は撤回し、「**ステージ進行とウェーブ編成はデータ、弾幕本体はレジストリ登録された generator**」と言い換える。

採用方針と各候補からの移植:

- **ベース = Candidate 1（Preserved single-file, 総合33）。** 「開いて即遊べる」本プロジェクト最大の美徳と itch.io 最良ケース（単一HTML）を守れること、移行リスク最小・制約適合が決め手。Candidate 3（esbuild フルモジュール, 32）は per-file 所有が魅力だが「dev は native ESM・ship は minify バンドル」という **dev/ship 乖離**を生み `file://` 直開きを失う。本プロジェクトの DNA（no build to play）を守るため不採用。その“per-file 所有”は **`src/` ミラー（任意・data リテラルのみ inline）** で取り込む（ただし §10/#10 の two-source 危険を後述の **byte-identical CI assert** で構造的に潰す）。
- **スペルカード層 = Candidate 2 の `makeSpell`/`Conductor`/`every` DSL** を移植するが、**「data-driven」ではなく「registry over generators」**と再定義（批評#1）。`raw:function*` は装飾でなく**主流**になる前提で設計する。
- **数値調整 = Candidate 4 のマスター `balance.js` + 監査ハーネス**（theme/sfx/balance-demo）を移植。
- **BGM パイプライン修復**は必須。死んだアンカー（`const STAGE_TRACK={` は現 `index.html` に**0件**、`integrate-game.js` のみに存在 — 検証済み）を捨て、**生成データ領域全体を自前アンカーで囲う新スプライサ**へ置換。ただし「N トラック＝transport ゼロ変更」は**誤り**で、`TRACKS`（L847）自体が生成領域内にあるため track 追加は再 inline を伴う（批評#4、§5.3で正す）。
- 全レビュアー指摘の **`playMusic` 4名ホワイトリスト**（L855、検証済み）を修正項目に固定。ただし提案された一行パッチ `!(ctx?false:true)` は**ナンセンス**だったので破棄し、正しい形に置換（批評#4、§5.3）。
- 性能の山は **uniform-grid 衝突 broad-phase では救えない**（`collidePlayerBullets` は全弾 vs 自機1点の O(n)、grid は無効）。本当の山は**毎 step の弾プール integrate + compact + draw のスループット**であり、そこへ照準を付け替える（批評#5、§8/§11）。

---

## 2. ファイル / モジュール構成

### 2.1 出荷物（不変の真実）

```
index.html        ← 唯一の出荷物。全 JS インライン・外部参照ゼロ・ダブルクリックで動く。
                    itch.io にはこの 1 ファイルだけをアップロードする。
```

`index.html` の `<script>` 内は de-facto ロード順をバナーコメントで固定（新規★）:

```
// ==== CONSTANTS ====            STEP, pool caps, 経済定数（単一チューニング源 = RECONCILIATION 表）
// ==== ENGINE CORE ====          math / rng / makePool(+shrink★) / spawn* / integrate* / collide* / simStep / frame
// ==== AUDIO ====                ctx/limiter/tone/noise/sfx + 【生成BGMブロック(TRACKS含む)】 + SFX_PARAMS★
// ==== RENDER ====               Render / sprites(petalSprite を再ベイク可能化★) / RenderFrame
// ==== THEMES ★ ====             THEMES[] データ + setTheme() + BOSS_DESIGNS レジストリ★
// ==== PATTERNS ====             pat.* + bare adapters（現状のまま不変）
// ==== SPELL REGISTRY ★ ====     makeSpell / Conductor / every / 動詞コンパイラ / SPELLS(motif & raw)
// ==== CONTENT DATA ★ ====       BALANCE / WAVES / SPELLS参照 / BOSSES / STAGES[] / CAMPAIGN
//                                  ↑ /*BUILD:CONTENT*/ … /*END:CONTENT*/ で囲む（build-game.js が所有）
// ==== INTERP ★ ====             runStage(stage) / resolveBoss() / resolveWave() / defineStage()
// ==== SYSTEMS / FSM ====        player / scoring / items / bombs / power / input(replay hook★) / setState / run★
// ==== UI ★ ====                 menu cursor コンポーネント / overlays / results
// ==== STAGE RUNTIME ====        Director（不変）/ campaign sequencer
// ==== BOOT ====                 boot() IIFE
```

### 2.2 オーサリング（任意・ship 依存にはしない）

`import`/`require`/`fetch` は一切持ち込まない。`src/` は連結可能な素の JS（IIFE/スクリプトスコープ）。

```
src/
  content/balance.js              全 contested 数値の一枚表
  content/themes.js               6テーマのパレット＋scenery 記述子
  content/spells.js               再利用 motif（昇格されたものだけ）＋ raw 本体
  content/bosses.js               ~12 ボス記述子（design / phases / hue / score / drops）
  content/stage1.js .. stage6.js  各ステージ = 1 データオブジェクト
design/
  bgm-tracks.js                   音楽の真実（既存）。stage2..6 / boss2..6 を追記し TRACKS を拡張
  bgm-engine.js                   合成エンジン（既存・ほぼ不変）
  build-bgm.js                    bgm-demo.html 生成（既存・動作中・無傷）
  build-game.js  ★NEW            content + 生成BGMリージョンを index.html へ inline（自前アンカー）
  build-theme-demo.js ★NEW       theme-demo.html 生成
  build-sfx-demo.js   ★NEW       sfx-demo.html 生成
  build-balance-demo.js ★NEW     balance-demo.html 生成
  test-content.js     ★NEW       スモーク＋byte-identical検証＋save migration unit-test（後述）
  test-bgm-unlock.js              既存（transport 回帰）
```

### 2.3 ビルド & 出荷ストーリー（itch.io）

- **直開きは維持。** コミット済み `index.html` は常に自己完結。`src/` は `bgm-tracks.js` が音楽に対してそうであるのと同じ「便宜ミラー」。
- **two-source 危険の構造的封じ込め（批評#10）。** 「`src/` を編集して build、**または** `index.html` を直接編集、両方混ぜない」という*規律だけ*では solo dev が playtest 中に index を直接 hotfix して back-port を忘れる失敗（＝まさに `integrate-game.js` が腐った経路）を防げない。よって**規律に加えて機械的ゲートを置く**:
  - `test-content.js` が「`src/content/*` から `build-game.js --dry` で生成した CONTENT DATA 領域」と「現 `index.html` の `/*BUILD:CONTENT*/…/*END:CONTENT*/` 中身」を**byte-identical 比較**し、不一致なら**非ゼロ終了**する。これにより「index を直接いじって src に戻し忘れた」状態は即座に検出される。
  - 運用は「**src/ を真実として編集 → build → test-content がアンカー領域の一致を assert**」を正とする。緊急で index を直接いじった場合、`test-content` が赤くなるので、それを **src へ吸い上げて再 build** するまでは出荷不可（CI ゲート）。
- **`build-game.js` は data リテラルのみ inline。** コード（インタプリタ・エンジン）は `index.html` 常駐。`BALANCE`/`THEMES`/`SPELLS`/`BOSSES`/`STAGES` を自前アンカー `/*BUILD:CONTENT*/ … /*END:CONTENT*/` 間へ流し込む。実行前に `design/index.html.bak`。
- **デプロイ手順:**
  1. `node design/bgm-tracks.js`（in-key/lane 検証）
  2. `node design/build-bgm.js` → `bgm-demo.html` で A/B
  3. `node design/build-game.js`（content + 生成BGMリージョン inline、`.bak`）
  4. `node design/test-content.js && node design/test-bgm-unlock.js`（スモーク＋byte-identical＋migration）
  5. `index.html` を**直接ダブルクリック**でゼロビルド再生確認（Playwright で `Z` 押下→canvas 描画＋AudioContext arm を自動確認）
  6. itch.io: 1ファイルを「This file will be played in the browser」／Embed = Click-to-launch-fullscreen（モバイル強制）／Fullscreen 有効／Mobile Friendly オン
  7. **SharedArrayBuffer / cross-origin isolation は OFF のまま**（ON にすると `html.itch.zone` へ移り localStorage セーブが壊れる）

---

## 3. ステージ・オーサリング

ステージは **1 データオブジェクト**。`runStage(stage)` が既存 Director コルーチンへコンパイルする（`_steered`・epoch group・`runBoss`/`runPhase` 再利用）。`CAMPAIGN = STAGES`、進行は `run.stage` インデックス。

```js
// src/content/stage3.js  (CONTENT DATA セクションへ inline)
STAGES[2] = {
  id: 3, title: 'Stage 3 — Lanternfall Dusk',
  theme: 'dusk',
  // ▼ 批評#11: music マップは「論理名→実 TRACKS キー」の間接参照。
  //   インタプリタは e.music を「stage.music[e.music] ?? e.music」で解決する（下記参照）。
  music: { stage:'stage3', midboss:'midboss', boss:'boss3' },
  rank: { hpMul:1.0, bulletMul:1.0, speedMul:1.0 },
  timeline: [
    { banner:'Stage 3 — Lanternfall Dusk' }, { wait:2.5 },
    { wave:'sideSweep', n:6, side:'left',  y:90,  hue:30, drops:'p1' },
    { wait:2.0 },
    { wave:'sideSweep', n:6, side:'right', y:150, hue:30, drops:'p1' },
    { waitClear:true }, { wait:1.2 },
    { wave:'vFormation', half:4, apexY:80, hue:18, drops:'pp' },
    { parallel:[ {wave:'stream', n:8, x:0.33},
                 {wave:'stream', n:8, x:0.66, delay:0.25} ] },   // ▼ 批評#3: delay は実装する
    { waitClear:true }, { wait:1.2 },
    { music:'midboss' }, { banner:'WARNING' },
    { boss:'midDusk' },
    { music:'stage' }, { wait:4.0 },                              // 'stage' = stage.music.stage = 'stage3'
    { music:'boss', warn:true },
    { boss:'lanternQueen' },
    { stageClear:true }
  ]
};
```

インタプリタ（批評#3/#11 を反映 — `delay` を honor し、`music` を per-stage マップで解決）:

```js
function* runStage(stage){
  setTheme(stage.theme);
  for(const e of stage.timeline){
    if(e.wave) yield* spawnWave(WAVES[e.wave](resolveWave(e, stage, run.diff)));
    else if(e.parallel){
      // ▼ 批評#3: parallel は「全完了までブロック」(既存 parallel() L1547 と同挙動)。
      //   delay は実コード(L1612)が inline waitT で実現していたものを、ここで明示ラップする。
      const gens = e.parallel.map(w=>{
        const base = ()=>WAVES[w.wave](resolveWave(w, stage, run.diff));
        return w.delay ? (function*(){ yield* waitT(w.delay); yield* base(); })() : base();
      });
      yield* parallel(...gens);
    }
    else if(e.boss)        yield* runBoss(resolveBoss(e.boss, stage.rank, run.diff));
    else if(e.wait!=null)  yield* waitT(e.wait);
    else if(e.waitClear)   yield* waitClear({minHp:(e.minHp||0)});   // ▼ 批評#3 注記: 弾は待たない(下記)
    else if(e.music)       Audio.playMusic(stage.music[e.music] ?? e.music);   // ▼ §5.3で whitelist 修正済
    else if(e.banner)      banner(e.banner);
    else if(e.warn)        { sfx.warn&&sfx.warn(); screenFlash('#ff3366',0.4); }
    else if(e.stageClear)  { yield* stageClearSeq(); advanceStage(); return; }
  }
}
```

**批評#3 の正直な明示:** `waitClear()`（L1546）は `!e.boss && e.hp>minHp` の**敵数**だけを数え、**弾が消えるのは待たない**。また `despawnEnemy`（L1560）は画面外で `e.dead=true` にするだけなので `waitClear` とは整合する（dead は数えない）。`parallel`＋`delay`＋`waitClear` の三者は上記実装で実際に動くことを Phase 2/4 で確認してから次へ。`parallel` は全 generator が `done` になるまでブロックする（既存仕様）ので、`{delay:0.25}` の stagger は generator ラップでしか出せない — それを宣言キーで落とさず実装した。

ステージ4を足す = `STAGES[3]={...}` を append。新しい制御フローはゼロ。`?stage=4&phase=2&diff=hard` で直行（ただし phase 直行は §11/#11 の seek 実装が要る — 単なる URL パースでは無い）。

---

## 4. パターン / スペルカード システム

既存 `pat.*` と bare adapters（`ring/spiral/fan/wall/burst/rain/aimedShot`）は**不変**。その上に「**generator レジストリ**」を載せる（RECONCILIATION が一度落とした `makeSpell`/`Conductor`/`every` の復活）。**「データ駆動」ではない**点を §1 で訂正済み。

### 4.1 スペル本体 = id 参照される generator（一部だけ動詞コンパイル）

スペルカード = `{ id, name, kind:'spell'|'nonspell', hp, survival?, bonus, drops, cutinHue?, body, params? }`。`body` は **`SPELLS` レジストリのキー** または `'raw'`。`compileSpell(spec, P)` は `runPhase` が呼ぶ `function*(boss){…}`（既存 `ph.emitter` 契約）を返す。

**批評#1 — 既存 phase を実際にこの形へ書くとどうなるか（具体例3つ）。**「DSL に乗る／乗らない」を読者が判断できるよう、現 `index.html` の実 phase を変換して示す:

(a) **乗る例（パラメータ化可能）** — midboss Petal Whirlpool の構造（spiral×2 + 周期 wall）は motif 化できる:
```js
// src/content/spells.js
SPELLS.twinSpiralWall = (b,P)=>function*(){
  Director.fork(function*(){ while(true){ wall(b,{n:P.wallN,speed:P.wallSpd,hue:P.hueB,style:'dart'}); yield* waitT(P.wallGap); } }, b);
  let a=0;
  while(true){
    spiral(b,{angle:a,      arms:P.arms, speed:P.spd, hue:(P.hueA+T*30)%360,    style:'small'});
    spiral(b,{angle:-a*1.3, arms:P.arms, speed:P.spd, hue:(P.hueA+30+T*30)%360, style:'small'});
    a+=P.da; yield* waitT(P.gap);
  }
};
// 元の L1638 emitter と弾種・arms・hue ランプは同形。a/wave の閉包は motif 内に閉じ込められる。
```

(b) **乗らない例（raw 必須）** — 最終ボス "Last Word"（L1639）。`speed:140+wave*4; wave+=0.05` の stateful ランプ + 2本の独立 `Director.fork`（rain と burst）+ `(T*70)%360` 全ハッシュ:
```js
{ kind:'spell', name:'"Lanternfall — Last Word"', survival:'$s3.boss.lw.t', bonus:5000000,
  body:'raw', raw:function*(b){ let a=0,wave=0;
    Director.fork(function*(){ while(true){ rain(b,{across:PF_W,count:10,speed:60,gravity:42.5,hue:(330+T*30)%360,style:'petal'}); yield* waitT(0.3); } },b);
    Director.fork(function*(){ while(true){ burst(b,{count:40,speed:130,hue:(T*60)%360,style:'orb'}); yield* waitT(2.2); } },b);
    while(true){ spiral(b,{angle:a,arms:6,speed:140+wave*4,hue:(T*70)%360,style:'small'});
                 spiral(b,{angle:-a*1.4,arms:6,speed:140+wave*4,hue:(120+T*70)%360,style:'small'});
                 a+=0.21; wave+=0.05; yield* waitT(0.035); } } }
```
これは **DSL に乗せても元と一字一句同じ generator** になるだけで、抽象化の利得はゼロ。よって raw のまま置く。

(c) **乗らない例（onEnter 移動コロ込み）** — midboss nonspell（L1637）は `onEnter` で `moveTo` 往復をforkする。これは `onEnter` フィールドとして温存（既存 `runPhase` が `ph.onEnter(boss)` を呼ぶ L1601 を流用）。

**結論（批評#1 反映）:** 既存8 phase のうち motif 化で利得が出るのは2〜3個（twin-spiral 系）。残り（Last Word、多重 fork、複雑な onEnter 連動）は **raw が主流**。よって「**スペル層は generator レジストリであり、パラメータ化可能なものだけ `$ref`＋motif に昇格する**」と位置づけ、「データ駆動の勝利」は**主張しない**。利得は (i) 数値の `balance.js` 集約、(ii) ボスが phase を id 列で宣言できること、(iii) 同一 motif の重複排除 — であって「コードがデータになる」ことではない。

### 4.2 ボス記述子と解決

```js
// src/content/bosses.js
BOSSES.lanternQueen = {
  name:'Lantern Queen', design:'lantern', hue:30, score:500000,
  enterFrom:{x:PF_W/2,y:-80}, enterTo:{x:PF_W/2,y:140},
  drops:['full','oneup','point','point','bigpower'],
  phases:[
    { kind:'nonspell', hp:'$s3.boss.p0.hp',  body:'ringWall',     params:'$s3.boss.p0' },
    { kind:'spell', name:'Verdant Sign "Petal Whirlpool"', hp:'$s3.boss.p1.hp',
      bonus:1500000, cutinHue:320, body:'twinSpiralWall', params:'$s3.boss.p1' },
    // …
    { kind:'spell', name:'"Lanternfall — Last Word"', survival:'$s3.boss.lw.t',
      bonus:5000000, body:'raw', raw:function*(b){ /* §4.1(b) */ } }
  ]
};
```

`resolveBoss(id, rank, diff)` が `$ref` を `BALANCE` から解決し `hp/spd/count` に `rank.* × DIFFICULTY[diff].*` を乗じ、既存 `runBoss` が消費する `{name,design,phases:[{kind,hp,emitter,survival,bonus,drops,onEnter?}]}` を返す（`emitter=compileSpell(spec,resolvedParams)`、raw は素通し）。

### 4.3 表現力の天井（全レビュアー指摘・批評#1）

- `body:'raw'` を**主流として公認**（装飾扱いしない）。
- **昇格則**: あるモチーフが**3カード以上**で繰り返されたら `SPELLS.*` へ切り出す。それ未満は raw。copy-paste 爆発と DSL 肥大の両方を抑える唯一の運用則。
- コンパイラは「同形 spawnBullet を吐く」だけなので **hot loop・pool・衝突は不変**。determinism については §8 を参照（hue/motion が `T` を読むため frame-exact golden は**採らない**）。

### 4.4 既存 emitter 契約の維持（批評#2 — 「wrap ではなく refactor」）

`runPhase`（L1597）は `Director.fork(()=>ph.emitter(boss),boss)` を `beginGroup`/`endGroup`（L1596/L1605）の epoch 内で回し、survival 時は `boss.timer`/`survivalActive` を駆動する。`compileSpell` の返す関数は**この契約を厳密に満たす**こと: (i) 引数は `boss` のみ、(ii) 内部 fork は呼び出し元 epoch に属する（`Director.fork` が現行 group を継ぐ既存挙動を利用）、(iii) survival/タイマー制御は `runPhase` 側のまま触らない。よって Phase 5 は**「1 phase 移して同弾確認→残り」では済まない初回 refactor**であることを Phase 5 に明記（§9 参照）。

---

## 5. プロシージャル・アセット パイプライン

全アセットはコード合成（外部ファイル0）。各種に「生成モジュール + オーディションハーネス + レジストリ」を与える。

### 5.1 グラフィック（6テーマ + ボス）

現状 `drawBackground`（L946）/`buildScenery`（L971）は単一桜パレット（`PALETTE`/`SCN`）ハードコード。テーマデータ駆動へ refactor:

```js
THEMES.dusk = {
  sky:['#3a2350','#7a4a6a','#c08a5a'], petal:['#ffcaa0','#ff9e6e','#e07a4a'], petalEdge:'#ffe',
  ground:{ base:'#7a5a30', tones:['#caa055','#9a4a28','#5a3a55'], seam:'rgba(201,183,154,0.42)', accent:'lantern' },
  fog:0.4, hueDriftAmp:10
};
```

**批評#6 — `petalSprite` const IIFE と scenery srng の正直な扱い。** 検証した実装上の障害を**設計に織り込む**:

1. `_petalSprite`（L948）は**モジュール評価時の `const` IIFE**で、`PALETTE.petal` から canvas をベイクする。`const` ゆえ再代入不可。`setTheme` で再ベイクするには、これを **`let _petalSprite=[]` ＋ `function bakePetals(theme){…}`** に書き換える必要がある（Phase 2 の明示作業項目）。`drawPetals`（L950）は配列を参照するだけなので、配列を作り直して中身を差し替えれば参照は保てる。
2. `buildScenery`（L971）は**独立した `srng=makeRng(0x5A6B7C8D)`** と**リテラル geometry**（`bw=46+srng()*96` 等）でタイルをベイクする。テーマ化では**色とアクセント形状だけ**をテーマから取り、**srng の seed と消費順は厳守**する（gameplay `rng` を汚さない既存契約 — コメントで明記済み）。よって「theme = pure data」は**一部 aspirational** と正直に認める: canopy/scatter の形状は小さな描画関数（`accent:'lantern'|'torii'|'crystal'|'snowdrift'`）が要り、80行 scenery の6 fork ではないが、**完全な純データでもない**。
3. **Phase 2 のゲートは「pixel-identical」ではなく「visual-similarity（目視 A/B ＋ srng 消費順不変の assert）」に緩める**（批評#6）。ベイクのタイミングがモジュール評価→関数呼び出しに変わり、srng 消費順は保てても**評価順の差で1ピクセル単位の散らしが変わりうる**ため、pixel-identity を gate にすると「どうでもいい理由で常に赤」になり always-shippable を破る。代わりに「`spring` 抽出前後で `theme-demo` を目視一致確認」＋「`buildScenery` の srng 呼び出し回数が抽出前後で不変であることを `test-content.js` で assert」する。

`setTheme(key)` が `bakePetals` と `buildScenery` を再実行。`drawScenery` の perspective-strip LUT は generic のまま色/アクセントだけテーマから。HUD の `PALETTE` は global 据え置き（ステージ跨ぎで identity 安定）。`theme-demo.html` で6テーマ横並び A/B（global note #17 を視覚へ適用）。

**ボス（批評#7 — 第3の真実源 `spec.r` を畳む）。** 検証: `BOSS_HIT_R={wisp:32,mandala:60}`（L1090）、`drawBoss` は文字列分岐＋per-design scale `0.55/0.60`（L1091）、`makeBoss` は `r:spec.r!=null?spec.r:(BOSS_HIT_R[spec.design]||18)`（L1580）で**`spec.r` という3つ目の上書き**を持つ。よって `BOSS_DESIGNS` は描画・hitR・scale を1レコードに同居させ、**`drawBoss` の if/else 連鎖を `BOSS_DESIGNS[d].draw` ルックアップに書き換え、`makeBoss` の `spec.r` エスケープを削除（または record に畳む）**:

```js
BOSS_DESIGNS.lantern = { draw: drawBossLantern, scale:0.6, hitR:34 };
// drawBoss: const D=BOSS_DESIGNS[boss.design]; ctx.scale(D.scale,D.scale); D.draw(ctx,t);
// makeBoss: r: (BOSS_DESIGNS[spec.design]?.hitR ?? 18)   ← spec.r 経路は撤去
```
Phase 3 で `wisp`/`mandala` を移植し、`spec.r` 上書きが消えること・hitR/scale の desync が撲滅されることを確認する（「両者1レコード」では `spec.r` を見落とすので明記）。

**カットイン（批評#11 — `cutinHue` は新規描画作業）。** 検証: `triggerCutin`/`cutin`（L1099/L1521）は `{announce|hold}` のみ受け取り、コメントに `dim-only 暗転 (no portrait art)` と明記。**現状ティント機構は存在しない**。よって `cutinHue` は「既存能力のデータフィールド」ではなく **net-new render 作業**として明示する: dim 据え置きのまま、`triggerCutin(o)` に `o.hue` を追加し、暗転オーバーレイに `hsla(hue,…,0.1)` の薄い色を乗せる小改修（Phase 5 で実装、画像ファイルは0のまま）。portrait 画像パイプライン（commit 3ea9b9b で撤去、`design/portraits/` は休眠 provenance）は**復活させない**。

### 5.2 音色（SFX）

SFX は `tone()/noise()`+ADSR を `sfx` facade 越しに維持。調律のため per-cue 数値を **`SFX_PARAMS` テーブル**（freq/decay/wave/detune）へ持ち上げ、cue 関数はそれを読む。brick-wall limiter は据え置き。`sfx-demo.html` で横並び試聴。MEMORY の教訓（per-着弾 多ノード SFX は Web Audio 過負荷／sub-150Hz は iPad で不可聴）を尊重し、新 SFX は**fire cadence の per-hit 多ノードを避ける**。

### 5.3 音楽（6+ トラック）& パイプライン修復

`design/bgm-tracks.js` に `stage2..stage6`/`boss2..boss6` を追記。エンジン/scheduler/crossfade は**ゼロ変更**（`trackOf(name)` は generic）。

**批評#4 — 「N トラック＝transport ゼロ変更」は false。正す。** 検証: `TRACKS={stage,midboss,boss}`（L847）は**生成BGMブロック内**にあり、`bgm-tracks.js` の `const TRACKS={stage:STAGE,midboss:MIDBOSS,boss:BOSS}`（L278）から来る。よって**track 追加は `TRACKS` 自体の拡張**＝生成領域の再 inline を伴う。つまり「BGM データ成長は（修復後の）スプライサに依然 coupling する」。これは隠さず受け入れる: **`bgm-tracks.js` で `TRACKS` に新キーを足す → `build-game.js` で生成領域ごと再 inline する**のが正規経路。audition（`build-bgm.js`）は無傷でそこで音を詰める。

**必須修復2点:**

1. **`playMusic` whitelist 撤廃（正しいパッチ）。** 現 L855 は `if(name!=='stage'&&name!=='midboss'&&name!=='boss'&&name!=='none') return;`（検証済み）。提案された `!(ctx?false:true)` は恒偽でナンセンス（批評#4）なので破棄。正しい置換は:
   ```js
   if(name!=='none' && !trackOf(name)) return;   // 'none' または TRACKS に存在するキーのみ許可
   ```
   `trackOf`（L849）は `TRACKS[n]` を引くので、`TRACKS` を拡張した後はこのガードが自動で全 track を通す。
2. **`integrate-game.js` の死んだアンカーを捨て、生成領域全体を正確に囲う。** 検証: `const STAGE_TRACK={` は `index.html` に**0件**（`integrate-game.js` L35 の splice 呼び出しにのみ存在）。生成領域は **`// ---- BGM ENGINE (generated …) ----`（L308）から始まり、`return {…}` の facade（L870）までの一塊**。**批評#4 の指摘どおり、提案していた終端アンカー `function startPump(`（L852）は誤り** — `pump`/`TRACKS`/`playMusic`/`unlock`/facade（L847〜870）が `startPump` の**後**にあり、track 名が増えるとまさにそこが変わるのに、その終端だと外に出てしまう。よって新スプライサは **L308 のマーカーから facade の `return {…}` 行までを丸ごと**囲う（`/*BGM:GEN*/ … /*END:BGM:GEN*/` を `build-game.js` 自身が所有・生成）。
   - さらに（批評#4）`build-bgm.js` は別機構（`/* __BGM_TRACKS__ */` プレースホルダの `indexOf`/`replace`、L13–19）で組み立てており、新スプライサの `spliceBetween` とは**共有・テスト済みコードパスが無い**。よって `build-game.js` のスプライス関数は**独立に単体テスト**（`test-content.js` 内で「囲んだ領域を再注入しても byte-identical」を assert）する。

### 5.4 タイトル

タイトルは手続き描画 + 既存 banner。文言・配色は `THEMES` と独立した `TITLE` データ（ロゴ色・サブタイトル）として1箇所に持つ。

---

## 6. 数値調整ワークフロー

3つの中央化:

1. **エンジン/経済定数は top-of-file CONSTANTS が単一源**（現状維持）。
2. **マスター `balance.js` 一枚表**。全 contested 数値（boss/midboss HP・phase bonus・wave count/speed/spacing・drop table・スペル param bag）を per-stage / per-difficulty で構造化。timeline に数値リテラルを残さない。

```js
BALANCE = {
  difficulties: {
    easy:   { countMul:0.7, spdMul:0.85, hpMul:0.8,  lives:4, bombs:3 },
    normal: { countMul:1.0, spdMul:1.0,  hpMul:1.0,  lives:3, bombs:2 },
    hard:   { countMul:1.2, spdMul:1.08, hpMul:1.15, lives:3, bombs:2 },
    lunatic:{ countMul:1.4, spdMul:1.15, hpMul:1.3,  lives:2, bombs:2 }
  },
  s3: { boss: {
    p0:{ hp:1800, ringN:24, ringSpd:110 },
    p1:{ hp:2400, arms:4, da:0.31, gap:0.045, wallN:9, wallSpd:175, wallGap:2.0, hueA:140, hueB:320 },
    lw:{ t:28 }
  } }
};
```

3. **難易度 = resolve 時の乗算**（call site にスレッドしない）。`resolveBoss`/`resolveWave` が `rank.* × DIFFICULTY[diff].*` を hp/count/speed に集中適用。

**安全イテレーション:** (a) practice/stage-select で任意カードへ秒で飛ぶ（phase 直行は §11/#11 の seek 実装込み）；(b) `?stage=4&phase=2&diff=hard`；(c) dev-only `?god=1`＋HUD に **live bullet-count／frame-time** オーバーレイ（`__DEV__` で itch ビルドから除去）— これは §8 の perf profiling の主計測器；(d) `balance-demo.html` スライダ live チューニング；(e) `test-content.js` が「全 phase `body`/`raw` 解決・全 theme key 存在・全 `$ref` 解決・全 wave 名定義・byte-identical・save migration」を assert し、typo を mid-run クラッシュでなく即 fail に。

---

## 7. ゲーム進行・状態・永続化

現 FSM は `STATE={TITLE,PLAYING,PAUSED,GAMEOVER,STAGECLEAR}`（L33、検証済み）の平坦 enum、`setState`（L1364）が唯一の遷移チョークポイント。

### 7.1 進行スパイン（最大の欠落）— 批評#8 の「mechanical ではない」を反映

検証: `onStageClear()`（L1374）は `setState(STAGECLEAR)` するだけで、`startGame`（L1372）/`startStage`（L1540）は `Director.start(stageScript)` と `Audio.playMusic('stage')` を**ハードコード**し、`stageScript` 末尾（L1643）が自ら `onStageClear()` を呼ぶ。`setState(TITLE)`（L1366）はプール clear を含むテイクダウン。よって以下は**「enum を足すだけ」ではなく実 surgery**であることを明記:

- `run` サブオブジェクト新設: `{ stage, difficulty, continuesUsed, practice, noMiss, noBomb, perStageScore[] }`。
- `startGame()` を **`startRun(diff, fromStage)`（score/lives/bombs/power をリセット）** と **`enterStage(i)`（per-stage spawn リセット、score/lives/bombs/power は **carry**）** に分割。`Director.start(stageScript)` を **`Director.start(()=>runStage(STAGES[run.stage]))`** に置換。
- `stageScript` 末尾の `onStageClear()` 自己呼び出しは `runStage` の `stageClear` entry → `advanceStage()` へ移す。
- `advanceStage()`: `run.stage<5` なら **STAGE_INTERMISSION→enterStage(i+1)**；**stage 6（index 5）でのみ ALLCLEAR**（results）。これにより現状の「STAGECLEAR=終了→TITLE auto-return」を是正。**carry 対象（score/lives/bombs/power）と reset 対象（spawn/pools）を取り違えないこと**が surgery の肝（批評#8）。

**批評#11 — `enterStage` の二義性を解消。** 「campaign-carry」と「practice-fixed loadout」は**同じ関数名に矛盾した要求**なので、引数で分ける:
```js
function enterStage(i, loadout /* null=campaign carry, obj=practice fixed */){ … }
```
practice は固定 loadout を渡し、campaign は `null`（直前 carry）を渡す。

### 7.2 追加する状態

| 新 STATE | 役割 |
| --- | --- |
| `DIFFICULTY_SELECT` | Easy/Normal/Hard/Lunatic 選択 |
| `STAGE_INTERMISSION` | ステージ間（run を carry）。ここで **pool capacity を縮小** ※下記 |
| `CONTINUE` | `finalizeDeath`（lives<0）→ ここへ。Yes→同ステージ復帰・No→GAMEOVER |
| `RESULTS` / `ALLCLEAR` | per-stage 内訳 + total + graze + continues used + clear rank |
| `NAME_ENTRY` | ハイスコア記名 |

**批評#8 — pool 縮小 API は net-new。** 検証: `makePool`（L138）は **grow-only**（`compact` は再配置のみ・`clear` は `count=0` にするが `items.length` は保持・`_grow` で伸びるが縮む経路は無い）。よって `STAGE_INTERMISSION` の「pool capacity リセット」は**新規エンジンメソッド `pool.shrink(toCap)`**（live でない末尾要素を捨てて backing 配列を `toCap` へ truncate）を要する。これは「状態 case 追加」ではなく**エンジン追加作業**として Phase 8/12 に明記。

### 7.3 メニュー & ポーズ

- 再利用 **menu cursor コンポーネント**（index/up-down/confirm/back）を keyboard+pad+touch 全配線。現タイトルは confirm edge 1個しか読まないので新規構築。
- **touch「どこでもタップ＝確定/resume」を撤廃**し、ナビ可能メニューに（pause: Resume/Restart/Return to Title/Options。`abortStage` 既存で mid-run→TITLE は半分済み）。

### 7.4 永続化（批評#5 の migration 安全策込み）

単一 int hi-score（`danmaku_hiscore_v1`, L1471 相当）を versioned JSON へ:

```js
danmaku_save_v2 = {
  ver:2, hiByDiff:{easy,normal,hard,lunatic},
  furthestStage:{ /* per diff */ }, clears:{ /* per diff:{noContinue,noMiss} */ },
  practiceUnlocked:[stageIds], options:{}, lastName
}
```

`migrate(old)`: v1 int を読んで `hiByDiff.normal` に注入、**read-old-before-write-new**、**v1 キーは1リリース残す**。`test-content.js` で migration を unit-test（返り客 hi-score wipe 防止）。Audio mute/vol は自前キー（`bh.muted`/`bh.vol`）据え置き。practice/stage-select は `furthestStage` で gate し `enterStage(i, fixedLoadout)` を呼ぶ。

---

## 8. 決定性 / リプレイ / リーダーボード

**スタンス（批評#9 を反映して縮小）: リプレイは stretch goal。v1 は「ローカル hi-score ＋（任意）ローカル ghost replay 試作」のみ。online leaderboard と「地ならし」フレーミングは v1 から外す。**

CLAUDE.md 明記のとおり「決定性は design goal だが未達」。検証した未達要因とリプレイの障害:

- **`Math.random()` リーク（複数）。** camera shake に加え audio detune も `Math.random`（MEMORY/CLAUDE.md）。§旧版が約束した「one-time 監査」は assert ではなく主張に過ぎず、detune が scheduling jitter を通じて分岐に効きうる。よって **v1 で online を gate するための `record→replay→identical-score` テストは、これらリークを閉じるまで green にできない**ことを正直に認め、online を別フェーズへ完全に退避する。
- **`keyEdge` は consuming（批評#9）。** CLAUDE.md 明記「first reader per step gets `true`」。リプレイ層が記録 held/edge ビットマスクを再供給するには、**consuming read より手前で割り込み、同一の単一消費者順序を保証**しなければ edge が desync する。「systems/input.js に1箇所、medium」では足りない — **入力ソースを差し替え可能にする抽象**（`inputSource = liveSource | replaySource`）を `attachInput` 層に置き、`keyEdge`/held の読み口を**唯一**に保つ設計を要する。
- **frame-exact golden は採らない（批評#2）。** hue/motion が `T` を読み、最初の捕捉弾以降が player 位置に依存し、`Math.random` リークが残るため、弾位置の frame-exact golden は現コードで green にならない。代わりに**構造 golden**を採る: 「scripted input（固定入力列）で N tick 走らせ、**(spawn 弾の style-id ヒストグラム + 各 tick の弾数)** を記録・比較」。これは §9 の Phase 2/5 検証ゲートに使う唯一の自動チェックで、「pixel-identical / identical-curtain」という到達不能なゲートは**全廃**する。

実装コスト: visual rng 分離（小）、入力ソース抽象（中、`attachInput`）、構造 golden harness（中）。online は別フェーズ。

**MAX_STEPS=8 slow-mo トラップ**（>66ms フレームで sim が遅回り＆wall-clock スコア破綻、`MAX_STEPS=8`/`_acc=0` ガード）は §11/#5 の perf 計画（弾プールスループット）で回避する — **衝突 broad-phase ではない**（批評#5）。

---

## 9. 移行ロードマップ（順序付き・常に出荷可能）

各フェーズ後に「完全に遊べる N ステージゲーム」が残る。big-bang なし。

**Phase 0 — ベースライン保護.** 現 `index.html` をコミット。`test-content.js` スタブ（byte-identical 枠だけ）。不変。

**Phase 1 — セクションバナー挿入.** THEMES/SPELL REGISTRY/INTERP/CONTENT DATA を空プレースホルダとしてロード順に挿入（`/*BUILD:CONTENT*/` アンカー含む）。挙動不変・出荷可能。

**Phase 2 — THEMES 導入.** 現桜パレットを `THEMES.spring` に抽出。`_petalSprite` const IIFE を **`let`＋`bakePetals()` に書き換え**、`drawBackground`/`buildPetals`/`buildScenery` を `setTheme('spring')` 経由に refactor。**ゲートは visual-similarity（目視 A/B）＋ `buildScenery` の srng 消費回数不変 assert**（pixel-identical は採らない・批評#6）。出荷可能（1テーマ）。

**Phase 3 — BOSS_DESIGNS レジストリ.** `drawBoss` の文字列分岐を `BOSS_DESIGNS[d].draw` ルックアップに、`makeBoss` の `spec.r` 上書きを撤去（批評#7）。wisp/mandala の hitR/scale desync 撲滅を確認。視覚不変。出荷可能。

**Phase 4 — WAVES レジストリ + interp `delay`/`parallel`.** 既存 `waveSideSweep/vFormation/stream/turrets` を名前→factory で包む。`runStage` の `parallel`＋`delay` 実装（批評#3）を**この時点で**入れ、Stage-1 の inline `waitT(0.25)` stagger と同挙動を確認。出荷可能。

**Phase 5 — SPELL レジストリ + emitter 契約 refactor + Stage-1 カード移植.** （批評#2/#4 反映 — これは wrap でなく refactor）まず `compileSpell` が `runPhase` の emitter 契約（`boss` 引数・epoch fork・survival 非介入）を満たすことを **Spiral Mandala 1枚**で確立 → **構造 golden（弾数＋style-id ヒストグラム、scripted input）**で同一性確認 → 残りを移植。Last Word 等は **raw が主流**（§4.1b）。出荷可能（1ステージ・レジストリ駆動）。

**Phase 6 — `playMusic` whitelist 撤廃 + BGM スプライサ修復.** L855 を `if(name!=='none' && !trackOf(name)) return;` に置換（批評#4 の正しい形）。`integrate-game.js` を捨て、**L308 マーカー〜facade `return{…}` を丸ごと**囲う `build-game.js` 新スプライサを導入（`.bak`＋スプライス単体テスト＋スモーク）。`test-bgm-unlock.js` green。出荷可能。

**Phase 7 — STAGES[] + インタプリタ.** `runStage(stage)` 追加、`STAGES[0]` に現 Stage 1 をデータ表現（`music` マップ間接含む・批評#11）。`Director.start(stageScript)` を `Director.start(()=>runStage(STAGES[run.stage]))` に置換。Stage 1 不変。出荷可能。

**Phase 8 — FSM スパイン + 永続化 + 難易度.** `run` サブオブジェクト、`startRun`/`enterStage(i,loadout)` 分割（批評#8/#11）、versioned save（v1 migration・read-old-before-write-new）、`DIFFICULTY` 表、新 STATE 6種、menu cursor、touch メニュー化、`pool.shrink` API 追加（批評#8）。`STAGES` が1個なら今日と同挙動。出荷可能（メニュー＋セーブ付き1ステージ）。

**Phase 9 — `balance.js` + 3ハーネス.** 数値を一枚表へ吸い上げ、theme/sfx/balance-demo を `build-*.js` で生成。以後の新ステージは difficulty-aware に書ける。出荷可能。

**Phase 10 — Stage 2 をフル authoring.** 新テーマ + 新 BGM 2本（`bgm-tracks.js` で **`TRACKS` 拡張**→audition→`build-game.js` で生成領域ごと再 inline・批評#4）+ spell library から新ボス + `STAGES[1]`。パイプライン全体を実コンテンツで検証。2ステージとして出荷。

**Phase 11 — Stage 3–6 を1ステージずつ.** 各 = データ + 1テーマ + 1–2 BGM、`?stage=N` で個別プレビュー。phase 直行（seek + skip 治癒）は §11/#11 の実装を含む。各ステージ追加後に出荷。practice/stage-select は `furthestStage` 解禁。

**Phase 12 — パフォーマンス & 仕上げ.** （批評#5 反映 — 衝突 grid ではなく**弾プールスループット**）dev の bullet-count/frame-time HUD で worst Lunatic card を profiling し、**(a) cap 強制・画面外 bullet culling、(b) draw batching、(c) compact コスト削減**を density が噛む前に投入、worst frame<66ms で MAX_STEPS slow-mo を回避。`STAGE_INTERMISSION` の `pool.shrink`、（任意）ghost replay の構造 golden 確定、results/ALLCLEAR/name-entry 仕上げ。出荷可能。

---

## 10. 制約遵守チェック

| ハード制約 | 遵守 | 根拠 |
| --- | --- | --- |
| 画面サイズ不変 | ✅ | `PF_W=432,PF_H=576,HUD_W=208 → CANVAS_W=640,CANVAS_H=576`。テーマは同矩形を塗り替えるのみ |
| プラットフォーム = Web | ✅ | 出荷物は静的 HTML 1枚。build は author-time（Node）、ship 物にビルド依存なし |
| 描画 = Canvas 2D（WebGL 不可） | ✅ | THEMES/インタプリタ/レジストリは純データ＋同一 `ctx` 2D。perf 改善は**プールスループット**で描画 API 変更ではない（衝突 grid は不採用・批評#5） |
| 音声 = Web Audio API | ✅ | SFX は `tone()/noise()`+ADSR、BGM は合成 scheduler。新トラックは `bgm-tracks.js` の `TRACKS` 拡張。音声ファイル0 |
| 単一プレイヤー | ✅ | campaign は1 run object。ネットワーク追加なし（ローカルセーブ＋任意ローカル ghost replay のみ） |
| 入力 = 4方向 + shot + bomb + focus | ✅ | 既存 player モデル・keymap 再利用。menu ナビは既存入力上の加算 UI（新 gameplay verb なし）。replay は**入力ソース差し替え**で同 verb |
| 対応入力方式不変（KB+pad+touch） | ✅ | 3方式保持。menu/difficulty/practice/pause を3方式へ配線（touch「どこでもタップ」のナビ化は**必須作業**であり制約変更ではない） |
| リソース = life + bomb + graze | ✅ | graze power-up・経済定数据え置き。difficulty/continue は乗算/状態追加のみ |
| プロシージャル・アセット（外部ファイル不可） | ✅ | テーマ/ボス silhouette/cutin/SFX/BGM は全てコード合成。`cutinHue` は dim オーバーレイへの薄色（画像0・批評#11）。撤去済み portrait 画像経路は復活させない。`build-game.js` は data リテラルのみ inline |

**境界事項（正直に明示）:** (a) `build-game.js` は dev 便宜であり play-time 依存にしない（コミット済み `index.html` は常に単体起動）。two-source 危険は **byte-identical CI assert** で機械的に封じる（批評#10）；(b) touch メニューナビ・3方式メニュー配線は net-new UI で、既存全方式をカバーしないと制約を暗黙後退させるため**必須作業**として固定；(c) `cutinHue` ティント・`pool.shrink`・入力ソース抽象は**既存能力ではなく新規実装**であることを各節で明記済み。

---

## 11. リスクと未解決の論点

1. **スペル層は「データ」にならない（批評#1・最重要）。** 既存8 phase の多数は raw generator のままで、DSL に乗せても同形の冗長ラッパになるだけ。**緩和: 「registry over generators」と再定義し、motif 昇格は3回則、利得は数値集約と id 宣言に限定。`raw` 比率が高くても問題視しない。**「ステージ追加＝ただのデータ」という主張は撤回済み。

2. **検証ゲートが現エンジンで通らない（批評#2/#6/#9）。** pixel-identical / identical-curtain / frame-exact golden は、`T` 依存・player 依存・`Math.random` リークにより green にできない。**緩和: (i) theme は visual-similarity＋srng 消費回数 assert、(ii) spell は構造 golden（弾数＋style-id ヒストグラム、scripted input）、(iii) frame-exact 系ゲートは全廃。**

3. **perf 修正の照準（批評#5）。** `collidePlayerBullets`（L218）は全弾 vs 自機1点の O(n) で **grid 無効**、`collideShotsEnemies`（L224）は enemies×shots で小。真の山は**毎 step の弾プール integrate + 全プール compact（L256）+ draw**で、これは on-screen 弾数に比例し pair 数ではない。**緩和: Phase 12 で cap 強制・画面外 culling・draw batching・compact コスト削減を density 前に投入、bullet-count/frame-time HUD で per-card profiling。uniform-grid broad-phase は本エンジンの衝突形状にほぼ no-op なので不採用。**

4. **MAX_STEPS=8 slow-mo トラップ.** dense Lunatic で >66ms フレームが sim をサイレント遅回りさせ wall-clock スコアを壊す。原因は衝突ペアでなく**生 bullet 数**（#3）。**緩和: #3 のスループット対策＋profiling。後回しの楽観にしない「予約前倒し作業」。**

5. **BGM track 成長はスプライサに coupling（批評#4）。** `TRACKS`（L847）が生成領域内にあるため track 追加は再 inline 必須。「N トラック＝transport ゼロ変更」は false。**緩和: `bgm-tracks.js` で `TRACKS` 拡張→`build-game.js` で生成領域（L308〜facade `return{…}`）を丸ごと再 inline。`playMusic` ガードは `if(name!=='none' && !trackOf(name)) return;`（提案の `!(ctx?false:true)` は破棄）。スプライス関数は単体テスト。**

6. **build-game.js のアンカー腐敗 / two-source-of-truth（批評#10）。** 規律だけでは solo dev の直接 hotfix back-port 漏れを防げない（`integrate-game.js` 腐敗と同型）。**緩和: ビルダがアンカー自前生成・所有、`.bak`、そして `test-content.js` が「src→build した CONTENT 領域」と「index の `/*BUILD:CONTENT*/` 中身」を byte-identical 比較し不一致で CI fail。`src/` を真実源、index 直接編集は test 赤化で検出。**

7. **theme 化が桜 Stage-1 を regress させる懸念（批評#6）。** `_petalSprite` は再代入不可 const、`buildScenery` は srng＋リテラル geometry。**緩和: const→`let`＋`bakePetals` 化、srng seed/消費順厳守、ゲートは visual-similarity。「theme=pure data」は一部 aspirational と認める（accent 形状は小描画関数が要る）。**

8. **FSM スパインは「mechanical」ではない（批評#8）。** STAGECLEAR を terminal→stage-advance に変えるのは death/respawn・saveHiScore timing・TITLE テイクダウンに触る surgery。`pool.shrink` は grow-only `makePool` への net-new メソッド。`enterStage` の carry vs fixed-loadout 二義性は引数で分離。**緩和: carry/reset の対象を明記、新規エンジンメソッドと2エントリ点を Phase 8 に固定。**

9. **save migration バグで返り客 hi-score 消失（批評#5系）。** **緩和: read-old-before-write-new、v1 キー1リリース保持、`test-content.js` で migration unit-test。**

10. **決定性 over-promise / replay 障害（批評#9）。** `keyEdge` は consuming・`Math.random` リーク複数。**緩和: replay は stretch、入力ソース抽象（live/replay 差し替え）で単一消費者順序を保証、online は `record→replay→identical-score` green を gate に別フェーズ。「地ならし」フレーミングは v1 から削除。**

11. **`cutinHue` は新規描画作業（批評#11）。** `triggerCutin`（L1099）は dim-only でティント機構なし。**緩和: `o.hue` を加えて暗転オーバーレイに薄色を乗せる小改修（Phase 5、画像0維持）。**

12. **phase 直行（`?stage=N&phase=M`）は free param ではない（批評#11）。** `runBoss`（L1581）は phase 0 からしか入らない。中間 phase 開始は `boss.hp`/`survivalActive`/前 phase drop skip/`beginGroup` epoch の seek+heal が要る。**緩和: Phase 11 で seek 機能として実装、URL は trigger のみ。**

13. **単一ファイル肥大**（12 BGM + 6テーマ + ~12ボス + spell library で 4–6k 行）。**緩和: BGM データは terse 生成物、`src/` ミラーで per-file 編集、parse-time 計測（itch CDN は auto-gzip）。buckling でなく friction。**

14. **未解決: touch での 6 ステージ高密度 danmaku の UX.** Mobile Friendly 公開前に late-stage density が touch で成立するか要検証。判断は Phase 10–11 の実機確認待ち。

---

主要参照ファイル（全て絶対パス）: `/home/puniu/bullet/index.html`（出荷物・編集対象。本版の行番号は全て本ファイルに照合済み）、`/home/puniu/bullet/design/bgm-tracks.js`（音楽の真実・`TRACKS` 定義 L278）、`/home/puniu/bullet/design/integrate-game.js`（**廃止し `build-game.js` に置換**・死んだ `STAGE_TRACK` アンカー L35）、`/home/puniu/bullet/design/build-bgm.js`（audition 経路・`/* __BGM_TRACKS__ */` 置換機構 L13–19・無傷）、`/home/puniu/bullet/design/RECONCILIATION.md`（定数表・所有モデル）。新規追加: `/home/puniu/bullet/design/build-game.js`・`/home/puniu/bullet/design/build-theme-demo.js`・`/home/puniu/bullet/design/build-sfx-demo.js`・`/home/puniu/bullet/design/build-balance-demo.js`・`/home/puniu/bullet/design/test-content.js`・`/home/puniu/bullet/src/content/*`。
