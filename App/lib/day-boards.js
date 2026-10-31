'use strict';
// The day's boards, all in points. « Aujourd'hui » is the day's score; « 7 jours » and « Total »
// add up every day played, so playing often counts, not only one lucky day (decided 30/10/2026).
const {playerLevelFromXp,rankingAvatarSql}=require('./profile-sync');
const {sql:pointsSql}=require('./daily-points');

// Where each stage's plays are and what a play is worth.
const STAGES=Object.freeze({
  enquete:{table:'daily_plays',points:pointsSql.enquiry('p.status','p.guessed','p.hints_used'),attempts:'jsonb_array_length(p.guessed)',hints:'p.hints_used'},
  wordlepts:{table:'wordle_plays',points:pointsSql.wordle('p.status','p.guessed'),attempts:'jsonb_array_length(p.guessed)',hints:'0'},
  dossier:{table:'dossier_plays',points:'p.points',attempts:'NULL::int',hints:'0'},
  challenge:{table:'challenge_plays',points:'p.points',attempts:'NULL::int',hints:'0'}
});
// On its own board a stage counts its usual ending (won, completed). In the day's total every
// finished stage counts, so a stage left out only costs its own points.
const OWN=Object.freeze({enquete:"p.status='won'",wordlepts:"p.status='won'",dossier:"p.status='completed'",challenge:"p.status='completed'"});
const FINISHED=Object.freeze({enquete:"p.status NOT IN ('ready','playing')",wordlepts:"p.status NOT IN ('ready','playing')",dossier:"p.status NOT IN ('ready','playing')",challenge:"p.status IN ('completed','abandoned')"});
const LABELS=Object.freeze({journey:'Parcours du jour',enquete:'Enquête du jour',wordlepts:'Wordle du jour',dossier:'Dossier du jour',challenge:'Défi du jour'});
const DAY_BOARDS=Object.freeze(Object.keys(LABELS));

function periodSql(scope){
  return scope==='today'?'AND p.day=$1::date':scope==='week'?'AND p.day>$1::date-7 AND p.day<=$1::date':'AND p.day<=$1::date';
}
// One row per account and day for a stage; MAX keeps a single play if an account has two.
function stageSql(name,condition,scope){
  const s=STAGES[name];
  return `SELECT p.account_id,p.day,MAX(${s.points})::int AS points,MIN(COALESCE(p.elapsed_ms,0))::bigint AS elapsed_ms,MIN(${s.attempts})::int AS attempts,MIN(${s.hints})::int AS hints FROM ${s.table} p WHERE p.account_id IS NOT NULL AND ${condition} ${periodSql(scope)} GROUP BY p.account_id,p.day`;
}

async function dayBoard(db,{mode,scope,accountId,day}){
  if(!LABELS[mode])throw new Error('Unknown day board: '+mode);
  const journey=mode==='journey';
  const parts=journey?Object.keys(STAGES).map(name=>stageSql(name,FINISHED[name],scope)):[stageSql(mode,OWN[mode],scope)];
  // A single day of Enquête or Wordle keeps its validated order: guesses, hints, then time.
  const detailed=scope==='today'&&(mode==='enquete'||mode==='wordlepts');
  const order=detailed?'t.score DESC,t.attempts ASC,t.hints ASC,t.elapsed_ms ASC':'t.score DESC,t.elapsed_ms ASC';
  const cte=`WITH plays AS (${parts.join(' UNION ALL ')}),
    totals AS (SELECT account_id AS discord_id,SUM(points)::int AS score,SUM(elapsed_ms)::bigint AS elapsed_ms,MIN(attempts)::int AS attempts,MIN(hints)::int AS hints,COUNT(DISTINCT day)::int AS days FROM plays GROUP BY account_id),
    ranked AS (SELECT t.discord_id,COALESCE(u.username,'Dresseur') AS username,${rankingAvatarSql("COALESCE(u.avatar,'')")} AS avatar,u.partner_id,u.xp,t.score,t.attempts,t.hints,t.days,(RANK() OVER(ORDER BY ${order}))::int AS rank FROM totals t LEFT JOIN users u ON u.discord_id=t.discord_id)`;
  const rows=(await db.query(cte+' SELECT * FROM ranked ORDER BY rank,username LIMIT 20',[day])).rows;
  const total=Number((await db.query(cte+' SELECT COUNT(*)::int AS total FROM ranked',[day])).rows[0].total);
  const mine=accountId?(await db.query(cte+' SELECT * FROM ranked WHERE discord_id=$2',[day,accountId])).rows[0]:null;
  const around=mine?(await db.query(cte+' SELECT * FROM ranked WHERE rank BETWEEN $2 AND $3 ORDER BY rank,username LIMIT 7',[day,Math.max(1,mine.rank-2),mine.rank+2])).rows:[];
  // The detail behind the points: guesses for one day of Enquête or Wordle, days played over a period.
  const detail=r=>detailed?{attempts:Number(r.attempts),hints:Number(r.hints)}:scope==='today'?{}:{days:Number(r.days)};
  const map=r=>({rank:Number(r.rank),username:r.username,avatar:r.avatar,partnerId:r.partner_id?Number(r.partner_id):null,level:playerLevelFromXp(r.xp),score:Number(r.score),...detail(r),me:r.discord_id===accountId});
  return {ok:true,mode,scope,authenticated:Boolean(accountId),direction:'desc',label:LABELS[mode],unit:'pts',cumulative:scope!=='today',total,top:rows.map(map),me:mine?{rank:Number(mine.rank),score:Number(mine.score),...detail(mine)}:null,around:around.map(map)};
}

module.exports={DAY_BOARDS,dayBoard};
