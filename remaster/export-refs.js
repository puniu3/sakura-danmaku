// Export procedural references from remaster/index.html?ref=<name>&size=768 into remaster/refs/.
// Canvas-element screenshots via playwright-core (exact wxh crop; re-renders after fonts.ready so
// the title's embedded kanji font is live). Usage: node export-refs.js [name ...]
const path = require('path');
const pw = require('/home/puniu/compose/node_modules/playwright-core');
const SHELL = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-linux64/chrome-headless-shell';
const OUT = path.join(__dirname, 'refs');
const ALL = [
  'scenery_spring_ground','scenery_spring_canopy0','scenery_spring_canopy1','scenery_spring_canopy2',
  'scenery_spring_lantern','scenery_spring_stream',
  'player_free','player_focus','enemy_body','items','title',
  'boss_wisp_disc','boss_mandala_ring0','boss_mandala_ring1','boss_mandala_ring2','boss_mandala_ring3',
  'boss_mandala_ring4','boss_mandala_core','boss_mizuchi_head','boss_twin_body',
];
(async () => {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
  const browser = await pw.chromium.launch({ executablePath: SHELL });
  const page = await browser.newPage({ viewport: { width: 1700, height: 1000 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  for (const name of names) {
    await page.goto(`http://127.0.0.1:8026/remaster/index.html?ref=${name}&size=768`, { waitUntil: 'load' });
    await page.evaluate(async () => { await document.fonts.ready; });
    // re-render now that fonts are guaranteed live (renderRefPage drew once at boot)
    await page.evaluate(() => {
      const q = new URLSearchParams(location.search);
      renderRefPage(q.get('ref'), parseInt(q.get('size') || '768', 10));
    });
    const el = await page.$('#game');
    const out = path.join(OUT, `${name}.ref.png`);
    await el.screenshot({ path: out });
    const dims = await page.evaluate(() => { const c = document.getElementById('game'); return c.width + 'x' + c.height; });
    console.log(`${name}.ref.png  canvas=${dims}  pageerrors=${errs.length}`);
    errs.length = 0;
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
