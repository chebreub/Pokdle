const V = require('path').join(__dirname, '..') + '/';
const { capture, BASE } = require(V + 'capture');
const { HIDE_VISITORS: HV, NO_SCROLL, LAST_ROW_JS, forceSecret, css } = require(V + 'stage');
const HIDE_VISITORS = HV + css('#generation-hint{display:none!important}');
const OPT = (sel, more = [], base = [HIDE_VISITORS, NO_SCROLL]) => ({ w: 390, h: 844, dpr: 2.5, q: 80, selectors: sel, before: async (page, ctx) => { for (const s of [...base, ...more]) await ctx.addInitScript(s); } });
const go = async (page, slug) => { await page.goto(BASE + '/?jeu=' + slug, { waitUntil: 'networkidle' }); await page.waitForTimeout(900); await page.keyboard.press('Escape'); await page.waitForTimeout(600); };
const M = {
  shiny: () => capture('promo-shiny', {
    async setup({ page }) { await go(page, 'shiny-ou-normal'); await page.evaluate(async () => { const ids = [609, 384, 700, 373]; await Promise.all(ids.flatMap((id) => ['', 'shiny/'].map((v) => new Promise((r) => { const i = new Image(); i.onload = i.onerror = r; i.src = 'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/other/official-artwork/' + v + id + '.png'; })))); shinyPool = ids; restartShinyGame(); }); await page.waitForTimeout(1500); },
    async run(a) {
      for (let i = 0; i < 3; i++) {
        await a.wait(1100);
        const shiny = await a.page.evaluate(() => shinyState.round.shiny);
        await a.tap(`[data-action=answerShiny][data-args='["${shiny ? 'shiny' : 'normal'}"]']`, 'answer');
        await a.wait(1700); a.mark('next'); await a.page.evaluate(() => nextShinyRound());
      }
      await a.wait(600);
    },
  }, OPT(['.shiny-stage'])),
  qui: () => capture('promo-qui', {
    async setup({ page }) { await go(page, 'qui-est-ce-pokemon'); await page.waitForTimeout(800); },
    async run(a) {
      for (let i = 0; i < 3; i++) { await a.wait(1300); a.mark('ask'); await a.page.locator('.qui-question:not([disabled])').first().dispatchEvent('click'); }
      await a.wait(1600);
    },
  }, OPT(['.qui-grid, [class*=qui-grid]'])),
  pixel: () => capture('promo-pixel', {
    async setup({ page }) { await go(page, 'pokemon-pixelise'); await forceSecret(page, 149); await page.waitForTimeout(1500); },
    async run(a) {
      const inp = a.page.locator('#guess-input');
      await a.wait(900);
      for (const g of ['Ectoplasma', 'Dracaufeu', 'Dracolosse']) { a.mark('focus'); await inp.focus(); await inp.fill(''); await inp.pressSequentially(g, { delay: 60 }); await a.wait(250); await inp.press('Enter'); a.mark('submit', { g }); await a.wait(1500); }
      a.mark('win'); await a.wait(2300);
    },
  }, OPT(['#pixel-box', '#guess-input'], [LAST_ROW_JS])),
  hl: () => capture('promo-hl', {
    async setup({ page }) {
      await go(page, 'higher-or-lower-pokemon');
      const IDS = [143, 291, 658, 778, 321];
      await page.evaluate((IDS) => {
        window.pickHigherLowerPokemonWithStats = async (ex) => { const id = ex ? IDS[higherLowerState.score + 1] : IDS[0]; const p = POKEMON_LIST.find((x) => x.id === id); return { pokemon: p, stats: await fetchBattleStats(p) }; };
        window.pickHigherLowerStat = () => ({ key: 'speed', label: 'Vitesse', icon: '💨' });
        for (const id of IDS) fetchBattleStats(POKEMON_LIST.find((x) => x.id === id));
      }, IDS);
      await page.waitForTimeout(1500);
      await page.click('[data-action=startHigherLowerMode][data-args=\'["infinite"]\']'); await page.waitForSelector('.higher-lower-btn-higher'); await page.waitForTimeout(800);
    },
    async run(a) {
      for (const c of ['higher', 'lower', 'higher']) { await a.wait(1200); await a.tap(c === 'higher' ? '.higher-lower-btn-higher' : '.higher-lower-btn-lower', 'answer'); await a.wait(1500); }
      await a.wait(500);
    },
  }, OPT(['.higher-lower-board'], [], [HIDE_VISITORS])),
};
(async () => { for (const m of process.argv.slice(2)) await M[m](); })();
