'use strict';
// 29/10: dragging the Zoom or Pixel image showed the real sprite in the drag preview.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('the mystery images cannot be dragged, long-pressed or clicked through', () => {
  const html = read('index.html');
  assert.match(html, /<img id="silhouette-sprite"[^>]*draggable="false"/);
  assert.match(html, /<img id="pixel-sprite"[^>]*draggable="false"/);
  assert.match(read('game-shell.css'), /:is\(#silhouette-sprite, #pixel-sprite, \.party-sprite-silhouette, \.party-sprite-pixel\) \{pointer-events:none;-webkit-user-drag:none;user-select:none;-webkit-touch-callout:none;\}/);
});

test('a Course au Pokédex mission opens the Party Room instead of the game list', () => {
  assert.match(read('src/script.10b.album-missions.js'), /req\.type === 'dexrace' \? \['openPartyRoomMode','Course au Pokédex en Party Room'\]/);
});
