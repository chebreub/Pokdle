// Stills of the real pixel mode at a chosen sharpness, one per Pokémon (filming-only staging, nothing changes in the repo).
const { open, BASE } = require('./common');
const { NO_SCROLL, HIDE_VISITORS, LAST_ROW_JS, forceSecret } = require('./stage');
const QUIZ = [[94, 2], [448, 1], [658, 1], [778, 1], [291, 1]];
const WRONG = ['Rattata', 'Roucool', 'Chenipan', 'Aspicot', 'Abo', 'Nosferapti'];
(async () => {
  const { browser, ctx, page } = await open({ w: 432, h: 1350, dpr: 2.5 });
  for (const s of [NO_SCROLL, HIDE_VISITORS, LAST_ROW_JS]) await ctx.addInitScript(s);
  for (let i = 0; i < QUIZ.length; i++) {
    const [id, level] = QUIZ[i];
    await page.goto(BASE + '/?jeu=pokemon-pixelise', { waitUntil: 'networkidle' });
    console.log('secret', await forceSecret(page, id));
    let k = 0;
    for (; k < level - 1; k++) { await page.fill('#guess-input', WRONG[k]); await page.waitForTimeout(250); await page.click('#btn-submit'); await page.waitForTimeout(700); }
    for (let step = 0; step < 3; step++) {
      if (step) { await page.fill('#guess-input', WRONG[k++]); await page.waitForTimeout(250); await page.click('#btn-submit'); await page.waitForTimeout(700); }
      await page.waitForTimeout(900);
      await page.locator('#pixel-sprite').screenshot({ path: `assets/q5b-${i + 1}-${step}.png` });
      console.log(i + 1, step, await page.evaluate(() => document.getElementById('pixel-level').textContent));
    }
  }
  await browser.close();
})();
