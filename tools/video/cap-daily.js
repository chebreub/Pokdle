const fs = require('fs');
const { capture, BASE } = require('./capture');
const { NO_SCROLL, LAST_ROW_JS, HIDE_VISITORS, rowStatus } = require('./stage');
const statuses = [];
capture('daily', {
  async setup({ page }) {
    await page.goto(BASE + '/?jeu=pokemon-du-jour', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800); await page.keyboard.press('Escape'); await page.waitForTimeout(800);
  },
  async run(a) {
    await a.wait(2600);
    for (const g of ['Pikachu', 'Machopeur', 'Scarhino', 'Carchacrok']) { await a.typeGuess(g); await a.wait(1900); statuses.push({ g, cells: await rowStatus(a.page) }); }
    a.mark('countdown'); await a.wait(3300);
    await a.typeGuess('Lucario', { delay: 40, pause: 200 });
    a.mark('win'); await a.wait(1500); statuses.push({ g: 'Lucario', cells: await rowStatus(a.page) }); await a.wait(2500);
  },
}, { h: 1350, dpr: 1.6, q: 68, selectors: ['#guess-input', '#btn-submit', '#results-body > tr:last-child', '#guess-ac', '#daily-notebook'],
     before: async (page, ctx) => { for (const s of [NO_SCROLL, LAST_ROW_JS, HIDE_VISITORS]) await ctx.addInitScript(s); } })
  .then(() => fs.writeFileSync('raw/daily/statuses.json', JSON.stringify(statuses, null, 1)));
