'use strict';
const WRITTEN = require('../src/script.00b.quiz-bank');
const STATS = require('../base-stats.json');
const {TYPE_CHART: QUIZ_TYPE_CHART} = require('./seo-guides');
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
  // Quiz v2 (8/11/2026, « go quiz ») : 15 questions qu'on ne devine pas d'un coup d'œil, de plus en plus dures.
  // Avant : 4 culture, 4 « type principal », 4 « génération », 3 « n° Pokédex » (n−10, n−1, n+1, n+10 : la bonne
  // était toujours celle du milieu). Maintenant : 3 silhouettes, 3 table des types, 2 stats, 2 taille/poids,
  // 2 générations, 2 culture, 1 n° Pokédex ; questions 1-5 faciles, 6-10 moyennes, 11-15 difficiles.
  const REGIONS=['Kanto','Johto','Hoenn','Sinnoh','Unys','Kalos','Alola','Galar','Paldea'];
  const STAT_LABELS=[['PV','Lequel a le plus de PV ?'],['Attaque','Lequel a la meilleure Attaque ?'],['Défense','Lequel a la meilleure Défense ?'],
    ['Attaque Spé.','Lequel a la meilleure Attaque Spéciale ?'],['Défense Spé.','Lequel a la meilleure Défense Spéciale ?'],['Vitesse','Lequel est le plus rapide ?']];
  const QUIZ_PLAN=[['who',1],['types',1],['size',1],['gen',1],['gen',1],['who',2],['types',2],['stats',2],['size',2],['culture',2],
    ['who',3],['types',3],['stats',3],['culture',3],['dex',3]];
  const chart=QUIZ_TYPE_CHART, allTypes=Object.keys(chart);
  const mult=(attack,p)=>[p.type1,p.type2].filter(Boolean).reduce((m,t)=>m*(chart[attack].no.includes(t)?0:chart[attack].super.includes(t)?2:chart[attack].not.includes(t)?0.5:1),1);
  const typesOf=p=>[p.type1,p.type2].filter(Boolean);
  const nf=(n,d=1)=>Number(n).toLocaleString('fr-FR',{maximumFractionDigits:d});
  const xLabel=m=>m===0?'×0':m===0.25?'×¼':m===0.5?'×½':'×'+m;
  const genOf=p=>Number(p.gen||p.generation);
  const pickOne=list=>list[randomInt(list.length)];
  function quiz() {
    const used=new Set(), written=shuffle(WRITTEN), withStats=base.filter(p=>Array.isArray(statsOf(p))&&statsOf(p).length===6);
    const free=list=>list.filter(p=>!used.has(p.id));
    const take=p=>{used.add(p.id);return p;};
    // Une question à 4 choix ; « art » = les Pokémon montrés, dans l'ordre des choix quand il y en a un par choix.
    const build=(kind,level,question,correct,distractors,extra={})=>{
      const options=shuffle([correct,...distractors.slice(0,3)]);
      return {kind,level,question,options,answer:options.indexOf(correct),...extra};
    };
    const gens={
      who(level){
        const pool=free(level===1?base.filter(p=>genOf(p)<=2):base), p=take(pickOne(pool));
        let near=base.filter(o=>o.id!==p.id&&(level===1?genOf(o)===genOf(p)&&o.type1!==p.type1:level===2?o.type1===p.type1:o.type1===p.type1&&o.color===p.color));
        if(near.length<3)near=base.filter(o=>o.id!==p.id&&o.type1===p.type1);
        const names=[...new Set(shuffle(near).map(o=>o.name))].filter(n=>n!==p.name);
        return build('who',level,'Quel Pokémon se cache derrière cette ombre ?',p.name,names,
          {artIds:[p.id],silhouette:true,explain:'C’était '+p.name+' (n° '+p.id+', '+typesOf(p).join(' / ')+').'});
      },
      types(level){
        for(const p of shuffle(free(base))){
          const byM=allTypes.map(t=>[t,mult(t,p)]);
          const ofM=f=>shuffle(byM.filter(([,m])=>f(m)).map(([t])=>t));
          let q,correct,others;
          if(level===1){ if(p.type2)continue; correct=ofM(m=>m===2)[0]; others=ofM(m=>m<=1&&m>0); q='Quel type est super efficace contre '+p.name+' ?'; }
          else if(level===2){ correct=ofM(m=>m===0)[0]; others=ofM(m=>m>=1); q='Quel type d’attaque n’a aucun effet sur '+p.name+' ?'; }
          else { correct=ofM(m=>m===4)[0]; others=[...ofM(m=>m===2),...ofM(m=>m===1)]; q='Quelle attaque fait le plus de dégâts à '+p.name+' ?'; }
          if(!correct||others.length<3)continue;
          take(p);const d=others.slice(0,3), ty=typesOf(p).join(' / ');
          const tail=d.map(t=>t+' '+xLabel(mult(t,p))).join(', ');
          const explain=level===3?p.name+' est '+ty+' : '+correct+' fait ×4 (×2 sur chaque type). Les autres : '+tail+'.'
            :level===2?p.name+' est '+ty+' : les attaques '+correct+' ne lui font rien (×0). Les autres : '+tail+'.'
            :p.name+' est '+ty+' : '+correct+' fait ×2. Les autres : '+tail+'.';
          return build('types',level,q,correct,d,{artIds:[p.id],types:typesOf(p),explain});
        }
        throw fail('unavailable',503);
      },
      stats(level){
        const k=randomInt(6), list=shuffle(free(withStats));
        for(let at=0;at+4<=list.length;at++){
          const four=list.slice(at,at+4);
          if(four.length<4||new Set(four.map(p=>p.name)).size<4)continue;
          const v=four.map(p=>statsOf(p)[k]), sorted=v.slice().sort((a,b)=>b-a), gap=sorted[0]-sorted[1];
          if(level===2?gap<15:(gap<1||gap>8||sorted[0]-sorted[3]>35))continue;
          const best=four[v.indexOf(sorted[0])];four.forEach(take);
          const order=four.map((p,i)=>[p,v[i]]).sort((a,b)=>b[1]-a[1]);
          const options=shuffle(four.map(p=>p.name)), art=options.map(n=>four.find(p=>p.name===n).id);
          return {kind:'stats',level,question:STAT_LABELS[k][1],options,answer:options.indexOf(best.name),artIds:art,
            explain:STAT_LABELS[k][0]+' de base : '+order.map(([p,x])=>p.name+' '+x).join(', ')+'.'};
        }
        throw fail('unavailable',503);
      },
      size(level){
        const heavy=randomInt(2)===0, key=heavy?'weight':'height', unit=heavy?' kg':' m';
        const list=shuffle(free(base.filter(p=>Number(p[key])>0)));
        for(let at=0;at+4<=list.length;at++){
          const four=list.slice(at,at+4);
          if(four.length<4||new Set(four.map(p=>p.name)).size<4)continue;
          const v=four.map(p=>Number(p[key])), sorted=v.slice().sort((a,b)=>b-a);
          if(level===1?sorted[0]<sorted[1]*2:(sorted[0]===sorted[1]||sorted[0]>sorted[1]*1.4||sorted[0]>sorted[3]*3))continue;
          const best=four[v.indexOf(sorted[0])];four.forEach(take);
          const options=shuffle(four.map(p=>p.name)), art=options.map(n=>four.find(p=>p.name===n).id);
          const order=four.slice().sort((a,b)=>Number(b[key])-Number(a[key]));
          return {kind:'size',level,question:heavy?'Lequel est le plus lourd ?':'Lequel est le plus grand ?',options,answer:options.indexOf(best.name),artIds:art,
            explain:(heavy?'Poids : ':'Taille : ')+order.map(p=>p.name+' '+nf(p[key])+unit).join(', ')+'.'};
        }
        throw fail('unavailable',503);
      },
      gen(level){
        const p=take(pickOne(free(base))), g=genOf(p);
        const far=shuffle([1,2,3,4,5,6,7,8,9].filter(x=>Math.abs(x-g)>=2)), near=shuffle([1,2,3,4,5,6,7,8,9].filter(x=>x!==g));
        const d=(far.length>=3?far:near).slice(0,3).map(x=>'Gen '+x);
        return build('gen',level,p.name+' est apparu dans quelle génération ?','Gen '+g,d,
          {artIds:[p.id],explain:p.name+' est apparu en Gen '+g+' ('+REGIONS[g-1]+').'});
      },
      culture(level){
        // 9/11/2026 : questions écrites avec un niveau (2 ou 3) et une explication ; les réponses sont mélangées
        // (dans la banque, la bonne est souvent la première).
        const at=written.findIndex(q=>q.level===level), w=at>=0?written.splice(at,1)[0]:written.pop();if(!w)throw fail('unavailable',503);
        const right=w.options[w.answer];
        return build('culture',level,w.question,right,w.options.filter((_,i)=>i!==w.answer),w.explain?{explain:w.explain}:{});
      },
      dex(level){
        const offsets=shuffle([...Array(80).keys()].map(i=>i-40).filter(o=>o!==0));
        for(const p of shuffle(free(base))){
          const others=[];for(const o of offsets){const x=base.find(q=>q.id===p.id+o);if(x&&x.name!==p.name&&!others.includes(x))others.push(x);if(others.length===3)break;}
          if(others.length<3)continue;
          take(p);
          return build('dex',level,'Lequel porte le n° '+p.id+' du Pokédex ?',p.name,others.map(o=>o.name),
            {explain:'N° '+p.id+' : '+p.name+'. Les autres : '+others.map(o=>o.name+' n° '+o.id).join(', ')+'.'});
        }
        throw fail('unavailable',503);
      }
    };
    const byLevel=[1,2,3].map(l=>shuffle(QUIZ_PLAN.filter(([,lv])=>lv===l)).map(([kind,lv])=>gens[kind](lv)));
    const picked=byLevel.flat();
    if(picked.length!==15||new Set(picked.map(q=>q.question+'|'+q.options.join('|'))).size!==15)throw fail('unavailable',503);
    return picked;
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
  const publicQuizQuestion=q=>({question:q.question,options:q.options,kind:q.kind,level:q.level||null,
    ...(Array.isArray(q.art)?{art:q.art}:{}),...(q.silhouette?{silhouette:true}:{}),...(Array.isArray(q.types)?{types:q.types}:{})});
  function view(s) {
    const q=s.question,revealed=s.phase!=='playing';
    return s.mode==='quiz'?{
      total:15,question:publicQuizQuestion(q),history:s.history,
      ...(s.phase==='reveal'&&s.round<14 ? {nextQuestion:publicQuizQuestion(s.questions[s.round+1])}:{}),
      ...(revealed?{reveal:{answer:q.answer,...(q.explain?{explain:q.explain}:{})}}:{})
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
      s.nextAt=+clock()+(s.mode==='higher-lower-rush'?900:1000);
    }
  }
  function next(s) {
    if(s.nextAt&&+clock()<s.nextAt)throw fail('round_wait');
    s.round++;s.phase='playing';s.answer=null;question(s);
  }
  return {init,view,answer,next,expire,result};
}
module.exports={MODES,createQuizHigherLower};
