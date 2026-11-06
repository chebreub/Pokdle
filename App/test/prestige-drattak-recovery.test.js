'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {SALAMENCE,SALAMENCE_RECOVERY,statusForSalamence,recoveryForSalamence}=require('../lib/prestige-quests');
const {createBallService,initBallsDb}=require('../lib/poke-balls');
function shiftDay(day,n){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
const two={cry:2,silhouette:2,description:2};
function status(day,wins,days,lastAttemptDay){
 return statusForSalamence({wins,days,lineageIds:[371],lastAttemptDay},day,shiftDay);
}
test('ECO-02 G: original quest stays intact; a single reduced retry after first flight',()=>{
 assert.deepEqual(SALAMENCE.modes,{cry:3,silhouette:3,description:3});
 assert.deepEqual(SALAMENCE_RECOVERY,{minDays:3,winsPerMode:2});
 const s=status('2026-11-28',two,3,'2026-11-06');
 assert.equal(s.eligible,false);
 const eligible=recoveryForSalamence(s,[{status:'fled'}],'2026-11-28',shiftDay);
 assert.equal(eligible.available,true);
 for(const attempts of [[],[{status:'caught'}],[{status:'skipped'}],[{status:'fled'},{status:'fled'}]])
  assert.equal(recoveryForSalamence(s,attempts,'2026-11-28',shiftDay).available,false);
});
test('ECO-02 G: 21-day cooldown and weekend in Paris',()=>{
 const s=status('2026-11-21',two,3,'2026-11-06');
 assert.equal(recoveryForSalamence(s,[{status:'fled'}],'2026-11-21',shiftDay).available,false);
 const fri=status('2026-11-27',two,3,'2026-11-06');
 const r=recoveryForSalamence(fri,[{status:'fled'}],'2026-11-27',shiftDay);
 assert.deepEqual([r.ready,r.weekendOpen,r.available,r.nextEventDay],[true,false,false,'2026-11-28']);
 assert.equal(recoveryForSalamence(status('2026-11-28',two,3,'2026-11-06'),[{status:'fled'}],'2026-11-28',shiftDay).available,true);
 assert.equal(recoveryForSalamence(status('2026-11-29',two,3,'2026-11-06'),[{status:'fled'}],'2026-11-29',shiftDay).available,true);
});
test('ECO-02 G: missing mode wins or participation days cannot unlock',()=>{
 const day='2026-11-28',attempts=[{status:'fled'}];
 const x=recoveryForSalamence(status(day,{cry:2,silhouette:1,description:2},3,'2026-11-06'),attempts,day,shiftDay);
 assert.equal(x.available,false);assert.equal(x.needs.modes.silhouette,1);
 const y=recoveryForSalamence(status(day,two,2,'2026-11-06'),attempts,day,shiftDay);
 assert.equal(y.available,false);assert.equal(y.needs.days,1);
});
test('PostgreSQL: first failure grants one weekend retry and no duplicate',{
 skip:!process.env.QA_DATABASE_URL,timeout:60000
},async()=>{
 const {Pool}=require('pg'),schema='eco02g_'+randomUUID().replaceAll('-','');
 const admin=new Pool({connectionString:process.env.QA_DATABASE_URL});let db;
 try{
  await admin.query('CREATE SCHEMA '+schema);
  db=new Pool({connectionString:process.env.QA_DATABASE_URL,options:'-c search_path='+schema,max:4});
  let now=new Date('2026-11-27T12:00:00Z');
  const me={key:'user:eco02g',accountId:'eco02g',guestKey:'guest:eco02g'};
  const service=createBallService({db,clock:()=>now,randomInt:()=>1,random:()=>0.99});
  await initBallsDb(db);
  await db.query("INSERT INTO wild_encounters(identity,account_id,day,pokemon_id,shiny,kind,status) VALUES($1,$2,'2026-10-30',371,false,'wild','caught')",[me.key,me.accountId]);
  await db.query("INSERT INTO wild_encounters(identity,account_id,day,pokemon_id,shiny,kind,status,throws) VALUES($1,$2,'2026-11-06',373,false,'prestige','fled',3)",[me.key,me.accountId]);
  const wins=[['2026-11-25','cry'],['2026-11-25','silhouette'],['2026-11-25','description'],
   ['2026-11-26','cry'],['2026-11-26','silhouette'],['2026-11-26','description'],['2026-11-27','cry']];
  for(const [day,mode] of wins)
   await db.query('INSERT INTO prestige_verified_wins(identity,account_id,day,mode) VALUES($1,$2,$3,$4)',[me.key,me.accountId,day,mode]);
  let p=(await service.prestige(me)).prestige;
  assert.equal(p.eligible,false);
  assert.equal(p.recovery.ready,true);
  assert.equal(p.available,false);
  await assert.rejects(service.meetPrestige(me,{answer:'Drackhaus'}),/prestige_event_closed/);
  now=new Date('2026-11-28T12:00:00Z');
  await service.state(me); // The existing welcome grant supplies 4 Poké + 1 Super Ball.
  p=(await service.prestige(me)).prestige;
  assert.equal(p.available,true);
  const pair=await Promise.allSettled([service.meetPrestige(me,{answer:'Drackhaus'}),service.meetPrestige(me,{answer:'Drackhaus'})]);
  assert.equal(pair.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(pair.filter(r=>r.status==='rejected').length,1);
  assert.match(String(pair.find(r=>r.status==='rejected').reason),/prestige_cooldown/);
  for(let i=0;i<3;i++)await service.throwBall(me,{ball:'poke'});
  p=(await service.prestige(me)).prestige;
  assert.equal(p.recovery.active,false);
  assert.equal(p.available,false);
  const count=Number((await db.query("SELECT COUNT(*)::int AS n FROM wild_encounters WHERE identity=$1 AND kind='prestige'",[me.key])).rows[0].n);
  assert.equal(count,2);
 }finally{if(db)await db.end();await admin.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');await admin.end()}
});

test('ECO-02 G: UI labels pending weekend without offering a disabled encounter',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
 const source=fs.readFileSync(path.join(__dirname,'../src/script.10xzb.expedition.js'),'utf8');
 const a=source.indexOf('function drattakPrestigeHtml() {');
 const b=source.indexOf('function meetPrestigeDrattak() {',a);
 assert.ok(a>=0&&b>a);
 const data={
  hasLineage:true,lineageIds:[371],wins:{cry:2,silhouette:2,description:2},days:3,
  goal:{days:5,modes:{cry:3,silhouette:3,description:3}},chances:{poke:23,great:32,ultra:46},
  recovery:{active:true,goal:{days:3,modes:{cry:2,silhouette:2,description:2}},
    ready:true,weekendOpen:false,nextEventDay:'2026-11-28'},
  eligible:false,available:false,needsAccount:false,cooldown:false
 };
 const ctx={drattakPrestigeState:data,escapeHtml:String};
 vm.createContext(ctx);
 vm.runInContext(source.slice(a,b)+'\nthis.render=drattakPrestigeHtml;',ctx);
 const friday=ctx.render();
 assert.match(friday,/3 nouveaux jours et 2 victoires par mode/);
 assert.match(friday,/Prochain rendez-vous : 28\/11\/2026/);
 assert.doesNotMatch(friday,/data-action="meetPrestigeDrattak"/);
 data.recovery.weekendOpen=true;data.available=true;
 const weekend=ctx.render();
 assert.match(weekend,/Seconde chance/);
 assert.match(weekend,/data-action="meetPrestigeDrattak"/);
});
