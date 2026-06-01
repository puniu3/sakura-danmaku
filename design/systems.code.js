// ======================================================================
// GAME SYSTEMS / PLAYER / UX STATE
// Assumes contract globals: game, player, enemyBullets, playerShots,
// enemies, particles, items, rng, and sim clock T (seconds).
// Other subsystems referenced (see integrationNotes): sfx.*, render.flash,
// spawnBullet(pool,...) / pool.spawn(), spawnParticle(...), boss damage.
// ======================================================================

// ---------- constants ----------
const PF_W=432, PF_H=576;
const PLAYER_R=2.4, GRAZE_R=14;
const PLAYER_SPEED=200, PLAYER_FOCUS_MUL=0.45, PLAYER_MARGIN=10;
const PLAYER_START={x:216,y:496};
const FIRE_CADENCE=0.055, SHOT_SPEED=720, SHOT_DMG=2, OPTION_DMG=1.4, MUZZLE_PARTICLES=2;
const MAXPOWER=400, POWER_BREAKS=[0,40,80,150,200,300,400];
const POWER_PER_ITEM=5, POWER_PER_BIG=25;
const START_BOMBS=3, MAX_BOMBS=8;
const BOMB_INVULN=2.5, BOMB_BOSS_DPS=140, BOMB_DOT_TIME=2.2, BOMB_FLASH=0.5;
const DEATHBOMB_TIME=8/120;
const START_LIVES=3, MAX_LIVES=9;
const RESPAWN_INVULN=3.0, RESPAWN_BLINK=0.09, DEATH_CLEAR_R=64, DEATH_POWER_DROP=8;
const GRAZE_SCORE=50;
const EXTEND_THRESHOLDS=[1e6,3e6,6e6,1e7];
const POINT_BASE=10000, POINT_MIN=2000, SPELL_CAPTURE_BONUS=500000;
const ITEM_GRAV=120, ITEM_TERMINAL=180, ITEM_R=10;
const ITEM_MAGNET_ACC=900, ITEM_MAGNET_MAXSPD=520;
const AUTO_COLLECT_Y=64, POC_LINE_Y=140;
const ITEM_KIND={POWER:0,POINT:1,BIGPOWER:2,ONEUP:3,FULLPOWER:4,STAR:5};
const ITEM_HUE={0:15,1:205,2:15,3:340,4:280,5:55};
const STATE={TITLE:0,PLAYING:1,PAUSED:2,GAMEOVER:3,STAGECLEAR:4};
const GAMEOVER_AUTORET=8.0;
const GAME_KEYS=new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','KeyZ','KeyX','Escape','KeyP','Enter']);

// ---------- INPUT ----------
const rawKeys=Object.create(null);     // code -> true while held
const edgeKeys=Object.create(null);    // code -> true if pressed since last handleInput()
const stepEdge=Object.create(null);    // code -> true for THIS sim step (consumed via keyEdge)

function attachInput(targetEl){
  const el=targetEl||window;
  el.addEventListener('keydown',e=>{
    // normalize Shift to ShiftLeft so focus works on either shift
    const code=e.code;
    if(GAME_KEYS.has(code)){ e.preventDefault(); }
    if(!rawKeys[code]) edgeKeys[code]=true;   // record press edge (latched until consumed)
    rawKeys[code]=true;
  },{passive:false});
  el.addEventListener('keyup',e=>{
    const code=e.code;
    if(GAME_KEYS.has(code)) e.preventDefault();
    rawKeys[code]=false;
  },{passive:false});
  // safety: drop all keys if window loses focus (prevents "stuck moving")
  window.addEventListener('blur',()=>{ for(const k in rawKeys) rawKeys[k]=false; });
}

// helpers that treat Shift/Ctrl variants as one logical key
function held2(a,b){ return !!(rawKeys[a]||rawKeys[b]); }
function keyHeld(code){ return !!rawKeys[code]; }
function keyEdge(code){ // consume a per-step edge
  if(stepEdge[code]){ stepEdge[code]=false; return true; }
  return false;
}
const moveLeft =()=> held2('ArrowLeft','KeyA');
const moveRight=()=> held2('ArrowRight','KeyD');
const moveUp   =()=> held2('ArrowUp','KeyW');
const moveDown =()=> held2('ArrowDown','KeyS');
const focusHeld=()=> held2('ShiftLeft','ShiftRight');
const fireHeld =()=> !!rawKeys['KeyZ'];

// Promote latched press-edges into this step's edge set. Call ONCE per sim step,
// BEFORE updateGameSystems. This guarantees a key pressed between steps is seen
// exactly once even at 120Hz.
function handleInput(dt){
  for(const k in edgeKeys){
    if(edgeKeys[k]){ stepEdge[k]=true; edgeKeys[k]=false; }
  }
  // fold logical aliases so callers can test one canonical code
  if(stepEdge['ShiftRight']) stepEdge['ShiftLeft']=true;
  if(stepEdge['KeyP'])       stepEdge['Escape']=true;
}

// ---------- PLAYER singleton ----------
let player=null;
function makePlayer(){
  return {
    x:PLAYER_START.x, y:PLAYER_START.y, r:PLAYER_R, graze:GRAZE_R,
    focus:false,
    state:'alive',            // 'alive' | 'pendingdeath' | 'dead' | 'gameover'
    invuln:0,                 // i-frame seconds remaining
    blink:false,
    fireCd:0,                 // cadence timer
    power:0,
    bombs:START_BOMBS,
    lives:START_LIVES,
    bombActive:0,             // seconds of bomb invuln-visual remaining (cosmetic)
    bossDot:0,                // seconds remaining of boss damage-over-time
    pendingDeath:0,           // deathbomb grace countdown (>0 means a hit is pending)
    respawnT:0,               // respawn lockout (dead -> back to alive)
    options:[],               // {dx,dy} option bit offsets (visual + fire origins)
    mvx:0, mvy:0,             // last move dir (for tilt anim by render)
  };
}

// ---------- GAME state model ----------
let game=null;
function makeGame(){
  return {
    state:STATE.TITLE,
    score:0, hi:0,
    grazeCount:0,
    pointValue:POINT_MIN,     // current per-point-item value (rises near top), for HUD
    pointTotal:0,             // count of point items collected (stat)
    extendsTaken:0,           // bitmask index into EXTEND_THRESHOLDS
    stateT:0,                 // seconds in current state
    flash:0,                  // screen flash strength 0..1 (render reads + decays via render)
    fullpower:false,
    titleSel:0,               // title menu cursor
    paused:false,
  };
}

// ---------- BOOT ----------
function initGameSystems(){
  game=makeGame();
  player=makePlayer();
  loadHiScore();
  setState(STATE.TITLE);
}

// ---------- MASTER TICK ----------
function updateGameSystems(dt){
  game.stateT+=dt;
  switch(game.state){
    case STATE.TITLE: updateTitle(dt); break;
    case STATE.PLAYING:
      playerUpdate(dt);
      updateItems(dt);
      applyBossDot(dt);
      break;
    case STATE.PAUSED:
      if(keyEdge('Escape')) togglePause();         // unpause
      break;
    case STATE.GAMEOVER:
      if(keyEdge('Enter')||game.stateT>GAMEOVER_AUTORET) setState(STATE.TITLE);
      break;
    case STATE.STAGECLEAR:
      if(keyEdge('Enter')||game.stateT>6) setState(STATE.TITLE);
      break;
  }
  // flash decays here so render just reads it
  if(game.flash>0){ game.flash-=dt/Math.max(0.0001,BOMB_FLASH); if(game.flash<0) game.flash=0; }
}

function updateTitle(dt){
  if(moveUp()&&keyEdge('ArrowUp'))   game.titleSel=(game.titleSel+1)%1; // single item for now
  if(keyEdge('Enter')||keyEdge('KeyZ')) startGame();
}

// ---------- STATE MACHINE ----------
function setState(s){
  // exit
  if(game.state===STATE.PLAYING && s!==STATE.PAUSED){ /* nothing */ }
  game.state=s; game.stateT=0;
  // enter
  if(s===STATE.TITLE){ game.paused=false; }
  else if(s===STATE.GAMEOVER){ saveHiScore(); if(typeof sfx!=='undefined') sfx.gameover&&sfx.gameover(); }
  else if(s===STATE.STAGECLEAR){ saveHiScore(); if(typeof sfx!=='undefined') sfx.stageclear&&sfx.stageclear(); }
}

function startGame(){
  // fresh run
  game.score=0; game.grazeCount=0; game.pointTotal=0; game.extendsTaken=0;
  game.fullpower=false; game.pointValue=POINT_MIN; game.flash=0;
  player=makePlayer();
  items.length=0;
  enemyBullets.clear&&enemyBullets.clear();
  playerShots.clear&&playerShots.clear();
  enemies.length=0;
  if(typeof startStage==='function') startStage(); // hand off to stage/wave subsystem
  setState(STATE.PLAYING);
  if(typeof sfx!=='undefined') sfx.start&&sfx.start();
}

function togglePause(){
  if(game.state===STATE.PLAYING){ setState(STATE.PAUSED); game.paused=true; if(typeof sfx!=='undefined') sfx.pause&&sfx.pause(); }
  else if(game.state===STATE.PAUSED){ setState(STATE.PLAYING); game.paused=false; }
}

function onStageClear(){ setState(STATE.STAGECLEAR); } // called by boss subsystem on final boss death

// ---------- PLAYER UPDATE ----------
function playerUpdate(dt){
  // global pause/confirm edges sampled in PLAYING
  if(keyEdge('Escape')){ togglePause(); return; }

  player.focus=focusHeld();

  // timers
  if(player.invuln>0){ player.invuln-=dt; player.blink=(Math.floor(player.invuln/RESPAWN_BLINK)&1)===0; }
  else player.blink=false;
  if(player.bombActive>0) player.bombActive-=dt;

  // deathbomb grace window
  if(player.state==='pendingdeath'){
    player.pendingDeath-=dt;
    if(keyEdge('KeyX') && player.bombs>0){
      // retroactive deathbomb
      player.state='alive';
      doBomb(true);
      return;
    }
    if(player.pendingDeath<=0){ finalizeDeath(); return; }
    // during grace the player can still inch but not fire
  }

  if(player.state==='dead'){
    player.respawnT-=dt;
    if(player.respawnT<=0) respawnNow();
    return;
  }

  // ---- movement ----
  let dx=0,dy=0;
  if(moveLeft())  dx-=1;
  if(moveRight()) dx+=1;
  if(moveUp())    dy-=1;
  if(moveDown())  dy+=1;
  if(dx&&dy){ const inv=0.70710678; dx*=inv; dy*=inv; }
  player.mvx=dx; player.mvy=dy;
  const spd=PLAYER_SPEED*(player.focus?PLAYER_FOCUS_MUL:1);
  player.x+=dx*spd*dt; player.y+=dy*spd*dt;
  // clamp
  if(player.x<PLAYER_MARGIN) player.x=PLAYER_MARGIN;
  if(player.x>PF_W-PLAYER_MARGIN) player.x=PF_W-PLAYER_MARGIN;
  if(player.y<PLAYER_MARGIN) player.y=PLAYER_MARGIN;
  if(player.y>PF_H-PLAYER_MARGIN) player.y=PF_H-PLAYER_MARGIN;

  // option bits follow with lag (focus tucks them in tight)
  layoutOptions();

  // ---- bomb edge ----
  if(keyEdge('KeyX')) tryBomb();

  // ---- fire ----
  if(player.state==='alive') playerFire(dt);
}

function respawnNow(){
  player.state='alive';
  player.x=PLAYER_START.x; player.y=PLAYER_START.y;
  player.invuln=RESPAWN_INVULN;
  player.fireCd=0;
  layoutOptions();
}

// ---------- POWER / SHOT LEVELING ----------
function shotLevel(){
  const p=player.power;
  let lvl=0;
  for(let i=1;i<POWER_BREAKS.length;i++) if(p>=POWER_BREAKS[i]) lvl=i;
  return lvl; // 0..6
}
function optionCount(){
  // 0,0,1,2,2,3,4 options across the 7 tiers
  return [0,0,1,2,2,3,4][shotLevel()];
}
function layoutOptions(){
  const n=optionCount();
  if(player.options.length!==n){
    player.options.length=0;
    for(let i=0;i<n;i++) player.options.push({dx:0,dy:0,tx:0,ty:0});
  }
  // target offsets: spread wider when not focused, tuck in when focused
  const spread=player.focus?10:22;
  for(let i=0;i<n;i++){
    const side=(i%2===0)?-1:1;
    const rank=Math.floor(i/2)+1;
    const o=player.options[i];
    o.tx=side*spread*rank*0.6;
    o.ty=-6 - rank*6;
    // ease toward target
    o.dx+=(o.tx-o.dx)*0.35;
    o.dy+=(o.ty-o.dy)*0.35;
  }
}

function addPower(p){
  if(player.power>=MAXPOWER) return;
  const before=shotLevel();
  player.power=Math.min(MAXPOWER,player.power+p);
  if(player.power>=MAXPOWER){ game.fullpower=true; }
  const after=shotLevel();
  if(after>before){
    if(typeof sfx!=='undefined') sfx.powerup&&sfx.powerup();
    layoutOptions();
  }
}

// ---------- FIRE ----------
function playerFire(dt){
  if(player.fireCd>0) player.fireCd-=dt;
  if(!fireHeld()) return;
  if(player.fireCd>0) return;
  player.fireCd+=FIRE_CADENCE;

  const lvl=shotLevel();
  const focus=player.focus;
  const up=-Math.PI/2; // straight up (radians, 0=+x clockwise)

  // ---- main streams: count grows with power ----
  const streams=[1,1,2,2,3,3,4][lvl];
  const spreadAng=focus?0.0:0.10;            // focus tightens to a needle
  for(let i=0;i<streams;i++){
    const t=(streams===1)?0:(i/(streams-1)-0.5);
    const a=up + t*spreadAng*2;
    const ox=(streams===1)?0:t*8;
    fireShot(player.x+ox, player.y-12, a, SHOT_SPEED, SHOT_DMG, 'main');
  }

  // ---- option bits fire too ----
  for(let i=0;i<player.options.length;i++){
    const o=player.options[i];
    const ox=player.x+o.dx, oy=player.y+o.dy;
    if(focus){
      // focused: dead-straight needles, high dps
      fireShot(ox,oy,up,SHOT_SPEED*1.05,OPTION_DMG,'option');
    }else{
      // unfocused: slight homing-ish lob toward nearest enemy
      const tgt=nearestEnemy(ox,oy);
      let a=up;
      if(tgt){ a=Math.atan2(tgt.y-oy,tgt.x-ox); a=up+clampAngle(a-up,-0.55,0.55); }
      fireShot(ox,oy,a,SHOT_SPEED*0.9,OPTION_DMG,'option');
    }
  }

  // muzzle particles
  for(let m=0;m<MUZZLE_PARTICLES;m++){
    spawnParticle && spawnParticle(player.x+(rng()-0.5)*8, player.y-12, (rng()-0.5)*40, -120-rng()*60, 0.12, 'muzzle', 50);
  }
  if(typeof sfx!=='undefined') sfx.shoot&&sfx.shoot();
}

function fireShot(x,y,a,speed,dmg,style){
  const b=playerShots.spawn?playerShots.spawn():allocShot();
  b.x=x; b.y=y;
  b.vx=Math.cos(a)*speed; b.vy=Math.sin(a)*speed;
  b.ax=0; b.ay=0; b.r=4; b.dmg=dmg; b.style=style; b.hue=(style==='option')?200:330;
  b.alive=true; b.born=T;
}
function allocShot(){ const b={}; playerShots.push?playerShots.push(b):0; return b; }

function nearestEnemy(x,y){
  let best=null,bd=1e9;
  for(let i=0;i<enemies.length;i++){
    const e=enemies[i]; if(!e||e.dead) continue;
    const d=(e.x-x)*(e.x-x)+(e.y-y)*(e.y-y);
    if(d<bd){ bd=d; best=e; }
  }
  return best;
}
function clampAngle(a,lo,hi){ // wrap into [-PI,PI] then clamp
  while(a>Math.PI)a-=2*Math.PI; while(a<-Math.PI)a+=2*Math.PI;
  return a<lo?lo:(a>hi?hi:a);
}

// ---------- BOMB ----------
function tryBomb(){
  if(player.state!=='alive') return false;
  if(player.bombs<=0) return false;
  doBomb(false);
  return true;
}
function doBomb(isDeathbomb){
  player.bombs--;
  player.invuln=Math.max(player.invuln,BOMB_INVULN);
  player.bombActive=BOMB_INVULN;
  player.bossDot=BOMB_DOT_TIME;          // heavy boss damage handled in applyBossDot
  game.flash=1.0;                        // render reads game.flash
  if(typeof render!=='undefined' && render.flash) render.flash(BOMB_FLASH);
  clearBulletsToSparkles(player.x,player.y,1e9); // bomb clears EVERYTHING
  if(typeof sfx!=='undefined') sfx.bomb&&sfx.bomb();
  if(isDeathbomb && typeof sfx!=='undefined') sfx.deathbomb&&sfx.deathbomb();
}
function applyBossDot(dt){
  if(player.bossDot>0){
    player.bossDot-=dt;
    // hit the boss/active enemies with damage-over-time
    for(let i=0;i<enemies.length;i++){
      const e=enemies[i];
      if(e&&e.isBoss&&!e.dead && typeof damageEnemy==='function')
        damageEnemy(e, BOMB_BOSS_DPS*dt, true);
    }
  }
}

// convert all enemyBullets within radius to score sparkles
function clearBulletsToSparkles(cx,cy,radius){
  const r2=radius*radius;
  enemyBullets.forEach && enemyBullets.forEach(b=>{
    if(!b.alive) return;
    const d=(b.x-cx)*(b.x-cx)+(b.y-cy)*(b.y-cy);
    if(d<=r2){
      b.alive=false;
      addScore(10);
      spawnParticle && spawnParticle(b.x,b.y,(rng()-0.5)*60,(rng()-0.5)*60,0.3,'sparkle',b.hue||55);
    }
  });
}

// ---------- DEATH ----------
// Called by COLLISION subsystem when an enemyBullet/enemy hits the player hitbox.
function onPlayerHit(srcBullet){
  if(player.state!=='alive') return;          // already dying / respawning
  if(player.invuln>0) return;                  // i-frames
  // begin deathbomb grace: record pending death, do NOT spend life yet
  player.state='pendingdeath';
  player.pendingDeath=DEATHBOMB_TIME;
  if(srcBullet){ srcBullet.alive=false; }      // consume the bullet that hit us
  if(typeof sfx!=='undefined') sfx.graze&&0; // (no sound here; finalize/deathbomb make sound)
}

function finalizeDeath(){
  player.state='dead';
  player.lives--;
  player.respawnT=0.55;                        // brief "popped" delay before respawn
  if(typeof sfx!=='undefined') sfx.death&&sfx.death();
  // clear nearby bullets so you don't instantly die again
  clearBulletsToSparkles(player.x,player.y,DEATH_CLEAR_R);
  // death burst particles
  for(let i=0;i<24;i++){
    const a=rng()*Math.PI*2, s=60+rng()*160;
    spawnParticle && spawnParticle(player.x,player.y,Math.cos(a)*s,Math.sin(a)*s,0.5,'death',330);
  }
  // drop power: lose a chunk of power, scatter as items
  const drop=Math.min(player.power, DEATH_POWER_DROP*POWER_PER_ITEM*0.5);
  player.power=Math.max(0, player.power-Math.floor(player.power*0.25)-15);
  game.fullpower=(player.power>=MAXPOWER);
  dropItems(ITEM_KIND.POWER, DEATH_POWER_DROP, player.x, player.y-10, 80);
  if(player.lives<0){
    player.state='gameover';
    setState(STATE.GAMEOVER);
  }
}

function addInvuln(seconds){ player.invuln=Math.max(player.invuln,seconds); }

// ---------- SCORING ----------
function addScore(n){
  game.score+=n;
  // score-threshold extends (each granted once, in order)
  while(game.extendsTaken<EXTEND_THRESHOLDS.length && game.score>=EXTEND_THRESHOLDS[game.extendsTaken]){
    game.extendsTaken++;
    grantExtend('score');
  }
  if(game.score>game.hi) game.hi=game.score;
}
function addGraze(n){
  n=n||1;
  game.grazeCount+=n;
  addScore(GRAZE_SCORE*n);
  if(typeof sfx!=='undefined') sfx.graze&&sfx.graze();
}
// Called by COLLISION: bullet entered graze ring but not hit ring (once per bullet).
function onGraze(bullet){
  if(player.invuln>0 && player.bombActive>0) { /* still graze during bomb is fine */ }
  if(bullet.grazed) return;
  bullet.grazed=true;
  addGraze(1);
  spawnParticle && spawnParticle(bullet.x,bullet.y,(rng()-0.5)*40,-30,0.18,'graze',55);
}
function grantExtend(reason){
  if(player.lives>=MAX_LIVES) return;
  player.lives++;
  if(typeof sfx!=='undefined') sfx.extend&&sfx.extend();
  game.flash=Math.max(game.flash,0.4);
}
// Called by BOSS subsystem when a spell card ends (captured=no-death-no-bomb flag).
function onSpellCaptured(bonus){
  const b=bonus||SPELL_CAPTURE_BONUS;
  addScore(b);
  if(typeof sfx!=='undefined') sfx.capture&&sfx.capture();
  game.flash=Math.max(game.flash,0.5);
}

// ---------- HI-SCORE persistence ----------
const HISCORE_KEY='danmaku_hiscore_v1';
function loadHiScore(){
  try{ const v=localStorage.getItem(HISCORE_KEY); game.hi=v?parseInt(v,10)||0:0; }catch(e){ game.hi=0; }
}
function saveHiScore(){
  try{ if(game.score>game.hi) game.hi=game.score; localStorage.setItem(HISCORE_KEY,String(game.hi)); }catch(e){}
}

// ---------- ITEMS ----------
// items[] is the global array (swap-remove).
function spawnItem(kind,x,y,vx,vy){
  items.push({
    kind, x, y,
    vx:vx||0, vy:(vy!=null?vy:-60),    // pop up then fall
    r:ITEM_R, hue:ITEM_HUE[kind],
    collected:false, magnet:false,
    autoT:0,                            // animation timer when auto-collected
    born:T,
  });
}
function dropItems(kind,count,x,y,spread){
  for(let i=0;i<count;i++){
    const a=(-Math.PI/2)+(rng()-0.5)*1.6;
    const s=60+rng()*90;
    spawnItem(kind, x+(rng()-0.5)*spread, y, Math.cos(a)*s, Math.sin(a)*s);
  }
}

function updateItems(dt){
  const pAlive=(player.state==='alive'||player.state==='pendingdeath');
  const magnetAll = game.fullpower || (pAlive && player.y<=POC_LINE_Y);
  for(let i=items.length-1;i>=0;i--){
    const it=items[i];

    // magnet trigger
    if(!it.magnet){
      if(magnetAll && pAlive) it.magnet=true;
    }
    // auto-collect line (suck items sitting above the line up to player regardless)
    const aboveAuto = it.y<=AUTO_COLLECT_Y;
    if(aboveAuto && pAlive) it.magnet=true;

    if(it.magnet && pAlive){
      const dx=player.x-it.x, dy=player.y-it.y;
      const d=Math.hypot(dx,dy)||1;
      it.vx+=(dx/d)*ITEM_MAGNET_ACC*dt;
      it.vy+=(dy/d)*ITEM_MAGNET_ACC*dt;
      const sp=Math.hypot(it.vx,it.vy);
      if(sp>ITEM_MAGNET_MAXSPD){ it.vx*=ITEM_MAGNET_MAXSPD/sp; it.vy*=ITEM_MAGNET_MAXSPD/sp; }
    }else{
      // gravity
      it.vy+=ITEM_GRAV*dt;
      if(it.vy>ITEM_TERMINAL) it.vy=ITEM_TERMINAL;
      it.vx*=0.992;
    }
    it.x+=it.vx*dt; it.y+=it.vy*dt;

    // collection test
    if(pAlive){
      const ddx=it.x-player.x, ddy=it.y-player.y;
      if(ddx*ddx+ddy*ddy <= ITEM_R*ITEM_R){
        collectItem(it);
        // swap-remove
        items[i]=items[items.length-1]; items.pop();
        continue;
      }
    }
    // despawn off bottom
    if(it.y>PF_H+40){ items[i]=items[items.length-1]; items.pop(); }
  }
}

function pointItemValue(yAtCollect){
  // worth POINT_BASE if collected at/above PoC line, scaling down to POINT_MIN at bottom.
  const top=POC_LINE_Y, bot=PF_H;
  let t=(yAtCollect-top)/(bot-top);           // 0 at PoC, 1 at bottom
  t=t<0?0:(t>1?1:t);
  return Math.round(POINT_BASE - t*(POINT_BASE-POINT_MIN));
}

function collectItem(it){
  switch(it.kind){
    case ITEM_KIND.POWER:     addPower(POWER_PER_ITEM); break;
    case ITEM_KIND.BIGPOWER:  addPower(POWER_PER_BIG); break;
    case ITEM_KIND.FULLPOWER: addPower(MAXPOWER); break;
    case ITEM_KIND.ONEUP:     grantExtend('item'); break;
    case ITEM_KIND.POINT: {
      const v=pointItemValue(it.y);
      game.pointValue=v; game.pointTotal++;
      addScore(v);
      break;
    }
    case ITEM_KIND.STAR:      addScore(500); break;
  }
  if(typeof sfx!=='undefined') sfx.item&&sfx.item(it.kind);
  spawnParticle && spawnParticle(it.x,it.y,0,-40,0.25,'pickup',it.hue);
}

// ---------- HUD DATA MODEL ----------
function getHUD(){
  return {
    state:game.state,
    score:game.score,
    hi:game.hi,
    lives:player.lives,
    bombs:player.bombs,
    power:player.power,            // 0..400
    powerDisp:(player.power/100).toFixed(2),
    maxpower:MAXPOWER,
    graze:game.grazeCount,
    pointValue:game.pointValue,    // current point-item worth
    fullpower:game.fullpower,
    focus:player.focus,
    invuln:player.invuln>0,
    paused:game.state===STATE.PAUSED,
    flash:game.flash,
    pocY:POC_LINE_Y,               // render can draw the PoC line
    autoY:AUTO_COLLECT_Y,
  };
}
