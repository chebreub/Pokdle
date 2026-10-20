
// Weekly League V1 — recurring skill event shared by all players.
const WEEKLY_LEAGUE_SYNCED = new Map();
const WEEKLY_LEAGUE_TEMPLATES = Object.freeze([
  { id:"daily", label:"Précision", mode:"daily", icon:"◎", description:"Résous le Pokémon du jour avec le moins d'essais possible.", objective:"Réussir en 6 essais ou moins", action:"startDailyGame" },
  { id:"quiz", label:"Connaissance", mode:"quiz", icon:"?", description:"Fais parler ta culture Pokémon au Quiz.", objective:"Atteindre 12/15 au Quiz", action:"startQuizGame" },
  { id:"speedrun", label:"Réflexes", mode:"speedrun", icon:"⚡", description:"Enchaîne les Pokémon avant la fin du chrono.", objective:"Trouver 12 Pokémon au Speedrun", action:"startSpeedrunGame" },
  { id:"higherlower", label:"Instinct", mode:"higher-lower", icon:"↕", description:"Construis une série solide à Higher or Lower.", objective:"Atteindre une série de 8", action:"startHigherLowerMode" },
  { id:"odd", label:"Observation", mode:"odd", icon:"◇", description:"Repère les intrus sans te faire piéger.", objective:"Gagner 5 énigmes Intrus", action:"openOddOneOutMode" },
  { id:"weight", label:"Mesure", mode:"weight", icon:"◆", description:"Compare les poids et enchaîne les bons choix.", objective:"Gagner 5 Duels de poids", action:"startWeightBattle" }
]);

// The League week follows Paris time, like every other game of the day: it starts
// on Monday at 00:00 in Paris, not at 00:00 UTC (22:00 or 23:00 on Sunday in Paris).
function weeklyLeagueParisDate(date=new Date()) {
  const p=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date).map(x=>[x.type,x.value]));
  return new Date(Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day)));
}
// Instant of 00:00 in Paris on the calendar day held (at 00:00 UTC) by day.
function weeklyLeagueParisMidnight(day) {
  const nominal=day.getTime();let instant=nominal;
  for(let i=0;i<3;i++){
    const p=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(new Date(instant)).map(x=>[x.type,x.value]));
    instant=nominal-(Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day),Number(p.hour),Number(p.minute),Number(p.second))-instant);
  }
  return new Date(instant);
}
function weeklyLeagueIsoWeek(date=new Date()) {
  const d=weeklyLeagueParisDate(date);
  const day=d.getUTCDay()||7;
  d.setUTCDate(d.getUTCDate()+4-day);
  const yearStart=new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const week=Math.ceil((((d-yearStart)/86400000)+1)/7);
  return { year:d.getUTCFullYear(), week, id:d.getUTCFullYear()+"-W"+String(week).padStart(2,"0") };
}
function weeklyLeagueStart(date=new Date()) {
  const d=weeklyLeagueParisDate(date);
  const day=d.getUTCDay()||7;
  d.setUTCDate(d.getUTCDate()-(day-1));
  return weeklyLeagueParisMidnight(d);
}
function weeklyLeagueEnd(date=new Date()) {
  const d=weeklyLeagueParisDate(date);
  const day=d.getUTCDay()||7;
  d.setUTCDate(d.getUTCDate()-(day-1)+7);
  return weeklyLeagueParisMidnight(d);
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
    // The log is shared by every account used in this browser: never count another account's games.
    return at>=start&&at<end&&(typeof matchHistoryBelongsToCurrent!=="function"||matchHistoryBelongsToCurrent(row));
  });
}
function weeklyLeagueQuizScore(entry) {
  const m=String(entry?.targetName||"").match(/Score\s+(\d+)\s*\/\s*(\d+)/i);
  return m&&Number(m[2])===15?Number(m[1])||0:0;
}
// Daily keeps the fewest attempts; every other discipline keeps the highest value.
function weeklyLeagueLowerIsBetter(template) {
  return template.id==="daily";
}
function weeklyLeagueEntryValue(template,e) {
  if(template.id==="daily") return e.mode==="daily"&&e.result==="win"&&e.dailyAccountId&&e.dailyAccountId===String(connectedAccountUser?.id||"")?Number(e.attempts)||0:0;
  if(template.id==="quiz") return e.mode==="quiz"?weeklyLeagueQuizScore(e):0;
  if(template.id==="speedrun") return e.mode==="speedrun"?Number(e.attempts)||0:0;
  if(template.id==="higherlower") return e.mode==="higher-lower"?Number(e.attempts)||0:0;
  if(template.id==="odd"||template.id==="weight") return e.mode===template.mode&&e.result==="win"?1:0;
  return 0;
}
function weeklyLeagueCountsWins(template) {
  return template.id==="odd"||template.id==="weight";
}
function weeklyLeagueBetter(template,a,b) {
  if(!a) return b||0;
  if(!b) return a;
  return weeklyLeagueLowerIsBetter(template)?Math.min(a,b):Math.max(a,b);
}
function weeklyLeagueLogValue(template,entries) {
  const values=entries.map(e=>weeklyLeagueEntryValue(template,e)).filter(Boolean);
  if(weeklyLeagueCountsWins(template)) return values.length;
  return values.reduce((best,value)=>weeklyLeagueBetter(template,best,value),0);
}
function weeklyLeagueMetricFromValue(template,best) {
  if(template.id==="daily"){
    const score=!best?0:best<=3?200:best<=6?170:best<=10?120:80;
    return { value:best, display:best?best+" essai"+(best>1?"s":""):"—", complete:best>0&&best<=6, score };
  }
  if(template.id==="quiz") return { value:best, display:best?best+"/15":"—", complete:best>=12, score:Math.min(200,Math.round(best*200/15)) };
  if(template.id==="speedrun") return { value:best, display:best?best+" trouvés":"—", complete:best>=12, score:Math.min(200,best*10) };
  if(template.id==="higherlower") return { value:best, display:best?String(best):"—", complete:best>=8, score:Math.min(200,best*15) };
  if(weeklyLeagueCountsWins(template)) return { value:best, display:best?best+" victoire"+(best>1?"s":""):"—", complete:best>=5, score:Math.min(200,best*40) };
  return {value:0,display:"—",complete:false,score:0};
}
// The week's results live in the profile (synced with the account), not only in the 120-game log:
// a long Intrus or Duel de poids session can push this week's games out of that log.
function weeklyLeagueWeekStats(info=weeklyLeagueIsoWeek()) {
  // Before the account is known, the shared log cannot be attributed: show it, store nothing.
  if(!playerProfile||(typeof window!=="undefined"&&!window.__pokedleAccountKnown)) return null;
  weeklyLeagueEnsureProfile();
  const all=playerProfile.weeklyLeagueStats;
  if(!all[info.id]||typeof all[info.id]!=="object"){
    // First visit of the week: start from the games already in the log, then count each new one.
    const entries=weeklyLeagueEntries(info),seeded={};
    for(const template of WEEKLY_LEAGUE_TEMPLATES){const value=weeklyLeagueLogValue(template,entries);if(value)seeded[template.id]=value;}
    all[info.id]=seeded;
    for(const old of Object.keys(all).sort().slice(0,-12)) delete all[old];
  }
  return all[info.id];
}
function weeklyLeagueRecord(entry,info=weeklyLeagueIsoWeek()) {
  if(!playerProfile||!entry||(typeof matchHistoryBelongsToCurrent==="function"&&!matchHistoryBelongsToCurrent(entry))) return false;
  const existed=Boolean(playerProfile.weeklyLeagueStats?.[info.id]);
  const stats=weeklyLeagueWeekStats(info);
  if(!stats) return false;
  if(!existed) return true; // the seed already includes this game
  let changed=false;
  for(const template of WEEKLY_LEAGUE_TEMPLATES){
    const value=weeklyLeagueEntryValue(template,entry);
    if(!value) continue;
    const previous=Number(stats[template.id])||0;
    const next=weeklyLeagueCountsWins(template)?previous+1:weeklyLeagueBetter(template,previous,value);
    if(next!==previous){stats[template.id]=next;changed=true;}
  }
  return changed;
}
function weeklyLeagueMetric(template,entries) {
  // Explicit entries: score exactly those games. Default: this week's log combined with the saved week.
  if(entries) return weeklyLeagueMetricFromValue(template,weeklyLeagueLogValue(template,entries));
  const logValue=weeklyLeagueLogValue(template,weeklyLeagueEntries());
  const stored=Number(weeklyLeagueWeekStats()?.[template.id])||0;
  return weeklyLeagueMetricFromValue(template,weeklyLeagueCountsWins(template)?Math.max(logValue,stored):weeklyLeagueBetter(template,logValue,stored));
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
  playerProfile.weeklyLeagueStats ||= {};
}
function weeklyLeagueSyncScore(state=weeklyLeagueState()) {
  weeklyLeagueEnsureProfile();
  const previous=Number(playerProfile?.weeklyLeagueScores?.[state.info.id])||0;
  if(playerProfile?.weeklyLeagueScores) playerProfile.weeklyLeagueScores[state.info.id]=Math.max(previous,state.score);
  if(state.score>previous){
    try { saveProfile(); } catch(_e) {}
  }
  const mode=weeklyLeagueLeaderboardMode(state.info);
  const synced=Number(WEEKLY_LEAGUE_SYNCED.get(mode))||0;
  if(window.__pokedleAuthed && typeof submitLeaderboardResult==="function" && state.score>0 && state.score>synced){
    WEEKLY_LEAGUE_SYNCED.set(mode,state.score);
    submitLeaderboardResult(mode,state.score).then(ok=>{
      if(!ok) WEEKLY_LEAGUE_SYNCED.delete(mode);
    });
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
  if(id==="speedrun") { openSpeedrunMode();return startSpeedrunGame(); }
  if(id==="higherlower") { openHigherLowerMode();return startHigherLowerMode("infinite"); }
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
    : state.claimed?'<div class="weekly-league-earned">'+leagueMedalSvg(leagueMedalTier(playerProfile?.weeklyLeagueBadges?.[state.info.id]?.score),state.info.week,"m"+state.info.id)+'<span>BADGE '+escapeHtml(LEAGUE_MEDAL_TIERS[leagueMedalTier(playerProfile?.weeklyLeagueBadges?.[state.info.id]?.score)].label.toUpperCase())+' OBTENU</span></div>':'';
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
  ensureOverlay("Ligue · Classement",skeletonHtml('Chargement du classement…','rows',5));
  fetch("/api/leaderboard?mode="+encodeURIComponent(mode)+"&scope=all",{credentials:"same-origin"})
    .then(r=>r.json()).then(data=>{
      const rows=Array.isArray(data?.top)?data.top:[];
      const me=data?.me;
      ensureOverlay("Ligue · Classement",'<div class="weekly-ranking">'+
        '<div class="weekly-ranking-head"><div><span>SEMAINE '+String(info.week).padStart(2,"0")+'</span><h3>Classement de Ligue</h3><p>Score cumulé des trois disciplines · maximum 600 pts.</p></div>'+(me?'<div class="weekly-ranking-me"><span>TA POSITION</span><strong>#'+Number(me.rank)+'</strong><small>'+Number(me.score)+' pts</small></div>':'')+'</div>'+
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
  }
  const pathways=document.querySelector("#screen-config .home-pathways");
  const anchor=pathways||daily;
  if(anchor.nextElementSibling!==card) anchor.insertAdjacentElement("afterend",card);
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
  if(weeklyLeagueRecord(entry)){try { saveProfile(); } catch(_e) {}}
  const state=weeklyLeagueState();
  weeklyLeagueSyncScore(state);
  renderWeeklyLeagueHome();
}
if(typeof recordMatchHistory==="function"){
  const recordMatchHistoryBeforeWeeklyLeague=recordMatchHistory;
  recordMatchHistory=function(entry){
    const result=recordMatchHistoryBeforeWeeklyLeague(entry);
    // The stored row carries the resolved mode, date and account of this game.
    const row=Array.isArray(matchHistory)&&matchHistory[0]?matchHistory[0]:entry;
    setTimeout(()=>weeklyLeagueAfterHistory(row),0);
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
  // The Daily discipline and the saved week depend on the account: redraw once it is known.
  window.addEventListener("pokedle:account-known",()=>setTimeout(renderWeeklyLeagueHome,0));
}
// Profile showcase: one badge per mastered week, newest first, with its date and score.
// League medals: the week's score sets the rank (600 = Maître), drawn as a real medal.
const LEAGUE_MEDAL_TIERS={
  master:{label:"Maître",title:"Maître de Ligue",rim:["#fff1a8","#ffb3e6","#a9c8ff","#9ff0d0"],face:["#ffffff","#f4ecff"],ribbon:["#7b5cff","#ff6fb1"],ink:"#4b2f91"},
  gold:{label:"Or",title:"Badge Or",rim:["#fff4b0","#f0c23a","#c98a0b"],face:["#fffbe6","#ffe9a3"],ribbon:["#e0483f","#2f76ff"],ink:"#7a5300"},
  silver:{label:"Argent",title:"Badge Argent",rim:["#ffffff","#cfd8e3","#8e9bab"],face:["#ffffff","#e9eef5"],ribbon:["#2f76ff","#5bc0eb"],ink:"#3b4a5c"},
  bronze:{label:"Bronze",title:"Badge Bronze",rim:["#ffd9b0","#d18a4a","#8f4f1f"],face:["#fff4ea","#f6d7bd"],ribbon:["#3d9b5f","#8ac926"],ink:"#6b3a14"}
};
function leagueMedalTier(score){const n=Number(score)||0;return n>=600?"master":n>=540?"gold":n>=450?"silver":"bronze";}
function leagueMedalSvg(tierKey,week,uid){
  const t=LEAGUE_MEDAL_TIERS[tierKey]||LEAGUE_MEDAL_TIERS.bronze,id="lm"+String(uid).replace(/[^a-z0-9]/gi,"");
  const stops=list=>list.map((c,i)=>'<stop offset="'+Math.round(i*100/Math.max(1,list.length-1))+'%" stop-color="'+c+'"/>').join("");
  // A laurel of seven leaves on each side of the face.
  const leaves=[0,1,2,3,4,5,6].map(i=>{const a=(200+i*20)*Math.PI/180,x=60+31*Math.cos(a),y=60+31*Math.sin(a),r=(200+i*20)+90;
    return '<ellipse cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" rx="2.6" ry="6" transform="rotate('+r+' '+x.toFixed(1)+' '+y.toFixed(1)+')"/><ellipse cx="'+(120-x).toFixed(1)+'" cy="'+y.toFixed(1)+'" rx="2.6" ry="6" transform="rotate('+(-r)+' '+(120-x).toFixed(1)+' '+y.toFixed(1)+')"/>';}).join("");
  return '<svg class="league-medal" viewBox="0 0 120 150" aria-hidden="true"><defs>'+
    '<linearGradient id="'+id+'r" x1="0" y1="0" x2="1" y2="1">'+stops(t.rim)+'</linearGradient>'+
    '<radialGradient id="'+id+'f" cx="50%" cy="35%" r="70%">'+stops(t.face)+'</radialGradient>'+
    '<linearGradient id="'+id+'b" x1="0" y1="0" x2="1" y2="0">'+stops(t.ribbon)+'</linearGradient></defs>'+
    '<path d="M38 88 L24 146 L40 136 L50 148 L60 98 Z" fill="url(#'+id+'b)"/><path d="M82 88 L96 146 L80 136 L70 148 L60 98 Z" fill="url(#'+id+'b)" opacity=".85"/>'+
    '<circle cx="60" cy="60" r="48" fill="url(#'+id+'r)"/><circle cx="60" cy="60" r="48" fill="none" stroke="rgba(0,0,0,.12)" stroke-width="1.5"/>'+
    '<circle cx="60" cy="60" r="39" fill="url(#'+id+'f)" stroke="url(#'+id+'r)" stroke-width="3"/>'+
    '<g fill="'+t.ink+'" opacity=".55">'+leaves+'</g>'+
    '<path d="M60 26 l3.2 6.5 7.2 1 -5.2 5 1.2 7.1 -6.4 -3.4 -6.4 3.4 1.2 -7.1 -5.2 -5 7.2 -1z" fill="'+t.ink+'" opacity=".9"/>'+
    '<text x="60" y="60" text-anchor="middle" font-family="Nunito, sans-serif" font-size="8" font-weight="900" letter-spacing="1.5" fill="'+t.ink+'">SEMAINE</text>'+
    '<text x="60" y="84" text-anchor="middle" font-family="Fredoka, Nunito, sans-serif" font-size="26" font-weight="700" fill="'+t.ink+'">'+escapeHtml(String(week))+'</text>'+
    '<ellipse class="league-medal-shine" cx="44" cy="38" rx="16" ry="7" fill="#fff" opacity=".45" transform="rotate(-30 44 38)"/></svg>';
}
function leagueBadgeShowcaseHtml() {
  const badges=Object.entries(playerProfile?.weeklyLeagueBadges||{}).filter(([,b])=>b&&typeof b==="object").sort((a,b)=>(Number(b[1].at)||0)-(Number(a[1].at)||0));
  if(!badges.length) return '<p class="league-badges-empty">Aucun badge pour l’instant. Remplis les 3 épreuves de la Ligue de la semaine pour gagner le premier : Bronze, Argent, Or… ou Maître avec 600 points.</p><button type="button" class="btn-blue" data-action="openWeeklyLeague">Voir la Ligue de la semaine →</button>';
  return '<ul class="league-badges">'+badges.map(([id,badge])=>{
    const [year,week]=String(id).split("-W"),weekNo=String(Number(week)||week||"?"),tierKey=leagueMedalTier(badge.score),tier=LEAGUE_MEDAL_TIERS[tierKey];
    const at=Number(badge.at)?new Date(Number(badge.at)).toLocaleDateString("fr-FR",{day:"numeric",month:"long"}):"";
    return '<li class="league-badge tier-'+tierKey+'">'+leagueMedalSvg(tierKey,weekNo,id)+'<span class="league-badge-rank">'+escapeHtml(tier.label)+'</span><b>'+escapeHtml(tier.title)+'</b><small>Semaine '+escapeHtml(weekNo)+' · '+escapeHtml(year||"")+'</small>'+(Number(badge.score)?'<small class="league-badge-score">'+Number(badge.score)+' / 600 pts</small>':'')+(at?'<small>obtenu le '+escapeHtml(at)+'</small>':'')+'</li>';
  }).join('')+'</ul>';
}
function renderLeagueBadgeShowcase() {
  const records=document.querySelector("#screen-profile .profile-records-panel");
  if(!records) return;
  let panel=document.getElementById("profile-league-badges");
  if(!panel){
    panel=document.createElement("details");panel.id="profile-league-badges";panel.className="profile-panel profile-disclosure league-badges-panel";panel.open=true;
    panel.innerHTML='<summary><span>◆ Badges de Ligue</span><small id="profile-league-badges-count"></small></summary><div class="profile-disclosure-body" id="profile-league-badges-body"></div>';
    records.parentNode.insertBefore(panel,records);
  }
  const count=Object.keys(playerProfile?.weeklyLeagueBadges||{}).length;
  document.getElementById("profile-league-badges-count").textContent=count?count+" badge"+(count>1?"s":"")+" de maîtrise":"Tes semaines de Ligue réussies";
  document.getElementById("profile-league-badges-body").innerHTML=leagueBadgeShowcaseHtml();
}
if(typeof renderProfileScreen==="function"){
  const renderProfileBeforeBadges=renderProfileScreen;
  renderProfileScreen=function(){const value=renderProfileBeforeBadges.apply(this,arguments);renderLeagueBadgeShowcase();return value;};
}
window.openWeeklyLeague=openWeeklyLeague;
window.openWeeklyLeagueRanking=openWeeklyLeagueRanking;
window.weeklyLeagueLaunch=weeklyLeagueLaunch;
window.weeklyLeagueClaimBadge=weeklyLeagueClaimBadge;
