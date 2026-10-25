'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const move = require('../lib/site-move');

const SITE = 'https://pokdle.fr', OLD = 'https://pokdle.onrender.com';

// A raw request: fetch() may not set Host or Sec-Fetch-Mode, browsers and Render do.
function request(base, method, path, headers = {}, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(base + path, { method, headers }, (res) => {
      let text = '';
      res.on('data', (chunk) => { text += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }));
    });
    req.on('error', reject);
    if (body) req.end(body); else req.end();
  });
}
async function server(t, options = {}) {
  const app = express();
  app.set('trust proxy', 1);
  const siteMove = move.mountSiteMove(app, { express, siteUrl: SITE, legacyOrigin: OLD, ...options });
  app.get('/', (req, res) => {
    const moved = siteMove.takeTransfer(req, res);
    res.type('html').send(moved ? move.injectTransfer('<html><head></head><body>app</body></html>', moved) : 'app');
  });
  app.get('/jeux/:slug', (_req, res) => res.send('page'));
  app.post('/api/feedback', (_req, res) => res.json({ ok: true }));
  const listener = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => listener.once('listening', resolve));
  t.after(() => listener.close());
  return { base: 'http://127.0.0.1:' + listener.address().port, siteMove };
}
const old = { host: 'pokdle.onrender.com' }, site = { host: 'pokdle.fr' };
const navigate = { 'sec-fetch-mode': 'navigate' };
const setCookies = (res) => (res.headers['set-cookie'] || []).map((line) => line.split(';')[0]);

test('the old address sends every page to the same page on pokdle.fr; open tabs and the transfer page keep working', async (t) => {
  const { base } = await server(t);
  const page = await request(base, 'GET', '/jeux/quiz-pokemon?x=1', { ...old, ...navigate });
  assert.deepEqual([page.status, page.headers.location], [301, SITE + '/jeux/quiz-pokemon?x=1']);
  // Search engines see the plain home page; a browser carries the mark that starts the transfer.
  assert.equal((await request(base, 'GET', '/', old)).headers.location, SITE + '/');
  assert.equal((await request(base, 'GET', '/', { ...old, ...navigate })).headers.location, SITE + '/?depuis=onrender');
  assert.equal((await request(base, 'GET', '/?room=AB12', { ...old, ...navigate })).headers.location, SITE + '/?room=AB12&depuis=onrender');
  assert.equal((await request(base, 'GET', '/index.html', { ...old, ...navigate })).headers.location, SITE + '/?depuis=onrender');
  assert.equal((await request(base, 'GET', '/', { host: 'www.pokdle.fr' })).headers.location, SITE + '/');

  assert.equal((await request(base, 'POST', '/api/feedback', old)).status, 200);
  assert.equal((await request(base, 'GET', '/socket.io/?EIO=4', old)).status, 404, 'not redirected');
  assert.equal((await request(base, 'GET', '/googled8d0a3d4583f5db3.html', old)).status, 404, 'Search Console keeps verifying the old property');
  const transfer = await request(base, 'GET', '/transfert?n=x', old);
  assert.equal(transfer.status, 200);
  assert.match(transfer.text, /data-site="https:\/\/pokdle\.fr"/);
  assert.match(transfer.text, /<script src="\/transfert\.js" defer><\/script>/);
  assert.equal(transfer.headers['x-robots-tag'], 'noindex');
  assert.equal((await request(base, 'GET', '/transfert.js', old)).status, 200);

  // pokdle.fr itself and local development are never redirected.
  assert.equal((await request(base, 'GET', '/jeux/quiz-pokemon', site)).text, 'page');
  assert.equal((await request(base, 'GET', '/jeux/quiz-pokemon')).text, 'page');
});

test('a browser coming from the old home page fetches its progress there once, then keeps it here', async (t) => {
  const { base } = await server(t);
  const arrive = await request(base, 'GET', '/?room=AB12&depuis=onrender', site);
  assert.equal(arrive.status, 302);
  const nonceCookie = setCookies(arrive).find((c) => c.startsWith(move.NONCE_COOKIE + '='));
  const nonce = nonceCookie.split('=')[1];
  assert.equal(arrive.headers.location, OLD + '/transfert?n=' + nonce + '&retour=' + encodeURIComponent('/?room=AB12'));
  assert.match(arrive.headers['set-cookie'].join(), /HttpOnly/);

  // On the old address: its localStorage and its cookies, for a one-time token.
  const json = { ...old, 'content-type': 'application/json', origin: OLD, cookie: 'pokdle_session=jwt.abc; pokdle_daily=g1; other=x' };
  const body = JSON.stringify({ nonce, data: { pokedle_stats_v1: '{"wins":12}', pokedexRecentIds: '[25]', 'bad key!': 'x', pokedle_profile_v1: 3 } });
  const sent = JSON.parse((await request(base, 'POST', '/api/transfert', json, body)).text);
  assert.ok(sent.ok && sent.token);

  // Back here: someone else's token or no nonce cookie gets nothing.
  assert.equal((await request(base, 'GET', '/?transfert=' + sent.token, { ...site, cookie: move.NONCE_COOKIE + '=' + 'x'.repeat(32) })).text, 'app');
  const second = JSON.parse((await request(base, 'POST', '/api/transfert', json, body)).text);
  const back = await request(base, 'GET', '/?room=AB12&transfert=' + second.token, { ...site, cookie: nonceCookie + '; pokdle_daily=already-here' });
  assert.equal(back.headers['cache-control'], undefined, 'the test app leaves caching to server.js');
  const holder = back.text.match(/<script type="application\/json" id="pokedle-transfert">(.*?)<\/script>/);
  assert.deepEqual(JSON.parse(holder[1]), { pokedle_stats_v1: '{"wins":12}', pokedexRecentIds: '[25]' });
  const cookies = setCookies(back);
  assert.ok(cookies.includes('pokdle_session=jwt.abc'), 'the account stays signed in');
  assert.ok(!cookies.some((c) => c.startsWith('pokdle_daily=')), 'a cookie this address already has is kept');
  assert.ok(cookies.includes(move.DONE_COOKIE + '=1'));
  assert.ok(cookies.includes(move.NONCE_COOKIE + '='), 'the nonce is cleared');
  assert.equal((await request(base, 'GET', '/?transfert=' + second.token, { ...site, cookie: nonceCookie })).text, 'app', 'a token works once');

  // Next visits from the old address go straight to the page.
  const again = await request(base, 'GET', '/?room=AB12&depuis=onrender', { ...site, cookie: move.DONE_COOKIE + '=1' });
  assert.deepEqual([again.status, again.headers.location], [302, '/?room=AB12']);
});

test('the transfer refuses other sites, bad input and floods', async (t) => {
  const { base, siteMove } = await server(t);
  const json = { ...old, 'content-type': 'application/json' };
  const nonce = 'n'.repeat(32);
  assert.equal((await request(base, 'POST', '/api/transfert', { ...json, origin: 'https://evil.example' }, JSON.stringify({ nonce, data: {} }))).status, 403);
  assert.equal((await request(base, 'POST', '/api/transfert', json, JSON.stringify({ nonce: 'short', data: {} }))).status, 400);
  assert.equal((await request(base, 'POST', '/api/transfert', json, JSON.stringify({ nonce, data: [] }))).status, 400);
  const many = Object.fromEntries(Array.from({ length: 301 }, (_, i) => ['k' + i, 'v']));
  assert.equal((await request(base, 'POST', '/api/transfert', json, JSON.stringify({ nonce, data: many }))).status, 400);
  for (let i = 0; i < 500; i++) siteMove.store.set('t' + i, { expires: Date.now() + 60000, bytes: 0 });
  assert.equal((await request(base, 'POST', '/api/transfert', json, JSON.stringify({ nonce, data: {} }))).status, 503);
});

test('tokens expire after 15 minutes and the page data cannot close its tag', () => {
  let now = 0;
  const siteMove = move.createSiteMove({ siteUrl: SITE, legacyOrigin: OLD, now: () => now });
  const res = { json() {}, set() {}, status() { return this; }, cookie() {}, clearCookie() {} };
  let token;
  res.json = (body) => { token = body.token; };
  siteMove.receive({ get: () => undefined, body: { nonce: 'n'.repeat(32), data: { a: '1' } }, headers: {} }, res);
  now += 15 * 60000;
  assert.equal(siteMove.takeTransfer({ query: { transfert: token }, get: () => 'pokdle.fr', headers: { cookie: move.NONCE_COOKIE + '=' + 'n'.repeat(32) } }, res), null);
  assert.equal(move.injectTransfer('<head></head>', { a: '</script><script>alert(1)</script>' }),
    '<head><script type="application/json" id="pokedle-transfert">{"a":"\\u003c/script>\\u003cscript>alert(1)\\u003c/script>"}</script>\n</head>');
});

test('one address gets 20 transfers per 15 minutes', () => {
  let now = 0;
  const siteMove = move.createSiteMove({ siteUrl: SITE, legacyOrigin: OLD, now: () => now });
  const codes = [];
  const res = { set() {}, json() { codes.push(200); }, status(code) { codes.push(code); return { json() {} }; } };
  const req = { ip: '1.2.3.4', get: () => undefined, body: { nonce: 'n'.repeat(32), data: {} }, headers: {} };
  for (let i = 0; i < 21; i++) siteMove.receive(req, res);
  assert.deepEqual([codes.filter(c => c === 200).length, codes.at(-1)], [20, 429]);
  now += 15 * 60000;
  siteMove.receive(req, res);
  assert.equal(codes.at(-1), 200);
});

test('the app stores the progress before anything reads it, and the old page sends everything but caches', () => {
  const fs = require('node:fs'), path = require('node:path');
  const src = fs.readdirSync(path.join(__dirname, '../src')).filter((f) => /^script\.\d+.*\.js$/.test(f)).sort();
  assert.equal(src[0], 'script.00.transfert.js', 'first file of the bundle');
  const page = fs.readFileSync(path.join(__dirname, '../transfert.js'), 'utf8');
  assert.match(page, /pokedle_form_sprites_v3: true/);
  assert.match(page, /if \(back\.charAt\(0\) !== '\/' \|\| back\.charAt\(1\) === '\/'\) back = '\/';/, 'never sends the player to another site');
  assert.equal(move.SITE_URL, process.env.SITE_URL ? move.SITE_URL : 'https://pokdle.fr');
});
