// ===================================================================
// ENGINE CORE  — fixed-timestep loop, pools, collision, RNG, math
// Vanilla JS. Playfield-local coords: (0,0) top-left, +x right, +y DOWN.
// Angles radians, 0=+x, increasing CLOCKWISE. vx=cos(a)*s, vy=sin(a)*s.
// ===================================================================

// ---------- layout / tuning constants ----------
const PF_W = 432, PF_H = 576;
const HUD_W = 208;
const CANVAS_W = PF_W + HUD_W;   // 640
const CANVAS_H = PF_H;           // 576
const PF_X = 0, PF_Y = 0;        // playfield origin within logical canvas (offset 0; HUD sits to the right)

const STEP = 1 / 120;
const MAX_FRAME_DT = 0.25;
const MAX_STEPS = 8;

const BULLET_DESPAWN_MARGIN = 32;
const ENEMYBULLET_CAP = 8192;
const PLAYERSHOT_CAP   = 1024;
const PARTICLE_CAP     = 4096;

const PLAYER_HIT_R = 2.4;
const GRAZE_R = 14;

const GRID_CELL = 32;
const GRID_COLS = Math.ceil(PF_W / GRID_CELL); // 14
const GRID_ROWS = Math.ceil(PF_H / GRID_CELL); // 18
const USE_GRID = false; // flip to route player-vs-bullet through the uniform grid

const FPS_SMOOTH = 0.92;
const DEFAULT_SEED = 0x9e3779b9 >>> 0;

const TAU = Math.PI * 2;
const HALFPI = Math.PI / 2;

// ---------- math helpers ----------
function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
// move cur toward tgt by at most maxDelta (per call; caller scales by dt if desired)
function approach(cur, tgt, maxDelta) {
  const d = tgt - cur;
  if (d > maxDelta) return cur + maxDelta;
  if (d < -maxDelta) return cur - maxDelta;
  return tgt;
}
function hypot(dx, dy) { return Math.sqrt(dx * dx + dy * dy); }
function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); } // CW because +y down
// wrap to [-PI, PI)
function normalizeAngle(a) {
  a = a % TAU;
  if (a < -Math.PI) a += TAU;
  else if (a >= Math.PI) a -= TAU;
  return a;
}
// shortest signed difference a-b in [-PI,PI)
function angleDiff(a, b) { return normalizeAngle(a - b); }
// O(1) unordered remove for plain arrays (enemies, items)
function swapRemove(arr, i) {
  const last = arr.length - 1;
  if (i !== last) arr[i] = arr[last];
  arr.pop();
}

// ---------- seeded RNG (mulberry32) ----------
function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  const rng = function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.range = (a, b) => a + (b - a) * rng();
  rng.int = (n) => (rng() * n) | 0;            // [0,n)
  rng.pick = (arr) => arr[(rng() * arr.length) | 0];
  rng.sign = () => (rng() < 0.5 ? -1 : 1);
  rng.bool = (p = 0.5) => rng() < p;
  rng.angle = () => rng() * TAU;
  rng.reseed = (n) => { s = (n >>> 0) || 1; };
  rng.state = () => s >>> 0;
  rng.setState = (n) => { s = (n >>> 0) || 1; };
  return rng;
}
const rng = makeRng(DEFAULT_SEED);

// ---------- generic object pool ----------
// Plain-object pool. items[0..count) are LIVE (dense). Dead live beyond count.
function makePool(factory, n) {
  const items = new Array(n);
  for (let i = 0; i < n; i++) { const o = factory(); o.alive = false; o._slot = i; items[i] = o; }
  const pool = {
    items,
    count: 0,        // # live
    cap: n,
    factory,
    acquire() {
      if (this.count >= this.items.length) this._grow();
      const o = this.items[this.count++];
      o.alive = true;
      return o;
    },
    release(o) { o.alive = false; }, // physically removed on next compact()
    // swap dead -> tail, shrink count. O(count).
    compact() {
      const it = this.items;
      let n2 = this.count;
      let i = 0;
      while (i < n2) {
        if (it[i].alive) { i++; }
        else {
          n2--;
          if (i !== n2) { const tmp = it[i]; it[i] = it[n2]; it[n2] = tmp; }
        }
      }
      this.count = n2;
    },
    forEachLive(fn) { const it = this.items; for (let i = 0; i < this.count; i++) fn(it[i], i); },
    clear() { for (let i = 0; i < this.count; i++) this.items[i].alive = false; this.count = 0; },
    _grow() {
      const add = Math.max(64, this.items.length >> 1);
      for (let k = 0; k < add; k++) { const o = this.factory(); o.alive = false; this.items.push(o); }
      this.cap = this.items.length;
    },
  };
  return pool;
}

// ---------- canonical entity factories (monomorphic shape) ----------
function newBullet() {
  return {
    x: 0, y: 0, vx: 0, vy: 0, ax: 0, ay: 0,
    r: 3, style: 'orb', hue: 0, alive: false, born: 0,
    // optional polar pattern fields (used by emitter/pattern subsystem):
    speed: 0, dir: 0, accel: 0, av: 0, // av = angular velocity (rad/s) for curving
    grazed: false, dmg: 0,
    update: null, // optional custom per-bullet update(b,dt); null => default integrate
    _slot: 0,
  };
}
function newShot() {
  return {
    x: 0, y: 0, vx: 0, vy: 0, ax: 0, ay: 0,
    r: 4, style: 'shot', hue: 200, alive: false, born: 0,
    dmg: 1, pierce: 0, update: null, _slot: 0,
  };
}
function newParticle() {
  return {
    x: 0, y: 0, vx: 0, vy: 0, ax: 0, ay: 0,
    r: 2, style: 'spark', hue: 0, alive: false, born: 0,
    life: 0, maxLife: 0.5, rot: 0, av: 0, update: null, _slot: 0,
  };
}

const enemyBullets = makePool(newBullet, ENEMYBULLET_CAP);
const playerShots  = makePool(newShot, PLAYERSHOT_CAP);
const particles    = makePool(newParticle, PARTICLE_CAP);

// ---------- spawn convenience ----------
function spawnBullet(x, y, vx, vy, opts) {
  const b = enemyBullets.acquire();
  b.x = x; b.y = y; b.vx = vx; b.vy = vy;
  b.ax = 0; b.ay = 0; b.r = 3; b.style = 'orb'; b.hue = 0;
  b.speed = 0; b.dir = 0; b.accel = 0; b.av = 0;
  b.grazed = false; b.dmg = 0; b.update = null; b.born = T;
  if (opts) for (const k in opts) b[k] = opts[k];
  return b;
}
function spawnShot(x, y, vx, vy, opts) {
  const s = playerShots.acquire();
  s.x = x; s.y = y; s.vx = vx; s.vy = vy;
  s.ax = 0; s.ay = 0; s.r = 4; s.style = 'shot'; s.hue = 200;
  s.dmg = 1; s.pierce = 0; s.update = null; s.born = T;
  if (opts) for (const k in opts) s[k] = opts[k];
  return s;
}
function spawnParticle(x, y, vx, vy, opts) {
  const p = particles.acquire();
  p.x = x; p.y = y; p.vx = vx; p.vy = vy;
  p.ax = 0; p.ay = 0; p.r = 2; p.style = 'spark'; p.hue = 0;
  p.life = 0; p.maxLife = 0.5; p.rot = 0; p.av = 0; p.update = null; p.born = T;
  if (opts) for (const k in opts) p[k] = opts[k];
  return p;
}

// ---------- default integration + despawn (called from simStep) ----------
// These advance the engine-owned pools. The emitter/pattern subsystem may set
// b.update for special motion; otherwise we integrate ax/ay then x/y. We also
// support polar curving (av rotates dir, speed re-derives vx/vy) when av!=0.
function integrateBullets(dt) {
  const it = enemyBullets.items, n = enemyBullets.count;
  const minX = -BULLET_DESPAWN_MARGIN, maxX = PF_W + BULLET_DESPAWN_MARGIN;
  const minY = -BULLET_DESPAWN_MARGIN, maxY = PF_H + BULLET_DESPAWN_MARGIN;
  for (let i = 0; i < n; i++) {
    const b = it[i];
    if (b.update) { b.update(b, dt); }
    else if (b.av !== 0) { // curving polar bullet
      b.dir += b.av * dt;
      b.speed += b.accel * dt;
      b.vx = Math.cos(b.dir) * b.speed;
      b.vy = Math.sin(b.dir) * b.speed;
      b.x += b.vx * dt; b.y += b.vy * dt;
    } else {
      b.vx += b.ax * dt; b.vy += b.ay * dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
    }
    if (b.x < minX || b.x > maxX || b.y < minY || b.y > maxY) b.alive = false;
  }
}
function integrateShots(dt) {
  const it = playerShots.items, n = playerShots.count;
  for (let i = 0; i < n; i++) {
    const s = it[i];
    if (s.update) s.update(s, dt);
    else { s.vx += s.ax * dt; s.vy += s.ay * dt; s.x += s.vx * dt; s.y += s.vy * dt; }
    if (s.y < -BULLET_DESPAWN_MARGIN || s.y > PF_H + BULLET_DESPAWN_MARGIN ||
        s.x < -BULLET_DESPAWN_MARGIN || s.x > PF_W + BULLET_DESPAWN_MARGIN) s.alive = false;
  }
}
function integrateParticles(dt) {
  const it = particles.items, n = particles.count;
  for (let i = 0; i < n; i++) {
    const p = it[i];
    if (p.update) p.update(p, dt);
    else { p.vx += p.ax * dt; p.vy += p.ay * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.av * dt; }
    p.life += dt;
    if (p.life >= p.maxLife) p.alive = false;
  }
}

// ---------- optional uniform spatial grid (broadphase for enemyBullets) ----------
const grid = (function () {
  const cells = new Array(GRID_COLS * GRID_ROWS);
  for (let i = 0; i < cells.length; i++) cells[i] = [];
  function idx(cx, cy) { return cy * GRID_COLS + cx; }
  return {
    cells,
    rebuild(pool) {
      for (let i = 0; i < cells.length; i++) cells[i].length = 0;
      const it = pool.items, n = pool.count;
      for (let i = 0; i < n; i++) {
        const b = it[i];
        let cx = (b.x / GRID_CELL) | 0, cy = (b.y / GRID_CELL) | 0;
        if (cx < 0) cx = 0; else if (cx >= GRID_COLS) cx = GRID_COLS - 1;
        if (cy < 0) cy = 0; else if (cy >= GRID_ROWS) cy = GRID_ROWS - 1;
        cells[idx(cx, cy)].push(b);
      }
    },
    // gather bullets in cells overlapping circle (x,y,rad) into out[]
    queryInto(x, y, rad, out) {
      out.length = 0;
      let x0 = ((x - rad) / GRID_CELL) | 0, x1 = ((x + rad) / GRID_CELL) | 0;
      let y0 = ((y - rad) / GRID_CELL) | 0, y1 = ((y + rad) / GRID_CELL) | 0;
      if (x0 < 0) x0 = 0; if (x1 >= GRID_COLS) x1 = GRID_COLS - 1;
      if (y0 < 0) y0 = 0; if (y1 >= GRID_ROWS) y1 = GRID_ROWS - 1;
      for (let cy = y0; cy <= y1; cy++)
        for (let cx = x0; cx <= x1; cx++) {
          const c = cells[idx(cx, cy)];
          for (let k = 0; k < c.length; k++) out.push(c[k]);
        }
      return out;
    },
  };
})();
const _gridQuery = []; // scratch

// ---------- collision ----------
// player & onX hooks come from other subsystems (see integrationNotes).
function collidePlayerBullets() {
  if (!player || player.dead || player.invuln > 0) {
    // still allow graze while invuln? Touhou grazes even during deathbomb window; keep simple: skip both when invuln.
    if (!player || player.dead) return;
  }
  const px = player.x, py = player.y;
  const hitR = PLAYER_HIT_R, grazeR = GRAZE_R;

  if (USE_GRID) {
    grid.rebuild(enemyBullets);
    const list = grid.queryInto(px, py, grazeR, _gridQuery);
    for (let i = 0; i < list.length; i++) testBulletVsPlayer(list[i], px, py, hitR, grazeR);
  } else {
    const it = enemyBullets.items, n = enemyBullets.count;
    for (let i = 0; i < n; i++) testBulletVsPlayer(it[i], px, py, hitR, grazeR);
  }
}
function testBulletVsPlayer(b, px, py, hitR, grazeR) {
  const dx = b.x - px, dy = b.y - py;
  const d2 = dx * dx + dy * dy;
  const hr = b.r + hitR;
  if (d2 <= hr * hr) {
    if (player.invuln <= 0 && !player.dead) onPlayerHit(b, null);
    return;
  }
  if (!b.grazed) {
    const gr = b.r + grazeR;
    if (d2 <= gr * gr) { b.grazed = true; onGraze(b); }
  }
}
function collideShotsEnemies() {
  const sh = playerShots.items, sn = playerShots.count;
  for (let ei = 0; ei < enemies.length; ei++) {
    const e = enemies[ei];
    if (e.dead || e.invuln > 0) continue;
    const ex = e.x, ey = e.y, er = e.r;
    for (let i = 0; i < sn; i++) {
      const s = sh[i];
      if (!s.alive) continue;
      const rr = er + s.r;
      if (dist2(s.x, s.y, ex, ey) <= rr * rr) {
        onEnemyHit(e, s, s.dmg);
        if (s.pierce > 0) s.pierce--; else s.alive = false;
        if (e.dead) break;
      }
    }
  }
}
function collidePlayerItems() {
  if (!player || player.dead) return;
  const px = player.x, py = player.y, pr = player.itemR || 8;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const rr = pr + (it.r || 4);
    if (dist2(px, py, it.x, it.y) <= rr * rr) onItemPickup(it);
  }
}
function collidePlayerEnemies() {
  if (!player || player.dead || player.invuln > 0) return;
  const px = player.x, py = player.y, pr = PLAYER_HIT_R;
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (e.dead || !e.bodyDamage) continue;
    const rr = pr + e.r;
    if (dist2(px, py, e.x, e.y) <= rr * rr) { onPlayerHit(null, e); return; }
  }
}

// ---------- FPS sampler ----------
const fps = { frame: 60, sim: 120, _stepsThisSec: 0, _accSec: 0 };

// ===================================================================
//  MAIN LOOP — fixed timestep, decoupled render, pause, sim clock T
// ===================================================================
let T = 0;
let renderAlpha = 0;
let _acc = 0;
let _lastMs = 0;
let _ctx = null, _canvas = null, _dpr = 1;

function setupCanvas() {
  _canvas = document.getElementById('game') || (() => {
    const c = document.createElement('canvas'); c.id = 'game'; document.body.appendChild(c); return c;
  })();
  _ctx = _canvas.getContext('2d', { alpha: false, desynchronized: true });
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
}
function resizeCanvas() {
  _dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  // integer-ish CSS scale to fill window, letterboxed, preserve aspect
  const sx = window.innerWidth / CANVAS_W, sy = window.innerHeight / CANVAS_H;
  const scale = Math.max(1, Math.floor(Math.min(sx, sy) * 2) / 2); // half-step scale, >=1
  _canvas.width = Math.round(CANVAS_W * _dpr);
  _canvas.height = Math.round(CANVAS_H * _dpr);
  _canvas.style.width = (CANVAS_W * scale) + 'px';
  _canvas.style.height = (CANVAS_H * scale) + 'px';
  // expose for render subsystem
  RENDER.ctx = _ctx; RENDER.dpr = _dpr; RENDER.canvas = _canvas;
}

// One fixed sim tick. ALL gameplay update happens here, in deterministic order.
function simStep(dt) {
  // ---- order matters; this is the canonical update pipeline ----
  player.update(dt);                 // [PLAYER]  movement, focus, shoot cadence -> spawnShot()
  for (let i = enemies.length - 1; i >= 0; i--) { // [ENEMY] AI + emitter -> spawnBullet()
    const e = enemies[i];
    e.update(dt);
    if (e.dead) swapRemove(enemies, i);
  }
  BOSS.update && BOSS.update(dt);    // [SPELLCARD] boss phase scripts / timeline
  integrateBullets(dt);              // [ENGINE] move enemy bullets + despawn
  integrateShots(dt);                // [ENGINE] move player shots + despawn
  integrateParticles(dt);           // [ENGINE] move/age particles
  for (let i = items.length - 1; i >= 0; i--) { // [ITEMS] gravity/magnet
    const it = items[i];
    it.update ? it.update(it, dt) : (it.y += (it.vy || 0) * dt);
    if (it.y > PF_H + BULLET_DESPAWN_MARGIN || it.dead) swapRemove(items, i);
  }
  // ---- collision pass (after everyone moved this tick) ----
  collideShotsEnemies();             // damage enemies
  collidePlayerBullets();            // player hit + graze
  collidePlayerEnemies();            // body collision
  collidePlayerItems();              // pickups
  // ---- compact pools (drop dead, keep live prefix dense) ----
  enemyBullets.compact();
  playerShots.compact();
  particles.compact();
  // ---- advance clock + timers ----
  if (player.invuln > 0) player.invuln -= dt;
  T += dt;
  fps._stepsThisSec++;
}

function renderFrame(alpha) {
  // [RENDER subsystem owns the actual draw calls]. Engine just hands it context+alpha.
  RENDER.draw(alpha);
}

function frame(nowMs) {
  requestAnimationFrame(frame);
  if (_lastMs === 0) _lastMs = nowMs;
  let dt = (nowMs - _lastMs) / 1000;
  _lastMs = nowMs;
  if (dt > MAX_FRAME_DT) dt = MAX_FRAME_DT; // clamp: never spiral

  // FPS display (EMA on real frame cadence)
  if (dt > 0) fps.frame = fps.frame * FPS_SMOOTH + (1 / dt) * (1 - FPS_SMOOTH);
  fps._accSec += dt;
  if (fps._accSec >= 1) { fps.sim = fps._stepsThisSec; fps._stepsThisSec = 0; fps._accSec -= 1; }

  if (!game.paused) {
    _acc += dt;
    let steps = 0;
    while (_acc >= STEP && steps < MAX_STEPS) {
      simStep(STEP);
      _acc -= STEP;
      steps++;
    }
    if (steps >= MAX_STEPS) _acc = 0; // we fell behind hard: drop backlog, stay responsive
    renderAlpha = _acc / STEP;
  }
  // render every animation frame (even paused -> draws overlay)
  renderFrame(game.paused ? 1 : renderAlpha);
}

function startEngine() {
  setupCanvas();
  _lastMs = 0; _acc = 0;
  requestAnimationFrame(frame);
}
