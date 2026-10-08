"use strict";
const crypto = require("node:crypto");
const { dailyCalendar, dailyGuest, issueDailyGuest } = require("./daily-game");
const { recordLeaderboardResultInTransaction } = require("./leaderboard-store");
const MAX_TRIES = 6;
function wordleLetters(name) {
  return String(name).replace(/♀/g,"F").replace(/♂/g,"M").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z]/g,"");
}
// Reserve exact matches first: a duplicate letter can only consume a remaining copy.
function compareLetters(guess, answer) {
  const result = Array(guess.length).fill("absent"), remaining = new Map();
  for (let i=0;i<answer.length;i++) {
    if (guess[i]===answer[i]) result[i]="exact";
    else remaining.set(answer[i],(remaining.get(answer[i])||0)+1);
  }
  for (let i=0;i<guess.length;i++) if(result[i]!=="exact" && remaining.get(guess[i])>0) {
    result[i]="present"; remaining.set(guess[i],remaining.get(guess[i])-1);
  }
  return result;
}
const error = (code,status=409)=>Object.assign(new Error(code),{code,status});
async function initWordleDb(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS wordle_rounds(day DATE PRIMARY KEY, secret_id INTEGER NOT NULL)`);
  await db.query(`CREATE TABLE IF NOT EXISTS wordle_plays(
    identity TEXT NOT NULL, day DATE NOT NULL REFERENCES wordle_rounds(day), account_id TEXT,
    guessed JSONB NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'playing'
      CHECK(status IN ('playing','won','lost','abandoned')),
    started_at TIMESTAMPTZ NOT NULL, finished_at TIMESTAMPTZ, elapsed_ms BIGINT,
    migrated BOOLEAN NOT NULL DEFAULT false, PRIMARY KEY(identity,day))`);
  await db.query("CREATE INDEX IF NOT EXISTS wordle_plays_account ON wordle_plays(account_id,day)");
}
function createWordleService({db,pokemon,clock=()=>new Date(),randomInt=crypto.randomInt}) {
  const byId=new Map(pokemon.map(p=>[Number(p.id),p]));
  const pool=pokemon.filter(p=>!p.isAltForm&&p.id>0&&p.id<=1025&&wordleLetters(p.name).length<=15);
  async function transaction(action) {
    const calendar=dailyCalendar(clock()), client=await db.connect();
    try {
      await client.query("BEGIN"); const value=await action(client,calendar);
      if(dailyCalendar(clock()).day!==calendar.day)throw error("stale_daily");
      await client.query("COMMIT");return value;
    } catch(e) {await client.query("ROLLBACK");throw e;} finally {client.release();}
  }
  async function round(client,day,who) {
    const daily=(await client.query("SELECT status FROM daily_plays WHERE identity=$1 AND day=$2",[who.key,day])).rows[0];
    if(!daily||daily.status==="playing")throw error("daily_required");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('pokedle-wordle:'||$1))",[day]);
    let r=(await client.query("SELECT secret_id FROM wordle_rounds WHERE day=$1",[day])).rows[0];
    if(!r) {
      const deduction=(await client.query("SELECT secret_id FROM daily_rounds WHERE day=$1",[day])).rows[0];
      const recent=(await client.query("SELECT secret_id FROM wordle_rounds WHERE day>$1::date-30 AND day<$1",[day])).rows.map(r=>Number(r.secret_id));
      const choices=pool.filter(p=>p.id!==Number(deduction?.secret_id)&&!recent.includes(p.id));
      if(!choices.length)throw error("unavailable",503);
      r={secret_id:choices[randomInt(choices.length)].id};
      await client.query("INSERT INTO wordle_rounds(day,secret_id) VALUES($1,$2)",[day,r.secret_id]);
    }
    return r;
  }
  async function play(client,day,who) {
    await client.query("INSERT INTO wordle_plays(identity,day,account_id,started_at) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",[who.key,day,who.accountId||null,clock()]);
    let row=(await client.query("SELECT * FROM wordle_plays WHERE identity=$1 AND day=$2 FOR UPDATE",[who.key,day])).rows[0];
    if(who.accountId&&!row.migrated) {
      if(who.guestKey) {
        const guest=(await client.query("SELECT * FROM wordle_plays WHERE identity=$1 AND day=$2 FOR UPDATE",[who.guestKey,day])).rows[0];
        if(guest&&(guest.guessed.length||guest.status!=="playing")) {
          await client.query("UPDATE wordle_plays SET guessed=$3::jsonb,status=$4,started_at=$5,finished_at=$6,elapsed_ms=$7,account_id=$8 WHERE identity=$1 AND day=$2",[who.key,day,JSON.stringify(guest.guessed),guest.status,guest.started_at,guest.finished_at,guest.elapsed_ms,guest.status==="playing"?who.accountId:null]);
        }
      }
      await client.query("UPDATE wordle_plays SET migrated=true WHERE identity=$1 AND day=$2",[who.key,day]);
      row=(await client.query("SELECT * FROM wordle_plays WHERE identity=$1 AND day=$2",[who.key,day])).rows[0];
    }
    return row;
  }
  function snapshot(calendar,who,row,r) {
    const target=byId.get(Number(r.secret_id)),answer=wordleLetters(target.name), finished=row.status!=="playing";
    return {ok:true,...calendar,accountId:who.accountId||null,authenticated:Boolean(who.accountId),
      status:row.status,finished,won:row.status==="won",maxTries:MAX_TRIES,length:answer.length,
      attempts:row.guessed.length,points:row.status==="won"?MAX_TRIES+1-row.guessed.length:0,
      ranked:row.status==="won"&&Boolean(row.account_id),elapsedMs:row.elapsed_ms===null?null:Number(row.elapsed_ms),
      rows:row.guessed.map(id=>{const p=byId.get(Number(id)),letters=wordleLetters(p.name);return {pokemonId:p.id,name:p.name,letters,colors:compareLetters(letters,answer)};}),
      ...(finished?{answerId:target.id,answerName:target.name}:{})};
  }
  async function act(who,body=null,abandon=false) {
    if(body) {
      if(body.day!==dailyCalendar(clock()).day)throw error("stale_daily");
      if((body.accountId||null)!==(who.accountId||null))throw error("account_changed");
      if(!abandon&&(!Number.isInteger(body.pokemonId)||!byId.has(body.pokemonId)))throw error("invalid_guess",400);
    }
    return transaction(async(client,calendar)=>{
      const r=await round(client,calendar.day,who),row=await play(client,calendar.day,who);
      if(!body||row.status!=="playing")return snapshot(calendar,who,row,r);
      if(!abandon&&row.guessed.includes(body.pokemonId))return {...snapshot(calendar,who,row,r),duplicate:true};
      const guessed=abandon?row.guessed:[...row.guessed,body.pokemonId];
      const status=abandon?"abandoned":body.pokemonId===Number(r.secret_id)?"won":guessed.length>=MAX_TRIES?"lost":"playing";
      const finished=status!=="playing",now=clock(),elapsed=finished?Math.max(0,now-new Date(row.started_at)):null;
      await client.query("UPDATE wordle_plays SET guessed=$3::jsonb,status=$4,finished_at=$5,elapsed_ms=$6 WHERE identity=$1 AND day=$2",[who.key,calendar.day,JSON.stringify(guessed),status,finished?now:null,elapsed]);
      if(status==="won"&&row.account_id)await recordLeaderboardResultInTransaction(client,{id:who.accountId,username:who.name,avatar:who.avatar},"wordle",guessed.length,{direction:"asc"},"wordle:"+calendar.day);
      return snapshot(calendar,who,{...row,guessed,status,elapsed_ms:elapsed},r);
    });
  }
  return {state:who=>act(who),guess:(who,body)=>act(who,body),abandon:(who,body)=>act(who,body,true)};
}
function mountWordleRoutes({app,express,db,pokemon,secret,getUser,readCookies,daily,readyBefore=Promise.resolve()}) {
  const service=db&&secret?createWordleService({db,pokemon}):null;
  const ready=service?readyBefore.then(()=>initWordleDb(db)).then(()=>true).catch(e=>{console.error("[wordle] init:",e.message);return false;}):Promise.resolve(false);
  const buckets=new Map();
  function rate(key,limit) {
    const now=Date.now();if(buckets.size>10000)for(const[k,b]of buckets)if(b.until<=now)buckets.delete(k);
    const b=buckets.get(key);
    if(b&&b.until>now){if(++b.count>limit)throw error("rate_limited",429);}
    else{if(buckets.size>=20000)throw error("rate_limited",429);buckets.set(key,{count:1,until:now+60000});}
  }
  const handle=action=>async(req,res)=>{
    res.set("Cache-Control","no-store");
    if(!service||!daily||!await ready)return res.status(503).json({ok:false,error:"unavailable"});
    try {
      if(req.method==="POST") {
        if(!req.is("application/json"))throw error("json_required",415);
        const origin=req.get("origin");if(origin&&new URL(origin).host!==req.get("host"))throw error("origin_denied",403);
      }
      rate("ip:"+crypto.createHmac("sha256",secret).update(String(req.ip)).digest("hex"),120);
      let id=dailyGuest(secret,readCookies(req).pokdle_daily);
      if(!id){const guest=issueDailyGuest(secret);id=guest.id;res.cookie("pokdle_daily",guest.cookie,{httpOnly:true,secure:req.secure,sameSite:"lax",path:"/",maxAge:180*86400000});}
      const user=getUser(req),who={key:user?.id?"user:"+user.id:"guest:"+id,guestKey:"guest:"+id,accountId:user?.id?String(user.id):null,name:user?.username||"Dresseur",avatar:user?.avatar||""};
      rate("id:"+who.key,60);
      // This also restores the anonymous Daily on login before opening stage two.
      await daily.state(who);
      res.json(await action(who,req));
    }catch(e){if(!e.status)console.error("[wordle] request:",e.message);if(e.status===429)res.set("Retry-After","60");res.status(e.status||503).json({ok:false,error:e.status?e.code:"unavailable"});}
  };
  app.get("/api/daily/wordle",handle(who=>service.state(who)));
  app.post("/api/daily/wordle/guess",express.json({limit:"2kb"}),handle((who,req)=>service.guess(who,req.body||{})));
  app.post("/api/daily/wordle/abandon",express.json({limit:"2kb"}),handle((who,req)=>service.abandon(who,req.body||{})));
  return service;
}
module.exports={MAX_TRIES,wordleLetters,compareLetters,initWordleDb,createWordleService,mountWordleRoutes};
