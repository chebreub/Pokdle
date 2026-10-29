'use strict';
// « Party Pokémon » was the old name of the Marathon mini-jeux: the missions now say where to play (29/10).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('missions and records name the Marathon mini-jeux, never the old « Party Pokémon »', () => {
  const src = read('src/script.10b.album-missions.js');
  assert.match(src, /req\.type === 'wins' && req\.mode === 'party'\) return `\$\{req\.goal\} session\(s\) gagnée\(s\) au Marathon mini-jeux`/);
  assert.match(src, /party:\['startPartyMode','Jouer au Marathon mini-jeux'\]/, 'the mission button opens the Marathon');
  for (const file of ['src/script.01.core.js', 'src/script.07.delegation-party.js', 'src/script.10b.album-missions.js', 'index.html']) {
    const visible = read(file).split('\n').filter((line) => !/^\s*\/\//.test(line)).join('\n');
    assert.doesNotMatch(visible, /Party Pokémon/, file);
  }
});
