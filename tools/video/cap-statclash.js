const { capture, BASE } = require('./capture');
const { NO_SCROLL, HIDE_VISITORS, SHIFT } = require('./stage');
// Bo3 vs the bot, no handicap rules. Draws are fixed so the story reads well:
// the bot leads, then Leveinard's 250 HP (kept for last) turns it round.
const DRAWS = [321, 20010, 113];
const MINE = ['attack', 'spAttack', 'hp'];
const BOT = ['hp', 'attack', 'spDefense'];
capture('statclash', {
  async setup({ page }) {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.evaluate('openStatClashMode()'); await page.waitForTimeout(800);
    await page.evaluate(() => { const c = document.querySelector('input[data-change-action=toggleStatClashHouseRule]'); if (c.checked) { c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); } });
    await page.waitForTimeout(300);
    await page.evaluate(() => { const s = document.querySelector('select[data-change-action=statClashFormatFromEl]'); s.value = 'bo3'; s.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.waitForTimeout(400);
    await page.evaluate(() => { const b = document.querySelector('.stat-clash-board').getBoundingClientRect(); const cur = parseFloat(getComputedStyle(document.body).top) || 0; document.body.style.setProperty('top', (cur - b.top + 24) + 'px', 'important'); });
    console.log('vp', await page.evaluate(() => [innerWidth, innerHeight, devicePixelRatio, JSON.stringify(document.querySelector('.stat-clash-board').getBoundingClientRect())]));
    console.log('rules', await page.evaluate(() => [statClashState.houseRuleEnabled, statClashState.format]));
    await page.waitForTimeout(500);
    await page.evaluate((ids) => {
      const queue = ids.slice();
      window.pickStatClashRoundPokemon = pickStatClashRoundPokemon = async () => {
        const p = statClashState.pool.find((x) => x.id === queue[0]) || POKEMON_LIST.find((x) => x.id === queue[0]); queue.shift();
        const stats = await fetchBattleStats(p); statClashState.usedPokemonIds.push(p.id); return { pokemon: p, stats };
      };
    }, DRAWS);
    await page.waitForTimeout(600);
  },
  async run(a) {
    const page = a.page;
    await a.wait(1600);
    await a.tap('.stat-clash-board button:has-text("Lancer vs bot")', 'launch');
    for (let r = 0; r < 3; r++) {
      const sel = `[data-action=pickStatClashStat][data-args='["left","${MINE[r]}"]']`;
      await page.waitForFunction((s) => { const b = document.querySelector(s); return b && !b.disabled && statClashState.phase === 'picking'; }, sel, { timeout: 20000 });
      a.mark('picking', { round: r + 1 });
      await a.wait(1300);
      await a.tap(sel, 'pick');
      await a.wait(700);
      await page.evaluate((k) => { pickStatClashStat('right', k); maybeResolveLocalStatClashRound(); renderStatClashScreen(); }, BOT[r]);
      a.mark('botpick', { round: r + 1 });
      await page.waitForFunction(() => statClashState.phase !== 'picking', null, { timeout: 10000 });
      a.mark('reveal', { round: r + 1 });
    }
    await page.waitForFunction(() => statClashState.phase === 'finished', null, { timeout: 20000 });
    a.mark('finished'); await a.wait(3500);
    console.log('score', await page.evaluate(() => [statClashState.players.left.score, statClashState.players.right.score]));
  },
}, { w: 1280, h: 800, dpr: 1.75, q: 80, selectors: ['.stat-clash-board', '.stat-clash-center-card', '.stat-clash-board > :first-child', '.stat-clash-board > :last-child', '.stat-clash-versus-overlay'],
     before: async (page, ctx) => { for (const s of [NO_SCROLL, HIDE_VISITORS]) await ctx.addInitScript(s); } });
