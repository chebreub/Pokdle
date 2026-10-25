"use strict";
// Petit Bac du jour: the same letter and the same eight Pokémon themes for everyone each
// Paris day, 90 seconds, one try. Answers are checked on our data (small typos forgiven);
// each right answer shows how many players gave the same Pokémon for that theme. It is a
// bonus of the day, beside the 100-point journey, with its own leaderboard.
const crypto=require('node:crypto');
const {playerLevelFromXp}=require('./profile-sync');
const {dailyCalendar,dailyGuest,issueDailyGuest}=require('./daily-game');
const {checkPokemonAnswer,examplesFor,drawSoloSheet}=require('./party-petitbac');
const {regionalFormsOn}=require('./daily-grid');
const fail=(code,status=409)=>Object.assign(new Error(code),{code,status});
const COLUMNS=8,SECONDS=90,GRACE_MS=15000;

function seededRandom(seed){
  let s=crypto.createHash('sha256').update(seed).digest().readUInt32LE(0);
  return ()=>{s=(s+0x6D2B79F5)|0;let t=Math.imul(s^(s>>>15),1|s);t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296;};
}
// Drawn from the date alone: every theme has at least two answers for the letter.
function drawDailySheet(day,catalogue){
  return drawSoloSheet({catalogue,gens:[1,2,3,4,5,6,7,8,9],random:seededRandom('pokedle-petitbac:'+day),columns:COLUMNS});
}
// 10 points per right answer, 20 more for a full sheet: up to 100.
function dailyPoints(results){const right=results.filter(r=>r.valid).length;return right*10+(right===COLUMNS?20:0);}

async function initDailyPetitBacDb(db){
  await db.query('CREATE TABLE IF NOT EXISTS petitbac_daily_rounds(day DATE PRIMARY KEY,letter TEXT NOT NULL,themes JSONB NOT NULL)');
  await db.query(`CREATE TABLE IF NOT EXISTS petitbac_daily_plays(
    identity TEXT NOT NULL,day DATE NOT NULL REFERENCES petitbac_daily_rounds(day),account_id TEXT,
    answers JSONB NOT NULL DEFAULT '[]',results JSONB NOT NULL DEFAULT '[]',points INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'playing' CHECK(status IN ('playing','completed')),late BOOLEAN NOT NULL DEFAULT false,
    started_at TIMESTAMPTZ NOT NULL,finished_at TIMESTAMPTZ,elapsed_ms BIGINT,PRIMARY KEY(identity,day))`);
  await db.query('CREATE INDEX IF NOT EXISTS petitbac_daily_plays_day ON petitbac_daily_plays(day)');
  await db.query('CREATE INDEX IF NOT EXISTS petitbac_daily_plays_account ON petitbac_daily_plays(account_id,day)');
}

function createDailyPetitBacService({db,pokemon,clock=()=>new Date(),draw=drawDailySheet}){
  const rounds=new Map();
  async function ensureRound(day){
    if(rounds.has(day))return rounds.get(day);
    let r=(await db.query('SELECT letter,themes FROM petitbac_daily_rounds WHERE day=$1',[day])).rows[0];
    if(!r){
      const sheet=draw(day,pokemon);if(!sheet)throw fail('unavailable',503);
      await db.query('INSERT INTO petitbac_daily_rounds(day,letter,themes) VALUES($1,$2,$3::jsonb) ON CONFLICT(day) DO NOTHING',[day,sheet.letter,JSON.stringify(sheet.categories)]);
      r=(await db.query('SELECT letter,themes FROM petitbac_daily_rounds WHERE day=$1',[day])).rows[0];
    }
    const round={letter:r.letter,categories:r.themes};
    rounds.set(day,round);if(rounds.size>4)rounds.delete(rounds.keys().next().value);
    return round;
  }
  // Rarity: share of the day's finished players who gave the same Pokémon for the theme.
  async function stats(q,day){
    const [picks,total]=await Promise.all([
      q.query(`SELECT (r.idx-1)::int AS idx,(r.val->>'pokemonId')::int AS id,COUNT(*)::int AS n FROM petitbac_daily_plays p
        CROSS JOIN LATERAL jsonb_array_elements(p.results) WITH ORDINALITY AS r(val,idx)
        WHERE p.day=$1 AND p.status='completed' AND (r.val->>'valid')::boolean AND r.val->>'pokemonId' IS NOT NULL GROUP BY 1,2`,[day]),
      q.query("SELECT COUNT(*)::int AS total FROM petitbac_daily_plays WHERE day=$1 AND status='completed'",[day])]);
    const count=new Map(picks.rows.map(r=>[r.idx+':'+r.id,Number(r.n)])),players=Number(total.rows[0]?.total||0);
    return {players,rarity:(idx,id)=>players?Math.max(1,Math.round(100*(count.get(idx+':'+id)||0)/players)):100};
  }
  async function adopt(q,who,day){
    if(!who.accountId||!who.guestKey||who.guestKey===who.key)return null;
    return (await q.query(`UPDATE petitbac_daily_plays SET identity=$1,account_id=$3 WHERE identity=$2 AND day=$4
      AND NOT EXISTS(SELECT 1 FROM petitbac_daily_plays WHERE identity=$1 AND day=$4) RETURNING *`,[who.key,who.guestKey,who.accountId,day])).rows[0]||null;
  }
  function deadlineOf(row){return new Date(row.started_at).getTime()+SECONDS*1000;}
  async function snapshot(cal,who,round,row,s){
    const status=row?row.status:'ready',finished=status==='completed';
    const base={ok:true,...cal,accountId:who.accountId||null,authenticated:Boolean(who.accountId),mode:'petitbacday',label:'Petit Bac du jour',
      status,finished,columns:COLUMNS,seconds:SECONDS,maxPoints:100,players:s.players};
    if(!row)return base;
    const sheet={letter:round.letter,categories:round.categories,deadline:new Date(deadlineOf(row)).toISOString(),remainingMs:Math.max(0,deadlineOf(row)-clock())};
    if(!finished)return {...base,...sheet,answers:row.answers};
    const results=row.results.map((r,i)=>({...r,...(r.valid&&r.pokemonId?{rarity:s.rarity(i,r.pokemonId)}:{})}));
    const rarities=results.filter(r=>r.rarity).map(r=>r.rarity);
    return {...base,...sheet,answers:row.answers,results,points:Number(row.points),late:Boolean(row.late),
      originality:rarities.length?Math.round(100-rarities.reduce((a,b)=>a+b,0)/rarities.length):null,
      elapsedMs:row.elapsed_ms==null?null:Number(row.elapsed_ms),ranked:Boolean(row.account_id),
      examples:round.categories.map(c=>examplesFor(round.letter,c,pokemon,[1,2,3,4,5,6,7,8,9]))};
  }
  async function withRank(out){
    if(!out.ranked||!out.finished)return out;
    const board=await leaderboard('today',out.accountId,out.day);
    return {...out,rank:board.me?{rank:board.me.rank,total:board.total}:null};
  }
  async function transaction(action){
    const cal=dailyCalendar(clock()),round=await ensureRound(cal.day),client=await db.connect();
    try{
      await client.query('BEGIN');const result=await action(client,cal,round);
      if(dailyCalendar(clock()).day!==cal.day)throw fail('stale_daily');
      await client.query('COMMIT');return result;
    }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}finally{client.release();}
  }
  function checkBody(who,body){
    if(body.day!==dailyCalendar(clock()).day)throw fail('stale_daily');
    if((body.accountId||null)!==(who.accountId||null))throw fail('account_changed');
  }
  async function lockedPlay(c,who,day){
    const select=()=>c.query('SELECT * FROM petitbac_daily_plays WHERE identity=$1 AND day=$2 FOR UPDATE',[who.key,day]).then(r=>r.rows[0]||null);
    const row=await select();if(row)return row;
    if(await adopt(c,who,day))return select();
    return null;
  }
  // Corrects the sheet; a sheet sent after the time (plus a grace for slow networks) scores 0.
  async function complete(c,who,day,round,row,answers){
    const now=clock(),elapsed=Math.max(0,now-new Date(row.started_at)),late=elapsed>SECONDS*1000+GRACE_MS;
    const results=round.categories.map((cat,i)=>{const r=checkPokemonAnswer(answers[i],round.letter,cat,pokemon,[1,2,3,4,5,6,7,8,9],{regionalForms:regionalFormsOn(day)});return {text:r.text,valid:r.valid&&!late,...(r.reason?{reason:r.reason}:{}),...(r.name&&r.name!==r.text?{name:r.name}:{}),...(r.valid?{pokemonId:r.pokemonId}:{})};});
    const points=late?0:dailyPoints(results);
    await c.query('UPDATE petitbac_daily_plays SET answers=$3::jsonb,results=$4::jsonb,points=$5,status=$6,late=$7,finished_at=$8,elapsed_ms=$9 WHERE identity=$1 AND day=$2',
      [who.key,day,JSON.stringify(answers),JSON.stringify(results),points,'completed',late,now,Math.min(elapsed,SECONDS*1000)]);
    return {...row,answers,results,points,status:'completed',late,elapsed_ms:Math.min(elapsed,SECONDS*1000)};
  }
  async function state(who){
    const cal=dailyCalendar(clock()),round=await ensureRound(cal.day);
    let row=(await db.query('SELECT * FROM petitbac_daily_plays WHERE identity=$1 AND day=$2',[who.key,cal.day])).rows[0]||null;
    if(!row)row=await adopt(db,who,cal.day);
    // An abandoned sheet closes on its own once its time is over.
    if(row&&row.status==='playing'&&clock()>deadlineOf(row)+GRACE_MS)return withRank(await transaction(async(c,cal2,r2)=>{const locked=await lockedPlay(c,who,cal2.day);const done=locked.status==='playing'?await complete(c,who,cal2.day,r2,locked,locked.answers):locked;return snapshot(cal2,who,r2,done,await stats(c,cal2.day));}));
    return withRank(await snapshot(cal,who,round,row,await stats(db,cal.day)));
  }
  async function start(who,body){
    checkBody(who,body);
    return transaction(async(c,cal,round)=>{
      let row=await lockedPlay(c,who,cal.day);
      if(!row){
        await c.query("INSERT INTO petitbac_daily_plays(identity,day,account_id,answers,started_at) VALUES($1,$2,$3,$4::jsonb,$5) ON CONFLICT DO NOTHING",[who.key,cal.day,who.accountId||null,JSON.stringify(Array(round.categories.length).fill('')),clock()]);
        row=await lockedPlay(c,who,cal.day);
      }
      return snapshot(cal,who,round,row,await stats(c,cal.day));
    });
  }
  async function save(who,body,finish){
    checkBody(who,body);
    return withRank(await transaction(async(c,cal,round)=>{
      let row=await lockedPlay(c,who,cal.day);
      if(!row)throw fail('not_started');
      if(row.status!=='playing')return snapshot(cal,who,round,row,await stats(c,cal.day));
      const answers=Array.isArray(body.answers)&&body.answers.length===round.categories.length?body.answers.map(a=>String(a??'').replace(/[<>]/g,'').replace(/\s+/g,' ').trim().slice(0,40)):null;
      if(!answers)throw fail('invalid_sheet',400);
      if(finish||clock()>deadlineOf(row)+GRACE_MS)row=await complete(c,who,cal.day,round,row,answers);
      else{await c.query('UPDATE petitbac_daily_plays SET answers=$3::jsonb WHERE identity=$1 AND day=$2',[who.key,cal.day,JSON.stringify(answers)]);row={...row,answers};}
      return snapshot(cal,who,round,row,await stats(c,cal.day));
    }));
  }
  // Right answers first, then originality (rarer picks first), then time.
  async function leaderboard(scope,accountId,day=dailyCalendar(clock()).day){
    const predicate=scope==='today'?'AND p.day=$1::date':scope==='week'?'AND p.day>$1::date-7 AND p.day<=$1::date':'AND p.day<=$1::date';
    const cte=`WITH picks AS (
      SELECT p.day,p.identity,r.idx,(r.val->>'pokemonId')::int AS id FROM petitbac_daily_plays p
      CROSS JOIN LATERAL jsonb_array_elements(p.results) WITH ORDINALITY AS r(val,idx)
      WHERE p.status='completed' AND (r.val->>'valid')::boolean AND r.val->>'pokemonId' IS NOT NULL ${predicate}
    ), counts AS (SELECT day,idx,id,COUNT(*)::numeric AS n FROM picks GROUP BY 1,2,3
    ), totals AS (SELECT p.day,COUNT(*)::numeric AS total FROM petitbac_daily_plays p WHERE p.status='completed' ${predicate} GROUP BY 1
    ), originality AS (
      SELECT k.day,k.identity,ROUND(100-AVG(100*c.n/t.total))::int AS originality FROM picks k JOIN counts c USING(day,idx,id) JOIN totals t USING(day) GROUP BY 1,2
    ), candidates AS (
      SELECT p.account_id AS discord_id,p.points AS score,COALESCE(o.originality,0) AS originality,p.elapsed_ms,p.finished_at,
        ROW_NUMBER() OVER(PARTITION BY p.account_id ORDER BY p.points DESC,COALESCE(o.originality,0) DESC,p.elapsed_ms ASC,p.finished_at ASC) AS attempt_rank
      FROM petitbac_daily_plays p LEFT JOIN originality o ON o.day=p.day AND o.identity=p.identity
      WHERE p.status='completed' AND p.account_id IS NOT NULL ${predicate}
    ), ranked AS (
      SELECT c.discord_id,COALESCE(u.username,'Dresseur') AS username,COALESCE(u.avatar,'') AS avatar,u.partner_id,u.xp,c.score,c.originality,
        (RANK() OVER(ORDER BY c.score DESC,c.originality DESC,c.elapsed_ms ASC))::int AS rank
      FROM candidates c LEFT JOIN users u ON u.discord_id=c.discord_id WHERE c.attempt_rank=1)`;
    const [top,count,mine]=await Promise.all([
      db.query(cte+' SELECT * FROM ranked ORDER BY rank,username LIMIT 20',[day]),
      db.query(cte+' SELECT COUNT(*)::int AS total FROM ranked',[day]),
      accountId?db.query(cte+' SELECT * FROM ranked WHERE discord_id=$2',[day,String(accountId)]):Promise.resolve({rows:[]})]);
    const me=mine.rows[0]||null;
    const around=me?(await db.query(cte+' SELECT * FROM ranked WHERE rank BETWEEN $2 AND $3 ORDER BY rank,username LIMIT 7',[day,Math.max(1,me.rank-2),me.rank+2])).rows:[];
    const map=r=>({rank:Number(r.rank),username:r.username,avatar:r.avatar,partnerId:r.partner_id?Number(r.partner_id):null,level:playerLevelFromXp(r.xp),score:Number(r.score),originality:Number(r.originality),me:r.discord_id===String(accountId)});
    return {ok:true,mode:'petitbacday',scope,authenticated:Boolean(accountId),direction:'desc',label:'Petit Bac du jour',unit:'pts',
      total:Number(count.rows[0]?.total||0),top:top.rows.map(map),me:me?{rank:Number(me.rank),score:Number(me.score),originality:Number(me.originality)}:null,around:around.map(map)};
  }
  return {state,start,save:(who,body)=>save(who,body,false),submit:(who,body)=>save(who,body,true),leaderboard};
}

function mountDailyPetitBacRoutes({app,express,db,pokemon,secret,getUser,readCookies,readyBefore=Promise.resolve()}){
  const service=db&&secret?createDailyPetitBacService({db,pokemon}):null;
  const ready=service?readyBefore.then(()=>initDailyPetitBacDb(db)).then(()=>true).catch(e=>{console.error('[petitbac-day] init:',e.message);return false;}):Promise.resolve(false);
  const buckets=new Map();
  function rate(key,limit){
    const now=Date.now();if(buckets.size>10000)for(const[k,b]of buckets)if(b.until<=now)buckets.delete(k);
    const b=buckets.get(key);if(b&&b.until>now){if(++b.count>limit)throw fail('rate_limited',429);}
    else{if(buckets.size>=20000)throw fail('rate_limited',429);buckets.set(key,{count:1,until:now+60000});}
  }
  const handle=action=>async(req,res)=>{
    const started=performance.now();
    res.set('Cache-Control','no-store');
    if(!service||!await ready)return res.status(503).json({ok:false,error:'unavailable'});
    try{
      if(req.method==='POST'){
        if(!req.is('application/json'))throw fail('json_required',415);
        const origin=req.get('origin');if(origin&&new URL(origin).host!==req.get('host'))throw fail('origin_denied',403);
      }
      rate('ip:'+crypto.createHmac('sha256',secret).update(String(req.ip)).digest('hex'),120);
      let id=dailyGuest(secret,readCookies(req).pokdle_daily);
      if(!id){const guest=issueDailyGuest(secret);id=guest.id;res.cookie('pokdle_daily',guest.cookie,{httpOnly:true,secure:req.secure,sameSite:'lax',path:'/',maxAge:180*86400000});}
      const user=getUser(req),who={key:user?.id?'user:'+user.id:'guest:'+id,guestKey:'guest:'+id,accountId:user?.id?String(user.id):null};
      rate('id:'+who.key,60);
      const data=await action(who,req);
      res.set('Server-Timing','petitbac;dur='+(performance.now()-started).toFixed(1));
      res.json(data);
    }catch(e){if(!e.status)console.error('[petitbac-day] request:',e.message);if(e.status===429)res.set('Retry-After','60');res.status(e.status||503).json({ok:false,error:e.status?e.code:'unavailable'});}
  };
  app.get('/api/daily/petitbac',handle(who=>service.state(who)));
  app.post('/api/daily/petitbac/start',express.json({limit:'2kb'}),handle((who,req)=>service.start(who,req.body||{})));
  app.post('/api/daily/petitbac/save',express.json({limit:'4kb'}),handle((who,req)=>service.save(who,req.body||{})));
  app.post('/api/daily/petitbac/submit',express.json({limit:'4kb'}),handle((who,req)=>service.submit(who,req.body||{})));
  return {ready,async leaderboard(scope,accountId){if(!service||!await ready)throw fail('unavailable',503);return service.leaderboard(scope,accountId);}};
}
module.exports={COLUMNS,SECONDS,GRACE_MS,drawDailySheet,dailyPoints,initDailyPetitBacDb,createDailyPetitBacService,mountDailyPetitBacRoutes};
