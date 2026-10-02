"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const {ensureLeaderboardResultKeys,recordLeaderboardResult,recordLeaderboardResultInTransaction}=require("../lib/leaderboard-store");
test("a storage failure rolls back the event and always releases the connection",async()=>{
 const calls=[];let released=false;
 const client={query:async(sql)=>{calls.push(sql);if(sql.startsWith("INSERT INTO scores"))throw Error("write failed");return {rows:[{score:6}]};},release(){released=true;}};
 await assert.rejects(recordLeaderboardResult({connect:async()=>client},{id:"test"},"daily",6,{direction:"asc"},"daily:2026-10-02"),/write failed/);
 assert.equal(calls[0],"BEGIN");assert.equal(calls.at(-1),"ROLLBACK");assert.equal(released,true);assert.equal(calls.includes("COMMIT"),false);
});
test("an outer transaction can record a leaderboard result without opening another transaction",async()=>{
 const calls=[];
 const client={query:async(sql)=>{
  calls.push(sql);
  if(sql.startsWith("INSERT INTO leaderboard_events"))return {rows:[{score:3}]};
  return {rows:[]};
 }};
 const stored=await recordLeaderboardResultInTransaction(client,{id:"A"},"daily",3,{direction:"asc"},"daily:2026-10-02");
 assert.deepEqual(stored,{score:3,duplicate:false});
 assert.equal(calls.includes("BEGIN"),false);assert.equal(calls.includes("COMMIT"),false);assert.equal(calls.includes("ROLLBACK"),false);
});
test("PostgreSQL migration preserves legacy records and concurrent retries count once",{skip:!process.env.QA_DATABASE_URL},async()=>{
 const {Pool}=require("pg"),url=process.env.QA_DATABASE_URL;
 const admin=new Pool({connectionString:url});const schema="qa_"+crypto.randomUUID().replaceAll("-","");let pool;
 try {
  await admin.query('CREATE SCHEMA "'+schema+'"');
  pool=new Pool({connectionString:url,options:"-c search_path="+schema});
  await pool.query("CREATE TABLE leaderboard_events(id bigserial PRIMARY KEY,discord_id text NOT NULL,mode text NOT NULL,score integer NOT NULL,created_at timestamptz NOT NULL DEFAULT now())");
  await pool.query("CREATE TABLE scores(discord_id text NOT NULL,mode text NOT NULL,score integer NOT NULL,username text NOT NULL DEFAULT '',avatar text NOT NULL DEFAULT '',updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(discord_id,mode))");
  await pool.query("INSERT INTO leaderboard_events(discord_id,mode,score) VALUES('legacy','daily',4)");
  await ensureLeaderboardResultKeys(pool);await ensureLeaderboardResultKeys(pool);
  const user={id:"A",username:"QA A"};
  const results=await Promise.all([1,2,3].map(()=>recordLeaderboardResult(pool,user,"daily",6,{direction:"asc"},"daily:2026-10-02")));
  assert.equal(results.filter(r=>r.duplicate).length,2);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM leaderboard_events WHERE discord_id='A'")).rows[0].n,1);
  const repeated=await recordLeaderboardResult(pool,user,"daily",1,{direction:"asc"},"daily:2026-10-02");assert.equal(repeated.score,6);
  assert.equal((await pool.query("SELECT score FROM scores WHERE discord_id='A'")).rows[0].score,6);
  await recordLeaderboardResult(pool,{id:"B"},"daily",2,{direction:"asc"},"daily:2026-10-02");
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM leaderboard_events")).rows[0].n,3);
  assert.equal((await pool.query("SELECT score FROM leaderboard_events WHERE discord_id='legacy'")).rows[0].score,4);
 } finally {if(pool)await pool.end();await admin.query('DROP SCHEMA IF EXISTS "'+schema+'" CASCADE');await admin.end();}
});
