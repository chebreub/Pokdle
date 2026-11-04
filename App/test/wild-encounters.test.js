'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path');
const {captureChance,WILD_POOL,missionPokemonIds,createBallService,initBallsDb,ENCOUNTERS_PER_DAY,ENCOUNTERS_PER_BATCH}=require('../lib/poke-balls');
const CAPTURE=require('../capture-rates.json');

test('capture chances follow the official rates and the validated formula',()=>{
  // Values from the plan of 2/11/2026 (rates read from PokéAPI, never from memory).
  assert.deepEqual([CAPTURE.rates[448],CAPTURE.rates[197],CAPTURE.rates[384]],[45,45,45],'Lucario, Noctali and Rayquaza are at 45');
  const pct=(id,ball)=>Math.round(captureChance(id,ball)*100);
  assert.deepEqual([pct(448,'poke'),pct(448,'great'),pct(448,'ultra')],[23,32,46]);
  assert.equal(pct(10,'poke'),80,'255 → 80 % with a Poké Ball');
  assert.equal(pct(10,'ultra'),95,'never more than 95 %');
  assert.equal(captureChance(10,'master'),0);
  assert.equal(Object.keys(CAPTURE.rates).length,1025);
});

test('the tall grass never holds a legendary, a mythical or an album mission reward',()=>{
  const missions=missionPokemonIds();
  assert.equal(missions.length,108);
  for(const id of [...CAPTURE.legendary,...CAPTURE.mythical,...missions])assert.ok(!WILD_POOL.includes(id),'#'+id+' must not appear');
  // 1020 Feu-Perçant (Paradoxe légendaire) and 793 Zéroïd (Ultra-Chimère) are not flagged by PokéAPI but are Légendes on the site.
  for(const id of [150,151,384,448,1020,793,1009])assert.ok(!WILD_POOL.includes(id),'#'+id);
  for(const id of require('../lib/poke-balls').siteLegendIds())assert.ok(!WILD_POOL.includes(id));
  assert.ok(WILD_POOL.includes(10)&&WILD_POOL.includes(19));
  assert.ok(WILD_POOL.length>800);
  // The missions are read from the client file: the same 108 ids as the album shows.
  const source=fs.readFileSync(path.join(__dirname,'../src/script.10b.album-missions.js'),'utf8');
  assert.deepEqual(missionPokemonIds(source),missions);
});

test('PostgreSQL: 4 encounters every 4 hours, 3 throws, Balls spent, captures kept and moved to the account',{skip:!process.env.QA_DATABASE_URL,timeout:30000},async()=>{
  const {Pool}=require('pg'),{randomUUID}=require('node:crypto'),schema='wild_'+randomUUID().replaceAll('-',''),admin=new Pool({connectionString:process.env.QA_DATABASE_URL});let db;
  try{
    await admin.query('CREATE SCHEMA '+schema);db=new Pool({connectionString:process.env.QA_DATABASE_URL,options:'-c search_path='+schema,max:4});
    let now=new Date('2026-11-03T08:30:00Z'); // 9 h 30 à Paris : 3 vagues (0 h, 4 h, 8 h) = 12 rencontres ouvertes
    // Scripted draws: the next index into the pool / shiny roll, and the capture roll.
    const ints=[],rolls=[];
    const balls=createBallService({db,clock:()=>now,randomInt:(n)=>ints.length?ints.shift()%n:0,random:()=>rolls.length?rolls.shift():0.99});
    await initBallsDb(db);
    const guest={key:'guest:w1',guestKey:'guest:w1',accountId:null};
    await assert.rejects(balls.encounter(guest),/no_balls/,'no Ball, no encounter');

    await balls.gift(guest);
    for(const mode of ['mystery','normal','cry'])await balls.earn(guest,{mode,result:'loss',score:1});
    let s=await balls.state(guest);
    assert.deepEqual(s.bag,{poke:4,great:0,ultra:0});
    assert.deepEqual([s.wild.max,s.wild.left,s.wild.open,s.wild.nextAt,s.wild.nextCount],[24,12,null,'2026-11-03T11:00:00.000Z',4]);
    assert.equal(ENCOUNTERS_PER_DAY,24);assert.equal(ENCOUNTERS_PER_BATCH,4);

    // Encounter 1: Chenipan (rate 255), caught at the 2nd throw.
    ints.push(WILD_POOL.indexOf(10),5);
    s=await balls.encounter(guest);
    assert.deepEqual([s.encounter.pokemonId,s.encounter.shiny,s.encounter.throwsLeft,s.encounter.chances.poke],[10,false,3,80]);
    assert.equal((await balls.encounter(guest)).encounter.id,s.encounter.id,'the open encounter comes back, it is not redrawn');
    rolls.push(0.9);ints.push(1);
    s=await balls.throwBall(guest,{ball:'poke'});
    assert.deepEqual([s.result.caught,s.result.fled,s.result.shakes,s.encounter.throwsLeft,s.bag.poke],[false,false,1,2,3]);
    await assert.rejects(balls.throwBall(guest,{ball:'great'}),/no_ball_left/,'no Super Ball in the bag');
    rolls.push(0.1);
    s=await balls.throwBall(guest,{ball:'poke'});
    assert.deepEqual([s.result.caught,s.result.shakes,s.encounter.status,s.bag.poke,s.wild.caught,s.wild.open],[true,3,'caught',2,1,null]);

    // Encounter 2: a shiny that flees after 3 throws... with only 2 Balls left, the bag empties first.
    ints.push(WILD_POOL.indexOf(19),0);
    s=await balls.encounter(guest);
    assert.equal(s.encounter.shiny,true,'1 chance in 150, here forced');
    rolls.push(0.99,0.99);ints.push(0,2);
    await balls.throwBall(guest,{ball:'poke'});s=await balls.throwBall(guest,{ball:'poke'});
    assert.deepEqual([s.encounter.status,s.bag.poke],['open',0]);
    await assert.rejects(balls.throwBall(guest,{ball:'poke'}),/no_ball_left/);
    s=await balls.skip(guest);
    assert.deepEqual([s.skipped,s.wild.today,s.wild.left],[true,2,10]);
    await assert.rejects(balls.encounter(guest),/no_balls/);

    // A 3rd failed throw: the Pokémon flees.
    await db.query("INSERT INTO ball_gains(identity,day,source,ball) VALUES('guest:w1','2026-11-02','gift','great'),('guest:w1','2026-11-01','gift','great'),('guest:w1','2026-10-31','gift','great')");
    ints.push(WILD_POOL.indexOf(19),5);await balls.encounter(guest);
    for(let i=0;i<3;i++){rolls.push(0.99);ints.push(0);s=await balls.throwBall(guest,{ball:'great'});}
    assert.deepEqual([s.result.fled,s.encounter.status,s.bag.great],[true,'fled',0]);

    // The limit of the moment: 12 encounters by 9 h 30, skipped and fled ones included.
    await db.query("INSERT INTO ball_gains(identity,day,source,ball) SELECT 'guest:w1','2026-10-01'::date+g,'gift','poke' FROM generate_series(0,9) g");
    for(let i=0;i<9;i++){ints.push(WILD_POOL.indexOf(10),5);await balls.encounter(guest);await balls.skip(guest);}
    await assert.rejects(balls.encounter(guest),/no_encounters_left/);

    // An encounter left open overnight is gone the next day; the count starts again.
    now=new Date('2026-11-04T12:30:00Z');
    ints.push(WILD_POOL.indexOf(10),5);s=await balls.encounter(guest);
    // The next morning: 4 at midnight, 4 more at 4 h, 8 h… and 24 by 20 h (heure de Paris).
    now=new Date('2026-11-04T23:30:00Z');
    s=await balls.state(guest);
    assert.deepEqual([s.wild.open,s.wild.left,s.wild.available,s.wild.nextAt],[null,4,4,'2026-11-05T03:00:00.000Z']);
    now=new Date('2026-11-05T12:00:00Z');
    s=await balls.state(guest);
    assert.deepEqual([s.wild.left,s.wild.nextAt],[16,'2026-11-05T15:00:00.000Z']);
    now=new Date('2026-11-05T21:00:00Z');
    s=await balls.state(guest);
    assert.deepEqual([s.wild.left,s.wild.nextAt],[24,'2026-11-05T23:00:00.000Z'],'after 20 h, the next ones come at midnight');
    assert.equal((await db.query("SELECT status FROM wild_encounters WHERE day='2026-11-04'")).rows[0].status,'fled');

    // Logging in: captures and spent Balls follow the account.
    const user={key:'user:7',guestKey:'guest:w1',accountId:'7'};
    s=await balls.collection(user);
    assert.deepEqual(s.captures,[{id:10,normal:1,shiny:0}]);
    assert.deepEqual(s.shinyLog.map(e=>[e.id,e.caught]),[[19,false]],'the shiny left behind is in the shiny log, greyed out');
    assert.equal(s.wild.caught,1);
    await assert.rejects(balls.throwBall(user,{ball:'ultra'}),/no_encounter/);
  }finally{if(db)await db.end();await admin.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');await admin.end();}
});
