'use strict';
// Le Carnet shiny affichait « 1 sur 150 » alors que les hautes herbes sont à 1 sur 500 depuis le 5/11 (bug vu le 9/11).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { SHINY_ODDS } = require('../lib/poke-balls');

test('the shiny log shows the same odds as the server', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', 'src/script.10xza.shiny-log.js'), 'utf8');
  assert.match(js, new RegExp('<b>1 sur ' + SHINY_ODDS + '</b>chance'));
  assert.doesNotMatch(js, /1 sur 150/);
});
