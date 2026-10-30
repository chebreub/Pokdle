const { capture, BASE } = require('./capture');
const { NO_SCROLL, HIDE_VISITORS } = require('./stage');
// Ronflex(G1) -> Ninjask(G3) -> Amphinobi(G6) -> Mimiqui(G7) -> Wailord(G3) -> Carchacrok
const IDS = [143, 291, 658, 778, 321, 445];
const STATS = ['speed', 'spAttack', 'hp', 'defense', 'attack'];
const CHOICES = ['higher', 'higher', 'lower', 'lower'];
capture('hl', {
  async setup({ page }) {
    await page.goto(BASE + '/?jeu=higher-or-lower-pokemon', { waitUntil: 'networkidle' });
    await page.evaluate(({ IDS, STATS }) => {
      const META = { hp: ['PV', '❤️'], attack: ['Attaque', '⚔️'], defense: ['Défense', '🛡️'], spAttack: ['Atk. Spé.', '✨'], speed: ['Vitesse', '💨'] };
      window.pickHigherLowerPokemonWithStats = async (ex) => { const id = ex ? IDS[higherLowerState.score + 1] : IDS[0]; const p = POKEMON_LIST.find((x) => x.id === id); return { pokemon: p, stats: await fetchBattleStats(p) }; };
      window.pickHigherLowerStat = () => { const k = STATS[higherLowerState.score] || 'hp'; return { key: k, label: META[k][0], icon: META[k][1] }; };
      for (const id of IDS) fetchBattleStats(POKEMON_LIST.find((x) => x.id === id));
    }, { IDS, STATS });
    await page.waitForTimeout(1500);
    await page.click('[data-action=startHigherLowerMode][data-args=\'["infinite"]\']');
    await page.waitForSelector('.higher-lower-btn-higher');
    await page.waitForTimeout(800);
  },
  async run(a) {
    await a.wait(2400);
    for (let i = 0; i < CHOICES.length; i++) {
      if (i === CHOICES.length - 1) { a.mark('countdown'); await a.wait(3400); } else await a.wait(1300);
      a.mark('answer' + i);
      await a.tap(CHOICES[i] === 'higher' ? '.higher-lower-btn-higher' : '.higher-lower-btn-lower');
      await a.wait(i === CHOICES.length - 1 ? 1700 : 2300);
    }
    a.mark('win'); await a.wait(1500);
  },
}, { h: 1350, dpr: 1.6, q: 68, selectors: ['.higher-lower-scoreline', '.higher-lower-stat-banner', '.higher-lower-pair', '.higher-lower-card-pokemon.side-left', '.higher-lower-card-pokemon.side-right', '.higher-lower-actions', '.higher-lower-feedback', '.higher-lower-board'],
     before: async (page, ctx) => { for (const s of [NO_SCROLL, HIDE_VISITORS]) await ctx.addInitScript(s); } });
