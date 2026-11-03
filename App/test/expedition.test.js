'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {weekStart,expeditionOf,EXPEDITIONS,createBallService,initBallsDb,missionPokemonIds}=require('../lib/poke-balls');

test('the week starts on Monday and each region has a legendary that is not an album mission reward',()=>{
  assert.equal(weekStart('2026-11-03'),'2026-11-02');
  assert.equal(weekStart('2026-11-08'),'2026-11-02','Sunday still belongs to the week');
  assert.equal(weekStart('2026-11-09'),'2026-11-09');
  assert.notDeepEqual(expeditionOf('2026-11-02'),expeditionOf('2026-11-09'),'a new region every week');
  const missions=new Set(missionPokemonIds());
  for(const e of EXPEDITIONS)assert.ok(!missions.has(e.legend),e.region+' legendary must fill the album');
});

test('PostgreSQL: participations, shared goal, chests before Sunday, legendary for accounts with 2 days',{skip:!process.env.QA_DATABASE_URL,timeout:30000},async()=>{
  const {Pool}=require('pg'),{randomUUID}=require('node:crypto'),schema='exp_'+randomUUID().replaceAll('-',''),admin=new Pool({connectionString:process.env.QA_DATABASE_URL});let db;
  try{
    await admin.query('CREATE SCHEMA '+schema);db=new Pool({connectionString:process.env.QA_DATABASE_URL,options:'-c search_path='+schema,max:4});
    let now=new Date('2026-11-03T09:00:00Z');const rolls=[];
    const balls=createBallService({db,clock:()=>now,randomInt:(n)=>1%n,random:()=>rolls.length?rolls.shift():0.99});await initBallsDb(db);
    const play=(who,day,...sources)=>Promise.all(sources.map(src=>db.query("INSERT INTO ball_gains(identity,day,source,ball) VALUES($1,$2,$3,'poke') ON CONFLICT DO NOTHING",[who,day,src])));
    // Last week: 6 active players → goal 9 this week.
    for(let i=0;i<6;i++)await play('guest:old'+i,'2026-10-28','mode:quiz','daily');
    const me={key:'user:1',guestKey:'guest:me',accountId:'1'};
    let s=(await balls.expedition(me)).expedition;
    assert.deepEqual([s.week,s.goal,s.progress,s.pct],['2026-11-02',9,0,0]);
    // One game a day is not a participation; two different games are. The gift never counts.
    await play('user:1','2026-11-02','mode:quiz','gift');
    assert.equal((await balls.expedition(me)).expedition.progress,0);
    await play('user:1','2026-11-02','mode:pixel');
    for(let i=0;i<4;i++)await play('guest:p'+i,'2026-11-02','mode:quiz','wordle');
    s=(await balls.expedition(me)).expedition;
    assert.deepEqual([s.progress,s.pct,s.participants,s.myDays],[5,55,5,['2026-11-02']]);
    assert.deepEqual(s.chests.map(c=>[c.tier,c.canClaim]),[[25,true],[50,true],[75,false]]);
    await assert.rejects(balls.meetLegend(me),/expedition_not_done/);
    // Opening the chests: 4 Balls, outside the daily cap, once.
    s=await balls.claimChests(me);
    assert.deepEqual(s.added.map(a=>a.ball).sort(),['great','poke','poke','poke']);
    assert.equal(s.today,0,'chest Balls do not use the daily cap');
    await assert.rejects(balls.claimChests(me),/no_chest/);
    // 100 %: the legendary needs an account and 2 days.
    for(let i=0;i<4;i++)await play('guest:q'+i,'2026-11-03','mode:quiz','daily');
    s=(await balls.expedition(me)).expedition;
    assert.equal(s.pct,100);assert.equal(s.legend.needsDays,1);
    await assert.rejects(balls.meetLegend(me),/not_enough_days/);
    const guest={key:'guest:q0',guestKey:'guest:q0',accountId:null};
    await assert.rejects(balls.meetLegend(guest),/account_required/);
    await play('user:1','2026-11-03','mode:quiz','daily');
    s=await balls.meetLegend(me);
    assert.deepEqual([s.encounter.legend,s.wild.left],[true,6],'the legendary encounter does not use one of the 6 daily encounters');
    assert.equal(s.encounter.pokemonId,639);
    rolls.push(0.99,0.99,0.99);
    for(let i=0;i<3;i++)s=await balls.throwBall(me,{ball:'poke'});
    assert.equal(s.encounter.status,'fled','no capture is guaranteed');
    await assert.rejects(balls.meetLegend(me),/legend_already_met/,'one try per week');
    // A new week: new region, chests start again, unopened ones are gone.
    now=new Date('2026-11-09T09:00:00Z');
    s=(await balls.expedition(me)).expedition;
    assert.deepEqual([s.week,s.progress],['2026-11-09',0]);
    assert.notEqual(s.legendId,639);
  }finally{if(db)await db.end();await admin.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');await admin.end();}
});
