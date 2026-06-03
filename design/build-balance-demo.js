#!/usr/bin/env node
// build-balance-demo.js — generate balance-demo.html, a self-contained difficulty-tuning playground.
// Extracts the BALANCE literal from index.html (no game code needed) and renders, per difficulty, the
// knobs as live sliders plus sample resolved values (wave count, boss HP, bullet speed) so a tuner can
// see what each multiplier does before editing index.html. (ARCHITECTURE-V2 §6 — balance-demo)
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const m = html.match(/const BALANCE = (\{[\s\S]*?\n\});/);
if (!m) throw new Error('BALANCE literal not found in index.html');
const balanceLiteral = m[1];

const out = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>balance-demo — 桜花弾幕</title>
<style>
  body{margin:0;background:#0a0410;color:#ffe9fb;font-family:"Trebuchet MS",sans-serif;padding:18px;}
  h2{color:#ffd45e;} table{border-collapse:collapse;margin-top:10px;width:100%;max-width:760px;}
  th,td{border:1px solid #4b2d72;padding:6px 9px;text-align:center;font-size:13px;}
  th{color:#b9ff6a;background:#1a0e2a;} .diff{color:#ffd45e;font-weight:bold;}
  input[type=range]{width:120px;vertical-align:middle;} .v{color:#cfa8e8;font-size:12px;}
  .res{color:#74e0ff;} small{color:#9d83c0;display:block;margin-top:14px;max-width:760px;line-height:1.5;}
</style></head>
<body>
<h2>BALANCE — difficulty tuning</h2>
<p class="v">Sample bases: wave n = <b>10</b>, boss HP = <b>2000</b>, bullet speed = <b>120</b>. Resolved = base × multiplier.</p>
<div id="tbl"></div>
<small>This mirrors the live BALANCE.difficulties from index.html. Sliders are a what-if preview only — to ship a change, edit the BALANCE table in index.html (CONTENT DATA) and reload the game. resolveWave scales count, resolveBoss scales phase HP; speed scaling is reserved for per-wave spd hooks.</small>
<script>
const BALANCE = ${balanceLiteral};
const BASE = { n:10, hp:2000, spd:120 };
const tbl = document.getElementById('tbl');
function render(){
  var diffs = Object.keys(BALANCE.difficulties);
  var h = '<table><tr><th>difficulty</th><th>countMul</th><th>spdMul</th><th>hpMul</th><th>lives</th><th>bombs</th><th>→ n / hp / spd</th></tr>';
  diffs.forEach(function(k){
    var D = BALANCE.difficulties[k];
    function sl(prop){ return '<input type="range" min="0.5" max="2" step="0.01" value="'+D[prop]+'" data-d="'+k+'" data-p="'+prop+'"> <span class="v" id="v_'+k+'_'+prop+'">'+D[prop].toFixed(2)+'</span>'; }
    var n = Math.max(1,Math.round(BASE.n*D.countMul)), hp = Math.round(BASE.hp*D.hpMul), spd = Math.round(BASE.spd*D.spdMul);
    h += '<tr><td class="diff">'+k+'</td><td>'+sl('countMul')+'</td><td>'+sl('spdMul')+'</td><td>'+sl('hpMul')+'</td><td>'+D.lives+'</td><td>'+D.bombs+'</td>'
      + '<td class="res" id="res_'+k+'">'+n+' / '+hp+' / '+spd+'</td></tr>';
  });
  h += '</table>';
  tbl.innerHTML = h;
  tbl.querySelectorAll('input[type=range]').forEach(function(inp){
    inp.oninput = function(){ var k=inp.dataset.d, p=inp.dataset.p; BALANCE.difficulties[k][p]=+inp.value;
      document.getElementById('v_'+k+'_'+p).textContent=(+inp.value).toFixed(2);
      var D=BALANCE.difficulties[k];
      document.getElementById('res_'+k).textContent = Math.max(1,Math.round(BASE.n*D.countMul))+' / '+Math.round(BASE.hp*D.hpMul)+' / '+Math.round(BASE.spd*D.spdMul);
    };
  });
}
render();
</script>
</body></html>`;

fs.writeFileSync(path.join(ROOT, 'balance-demo.html'), out);
console.log('build-balance-demo: wrote balance-demo.html (' + out.length + ' bytes).');
