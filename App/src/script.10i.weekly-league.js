
// Weekly League V1 — recurring skill event shared by all players.
const WEEKLY_LEAGUE_TEMPLATES = Object.freeze([
  { id:"daily", label:"Précision", mode:"daily", icon:"◎", description:"Résous le Pokémon du jour avec le moins d'essais possible.", objective:"Réussir en 6 essais ou moins", action:"startDailyGame" },
  { id:"quiz", label:"Connaissance", mode:"quiz", icon:"?", description:"Fais parler ta culture Pokémon au Quiz.", objective:"Atteindre 8/10 au Quiz", action:"startQuizGame" },
  { id:"speedrun", label:"Réflexes", mode:"speedrun", icon:"⚡", description:"Enchaîne les Pokémon avant la fin du chrono.", objective:"Trouver 12 Pokémon au Speedrun", action:"startSpeedrunGame" },
  { id:"higherlower", label:"Instinct", mode:"higher-lower", icon:"↕", description:"Construis une série solide à Higher or Lower.", objective:"Atteindre une série de 8", action:"startHigherLowerMode" },
  { id:"odd", label:"Observation", mode:"odd", icon:"◇", description:"Repère les intrus sans te faire piéger.", objective:"Gagner 5 énigmes Intrus", action:"openOddOneOutMode" },
  { id:"weight", label:"Mesure", mode:"weight", icon:"◆", description:"Compare les poids et enchaîne les bons choix.", objective:"Gagner 5 Duels de poids", action:"startWeightBattle" }
]);

function weeklyLeagueIsoWeek(date=new Date()) {
  const d=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()));
  const day=d.getUTCDay()||7;
  d.setUTCDate(d.getUTCDate()+4-day);
  const yearStart=new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const week=Math.ceil((((d-yearStart)/86400000)+1)/7);
  return { year:d.getUTCFullYear(), week, id:d.getUTCFullYear()+"-W"+String(week).padStart(2,"0") };
}
function weeklyLeagueStart(date=new Date()) {
  const d=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()));
  const day=d.getUTCDay()||7;
  d.setUTCDate(d.getUTCDate()-(day-1));
  d.setUTCHours(0,0,0,0);
  return d;
}
function weeklyLeagueEnd(date=new Date()) {
  return new Date(weeklyLeagueStart(date).getTime()+7*86400000);
}
function weeklyLeagueSeed(info=weeklyLeagueIsoWeek()) {
  return info.year*53+info.week;
}
function weeklyLeagueDisciplines(info=weeklyLeagueIsoWeek()) {
  const seed=weeklyLeagueSeed(info);
  const n=WEEKLY_LEAGUE_TEMPLATES.length;
  const first=seed%n;
  const step=(seed%2)?2:1;
  const picks=[];
  for(let i=0;picks.length<3&&i<n*2;i++){
    const item=WEEKLY_LEAGUE_TEMPLATES[(first+i*step)%n];
    if(!picks.includes(item)) picks.push(item);
  }
  return picks;
}
function weeklyLeagueEntries(info=weeklyLeagueIsoWeek()) {
  const start=weeklyLeagueStart().getTime();
  const end=weeklyLeagueEnd().getTime();
  return (Array.isArray(matchHistory)?matchHistory:[]).filter(row=>{
    const at=Number(row?.at)||0;
    return at>=start&&at<end;
  });
}
function weeklyLeagueQuizScore(entry) {
  const m=String(entry?.targetName||"").match(/Score\s+(\d+)\s*\/\s*(\d+)/i);
  return m?Number(m[1])||0:0;
}
function weeklyLeagueMetric(template,entries=weeklyLeagueEntries()) {
  if(template.id==="daily"){
    const wins=entries.filter(e=>e.mode==="daily"&&e.result==="win").map(e=>Number(e.attempts)||0).filter(Boolean);
    const best=wins.length?Math.min(...wins):0;
    const score=!best?0:best<=3?200:best<=6?170:best<=10?120:80;
    return { value:best, display:best?best+" essai"+(best>1?"s":""):"—", complete:best>0&&best<=6, score };
  }
  if(template.id==="quiz"){
    const best=Math.max(0,...entries.filter(e=>e.mode==="quiz").map(weeklyLeagueQuizScore));
    return { value:best, display:best?best+"/10":"—", complete:best>=8, score:Math.min(200,best*20) };
  }
  if(template.id==="speedrun"){
    const best=Math.max(0,...entries.filter(e=>e.mode==="speedrun").map(e=>Number(e.attempts)||0));
    return { value:best, display:best?best+" trouvés":"—", complete:best>=12, score:Math.min(200,best*10) };
  }
  if(template.id==="higherlower"){
    const best=Math.max(0,...entries.filter(e=>e.mode==="higher-lower").map(e=>Number(e.attempts)||0));
    return { value:best, display:best?String(best):"—", complete:best>=8, score:Math.min(200,best*15) };
  }
  if(template.id==="odd"){
    const wins=entries.filter(e=>e.mode==="odd"&&e.result==="win").length;
    return { value:wins, display:wins?wins+" victoire"+(wins>1?"s":""):"—", complete:wins>=5, score:Math.min(200,wins*40) };
  }
  if(template.id==="weight"){
    const wins=entries.filter(e=>e.mode==="weight"&&e.result==="win").length;
    return { value:wins, display:wins?wins+" victoire"+(wins>1?"s":""):"—", complete:wins>=5, score:Math.min(200,wins*40) };
  }
  return {value:0,display:"—",complete:false,score:0};
}
function weeklyLeagueState(info=weeklyLeagueIsoWeek()) {
  const disciplines=weeklyLeagueDisciplines(info).map(template=>({template,metric:weeklyLeagueMetric(template)}));
  const score=disciplines.reduce((sum,row)=>sum+row.metric.score,0);
  const completed=disciplines.filter(row=>row.metric.complete).length;
  const badges=playerProfile?.weeklyLeagueBadges||{};
  return { info, disciplines, score, completed, mastered:completed===3, claimed:Boolean(badges[info.id]) };
}
function weeklyLeagueLeaderboardMode(info=weeklyLeagueIsoWeek()) {
  return "weekly_"+info.id;
}
function weeklyLeagueEnsureProfile() {
  if(!playerProfile) return;
  playerProfile.weeklyLeagueBadges ||= {};
  playerProfile.weeklyLeagueScores ||= {};
}
function weeklyLeagueSyncScore(state=weeklyLeagueState()) {
  weeklyLeagueEnsureProfile();
  const previous=Number(playerProfile?.weeklyLeagueScores?.[state.info.id])||0;
  if(playerProfile?.weeklyLeagueScores) playerProfile.weeklyLeagueScores[state.info.id]=Math.max(previous,state.score);
  if(state.score>previous){
    try { saveProfile(); } catch(_e) {}
    if(window.__pokedleAuthed && typeof submitLeaderboardResult==="function" && state.score>0){
      submitLeaderboardResult(weeklyLeagueLeaderboardMode(state.info),state.score);
    }
  }
}
function weeklyLeagueClaimBadge() {
  const state=weeklyLeagueState();
  if(!state.mastered||state.claimed) return false;
  weeklyLeagueEnsureProfile();
  playerProfile.weeklyLeagueBadges[state.info.id]={
    at:Date.now(),
    score:state.score,
    title:"Maître de Ligue · "+state.info.id
  };
  saveProfile();
  if(typeof gameFeelPlay==="function") gameFeelPlay("record");
  if(typeof showToast==="function") showToast("Badge de Ligue obtenu !");
  renderWeeklyLeagueHome();
  openWeeklyLeague();
  return true;
}
function weeklyLeagueTimeLeft() {
  const ms=Math.max(0,weeklyLeagueEnd().getTime()-Date.now());
  const days=Math.floor(ms/86400000);
  const hours=Math.floor((ms%86400000)/3600000);
  return days>0?days+" j "+hours+" h":hours+" h";
}
function weeklyLeagueLaunch(id) {
  closeOverlayModal?.();
  if(id==="daily") return startDailyGame();
  if(id==="quiz") return startQuizGame();
  if(id==="speedrun") return startSpeedrunGame();
  if(id==="higherlower") return startHigherLowerMode("infinite");
  if(id==="odd") return openOddOneOutMode();
  if(id==="weight") return startWeightBattle();
}
function weeklyLeagueCardHtml(row) {
  const {template,metric}=row;
  return '<article class="weekly-league-discipline '+(metric.complete?'is-complete':'')+'">'+
    '<div class="weekly-league-icon">'+template.icon+'</div>'+
    '<div class="weekly-league-discipline-copy"><span>'+escapeHtml(template.label.toUpperCase())+'</span><h4>'+escapeHtml(template.objective)+'</h4><p>'+escapeHtml(template.description)+'</p></div>'+
    '<div class="weekly-league-performance"><strong>'+escapeHtml(metric.display)+'</strong><small>'+metric.score+'/200 pts</small></div>'+
    '<button type="button" data-action="weeklyLeagueLaunch" data-args=\'["'+template.id+'"]\'>'+(metric.complete?'Améliorer':'Jouer')+' →</button>'+
  '</article>';
}
function openWeeklyLeague() {
  const state=weeklyLeagueState();
  weeklyLeagueSyncScore(state);
  const claim=state.mastered&&!state.claimed
    ? '<button type="button" class="btn-yellow weekly-league-claim" data-action="weeklyLeagueClaimBadge">Réclamer le badge de maîtrise</button>'
    : state.claimed?'<div class="weekly-league-earned">◆ BADGE DE LIGUE OBTENU</div>':'';
  ensureOverlay("Épreuve de Ligue",'<div class="weekly-league-modal">'+
    '<header class="weekly-league-modal-head"><div><span>SEMAINE '+String(state.info.week).padStart(2,"0")+'</span><h3>Épreuve de Ligue</h3><p>Trois disciplines. Une semaine. Ta maîtrise avant tout.</p></div><div class="weekly-league-score"><strong>'+state.score+'</strong><span>/ 600 pts</span></div></header>'+
    '<div class="weekly-league-progress"><progress value="'+state.completed+'" max="3"></progress><span>'+state.completed+'/3 objectifs maîtrisés · '+weeklyLeagueTimeLeft()+' restantes</span></div>'+
    '<div class="weekly-league-disciplines">'+state.disciplines.map(weeklyLeagueCardHtml).join("")+'</div>'+
    claim+
    '<div class="weekly-league-footer"><button type="button" class="btn-blue" data-action="openWeeklyLeagueRanking">Classement de la semaine →</button><small>Le badge récompense la maîtrise des 3 objectifs. Le classement récompense le meilleur score sur 600.</small></div>'+
  '</div>');
}
function weeklyLeagueRankRow(row,index) {
  const rank=Number(row?.rank)||index+1;
  const medal=rank===1?"🥇":rank===2?"🥈":rank===3?"🥉":"#"+rank;
  return '<div class="weekly-rank-row '+(row?.me?'is-me':'')+'"><span>'+medal+'</span><b>'+escapeHtml(row?.username||"Dresseur")+'</b><strong>'+Number(row?.score||0)+' pts</strong></div>';
}
function openWeeklyLeagueRanking() {
  const info=weeklyLeagueIsoWeek();
  const mode=weeklyLeagueLeaderboardMode(info);
  ensureOverlay("Ligue · Classement",'<div class="weekly-ranking-loading">Chargement du classement…</div>');
  fetch("/api/leaderboard?mode="+encodeURIComponent(mode)+"&scope=all",{credentials:"same-origin"})
    .then(r=>r.json()).then(data=>{
      const rows=Array.isArray(data?.top)?data.top:[];
      const me=data?.me;
      ensureOverlay("Ligue · Classement",'<div class="weekly-ranking">'+
        '<header><div><span>SEMAINE '+String(info.week).padStart(2,"0")+'</span><h3>Classement de Ligue</h3><p>Score cumulé des trois disciplines · maximum 600 pts.</p></div>'+(me?'<div class="weekly-ranking-me"><span>TA POSITION</span><strong>#'+Number(me.rank)+'</strong><small>'+Number(me.score)+' pts</small></div>':'')+'</header>'+
        (rows.length?'<div class="weekly-ranking-list">'+rows.map(weeklyLeagueRankRow).join("")+'</div>':'<div class="weekly-ranking-empty">Aucune performance enregistrée pour le moment.</div>')+
        '<button type="button" class="btn-ghost" data-action="openWeeklyLeague">← Retour à l’épreuve</button>'+
      '</div>');
    }).catch(()=>ensureOverlay("Ligue · Classement",'<div class="weekly-ranking-empty">Classement indisponible pour le moment.</div>'));
}
function renderWeeklyLeagueHome() {
  const daily=document.getElementById("daily-hero");
  if(!daily) return;
  let card=document.getElementById("weekly-league-home");
  if(!card){
    card=document.createElement("section");
    card.id="weekly-league-home";
    card.className="weekly-league-home";
    daily.insertAdjacentElement("afterend",card);
  }
  const state=weeklyLeagueState();
  weeklyLeagueSyncScore(state);
  const next=state.disciplines.find(row=>!row.metric.complete)||state.disciplines[0];
  card.innerHTML=
    '<div class="weekly-league-home-mark"><span>◆</span><small>ÉPREUVE<br>DE LIGUE</small></div>'+
    '<div class="weekly-league-home-copy"><span>SEMAINE '+String(state.info.week).padStart(2,"0")+' · '+weeklyLeagueTimeLeft()+'</span><h3>'+state.completed+'/3 disciplines maîtrisées</h3><p>Prochain objectif · '+escapeHtml(next.template.objective)+'</p></div>'+
    '<div class="weekly-league-home-score"><strong>'+state.score+'</strong><small>/600 pts</small><progress value="'+state.score+'" max="600"></progress></div>'+
    '<button type="button" class="'+(state.mastered&&!state.claimed?'btn-yellow':'btn-blue')+'" data-action="openWeeklyLeague">'+(state.mastered&&!state.claimed?'Badge prêt':'Voir l’épreuve')+' →</button>';
}
function weeklyLeagueAfterHistory(entry) {
  const state=weeklyLeagueState();
  weeklyLeagueSyncScore(state);
  renderWeeklyLeagueHome();
}
if(typeof recordMatchHistory==="function"){
  const recordMatchHistoryBeforeWeeklyLeague=recordMatchHistory;
  recordMatchHistory=function(entry){
    const result=recordMatchHistoryBeforeWeeklyLeague(entry);
    setTimeout(()=>weeklyLeagueAfterHistory(entry),0);
    return result;
  };
}
if(typeof goToConfig==="function"){
  const goToConfigBeforeWeeklyLeague=goToConfig;
  goToConfig=function(){
    const result=goToConfigBeforeWeeklyLeague.apply(this,arguments);
    setTimeout(renderWeeklyLeagueHome,0);
    return result;
  };
}
if(typeof window!=="undefined"&&window.addEventListener){
  window.addEventListener("DOMContentLoaded",()=>setTimeout(renderWeeklyLeagueHome,0));
}
window.openWeeklyLeague=openWeeklyLeague;
window.openWeeklyLeagueRanking=openWeeklyLeagueRanking;
window.weeklyLeagueLaunch=weeklyLeagueLaunch;
window.weeklyLeagueClaimBadge=weeklyLeagueClaimBadge;
