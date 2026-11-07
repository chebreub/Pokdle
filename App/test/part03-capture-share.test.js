'use strict';
// PART-03 (7/11/2026): « 📸 Partager ma capture » after a real, marking capture (shiny, 1st capture,
// legendary or prestige). The card carries no player name; the fallback link is the public
// /pokemon/<name>?via=capture page. Step 1 (`share:capture`) is sent by the browser once per capture;
// step 2 (`share:capture-visit`) is counted by the server only, preview robots apart.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const express = require('express');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const seoPokemon = require('../lib/seo-pokemon');
const { mountSeoPages } = require('../lib/seo-render');

const CLIENT = read('src/script.10xzs.capture-share.js');
function loadClient(extra = {}) {
  const ctx = { window: {}, LEGENDARY_IDS: new Set([150, 151]), location: { origin: 'https://pokdle.fr' }, ...extra };
  vm.runInNewContext(CLIENT, ctx);
  return ctx;
}

test('the client link uses exactly the server slug of every Pokémon page', () => {
  const ctx = loadClient();
  for (const p of seoPokemon.BASE) {
    assert.equal(ctx.captureShareUrl(p), 'https://pokdle.fr' + seoPokemon.pokemonPath(p.id) + '?via=capture', p.name);
  }
});

test('only a real, marking capture offers the share button', () => {
  const { captureShareIsMarking: marking } = loadClient();
  const plain = { caught: true, pokemonId: 16, shiny: false, firstCatch: false };
  assert.equal(marking(plain, { encounter: {} }), false, 'an ordinary duplicate');
  assert.equal(marking({ ...plain, firstCatch: true }, {}), true, '1st capture');
  assert.equal(marking({ ...plain, shiny: true }, {}), true, 'shiny duplicate');
  assert.equal(marking(plain, { encounter: { legend: true } }), true, 'weekly legendary');
  assert.equal(marking(plain, { encounter: { prestige: true } }), true, 'prestige encounter');
  assert.equal(marking({ ...plain, pokemonId: 150 }, {}), true, 'a legendary species');
  assert.equal(marking({ fled: true, pokemonId: 150 }, {}), false, 'a Pokémon that fled');
  assert.equal(marking(null, {}), false, 'no outcome');
});

test('the card and the shared text carry no player name; step 1 is counted once per capture', () => {
  assert.doesNotMatch(CLIENT, /connectedAccountUser|username|accountId|playerProfile/);
  const calls = [];
  const ctx = loadClient({ trackUsage: (e) => calls.push(e) });
  ctx.captureShareLast = { pokemonId: 25, counted: false };
  ctx.captureShareCount(); ctx.captureShareCount();
  assert.deepEqual(calls, ['share:capture']);
  // A cancelled native share is not counted; the image save alone is not a share.
  assert.match(CLIENT, /await navigator\.share\([^;]+;\n\s+captureShareCount\(\);/);
  assert.match(CLIENT, /if \(!e \|\| e\.name !== 'AbortError'\) captureShareCopyLink\(\);/);
  assert.match(CLIENT, /if \(ok\) \{ captureShareCount\(\);/);
});

function serve(app) {
  return new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
}
function get(port, url, ua) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: url, headers: { 'user-agent': ua } }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); }).on('error', reject);
  });
}

test('the server counts an opened capture link only on the real page with ?via=capture', async () => {
  const seen = [];
  const app = express();
  mountSeoPages(app, { onCaptureVisit: (req) => seen.push(req.get('user-agent')) });
  const server = await serve(app);
  try {
    const port = server.address().port;
    assert.equal(await get(port, '/pokemon/pikachu?via=capture', 'iPhone Safari'), 200);
    assert.equal(await get(port, '/pokemon/pikachu', 'iPhone Safari'), 200);
    assert.equal(await get(port, '/pokemon/pikachu?via=autre', 'iPhone Safari'), 200);
    assert.equal(await get(port, '/pokemon/Pikachu?via=capture', 'iPhone Safari'), 301, 'a redirect is not counted');
    assert.deepEqual(seen, ['iPhone Safari']);
  } finally { server.close(); }
});

test('server wiring: robots apart, server-only steps refused from the browser, admin row', () => {
  const server = read('server.js');
  assert.match(server, /onCaptureVisit: \(req\) => recordUsage\(usageMetrics\.isLinkPreviewAgent\(req\.get\("user-agent"\)\) \? "share:preview" : "share:capture-visit"/);
  assert.match(server, /"share:capture", "share:capture-visit",/);
  const only = server.match(/const SERVER_ONLY_USAGE = new Set\(\[([^\]]+)\]\)/);
  assert.ok(only, 'server-only list');
  for (const e of ['share:visit', 'share:preview', 'share:daily-start', 'share:party-visit', 'share:party-start', 'share:capture-visit']) assert.ok(only[1].includes('"' + e + '"'), e);
  for (const e of ['share:daily', 'share:party', 'share:capture']) assert.ok(!only[1].includes('"' + e + '"'), e + ' stays a browser step');
  assert.match(server, /if \(!USAGE_EVENTS\.has\(event\) \|\| SERVER_ONLY_USAGE\.has\(event\)\) return res\.status\(400\)/);
  assert.match(read('lib/admin-stats-dashboard.js'), /\["Capture", \["share:capture","share:capture-visit",null\]\]/);
});
