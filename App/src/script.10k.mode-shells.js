
// Common frame for different mechanics. The boards, timers, scoring and replay
// actions stay owned by their existing controllers.
const DEDICATED_SHELLS = {
  "screen-higher-lower": { label: "Higher / Lower", mode: "higher-lower", ranking: "higherlower", help: "Observe la statistique du Pokémon de gauche. Compare avec celui de droite, puis choisis plus ou moins.", state: () => higherLowerState },
  "screen-type-combo": { label: "Combo de types", mode: "type-combo", ranking: "typecombo", help: "Lis les deux types. Propose un Pokémon qui possède cette combinaison. Enchaîne les combos pendant 60 secondes.", state: () => typeComboState },
  "screen-speedrun": { label: "Speedrun", mode: "speedrun", help: "Observe le sprite. Tape son nom ou passe si tu hésites. Retrouve le maximum de Pokémon en 60 secondes.", state: () => speedrunState },
  "screen-poke-connections": { label: "Connexions Pokémon", mode: "poke-connections", help: "Sélectionne quatre Pokémon ayant un lien commun. Valide le groupe et découvre les quatre familles.", state: () => pokeConnectionsState },
  "screen-odd-one-out": { label: "Intrus Pokémon", mode: "odd", ranking: "intrus", help: "Observe les six Pokémon. Cinq ont un point commun : choisis l’intrus, puis lis l’explication." },
  "screen-draft-arena": { label: "Draft Pokémon", mode: "draft-arena", help: "Construis ton équipe avec les choix proposés. Compare les types et les statistiques, puis lance les combats.", state: () => draftArenaState },
  "screen-draft-score-attack": { label: "Draft Score Attack", mode: "draft-score-attack", ranking: "draft", help: "Construis une équipe de six Pokémon. Recherche les synergies pour améliorer ton score.", state: () => draftArenaState },
  "screen-stat-clash": { label: "Clash de stats", mode: "stat-clash", help: "Compare les Pokémon en main. Choisis une statistique disponible et découvre le résultat du duel." },
  "screen-stat-auction": { label: "Enchères de stats", mode: "stat-auction", help: "Observe le Pokémon proposé. Mise dans la limite de ton budget pour construire ta meilleure équipe." },
};
function prepareDedicatedShell(id) {
  const meta = DEDICATED_SHELLS[id], screen = document.getElementById(id);
  if (!meta || !screen) return;
  const card = screen.querySelector(".gameplay-screen-card");
  if (!card) return;
  screen.classList.add("focused-mode-screen");
  let toolbar = card.querySelector(".dedicated-toolbar");
  if (!toolbar) {
    toolbar = document.createElement("div"); toolbar.className = "dedicated-toolbar";
    toolbar.innerHTML = '<button class="btn-ghost" data-action="goToConfig">← Jeux</button><span class="shell-mode">'+escapeHtml(meta.label)+'</span><details class="dedicated-help"><summary>Comment jouer</summary><p>'+escapeHtml(meta.help)+'</p></details>';
    card.prepend(toolbar);
  }
  if(id === "screen-odd-one-out" && !toolbar.querySelector(".generation-trigger")){
    const button=document.createElement("button");button.className="generation-trigger";button.dataset.action="openGenerationPicker";button.dataset.args='["odd"]';button.textContent="Générations";toolbar.appendChild(button);
  }
  const state = meta.state?.();
  const finished = ["gameover", "result", "finished"].includes(state?.phase);
  screen.dataset.finished = String(finished);
  // Keep real-time multiplayer ranking and room controls intact.
  screen.dataset.shell = state?.mode === "versus" ? "" : "focused";
  if (screen.dataset.shell && typeof clearLiveRankHud === "function") clearLiveRankHud(id);
  let footer = card.querySelector(".dedicated-result-footer");
  if (!finished || state?.mode === "versus") { footer?.remove(); return; }
  if (!footer) { footer = document.createElement("section"); footer.className = "dedicated-result-footer"; card.appendChild(footer); }
  const stats = shellRecentStats(matchHistory, meta.mode);
  const ranking = id === "screen-higher-lower" && state?.mode === "rush60" ? "higherlower60" : meta.ranking;
  const statsHtml = stats.played ? '<p class="shell-stats-caption">Historique récent de ce jeu</p><div class="shell-stats-grid">'+[[stats.played,"Parties"],[stats.wins,"Victoires"],[stats.current,"Série"],[stats.best,"Meilleure série"]].map(([n,l])=>'<div><strong>'+n+'</strong><span>'+l+'</span></div>').join('')+'</div>' : '';
  footer.innerHTML = statsHtml+'<div class="dedicated-result-actions">'+(ranking ? '<button class="btn-ghost" data-action="openLeaderboardV2" data-args="'+escapeHtml(JSON.stringify([ranking,"today"]))+'">Classement du jour</button>' : '')+'<button class="btn-blue" data-action="openAllModesScreen" data-args=\'["solo"]\'>Choisir le prochain jeu →</button></div>';
}
if (typeof window !== "undefined") {
  for (const [name, id] of [["renderHigherLowerScreen","screen-higher-lower"],["renderTypeComboScreen","screen-type-combo"],["renderSpeedrunScreen","screen-speedrun"],["renderPokeConnectionsScreen","screen-poke-connections"],["renderDraftArena","screen-draft-arena"],["renderStatAuctionScreen","screen-stat-auction"]]) {
    const original = window[name];
    if (typeof original !== "function") continue;
    window[name] = function() { const result = original.apply(this, arguments); prepareDedicatedShell(name === "renderDraftArena" && !document.getElementById("screen-draft-score-attack")?.classList.contains("hidden") ? "screen-draft-score-attack" : id); return result; };
  }
}
