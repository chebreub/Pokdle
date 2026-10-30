// Spin up a Party Room: one host page + guests in their own contexts (invented nicknames).
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:4173';
async function guestPage(browser, w = 390, h = 800) {
  const c = await browser.newContext({ viewport: { width: w, height: h }, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  await c.route(/cdn\.jsdelivr\.net\/gh\/PokeAPI\/(sprites|cries)@[^/]+\//, (route) => route.continue({ url: route.request().url().replace(/cdn\.jsdelivr\.net\/gh\/PokeAPI\/(sprites|cries)@([^/]+)\//, 'raw.githubusercontent.com/PokeAPI/$1/$2/') }));
  return c.newPage();
}
async function createRoom(host, nick) {
  await host.goto(BASE + '/', { waitUntil: 'networkidle' }); await host.evaluate('openPartyRoomMode()'); await host.waitForTimeout(700);
  await host.fill('#party-nickname', nick); await host.click('[data-action=partyCreateRoom]');
  await host.waitForFunction(() => partyRoomState?.code, null, { timeout: 10000 });
  return host.evaluate(() => partyRoomState.code);
}
async function joinRoom(p, code, nick) {
  await p.goto(BASE + '/', { waitUntil: 'networkidle' }); await p.evaluate('openPartyRoomMode()'); await p.waitForTimeout(400);
  await p.fill('#party-nickname', nick); await p.fill('#party-join-code', code); await p.click('[data-action=partyJoinRoom]');
  await p.waitForFunction(() => partyRoomState?.room, null, { timeout: 10000 });
}
module.exports = { BASE, guestPage, createRoom, joinRoom };
