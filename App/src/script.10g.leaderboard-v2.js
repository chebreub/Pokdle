
// Results & Leaderboards V2 — time-scoped performance leaderboards and result integration.
const LEADERBOARD_V2_MODES = [
  ["dossier","Dossier du jour","Points, puis temps"],
  ["wordle","Wordle du jour","Moins d’essais = mieux"],
  ["daily","Pokémon du jour","Moins d’essais = mieux"],
  ["quiz","Quiz","Bonnes réponses"],
  ["speedrun","Speedrun","Pokémon trouvés"],
  ["higherlower","Higher / Lower","Meilleure série"],
  ["higherlower60","H/L 60s","Points"],
  ["intrus","Intrus","Meilleure série"],
  ["poids","Duel de poids","Meilleure série"],
  ["party","Party","Victoires"],
  ["typecombo","Combo types","Points"],
  ["draft","Draft Score","Moyenne BST"]
];
const LEADERBOARD_V2_SCOPES = [["today","Aujourd’hui"],["week","7 derniers jours"],["all","Records historiques"]];
let leaderboardV2Scope = "all";
let leaderboardV2LastMode = "daily";

function leaderboardV2IsDraft(mode) {
  return typeof mode === "string" && /^draft(?:_(?:all|[1-9]))?$/.test(mode);
}
function leaderboardV2ModeMeta(mode) {
  if (leaderboardV2IsDraft(mode)) return { label:"Draft Score", hint:"Moyenne BST", unit:"BST", direction:"desc" };
  const rows = {
    dossier:{label:"Dossier du jour",hint:"Points, puis temps",unit:"pts",direction:"desc"},
    wordle:{label:"Wordle du jour",hint:"Moins d’essais = mieux",unit:"essais",direction:"asc"},
    daily:{label:"Pokémon du jour",hint:"Moins d’essais = mieux",unit:"essais",direction:"asc"},
    quiz:{label:"Quiz",hint:"Bonnes réponses",unit:"bonnes réponses",direction:"desc"},
    speedrun:{label:"Speedrun",hint:"Pokémon trouvés",unit:"Pokémon",direction:"desc"},
    party:{label:"Party",hint:"Victoires",unit:"victoires",direction:"desc"},
    intrus:{label:"Intrus",hint:"Meilleure série",unit:"série",direction:"desc"},
    poids:{label:"Duel de poids",hint:"Meilleure série",unit:"série",direction:"desc"},
    higherlower:{label:"Higher / Lower",hint:"Meilleure série",unit:"série",direction:"desc"},
    higherlower60:{label:"H/L 60s",hint:"Points",unit:"pts",direction:"desc"},
    typecombo:{label:"Combo de types",hint:"Points",unit:"pts",direction:"desc"}
  };
  return rows[mode] || rows.quiz;
}
function leaderboardV2FormatScore(score, mode, unit) {
  const n = Number(score) || 0;
  if (mode === "daily" || mode === "wordle") return n + " essai" + (n > 1 ? "s" : "");
  if (leaderboardV2IsDraft(mode)) return n + " BST";
  if (mode === "quiz") return n + " bonne" + (n > 1 ? "s" : "");
  if (mode === "speedrun") return n + " Pokémon";
  if (mode === "higherlower60" || mode === "typecombo") return n + " pts";
  return n + (unit ? " " + unit : "");
}
// R1: validate both HTTP and application responses; a failed request is not an empty board.
async function leaderboardFetchJson(url, options = {}) {
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 10000) : null;
  try {
    const response = await fetch(url, { credentials:"same-origin", ...options, ...(controller ? { signal:controller.signal } : {}) });
    const data = await response.json();
    if (response.ok === false || !data || data.ok !== true) {
      const error = new Error("Classement indisponible");
      error.status = response.status || 0;
      throw error;
    }
    return data;
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}
function leaderboardWaitForSync(promise) {
  let timer;
  return Promise.race([Promise.resolve(promise),new Promise(resolve=>{timer=setTimeout(()=>resolve(false),5000);})])
    .finally(()=>clearTimeout(timer));
}
function leaderboardAccountId() {
  return typeof connectedAccountUser !== "undefined" && connectedAccountUser?.id
    ? String(connectedAccountUser.id) : "";
}
function leaderboardResultId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID() : Date.now().toString(36)+"-"+Math.random().toString(36).slice(2);
}
function submitLeaderboardResult(mode, score, options = {}) {
  if (!window.__pokedleAuthed) return Promise.resolve(false);
  const n = Number(score);
  if (!mode || !Number.isInteger(n) || n <= 0) return Promise.resolve(false);
  const body = { mode, score:n, resultId:options.resultId || leaderboardResultId() };
  // Daily is recorded by /api/daily/guess after the server observes the winning guess.
  if (mode === "dossier" || mode === "wordle") return Promise.resolve(false);
  if (mode === "daily") return Promise.resolve(false);
  return leaderboardFetchJson("/api/leaderboard/result", {
    method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)
  }).then(() => true).catch(() => false);
}
const DAILY_LEADERBOARD_SYNC_PREFIX="pokedle_lb_daily_sync_";
const dailyLeaderboardInFlight = new Map();
function leaderboardTodayKey() {
  try { if (typeof getDailyDateKey === "function") return getDailyDateKey(); } catch (_e) {}
  const d = new Date();
  return d.getUTCFullYear()+"-"+String(d.getUTCMonth()+1).padStart(2,"0")+"-"+String(d.getUTCDate()).padStart(2,"0");
}
function pendingDailyLeaderboardScore() {
  const entries = typeof matchHistory !== "undefined" && Array.isArray(matchHistory) ? matchHistory : [];
  const now = Date.now(), d = new Date(now);
  const today = leaderboardTodayKey();
  let best = 0;
  for (const entry of entries) {
    const at = Number(entry?.at), score = Number(entry?.attempts);
    if (entry?.mode !== "daily" || entry?.result !== "win" || !Number.isFinite(at) || at > now || (typeof getDailyDateKey === "function" ? getDailyDateKey(new Date(at)) : new Date(at).toISOString().slice(0,10)) !== today) continue;
    if (!Number.isInteger(score) || score < 1 || score > 1025) continue;
    if (!best || score < best) best = score;
  }
  return best;
}
function syncPendingDailyLeaderboard() {
  // Retained as a no-op for callers/UI compatibility. Historical browser state is
  // not trusted to backfill Daily rankings; new authenticated runs are server-owned.
  return Promise.resolve(false);
}

let leaderboardViewRequest = 0;
function leaderboardOwnsDialog(id) {
  const overlay = document.getElementById("overlay-modal");
  return id === leaderboardViewRequest && Boolean(overlay && !overlay.classList.contains("hidden") &&
    document.querySelector('#overlay-body [data-lb-request="'+id+'"]'));
}
function leaderboardUnrankedCopy(authenticated, pending) {
  if (!authenticated) return "Connecte-toi pour enregistrer ta position.";
  return pending ? "Ton résultat n’est pas encore enregistré. Réessaie la synchronisation."
    : "Aucune victoire enregistrée aujourd’hui pour ce compte.";
}

function leaderboardResultFromHistory(entry) {
  if (!entry || entry.result === "draw") return null;
  const mode = String(entry.mode || "");
  const win = entry.result === "win";
  if (mode === "daily") return win ? {mode:"daily",score:Number(entry.attempts)||0} : null;
  if (mode === "quiz") {
    const m=String(entry.targetName||"").match(/Score\s+(\d+)/i);
    return m ? {mode:"quiz",score:Number(m[1])} : null;
  }
  if (mode === "speedrun") return {mode:"speedrun",score:Number(entry.attempts)||0};
  if (mode === "higher-lower") return {mode:"higherlower",score:Number(entry.attempts)||0};
  if (mode === "higher-lower-rush") return {mode:"higherlower60",score:Number(entry.attempts)||0};
  if (mode === "party") {
    const m=String(entry.targetName||"").match(/^(\d+)\s+victoire/i);
    return m ? {mode:"party",score:Number(m[1])} : null;
  }
  if (mode === "odd" && win) return {mode:"intrus",score:(Number(playerProfile?.oddOneOutStreak)||0)+1};
  if (mode === "weight" && win) return {mode:"poids",score:(Number(playerProfile?.weightBattleStreak)||0)+1};
  return null;
}
function switchLeaderboardV2() {
  const mode=this?.dataset?.lbMode || "daily";
  openLeaderboardV2(mode,leaderboardV2Scope);
}
function switchLeaderboardScopeV2() {
  const scope=this?.dataset?.lbScope || "all";
  openLeaderboardV2(leaderboardV2LastMode,scope);
}
function leaderboardV2Avatar(row) {
  return row?.avatar
    ? '<img class="lbv2-avatar" src="'+escapeHtml(row.avatar)+'" alt="" />'
    : '<span class="lbv2-avatar lbv2-avatar-empty" aria-hidden="true">?</span>';
}
function leaderboardV2Row(row, fallbackRank, mode, unit, compact=false) {
  const rank=Number(row?.rank)||fallbackRank||0;
  const medal=rank===1?"🥇":rank===2?"🥈":rank===3?"🥉":"#"+rank;
  return '<div class="lbv2-row'+(row?.me?' is-me':'')+(rank<=3?' is-podium':'')+(compact?' is-compact':'')+'">'+
    '<span class="lbv2-rank">'+medal+'</span>'+
    leaderboardV2Avatar(row)+
    '<span class="lbv2-player"><b>'+escapeHtml(row?.username||"Dresseur")+'</b>'+(row?.me?'<small>TOI</small>':'')+'</span>'+
    '<strong>'+escapeHtml(leaderboardV2FormatScore(row?.score,mode,unit))+'</strong>'+
    '</div>';
}
function openLeaderboardV2(mode="daily",scope="all") {
  const DRAFT_GENS=[["draft_all","Tous"],["draft_1","G1"],["draft_2","G2"],["draft_3","G3"],["draft_4","G4"],["draft_5","G5"],["draft_6","G6"],["draft_7","G7"],["draft_8","G8"],["draft_9","G9"]];
  let current=String(mode||"daily");
  if (current==="draft") current="draft_all";
  const valid=LEADERBOARD_V2_MODES.some(([id])=>id===current || (id==="draft"&&leaderboardV2IsDraft(current)));
  if (!valid) current="daily";
  leaderboardV2LastMode=current;
  leaderboardV2Scope=LEADERBOARD_V2_SCOPES.some(([id])=>id===scope)?scope:"all";
  const meta=leaderboardV2ModeMeta(current);
  const requestedScope=leaderboardV2Scope;
  const requestId=++leaderboardViewRequest;

  const loading='<div class="lbv3-shell" data-lb-request="'+requestId+'"><div class="lbv3-loading"><span></span><p>Synchronisation du classement…</p></div></div>';
  ensureOverlay("Classements",loading);

  const syncTasks=[];
  if (current==="daily") syncTasks.push(Promise.resolve(syncPendingDailyLeaderboard()).catch(()=>false));
  const syncPromise=syncTasks.length ? Promise.all(syncTasks) : Promise.resolve([]);

  return syncPromise.then(()=>{
    if (!leaderboardOwnsDialog(requestId)) return null;
    return leaderboardFetchJson("/api/leaderboard?mode="+encodeURIComponent(current)+"&scope="+encodeURIComponent(requestedScope));
  }).then(data=>{
    if (!data || !leaderboardOwnsDialog(requestId)) return;
    const modeTabs=LEADERBOARD_V2_MODES.map(([id,label])=>{
      const active=id==="draft"?leaderboardV2IsDraft(current):id===current;
      const target=id==="draft"?"draft_all":id;
      return '<button type="button" class="lbv3-mode-tab'+(active?' is-active':'')+'" aria-pressed="'+active+'" data-action="switchLeaderboardV2" data-lb-mode="'+target+'">'+escapeHtml(label)+'</button>';
    }).join("");

    const scopeTabs=LEADERBOARD_V2_SCOPES.map(([id,label])=>
      '<button type="button" class="lbv3-scope-tab'+(id===leaderboardV2Scope?' is-active':'')+'" aria-pressed="'+(id===leaderboardV2Scope)+'" data-action="switchLeaderboardScopeV2" data-lb-scope="'+id+'">'+label+'</button>'
    ).join("");

    const genTabs=leaderboardV2IsDraft(current)
      ? '<div class="lbv3-gen-tabs">'+DRAFT_GENS.map(([id,label])=>
          '<button type="button" class="'+(id===current?'is-active':'')+'" data-action="switchLeaderboardV2" data-lb-mode="'+id+'">'+label+'</button>'
        ).join("")+'</div>'
      : '';

    const rows=Array.isArray(data?.top)?data.top:[];
    const topThree=rows.filter(row=>Number(row.rank)<=3).sort((a,b)=>[2,1,3].indexOf(Number(a.rank))-[2,1,3].indexOf(Number(b.rank)));
    const rest=rows.filter(row=>Number(row.rank)>3);

    const podiumHtml=topThree.length
      ? '<section class="lbv3-podium">'+topThree.map((row,i)=>{
          const rank=Number(row.rank)||i+1;
          const medal=rank===1?"🥇":rank===2?"🥈":"🥉";
          return '<article class="lbv3-podium-card rank-'+rank+(row.me?' is-me':'')+'">'+
            '<div class="lbv3-medal">'+medal+'</div>'+
            leaderboardV2Avatar(row)+
            '<div class="lbv3-podium-name"><b>'+escapeHtml(row.username||"Dresseur")+'</b>'+(row.me?'<small>TOI</small>':'')+'</div>'+
            '<strong>'+escapeHtml(leaderboardV2FormatScore(row.score,current,data.unit||meta.unit))+'</strong>'+
          '</article>';
        }).join("")+'</section>'
      : '';

    const listHtml=rest.length
      ? '<section class="lbv3-list">'+rest.map((row,i)=>leaderboardV2Row(row,i+4,current,data.unit||meta.unit)).join("")+'</section>'
      : '';

    const around=(Array.isArray(data?.around)?data.around:[]).filter(row=>!rows.some(top=>Number(top.rank)===Number(row.rank)&&top.username===row.username));
    const aroundHtml=around.length
      ? '<section class="lbv3-around"><div class="lbv3-section-title">AUTOUR DE TOI</div>'+around.map(row=>leaderboardV2Row(row,row.rank,current,data.unit||meta.unit,true)).join("")+'</section>'
      : '';

    let personalHtml='';
    if (data?.me) {
      personalHtml='<section class="lbv3-personal">'+
        '<div><span>TA POSITION</span><strong>#'+Number(data.me.rank)+'</strong></div>'+
        '<div><span>TA PERFORMANCE</span><strong>'+escapeHtml(leaderboardV2FormatScore(data.me.score,current,data.unit||meta.unit))+'</strong></div>'+
      '</section>';
    }

    const empty = !rows.length;
    const emptyHtml = empty
      ? '<section class="lbv3-empty"><div class="lbv3-empty-icon">🏆</div><h4>Pas encore de performance ici</h4><p>'+
        (requestedScope==="all"
          ? (window.__pokedleAuthed?'Aucun record enregistré pour ce mode.':'Connecte-toi pour enregistrer tes records.')
          : 'Aucune performance enregistrée sur cette période. Les records locaux antérieurs ne sont pas antidatés.')+
        '</p></section>'
      : '';

    const total=Number(data?.total)||0;
    const body='<div class="lbv3-shell">'+
      '<header class="lbv3-header">'+
        '<div class="lbv3-title"><span>À CHACUN SON RECORD</span><h3>'+escapeHtml(data?.label||meta.label)+'</h3><p>'+escapeHtml(meta.hint)+' · Meilleure performance par joueur.</p></div>'+
        '<div class="lbv3-stats"><b>'+total+'</b><span>joueur'+(total>1?'s':'')+' classé'+(total>1?'s':'')+'</span></div>'+
      '</header>'+
      '<div class="lbv3-controls"><div class="lbv3-scope-tabs">'+scopeTabs+'</div><div class="lbv3-mode-grid">'+modeTabs+'<button type="button" class="lbv3-mode-tab" data-action="openWeeklyLeagueRanking">Ligue · 3 disciplines</button></div></div>'+
      genTabs+
      '<div class="leaderboard-content"><div class="leaderboard-main">'+
      personalHtml+
      podiumHtml+
      listHtml+
      aroundHtml+
      emptyHtml+'</div>'+(typeof leaderboardLeagueAside === "function" ? leaderboardLeagueAside(data,current,requestedScope) : '')+'</div>'+
    '</div>';

    ensureOverlay("Classements",body);
  }).catch(()=>{
    if (!leaderboardOwnsDialog(requestId)) return;
    const args=escapeHtml(JSON.stringify([current,requestedScope]));
    ensureOverlay("Classements",'<div class="lbv3-shell"><section class="lbv3-empty" role="status"><div class="lbv3-empty-icon">!</div><h4>Classement indisponible</h4><p>Le serveur n’a pas confirmé le classement. Aucun résultat n’est effacé.</p><button type="button" class="btn-blue" data-action="openLeaderboardV2" data-args="'+args+'">Réessayer</button></section></div>');
  });
}
let leaderboardPreviewRequest = 0;
function renderWinLeaderboardPreview(mode) {
  const requestId = ++leaderboardPreviewRequest;
  const box=document.getElementById("win-box");
  if (!box || !["daily","normal"].includes(mode)) return Promise.resolve();
  let panel=document.getElementById("win-ranking-preview");
  if (!panel) {
    panel=document.createElement("section"); panel.id="win-ranking-preview"; panel.className="win-ranking-preview";
    const buttons=box.querySelector(".win-btns");
    if (buttons) box.insertBefore(panel,buttons); else box.appendChild(panel);
  }
  const link='<button type="button" class="btn-ghost" data-action="openLeaderboardV2" data-args="[&quot;daily&quot;,&quot;today&quot;]">Voir le classement →</button>';
  if (mode !== "daily") {
    panel.innerHTML='<div><span>CLASSEMENTS</span><b>Compare tes records sur les modes compétitifs.</b></div>'+link;
    return Promise.resolve();
  }
  const account=leaderboardAccountId();
  const current=()=>requestId===leaderboardPreviewRequest && document.getElementById("win-ranking-preview")===panel &&
    account===leaderboardAccountId() && (typeof gameMode === "undefined" || gameMode === mode);
  panel.innerHTML='<div class="win-rank-loading" role="status">Chargement de ta position du jour…</div>';
  return syncPendingDailyLeaderboard().then(()=>leaderboardFetchJson("/api/leaderboard?mode=daily&scope=today")).then(data=>{
    if (!current()) return;
    if (data.me) {
      const neighbors=(Array.isArray(data.around)?data.around:[]).slice(0,7);
      panel.innerHTML='<div class="win-rank-position"><span>CLASSEMENT DU JOUR</span><strong>#'+Number(data.me.rank)+'</strong><small>'+escapeHtml(leaderboardV2FormatScore(data.me.score,"daily","essais"))+' · '+(Number(data.total)||0)+' classés</small></div>'+(neighbors.length?'<div class="win-rank-neighbors" aria-label="Joueurs autour de toi">'+neighbors.map(row=>leaderboardV2Row(row,row.rank,"daily","essais",true)).join('')+'</div>':'')+link;
    } else {
      const authenticated = typeof data.authenticated === "boolean" ? data.authenticated : Boolean(window.__pokedleAuthed);
      panel.innerHTML='<div><span>CLASSEMENT DU JOUR</span><b>'+leaderboardUnrankedCopy(authenticated,pendingDailyLeaderboardScore()>0)+'</b></div>'+link;
    }
  }).catch(()=>{
    if (current()) panel.innerHTML='<div role="status"><span>CLASSEMENT DU JOUR</span><b>Classement indisponible. Tes essais validés restent sauvegardés.</b></div>'+link;
  });
}


if (typeof recordMatchHistory === "function") {
  const recordMatchHistoryBeforeLeaderboardV2=recordMatchHistory;
  recordMatchHistory=function(entry) {
    const performance=leaderboardResultFromHistory(entry);
    const result=recordMatchHistoryBeforeLeaderboardV2(entry);
    if (performance?.score>0) {
      const submission=entry.mode==="daily" ? syncPendingDailyLeaderboard() : submitLeaderboardResult(performance.mode,performance.score);
      submission.then(()=>{
        if (entry.mode==="daily") renderWinLeaderboardPreview("daily");
      });
    }
    return result;
  };
}
if (typeof enhanceGameOverBox === "function") {
  const enhanceGameOverBoxBeforeLeaderboardV2=enhanceGameOverBox;
  enhanceGameOverBox=function(options) {
    const result=enhanceGameOverBoxBeforeLeaderboardV2(options);
    renderWinLeaderboardPreview(options?.mode || gameMode);
    return result;
  };
}

window.submitLeaderboardResult=submitLeaderboardResult;
window.syncPendingDailyLeaderboard=syncPendingDailyLeaderboard;
try {
  window.addEventListener("pokedle:auth-ready",()=>{ syncPendingDailyLeaderboard(); });
  if (window.__pokedleAuthed) setTimeout(()=>syncPendingDailyLeaderboard(),0);
} catch (_e) {}
window.openLeaderboardV2=openLeaderboardV2;
window.switchLeaderboardV2=switchLeaderboardV2;
window.switchLeaderboardScopeV2=switchLeaderboardScopeV2;
window.openLeaderboard=openLeaderboardV2;
window.switchLeaderboard=switchLeaderboardV2;
try { openLeaderboard=openLeaderboardV2; switchLeaderboard=switchLeaderboardV2; } catch (_e) {}
