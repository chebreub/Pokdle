'use strict';
// Safari iPhone (iOS 26) : l'essai du menu du bas (?navtest=1) n'a pas convaincu, il est retiré (choix B).
// Ce qui reste : la carte « Installer l'appli » arrive dès le 2e jour sur iPhone.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('l’essai ?navtest=1 est retiré (choix B de Kayan, 13/11) : rien ne reste', () => {
  assert.ok(!fs.existsSync(path.join(__dirname, '..', 'src', 'script.10zzzzi.ios-safe-nav.js')));
  assert.doesNotMatch(read('mobile.css'), /ios-safe-nav/);
  assert.doesNotMatch(read('index.html'), /viewport-fit=cover/);
});

test('la carte « Installer l’appli » : 2e jour sur iPhone, 3e ailleurs', () => {
  assert.match(read('src/script.10xt.install-app.js'), /installVisitDays\(\) >= \(installPlatform\(\) === 'iphone' \? 2 : 3\)/);
});
