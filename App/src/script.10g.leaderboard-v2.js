
// Results & Leaderboards V2 — time-scoped performance leaderboards and result integration.
const LEADERBOARD_V2_MODES = [
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
const LEADERBOARD_V2_SCOPES = [["today","Aujourd’hui"],["week","7 jours"],["all","Toujours"]];
let leaderboardV2Scope = "all";
let leaderboardV2LastMode = "daily";

function leaderboardV2IsDraft(mode) {
  return typeof mode === "string" && mode.indexOf("draft") === 0;
}
function leaderboardV2ModeMeta(mode) {
  if (leaderboardV2IsDraft(mode)) return { label:"Draft Score", hint:"Moyenne BST", unit:"BST", direction:"desc" };
  const rows = {
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
  if (mode === "daily") return n + " essai" + (n > 1 ? "s" : "");
  if (leaderboardV2IsDraft(mode)) return n + " BST";
  if (mode === "quiz") return n + " bonne" + (n > 1 ? "s" : "");
  if (mode === "speedrun") return n + " Pokémon";
  if (mode === "higherlower60" || mode === "typecombo") return n + " pts";
  return n + (unit ? " " + unit : "");
}
function submitLeaderboardResult(mode, score) {
  if (!window.__pokedleAuthed) return Promise.resolve(false);
  const n = Math.floor(Number(score));
  if (!mode || !Number.isFinite(n) || n <= 0) return Promise.resolve(false);
  return fetch("/api/leaderboard/result", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    credentials:"same-origin",
    body:JSON.stringify({mode,score:n})
  }).then(r=>r.json()).then(data=>Boolean(data?.ok)).catch(()=>false);
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

  ensureOverlay("Classements",'<div class="lbv2-shell"><div class="lbv2-loading"><span></span><p>Chargement du classement…</p></div></div>');
  fetch("/api/leaderboard?mode="+encodeURIComponent(current)+"&scope="+encodeURIComponent(leaderboardV2Scope),{credentials:"same-origin"})
    .then(r=>r.json())
    .then(data=>{
      const tabs=LEADERBOARD_V2_MODES.map(([id,label])=>{
        const active=id==="draft"?leaderboardV2IsDraft(current):id===current;
        const target=id==="draft"?"draft_all":id;
        return '<button type="button" class="lbv2-mode-tab'+(active?' is-active':'')+'" data-action="switchLeaderboardV2" data-lb-mode="'+target+'">'+escapeHtml(label)+'</button>';
      }).join("");
      const periods=LEADERBOARD_V2_SCOPES.map(([id,label])=>'<button type="button" class="lbv2-scope-tab'+(id===leaderboardV2Scope?' is-active':'')+'" data-action="switchLeaderboardScopeV2" data-lb-scope="'+id+'">'+label+'</button>').join("");
      const draft=leaderboardV2IsDraft(current)
        ? '<div class="lbv2-draft-tabs">'+DRAFT_GENS.map(([id,label])=>'<button type="button" class="'+(id===current?'is-active':'')+'" data-action="switchLeaderboardV2" data-lb-mode="'+id+'">'+label+'</button>').join("")+'</div>'
        : '';
      const rows=Array.isArray(data?.top)?data.top:[];
      const podium=rows.filter(row=>Number(row.rank)<=3);
      const rest=rows.filter(row=>Number(row.rank)>3);
      const podiumHtml=podium.length
        ? '<div class="lbv2-podium">'+podium.map((row,i)=>leaderboardV2Row(row,i+1,current,data.unit||meta.unit)).join("")+'</div>'
        : '';
      const listHtml=rest.length
        ? '<div class="lbv2-list">'+rest.map((row,i)=>leaderboardV2Row(row,i+4,current,data.unit||meta.unit)).join("")+'</div>'
        : (!podium.length?'<div class="lbv2-empty"><b>Le classement est encore vide.</b><span>Sois le premier à poser une performance.</span></div>':'');
      const around=(Array.isArray(data?.around)?data.around:[]).filter(row=>!rows.some(top=>Number(top.rank)===Number(row.rank)&&top.username===row.username));
      const aroundHtml=around.length
        ? '<section class="lbv2-around"><div class="lbv2-section-title"><span>AUTOUR DE TOI</span></div>'+around.map(row=>leaderboardV2Row(row,row.rank,current,data.unit||meta.unit,true)).join("")+'</section>'
        : '';
      let meHtml='';
      if (data?.me) {
        meHtml='<div class="lbv2-me-card"><div><span>TA POSITION</span><strong>#'+Number(data.me.rank)+'</strong></div><div><span>TA PERFORMANCE</span><strong>'+escapeHtml(leaderboardV2FormatScore(data.me.score,current,data.unit||meta.unit))+'</strong></div></div>';
      } else {
        meHtml='<div class="lbv2-login-note">'+(window.__pokedleAuthed?'Joue à ce mode pour entrer dans ce classement.':'Connecte-toi avec Discord pour enregistrer tes performances.')+'</div>';
      }
      const total=Number(data?.total)||0;
      const body='<div class="lbv2-shell">'+
        '<header class="lbv2-hero"><div><span class="lbv2-eyebrow">ARÈNE DES DRESSEURS</span><h3>'+escapeHtml(data?.label||meta.label)+'</h3><p>'+escapeHtml(meta.hint)+' · '+total+' joueur'+(total>1?'s':'')+'</p></div><div class="lbv2-scope-tabs">'+periods+'</div></header>'+
        '<div class="lbv2-mode-tabs">'+tabs+'</div>'+draft+
        meHtml+podiumHtml+listHtml+aroundHtml+
        '</div>';
      ensureOverlay("Classements",body);
    })
    .catch(()=>ensureOverlay("Classements",'<div class="lbv2-shell"><div class="lbv2-empty"><b>Classement indisponible.</b><span>Réessaie dans quelques instants.</span></div></div>'));
}
function renderWinLeaderboardPreview(mode) {
  const box=document.getElementById("win-box");
  if (!box || !["daily","normal"].includes(mode)) return;
  let panel=document.getElementById("win-ranking-preview");
  if (!panel) {
    panel=document.createElement("section");
    panel.id="win-ranking-preview";
    panel.className="win-ranking-preview";
    const buttons=box.querySelector(".win-btns");
    if (buttons) box.insertBefore(panel,buttons);
    else box.appendChild(panel);
  }
  if (mode!=="daily") {
    panel.innerHTML='<div><span>CLASSEMENTS</span><b>Compare tes records sur les modes compétitifs.</b></div><button type="button" class="btn-ghost" data-action="openLeaderboardV2" data-args='["daily","today"]'>Voir les classements →</button>';
    return;
  }
  panel.innerHTML='<div class="win-rank-loading">Calcul de ta position du jour…</div>';
  setTimeout(()=>{
    fetch("/api/leaderboard?mode=daily&scope=today",{credentials:"same-origin"})
      .then(r=>r.json())
      .then(data=>{
        if (!document.getElementById("win-ranking-preview")) return;
        if (data?.me) {
          panel.innerHTML='<div class="win-rank-position"><span>CLASSEMENT DU JOUR</span><strong>#'+Number(data.me.rank)+'</strong><small>'+escapeHtml(leaderboardV2FormatScore(data.me.score,"daily","essais"))+' · '+(Number(data.total)||0)+' classé'+(Number(data.total)>1?'s':'')+'</small></div>'+
            '<button type="button" class="btn-blue" data-action="openLeaderboardV2" data-args='["daily","today"]'>Voir le classement →</button>';
        } else {
          panel.innerHTML='<div><span>CLASSEMENT DU JOUR</span><b>Connecte-toi pour enregistrer ta position.</b></div><button type="button" class="btn-ghost" data-action="openLeaderboardV2" data-args='["daily","today"]'>Voir le classement →</button>';
        }
      }).catch(()=>{ panel.innerHTML=''; });
  },650);
}

if (typeof recordMatchHistory === "function") {
  const recordMatchHistoryBeforeLeaderboardV2=recordMatchHistory;
  recordMatchHistory=function(entry) {
    const performance=leaderboardResultFromHistory(entry);
    const result=recordMatchHistoryBeforeLeaderboardV2(entry);
    if (performance?.score>0) {
      submitLeaderboardResult(performance.mode,performance.score).then(()=>{
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
window.openLeaderboardV2=openLeaderboardV2;
window.switchLeaderboardV2=switchLeaderboardV2;
window.switchLeaderboardScopeV2=switchLeaderboardScopeV2;
window.openLeaderboard=openLeaderboardV2;
window.switchLeaderboard=switchLeaderboardV2;
try { openLeaderboard=openLeaderboardV2; switchLeaderboard=switchLeaderboardV2; } catch (_e) {}
