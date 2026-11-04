'use strict';
const WRITTEN = require('../src/script.00b.quiz-bank');
const STATS = require('../base-stats.json');
const MODES = ['quiz','higher-lower','higher-lower-rush'];
const KEYS = ['hp','attack','defense','spAttack','spDefense','speed'];
const fail = (code,status=409)=>Object.assign(new Error(code),{code,status});
function createQuizHigherLower(catalog,randomInt,clock) {
  const shuffle = list => {
    const a=list.slice();
    for(let i=a.length-1;i>0;i--){const j=randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];}
    return a;
  };
  const base=catalog.filter(p=>!p.isAltForm&&p.guessable!==false&&Number.isInteger(p.id)&&p.id<=1025);
  const statsOf=p=>STATS[String(p.formApiName||p.apiId||p.baseId||p.id)];
  const hl=catalog.filter(p=>p.guessable!==false&&Array.isArray(statsOf(p))&&statsOf(p).length===6&&statsOf(p).every(v=>Number.isFinite(v)&&v>0));
  const byId=new Map(hl.map(p=>[p.id,p]));
  function quiz() {
    const sampled=shuffle(base).slice(0,120), types=[...new Set(base.map(p=>p.type1).filter(Boolean))];
    const pools={culture:shuffle(WRITTEN),type:[],gen:[],dex:[]};
    const make=(kind,question,values,correct)=>{
      const options=shuffle([correct,...shuffle([...new Set(values)].filter(v=>v!==correct)).slice(0,3)]);
      return {kind,question,options,answer:options.indexOf(correct)};
    };
    for(const p of sampled.slice(0,40))pools.dex.push(make('dex',`Quel est le numéro Pokédex de ${p.name} ?`,[Math.max(1,p.id-1),Math.min(1025,p.id+1),Math.max(1,p.id+10),Math.max(1,p.id-10)].map(String),String(p.id)));
    for(const p of sampled.slice(40,80))pools.type.push(make('type',`Quel est le type principal de ${p.name} ?`,types,p.type1));
    for(const p of sampled.slice(80,120))pools.gen.push(make('gen',`${p.name} appartient à quelle génération ?`,[1,2,3,4,5,6,7,8,9].map(g=>'Gen '+g),'Gen '+Number(p.gen||p.generation)));
    for(const k of ['type','gen','dex'])pools[k]=shuffle(pools[k]);
    const picked=[];
    while(picked.length<15&&Object.values(pools).some(a=>a.length))
      for(const kind of ['culture','type','gen','dex'])if(picked.length<15&&pools[kind].length)picked.push({...pools[kind].pop(),kind});
    if(picked.length!==15)throw fail('unavailable',503);
    return shuffle(picked);
  }
  function question(s) {
    if(s.mode==='quiz'){s.question=s.questions[s.round];return;}
    if(hl.length<2)throw fail('unavailable',503);
    const left=s.question?byId.get(s.question.right):hl[randomInt(hl.length)];
    const pool=hl.filter(p=>p.id!==left.id),right=pool[randomInt(pool.length)],stat=randomInt(6);
    s.question={left:left.id,right:right.id,statKey:KEYS[stat],leftValue:statsOf(left)[stat],rightValue:statsOf(right)[stat]};
  }
  function init(s) {
    if(s.mode==='quiz'){s.questions=quiz();s.history=[];}
    else if(s.mode==='higher-lower-rush')s.endsAt=+clock()+60000;
    question(s);
  }
  // Quiz preloads its next question (without the correct option index) only after
  // the current answer has been confirmed. Preview does not advance the round.
  const publicQuizQuestion=q=>({question:q.question,options:q.options,kind:q.kind});
  function view(s) {
    const q=s.question,revealed=s.phase!=='playing';
    return s.mode==='quiz'?{
      total:15,question:publicQuizQuestion(q),history:s.history,
      ...(s.phase==='reveal'&&s.round<14 ? {nextQuestion:publicQuizQuestion(s.questions[s.round+1])}:{}),
      ...(revealed?{reveal:{answer:q.answer}}:{})
    }:{
      question:{left:q.left,right:q.right,statKey:q.statKey,leftValue:q.leftValue},
      ...(revealed?{reveal:{rightValue:q.rightValue}}:{}),
      serverNow:+clock(),endsAt:s.endsAt||null,nextAt:s.nextAt||null
    };
  }
  function result(s){return {mode:s.mode,score:s.score,result:s.score>=(s.mode==='quiz'?8:s.mode==='higher-lower'?5:10)?'win':'loss'};}
  function expire(s) {
    if(s.mode!=='higher-lower-rush'||s.phase==='over'||+clock()<s.endsAt)return false;
    s.phase='over';return true;
  }
  function answer(s,choice) {
    const q=s.question;
    if(s.mode==='quiz'?(!Number.isInteger(choice)||choice<0||choice>=q.options.length):!['higher','lower'].includes(choice))throw fail('invalid_choice',400);
    const correct=s.mode==='quiz'?choice===q.answer:q.rightValue===q.leftValue||(q.rightValue>q.leftValue?choice==='higher':choice==='lower');
    s.answer={choice,correct};if(correct)s.score++;
    if(s.mode==='quiz') {
      s.history.push({ok:correct,number:s.round+1,question:q.question,answer:q.options[q.answer],chosen:q.options[choice]});
      s.phase=s.round===14?'over':'reveal';
    } else {
      s.phase=s.mode==='higher-lower'&&!correct?'over':'reveal';
      s.nextAt=+clock()+(s.mode==='higher-lower-rush'?900:1800);
    }
  }
  function next(s) {
    if(s.nextAt&&+clock()<s.nextAt)throw fail('round_wait');
    s.round++;s.phase='playing';s.answer=null;question(s);
  }
  return {init,view,answer,next,expire,result};
}
module.exports={MODES,createQuizHigherLower};
