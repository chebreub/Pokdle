const V = require('path').join(__dirname, '..') + '/';
const { capture, BASE } = require(V + 'capture');
const { HIDE_VISITORS } = require(V + 'stage');
capture('promo-daily', {
  async setup({ page }) {
    await page.goto(BASE + '/?jeu=pokemon-du-jour', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800); await page.keyboard.press('Escape'); await page.waitForTimeout(800);
  },
  async run(a) {
    await a.wait(1200);
    const inp = a.page.locator('#guess-input');
    for (const g of (process.env.G || 'Pikachu,Lucario,Amphinobi').split(',')) {
      await a.tap('#guess-input', 'focus'); await a.wait(350);
      for (const ch of g) { a.mark('key'); await inp.press(ch === ' ' ? 'Space' : ch); await a.wait(165); }
      await a.wait(650); await a.tap('#btn-submit', 'submit'); a.mark('guess', { g }); await a.wait(2800);
    }
    await a.wait(1000);
  },
}, { w: 390, h: 844, dpr: 2.5, q: 80, selectors: ['#guess-input', '#results-body > tr:first-child', '#results-body > tr:first-child .dir-pill', '#results-body > tr:last-child .dir-pill'],
     before: async (page, ctx) => { await ctx.addInitScript(HIDE_VISITORS); } });
