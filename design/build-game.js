#!/usr/bin/env node
// build-game.js — re-inline the generated BGM region (and, later, CONTENT data) into index.html.
// Replaces the retired integrate-game.js, whose anchors went stale once index.html became the
// multi-section build. This tool OWNS the region between the self-generated anchors:
//
//     /*BGM:GEN*/  …engine + tracks…  /*END:BGM:GEN*/   <- bgm-engine.js + bgm-tracks.js
//
// The hand-written transport (trackOf/pump/startPump/playMusic/…/facade) lives OUTSIDE the
// anchors and is NOT touched here. Track edits (new TRACKS entries in bgm-tracks.js) flow into
// index.html through this region — see ARCHITECTURE-V2 §5.3.
//
// Usage:
//   node design/build-game.js          # re-inline (writes index.html, backs up index.html.bak)
//   node design/build-game.js --check  # verify the current region == freshly-built region (exit 1 on drift)
//   --index <path>    target html (default: index.html; backup then goes NEXT TO the target)
//   --engine <path>   engine source (default: design/bgm-engine.js)
'use strict';
const fs = require('fs');
const path = require('path');

const D = __dirname, ROOT = path.join(D, '..');
const argVal = f => { const i = process.argv.indexOf(f); return (i >= 0 && process.argv[i + 1]) ? process.argv[i + 1] : null; };
const INDEX = argVal('--index') ? path.resolve(argVal('--index')) : path.join(ROOT, 'index.html');
const ENGINE = argVal('--engine') ? path.resolve(argVal('--engine')) : path.join(D, 'bgm-engine.js');
const BAK = argVal('--index') ? INDEX + '.bak' : path.join(D, 'index.html.bak');
const read = p => fs.readFileSync(p, 'utf8');

const BGM_START = '  /*BGM:GEN*/\n';
const BGM_END = '  /*END:BGM:GEN*/';
const TRACKS_VALIDATION_MARKER = '// ---------------------------------------------------------------- validation (Node only)';

// Build the canonical BGM:GEN region content from the two source files.
function buildBgmRegion() {
  const engine = read(ENGINE);
  let tracks = read(path.join(D, 'bgm-tracks.js'));
  const cut = tracks.indexOf(TRACKS_VALIDATION_MARKER);
  if (cut < 0) throw new Error('bgm-tracks.js validation marker not found (do not rename it)');
  tracks = tracks.slice(0, cut).trimEnd() + '\n';
  return engine + '\n' + tracks;
}

// Locate the [start,end) span of the current region between the anchors.
function regionSpan(html) {
  const i = html.indexOf(BGM_START);
  if (i < 0) throw new Error('BGM_START anchor not found: ' + BGM_START.trim());
  if (html.indexOf(BGM_START, i + 1) >= 0) throw new Error('BGM_START anchor not unique');
  const a = i + BGM_START.length;
  const j = html.indexOf(BGM_END, a);
  if (j < 0) throw new Error('BGM_END anchor not found: ' + BGM_END.trim());
  return { start: a, end: j };
}

function main() {
  const check = process.argv.includes('--check');
  const region = buildBgmRegion();
  const html = read(INDEX);
  const { start, end } = regionSpan(html);
  const current = html.slice(start, end);

  if (check) {
    if (current === region) { console.log('build-game --check: BGM:GEN region is in sync (' + region.length + ' bytes).'); return; }
    console.error('build-game --check: BGM:GEN region DRIFTED from bgm-engine.js + bgm-tracks.js.');
    for (let k = 0; k < Math.min(current.length, region.length); k++) {
      if (current[k] !== region[k]) { console.error('  first diff at offset ' + k + '\n    index: ' + JSON.stringify(current.slice(k - 30, k + 30)) + '\n    src  : ' + JSON.stringify(region.slice(k - 30, k + 30))); break; }
    }
    if (current.length !== region.length) console.error('  length differs: index=' + current.length + ' src=' + region.length);
    process.exit(1);
  }

  if (current === region) { console.log('build-game: BGM:GEN already in sync; nothing to write.'); return; }
  fs.writeFileSync(BAK, html);
  const out = html.slice(0, start) + region + html.slice(end);
  fs.writeFileSync(INDEX, out);
  console.log('build-game: re-inlined BGM:GEN (' + region.length + ' bytes); backup at ' + BAK + '; ' + INDEX + ' now ' + out.length + ' bytes.');
}

main();
