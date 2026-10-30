const fs = require('fs');
const { capture, BASE } = require('./capture');
const { NO_SCROLL, HIDE_VISITORS } = require('./stage');
async function pickDraw() {
  let best = null;
  for (let i = 0; i < 12; i++) {
    const d = await (await fetch(BASE + '/api/petitbac/solo')).json();
    if (!d.ok) { await new Promise((r) => setTimeout(r, 1500)); continue; }
    const keys = d.categories.map((c) => c.key);
    const chk = await (await fetch(BASE + '/api/petitbac/solo/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ letter: d.letter, keys, answers: keys.map(() => '') }) })).json();
    if (!chk.ok) continue;
    const used = new Set(), ids = [];
    for (const ex of chk.examples) { const id = ex.slice().sort((a, b) => a - b).find((x) => !used.has(x)); if (!id) { ids.length = 0; break; } used.add(id); ids.push(id); }
    if (ids.length !== keys.length) continue;
    const score = ids.reduce((s, id) => s + Math.min(id, 900), 0);
    if (!best || score < best.score) best = { d, ids, score };
    await new Promise((r) => setTimeout(r, 600));
  }
  return best;
}
(async () => {
  const best = await pickDraw();
  fs.mkdirSync('raw', { recursive: true });
  console.log('letter', best.d.letter, best.ids, best.d.categories.map((c) => c.label));
  await capture('bac', {
    async setup({ page }) {
      await page.route('**/api/petitbac/solo?**', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(best.d) }));
      await page.goto(BASE + '/', { waitUntil: 'networkidle' });
      await page.evaluate('openPetitBacMode()'); await page.waitForTimeout(900);
      best.names = await page.evaluate((ids) => ids.map((id) => POKEMON_BY_ID.get(id).name), best.ids);
      console.log('answers', best.names);
    },
    async run(a) {
      const page = a.page;
      await a.wait(2300);
      await a.tap('text=Tirer une lettre', 'draw');
      await page.waitForSelector('#petitbac-sheet input');
      await a.wait(1300);
      for (let i = 0; i < best.names.length; i++) {
        const sel = `#petitbac-sheet input >> nth=${i}`;
        await a.tap(sel, 'focus'); a.mark('field', { i });
        await page.locator(sel).pressSequentially(best.names[i], { delay: 70 });
        a.mark('typed', { i, name: best.names[i] });
        await a.wait(420);
      }
      a.mark('countdown'); await a.wait(3300);
      await a.tap('button:has-text("J’ai fini")', 'submit');
      await page.waitForFunction(() => petitBacState.phase === 'finished', null, { timeout: 10000 });
      a.mark('win'); await a.wait(3500);
      console.log('score', await page.evaluate(() => [petitBacState.score, petitBacState.elapsedMs]));
    },
  }, { h: 1350, dpr: 1.6, q: 68, selectors: ['#petitbac-sheet', '#petitbac-sheet input:focus', '.bac-review', '#petitbac-root'],
       before: async (page, ctx) => { for (const s of [NO_SCROLL, HIDE_VISITORS]) await ctx.addInitScript(s); } });
  fs.writeFileSync('raw/bac/answers.json', JSON.stringify({ letter: best.d.letter, ids: best.ids, names: best.names, labels: best.d.categories.map((c) => c.label) }));
})();
