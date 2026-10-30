// One still of the home page on a computer and on a phone, for the end card.
const fs = require('fs');
const V = require('path').join(__dirname, '..') + '/';
const { open, BASE } = require(V + 'common');
const { HIDE_VISITORS, css } = require(V + 'stage');
const RAW = V + 'raw/';
(async () => {
  for (const [name, w, h, dpr] of [['promo-home-pc', 1280, 800, 1.5], ['promo-home-ph', 390, 844, 2.5]]) {
    const { browser, ctx, page } = await open({ w, h, dpr });
    await ctx.addInitScript(HIDE_VISITORS + css('#generation-hint{display:none!important}'));
    await page.goto(BASE + '/', { waitUntil: 'networkidle' }); await page.waitForTimeout(1500); await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    fs.rmSync(RAW + name, { recursive: true, force: true }); fs.mkdirSync(RAW + name, { recursive: true });
    await page.screenshot({ path: RAW + name + '/00000.jpg', type: 'jpeg', quality: 88 });
    fs.writeFileSync(RAW + name + '/index.json', JSON.stringify({ frames: [{ t: 0, file: '00000.jpg' }], events: [], rects: [], duration: 1, viewport: { w, h, dpr } }));
    await browser.close();
  }
})();
