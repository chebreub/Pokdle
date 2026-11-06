'use strict';
// ECO-08: isolated DB integration; never targets a real player's database.
const test=require('node:test'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createBallService,initBallsDb}=require('../lib/poke-balls');
async function withDb(fn){
 const {Pool}=require('pg'),schema='eco08_'+randomUUID().replaceAll('-','');
 const admin=new Pool({connectionString:process.env.QA_DATABASE_URL});
 let db;
 try{
  await admin.query('CREATE SCHEMA '+schema);
  db=new Pool({connectionString:process.env.QA_DATABASE_URL,options:'-c search_path='+schema,max:6});
  await initBallsDb(db);
  await fn(db);
 }finally{
  if(db)await db.end();
  await admin.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');
  await admin.end();
 }
}
async function participation(db,identity,day){
 for(const src of ['mode:quiz','mode:pixel'])
  await db.query("INSERT INTO ball_gains(identity,day,source,ball) VALUES($1,$2,$3,'poke') ON CONFLICT DO NOTHING",[identity,day,src]);
}
async function qualify(db,me,monday,otherCount){
 await participation(db,me.key,monday);
 const next=new Date(monday+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);
 await participation(db,me.key,next.toISOString().slice(0,10));
 for(let i=0;i<otherCount;i++)await participation(db,'guest:eco08-'+monday+'-'+i,monday);
}
test('ECO-08: only new weekly legends gain an expires_at; old encounters keep midnight behavior',{
 skip:!process.env.QA_DATABASE_URL,timeout:60000
},async()=>withDb(async db=>{
 let now=new Date('2026-11-08T20:00:00Z');
 const me={key:'user:eco08legacy',accountId:'eco08legacy',guestKey:'guest:eco08legacy'};
 const service=createBallService({db,clock:()=>now,randomInt:()=>1,random:()=>.999});
 for(const kind of ['legend','wild','prestige']){
  const key='guest:eco08old:'+kind;
  await db.query("INSERT INTO wild_encounters(identity,day,pokemon_id,shiny,kind,status) VALUES($1,'2026-11-07',25,false,$2,'open')",[key,kind]);
  const who={key,guestKey:key,accountId:null};
  const state=await service.state(who);
  assert.equal(state.wild.open,null,'legacy '+kind+' must expire at Paris midnight');
  const row=(await db.query("SELECT status,expires_at FROM wild_encounters WHERE identity=$1",[key])).rows[0];
  assert.equal(row.status,'fled');
  assert.equal(row.expires_at,null);
 }
 await qualify(db,me,'2026-11-02',6); // 7 contributors, minimum goal 7
 const pre=(await service.expedition(me)).expedition;
 assert.equal(pre.legend.available,true);
 const first=await service.meetLegend(me);
 assert.equal(first.encounter.legend,true);
 assert.equal(first.encounter.throws,0);
 assert.equal(first.encounter.expiresAt,'2026-11-11T20:00:00.000Z');
 const row=(await db.query("SELECT expires_at,created_at FROM wild_encounters WHERE id=$1",[first.encounter.id])).rows[0];
 assert.equal(new Date(row.expires_at).toISOString(),first.encounter.expiresAt);
 assert.equal(first.encounter.shiny,false);
}));
test('ECO-08: Sunday night survives Monday; old encounter blocks next week without rerolling',{
 skip:!process.env.QA_DATABASE_URL,timeout:60000
},async()=>withDb(async db=>{
 let now=new Date('2026-11-08T20:00:00Z');
 let shinyRolls=0;
 const service=createBallService({db,clock:()=>now,randomInt:(n)=>{if(n===500)shinyRolls++;return 1},random:()=>.999});
 const me={key:'user:eco08hold',accountId:'eco08hold',guestKey:'guest:eco08hold'};
 await qualify(db,me,'2026-11-02',6);
 await service.state(me); // welcome grants once
 const first=await service.meetLegend(me);
 const id=first.encounter.id;
 assert.equal(shinyRolls,1);
 const stockBefore=(await service.state(me)).bag.poke;
 now=new Date('2026-11-09T12:00:00Z');
 let s=await service.state(me);
 assert.equal(s.wild.open.id,id);
 assert.equal(s.wild.open.throwsLeft,3);
 assert.equal(shinyRolls,1);
 assert.equal(s.bag.poke,stockBefore,'holding encounter does not spend a Ball');
 const resumed=await service.encounter(me);
 assert.equal(resumed.fresh,false);
 assert.equal(resumed.encounter.id,id,'entering grass must not reroll');
 await qualify(db,me,'2026-11-09',10); // 11 contributors meet at least 1.5 * previous 7
 now=new Date('2026-11-10T12:00:00Z');
 const exp=(await service.expedition(me)).expedition;
 assert.equal(exp.legend.reached,true);
 assert.equal(exp.legend.eligible,true);
 assert.equal(exp.legend.pending.kind,'legend');
 assert.equal(exp.legend.pending.pokemonId,first.encounter.pokemonId);
 assert.equal(exp.legend.available,false);
 await assert.rejects(service.meetLegend(me),/encounter_open/);
 assert.equal(shinyRolls,1);
 const throwId=randomUUID();
 const attempt=await service.throwBall(me,{actionId:throwId,ball:'poke',encounterId:id,expectedThrows:0});
 assert.equal(attempt.encounter.id,id);
 assert.equal(attempt.encounter.throws,1);
 assert.equal(attempt.encounter.status,'open');
 assert.equal(attempt.wild.open.id,id);
 const replay=await service.throwBall(me,{actionId:throwId,ball:'poke',encounterId:id,expectedThrows:0});
 assert.equal(replay.replayed,true);
 assert.equal(replay.wild.open.throws,1);
 assert.equal(replay.encounter.shiny,first.encounter.shiny);
 assert.equal(shinyRolls,1);
 now=new Date('2026-11-11T19:59:59Z');
 assert.equal((await service.state(me)).wild.open.id,id);
 now=new Date('2026-11-11T20:00:00Z');
 await assert.rejects(service.throwBall(me,{actionId:randomUUID(),ball:'poke',encounterId:id,expectedThrows:1}),/encounter_changed/);
 s=await service.state(me); // commit expiry once even if prior invalid throw rolled back
 assert.equal(s.wild.open,null,'expiry is strict at exactly 72h');
 const old=(await db.query("SELECT status,throws,used_poke FROM wild_encounters WHERE id=$1",[id])).rows[0];
 assert.deepEqual([old.status,old.throws,old.used_poke],['fled',1,1]);
 const next=await service.meetLegend(me);
 assert.equal(next.encounter.legend,true);
 assert.notEqual(next.encounter.id,id);
 assert.notEqual(next.encounter.pokemonId,first.encounter.pokemonId);
 assert.equal(shinyRolls,2,'only a NEW qualified week rolls one new shiny');
 const rows=(await db.query("SELECT COUNT(*)::int AS n FROM wild_encounters WHERE identity=$1 AND kind='legend'",[me.key])).rows[0].n;
 assert.equal(rows,2);
}));
test('ECO-08: two concurrent opens for the same weekly legend cannot create duplicates',{
 skip:!process.env.QA_DATABASE_URL,timeout:60000
},async()=>withDb(async db=>{
 const me={key:'user:eco08race',accountId:'eco08race',guestKey:'guest:eco08race'};
 await qualify(db,me,'2026-11-02',6);
 const balls=createBallService({db,clock:()=>new Date('2026-11-08T20:00:00Z'),randomInt:()=>1});
 await balls.state(me);
 const settled=await Promise.allSettled([balls.meetLegend(me),balls.meetLegend(me)]);
 assert.equal(settled.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(settled.filter(x=>x.status==='rejected').length,1);
 const n=(await db.query("SELECT COUNT(*)::int AS n FROM wild_encounters WHERE identity=$1 AND kind='legend'",[me.key])).rows[0].n;
 assert.equal(n,1);
}));
test('ECO-08: a stored legend may be skipped after day rollover; prestige never gets this extension',{
 skip:!process.env.QA_DATABASE_URL,timeout:60000
},async()=>withDb(async db=>{
 let now=new Date('2026-11-08T20:00:00Z');
 const me={key:'user:eco08skip',accountId:'eco08skip',guestKey:'guest:eco08skip'};
 const service=createBallService({db,clock:()=>now,randomInt:()=>1});
 await qualify(db,me,'2026-11-02',6);
 const first=await service.meetLegend(me);
 now=new Date('2026-11-09T12:00:00Z');
 assert.equal((await service.skip(me)).skipped,true);
 assert.equal((await service.state(me)).wild.open,null);
 const row=(await db.query("SELECT status,expires_at FROM wild_encounters WHERE id=$1",[first.encounter.id])).rows[0];
 assert.equal(row.status,'skipped');
 assert.ok(row.expires_at);
}));
test('ECO-08: weekly UI resumes held legend with GET only and shows Paris deadline',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/script.10xzb.expedition.js'),'utf8');
 const start=source.indexOf('function expeditionLegendExpiryText(iso) {');
 const end=source.indexOf('const EXP_DAY_NAMES',start);
 assert.ok(start>=0&&end>start);
 let renders=0,close=0;
 const current={wild:{open:{id:42,legend:true,throws:1,throwsLeft:2,pokemonId:639,expiresAt:'2026-11-11T20:00:00.000Z'}}};
 const ctx={window:{},refreshBalls:async()=>current,renderWildEncounter:()=>{renders++},closeOverlayModal:()=>{close++}};
 vm.createContext(ctx);
 vm.runInContext(source.slice(start,end),ctx);
 await ctx.resumeExpeditionLegend();
 assert.deepEqual([renders,close],[1,1]);
 assert.match(ctx.expeditionLegendExpiryText('2026-11-11T20:00:00.000Z'),/11 novembre/);
 const a=source.indexOf('function expeditionHtml(e) {');
 const b=source.indexOf('function openExpedition()',a);
 assert.ok(a>0&&b>a);
 const htmlCtx={escapeHtml:String,expeditionLegend:()=>({name:'Terrakium'}),ballImg:()=>'',pokedexDetailArtwork:()=>'/mock',
  drattakPrestigeHtml:()=>'',expeditionLegendExpiryText:ctx.expeditionLegendExpiryText,
  POKEMON_BY_ID:new Map([[485,{name:'Heatran'}]])};
 vm.createContext(htmlCtx);
 vm.runInContext(source.slice(a,b)+'\nthis.render=expeditionHtml;',htmlCtx);
 const html=htmlCtx.render({legendId:639,week:'2026-11-09',region:'Unys',chests:[],days:[],myDays:[],
  goal:10,progress:0,pct:0,participants:0,
  legend:{status:null,reached:false,available:false,pending:{kind:'legend',pokemonId:485,expiresAt:'2026-11-11T20:00:00.000Z'}}});
 assert.match(html,/Reprendre ma rencontre/);
 assert.match(html,/Heatran/);
 assert.doesNotMatch(html,/data-action="meetExpeditionLegend"/);
 const wild=fs.readFileSync(path.join(__dirname,'../src/script.10xz.wild-grass.js'),'utf8');
 assert.match(wild,/Rencontre conservée jusqu/);
 assert.match(wild,/wildLegendExpiryText\(e.expiresAt\)/);
});
