"use strict";
const crypto = require("node:crypto");
const { parisDay, parisMidnight } = require("./egg-mystery");
const { recordLeaderboardResultInTransaction } = require("./leaderboard-store");
const { DAILY_MAX, enquiryPoints } = require("./daily-points");
const bundledForms = Object.fromEntries(Object.entries(require('../forms-data.json')).map(([name, data]) =>
  [name.replace(/^(.+) Mega( [XY])?$/, 'Méga-$1$2'), data]));
// First deploy-ready Git revision containing getDailyPokemon: 30af7a7 (2026-03-23).
const DAILY_ORIGIN = "2026-03-23";
function nextDay(day, delta = 1) { return new Date(Date.parse(day + "T12:00:00Z") + delta * 86400000).toISOString().slice(0,10); }
function dailyCalendar(now = new Date(), origin = DAILY_ORIGIN) {
  const day = parisDay(now);
  return { day, number: Math.floor((Date.parse(day)-Date.parse(origin))/86400000)+1, resetAt: parisMidnight(nextDay(day)).toISOString() };
}
function dailyError(code, status = 409) { return Object.assign(new Error(code), { code, status }); }
function streakFromDays(days, today, abandoned = false) {
  const wins = [...new Set(days)].sort(); let best=0, run=0, previous=null;
  for (const day of wins) { run = previous && nextDay(previous)===day ? run+1 : 1; best=Math.max(best,run); previous=day; }
  return { current: !abandoned && [today,nextDay(today,-1)].includes(previous) ? run : 0, best, lastWin:previous };
}
// The shiny hunt (31/10/2026): each Pokémon du jour found is captured, shiny with odds that
// improve with the streak, like chaining in the games: 1 in 40, 1 in 30 from a 7-day streak,
// 1 in 20 from 30 days. The server rolls once, at the win, and keeps the result with the play.
const SHINY_TIERS = Object.freeze([[30, 20], [7, 30], [0, 40]]);
function shinyOdds(streak) {
  const days = Math.max(0, Number(streak) || 0);
  return SHINY_TIERS.find(([from]) => days >= from)[1];
}
// What the result card shows: the capture once won, the odds for a win today while playing.
function shinyState(status, shiny, streak) {
  if (status === "won") return { captured: true, shiny: Boolean(shiny), streak, odds: shinyOdds(streak) };
  if (status === "playing") return { captured: false, shiny: false, streak: streak + 1, odds: shinyOdds(streak + 1) };
  return { captured: false, shiny: false, streak: 0, odds: null };
}
function dailyGuest(secret, cookie) {
  const [id,mac] = String(cookie||"").split(".");
  if (!/^[a-f0-9]{32}$/.test(id||"") || !/^[a-f0-9]{64}$/.test(mac||"")) return null;
  const expected=crypto.createHmac("sha256",secret).update("daily-guest:"+id).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(mac),Buffer.from(expected)) ? id : null;
}
function issueDailyGuest(secret) {
  const id=crypto.randomBytes(16).toString("hex");
  return {id,cookie:id+"."+crypto.createHmac("sha256",secret).update("daily-guest:"+id).digest("hex")};
}
async function initDailyDb(db, now = new Date()) {
  await db.query("CREATE TABLE IF NOT EXISTS daily_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  await db.query("INSERT INTO daily_settings(key,value) VALUES('transition_day',$1),('legacy_day',$2) ON CONFLICT DO NOTHING",[parisDay(now),now.toISOString().slice(0,10)]);
  await db.query(`CREATE TABLE IF NOT EXISTS daily_rounds (day DATE PRIMARY KEY, secret_id INTEGER NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  await db.query(`CREATE TABLE IF NOT EXISTS daily_plays (
    identity TEXT NOT NULL, day DATE NOT NULL REFERENCES daily_rounds(day), account_id TEXT,
    guessed JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'playing' CHECK(status IN ('playing','won','abandoned')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(), finished_at TIMESTAMPTZ,
    elapsed_ms BIGINT, hints_used INTEGER NOT NULL DEFAULT 0, migrated BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY(identity,day)
  )`);
  await db.query("CREATE INDEX IF NOT EXISTS daily_plays_results ON daily_plays(day,status)");
  await db.query("CREATE INDEX IF NOT EXISTS daily_plays_account ON daily_plays(account_id,day)");
  await db.query("ALTER TABLE daily_plays ADD COLUMN IF NOT EXISTS excluded_stats BOOLEAN NOT NULL DEFAULT false");
  await db.query("ALTER TABLE daily_plays ADD COLUMN IF NOT EXISTS shiny BOOLEAN NOT NULL DEFAULT false");
  // One quick reaction per player and per day, once the day is played (31/10/2026). Kept 30 days.
  await db.query(`CREATE TABLE IF NOT EXISTS daily_reactions (
    day DATE NOT NULL, identity TEXT NOT NULL, emoji TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY(day,identity))`);
}
// The reactions under the Pokémon du jour result. Under FOUND_MIN finders the count stays hidden:
// « 1 joueur l'a trouvé » would make the site look empty.
const DAILY_REACTIONS=["😂","🔥","👏","😱"];
const DAILY_FOUND_MIN=5;
function createDailyService({db,pokemon,compare,legacyTarget,clock=()=>new Date(),randomInt=crypto.randomInt}) {
  const pool=pokemon.filter(p=>p&&!p.isAltForm&&Number(p.id)>0&&Number(p.id)<=1025).sort((a,b)=>a.id-b.id);
  // Targets stay base species; proposals include every playable form. Use the
  // same bundled form measurements as the client, never the base species' size.
  const byId=new Map(pokemon.filter(p=>p&&Number(p.id)>0).map(p=>{
    const form=p.isAltForm?bundledForms[p.name]:null;
    return [Number(p.id),form?{...p,type1:form.type1||p.type1,type2:form.type2!==undefined?form.type2:p.type2,
      height:typeof form.height==='number'?form.height:p.height,weight:typeof form.weight==='number'?form.weight:p.weight}:p];
  }));
  async function transaction(action) {
    const day=parisDay(clock());
    const client=await db.connect();
    try { await client.query("BEGIN"); const result=await action(client); if(parisDay(clock())!==day)throw dailyError("stale_daily"); await client.query("COMMIT"); return result; }
    catch(e){await client.query("ROLLBACK");throw e;} finally{client.release();}
  }
  async function settings(client) { return Object.fromEntries((await client.query("SELECT key,value FROM daily_settings")).rows.map(r=>[r.key,r.value])); }
  // A drawn round never changes: once read back from the database it is kept in
  // memory, so opening the game does not pay a round trip for the secret. Rounds
  // created inside a transaction are only cached once read again (it may roll back).
  const roundCache=new Map();
  function rememberRound(day,r){if(!roundCache.has(day)){roundCache.clear();roundCache.set(day,{secret_id:Number(r.secret_id)});}return roundCache.get(day);}
  async function round(client, day) {
    if(roundCache.has(day))return roundCache.get(day);
    let r=(await client.query("SELECT secret_id FROM daily_rounds WHERE day=$1",[day])).rows[0];
    if(r)return rememberRound(day,r);
    await client.query("SELECT pg_advisory_xact_lock(hashtext('pokedle-daily-round'))");
    r=(await client.query("SELECT secret_id FROM daily_rounds WHERE day=$1",[day])).rows[0]; if(r)return r;
    const config=await settings(client);
    // Keep the already-public transition day's target, then use private random draws.
    let target=day===config.transition_day && legacyTarget ? legacyTarget(config.legacy_day) : null;
    if(!target){
      const recent=new Set((await client.query("SELECT secret_id FROM daily_rounds WHERE day > $1::date - 365 AND day < $1::date",[day])).rows.map(row=>Number(row.secret_id)));
      const choices=pool.filter(p=>!recent.has(Number(p.id))); if(!choices.length)throw dailyError("unavailable",503);
      target=choices[randomInt(choices.length)];
    }
    await client.query("INSERT INTO daily_rounds(day,secret_id) VALUES($1,$2)",[day,target.id]);
    return {secret_id:Number(target.id)};
  }
  async function play(client,who,day,r) {
    let row=(await client.query("SELECT * FROM daily_plays WHERE identity=$1 AND day=$2 FOR UPDATE",[who.key,day])).rows[0];
    if(!row) {
      await client.query("INSERT INTO daily_plays(identity,day,account_id,started_at) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",[who.key,day,who.accountId||null,clock()]);
      row=(await client.query("SELECT * FROM daily_plays WHERE identity=$1 AND day=$2 FOR UPDATE",[who.key,day])).rows[0];
    }
    if(who.accountId && !row.migrated){
      const config=await settings(client);
      let hasLegacy=false;
      if(day===config.transition_day){
        const old=(await client.query("SELECT guessed,finished,updated_at FROM daily_sessions WHERE discord_id=$1 AND day=$2",[who.accountId,config.legacy_day])).rows[0];
        if(old){
          hasLegacy=Boolean(old.finished || old.guessed?.length);
          const ids=(old.guessed||[]).map(key=>String(key).startsWith("id:")?Number(String(key).slice(3)):Number(pokemon.find(p=>String(p.name).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^\p{L}\p{N}]+/gu,"").toLowerCase()===key)?.id)).filter(id=>byId.has(id));
          const won=Boolean(old.finished)&&ids.includes(Number(r.secret_id));
          await client.query("UPDATE daily_plays SET guessed=$3::jsonb,status=$4,finished_at=$5 WHERE identity=$1 AND day=$2",[who.key,day,JSON.stringify([...new Set(ids)]),won?"won":"playing",won?old.updated_at:null]);
        }
      }
      // Preserve a guest game on login. A completed guest game cannot become a
      // one-guess ranked replay after the answer has been revealed.
      if(!hasLegacy&&who.guestKey){
        const guest=(await client.query("SELECT * FROM daily_plays WHERE identity=$1 AND day=$2 FOR UPDATE",[who.guestKey,day])).rows[0];
        if(guest&&(guest.guessed.length||guest.status!=="playing")){
          const completed=guest.status!=="playing";
          await client.query("UPDATE daily_plays SET guessed=$3::jsonb,status=$4,started_at=$5,finished_at=$6,elapsed_ms=$7,account_id=$8,excluded_stats=$9,shiny=$10 WHERE identity=$1 AND day=$2",[who.key,day,JSON.stringify(guest.guessed),guest.status,guest.started_at,guest.finished_at,guest.elapsed_ms,completed?null:who.accountId,completed,Boolean(guest.shiny)]);
          if(!completed)await client.query("UPDATE daily_plays SET excluded_stats=true WHERE identity=$1 AND day=$2",[who.guestKey,day]);
        }
      }
      await client.query("UPDATE daily_plays SET migrated=true WHERE identity=$1 AND day=$2",[who.key,day]);
      row=(await client.query("SELECT * FROM daily_plays WHERE identity=$1 AND day=$2",[who.key,day])).rows[0];
    }
    return row;
  }
  async function streakDays(client,who) {
    if(!who.accountId)return null;
    return (await client.query(`SELECT day::text FROM daily_plays WHERE account_id=$1 AND status='won'
      UNION SELECT day::text FROM daily_sessions WHERE discord_id=$1 AND finished=true
      AND NOT EXISTS(SELECT 1 FROM daily_plays p WHERE p.account_id=$1 AND p.day=daily_sessions.day)`,[who.accountId])).rows.map(r=>r.day);
  }
  function streakOf(days,day,status) {
    if(!days)return {current:0,best:0,lastWin:null};
    return streakFromDays(days.filter(d=>d<=day),day,status==="abandoned");
  }
  async function snapshot(client,who,row,r,now,days) {
    const secret=byId.get(Number(r.secret_id)); if(!secret)throw dailyError("unavailable",503);
    const ids=row.guessed||[], day=parisDay(now);
    const direction=(a,b)=>a===b?"":a<b?"↑":"↓";
    const streak=streakOf(days!==undefined?days:await streakDays(client,who),day,row.status);
    return {ok:true,...dailyCalendar(now),accountId:who.accountId||null,authenticated:Boolean(who.accountId),
      status:row.status,finished:row.status!=="playing",won:row.status==="won",attempts:ids.length,
      hintsUsed:Number(row.hints_used),elapsedMs:row.elapsed_ms===null?null:Number(row.elapsed_ms),
      points:enquiryPoints(row.status==='won',ids.length,row.hints_used),maxPoints:DAILY_MAX.enquiry,
      rows:ids.map(id=>{const p=byId.get(Number(id));return {pokemonId:p.id,cmp:compare(p,secret),generationDirection:direction(p.gen,secret.gen),heightDirection:direction(p.height,secret.height),weightDirection:direction(p.weight,secret.weight)};}),
      ...(row.status!=="playing"?{answerId:secret.id}:{}),
      streak,shiny:shinyState(row.status,row.shiny,streak.current),ranked:Boolean(who.accountId&&row.account_id&&row.status==="won")};
  }
  async function state(who) {
    // A returning player only reads: the round, the play and the streak arrive in
    // parallel, without a transaction or a row lock. First visits, logins to migrate
    // and new rounds still go through the locked path below.
    const now=clock(),day=parisDay(now);
    const [cached,row,days]=await Promise.all([
      roundCache.has(day)?roundCache.get(day):db.query("SELECT secret_id FROM daily_rounds WHERE day=$1",[day]).then(res=>res.rows[0]||null),
      db.query("SELECT * FROM daily_plays WHERE identity=$1 AND day=$2",[who.key,day]).then(res=>res.rows[0]||null),
      streakDays(db,who)
    ]);
    if(cached&&row&&(!who.accountId||row.migrated)&&parisDay(clock())===day)return snapshot(db,who,row,rememberRound(day,cached),now,days);
    return transaction(async client=>{const now=clock(),day=parisDay(now),r=await round(client,day),row=await play(client,who,day,r);return snapshot(client,who,row,r,now);});
  }
  async function act(who,{day,accountId,pokemonId},abandon=false) {
    if(day!==parisDay(clock()))throw dailyError("stale_daily");
    if((accountId||null)!==(who.accountId||null))throw dailyError("account_changed");
    if(!abandon&&(!Number.isInteger(pokemonId)||!byId.has(pokemonId)))throw dailyError("invalid_guess",400);
    return transaction(async client=>{
      const now=clock(),r=await round(client,day),row=await play(client,who,day,r);
      if(day!==parisDay(clock()))throw dailyError("stale_daily");
      // Idempotent retries return the saved result; no second reward or event.
      if(row.status!=="playing"||(!abandon&&row.guessed.includes(pokemonId)))return {...await snapshot(client,who,row,r,now),duplicate:true};
      const ids=abandon?row.guessed:[...row.guessed,pokemonId];
      const status=abandon?"abandoned":Number(r.secret_id)===pokemonId?"won":"playing";
      const finished=status!=="playing",elapsed=finished?Math.max(0,now-new Date(row.started_at)):null;
      // One roll, at the win, with the streak this win makes (guests have no streak).
      let shiny=false;
      if(status==="won"){
        const days=await streakDays(client,who);
        const streak=days?streakFromDays([...days.filter(d=>d<day),day],day).current:0;
        shiny=randomInt(shinyOdds(streak))===0;
      }
      await client.query("UPDATE daily_plays SET guessed=$3::jsonb,status=$4,finished_at=$5,elapsed_ms=$6,shiny=$7 WHERE identity=$1 AND day=$2",[who.key,day,JSON.stringify(ids),status,finished?now:null,elapsed,shiny]);
      if(status==="won"&&who.accountId&&row.account_id)await recordLeaderboardResultInTransaction(client,{id:who.accountId,username:who.name,avatar:who.avatar},"daily",ids.length,{direction:"asc"},"daily:"+day);
      if(day!==parisDay(clock()))throw dailyError("stale_daily");
      return {...await snapshot(client,who,{...row,guessed:ids,status,elapsed_ms:elapsed,shiny},r,now),fresh:finished};
    });
  }
  async function distribution() {
    const day=parisDay(clock());
    const results=(await db.query(`SELECT status,attempts,count(*)::int AS count FROM (
      SELECT status,jsonb_array_length(guessed)::int AS attempts FROM daily_plays
      WHERE day=$1 AND status <> 'playing' AND NOT excluded_stats
      UNION ALL
      SELECT 'won',jsonb_array_length(s.guessed)::int FROM daily_sessions s
      WHERE s.finished AND jsonb_array_length(s.guessed)>0
      AND $1::date=(SELECT value::date FROM daily_settings WHERE key='transition_day')
      AND s.day=(SELECT value::date FROM daily_settings WHERE key='legacy_day')
      AND NOT EXISTS(SELECT 1 FROM daily_plays p WHERE p.identity='user:'||s.discord_id AND p.day=$1)
    ) results GROUP BY status,attempts`,[day])).rows;
    const counts={"1":0,"2":0,"3":0,"4":0,"5":0,"6":0,"7plus":0};let abandoned=0,wins=0;
    for(const row of results){if(row.status==="abandoned")abandoned+=row.count;else {wins+=row.count;counts[row.attempts>=7?"7plus":String(row.attempts)]+=row.count;}}
    return {ok:true,key:day,counts,wins,abandoned,total:wins+abandoned};
  }
  // The player's shinies, newest first: by account once signed in, else this browser's guest plays.
  async function shinies(who) {
    const where=who.accountId?"p.account_id=$1":"p.identity=$1";
    const rows=(await db.query(`SELECT to_char(p.day,'YYYY-MM-DD') AS day,r.secret_id FROM daily_plays p JOIN daily_rounds r ON r.day=p.day
      WHERE ${where} AND p.status='won' AND p.shiny ORDER BY p.day DESC LIMIT 60`,[who.accountId||who.key])).rows;
    return {ok:true,count:rows.length,shinies:rows.map(row=>({id:Number(row.secret_id),day:row.day}))};
  }
  async function reactions(who) {
    const day=parisDay(clock());
    const [counts,mine,found]=await Promise.all([
      db.query("SELECT emoji,count(*)::int AS n FROM daily_reactions WHERE day=$1 GROUP BY emoji",[day]),
      db.query("SELECT emoji FROM daily_reactions WHERE day=$1 AND identity=$2",[day,who.key]),
      db.query("SELECT count(*)::int AS n FROM daily_plays WHERE day=$1 AND status='won' AND NOT excluded_stats",[day]),
    ]);
    const byEmoji=Object.fromEntries(DAILY_REACTIONS.map(e=>[e,0]));
    for(const row of counts.rows)if(row.emoji in byEmoji)byEmoji[row.emoji]=row.n;
    const n=found.rows[0]?found.rows[0].n:0;
    return {ok:true,key:day,emojis:DAILY_REACTIONS,counts:byEmoji,mine:mine.rows[0]?mine.rows[0].emoji:null,found:n>=DAILY_FOUND_MIN?n:null};
  }
  async function react(who,body) {
    const day=parisDay(clock()),emoji=String(body&&body.emoji||"");
    if(!DAILY_REACTIONS.includes(emoji))throw dailyError("bad_reaction",400);
    const play=(await db.query("SELECT status FROM daily_plays WHERE identity=$1 AND day=$2",[who.key,day])).rows[0];
    if(!play||play.status==="playing")throw dailyError("play_first",409);
    const current=(await db.query("SELECT emoji FROM daily_reactions WHERE day=$1 AND identity=$2",[day,who.key])).rows[0];
    // The same emoji again takes the reaction back; another one replaces it.
    if(current&&current.emoji===emoji)await db.query("DELETE FROM daily_reactions WHERE day=$1 AND identity=$2",[day,who.key]);
    else await db.query("INSERT INTO daily_reactions(day,identity,emoji) VALUES($1,$2,$3) ON CONFLICT(day,identity) DO UPDATE SET emoji=EXCLUDED.emoji,created_at=now()",[day,who.key,emoji]);
    await db.query("DELETE FROM daily_reactions WHERE day < $1::date - 30",[day]);
    return reactions(who);
  }
  return {state,guess:(who,body)=>act(who,body),abandon:(who,body)=>act(who,body,true),distribution,shinies,reactions,react};
}
function mountDailyRoutes({app,express,db,pokemon,secret,getUser,readCookies,compare,legacyTarget,readyBefore=Promise.resolve()}) {
  const service=db&&secret?createDailyService({db,pokemon,compare,legacyTarget}):null;
  const ready=service?readyBefore.then(()=>initDailyDb(db)).then(()=>true).catch(e=>{console.error("[daily] init:",e.message);return false;}):Promise.resolve(false);
  const buckets=new Map();
  function rate(key,limit,now){
    if(buckets.size>10000)for(const [k,v]of buckets)if(v.until<=now)buckets.delete(k);
    const b=buckets.get(key);
    if(b&&b.until>now){if(++b.count>limit)throw dailyError("rate_limited",429);}
    else {if(buckets.size>=20000)throw dailyError("rate_limited",429);buckets.set(key,{count:1,until:now+60000});}
  }
  const handle=action=>async(req,res)=>{
    const started=performance.now();
    res.set("Cache-Control","no-store");
    if(!service||!await ready)return res.status(503).json({ok:false,error:"unavailable"});
    try{
      if(req.method==="POST"){
        if(!req.is("application/json"))throw dailyError("json_required",415);
        const origin=req.get("origin");if(origin&&new URL(origin).host!==req.get("host"))throw dailyError("origin_denied",403);
      }
      const ip=crypto.createHmac("sha256",secret).update("daily-ip:"+String(req.ip)).digest("hex");
      rate("ip:"+ip+":"+req.method,req.method==="POST"?120:240,Date.now());
      let id=dailyGuest(secret,readCookies(req).pokdle_daily);
      if(!id){const issued=issueDailyGuest(secret);id=issued.id;res.cookie("pokdle_daily",issued.cookie,{httpOnly:true,secure:req.secure,sameSite:"lax",path:"/",maxAge:180*86400000});}
      const user=getUser(req),who={key:user?.id?"user:"+user.id:"guest:"+id,guestKey:"guest:"+id,accountId:user?.id?String(user.id):null,name:user?.username||"Dresseur",avatar:user?.avatar||""};
      rate("id:"+who.key+":"+req.method,req.method==="POST"?20:90,Date.now());
      const data=await action(who,req);
      res.set('Server-Timing','daily;dur='+(performance.now()-started).toFixed(1));
      res.json(data);
    }catch(e){if(!e.status)console.error("[daily] request:",e.message);if(e.status===429)res.set("Retry-After","60");res.status(e.status||503).json({ok:false,error:e.status?e.code:"unavailable"});}
  };
  app.get("/api/daily",handle(who=>service.state(who)));
  app.post("/api/daily/guess",express.json({limit:"2kb"}),handle((who,req)=>service.guess(who,req.body||{})));
  app.post("/api/daily/abandon",express.json({limit:"2kb"}),handle((who,req)=>service.abandon(who,req.body||{})));
  app.get("/api/daily-stats/today",handle(()=>service.distribution()));
  app.get("/api/daily/shinies",handle(who=>service.shinies(who)));
  app.get("/api/daily/reactions",handle(who=>service.reactions(who)));
  app.post("/api/daily/react",express.json({limit:"1kb"}),handle((who,req)=>service.react(who,req.body||{})));
  app.post("/api/daily-stats/report",(_req,res)=>res.status(410).json({ok:false,error:"retired"}));
  app.post("/api/daily/session",(_req,res)=>res.status(409).json({ok:false,error:"daily_update_required"}));
  return service;
}
module.exports={DAILY_ORIGIN,SHINY_TIERS,DAILY_REACTIONS,DAILY_FOUND_MIN,shinyOdds,shinyState,dailyCalendar,nextDay,streakFromDays,dailyGuest,issueDailyGuest,initDailyDb,createDailyService,mountDailyRoutes};
