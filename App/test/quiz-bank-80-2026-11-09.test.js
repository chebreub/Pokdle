'use strict';
// Quiz étape 2 (9/11/2026) : la banque de questions écrites passe de 20 à 99, chacune avec un niveau et une explication ;
// les réponses sont mélangées au moment de poser la question (dans la banque, la bonne est souvent la première).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const BANK = require('../src/script.00b.quiz-bank');

test('the written bank has at least 80 clean questions with a level and an explanation', () => {
  assert.ok(BANK.length >= 80, 'only ' + BANK.length);
  assert.equal(new Set(BANK.map((q) => q.question)).size, BANK.length, 'duplicate question');
  for (const q of BANK) {
    assert.equal(q.options.length, 4, q.question);
    assert.equal(new Set(q.options).size, 4, q.question);
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4, q.question);
    assert.ok([2, 3].includes(q.level), q.question);
    assert.ok(typeof q.explain === 'string' && q.explain.length > 10, q.question);
  }
  // Les 4 erreurs repérées à la relecture sont corrigées.
  const text = JSON.stringify(BANK);
  assert.doesNotMatch(text, /Nigirigon/);
  assert.doesNotMatch(text, /Rouge\/Bleu, quel type n'avait aucune faiblesse/);
  const belt = BANK.find((q) => /super efficaces/.test(q.question));
  assert.equal(belt.options[belt.answer], 'Ceinture Pro');
});

test('written questions are served with shuffled options, the right level and their explanation', () => {
  const server = fs.readFileSync(path.join(__dirname, '..', 'lib/quiz-higher-lower.js'), 'utf8');
  assert.match(server, /written\.findIndex\(q=>q\.level===level\)/);
  assert.match(server, /return build\('culture',level,w\.question,right,/);
  assert.match(server, /w\.explain\?\{explain:w\.explain\}:\{\}/);
  const party = fs.readFileSync(path.join(__dirname, '..', 'src/script.03.minijeux.js'), 'utf8');
  assert.match(party, /const options = shuffleArray\(q\.options\.slice\(\)\);/);
});
