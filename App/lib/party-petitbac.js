"use strict";
// Petit Bac Pokémon: the host picks the themes (columns) and the time, then each round
// draws a letter every Pokémon theme can answer. Players fill a private sheet; the
// first full sheet calls STOP. At the end everyone reviews the answers: they count as
// right unless Pokédle knows they are wrong (letter, unknown Pokémon, wrong type…), and
// a majority vote can turn any of them. Small spelling mistakes are forgiven. A valid
// answer earns 2 points when nobody else gave it, 1 point when shared.
const {buildCriteria,speciesOf,isRegionalForm,speciesIdOf}=require('./daily-grid');
const STOP_MS=10000,REVIEW_MS=90000,MAX_ANSWER=40,MIN_THEMES=3,MAX_THEMES=10,SOLO_COLUMNS=6,MIN_SOLO_ANSWERS=2;
const TIMES=[60,300,0],DEFAULT_TIME=300,ROUNDS=[3,5,10],DEFAULT_ROUNDS=3;
const LETTERS='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),HARD_LETTERS=['Q','W','X','Y','Z'];
const STARTER_IDS=new Set([1,2,3,4,5,6,7,8,9,152,153,154,155,156,157,158,159,160,252,253,254,255,256,257,258,259,260,387,388,389,390,391,392,393,394,395,495,496,497,498,499,500,501,502,503,650,651,652,653,654,655,656,657,658,722,723,724,725,726,727,728,729,730,810,811,812,813,814,815,816,817,818,906,907,908,909,910,911,912,913,914]);
// Themes the players judge themselves (no data to check them against).
const FREE=[
  {key:'free:move',label:'Attaque',hint:'Une capacité Pokémon'},
  {key:'free:ability',label:'Talent',hint:'Un talent de Pokémon'},
  {key:'free:item',label:'Objet',hint:'Objet, Poké Ball, CT…'},
  {key:'free:berry',label:'Baie',hint:'Une baie des jeux'},
  {key:'free:place',label:'Ville ou lieu',hint:'Ville, route, région, grotte…'},
  {key:'free:person',label:'Personnage',hint:'Dresseur, professeur, rival…'},
  {key:'free:leader',label:'Champion ou Conseil 4',hint:'Champion d’arène, Conseil 4, Maître…'},
  {key:'free:game',label:'Jeu, film ou épisode',hint:'Un titre de jeu, de film ou d’épisode'},
  {key:'free:nickname',label:'Surnom rigolo',hint:'Un surnom pour un Pokémon, le plus drôle possible'},
  {key:'free:word',label:'Mot du monde Pokémon',hint:'Tout mot lié à Pokémon'},
];
const GROUPS=[['pokemon','Pokémon'],['type','Types'],['gen','Régions'],['color','Couleurs'],['free','Libres (jugés au vote)']];
const DEFAULT_THEMES=['any','type:Eau','type:Feu','stage:1','free:move','free:place'];
// Solo sheets mix several ideas: at most one column of a kind, two for types.
const FAMILY_LIMIT={type:2,gen:1,color:1,stage:1,special:2,shape:1,size:1};
const fail=error=>({error});

function normalize(text){return String(text||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');}
function initialOf(text){return normalize(text).charAt(0).toUpperCase();}
function cleanAnswer(text){return String(text??'').replace(/[<>]/g,'').replace(/\s+/g,' ').trim().slice(0,MAX_ANSWER);}
function shuffled(list,random){const out=[...list];for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
// Edit distance with an early stop: small typos only, so the cap stays tiny.
function distance(a,b,max){
  if(Math.abs(a.length-b.length)>max)return max+1;
  let prev=Array.from({length:b.length+1},(_,j)=>j);
  for(let i=1;i<=a.length;i++){
    const row=[i];let best=i;
    for(let j=1;j<=b.length;j++){row[j]=Math.min(prev[j]+1,row[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));best=Math.min(best,row[j]);}
    if(best>max)return max+1;prev=row;
  }
  return prev[b.length];
}
function allowedTypos(name){return name.length<=4?0:name.length<=7?1:2;}

// Every theme the host can pick, with the test for the Pokémon ones (cached per catalogue).
const catalogs=new WeakMap();
function catalogFor(catalogue){
  if(catalogs.has(catalogue))return catalogs.get(catalogue);
  const grid=[...buildCriteria(catalogue).values()];
  const auto=[
    {key:'any',family:'any',label:'N’importe quel Pokémon',test:()=>true},
    ...grid,
    {key:'special:starter',family:'special',label:'Starter ou son évolution',test:p=>STARTER_IDS.has(speciesIdOf(p))},
    {key:'size:light',family:'size',label:'Pèse moins de 10 kg',test:p=>Number(p.weight)<10},
    {key:'size:small',family:'size',label:'Mesure moins de 1 m',test:p=>Number(p.height)<1},
  ];
  const groupOf=family=>['type','gen','color','free'].includes(family)?family:'pokemon';
  const entries=[...auto,...FREE.map(f=>({...f,family:'free'}))].map(c=>({...c,group:groupOf(c.family)}));
  const byKey=new Map(entries.map(c=>[c.key,c]));
  const entry=p=>({p,norm:normalize(p.name),initial:initialOf(p.name)});
  const species=speciesOf(catalogue).map(entry),regional=catalogue.filter(isRegionalForm).map(entry);
  // Méga and special forms never count; naming one says so instead of « unknown ».
  const otherForms=catalogue.filter(p=>p.isAltForm&&!isRegionalForm(p)).map(entry);
  const value={byKey,species,regional,otherForms,list:entries.map(describe)};
  catalogs.set(catalogue,value);
  return value;
}
function describe(c){return {key:c.key,family:c.family,group:c.group,label:c.label,...(c.value!==undefined?{value:c.value}:{}),...(c.hint?{hint:c.hint}:{})};}
function poolFor(cat,gens,regionalForms=false){
  const allowed=Array.isArray(gens)&&gens.length?gens.map(Number):[1,2,3,4,5,6,7,8,9];
  return (regionalForms?[...cat.species,...cat.regional]:cat.species).filter(s=>allowed.includes(Number(s.p.gen||s.p.generation)));
}
// Letters where every Pokémon theme has at least one answer in the chosen generations.
function playableLetters(catalogue,gens,themes,hard=false){
  const cat=catalogFor(catalogue),pool=poolFor(cat,gens),tests=themes.map(k=>cat.byKey.get(k)).filter(c=>c&&c.family!=='free');
  return LETTERS.filter(letter=>(hard||!HARD_LETTERS.includes(letter))&&(()=>{const starting=pool.filter(s=>s.initial===letter);return starting.length>0&&tests.every(c=>starting.some(s=>c.test(s.p)));})());
}
// A typed name finds its Pokémon even with a small mistake (never on the first letter).
function matchPokemon(text,pool){
  const name=normalize(text);if(!name)return null;
  const exact=pool.filter(s=>s.norm===name);
  if(exact.length)return {matches:exact.map(s=>s.p),fuzzy:false};
  const max=allowedTypos(name);if(!max)return null;
  let best=max+1,list=[];
  for(const s of pool){if(s.norm[0]!==name[0])continue;const d=distance(name,s.norm,max);if(d<best){best=d;list=[s.p];}else if(d===best)list.push(s.p);}
  return best<=max?{matches:list,fuzzy:true}:null;
}
// Regional forms answer with their own types and colour; the daily sheet switches them on
// from REGIONAL_FORMS_FROM, live Party Rooms at once.
function checkPokemonAnswer(text,letter,category,catalogue,gens,{regionalForms=true}={}){
  const cat=catalogFor(catalogue),answer=cleanAnswer(text);
  if(!answer)return {text:'',valid:false,reason:'empty'};
  if(initialOf(answer)!==letter)return {text:answer,valid:false,reason:'letter'};
  const found=matchPokemon(answer,poolFor(cat,gens,regionalForms));
  if(!found){
    const name=normalize(answer),form=[...cat.otherForms,...(regionalForms?[]:cat.regional)].find(s=>s.norm===name);
    return {text:answer,valid:false,reason:form?'form':'unknown'};
  }
  const c=cat.byKey.get(category.key),hit=c?found.matches.find(p=>c.test(p)):null;
  if(!hit)return {text:answer,valid:false,reason:'criterion',pokemonId:Number(found.matches[0].id),name:found.matches[0].name};
  return {text:answer,valid:true,pokemonId:Number(hit.id),name:hit.name,...(found.fuzzy?{fuzzy:true}:{})};
}
function examplesFor(letter,category,catalogue,gens){
  const cat=catalogFor(catalogue),c=cat.byKey.get(category.key);if(!c||c.family==='free')return [];
  return poolFor(cat,gens).filter(s=>s.initial===letter&&c.test(s.p)).slice(0,3).map(s=>Number(s.p.id));
}
// Solo sheets: six Pokémon columns, each with at least two answers for the letter.
function drawSoloSheet({catalogue,gens,used=[],random=Math.random,columns=SOLO_COLUMNS}){
  const cat=catalogFor(catalogue),pool=poolFor(cat,gens),single=new Set(pool.map(s=>Number(s.p.gen||s.p.generation))).size===1;
  const themes=[...cat.byKey.values()].filter(c=>c.family!=='free'&&c.family!=='any'&&!(single&&c.family==='gen'));
  const order=[...shuffled(LETTERS.filter(l=>!used.includes(l)),random),...shuffled(LETTERS.filter(l=>used.includes(l)),random)];
  for(const letter of order){
    const starting=pool.filter(s=>s.initial===letter);
    if(starting.length<columns*MIN_SOLO_ANSWERS)continue;
    const usable=shuffled(themes.filter(c=>starting.filter(s=>c.test(s.p)).length>=MIN_SOLO_ANSWERS),random),picked=[],count={};
    for(const c of usable){if(picked.length>=columns)break;if((count[c.family]||0)>=FAMILY_LIMIT[c.family])continue;picked.push(c);count[c.family]=(count[c.family]||0)+1;}
    if(picked.length===columns)return {letter,categories:picked.map(describe)};
  }
  return null;
}

/* ---------- Party Room ---------- */
function petitBacOptions(room,catalogue){
  const cat=catalogFor(catalogue);
  const themes=Array.isArray(room.bacThemes)&&room.bacThemes.length>=MIN_THEMES&&room.bacThemes.every(k=>cat.byKey.has(k))?room.bacThemes:DEFAULT_THEMES;
  return {themes,time:TIMES.includes(room.bacTime)?room.bacTime:DEFAULT_TIME,rounds:ROUNDS.includes(room.bacRounds)?room.bacRounds:DEFAULT_ROUNDS,hard:room.bacHard===true};
}
// A varied random set: any Pokémon, three Pokémon themes of different kinds, two free
// themes, kept only when at least eight letters can be played with it.
function randomThemes(catalogue,gens,random=Math.random){
  const cat=catalogFor(catalogue),all=[...cat.byKey.values()],pick=list=>list[Math.floor(random()*list.length)];
  for(let attempt=0;attempt<60;attempt++){
    const kinds=shuffled(['type','gen','color','pokemon'],random).slice(0,3);
    const themes=['any',...kinds.map(group=>pick(all.filter(c=>c.group===group&&c.key!=='any')).key),...shuffled(FREE,random).slice(0,2).map(f=>f.key)];
    if(playableLetters(catalogue,gens,themes,false).length>=8)return themes;
  }
  return DEFAULT_THEMES;
}
function setPetitBacOptions(room,payload,catalogue,random=Math.random){
  const cat=catalogFor(catalogue),next={...petitBacOptions(room,catalogue)};
  if(payload.random)next.themes=randomThemes(catalogue,room.selectedGens,random);
  else if(payload.themes!==undefined){
    const themes=Array.isArray(payload.themes)?[...new Set(payload.themes.map(String))]:[];
    if(themes.length<MIN_THEMES||themes.length>MAX_THEMES)return fail(`Choisis entre ${MIN_THEMES} et ${MAX_THEMES} thèmes.`);
    if(themes.some(k=>!cat.byKey.has(k)))return fail('Thème inconnu.');
    next.themes=themes;
  }
  if(payload.time!==undefined){if(!TIMES.includes(Number(payload.time)))return fail('Durée inconnue.');next.time=Number(payload.time);}
  if(payload.rounds!==undefined){if(!ROUNDS.includes(Number(payload.rounds)))return fail('Nombre de lettres inconnu.');next.rounds=Number(payload.rounds);}
  if(payload.hard!==undefined)next.hard=payload.hard===true;
  room.bacThemes=next.themes;room.bacTime=next.time;room.bacRounds=next.rounds;room.bacHard=next.hard;
  return {saved:true};
}
// What the room shows about the next game; the full list of themes only while setting up.
function publicOptions(room,catalogue){
  const options=petitBacOptions(room,catalogue),setup=room.status==='waiting'||room.status==='complete';
  return {...options,letters:playableLetters(catalogue,room.selectedGens,options.themes,options.hard).length,catalog:setup?catalogFor(catalogue).list:null,groups:setup?GROUPS:null,minThemes:MIN_THEMES,maxThemes:MAX_THEMES};
}
function roundPlayers(room,now=Date.now()){return room.players.filter(p=>(room.roundPlayerIds||[]).includes(p.id)&&(p.connected||Number(p.reconnectUntil)>now));}
function filledCount(player){return (player.bacAnswers||[]).filter(Boolean).length;}
function check(room,player,serial,phases){
  if(room.status!=='playing'||!room.bac)return fail('Aucune manche en cours.');
  if(serial!==room.roundSerial)return fail('Cette manche a changé.');
  if(!(room.roundPlayerIds||[]).includes(player.id))return fail('Tu regardes cette manche : tu joueras à la suivante.');
  if(!phases.includes(room.bac.phase))return fail(room.bac.phase==='review'?'Place à la vérification des réponses !':'Ce n’est plus le moment.');
  return null;
}
function startPetitBacRound(room,catalogue,random=Math.random){
  const options=petitBacOptions(room,catalogue),cat=catalogFor(catalogue);
  const letters=playableLetters(catalogue,room.selectedGens,options.themes,options.hard);
  if(!letters.length)throw new Error('Aucune lettre ne convient à ces thèmes.');
  const fresh=letters.filter(l=>!(room.bacUsedLetters||[]).includes(l)),from=fresh.length?fresh:letters,letter=from[Math.floor(random()*from.length)];
  room.bacUsedLetters=[...(room.bacUsedLetters||[]),letter].slice(-26);
  room.bac={letter,categories:options.themes.map(k=>describe(cat.byKey.get(k))),time:options.time,phase:'write',stopBy:null,votes:[],votersDone:[],verdicts:null,examples:null};
  room.target={id:0,name:'',sprite:null};
  room.roundSerial=(room.roundSerial||0)+1;
  room.status='playing';
  room.roundPlayerIds=room.players.filter(p=>p.connected).map(p=>p.id);
  for(const p of room.players){p.bacAnswers=Array(options.themes.length).fill('');p.bacResults=null;p.correct=false;p.lastGain=0;p.pickKey=null;}
}
// The whole sheet travels at once, so a slow network never mixes up the columns.
function writeAnswers(room,player,answers,serial){
  const error=check(room,player,serial,['write','stopping']);if(error)return error;
  if(!Array.isArray(answers)||answers.length!==room.bac.categories.length)return fail('Feuille invalide.');
  const before=filledCount(player);
  player.bacAnswers=answers.map(cleanAnswer);
  return {saved:true,changed:before!==filledCount(player)};
}
function stopRound(room,player,serial){
  const error=check(room,player,serial,['write','stopping']);if(error)return error;
  if(room.bac.phase==='stopping')return {already:true};
  if(filledCount(player)<room.bac.categories.length)return fail('Remplis toutes les colonnes avant de crier STOP.');
  room.bac.phase='stopping';room.bac.stopBy=player.id;
  return {stopped:true};
}
// Pokédle's first opinion on each answer; the review vote can change it.
function verdictFor(text,letter,category,catalogue,gens){
  if(category.family!=='free')return checkPokemonAnswer(text,letter,category,catalogue,gens);
  const answer=cleanAnswer(text);
  if(!answer)return {text:'',valid:false,reason:'empty'};
  if(initialOf(answer)!==letter)return {text:answer,valid:false,reason:'letter'};
  return {text:answer,valid:true};
}
function openReview(room,catalogue){
  const bac=room.bac;bac.verdicts={};
  for(const p of room.players.filter(p=>(room.roundPlayerIds||[]).includes(p.id)))bac.verdicts[p.id]=bac.categories.map((c,i)=>verdictFor(p.bacAnswers?.[i],bac.letter,c,catalogue,room.selectedGens));
  bac.phase='review';
}
function verdict(room,author,index){return room.bac.verdicts?.[author]?.[index]||null;}
// An answer keeps Pokédle's opinion unless more than half of the other players vote the other way.
function finalValid(room,author,index){
  const v=verdict(room,author,index);if(!v||!v.text)return false;
  const others=room.players.filter(p=>(room.roundPlayerIds||[]).includes(p.id)&&p.id!==author).length;
  const against=room.bac.votes.filter(x=>x.author===author&&x.index===index&&x.valid!==v.valid).length;
  return others>0&&against*2>others?!v.valid:v.valid;
}
function voteAnswer(room,voter,author,index,valid,serial){
  const error=check(room,voter,serial,['review']);if(error)return error;
  const v=verdict(room,author,index);
  if(!v||!v.text)return fail('Cette réponse n’existe pas.');
  if(author===voter.id)return fail('Tu ne votes pas pour toi-même.');
  room.bac.votes=room.bac.votes.filter(x=>!(x.voter===voter.id&&x.author===author&&x.index===index));
  if(Boolean(valid)!==v.valid)room.bac.votes.push({voter:voter.id,author,index,valid:Boolean(valid)});
  return {voted:true};
}
function finishVoting(room,voter,serial){
  const error=check(room,voter,serial,['review']);if(error)return error;
  if(!room.bac.votersDone.includes(voter.id))room.bac.votersDone.push(voter.id);
  return {done:true,allDone:roundPlayers(room).every(p=>room.bac.votersDone.includes(p.id))};
}
// Two answers are the same when they name the same Pokémon, or differ by a small typo.
function sameAnswerGroups(entries){
  const groups=[];
  const same=(a,b)=>a.pokemonId||b.pokemonId?a.pokemonId===b.pokemonId:a.norm===b.norm||(Math.min(a.norm.length,b.norm.length)>=4&&distance(a.norm,b.norm,1)<=1);
  for(const e of entries){const g=groups.find(group=>group.some(o=>same(e,o)));if(g)g.push(e);else groups.push([e]);}
  return groups;
}
function scorePetitBac(room,catalogue){
  const bac=room.bac;if(!bac.verdicts)openReview(room,catalogue);
  const players=room.players.filter(p=>(room.roundPlayerIds||[]).includes(p.id));
  const sheets=players.map(p=>bac.categories.map((c,i)=>{
    const v=verdict(room,p.id,i)||{text:'',valid:false,reason:'empty'},valid=finalValid(room,p.id,i);
    return {text:v.text,...(v.name&&normalize(v.name)!==normalize(v.text)?{name:v.name}:{}),valid,
      ...(!valid&&v.text?{reason:v.valid?'vote':v.reason}:{}),...(valid&&!v.valid?{accepted:true}:{}),pokemonId:valid?v.pokemonId||null:null,points:0};
  }));
  bac.categories.forEach((c,i)=>{
    const entries=sheets.map((sheet,k)=>({k,pokemonId:sheet[i].pokemonId,norm:normalize(sheet[i].text),valid:sheet[i].valid})).filter(e=>e.valid);
    for(const group of sameAnswerGroups(entries))for(const e of group){sheets[e.k][i].points=group.length>1?1:2;if(group.length>1)sheets[e.k][i].shared=true;}
  });
  room.bacStats=room.bacStats||{};
  for(const p of room.players){
    const index=players.indexOf(p),sheet=index>=0?sheets[index]:null;
    p.bacResults=sheet?sheet.map(({pokemonId,...rest})=>rest):null;p.lastGain=sheet?sheet.reduce((sum,r)=>sum+r.points,0):0;
    p.score=(Number(p.score)||0)+p.lastGain;p.correct=p.lastGain>0;
    if(!sheet)continue;
    // Running totals for the end-of-game recap.
    const stats=room.bacStats[p.id]||(room.bacStats[p.id]={points:0,unique:0,shared:0,refused:0,stops:0,rounds:0});
    stats.points+=p.lastGain;stats.rounds+=1;stats.unique+=sheet.filter(r=>r.points===2).length;stats.shared+=sheet.filter(r=>r.points===1).length;
    stats.refused+=sheet.filter(r=>r.text&&!r.valid).length;if(bac.stopBy===p.id)stats.stops+=1;
  }
  bac.examples=bac.categories.map(c=>examplesFor(bac.letter,c,catalogue,room.selectedGens));
  bac.phase='done';
}
// Time is up, STOP ran out, or everyone has reviewed: on to the review, then the score.
function advancePetitBac(room,catalogue){
  if(!room.bac||room.bac.phase==='done')return 'scored';
  if((room.bac.phase==='write'||room.bac.phase==='stopping')&&room.players.some(p=>(room.roundPlayerIds||[]).includes(p.id)&&filledCount(p))){openReview(room,catalogue);return 'review';}
  scorePetitBac(room,catalogue);return 'scored';
}
function publicPetitBac(room,viewerId){
  const bac=room.bac;if(!bac)return null;
  const viewer=room.players.find(p=>p.id===viewerId),playing=viewer&&(room.roundPlayerIds||[]).includes(viewer.id);
  const players=room.players.filter(p=>(room.roundPlayerIds||[]).includes(p.id));
  return {
    mode:'petitbac',roundSerial:room.roundSerial,letter:bac.letter,categories:bac.categories,time:bac.time,phase:bac.phase,stopBy:bac.stopBy,
    mine:playing?[...(viewer.bacAnswers||[])]:null,
    progress:players.map(p=>({id:p.id,filled:filledCount(p),voted:bac.votersDone.includes(p.id)})),
    ballot:bac.phase==='review'?bac.categories.flatMap((c,i)=>players.map(p=>({p,v:verdict(room,p.id,i)})).filter(({v})=>v&&v.text).map(({p,v})=>{
      const mine=bac.votes.find(x=>x.voter===viewerId&&x.author===p.id&&x.index===i);
      return {author:p.id,index:i,text:v.text,...(v.name&&normalize(v.name)!==normalize(v.text)?{name:v.name}:{}),own:p.id===viewerId,suggested:v.valid,...(v.valid?{}:{reason:v.reason}),
        myVote:mine?mine.valid:v.valid,against:bac.votes.filter(x=>x.author===p.id&&x.index===i&&x.valid!==v.valid).length,valid:finalValid(room,p.id,i)};
    })):null,
    results:bac.phase==='done'?players.map(p=>({playerId:p.id,nickname:p.nickname,answers:p.bacResults||[],gained:Number(p.lastGain)||0})).sort((a,b)=>b.gained-a.gained):null,
    examples:bac.phase==='done'?bac.examples:null,
    recap:room.status==='complete'&&bac.phase==='done'?gameRecap(room):null,
  };
}
// End of the game: everyone's totals and three titles.
function gameRecap(room){
  const rows=room.players.filter(p=>room.bacStats?.[p.id]).map(p=>({playerId:p.id,nickname:p.nickname,...room.bacStats[p.id]})).sort((a,b)=>b.points-a.points||b.unique-a.unique);
  const best=(field,min=1)=>{const top=Math.max(0,...rows.map(r=>r[field]));return top>=min?rows.filter(r=>r[field]===top).map(r=>r.nickname):[];};
  return {rows,titles:[
    {key:'champion',label:'Champion',players:best('points',0),value:Math.max(0,...rows.map(r=>r.points)),unit:'points'},
    {key:'original',label:'Le plus original',players:best('unique'),value:Math.max(0,...rows.map(r=>r.unique)),unit:'réponses uniques'},
    {key:'stopper',label:'Roi du STOP',players:best('stops'),value:Math.max(0,...rows.map(r=>r.stops)),unit:'STOP'},
  ].filter(t=>t.players.length)};
}
// A reconnecting player keeps their sheet, their verdicts and their votes.
function rekeyPetitBac(room,previousId,nextId){
  const bac=room.bac;if(!bac)return;
  if(bac.stopBy===previousId)bac.stopBy=nextId;
  for(const v of bac.votes){if(v.voter===previousId)v.voter=nextId;if(v.author===previousId)v.author=nextId;}
  bac.votersDone=bac.votersDone.map(id=>id===previousId?nextId:id);
  if(bac.verdicts&&Object.prototype.hasOwnProperty.call(bac.verdicts,previousId)){bac.verdicts[nextId]=bac.verdicts[previousId];delete bac.verdicts[previousId];}
  if(room.bacStats&&Object.prototype.hasOwnProperty.call(room.bacStats,previousId)){room.bacStats[nextId]=room.bacStats[previousId];delete room.bacStats[previousId];}
}

/* ---------- Solo against the clock: the server draws and corrects, nothing is stored ---------- */
const SOLO_SECONDS=75,SOLO_MAX_THEMES=8;
// About 12 seconds per theme: 75 seconds for six.
function soloSeconds(columns){return 45+5*columns;}
function soloSheetFor(catalogue,gens,themes,used=[],random=Math.random){
  const letters=playableLetters(catalogue,gens,themes),fresh=letters.filter(l=>!used.includes(l)),from=fresh.length?fresh:letters;
  if(!from.length)return null;
  const cat=catalogFor(catalogue);
  return {letter:from[Math.floor(random()*from.length)],categories:themes.map(k=>describe(cat.byKey.get(k)))};
}
function parseGens(value){
  const gens=String(value||'').split(',').map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=9);
  return gens.length?[...new Set(gens)]:[1,2,3,4,5,6,7,8,9];
}
function mountPetitBacSolo({app,express,pokemon}){
  const cat=catalogFor(pokemon),hits=new Map();
  const limited=req=>{
    const now=Date.now(),key=String(req.ip),entry=hits.get(key);
    if(hits.size>5000)for(const[k,v]of hits)if(now-v.at>60000)hits.delete(k);
    if(!entry||now-entry.at>60000){hits.set(key,{at:now,count:1});return false;}
    return ++entry.count>60;
  };
  app.get('/api/petitbac/solo',(req,res)=>{
    res.set('Cache-Control','no-store');
    if(limited(req))return res.status(429).json({ok:false,error:'rate_limited'});
    const used=String(req.query.exclude||'').toUpperCase().split('').filter(l=>LETTERS.includes(l)),gens=parseGens(req.query.gens);
    const chosen=req.query.themes?[...new Set(String(req.query.themes).split(',').filter(Boolean))]:null;
    if(chosen&&(chosen.length<MIN_THEMES||chosen.length>SOLO_MAX_THEMES||chosen.some(k=>!cat.byKey.has(k)||cat.byKey.get(k).family==='free')))return res.status(400).json({ok:false,error:'invalid_themes'});
    const sheet=chosen?soloSheetFor(pokemon,gens,chosen,used):drawSoloSheet({catalogue:pokemon,gens,used});
    if(!sheet)return res.status(409).json({ok:false,error:'no_letter'});
    res.json({ok:true,...sheet,seconds:soloSeconds(sheet.categories.length)});
  });
  // The themes a solo player can pick (the Pokémon ones, checked by the data).
  app.get('/api/petitbac/themes',(req,res)=>{res.set('Cache-Control','public, max-age=3600');res.json({ok:true,themes:cat.list.filter(c=>c.family!=='free'&&c.family!=='any'),groups:GROUPS.filter(([g])=>g!=='free'),min:MIN_THEMES,max:SOLO_MAX_THEMES});});
  app.post('/api/petitbac/solo/check',express.json({limit:'4kb'}),(req,res)=>{
    res.set('Cache-Control','no-store');
    if(limited(req))return res.status(429).json({ok:false,error:'rate_limited'});
    const body=req.body||{},letter=String(body.letter||''),keys=Array.isArray(body.keys)?body.keys.map(String):[],answers=Array.isArray(body.answers)?body.answers:[];
    if(!/^[A-Z]$/.test(letter)||!keys.length||keys.length>SOLO_MAX_THEMES||answers.length!==keys.length||keys.some(k=>!cat.byKey.has(k)||cat.byKey.get(k).family==='free'))return res.status(400).json({ok:false,error:'invalid_sheet'});
    const gens=parseGens(body.gens);
    res.json({ok:true,results:keys.map((key,i)=>checkPokemonAnswer(answers[i],letter,{key},pokemon,gens)),examples:keys.map(key=>examplesFor(letter,{key},pokemon,gens))});
  });
}

module.exports={soloSheetFor,soloSeconds,STOP_MS,REVIEW_MS,TIMES,ROUNDS,HARD_LETTERS,DEFAULT_THEMES,FREE,SOLO_SECONDS,normalize,initialOf,distance,catalogFor,playableLetters,matchPokemon,checkPokemonAnswer,examplesFor,drawSoloSheet,
  petitBacOptions,setPetitBacOptions,randomThemes,publicOptions,startPetitBacRound,writeAnswers,stopRound,voteAnswer,finishVoting,advancePetitBac,scorePetitBac,publicPetitBac,rekeyPetitBac,mountPetitBacSolo};
