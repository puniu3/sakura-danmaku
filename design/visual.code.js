// =====================================================================
//  RENDER / VISUAL LAYER  — Canvas2D danmaku presentation
//  Reads global sim singletons; owns petals + screen-FX + popups only.
// =====================================================================

// ---- coordinate / canvas contract ----
const PF_W = 432, PF_H = 576, HUD_W = 208;
const CANVAS_W = PF_W + HUD_W;      // 640
const CANVAS_H = PF_H;              // 576
const PF_X = 0, PF_Y = 0;           // playfield origin within logical canvas

// ---- tunables ----
const HUE_BUCKET = 10, DPR_CAP = 2, SPRITE_PAD = 3;
const GLOW_SOFTNESS = 0.55, CORE_FRACTION = 0.42, BULLET_SPRITE_PX_PER_UNIT = 2.0;
const MAX_SHAKE = 11, TRAUMA_DECAY = 1.8, FLASH_DECAY = 9.0, SPAWN_FADE = 0.10;
const CANCEL_WAVE_SPEED = 520, CANCEL_WAVE_LIFE = 0.6;
const POPTEXT_LIFE = 0.9, BOSS_AURA_SPIN = 0.6;

const PALETTE = {
  skyTop:'#ffd9ec', skyMid:'#cfe0ff', skyBot:'#bfeede',
  cloud:'rgba(255,255,255,0.42)',
  petal:['#ffd5e6','#ffb3d1','#f58fb6'], petalEdge:'#ffe9f2',
  hudBg:'#160b22', hudPanel:'#241338', hudEdge:'#4b2d72',
  uiText:'#ffe9fb', uiDim:'#9d83c0', uiGold:'#ffd45e',
  life:'#ff5d8f', bomb:'#74e0ff', graze:'#b9ff6a',
  power0:'#ffb347', power1:'#ffe08a', powerBg:'#2a1840',
  ship:'#f7fbff', shipTrim:'#8fd0ff', engine:'#6cf0ff',
  hitRing:'#ff3b6b', option:'#bff0ff',
  bossBody:'#2a1030', bossRim:'#ff7ae0', auraA:'#ff5ec4', auraB:'#7a5cff',
  hp0:'#ff5e8a', hp1:'#ffd45e', timerWarn:'#ff4040',
  banner:'rgba(20,6,34,0.78)'
};

// ---------------------------------------------------------------------
//  Module state
// ---------------------------------------------------------------------
let canvas=null, ctx=null, dpr=1;
let _lastNow=0;
const cam = {                 // screen-FX / camera
  trauma:0, shakeX:0, shakeY:0,
  flash:0, flashHue:0,
  timeScale:1, slowT:0, slowTarget:1,
};
const waves=[];               // bullet-cancel radial waves {x,y,hue,t,life,strength}
const pops=[];                // floating popups {x,y,text,hue,t}
const petals=[];              // parallax cherry petals
let _fpsAcc=0,_fpsN=0,_fps=60;

const Render = {
  timeScale:1, fps:60,
  init, resize, frame,
  flash:reqFlash, shake:reqShake, cancelWave:reqCancelWave,
  slowmo:reqSlowmo, popText:reqPop,
};

// ---------------------------------------------------------------------
//  INIT / RESIZE
// ---------------------------------------------------------------------
function init(canvasEl){
  canvas = canvasEl;
  ctx = canvas.getContext('2d', { alpha:false, desynchronized:true });
  buildPetals();
  buildBgGradientCache();
  window.addEventListener('resize', resize);
  resize();
}

function resize(){
  dpr = Math.min(DPR_CAP, window.devicePixelRatio||1);
  canvas.width  = Math.round(CANVAS_W*dpr);
  canvas.height = Math.round(CANVAS_H*dpr);
  // CSS letterbox: integer-ish scale that fits the window
  const sx = window.innerWidth/CANVAS_W, sy = window.innerHeight/CANVAS_H;
  let s = Math.min(sx,sy);
  if (s>=1) s = Math.max(1, Math.floor(s*2)/2); // half-step snap when upscaling
  canvas.style.width  = (CANVAS_W*s)+'px';
  canvas.style.height = (CANVAS_H*s)+'px';
  ctx.imageSmoothingEnabled = true;
}

// ---------------------------------------------------------------------
//  BULLET SPRITE CACHE  (the core perf+look technique)
//  Key: "style|hueBucket".  Each entry: {canvas, cx, cy, rot, baseR}
//  Recipe per style = soft translucent colored glow halo + bright core.
//  Baked dark-on-transparent so the bullet batch can use 'lighter' once.
// ---------------------------------------------------------------------
const _bulletCache = new Map();
const _shotCache   = new Map();

function hueKey(hue){ return Math.round(((hue%360)+360)%360 / HUE_BUCKET)*HUE_BUCKET; }

// Approx hit-radius per style so a sprite scales sensibly; sim sets bullet.r,
// we bake at a canonical radius and downscale by bullet.r at draw time.
const STYLE_BASE_R = { orb:6, rice:4.5, kunai:7, bigBall:13, star:7, ring:7, bubble:7, scale:6, bolt:7 };

function getBulletSprite(style, hue){
  const hk = hueKey(hue);
  const key = style+'|'+hk;
  let e = _bulletCache.get(key);
  if (e) return e;
  e = bakeBulletSprite(style, hk);
  _bulletCache.set(key, e);
  return e;
}

function bakeBulletSprite(style, hue){
  const baseR = STYLE_BASE_R[style] || 6;
  const R = baseR * BULLET_SPRITE_PX_PER_UNIT;         // sprite radius in px
  const pad = SPRITE_PAD;
  const W = Math.ceil((R+pad)*2);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = W;
  const c = cv.getContext('2d');
  const cx = W/2, cy = W/2;
  c.translate(cx, cy);

  const lit  = `hsl(${hue},95%,62%)`;     // saturated body color
  const litT = (a)=>`hsla(${hue},95%,60%,${a})`;
  const coreR = R*CORE_FRACTION;
  let rot = false;                         // does the draw loop rotate this to bullet.dir?

  function glowBall(rad){                   // soft outer halo (additive-friendly)
    const g = c.createRadialGradient(0,0,rad*GLOW_SOFTNESS, 0,0,rad);
    g.addColorStop(0,  litT(0.85));
    g.addColorStop(0.5,litT(0.35));
    g.addColorStop(1,  litT(0.0));
    c.fillStyle=g; c.beginPath(); c.arc(0,0,rad,0,6.2832); c.fill();
  }
  function core(rad, soft){                 // bright near-white center
    const g = c.createRadialGradient(0,0,0, 0,0,rad);
    g.addColorStop(0,'rgba(255,255,255,0.98)');
    g.addColorStop(0.55,`hsla(${hue},100%,85%,0.95)`);
    g.addColorStop(1, litT(soft?0.0:0.5));
    c.fillStyle=g; c.beginPath(); c.arc(0,0,rad,0,6.2832); c.fill();
  }

  switch(style){
    case 'orb': {
      glowBall(R); core(coreR);
      // tiny specular dot
      c.fillStyle='rgba(255,255,255,0.9)';
      c.beginPath(); c.arc(-coreR*0.35,-coreR*0.35, coreR*0.32,0,6.2832); c.fill();
      break;
    }
    case 'bigBall': {
      glowBall(R); core(coreR*1.15);
      c.fillStyle='rgba(255,255,255,0.85)';
      c.beginPath(); c.arc(-coreR*0.4,-coreR*0.5, coreR*0.45,0,6.2832); c.fill();
      break;
    }
    case 'rice': {           // small oval, oriented along travel
      rot = true;
      c.save(); c.scale(1.0,0.5);          // squash to oval (will be rotated to dir)
      glowBall(R*0.9); c.restore();
      c.save(); c.scale(1.0,0.5); core(coreR*0.9,true); c.restore();
      break;
    }
    case 'kunai': {          // tapered knife: glowing diamond/blade
      rot = true;
      const L=R*1.05, w=R*0.42;
      // halo
      c.save(); c.globalAlpha=0.6;
      const g=c.createLinearGradient(-L,0,L,0);
      g.addColorStop(0,litT(0)); g.addColorStop(0.5,litT(0.5)); g.addColorStop(1,litT(0));
      c.fillStyle=g;
      c.beginPath(); c.moveTo(L,0); c.lineTo(0,-w); c.lineTo(-L*0.8,0); c.lineTo(0,w); c.closePath(); c.fill();
      c.restore();
      // bright blade
      c.fillStyle='rgba(255,255,255,0.95)';
      c.beginPath(); c.moveTo(L*0.92,0); c.lineTo(0,-w*0.5); c.lineTo(-L*0.6,0); c.lineTo(0,w*0.5); c.closePath(); c.fill();
      c.strokeStyle=lit; c.lineWidth=1.5; c.stroke();
      break;
    }
    case 'star': {
      rot = true;
      glowBall(R*0.95);
      drawStar(c, 5, R*0.82, R*0.34, '#ffffff', lit);
      break;
    }
    case 'ring':
    case 'bubble': {         // hollow glowing ring
      const g=c.createRadialGradient(0,0,R*0.45, 0,0,R);
      g.addColorStop(0, litT(0.0));
      g.addColorStop(0.62,litT(0.0));
      g.addColorStop(0.78,litT(0.9));
      g.addColorStop(0.92,`hsla(${hue},100%,88%,0.95)`);
      g.addColorStop(1, litT(0.0));
      c.fillStyle=g; c.beginPath(); c.arc(0,0,R,0,6.2832); c.fill();
      if (style==='bubble'){ // faint inner fill
        c.fillStyle=litT(0.12);
        c.beginPath(); c.arc(0,0,R*0.6,0,6.2832); c.fill();
      }
      break;
    }
    case 'scale': {          // oval w/ bright rim (fish-scale / petal-ish)
      rot = true;
      c.save(); c.scale(0.78,1.0);
      glowBall(R*0.92);
      c.lineWidth=2; c.strokeStyle=`hsla(${hue},100%,90%,0.95)`;
      c.beginPath(); c.arc(0,0,R*0.62,0,6.2832); c.stroke();
      core(coreR*0.8,true);
      c.restore();
      break;
    }
    case 'bolt': {           // jagged energy bolt
      rot = true;
      glowBall(R*0.85);
      c.strokeStyle='rgba(255,255,255,0.95)'; c.lineWidth=2.4; c.lineJoin='round';
      c.beginPath();
      c.moveTo(-R*0.7,0); c.lineTo(-R*0.15,-R*0.28); c.lineTo(R*0.1,R*0.2); c.lineTo(R*0.7,-R*0.05);
      c.stroke();
      c.strokeStyle=litT(0.8); c.lineWidth=4.5; c.globalAlpha=0.4; c.stroke();
      break;
    }
    default: { glowBall(R); core(coreR); }
  }
  return { canvas:cv, cx, cy, rot, baseR };
}

function drawStar(c, points, outer, inner, fill, stroke){
  c.beginPath();
  for (let i=0;i<points*2;i++){
    const r = (i&1)?inner:outer;
    const a = -Math.PI/2 + i*Math.PI/points;
    const x=Math.cos(a)*r, y=Math.sin(a)*r;
    i?c.lineTo(x,y):c.moveTo(x,y);
  }
  c.closePath();
  c.fillStyle=fill; c.fill();
  c.lineWidth=1.5; c.strokeStyle=stroke; c.stroke();
}

// player shot sprites (small fast white-blue needles + power orbs)
function getPlayerShotSprite(kind, hue){
  const key=kind+'|'+hueKey(hue);
  let cv=_shotCache.get(key); if(cv) return cv;
  cv=document.createElement('canvas');
  const W = kind==='orb'?20:14; cv.width=W; cv.height=W;
  const c=cv.getContext('2d'); c.translate(W/2,W/2);
  if(kind==='needle'){
    const g=c.createLinearGradient(0,-W/2,0,W/2);
    g.addColorStop(0,'rgba(255,255,255,0)'); g.addColorStop(0.5,'rgba(200,240,255,0.95)'); g.addColorStop(1,'rgba(255,255,255,0)');
    c.fillStyle=g; c.fillRect(-2,-W/2,4,W);
    c.fillStyle='rgba(255,255,255,0.95)'; c.fillRect(-1,-W/2,2,W);
  } else { // power orb
    const g=c.createRadialGradient(0,0,1,0,0,W/2);
    g.addColorStop(0,'rgba(255,255,255,0.95)'); g.addColorStop(0.5,`hsla(${hue},100%,75%,0.8)`); g.addColorStop(1,'hsla(190,100%,70%,0)');
    c.fillStyle=g; c.beginPath(); c.arc(0,0,W/2,0,6.2832); c.fill();
  }
  _shotCache.set(key,cv); return cv;
}

// ---------------------------------------------------------------------
//  BACKGROUND  (sky gradient + clouds + parallax petals + vignette)
// ---------------------------------------------------------------------
let _bgGrad=null;
function buildBgGradientCache(){ _bgGrad=null; } // rebuilt lazily with hue drift

function drawBackground(t){
  const drift = Math.sin(t*0.05)*14;            // slow ±14° hue drift
  const g = ctx.createLinearGradient(0,0,0,PF_H);
  g.addColorStop(0,  shiftHue(PALETTE.skyTop, drift));
  g.addColorStop(0.5,shiftHue(PALETTE.skyMid, drift*0.5));
  g.addColorStop(1,  shiftHue(PALETTE.skyBot,-drift*0.4));
  ctx.fillStyle=g; ctx.fillRect(0,0,PF_W,PF_H);

  // soft horizontal cloud bands
  ctx.save(); ctx.globalAlpha=0.5;
  for(let i=0;i<3;i++){
    const y = ((t*8*(i+1) ) % (PF_H+120)) - 60;
    const cg=ctx.createLinearGradient(0,y-30,0,y+30);
    cg.addColorStop(0,'rgba(255,255,255,0)'); cg.addColorStop(0.5,PALETTE.cloud); cg.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=cg; ctx.fillRect(0,y-30,PF_W,60);
  }
  ctx.restore();
}

function buildPetals(){
  const L=[{n:14,scale:0.55,vy:18,sway:10,alpha:0.55},
           {n:18,scale:0.8, vy:34,sway:16,alpha:0.8},
           {n:12,scale:1.15,vy:58,sway:24,alpha:1.0}];
  petals.length=0;
  const R = (typeof rng!=='undefined'&&rng.next)?()=>rng.next():Math.random;
  L.forEach((layer,li)=>{
    for(let i=0;i<layer.n;i++){
      petals.push({
        layer:li, x:R()*PF_W, y:R()*PF_H, scale:layer.scale*(0.7+R()*0.6),
        vy:layer.vy*(0.8+R()*0.4), sway:layer.sway, swayPh:R()*6.28, swaySpd:0.6+R()*0.8,
        rot:R()*6.28, rotV:(R()-0.5)*1.4, alpha:layer.alpha,
        hue: (li===2)?2:(li===1?-6:8) // deep/mid/light tint offsets
      });
    }
  });
}

const _petalSprite = (()=>{   // bake one petal bitmap (recolored per layer at draw via globalAlpha+tint? -> just bake 3)
  const out=[];
  PALETTE.petal.forEach((col)=>{
    const W=24,cv=document.createElement('canvas'); cv.width=W;cv.height=W;
    const c=cv.getContext('2d'); c.translate(W/2,W/2);
    // cherry petal: rounded teardrop with notch
    c.fillStyle=col;
    c.beginPath();
    c.moveTo(0,-9);
    c.bezierCurveTo(7,-6, 7,6, 0,9);
    c.bezierCurveTo(-7,6, -7,-6, 0,-9);
    c.fill();
    c.fillStyle=PALETTE.skyTop; // notch
    c.beginPath(); c.arc(0,9,2.4,0,6.2832); c.fill();
    c.strokeStyle=PALETTE.petalEdge; c.lineWidth=0.8;
    c.beginPath(); c.moveTo(0,-8); c.lineTo(0,7); c.stroke();
    out.push(cv);
  });
  return out;
})();

function updateAndDrawPetals(dt,t){
  for(const p of petals){
    p.y += p.vy*dt;
    p.swayPh += p.swaySpd*dt;
    p.rot += p.rotV*dt;
    if(p.y > PF_H+16){ p.y=-16; p.x=(typeof rng!=='undefined'&&rng.next?rng.next():Math.random())*PF_W; }
    const x = p.x + Math.sin(p.swayPh)*p.sway;
    const spr=_petalSprite[p.layer];
    ctx.save();
    ctx.globalAlpha=p.alpha;
    ctx.translate(x,p.y); ctx.rotate(p.rot);
    const s=p.scale; ctx.scale(s,s*(0.6+0.4*Math.abs(Math.cos(p.swayPh)))); // flutter foreshorten
    ctx.drawImage(spr,-spr.width/2,-spr.height/2);
    ctx.restore();
  }
}

// ---------------------------------------------------------------------
//  BOSS  (procedural silhouette + aura + spell background + banner)
// ---------------------------------------------------------------------
let _banner={active:false,t:0,name:'',sub:''};
function triggerBanner(name,sub){ _banner={active:true,t:0,name:name||'',sub:sub||''}; }

function drawSpellBackground(t, intensity){    // darken playfield during a spell
  if(intensity<=0) return;
  ctx.save();
  // vortex darken
  const g=ctx.createRadialGradient(PF_W*0.5,PF_H*0.42,40, PF_W*0.5,PF_H*0.42,PF_H*0.8);
  g.addColorStop(0,`rgba(60,20,90,${0.0})`);
  g.addColorStop(1,`rgba(20,6,34,${0.5*intensity})`);
  ctx.fillStyle=g; ctx.fillRect(0,0,PF_W,PF_H);
  // rotating spokes
  ctx.globalCompositeOperation='lighter';
  ctx.translate(PF_W*0.5,PF_H*0.42);
  ctx.rotate(t*0.25);
  for(let i=0;i<10;i++){
    ctx.rotate(Math.PI*2/10);
    const sg=ctx.createLinearGradient(0,0,0,-PF_H);
    sg.addColorStop(0,`rgba(180,120,255,${0.10*intensity})`);
    sg.addColorStop(1,'rgba(180,120,255,0)');
    ctx.fillStyle=sg; ctx.beginPath(); ctx.moveTo(-26,0); ctx.lineTo(26,0); ctx.lineTo(8,-PF_H); ctx.lineTo(-8,-PF_H); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawBoss(boss,t){
  if(!boss||!boss.alive) return;
  const x=boss.x, y=boss.y;
  // rotating auras (additive)
  ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.translate(x,y);
  for(let k=0;k<2;k++){
    ctx.save(); ctx.rotate(t*BOSS_AURA_SPIN*(k?-1:1) + k);
    const col = k?PALETTE.auraB:PALETTE.auraA;
    const g=ctx.createRadialGradient(0,0,6,0,0,46+k*10);
    g.addColorStop(0, hexA(col,0.55));
    g.addColorStop(1, hexA(col,0));
    ctx.fillStyle=g;
    for(let p=0;p<6;p++){ ctx.rotate(Math.PI/3);
      ctx.beginPath(); ctx.ellipse(20,0,26,9,0,0,6.2832); ctx.fill(); }
    ctx.restore();
  }
  ctx.restore();
  // silhouette body
  ctx.save(); ctx.translate(x,y);
  ctx.fillStyle=PALETTE.bossBody;
  ctx.beginPath(); ctx.ellipse(0,4,16,22,0,0,6.2832); ctx.fill();        // gown
  ctx.beginPath(); ctx.arc(0,-16,9,0,6.2832); ctx.fill();                // head
  ctx.strokeStyle=PALETTE.bossRim; ctx.lineWidth=1.6;
  ctx.beginPath(); ctx.ellipse(0,4,16,22,0,0,6.2832); ctx.stroke();
  ctx.beginPath(); ctx.arc(0,-16,9,0,6.2832); ctx.stroke();
  // hint of wings/aura sigils
  ctx.fillStyle=hexA(PALETTE.bossRim,0.5);
  ctx.beginPath(); ctx.moveTo(-16,-2); ctx.quadraticCurveTo(-40,-18,-30,12); ctx.quadraticCurveTo(-22,2,-16,6); ctx.fill();
  ctx.beginPath(); ctx.moveTo(16,-2); ctx.quadraticCurveTo(40,-18,30,12); ctx.quadraticCurveTo(22,2,16,6); ctx.fill();
  ctx.restore();
}

function drawBanner(dt){
  if(!_banner.active) return;
  _banner.t+=dt;
  const T=_banner.t;
  // 0..0.35 sweep in, hold, 1.6..2.0 sweep out
  let x;
  if(T<0.35) x = PF_W*(1 - easeOut(T/0.35));
  else if(T<1.6) x=0;
  else if(T<2.0) x = -PF_W*easeIn((T-1.6)/0.4);
  else { _banner.active=false; return; }
  ctx.save(); ctx.translate(x,0);
  const by=PF_H*0.34;
  ctx.fillStyle=PALETTE.banner; ctx.fillRect(0,by,PF_W,44);
  ctx.fillStyle=hexA(PALETTE.bossRim,0.9); ctx.fillRect(0,by,PF_W,2); ctx.fillRect(0,by+42,PF_W,2);
  ctx.fillStyle=PALETTE.uiText; ctx.textAlign='center';
  ctx.font='bold 20px "Trebuchet MS",sans-serif';
  ctx.fillText(_banner.name, PF_W/2, by+24);
  ctx.font='12px "Trebuchet MS",sans-serif'; ctx.fillStyle=PALETTE.uiDim;
  ctx.fillText(_banner.sub, PF_W/2, by+38);
  ctx.restore();
}

// ---------------------------------------------------------------------
//  PARTICLES  (additive sparks/rings) — render reads particles pool
//  Expected particle fields: {x,y,vx,vy,r,life,age,kind,hue,alive}
//  kinds: 'spark','ring','sparkle','petalBurst'
// ---------------------------------------------------------------------
function drawParticles(){
  if(typeof particles==='undefined') return;
  ctx.save(); ctx.globalCompositeOperation='lighter';
  const arr=particles.items||particles; // support pool wrapper or raw array
  for(let i=0;i<arr.length;i++){
    const p=arr[i]; if(!p||!p.alive) continue;
    const k=p.age/p.life, fade=1-k;
    if(p.kind==='ring'){
      const rr=p.r*(0.3+k*1.6);
      ctx.globalAlpha=fade*0.8; ctx.strokeStyle=`hsl(${p.hue},100%,70%)`; ctx.lineWidth=2*fade+0.5;
      ctx.beginPath(); ctx.arc(p.x,p.y,rr,0,6.2832); ctx.stroke();
    } else if(p.kind==='sparkle'){ // bullet-cancel star sparkle
      ctx.globalAlpha=fade;
      ctx.fillStyle=`hsl(${p.hue},100%,85%)`;
      const s=p.r*(1+k); ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.age*8);
      ctx.fillRect(-s,-0.6,2*s,1.2); ctx.fillRect(-0.6,-s,1.2,2*s); ctx.restore();
    } else { // spark / petalBurst dot
      ctx.globalAlpha=fade;
      const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r);
      g.addColorStop(0,'rgba(255,255,255,0.9)');
      g.addColorStop(0.5,`hsla(${p.hue},100%,70%,0.7)`);
      g.addColorStop(1,`hsla(${p.hue},100%,60%,0)`);
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,6.2832); ctx.fill();
    }
  }
  ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over'; ctx.restore();
}

// ---------------------------------------------------------------------
//  BULLET BATCH  (thousands of drawImage; one 'lighter' for whole batch)
// ---------------------------------------------------------------------
function drawEnemyBullets(alpha,T){
  if(typeof enemyBullets==='undefined') return;
  const arr=enemyBullets.items||enemyBullets;
  ctx.save();
  ctx.globalCompositeOperation='lighter';
  for(let i=0;i<arr.length;i++){
    const b=arr[i]; if(!b||!b.alive) continue;
    // interpolate position for smooth render between sim steps
    const px=b.x + b.vx*alpha*(1/120), py=b.y + b.vy*alpha*(1/120);
    const spr=getBulletSprite(b.style, b.hue);
    const sc=(b.r/spr.baseR);             // downscale baked sprite to actual hit radius feel
    // spawn fade-in
    const age=T-b.born;
    const a = age<SPAWN_FADE ? (age/SPAWN_FADE) : (b.fade!=null?b.fade:1);
    ctx.globalAlpha=a;
    if(spr.rot){
      const dir = (b.dir!=null)?b.dir:Math.atan2(b.vy,b.vx);
      ctx.setTransform(dpr,0,0,dpr, (PF_X+px)*dpr+cam.shakeX*dpr, (PF_Y+py)*dpr+cam.shakeY*dpr);
      ctx.rotate(dir + (b.style==='rice'||b.style==='kunai'||b.style==='scale'?0:0));
      ctx.scale(sc,sc);
      ctx.drawImage(spr.canvas,-spr.cx,-spr.cy);
    } else {
      // fast path: no rotation -> direct drawImage with scaled size
      const w=spr.canvas.width*sc, h=spr.canvas.height*sc;
      // (setTransform reset each time we did rotate; ensure base transform here)
      ctx.setTransform(dpr,0,0,dpr,0,0);
      ctx.translate(PF_X+cam.shakeX, PF_Y+cam.shakeY);
      ctx.drawImage(spr.canvas, px-w/2, py-h/2, w, h);
    }
  }
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over';
  ctx.restore();
}

function drawPlayerShots(alpha){
  if(typeof playerShots==='undefined') return;
  const arr=playerShots.items||playerShots;
  ctx.save(); ctx.globalCompositeOperation='lighter';
  ctx.translate(PF_X+cam.shakeX,PF_Y+cam.shakeY);
  for(let i=0;i<arr.length;i++){
    const s=arr[i]; if(!s||!s.alive) continue;
    const spr=getPlayerShotSprite(s.kind||'needle', s.hue||190);
    const px=s.x+s.vx*alpha*(1/120), py=s.y+s.vy*alpha*(1/120);
    if((s.kind||'needle')==='needle'){
      ctx.save(); ctx.translate(px,py); ctx.rotate(Math.atan2(s.vy,s.vx)+Math.PI/2);
      ctx.drawImage(spr,-spr.width/2,-spr.height/2); ctx.restore();
    } else ctx.drawImage(spr,px-spr.width/2,py-spr.height/2);
  }
  ctx.globalCompositeOperation='source-over'; ctx.restore();
}

// ---------------------------------------------------------------------
//  PLAYER  (ship + engine glow + focus hitbox reveal + options + iframe)
//  Expected: player {x,y,focus(bool),iframe(s),power, options:[{x,y}], dead}
// ---------------------------------------------------------------------
function drawPlayer(t){
  if(typeof player==='undefined'||player.dead) return;
  ctx.save(); ctx.translate(PF_X+cam.shakeX,PF_Y+cam.shakeY);
  const x=player.x,y=player.y;
  // i-frame blink
  let vis=1;
  if(player.iframe>0){ vis = (Math.sin(player.iframe*40)>0)?0.35:1; }
  ctx.globalAlpha=vis;
  // engine glow (additive)
  ctx.save(); ctx.globalCompositeOperation='lighter';
  const eg=ctx.createRadialGradient(x,y+10,1,x,y+10,12+Math.sin(t*20)*2);
  eg.addColorStop(0,hexA(PALETTE.engine,0.9)); eg.addColorStop(1,hexA(PALETTE.engine,0));
  ctx.fillStyle=eg; ctx.beginPath(); ctx.arc(x,y+10,12,0,6.2832); ctx.fill();
  ctx.restore();
  // ship body (small arrow craft)
  ctx.fillStyle=PALETTE.ship;
  ctx.beginPath(); ctx.moveTo(x,y-11); ctx.lineTo(x-8,y+8); ctx.lineTo(x,y+4); ctx.lineTo(x+8,y+8); ctx.closePath(); ctx.fill();
  ctx.fillStyle=PALETTE.shipTrim;
  ctx.beginPath(); ctx.moveTo(x,y-6); ctx.lineTo(x-4,y+5); ctx.lineTo(x+4,y+5); ctx.closePath(); ctx.fill();
  // option bits
  if(player.options) for(const o of player.options){
    ctx.fillStyle=PALETTE.option;
    ctx.beginPath(); ctx.arc(x+o.x,y+o.y,3,0,6.2832); ctx.fill();
  }
  // focus hitbox reveal: spinning ring + tiny dot
  if(player.focus){
    ctx.save(); ctx.globalCompositeOperation='lighter';
    ctx.translate(x,y);
    ctx.rotate(t*2.2);
    ctx.strokeStyle=PALETTE.hitRing; ctx.lineWidth=1.6;
    for(let s=0;s<3;s++){ ctx.rotate(Math.PI*2/3);
      ctx.beginPath(); ctx.arc(0,0,9,0.2,Math.PI*0.8); ctx.stroke(); }
    ctx.restore();
    // hard core dot (the true ~2.4u hitbox)
    ctx.fillStyle='#ffffff';
    ctx.beginPath(); ctx.arc(x,y,2.4,0,6.2832); ctx.fill();
    ctx.fillStyle=PALETTE.hitRing;
    ctx.beginPath(); ctx.arc(x,y,1.2,0,6.2832); ctx.fill();
  }
  ctx.globalAlpha=1;
  ctx.restore();
}

// ---------------------------------------------------------------------
//  ITEMS  (power/point pickups) — items array {x,y,kind}
// ---------------------------------------------------------------------
function drawItems(t){
  if(typeof items==='undefined') return;
  ctx.save(); ctx.translate(PF_X+cam.shakeX,PF_Y+cam.shakeY);
  for(const it of items){
    if(!it||it.alive===false) continue;
    const col = it.kind==='power'?'#ff8a3c':(it.kind==='point'?'#5ec8ff':'#ffe08a');
    ctx.save(); ctx.globalCompositeOperation='lighter';
    const g=ctx.createRadialGradient(it.x,it.y,0,it.x,it.y,7);
    g.addColorStop(0,'rgba(255,255,255,0.9)'); g.addColorStop(0.5,hexA(col,0.8)); g.addColorStop(1,hexA(col,0));
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(it.x,it.y,7,0,6.2832); ctx.fill();
    ctx.restore();
    ctx.fillStyle=col; ctx.font='bold 8px sans-serif'; ctx.textAlign='center';
    ctx.fillText(it.kind==='power'?'P':(it.kind==='point'?'•':'1'),it.x,it.y+3);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------
//  SCREEN FX  (cancel waves, white flash) + popups
// ---------------------------------------------------------------------
function reqFlash(intensity=1,hue=0){ cam.flash=Math.max(cam.flash,intensity); cam.flashHue=hue; }
function reqShake(amount=0.6){ cam.trauma=Math.min(1,cam.trauma+amount); }
function reqCancelWave(x,y,hue=200,strength=1){ waves.push({x,y,hue,t:0,life:CANCEL_WAVE_LIFE,strength}); }
function reqSlowmo(scale=0.25,dur=0.5){ cam.slowTarget=scale; cam.slowT=dur; }
function reqPop(x,y,text,hue=48){ pops.push({x,y,text,hue,t:0}); }

function updateCam(dt){
  cam.trauma=Math.max(0,cam.trauma-TRAUMA_DECAY*dt);
  const sh=cam.trauma*cam.trauma*MAX_SHAKE;
  cam.shakeX=(Math.random()*2-1)*sh; cam.shakeY=(Math.random()*2-1)*sh;
  cam.flash=Math.max(0,cam.flash-FLASH_DECAY*dt);
  // slow-mo ramp
  if(cam.slowT>0){ cam.slowT-=dt; cam.timeScale += (cam.slowTarget-cam.timeScale)*Math.min(1,dt*12); if(cam.slowT<=0) cam.slowTarget=1; }
  else cam.timeScale += (1-cam.timeScale)*Math.min(1,dt*6);
  Render.timeScale=cam.timeScale;
}

function drawWaves(dt){
  ctx.save(); ctx.translate(PF_X+cam.shakeX,PF_Y+cam.shakeY); ctx.globalCompositeOperation='lighter';
  for(let i=waves.length-1;i>=0;i--){
    const w=waves[i]; w.t+=dt; const k=w.t/w.life;
    if(k>=1){ waves.splice(i,1); continue; }
    const r=k*CANCEL_WAVE_SPEED*w.life;
    ctx.globalAlpha=(1-k)*0.7*w.strength;
    ctx.lineWidth=(1-k)*6+1; ctx.strokeStyle=`hsl(${w.hue},100%,75%)`;
    ctx.beginPath(); ctx.arc(w.x,w.y,r,0,6.2832); ctx.stroke();
    ctx.lineWidth=1; ctx.strokeStyle='rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.arc(w.x,w.y,r*0.92,0,6.2832); ctx.stroke();
  }
  ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over'; ctx.restore();
}

function drawPops(dt){
  ctx.save(); ctx.translate(PF_X,PF_Y); ctx.textAlign='center';
  for(let i=pops.length-1;i>=0;i--){
    const p=pops[i]; p.t+=dt; const k=p.t/POPTEXT_LIFE;
    if(k>=1){ pops.splice(i,1); continue; }
    ctx.globalAlpha=1-k; ctx.font='bold 11px "Trebuchet MS",sans-serif';
    ctx.fillStyle=`hsl(${p.hue},90%,70%)`;
    ctx.fillText(p.text, p.x, p.y-26*easeOut(k));
  }
  ctx.globalAlpha=1; ctx.restore();
}

function drawFlash(){
  if(cam.flash<=0) return;
  ctx.save(); ctx.globalCompositeOperation='lighter';
  ctx.fillStyle=`hsla(${cam.flashHue},80%,90%,${cam.flash})`;
  ctx.fillRect(0,0,PF_W,PF_H);
  ctx.restore();
}

function drawVignetteAndGrain(t){
  // vignette
  const g=ctx.createRadialGradient(PF_W/2,PF_H/2,PF_H*0.35,PF_W/2,PF_H/2,PF_H*0.72);
  g.addColorStop(0,'rgba(40,18,46,0)'); g.addColorStop(1,'rgba(40,18,46,0.55)');
  ctx.fillStyle=g; ctx.fillRect(0,0,PF_W,PF_H);
  // subtle scanlines
  ctx.save(); ctx.globalAlpha=1; ctx.fillStyle='rgba(0,0,0,0.05)';
  for(let y=0;y<PF_H;y+=3) ctx.fillRect(0,y,PF_W,1);
  ctx.restore();
}

// ---------------------------------------------------------------------
//  HUD  (right panel: score, hi, lives, bombs, power, graze, boss bar, fps)
//  Reads game {score,hi,lives,bombs,power,graze,boss}
// ---------------------------------------------------------------------
function drawHUD(){
  const G = (typeof game!=='undefined')?game:{};
  ctx.save();
  ctx.translate(PF_W,0);
  // panel bg
  ctx.fillStyle=PALETTE.hudBg; ctx.fillRect(0,0,HUD_W,PF_H);
  ctx.fillStyle=PALETTE.hudPanel; ctx.fillRect(8,8,HUD_W-16,PF_H-16);
  ctx.strokeStyle=PALETTE.hudEdge; ctx.lineWidth=2; ctx.strokeRect(8,8,HUD_W-16,PF_H-16);
  ctx.textAlign='left';
  let y=34; const lx=22;
  const label=(s)=>{ ctx.fillStyle=PALETTE.uiDim; ctx.font='10px "Trebuchet MS",sans-serif'; ctx.fillText(s,lx,y); };
  const val=(s,col)=>{ ctx.fillStyle=col||PALETTE.uiText; ctx.font='bold 18px "Trebuchet MS",sans-serif'; ctx.textAlign='right'; ctx.fillText(s,HUD_W-22,y); ctx.textAlign='left'; };

  label('HiScore'); val(pad(G.hi||0,9),PALETTE.uiGold); y+=22;
  label('Score');   val(pad(G.score||0,9),PALETTE.uiText); y+=34;

  // lives
  label('Player'); y+=16;
  for(let i=0;i<5;i++){ ctx.fillStyle=(i<(G.lives||0))?PALETTE.life:'rgba(255,93,143,0.18)';
    icon_heart(lx+i*18,y); }
  y+=26;
  // bombs
  label('Bomb'); y+=16;
  for(let i=0;i<5;i++){ ctx.fillStyle=(i<(G.bombs||0))?PALETTE.bomb:'rgba(116,224,255,0.18)';
    icon_star(lx+i*18,y); }
  y+=28;
  // power bar
  label('Power'); y+=8;
  const pw=HUD_W-44, ph=12, pf=Math.max(0,Math.min(1,(G.power||0)/(G.powerMax||128)));
  ctx.fillStyle=PALETTE.powerBg; roundRect(lx,y,pw,ph,4); ctx.fill();
  const pg=ctx.createLinearGradient(lx,0,lx+pw,0); pg.addColorStop(0,PALETTE.power0); pg.addColorStop(1,PALETTE.power1);
  ctx.fillStyle=pg; roundRect(lx,y,pw*pf,ph,4); ctx.fill();
  ctx.fillStyle=PALETTE.uiText; ctx.font='9px sans-serif'; ctx.textAlign='right';
  ctx.fillText(((G.power||0).toFixed?G.power.toFixed(2):G.power),lx+pw,y-3); ctx.textAlign='left';
  y+=30;
  // graze
  label('Graze'); ctx.fillStyle=PALETTE.graze; ctx.font='bold 16px "Trebuchet MS",sans-serif';
  ctx.textAlign='right'; ctx.fillText(''+(G.graze||0),HUD_W-22,y+2); ctx.textAlign='left';
  y+=30;

  // fps (bottom)
  ctx.fillStyle=PALETTE.uiDim; ctx.font='9px monospace';
  ctx.fillText('FPS '+(_fps|0), lx, PF_H-18);
  ctx.restore();

  // boss HP bar(s) — drawn over the TOP of the playfield, not the panel
  if(G.boss && G.boss.alive) drawBossHUD(G.boss);
}

function drawBossHUD(boss){
  // top-of-playfield arc + segmented bar + spell name + countdown
  ctx.save();
  const cx=PF_W*0.5, cy=8;
  // HP bar
  const phases=boss.phasesLeft!=null?boss.phasesLeft:0;
  const frac=Math.max(0,Math.min(1,boss.hp/boss.hpMax));
  const bw=PF_W-40, bh=8, bx=20, by=6;
  ctx.fillStyle='rgba(0,0,0,0.45)'; roundRect(bx,by,bw,bh,4); ctx.fill();
  const hg=ctx.createLinearGradient(bx,0,bx+bw,0); hg.addColorStop(0,PALETTE.hp0); hg.addColorStop(1,PALETTE.hp1);
  ctx.fillStyle=hg; roundRect(bx,by,bw*frac,bh,4); ctx.fill();
  // phase pips
  for(let i=0;i<phases;i++){ ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.arc(bx+8+i*10,by+bh+7,2,0,6.2832); ctx.fill(); }
  // spell name
  if(boss.spellName){
    ctx.fillStyle=PALETTE.uiText; ctx.font='italic 13px "Trebuchet MS",sans-serif'; ctx.textAlign='right';
    ctx.fillText(boss.spellName, PF_W-22, 34);
  }
  // countdown timer
  if(boss.timer!=null){
    const warn=boss.timer<8;
    ctx.fillStyle=warn?PALETTE.timerWarn:PALETTE.uiText;
    ctx.font='bold 16px "Trebuchet MS",monospace'; ctx.textAlign='left';
    ctx.fillText(boss.timer.toFixed(2), 22, 34);
  }
  ctx.restore();
}

// HUD icon helpers
function icon_heart(x,y){ ctx.beginPath(); ctx.moveTo(x,y+4); ctx.bezierCurveTo(x-7,y-3,x-3,y-7,x,y-3); ctx.bezierCurveTo(x+3,y-7,x+7,y-3,x,y+4); ctx.fill(); }
function icon_star(x,y){ ctx.save(); ctx.translate(x,y-1); drawStarFill(5,6,2.6); ctx.restore(); }
function drawStarFill(p,o,inn){ ctx.beginPath(); for(let i=0;i<p*2;i++){ const r=(i&1)?inn:o,a=-Math.PI/2+i*Math.PI/p; const X=Math.cos(a)*r,Y=Math.sin(a)*r; i?ctx.lineTo(X,Y):ctx.moveTo(X,Y);} ctx.closePath(); ctx.fill(); }

// ---------------------------------------------------------------------
//  FRAME  — the master draw order
// ---------------------------------------------------------------------
function frame(now, alpha){
  const dt = _lastNow? Math.min(0.05,(now-_lastNow)/1000):0.016;
  _lastNow=now;
  // fps smoothing
  _fpsAcc+=dt; _fpsN++; if(_fpsAcc>=0.25){ _fps=_fps*0.5+(_fpsN/_fpsAcc)*0.5; Render.fps=_fps; _fpsAcc=0;_fpsN=0; }
  const T = (typeof window.T!=='undefined')?window.T:(now/1000);
  const G = (typeof game!=='undefined')?game:{};

  updateCam(dt);

  // root transform = logical px
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle='#000'; ctx.fillRect(0,0,CANVAS_W,CANVAS_H);

  // ===== PLAYFIELD (clipped) =====
  ctx.save();
  ctx.beginPath(); ctx.rect(PF_X,PF_Y,PF_W,PF_H); ctx.clip();
  ctx.translate(PF_X,PF_Y);            // local origin (shake handled per-layer where needed)

  drawBackground(T);                                    // 1 sky+clouds
  updateAndDrawPetals(dt*(G.paused?0:1), T);            // 2 parallax petals (behind action)
  const spellI = (G.boss&&G.boss.inSpell)?(G.spellIntensity!=null?G.spellIntensity:1):0;
  drawSpellBackground(T, spellI);                       // 3 spell darken/vortex
  // (reset translate; sublayers translate themselves to include shake)
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.save(); ctx.beginPath(); ctx.rect(PF_X,PF_Y,PF_W,PF_H); ctx.clip();

  drawItems(T);                                         // 4 pickups
  drawPlayerShots(alpha);                               // 5 player bullets
  // boss + enemies (enemy sprites left to enemy subsystem; we draw boss body)
  ctx.save(); ctx.translate(PF_X+cam.shakeX,PF_Y+cam.shakeY);
  if(G.boss) drawBoss(G.boss,T);
  if(typeof drawEnemies==='function') drawEnemies(ctx,T,alpha); // enemy subsystem hook
  ctx.restore();
  drawParticles();                                      // 6 particles (additive)
  drawEnemyBullets(alpha,T);                            // 7 BULLET CURTAIN (top)
  drawPlayer(T);                                        // 8 player ship + hitbox
  drawWaves(dt);                                        // 9 cancel waves
  drawPops(dt);                                         //10 score popups
  drawBanner(dt);                                       //11 spell name banner
  drawFlash();                                          //12 white flash
  ctx.restore();

  // vignette+grain on top of playfield content, still clipped
  ctx.save(); ctx.beginPath(); ctx.rect(PF_X,PF_Y,PF_W,PF_H); ctx.clip();
  ctx.setTransform(dpr,0,0,dpr,0,0); ctx.translate(PF_X,PF_Y);
  drawVignetteAndGrain(T);                              //13
  ctx.restore();
  ctx.restore(); // end outer playfield clip

  // ===== HUD =====
  ctx.setTransform(dpr,0,0,dpr,0,0);
  drawHUD();                                            //14
}

// expose hooks for the event/sim layer to trigger the banner
Render.banner = triggerBanner;

// ---------------------------------------------------------------------
//  small color/math utils
// ---------------------------------------------------------------------
function easeOut(t){ return 1-(1-t)*(1-t); }
function easeIn(t){ return t*t; }
function pad(n,w){ let s=''+Math.floor(n); while(s.length<w)s='0'+s; return s; }
function hexA(hex,a){ const n=parseInt(hex.slice(1),16); return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`; }
function shiftHue(hex,deg){
  // hex -> hsl shift -> hsl() string
  const n=parseInt(hex.slice(1),16); let r=((n>>16)&255)/255,g=((n>>8)&255)/255,b=(n&255)/255;
  const mx=Math.max(r,g,b),mn=Math.min(r,g,b); let h,s,l=(mx+mn)/2;
  if(mx===mn){h=s=0;} else { const d=mx-mn; s=l>0.5?d/(2-mx-mn):d/(mx+mn);
    h=mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4; h/=6; }
  h=(h*360+deg+360)%360;
  return `hsl(${h.toFixed(1)},${(s*100).toFixed(0)}%,${(l*100).toFixed(0)}%)`;
}
function roundRect(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }

// expose
window.Render = Render;
window.getBulletSprite = getBulletSprite;
window.getPlayerShotSprite = getPlayerShotSprite;