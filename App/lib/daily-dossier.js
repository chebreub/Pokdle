"use strict";
const crypto=require('node:crypto');
const {dailyCalendar,dailyGuest,issueDailyGuest}=require('./daily-game');
const {buildDossierQuestions,facts}=require('./dossier-questions');
const {recordLeaderboardResultInTransaction}=require('./leaderboard-store');
const fail=(code,status=409)=>Object.assign(new Error(code),{code,status});
async function initDossierDb(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS dossier_rounds(day DATE PRIMARY KEY,pokemon_id INTEGER NOT NULL,questions JSONB NOT NULL)`);
  await db.query(`CREATE TABLE IF NOT EXISTS dossier_plays(
    identity TEXT NOT NULL,day DATE NOT NULL REFERENCES dossier_rounds(day),account_id TEXT,
    answers JSONB NOT NULL DEFAULT '[]',points INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'playing' CHECK(status IN ('playing','completed','abandoned')),
    started_at TIMESTAMPTZ NOT NULL,finished_at TIMESTAMPTZ,elapsed_ms BIGINT,
    migrated BOOLEAN NOT NULL DEFAULT false,PRIMARY KEY(identity,day))`);
  await db.query('CREATE INDEX IF NOT EXISTS dossier_plays_account ON dossier_plays(account_id,day)');
}
function createDossierService({db,clock=()=>new Date(),buildQuestions=buildDossierQuestions}) {
  async function transaction(action) {
    const calendar=dailyCalendar(clock()),client=await db.connect();
    try {
      await client.query('BEGIN');const result=await action(client,calendar);
      if(dailyCalendar(clock()).day!==calendar.day)throw fail('stale_daily');
      await client.query('COMMIT');return result;
    }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
  }
  async function round(client,day,who) {
    const prior=(await client.query('SELECT status FROM wordle_plays WHERE identity=$1 AND day=$2',[who.key,day])).rows[0];
    if(!prior||prior.status==='playing')throw fail('wordle_required');
    let r=(await client.query('SELECT * FROM dossier_rounds WHERE day=$1',[day])).rows[0];
    if(r)return r;
    await client.query("SELECT pg_advisory_xact_lock(hashtext('pokedle-dossier:'||$1))",[day]);
    r=(await client.query('SELECT * FROM dossier_rounds WHERE day=$1',[day])).rows[0];
    if(!r) {
      const daily=(await client.query('SELECT secret_id FROM daily_rounds WHERE day=$1',[day])).rows[0];
      if(!daily||!facts[daily.secret_id])throw fail('unavailable',503);
      r={pokemon_id:Number(daily.secret_id),questions:buildQuestions(Number(daily.secret_id),day)};
      await client.query('INSERT INTO dossier_rounds(day,pokemon_id,questions) VALUES($1,$2,$3::jsonb)',[day,r.pokemon_id,JSON.stringify(r.questions)]);
    }
    return r;
  }
  async function play(client,calendar,who) {
    const day=calendar.day;
    let row=(await client.query('SELECT * FROM dossier_plays WHERE identity=$1 AND day=$2 FOR UPDATE',[who.key,day])).rows[0];
    if(!row) {
      await client.query('INSERT INTO dossier_plays(identity,day,account_id,started_at) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[who.key,day,who.accountId||null,clock()]);
      row=(await client.query('SELECT * FROM dossier_plays WHERE identity=$1 AND day=$2 FOR UPDATE',[who.key,day])).rows[0];
    }
    if(who.accountId&&!row.migrated) {
      if(who.guestKey) {
        const guest=(await client.query('SELECT * FROM dossier_plays WHERE identity=$1 AND day=$2 FOR UPDATE',[who.guestKey,day])).rows[0];
        if(guest&&(guest.answers.length||guest.status!=='playing'))await client.query('UPDATE dossier_plays SET answers=$3::jsonb,points=$4,status=$5,started_at=$6,finished_at=$7,elapsed_ms=$8,account_id=$9 WHERE identity=$1 AND day=$2',[who.key,day,JSON.stringify(guest.answers),guest.points,guest.status,guest.started_at,guest.finished_at,guest.elapsed_ms,guest.status==='playing'?who.accountId:null]);
      }
      await client.query('UPDATE dossier_plays SET migrated=true WHERE identity=$1 AND day=$2',[who.key,day]);
      row=(await client.query('SELECT * FROM dossier_plays WHERE identity=$1 AND day=$2',[who.key,day])).rows[0];
    }
    return row;
  }
  function snapshot(calendar,who,row,r) {
    const answered=row.answers.length,baseCorrect=row.answers.slice(0,10).filter(a=>a.correct).length;
    const bonus=answered>=10&&baseCorrect===10,finished=row.status!=='playing',q=!finished?r.questions[answered]:null;
    const last=answered?row.answers[answered-1]:null,lastQuestion=last?r.questions[answered-1]:null;
    return {ok:true,...calendar,accountId:who.accountId||null,authenticated:Boolean(who.accountId),
      pokemonId:Number(r.pokemon_id),pokemonName:facts[r.pokemon_id].name,status:row.status,finished,
      answered,points:Number(row.points),baseCorrect,bonusUnlocked:bonus,total:bonus?20:10,
      ranked:row.status==='completed'&&Boolean(row.account_id),elapsedMs:row.elapsed_ms===null?null:Number(row.elapsed_ms),
      question:q?{index:answered,category:q.category,prompt:q.prompt,options:q.options}:null,
      feedback:last?{index:answered-1,choice:last.choice,correct:last.correct,answer:lastQuestion.answer,prompt:lastQuestion.prompt,options:lastQuestion.options,explanation:lastQuestion.explanation}:null,
      results:row.answers.map((a,index)=>({correct:a.correct,...(finished?{prompt:r.questions[index].prompt,options:r.questions[index].options,choice:a.choice,answer:r.questions[index].answer,explanation:r.questions[index].explanation}:{})}))};
  }
  async function act(who,body=null,abandon=false) {
    if(body) {
      if(body.day!==dailyCalendar(clock()).day)throw fail('stale_daily');
      if((body.accountId||null)!==(who.accountId||null))throw fail('account_changed');
      if(!abandon&&(!Number.isInteger(body.index)||body.index<0||body.index>19||!Number.isInteger(body.choice)||body.choice<0||body.choice>3))throw fail('invalid_answer',400);
    }
    return transaction(async(client,calendar)=>{
      const r=await round(client,calendar.day,who),row=await play(client,calendar,who);
      if(!body||row.status!=='playing')return snapshot(calendar,who,row,r);
      if(!abandon&&body.index<row.answers.length)return {...snapshot(calendar,who,row,r),duplicate:true};
      if(!abandon&&body.index!==row.answers.length)throw fail('question_changed');
      const answers=abandon?row.answers:[...row.answers,{choice:body.choice,correct:body.choice===r.questions[body.index].answer}];
      const correct=answers.filter(a=>a.correct).length,bonus=answers.length>=10&&answers.slice(0,10).every(a=>a.correct);
      const status=abandon?'abandoned':answers.length===(bonus?20:10)?'completed':'playing';
      const points=abandon?0:correct,finished=status!=='playing',now=clock(),elapsed=finished?Math.max(0,now-new Date(row.started_at)):null;
      await client.query('UPDATE dossier_plays SET answers=$3::jsonb,points=$4,status=$5,finished_at=$6,elapsed_ms=$7 WHERE identity=$1 AND day=$2',[who.key,calendar.day,JSON.stringify(answers),points,status,finished?now:null,elapsed]);
      if(status==='completed'&&row.account_id)await recordLeaderboardResultInTransaction(client,{id:who.accountId,username:who.name,avatar:who.avatar},'dossier',points,{direction:'desc'},'dossier:'+calendar.day);
      return snapshot(calendar,who,{...row,answers,points,status,elapsed_ms:elapsed},r);
    });
  }
  async function leaderboard(scope,accountId) {
    const day=dailyCalendar(clock()).day;
    const predicate=scope==='today'?'AND p.day=$1::date':scope==='week'?"AND p.day>$1::date-7 AND p.day<=$1::date":'AND p.day<=$1::date';
    const cte=`WITH candidates AS (
      SELECT p.account_id AS discord_id,p.points AS score,p.elapsed_ms,p.finished_at,
        ROW_NUMBER() OVER(PARTITION BY p.account_id ORDER BY p.points DESC,p.elapsed_ms ASC,p.finished_at ASC) AS attempt_rank
      FROM dossier_plays p WHERE p.status='completed' AND p.account_id IS NOT NULL ${predicate}
    ), ranked AS (
      SELECT c.discord_id,COALESCE(u.username,'Dresseur') AS username,COALESCE(u.avatar,'') AS avatar,c.score,
        (RANK() OVER(ORDER BY c.score DESC,c.elapsed_ms ASC))::int AS rank
      FROM candidates c LEFT JOIN users u ON u.discord_id=c.discord_id WHERE c.attempt_rank=1)`;
    const rows=(await db.query(cte+' SELECT * FROM ranked ORDER BY rank,username LIMIT 20',[day])).rows;
    const total=Number((await db.query(cte+' SELECT COUNT(*)::int AS total FROM ranked',[day])).rows[0].total);
    const mine=accountId?(await db.query(cte+' SELECT * FROM ranked WHERE discord_id=$2',[day,accountId])).rows[0]:null;
    const around=mine?(await db.query(cte+' SELECT * FROM ranked WHERE rank BETWEEN $2 AND $3 ORDER BY rank,username LIMIT 7',[day,Math.max(1,mine.rank-2),mine.rank+2])).rows:[];
    const map=r=>({rank:Number(r.rank),username:r.username,avatar:r.avatar,score:Number(r.score),me:r.discord_id===accountId});
    return {ok:true,mode:'dossier',scope,authenticated:Boolean(accountId),direction:'desc',label:'Dossier du jour',unit:'pts',total,top:rows.map(map),me:mine?{rank:Number(mine.rank),score:Number(mine.score)}:null,around:around.map(map)};
  }
  return {state:who=>act(who),answer:(who,body)=>act(who,body),abandon:(who,body)=>act(who,body,true),leaderboard};
}
function mountDossierRoutes({app,express,db,secret,getUser,readCookies,daily,wordle,readyBefore=Promise.resolve()}) {
  const service=db&&secret?createDossierService({db}):null;
  const ready=service?readyBefore.then(()=>initDossierDb(db)).then(()=>true).catch(e=>{console.error('[dossier] init:',e.message);return false;}):Promise.resolve(false);
  const buckets=new Map();
  function rate(key,limit) {
    const now=Date.now();if(buckets.size>10000)for(const[k,b]of buckets)if(b.until<=now)buckets.delete(k);
    const b=buckets.get(key);if(b&&b.until>now){if(++b.count>limit)throw fail('rate_limited',429);}
    else{if(buckets.size>=20000)throw fail('rate_limited',429);buckets.set(key,{count:1,until:now+60000});}
  }
  const handle=action=>async(req,res)=>{
    const started=performance.now();
    res.set('Cache-Control','no-store');
    if(!service||!daily||!wordle||!await ready||!await wordle.ready)return res.status(503).json({ok:false,error:'unavailable'});
    try {
      if(req.method==='POST') {
        if(!req.is('application/json'))throw fail('json_required',415);
        const origin=req.get('origin');if(origin&&new URL(origin).host!==req.get('host'))throw fail('origin_denied',403);
      }
      rate('ip:'+crypto.createHmac('sha256',secret).update(String(req.ip)).digest('hex'),120);
      let id=dailyGuest(secret,readCookies(req).pokdle_daily);
      if(!id){const guest=issueDailyGuest(secret);id=guest.id;res.cookie('pokdle_daily',guest.cookie,{httpOnly:true,secure:req.secure,sameSite:'lax',path:'/',maxAge:180*86400000});}
      const user=getUser(req),who={key:user?.id?'user:'+user.id:'guest:'+id,guestKey:'guest:'+id,accountId:user?.id?String(user.id):null,name:user?.username||'Dresseur',avatar:user?.avatar||''};
      rate('id:'+who.key,60);
      if(req.method==='GET'){await daily.state(who);await wordle.state(who);}
      const data=await action(who,req);
      res.set('Server-Timing','dossier;dur='+(performance.now()-started).toFixed(1));
      res.json(data);
    }catch(e){if(!e.status)console.error('[dossier] request:',e.message);if(e.status===429)res.set('Retry-After','60');res.status(e.status||503).json({ok:false,error:e.status?e.code:'unavailable'});}
  };
  app.get('/api/daily/dossier',handle(who=>service.state(who)));
  app.post('/api/daily/dossier/answer',express.json({limit:'2kb'}),handle((who,req)=>service.answer(who,req.body||{})));
  app.post('/api/daily/dossier/abandon',express.json({limit:'2kb'}),handle((who,req)=>service.abandon(who,req.body||{})));
  return {ready,async state(who){if(!service||!await ready)throw fail('unavailable',503);return service.state(who);},async leaderboard(scope,accountId){if(!service||!await ready)throw fail('unavailable',503);return service.leaderboard(scope,accountId);}};
}
module.exports={initDossierDb,createDossierService,mountDossierRoutes};
