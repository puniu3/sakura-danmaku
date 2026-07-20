// Regression test for the "shooting restarts the BGM" bug.
// Extracts the REAL transport functions from index.html and runs the state
// machine with mocks. Reproduces the bug with the old unlock() and confirms the
// fix (the `&&!pumpTimer` guard) stops the restart-on-every-keydown.
//   node design/test-bgm-unlock.js [path-to-index.html]   (default: ../index.html)
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || (__dirname + '/../index.html'), 'utf8').split('\n');
function grab(name) {
  const re = new RegExp('^\\s*(function ' + name + '\\(.*\\})\\s*$');
  for (const l of src) { const m = l.match(re); if (m) return m[1]; }
  throw new Error('function not found in index.html: ' + name);
}
const FNS = ['tryResume','startPump','stopPump','rampMusic','playMusic','applyMuteToCtx','unlock'].map(grab).join('\n');

function run(useFix) {
  let ctx = null;
  const musicGain = { gain: { value: 0.0001, cancelScheduledValues(){}, setValueAtTime(v){this.value=v;}, exponentialRampToValueAtTime(v){this.value=v;} } };
  let curTrack = 'none', pendingTrack = null, pumpTimer = 0, nextNoteTime = 0, stepIndex = 0, muted = false;
  const MUSIC_FADE = 0.18;
  let pumpRuns = 0;
  const now = () => ctx ? ctx.currentTime : 0;
  const trackOf = () => ({ gain: 0.55 });
  const build = () => { ctx = { currentTime: 0, state: 'running', resume(){ this.state='running'; }, suspend(){ this.state='suspended'; } }; };
  const pump = () => { pumpRuns++; pumpTimer = 1; };            // emulate pumpTimer=setTimeout(...)
  const setTimeout = () => 0;                                   // ignore the deferred-fade callbacks
  let code = FNS;
  if (!useFix) code = code.replace("if(curTrack!=='none'&&!pumpTimer)", "if(curTrack!=='none')");
  eval(code);
  playMusic('stage');                                           // requested before ctx exists
  const afterDefer = { curTrack, pumpTimer, stepIndex };
  unlock();                                                     // first real gesture -> starts pump
  const afterFirst = { curTrack, pumpTimer, stepIndex, pumpRuns };
  stepIndex = 200;                                              // pretend the pump advanced ~12 bars in
  for (let i = 0; i < 8; i++) unlock();                         // OS key-repeat while holding Z (shoot)
  const afterRepeat = { curTrack, pumpTimer, stepIndex, pumpRuns };
  return { afterDefer, afterFirst, afterRepeat };
}

const fix = run(true), old = run(false);
console.log('OLD unlock (buggy):', JSON.stringify(old.afterRepeat));
console.log('NEW unlock (fixed):', JSON.stringify(fix.afterRepeat));
let ok = true;
function assert(c, msg) { if (!c) { ok = false; console.log('  FAIL: ' + msg); } else console.log('  PASS: ' + msg); }
assert(old.afterRepeat.stepIndex === 0, 'old logic RESETS stepIndex to 0 on key-repeat (reproduces the bug)');
assert(fix.afterRepeat.stepIndex === 200, 'fixed logic keeps stepIndex at 200 (no restart on key-repeat)');
assert(fix.afterRepeat.pumpRuns === 1, 'fixed logic does not re-run the pump on key-repeat');
assert(fix.afterFirst.pumpTimer === 1 && fix.afterFirst.stepIndex === 0, 'first unlock still starts playback correctly');
process.exit(ok ? 0 : 1);
