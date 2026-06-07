#!/usr/bin/env node
// test-content.js — content/integration regression gate for 桜花弾幕 (ARCHITECTURE-V2 §2.3/§6).
//
// STATUS: Phase 0 stub. The byte-identical CONTENT-region assert and the save-migration
// unit test are filled in as the matching phases land (Phase 6: BGM splice round-trip;
// Phase 7: CONTENT region; Phase 8: save migration; Phase 9: balance/$ref resolution).
//
// Run:  node design/test-content.js   (exits non-zero on failure)
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');

let failures = 0;
function check(name, cond, detail) {
  if (cond) { console.log('  ok   ' + name); }
  else { failures++; console.log('  FAIL ' + name + (detail ? '  — ' + detail : '')); }
}

console.log('test-content.js — content/integration gate');

const html = fs.readFileSync(INDEX, 'utf8');
check('index.html exists and is non-empty', html.length > 1000);
check('index.html is a single-file artifact (one <script>)', (html.match(/<script>/g) || []).length === 1);

// (Phase 6) anchors present + BGM splice round-trip is byte-identical.
check('BGM:GEN anchors present', html.indexOf('/*BGM:GEN*/') >= 0 && html.indexOf('/*END:BGM:GEN*/') >= 0);
check('CONTENT anchors present', html.indexOf('/*BUILD:CONTENT*/') >= 0 && html.indexOf('/*END:CONTENT*/') >= 0);
check('playMusic uses the trackOf whitelist (not a hardcoded name list)',
  /function playMusic\(name,restart\)\{ if\(name!=='none' && !trackOf\(name\)\) return;/.test(html));
try {
  require('child_process').execFileSync('node', [path.join(__dirname, 'build-game.js'), '--check'], { stdio: 'pipe' });
  check('BGM:GEN region in sync with bgm-engine.js + bgm-tracks.js (build-game --check)', true);
} catch (e) {
  check('BGM:GEN region in sync with bgm-engine.js + bgm-tracks.js (build-game --check)', false, 'build-game --check exited non-zero');
}

// (Phase 8) save migration unit test: extract the real migrateSave() source and exercise it with a
// stub localStorage. Guards the "returning players never lose their hi-score" property.
(function testMigration() {
  const m = html.match(/function migrateSave\(old\)\{[\s\S]*?return s; \}/);
  if (!m) { check('migrateSave() source extractable', false); return; }
  check('migrateSave() source extractable', true);
  function makeStub(v1) { return { getItem: k => (k === 'danmaku_hiscore_v1' ? v1 : null) }; }
  let migrateSave;
  try {
    migrateSave = new Function('localStorage', 'HISCORE_KEY', m[0] + '; return migrateSave;')(makeStub(null), 'danmaku_hiscore_v1');
  } catch (e) { check('migrateSave() evaluable', false, '' + e); return; }
  // fresh player, no prior save, legacy v1 int present -> folds into hiByDiff.normal
  const fromV1 = new Function('localStorage', 'HISCORE_KEY', m[0] + '; return migrateSave;')(makeStub('123456'), 'danmaku_hiscore_v1')(null);
  check('migrate(v1 int) -> hiByDiff.normal', fromV1.ver === 2 && fromV1.hiByDiff.normal === 123456);
  // already-v2 with a higher normal is not lowered by an older v1
  const keepHigher = new Function('localStorage', 'HISCORE_KEY', m[0] + '; return migrateSave;')(makeStub('100'), 'danmaku_hiscore_v1')({ ver: 2, hiByDiff: { easy: 0, normal: 9999, hard: 0, lunatic: 0 } });
  check('migrate never lowers an existing hi-score', keepHigher.hiByDiff.normal === 9999);
  // no data at all -> clean v2 shell
  const empty = migrateSave(null);
  check('migrate(null) -> clean v2 shell', empty.ver === 2 && empty.hiByDiff.normal === 0 && typeof empty.lastName === 'string');
})();
check('pool.shrink API present', /shrink\(toCap\)\{/.test(html));
check('run spine present (startRun/enterStage/advanceStage)', /function startRun\(/.test(html) && /function enterStage\(/.test(html) && /function advanceStage\(/.test(html));

// (Phase 9) BALANCE master table + difficulty resolution + registries + demo builders.
check('BALANCE.difficulties present (4 tiers)',
  /const BALANCE = \{[\s\S]*?difficulties:\s*\{[\s\S]*?easy:[\s\S]*?normal:[\s\S]*?hard:[\s\S]*?lunatic:/.test(html));
check('resolveWave/resolveBoss are identity at normal (mul===1 short-circuit)',
  /function resolveWave\([\s\S]*?if\(D\.countMul===1\) return opts;/.test(html) &&
  /function resolveBoss\([\s\S]*?if\(D\.hpMul===1\) return spec;/.test(html));
check('content registries present (WAVES / SPELLS / BOSSES / STAGES)',
  /const WAVES = \{/.test(html) && /const SPELLS = \{/.test(html) && /const BOSSES = \{/.test(html) && /const STAGES = \[/.test(html));
for (const b of ['build-theme-demo.js', 'build-sfx-demo.js', 'build-balance-demo.js']) {
  check('demo builder design/' + b + ' present', fs.existsSync(path.join(__dirname, b)));
}

if (failures) { console.error('\n' + failures + ' check(s) failed.'); process.exit(1); }
console.log('\nAll checks passed.');
