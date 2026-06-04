#!/usr/bin/env node
// build-stage3-demo.js — generate stage3-demo.html, a Stage-3 BACKGROUND colour-candidate audition harness.
// Inlines the real game <script> (no code drift) with window.__DEMO set, then injects several candidate
// Stage-3 grove palettes into THEMES (via the dev hook) and renders buttons to live-swap them. Each candidate
// keeps Stage 3's overall tone (dark, misty, petalAlpha 0.5, road-less bamboo grove) but recolours the
// load-bearing accents (sky gradient, drifting petals/leaves, grove.{hue,glow,lantern,fog}) so it reads as a
// distinct stage from Stage 2's jade-teal "Far Shore".
//
// Launch:  node design/build-stage3-demo.js   then open  http://<LAN-IP>:8000/stage3-demo.html?stage=3
// (?stage=3 → the grove renders live at full brightness behind only the play tint; the harness keeps the
//  player invulnerable so a game-over never snaps the theme back to spring. Press P to freeze the bullets.)
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) throw new Error('game <script> not found in index.html');
const game = m[1];

// Candidate Stage-3 palettes. Each is a full THEME entry with bamboo:true (→ drawSceneryBamboo branch) and a
// grove{} accent block. Reference entries 'dusk' (Stage 2) and 'bamboo' (current Stage 3) already live in THEMES.
const CANDIDATES = {
  // A — 宵 Indigo Grove: cool indigo-violet night, teal-cyan stalks, the one warm accent kept (amber lantern =
  // 暁's lamp glimpsed deep in the grove). Reads unmistakably cooler/bluer than Stage 2's jade.
  s3a: { name:'A · 宵 Indigo', bamboo:true,
    sky:{ top:'#0e1622', mid:'#1f2f52', bot:'#9fb6d6' },
    petal:['#5b6f9e','#46588a','#8fa0c8'], petalEdge:'#b9c6e6', petalAlpha:0.5,
    grove:{ hue:178, glow:['rgba(110,170,210,0.22)','rgba(120,150,200,0.09)','rgba(120,150,200,0)'], lantern:['rgba(255,222,150,0.22)','rgba(255,222,150,0)'], fog:['rgba(196,214,236,0.15)','rgba(196,214,236,0)'] } },
  // B — 暁 Amber Grove: warm dusk/lantern gold. Differentiates from Stage 2 by WARMTH rather than hue-rotation;
  // olive-gold stalks, strong gold horizon core, warm haze. Stays dark + misty.
  s3b: { name:'B · 暁 Amber', bamboo:true,
    sky:{ top:'#141612', mid:'#3a3a1c', bot:'#e6d2a0' },
    petal:['#c9a85e','#b8923f','#e0cf86'], petalEdge:'#f0e0a0', petalAlpha:0.5,
    grove:{ hue:96, glow:['rgba(190,200,110,0.22)','rgba(200,170,90,0.10)','rgba(200,170,90,0)'], lantern:['rgba(255,212,120,0.28)','rgba(255,212,120,0)'], fog:['rgba(228,222,190,0.15)','rgba(228,222,190,0)'] } },
  // C — 二つの月 Moonlit Violet-Silver: desaturated silver-violet moonlight (the "Mirror of Two Moons" boss
  // motif). Cool violet stalks, moon-WHITE horizon core (no gold), silver haze. Eerie, clearly not green.
  s3c: { name:'C · 二月 Moonlit', bamboo:true,
    sky:{ top:'#16121f', mid:'#2e2647', bot:'#cdc6dc' },
    petal:['#9a8fb5','#7d6f9e','#c2b8d6'], petalEdge:'#ddd4ea', petalAlpha:0.5,
    grove:{ hue:255, glow:['rgba(170,160,210,0.20)','rgba(150,150,190,0.08)','rgba(150,150,190,0)'], lantern:['rgba(220,225,255,0.20)','rgba(220,225,255,0)'], fog:['rgba(214,210,228,0.16)','rgba(214,210,228,0)'] } },
  // D — 宵暁 Twin-tone: the literal two-sisters / two-moons split — a cool indigo sky bleeding to a WARM amber
  // horizon glow, cool fog over warm core. Carries both twin identities in one frame; keeps stalks faintly teal.
  s3d: { name:'D · 宵暁 Twin-tone', bamboo:true,
    sky:{ top:'#0d1320', mid:'#243049', bot:'#e8c894' },
    petal:['#7a86ac','#b89a5a','#cdbf86'], petalEdge:'#e6d79a', petalAlpha:0.5,
    grove:{ hue:160, glow:['rgba(255,206,130,0.22)','rgba(210,180,120,0.09)','rgba(210,180,120,0)'], lantern:['rgba(255,200,110,0.26)','rgba(255,200,110,0)'], fog:['rgba(200,210,236,0.14)','rgba(200,210,236,0)'] } },
};

// Button order: references first (for A/B), then the four candidates.
const BUTTONS = [
  { key:'dusk',   label:'Stage 2 ref · Far Shore' },
  { key:'bamboo', label:'Stage 3 now · Grove' },
  { key:'s3a',    label:'A · 宵 Indigo' },
  { key:'s3b',    label:'B · 暁 Amber' },
  { key:'s3c',    label:'C · 二月 Moonlit' },
  { key:'s3d',    label:'D · 宵暁 Twin-tone' },
];

const out = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>stage3-colour-demo — 桜花弾幕</title>
<style>
  html,body{margin:0;min-height:100%;background:#0a0410;font-family:"Trebuchet MS",sans-serif;color:#ffe9fb;-webkit-tap-highlight-color:transparent;}
  #game{display:block;margin:0 auto;}
  #panel{position:fixed;left:8px;top:8px;z-index:10;max-width:300px;background:rgba(16,8,28,0.9);border:1px solid #4b2d72;border-radius:10px;padding:12px 14px;}
  h2{color:#ffd45e;margin:0 0 2px;font-size:16px;} #active{color:#b9ff6a;font-size:13px;margin:0 0 8px;min-height:16px;}
  button{display:block;width:100%;margin:5px 0 0;padding:8px 10px;background:#241338;color:#ffe9fb;border:1px solid #6a4a9a;border-radius:6px;cursor:pointer;font:inherit;font-size:13px;text-align:left;}
  button:hover{background:#3a2358;} button.sel{border-color:#b9ff6a;background:#34234e;}
  .ref{opacity:0.82;border-style:dashed;}
  small{color:#9d83c0;display:block;margin-top:10px;line-height:1.45;font-size:11px;}
</style></head>
<body>
<canvas id="game"></canvas>
<div id="panel"><h2>Stage 3 — grove colour</h2><div id="active">loading…</div><div id="btns"></div>
<small>Click to live-swap the Stage-3 backdrop. Press <b>P</b> to freeze bullets for a clean look. Dashed = reference (Stage 2 / current Stage 3). Player is kept invulnerable.</small></div>
<script>window.__DEMO='theme';</script>
<script>${game}</script>
<script>
(function(){
  var d = window.__dbg, active = document.getElementById('active'), btns = document.getElementById('btns');
  if(!d){ active.textContent='__dbg unavailable (dev hook did not arm)'; return; }
  var CAND = ${JSON.stringify(CANDIDATES)};
  // inject candidate palettes into THEMES (object is mutable even though the binding is const)
  for(var k in CAND){ d.themes[k] = CAND[k]; }
  var BTN = ${JSON.stringify(BUTTONS)};
  var els = {};
  function select(key, label){
    d.setTheme(key);
    active.textContent = '▶ ' + label;
    for(var kk in els){ els[kk].className = (kk===key) ? (CAND[kk]?'sel':'sel ref') : (CAND[kk]?'':'ref'); }
  }
  BTN.forEach(function(b){
    var el = document.createElement('button'); el.textContent = b.label;
    if(!CAND[b.key]) el.className = 'ref';
    el.onclick = function(){ select(b.key, b.label); };
    btns.appendChild(el); els[b.key] = el;
  });
  // keep the player invulnerable so the demo never hits game-over (which would reset the theme to spring)
  setInterval(function(){ try{ if(d.player) d.player.invuln = 1e9; }catch(e){} }, 400);
  // default view: current Stage 3, so the first thing shown is the baseline being compared against
  setTimeout(function(){ select('bamboo','Stage 3 now · Grove'); }, 350);
})();
</script>
</body></html>`;

fs.writeFileSync(path.join(ROOT, 'stage3-demo.html'), out);
console.log('build-stage3-demo: wrote stage3-demo.html (' + out.length + ' bytes).');
