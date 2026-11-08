// 📱 Accueil sur téléphone (8/11/2026, « go ») : Défi du jour fini en bilan court, nouvel ordre, bouton « Acheter ».
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const SRC = read('src/script.10xzzt.home-phone.js');
const CSS = read('home.css');
const P_CSS = CSS.slice(CSS.indexOf('/* 📱 Accueil sur téléphone'));

function sandbox(streak) {
  const ctx = { window: {}, document: { getElementById: (id) => (id === 'daily-hero-streak' ? { textContent: '🔥 Série : ' + streak } : null), querySelector: () => null, querySelectorAll: () => [] },
    escapeHtml: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'), MutationObserver: undefined };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return ctx;
}

test('a finished day shows the score ring, the points and the streak', () => {
  const html = sandbox(21).hpScoreHtml({ points: 78, maxPoints: 100 });
  assert.match(html, /style="--p:78"/);
  assert.match(html, /✓ Journée terminée/);
  assert.match(html, /78 \/ 100 points/);
  assert.match(html, /🔥 21 j/);
  assert.doesNotMatch(sandbox(0).hpScoreHtml({ points: 40, maxPoints: 100 }), /🔥/, 'no streak pill at 0');
});

test('the original texts stay in the page: short versions are added, never replaced', () => {
  assert.match(SRC, /<i class="hp-long">\$1<\/i>/);
  assert.match(P_CSS, /\.hp-long\{display:none\}/);
  assert.match(P_CSS, /content:attr\(data-short\)/);
  assert.match(P_CSS, /\.hp-score\{display:none\}/, 'hidden on PC');
  assert.match(P_CSS, /@media \(max-width:640px\)\{\s*\/\* Journée finie/);
});

test('only a finished day changes: data-daily-state="complete" everywhere in the phone rules', () => {
  const block = P_CSS.slice(P_CSS.indexOf('@media (max-width:640px)'), P_CSS.indexOf('@media (max-width:860px)'));
  for (const line of block.split('\n').filter((l) => /#daily-hero/.test(l))) assert.match(line, /data-daily-state="complete"/, line);
});

test('phone order: challenge received and capture before the mini-games, « Aussi aujourd’hui » last', () => {
  assert.match(P_CSS, />#home-inbox\{order:1\}/);
  assert.match(P_CSS, />\.hs-capture\{order:1\}/);
  assert.match(P_CSS, /#home-games-grid\{order:2\}/);
  assert.match(P_CSS, />\.hm-side>\.hm-duel\{order:3\}/);
  assert.match(P_CSS, />#home-party\{order:3\}/);
  assert.match(P_CSS, />\.hs-more\{order:4\}/);
  assert.match(P_CSS, /#home-balls:not\(\.is-beginner\)\{display:contents!important\}/, 'the 3-step beginner card keeps its frame');
});

test('no Ball but enough ₽: the capture card offers the shop', () => {
  assert.match(SRC, /var HP_POKE_PRICE = 50;/);
  assert.match(SRC, /go\.dataset\.action = 'openShop'/);
  assert.match(SRC, /if \(!\(coins >= price\) \|\| left <= 0\) return;/);
  assert.doesNotMatch(SRC, /fetch\(/, 'no new request');
});
