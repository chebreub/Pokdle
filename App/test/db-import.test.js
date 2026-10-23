'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {IMPORT_NAME,DATE_AS_TEXT,importLegacy,scheduleLegacyImport}=require('../lib/db-import');

// The tables as production creates them, enough of each for the import to meet real shapes.
const SCHEMA=`
CREATE TABLE users(discord_id TEXT PRIMARY KEY,username TEXT NOT NULL DEFAULT '',avatar TEXT NOT NULL DEFAULT '',data JSONB NOT NULL DEFAULT '{}'::jsonb,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),last_login TIMESTAMPTZ NOT NULL DEFAULT now(),partner_id INTEGER);
CREATE TABLE account_identities(provider TEXT NOT NULL,provider_user_id TEXT NOT NULL,account_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),PRIMARY KEY(provider,provider_user_id));
CREATE TABLE scores(discord_id TEXT NOT NULL,mode TEXT NOT NULL,score INTEGER NOT NULL DEFAULT 0,username TEXT NOT NULL DEFAULT '',avatar TEXT NOT NULL DEFAULT '',updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),PRIMARY KEY(discord_id,mode));
CREATE TABLE leaderboard_events(id BIGSERIAL PRIMARY KEY,discord_id TEXT NOT NULL,mode TEXT NOT NULL,score INTEGER NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),result_key TEXT);
CREATE UNIQUE INDEX leaderboard_events_result_key ON leaderboard_events(discord_id,mode,result_key) WHERE result_key IS NOT NULL;
CREATE TABLE daily_sessions(discord_id TEXT NOT NULL,day DATE NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,guessed JSONB NOT NULL DEFAULT '[]'::jsonb,finished BOOLEAN NOT NULL DEFAULT false,updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),PRIMARY KEY(discord_id,day));
CREATE TABLE visits(day DATE PRIMARY KEY,hits INTEGER NOT NULL DEFAULT 0);
CREATE TABLE daily_rounds(day DATE PRIMARY KEY,secret_id INTEGER NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE daily_plays(identity TEXT NOT NULL,day DATE NOT NULL REFERENCES daily_rounds(day),account_id TEXT,guessed JSONB NOT NULL DEFAULT '[]'::jsonb,status TEXT NOT NULL DEFAULT 'playing',started_at TIMESTAMPTZ NOT NULL DEFAULT now(),finished_at TIMESTAMPTZ,elapsed_ms BIGINT,hints_used INTEGER NOT NULL DEFAULT 0,migrated BOOLEAN NOT NULL DEFAULT false,PRIMARY KEY(identity,day));
CREATE TABLE egg_rounds(id BIGSERIAL PRIMARY KEY,week_start DATE NOT NULL UNIQUE,secret_id INTEGER NOT NULL,reward_id INTEGER NOT NULL,found_by TEXT,found_at TIMESTAMPTZ,winner_name TEXT);
CREATE TABLE egg_guesses(id BIGSERIAL PRIMARY KEY,round_id BIGINT NOT NULL REFERENCES egg_rounds(id),pokemon_id INTEGER NOT NULL,player_id TEXT,anon_id TEXT NOT NULL,ip_hash TEXT NOT NULL,day DATE NOT NULL,username TEXT NOT NULL,correct BOOLEAN NOT NULL DEFAULT false,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),credited_player_id TEXT,UNIQUE(round_id,pokemon_id));
CREATE TABLE egg_rewards(round_id BIGINT PRIMARY KEY REFERENCES egg_rounds(id),player_id TEXT NOT NULL,pokemon_id INTEGER NOT NULL,granted_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE deleted_accounts(id TEXT PRIMARY KEY,deleted_at TIMESTAMPTZ NOT NULL DEFAULT now());`;

test('PostgreSQL: the old database comes back once, without overwriting what was played since',{skip:!process.env.QA_DATABASE_URL,timeout:30000},async()=>{
  const {Pool}=require('pg'),{randomUUID}=require('node:crypto'),suffix=randomUUID().replaceAll('-','').slice(0,12);
  const oldSchema='legacy_'+suffix,newSchema='current_'+suffix,admin=new Pool({connectionString:process.env.QA_DATABASE_URL});
  const pool=schema=>new Pool({connectionString:process.env.QA_DATABASE_URL,options:'-c search_path='+schema,max:3,types:DATE_AS_TEXT});
  let old,db;
  try{
    await admin.query(`CREATE SCHEMA ${oldSchema}; CREATE SCHEMA ${newSchema}`);
    old=pool(oldSchema);db=pool(newSchema);
    await old.query(SCHEMA);await db.query(SCHEMA);
    // Before the move: Alice has a long history, Bob played once, an egg was found.
    await old.query(`INSERT INTO users(discord_id,username,data,created_at,partner_id) VALUES
      ('A','Alice','{"profile":{"xp":900,"album":[1,2,3,4,5,6,7,8]}}','2026-06-01T10:00:00Z',25),('B','Bob','{"profile":{"xp":50}}','2026-07-01T10:00:00Z',NULL),('D','Dan','{"profile":{"xp":5}}','2026-08-01T10:00:00Z',NULL),('E','Eve','{"profile":{"xp":120}}','2026-08-15T10:00:00Z',NULL),('F','Faye','{"_accountId":"B","profile":{"xp":999}}','2026-08-16T10:00:00Z',NULL);
      INSERT INTO account_identities(provider,provider_user_id,account_id) VALUES('discord','A','A'),('google','g-b','B'),('discord','F','F');
      INSERT INTO scores(discord_id,mode,score) VALUES('A','quiz',10),('A','wordle',3),('B','quiz',4),('D','quiz',99);
      INSERT INTO leaderboard_events(discord_id,mode,score,result_key,created_at) VALUES('A','dossier',18,'dossier:2026-10-17','2026-10-17T12:00:00Z'),('A','quiz',10,NULL,'2026-10-10T12:00:00Z');
      INSERT INTO daily_sessions(discord_id,day,attempts) VALUES('A','2026-09-01',4);
      INSERT INTO visits(day,hits) VALUES('2026-10-18',120),('2026-10-19',7);
      INSERT INTO daily_rounds(day,secret_id) VALUES('2026-10-17',25),('2026-10-18',6),('2026-10-19',150);
      INSERT INTO daily_plays(identity,day,account_id,guessed,status) VALUES('user:A','2026-10-17','A','[1,25]','won'),('user:A','2026-10-18','A','[6]','won'),('user:B','2026-10-19','B','[150]','won'),('user:D','2026-10-17','D','[2]','won');
      INSERT INTO egg_rounds(week_start,secret_id,reward_id,found_by,found_at,winner_name) VALUES('2026-10-12',7,8,'user:A','2026-10-13T09:00:00Z','Alice');
      INSERT INTO egg_guesses(round_id,pokemon_id,player_id,anon_id,ip_hash,day,username,correct) VALUES(1,4,'A','x','h','2026-10-13','Alice',false),(1,7,'A','x','h','2026-10-13','Alice',true),(1,9,'D','y','h2','2026-10-14','Dan',false);
      INSERT INTO egg_rewards(round_id,player_id,pokemon_id) VALUES(1,'A',8);`);
    // Since the move: Alice came back on a new browser, Chloé is new, Dan deleted his account, today's games exist already.
    await db.query(`INSERT INTO deleted_accounts(id) VALUES('D');
      INSERT INTO users(discord_id,username,data) VALUES('A','Alice','{"profile":{"xp":20}}'),('C','Chloé','{"profile":{"xp":70}}'),('E','Eve','{"_accountId":"E","_savedAt":1777777777777}');
      INSERT INTO account_identities(provider,provider_user_id,account_id) VALUES('discord','A','A');
      INSERT INTO scores(discord_id,mode,score) VALUES('A','quiz',12),('A','wordle',5);
      INSERT INTO leaderboard_events(discord_id,mode,score,result_key) VALUES('A','dossier',20,'dossier:2026-10-17');
      INSERT INTO visits(day,hits) VALUES('2026-10-19',40);
      INSERT INTO daily_rounds(day,secret_id) VALUES('2026-10-19',3);
      INSERT INTO daily_plays(identity,day,account_id,guessed,status) VALUES('user:C','2026-10-19','C','[3]','won');
      INSERT INTO egg_rounds(week_start,secret_id,reward_id) VALUES('2026-10-19',9,10);`);

    const report=await importLegacy({db,old,ascModes:['wordle','daily']});
    assert.equal(report.users,2,'Bob comes back and Faye gets a blank but valid account row');
    assert.equal(report.profilesOwnerMismatch,1,'A foreign-owned legacy snapshot is excluded');
    assert.equal(report.profilesRestored,1,'Eve gets the old profile because her live row is genuinely empty');
    assert.equal(report.profilesBackedUp,1,'Alice has both snapshots preserved for deliberate recovery');
    const users=Object.fromEntries((await db.query('SELECT discord_id,data,partner_id,created_at FROM users')).rows.map(r=>[r.discord_id,r]));
    assert.equal(users.A.data.profile.xp,20,'A newer live profile survives even when the old blob is longer');
    assert.equal(users.E.data.profile.xp,120,'Only an empty placeholder is restored');
    assert.deepEqual(users.F.data,{},'A mismatched old snapshot is not attached to another account');
    assert.equal((await db.query("SELECT account_id FROM account_identities WHERE provider='discord' AND provider_user_id='F'")).rows[0].account_id,'F','The cleaned account still supports identity import');
    const backups=(await db.query("SELECT legacy_data,current_data FROM legacy_profile_backups WHERE discord_id='A'")).rows;
    assert.equal(backups.length,1);
    assert.equal(backups[0].legacy_data.profile.xp,900,'The old progress is recoverable');
    assert.equal(backups[0].current_data.profile.xp,20,'The live snapshot is also recoverable');
    assert.equal(users.A.partner_id,25);assert.equal(users.A.created_at.toISOString(),'2026-06-01T10:00:00.000Z');
    assert.equal(users.C.data.profile.xp,70,'new players are untouched');
    assert.equal(users.D,undefined,'an account deleted since the move does not come back');
    assert.equal((await db.query("SELECT account_id FROM account_identities WHERE provider='google'")).rows[0].account_id,'B');
    const scores=Object.fromEntries((await db.query("SELECT discord_id||':'||mode AS k,score FROM scores")).rows.map(r=>[r.k,r.score]));
    assert.deepEqual(scores,{'A:quiz':12,'A:wordle':3,'B:quiz':4},'the best of both sides, lower is better for the Wordle');
    assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM leaderboard_events WHERE result_key='dossier:2026-10-17'")).rows[0].n,1,'a result already kept is not doubled');
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM leaderboard_events')).rows[0].n,2);
    assert.deepEqual((await db.query('SELECT day,hits FROM visits ORDER BY day')).rows,[{day:'2026-10-18',hits:120},{day:'2026-10-19',hits:47}]);
    const rounds=(await db.query('SELECT day,secret_id FROM daily_rounds ORDER BY day')).rows;
    assert.deepEqual(rounds,[{day:'2026-10-17',secret_id:25},{day:'2026-10-18',secret_id:6},{day:'2026-10-19',secret_id:3}],'today keeps the Pokémon drawn since the move');
    const plays=(await db.query('SELECT identity,day FROM daily_plays ORDER BY day,identity')).rows.map(r=>r.identity+'@'+r.day);
    assert.deepEqual(plays,['user:A@2026-10-17','user:A@2026-10-18','user:C@2026-10-19'],'old plays of a redrawn day are left out');
    assert.deepEqual((await db.query('SELECT guessed FROM daily_plays WHERE identity=$1 AND day=$2',['user:A','2026-10-17'])).rows[0].guessed,[1,25]);
    const eggs=(await db.query('SELECT id,week_start,found_by FROM egg_rounds ORDER BY week_start')).rows;
    assert.equal(eggs.length,2);assert.equal(eggs[0].found_by,'user:A');
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM egg_guesses WHERE round_id=$1',[eggs[0].id])).rows[0].n,3,'guesses follow their round under its new id');
    assert.deepEqual((await db.query('SELECT player_id,username FROM egg_guesses WHERE pokemon_id=9')).rows[0],{player_id:null,username:'Anonyme'},"a deleted player's guess stays, anonymised");
    assert.equal((await db.query('SELECT pokemon_id FROM egg_rewards WHERE round_id=$1',[eggs[0].id])).rows[0].pokemon_id,8);

    // The scheduler records the import and never runs it twice.
    const logs=[],url=process.env.QA_DATABASE_URL+(process.env.QA_DATABASE_URL.includes('?')?'&':'?')+'sslmode=disable&options='+encodeURIComponent('-c search_path='+oldSchema);
    await db.query("DELETE FROM visits WHERE day='2026-10-18'");
    const job=scheduleLegacyImport({db,oldUrl:url,ascModes:['wordle'],readyBefore:new Promise(()=>{}),log:{log:(...a)=>logs.push(a.join(' '))}});
    await job.attempt();
    assert.equal((await db.query('SELECT name FROM data_imports')).rows[0].name,IMPORT_NAME);
    assert.equal((await db.query("SELECT hits FROM visits WHERE day='2026-10-18'")).rows[0].hits,120,'the scheduled run imported');
    await job.attempt();
    assert.equal((await db.query("SELECT hits FROM visits WHERE day='2026-10-19'")).rows[0].hits,47+7,'a second attempt does nothing more than the first');
    assert.ok(logs.some(l=>l.includes('old data restored')));

    // An unreachable old database is reported and retried later, nothing is written.
    await db.query('DELETE FROM data_imports');
    const down=scheduleLegacyImport({db,oldUrl:'postgresql://qa@127.0.0.1:1/none?sslmode=disable',readyBefore:new Promise(()=>{}),log:{log:(...a)=>logs.push(a.join(' '))}});
    await down.attempt();
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM data_imports')).rows[0].n,0);
    assert.ok(logs.some(l=>l.includes('not available yet')));
    await db.query("DELETE FROM users WHERE discord_id='A'");
    assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM legacy_profile_backups WHERE discord_id='A'")).rows[0].n,0,'Deleting an account automatically purges its migration backup');
  }finally{if(old)await old.end();if(db)await db.end();await admin.query(`DROP SCHEMA IF EXISTS ${oldSchema} CASCADE; DROP SCHEMA IF EXISTS ${newSchema} CASCADE`);await admin.end();}
});
