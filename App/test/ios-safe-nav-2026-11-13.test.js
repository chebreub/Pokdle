'use strict';
// Safari iPhone (iOS 26) : essai du menu du bas sous ?navtest=1 seulement, jamais dans l'appli installée ;
// la carte « Installer l'appli » arrive dès le 2e jour sur iPhone.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('l’essai ne s’active qu’avec ?navtest=1, se retire avec ?navtest=0, et jamais en appli', () => {
  const js = read('src/script.10zzzzi.ios-safe-nav.js');
  assert.match(js, /get\('navtest'\)/);
  assert.match(js, /q === '1'\) localStorage\.setItem\(IOS_NAV_KEY, '1'\)/);
  assert.match(js, /q === '0'\) localStorage\.removeItem\(IOS_NAV_KEY\)/);
  assert.match(js, /flag === '1' && !iosNavStandalone\(\)/);
  assert.match(js, /viewport-fit=cover/);
  assert.doesNotMatch(read('index.html'), /viewport-fit=cover/, 'pas encore pour tout le monde');
});

test('le fondu reste sous le menu, ne bloque aucun clic et disparaît avec le clavier', () => {
  const css = read('mobile.css');
  const block = css.slice(css.indexOf('/* Safari iPhone (iOS 26), essai ?navtest=1'));
  assert.match(block, /#ios-safe-nav-fade \{display:none;\}/);
  assert.match(block, /z-index:1990;pointer-events:none;/);
  assert.match(block, /body\.mobile-keyboard-open #ios-safe-nav-fade \{display:none;\}/);
});

test('la carte « Installer l’appli » : 2e jour sur iPhone, 3e ailleurs', () => {
  assert.match(read('src/script.10xt.install-app.js'), /installVisitDays\(\) >= \(installPlatform\(\) === 'iphone' \? 2 : 3\)/);
});
