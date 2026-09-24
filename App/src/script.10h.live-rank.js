
// Live Rank HUD — in-game competitive context without opening the full leaderboard.
const LIVE_RANK_CACHE = new Map();
const LIVE_RANK_TTL = 12000;
const LIVE_RANK_MILESTONES = new Set();

function liveRankModeMeta(mode) {
  if (typeof leaderboardV2ModeMeta === "function") return leaderboardV2ModeMeta(mode);
  return { label:String(mode||"Classement"), unit:"pts", direction:"desc" };
}
function liveRankFormat(score, mode, unit) {
  if (typeof leaderboardV2FormatScore === "function") return leaderboardV2FormatScore(score, mode, unit);
  return String(Number(score)||0) + (unit ? " " + unit : "");
}
function liveRankFetch(mode, force=false) {
  if (!mode) return Promise.resolve(null);
  const cached=LIVE_RANK_CACHE.get(mode);
  const now=Date.now();
  if (!force && cached?.data && now-cached.at<LIVE_RANK_TTL) return Promise.resolve(cached.data);
  if (!force && cached?.promise) return cached.promise;
  const promise=fetch("/api/leaderboard?mode="+encodeURIComponent(mode)+"&scope=today",{credentials:"same-origin"})
    .then(r=>r.json())
    .then(data=>{
      const row={data:data?.ok?data:null,at:Date.now(),promise:null};
      LIVE_RANK_CACHE.set(mode,row);
      return row.data;
    })
    .catch(()=>{
      LIVE_RANK_CACHE.set(mode,{data:cached?.data||null,at:cached?.at||0,promise:null});
      return cached?.data||null;
    });
  LIVE_RANK_CACHE.set(mode,{data:cached?.data||null,at:cached?.at||0,promise});
  return promise;
}
function liveRankPersonalBest(mode) {
  const p=typeof playerProfile==="object"&&playerProfile?playerProfile:{};
  if (mode==="quiz") return Number(p.quizHighScore)||0;
  if (mode==="speedrun") return Number(p.speedrunHighScore)||0;
  if (mode==="higherlower") return Number(p.higherLowerHighScore)||0;
  if (mode==="higherlower60") return Number(p.higherLower60sHighScore)||0;
  if (mode==="typecombo") return Number(p.typeComboHighScore)||0;
  if (/^draft_([1-9])$/.test(mode)) {
    const gen=Number(mode.split("_")[1]);
    return Number(p.draftScoreAttackRecords?.[gen])||0;
  }
  if (mode==="draft_all") {
    const values=Object.values(p.draftScoreAttackRecords||{}).map(Number).filter(Number.isFinite);
    return values.length?Math.max(...values):0;
  }
  if (mode==="daily") {
    const wins=(Array.isArray(matchHistory)?matchHistory:[])
      .filter(row=>row?.mode==="daily"&&row?.result==="win")
      .map(row=>Number(row.attempts)||0)
      .filter(n=>n>0);
    return wins.length?Math.min(...wins):0;
  }
  return 0;
}
function liveRankCurrentContext(mode) {
  if (mode==="daily") return { score:Number(attempts)||0, label:"Essais en cours" };
  if (mode==="quiz") return { score:Number(quizScore)||0, label:"Score en cours" };
  if (mode==="speedrun") return { score:Number(speedrunState?.correct)||0, label:"Score en cours" };
  if (mode==="higherlower") return { score:Number(higherLowerState?.score)||0, label:"Série en cours" };
  if (mode==="higherlower60") return { score:Number(higherLowerState?.score)||0, label:"Score en cours" };
  if (mode==="typecombo") return { score:Number(typeComboState?.score)||0, label:"Score en cours" };
  if (mode && mode.startsWith("draft_")) {
    const metrics=typeof getDraftTeamBstMetrics==="function"&&draftArenaState
      ? getDraftTeamBstMetrics(draftArenaState.team||[]) : {average:0};
    return { score:Number(metrics?.average)||0, label:"Moyenne actuelle" };
  }
  return {score:0,label:"En cours"};
}
function liveRankAheadRow(data) {
  if (!data?.me) return null;
  const rank=Number(data.me.rank)||0;
  const rows=[...(data.top||[]),...(data.around||[])]
    .filter(row=>Number(row.rank)>0&&Number(row.rank)<rank)
    .sort((a,b)=>Number(b.rank)-Number(a.rank));
  return rows[0]||null;
}
function liveRankGoal(data, mode) {
  const ahead=liveRankAheadRow(data);
  if (!ahead) return null;
  const meta=liveRankModeMeta(mode);
  const threshold=Number(ahead.score)||0;
  const score=meta.direction==="asc"?Math.max(1,threshold-1):threshold+1;
  return {rank:Number(ahead.rank)||Math.max(1,(Number(data.me?.rank)||2)-1),score,threshold};
}
function liveRankAnchor(screenId) {
  const screen=document.getElementById(screenId);
  if (!screen) return null;
  if (screenId==="screen-game") return screen.querySelector(".game-topbar");
  if (screenId==="screen-draft-score-attack") return screen.querySelector(".ranking-head") || screen.querySelector(".draft-card");
  return screen.querySelector(".ranking-head") || screen.querySelector(".card");
}
function ensureLiveRankHud(screenId) {
  const screen=document.getElementById(screenId);
  if (!screen) return null;
  let hud=screen.querySelector(":scope > .live-rank-hud, .card > .live-rank-hud, #draft-mode-card > .live-rank-hud");
  if (hud) return hud;
  const anchor=liveRankAnchor(screenId);
  if (!anchor) return null;
  hud=document.createElement("section");
  hud.className="live-rank-hud";
  hud.setAttribute("aria-live","polite");
  anchor.insertAdjacentElement("afterend",hud);
  return hud;
}
function liveRankGoalCopy(data,mode,currentScore) {
  const meta=liveRankModeMeta(mode);
  if (!data?.me) {
    const leader=Array.isArray(data?.top)&&data.top[0]?data.top[0]:null;
    if (!leader) return {tone:"muted",text:"Sois le premier classé aujourd’hui."};
    return {tone:"muted",text:"Leader · "+liveRankFormat(leader.score,mode,data.unit||meta.unit)};
  }
  if (Number(data.me.rank)===1) return {tone:"leader",text:"Tu es leader aujourd’hui."};
  const goal=liveRankGoal(data,mode);
  if (!goal) return {tone:"muted",text:"Continue pour gagner des places."};
  if (mode==="daily") {
    if (currentScore>0&&currentScore<=goal.score) return {tone:"hot",text:"Top #"+goal.rank+" possible si tu trouves maintenant."};
    return {tone:"goal",text:"Pour dépasser #"+goal.rank+" · "+liveRankFormat(goal.score,mode,data.unit||meta.unit)};
  }
  if (currentScore>0&&currentScore>=goal.score) {
    return {tone:"hot",text:"Objectif #"+goal.rank+" atteint provisoirement."};
  }
  const diff=Math.max(0,goal.score-currentScore);
  return {tone:"goal",text:"Encore "+diff+" pour dépasser #"+goal.rank+"."};
}
function maybeCelebrateLiveRankGoal(mode,data,currentScore) {
  if (!data?.me || mode==="daily" || !(currentScore>0)) return;
  const goal=liveRankGoal(data,mode);
  if (!goal || currentScore<goal.score) return;
  const key=mode+":"+goal.rank+":"+goal.score;
  if (LIVE_RANK_MILESTONES.has(key)) return;
  LIVE_RANK_MILESTONES.add(key);
  const hud=document.querySelector('.live-rank-hud[data-mode="'+CSS.escape(mode)+'"]');
  if (hud) {
    hud.classList.remove("is-goal-hit");
    void hud.offsetWidth;
    hud.classList.add("is-goal-hit");
    setTimeout(()=>hud.classList.remove("is-goal-hit"),900);
  }
  if (typeof gameFeelFloatingMark==="function"&&hud) gameFeelFloatingMark(hud,"Rang en vue","success");
}
function renderLiveRankHud(screenId,mode,currentOverride=null) {
  const hud=ensureLiveRankHud(screenId);
  if (!hud||!mode) return;
  hud.dataset.mode=mode;
  const meta=liveRankModeMeta(mode);
  const current=currentOverride||liveRankCurrentContext(mode);
  const personal=liveRankPersonalBest(mode);
  const cached=LIVE_RANK_CACHE.get(mode)?.data||null;
  const paint=(data)=>{
    if (!hud.isConnected||hud.dataset.mode!==mode) return;
    const me=data?.me||null;
    const goalCopy=liveRankGoalCopy(data,mode,current.score);
    const rankText=me?"#"+Number(me.rank):"—";
    const todayText=me?liveRankFormat(me.score,mode,data.unit||meta.unit):"Non classé";
    const currentText=current.score>0?liveRankFormat(current.score,mode,data?.unit||meta.unit):"—";
    const recordText=personal>0?liveRankFormat(personal,mode,data?.unit||meta.unit):"—";
    hud.innerHTML=
      '<div class="live-rank-mark"><svg aria-hidden="true"><use href="#i-trophy"/></svg></div>'+
      '<div class="live-rank-primary"><span>CLASSEMENT DU JOUR</span><div><strong>'+rankText+'</strong><b>'+escapeHtml(todayText)+'</b></div></div>'+
      '<div class="live-rank-stat"><span>'+escapeHtml(current.label)+'</span><strong>'+escapeHtml(currentText)+'</strong></div>'+
      '<div class="live-rank-stat live-rank-record"><span>Record perso</span><strong>'+escapeHtml(recordText)+'</strong></div>'+
      '<div class="live-rank-goal is-'+goalCopy.tone+'"><span>OBJECTIF</span><b>'+escapeHtml(goalCopy.text)+'</b></div>'+
      '<button type="button" class="live-rank-open" data-action="openLeaderboardV2" data-args=\'["'+escapeHtml(mode)+'","today"]\'>Classement →</button>';
    maybeCelebrateLiveRankGoal(mode,data,current.score);
  };
  paint(cached);
  liveRankFetch(mode).then(paint);
}
function refreshDailyLiveRank(force=false) {
  if (typeof gameMode==="undefined"||gameMode!=="daily") return;
  if (force) LIVE_RANK_CACHE.delete("daily");
  renderLiveRankHud("screen-game","daily");
}
function refreshQuizLiveRank() {
  if (typeof gameMode==="undefined"||gameMode!=="quiz") return;
  if (typeof isPartySessionActive==="function"&&isPartySessionActive()) return;
  renderLiveRankHud("screen-game","quiz");
}
function refreshSpeedrunLiveRank() {
  renderLiveRankHud("screen-speedrun","speedrun");
}
function refreshHigherLowerLiveRank() {
  const mode=higherLowerState?.mode==="rush60"?"higherlower60":higherLowerState?.mode==="infinite"?"higherlower":null;
  const hud=document.querySelector("#screen-higher-lower .live-rank-hud");
  if (!mode) { if(hud) hud.remove(); return; }
  renderLiveRankHud("screen-higher-lower",mode);
}
function refreshTypeComboLiveRank() {
  renderLiveRankHud("screen-type-combo","typecombo");
}
function refreshDraftLiveRank() {
  if (!draftArenaState||draftArenaState.mode!=="scoreAttack") return;
  const gen=Number(draftArenaState.selectedGen)||0;
  const mode=gen?"draft_"+gen:"draft_all";
  renderLiveRankHud("screen-draft-score-attack",mode);
}

// Wrap entry points and renderers so the HUD stays in sync with the actual live score.
if (typeof startDailyGame==="function") {
  const before=startDailyGame;
  startDailyGame=function(){ const out=before.apply(this,arguments); setTimeout(()=>refreshDailyLiveRank(true),0); return out; };
}
if (typeof addRow==="function") {
  const before=addRow;
  addRow=function(){ const out=before.apply(this,arguments); if(gameMode==="daily") setTimeout(refreshDailyLiveRank,0); return out; };
}
if (typeof startQuizGame==="function") {
  const before=startQuizGame;
  startQuizGame=function(){ const out=before.apply(this,arguments); setTimeout(refreshQuizLiveRank,0); return out; };
}
if (typeof renderQuizMeta==="function") {
  const before=renderQuizMeta;
  renderQuizMeta=function(){ const out=before.apply(this,arguments); refreshQuizLiveRank(); return out; };
}
if (typeof startSpeedrunGame==="function") {
  const before=startSpeedrunGame;
  startSpeedrunGame=function(){ const out=before.apply(this,arguments); setTimeout(refreshSpeedrunLiveRank,0); return out; };
}
if (typeof renderSpeedrunScreen==="function") {
  const before=renderSpeedrunScreen;
  renderSpeedrunScreen=function(){ const out=before.apply(this,arguments); refreshSpeedrunLiveRank(); return out; };
}
if (typeof startHigherLowerMode==="function") {
  const before=startHigherLowerMode;
  startHigherLowerMode=function(){ const out=before.apply(this,arguments); setTimeout(refreshHigherLowerLiveRank,0); return out; };
}
if (typeof renderHigherLowerScreen==="function") {
  const before=renderHigherLowerScreen;
  renderHigherLowerScreen=function(){ const out=before.apply(this,arguments); refreshHigherLowerLiveRank(); return out; };
}
if (typeof startTypeComboGame==="function") {
  const before=startTypeComboGame;
  startTypeComboGame=function(){ const out=before.apply(this,arguments); setTimeout(refreshTypeComboLiveRank,0); return out; };
}
if (typeof renderTypeComboScreen==="function") {
  const before=renderTypeComboScreen;
  renderTypeComboScreen=function(){ const out=before.apply(this,arguments); refreshTypeComboLiveRank(); return out; };
}
if (typeof openDraftScoreAttackMode==="function") {
  const before=openDraftScoreAttackMode;
  openDraftScoreAttackMode=function(){ const out=before.apply(this,arguments); setTimeout(refreshDraftLiveRank,0); return out; };
}
if (typeof renderDraftArena==="function") {
  const before=renderDraftArena;
  renderDraftArena=function(){ const out=before.apply(this,arguments); refreshDraftLiveRank(); return out; };
}

window.renderLiveRankHud=renderLiveRankHud;
window.refreshDailyLiveRank=refreshDailyLiveRank;
