'use strict';
// ECO-03 (7/11/2026, option B choisie par Kayan) : la meilleure partie du jour de chaque mode compte.
// 30 ₽ (perdue), 60 ₽ (gagnée), 90 ₽ (belle partie) : une partie meilleure verse la différence, 90 ₽ au plus
// par mode et par jour, 2 000 ₽ par jour au plus pour toutes les parties (inchangés).
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const {randomUUID} = require('node:crypto');
const {createBallService,initBallsDb} = require('../lib/poke-balls');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const pokemon = [{id:6,name:'Dracaufeu',generation:1,weight:5},{id:25,name:'Pikachu',generation:1,weight:20},{id:133,name:'Évoli',generation:2,weight:8}];
const me = {key:'user:eco03',guestKey:'guest:eco03',accountId:'eco03'};
const sql = {skip:!process.env.QA_DATABASE_URL,timeout:60000};
async function withDb(run) {
  const {Pool} = require('pg'), schema = 'eco03_' + randomUUID().replaceAll('-','');
  const admin = new Pool({connectionString:process.env.QA_DATABASE_URL}); let db;
  try {
    await admin.query('CREATE SCHEMA '+schema);
    db = new Pool({connectionString:process.env.QA_DATABASE_URL,options:'-c search_path='+schema,max:6});
    await initBallsDb(db); await run(db);
  } finally { if(db)await db.end(); await admin.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE'); await admin.end(); }
}
const service = (db) => createBallService({db,pokemon,secret:'local-only',clock:()=>new Date('2026-11-07T12:00:00Z'),randomInt:()=>0});
const duel = async (s, who, choice) => {
  const a = (await s.arcadeStart(who,{mode:'weight',startId:randomUUID(),gens:[1]})).arcade;
  return s.arcadeAnswer(who,{mode:'weight',sessionId:a.sessionId,round:a.round,choice});
};

test('PostgreSQL: a better game pays the difference, never more than 90 ₽ per mode', sql, () => withDb(async db => {
  const s = service(db); await s.state(me);
  let r = await duel(s, me, 6); // perdu
  assert.deepEqual(r.coinsAdded, [{source:'play:weight',amount:30}]);
  assert.equal(r.coins.byMode.weight, 30);
  r = await duel(s, me, 6);
  assert.deepEqual(r.coinsAdded, [], 'another lost game pays nothing');
  r = await duel(s, me, 25); // gagné (série 1)
  assert.deepEqual(r.coinsAdded, [{source:'play:weight:60',amount:30}]);
  assert.equal(r.coins.balance, 60); assert.equal(r.coins.byMode.weight, 60);
  for (let i = 2; i < 10; i++) assert.deepEqual((await duel(s, me, 25)).coinsAdded, [], 'same tier pays nothing');
  r = await duel(s, me, 25); // série 10 : belle partie
  assert.deepEqual(r.coinsAdded, [{source:'play:weight:90',amount:30}]);
  assert.equal(r.coins.balance, 90); assert.equal(r.coins.byMode.weight, 90);
  assert.deepEqual((await duel(s, me, 25)).coinsAdded, [], 'already 90 ₽ for this mode');
  assert.equal((await s.state(me)).coins.balance, 90);
}));

test('PostgreSQL: the 2 000 ₽ daily cap for games still applies', sql, () => withDb(async db => {
  const s = service(db); await s.state(me);
  for (let i = 0; i < 22; i++) await db.query("INSERT INTO coin_ledger(identity,account_id,day,source,amount) VALUES($1,$2,'2026-11-07',$3,90)", [me.key, me.accountId, 'play:test' + i]);
  const r = await duel(s, me, 25);
  assert.deepEqual(r.coinsAdded, [{source:'play:weight',amount:20}]);
  assert.deepEqual((await duel(s, me, 25)).coinsAdded, []);
  for (let i = 2; i < 10; i++) await duel(s, me, 25);
  assert.deepEqual((await duel(s, me, 25)).coinsAdded, [], 'cap reached: a fine game adds nothing');
}));

test('the game line and the shop say the best game of the day counts', () => {
  const line = read('src/script.10xzl.reward-line.js'), shop = read('src/script.10xzh.shop.js');
  assert.match(line, /ta meilleure partie compte, tu peux encore faire mieux/);
  assert.match(line, /byMode/);
  assert.match(shop, /Ta meilleure partie du jour/);
  assert.match(shop, /90 ₽ au plus par jeu/);
  assert.doesNotMatch(line + shop, /1re partie du jour : 1 Ball/);
});
