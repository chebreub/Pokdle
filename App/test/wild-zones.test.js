'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path');
const {ZONES,ZONE_POOLS,WILD_POOL,WILD_ENCOUNTER_TABLE,ZONE_ENCOUNTER_TABLES,createBallService,initBallsDb}=require('../lib/poke-balls');
const {wildTicketFor}=require('../lib/wild-rarity');
const LIST=JSON.parse(fs.readFileSync(path.join(__dirname,'..','pokemon.js'),'utf8').match(/const POKEMON_LIST =\s*(\[[\s\S]*\]);/)[1]);
const TYPES=new Map(LIST.filter(p=>p.id<=1025).map(p=>[p.id,[p.type1,p.type2].filter(Boolean)]));

test('the 6 zones split the 18 types, and every wild Pokémon lives in at least one zone',()=>{
  const all=Object.values(ZONES).flat();
  assert.equal(all.length,18);assert.equal(new Set(all).size,18);
  for(const [key,ids] of Object.entries(ZONE_POOLS)){
    assert.ok(ids.length>100,key+' has enough Pokémon');
    for(const id of ids){assert.ok(WILD_POOL.includes(id),'#'+id+' is a wild Pokémon');assert.ok(TYPES.get(id).some(t=>ZONES[key].includes(t)),'#'+id+' has a '+key+' type');}
  }
  assert.equal(new Set(Object.values(ZONE_POOLS).flat()).size,WILD_POOL.length,'nobody is left out');
  assert.ok(ZONE_POOLS.mer.includes(7)&&ZONE_POOLS.tour.includes(92)&&ZONE_POOLS.volcan.includes(4));
});

test('PostgreSQL: a zone draws from its own types, keeps the zone on the encounter, and refuses an unknown zone',{skip:!process.env.QA_DATABASE_URL,timeout:30000},async()=>{
  const {Pool}=require('pg'),{randomUUID}=require('node:crypto'),schema='zones_'+randomUUID().replaceAll('-',''),admin=new Pool({connectionString:process.env.QA_DATABASE_URL});let db;
  try{
    await admin.query('CREATE SCHEMA '+schema);db=new Pool({connectionString:process.env.QA_DATABASE_URL,options:'-c search_path='+schema,max:4});
    const now=new Date('2026-11-03T12:30:00Z'),ints=[];
    const balls=createBallService({db,clock:()=>now,randomInt:(n)=>ints.length?ints.shift()%n:0,random:()=>0.99});
    await initBallsDb(db);
    const guest={key:'guest:z1',guestKey:'guest:z1',accountId:null};
    await balls.gift(guest);
    await assert.rejects(balls.encounter(guest,{zone:'lune'}),/invalid_zone/);
    ints.push(wildTicketFor(ZONE_ENCOUNTER_TABLES.mer,7),5);
    let s=await balls.encounter(guest,{zone:'mer'});
    assert.deepEqual([s.encounter.pokemonId,s.encounter.zone],[7,'mer']);
    assert.equal((await balls.state(guest)).wild.open.zone,'mer','the zone comes back with the open encounter');
    await balls.skip(guest);
    ints.push(wildTicketFor(WILD_ENCOUNTER_TABLE,WILD_POOL[10]),5);
    s=await balls.encounter(guest,{});
    assert.equal(s.encounter.zone,null,'no zone = au hasard');
    assert.equal(s.encounter.pokemonId,WILD_POOL[10]);
    const col=await balls.collection(guest);
    assert.deepEqual(Object.keys(col.zones).sort(),Object.keys(ZONES).sort());
  }finally{if(db)await db.end();await admin.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');await admin.end();}
});
