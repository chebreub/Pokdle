const fs = require('fs');
const { chromium } = require('playwright');
const { capture } = require('./capture');
const { NO_SCROLL, HIDE_VISITORS } = require('./stage');
const { guestPage, createRoom, joinRoom } = require('./party-lib');
// Course au Pokédex, gen 1, duel: Sacha (filmed) and Ondine (invented) both pick all over the grid.
let gb, g1, names, guestDone = false, claimed = new Set();
capture('race', {
  async setup({ page }) {
    const code = await createRoom(page, 'Sacha');
    gb = await chromium.launch(); g1 = await guestPage(gb, 1280, 800); await joinRoom(g1, code, 'Ondine');
    await page.click('[data-action=partySetMode][data-args=\'["dexrace"]\']'); await page.waitForTimeout(500);
    await page.click('[data-action=setDexRaceDuration][data-args="[0]"]').catch(() => {});
    names = await page.evaluate(() => POKEMON_LIST.filter((p) => !p.isAltForm && p.id >= 1 && p.id <= 151).sort((a, b) => a.id - b.id).map((p) => p.name));
    await page.waitForTimeout(500);
  },
  async run(a) {
    const page = a.page;
    await a.wait(2300); a.mark('lobby'); await a.wait(1300);
    a.mark('start'); await page.evaluate('partyStartGame()');
    await page.waitForFunction(() => partyRoomState.room.status === 'playing', null, { timeout: 10000 });
    await a.wait(900); a.mark('go');
    const hostInput = page.locator('input:visible').first(), gInput = g1.locator('input:visible').first();
    // One shuffled order, dealt alternately: both players claim cases spread over the whole grid.
    let seed = 11; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const order = names.slice(); for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const mine = order.filter((_, i) => i % 2 === 0), theirs = order.filter((_, i) => i % 2 === 1);
    let lo = 0, hi = names.length - 1;
    const guest = (async () => {
      await new Promise((r) => setTimeout(r, 700));
      for (const n of theirs) { await gInput.fill(n); await gInput.press('Enter'); await new Promise((r) => setTimeout(r, 1760)); }
      guestDone = true; hi = -1;
    })();
    let count = 0;
    for (const n of mine) {
      lo++; const t0 = Date.now(); await hostInput.pressSequentially(n, { delay: 45 }); await hostInput.press('Enter'); count++; await new Promise((r) => setTimeout(r, Math.max(0, 1640 - (Date.now() - t0))));
      if (await page.evaluate(() => (partyRoomState.room.round?.claims || []).length) >= 138 && !a.cdMarked) { a.cdMarked = true; a.mark('countdown'); }
    }
    await guest;
    await page.waitForFunction(() => partyRoomState.room.status !== 'playing', null, { timeout: 15000 }).catch(() => {});
    a.mark('win'); await a.wait(3500);
    console.log('scores', await page.evaluate(() => partyRoomState.room.players.map((p) => [p.nickname, p.score])), 'status', await page.evaluate(() => partyRoomState.room.status));
  },
}, { w: 1280, h: 800, dpr: 1.4, q: 62, selectors: ['.party-race-board, [class*=race-board]', 'input:focus', '#party-room-code', '#party-mode-select', '#party-players'],
     before: async (page, ctx) => { for (const s of [NO_SCROLL, HIDE_VISITORS]) await ctx.addInitScript(s); } })
  .then(async () => { await gb.close(); });
