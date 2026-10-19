
// Results & Leaderboards V2 — time-scoped performance leaderboards and result integration.
// The day's boards come first, in the order of the day and all in points.
const LEADERBOARD_V2_DAY_MODES = [
  ["journey","Global du jour","Total de tes 4 épreuves du jour"],
  ["enquete","Enquête","Points"],
  ["wordlepts","Wordle","Points"],
  ["dossier","Dossier","Points, puis temps"],
  ["challenge","Défi","Points, puis temps"],
  ["grid","Grille","Cases, puis originalité"],
  ["petitbacday","Petit Bac","Bonnes réponses, puis originalité"]
];
// Arcade games keep their own record and unit, under "Autres classements".
const LEADERBOARD_V2_OTHER_MODES = [
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
const LEADERBOARD_V2_MODES = LEADERBOARD_V2_DAY_MODES.concat(LEADERBOARD_V2_OTHER_MODES);
// Old links to the attempt boards open the same stage in points.
const LEADERBOARD_V2_ALIASES = { daily:"enquete", wordle:"wordlepts" };
// One colour per stage of the day (background, ink).
const LEADERBOARD_V2_TONES = { journey:["#C9B6F5","#4B3291"], enquete:["#FFD45C","#6B4C00"], wordlepts:["#8FC8FF","#1F5288"], dossier:["#F7A8C8","#8E1F4D"], challenge:["#86D9B0","#17583A"], grid:["#FFC48C","#7A3E00"], petitbacday:["#9FD8CB","#1F6B5E"] };
const LEADERBOARD_V2_SCOPES = [["today","Aujourd’hui"],["week","7 derniers jours"],["all","Records historiques"]];
let leaderboardV2Scope = "all";
let leaderboardV2LastMode = "daily";

function leaderboardV2IsDraft(mode) {
  return typeof mode === "string" && /^draft(?:_(?:all|[1-9]))?$/.test(mode);
}
function leaderboardV2ModeMeta(mode) {
  if (leaderboardV2IsDraft(mode)) return { label:"Draft Score", hint:"Moyenne BST", unit:"BST", direction:"desc" };
  const rows = {
    journey:{label:"Global du jour",hint:"Total de tes 4 épreuves du jour : Enquête + Wordle + Dossier + Défi",unit:"pts",direction:"desc"},
    enquete:{label:"Enquête du jour",hint:"Moins d’essais, puis moins d’indices, puis le temps",unit:"pts",direction:"desc"},
    wordlepts:{label:"Wordle du jour",hint:"Moins d’essais, puis le temps",unit:"pts",direction:"desc"},
    challenge:{label:"Défi du jour",hint:"Points, puis temps",unit:"pts",direction:"desc"},
    grid:{label:"Grille du jour",hint:"Bonus du jour : cases trouvées, puis originalité, puis temps",unit:"pts",direction:"desc"},
    petitbacday:{label:"Petit Bac du jour",hint:"Bonus du jour : bonnes réponses, puis originalité, puis temps",unit:"pts",direction:"desc"},
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
  if (mode === "dossier" || mode === "wordle" || mode === "grid" || mode === "petitbacday") return Promise.resolve(false);
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
// The leaderboard is a page (#classement); the overlay only serves pages without it.
function leaderboardV2Surface() {
  const page = document.getElementById("screen-leaderboard"), body = document.getElementById("leaderboard-page-body");
  return page && body ? { page, body } : null;
}
function leaderboardV2Show(html) {
  const surface = leaderboardV2Surface();
  if (!surface) return ensureOverlay("Classements", html);
  const overlay = document.getElementById("overlay-modal");
  if (overlay && !overlay.classList.contains("hidden") && typeof closeOverlayModal === "function") closeOverlayModal();
  if (surface.page.classList.contains("hidden")) { showScreen("screen-leaderboard"); window.scrollTo(0, 0); }
  if (typeof setGlobalNavActive === "function") setGlobalNavActive("leaderboard");
  surface.body.innerHTML = html;
}
function leaderboardOwnsDialog(id) {
  const surface = leaderboardV2Surface();
  if (surface) return id === leaderboardViewRequest && !surface.page.classList.contains("hidden") && Boolean(surface.body.querySelector('[data-lb-request="'+id+'"]'));
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
// Points come first; the detail behind them follows ("3 essais · 1 indice", "2/6").
function leaderboardV2Detail(row, mode) {
  const attempts = Number(row?.attempts);
  if (!(attempts > 0)) return "";
  if (mode === "wordlepts") return attempts + "/6";
  if (mode !== "enquete") return "";
  const hints = Number(row?.hints) || 0;
  return attempts + " essai" + (attempts > 1 ? "s" : "") + (hints ? " · " + hints + " indice" + (hints > 1 ? "s" : "") : "");
}
function leaderboardV2ScoreHtml(row, mode, unit) {
  const detail = leaderboardV2Detail(row, mode);
  return escapeHtml(leaderboardV2FormatScore(row?.score, mode, unit)) + (detail ? '<small class="lbv2-detail">' + escapeHtml(detail) + "</small>" : "");
}
// The player's partner Pokémon first, then their account picture, then a Poké Ball.
const LEADERBOARD_V2_DEFAULT_AVATAR = "https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/items/poke-ball.png";
function leaderboardV2Avatar(row) {
  const partner = row?.partnerId && typeof POKEMON_BY_ID !== "undefined" ? POKEMON_BY_ID.get(Number(row.partnerId)) : null;
  if (partner) return '<img class="lbv2-avatar is-partner'+(typeof pokemonIsRare === "function" && pokemonIsRare(partner)?' is-rare':'')+'" src="'+escapeHtml(getPokemonSprite(partner))+'" alt="" title="'+escapeHtml(partner.name)+'" loading="lazy" />';
  return row?.avatar
    ? '<img class="lbv2-avatar" src="'+escapeHtml(row.avatar)+'" alt="" loading="lazy" />'
    : '<img class="lbv2-avatar is-default" src="'+LEADERBOARD_V2_DEFAULT_AVATAR+'" alt="" loading="lazy" />';
}
// Arcade boards with nobody ranked on the period are hidden; null keeps them all.
function leaderboardV2ArcadeCounts(scope) {
  return leaderboardFetchJson("/api/leaderboard/counts?scope="+encodeURIComponent(scope)).then(data=>data?.counts||null).catch(()=>null);
}
function leaderboardV2Row(row, fallbackRank, mode, unit, compact=false) {
  const rank=Number(row?.rank)||fallbackRank||0;
  const medal=rank===1?"🥇":rank===2?"🥈":rank===3?"🥉":"#"+rank;
  return '<div class="lbv2-row'+(row?.me?' is-me':'')+(rank<=3?' is-podium':'')+(compact?' is-compact':'')+'">'+
    '<span class="lbv2-rank">'+medal+'</span>'+
    leaderboardV2Avatar(row)+
    '<span class="lbv2-player"><b>'+escapeHtml(row?.username||"Dresseur")+'</b>'+(row?.me?'<small>TOI</small>':'')+'</span>'+
    '<strong>'+leaderboardV2ScoreHtml(row,mode,unit)+'</strong>'+
    '</div>';
}
function openLeaderboardV2(mode="journey",scope="today") {
  const DRAFT_GENS=[["draft_all","Tous"],["draft_1","G1"],["draft_2","G2"],["draft_3","G3"],["draft_4","G4"],["draft_5","G5"],["draft_6","G6"],["draft_7","G7"],["draft_8","G8"],["draft_9","G9"]];
  let current=String(mode||"journey");
  if (LEADERBOARD_V2_ALIASES[current]) current=LEADERBOARD_V2_ALIASES[current];
  if (current==="draft") current="draft_all";
  const valid=LEADERBOARD_V2_MODES.some(([id])=>id===current || (id==="draft"&&leaderboardV2IsDraft(current)));
  if (!valid) current="journey";
  leaderboardV2LastMode=current;
  leaderboardV2Scope=LEADERBOARD_V2_SCOPES.some(([id])=>id===scope)?scope:"today";
  const meta=leaderboardV2ModeMeta(current);
  const requestedScope=leaderboardV2Scope;
  const requestId=++leaderboardViewRequest;

  const loading='<div class="lbv3-shell" data-lb-request="'+requestId+'">'+skeletonHtml('Synchronisation du classement…','rows',6,'lbv3-skeleton')+'</div>';
  leaderboardV2Show(loading);

  const syncTasks=[];
  if (["enquete","journey"].includes(current)) syncTasks.push(Promise.resolve(syncPendingDailyLeaderboard()).catch(()=>false));
  const syncPromise=syncTasks.length ? Promise.all(syncTasks) : Promise.resolve([]);

  return syncPromise.then(()=>{
    if (!leaderboardOwnsDialog(requestId)) return null;
    return Promise.all([
      leaderboardFetchJson("/api/leaderboard?mode="+encodeURIComponent(current)+"&scope="+encodeURIComponent(requestedScope)),
      leaderboardV2ArcadeCounts(requestedScope)
    ]);
  }).then(result=>{
    const [data,counts]=result||[];
    if (!data || !leaderboardOwnsDialog(requestId)) return;
    const isActive=id=>id==="draft"?leaderboardV2IsDraft(current):id===current;
    const modeTab=([id,label])=>{
      const active=isActive(id),target=id==="draft"?"draft_all":id,tone=LEADERBOARD_V2_TONES[id];
      return '<button type="button" class="lbv3-mode-tab'+(tone?' is-day':'')+(active?' is-active':'')+'"'+(tone?' style="--lb-tone:'+tone[0]+';--lb-ink:'+tone[1]+'"':'')+' aria-pressed="'+active+'" data-action="switchLeaderboardV2" data-lb-mode="'+target+'">'+escapeHtml(label)+'</button>';
    };
    const dayTabs=LEADERBOARD_V2_DAY_MODES.map(modeTab).join("");
    const otherOpen=LEADERBOARD_V2_OTHER_MODES.some(([id])=>isActive(id));
    const otherModes=LEADERBOARD_V2_OTHER_MODES.filter(([id])=>!counts||isActive(id)||Number(counts[id])>0);
    const modeTabs='<details class="lbv3-other"'+(otherOpen?' open':'')+'><summary>Autres classements <small>records des jeux d’arcade</small></summary><div class="lbv3-mode-grid">'+
      otherModes.map(modeTab).join("")+'<button type="button" class="lbv3-mode-tab" data-action="openWeeklyLeagueRanking">Ligue · 3 disciplines</button></div>'+
      (otherModes.length?'':'<p class="lbv3-other-empty">Aucun record d’arcade sur cette période.</p>')+'</details>';

    const scopeTabs=LEADERBOARD_V2_SCOPES.map(([id,label])=>
      '<button type="button" class="lbv3-scope-tab'+(id===leaderboardV2Scope?' is-active':'')+'" aria-pressed="'+(id===leaderboardV2Scope)+'" data-action="switchLeaderboardScopeV2" data-lb-scope="'+id+'">'+label+'</button>'
    ).join("");

    const genTabs=leaderboardV2IsDraft(current)
      ? '<div class="lbv3-gen-tabs">'+DRAFT_GENS.map(([id,label])=>
          '<button type="button" class="'+(id===current?'is-active':'')+'" data-action="switchLeaderboardV2" data-lb-mode="'+id+'">'+label+'</button>'
        ).join("")+'</div>'
      : '';

    const rows=Array.isArray(data?.top)?data.top:[];
    // Below three ranked players a podium is mostly empty: show a plain list and
    // invite the player to take one of the free places instead.
    const smallAudience=rows.length>0&&rows.length<3;
    const topThree=smallAudience?[]:rows.filter(row=>Number(row.rank)<=3).sort((a,b)=>[2,1,3].indexOf(Number(a.rank))-[2,1,3].indexOf(Number(b.rank)));
    const rest=smallAudience?rows:rows.filter(row=>Number(row.rank)>3);

    const podiumHtml=topThree.length
      ? '<section class="lbv3-podium">'+topThree.map((row,i)=>{
          const rank=Number(row.rank)||i+1;
          const medal=rank===1?"🥇":rank===2?"🥈":"🥉";
          return '<article class="lbv3-podium-card rank-'+rank+(row.me?' is-me':'')+'">'+
            '<div class="lbv3-medal">'+medal+'</div>'+
            leaderboardV2Avatar(row)+
            '<div class="lbv3-podium-name"><b>'+escapeHtml(row.username||"Dresseur")+'</b>'+(row.me?'<small>TOI</small>':'')+'</div>'+
            '<strong>'+leaderboardV2ScoreHtml(row,current,data.unit||meta.unit)+'</strong>'+
          '</article>';
        }).join("")+'</section>'
      : '';

    const listHtml=rest.length
      ? '<section class="lbv3-list">'+rest.map((row,i)=>leaderboardV2Row(row,i+(smallAudience?1:4),current,data.unit||meta.unit)).join("")+'</section>'
      : '';
    const freePlaces=3-rows.length;
    const period=requestedScope==="today"?" aujourd’hui":requestedScope==="week"?" sur 7 jours":"";
    const inviteHtml=smallAudience
      ? '<p class="lbv3-invite" role="status">'+(rows.some(row=>row.me)
          ? 'Tu fais partie des premiers classés'+period+'. Le podium a encore '+freePlaces+' place'+(freePlaces>1?'s':'')+' : invite tes amis !'
          : 'Sois parmi les premiers'+period+' : le podium a encore '+freePlaces+' place'+(freePlaces>1?'s':'')+'.')+'</p>'
      : '';

    const around=(Array.isArray(data?.around)?data.around:[]).filter(row=>!rows.some(top=>Number(top.rank)===Number(row.rank)&&top.username===row.username));
    const aroundHtml=around.length
      ? '<section class="lbv3-around"><div class="lbv3-section-title">AUTOUR DE TOI</div>'+around.map(row=>leaderboardV2Row(row,row.rank,current,data.unit||meta.unit,true)).join("")+'</section>'
      : '';

    let personalHtml='';
    if (data?.me) {
      personalHtml='<section class="lbv3-personal">'+
        '<div><span>TA POSITION</span><strong>#'+Number(data.me.rank)+'</strong></div>'+
        '<div><span>TA PERFORMANCE</span><strong>'+leaderboardV2ScoreHtml(data.me,current,data.unit||meta.unit)+'</strong></div>'+
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
    const body='<div class="lbv3-shell" data-lb-request="'+requestId+'">'+
      '<header class="lbv3-header">'+
        '<div class="lbv3-title"><span>À CHACUN SON RECORD</span><h3>'+escapeHtml(data?.label||meta.label)+'</h3><p>'+escapeHtml(meta.hint)+' · Meilleure performance par joueur.</p></div>'+
        '<div class="lbv3-stats"><b>'+total+'</b><span>joueur'+(total>1?'s':'')+' classé'+(total>1?'s':'')+'</span></div>'+
      '</header>'+
      '<div class="lbv3-controls"><div class="lbv3-scope-tabs">'+scopeTabs+'</div><div class="lbv3-day-tabs" role="group" aria-label="Classements de la journée">'+dayTabs+'</div>'+modeTabs+'</div>'+
      genTabs+
      '<div class="leaderboard-content"><div class="leaderboard-main">'+
      personalHtml+
      inviteHtml+
      podiumHtml+
      listHtml+
      aroundHtml+
      emptyHtml+'</div>'+(typeof leaderboardLeagueAside === "function" ? leaderboardLeagueAside(data,current,requestedScope) : '')+'</div>'+
    '</div>';

    leaderboardV2Show(body);
    if (typeof fillLeaderboardWeekTop === "function") fillLeaderboardWeekTop(()=>requestId===leaderboardViewRequest);
  }).catch(()=>{
    if (!leaderboardOwnsDialog(requestId)) return;
    const args=escapeHtml(JSON.stringify([current,requestedScope]));
    leaderboardV2Show('<div class="lbv3-shell" data-lb-request="'+requestId+'"><section class="lbv3-empty" role="status"><div class="lbv3-empty-icon">!</div><h4>Classement indisponible</h4><p>Le serveur n’a pas confirmé le classement. Aucun résultat n’est effacé.</p><button type="button" class="btn-blue" data-action="openLeaderboardV2" data-args="'+args+'">Réessayer</button></section></div>');
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
  panel.innerHTML=skeletonHtml('Chargement de ta position du jour…','rows',3,'win-rank-loading');
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
