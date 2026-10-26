'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {COLUMNS,SECONDS,drawDailySheet,dailyPoints,initDailyPetitBacDb,createDailyPetitBacService}=require('../lib/daily-petitbac');

function realCatalogue(){
  const list=JSON.parse(fs.readFileSync(path.join(__dirname,'../pokemon.js'),'utf8').match(/const POKEMON_LIST =\s*(\[[\s\S]*\]);/)[1]);
  const core=fs.readFileSync(path.join(__dirname,'../src/script.01.core.js'),'utf8'),context={};
  vm.createContext(context);vm.runInContext('forms='+core.match(/const EXTRA_FORMS =\s*(\[[\s\S]*?\]);/)[1],context);
  return list.concat(context.forms.map(f=>({...f,isAltForm:true})));
}
const pokemon=realCatalogue();

test('the daily sheet comes from the date alone: one letter, eight themes, all answerable',()=>{
  const seen=new Set();
  for(let i=0;i<20;i++){
    const day=new Date(Date.UTC(2026,9,19+i)).toISOString().slice(0,10),sheet=drawDailySheet(day,pokemon);
    assert.deepEqual(drawDailySheet(day,pokemon),sheet,'same sheet for everyone on '+day);
    assert.equal(sheet.categories.length,COLUMNS);
    assert.ok(sheet.categories.every(c=>c.family!=='free'&&c.family!=='any'));
    seen.add(sheet.letter+sheet.categories.map(c=>c.key).join());
  }
  assert.ok(seen.size>=18,'the sheet changes from day to day');
  assert.equal(dailyPoints(Array(8).fill({valid:true})),100,'a full sheet earns a 20-point bonus');
  assert.equal(dailyPoints([{valid:true},{valid:false},{valid:true}]),20);
});

test('PostgreSQL: start, save, submit, rarity, late sheets, adoption, rankings and Paris rollover',{skip:!process.env.QA_DATABASE_URL,timeout:30000},async()=>{
  const {Pool}=require('pg'),{randomUUID}=require('node:crypto');const schema='bacday_'+randomUUID().replaceAll('-','');const admin=new Pool({connectionString:process.env.QA_DATABASE_URL});let db;
  const themes=['type:Feu','type:Eau','any','gen:1','shape:dual','color:Rouge','stage:3','special:legendary'].map(key=>({key,family:key.split(':')[0],label:key}));
  const draw=()=>({letter:'S',categories:themes});
  try{
    await admin.query('CREATE SCHEMA '+schema);db=new Pool({connectionString:process.env.QA_DATABASE_URL,options:'-c search_path='+schema,max:6});
    await db.query('CREATE TABLE users(discord_id TEXT PRIMARY KEY,username TEXT,avatar TEXT,partner_id INT,xp INT,photo_key TEXT)');
    await db.query("INSERT INTO users VALUES('A','Alice',''),('B','Bob',''),('C','Chloé',''),('D','Dan','')");
    await initDailyPetitBacDb(db);await initDailyPetitBacDb(db);
    let now=new Date('2026-10-19T12:00:00Z');const game=createDailyPetitBacService({db,pokemon,clock:()=>now,draw});
    const who=(key,accountId=null,guestKey='guest:'+key)=>({key:accountId?'user:'+accountId:'guest:'+key,guestKey,accountId});
    const guest=who('g'),A=who('a','A'),B=who('b','B'),C=who('c','C');
    const body=(w,extra={})=>({day:'2026-10-19',accountId:w.accountId||null,...extra});

    let s=await game.state(guest);
    assert.equal(s.status,'ready');assert.equal(s.letter,undefined,'the letter stays hidden until the start');assert.equal(s.seconds,SECONDS);
    s=await game.start(guest,body(guest));
    assert.equal(s.letter,'S');assert.equal(s.categories.length,8);assert.ok(s.remainingMs>89000);
    const sheet=['Salamech','Stari','Sabelette','Smogo','Scarhino','Simiabraz','Sablaireau','Sulfura'];
    now=new Date(+now+20000);
    s=await game.save(guest,body(guest,{answers:sheet}));
    assert.equal(s.status,'playing');assert.deepEqual(s.answers,sheet,'answers are kept while playing');
    await assert.rejects(game.save(guest,body(guest,{answers:['x']})),{code:'invalid_sheet'});
    s=await game.submit(guest,body(guest,{answers:sheet}));
    assert.equal(s.status,'completed');
    // Salamech (typo) is Fire; Stari Water; Sabelette any; Smogo Kanto; Scarhino dual; Simiabraz not red; Sablaireau evolved twice? no; Sulfura legendary.
    const right=s.results.map(r=>r.valid);
    assert.deepEqual(right,[true,true,true,true,true,false,false,true]);
    assert.equal(s.results[0].name,'Salamèche');
    assert.equal(s.points,60);assert.equal(s.results[0].rarity,100,'alone so far');
    assert.ok(s.examples[5].length>=1,'examples for every theme');
    await assert.rejects(game.start(guest,body(guest,{})).then(r=>{if(r.status==='completed')throw Object.assign(Error('done'),{code:'done'});}),{code:'done'},'one try per day');

    await game.start(A,body(A));s=await game.submit(A,body(A,{answers:['Salamèche','Staross','Scarabrute','Sabelette','Smogogo','Sorbébé','Simiabraz','Suicune']}));
    await game.start(B,body(B));s=await game.submit(B,body(B,{answers:['Simiabraz','','','','','','','']}));
    s=await game.state(A);
    assert.equal(s.results[0].rarity,67,'two of three players chose Salamèche for Fire');
    assert.ok(s.originality!==null);

    // A sheet sent long after the time scores nothing.
    await game.start(C,body(C));now=new Date(+now+(SECONDS+30)*1000);
    s=await game.submit(C,body(C,{answers:sheet}));
    assert.equal(s.late,true);assert.equal(s.points,0);
    // An abandoned sheet closes on its own with what was saved.
    const D=who('d','D');
    await game.start(D,body(D));await game.save(D,body(D,{answers:['Salamèche','','','','','','','']}));
    now=new Date(+now+(SECONDS+30)*1000);
    s=await game.state(D);assert.equal(s.status,'completed');assert.equal(s.points,0,'too late, even with a right answer saved');

    // A guest who signs in keeps the sheet started before.
    const g2=who('g2'),E=who('g2','E','guest:g2');
    await db.query("INSERT INTO users VALUES('E','Eve','')");
    await game.start(g2,body(g2));
    s=await game.state(E);assert.equal(s.status,'playing');assert.equal(s.accountId,'E');

    const board=await game.leaderboard('today','A');
    assert.deepEqual(board.top.map(r=>[r.username,r.score]).slice(0,2),[['Alice',60],['Bob',10]],'ranked by points; guests stay out');
    assert.equal(board.top.some(r=>r.username==='Eve'),false,'unfinished sheets stay out');
    assert.ok(board.me);

    now=new Date('2026-10-19T22:00:01Z');
    s=await game.state(A);assert.equal(s.day,'2026-10-20');assert.equal(s.status,'ready');
  }finally{if(db)await db.end();await admin.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');await admin.end();}
});
