// ============================================================
//  SCORE ATTACK PRO — moteur de bonus + données dresseurs + écran de révélation
//  Morceau autonome (globals). Branché depuis script.06 (fin de draft) et le serveur 1v1.
//  Le mode Score Attack "de base" reste inchangé.
// ============================================================

// --- Météos (roue) ---
const PRO_WEATHERS = [
  { key: "soleil", label: "Grand Soleil",     emoji: "☀️", types: ["Feu", "Plante"] },
  { key: "pluie",  label: "Pluie",            emoji: "🌧️", types: ["Eau"] },
  { key: "sable",  label: "Tempête de sable", emoji: "🏜️", types: ["Roche", "Sol", "Acier"] },
  { key: "grele",  label: "Neige / Grêle",    emoji: "❄️", types: ["Glace"] },
];

// --- Champions d'Arène (nom + type) — vérifiés Poképédia gen 1-4 ---
const PRO_GYM_LEADERS = {
  1: [["Pierre","Roche"],["Ondine","Eau"],["Major Bob","Électrik"],["Erika","Plante"],["Koga","Poison"],["Morgane","Psy"],["Auguste","Feu"],["Giovanni","Sol"]],
  2: [["Albert","Vol"],["Hector","Insecte"],["Blanche","Normal"],["Mortimer","Spectre"],["Chuck","Combat"],["Jasmine","Acier"],["Frédo","Glace"],["Sandra","Dragon"]],
  3: [["Roxanne","Roche"],["Bastien","Combat"],["Voltère","Électrik"],["Adriane","Feu"],["Norman","Normal"],["Alizée","Vol"],["Lévy & Tatia","Psy"],["Juan","Eau"]],
  4: [["Pierrick","Roche"],["Flo","Plante"],["Mélina","Combat"],["Lovis","Eau"],["Kiméra","Spectre"],["Charles","Acier"],["Gladys","Glace"],["Tanguy","Électrik"]],
};

// --- Maîtres de Ligue (type + ace) — gen 1-6, fiables ---
const PRO_LEAGUE_MASTERS = {
  1: { name: "Blue",           type: "Normal",  aceId: 18,  aceName: "Roucarnage" },
  2: { name: "Peter",          type: "Dragon",  aceId: 149, aceName: "Dracolosse" },
  3: { name: "Pierre Rochard", type: "Acier",   aceId: 376, aceName: "Métalosse" },
  4: { name: "Cynthia",        type: "Dragon",  aceId: 445, aceName: "Carchacrok" },
  5: { name: "Goyah",          type: "Insecte", aceId: 637, aceName: "Pyrax" },
  6: { name: "Dianthéa",       type: "Fée",     aceId: 282, aceName: "Gardevoir" },
};

// --- Barème (réglable) ---
const PRO_TUNING = {
  weatherPerMon: 40,
  monoType: 250, rainbow: 180, colossusPerMon: 50, colorFamily: 80, finalEvoPerMon: 20,
  gymTypePerMon: 35,
  masterTypePerMon: 55, masterAce: 250,
};

function proMonTypes(m) { return [m.type1, m.type2].filter(Boolean); }

// Tire météo + dresseur pour une génération (rnd injectable pour tests / serveur)
function rollProModifiers(gen, rnd) {
  rnd = typeof rnd === "function" ? rnd : Math.random;
  const g = Number(gen) || 1;
  const weather = PRO_WEATHERS[Math.floor(rnd() * PRO_WEATHERS.length)];
  const gyms = PRO_GYM_LEADERS[g] || PRO_GYM_LEADERS[1];
  const master = PRO_LEAGUE_MASTERS[g] || null;
  let trainer;
  if (master && rnd() < 0.25) {
    trainer = { name: master.name, type: master.type, tier: "maitre", aceId: master.aceId, aceName: master.aceName };
  } else {
    const pick = gyms[Math.floor(rnd() * gyms.length)];
    trainer = { name: pick[0], type: pick[1], tier: "arene" };
  }
  return { weather, trainer };
}

// Calcule le score PRO : base BST + bonus. team = [{id,name,type1,type2,bst,stage,color}]
function computeDraftProScore(team, mods, tuning) {
  tuning = tuning || PRO_TUNING;
  mods = mods || {};
  team = Array.isArray(team) ? team.filter(Boolean) : [];
  const base = team.reduce((s, m) => s + (Number(m.bst) || 0), 0);
  const bonuses = [];
  const add = (label, points, detail) => { if (points) bonuses.push({ label, points, detail: detail || "" }); };

  if (mods.weather && Array.isArray(mods.weather.types)) {
    const wt = new Set(mods.weather.types);
    const hits = team.filter((m) => proMonTypes(m).some((t) => wt.has(t)));
    add(`${mods.weather.emoji} ${mods.weather.label}`, hits.length * tuning.weatherPerMon, `${hits.length} Pokémon ${mods.weather.types.join("/")}`);
  }

  const typeCount = {};
  for (const m of team) for (const t of proMonTypes(m)) typeCount[t] = (typeCount[t] || 0) + 1;
  const mono = Object.entries(typeCount).find(([, c]) => c === team.length && team.length >= 6);
  if (mono) add(`🧬 Équipe mono ${mono[0]}`, tuning.monoType);

  if (team.length >= 6 && new Set(team.map((m) => m.type1)).size >= 6) add("🌈 Arc-en-ciel (6 types)", tuning.rainbow);

  const colossi = team.filter((m) => (Number(m.bst) || 0) >= 600);
  add("💪 Colosses (BST≥600)", colossi.length * tuning.colossusPerMon, `${colossi.length} Pokémon`);

  const colorCount = {};
  for (const m of team) if (m.color) colorCount[m.color] = (colorCount[m.color] || 0) + 1;
  const top = Object.entries(colorCount).sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] >= 4) add(`🎨 Famille ${top[0]} (×${top[1]})`, tuning.colorFamily);

  const finals = team.filter((m) => Number(m.stage) === 3);
  add("✨ Évolutions abouties", finals.length * tuning.finalEvoPerMon, `${finals.length} au stade final`);

  if (mods.trainer) {
    const tr = mods.trainer;
    const isMaster = tr.tier === "maitre";
    const per = isMaster ? tuning.masterTypePerMon : tuning.gymTypePerMon;
    const hits = team.filter((m) => proMonTypes(m).includes(tr.type));
    add(`${isMaster ? "👑 Maître" : "🎽 Champion"} ${tr.name} (${tr.type})`, hits.length * per, `${hits.length} Pokémon ${tr.type}`);
    if (isMaster && tr.aceId && team.some((m) => Number(m.id) === Number(tr.aceId))) {
      add(`🏆 JACKPOT : l'ace ${tr.aceName} !`, tuning.masterAce);
    }
  }

  const bonusTotal = bonuses.reduce((s, b) => s + b.points, 0);
  return { base, bonuses, bonusTotal, total: base + bonusTotal };
}

// Map l'équipe d'état (draftArenaState.team = [{pokemon, shiny}]) vers l'entrée du moteur
function buildProTeamData(stateTeam) {
  return (Array.isArray(stateTeam) ? stateTeam : [])
    .filter((e) => e && e.pokemon)
    .map((e) => ({
      id: Number(e.pokemon.id) || 0,
      name: e.pokemon.name,
      type1: e.pokemon.type1 || null,
      type2: e.pokemon.type2 || null,
      stage: Number(e.pokemon.stage) || 0,
      color: e.pokemon.color || null,
      bst: (typeof getDraftCachedPokemonPowerData === "function" ? Number(getDraftCachedPokemonPowerData(e.pokemon).statGlobal) : 0) || 0,
      shiny: Boolean(e.shiny),
    }));
}

// --- Record PRO séparé du Score Attack normal ---
function getDraftProRecord(gen) {
  if (typeof playerProfile === "undefined" || !playerProfile) return 0;
  const r = playerProfile.draftScoreProRecords || {};
  return Number(r[gen]) || 0;
}
function updateDraftProRecord(gen, score) {
  if (typeof playerProfile === "undefined" || !playerProfile) return false;
  playerProfile.draftScoreProRecords = playerProfile.draftScoreProRecords || {};
  const prev = Number(playerProfile.draftScoreProRecords[gen]) || 0;
  if (score > prev) {
    playerProfile.draftScoreProRecords[gen] = score;
    if (typeof saveProfile === "function") { try { saveProfile(); } catch (e) {} }
    return true;
  }
  return false;
}

// --- Écran de révélation animé ---
// teamData : sortie de buildProTeamData ; mods : {weather, trainer} ; result : computeDraftProScore(...)
// opts : { isNewRecord, previousRecord, onDone, opponent: {nickname,total}|null }
function showDraftProRevealOverlay(teamData, mods, result, opts) {
  opts = opts || {};
  const esc = (typeof escapeHtml === "function") ? escapeHtml : (s) => String(s);
  const old = document.getElementById("draft-pro-reveal-overlay");
  if (old) old.remove();

  const tr = mods.trainer || {};
  const isMaster = tr.tier === "maitre";
  const overlay = document.createElement("div");
  overlay.id = "draft-pro-reveal-overlay";
  overlay.className = "draft-pro-reveal";
  overlay.innerHTML = `
    <div class="dpr-backdrop"></div>
    <div class="dpr-card">
      <div class="dpr-title">Révélation des bonus</div>
      <div class="dpr-rolls">
        <div class="dpr-roll" id="dpr-weather"><span class="dpr-roll-emoji">🌀</span><span class="dpr-roll-label">Météo…</span></div>
        <div class="dpr-roll" id="dpr-trainer"><span class="dpr-roll-emoji">❓</span><span class="dpr-roll-label">Dresseur…</span></div>
      </div>
      <ul class="dpr-bonuses" id="dpr-bonuses"></ul>
      <div class="dpr-score" id="dpr-score">
        <span class="dpr-score-base">Base ${result.base}</span>
        <span class="dpr-score-total" id="dpr-score-total">${result.base}</span>
      </div>
      <div class="dpr-verdict" id="dpr-verdict"></div>
      <div class="dpr-actions"><button type="button" class="btn-red" id="dpr-close">Continuer</button></div>
    </div>`;
  document.body.appendChild(overlay);

  const weatherEl = overlay.querySelector("#dpr-weather");
  const trainerEl = overlay.querySelector("#dpr-trainer");
  const bonusList = overlay.querySelector("#dpr-bonuses");
  const scoreTotalEl = overlay.querySelector("#dpr-score-total");
  const verdictEl = overlay.querySelector("#dpr-verdict");

  // 1) Roue météo
  let spins = 0;
  const wheel = setInterval(() => {
    const w = PRO_WEATHERS[spins % PRO_WEATHERS.length];
    weatherEl.querySelector(".dpr-roll-emoji").textContent = w.emoji;
    weatherEl.querySelector(".dpr-roll-label").textContent = w.label;
    spins += 1;
    if (spins > 9) {
      clearInterval(wheel);
      weatherEl.classList.add("is-locked");
      weatherEl.querySelector(".dpr-roll-emoji").textContent = mods.weather.emoji;
      weatherEl.querySelector(".dpr-roll-label").textContent = mods.weather.label;
      setTimeout(revealTrainer, 450);
    }
  }, 110);

  // 2) Dresseur
  function revealTrainer() {
    trainerEl.classList.add("is-locked", isMaster ? "is-master" : "is-gym");
    trainerEl.querySelector(".dpr-roll-emoji").textContent = isMaster ? "👑" : "🎽";
    trainerEl.querySelector(".dpr-roll-label").innerHTML = `${esc(tr.name || "")}<small>${isMaster ? "Maître" : "Champion"} · ${esc(tr.type || "")}</small>`;
    setTimeout(revealBonuses, 500);
  }

  // 3) Bonus un par un + score qui monte
  function revealBonuses() {
    let i = 0;
    const step = () => {
      if (i >= result.bonuses.length) { setTimeout(finishScore, 250); return; }
      const b = result.bonuses[i];
      const li = document.createElement("li");
      li.innerHTML = `<span>${esc(b.label)}${b.detail ? ` <em>${esc(b.detail)}</em>` : ""}</span><b>+${b.points}</b>`;
      bonusList.appendChild(li);
      requestAnimationFrame(() => li.classList.add("is-in"));
      i += 1;
      setTimeout(step, 360);
    };
    step();
  }

  // 4) Score final animé + verdict
  function finishScore() {
    const start = Date.now(), dur = 900, from = result.base, to = result.total;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      scoreTotalEl.textContent = Math.round(from + (to - from) * eased);
      if (t < 1) requestAnimationFrame(tick);
      else {
        scoreTotalEl.textContent = to;
        scoreTotalEl.classList.add("is-pop");
        showVerdict();
      }
    };
    requestAnimationFrame(tick);
  }

  function showVerdict() {
    if (opts.isNewRecord) {
      verdictEl.innerHTML = `🏆 NOUVEAU RECORD PRO ! <small>(avant : ${opts.previousRecord || 0})</small>`;
      verdictEl.classList.add("is-record");
    } else if (opts.opponent) {
      const won = result.total > opts.opponent.total;
      const tie = result.total === opts.opponent.total;
      verdictEl.innerHTML = tie ? "🤝 Égalité !" : won ? "🏆 VICTOIRE !" : "💀 Défaite";
      verdictEl.classList.add(tie ? "is-tie" : won ? "is-win" : "is-lose");
    } else {
      verdictEl.textContent = `Bonus total : +${result.bonusTotal}`;
    }
  }

  const close = () => { overlay.classList.add("is-closing"); setTimeout(() => { overlay.remove(); if (typeof opts.onDone === "function") opts.onDone(); }, 280); };
  overlay.querySelector("#dpr-close").addEventListener("click", close);
  setTimeout(() => overlay.querySelector("#dpr-close")?.focus(), 300);
}


// --- Bascule Normal / PRO sur l'écran Score Attack ---
function setScoreAttackProMode(pro) {
  if (!draftArenaState) return;
  draftArenaState.scoreAttackPro = !!pro;
  var n = document.getElementById("dpa-mode-normal");
  var p = document.getElementById("dpa-mode-pro");
  if (n) n.classList.toggle("is-active", !pro);
  if (p) p.classList.toggle("is-active", !!pro);
  // Relance proprement si un draft est déjà en cours (le scoring de fin change)
  if (draftArenaState.mode === "scoreAttack" && draftArenaState.selectedGen && (draftArenaState.team || []).length > 0 && draftArenaState.phase === "draft" && typeof selectDraftGeneration === "function") {
    selectDraftGeneration(draftArenaState.selectedGen);
  } else if (typeof renderDraftArena === "function") {
    renderDraftArena();
  }
}

// --- Finale PRO solo : tire météo+dresseur, calcule, révèle, enregistre le record PRO ---
function runDraftProFinale() {
  if (!draftArenaState) return;
  draftArenaState.phase = "result";
  var teamData = buildProTeamData(draftArenaState.team);
  var mods = rollProModifiers(draftArenaState.selectedGen);
  var result = computeDraftProScore(teamData, mods);
  var gen = draftArenaState.selectedGen;
  var previousRecord = getDraftProRecord(gen);
  var isNewRecord = updateDraftProRecord(gen, result.total);
  var power = function (m) { return (typeof getDraftCachedPokemonPowerData === "function" ? Number(getDraftCachedPokemonPowerData(m.pokemon).statGlobal) : 0) || 0; };
  var mvp = (draftArenaState.team || []).slice().sort(function (a, b) { return power(b) - power(a); })[0];
  draftArenaState.runSummary = {
    status: "Score PRO " + result.total + (isNewRecord ? " 🏆 NOUVEAU RECORD !" : ""),
    mvpName: (mvp && mvp.pokemon && mvp.pokemon.name) || "-",
    balanceLabel: "Base " + result.base + " · Bonus +" + result.bonusTotal,
    offenseLabel: mods.weather.emoji + " " + mods.weather.label + " · " + (mods.trainer.tier === "maitre" ? "👑 " : "🎽 ") + mods.trainer.name,
  };
  draftArenaState.message = isNewRecord
    ? ("🏆 NOUVEAU RECORD PRO Gen " + gen + " : " + result.total + " ! (avant : " + (previousRecord || 0) + ")")
    : ("Score Attack PRO terminé : " + result.total + " points.");
  if (typeof awardXp === "function") awardXp(Math.round(result.total / 12), "Score Attack PRO " + result.total);
  if (typeof progressQuest === "function") { try { progressQuest("draft_complete", 1); } catch (e) {} }
  if (typeof renderDraftArena === "function") renderDraftArena();
  showDraftProRevealOverlay(teamData, mods, result, {
    isNewRecord: isNewRecord, previousRecord: previousRecord,
    onDone: function () { if (typeof renderDraftArena === "function") renderDraftArena(); },
  });
}
