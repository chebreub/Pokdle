// ============================================================
//  SCORE ATTACK PRO — moteur de bonus + données dresseurs + révélation inline
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
  1: [["Pierre","Roche","img/trainers/pierre.png"], ["Ondine","Eau","img/trainers/ondine.png"], ["Major Bob","Électrik","img/trainers/major_bob.png"], ["Erika","Plante","img/trainers/erika.png"], ["Koga","Poison","img/trainers/koga.png"], ["Morgane","Psy","img/trainers/morgane.png"], ["Auguste","Feu","img/trainers/auguste.png"], ["Giovanni","Sol","img/trainers/giovanni.png"]],
  2: [["Albert","Vol","img/trainers/albert.png"], ["Hector","Insecte","img/trainers/hector.png"], ["Blanche","Normal","img/trainers/blanche.png"], ["Mortimer","Spectre","img/trainers/mortimer.png"], ["Chuck","Combat","img/trainers/chuck.png"], ["Jasmine","Acier","img/trainers/jasmine.png"], ["Frédo","Glace","img/trainers/fredo.png"], ["Sandra","Dragon","img/trainers/sandra.png"]],
  3: [["Roxanne","Roche","img/trainers/roxanne.png"], ["Bastien","Combat","img/trainers/bastien.png"], ["Voltère","Électrik","img/trainers/voltere.png"], ["Adriane","Feu","img/trainers/adriane.png"], ["Norman","Normal","img/trainers/norman.png"], ["Alizée","Vol","img/trainers/alizee.png"], ["Lévy & Tatia","Psy","img/trainers/levy_tatia.png"], ["Juan","Eau","img/trainers/juan.png"]],
  4: [["Pierrick","Roche","img/trainers/pierrick.png"], ["Flo","Plante","img/trainers/flo.png"], ["Mélina","Combat","img/trainers/melina.png"], ["Lovis","Eau","img/trainers/lovis.png"], ["Kiméra","Spectre","img/trainers/kimera.png"], ["Charles","Acier","img/trainers/charles.png"], ["Gladys","Glace","img/trainers/gladys.png"], ["Tanguy","Électrik","img/trainers/tanguy.png"]],
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

// --- Conseil 4 (nom + type) — gen 1-5, vérifiés Poképédia (palier intermédiaire) ---
const PRO_CONSEIL_4 = {
  1: [["Olga","Glace","img/trainers/c4_1_olga.png"], ["Aldo","Combat","img/trainers/c4_1_aldo.png"], ["Agatha","Spectre","img/trainers/c4_1_agatha.png"], ["Peter","Dragon","img/trainers/c4_1_peter.png"]],
  2: [["Clément","Psy","img/trainers/c4_2_clement.png"], ["Koga","Poison","img/trainers/c4_2_koga.png"], ["Aldo","Combat","img/trainers/c4_2_aldo.png"], ["Marion","Ténèbres","img/trainers/c4_2_marion.png"]],
  3: [["Damien","Ténèbres","img/trainers/c4_3_damien.png"], ["Spectra","Spectre","img/trainers/c4_3_spectra.png"], ["Glacia","Glace","img/trainers/c4_3_glacia.png"], ["Aragon","Dragon","img/trainers/c4_3_aragon.png"]],
  4: [["Aaron","Insecte","img/trainers/c4_4_aaron.png"], ["Terry","Sol","img/trainers/c4_4_terry.png"], ["Adrien","Feu","img/trainers/c4_4_adrien.png"], ["Lucio","Psy","img/trainers/c4_4_lucio.png"]],
  5: [["Anis","Spectre","img/trainers/c4_5_anis.png"], ["Pieris","Ténèbres","img/trainers/c4_5_pieris.png"], ["Percila","Psy","img/trainers/c4_5_percila.png"], ["Kunz","Combat","img/trainers/c4_5_kunz.png"]],
};

// Couleurs de types (vignette dresseur)
const PRO_TYPE_COLORS = {
  "Normal": "#9aa0a6", "Feu": "#ff7043", "Eau": "#4f8fef", "Plante": "#5cb85c", "Électrik": "#f2c037",
  "Glace": "#69c9d0", "Combat": "#d94f4f", "Poison": "#a557c4", "Sol": "#d9a441", "Vol": "#7aa7ff",
  "Psy": "#f25f9a", "Insecte": "#9bbe2e", "Roche": "#c9a23a", "Spectre": "#6b5ca5", "Dragon": "#5e54d6",
  "Ténèbres": "#5a5566", "Acier": "#7aa0b5", "Fée": "#f29ad0",
};

// --- Barème (réglable) ---
const PRO_TUNING = {
  weatherPerMon: 40,
  monoType: 250, rainbow: 180, colossusPerMon: 50, colorFamily: 80, finalEvoPerMon: 20,
  gymTypePerMon: 35,
  conseilTypePerMon: 45,
  masterTypePerMon: 55, masterAce: 250,
};

function proMonTypes(m) { return [m.type1, m.type2].filter(Boolean); }
function proTypeColor(t) { return PRO_TYPE_COLORS[t] || "#5a6f96"; }

// Tire météo + dresseur pour une génération (rnd injectable pour tests / serveur)
function rollProModifiers(gen, rnd) {
  rnd = typeof rnd === "function" ? rnd : Math.random;
  const g = Number(gen) || 1;
  const weather = PRO_WEATHERS[Math.floor(rnd() * PRO_WEATHERS.length)];
  const gyms = PRO_GYM_LEADERS[g] || [];
  const master = PRO_LEAGUE_MASTERS[g] || null;
  const conseil = (typeof PRO_CONSEIL_4 !== "undefined" && PRO_CONSEIL_4[g]) || null;
  const pickGym = () => { const p = gyms[Math.floor(rnd() * gyms.length)]; return { name: p[0], type: p[1], tier: "arene", sprite: p[2] || "" }; };
  const pickC4 = () => { const c = conseil[Math.floor(rnd() * conseil.length)]; return { name: c[0], type: c[1], tier: "conseil", sprite: c[2] || "" }; };
  const pickMaster = () => ({ name: master.name, type: master.type, tier: "maitre", aceId: master.aceId, aceName: master.aceName });
  let trainer = null;
  const r = rnd();
  // Strict par génération : aucun repli sur une autre gen. Si la gen n'a aucun dresseur, trainer reste null.
  if (master && r < 0.18) trainer = pickMaster();
  else if (conseil && conseil.length && r < 0.45) trainer = pickC4();
  else if (gyms.length) trainer = pickGym();
  else if (conseil && conseil.length) trainer = pickC4();
  else if (master) trainer = pickMaster();
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
    const isConseil = tr.tier === "conseil";
    const per = isMaster ? tuning.masterTypePerMon : isConseil ? tuning.conseilTypePerMon : tuning.gymTypePerMon;
    const label = isMaster ? "👑 Maître" : isConseil ? "⚔️ Conseil 4" : "🎽 Champion";
    const hits = team.filter((m) => proMonTypes(m).includes(tr.type));
    add(`${label} ${tr.name} (${tr.type})`, hits.length * per, `${hits.length} Pokémon ${tr.type}`);
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

// Vignette dresseur (avatar type + nom + sous-titre)
function proTrainerSlotHtml(tr, esc, useSprite) {
  const col = proTypeColor(tr.type);
  const badge = tr.tier === "maitre" ? "👑" : tr.tier === "conseil" ? "⚔️" : "🎽";
  const role = tr.tier === "maitre" ? "Maître" : tr.tier === "conseil" ? "Conseil 4" : "Champion";
  const avatar = (useSprite && tr.sprite)
    ? `<img class="dpr-trainer-sprite" src="${esc(tr.sprite)}" alt="${esc(tr.name)}" />`
    : `<span class="dpr-trainer-avatar" style="background:${col}">${badge}</span>`;
  return `${avatar}<span class="dpr-roll-label">${esc(tr.name)}<small>${role} · ${esc(tr.type)}</small></span>`;
}

// --- Révélation INLINE (remplace les tuiles le temps de la séquence) ---
// opts : { isNewRecord, previousRecord, onDone, opponent:{nickname,total}|null }
function renderDraftProRevealInline(teamData, mods, result, opts) {
  opts = opts || {};
  const esc = (typeof escapeHtml === "function") ? escapeHtml : (s) => String(s);
  const mount = document.getElementById("draft-options");
  if (!mount) { if (typeof opts.onDone === "function") opts.onDone(); return; }

  const gen = (typeof draftArenaState !== "undefined" && draftArenaState && draftArenaState.selectedGen) || 1;
  const gyms = PRO_GYM_LEADERS[gen] || [];
  const tr = mods.trainer || {};
  const isMaster = tr.tier === "maitre";

  mount.className = "draft-pro-inline";
  mount.innerHTML =
    '<div class="dpr-card">' +
      '<div class="dpr-title">🎰 Bonus de fin de draft</div>' +
      '<div class="dpr-rolls">' +
        '<div class="dpr-roll is-spinning" id="dpr-weather"><span class="dpr-roll-emoji">🌀</span><span class="dpr-roll-label">Météo…</span></div>' +
        '<div class="dpr-roll is-spinning" id="dpr-trainer"><span class="dpr-trainer-avatar" style="background:#cdd8ee">❓</span><span class="dpr-roll-label">Dresseur…</span></div>' +
      '</div>' +
      '<ul class="dpr-bonuses" id="dpr-bonuses"></ul>' +
      '<div class="dpr-score"><span class="dpr-score-base">Base ' + result.base + '</span><span class="dpr-score-total" id="dpr-score-total">' + result.base + '</span></div>' +
      '<div class="dpr-verdict" id="dpr-verdict"></div>' +
      '<div class="dpr-actions"><button type="button" class="btn-red" id="dpr-close">Continuer</button></div>' +
    '</div>';

  const weatherEl = mount.querySelector("#dpr-weather");
  const trainerEl = mount.querySelector("#dpr-trainer");
  const bonusList = mount.querySelector("#dpr-bonuses");
  const scoreTotalEl = mount.querySelector("#dpr-score-total");
  const verdictEl = mount.querySelector("#dpr-verdict");

  // 1) Roue météo
  let ws = 0;
  const wheel = setInterval(() => {
    const w = PRO_WEATHERS[ws % PRO_WEATHERS.length];
    weatherEl.querySelector(".dpr-roll-emoji").textContent = w.emoji;
    weatherEl.querySelector(".dpr-roll-label").textContent = w.label;
    ws += 1;
    if (ws > 10) {
      clearInterval(wheel);
      weatherEl.classList.remove("is-spinning");
      weatherEl.classList.add("is-locked");
      weatherEl.querySelector(".dpr-roll-emoji").textContent = mods.weather.emoji;
      weatherEl.querySelector(".dpr-roll-label").textContent = mods.weather.label;
      if (!mods.trainer) {
        trainerEl.classList.remove("is-spinning");
        trainerEl.innerHTML = '<span class="dpr-trainer-avatar" style="background:#cdd8ee">—</span><span class="dpr-roll-label">Pas de dresseur<small>gen pas encore couverte</small></span>';
        setTimeout(revealBonuses, 320);
      } else {
        setTimeout(spinTrainer, 420);
      }
    }
  }, 105);

  // 2) Roue dresseur
  function spinTrainer() {
    let ts = 0;
    const reelPool = gyms.length ? gyms : [[tr.name, tr.type, tr.sprite || ""]];
    const reel = setInterval(() => {
      const g = reelPool[ts % reelPool.length];
      trainerEl.innerHTML = proTrainerSlotHtml({ name: g[0], type: g[1], tier: "arene" }, esc);
      ts += 1;
      if (ts > 11) {
        clearInterval(reel);
        trainerEl.classList.remove("is-spinning");
        trainerEl.classList.add("is-locked", isMaster ? "is-master" : "is-gym");
        trainerEl.innerHTML = proTrainerSlotHtml(tr, esc, true);
        const sp = trainerEl.querySelector(".dpr-trainer-sprite");
        if (sp) sp.addEventListener("error", function () { trainerEl.innerHTML = proTrainerSlotHtml(tr, esc, false); });
        setTimeout(revealBonuses, 480);
      }
    }, 95);
  }

  // 3) Bonus un par un — le score GRIMPE du montant de chaque bonus (effet d'addition)
  function revealBonuses() {
    let i = 0;
    let running = result.base;
    const step = () => {
      if (i >= result.bonuses.length) {
        scoreTotalEl.textContent = result.total;
        scoreTotalEl.classList.add("is-pop");
        setTimeout(showVerdict, 150);
        return;
      }
      const b = result.bonuses[i];
      const li = document.createElement("li");
      li.innerHTML = `<span>${esc(b.label)}${b.detail ? ` <em>${esc(b.detail)}</em>` : ""}</span><b>+${b.points}</b>`;
      bonusList.appendChild(li);
      requestAnimationFrame(() => li.classList.add("is-in"));
      // le compteur saute de +b.points
      const from = running, to = running + b.points; running = to;
      const start = Date.now(), dur = 480;
      const tick = () => {
        const t = Math.min(1, (Date.now() - start) / dur);
        const eased = 1 - Math.pow(1 - t, 3);
        scoreTotalEl.textContent = Math.round(from + (to - from) * eased);
        if (t < 1) requestAnimationFrame(tick); else scoreTotalEl.textContent = to;
      };
      requestAnimationFrame(tick);
      scoreTotalEl.classList.remove("is-bump"); void scoreTotalEl.offsetWidth; scoreTotalEl.classList.add("is-bump");
      i += 1;
      setTimeout(step, 640);
    };
    step();
  }
  function showVerdict() {
    if (opts.isNewRecord) {
      verdictEl.innerHTML = `🏆 NOUVEAU RECORD PRO ! <small>(avant : ${opts.previousRecord || 0})</small>`;
      verdictEl.classList.add("is-record");
    } else if (opts.opponent) {
      const won = result.total > opts.opponent.total, tie = result.total === opts.opponent.total;
      verdictEl.innerHTML = tie ? "🤝 Égalité !" : won ? "🏆 VICTOIRE !" : "💀 Défaite";
      verdictEl.classList.add(tie ? "is-tie" : won ? "is-win" : "is-lose");
    } else {
      verdictEl.textContent = `Bonus total : +${result.bonusTotal}`;
    }
  }

  const closeBtn = mount.querySelector("#dpr-close");
  if (closeBtn) closeBtn.addEventListener("click", () => { if (typeof opts.onDone === "function") opts.onDone(); });
}

// Synchronise l'affichage (bascule + titre) avec le drapeau PRO courant
function syncScoreAttackProUI() {
  if (typeof draftArenaState === "undefined" || !draftArenaState) return;
  const pro = !!draftArenaState.scoreAttackPro;
  const n = document.getElementById("dpa-mode-normal");
  const p = document.getElementById("dpa-mode-pro");
  if (n) n.classList.toggle("is-active", !pro);
  if (p) p.classList.toggle("is-active", pro);
  const card = document.getElementById("draft-mode-card");
  const title = card && card.querySelector(".card-title");
  if (title && draftArenaState.mode === "scoreAttack") {
    title.innerHTML = pro
      ? '<span class="dpa-pro-tag">🔥 SCORE ATTACK <b>PRO</b></span>'
      : '🎯 Draft Score Attack';
  }
  const screen = document.getElementById("screen-draft-score-attack");
  if (screen) screen.classList.toggle("is-pro-mode", pro);
}

// Bascule Normal / PRO (boutons segmentés)
function setScoreAttackProMode(pro) {
  if (typeof draftArenaState === "undefined" || !draftArenaState) return;
  draftArenaState.scoreAttackPro = !!pro;
  syncScoreAttackProUI();
  if (draftArenaState.mode === "scoreAttack" && draftArenaState.selectedGen && (draftArenaState.team || []).length > 0 && draftArenaState.phase === "draft" && typeof selectDraftGeneration === "function") {
    selectDraftGeneration(draftArenaState.selectedGen);
  } else if (typeof renderDraftArena === "function") {
    renderDraftArena();
  }
}

// Finale PRO solo : tire météo+dresseur, calcule, révèle (inline), enregistre le record
function runDraftProFinale() {
  if (typeof draftArenaState === "undefined" || !draftArenaState) return;
  const teamData = buildProTeamData(draftArenaState.team);
  const mods = rollProModifiers(draftArenaState.selectedGen);
  const result = computeDraftProScore(teamData, mods);
  const gen = draftArenaState.selectedGen;
  const previousRecord = getDraftProRecord(gen);
  const isNewRecord = updateDraftProRecord(gen, result.total);
  if (typeof awardXp === "function") awardXp(Math.round(result.total / 12), "Score Attack PRO " + result.total);
  if (typeof progressQuest === "function") { try { progressQuest("draft_complete", 1); } catch (e) {} }

  // On reste en phase "draft" pendant la révélation (tuiles remplacées), bascule en "result" à "Continuer".
  if (typeof renderDraftArena === "function") renderDraftArena();
  renderDraftProRevealInline(teamData, mods, result, {
    isNewRecord: isNewRecord,
    previousRecord: previousRecord,
    onDone: function () {
      if (typeof draftArenaState === "undefined" || !draftArenaState) return;
      const power = function (m) { return (typeof getDraftCachedPokemonPowerData === "function" ? Number(getDraftCachedPokemonPowerData(m.pokemon).statGlobal) : 0) || 0; };
      const mvp = (draftArenaState.team || []).slice().sort(function (a, b) { return power(b) - power(a); })[0];
      draftArenaState.phase = "result";
      draftArenaState.runSummary = {
        status: "Score PRO " + result.total + (isNewRecord ? " 🏆 NOUVEAU RECORD !" : ""),
        mvpName: (mvp && mvp.pokemon && mvp.pokemon.name) || "-",
        balanceLabel: "Base " + result.base + " · Bonus +" + result.bonusTotal,
        offenseLabel: mods.weather.emoji + " " + mods.weather.label + " · " + (mods.trainer.tier === "maitre" ? "👑 " : "🎽 ") + mods.trainer.name,
      };
      draftArenaState.message = isNewRecord
        ? ("🏆 NOUVEAU RECORD PRO Gen " + gen + " : " + result.total + " !")
        : ("Score Attack PRO terminé : " + result.total + " points.");
      const mount = document.getElementById("draft-options");
      if (mount) mount.className = "draft-options-grid";
      if (typeof renderDraftArena === "function") renderDraftArena();
    },
  });
}
