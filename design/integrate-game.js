#!/usr/bin/env node
// DEPRECATED (Phase 6, ARCHITECTURE-V2 §5.3). Replaced by design/build-game.js.
//
// This was a one-shot migration that spliced the multi-section BGM engine+tracks into index.html
// using the anchor `  const STAGE_TRACK={`, which no longer exists in the file (the current BGM is
// already the multi-section build). Re-running it threw "start anchor not found" and, worse, its
// inlined `pump` predated the hand-applied "holding shoot restarts BGM" fix — so it would have
// reverted that fix.
//
// The replacement, build-game.js, owns a self-generated region delimited by /*BGM:GEN*/ …
// /*END:BGM:GEN*/ and re-inlines bgm-engine.js + bgm-tracks.js there (with a --check round-trip
// gate run by test-content.js). The hand-written transport stays outside the anchors.
'use strict';
console.error('integrate-game.js is deprecated — use:  node design/build-game.js  (or --check).');
process.exit(1);
