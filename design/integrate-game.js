// Surgically swap the old 2-bar-loop BGM (STAGE_TRACK/BOSS_TRACK + scheduleStep
// + pump + playMusic) in index.html's Audio IIFE for the new multi-section engine
// + composed tracks. Generated from the same source files as the demo, so they
// stay in sync. Idempotent-ish via unique anchors; asserts loudly on mismatch.
const fs = require('fs');
const path = require('path');
const D = __dirname, ROOT = path.join(D, '..');
const read = p => fs.readFileSync(p, 'utf8');

const engine = read(path.join(D, 'bgm-engine.js'));
let tracks = read(path.join(D, 'bgm-tracks.js'));
const cut = tracks.indexOf('// ---------------------------------------------------------------- validation (Node only)');
if (cut < 0) throw new Error('tracks validation marker not found');
tracks = tracks.slice(0, cut).trimEnd() + '\n';

let html = read(path.join(ROOT, 'index.html'));

function spliceBetween(src, startAnchor, endAnchor, replacement) {
  const i = src.indexOf(startAnchor);
  const j = src.indexOf(endAnchor);
  if (i < 0) throw new Error('start anchor not found: ' + startAnchor);
  if (j < 0) throw new Error('end anchor not found: ' + endAnchor);
  if (src.indexOf(startAnchor, i + 1) >= 0) throw new Error('start anchor not unique: ' + startAnchor);
  if (j <= i) throw new Error('end anchor before start anchor');
  return src.slice(0, i) + replacement + src.slice(j);
}

const trackOfLine = '  function trackOf(n){ return (TRACKS && TRACKS[n]) ? TRACKS[n] : null; }\n';
const newPump = '  function pump(){ if(!ctx) return; const trk=trackOf(curTrack); if(trk){ const C=compile(trk); while(nextNoteTime<ctx.currentTime+SCHEDULE_AHEAD){ scheduleTrackStep(C, musicGain, stepIndex%C.totalSteps, nextNoteTime); stepIndex++; nextNoteTime+=C.step16; } } pumpTimer=setTimeout(pump,PUMP_MS); }\n';

const block =
  '  // ---- BGM ENGINE (generated from design/bgm-engine.js + design/bgm-tracks.js; rebuild via design/integrate-game.js) ----\n' +
  engine + '\n' + tracks + '\n' + trackOfLine + newPump + '\n  ';

html = spliceBetween(html, '  const STAGE_TRACK={', '  function startPump(){', block);

const newPlayMusic =
  "  function playMusic(name){ if(name!=='stage'&&name!=='midboss'&&name!=='boss'&&name!=='none') return; if(!ctx){ curTrack=name; return; } if(name===curTrack) return; if(name==='none'){ rampMusic(0.0001,MUSIC_FADE); setTimeout(()=>{ if(curTrack==='none') stopPump(); },(MUSIC_FADE+0.3)*1000); curTrack='none'; return; } const trk=trackOf(name); const target=(trk&&trk.gain)?trk.gain:0.55; if(curTrack==='none'){ curTrack=name; stepIndex=0; startPump(); rampMusic(target,MUSIC_FADE); } else { rampMusic(0.0001,MUSIC_FADE); setTimeout(()=>{ curTrack=name; stepIndex=0; if(ctx) nextNoteTime=ctx.currentTime+0.04; rampMusic(target,MUSIC_FADE); },MUSIC_FADE*1000); } }\n";

html = spliceBetween(html, '  function playMusic(name){', '  function applyMuteToCtx(){', newPlayMusic);

if (html.includes('STAGE_TRACK') || html.includes('scheduleStep(trk')) throw new Error('old symbols still present after splice');

fs.writeFileSync(path.join(ROOT, 'index.html'), html);
console.log('integrated. index.html now ' + html.length + ' bytes');
