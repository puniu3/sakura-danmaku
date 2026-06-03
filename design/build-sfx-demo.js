#!/usr/bin/env node
// build-sfx-demo.js — generate sfx-demo.html, a standalone SFX/BGM audition harness.
// Inlines the real game <script> (no code drift) with window.__DEMO set, then adds buttons that fire
// each sfx cue and BGM track through the dev-hook exports. A volume slider drives the master gain.
// (ARCHITECTURE-V2 §5.2; respects MEMORY: no per-frame multi-node cues, sub-150Hz inaudible on iPad.)
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) throw new Error('game <script> not found in index.html');
const game = m[1];

const out = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>sfx-demo — 桜花弾幕</title>
<style>
  html,body{margin:0;height:100%;background:#0a0410;overflow:auto;font-family:"Trebuchet MS",sans-serif;color:#ffe9fb;}
  #wrap{position:fixed;right:8px;bottom:8px;opacity:0.25;}
  #panel{position:relative;z-index:10;max-width:560px;margin:18px auto;background:rgba(16,8,28,0.92);border:1px solid #4b2d72;border-radius:10px;padding:16px 18px;}
  h2{color:#ffd45e;margin:0 0 4px;} h3{color:#b9ff6a;margin:14px 0 4px;font-size:14px;}
  button{margin:4px 5px 0 0;padding:7px 11px;background:#241338;color:#ffe9fb;border:1px solid #6a4a9a;border-radius:6px;cursor:pointer;font:inherit;font-size:12px;}
  button:hover{background:#3a2358;} small{color:#9d83c0;display:block;margin-top:10px;line-height:1.5;}
  label{font-size:12px;color:#cfa8e8;}
</style></head>
<body>
<div id="wrap"><canvas id="game"></canvas></div>
<div id="panel"><h2>SFX / BGM audition</h2><div id="body">loading…</div></div>
<script>window.__DEMO='sfx';</script>
<script>${game}</script>
<script>
(function(){
  var d = window.__dbg, body = document.getElementById('body');
  if(!d){ body.textContent='__dbg unavailable (dev hook did not arm)'; return; }
  function unlock(){ try{ d.audio.unlock(); d.audio.setMuted(false); }catch(e){} }
  body.innerHTML = '';
  var en = document.createElement('button'); en.textContent = '🔊 enable audio'; en.onclick = unlock; body.appendChild(en);

  var sh = document.createElement('h3'); sh.textContent = 'SFX cues'; body.appendChild(sh);
  Object.keys(d.sfx).forEach(function(k){
    if(typeof d.sfx[k] !== 'function') return;
    var b = document.createElement('button'); b.textContent = k;
    b.onclick = function(){ unlock(); try{ d.sfx[k](k); }catch(e){ console.error(e); } };
    body.appendChild(b);
  });

  var bh = document.createElement('h3'); bh.textContent = 'BGM tracks'; body.appendChild(bh);
  ['stage','midboss','boss','none'].forEach(function(t){
    var b = document.createElement('button'); b.textContent = t;
    b.onclick = function(){ unlock(); d.audio.playMusic(t); };
    body.appendChild(b);
  });

  var s = document.createElement('small');
  s.textContent = 'Cues call the real Audio module (no drift). Tune cue params in index.html (Audio IIFE), rebuild, and A/B here before shipping. BGM is authored in design/bgm-tracks.js (use bgm-demo.html for music itself).';
  body.appendChild(s);
})();
</script>
</body></html>`;

fs.writeFileSync(path.join(ROOT, 'sfx-demo.html'), out);
console.log('build-sfx-demo: wrote sfx-demo.html (' + out.length + ' bytes).');
