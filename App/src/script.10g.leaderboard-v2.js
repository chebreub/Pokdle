
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
// « Semaine » runs from Monday to Sunday in Paris, like the week's prize (31/10/2026).
const LEADERBOARD_V2_SCOPES = [["today","Aujourd’hui"],["week","Semaine"],["all","Records"]];
let leaderboardV2Scope = "all";
let leaderboardV2LastMode = "daily";

function leaderboardV2IsDraft(mode) {
  return typeof mode === "string" && /^draft(?:_(?:all|[1-9]))?$/.test(mode);
}
// Personal records are preserved independently of verified leaderboard results.
// They can be displayed, but must never be silently uploaded to a public ranking.
function leaderboardV2DraftLocalBest(mode) {
  if (!leaderboardV2IsDraft(mode) || typeof playerProfile === "undefined") return 0;
  const records = playerProfile?.draftScoreAttackRecords;
  if (!records || typeof records !== "object" || Array.isArray(records)) return 0;
  const values = mode === "draft" || mode === "draft_all"
    ? Object.values(records) : [records[Number(mode.slice(6))]];
  return values.map(Number).filter(n => Number.isInteger(n) && n > 0 && n <= 1000)
    .reduce((best, score) => Math.max(best, score), 0);
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
// The day's stages add their points up over a period (30/10/2026): « Total » instead of « Records ».
const LEADERBOARD_V2_CUMULATIVE = ["journey","enquete","wordlepts","dossier","challenge"];
function leaderboardV2IsCumulative(mode) {
  return LEADERBOARD_V2_CUMULATIVE.includes(mode);
}
function leaderboardV2ScopeLabel(scope, mode) {
  if (scope === "all" && leaderboardV2IsCumulative(mode)) return "Total";
  return (LEADERBOARD_V2_SCOPES.find(([id]) => id === scope) || [scope, scope])[1];
}
// Over a period the points of every day are added up: the hint says so.
function leaderboardV2Hint(meta, mode, scope) {
  if (scope === "today" || !leaderboardV2IsCumulative(mode)) return meta.hint;
  const period = scope === "week" ? "depuis lundi" : "depuis ton premier jour";
  return (mode === "journey" ? "Tes 4 épreuves additionnées " : "Tes points additionnés ") + period + " : chaque jour joué compte";
}
// « Global du jour » over the week reads « Global · semaine ».
function leaderboardV2Title(label, scope, mode) {
  const text = String(label || "");
  // « Pokémon du jour » is a game's name: only the other boards lose their « du jour ».
  const base = text === "Pokémon du jour" ? text : text.replace(/ du jour$/, "");
  if (scope === "week") return base + " · semaine";
  if (scope === "all") return base + (leaderboardV2IsCumulative(mode) ? " · total" : " · records");
  return text;
}
// « à 1 pt de Jade », « à 12 pts de Jade »: the gap reads in the board's unit, singular for one.
function leaderboardV2GapText(gap, mode, unit) {
  const text = leaderboardV2FormatScore(gap, mode, unit);
  return Number(gap) === 1 ? text.replace(/(\p{L})s\b/gu, "$1") : text;
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
  const days = Number(row?.days);
  if (days > 0) return days + " jour" + (days > 1 ? "s" : "");
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
// The player's partner Pokémon first, then their shared photo or account picture, then a Poké Ball.
const LEADERBOARD_V2_DEFAULT_AVATAR = "https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/items/poke-ball.png";
// Last week's champion plays with a shiny partner (31/10/2026). A picture that fails shows the Poké Ball.
function leaderboardV2Partner(row) {
  return row?.partnerId && typeof POKEMON_BY_ID !== "undefined" ? POKEMON_BY_ID.get(Number(row.partnerId)) : null;
}
function leaderboardV2Avatar(row) {
  const partner = leaderboardV2Partner(row), shiny = Boolean(row?.champion);
  if (partner) return '<img class="lbv2-avatar is-partner'+(typeof pokemonIsRare === "function" && pokemonIsRare(partner)?' is-rare':'')+(shiny?' is-champion':'')+'" src="'+escapeHtml(shiny ? getPokemonShinySprite(partner) : getPokemonSprite(partner))+'" data-fallback="'+escapeHtml(getPokemonSprite(partner))+'" alt="" title="'+escapeHtml(partner.name+(shiny ? ' shiny · champion de la semaine' : ''))+'" loading="lazy" />';
  return row?.avatar
    ? '<img class="lbv2-avatar" src="'+escapeHtml(row.avatar)+'" data-fallback="'+LEADERBOARD_V2_DEFAULT_AVATAR+'" alt="" loading="lazy" />'
    : '<img class="lbv2-avatar is-default" src="'+LEADERBOARD_V2_DEFAULT_AVATAR+'" alt="" loading="lazy" />';
}
// The podium's big picture: the partner's official artwork (shiny for the champion), else the player's picture.
function leaderboardV2PodiumArt(row) {
  const partner = leaderboardV2Partner(row), shiny = Boolean(row?.champion);
  if (partner) return '<img class="lbv5-art" src="'+escapeHtml(pokedexDetailArtwork(partner, shiny))+'" data-fallback="'+escapeHtml(shiny ? getPokemonShinySprite(partner) : getPokemonSprite(partner))+'" alt="" title="'+escapeHtml(partner.name+(shiny ? ' shiny' : ''))+'" loading="lazy" />';
  return row?.avatar
    ? '<img class="lbv5-art is-photo" src="'+escapeHtml(row.avatar)+'" data-fallback="'+LEADERBOARD_V2_DEFAULT_AVATAR+'" alt="" loading="lazy" />'
    : '<img class="lbv5-art is-default" src="'+LEADERBOARD_V2_DEFAULT_AVATAR+'" alt="" loading="lazy" />';
}
// The board's podium, as on PokeQuizz: second, first, third. Below three players the list stays alone.
function leaderboardV2PodiumHtml(rows, mode, unit) {
  if (!Array.isArray(rows) || rows.length < 3) return "";
  const places = [[rows[1], "silver"], [rows[0], "gold"], [rows[2], "bronze"]];
  return '<section class="lbv5-podium" aria-label="Podium">' + places.map(([row, metal]) =>
    '<div class="lbv5-step is-' + metal + (row.me ? ' is-me' : '') + (row.champion ? ' is-champion' : '') + '"' + leaderboardPlayerAttrs(row) + '>' +
      '<span class="lbv5-medal">' + (Number(row.rank) || "") + '</span>' + leaderboardV2PodiumArt(row) +
      '<b>' + escapeHtml(row.username || "Dresseur") + '</b>' + leaderboardLevelPill(row) +
      '<strong>' + escapeHtml(leaderboardV2FormatScore(row.score, mode, unit)) + '</strong>' +
      (row.me ? '<small>TOI</small>' : '') +
    '</div>').join("") + '</section>';
}
// The trainer card of a ranked player, as on PokeQuizz: partner, level, medals, days played,
// Pokémon du jour found, best streak, points, the day's games and the latest arcade records.
const PLAYER_CARD_GAMES = { enquete: ["Pokémon du jour", 149], wordlepts: ["Wordle", 201], dossier: ["Dossier", 65], challenge: ["Défi", 137] };
function playerCardArt(player) {
  const partner = leaderboardV2Partner(player);
  if (partner) return '<img src="'+escapeHtml(pokedexDetailArtwork(partner, Boolean(player.champion)))+'" data-fallback="'+escapeHtml(player.champion ? getPokemonShinySprite(partner) : getPokemonSprite(partner))+'" alt="'+escapeHtml(partner.name+(player.champion ? ' shiny' : ''))+'" />';
  return '<img class="is-photo" src="'+escapeHtml(player.avatar || LEADERBOARD_V2_DEFAULT_AVATAR)+'" data-fallback="'+LEADERBOARD_V2_DEFAULT_AVATAR+'" alt="" />';
}
function playerCardSince(since) {
  const [year, month] = String(since || "").split("-").map(Number);
  if (!year || !month) return "";
  return "Membre depuis " + new Date(Date.UTC(year, month - 1, 15)).toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
}
// The shiny hunt (31/10/2026): the Pokémon du jour caught shiny, newest first, with their day.
function shinyShowcaseHtml(list, count) {
  const entries = Array.isArray(list) ? list : [];
  const items = entries.map(entry => {
    const pokemon = typeof POKEMON_BY_ID !== "undefined" ? POKEMON_BY_ID.get(Number(entry.id)) : null;
    if (!pokemon) return "";
    const day = String(entry.day || "").split("-").reverse().slice(0, 2).join("/");
    return '<figure class="shiny-showcase-item"><img src="'+escapeHtml(pokedexDetailArtwork(pokemon, true))+'" data-fallback="'+escapeHtml(getPokemonShinySprite(pokemon))+'" alt="'+escapeHtml(pokemon.name)+' shiny" loading="lazy" />'+
      '<figcaption>'+escapeHtml(pokemon.name)+(day ? '<small>'+escapeHtml(day)+'</small>' : '')+'</figcaption></figure>';
  }).join("");
  const more = Number(count) > entries.length ? '<span class="shiny-showcase-more">+'+(Number(count) - entries.length)+'</span>' : "";
  return items ? '<div class="shiny-showcase">'+items+more+'</div>' : "";
}
function playerCardHtml(data) {
  const player = data.player || {}, figures = data.figures || {};
  const tier = typeof getXpTier === "function" ? getXpTier(Number(player.xp) || 0) : null;
  const level = tier ? Number(tier.level) || 1 : 1;
  const medals = [1, 2, 3].map((rank, i) => Number(player.medals?.[rank]) ? ["🥇","🥈","🥉"][i]+' ×'+Number(player.medals[rank]) : "").filter(Boolean).join(" · ");
  const number = n => typeof formatNumberFr === "function" ? formatNumberFr(n) : String(n);
  const figure = (value, label) => '<div><b>'+value+'</b><span>'+label+'</span></div>';
  const games = (data.games || []).map(row => {
    const [name, sprite] = PLAYER_CARD_GAMES[row.game] || [row.game, 0];
    const pokemon = typeof POKEMON_BY_ID !== "undefined" ? POKEMON_BY_ID.get(sprite) : null;
    return '<div class="player-card-game">'+(pokemon ? '<img src="'+escapeHtml(pokedexDetailArtwork(pokemon, false))+'" data-fallback="'+escapeHtml(getPokemonSprite(pokemon))+'" alt="" loading="lazy" />' : '')+
      '<b>'+escapeHtml(name)+'</b><span>'+(row.played ? row.played+' partie'+(row.played > 1 ? 's' : '')+' · '+number(row.points)+' pts' : 'Pas encore joué')+'</span></div>';
  }).join("");
  const records = (data.records || []).map(row => '<div class="player-card-record"><span>'+escapeHtml(row.label)+'</span><b>'+number(row.score)+(row.unit ? ' '+escapeHtml(row.unit) : '')+'</b></div>').join("");
  return '<article class="player-card">'+
    '<div class="player-card-hero"><div class="player-card-circle'+(player.champion ? ' is-champion' : '')+'">'+playerCardArt(player)+'</div>'+
      '<div class="player-card-id"><h3>'+escapeHtml(player.username || "Dresseur")+'</h3>'+
        '<div class="player-card-chips"><span class="player-card-title">'+(tier ? escapeHtml(tier.emoji+' '+tier.name)+' · ' : '')+'Niv. '+level+'</span>'+
          (player.pioneer ? '<span class="player-card-pioneer">✦ Pionnier</span>' : '')+(medals ? '<span class="profile-hero-medals">'+medals+'</span>' : '')+'</div>'+
        (player.champion ? '<p class="player-card-champion">✨ Partenaire shiny : champion de la semaine</p>' : '')+
        (player.since ? '<small>'+escapeHtml(playerCardSince(player.since))+'</small>' : '')+
      '</div></div>'+
    '<div class="player-card-figures">'+figure(number(figures.days || 0), 'jours joués')+figure(number(figures.found || 0), 'Pokémon du jour trouvés')+
      figure((figures.bestStreak || 0)+' j', 'meilleure série')+figure(number(figures.points || 0), 'points cumulés')+'</div>'+
    (Number(data.shinies?.count) ? '<h4>✨ Shinies · '+number(Number(data.shinies.count))+'</h4>'+shinyShowcaseHtml(data.shinies.latest, data.shinies.count) : '')+
    '<h4>Jeux du jour</h4><div class="player-card-games">'+games+'</div>'+
    (records ? '<h4>Derniers records</h4><div class="player-card-records">'+records+'</div>' : '')+
  '</article>';
}
let playerCardRequest = 0;
function openPlayerCard(pid) {
  const id = String(pid || "");
  if (!/^[0-9a-f]{16}$/.test(id) || typeof ensureOverlay !== "function") return;
  const request = ++playerCardRequest;
  ensureOverlay("Carte de dresseur", '<div class="player-card is-loading" aria-busy="true">'+(typeof skeletonHtml === "function" ? skeletonHtml("Chargement de la carte…", "rows", 4) : "Chargement…")+'</div>');
  const overlay = document.getElementById("overlay-modal");
  if (overlay) overlay.dataset.kind = "player";
  leaderboardFetchJson("/api/player/"+id).then(data => {
    const body = document.getElementById("overlay-body");
    if (request !== playerCardRequest || !body || overlay?.dataset.kind !== "player") return;
    body.innerHTML = playerCardHtml(data);
  }).catch(() => {
    const body = document.getElementById("overlay-body");
    if (request === playerCardRequest && body && overlay?.dataset.kind === "player") body.innerHTML = '<p class="player-card-error" role="status">Cette carte n’a pas pu s’ouvrir. Recharge le classement et réessaie.</p>';
  });
}
if (typeof document !== "undefined") document.addEventListener?.("keydown", event => {
  const row = event.target?.closest?.('[role="button"][data-action="openPlayerCard"]');
  if (row && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); row.click(); }
});
// Arcade boards with nobody ranked on the period are hidden; null keeps them all.
function leaderboardV2ArcadeCounts(scope) {
  return leaderboardFetchJson("/api/leaderboard/counts?scope="+encodeURIComponent(scope)).then(data=>data?.counts||null).catch(()=>null);
}
// « Niv. 70 » after a player's name; accounts without a saved profile have no level.
function leaderboardLevelPill(row) {
  const level = Number(row?.level);
  return Number.isInteger(level) && level >= 1 ? '<span class="player-level-pill">Niv. '+level+'</span>' : '';
}
// A ranked player opens their trainer card (31/10/2026): by a click, or Enter on the focused row.
function leaderboardPlayerAttrs(row) {
  return row?.pid ? ' data-action="openPlayerCard" data-args=\'["'+escapeHtml(String(row.pid))+'"]\' role="button" tabindex="0" aria-label="Voir la carte de dresseur de '+escapeHtml(row.username||"Dresseur")+'"' : '';
}
function leaderboardV2Row(row, fallbackRank, mode, unit, compact=false) {
  const rank=Number(row?.rank)||fallbackRank||0;
  return '<div class="lbv2-row'+(row?.me?' is-me':'')+(rank<=3?' is-podium rank-'+rank:'')+(compact?' is-compact':'')+(row?.pid?' is-clickable':'')+'"'+leaderboardPlayerAttrs(row)+'>'+
    '<span class="lbv2-rank">#'+rank+'</span>'+
    leaderboardV2Avatar(row)+
    '<span class="lbv2-player"><b>'+escapeHtml(row?.username||"Dresseur")+'</b>'+leaderboardLevelPill(row)+(row?.me?'<small>TOI</small>':'')+'</span>'+
    '<strong>'+leaderboardV2ScoreHtml(row,mode,unit)+'</strong>'+
    '</div>';
}
// The week's prize (31/10/2026), as on PokeQuizz: the first of the week's Global plays the next week
// with a shiny partner, and the top three keep a medal on their trainer card. Last week's champion
// is filled in by fillLeaderboardPrize.
const LEADERBOARD_PRIZE_EXAMPLE = 133;
function leaderboardPrizeHtml(mode, scope) {
  const byId = typeof POKEMON_BY_ID !== "undefined" ? POKEMON_BY_ID : null;
  const own = byId && typeof playerProfile !== "undefined" && playerProfile?.favoritePokemonId ? byId.get(Number(playerProfile.favoritePokemonId)) : null;
  const pokemon = own || byId?.get(LEADERBOARD_PRIZE_EXAMPLE);
  const art = pokemon && typeof pokedexDetailArtwork === "function" && typeof getPokemonShinySprite === "function" ? '<img class="lbv5-prize-art" src="'+escapeHtml(pokedexDetailArtwork(pokemon, true))+'" data-fallback="'+escapeHtml(getPokemonShinySprite(pokemon))+'" alt="'+escapeHtml(pokemon.name)+' shiny" loading="lazy" />' : '';
  const left = typeof weeklyLeagueTimeLeft === "function" ? weeklyLeagueTimeLeft() : "";
  const onWeek = mode === "journey" && scope === "week";
  return '<section class="lbv5-prize" aria-label="À gagner cette semaine"><span class="lbv5-prize-tag">À gagner cette semaine</span>'+
    '<div class="lbv5-prize-main">'+art+'<div class="lbv5-prize-text">'+
      '<h4>'+(own ? 'Ton '+escapeHtml(own.name)+' en shiny' : 'Ton partenaire en shiny')+'</h4>'+
      '<p>Pour le 1er du Global de la semaine, pendant 7 jours dans tous les classements. Médaille d’or, d’argent et de bronze pour le podium.</p>'+
      '<p class="lbv5-prize-time"><b>'+escapeHtml(left)+'</b> avant le reset · lundi 0 h</p>'+
      (onWeek ? '' : '<button type="button" class="btn-ghost lbv5-prize-link" data-action="openLeaderboardV2" data-args="[&quot;journey&quot;,&quot;week&quot;]">Voir le Global de la semaine →</button>')+
    '</div></div><div id="leaderboard-prize-last" class="lbv5-prize-last"></div></section>';
}
// The week's prize: last week's podium, the player's medals and whether they are the champion.
function loadWeeklyAwards() {
  return leaderboardFetchJson("/api/weekly-awards").then(data => {
    if (typeof window !== "undefined") window.__pokedleWeeklyAwards = data;
    if (document.getElementById("screen-profile")?.classList.contains("hidden") === false && typeof renderProfileScreen === "function") renderProfileScreen();
    return data;
  }).catch(() => null);
}
if (typeof window !== "undefined") window.addEventListener?.("pokedle:auth-ready", () => loadWeeklyAwards());
function fillLeaderboardPrize(isCurrent) {
  return loadWeeklyAwards().then(data => {
    const box = document.getElementById("leaderboard-prize-last");
    if (!box || !isCurrent() || !data) return;
    const firsts = (data.podium || []).filter(row => row.rank === 1);
    const medals = [1, 2, 3].map(rank => (data.medals || []).filter(m => m.rank === rank).length);
    const mine = medals.some(Boolean) ? '<small>Tes médailles : '+["🥇","🥈","🥉"].map((icon, i) => medals[i] ? icon+' ×'+medals[i] : "").filter(Boolean).join(" · ")+'</small>' : "";
    box.innerHTML = firsts.length
      ? '<span>Champion de la semaine dernière</span>'+firsts.map(row => '<div class="lbv5-champion"'+leaderboardPlayerAttrs(row)+'>'+leaderboardV2Avatar({ ...row, champion: true })+'<b>'+escapeHtml(row.username || "Dresseur")+'</b>'+leaderboardLevelPill(row)+'<strong>'+Number(row.points)+' pts</strong></div>').join("")+mine
      : '<span>Champion de la semaine dernière</span><p>Pas encore de champion : la première couronne t’attend.</p>'+mine;
  });
}
function switchLeaderboardSelect() {
  const value = this?.value || "";
  if (!value) return;
  if (value === "__league") { this.value = ""; return typeof openWeeklyLeagueRanking === "function" ? openWeeklyLeagueRanking() : null; }
  openLeaderboardV2(value, leaderboardV2Scope);
}
// Opened from the menu (no period given) with fewer than three players today, the board shows
// the last 7 days: an almost empty list reads as an empty site.
const LEADERBOARD_V2_FEW_PLAYERS = 3;
let leaderboardV2AutoWeek = false;
function openLeaderboardV2(mode="journey",scope="today") {
  const autoScope = arguments.length < 2;
  if (!autoScope) leaderboardV2AutoWeek = false;
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
    if (autoScope && requestedScope==="today" && (Number(data.total)||0) < LEADERBOARD_V2_FEW_PLAYERS) {
      const shown=openLeaderboardV2(current,"week");
      leaderboardV2AutoWeek = true;
      return shown;
    }
    const isActive=id=>id==="draft"?leaderboardV2IsDraft(current):id===current;
    const otherModes=LEADERBOARD_V2_OTHER_MODES.filter(([id])=>!counts||isActive(id)||Number(counts[id])>0||(id==="draft"&&requestedScope==="all"&&leaderboardV2DraftLocalBest("draft_all")>0));
    // One menu for every board: the day's stages first, then the arcade games that have a score.
    const option=([id,label])=>'<option value="'+(id==="draft"?"draft_all":id)+'"'+(isActive(id)?' selected':'')+'>'+escapeHtml(label)+'</option>';
    const modeTabs='<label class="lbv4-arcade lbv4-board-select is-active"><span>Classement</span><select data-change-action="switchLeaderboardSelect" aria-label="Choisir un classement">'+
      '<optgroup label="Jeux du jour">'+LEADERBOARD_V2_DAY_MODES.map(option).join("")+'</optgroup>'+
      (otherModes.length?'<optgroup label="Jeux d’arcade">'+otherModes.map(option).join("")+'</optgroup>':'')+
      '<option value="__league">Ligue · 3 disciplines</option></select></label>';

    const scopeTabs=LEADERBOARD_V2_SCOPES.map(([id])=>
      '<button type="button" class="lbv3-scope-tab'+(id===leaderboardV2Scope?' is-active':'')+'" aria-pressed="'+(id===leaderboardV2Scope)+'" data-action="switchLeaderboardScopeV2" data-lb-scope="'+id+'">'+leaderboardV2ScopeLabel(id,current)+'</button>'
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
    const rest=rows;

    const listHtml=rest.length
      ? '<section class="lbv3-list">'+rest.map((row,i)=>leaderboardV2Row(row,i+1,current,data.unit||meta.unit)).join("")+'</section>'
      : '';
    const freePlaces=3-rows.length;
    const period=requestedScope==="today"?" aujourd’hui":requestedScope==="week"?" cette semaine":"";
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
      const myRank=Number(data.me.rank)||0, unit=data.unit||meta.unit;
      const inList=rows.some(row=>row.me);
      const above=[...rows,...(Array.isArray(data?.around)?data.around:[])].find(row=>Number(row.rank)===myRank-1&&!row.me);
      // Whatever the direction of the board, the gap is the distance to the next place.
      const gap=above?Math.abs((Number(above.score)||0)-(Number(data.me.score)||0)):null;
      const gapHtml=above
        ? (gap>0
            ? '<em>à '+escapeHtml(leaderboardV2GapText(gap,current,unit))+' de '+escapeHtml(above.username||"Dresseur")+' (#'+(myRank-1)+')</em>'
            : '<em>à égalité avec '+escapeHtml(above.username||"Dresseur")+' : le temps vous départage</em>')
        : '';
      // Already in the list and first: nothing to add. Otherwise the line says how far the next place is.
      if (!(inList && myRank===1)) {
        personalHtml='<section class="lbv3-personal"><span>Ta position</span><strong>#'+myRank+'</strong><span>·</span><b>'+leaderboardV2ScoreHtml(data.me,current,unit)+'</b>'+gapHtml+'</section>';
      }
    }
    const localDraftBest=requestedScope==="all" ? leaderboardV2DraftLocalBest(current) : 0;
    if (localDraftBest > (Number(data?.me?.score)||0)) {
      personalHtml+='<aside class="lbv3-local-record" role="note"><span>Ton record personnel</span><strong>'+localDraftBest+' BST</strong><p>Ce record est conservé dans ton profil, mais il n’est pas confirmé par le serveur pour le classement public. Il n’a pas disparu.</p></aside>';
    }

    const empty = !rows.length;
    const emptyHtml = empty
      ? '<section class="lbv3-empty"><div class="lbv3-empty-icon">🏆</div><h4>Pas encore de performance ici</h4><p>'+
        (requestedScope==="all"
          ? (leaderboardV2IsCumulative(current)?(window.__pokedleAuthed?'Aucun point enregistré pour l’instant.':'Connecte-toi pour que tes points comptent.'):(window.__pokedleAuthed?'Aucun record enregistré pour ce mode.':'Connecte-toi pour enregistrer tes records.'))
          : 'Aucune performance enregistrée sur cette période. Les records locaux antérieurs ne sont pas antidatés.')+
        '</p></section>'
      : '';

    const total=Number(data?.total)||0;
    const body='<div class="lbv3-shell lbv4" data-lb-request="'+requestId+'">'+
      leaderboardPrizeHtml(current, requestedScope)+
      '<div class="lbv3-controls"><div class="lbv4-filters">'+modeTabs+'<div class="lbv3-scope-tabs">'+scopeTabs+'</div></div></div>'+
      (leaderboardV2AutoWeek&&requestedScope==="week"?'<p class="lbv4-auto-week" role="status">Peu de joueurs aujourd’hui : voici la semaine.</p>':'')+
      genTabs+
      '<header class="lbv3-header lbv4-board-head">'+
        '<div class="lbv3-title"><h3>'+escapeHtml(leaderboardV2Title(data?.label||meta.label,requestedScope,current))+'</h3><p>'+escapeHtml(leaderboardV2Hint(meta,current,requestedScope))+'</p></div>'+
        '<div class="lbv3-stats"><b>'+total+'</b><span>joueur'+(total>1?'s':'')+' classé'+(total>1?'s':'')+'</span></div>'+
      '</header>'+
      leaderboardV2PodiumHtml(rows, current, data.unit||meta.unit)+
      personalHtml+
      inviteHtml+
      listHtml+
      aroundHtml+
      emptyHtml+
    '</div>';

    leaderboardV2Show(body);
    fillLeaderboardPrize(()=>requestId===leaderboardViewRequest);
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
window.switchLeaderboardSelect=switchLeaderboardSelect;
window.openLeaderboard=openLeaderboardV2;
window.switchLeaderboard=switchLeaderboardV2;
try { openLeaderboard=openLeaderboardV2; switchLeaderboard=switchLeaderboardV2; } catch (_e) {}
