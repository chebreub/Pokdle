'use strict';
const crypto=require('node:crypto');
const {dailyCalendar,dailyGuest,issueDailyGuest}=require('./daily-game');
const {recordLeaderboardResultInTransaction}=require('./leaderboard-store');
const {DAILY_MAX,DAILY_TOTAL,challengePoints,enquiryPoints,sql:pointsSql}=require('./daily-points');
const LIMIT=180000,COUNT=10,TRIES=6;
const MODES=['zoom','cry','pixel'];
const LABELS={zoom:'Zoom progressif',cry:'Cri Pokémon',pixel:'Pixelisé'};
const fail=(code,status=409)=>Object.assign(new Error(code),{code,status});
function modeForDay(day){return MODES[Math.floor(Date.parse(day+'T12:00:00Z')/86400000)%MODES.length];}
function chooseTargets(pokemon,randomInt=crypto.randomInt){const pool=pokemon.filter(p=>!p.isAltForm&&p.id>=1&&p.id<=1025).map(p=>p.id);if(pool.length<COUNT)throw fail('unavailable',503);const out=[];while(out.length<COUNT)out.push(pool.splice(randomInt(pool.length),1)[0]);return out;}
async function initChallengeDb(db){
  await db.query('CREATE TABLE IF NOT EXISTS challenge_rounds(day DATE PRIMARY KEY,mode TEXT NOT NULL,targets JSONB NOT NULL)');
  await db.query(`CREATE TABLE IF NOT EXISTS challenge_plays(identity TEXT NOT NULL,day DATE NOT NULL REFERENCES challenge_rounds(day),account_id TEXT,answers JSONB NOT NULL DEFAULT '[]',guessed JSONB NOT NULL DEFAULT '[]',points INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'ready' CHECK(status IN ('ready','playing','completed','abandoned')),started_at TIMESTAMPTZ,finished_at TIMESTAMPTZ,elapsed_ms BIGINT,migrated BOOLEAN NOT NULL DEFAULT false,PRIMARY KEY(identity,day))`);
  await db.query('CREATE INDEX IF NOT EXISTS challenge_account ON challenge_plays(account_id,day)');
  // A failed rescore must not take the Défi offline: new plays already use the current scale.
  try{await rescoreChallengePlays(db);}catch(e){console.error('[challenge] rescore:',e.message);}
}
// Points follow the current scale from each stored answer (correct + attempts), so plays
// recorded under an older scale stay comparable. Abandons keep 0. Idempotent at every start.
async function rescoreChallengePlays(db){
  await db.query(`UPDATE challenge_plays c SET answers=fixed.answers,points=fixed.points FROM (
    SELECT p.identity,p.day,
      COALESCE(jsonb_agg(a.value||jsonb_build_object('points',${pointsSql.challengeAnswer('a.value')}) ORDER BY a.n) FILTER (WHERE a.value IS NOT NULL),'[]'::jsonb) AS answers,
      COALESCE(SUM(${pointsSql.challengeAnswer('a.value')}),0)::int AS points
    FROM challenge_plays p LEFT JOIN LATERAL jsonb_array_elements(p.answers) WITH ORDINALITY a(value,n) ON true
    GROUP BY p.identity,p.day) fixed
    WHERE c.identity=fixed.identity AND c.day=fixed.day AND c.status<>'abandoned' AND (c.points<>fixed.points OR c.answers<>fixed.answers)`);
  const tables=(await db.query("SELECT to_regclass('leaderboard_events') IS NOT NULL AS events,to_regclass('scores') IS NOT NULL AS scores")).rows[0];
  if(tables.events)await db.query(`UPDATE leaderboard_events e SET score=c.points FROM challenge_plays c
    WHERE e.mode='challenge' AND e.result_key='challenge:'||c.day::text AND e.discord_id=c.account_id AND c.status='completed' AND e.score<>c.points`);
  if(tables.events&&tables.scores)await db.query(`UPDATE scores s SET score=b.best FROM (SELECT discord_id,MAX(score)::int AS best FROM leaderboard_events WHERE mode='challenge' GROUP BY discord_id) b
    WHERE s.mode='challenge' AND s.discord_id=b.discord_id AND s.score<>b.best`);
}
function createChallengeService({db,pokemon,clock=()=>new Date(),randomInt=crypto.randomInt}){
  const byId=new Map(pokemon.map(p=>[Number(p.id),p]));
  async function transaction(action){const cal=dailyCalendar(clock()),c=await db.connect();try{await c.query('BEGIN');const result=await action(c,cal);if(dailyCalendar(clock()).day!==cal.day)throw fail('stale_daily');await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
  async function round(c,day,who){
    const prior=(await c.query('SELECT status FROM dossier_plays WHERE identity=$1 AND day=$2',[who.key,day])).rows[0];if(!prior||prior.status==='playing')throw fail('dossier_required');
    let r=(await c.query('SELECT * FROM challenge_rounds WHERE day=$1',[day])).rows[0];if(r)return r;
    await c.query("SELECT pg_advisory_xact_lock(hashtext('pokedle-challenge:'||$1))",[day]);r=(await c.query('SELECT * FROM challenge_rounds WHERE day=$1',[day])).rows[0];
    if(!r){r={mode:modeForDay(day),targets:chooseTargets(pokemon,randomInt)};await c.query('INSERT INTO challenge_rounds VALUES($1,$2,$3::jsonb)',[day,r.mode,JSON.stringify(r.targets)]);}return r;
  }
  async function play(c,day,who){
    let row=(await c.query('SELECT * FROM challenge_plays WHERE identity=$1 AND day=$2 FOR UPDATE',[who.key,day])).rows[0];
    if(!row){await c.query('INSERT INTO challenge_plays(identity,day,account_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[who.key,day,who.accountId||null]);row=(await c.query('SELECT * FROM challenge_plays WHERE identity=$1 AND day=$2 FOR UPDATE',[who.key,day])).rows[0];}
    if(who.accountId&&!row.migrated){
      if(who.guestKey){const guest=(await c.query('SELECT * FROM challenge_plays WHERE identity=$1 AND day=$2 FOR UPDATE',[who.guestKey,day])).rows[0];if(guest&&guest.status!=='ready'){
        await c.query('UPDATE challenge_plays SET answers=$3::jsonb,guessed=$4::jsonb,points=$5,status=$6,started_at=$7,finished_at=$8,elapsed_ms=$9,account_id=$10 WHERE identity=$1 AND day=$2',[who.key,day,JSON.stringify(guest.answers),JSON.stringify(guest.guessed),guest.points,guest.status,guest.started_at,guest.finished_at,guest.elapsed_ms,(['completed','abandoned'].includes(guest.status)||(guest.status==='playing'&&clock()-new Date(guest.started_at)>=LIMIT))?null:who.accountId]);}}
      await c.query('UPDATE challenge_plays SET migrated=true WHERE identity=$1 AND day=$2',[who.key,day]);row=(await c.query('SELECT * FROM challenge_plays WHERE identity=$1 AND day=$2',[who.key,day])).rows[0];
    }return row;
  }
  async function save(c,cal,who,row){await c.query('UPDATE challenge_plays SET answers=$3::jsonb,guessed=$4::jsonb,points=$5,status=$6,started_at=$7,finished_at=$8,elapsed_ms=$9 WHERE identity=$1 AND day=$2',[who.key,cal.day,JSON.stringify(row.answers),JSON.stringify(row.guessed),row.points,row.status,row.started_at,row.finished_at,row.elapsed_ms]);if(row.status==='completed'&&row.account_id)await recordLeaderboardResultInTransaction(c,{id:who.accountId,username:who.name,avatar:who.avatar},'challenge',row.points,{direction:'desc'},'challenge:'+cal.day);}
  async function expire(c,cal,who,row){if(row.status==='playing'&&clock()-new Date(row.started_at)>=LIMIT){row={...row,status:'completed',finished_at:new Date(+new Date(row.started_at)+LIMIT),elapsed_ms:LIMIT};await save(c,cal,who,row);}return row;}
  function snapshot(cal,who,row,r){
    const index=row.answers.length,finished=['completed','abandoned'].includes(row.status),p=byId.get(Number(r.targets[index]));
    return {ok:true,...cal,accountId:who.accountId||null,authenticated:Boolean(who.accountId),mode:r.mode,label:LABELS[r.mode],status:row.status,finished,index,total:COUNT,maxTries:TRIES,points:Number(row.points),maxPoints:DAILY_MAX.challenge,nextPoints:challengePoints(true,row.guessed.length+1),ranked:row.status==='completed'&&Boolean(row.account_id),elapsedMs:row.elapsed_ms===null?null:Number(row.elapsed_ms),remainingMs:row.status==='ready'?LIMIT:Math.max(0,LIMIT-(clock()-new Date(row.started_at))),guesses:row.guessed.map(id=>({id,name:byId.get(id).name})),hints:!finished&&p?[...(row.guessed.length>=2?['Génération '+p.gen]:[]),...(row.guessed.length>=4?['Type : '+p.type1+(p.type2?' / '+p.type2:'')]:[])]:[],results:row.answers.map((a,i)=>({...a,pokemonId:r.targets[i],name:byId.get(r.targets[i]).name})),media:row.status==='playing'?'/api/daily/challenge/media?day='+cal.day+'&index='+index+'&attempt='+row.guessed.length:null};
  }
  async function act(who,kind='state',body={}){
    if(kind!=='state'&&kind!=='media'){if(body.day!==dailyCalendar(clock()).day)throw fail('stale_daily');if((body.accountId||null)!==(who.accountId||null))throw fail('account_changed');}
    if(kind==='guess'&&(!Number.isInteger(body.pokemonId)||!byId.has(body.pokemonId)||!Number.isInteger(body.index)))throw fail('invalid_guess',400);
    return transaction(async(c,cal)=>{const r=await round(c,cal.day,who);let row=await expire(c,cal,who,await play(c,cal.day,who));
      if(kind==='media'){if(body.day!==cal.day||row.status!=='playing'||Number(body.index)!==row.answers.length||Number(body.attempt)!==row.guessed.length)throw fail('question_changed');return {id:r.targets[row.answers.length],mode:r.mode,attempt:row.guessed.length};}
      if(kind==='state'||['completed','abandoned'].includes(row.status))return snapshot(cal,who,row,r);
      if(kind==='start'){if(row.status==='ready'){row={...row,status:'playing',started_at:clock()};await save(c,cal,who,row);}return snapshot(cal,who,row,r);}
      if(kind==='abandon'){row={...row,status:'abandoned',points:0,finished_at:clock(),elapsed_ms:row.started_at?Math.min(LIMIT,Math.max(0,clock()-new Date(row.started_at))):0};await save(c,cal,who,row);return snapshot(cal,who,row,r);}
      if(row.status!=='playing')throw fail('not_started');
      if(body.index<row.answers.length||row.guessed.includes(body.pokemonId))return {...snapshot(cal,who,row,r),duplicate:true};
      if(body.index!==row.answers.length)throw fail('question_changed');
      const guessed=[...row.guessed,body.pokemonId],correct=body.pokemonId===Number(r.targets[body.index]),resolved=correct||guessed.length===TRIES;
      const earned=challengePoints(correct,guessed.length);
      row={...row,guessed:resolved?[]:guessed,answers:resolved?[...row.answers,{correct,attempts:guessed.length,points:earned}]:row.answers,points:row.points+earned};
      if(row.answers.length===COUNT)row={...row,status:'completed',finished_at:clock(),elapsed_ms:Math.min(LIMIT,Math.max(0,clock()-new Date(row.started_at)))};
      await save(c,cal,who,row);return {...snapshot(cal,who,row,r),feedback:{correct,resolved,...(resolved?{pokemonId:r.targets[body.index],name:byId.get(r.targets[body.index]).name,points:earned}:{})}};
    });
  }
  async function board(mode,scope,accountId){
    const day=dailyCalendar(clock()).day,filter=scope==='today'?'AND c.day=$1::date':scope==='week'?'AND c.day>$1::date-7 AND c.day<=$1::date':'AND c.day<=$1::date';
    const global=mode==='journey';
    const score=global?`c.points+${pointsSql.wordle('w.status','w.guessed')}+d.points+${pointsSql.enquiry('e.status','e.guessed','e.hints_used')}`:'c.points';
    const elapsed=global?'c.elapsed_ms+COALESCE(w.elapsed_ms,0)+COALESCE(d.elapsed_ms,0)+COALESCE(e.elapsed_ms,0)':'c.elapsed_ms';
    const joins=global?`JOIN daily_plays e ON e.identity=c.identity AND e.day=c.day AND e.account_id=c.account_id AND e.status!='playing' JOIN wordle_plays w ON w.identity=c.identity AND w.day=c.day AND w.account_id=c.account_id AND w.status!='playing' JOIN dossier_plays d ON d.identity=c.identity AND d.day=c.day AND d.account_id=c.account_id AND d.status!='playing'`:'';
    const cte=`WITH candidates AS (SELECT c.account_id AS discord_id,${score} AS score,${elapsed} AS elapsed_ms,c.finished_at,ROW_NUMBER() OVER(PARTITION BY c.account_id ORDER BY ${score} DESC,${elapsed} ASC,c.finished_at ASC) AS attempt_rank FROM challenge_plays c ${joins} WHERE c.status IN ('completed'${global?",'abandoned'":''}) AND c.account_id IS NOT NULL ${filter}), ranked AS (SELECT a.discord_id,COALESCE(u.username,'Dresseur') AS username,COALESCE(u.avatar,'') AS avatar,a.score,(RANK() OVER(ORDER BY a.score DESC,a.elapsed_ms ASC))::int AS rank FROM candidates a LEFT JOIN users u ON u.discord_id=a.discord_id WHERE a.attempt_rank=1)`;
    const rows=(await db.query(cte+' SELECT * FROM ranked ORDER BY rank,username LIMIT 20',[day])).rows,total=Number((await db.query(cte+' SELECT COUNT(*)::int AS total FROM ranked',[day])).rows[0].total),mine=accountId?(await db.query(cte+' SELECT * FROM ranked WHERE discord_id=$2',[day,accountId])).rows[0]:null,around=mine?(await db.query(cte+' SELECT * FROM ranked WHERE rank BETWEEN $2 AND $3 ORDER BY rank,username LIMIT 7',[day,Math.max(1,mine.rank-2),mine.rank+2])).rows:[];
    const map=r=>({rank:Number(r.rank),username:r.username,avatar:r.avatar,score:Number(r.score),me:r.discord_id===accountId});return {ok:true,mode,scope,authenticated:Boolean(accountId),direction:'desc',label:global?'Parcours du jour':'Défi du jour',unit:'pts',total,top:rows.map(map),me:mine?{rank:Number(mine.rank),score:Number(mine.score)}:null,around:around.map(map)};
  }
  async function summary(who){return transaction(async(c,cal)=>{const rows=await c.query(`SELECT e.status AS enquiry_status,jsonb_array_length(e.guessed) AS attempts,e.hints_used,e.account_id AS enquiry_account,w.status AS wordle_status,${pointsSql.wordle('w.status','w.guessed')} AS wordle_points,w.account_id AS wordle_account,d.status AS dossier_status,d.points AS dossier_points,d.account_id AS dossier_account,c.status AS challenge_status,c.points AS challenge_points,c.account_id AS challenge_account FROM daily_plays e LEFT JOIN wordle_plays w ON w.identity=e.identity AND w.day=e.day LEFT JOIN dossier_plays d ON d.identity=e.identity AND d.day=e.day LEFT JOIN challenge_plays c ON c.identity=e.identity AND c.day=e.day WHERE e.identity=$1 AND e.day=$2`,[who.key,cal.day]);const r=rows.rows[0]||{},done=s=>s&&!['ready','playing'].includes(s);const stages=[{name:'Enquête',action:'startDailyGame',max:DAILY_MAX.enquiry,finished:done(r.enquiry_status),points:enquiryPoints(r.enquiry_status==='won',r.attempts,r.hints_used)},{name:'Wordle',action:'startDailyWordle',max:DAILY_MAX.wordle,finished:done(r.wordle_status),points:r.wordle_points||0},{name:'Dossier',action:'startDailyDossier',max:DAILY_MAX.dossier,finished:done(r.dossier_status),points:r.dossier_points||0},{name:'Défi',action:'startDailyChallenge',max:DAILY_MAX.challenge,finished:done(r.challenge_status),points:r.challenge_points||0}];return {ok:true,...cal,stages,maxPoints:DAILY_TOTAL,points:stages.reduce((n,s)=>n+s.points,0),finished:stages.every(s=>s.finished),ranked:Boolean(who.accountId&&stages.every(s=>s.finished)&&[r.enquiry_account,r.wordle_account,r.dossier_account,r.challenge_account].every(id=>id===who.accountId))};});}
  return {state:who=>act(who),start:(who,b)=>act(who,'start',b),guess:(who,b)=>act(who,'guess',b),abandon:(who,b)=>act(who,'abandon',b),media:(who,b)=>act(who,'media',b),leaderboard:board,summary};
}
function createMediaLoader({fetchAsset=fetch,sharp=require('sharp')}={}){
  const cache=new Map(),sources=new Map();return async({id,mode,attempt})=>{
    const key=id+':'+mode+':'+attempt;if(cache.has(key))return cache.get(key);
    const promise=(async()=>{const url=mode==='cry'?`https://cdn.jsdelivr.net/gh/PokeAPI/cries@main/cries/pokemon/latest/${id}.ogg`:`https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/${id}.png`;const sourceKey=id+':'+(mode==='cry'?'audio':'image');if(!sources.has(sourceKey)){const pending=(async()=>{const response=await fetchAsset(url,{signal:AbortSignal.timeout(7000)});if(!response.ok)throw fail('media_unavailable',503);const data=Buffer.from(await response.arrayBuffer());if(data.length>2000000)throw fail('media_unavailable',503);return data;})();sources.set(sourceKey,pending);if(sources.size>100)sources.delete(sources.keys().next().value);pending.catch(()=>sources.delete(sourceKey));}const raw=await sources.get(sourceKey);if(mode==='cry')return {buffer:raw,type:'audio/ogg'};
      let img=sharp(raw);if(mode==='zoom'){const size=[22,30,42,56,72,96][attempt];img=img.extract({left:Math.floor((96-size)/2),top:Math.floor((96-size)/2),width:size,height:size}).resize(288,288,{kernel:'nearest'});}else img=img.resize([8,12,18,26,40,64][attempt],[8,12,18,26,40,64][attempt],{kernel:'nearest'}).png();const small=await img.png().toBuffer();return {buffer:mode==='pixel'?await sharp(small).resize(288,288,{kernel:'nearest'}).png().toBuffer():small,type:'image/png'};
    })();cache.set(key,promise);if(cache.size>180)cache.delete(cache.keys().next().value);try{return await promise;}catch(e){cache.delete(key);throw e;}
  };
}
function mountChallengeRoutes({app,express,db,pokemon,secret,getUser,readCookies,daily,wordle,dossier,readyBefore=Promise.resolve(),loadMedia=createMediaLoader()}){
  const service=db&&secret?createChallengeService({db,pokemon}):null,ready=service?readyBefore.then(()=>Promise.all([wordle.ready,dossier.ready])).then(values=>{if(values.some(v=>!v))throw fail('unavailable',503);return initChallengeDb(db);}).then(()=>true).catch(e=>{console.error('[challenge] init:',e.message);return false;}):Promise.resolve(false),buckets=new Map();
  const rate=key=>{const now=Date.now(),b=buckets.get(key);if(b&&b.until>now){if(++b.count>120)throw fail('rate_limited',429);}else{if(buckets.size>10000)for(const[k,v]of buckets)if(v.until<=now)buckets.delete(k);if(buckets.size>=20000)throw fail('rate_limited',429);buckets.set(key,{until:now+60000,count:1});}};
  const handle=action=>async(req,res)=>{const started=performance.now();res.set('Cache-Control','no-store');if(!service||!await ready)return res.status(503).json({ok:false,error:'unavailable'});try{
    if(req.method==='POST'){if(!req.is('application/json'))throw fail('json_required',415);const origin=req.get('origin');if(origin&&new URL(origin).host!==req.get('host'))throw fail('origin_denied',403);}
    rate('ip:'+crypto.createHmac('sha256',secret).update(String(req.ip)).digest('hex'));let id=dailyGuest(secret,readCookies(req).pokdle_daily);if(!id){const guest=issueDailyGuest(secret);id=guest.id;res.cookie('pokdle_daily',guest.cookie,{httpOnly:true,secure:req.secure,sameSite:'lax',path:'/',maxAge:180*86400000});}const u=getUser(req),who={key:u?.id?'user:'+u.id:'guest:'+id,guestKey:'guest:'+id,accountId:u?.id?String(u.id):null,name:u?.username||'Dresseur',avatar:u?.avatar||''};rate('id:'+who.key);
    // Migration only when opening; each answer checks the prerequisite itself.
    if(req.method==='GET'&&!req.path.endsWith('/media')&&!req.path.endsWith('/summary')){await daily.state(who);await wordle.state(who);await dossier.state(who);}
    const data=await action(who,req);res.set('Server-Timing','challenge;dur='+(performance.now()-started).toFixed(1));if(data.buffer)res.type(data.type).send(data.buffer);else res.json(data);
  }catch(e){if(!e.status)console.error('[challenge]',e.message);if(e.status===429)res.set('Retry-After','60');res.status(e.status||503).json({ok:false,error:e.status?e.code:'unavailable'});}};
  app.get('/api/daily/challenge',handle(who=>service.state(who)));for(const action of ['start','guess','abandon'])app.post('/api/daily/challenge/'+action,express.json({limit:'2kb'}),handle((who,req)=>service[action](who,req.body||{})));
  app.get('/api/daily/challenge/media',handle(async(who,req)=>loadMedia(await service.media(who,req.query))));app.get('/api/daily/challenge/summary',handle(who=>service.summary(who)));
  return {ready,async leaderboard(mode,scope,accountId){if(!service||!await ready)throw fail('unavailable',503);return service.leaderboard(mode,scope,accountId);}};
}
module.exports={LIMIT,modeForDay,chooseTargets,initChallengeDb,createChallengeService,createMediaLoader,mountChallengeRoutes};
