'use strict';
// 📱 Classement et bilan du jour plus courts sur iPhone (9/11/2026) : rien d'origine n'est retiré.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('the week prize keeps its card and gets a details button', () => {
  const js = read('src/script.10zz.compact-lb-bilan.js');
  assert.match(js, /leaderboardPrizeHtml = function/);
  assert.match(js, /'<section class="lbv5-prize is-compact"'/);
  assert.match(js, /data-action="lbp2Toggle"/);
  assert.match(js, /window\.lbp2Toggle = lbp2Toggle/);
  // The original card (tag, title, champion box) is unchanged: the compact look is CSS only.
  assert.match(read('src/script.10g.leaderboard-v2.js'), /<span class="lbv5-prize-tag">À gagner cette semaine<\/span>/);
  const css = read('game-shell.css');
  assert.match(css, /\.lbv5-prize\.is-compact\.is-open \.lbv5-prize-text p:not\(\.lbv5-prize-time\)\{display:block\}/);
});

test('the phone summary is one card; the original buttons stay in the page', () => {
  const js = read('src/script.10zz.compact-lb-bilan.js');
  assert.match(js, /showDailyJourneySummary = async function/);
  assert.match(js, /content\.querySelectorAll\('\.journey-stages > button'\)/);
  assert.match(js, /data-action="startDailyGrid"/);
  assert.match(js, /data-action="startNormalGame"/);
  // Wraps after every other wrapper of the summary (grid bonus, day done, support).
  const parts = fs.readdirSync(path.join(__dirname, '..', 'src')).filter((f) => /^script\.\d+.*\.js$/.test(f)).sort();
  const at = (name) => parts.indexOf(name);
  for (const before of ['script.10w.daily-grid.js', 'script.10xl.day-done.js', 'script.10y.support.js']) assert.ok(at(before) < at('script.10zz.compact-lb-bilan.js'), before);
  const css = read('game-shell.css');
  assert.match(css, /#challenge-content \.bj2,#challenge-content \.bj2-next\{display:none\}/, 'nothing changes on PC');
  // The QA clicks the blue « Classement global du jour » of the summary: it stays visible on phone.
  assert.match(css, /#challenge-content:has\(\.bj2\) \.challenge-actions \.btn-blue\{display:block/);
  assert.doesNotMatch(css, /#challenge-content:has\(\.bj2\) \.challenge-actions\{display:none/);
});
