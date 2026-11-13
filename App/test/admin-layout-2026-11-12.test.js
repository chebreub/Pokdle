'use strict';
// Panneau admin rangé (12/11) : en-tête, « En un coup d'œil », 3 groupes ; mêmes formulaires.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const src = fs.readFileSync(path.join(__dirname, '../lib/admin-panel.js'), 'utf8');

test('3 groupes avec toutes les sections d’avant', () => {
  for (const part of ['reportsHtml, true', 'suspensionHtml', 'photosSection(photos)', 'namesHtml', 'newsSection(news, day)', 'surveyHtml', 'messagesHtml, true', 'levelHtml', 'wildTestSectionHtml()']) {
    assert.ok(src.includes(part), part);
  }
  assert.match(src, /\["moderation", "🛡️ Modération"/);
  assert.match(src, /\["communiquer", "📣 Communiquer"/);
  assert.match(src, /\["outils", "🧰 Outils"/);
});

test('« En un coup d’œil » : signalements, annonce, sondage, réponses', () => {
  assert.match(src, /glance\.reports = list\.filter\(\(r\) => r\.status === "open"\)\.length;/);
  assert.match(src, /glance\.replies = msgState\.messages\.reduce/);
  assert.match(src, /if \(live\) glance\.survey = \{ answered: live\.answered, comments: live\.comments \};/);
});

test('pas de script dans la page (CSP) : onglets en CSS seulement, un seul bloc de style', () => {
  assert.doesNotMatch(src, /<script/);
  assert.equal((src.match(/<style>/g) || []).length, 1);
  assert.match(src, /\.grp:target\{display:block\}/);
});
