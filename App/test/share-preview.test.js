'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const share = require('../lib/share-preview');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('only « number-attempts » codes make a challenge link', () => {
  assert.deepEqual(share.parseChallenge('222-3'), { number: 222, attempts: 3 });
  for (const code of ['222', '222-0', '0-3', '222-3-1', '222-123', 'abc-3', '<b>-3', undefined, ['222-3']]) {
    assert.equal(share.parseChallenge(code), null, String(code));
  }
});

test('a shared link previews the friend\'s score and stays out of search results', () => {
  const html = share.challengePageHtml(read('index.html'), { number: 222, attempts: 3 });
  assert.match(html, /<meta property="og:title" content="Trouvé en 3 essais : à toi de faire mieux !">/);
  assert.match(html, /<meta name="twitter:title" content="Trouvé en 3 essais : à toi de faire mieux !">/);
  assert.match(html, /<meta property="og:description" content="Pokémon du jour n°222 sur Pokédle/);
  assert.match(html, /<meta name="twitter:description" content="Pokémon du jour n°222 sur Pokédle/);
  assert.match(html, /<meta name="robots" content="noindex">\s*<link rel="canonical" href="https:\/\/pokdle.fr\/">/);
  assert.match(html, /<meta property="og:url" content="https:\/\/pokdle.fr\/">/, 'the preview still points to the home page');
  assert.equal(share.challengeTexts({ number: 5, attempts: 1 }).title, 'Trouvé en 1 essai : à toi de faire mieux !');
});

test('the daily share text ends with a challenge link carrying the score', () => {
  const src = read('src/script.04.jeu-pokedex.js');
  const body = src.slice(src.indexOf('function shareResult'), src.indexOf('\n}\n', src.indexOf('function shareResult')));
  assert.match(body, /Fais mieux que moi 👉 \$\{window\.location\.origin\}\/\?defi=\$\{dailyServerState\?\.number \|\| getDailyNumber\(\)\}-\$\{attempts\}/);
  assert.match(body, /trackUsage\("share:daily"\)/);
  assert.match(body, /"Trouvé en " \+ tries/);
});

function landing(search, today = 222) {
  const opened = [];
  let address = null;
  const window = { startDailyGame: () => opened.push('daily'), openFeedbackModal: () => opened.push('avis') };
  const env = {
    window,
    location: { search, pathname: '/', hash: '' },
    history: { state: null, replaceState: (_s, _t, url) => { address = url; } },
    document: { readyState: 'complete' },
    setTimeout: () => {},
    getDailyNumber: () => today,
  };
  const page = Function(...Object.keys(env), read('src/script.10z.landing-links.js') + '; return { openLandingGame, landingChallengeMessage };')(...Object.values(env));
  page.openLandingGame();
  return { opened, address, message: page.landingChallengeMessage };
}

test('/?defi opens the Pokémon du jour, then leaves a clean address', () => {
  assert.deepEqual(landing('?defi=222-3').opened, ['daily']);
  assert.equal(landing('?defi=222-3').address, '/');
  assert.deepEqual(landing('?defi=<script>').opened, ['daily'], 'a broken code still opens the game');
  assert.deepEqual(landing('?jeu=wordle-pokemon&defi=222-3').opened, ['daily'], 'a game link wins');
});

test('the friend\'s score becomes the visitor\'s goal for today only', () => {
  const { message } = landing('');
  assert.equal(message('222-3', 222), '🎯 Ton ami l\'a trouvé en 3 essais. À toi de faire mieux !');
  assert.equal(message('222-1', 222), '🎯 Ton ami l\'a trouvé en 1 essai. À toi de faire mieux !');
  assert.equal(message('221-4', 222), '🎯 Ton ami t\'a lancé un défi. Voici le Pokémon du jour !', 'an old link: no stale score');
  assert.equal(message('<b>', 222), '');
});
