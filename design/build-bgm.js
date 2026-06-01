// Build step: inline the BGM engine + composed tracks into the demo harness.
// Usage: node design/build-bgm.js   ->  writes /bgm-demo.html
const fs = require('fs');
const path = require('path');
const D = __dirname, ROOT = path.join(D, '..');

function read(p) { return fs.readFileSync(p, 'utf8'); }

const tpl = read(path.join(D, 'bgm-demo.tpl.html'));
const engine = read(path.join(D, 'bgm-engine.js'));
let tracks = read(path.join(D, 'bgm-tracks.js'));

// strip the Node-only validation + export tail from the tracks file
const cut = tracks.indexOf('// ---------------------------------------------------------------- validation (Node only)');
if (cut >= 0) tracks = tracks.slice(0, cut).trimEnd() + '\n';

const out = tpl
  .replace('/* __BGM_ENGINE__ */', () => engine)
  .replace('/* __BGM_TRACKS__ */', () => tracks);

fs.writeFileSync(path.join(ROOT, 'bgm-demo.html'), out);
console.log('built bgm-demo.html  (' + out.length + ' bytes)');
