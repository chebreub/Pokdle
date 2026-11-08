// 🧠 Quiz v2 (8/11/2026, « go quiz ») : l'écran habille ce que le serveur envoie, sans rien décider.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const SRC = read('src/script.10xzzq.quiz-v2.js');
const CSS = read('game-feel.css');

test('the screen never computes the right answer: it only reads what the quiz already shows', () => {
  assert.doesNotMatch(SRC, /\.answer\b/, 'no access to the correct option');
  assert.doesNotMatch(SRC, /fetch\(|verifiedArcadeRequest|quizScore\s*=|quizHistory\.push/);
  assert.match(SRC, /if \(answered && q\.explain\)/, 'the explanation appears only after answering');
});

test('the Party Room quiz keeps its own screen', () => {
  assert.match(SRC, /!\(typeof isPartySessionActive === 'function' && isPartySessionActive\(\)\)/);
});

test('pictures come from opaque addresses only and the silhouette is lifted after the answer', () => {
  assert.match(SRC, /q\.silhouette && !answered \? 'is-shadow'/);
  assert.doesNotMatch(SRC, /img\/art\/|official-artwork|jsdelivr/);
  const lib = read('lib/verified-arcade.js');
  assert.match(lib, /q\.art = q\.artIds\.map\(id => '\/api\/arcade\/art\/' \+ imageToken\(who, \{id, guess:true, quiz:true\}/);
  assert.match(lib, /if \(spec\.k === 'q'\)/);
});

test('hidden counters stay readable for assistive tech and QA, motion respects reduced motion', () => {
  assert.match(CSS, /#quiz-box\.qz-on :is\(#quiz-progress,\.quiz-progressbar,\.quiz-stats\)\{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip-path:inset\(50%\)/);
  assert.match(CSS, /@media \(prefers-reduced-motion:reduce\)\{#quiz-box\.qz-on \.qz-scene::before,#quiz-box\.qz-on \.qz-solo>img/);
});
