"use strict";
// Petit Bac Pokémon: one letter, six columns, one answer per column that starts with
// the letter. Pokémon columns (type, region, colour…) are checked on our data; free
// columns (attack, place, character…) are an option the players judge by vote.
// A valid answer earns 2 points when nobody else gave it, 1 point when shared.
const {buildCriteria,speciesOf}=require('./daily-grid');
const WRITE_MS=90000,STOP_MS=10000,VOTE_MS=45000,COLUMNS=6,FREE_COLUMNS=2,MAX_ANSWER=40,MIN_ANSWERS=2;
const LETTERS='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const FREE=[
  {key:'free:move',label:'Attaque',hint:'Une capacité Pokémon'},
  {key:'free:place',label:'Lieu',hint:'Ville, route, région…'},
  {key:'free:person',label:'Personnage',hint:'Dresseur, champion, professeur…'},
  {key:'free:item',label:'Objet',hint:'Objet, baie, Poké Ball…'},
  {key:'free:ability',label:'Talent',hint:'Un talent de Pokémon'},
];
// At most one column of a kind, two for types: a sheet mixes several ideas.
const FAMILY_LIMIT={type:2,gen:1,color:1,stage:1,special:1,shape:1,size:1};
const fail=error=>({error});

function normalize(text){return String(text||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');}
function initialOf(text){return normalize(text).charAt(0).toUpperCase();}
function cleanAnswer(text){return String(text??'').replace(/[<>]/g,'').replace(/\s+/g,' ').trim().slice(0,MAX_ANSWER);}
function shuffled(list,random){const out=[...list];for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
function describe(c){return {key:c.key,family:c.family,label:c.label,...(c.value!==undefined?{value:c.value}:{}),...(c.hint?{hint:c.hint}:{})};}
function poolFor(catalogue,gens){
  const allowed=Array.isArray(gens)&&gens.length?gens.map(Number):[1,2,3,4,5,6,7,8,9];
  return speciesOf(catalogue).filter(p=>allowed.includes(Number(p.gen||p.generation)));
}
// A letter is drawn only when every Pokémon column has at least two answers for it.
function drawSheet({catalogue,gens,used=[],random=Math.random,free=0}){
  const species=poolFor(catalogue,gens),needed=COLUMNS-free,single=new Set(species.map(p=>Number(p.gen||p.generation))).size===1;
  // With a single generation the region column would accept everything.
  const criteria=[...buildCriteria(catalogue).values()].filter(c=>!(single&&c.family==='gen'));
  // Fresh letters first; letters already played this game only when no fresh one works.
  const order=[...shuffled(LETTERS.filter(l=>!used.includes(l)),random),...shuffled(LETTERS.filter(l=>used.includes(l)),random)];
  for(const letter of order){
    const starting=species.filter(p=>initialOf(p.name)===letter);
    if(starting.length<needed*MIN_ANSWERS)continue;
    const usable=shuffled(criteria.filter(c=>starting.filter(c.test).length>=MIN_ANSWERS),random),picked=[],count={};
    for(const c of usable){if(picked.length>=needed)break;if((count[c.family]||0)>=FAMILY_LIMIT[c.family])continue;picked.push(c);count[c.family]=(count[c.family]||0)+1;}
    if(picked.length<needed)continue;
    const freeColumns=shuffled(FREE,random).slice(0,free).map(f=>({...f,family:'free'}));
    return {letter,categories:[...picked.map(describe),...freeColumns]};
  }
  return null;
}
// Checks one Pokémon answer: right letter, a known Pokémon, and the column's criterion.
function checkPokemonAnswer(text,letter,category,catalogue,gens,criteria=buildCriteria(catalogue)){
  const answer=cleanAnswer(text);
  if(!answer)return {text:'',valid:false,reason:'empty'};
  if(initialOf(answer)!==letter)return {text:answer,valid:false,reason:'letter'};
  const name=normalize(answer),matches=poolFor(catalogue,gens).filter(p=>normalize(p.name)===name);
  if(!matches.length)return {text:answer,valid:false,reason:'unknown'};
  const c=criteria.get(category.key),hit=c?matches.find(p=>c.test(p)):null;
  if(!hit)return {text:answer,valid:false,reason:'criterion',pokemonId:Number(matches[0].id)};
  return {text:hit.name,valid:true,pokemonId:Number(hit.id),key:'p'+hit.id};
}
function examplesFor(letter,category,catalogue,gens,criteria){
  const c=criteria.get(category.key);if(!c)return [];
  return poolFor(catalogue,gens).filter(p=>initialOf(p.name)===letter&&c.test(p)).slice(0,3).map(p=>Number(p.id));
}
function roundPlayers(room,now=Date.now()){return room.players.filter(p=>(room.roundPlayerIds||[]).includes(p.id)&&(p.connected||Number(p.reconnectUntil)>now));}
function filledCount(player){return (player.bacAnswers||[]).filter(Boolean).length;}
function check(room,player,serial,phases){
  if(room.status!=='playing'||!room.bac)return fail('Aucune manche en cours.');
  if(serial!==room.roundSerial)return fail('Cette manche a changé.');
  if(!(room.roundPlayerIds||[]).includes(player.id))return fail('Tu regardes cette manche : tu joueras à la suivante.');
  if(!phases.includes(room.bac.phase))return fail(room.bac.phase==='vote'?'Place au vote !':'Ce n’est plus le moment.');
  return null;
}

function startPetitBacRound(room,catalogue,random=Math.random){
  const sheet=drawSheet({catalogue,gens:room.selectedGens,used:room.bacUsedLetters||[],random,free:room.bacFree?FREE_COLUMNS:0});
  if(!sheet)throw new Error('Aucune lettre jouable pour ces générations.');
  room.bacUsedLetters=[...(room.bacUsedLetters||[]),sheet.letter].slice(-20);
  room.bac={letter:sheet.letter,categories:sheet.categories,phase:'write',stopBy:null,votes:[],votersDone:[],examples:null};
  room.target={id:0,name:'',sprite:null};
  room.roundSerial=(room.roundSerial||0)+1;
  room.status='playing';
  room.roundPlayerIds=room.players.filter(p=>p.connected).map(p=>p.id);
  for(const p of room.players){p.bacAnswers=Array(sheet.categories.length).fill('');p.bacResults=null;p.correct=false;p.lastGain=0;p.pickKey=null;}
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
function hasBallot(room){
  return room.bac.categories.some((c,i)=>c.family==='free'&&roundPlayers(room).some(p=>p.bacAnswers?.[i]));
}
function voteAnswer(room,voter,author,index,valid,serial){
  const error=check(room,voter,serial,['vote']);if(error)return error;
  const category=room.bac.categories[index],target=room.players.find(p=>p.id===author);
  if(!category||category.family!=='free')return fail('On ne vote que sur les colonnes libres.');
  if(!target||!target.bacAnswers?.[index])return fail('Cette réponse n’existe pas.');
  if(author===voter.id)return fail('Tu ne votes pas pour toi-même.');
  room.bac.votes=room.bac.votes.filter(v=>!(v.voter===voter.id&&v.author===author&&v.index===index));
  room.bac.votes.push({voter:voter.id,author,index,valid:Boolean(valid)});
  return {voted:true};
}
function finishVoting(room,voter,serial){
  const error=check(room,voter,serial,['vote']);if(error)return error;
  if(!room.bac.votersDone.includes(voter.id))room.bac.votersDone.push(voter.id);
  return {done:true,allDone:roundPlayers(room).every(p=>room.bac.votersDone.includes(p.id))};
}
// A free answer stays valid unless more than half of the other players reject it.
function freeAnswerValid(room,author,index){
  const others=room.players.filter(p=>(room.roundPlayerIds||[]).includes(p.id)&&p.id!==author).length;
  const rejected=room.bac.votes.filter(v=>v.author===author&&v.index===index&&!v.valid).length;
  return others===0||rejected*2<=others;
}
function scorePetitBac(room,catalogue){
  const bac=room.bac,criteria=buildCriteria(catalogue),players=room.players.filter(p=>(room.roundPlayerIds||[]).includes(p.id));
  const sheets=players.map(p=>bac.categories.map((c,i)=>{
    const text=p.bacAnswers?.[i]||'';
    if(c.family!=='free')return checkPokemonAnswer(text,bac.letter,c,catalogue,room.selectedGens,criteria);
    const answer=cleanAnswer(text);
    if(!answer)return {text:'',valid:false,reason:'empty'};
    if(initialOf(answer)!==bac.letter)return {text:answer,valid:false,reason:'letter'};
    return freeAnswerValid(room,p.id,i)?{text:answer,valid:true,key:'f'+normalize(answer)}:{text:answer,valid:false,reason:'vote'};
  }));
  bac.categories.forEach((c,i)=>{
    const keys=sheets.map(sheet=>sheet[i].valid?sheet[i].key:null);
    sheets.forEach(sheet=>{const r=sheet[i];r.points=r.valid?(keys.filter(k=>k===r.key).length>1?1:2):0;r.shared=r.valid&&r.points===1;delete r.key;});
  });
  for(const p of room.players){
    const index=players.indexOf(p),sheet=index>=0?sheets[index]:null;
    p.bacResults=sheet;p.lastGain=sheet?sheet.reduce((sum,r)=>sum+r.points,0):0;
    p.score=(Number(p.score)||0)+p.lastGain;p.correct=p.lastGain>0;
  }
  bac.examples=bac.categories.map(c=>c.family==='free'?[]:examplesFor(bac.letter,c,catalogue,room.selectedGens,criteria));
  bac.phase='done';
}
// Time is up or everyone has voted: on to the vote if free answers need one, else the score.
function advancePetitBac(room,catalogue){
  if(!room.bac||room.bac.phase==='done')return 'scored';
  if((room.bac.phase==='write'||room.bac.phase==='stopping')&&hasBallot(room)){room.bac.phase='vote';return 'vote';}
  scorePetitBac(room,catalogue);return 'scored';
}
function publicPetitBac(room,viewerId){
  const bac=room.bac;if(!bac)return null;
  const viewer=room.players.find(p=>p.id===viewerId),playing=viewer&&(room.roundPlayerIds||[]).includes(viewer.id);
  const players=room.players.filter(p=>(room.roundPlayerIds||[]).includes(p.id));
  return {
    mode:'petitbac',roundSerial:room.roundSerial,letter:bac.letter,categories:bac.categories,phase:bac.phase,stopBy:bac.stopBy,
    mine:playing?[...(viewer.bacAnswers||[])]:null,
    progress:players.map(p=>({id:p.id,filled:filledCount(p),voted:bac.votersDone.includes(p.id)})),
    ballot:bac.phase==='vote'?bac.categories.flatMap((c,i)=>c.family!=='free'?[]:players.filter(p=>p.bacAnswers?.[i]).map(p=>{
      const mine=bac.votes.find(v=>v.voter===viewerId&&v.author===p.id&&v.index===i);
      return {author:p.id,index:i,text:p.bacAnswers[i],own:p.id===viewerId,myVote:mine?mine.valid:null};
    })):null,
    results:bac.phase==='done'?players.map(p=>({playerId:p.id,nickname:p.nickname,answers:p.bacResults||[],gained:Number(p.lastGain)||0})).sort((a,b)=>b.gained-a.gained):null,
    examples:bac.phase==='done'?bac.examples:null,
  };
}
// Leaving players keep their sheet; a reconnecting player keeps their votes.
function rekeyPetitBac(room,previousId,nextId){
  const bac=room.bac;if(!bac)return;
  if(bac.stopBy===previousId)bac.stopBy=nextId;
  for(const v of bac.votes){if(v.voter===previousId)v.voter=nextId;if(v.author===previousId)v.author=nextId;}
  bac.votersDone=bac.votersDone.map(id=>id===previousId?nextId:id);
}

// Solo against the clock: the server draws a sheet and checks it, nothing is stored.
const SOLO_SECONDS=75;
function parseGens(value){
  const gens=String(value||'').split(',').map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=9);
  return gens.length?[...new Set(gens)]:[1,2,3,4,5,6,7,8,9];
}
function mountPetitBacSolo({app,express,pokemon}){
  const criteria=buildCriteria(pokemon),hits=new Map();
  const limited=req=>{
    const now=Date.now(),key=String(req.ip),entry=hits.get(key);
    if(hits.size>5000)for(const[k,v]of hits)if(now-v.at>60000)hits.delete(k);
    if(!entry||now-entry.at>60000){hits.set(key,{at:now,count:1});return false;}
    return ++entry.count>60;
  };
  app.get('/api/petitbac/solo',(req,res)=>{
    res.set('Cache-Control','no-store');
    if(limited(req))return res.status(429).json({ok:false,error:'rate_limited'});
    const used=String(req.query.exclude||'').toUpperCase().split('').filter(l=>LETTERS.includes(l));
    const sheet=drawSheet({catalogue:pokemon,gens:parseGens(req.query.gens),used});
    if(!sheet)return res.status(409).json({ok:false,error:'no_letter'});
    res.json({ok:true,...sheet,seconds:SOLO_SECONDS});
  });
  app.post('/api/petitbac/solo/check',express.json({limit:'4kb'}),(req,res)=>{
    res.set('Cache-Control','no-store');
    if(limited(req))return res.status(429).json({ok:false,error:'rate_limited'});
    const body=req.body||{},letter=String(body.letter||''),keys=Array.isArray(body.keys)?body.keys.map(String):[],answers=Array.isArray(body.answers)?body.answers:[];
    if(!/^[A-Z]$/.test(letter)||!keys.length||keys.length>8||answers.length!==keys.length||keys.some(k=>!criteria.has(k)))return res.status(400).json({ok:false,error:'invalid_sheet'});
    const gens=parseGens(body.gens);
    res.json({ok:true,results:keys.map((key,i)=>{const r=checkPokemonAnswer(answers[i],letter,{key},pokemon,gens,criteria);delete r.key;return r;}),
      examples:keys.map(key=>examplesFor(letter,{key},pokemon,gens,criteria))});
  });
}

module.exports={SOLO_SECONDS,mountPetitBacSolo,WRITE_MS,STOP_MS,VOTE_MS,FREE,normalize,initialOf,drawSheet,checkPokemonAnswer,examplesFor,startPetitBacRound,writeAnswers,stopRound,voteAnswer,finishVoting,advancePetitBac,scorePetitBac,publicPetitBac,rekeyPetitBac};
