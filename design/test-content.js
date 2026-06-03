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

console.log('test-content.js — Phase 0 stub');

const html = fs.readFileSync(INDEX, 'utf8');
check('index.html exists and is non-empty', html.length > 1000);
check('index.html is a single-file artifact (one <script>)', (html.match(/<script>/g) || []).length === 1);

// --- placeholder framing for assertions added in later phases ---
// (Phase 6) BGM splice round-trip: re-injecting the generated region yields byte-identical output.
// (Phase 7) CONTENT region: src/content build output === /*BUILD:CONTENT*/…/*END:CONTENT*/ slice.
// (Phase 8) save migration: migrate(v1-int) preserves the hi-score under hiByDiff.normal.
// (Phase 9) every $ref resolves; every wave/theme/spell id is defined.

if (failures) { console.error('\n' + failures + ' check(s) failed.'); process.exit(1); }
console.log('\nAll Phase 0 checks passed.');
