#!/usr/bin/env node
// build-remaster-bgm.js — build remaster/bgm2-demo.html (audition harness for the
// remaster engine) from design/bgm-demo.tpl.html, splicing remaster/bgm-engine2.js
// + the unchanged design/bgm-tracks.js data. Mirrors design/build-bgm.js.
// Also injects window.__bgm2 test hooks: the tpl's audio state (ctx/analyser/
// curTrack/...) is script-scoped, not on window — headless verification needs them.
'use strict';
const fs = require('fs');
const path = require('path');

const D = __dirname;                 /* remaster/ */
const ROOT = path.join(D, '..');     /* bullet/ */
const read = p => fs.readFileSync(p, 'utf8');

const tpl = read(path.join(ROOT, 'design', 'bgm-demo.tpl.html'));
const engine = read(path.join(D, 'bgm-engine2.js'));
let tracks = read(path.join(ROOT, 'design', 'bgm-tracks.js'));

const MARK = '// ---------------------------------------------------------------- validation (Node only)';
const cut = tracks.indexOf(MARK);
if (cut < 0) throw new Error('bgm-tracks.js validation marker not found (do not rename it)');
tracks = tracks.slice(0, cut).trimEnd() + '\n';

const HOOK = 'window.__bgm2={get ctx(){return ctx},get analyser(){return analyser},get masterGain(){return masterGain},' +
  'get musicGain(){return musicGain},get curTrack(){return curTrack},' +
  'get stepIndex(){return stepIndex},set stepIndex(v){stepIndex=v},' +
  'trackOf:trackOf,compile:compile,scheduleTrackStep:scheduleTrackStep,playMusic:playMusic,now:now};\n';

let out = tpl
  .replace('/* __BGM_ENGINE__ */', () => engine)
  .replace('/* __BGM_TRACKS__ */', () => tracks)
  .replace('BGM Audition Harness', 'BGM Audition Harness — REMASTER engine2');
if (!out.includes('</script>')) throw new Error('tpl missing </script>');
out = out.replace('</script>', HOOK + '</script>');

fs.writeFileSync(path.join(D, 'bgm2-demo.html'), out);
console.log('built remaster/bgm2-demo.html  (' + out.length + ' bytes)');
