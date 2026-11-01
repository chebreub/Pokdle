// « 3 Pokémon pixelisés » (01/11/2026): three real games of the pixel mode, filmed on the local site.
// a: Absol on a phone (one wrong guess, then found), b: Trousselin on a PC (1920 × 1200, so the box to type in stays in view), c: Lanssorien on a
// phone (one wrong guess, never found: the viewers answer in the comments). Typing at 165 ms a letter.
const V = require('path').join(__dirname, '..') + '/';
const { capture, BASE } = require(V + 'capture');
const { HIDE_VISITORS, NO_SCROLL, LAST_ROW_JS, forceSecret, css } = require(V + 'stage');
// Every generation, so the summary reads « Toutes » and a Gen 8 answer is allowed; no popups on top.
const ALL_GENS = `try{localStorage.setItem('pokedle_generations_v1','[1,2,3,4,5,6,7,8,9]');localStorage.setItem('pokedle_generation_picked_v1','1');localStorage.setItem('pokedle_generation_hint_v1','1')}catch(e){}`;
const QUIET = css('html body #guess-ac.ac-list,#generation-hint,.achc,.lvc-back,.lvc,.xp-toast,#xp-toast-stack,.achievement-toast{display:none!important}');
// Absol on the phone: the clue row is hidden so the box to type in stays on screen for the answer.
const NO_ROWS = css('html body #results-wrap.results-wrap,html body #results-wrap #results-table{display:none!important}');
const OPT = (pc, sel, more = []) => ({ ...(pc ? { w: 1920, h: 1200, dpr: 1 } : { w: 390, h: 844, dpr: 2.5 }), q: 85, selectors: sel,
  before: async (page, ctx) => { for (const s of [ALL_GENS, HIDE_VISITORS, NO_SCROLL, LAST_ROW_JS, QUIET, ...more]) await ctx.addInitScript(s); } });
const go = async (page) => { await page.goto(BASE + '/?jeu=pokemon-pixelise', { waitUntil: 'networkidle' }); await page.waitForTimeout(900); await page.keyboard.press('Escape'); await page.waitForTimeout(600); };
async function typeGuess(a, g) {
  const inp = a.page.locator('#guess-input');
  a.mark('focus'); await inp.focus(); await inp.fill('');
  for (const ch of g) { a.mark('key'); await a.page.keyboard.type(ch); await a.wait(165); }
  await a.wait(420); a.mark('submit', { g }); await inp.press('Enter');
}
const game = (name, pc, id, guesses, end, more) => capture(name, {
  async setup({ page }) {
    await go(page);
    // Filming only: no level-up card over the answer.
    await page.evaluate(() => { window.celebrateLevelUp = () => {}; try { celebrateLevelUp = () => {}; } catch (e) {} });
    console.log(name, 'secret', await forceSecret(page, id)); await page.waitForTimeout(1500);
  },
  async run(a) {
    await a.wait(1600);
    for (const g of guesses) { await typeGuess(a, g); await a.wait(1500); a.mark('level', { level: await a.page.evaluate(() => document.getElementById('pixel-level').textContent) }); await a.wait(900); }
    if (end) { await typeGuess(a, end); a.mark('win'); await a.wait(2600); } else await a.wait(2500);
  },
}, OPT(pc, ['#pixel-box', '#pixel-sprite', '#guess-input', '#results-body > tr:last-child'], more));
const M = {
  a: () => game('pix3-a', false, 359, ['Mangriff'], 'Absol', [NO_ROWS]),
  b: () => game('pix3-b', true, 707, ['Magnéti'], 'Trousselin'),
  c: () => game('pix3-c', false, 887, ['Dracolosse'], null),
};
(async () => { for (const m of process.argv.slice(2)) await M[m](); })();
