const { capture, BASE } = require('./capture');
const { NO_SCROLL, LAST_ROW_JS, HIDE_VISITORS, forceSecret } = require('./stage');
capture('pixel', {
  async setup({ page }) {
    await page.goto(BASE + '/?jeu=pokemon-pixelise', { waitUntil: 'networkidle' });
    console.log('secret', await forceSecret(page, 94));
    await page.waitForTimeout(1200);
  },
  async run(a) {
    await a.wait(2600);
    for (const g of ['Mewtwo', 'Nidoking', 'Smogogo', 'Spectrum']) { await a.typeGuess(g); await a.wait(1700); }
    a.mark('countdown'); await a.wait(3300);
    await a.typeGuess('Ectoplasma', { delay: 40, pause: 200 });
    a.mark('win'); await a.wait(4000);
  },
}, { h: 1350, dpr: 1.6, q: 68, selectors: ['#pixel-box', '#pixel-sprite', '#guess-input', '#btn-submit', '#results-body > tr:last-child', '#guess-ac'],
     before: async (page, ctx) => { for (const s of [NO_SCROLL, LAST_ROW_JS, HIDE_VISITORS]) await ctx.addInitScript(s); } });
