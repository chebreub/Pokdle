const fs = require('fs');
const { chromium } = require('playwright');
const { capture } = require('./capture');
const { NO_SCROLL, HIDE_VISITORS } = require('./stage');
const { guestPage, createRoom, joinRoom } = require('./party-lib');
// Combo de types in a Party Room: Sacha (filmed) against two invented friends.
// Plan per round: who finds it first. Round 2 starts with a wrong try, round 3 is lost to Ondine.
const PLAN = ['host', 'host-wrong', 'ondine', 'host', 'host'];
let gb, g1, g2;
const answersFor = (page) => page.evaluate(() => {
  const ty = partyRoomState.room.round.types, key = [ty[0], ty[1] || ty[0]].sort().join('|');
  const ok = POKEMON_LIST.filter((p) => !p.isAltForm && p.id < 10000 && [p.type1, p.type2 || p.type1].sort().join('|') === key).sort((a, b) => a.id - b.id).map((p) => p.name);
  const near = POKEMON_LIST.filter((p) => !p.isAltForm && p.id < 400 && (p.type1 === ty[0] || p.type2 === ty[0]) && [p.type1, p.type2 || p.type1].sort().join('|') !== key).map((p) => p.name);
  return { ty, ok, near };
});
const log = [];
capture('combo', {
  async setup({ page }) {
    const code = await createRoom(page, 'Sacha');
    gb = await chromium.launch(); g1 = await guestPage(gb); g2 = await guestPage(gb);
    await joinRoom(g1, code, 'Ondine'); await joinRoom(g2, code, 'Pierre');
    await page.click('[data-action=partySetMode][data-args=\'["typecombo"]\']'); await page.waitForTimeout(800);
  },
  async run(a) {
    const page = a.page;
    await a.wait(2300); a.mark('lobby'); await a.wait(1200);
    await a.tap('[data-action=partyStartGame]', 'start');
    for (let r = 0; r < 5; r++) {
      await page.waitForFunction((n) => partyRoomState.room.status === 'playing' && partyRoomState.room.roundNumber === n, r + 1, { timeout: 15000 });
      const ans = await answersFor(page); log.push({ r: r + 1, ...ans, plan: PLAN[r] });
      a.mark('round', { r: r + 1, types: ans.ty });
      await a.wait(1100);
      if (PLAN[r] === 'ondine') {
        await a.tap('#party-guess', 'focus');
        const typing = page.locator('#party-guess').pressSequentially(ans.ok[0].slice(0, 5), { delay: 160 });
        await new Promise((res) => setTimeout(res, 500));
        await g1.fill('#party-guess', ans.ok[0]); await g1.click('#party-submit-btn'); a.mark('rival', { who: 'Ondine' });
        await typing.catch(() => {});
      } else {
        if (PLAN[r] === 'host-wrong' && ans.near[0]) {
          await a.tap('#party-guess', 'focus'); await page.locator('#party-guess').pressSequentially(ans.near[0], { delay: 70 });
          await a.wait(250); await a.tap('#party-submit-btn', 'wrong'); await a.wait(900);
          await page.fill('#party-guess', '');
        }
        await a.tap('#party-guess', 'focus'); await page.locator('#party-guess').pressSequentially(ans.ok[0], { delay: 70 });
        await a.wait(250); await a.tap('#party-submit-btn', 'submit');
      }
      await page.waitForFunction(() => partyRoomState.room.status !== 'playing', null, { timeout: 15000 });
      a.mark('roundEnd', { r: r + 1 });
      await a.wait(1700);
      if (r < 4) { await a.tap('#party-next-btn', 'next').catch(async () => { await page.evaluate('partyNextRound()'); }); }
    }
    a.mark('final'); await a.wait(3800);
    log.push({ scores: await page.evaluate(() => partyRoomState.room.players.map((p) => [p.nickname, p.score])) });
  },
}, { h: 1350, dpr: 1.6, q: 68, selectors: ['#party-round', '#party-players', '#party-guess', '#party-lobby', '#party-mode-select', '#party-room-code', '#party-box', '#party-next-btn'],
     before: async (page, ctx) => { for (const s of [NO_SCROLL, HIDE_VISITORS]) await ctx.addInitScript(s); } })
  .then(async () => { fs.writeFileSync('raw/combo/plan.json', JSON.stringify(log, null, 1)); console.log(JSON.stringify(log.at(-1))); await gb.close(); });
