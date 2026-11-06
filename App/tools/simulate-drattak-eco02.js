'use strict';
// Offline ECO-02 research; nothing modifies inventory, currency, DB or server rules.
// Population: accounts which completed the original Drattak quest and failed on day 0.
const { SALAMENCE } = require('../lib/prestige-quests');
const { MAX_THROWS, SHINY_ODDS, SHOP_PRICES, captureChance } = require('../lib/poke-balls');
const SEED=20261106, PLAYERS=20000, HORIZON=90;
const ASSUMPTIONS=Object.freeze({activeDayChance:0.30,winPerModeOnActiveDay:0.35,randomEventDailyChance:0.15});
const SCENARIOS=Object.freeze([
  {id:'A_actuel',days:5,wins:3,gate:'always'},
  {id:'B_reprise_2j',days:2,wins:1,gate:'always'},
  {id:'C_weekend_2j',days:2,wins:1,gate:'weekend'},
  {id:'D_aleatoire_2j',days:2,wins:1,gate:'random'},
  {id:'E_une_reprise_2j',days:2,wins:1,gate:'always',onlyOnce:true},
  {id:'F_une_reprise_weekend',days:2,wins:1,gate:'weekend',onlyOnce:true},
  {id:'G_une_reprise_weekend_3j2v',days:3,wins:2,gate:'weekend',onlyOnce:true}
]);
const MODES=Object.keys(SALAMENCE.modes);
function unit(seed,account,day,channel){
  let v=(seed ^ Math.imul(account+1,0x9e3779b1) ^ Math.imul(day+17,0x85ebca6b) ^ Math.imul(channel+13,0xc2b2ae35))>>>0;
  v=Math.imul(v^(v>>>16),0x7feb352d);v=Math.imul(v^(v>>>15),0x846ca68b);
  return ((v^(v>>>16))>>>0)/4294967296;
}
function isWeekend(day){
  // Day zero is 2026-11-06 (Friday); weekday Mon=0.
  const weekday=(4+day)%7;
  return weekday===5||weekday===6;
}
function eligible(proofs,day,lastAttempt,scenario){
  const minDay=Math.max(lastAttempt+1,day-SALAMENCE.windowDays+1);
  const recent=proofs.filter(e=>e.day>=minDay&&e.day<=day);
  if(new Set(recent.map(e=>e.day)).size<scenario.days)return false;
  return MODES.every(mode=>recent.filter(e=>e.mode===mode).length>=scenario.wins);
}
function firstRetryAllowed(scenario,day,active,seed,id,eventChance){
  if(scenario.gate==='always')return true;
  if(scenario.gate==='weekend')return isWeekend(day);
  if(scenario.gate==='random')return active&&unit(seed,id,day,9)<eventChance;
  throw Error('unknown_gate');
}
function simulate({players=PLAYERS,seed=SEED,horizon=HORIZON,ball='great',scenario=SCENARIOS[0],
  activeDayChance=ASSUMPTIONS.activeDayChance,winPerModeOnActiveDay=ASSUMPTIONS.winPerModeOnActiveDay,
  randomEventDailyChance=ASSUMPTIONS.randomEventDailyChance}={}){
  if(SALAMENCE.pokemonId!==373||SALAMENCE.cooldownDays!==21||SALAMENCE.windowDays!==30||SALAMENCE.minDays!==5||
    !Object.values(SALAMENCE.modes).every(n=>n===3)||MAX_THROWS!==3||SHINY_ODDS!==500)
    throw Error('production_rules_changed');
  if(!Number.isSafeInteger(players)||players<1||players>1000000||!Number.isSafeInteger(seed)||
    !Number.isSafeInteger(horizon)||horizon<21||horizon>365||!SHOP_PRICES[ball]||
    [activeDayChance,winPerModeOnActiveDay,randomEventDailyChance].some(x=>!Number.isFinite(x)||x<0||x>1))
    throw Error('invalid_simulation_parameters');
  const chance=captureChance(SALAMENCE.pokemonId,ball);
  let retries=0,retried=0,captures=0,ballsUsed=0;
  const firstRetryDays=[];
  for(let id=0;id<players;id++){
    let lastAttempt=0,attempts=0,caught=false;
    const proofs=[];
    for(let day=1;day<=horizon&&!caught;day++){
      const active=unit(seed,id,day,0)<activeDayChance;
      if(active)MODES.forEach((mode,k)=>{
        if(unit(seed,id,day,k+1)<winPerModeOnActiveDay)proofs.push({day,mode});
      });
      const phase=scenario.onlyOnce&&attempts>0?SCENARIOS[0]:scenario;
      if(day-lastAttempt<SALAMENCE.cooldownDays||!eligible(proofs,day,lastAttempt,phase)||
        !firstRetryAllowed(phase,day,active,seed,id,randomEventDailyChance))continue;
      retries++;attempts++;
      if(attempts===1){retried++;firstRetryDays.push(day)}
      // Capture attempts are tied to player and attempt ordinal to share random outcomes
      // across scenario comparisons; no odds or number of throws are changed.
      for(let throwNo=0;throwNo<MAX_THROWS;throwNo++){
        ballsUsed++;
        if(unit(seed,id,attempts,20+throwNo)<chance){captures++;caught=true;break}
      }
      lastAttempt=day;
    }
  }
  firstRetryDays.sort((a,b)=>a-b);
  return {scenario:scenario.id,ball,players,seed,horizon,conditionalOnFirstFailure:true,
    retries,retried,captures,attemptsPer1000:1000*retries/players,
    playersRetriedPct:100*retried/players,capturedPct:100*captures/players,
    medianDaysToFirstRetry:firstRetryDays.length?firstRetryDays[Math.floor((firstRetryDays.length-1)/2)]:null,
    ballsUsedPerAccount:ballsUsed/players,ballShopEquivalentPerAccount:ballsUsed*SHOP_PRICES[ball]/players,
    actualPokedollarsCharged:0,expectedNewShinyRolls:retries/SHINY_ODDS};
}
function compare(options={}){
  return ['poke','great','ultra'].flatMap(ball=>SCENARIOS.map(scenario=>simulate({...options,ball,scenario})));
}
function cli(args){
  function num(name,fallback){
    const i=args.indexOf(name);
    if(i<0)return fallback;
    if(!args[i+1])throw Error('missing_'+name);
    return Number(args[i+1]);
  }
  const inputs={seed:num('--seed',SEED),players:num('--players',PLAYERS),horizon:num('--horizon',HORIZON),
    activeDayChance:num('--active',ASSUMPTIONS.activeDayChance),
    winPerModeOnActiveDay:num('--win',ASSUMPTIONS.winPerModeOnActiveDay),
    randomEventDailyChance:num('--event',ASSUMPTIONS.randomEventDailyChance)};
  const result=compare(inputs);
  if(args.includes('--json')){
    console.log(JSON.stringify({inputs,assumptions:ASSUMPTIONS,scenarios:SCENARIOS,results:result},null,2));
    return;
  }
  console.log('ECO-02 synthetic: initial Drattak encounter FAILED on day 0; first quest already completed.');
  console.log('Scenario | Ball | retries per 1000 | retried % | captured % | median wait days | Balls per player | shop equivalent per player');
  for(const r of result)console.log([r.scenario,r.ball,r.attemptsPer1000.toFixed(1),r.playersRetriedPct.toFixed(1),
    r.capturedPct.toFixed(1),r.medianDaysToFirstRetry,r.ballsUsedPerAccount.toFixed(2),r.ballShopEquivalentPerAccount.toFixed(1)].join(' | '));
}
if(require.main===module)cli(process.argv.slice(2));
module.exports={SCENARIOS,ASSUMPTIONS,unit,isWeekend,eligible,simulate,compare};
