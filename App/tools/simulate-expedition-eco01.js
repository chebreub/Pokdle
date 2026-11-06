'use strict';
// ECO-01 research only: no network, DB writes, reward or production rules.
const { EXPEDITIONS, EXP_CHESTS, MAX_THROWS, SHOP_PRICES, SHINY_ODDS, captureChance } = require('../lib/poke-balls');
const DEFAULT_SEED=20261106, DEFAULT_PLAYERS=120000;
// Hypothetical distribution among identities already eligible for the first legendary.
const PARTICIPATION=Object.freeze([{days:2,count:50},{days:3,count:25},{days:4,count:15},{days:5,count:10}]);
const SCENARIOS=Object.freeze([
 {id:'actuel',minDays:Infinity,retryFee:0},
 {id:'seconde_3j',minDays:3,retryFee:0},
 {id:'seconde_4j',minDays:4,retryFee:0},
 {id:'seconde_5j',minDays:5,retryFee:0},
 {id:'seconde_4j_300',minDays:4,retryFee:300}
]);
const STRATEGIES=Object.freeze({
 coffres:{first:['great','great','great'],retry:['poke','poke','poke']},
 poke:{first:['poke','poke','poke'],retry:['poke','poke','poke']},
 ultra:{first:['ultra','ultra','ultra'],retry:['ultra','ultra','ultra']}
});
function playerDays(index){
 const ticket=index%100; let sum=0;
 for(const group of PARTICIPATION){sum+=group.count;if(ticket<sum)return group.days}
 throw Error('invalid_participation_distribution');
}
function rng(seed,index){
 let state=(seed^Math.imul(index+1,0x9e3779b1))>>>0;
 if(!state)state=0x6d2b79f5;
 return ()=>{
  state^=state<<13;state^=state>>>17;state^=state<<5;
  return (state>>>0)/0x100000000;
 };
}
function encounter(pokemonId,sequence,random,used){
 if(sequence.length!==MAX_THROWS)throw Error('invalid_throw_sequence');
 for(const ball of sequence){
  used[ball]++;
  if(random()<captureChance(pokemonId,ball))return true;
 }
 return false;
}
function exactChance(pokemonId,sequence){
 return 1-sequence.reduce((failure,ball)=>failure*(1-captureChance(pokemonId,ball)),1);
}
function assertEngineConstraints(){
 if(MAX_THROWS!==3||SHINY_ODDS!==500||EXPEDITIONS.length!==6)
  throw Error('production_rules_changed_review_simulation');
 const chestBalls=Object.values(EXP_CHESTS).flat().sort();
 if(JSON.stringify(chestBalls)!==JSON.stringify(['great','great','great','poke','poke','poke'].sort()))
  throw Error('expedition_chest_contents_changed_review_simulation');
}
function simulate({players=DEFAULT_PLAYERS,seed=DEFAULT_SEED,scenario=SCENARIOS[0],strategy=STRATEGIES.coffres}={}){
 assertEngineConstraints();
 if(!Number.isSafeInteger(players)||players<600||players%(EXPEDITIONS.length*100)!==0)
  throw Error('players_must_be_multiple_of_600_and_at_least_600');
 if(!Number.isSafeInteger(seed))throw Error('seed_must_be_integer');
 const used={poke:0,great:0,ultra:0};
 let meetings=0,retries=0,captured=0,firstCaptures=0,secondCaptures=0;
 for(let i=0;i<players;i++){
  const pokemonId=EXPEDITIONS[Math.floor(i/100)%EXPEDITIONS.length].legend;
  const random=rng(seed,i);
  meetings++;
  if(encounter(pokemonId,strategy.first,random,used)){captured++;firstCaptures++}
  else if(playerDays(i)>=scenario.minDays){
   // At most one second encounter, only after failure, per synthetic identity/week.
   meetings++;retries++;
   if(encounter(pokemonId,strategy.retry,random,used)){captured++;secondCaptures++}
  }
 }
 const shopEquivalent=used.poke*SHOP_PRICES.poke+used.great*SHOP_PRICES.great+used.ultra*SHOP_PRICES.ultra;
 return {
  scenario:scenario.id,strategy:Object.entries(STRATEGIES).find(([,s])=>s===strategy)?.[0]||'custom',
  players,seed,meetings,retries,captured,firstCaptures,secondCaptures,
  encountersPer1000:1000*meetings/players,capturesPer1000:1000*captured/players,
  successPct:100*captured/players,balls:used,
  ballsPerPlayer:(used.poke+used.great+used.ultra)/players,
  ballShopEquivalentPerPlayer:shopEquivalent/players,
  // Fee model assumes 100% ability and willingness to pay; actual extra spending unknown.
  hypotheticalFeeTotal:retries*scenario.retryFee,
  hypotheticalFeePerPlayer:retries*scenario.retryFee/players,
  // Only if a second encounter triggers a NEW shiny roll. Not a changed shiny rate.
  hypotheticalExtraShinyRolls:retries,
  expectedExtraShinyAppearances:retries/SHINY_ODDS
 };
}
function compare({players=DEFAULT_PLAYERS,seed=DEFAULT_SEED}={}){
 return Object.keys(STRATEGIES).flatMap(name=>
  SCENARIOS.map(scenario=>simulate({players,seed,scenario,strategy:STRATEGIES[name]})));
}
function cli(args){
 function option(flag,fallback){
  const i=args.indexOf(flag);
  if(i<0)return fallback;
  if(i+1>=args.length)throw Error('missing_'+flag);
  return Number(args[i+1]);
 }
 const players=option('--players',DEFAULT_PLAYERS),seed=option('--seed',DEFAULT_SEED);
 const results=compare({players,seed});
 if(args.includes('--json')){
  process.stdout.write(JSON.stringify({
   inputs:{players,seed,participation:PARTICIPATION,
    scenarios:SCENARIOS.map(s=>({id:s.id,minDays:Number.isFinite(s.minDays)?s.minDays:null,retryFee:s.retryFee})),
    strategies:STRATEGIES,
    species:EXPEDITIONS.map(e=>({id:e.legend,firstCoffresPct:100*exactChance(e.legend,STRATEGIES.coffres.first),
      retryCoffresPct:100*exactChance(e.legend,STRATEGIES.coffres.retry)}))},
   results
  },null,2)+'\n');return;
 }
 console.log('ECO-01 - simulation SYNTHETIQUE, seed='+seed+', joueurs eligibles='+players);
 console.log('Scenario | Balls | Rencontres/1000 | Captures/1000 | Retours/1000 | Balls/joueur | Valeur boutique/joueur | Taxe hypothetique/joueur');
 for(const r of results)console.log([r.scenario,r.strategy,r.encountersPer1000.toFixed(1),
  r.capturesPer1000.toFixed(1),(r.retries*1000/players).toFixed(1),r.ballsPerPlayer.toFixed(2),
  r.ballShopEquivalentPerPlayer.toFixed(1),r.hypotheticalFeePerPlayer.toFixed(1)].join(' | '));
 console.log('100% des identites simulees sont deja eligibles au premier legendaire; achats reels inconnus.');
}
if(require.main===module)cli(process.argv.slice(2));
module.exports={PARTICIPATION,SCENARIOS,STRATEGIES,rng,playerDays,exactChance,encounter,simulate,compare,assertEngineConstraints};
