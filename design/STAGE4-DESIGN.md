# Stage 4 設計：「曙の嶺 / First Light Summit」

> **次セッションへの引き継ぎ文書。** これ一枚で実装に入れるようにまとめてある。
> 設計確定: 2026-06-05 / **実装未着手**。
> 併読: `CLAUDE.md`（§index.html architecture, §golden, §BGM pipeline）、
> `design/ARCHITECTURE-V2.md`（forward roadmap）、メモリ [[v2-architecture-plan]] [[stage-difficulty-power-gap]] [[bgm-build-pipeline]]。

---

## 0. サマリ / ステータス

- **Stage 4 = 山の夜明け。** 中盤の山。新ギミック＝**予告レーザー＋巨大弾**を初投入する面。
- **ギミック配分（合意済・3面分）**:
  | Stage | 新ギミック |
  | --- | --- |
  | **4 曙の嶺** | **予告ありレーザー ＋ 巨大弾**（＋螺旋は既存を装飾流用） |
  | 5（未設計） | 螺旋全方位 ＋ 周囲の敵弾を吸う重力場弾 |
  | 6（未設計） | 置き弾幕 ＋ 弾を生む弾 |
  - 1面に6個は詰めない方針。Stage 4 は「最重量の新規システム(レーザー)1本＋中コスト(巨大弾)1本＋ほぼ無料の螺旋」。
- **登場人物**:
  - **ボス＝八咫烏（Yatagarasu）** 三本足の太陽烏。7フェーズ。
  - **中ボス＝山姥（Yamauba）** 髪・糸の妖。**撃破（retreat ではない）**、2フェーズ。
- **BGM＝専用3トラック（Stage 1 に倣う）**: `stage4` / `midboss4` / `boss4`。中ボスにも**専用曲**（道中曲の流用をしない＝Stage 1 と同じ構成。Stage 2/3 は道中曲を流用していた点が違う）。
- **着手順**: レーザー系統（最重量・再利用最大）から。各ステップ `?golden=1` で **Stage 1 + boot が byte-identical** を回帰確認（golden は1面/boot のみカバー。2面以降は golden に出ない＝出たら事故。stage h=3188712340 / boot-rng=0.19207037752494216）。

---

## 1. コンセプト / 物語

- **光の循環**: 春の昼（S1）→ 彼岸の黄昏（S2）→ 夜の竹林（S3, 暁色）→ **山の夜明け（S4, 曙）**。光が一周する。
- **暁→曙の綾**: S3 の双子の一人 **暁（あかつき＝まだ暗い・東だけ橙の前夜明け）** に対し、S4 を **曙（あけぼの／払暁＝空が白み陽が稜線を越える瞬間）** にすると、夜明けの実進行そのものになり、S3 の amber を繰り返さず一段「明るく・上へ」押し上がる。
- **舞台**: 山頂の御来光。登攀し、関の主（山姥）を**討って**山頂へ至り、そこで陽の烏（八咫烏）が昇る。
- **感情のレジスター**: S1（春昼・パステル・可愛い・平坦な昼光）と被らないよう、S4 は**崇高（sublime）・高コントラスト・劇的**。「眩しさ＝脅威」という反転で、明るいのに中盤の山として緊張を出す。

---

## 2. テーマ（新 `THEMES.summit`）

`THEMES` セクションに `summit` を追記（spring/dusk/bamboo の隣）。`setTheme('summit')` で petal 再bake＋scenery 再構築。

- **空**: プレイ帯は **morning blue〜灰青の中トーン**（弾の視認性を守る）。輝度は **horizon の白金の陽・god-ray・boss 背後の日輪**に寄せる。
- **scenery（道なし分岐の4例目）**: `summit:true` を立て、`buildScenery`/`drawScenery` を summit 分岐へ（`buildSummitScenery`/`drawScenerySummit`）。**雲海（sea of clouds）を下へ流し、暗い稜線がせり上がる前方クルーズ**。`ghost`/`bamboo` と同型（道はないが流れる＝既存 `bgScroll` 共有でボス到達 hover ease が無料で付く）。
- **petal**: 朝靄の光の粒（金〜白、`petalAlpha` で輝度帯の下に沈める。dusk/bamboo と同様）。
- **⚠ 視認性 caveat（最重要の設計注意）**: 明るい空＋光線＋明るい弾は**洗い流し合う**。S2/3 を暗くしたのは「明るい弾を目立たせる」ため。対策＝プレイ帯の空を中〜暗トーンに抑え、**白金の輝度を horizon の陽・god-ray・日輪・boss に集約**する。レーザー（光帯）も画面を白飛びさせない設計が必要。
- **未決定（次セッションで詰める）**: 具体 hex 一式、summit scenery の draw 実装、雲海の表現（worldY 固定の雲塊を深度投影で下へ流す等）。
  - 参考: S3 の `THEMES.bamboo.grove{hue,glow,lantern,fog}` のようにアクセント色を外出しすると後でデモ調整が楽（[[stage3-distinctiveness-pass]] の手法）。

---

## 3. 新エンジンシーム（このステージで作る本体）

### (a) 敵レーザー系統 ＝ 御来光 / 光芒　【L・最重量・S5/6 でも再利用】

> 現状 *自機側* の graze laser（`drawGrazeLaser` / `grazeLaserDamage`）はあるが、**敵レーザーは存在しない**。完全新規システム。レーザーは**ボス（八咫烏）の専売**にして看板を濃く保つ（中ボスには出さない）。

- **実体**（小プール、同時 ≤ ~12）:
  ```
  { x, y, ang, len, halfW, hue, state, t }   state ∈ WARN → FIRE → FADE
  ```
  - `warnDur`（予告 ~0.8–1.2s）→ `fireDur`（発火 ~0.4–0.9s）→ `fadeDur`（残光 ~0.3s）。値は tuning 課題。
- **ライフサイクル**（新 integrate パス `integrateLasers(dt)` を simStep に追加、bullets/particles と並ぶ）:
  - `WARN`: 細い高輝度の**予告線**（無害・脈動）。「これから撃つ」が読める。
  - `FIRE`: 半幅 `halfW` の**光帯**。FIRE 中のみ自機衝突判定。
  - `FADE`: 残光（無害、alpha ramp）。
  - origin を boss 追従にもできる（毎tick `x,y` を boss から更新）。`ang` を**コルーチンが毎tick書き換え＝掃射**（steered emitter と同じ流儀）。
- **衝突**（`collidePlayer*` に1パス追加、FIRE のみ）: 自機 (px,py) を origin から `ang` 方向の線分 [0,len] に射影しクランプ、その点までの距離 d。
  - `d < halfW + PLAYER_R` → `onPlayerHit`
  - `d < halfW + GRAZE_R` → `onGraze`（graze パワーアップ経済にも乗る）
- **描画**（**最背面**＝既存 player graze laser と同じ流儀。弾・item を上に残す）:
  - WARN = 1–2px の脈動コア線（全長）。FIRE = 加算の半幅グラデ帯＋白いホットコア。FADE = alpha 落ち。
  - ⚠ §2 caveat: 画面を白飛びさせない（コア以外の輝度を抑える）。
- **発火 verb**: `fireBeam({x,y,ang,len,halfW,warn,fire,hue,track})` を spell コルーチンから呼ぶ。
  - 扇/格子 = N回 stagger 呼び。掃射 = 1〜数本生成し coro が `.ang` を毎tick更新。
- **プール**: 専用小配列/pool（dense-prefix、他プール同様 compact）。

### (b) `b.hitR` 分離 ＝ 巨大弾の公平化　【S・golden 不変】

- 現状の衝突は `b.r` 一本（lethal も graze も同径）→ 見た目巨大な弾は kill 判定もデカすぎて理不尽。
- **kill 判定だけ `(b.hitR != null ? b.hitR : b.r)` を使う**。graze は `b.r` のまま。`spawnBullet` が `o.hitR` を写す。
  - 該当: `collidePlayerEnemies` の lethal パス（現 `const hr=b.r+PLAYER_R;`）。graze パス（`b.r+GRAZE_R`）は触らない。
- 既存弾は `hitR` 無し → 恒等 → **golden byte-identical**。全ての将来の大弾にも効く土台投資。
- これで **日輪＝見た目巨大／弾芯だけ致命** の東方流儀が成立。

### (c) 日輪（巨大弾）/ 螺旋（既存）

- **日輪**: 大 `r` ＋ 小 `hitR` ＋ 低速の単発巨大光球。稜線からゆっくりせり上がる。必要なら専用 `b.update` で「せり上がり→横断」を制御（`_updGhost` 流の位相機械、新規システム不要）。
- **螺旋**: 既存 `pat.spiral` / `spiral()` をそのまま装飾流用（朝靄に舞う光の粒、常時 BG）。コスト ~0。

---

## 4. ボス：八咫烏（Yatagarasu）

- **意匠**: 新 `BOSS_DESIGNS.yatagarasu`（`{ draw:drawBossYatagarasu, scale, hitR }`）＋ `drawBossYatagarasu`（RENDER）。三本足の太陽烏、**金〜白の高輝度シルエット**、背後に日輪。大型の鳥型で mizuchi(蛇)/twin(少女)/wisp/mandala と被らない。`hitR` は胴中心。
- **理由**: 三本足の太陽烏＝**光そのものが本体**なので、御来光レーザーと主題が完全一致。
- **7フェーズ**（escalation: nonspell 3 / spell 3 / survival 1。3スペルがそれぞれ別の顔＝静レーザー/日輪/掃射レーザー）:

  | # | 種別 | 内容 | 主ギミック |
  | --- | --- | --- | --- |
  | P1 | nonspell | 烏羽の自機狙い扇 ＋ ゆるい螺旋（導入） | 螺旋(装飾) |
  | P2 | spell「光芒の梯子」 | 稜線から**静的な**扇状予告レーザー、隙間が安地レーン | **レーザー初出(静)** |
  | P3 | nonspell | 羽根リング ＋ **日輪**が1つせり上がる（巨大弾の顔見せ） | 巨大弾(hitR) |
  | P4 | spell「日輪」 | ゆっくり横断する複数の日輪、周囲を pellet リングが埋め、陽とリングの間を縫う | **巨大弾(主役)** |
  | P5 | nonspell | 反転する二重螺旋羽根（中盤の圧） | 螺旋(強化) |
  | P6 | spell「御来光」 | 時計回りに**掃射**するレーザー ＋ その間を縫う螺旋羽根（看板＝レーザー×螺旋） | **レーザー掃射＋螺旋** |
  | P7 | survival「曙光」 | 画面が白金へ、掃射ビーム＋密螺旋＋日輪を全部、~28s 耐久 | 全部 |

- **HP**: 実プレイは power=max 進入なので、[[stage-difficulty-power-gap]] に従い DPS 比でスケール（max ≈ 2×power1）。S3 双子の帯（単体ボス 1340–1720 級）を参考に各フェーズ設定。
- **BGM 切替**: 八咫烏で `boss4` に切替（中ボスは `midboss4`、§7）。

---

## 5. 中ボス：山姥（Yamauba）— **撃破**（retreat ではない）

- **意匠**: 新 `BOSS_DESIGNS.yamauba` ＋ `drawBossYamauba`。**白髪・襤褸の深山の老婆**＝関の主。金の太陽烏と**最大コントラスト**。蛇・少女・烏のどれとも非重複。
- **撃破挙動**: S2/3 の `spec.retreat`→`bossRetreat` ではなく**通常の `bossDefeat`**（死亡爆発＋drops）。
  - 利点: 「ちゃんと倒した手応え」＋ **death 爆発と drop が power/score 源**になる（撤退は 0点死蔵だった）。
  - 物語の置き換え: 退場（夜→朝の受け渡し）の理屈は消え、「**山の関を守る主を登攀で討って山頂へ至る**」になる。むしろ撃破の方が中ボスを実体ある敵にできる。
- **フェーズ**: 2フェーズ（1 nonspell ＋ 1 spell）→ 死亡。
- **固有弾＝髪・糸**（**新規システム不要**＝既存 pattern 流用。レーザーはボス専売に保つ）:
  - **白髪の薙ぎ鞭弾**: `lineOfBullets`（糸＝弾の一筋）の角度を coro で薙ぐ／`nWaySpread` の baseAngle を回す掃き。
  - **糸車の螺旋糸カーテン**: `pat.spiral` を細い `rice`/`needle` で低速、帳（curtain）状に。
  - 視覚＝「掃く帳」で、ボスの放射状の光と**正反対**。
- **BGM**: **専用 `midboss4` に切替**（Stage 1 に倣う。S2/3 のように道中曲を流用しない）。

---

## 6. 道中（road / 中道）

- **アイデンティティ**: 小烏が**単発の御来光レーザーを一本ずつ置く**（予告→発火の慣らし場＝この道の identity）。レーザー本体は §3(a) を使う。
- **モーション**: 雲海の流れ（§2 scenery）。
- **power 源**: 烏の V字編隊（既存 `waveVFormation` 流用、`halvePower` 等の既定維持フラグも利用可）。
- **陣形ポリシー（[[v2-architecture-plan]] のユーザ方針を踏襲）**: 横一列 curtain を嫌う。**複数編隊・時間差・離れた位置・縦方向（深さ）も使った2D陣形**にする（`waveDrifters` の `speed`/`speedJit`/`drift`、`waveSideSweep` の `yStep` echelon を活用、ただし中央収束 drift は逆効果）。
- **配置**: `WAVES` レジストリに小烏レーザー wave を追加。総数は power economy 維持で設定。
- **未決定**: 日輪を道中にも出すか（現状はボス専用想定。出すなら落石＝既存 `_updBounce` 流用も可）。

---

## 7. BGM（専用3トラック ＝ Stage 1 に倣う）

`design/bgm-tracks.js` の `TRACKS` に **3曲**追加 → audition → `build-game.js` で `/*BGM:GEN*/` 領域を再インライン。

- `stage4`（道中）/ `midboss4`（山姥）/ `boss4`（八咫烏）。
- **全て独立した曲**（1/2/3面の reskin にしない＝記憶の教訓。音色/グルーヴ/テンポだけ変えると「変奏」に聞こえる→**メロディ＝モチーフ自体を別物に書く**）。[[bgm-build-pipeline]]
- **旋法**: 明るいが甘すぎない（Lydian or 明るい和ペンタトニック等、夜明けの清澄さ）。`SCALES` に追記（既存 Dharm/Eharm 等の隣）。
- **切替点**: 道中＝`stage4`、山姥登場＝`midboss4`、八咫烏登場＝`boss4`。`playMusic` は `trackOf(name)` で任意キーを受けるのでホワイトリスト編集不要。
- **pipeline**（CLAUDE.md §BGM）:
  ```bash
  # design/bgm-tracks.js に stage4/midboss4/boss4 を追加
  node design/bgm-tracks.js        # lane/in-key 検証
  node design/build-bgm.js         # bgm-demo.html 再生成 → A/B 試聴（要ユーザ）
  node design/build-game.js        # /*BGM:GEN*/ を index.html に再インライン
  node design/build-game.js --check
  node design/test-bgm-unlock.js
  ```
- **未決定**: 各曲の key/BPM/モチーフ、SCALES の具体追加。audition でユーザ確定。

---

## 8. 実装ビルド順（各段 `?golden=1` で Stage 1+boot 不変を確認）

1. **レーザー系統 (a)** を `?stage=4` デバッグ起動で動く**最小プロトタイプ**として差し込む（最重量・再利用最大。実体プール＋integrate＋collide パス＋最背面 draw＋`fireBeam` verb）。
2. **`b.hitR` 分離 (b)** → **日輪 (c)**（恒等変更、golden 不変を確認）。
3. **`THEMES.summit` ＋ summit scenery**（§2、視認性 caveat 厳守）。
4. **道中 WAVES ＋ 中ボス山姥**（§6・§5。撃破＝`bossDefeat`、2ph）。
5. **ボス八咫烏 7フェーズ**を `STAGES[3]` timeline に（§4）。
6. **BGM `stage4`/`midboss4`/`boss4`**（§7）。
7. 難度スケール（[[stage-difficulty-power-gap]]）・実プレイ調整。

---

## 9. index.html 配置（CLAUDE.md §architecture 参照。行番号はドリフトするので banner/symbol で辿る）

| 置く所 | 追加物 |
| --- | --- |
| **THEMES** | `THEMES.summit` ＋ `summit:true` scenery 分岐（`buildSummitScenery`/`drawScenerySummit`） |
| **BOSS_DESIGNS** | `yatagarasu`・`yamauba`（draw fn は RENDER に `drawBossYatagarasu`/`drawBossYamauba`） |
| **レーザー系統（新規）** | 実体プール＋`integrateLasers`＋`fireBeam`（PATTERNS 近辺 or 新 section）／`collidePlayer*` に FIRE 衝突1パス／RenderFrame に**最背面** draw |
| **ENGINE CORE** | `spawnBullet` に `o.hitR` 写し／`collidePlayerEnemies` lethal パスを `hitR ?? r` に |
| **PATTERNS** | 山姥の髪鞭/糸カーテン（既存 `lineOfBullets`/`pat.spiral` 流用、必要なら `b.update` updater）／日輪の `b.update`（任意） |
| **SPELL REGISTRY** | 看板スペルが3カード以上で再利用されたら motif 昇格（基本は `raw:function*`） |
| **WAVES** | 小烏レーザー wave・V字編隊 |
| **BOSSES** | `yamauba`（中ボス, 2ph, 撃破）・`yatagarasu`（7ph） |
| **STAGES[]** | `STAGES[3]` timeline（道中→中ボス山姥→道中→山場→八咫烏→`{stageClear}` or 6面があるので `{stageEnd}`／次面送りは `run._advanceTo` 経路必須） |
| **BGM** | `design/bgm-tracks.js` に3曲＋`SCALES`、pipeline で再インライン |

---

## 10. 留意（既存の教訓を適用）

- **golden は1面/boot のみカバー**。Stage 4 を足しても Stage 1 + boot が byte-identical なら回帰なし（stage h=3188712340 / boot-rng=0.19207037752494216 / 全 emitter）。**各段で再捕捉して cmp**。プレビューは `?stage=4`。
- **再利用できる既存シーム**（S2/3 で実装済）: 道なし scenery 分岐（§2）／deferred stage-advance `run._advanceTo`（次面送りはこの経路必須）／`{stageEnd}` verb／共有HP twin（S4 では不要だが S5/6 多体ボスで）。**撤退 retreat は今回使わない**（中ボスは撃破）。
- **power gap**: 実プレイは power=max 進入。boss HP・道中数を DPS 比でスケール（[[stage-difficulty-power-gap]]）。
- **honest constants**: 隠れたグローバル ×k を入れず、係数は source 値に畳む（ユーザ方針）。
- **視認性**（§2 caveat）は明るい面の生命線。レーザー/巨大弾/螺旋/明るい空が白飛びで潰し合わないこと。playwright で自分の目で確認（global note #19）。

---

## 11. 未決定リスト（次セッションで詰める）

- [ ] `THEMES.summit` 具体 hex 一式 ＋ summit scenery（雲海）の draw
- [ ] レーザーの `halfW` / warn・fire・fade 秒（tuning、公平性の核）
- [ ] `drawBossYatagarasu`（太陽烏）/ `drawBossYamauba`（白髪老婆）の意匠
- [ ] BGM `stage4`/`midboss4`/`boss4` の旋法・key・BPM・モチーフ（audition でユーザ確定）
- [ ] 日輪を道中にも出すか（落石＝`_updBounce` 流用案あり）
- [ ] 各ボスフェーズ・中ボス・スペルの最終 HP / 数値（power gap スケール後）
- [ ] スペル名最終化（光芒の梯子 / 日輪 / 御来光 / 曙光 / 山姥スペル名）
