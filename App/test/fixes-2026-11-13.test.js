'use strict';
// 13/11/2026 : « ⚡ Partie rapide » de Stat Clash ne lançait rien, et la fin de Combo de types empilait
// les Pokémon trouvés en une colonne, sous les boutons.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('Stat Clash contre le Bot : sans règle choisie, une règle est tirée au hasard et la partie part', () => {
  const src = read('src/script.02.statclash.js');
  const start = src.indexOf('function startStatClashBotGame()');
  const head = src.slice(start, src.indexOf('resetStatClashRuntime();', start));
  assert.doesNotMatch(head, /Choisis une règle à imposer au bot avant de lancer/);
  assert.doesNotMatch(head, /return renderStatClashScreen\(\)/, 'plus de sortie avant le lancement');
  assert.match(head, /getRandomStatClashRuleFromSet\(STAT_CLASH_IMPOSABLE_RULE_IDS\)/);
  assert.match(head, /Règle tirée au hasard/);
});

test('Combo de types : « Rejouer » avant la liste, liste en grille sur toute la largeur', () => {
  const src = read('src/script.03.minijeux.js');
  const over = src.slice(src.indexOf('if (st.phase === "gameover")'), src.indexOf('function typeComboTypesHtml'));
  assert.ok(over.indexOf('data-action="startTypeComboGame"') < over.indexOf('typeComboFoundHtml(st.found)'));
  const css = read('game-shell.css');
  const block = css.slice(css.indexOf('/* Combo de types : fin de partie (13/11/2026)'));
  assert.match(block, /\.tc-gameover \.tc-found \{width:100%;/);
  assert.match(block, /\.tc-gameover \.tc-found-list \{grid-template-columns:repeat\(auto-fill,minmax\(74px,1fr\)\)/);
});
