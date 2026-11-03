'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {arcadeGain,createBallService,initBallsDb,DAILY_CAP}=require('../lib/poke-balls');

test('a game gives a Poké Ball, a fine one a Super Ball, and an unknown mode nothing',()=>{
  assert.deepEqual(arcadeGain('quiz','win',12),{source:'mode:quiz',ball:'great'});
  assert.deepEqual(arcadeGain('quiz','loss',5),{source:'mode:quiz',ball:'poke'});
  assert.deepEqual(arcadeGain('normal','win',4),{source:'mode:normal',ball:'great'});
  assert.deepEqual(arcadeGain('normal','win',9),{source:'mode:normal',ball:'poke'});
  assert.deepEqual(arcadeGain('normal','loss',3),{source:'mode:normal',ball:'poke'},'a lost guess is not a fine game');
  // Higher or Lower and its 60 s version are one game: one Ball for both.
  assert.equal(arcadeGain('higher-lower-rush','loss',30).source,arcadeGain('higher-lower','loss',1).source);
  for(const bad of [['daily','win',1],['challenge','win',1],['nope','win',1]])assert.throws(()=>arcadeGain(...bad),/unknown_mode/);
  assert.throws(()=>arcadeGain('quiz','draw',1),/invalid_result/);
  assert.throws(()=>arcadeGain('quiz','win',-1),/invalid_score/);
});

test('PostgreSQL: one Ball per source and day, 10 a day, daily games checked, guest Balls follow the account',{skip:!process.env.QA_DATABASE_URL,timeout:30000},async()=>{
  const {Pool}=require('pg'),{randomUUID}=require('node:crypto'),schema='balls_'+randomUUID().replaceAll('-',''),admin=new Pool({connectionString:process.env.QA_DATABASE_URL});let db;
  try{
    await admin.query('CREATE SCHEMA '+schema);db=new Pool({connectionString:process.env.QA_DATABASE_URL,options:'-c search_path='+schema,max:4});
    let now=new Date('2026-11-03T09:00:00Z');const day='2026-11-03';
    const balls=createBallService({db,clock:()=>now});
    await initBallsDb(db);
    const guest={key:'guest:g1',guestKey:'guest:g1',accountId:null};
    // The daily games' tables are not there yet: the Balls still work.
    let s=await balls.state(guest);
    assert.deepEqual([s.today,s.cap,s.giftAvailable,s.bag.poke],[0,DAILY_CAP,true,0]);

    s=await balls.gift(guest);
    assert.deepEqual(s.added,[{source:'gift',ball:'poke'}]);
    assert.deepEqual([(await balls.gift(guest)).added,(await balls.state(guest)).giftAvailable],[[],false],'one gift a day');
    s=await balls.earn(guest,{mode:'quiz',result:'win',score:13});
    assert.deepEqual(s.added,[{source:'mode:quiz',ball:'great'}]);
    assert.deepEqual((await balls.earn(guest,{mode:'quiz',result:'win',score:15})).added,[],'replaying a mode the same day gives nothing');
    await assert.rejects(balls.earn(guest,{mode:'daily',result:'win',score:1}),/unknown_mode/,'the Pokémon du jour is never declared by the browser');

    // Daily games are read from their own tables.
    await db.query(`CREATE TABLE daily_plays(identity TEXT,day DATE,status TEXT);CREATE TABLE wordle_plays(identity TEXT,day DATE,status TEXT);
      CREATE TABLE dossier_plays(identity TEXT,day DATE,status TEXT,points INT);CREATE TABLE challenge_plays(identity TEXT,day DATE,status TEXT,points INT)`);
    await db.query("INSERT INTO daily_plays VALUES('guest:g1',$1,'won'),('guest:g1','2026-11-02','won')",[day]);
    s=await balls.state(guest);
    assert.deepEqual(s.added,[{source:'daily',ball:'poke'}],'the Pokémon du jour found today gives its Ball once');
    await db.query("INSERT INTO wordle_plays VALUES('guest:g1',$1,'lost');INSERT INTO dossier_plays VALUES('guest:g1',$1,'completed',20);INSERT INTO challenge_plays VALUES('guest:g1',$1,'abandoned',5)".replaceAll('$1',`'${day}'`));
    s=await balls.state(guest);
    assert.deepEqual(s.added,[{source:'dossier',ball:'great'},{source:'journey',ball:'great'}],'a perfect Dossier and the 4/4 journey give Super Balls; a lost Wordle and an abandoned Défi give nothing');
    assert.deepEqual([s.today,s.bag],[5,{poke:2,great:3,ultra:0}]);

    // The cap: 10 a day, whatever the source.
    for(const mode of ['normal','pixel','cry','speedrun','odd','weight','shiny'])await balls.earn(guest,{mode,result:'loss',score:1});
    s=await balls.state(guest);
    assert.deepEqual([s.today,s.giftAvailable],[10,false]);
    assert.equal(s.gains.filter(g=>g.source.startsWith('mode:')).length,6,'the 7th mode is past the cap');

    // Logging in: the guest's Balls join the account, and a source already won on the account is not doubled.
    const user={key:'user:42',guestKey:'guest:g1',accountId:'42'};
    await db.query("INSERT INTO ball_gains(identity,day,source,ball,account_id) VALUES('user:42',$1,'gift','poke','42'),('user:42','2026-11-01','mode:quiz','great','42')",[day]);
    s=await balls.state(user);
    assert.equal(s.today,10);assert.equal(s.authenticated,true);
    assert.deepEqual(s.bag,{poke:7,great:4,ultra:0});
    assert.equal(Number((await db.query("SELECT COUNT(*) FROM ball_gains WHERE identity='guest:g1'")).rows[0].count),0);

    // A new Paris day starts a new count.
    now=new Date('2026-11-03T23:30:00Z');
    s=await balls.gift(user);
    assert.deepEqual([s.day,s.today,s.added],['2026-11-04',1,[{source:'gift',ball:'poke'}]]);
  }finally{if(db)await db.end();await admin.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');await admin.end();}
});
