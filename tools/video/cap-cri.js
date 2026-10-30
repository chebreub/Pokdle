const { capture, BASE } = require('./capture');
const { NO_SCROLL, LAST_ROW_JS, HIDE_VISITORS, forceSecret } = require('./stage');
capture('cri', {
  async setup({ page }) {
    await page.goto(BASE + '/?jeu=cri-pokemon', { waitUntil: 'networkidle' });
    console.log('secret', await forceSecret(page, 54));
    await page.waitForTimeout(1200);
  },
  async run(a) {
    await a.wait(2300);
    await a.tap('#cry-play-btn', 'cry'); await a.wait(2600);
    await a.typeGuess('Akwakwak'); await a.wait(2200);
    await a.tap('#cry-play-btn', 'cry'); await a.wait(2000);
    a.mark('countdown'); await a.wait(3300);
    await a.typeGuess('Psykokwak', { delay: 40, pause: 200 });
    a.mark('win'); await a.wait(4000);
  },
}, { h: 1350, dpr: 1.6, q: 68, selectors: ['#cry-box', '#cry-play-btn', '#guess-input', '#btn-submit', '#results-body > tr:last-child', '#guess-ac'],
     before: async (page, ctx) => { for (const s of [NO_SCROLL, LAST_ROW_JS, HIDE_VISITORS]) await ctx.addInitScript(s); } });
