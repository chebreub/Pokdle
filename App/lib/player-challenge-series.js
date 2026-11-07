"use strict";
// PART-02: a competitive series must be the SAME ten Pokémon and generations.
// All secrets and progress live on the server, in the existing challenge record.
// This is distinct from the older "beat my personal record" challenges, which
// remain available but are not represented as same-sequence competitions.
const crypto = require("node:crypto");
const MODE = "serie10";
const KIND = "serie_identique";
const TOTAL = 10;
const MAX_TRIES = 8;
const DEFAULT_GENS = Object.freeze([1,2,3,4,5,6,7,8,9]);

function normalizeGens(gens) {
  if (gens === undefined) return [...DEFAULT_GENS];
  if (!Array.isArray(gens) || !gens.length || gens.length > 9 ||
      gens.some(g => !Number.isInteger(g) || g < 1 || g > 9)) return null;
  return [...new Set(gens)].sort((a,b)=>a-b);
}
function selectable(p, gens) {
  return p && Number.isInteger(Number(p.id)) && Number(p.id) > 0 &&
    !p.isAltForm && p.guessable !== false && Number(p.id) <= 1025 &&
    gens.includes(Number(p.gen || p.generation));
}
function pickSeries(pokemon, gens, randomInt = crypto.randomInt) {
  const pool = pokemon.filter(p => selectable(p,gens));
  if (pool.length < TOTAL) return null;
  // Uniform draws without replacement; never client-supplied IDs or a seed.
  const ids = [];
  for(let i=0;i<TOTAL;i++) {
    const j = randomInt(pool.length);
    ids.push(Number(pool[j].id));
    pool.splice(j,1);
  }
  return ids;
}
const emptyPlayer = () => ({index:0,guesses:[],rounds:[],found:0,attemptsWon:0,done:false});
const newProgress = () => ({version:1,from:emptyPlayer(),to:emptyPlayer()});
function scoreCompare(a,b) {
  if(a.found !== b.found) return Math.sign(a.found - b.found);
  // Only attempts on correctly found Pokémon are counted for a tie-break.
  return Math.sign(b.attemptsWon - a.attemptsWon);
}
function outcome(state) {
  if (!state?.from?.done || !state?.to?.done) return null;
  const result=scoreCompare(state.to,state.from);
  return result>0 ? "won" : result<0 ? "lost" : "tied";
}
function advance(state,side,expectedIndex,pokemonId,pass,secretIds,byId) {
  const player=state?.[side];
  if(!player || !Number.isInteger(expectedIndex) || expectedIndex<0 ||
      player.done || player.index !== expectedIndex) return {changed:false,replayed:true};
  if(!Array.isArray(secretIds) || secretIds.length !== TOTAL ||
      player.index>=TOTAL) return {changed:false,replayed:true};
  if(pass !== true) {
    const id=Number(pokemonId), p=byId.get(id);
    if(!Number.isSafeInteger(id) || !p || !selectable(p,DEFAULT_GENS))
      return {changed:false,error:"invalid_guess"};
    if(player.guesses.includes(id)) return {changed:false,duplicate:true};
    // The same generation choice applies to either participant.
    // Forbidden picks are checked by the caller against the stored gens.
    player.guesses.push(id);
  }
  const won=pass !== true && Number(pokemonId) === secretIds[player.index];
  if(won || pass === true || player.guesses.length >= MAX_TRIES) {
    player.rounds.push({won,tries:player.guesses.length});
    if(won){player.found++;player.attemptsWon+=player.guesses.length;}
    player.index++;
    player.guesses=[];
    player.done=player.index>=TOTAL;
  }
  return {changed:true,roundFinished:won||pass===true||player.guesses.length===0};
}
function publicView(row,me,byId,compare) {
  const side=String(me)===String(row.from_id)?"from":String(me)===String(row.to_id)?"to":null;
  if(!side) return {ok:false,error:"unknown"};
  const state=row.series_progress;
  const player=state?.[side], rival=state?.[side==="from"?"to":"from"];
  if(!player||!rival||state.version!==1||!Array.isArray(row.series_ids)||row.series_ids.length!==TOTAL)
    return {ok:false,error:"unavailable"};
  const expired=row.status==="open"&&new Date(row.expires_at)<=new Date();
  const status=expired?"expired":row.status;
  const rows=player.index<TOTAL?player.guesses.map(id=>{
    const p=byId.get(Number(id)),secret=byId.get(Number(row.series_ids[player.index]));
    if(!p||!secret) return null;
    const direction=(a,b)=>a===b?"":a<b?"↑":"↓";
    const g=pokemon=>Number(pokemon.gen||pokemon.generation);
    return {pokemonId:Number(id),cmp:compare(p,secret),
      generationDirection:direction(g(p),g(secret)),
      heightDirection:direction(Number(p.height),Number(secret.height)),
      weightDirection:direction(Number(p.weight),Number(secret.weight))};
  }).filter(Boolean):[];
  const ended=status!=="open";
  return {ok:true,id:Number(row.id),kind:KIND,mode:MODE,status,done:player.done||ended,
    index:player.index,total:TOTAL,max:MAX_TRIES,gens:row.series_gens,
    attempts:player.guesses.length,rows,found:player.found,attemptsWon:player.attemptsWon,
    rounds:player.rounds.map(r=>({won:r.won,tries:r.tries})),
    opponentDone:Boolean(rival.done),...((ended&&player.done&&rival.done)
      ? {opponentFound:rival.found,opponentAttemptsWon:rival.attemptsWon,
          outcome:status==="tied"?"égalité":(status==="won"?(side==="to"?"gagné":"perdu"):(status==="lost"?(side==="to"?"perdu":"gagné"):"non terminé")}
      : {})};
}
module.exports={MODE,KIND,TOTAL,MAX_TRIES,DEFAULT_GENS,normalizeGens,selectable,pickSeries,newProgress,scoreCompare,outcome,advance,publicView};
