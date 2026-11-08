// 🎬 Accueil en mouvement (8/11/2026) : accueil plus court, 6 tuiles animées une à une, « Défie tes amis ».
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const SRC = read('src/script.10xzy.home-motion.js');
const CSS = read('home.css');
const MOTION_CSS = CSS.slice(CSS.indexOf('/* 🎬 Accueil en mouvement'));

test('the six animated tiles are exactly the home « Sélection » shelf', () => {
  const shelf = read('src/script.09.club.js').match(/popular: \[([^\]]+)\]/)[1].match(/"(\w+)"/g).map((s) => s.slice(1, -1));
  const scenes = SRC.match(/var HM_SCENES = \{([\s\S]*?)\};/)[1].match(/(\w+):/g).map((s) => s.slice(0, -1));
  assert.deepEqual(scenes.slice().sort(), shelf.slice().sort());
});

test('tiles keep their catalog image and their game: the scene only decorates', () => {
  assert.match(SRC, /slot\.insertBefore\(main, slot\.firstChild\)/, 'the catalog sprite moves into the scene, so it still loads');
  assert.doesNotMatch(SRC, /data-action="(?!openPartyRoomWithGame)/, 'only the duel banner adds an action');
  assert.doesNotMatch(SRC, /pk-hero-title|pk-hero-sub|innerHTML\s*=\s*''/, 'the home presentation text is not rewritten');
  assert.doesNotMatch(SRC, /cdn\.jsdelivr/, 'images come from the site itself');
  for (const id of [4, 6]) {
    const file = path.join(__dirname, '..', 'img', 'motion', id + '.webp');
    assert.ok(fs.existsSync(file) && fs.statSync(file).size < 10000, id + '.webp is a small local thumbnail');
  }
});

test('one scene at a time, only on screen, only with a visible tab', () => {
  assert.match(SRC, /new IntersectionObserver/);
  assert.match(SRC, /if \(document\.hidden \|\| hmReduced\(\)\) return;/);
  assert.match(SRC, /setInterval\(hmStep, 1500\)/);
  assert.match(MOTION_CSS, /:not\(\.hm-live\)[^{]*\{animation-play-state:paused!important\}/);
});

test('nothing moves with « Animations réduites »', () => {
  assert.match(SRC, /appAnimationMode\(\) === 'reduced'/);
  assert.match(SRC, /classList\.contains\('reduce-motion'\)/);
  assert.match(MOTION_CSS, /@media \(prefers-reduced-motion:reduce\)\{#screen-config\.hm-on :is\(\.hm-scene,\.hm-duel\) \*/);
  assert.match(MOTION_CSS, /\.reduce-motion #screen-config\.hm-on :is\(\.hm-scene,\.hm-duel\) \*/);
});

test('« Défie tes amis » opens a Party Room and keeps the band readable by screen readers', () => {
  assert.match(SRC, /class="hm-duel" data-action="openPartyRoomWithGame" data-args=\\'\[""\]\\' aria-label="Défie tes amis : créer un salon"/);
  assert.match(MOTION_CSS, /\.home-party \.home-party-head\{position:absolute!important;width:1px;height:1px;overflow:hidden;clip-path:inset\(50%\)/, 'the band title stays for screen readers');
  const html = read('index.html');
  assert.ok(html.indexOf('id="home-party"') > 0 && html.includes('Joue avec tes amis, en direct'));
});

test('the empty daily notebook stays hidden and the daily card keeps its four steps and bonuses', () => {
  assert.match(MOTION_CSS, /#daily-notebook\[data-progress="empty"\]\{display:none!important\}/);
  assert.match(MOTION_CSS, /\.daily-hero-steps\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)!important/);
  assert.doesNotMatch(MOTION_CSS, /\.daily-hero-(steps|bonus)\{display:none/);
});
