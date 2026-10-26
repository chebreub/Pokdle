'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {PP,LEGENDARY_IDS,REGIONAL_FORMS_FROM,buildCriteria,buildGrid,gridPoints,speciesOf,isRegionalForm,regionalFormsOn,playableOf,speciesIdOf,initGridDb,createGridService}=require('../lib/daily-grid');

// The real catalogue: 1025 species plus the forms the server injects (Méga, régionales…).
function realCatalogue(){
  const list=JSON.parse(fs.readFileSync(path.join(__dirname,'../pokemon.js'),'utf8').match(/const POKEMON_LIST =\s*(\[[\s\S]*\]);/)[1]);
  const core=fs.readFileSync(path.join(__dirname,'../src/script.01.core.js'),'utf8'),context={};
  vm.createContext(context);vm.runInContext('forms='+core.match(/const EXTRA_FORMS =\s*(\[[\s\S]*?\]);/)[1],context);
  return list.concat(context.forms.map(f=>({...f,isAltForm:true})));
}

test('every day draws one fixed grid whose nine cells all have answers',()=>{
  const pokemon=realCatalogue(),criteria=buildCriteria(pokemon),species=speciesOf(pokemon);
  assert.equal(species.length,1025);
  assert.ok(species.filter(criteria.get('special:mega').test).length>=40,'species with a Mega evolution come from the forms');
  assert.ok(species.filter(criteria.get('special:regional').test).length>=40,'species with a regional form come from the forms');
  const seen=new Set();
  for(let i=0;i<40;i++){
    const day=new Date(Date.UTC(2026,9,19+i)).toISOString().slice(0,10),grid=buildGrid(day,criteria,species);
    assert.deepEqual(buildGrid(day,criteria,species),grid,'same grid for everyone on '+day);
    const keys=[...grid.rows,...grid.cols];
    assert.equal(new Set(keys).size,6);
    for(const key of keys)assert.ok(criteria.has(key),key);
    const families={};for(const key of keys)families[key.split(':')[0]]=(families[key.split(':')[0]]||0)+1;
    assert.ok((families.gen||0)<=2&&(families.type||0)<=4,'no grid is only generations or only types');
    for(const row of grid.rows)for(const col of grid.cols){
      const answers=species.filter(p=>criteria.get(row).test(p)&&criteria.get(col).test(p)).length;
      assert.ok(answers>=3,day+' '+row+' × '+col+' has '+answers+' answers');
    }
    seen.add(keys.join('|'));
  }
  assert.equal(seen.size,40,'the grid changes every day');
});

test('the legendary list matches the Pokédex filter and points follow the cells found',()=>{
  const core=fs.readFileSync(path.join(__dirname,'../src/script.01.core.js'),'utf8');
  const client=JSON.parse(core.match(/const POKEDEX_LEGENDARY_IDS = new Set\((\[[^\]]*\])\)/)[1]);
  assert.deepEqual([...LEGENDARY_IDS].sort((a,b)=>a-b),client.sort((a,b)=>a-b));
  assert.equal(gridPoints(Array(9).fill(null)),0);
  assert.equal(gridPoints([1,2,null,4,5,null,null,null,9]),50);
  assert.equal(gridPoints([1,2,3,4,5,6,7,8,9]),100,'a full grid earns a 10-point bonus');
});

test('PostgreSQL: shared grid, nine PP, rarity, originality, adoption, rankings and Paris rollover',{skip:!process.env.QA_DATABASE_URL,timeout:30000},async()=>{
  const {Pool}=require('pg'),{randomUUID}=require('node:crypto');const schema='grid_'+randomUUID().replaceAll('-','');const admin=new Pool({connectionString:process.env.QA_DATABASE_URL});let db;
  // Thirty species: types Feu/Eau/Plante in turn, generations 1/2/3 in turn, every fifth one also flies.
  const T=['Feu','Eau','Plante'],pokemon=Array.from({length:30},(_,i)=>({id:i+1,name:'Pkmn'+(i+1),type1:T[i%3],type2:i%5===0?'Vol':null,gen:Math.floor(i/3)%3+1,color:'Rouge',stage:1,height:1,weight:10}));
  const draw=()=>({rows:['type:Feu','type:Eau','type:Plante'],cols:['gen:1','gen:2','shape:dual']});
  const criteria=buildCriteria(pokemon),fits=(cell,p)=>criteria.get(draw().rows[Math.floor(cell/3)]).test(p)&&criteria.get(draw().cols[cell%3]).test(p);
  const answers=cell=>pokemon.filter(p=>fits(cell,p)).map(p=>p.id),wrong=cell=>pokemon.find(p=>!fits(cell,p)).id;
  try{
    await admin.query('CREATE SCHEMA '+schema);db=new Pool({connectionString:process.env.QA_DATABASE_URL,options:'-c search_path='+schema,max:6});
    await db.query('CREATE TABLE users(discord_id TEXT PRIMARY KEY,username TEXT,avatar TEXT,partner_id INT,xp INT,photo_key TEXT)');
    await db.query("INSERT INTO users(discord_id,username,avatar,xp) VALUES('A','Alice','',122928),('B','Bob','',0),('C','Chloé','',NULL),('D','Dan','',2250)");
    await initGridDb(db);await initGridDb(db);
    let now=new Date('2026-10-19T12:00:00Z');const game=createGridService({db,pokemon,clock:()=>now,draw});
    const guest={key:'guest:g',guestKey:'guest:g'},A={key:'user:A',guestKey:'guest:a',accountId:'A'},B={key:'user:B',guestKey:'guest:b',accountId:'B'},C={key:'user:C',guestKey:'guest:c',accountId:'C'};
    const play=(who,cell,pokemonId)=>{now=new Date(+now+1000);return game.guess(who,{day:'2026-10-19',accountId:who.accountId||null,cell,pokemonId});};

    let s=await game.state(guest);
    assert.equal(s.status,'ready');assert.equal(s.pp,PP);assert.deepEqual(s.cells,Array(9).fill(null));
    assert.deepEqual(s.rows.map(r=>r.label),['Type Feu','Type Eau','Type Plante']);
    assert.deepEqual(s.possible,Array.from({length:9},(_,i)=>answers(i).length),'each cell says how many answers exist');
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM grid_plays')).rows[0].n,0,'looking at the grid does not start a play');

    s=await play(guest,0,wrong(0));
    assert.equal(s.feedback.correct,false);assert.ok(s.feedback.failed.length>=1);assert.equal(s.pp,8);assert.equal(s.status,'playing');
    await assert.rejects(play(guest,0,wrong(0)),{code:'already_tried'},'the same miss twice costs nothing');
    const [first,second]=answers(0);
    s=await play(guest,0,first);
    assert.equal(s.feedback.correct,true);assert.deepEqual(s.cells[0],{pokemonId:first,rarity:100});assert.equal(s.pp,7);assert.equal(s.points,10);
    await assert.rejects(play(guest,0,second),{code:'cell_filled'});
    await assert.rejects(game.guess(guest,{day:'2026-10-18',accountId:null,cell:1,pokemonId:1}),{code:'stale_daily'});
    await assert.rejects(game.guess(guest,{day:'2026-10-19',accountId:'A',cell:1,pokemonId:1}),{code:'account_changed'});
    await assert.rejects(play(guest,9,1),{code:'invalid_guess'});await assert.rejects(play(guest,1,999),{code:'invalid_guess'});

    s=await play(A,0,first);assert.equal(s.cells[0].rarity,100,'two players, same pick: 100 %');
    await assert.rejects(play(A,1,first),{code:'already_used'},'a Pokémon fills one cell only');
    s=await play(B,0,second);assert.equal(s.cells[0].rarity,33,'one player in three');
    const bobAfterFirst=s;
    s=await game.state(A);assert.equal(s.cells[0].rarity,67);assert.equal(s.originality,33);

    s=await game.stop(A,{day:'2026-10-19',accountId:'A'});
    assert.equal(s.status,'completed');assert.equal(s.endReason,'stopped');assert.equal(s.points,10);assert.equal(s.ranked,true);
    assert.equal(s.reveal.length,9);assert.deepEqual(s.reveal[0].popular,{pokemonId:first,rarity:67});
    assert.ok(s.reveal[4].examples.every(id=>fits(4,pokemon[id-1])),'examples answer their cell');
    assert.deepEqual(s.rank,{rank:1,total:1});
    s=await play(A,1,answers(1)[0]);assert.equal(s.status,'completed');assert.equal(s.cells[1],null,'a finished grid ignores new guesses');

    s=bobAfterFirst;
    for(let cell=1;cell<9;cell++){const used=s.cells.filter(Boolean).map(c=>c.pokemonId);s=await play(B,cell,answers(cell).find(id=>!used.includes(id)));}
    assert.equal(s.found,9);assert.equal(s.status,'completed');assert.equal(s.endReason,'full');assert.equal(s.points,100);assert.equal(s.pp,0);

    for(let cell=0;cell<PP;cell++)s=await play(C,cell,wrong(cell));
    assert.equal(s.status,'completed');assert.equal(s.endReason,'out_of_pp');assert.equal(s.points,0);assert.equal(s.originality,null);

    // A guest who signs in keeps the grid started before.
    const g2={key:'guest:g2',guestKey:'guest:g2'},D={key:'user:D',guestKey:'guest:g2',accountId:'D'};
    await play(g2,4,answers(4)[0]);
    s=await game.state(D);assert.equal(s.cells[4].pokemonId,answers(4)[0]);assert.equal(s.accountId,'D');
    assert.equal((await db.query("SELECT account_id FROM grid_plays WHERE identity='user:D'")).rows[0].account_id,'D');

    const board=await game.leaderboard('today','A');
    assert.deepEqual(board.top.map(r=>[r.username,r.score]),[['Bob',100],['Alice',10],['Chloé',0]],'guests and unfinished plays stay out');
    // The level next to each name: from the account's XP, none without a saved profile.
    assert.deepEqual(board.top.map(r=>[r.username,r.level]),[['Bob',1],['Alice',70],['Chloé',null]]);
    assert.deepEqual(board.me,{rank:2,score:10,originality:60},'two of the five players chose that Pokémon');
    assert.equal((await game.leaderboard('week','B')).me.score,100);

    now=new Date('2026-10-19T22:00:01Z');
    s=await game.state(A);assert.equal(s.day,'2026-10-20');assert.equal(s.status,'ready');assert.equal(s.pp,PP);
    assert.equal((await game.leaderboard('today','A')).total,0);assert.equal((await game.leaderboard('all','A')).me.score,10);
  }finally{if(db)await db.end();await admin.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');await admin.end();}
});

test('regional forms are answers of their own from REGIONAL_FORMS_FROM, judged on their own types and colour',()=>{
  const pokemon=realCatalogue(),criteria=buildCriteria(pokemon),byName=name=>pokemon.find(p=>p.name===name);
  assert.equal(pokemon.filter(isRegionalForm).length,57,'Alola, Galar, Hisui, Paldea and the three Paldea Tauros');
  assert.ok(!isRegionalForm(byName('Méga-Dracaufeu X'))&&!isRegionalForm(byName('Darumacho de Galar Mode Transe')),'Méga and special forms stay out');
  assert.ok(!regionalFormsOn('2026-10-24')&&regionalFormsOn(REGIONAL_FORMS_FROM),'the day already started keeps its rules');
  assert.equal(playableOf(pokemon,'2026-10-24').length,1025);
  assert.equal(playableOf(pokemon,REGIONAL_FORMS_FROM).length,1025+57);
  const articuno=byName('Artikodin de Galar'),weezing=byName('Smogogo de Galar');
  for(const key of ['type:Psy','color:Violet','special:legendary','special:regional'])assert.ok(criteria.get(key).test(articuno),'Artikodin de Galar fits '+key);
  assert.ok(!criteria.get('type:Glace').test(articuno),'not the species types');
  assert.ok(criteria.get('shape:dual').test(weezing)&&!criteria.get('shape:dual').test(byName('Smogogo')),'Smogogo de Galar has two types, Smogogo one');
  assert.ok(criteria.get('special:regional').test(byName('Tauros')),'Tauros has its Paldea forms');
  assert.equal(speciesIdOf(weezing),110);
});

test('PostgreSQL: a regional form counts from REGIONAL_FORMS_FROM and shares « one Pokémon per grid » with its species',{skip:!process.env.QA_DATABASE_URL,timeout:30000},async()=>{
  const {Pool}=require('pg'),{randomUUID}=require('node:crypto');const schema='gridform_'+randomUUID().replaceAll('-','');const admin=new Pool({connectionString:process.env.QA_DATABASE_URL});let db;
  const base={stage:1,height:1,weight:10,type2:null};
  const pokemon=[{...base,id:1,name:'Alpha',type1:'Feu',gen:1,color:'Rouge'},{...base,id:2,name:'Beta',type1:'Eau',gen:1,color:'Bleu'},{...base,id:3,name:'Gamma',type1:'Plante',gen:1,color:'Vert'},
    {...base,id:21001,name:'Alpha de Galar',baseId:1,isAltForm:true,type1:'Eau',gen:8,color:'Bleu'}];
  const draw=()=>({rows:['type:Feu','type:Eau','type:Plante'],cols:['gen:1','gen:8','shape:mono']});
  try{
    await admin.query('CREATE SCHEMA '+schema);db=new Pool({connectionString:process.env.QA_DATABASE_URL,options:'-c search_path='+schema,max:4});
    await initGridDb(db);
    let now=new Date('2026-10-24T12:00:00Z');const game=createGridService({db,pokemon,clock:()=>now,draw});
    const guest={key:'guest:f',guestKey:'guest:f'},play=(day,cell,pokemonId)=>game.guess(guest,{day,accountId:null,cell,pokemonId});
    let s=await game.state(guest);
    assert.equal(s.regionalForms,false);assert.equal(s.possible[4],0,'Eau × Galar has no species');
    await assert.rejects(play('2026-10-24',4,21001),{code:'form_not_allowed'},'the day already started keeps its rules');
    now=new Date(REGIONAL_FORMS_FROM+'T12:00:00Z');
    s=await game.state(guest);
    assert.equal(s.regionalForms,true);assert.equal(s.possible[4],1,'the form answers Eau × Galar');
    s=await play(REGIONAL_FORMS_FROM,4,21001);
    assert.equal(s.feedback.correct,true);assert.equal(s.cells[4].pokemonId,21001);
    await assert.rejects(play(REGIONAL_FORMS_FROM,0,1),{code:'already_used'},'its species cannot fill another cell');
  }finally{if(db)await db.end();await admin.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');await admin.end();}
});
