// /admin/stats plus lisible (8/11/2026, « go stats ») : onglets, tendances, « Ce qui a bougé », « Tout copier ».
const test = require('node:test');
const assert = require('node:assert/strict');
const { renderStatsDashboard, htmlToText, STATS_CLIENT_JS } = require('../lib/admin-stats-dashboard');

const day = '2026-11-07';
const metrics = [
  { day, event: 'visit', hits: 40 }, { day, event: 'solo:quiz', hits: 31 }, { day, event: 'share:daily', hits: 3 }
];
const previousMetrics = [{ day: '2026-10-31', event: 'visit', hits: 20 }, { day: '2026-10-31', event: 'solo:quiz', hits: 12 }];
const html = renderStatsDashboard({ days: 7, endDay: day, metrics, previousMetrics, generatedAt: '2026-11-08T10:42:00.000Z', adminKey: 'k', feedbackHtml: '<h2>Retours</h2><p>« Super jeu » &amp; merci</p>' });

test('one button copies the whole dashboard as plain text, a second one saves it', () => {
  assert.match(html, /<button type="button" id="copy-report" class="export-main">📋 Tout copier pour Claude<\/button>/);
  assert.match(html, /<button type="button" id="download-report" class="export-ghost">⬇ \.txt<\/button>/);
  const report = html.match(/<textarea id="stats-report"[^>]*>([\s\S]*?)<\/textarea>/)[1];
  for (const part of ['== ESSENTIEL ==', '== JEUX ==', '== PARTY ROOM ==', '== RETOUR DES JOUEURS ==', '== ÉCONOMIE ET CAPTURES ==', '== AVIS ET INTERACTIONS ==', '== DIAGNOSTIC'])
    assert.ok(report.includes(part), part);
  assert.match(report, /Exporté le 08\/11 à 11 h 42 \(heure de Paris\)/);
  assert.match(report, /Sessions : 40 \(\+100 % vs période d’avant : 20\)/);
  assert.match(report, /« Super jeu » &amp; merci/, 'the text is decoded, then escaped once in the page');
  assert.doesNotMatch(report, /<(section|table|td|div)\b/, 'no HTML in the copied text');
});

test('trends compare with the previous period of the same length', () => {
  assert.match(html, /<em class="trend up">▲ \+100 %<\/em>/);
  assert.match(html, /<ul class="insights">/);
});

test('every section is still on the page, grouped in tabs that only hide with the script', () => {
  for (const tab of ['overview', 'games', 'economy', 'social', 'players', 'details']) assert.match(html, new RegExp('<div class="tab-panel" data-tab="' + tab + '" role="tabpanel">'));
  assert.match(html, /<nav class="tabs" role="tablist" aria-label="Rubriques" hidden>/, 'without the script, nothing is hidden');
  assert.match(html, /<script src="\/admin\/stats\.js" defer><\/script>/);
  assert.doesNotMatch(html, /<script>(?!<\/script>)/, 'no inline script (CSP)');
  assert.match(STATS_CLIENT_JS, /navigator\.clipboard\.writeText\(text\)/);
  assert.match(STATS_CLIENT_JS, /document\.execCommand\('copy'\)/, 'fallback when the clipboard API is refused');
});

test('tables become readable lines', () => {
  assert.equal(htmlToText('<table><tr><th>Jeu</th><th>Ouvertures</th></tr><tr><td>Quiz</td><td>31</td></tr></table>'), 'Jeu | Ouvertures\nQuiz | 31');
});
