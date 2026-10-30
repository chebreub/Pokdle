// Dessine-le ! filmed on a computer and a phone at once: Léa draws on PC, Tom guesses on his phone, Sam (not filmed) chats.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const V = path.join(__dirname, '..') + '/';
const { HIDE_VISITORS, css } = require(V + 'stage');
const RAW = V + 'raw/', BASE = 'http://127.0.0.1:4173/';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const PAL = ['#2E2A33', '#8E8A93', '#E8453C', '#FF9F43', '#FFD45C', '#5DBE7E', '#4069E0', '#7C5BD6', '#FFFFFF', '#F1D3B3', '#8E2240', '#8A5A3C', '#FFF1A8', '#2F7D4F', '#7CC8F2', '#FF8FC1'];
(async () => {
  const b = await chromium.launch();
  const mk = async (w, h, dpr, mobile) => {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
    await ctx.route(/cdn\.jsdelivr\.net\/gh\/PokeAPI\/(sprites|cries)@[^/]+\//, (route) => route.continue({ url: route.request().url().replace(/cdn\.jsdelivr\.net\/gh\/PokeAPI\/(sprites|cries)@([^/]+)\//, 'raw.githubusercontent.com/PokeAPI/$1/$2/') }));
    await ctx.addInitScript(HIDE_VISITORS + css('#generation-hint{display:none!important}'));
    const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('pageerror', e.message));
    await p.goto(BASE, { waitUntil: 'networkidle' }); await p.evaluate(() => openPartyRoomMode()); await p.waitForTimeout(400); return { p, ctx };
  };
  const A = await mk(1280, 800, 1.5, false), B = await mk(390, 844, 2.5, true), C = await mk(1100, 800, 1, false);
  await A.p.fill('#party-nickname', 'Léa'); await A.p.evaluate(() => partyCreateRoom()); await wait(800);
  const code = await A.p.evaluate(() => partyRoomState.code);
  for (const [x, n] of [[B, 'Tom'], [C, 'Sam']]) { await x.p.fill('#party-nickname', n); await x.p.fill('#party-join-code', code); await x.p.evaluate(() => partyJoinRoom()); await wait(700); }
  await A.p.evaluate(() => partySetMode('dessin')); await wait(500);
  await A.p.evaluate(() => partyStartGame()); await wait(1000);
  await A.p.click('.dessin-option >> nth=0'); await wait(900);
  const secret = await A.p.evaluate(() => partyRoomState.room.round.secret);
  console.log('secret', secret.id, secret.name);
  if (![175, 39, 174, 132, 100, 54, 25, 143, 113, 440, 79, 60, 183, 194, 202, 35, 172, 7, 1, 52, 133].includes(secret.id)) { await b.close(); process.exit(3); }
  const art = path.join(V, 'assets', 'art-' + secret.id + '.png');
  if (!fs.existsSync(art)) execFileSync('curl', ['-sf', '-o', art, `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${secret.id}.png`]);
  const D = JSON.parse(execFileSync('python3', [path.join(__dirname, 'contour.py'), art, JSON.stringify(PAL)]).toString());
  await B.p.evaluate(() => document.getElementById('party-dessin').scrollIntoView({ block: 'start' })); await A.p.evaluate(() => { const r = document.getElementById('party-dessin').getBoundingClientRect(); window.scrollBy(0, r.top - 20); });
  await wait(500);
  // two screencasts sharing one clock
  const cams = [];
  for (const [x, name, mw, mh] of [[A, 'promo-party-pc', 1920, 1200], [B, 'promo-party-b', 975, 2110]]) {
    const dir = RAW + name; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    const cdp = await x.ctx.newCDPSession(x.p), cam = { dir, cdp, frames: [], writing: Promise.resolve() };
    cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => { cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {}); if (t0 == null) return; const t = metadata.timestamp - t0; if (t < 0) return; const file = String(cam.frames.length).padStart(5, '0') + '.jpg'; cam.frames.push({ t, file }); cam.writing = cam.writing.then(() => fs.promises.writeFile(path.join(dir, file), Buffer.from(data, 'base64'))); });
    cam.vp = x === A ? { w: 1280, h: 800, dpr: 1.5 } : { w: 390, h: 844, dpr: 2.5 }; cam.mw = mw; cam.mh = mh; cams.push(cam);
  }
  let t0 = Date.now() / 1000; const events = [], now = () => Date.now() / 1000 - t0, mark = (type, extra = {}) => events.push({ t: now(), type, ...extra });
  for (const c of cams) await c.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 80, everyNthFrame: 1, maxWidth: c.mw, maxHeight: c.mh });
  // a frame keeps coming even when nothing moves: the clocks on screen tick
  const box = await A.p.locator('#party-dessin-canvas').boundingBox();
  const side = Math.min(box.width, box.height) * .96; const P = ([x, y]) => [box.x + box.width / 2 + (x - 500) / 1000 * side, box.y + box.height / 2 + (y - 500) / 1000 * side];
  const jit = (i) => Math.sin(i * 1.7) * 4;
  const line = async (pts) => { await A.p.mouse.move(...P(pts[0])); await A.p.mouse.down(); for (let i = 1; i < pts.length; i++) await A.p.mouse.move(...P([pts[i][0] + jit(i), pts[i][1] + jit(i + 3)]), { steps: 3 }); await A.p.mouse.up(); await wait(40); };
  const say = (text) => C.p.evaluate((text) => partyChatSend({ text }), text);
  await wait(700); mark('draw');
  await A.p.evaluate(() => partyDessinTool('size', 1));
  const half = Math.floor(D.outline.length / 2);
  await line(D.outline.slice(0, half + 1));
  mark('chat1'); await say('c’est quoi ce truc 😂');
  await line(D.outline.slice(half));
  await A.p.evaluate(() => partyDessinTool('size', 2));
  for (const d of D.details.slice(0, 12)) await line([d, [d[0] + 3, d[1] + 3]]);
  mark('fill'); await A.p.evaluate((c) => { partyDessinTool('color', c); partyDessinTool('fill'); }, D.color); await A.p.mouse.click(...P(D.fill)); await wait(500);
  const guess = async (name) => { const inp = B.p.locator('#party-guess'); await inp.focus(); await wait(300); for (const ch of name) { mark('key'); await B.p.keyboard.type(ch); await wait(165); } await wait(650); mark('submit'); await B.p.evaluate(() => partySubmitAnswer()); };
  mark('wrong'); await guess(secret.id === 133 ? 'Pikachu' : 'Évoli'); await wait(900);
  mark('chat2'); await say('t’es nul Tom 😭'); await wait(1100);
  mark('right'); await guess(secret.name); await wait(2600);
  mark('end');
  for (const c of cams) { await c.cdp.send('Page.stopScreencast'); await c.writing; }
  const canvasB = await B.p.locator('#party-dessin-canvas').boundingBox().catch(() => null);
  for (const c of cams) fs.writeFileSync(path.join(c.dir, 'index.json'), JSON.stringify({ frames: c.frames, events, rects: [], duration: now(), viewport: c.vp, secret, canvasA: box, canvasB }, null, 1));
  console.log('frames', cams.map((c) => c.frames.length), 'dur', now().toFixed(1), events.map((e) => e.type + '@' + e.t.toFixed(1)).join(' '));
  await b.close();
})();
