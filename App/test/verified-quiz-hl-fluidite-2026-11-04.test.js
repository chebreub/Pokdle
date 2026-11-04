'use strict';
// UI-only latency feedback for the server-authoritative Quiz and Higher or Lower.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const client = fs.readFileSync(path.join(__dirname, '../src/script.10xzj.verified-quiz-hl.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../game-shell.css'), 'utf8');

function extract(start, end) {
  const a = client.indexOf(start), b = client.indexOf(end, a);
  assert.ok(a >= 0 && b > a, 'helper must remain accessible');
  return client.slice(a, b);
}

test('Quiz acknowledges the clicked choice immediately without inventing a correct answer', () => {
  const attributes = [];
  const buttons = Array.from({length:4}, () => ({
    disabled:false,
    classList:{add(x){this.last=x;}},
    setAttribute(name,value){attributes.push({name,value});}
  }));
  const feedback={textContent:'',setAttribute(name,value){attributes.push({name,value});}};
  const next={disabled:false,textContent:'Question suivante'};
  const ctx=vm.createContext({document:{
    querySelectorAll: selector => selector === '#quiz-options button' ? buttons : [],
    getElementById: id => id === 'quiz-feedback' ? feedback : id === 'quiz-next-btn' ? next : null
  }});
  vm.runInContext(extract('function verifiedQuizShowPending(choice) {','\nfunction renderVerifiedQuiz() {'),ctx);
  ctx.verifiedQuizShowPending(2);
  assert.ok(buttons.every(b=>b.disabled));
  assert.equal(buttons[2].classList.last,'is-verifying');
  assert.ok(attributes.some(a=>a.name==='aria-pressed'&&a.value==='true'));
  assert.match(feedback.textContent,/Vérification de ta réponse/);
  assert.doesNotMatch(feedback.textContent,/Bonne réponse|Mauvaise réponse/);
  assert.match(css,/#quiz-box #quiz-options button\.is-verifying:disabled/);
  ctx.verifiedQuizShowPending(null);
  assert.equal(next.disabled,true);
  assert.match(next.textContent,/Chargement de la question/);
});

test('Quiz does not send duplicate answers while verification is pending', () => {
  assert.match(client,/if\(verifiedQuizLoading\|\|state\.busy\|\|state\.server\.phase!=='playing'/);
  assert.match(client,/state\.busy=true;verifiedQuizShowPending\(choice\);/);
  assert.match(client,/state\.busy=true;verifiedQuizShowPending\(null\);/);
  assert.match(client,/return verifiedArcadeRequest\('answer',\{mode:'quiz',sessionId:s\.sessionId,round:s\.round,choice\}\)/);
});

test('a slow reply never extends the visible 60-second Higher or Lower countdown', () => {
  const ctx=vm.createContext({performance:{now:()=>5000}});
  vm.runInContext(extract('function verifiedHLClockReading(server, previous, now=performance.now()) {',
    '\nfunction startVerifiedHLClock(state){'),ctx);
  const first={sessionId:'same',endsAt:160000,serverNow:100000};
  const initial=ctx.verifiedHLClockReading(first,null,5000);
  assert.equal(initial.rushLeftMs,60000);
  assert.equal(initial.endsMono,65000);
  const prev={verified:{sessionId:'same'},endsMono:initial.endsMono};
  const delayed=ctx.verifiedHLClockReading({sessionId:'same',endsAt:160000,serverNow:101000},prev,10500);
  assert.equal(delayed.endsMono,65000);
  assert.equal(delayed.rushLeftMs,54500);
  const serverCorrection=ctx.verifiedHLClockReading({sessionId:'same',endsAt:160000,serverNow:109000},prev,10500);
  assert.equal(serverCorrection.endsMono,61500);
  assert.equal(serverCorrection.rushLeftMs,51000);
  const newSession=ctx.verifiedHLClockReading({sessionId:'new',endsAt:230000,serverNow:170000},prev,50000);
  assert.equal(newSession.rushLeftMs,60000);
  assert.equal(newSession.endsMono,110000);
});

test('Higher or Lower shows a pending status without changing authoritative outcomes', () => {
  assert.match(client,/Vérification de ta réponse…/);
  assert.match(client,/actions\.after\(note\)/);
  assert.match(client,/applyVerifiedHL\(data,state\)/);
  assert.match(client,/Math\.min\(previous\.endsMono,candidate\)/);
  const gameplay=fs.readFileSync(path.join(__dirname,'../lib/quiz-higher-lower.js'),'utf8');
  assert.match(gameplay,/s\.endsAt=\+clock\(\)\+60000/);
  assert.match(gameplay,/s\.nextAt=\+clock\(\)\+\(s\.mode==='higher-lower-rush'\?900:1800\)/);
});
