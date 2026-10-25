"use strict";
// Grille du jour: a 3×3 grid where each cell takes one Pokémon matching both its
// row and its column. Same grid for everyone each Paris day, nine guesses (PP),
// and each answer's rarity among the day's players. It is the bonus of the day:
// it stands beside the 100-point journey and has its own leaderboard.
const crypto=require('node:crypto');
const {playerLevelFromXp}=require('./profile-sync');
const {dailyCalendar,dailyGuest,issueDailyGuest}=require('./daily-game');
const fail=(code,status=409)=>Object.assign(new Error(code),{code,status});
const PP=9,CELLS=9,MIN_ANSWERS=3;
const TYPES=['Normal','Feu','Eau','Plante','Électrik','Glace','Combat','Poison','Sol','Vol','Psy','Insecte','Roche','Spectre','Dragon','Ténèbres','Acier','Fée'];
const REGIONS=['Kanto','Johto','Hoenn','Sinnoh','Unys','Kalos','Alola','Galar','Paldea'];
const COLORS=['Rouge','Bleu','Vert','Jaune','Violet','Rose','Brun','Noir','Blanc','Gris'];
// Same list as the Pokédex "Légendes" filter (POKEDEX_LEGENDARY_IDS in script.01).
const LEGENDARY_IDS=new Set([144,145,146,150,151,243,244,245,249,250,251,377,378,379,380,381,382,383,384,385,386,480,481,482,483,484,485,486,487,488,489,490,491,492,493,494,638,639,640,641,642,643,644,645,646,647,648,649,716,717,718,719,720,721,772,773,785,786,787,788,789,790,791,792,793,794,795,796,797,798,799,800,801,802,803,804,805,806,807,808,809,888,889,890,891,892,893,894,895,896,897,898,905,1001,1002,1003,1004,1007,1008,1009,1010,1014,1015,1016,1017,1020,1021,1022,1023,1024,1025]);
// How often each family is drawn, and how many of it one grid may hold.
const FAMILY_WEIGHT={type:6,gen:3,color:1.2,stage:1,special:1.2,shape:.6,size:.35};
const FAMILY_LIMIT={type:4,gen:2,color:1,stage:1,special:1,shape:1,size:1};
const FALLBACK={rows:['type:Feu','type:Eau','type:Plante'],cols:['gen:1','stage:1','shape:dual']};

function speciesOf(pokemon){return pokemon.filter(p=>!p.isAltForm&&Number.isInteger(p.id)&&p.id>=1&&p.id<=1025);}
// Regional forms (Alola, Galar, Hisui, Paldea, the three Paldea Tauros) are answers of their
// own, with their own types, colour and generation, from this Paris day on: the day's games
// already started keep their rules.
const REGIONAL_FORMS_FROM='2026-10-25';
const REGIONAL_FORM_NAME=/(d['’]Alola|de Galar|de Hisui|de Paldea)( \(.+\))?$/;
function isRegionalForm(p){return Boolean(p&&p.isAltForm&&p.baseId&&REGIONAL_FORM_NAME.test(p.name));}
function regionalFormsOn(day){return String(day)>=REGIONAL_FORMS_FROM;}
function playableOf(pokemon,day){const species=speciesOf(pokemon);return regionalFormsOn(day)?[...species,...pokemon.filter(isRegionalForm)]:species;}
// A form and its species are the same Pokémon for « one Pokémon per grid ».
function speciesIdOf(p){return p.isAltForm?Number(p.baseId):Number(p.id);}
function buildCriteria(pokemon){
  const forms=pokemon.filter(p=>p.isAltForm&&p.baseId);
  const mega=new Set(forms.filter(p=>/^Méga-/.test(p.name)).map(p=>Number(p.baseId)));
  const regional=new Set(forms.filter(isRegionalForm).map(p=>Number(p.baseId)));
  const list=[
    ...TYPES.map(t=>({key:'type:'+t,family:'type',value:t,label:'Type '+t,test:p=>p.type1===t||p.type2===t})),
    ...REGIONS.map((r,i)=>({key:'gen:'+(i+1),family:'gen',value:i+1,label:r+' (gén. '+(i+1)+')',test:p=>Number(p.gen)===i+1})),
    ...COLORS.map(c=>({key:'color:'+c,family:'color',value:c,label:'Couleur : '+c.toLowerCase(),test:p=>p.color===c})),
    {key:'stage:1',family:'stage',value:1,label:'Stade de base',hint:'N’est l’évolution d’aucun Pokémon',test:p=>Number(p.stage)===1},
    {key:'stage:2',family:'stage',value:2,label:'Évolué une fois',test:p=>Number(p.stage)===2},
    {key:'stage:3',family:'stage',value:3,label:'Évolué deux fois',test:p=>Number(p.stage)===3},
    {key:'special:legendary',family:'special',label:'Légendaire ou fabuleux',test:p=>LEGENDARY_IDS.has(speciesIdOf(p))},
    {key:'special:mega',family:'special',label:'A une Méga-évolution',test:p=>mega.has(p.id)},
    {key:'special:regional',family:'special',label:'A une forme régionale',hint:'Alola, Galar, Hisui ou Paldea',test:p=>regional.has(p.id)||isRegionalForm(p)},
    {key:'shape:mono',family:'shape',label:'Un seul type',test:p=>!p.type2},
    {key:'shape:dual',family:'shape',label:'Deux types',test:p=>Boolean(p.type2)},
    {key:'size:heavy',family:'size',label:'Pèse 100 kg ou plus',test:p=>Number(p.weight)>=100},
    {key:'size:tall',family:'size',label:'Mesure 2 m ou plus',test:p=>Number(p.height)>=2},
  ];
  return new Map(list.map(c=>[c.key,c]));
}
function seededRandom(seed){
  let s=crypto.createHash('sha256').update(seed).digest().readUInt32LE(0);
  return ()=>{s=(s+0x6D2B79F5)|0;let t=Math.imul(s^(s>>>15),1|s);t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296;};
}
function cellAnswers(species,row,col){return species.filter(p=>row.test(p)&&col.test(p));}
// Draws the day's grid from its date alone; every cell keeps at least three answers
// and at most two cells are tight (fewer than six answers).
function buildGrid(day,criteria,species){
  const rand=seededRandom('pokedle-grid:'+day),all=[...criteria.values()],sizes={};
  for(const c of all)sizes[c.family]=(sizes[c.family]||0)+1;
  const weight=c=>FAMILY_WEIGHT[c.family]/sizes[c.family];
  for(let attempt=0;attempt<4000;attempt++){
    const picked=[],used={};
    while(picked.length<6){
      const open=all.filter(c=>!picked.includes(c)&&(used[c.family]||0)<FAMILY_LIMIT[c.family]);
      let roll=rand()*open.reduce((sum,c)=>sum+weight(c),0),choice=open[open.length-1];
      for(const c of open){roll-=weight(c);if(roll<=0){choice=c;break;}}
      picked.push(choice);used[choice.family]=(used[choice.family]||0)+1;
    }
    const rows=picked.slice(0,3),cols=picked.slice(3),counts=rows.flatMap(r=>cols.map(c=>cellAnswers(species,r,c).length));
    if(counts.every(n=>n>=MIN_ANSWERS)&&counts.filter(n=>n<6).length<=2)return {rows:rows.map(c=>c.key),cols:cols.map(c=>c.key)};
  }
  return FALLBACK;
}
// 10 points per cell found, 10 more for a full grid: the same scale as the journey.
function gridPoints(cells){const found=cells.filter(Boolean).length;return found*10+(found===CELLS?10:0);}

async function initGridDb(db){
  await db.query('CREATE TABLE IF NOT EXISTS grid_rounds(day DATE PRIMARY KEY,rows JSONB NOT NULL,cols JSONB NOT NULL)');
  await db.query(`CREATE TABLE IF NOT EXISTS grid_plays(
    identity TEXT NOT NULL,day DATE NOT NULL REFERENCES grid_rounds(day),account_id TEXT,
    cells JSONB NOT NULL DEFAULT '[null,null,null,null,null,null,null,null,null]',misses JSONB NOT NULL DEFAULT '[]',
    points INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'playing' CHECK(status IN ('playing','completed')),end_reason TEXT,
    started_at TIMESTAMPTZ NOT NULL,finished_at TIMESTAMPTZ,elapsed_ms BIGINT,PRIMARY KEY(identity,day))`);
  await db.query('CREATE INDEX IF NOT EXISTS grid_plays_day ON grid_plays(day)');
  await db.query('CREATE INDEX IF NOT EXISTS grid_plays_account ON grid_plays(account_id,day)');
}

function createGridService({db,pokemon,clock=()=>new Date(),draw=buildGrid}){
  const byId=new Map(playableOf(pokemon,REGIONAL_FORMS_FROM).map(p=>[p.id,p])),criteria=buildCriteria(pokemon),rounds=new Map();
  function describe(key){const c=criteria.get(key);return c?{key,family:c.family,label:c.label,...(c.value!==undefined?{value:c.value}:{}),...(c.hint?{hint:c.hint}:{})}:{key,family:'unknown',label:key};}
  function cellCriteria(round,cell){return [criteria.get(round.rows[Math.floor(cell/3)]),criteria.get(round.cols[cell%3])];}
  function answersFor(round,cell){const [r,c]=cellCriteria(round,cell);return r&&c?cellAnswers(round.pool,r,c):[];}
  async function ensureRound(day){
    if(rounds.has(day))return rounds.get(day);
    let r=(await db.query('SELECT rows,cols FROM grid_rounds WHERE day=$1',[day])).rows[0];
    if(!r){
      const drawn=draw(day,criteria,playableOf(pokemon,day));
      await db.query('INSERT INTO grid_rounds(day,rows,cols) VALUES($1,$2::jsonb,$3::jsonb) ON CONFLICT(day) DO NOTHING',[day,JSON.stringify(drawn.rows),JSON.stringify(drawn.cols)]);
      r=(await db.query('SELECT rows,cols FROM grid_rounds WHERE day=$1',[day])).rows[0];
    }
    const round={rows:r.rows,cols:r.cols,pool:playableOf(pokemon,day),regionalForms:regionalFormsOn(day)};round.possible=Array.from({length:CELLS},(_,i)=>answersFor(round,i).length);
    rounds.set(day,round);if(rounds.size>4)rounds.delete(rounds.keys().next().value);
    return round;
  }
  // Rarity: share of the day's players who put this Pokémon in this cell.
  async function stats(q,day){
    const [picks,total]=await Promise.all([
      q.query(`SELECT (c.idx-1)::int AS cell,c.val::int AS id,COUNT(*)::int AS n FROM grid_plays p
        CROSS JOIN LATERAL jsonb_array_elements_text(p.cells) WITH ORDINALITY AS c(val,idx) WHERE p.day=$1 AND c.val IS NOT NULL GROUP BY 1,2`,[day]),
      q.query('SELECT COUNT(*)::int AS total FROM grid_plays WHERE day=$1',[day])]);
    const count=new Map(picks.rows.map(r=>[r.cell+':'+r.id,Number(r.n)])),players=Number(total.rows[0]?.total||0);
    return {players,count,picks:picks.rows,rarity:(cell,id)=>players?Math.max(1,Math.round(100*(count.get(cell+':'+id)||0)/players)):100};
  }
  // A guest play started before signing in follows the player into their account.
  async function adopt(q,who,day){
    if(!who.accountId||!who.guestKey||who.guestKey===who.key)return null;
    return (await q.query(`UPDATE grid_plays SET identity=$1,account_id=$3 WHERE identity=$2 AND day=$4
      AND NOT EXISTS(SELECT 1 FROM grid_plays WHERE identity=$1 AND day=$4) RETURNING *`,[who.key,who.guestKey,who.accountId,day])).rows[0]||null;
  }
  // The rank is read after the commit, so a grid that just ended is already counted.
  async function withRank(out){
    if(!out.ranked)return out;
    const board=await leaderboard('today',out.accountId,out.day);
    return {...out,rank:board.me?{rank:board.me.rank,total:board.total}:null};
  }
  async function snapshot(cal,who,round,row,s,extra={}){
    const cells=row?.cells||Array(CELLS).fill(null),misses=row?.misses||[],found=cells.filter(Boolean).length;
    const status=row?row.status:'ready',finished=status==='completed';
    const rarities=cells.map((id,i)=>id?s.rarity(i,id):null).filter(v=>v!==null);
    const reveal=finished?Array.from({length:CELLS},(_,i)=>{
      const top=s.picks.filter(p=>p.cell===i).sort((a,b)=>b.n-a.n||a.id-b.id)[0];
      const examples=answersFor(round,i).map(p=>p.id).filter(id=>id!==cells[i]).slice(0,8);
      return {popular:top?{pokemonId:Number(top.id),rarity:s.rarity(i,top.id)}:null,examples};
    }):null;
    return {ok:true,...cal,accountId:who.accountId||null,authenticated:Boolean(who.accountId),mode:'grid',regionalForms:round.regionalForms,label:'Grille du jour',
      status,finished,endReason:row?.end_reason||null,pp:PP-found-misses.length,maxPp:PP,found,points:Number(row?.points||0),maxPoints:100,
      originality:rarities.length?Math.round(100-rarities.reduce((a,b)=>a+b,0)/rarities.length):null,players:s.players,
      rows:round.rows.map(describe),cols:round.cols.map(describe),possible:round.possible,
      cells:cells.map((id,i)=>id?{pokemonId:Number(id),rarity:s.rarity(i,id)}:null),
      misses:misses.map(m=>({cell:m.cell,pokemonId:m.pokemonId})),
      ranked:finished&&Boolean(row?.account_id),rank:null,
      elapsedMs:row?.elapsed_ms==null?null:Number(row.elapsed_ms),reveal,...extra};
  }
  async function state(who){
    const cal=dailyCalendar(clock()),round=await ensureRound(cal.day);
    let row=(await db.query('SELECT * FROM grid_plays WHERE identity=$1 AND day=$2',[who.key,cal.day])).rows[0]||null;
    if(!row)row=await adopt(db,who,cal.day);
    return withRank(await snapshot(cal,who,round,row,await stats(db,cal.day)));
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
  async function lockedPlay(c,who,day,create){
    const select=()=>c.query('SELECT * FROM grid_plays WHERE identity=$1 AND day=$2 FOR UPDATE',[who.key,day]).then(r=>r.rows[0]||null);
    let row=await select();if(row)return row;
    if(await adopt(c,who,day))return select();
    if(!create)return null;
    await c.query('INSERT INTO grid_plays(identity,day,account_id,started_at) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[who.key,day,who.accountId||null,clock()]);
    return select();
  }
  async function finish(c,who,day,row,cells,misses,reason){
    const points=gridPoints(cells),found=cells.filter(Boolean).length,done=reason||(found===CELLS?'full':PP-found-misses.length<=0?'out_of_pp':null);
    const now=clock(),elapsed=done?Math.max(0,now-new Date(row.started_at)):null;
    await c.query('UPDATE grid_plays SET cells=$3::jsonb,misses=$4::jsonb,points=$5,status=$6,end_reason=$7,finished_at=$8,elapsed_ms=$9 WHERE identity=$1 AND day=$2',
      [who.key,day,JSON.stringify(cells),JSON.stringify(misses),points,done?'completed':'playing',done,done?now:null,elapsed]);
    return {...row,cells,misses,points,status:done?'completed':'playing',end_reason:done,elapsed_ms:elapsed};
  }
  async function guess(who,body){
    checkBody(who,body);
    const cell=body.cell,id=body.pokemonId;
    if(!Number.isInteger(cell)||cell<0||cell>=CELLS||!Number.isInteger(id)||!byId.has(id))throw fail('invalid_guess',400);
    return withRank(await transaction(async(c,cal,round)=>{
      let row=await lockedPlay(c,who,cal.day,true);
      if(row.status!=='playing')return snapshot(cal,who,round,row,await stats(c,cal.day));
      const cells=[...row.cells],misses=[...row.misses];
      if(cells[cell])throw fail('cell_filled');
      if(byId.get(id).isAltForm&&!round.regionalForms)throw fail('form_not_allowed',400);
      if(cells.some(c=>c&&speciesIdOf(byId.get(c))===speciesIdOf(byId.get(id))))throw fail('already_used');
      if(misses.some(m=>m.cell===cell&&m.pokemonId===id))throw fail('already_tried');
      const failed=cellCriteria(round,cell).filter(k=>!k.test(byId.get(id))).map(k=>k.label),correct=!failed.length;
      if(correct)cells[cell]=id;else misses.push({cell,pokemonId:id});
      row=await finish(c,who,cal.day,row,cells,misses,null);
      return snapshot(cal,who,round,row,await stats(c,cal.day),{feedback:{cell,pokemonId:id,correct,failed}});
    }));
  }
  async function stop(who,body){
    checkBody(who,body);
    return withRank(await transaction(async(c,cal,round)=>{
      let row=await lockedPlay(c,who,cal.day,true);
      if(row.status==='playing')row=await finish(c,who,cal.day,row,[...row.cells],[...row.misses],'stopped');
      return snapshot(cal,who,round,row,await stats(c,cal.day));
    }));
  }
  // Cells found first, then originality (the rarer the picks the better), then time.
  async function leaderboard(scope,accountId,day=dailyCalendar(clock()).day){
    const predicate=scope==='today'?'AND p.day=$1::date':scope==='week'?'AND p.day>$1::date-7 AND p.day<=$1::date':'AND p.day<=$1::date';
    const cte=`WITH picks AS (
      SELECT p.day,p.identity,c.idx,c.val FROM grid_plays p CROSS JOIN LATERAL jsonb_array_elements_text(p.cells) WITH ORDINALITY AS c(val,idx)
      WHERE c.val IS NOT NULL ${predicate}
    ), counts AS (SELECT day,idx,val,COUNT(*)::numeric AS n FROM picks GROUP BY 1,2,3
    ), totals AS (SELECT p.day,COUNT(*)::numeric AS total FROM grid_plays p WHERE true ${predicate} GROUP BY 1
    ), originality AS (
      SELECT k.day,k.identity,ROUND(100-AVG(100*c.n/t.total))::int AS originality FROM picks k JOIN counts c USING(day,idx,val) JOIN totals t USING(day) GROUP BY 1,2
    ), candidates AS (
      SELECT p.account_id AS discord_id,p.points AS score,COALESCE(o.originality,0) AS originality,p.elapsed_ms,p.finished_at,
        ROW_NUMBER() OVER(PARTITION BY p.account_id ORDER BY p.points DESC,COALESCE(o.originality,0) DESC,p.elapsed_ms ASC,p.finished_at ASC) AS attempt_rank
      FROM grid_plays p LEFT JOIN originality o ON o.day=p.day AND o.identity=p.identity
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
    return {ok:true,mode:'grid',scope,authenticated:Boolean(accountId),direction:'desc',label:'Grille du jour',unit:'pts',
      total:Number(count.rows[0]?.total||0),top:top.rows.map(map),me:me?{rank:Number(me.rank),score:Number(me.score),originality:Number(me.originality)}:null,around:around.map(map)};
  }
  return {state,guess,stop,leaderboard};
}

function mountGridRoutes({app,express,db,pokemon,secret,getUser,readCookies,readyBefore=Promise.resolve()}){
  const service=db&&secret?createGridService({db,pokemon}):null;
  const ready=service?readyBefore.then(()=>initGridDb(db)).then(()=>true).catch(e=>{console.error('[grid] init:',e.message);return false;}):Promise.resolve(false);
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
      res.set('Server-Timing','grid;dur='+(performance.now()-started).toFixed(1));
      res.json(data);
    }catch(e){if(!e.status)console.error('[grid] request:',e.message);if(e.status===429)res.set('Retry-After','60');res.status(e.status||503).json({ok:false,error:e.status?e.code:'unavailable'});}
  };
  app.get('/api/daily/grid',handle(who=>service.state(who)));
  app.post('/api/daily/grid/guess',express.json({limit:'2kb'}),handle((who,req)=>service.guess(who,req.body||{})));
  app.post('/api/daily/grid/stop',express.json({limit:'2kb'}),handle((who,req)=>service.stop(who,req.body||{})));
  return {ready,async leaderboard(scope,accountId){if(!service||!await ready)throw fail('unavailable',503);return service.leaderboard(scope,accountId);}};
}
module.exports={PP,LEGENDARY_IDS,REGIONAL_FORMS_FROM,buildCriteria,buildGrid,gridPoints,speciesOf,isRegionalForm,regionalFormsOn,playableOf,speciesIdOf,initGridDb,createGridService,mountGridRoutes};
