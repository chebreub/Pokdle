'use strict';
// « Pokédle a été mis à jour » (01/11/2026): a page left open across a deploy keeps its old script, so
// « Relever le défi » did nothing in it. The page compares its build with the server's and offers to
// reload; and the Stat Clash room box sits under its fields instead of a narrow column.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('the server tells the build of the page it serves', () => {
  const server = read('server.js');
  assert.match(server, /fs\.readFileSync\(DIST_INDEX, "utf8"\)\.match\(\/dist\\\/script\\\.min\\\.js\\\?v=\(\[0-9a-f\]\+\)\/\)/);
  assert.match(server, /app\.get\("\/api\/version", \(_req, res\) => \{ res\.set\("Cache-Control", "no-store"\); res\.json\(\{ ok: true, build: SITE_BUILD \}\); \}\);/);
  assert.match(read('build.mjs'), /dist\/\$\{file\}\?v=\$\{hash\}/, 'the build puts the version in the page');
});

test('an old page shows the banner once, and only reloads when asked', async () => {
  const src = read('src/script.10xr.update-banner.js');
  const inserted = [], toasts = [];
  let reloaded = 0, fetches = 0, build = 'aaa111';
  const main = { firstChild: null, insertBefore: (el) => inserted.push(el) };
  const ctx = {
    window: {}, Date, setInterval: () => 0, showToast: (m) => toasts.push(m), location: { reload: () => { reloaded += 1; } },
    fetch: async () => { fetches += 1; return { json: async () => ({ ok: true, build }) }; },
    document: {
      querySelector: (sel) => (sel === 'main' ? main : sel.includes('script.min.js') ? { getAttribute: () => 'dist/script.min.js?v=aaa111' } : null),
      getElementById: () => null, createElement: () => ({ setAttribute() {} }), addEventListener() {}, body: main,
    },
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  assert.equal(ctx.siteBuildMine, 'aaa111');
  ctx.checkSiteBuild(false);
  assert.equal(fetches, 0, 'not right after the page loaded');
  ctx.checkSiteBuild(true); await new Promise((r) => setImmediate(r));
  assert.equal(inserted.length, 0, 'same build: nothing');
  build = 'bbb222';
  ctx.checkSiteBuild(true); await new Promise((r) => setImmediate(r));
  assert.equal(inserted.length, 1); assert.match(inserted[0].innerHTML, /Pokédle a été mis à jour[\s\S]*data-action="reloadSiteNow">Recharger/);
  assert.equal(toasts.length, 1);
  ctx.checkSiteBuild(true); await new Promise((r) => setImmediate(r));
  assert.equal(inserted.length, 1, 'once');
  assert.equal(reloaded, 0, 'never reloads on its own: a game in progress is kept');
  ctx.reloadSiteNow();
  assert.equal(reloaded, 1);
  assert.equal((src.match(/location\.reload\(\)/g) || []).length, 1);
});

test('Stat Clash Room 1v1: the room box under the fields, never the same sentence twice', () => {
  const src = read('src/script.02.statclash.js');
  assert.match(src, /if \(!text \|\| same\(text\) === same\(roomUi\?\.title \|\| "Room 1v1"\)\) return "";/);
  assert.doesNotMatch(src, /\$\{state\.roomFeedback \? `<span class="stat-clash-room-feedback/);
  assert.match(read('game-shell.css'), /#screen-stat-clash \.stat-clash-shell\.mode-room \.stat-clash-room-panel:not\(\.is-compact\) \{grid-template-columns:minmax\(0,1fr\) !important;\}/);
});
