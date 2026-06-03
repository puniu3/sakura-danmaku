#!/usr/bin/env node
// build-theme-demo.js — generate theme-demo.html, a standalone theme audition harness.
// Inlines the real game <script> (so there is zero code drift) with window.__DEMO set, then adds a
// control overlay that flips THEMES via the dev-hook export. The title screen renders the themed
// sky / petals / scenery live, so clicking a theme re-paints the whole palette. (ARCHITECTURE-V2 §5.1)
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
<title>theme-demo — 桜花弾幕</title>
<style>
  html,body{margin:0;height:100%;background:#0a0410;overflow:hidden;font-family:"Trebuchet MS",sans-serif;}
  #wrap{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 30%,#1a0e2a,#070310 70%);}
  #panel{position:fixed;top:8px;left:8px;z-index:10;background:rgba(16,8,28,0.86);border:1px solid #4b2d72;border-radius:8px;padding:10px 12px;color:#ffe9fb;font-size:13px;max-width:240px;}
  #panel b{color:#ffd45e;}
  #panel button{display:inline-block;margin:4px 4px 0 0;padding:5px 9px;background:#241338;color:#ffe9fb;border:1px solid #6a4a9a;border-radius:6px;cursor:pointer;font:inherit;font-size:12px;}
  #panel button:hover{background:#3a2358;}
  #panel small{color:#9d83c0;display:block;margin-top:8px;line-height:1.4;}
</style></head>
<body>
<div id="wrap"><canvas id="game"></canvas></div>
<div id="panel">loading…</div>
<script>window.__DEMO='theme';</script>
<script>${game}</script>
<script>
(function(){
  var d = window.__dbg, p = document.getElementById('panel');
  if(!d){ p.textContent='__dbg unavailable (dev hook did not arm)'; return; }
  p.innerHTML = '<b>THEMES</b> — click to apply<br>';
  Object.keys(d.themes).forEach(function(k){
    var b = document.createElement('button');
    b.textContent = k + (d.themes[k].name ? ' · ' + d.themes[k].name : '');
    b.onclick = function(){ d.setTheme(k); };
    p.appendChild(b);
  });
  var s = document.createElement('small');
  s.textContent = 'The title screen renders the live themed sky / petals / scenery. Add THEMES entries in index.html, rebuild, and audition them side by side here.';
  p.appendChild(s);
})();
</script>
</body></html>`;

fs.writeFileSync(path.join(ROOT, 'theme-demo.html'), out);
console.log('build-theme-demo: wrote theme-demo.html (' + out.length + ' bytes).');
