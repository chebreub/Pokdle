'use strict';
// A Quiz question may be prepared for display without committing the next round.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createQuizHigherLower}=require('../lib/quiz-higher-lower');
const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'../pokemon.js'),'utf8').match(/const POKEMON_LIST =\s*(\[[\s\S]*\]);/)[1]);
const client=fs.readFileSync(path.join(__dirname,'../src/script.10xzj.verified-quiz-hl.js'),'utf8');

function quizState(){
  const engine=createQuizHigherLower(catalog,require('node:crypto').randomInt,()=>new Date());
  const s={id:'quiz-preview-test',mode:'quiz',round:0,score:0,phase:'playing'};
  engine.init(s);
  return {engine,s};
}

test('the next question appears only after a verified answer, without its answer index',()=>{
  const {engine,s}=quizState();
  let view=engine.view(s);
  assert.equal(view.nextQuestion,undefined);
  assert.equal(view.question.answer,undefined);
  const expected=s.questions[1];
  engine.answer(s,s.question.answer);
  view=engine.view(s);
  assert.equal(view.reveal.answer,s.question.answer);
  assert.equal(view.nextQuestion.question,expected.question);
  assert.deepEqual(view.nextQuestion.options,expected.options);
  assert.equal(view.nextQuestion.kind,expected.kind);
  assert.equal(view.nextQuestion.answer,undefined);
  assert.equal(Object.hasOwn(view.nextQuestion,'answer'),false);
  assert.equal(view.nextQuestion.question===s.question.question,false);
  assert.equal(s.round,0,'preview must not advance the stored round');
  assert.equal(s.phase,'reveal');
  engine.next(s);
  view=engine.view(s);
  assert.equal(s.round,1);
  assert.equal(view.question.question,expected.question);
  assert.equal(view.nextQuestion,undefined);
  assert.equal(view.reveal,undefined);
});

test('a completed Quiz never pre-exposes another question',()=>{
  const {engine,s}=quizState();
  s.round=14;s.question=s.questions[14];s.phase='playing';
  engine.answer(s,0);
  assert.equal(s.phase,'over');
  assert.equal(engine.view(s).nextQuestion,undefined);
});

test('preview paints disabled options without selecting an answer or changing score',()=>{
  const idx=client.indexOf('function verifiedQuizShowNextPreview(s) {');
  const end=client.indexOf('\nfunction renderVerifiedQuiz() {',idx);
  assert.ok(idx>=0 && end>idx,'preview helper is present');
  const nodes={
    'quiz-progress':{textContent:''},
    'quiz-question':{textContent:''},
    'quiz-options':{
      children:[],
      replaceChildren(){this.children=[];},
      appendChild(node){this.children.push(node);}
    },
    'quiz-feedback':{textContent:''}
  };
  const ctx=vm.createContext({document:{
    getElementById:(id)=>nodes[id]||null,
    createElement:()=>({disabled:false,type:'',className:'',textContent:''})
  }});
  vm.runInContext(client.slice(idx,end),ctx);
  const view={phase:'reveal',round:4,total:15,nextQuestion:{question:'Quel type ?',options:['Eau','Feu','Plante','Acier'],kind:'type'}};
  assert.equal(ctx.verifiedQuizShowNextPreview(view),true);
  assert.equal(nodes['quiz-progress'].textContent,'Question 6 / 15');
  assert.equal(nodes['quiz-question'].textContent,'Quel type ?');
  assert.deepEqual(nodes['quiz-options'].children.map(b=>b.textContent),view.nextQuestion.options);
  assert.ok(nodes['quiz-options'].children.every(b=>b.disabled));
  assert.match(nodes['quiz-feedback'].textContent,/Chargement/);
  assert.equal(ctx.verifiedQuizShowNextPreview({...view,phase:'playing'}),false);
  assert.equal(ctx.verifiedQuizShowNextPreview({...view,nextQuestion:null}),false);
});

test('preview remains provisional until the authoritative /next succeeds',()=>{
  assert.match(client,/state\.busy=true;verifiedQuizShowPending\(null\);\s*const s=state\.server;\s*verifiedQuizShowNextPreview\(s\);\s*return verifiedArcadeRequest\('next'/);
  assert.match(client,/if\(data\?\.ok\)state\.server=data\.arcade;\s*renderVerifiedQuiz\(\);\s*if\(!data\?\.ok\)advancedArcadeError/);
  assert.match(client,/if\(verifiedQuizLoading\|\|state\.busy\|\|gameMode!=='quiz'\)return;/);
});
