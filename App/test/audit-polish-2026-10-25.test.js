'use strict';
// Second batch of the 25/10 audit: profile figures, the Quiz recap and mix, the home picks.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const between = (src, from, to) => src.slice(src.indexOf(from), src.indexOf(to, src.indexOf(from)));

test('the profile says its first three figures count the guessing games, and the Quiz is not one', () => {
  const html = read('index.html');
  const numbers = between(html, '<h3 id="profile-numbers-title">Mes chiffres</h3>', '</section>');
  assert.match(numbers, /<p class="profile-numbers-note">Les devinettes : Pokémon du jour, mode illimité, Zoom, Pixelisé, Cri, Stat Mystère… Tous tes autres jeux sont dans l’<button type="button" class="link-button" data-action="openMatchHistoryScreen">Historique<\/button>\.<\/p>/);
  const labels = [...numbers.matchAll(/<div class="profile-stat-card"><span>([^<]+)<\/span>/g)].map((m) => m[1]);
  assert.deepEqual(labels, ['Devinettes jouées', 'Pokémon trouvés', 'Taux de réussite', 'Série du jour', 'Meilleure série', 'Quêtes réussies']);
  // The Quiz can never count a win, so it no longer counts a devinette played either.
  assert.doesNotMatch(between(read('src/script.02.statclash.js'), 'function startQuizGame()', '\n}\n'), /registerGameStart/);
});

function quizApi() {
  const src = read('src/script.03.minijeux.js');
  return Function(between(src, 'function shuffleArray(', 'function randomUniqueChoices(') +
    between(src, 'const QUIZ_KIND_ORDER', 'function renderQuizMeta()') + '; return pickQuizQuestions;')();
}

test('every Quiz mixes written questions, types, generations and Pokédex numbers', () => {
  const pick = quizApi();
  const pool = [
    ...Array.from({ length: 20 }, (_, i) => ({ question: 'culture ' + i })),
    ...['dex', 'type', 'gen'].flatMap((kind) => Array.from({ length: 40 }, (_, i) => ({ kind, question: kind + ' ' + i }))),
  ];
  for (let run = 0; run < 50; run += 1) {
    const quiz = pick(pool, 15);
    assert.equal(quiz.length, 15);
    assert.equal(new Set(quiz).size, 15);
    const count = (kind) => quiz.filter((q) => (q.kind || 'culture') === kind).length;
    assert.deepEqual([count('culture'), count('type'), count('gen'), count('dex')], [4, 4, 4, 3]);
  }
  // A Party round has 5 questions: one of each kind, then a written one.
  const party = pick(pool, 5);
  assert.deepEqual(['culture', 'type', 'gen', 'dex'].map((kind) => party.filter((q) => (q.kind || 'culture') === kind).length), [2, 1, 1, 1]);
  // A kind that runs out leaves its place to the others.
  assert.equal(pick(pool.filter((q) => q.kind !== 'dex'), 15).length, 15);
  const src = read('src/script.03.minijeux.js');
  for (const kind of ['dex', 'type', 'gen']) assert.match(src, new RegExp('pool\\.push\\(\\{\\n\\s+kind: "' + kind + '",'));
  assert.match(read('src/script.02.statclash.js'), /quizQuestions = pickQuizQuestions\(buildQuizQuestionPool\(\), isPartySessionActive\(\) \? 5 : QUIZ_QUESTION_COUNT\);/);
});

test('the Quiz recap recalls each question, and the last answer leads to « Voir mon résultat »', () => {
  const src = read('src/script.03.minijeux.js');
  const render = between(src, 'function renderQuizMeta()', 'let quizResultSnapshot');
  const el = { innerHTML: '', style: {}, textContent: '' };
  const document = { getElementById: (id) => id === 'quiz-history' ? el : { style: {}, textContent: '' } };
  const escapeHtml = (s) => String(s).replace(/</g, '&lt;');
  const quizHistory = [
    { ok: true, number: 1, question: 'Quel est le numéro Pokédex de Cizayox ?', answer: '212', chosen: '212' },
    { ok: false, number: 2, question: 'Grodrive appartient à quelle génération ?', answer: 'Gen 4', chosen: 'Gen 3' },
  ];
  Function('document', 'escapeHtml', 'quizHistory', 'quizQuestions', 'quizScore', render + '; renderQuizMeta();')(document, escapeHtml, quizHistory, [1, 2, 3], 1);
  assert.match(el.innerHTML, /<div class="quiz-history-item ok"><span>✓ 1\. Quel est le numéro Pokédex de Cizayox \?<\/span><b>212<\/b><\/div>/);
  assert.match(el.innerHTML, /<div class="quiz-history-item bad"><span>✕ 2\. Grodrive appartient à quelle génération \?<\/span><b>Gen 4<\/b><small>Ta réponse : Gen 3<\/small><\/div>/);
  assert.match(src, /nextBtn\.textContent = quizCurrentIndex \+ 1 >= quizQuestions\.length \? "Voir mon résultat" : "Question suivante";/);
  // Once the Quiz is over, the whole recap shows at once instead of a small scrolling box.
  assert.match(read('game-feel.css'), /#pokdle-app #quiz-box:has\(#quiz-end-card:not\(\.hidden\)\) \.quiz-history \{ max-height: none; overflow: visible; \}/);
});

test('the home suggests easier first games: one hard game out of six, not three', () => {
  const club = read('src/script.09.club.js');
  const popular = JSON.parse(club.match(/popular: (\[[^\]]+\])/)[1]);
  assert.deepEqual(popular, ['startSilhouetteGame', 'openHigherLowerMode', 'startWeightBattle', 'openOddOneOutMode', 'startQuizGame', 'openPokeConnectionsMode']);
  const catalog = read('src/script.08.catalog.js');
  const difficulty = Function(between(catalog, 'var MODE_CATALOG_DIFFICULTY = ', '\n});') + '\n}); return MODE_CATALOG_DIFFICULTY;')();
  assert.equal(popular.filter((key) => ['hard', 'expert'].includes(difficulty[key])).length, 1);
});
