const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:4173';
async function open({ w = 432, h = 768, dpr = 2.5, video } = {}) {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--force-device-scale-factor=' + dpr] });
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Paris', colorScheme: 'light', reducedMotion: 'no-preference' });
  const failed = [];
  await ctx.route(/cdn\.jsdelivr\.net\/gh\/PokeAPI\/(sprites|cries)@[^/]+\//, (route) => {
    const u = route.request().url().replace(/cdn\.jsdelivr\.net\/gh\/PokeAPI\/(sprites|cries)@([^/]+)\//, 'raw.githubusercontent.com/PokeAPI/$1/$2/');
    route.continue({ url: u });
  });
  ctx.on('requestfailed', (r) => failed.push(r.url()));
  const page = await ctx.newPage();
  return { browser, ctx, page, failed };
}
module.exports = { open, BASE };
