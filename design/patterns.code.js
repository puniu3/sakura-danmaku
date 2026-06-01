// =====================================================================
// DANMAKU PATTERN LIBRARY
// Assumes globals from the loop/contract: enemyBullets (pool), player,
// rng() in [0,1), and sim clock T (seconds). All angles radians, 0=+x,
// clockwise (because +y is down). Velocities units/sec, accel units/sec^2.
// =====================================================================

const PF_W = 432, PF_H = 576;
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

const DEFAULT_R = 4.5;
const HUE_SPAN_RING = 40;
const HUE_SPAN_LAYER = 60;
const HUE_SPIN_PERTICK = 7;
const MAX_BOUNCES_DEFAULT = 2;

// ---------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------
function polarVel(a, speed) {
  return { vx: Math.cos(a) * speed, vy: Math.sin(a) * speed };
}
function angleToPlayer(x, y) {
  // player center assumed at player.x, player.y (playfield-local)
  return Math.atan2(player.y - y, player.x - x);
}
function dist(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}
function wrapAngle(a) {
  a %= TAU; if (a < 0) a += TAU; return a;
}
function hueShift(hue, d) {
  let h = (hue + d) % 360; if (h < 0) h += 360; return h;
}
// hue for layer i of n spread across `span` degrees, centered on base
function layerHue(baseHue, i, n, span) {
  if (n <= 1) return baseHue;
  const t = i / (n - 1);          // 0..1
  return hueShift(baseHue, (t - 0.5) * span);
}

// ---------------------------------------------------------------------
// LOW-LEVEL ALLOCATOR
// Pulls a dead bullet from the enemyBullets pool and stamps fields.
// The pool is expected to expose: enemyBullets.spawn() -> object|null
// (a recycled dead bullet with .alive=false), OR we fall back to a
// simple free-list scan. We support both; integration notes explain.
// ---------------------------------------------------------------------
function _poolGet() {
  // Preferred: pool with a fast spawn()/alloc() returning a slot.
  if (enemyBullets.spawn) return enemyBullets.spawn();
  if (enemyBullets.alloc) return enemyBullets.alloc();
  // Fallback: array-of-objects with .alive flag + cursor.
  const arr = enemyBullets.list || enemyBullets;
  const n = arr.length;
  let c = enemyBullets._cursor | 0;
  for (let k = 0; k < n; k++) {
    const idx = (c + k) % n;
    if (!arr[idx].alive) { enemyBullets._cursor = (idx + 1) % n; return arr[idx]; }
  }
  return null; // pool exhausted; pattern silently drops the bullet
}

function spawnBullet(o) {
  const b = _poolGet();
  if (!b) return null;
  b.x = o.x; b.y = o.y;
  b.vx = o.vx || 0; b.vy = o.vy || 0;
  b.ax = o.ax || 0; b.ay = o.ay || 0;
  b.r = (o.r != null) ? o.r : DEFAULT_R;
  b.style = o.style || 'orb';
  b.hue = (o.hue != null) ? o.hue : 0;
  b.alive = true;
  b.born = T;                       // sim time stamp (contract)
  // Optional polar/pattern fields (kept so emitters or custom updates can use them):
  b.speed = (o.speed != null) ? o.speed : Math.hypot(b.vx, b.vy);
  b.dir = (o.dir != null) ? o.dir : Math.atan2(b.vy, b.vx);
  b.av = o.av || 0;                 // angular velocity (rad/s) for curving bullets
  b.accel = o.accel || 0;           // scalar radial accel along dir
  // Custom behavior hook (bounce / ghost / laser). custom=true tells the
  // integrator this bullet owns its motion (skip default Euler).
  b.update = o.update || null;
  b.custom = !!o.custom;
  // Scratch fields some patterns need:
  b.t0 = o.t0 || 0; b.delay = o.delay || 0; b.bounces = o.bounces || 0;
  b.turn = o.turn || 0; b.spin = o.spin || 0; b.phase = o.phase || 0;
  b.fired = false;                  // for delayedTurn
  return b;
}

// Convenience: spawn from polar (angle+speed) directly.
function spawnPolar(o, a, speed, extra) {
  const v = polarVel(a, speed);
  const opts = extra ? Object.assign({}, extra) : {};
  opts.x = o.x; opts.y = o.y;
  opts.vx = v.vx; opts.vy = v.vy;
  opts.dir = a; opts.speed = speed;
  return spawnBullet(opts);
}

// ---------------------------------------------------------------------
// PER-BULLET CUSTOM UPDATES (used by a few patterns).
// Signature: fn(b, dt). They fully integrate motion when b.custom===true.
// ---------------------------------------------------------------------
function _updBounce(b, dt) {
  // reflect off playfield walls, decrement bounces; default integrate.
  b.vx += b.ax * dt; b.vy += b.ay * dt;
  b.x += b.vx * dt;  b.y += b.vy * dt;
  if (b.bounces > 0) {
    if (b.x < b.r)        { b.x = b.r;        b.vx = -b.vx; b.bounces--; }
    else if (b.x > PF_W - b.r) { b.x = PF_W - b.r; b.vx = -b.vx; b.bounces--; }
    if (b.y < b.r)        { b.y = b.r;        b.vy = -b.vy; b.bounces--; }
    else if (b.y > PF_H - b.r) { b.y = PF_H - b.r; b.vy = -b.vy; b.bounces--; }
  }
  // once bounces exhausted, let it leave & despawn normally
}
function _updGhost(b, dt) {
  // travel straight until born+delay, then snap to a new heading once.
  if (!b.fired && (T - b.born) >= b.delay) {
    b.fired = true;
    let na;
    if (b.turn === 'aim') na = angleToPlayer(b.x, b.y);
    else na = b.dir + b.turn;        // b.turn is delta radians, or absolute if turnAbs
    if (b.turnAbs) na = b.turn;
    b.dir = na;
    const v = polarVel(na, b.speed2 != null ? b.speed2 : b.speed);
    b.vx = v.vx; b.vy = v.vy;
  }
  b.vx += b.ax * dt; b.vy += b.ay * dt;
  b.x += b.vx * dt;  b.y += b.vy * dt;
}
function _updCurve(b, dt) {
  // constant angular velocity curving bullet (used by some spirals/whips).
  b.dir += b.av * dt;
  b.speed += b.accel * dt;
  b.vx = Math.cos(b.dir) * b.speed;
  b.vy = Math.sin(b.dir) * b.speed;
  b.x += b.vx * dt; b.y += b.vy * dt;
}

// ---------------------------------------------------------------------
// PATTERN LIBRARY
// Every pattern: pat.NAME(origin, p). origin = {x,y} (boss/enemy).
// ---------------------------------------------------------------------
const pat = {};

// 1. aimedShot — single bullet toward the player.
pat.aimedShot = function (o, p) {
  let a = angleToPlayer(o.x, o.y);
  if (p.jitter) a += (rng() - 0.5) * p.jitter;
  spawnPolar(o, a, p.speed, { hue: p.hue, style: p.style || 'rice', r: p.r });
};

// 2. nWaySpread — fan of `count` around baseAngle, total angular width = spread.
pat.nWaySpread = function (o, p) {
  const n = p.count;
  const half = (p.spread || 0) * 0.5;
  const step = n > 1 ? (p.spread || 0) / (n - 1) : 0;
  for (let i = 0; i < n; i++) {
    const a = p.baseAngle - half + step * i;
    const hue = (p.hueSpread != null)
      ? layerHue(p.hue, i, n, p.hueSpread) : p.hue;
    spawnPolar(o, a, p.speed, { hue, style: p.style || 'orb', r: p.r });
  }
};

// 3. aimedSpread — nWaySpread whose center auto-aims at the player.
pat.aimedSpread = function (o, p) {
  const q = Object.assign({}, p);
  q.baseAngle = angleToPlayer(o.x, o.y);
  pat.nWaySpread(o, q);
};

// 4. ring — even full circle of `count`.
pat.ring = function (o, p) {
  const n = p.count;
  const step = TAU / n;
  const base = p.baseAngle || 0;
  for (let i = 0; i < n; i++) {
    const a = base + step * i;
    const hue = (p.hueSpread != null)
      ? layerHue(p.hue, i, n, p.hueSpread) : p.hue;
    spawnPolar(o, a, p.speed, { hue, style: p.style || 'orb', r: p.r });
  }
};

// 5. evenRingOffset — a ring rotated by p.offset (caller advances offset/tick).
pat.evenRingOffset = function (o, p) {
  const q = Object.assign({}, p);
  q.baseAngle = (p.baseAngle || 0) + (p.offset || 0);
  pat.ring(o, q);
};

// 6. doubleRing — two concentric rings, different speeds, hue per layer.
pat.doubleRing = function (o, p) {
  const n = p.count;
  const step = TAU / n;
  const base = p.baseAngle || 0;
  const off = p.innerOffset != null ? p.innerOffset : step * 0.5;
  const hueA = p.hue;
  const hueB = hueShift(p.hue, p.hueLayer != null ? p.hueLayer : HUE_SPAN_LAYER);
  for (let i = 0; i < n; i++) {
    spawnPolar(o, base + step * i, p.speed,
      { hue: hueA, style: p.style || 'orb', r: p.r });
    spawnPolar(o, base + step * i + off, p.speed2 != null ? p.speed2 : p.speed * 0.7,
      { hue: hueB, style: p.style2 || p.style || 'pellet', r: p.r2 != null ? p.r2 : p.r });
  }
};

// 7. spiral — multi-arm rotating spiral. Caller advances p.phase each tick.
pat.spiral = function (o, p) {
  const arms = p.arms || 1;
  const armStep = TAU / arms;
  const base = (p.baseAngle || 0) + p.phase;
  const hueBase = (p.hueSpin != null)
    ? hueShift(p.hue, p.hueSpin * (p.tick || 0)) : p.hue;
  for (let k = 0; k < arms; k++) {
    const a = base + armStep * k;
    const hue = layerHue(hueBase, k, arms, p.hueArmSpan != null ? p.hueArmSpan : HUE_SPAN_RING);
    spawnPolar(o, a, p.speed, { hue, style: p.style || 'rice', r: p.r });
  }
};

// 8. expandingRing — ring with outward radial acceleration (speeds up).
pat.expandingRing = function (o, p) {
  const n = p.count;
  const step = TAU / n;
  const base = p.baseAngle || 0;
  const accel = p.accel != null ? p.accel : 120;
  for (let i = 0; i < n; i++) {
    const a = base + step * i;
    const v = polarVel(a, p.speed);
    const ac = polarVel(a, accel);
    spawnBullet({
      x: o.x, y: o.y, vx: v.vx, vy: v.vy, ax: ac.vx, ay: ac.vy,
      hue: (p.hueSpread != null) ? layerHue(p.hue, i, n, p.hueSpread) : p.hue,
      style: p.style || 'orb', r: p.r, dir: a, speed: p.speed,
    });
  }
};

// 9. contractingRing — bullets thrown outward but decelerated/pulled inward.
//    speed>0 outward, accel points back toward origin (negative radial).
pat.contractingRing = function (o, p) {
  const n = p.count;
  const step = TAU / n;
  const base = p.baseAngle || 0;
  const decel = p.decel != null ? p.decel : 200;
  for (let i = 0; i < n; i++) {
    const a = base + step * i;
    const v = polarVel(a, p.speed);
    const ac = polarVel(a, -decel);  // toward center
    spawnBullet({
      x: o.x, y: o.y, vx: v.vx, vy: v.vy, ax: ac.vx, ay: ac.vy,
      hue: (p.hueSpread != null) ? layerHue(p.hue, i, n, p.hueSpread) : p.hue,
      style: p.style || 'pellet', r: p.r, dir: a, speed: p.speed,
    });
  }
};

// 10. whipArc — a sweeping arc keyed by p.t (0..duration). Each call emits one
//     bullet whose angle marches across [baseAngle .. baseAngle+arc] over time.
pat.whipArc = function (o, p) {
  const frac = Math.max(0, Math.min(1, p.t / p.duration));
  const a = p.baseAngle + p.arc * frac;
  // speed ramps slightly along the whip for the classic "crack" read
  const sp = p.speed * (1 + (p.speedRamp || 0) * frac);
  const hue = (p.hueSpin != null) ? hueShift(p.hue, p.hueSpin * frac) : p.hue;
  spawnPolar(o, a, sp, { hue, style: p.style || 'rice', r: p.r });
};

// 11. randomScatter — `count` bullets in random dirs/speeds (seeded rng).
pat.randomScatter = function (o, p) {
  const n = p.count;
  const base = p.baseAngle != null ? p.baseAngle : 0;
  const spread = p.spread != null ? p.spread : TAU;
  for (let i = 0; i < n; i++) {
    const a = base + (rng() - 0.5) * spread;
    const sp = p.speedMin + rng() * (p.speedMax - p.speedMin);
    const hue = p.jitterHue ? hueShift(p.hue, (rng() - 0.5) * p.jitterHue) : p.hue;
    spawnPolar(o, a, sp, { hue, style: p.style || 'pellet', r: p.r });
  }
};

// 12. roseCurve — r=cos(k*theta) maps to per-bullet SPEED so the curtain
//     forms rose petals as it expands. count samples around the circle.
pat.roseCurve = function (o, p) {
  const n = p.count;
  const k = p.k || 4;
  const step = TAU / n;
  const phase = p.phase || 0;
  const sMin = p.speedMin != null ? p.speedMin : p.speed * 0.35;
  const sMax = p.speed;
  for (let i = 0; i < n; i++) {
    const theta = phase + step * i;
    const rr = Math.abs(Math.cos(k * theta)); // 0..1 petal envelope
    const sp = sMin + (sMax - sMin) * rr;
    // hue tracks petal lobe for color-banded petals
    const hue = hueShift(p.hue, rr * (p.hueSpan != null ? p.hueSpan : HUE_SPAN_RING));
    spawnPolar(o, theta, sp, { hue, style: p.style || 'star', r: p.r });
  }
};

// 13. flower — petalled bands: several roseCurves at offset phases & k.
pat.flower = function (o, p) {
  const layers = p.layers || 3;
  for (let L = 0; L < layers; L++) {
    pat.roseCurve(o, {
      count: p.count, k: p.k || 5, speed: p.speed * (0.6 + 0.4 * (L / layers)),
      phase: (p.phase || 0) + L * (Math.PI / (p.k || 5)) * 0.5,
      hue: hueShift(p.hue, L * (p.hueLayer != null ? p.hueLayer : 28)),
      style: p.style || 'star', r: p.r,
    });
  }
};

// 14. acceleratingRain — bullets drop from a span across the top, slow then
//     accelerate downward (gravity-ish). Great for "sky falling" filler.
pat.acceleratingRain = function (o, p) {
  const n = p.count;
  const span = p.xSpread != null ? p.xSpread : PF_W * 0.9;
  const x0 = (o.x != null ? o.x : PF_W * 0.5) - span * 0.5;
  const g = p.gravity != null ? p.gravity : 240;
  const s0 = p.speed0 != null ? p.speed0 : 30;
  for (let i = 0; i < n; i++) {
    const x = x0 + (n > 1 ? span * (i / (n - 1)) : 0) + (p.jitterX ? (rng() - 0.5) * p.jitterX : 0);
    spawnBullet({
      x, y: o.y != null ? o.y : -8,
      vx: (p.driftX || 0), vy: s0, ax: 0, ay: g,
      hue: (p.hueSpread != null) ? layerHue(p.hue, i, n, p.hueSpread) : p.hue,
      style: p.style || 'rice', r: p.r,
    });
  }
};

// 15. bouncingBullets — fan that reflects off playfield walls (custom update).
pat.bouncingBullets = function (o, p) {
  const n = p.count;
  const half = (p.spread || 0) * 0.5;
  const step = n > 1 ? (p.spread || 0) / (n - 1) : 0;
  for (let i = 0; i < n; i++) {
    const a = (p.baseAngle || 0) - half + step * i;
    const v = polarVel(a, p.speed);
    spawnBullet({
      x: o.x, y: o.y, vx: v.vx, vy: v.vy,
      hue: (p.hueSpread != null) ? layerHue(p.hue, i, n, p.hueSpread) : p.hue,
      style: p.style || 'kite', r: p.r, dir: a, speed: p.speed,
      bounces: p.bounces != null ? p.bounces : MAX_BOUNCES_DEFAULT,
      custom: true, update: _updBounce,
    });
  }
};

// 16. delayedTurn / ghost — travel, then re-aim at born+delay (custom update).
pat.delayedTurn = function (o, p) {
  const n = p.count;
  const half = (p.spread || 0) * 0.5;
  const step = n > 1 ? (p.spread || 0) / (n - 1) : 0;
  for (let i = 0; i < n; i++) {
    const a = (p.baseAngle || 0) - half + step * i;
    const v = polarVel(a, p.speed);
    spawnBullet({
      x: o.x, y: o.y, vx: v.vx, vy: v.vy,
      hue: (p.hueSpread != null) ? layerHue(p.hue, i, n, p.hueSpread) : p.hue,
      style: p.style || 'orb', r: p.r, dir: a, speed: p.speed,
      delay: p.delay != null ? p.delay : 0.8,
      turn: (p.turnTo != null ? p.turnTo : (p.turnAim ? 'aim' : (p.turn || Math.PI))),
      turnAbs: !!p.turnAbs,
      speed2: p.speed2,
      custom: true, update: _updGhost,
    });
  }
};

// 17. lineOfBullets — a rigid line of bullets along `angle`, spaced by gap.
pat.lineOfBullets = function (o, p) {
  const n = p.count;
  const ca = Math.cos(p.angle), sa = Math.sin(p.angle);
  const v = polarVel(p.angle, p.speed != null ? p.speed : 0);
  for (let i = 0; i < n; i++) {
    const d = (p.startGap || 0) + p.gap * i;
    spawnBullet({
      x: o.x + ca * d, y: o.y + sa * d, vx: v.vx, vy: v.vy,
      hue: (p.hueSpread != null) ? layerHue(p.hue, i, n, p.hueSpread) : p.hue,
      style: p.style || 'arrow', r: p.r, dir: p.angle, speed: p.speed || 0,
    });
  }
};

// 18. straightLaser — a fast dense line fired as a beam toward `angle`.
//     Modeled as a tight lineOfBullets with small gap & high speed.
pat.straightLaser = function (o, p) {
  const length = p.length != null ? p.length : 120;
  const gap = p.gap != null ? p.gap : 7;
  const count = Math.max(1, Math.round(length / gap));
  pat.lineOfBullets(o, {
    count, gap, startGap: p.startGap || 0,
    angle: p.angle, speed: p.speed != null ? p.speed : 260,
    hue: p.hue, style: p.style || 'arrow', r: p.r != null ? p.r : 3,
    hueSpread: p.hueSpread,
  });
};

// 19. ringOfRings — a ring of cluster origins, each firing a mini-burst.
//     The clusters fly outward; their bursts spawn relative to cluster dir.
pat.ringOfRings = function (o, p) {
  const C = p.clusters || 8;
  const step = TAU / C;
  const base = p.baseAngle || 0;
  for (let c = 0; c < C; c++) {
    const a = base + step * c;
    // place a sub-origin a little out along the cluster angle for visual sep
    const rad = p.clusterRadius != null ? p.clusterRadius : 14;
    const sub = { x: o.x + Math.cos(a) * rad, y: o.y + Math.sin(a) * rad };
    const hue = layerHue(p.hue, c, C, p.hueSpread != null ? p.hueSpread : HUE_SPAN_RING);
    // the mini burst: a small ring centered on the cluster's outward dir
    pat.nWaySpread(sub, {
      count: p.perCluster || 5,
      speed: p.burstSpeed != null ? p.burstSpeed : 110,
      baseAngle: a,
      spread: p.burstSpread != null ? p.burstSpread : 0.9,
      hue, style: p.style || 'pellet', r: p.r,
    });
    // also give the cluster a leading bullet so the ring structure reads:
    spawnPolar(sub, a, p.clusterSpeed != null ? p.clusterSpeed : 70,
      { hue, style: 'big', r: p.rLead != null ? p.rLead : 6 });
  }
};

// ---------------------------------------------------------------------
// SPELL-CARD / ATTACK DESCRIPTOR + CONDUCTOR
// ---------------------------------------------------------------------
// every(card, period): true exactly once per `period` seconds of card time.
function every(card, period) {
  if (!card._timers) card._timers = {};
  const key = '' + period;
  const acc = (card._timers[key] || 0) + card._dt;
  if (acc >= period) { card._timers[key] = acc - period; return true; }
  card._timers[key] = acc; return false;
}
// everyN(card, key, period): named variant so two emitters can share one period.
function everyN(card, key, period) {
  if (!card._timers) card._timers = {};
  const acc = (card._timers[key] || 0) + card._dt;
  if (acc >= period) { card._timers[key] = acc - period; return true; }
  card._timers[key] = acc; return false;
}
// phase(t, segments): pick segment by cumulative duration; returns {i, lt, seg}.
function phase(t, segments) {
  let acc = 0;
  for (let i = 0; i < segments.length; i++) {
    const d = segments[i].dur;
    if (t < acc + d) return { i, lt: t - acc, seg: segments[i] };
    acc += d;
  }
  const last = segments.length - 1;
  return { i: last, lt: t - (acc - segments[last].dur), seg: segments[last] };
}

function makeSpell(cfg) {
  return {
    name: cfg.name,
    hpMax: cfg.hp, hp: cfg.hp,
    timeLimit: cfg.timeLimit != null ? cfg.timeLimit : 60,
    bonus: cfg.bonus || 0,
    update: cfg.update,
    onStart: cfg.onStart || null,
    onEnd: cfg.onEnd || null,
    // runtime scratch (reset on start):
    _t: 0, _dt: 0, _timers: null, _spinPhase: 0, _tick: 0,
  };
}

function Conductor(boss) {
  return {
    boss,
    active: null,
    finished: false,
    captured: false,   // true if defeated by HP before timeout (bonus awarded)
    start(spell) {
      this.active = spell;
      spell.hp = spell.hpMax;
      spell._t = 0; spell._dt = 0; spell._timers = {};
      spell._spinPhase = 0; spell._tick = 0;
      this.finished = false; this.captured = false;
      if (spell.onStart) spell.onStart(boss, spell);
    },
    damage(n) {
      const s = this.active; if (!s) return;
      s.hp -= n;
      if (s.hp <= 0) { s.hp = 0; this._end(true); }
    },
    update(dt) {
      const s = this.active; if (!s || this.finished) return;
      s._dt = dt; s._t += dt; s._tick++;
      s.update(boss, s._t, dt);
      if (s._t >= s.timeLimit) this._end(false);
    },
    _end(captured) {
      const s = this.active;
      this.captured = captured; this.finished = true;
      if (s && s.onEnd) s.onEnd(boss, s, captured);
    },
  };
}

// ---------------------------------------------------------------------
// EXAMPLE SPELL CARDS (showing how the stage script drives the library).
// These are illustrative; the stage subsystem owns the real card list.
// ---------------------------------------------------------------------
const SAMPLE_CARDS = [
  // "Sign: Petal Cascade" — rotating spiral + occasional aimed reminder.
  makeSpell({
    name: 'Sign “Petal Cascade”', hp: 1600, timeLimit: 35, bonus: 50000,
    update(boss, t, dt) {
      boss._spinPhase = (boss._spinPhase || 0) + dt * 1.1;
      if (everyN(this, 'spiral', 1 / 30)) {
        pat.spiral(boss, {
          arms: 4, speed: 120, phase: boss._spinPhase, baseAngle: 0,
          hue: 320, style: 'rice', r: 3.5, hueSpin: HUE_SPIN_PERTICK, tick: this._tick,
        });
      }
      if (everyN(this, 'aim', 1.4)) {
        pat.aimedSpread(boss, { count: 5, speed: 160, spread: 0.6, hue: 200, hueSpread: 30 });
      }
    },
  }),
  // "Bloom: Rose of Spring" — flower bursts with bouncing accents.
  makeSpell({
    name: 'Bloom “Rose of Spring”', hp: 2200, timeLimit: 45, bonus: 80000,
    update(boss, t, dt) {
      if (everyN(this, 'flower', 2.0)) {
        pat.flower(boss, { count: 60, k: 5, speed: 150, phase: t * 0.3, hue: 330 });
      }
      if (everyN(this, 'bounce', 0.5)) {
        pat.bouncingBullets(boss, {
          count: 3, speed: 130, baseAngle: angleToPlayer(boss.x, boss.y),
          spread: 0.4, hue: 50, bounces: 2,
        });
      }
    },
  }),
  // "Final: Cherry-Blossom Storm" — phased: rings -> ghosts -> ring-of-rings.
  makeSpell({
    name: 'Final “Cherry-Blossom Storm”', hp: 4000, timeLimit: 70, bonus: 200000,
    update(boss, t, dt) {
      const ph = phase(t, [{ dur: 20 }, { dur: 25 }, { dur: 25 }]);
      if (ph.i === 0) {
        if (everyN(this, 'dring', 0.7))
          pat.doubleRing(boss, { count: 24, speed: 120, speed2: 85, hue: 300, hueLayer: 60 });
      } else if (ph.i === 1) {
        if (everyN(this, 'ghost', 1.6))
          pat.delayedTurn(boss, {
            count: 16, speed: 140, baseAngle: 0, spread: TAU, delay: 0.9, turnAim: true, speed2: 180, hue: 270,
          });
      } else {
        boss._spinPhase = (boss._spinPhase || 0) + dt * 0.8;
        if (everyN(this, 'ror', 1.2))
          pat.ringOfRings(boss, {
            clusters: 10, perCluster: 5, baseAngle: boss._spinPhase,
            clusterSpeed: 80, burstSpeed: 120, hue: 210, hueSpread: 60,
          });
        if (everyN(this, 'rain', 0.25))
          pat.acceleratingRain({ x: PF_W * 0.5, y: -8 }, { count: 4, gravity: 200, speed0: 20, hue: 340, jitterX: 30 });
      }
    },
  }),
];

// ---------------------------------------------------------------------
// EXPORTS (attach to a namespace if the project uses modules; otherwise
// these are all top-level globals usable by the stage script.)
// ---------------------------------------------------------------------
// window.Danmaku = { pat, spawnBullet, spawnPolar, polarVel, angleToPlayer,
//   makeSpell, Conductor, every, everyN, phase, hueShift, layerHue,
//   _updBounce, _updGhost, _updCurve, SAMPLE_CARDS };
