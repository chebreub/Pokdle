
// Shared presentation only: mode controllers remain responsible for game rules.
const GAME_SHELL_MODES = {
  normal: { title: "Pokémon mystère", instruction: "Croise les indices pour retrouver le Pokémon.", kicker: "À TON RYTHME" },
  daily: { title: "Le Pokémon du jour", instruction: "Un même mystère pour tout le monde. À toi de mener l’enquête.", kicker: "RENDEZ-VOUS QUOTIDIEN" },
  challenge: { title: "Le défi de ton ami", instruction: "Ton ami a choisi un Pokémon. Retrouve-le grâce aux indices.", kicker: "DÉFI AMICAL" },
  silhouette: { title: "Zoom progressif", instruction: "Observe le détail. Chaque essai élargit la vue.", kicker: "OUVRE L’ŒIL" },
  pixel: { title: "Pokémon pixelisé", instruction: "L’image devient plus nette à chaque proposition.", kicker: "UNE IMAGE À DÉCHIFFRER" },
  cry: { title: "Le cri mystère", instruction: "Écoute, reconnais, propose. Tu peux rejouer le cri à volonté.", kicker: "TENDS L’OREILLE" },
  mystery: { title: "Stat Mystère", instruction: "Observe les statistiques et croise-les avec les indices.", kicker: "DERRIÈRE LES CHIFFRES" },
  description: { title: "Description Pokédex", instruction: "Lis l’extrait du Pokédex pour retrouver son propriétaire.", kicker: "LE PORTRAIT MYSTÈRE" },
  quiz: { title: "Quiz Pokémon", instruction: "Choisis une réponse et découvre l’explication.", kicker: "À TOI DE JOUER", custom: true },
  weight: { title: "Duel de poids", instruction: "Quel Pokémon est le plus lourd ? Choisis ta réponse.", kicker: "FAIS PENCHER LA BALANCE", custom: true },
  evolution: { title: "Chaîne d’évolution", instruction: "Retrouve le Pokémon manquant dans la lignée.", kicker: "LE CHAÎNON MANQUANT", custom: true },
  order: { title: "Ordre Pokédex", instruction: "Retrouve l’entrée qui complète cette suite.", kicker: "UNE PLACE À RETROUVER", custom: true },
};

function shellRecentStats(history, mode) {
  const rows = (Array.isArray(history) ? history : []).filter(row => row.mode === mode);
  let current = 0, best = 0, run = 0;
  for (const row of [...rows].reverse()) {
    run = row.result === "win" ? run + 1 : 0;
    best = Math.max(best, run);
  }
  for (const row of rows) { if (row.result !== "win") break; current++; }
  return { played: rows.length, wins: rows.filter(row => row.result === "win").length, current, best };
}

// Only facts already disclosed by a comparison are used here. No target access.
function shellObservedFacts(rows) {
  const facts = new Map();
  const labels = { generation: ["Génération", "gen"], altForm: ["Forme alternative", "isAltForm"], type1: ["Type 1", "type1"], type2: ["Type 2", "type2"], habitat: ["Habitat", "habitat"], color: ["Couleur", "color"], stage: ["Stade", "stage"] };
  for (const row of rows) {
    const { pokemon: p, cmp } = row;
    for (const [key, [label, prop]] of Object.entries(labels)) {
      if (cmp[key] === "ok") facts.set(key, `${label} : ${key === "altForm" ? (p[prop] ? "oui" : "non") : (p[prop] || "aucun")}`);
    }
    for (const [key, label, unit] of [["height", "Taille", "m"], ["weight", "Poids", "kg"]]) {
      const value = Number(p[key]);
      if (cmp[key] === "ok") facts.set(key, `${label} : ${value} ${unit}`);
      else if (row[key + "Direction"] && !facts.has(key)) {
        const dir = row[key + "Direction"], mapKey = key + dir;
        const previous = facts.get(mapKey);
        const threshold = previous ? Number(previous.match(/([\d.]+) [mk]/)?.[1]) : null;
        if (threshold === null || (dir === "↑" ? value > threshold : value < threshold)) facts.set(mapKey, `${label} : ${dir === "↑" ? "plus" : "moins"} de ${value} ${unit}`);
      }
      if (cmp[key] === "ok") { facts.delete(key + "↑"); facts.delete(key + "↓"); }
    }
  }
  return [...facts.values()];
}

function prepareGameShell() {
  const shell = document.querySelector("#screen-game .classic-game-shell");
  if (!shell || shell.dataset.prepared) return;
  shell.dataset.prepared = "true";
  const history = document.getElementById("results-wrap");
  const command = shell.querySelector(".classic-game-command");
  const legend = history?.querySelector(".results-legend");
  shell.prepend(history);
  if (legend) command.after(legend);
  const guide = document.createElement("details");
  guide.className = "shell-guide";
  guide.innerHTML = '<summary>Comment mener l’enquête ?</summary><ol><li>Propose un Pokémon avec la recherche.</li><li>Compare les neuf indices : ✓ exact, ≈ partiel ou proche, × différent.</li><li>Croise les informations pour affiner ta prochaine proposition.</li></ol><p>Aucune limite d’essais. La forme alternative fait partie des indices ; les flèches concernent la taille et le poids.</p>';
  shell.appendChild(guide);
}

function renderGameShell() {
  const screen = document.getElementById("screen-game");
  if (!screen) return;
  const meta = GAME_SHELL_MODES[gameMode];
  screen.dataset.shell = meta ? "focused" : "";
  for (const id of ["shell-intro", "shell-mode"]) document.getElementById(id)?.classList.toggle("hidden", !meta);
  document.getElementById("shell-selector")?.classList.toggle("hidden", !["daily", "normal"].includes(gameMode));
  document.getElementById("shell-notebook")?.classList.toggle("hidden", !meta || !["daily", "normal", "challenge"].includes(gameMode) || gameOver);
  if (!meta) return;
  prepareGameShell();
  screen.dataset.mechanic = meta.custom ? "custom" : "comparison";
  screen.dataset.finished = String(Boolean(gameOver));
  document.getElementById("shell-mode").textContent = meta.title;
  document.getElementById("shell-title").textContent = meta.title;
  document.getElementById("shell-instruction").textContent = meta.instruction;
  const guide = screen.querySelector(".shell-guide");
  if (guide) guide.classList.toggle("hidden", Boolean(meta.custom));
  document.getElementById("shell-kicker").textContent = gameMode === "daily" ? `JOUR #${dailyServerState?.number || getDailyNumber()} · ` + new Date().toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", weekday: "long", day: "numeric", month: "long" }) : meta.kicker;
  document.getElementById("shell-daily")?.setAttribute("aria-pressed", String(gameMode === "daily"));
  document.getElementById("shell-infinite")?.setAttribute("aria-pressed", String(gameMode === "normal"));
  const rows = Array.from(document.querySelectorAll("#results-body tr"));
  const facts = shellObservedFacts((resultHistory || []).map((row, index) => ({ ...row, heightDirection: rows[index]?.dataset.heightDirection, weightDirection: rows[index]?.dataset.weightDirection })));
  document.getElementById("shell-facts").innerHTML = facts.length ? facts.map(text => `<span class="notebook-fact">✓ ${escapeHtml(text)}</span>`).join("") : '<p class="notebook-empty">Ton carnet est encore vierge. Chaque proposition t’aidera à le compléter.</p>';
  const best = Math.min(...(matchHistory || []).filter(row => row.mode === gameMode && row.result === "win" && row.attempts > 0).map(row => row.attempts));
  document.getElementById("shell-goal").textContent = Number.isFinite(best) && attempts === 0 ? `Ton record récent : ${best} essai${best > 1 ? "s" : ""}.` : Number.isFinite(best) && attempts + 1 < best ? `Objectif personnel : trouver en moins de ${best} essais.` : attempts ? `${attempts} essai${attempts > 1 ? "s" : ""} · Chaque indice compte. Continue à ton rythme.` : "Commence par un Pokémon que tu connais bien.";
  if (gameMode === "daily" && !attempts && typeof liveRankFetch === "function") {
    liveRankFetch("daily").then(data => {
      if (gameMode !== "daily" || attempts || gameOver) return;
      const record = Number(data?.top?.[0]?.score);
      if (record > 0) document.getElementById("shell-goal").textContent = `Record du jour : ${record} essai${record > 1 ? "s" : ""}. À toi de commencer ton enquête.`;
    }).catch(() => {});
  }
}

function renderShellResult() {
  const screen = document.getElementById("screen-game"), box = document.getElementById("win-box");
  if (!screen || screen.dataset.shell !== "focused" || !gameOver || !box || box.classList.contains("hidden")) return;
  renderGameShell();
  let stats = document.getElementById("shell-result-stats");
  if (!stats) { stats = document.createElement("div"); stats.id = "shell-result-stats"; box.querySelector(".win-inner").after(stats); }
  const data = shellRecentStats(matchHistory, gameMode);
  if (gameMode === "daily") { data.current = Number(playerStats.dailyCurrentStreak) || 0; data.best = Number(playerStats.dailyBestStreak) || 0; }
  stats.innerHTML = '<p class="shell-stats-caption">Historique récent de ce jeu · enregistré sur ton profil</p><div class="shell-stats-grid">' + [[data.played,"Parties"],[data.wins,"Victoires"],[data.current,gameMode === "daily" ? "Série en jours" : "Série de victoires"],[data.best,"Meilleure série"]].map(([value,label]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join("") + '</div>';
}

// Results are also rendered when restoring an already completed Daily. Let the
// existing accounting finish before reading its counters; do not award twice.
const renderGameOverBoxBeforeShell = renderGameOverBox;
renderGameOverBox = function(options) {
  const result = renderGameOverBoxBeforeShell.apply(this, arguments);
  queueMicrotask(renderShellResult);
  return result;
};
