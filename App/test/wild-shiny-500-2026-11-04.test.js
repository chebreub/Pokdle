'use strict';
// Hautes herbes (4/11/2026, choix de Kayan) : shiny plus rare, 1 sur 500 à partir du 5/11 (jour de Paris).
const test = require('node:test');
const assert = require('node:assert/strict');
const { shinyOddsFor, SHINY_ODDS } = require('../lib/poke-balls');

test('wild shinies are 1 in 500 from 5 November, 1 in 150 before', () => {
  assert.equal(SHINY_ODDS, 500);
  assert.equal(shinyOddsFor('2026-11-04'), 150);
  assert.equal(shinyOddsFor('2026-11-05'), 500);
  assert.equal(shinyOddsFor('2026-12-25'), 500);
});
