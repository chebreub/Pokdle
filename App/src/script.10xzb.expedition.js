
// ===== 🧭 L'Expédition de la semaine (3/11/2026, maquette « ce qui manque au plan ») =====
// Le serveur (lib/poke-balls.js) calcule tout : région, objectif commun, participations, coffres, légendaire.
let expeditionState = null, expeditionAt = 0;
let drattakPrestigeState = null, drattakPrestigeAt = 0;
function loadDrattakPrestige(force = false) {
  if (!force && drattakPrestigeState && Date.now() - drattakPrestigeAt < 120000) return Promise.resolve(drattakPrestigeState);
  return expeditionFetch("/api/prestige/drattak").then((data) => {
    if (data?.ok && data.prestige) {
      drattakPrestigeState = data.prestige;
      drattakPrestigeAt = Date.now();
      const body = document.querySelector("#overlay-body .exp");
      if (body && expeditionState && typeof ensureOverlay === "function") {
        ensureOverlay("🧭 Expédition de la semaine", expeditionHtml(expeditionState));
      }
    }
    return drattakPrestigeState;
  });
}
function drattakPrestigeHtml() {
  const p = drattakPrestigeState;
  if (!p) return '<section class="exp-card exp-prestige"><h4>🐉 Le rêve de Draby</h4><p class="exp-note">Chargement des indices et de ta progression…</p></section>';
  const line = p.hasLineage
    ? '<span>✅ La lignée retrouvée : ' + (p.lineageIds.includes(371) ? 'Draby' : 'Drackhaus') + ' a été capturé avec une Ball.</span>'
    : '<span>🔒 Retrouve et capture un Draby ou un Drackhaus dans les hautes herbes. Ils vivent notamment près du volcan.</span>';
  const trials = [
    ['cry','Cri','Le murmure des falaises','Un cri de Dragon résonne au pied de la falaise.'],
    ['silhouette','Silhouette','L’ombre sans ailes','Une silhouette immobile, protégée par une cuirasse, contemple le ciel.'],
    ['description','Description','La mémoire de la pierre','Ce Pokémon n’est ni le premier rêveur, ni celui qui vole enfin.']
  ];
  const retry = p.recovery?.active && !p.eligible;
  const displayGoal = retry ? p.recovery.goal : p.goal;
  const trialsHtml = trials.map(([mode,label,title,clue]) => {
    const won = Number(p.wins?.[mode] || 0),goal = Number(displayGoal?.modes?.[mode] || 3);
    const done = won >= goal;
    return '<div class="exp-prestige-trial"><b>' + (done ? '✅ ' : '🔒 ') + label + ' · ' + Math.min(won,goal) + '/' + goal + '</b>' +
      '<span>' + (done ? '✦ ' + title + ' : ' + clue : 'Gagne ' + goal + ' parties vérifiées en mode ' + label + ' pour révéler cet indice.') + '</span></div>';
  }).join("");
  const days = '<p class="exp-note">📅 ' + Math.min(p.days,displayGoal.days) + '/' + displayGoal.days +
    ' jours de réussite dans ces modes, sur une période de 30 jours. Une victoire par mode et par jour compte.</p>';
  const retryInfo = retry ? '<p class="exp-note">🐉 Seconde chance unique après la première fuite : ' +
    '3 nouveaux jours et 2 victoires par mode, délai de 21 jours. Rencontre ouverte le samedi et le dimanche (heure de Paris). ' +
    'Après cette reprise, les conditions complètes redeviennent nécessaires.</p>' : '';
  let next = '';
  if (p.needsAccount) next = '<p class="exp-note">Connecte-toi pour garder tes preuves de jeu et débloquer la rencontre.</p>';
  else if (p.cooldown) next = '<p class="exp-note">Drattak a quitté les falaises. Nouvelle tentative à partir du ' +
    escapeHtml(p.nextAttemptDay.split("-").reverse().join("/")) + ', après de nouvelles épreuves.</p>';
  else if (retry && p.recovery.ready && !p.recovery.weekendOpen) next = '<p class="exp-note">🐉 L’événement de seconde chance ouvre le samedi et le dimanche. ' +
    'Prochain rendez-vous : ' + escapeHtml(p.recovery.nextEventDay.split("-").reverse().join("/")) + '.</p>';
  else if (p.available) next = '<div class="exp-prestige-riddle"><strong>✦ ' +
    (retry ? 'Seconde chance · week-end' : 'Le secret de la falaise') + '</strong>' +
    '<p>« Entre celui qui rêvait de voler et celui qui déploie ses ailes, je demeure immobile dans mon armure. Qui suis-je ? »</p>' +
    '<label for="prestige-drattak-answer">Le nom du Pokémon</label>' +
    '<input id="prestige-drattak-answer" type="text" maxlength="50" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Ta réponse" />' +
    '<button type="button" class="exp-legend-cta" data-action="meetPrestigeDrattak">🐉 Ouvrir le passage vers Drattak</button>' +
    '<p class="exp-note">La bonne réponse permet une rencontre, pas une capture garantie. Trois lancers maximum avec tes Balls : Poké ' +
    p.chances.poke + ' %, Super ' + p.chances.great + ' %, Hyper ' + p.chances.ultra + ' % par lancer.</p></div>';
  else next = '<p class="exp-note">Termine les étapes pour déchiffrer le secret de la falaise et débloquer ta rencontre.</p>';
  return '<section class="exp-card exp-prestige"><h4>🐉 Le rêve de Draby · Quête de Drattak</h4>' +
    '<p class="exp-note">Dans les jeux Pokémon, Draby rêvait de voler en s’élançant des falaises. Sur Pokédle, suis sa lignée et retrouve les indices cachés dans trois modes.</p>' +
    '<div class="exp-prestige-lineage">' + line + '</div>' + retryInfo + trialsHtml + days + next + '</section>';
}

function meetPrestigeDrattak() {
  const answer = document.getElementById("prestige-drattak-answer")?.value?.trim() || "";
  if (!answer) { if (typeof showToast === "function") showToast("Entre ta réponse à l’énigme de la falaise."); return; }
  return expeditionPrepareEncounter("prestige", answer);
}
function expeditionPerformPrestige(answer) {
  const scope = typeof ballState !== "undefined" && ballState?.actionScope;
  if (!scope) { if (typeof showToast === "function") showToast("Ouvre ton sac ou recharge la page avant de tenter la rencontre."); return; }
  return expeditionFetch("/api/prestige/drattak/meet",{actionScope:scope,answer}).then((data) => {
    if (!data?.ok) {
      const message = { prestige_not_ready:"Épreuve non terminée.",prestige_riddle_wrong:"L’inscription ne réagit pas… Relis les indices de la falaise.",prestige_need_three_balls:"Il te faut au moins trois Balls pour ne pas perdre une rare occasion de rencontre.",prestige_cooldown:"Nouvelle tentative pas encore disponible.",prestige_event_closed:"Le passage de la seconde chance ouvre le samedi et le dimanche.",
        encounter_open:"Termine d’abord ta rencontre en cours.",no_balls:"Tu dois posséder au moins une Ball.",
        account_required:"Connecte-toi pour ce défi.",account_changed:"Recharge la page après ton changement de compte." }[data?.error] || "Rencontre indisponible. Réessaie.";
      // Une requête peut avoir réussi alors que sa réponse s'est perdue.
      // Reprendre l'unique rencontre ouverte plutôt que brûler une nouvelle tentative.
      if (["prestige_cooldown","encounter_open"].includes(data?.error) && typeof refreshBalls === "function") {
        return refreshBalls({announce:false}).then((current) => {
          if (current?.wild?.open?.prestige && typeof renderWildEncounter === "function") {
            if (typeof closeOverlayModal === "function") closeOverlayModal();
            renderWildEncounter(current);
            return;
          }
          if (typeof showToast === "function") showToast(message);
        });
      }
      if (typeof showToast === "function") showToast(message);
      return;
    }
    if (typeof closeOverlayModal === "function") closeOverlayModal();
    if (typeof ballApply === "function") ballApply(data,{announce:false});
    if (typeof renderWildEncounter === "function") renderWildEncounter(data,null,true);
    drattakPrestigeAt = 0;
    const pokemon = typeof POKEMON_BY_ID !== "undefined" ? POKEMON_BY_ID.get(373) : null;
    if (pokemon && typeof playPokemonCry === "function") try { playPokemonCry(pokemon,0.6); } catch (_e) {}
  });
}
window.meetPrestigeDrattak = meetPrestigeDrattak;

 // ECO-07 — une confirmation purement client, avant tout appel POST ouvrant une rencontre.
 // Les stocks, conditions d'accès et probabilités restent strictement décidés par le serveur.
let expeditionPendingEncounter = null;
let expeditionOpeningEncounter = false;
let expeditionPreflightSerial = 0;
function expeditionPreflightHtml(kind, bag, chances) {
  const prestige = kind === "prestige";
  const total = ["poke", "great", "ultra"].reduce((n, k) => n + Math.max(0, Number(bag?.[k]) || 0), 0);
  const required = prestige ? 3 : 1; // Contraintes existantes du serveur, jamais une nouvelle règle.
  const rows = [["poke", "Poké Ball"], ["great", "Super Ball"], ["ultra", "Hyper Ball"]]
    .map(([k, label]) => '<li>' + ballImg(k, 22) + '<span>' + label + ' : <b>' + Math.max(0, Number(bag?.[k]) || 0) +
      '</b> disponible(s) · <b>' + Math.max(0, Number(chances?.[k]) || 0) + ' %</b> par lancer</span></li>').join("");
  const warning = total < required
    ? '<p class="exp-note">🔒 Stock insuffisant : ' + (prestige ? 'Drattak exige au moins 3 Balls.' : 'Il faut au moins 1 Ball.') + '</p>'
    : total < 3 ? '<p class="exp-note">⚠️ Avec ' + total + ' Ball' + (total > 1 ? 's' : '') +
      ', tu ne pourras pas effectuer les 3 lancers si les premiers échouent. La règle actuelle reste inchangée.</p>'
      : '<p class="exp-note">Tu disposes de suffisamment de Balls pour trois lancers.</p>';
  return '<div class="exp exp-preflight"><section class="exp-card exp-prestige">' +
    '<h4>' + (prestige ? '🐉 Se préparer à Drattak' : '👑 Se préparer au légendaire') + '</h4>' +
    '<p class="exp-note">Tu as ' + total + ' Ball' + (total > 1 ? 's' : '') +
    '. Trois lancers maximum, une Ball dépensée à chaque lancer et aucune capture garantie.</p>' +
    '<ul class="ball-gains">' + rows + '</ul>' + warning +
    '<p class="exp-note">Annuler maintenant ne crée aucune rencontre, ne dépense aucune Ball et conserve ta progression.</p>' +
    '<div class="challenge-actions">' +
    (total >= required ? '<button type="button" class="exp-legend-cta" data-action="expeditionConfirmEncounter">Commencer la rencontre</button>' : '') +
    '<button type="button" class="btn-ghost" data-action="expeditionCancelEncounter">Annuler · garder ma progression</button>' +
    '</div></section></div>';
}
function expeditionPrepareEncounter(kind, answer) {
  if (expeditionOpeningEncounter) return Promise.resolve();
  // L'écran montre toujours le sac et l'éligibilité actualisés ; aucun POST de rencontre ici.
  const serial = ++expeditionPreflightSerial;
  const detail = kind === "prestige" ? loadDrattakPrestige(true) : loadExpedition(true);
  return Promise.all([refreshBalls({ announce: false }), detail]).then(([state, progress]) => {
    const overlay = document.getElementById("overlay-modal");
    if (serial !== expeditionPreflightSerial || !overlay || overlay.classList.contains("hidden")) return;
    if (!state?.bag || !progress || (kind === "prestige" ? !progress.available : !progress.legend?.available)) {
      if (typeof showToast === "function") showToast("Rencontre indisponible : vérifie ta progression et ton sac.");
      return;
    }
    if (kind === "prestige" && !state.actionScope) {
      if (typeof showToast === "function") showToast("Recharge ton sac avant d'ouvrir le passage.");
      return;
    }
    expeditionPendingEncounter = { kind, answer: kind === "prestige" ? answer : null };
    if (typeof ensureOverlay === "function") ensureOverlay("Préparer ma rencontre",
      expeditionPreflightHtml(kind, state.bag, kind === "prestige" ? progress.chances : progress.legendChances));
  }).catch(() => {
    if (typeof showToast === "function") showToast("Impossible de vérifier ton sac pour le moment.");
  });
}
function expeditionCancelEncounter() {
  expeditionPreflightSerial++;
  expeditionPendingEncounter = null;
  if (typeof openExpedition === "function") openExpedition();
}
function expeditionConfirmEncounter() {
  const pending = expeditionPendingEncounter;
  if (!pending || expeditionOpeningEncounter || !document.querySelector("#overlay-body .exp-preflight")) return;
  expeditionPreflightSerial++;
  expeditionPendingEncounter = null;
  expeditionOpeningEncounter = true;
  return Promise.resolve(pending.kind === "prestige"
    ? expeditionPerformPrestige(pending.answer) : expeditionPerformLegend())
    .finally(() => { expeditionOpeningEncounter = false; });
}
window.expeditionCancelEncounter = expeditionCancelEncounter;
window.expeditionConfirmEncounter = expeditionConfirmEncounter;

function expeditionFetch(url, body) {
  const opts = body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" } : { credentials: "same-origin" };
  return fetch(url, opts).then((r) => r.json().catch(() => null)).catch(() => null);
}
function loadExpedition(force) {
  if (!force && expeditionState && Date.now() - expeditionAt < 120000) return Promise.resolve(expeditionState);
  return expeditionFetch("/api/expedition").then((d) => {
    if (d && d.ok && d.expedition) { expeditionState = d.expedition; expeditionAt = Date.now(); if (typeof renderBallHomeCard === "function") renderBallHomeCard(); }
    return expeditionState;
  });
}
function expeditionLegend(e) { return typeof POKEMON_BY_ID !== "undefined" ? POKEMON_BY_ID.get(Number(e.legendId)) : null; }
// Applies to the new server-provided 72-hour window; the server decides expiry.
function expeditionLegendExpiryText(iso) {
  if (!iso || !Number.isFinite(Date.parse(iso))) return "à la fin de la journée";
  return new Intl.DateTimeFormat("fr-FR", {timeZone:"Europe/Paris",weekday:"long",day:"numeric",
    month:"long",hour:"2-digit",minute:"2-digit"}).format(new Date(iso));
}
function resumeExpeditionLegend() {
  // GET state first: never re-open, re-roll or debit a Ball by resuming.
  if (typeof refreshBalls !== "function") return Promise.resolve();
  return refreshBalls({announce:false}).then((state) => {
    if (state?.wild?.open?.legend && typeof renderWildEncounter === "function") {
      if (typeof closeOverlayModal === "function") closeOverlayModal();
      renderWildEncounter(state);
    } else {
      if (typeof showToast === "function") showToast("Cette rencontre n'est plus disponible.");
      expeditionAt = 0;
      openExpedition();
    }
  });
}
window.resumeExpeditionLegend = resumeExpeditionLegend;
const EXP_DAY_NAMES = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

// La bannière de « Ta journée ».
function expeditionBannerHtml() {
  const e = expeditionState;
  if (!e) return "";
  const p = expeditionLegend(e);
  const ready = e.chests.some((c) => c.canClaim);
  const held = e.legend?.pending?.kind === "legend";
  const line = held ? "👑 Une rencontre légendaire est à reprendre" : e.legend.available ? "100 % : " + (p ? p.name : "le légendaire") + " t’attend !" : ready ? e.pct + " % · un coffre à ouvrir !" : e.pct + " % · " + e.progress + " / " + e.goal + " participations";
  return '<button type="button" class="day-exp" data-action="openExpedition">' + (p ? '<img src="' + escapeHtml(pokedexDetailArtwork(p, false)) + '" alt="" aria-hidden="true">' : "") +
    '<small>🧭 EXPÉDITION · ' + escapeHtml(e.region.toUpperCase()) + '</small><b>' + escapeHtml(line) + '</b><span class="day-exp-bar"><i style="width:' + e.pct + '%"></i></span></button>';
}
if (typeof renderBallHomeCard === "function") {
  const renderBallHomeCardBeforeExp = renderBallHomeCard;
  renderBallHomeCard = function () {
    const out = renderBallHomeCardBeforeExp.apply(this, arguments);
    const tiles = document.querySelector("#home-balls .day-tiles");
    if (tiles && expeditionState && !document.querySelector("#home-balls .day-exp")) tiles.insertAdjacentHTML("beforebegin", expeditionBannerHtml());
    if (!expeditionState || Date.now() - expeditionAt > 120000) loadExpedition();
    return out;
  };
}

function expeditionHtml(e) {
  const p = expeditionLegend(e), name = p ? escapeHtml(p.name) : "le légendaire";
  const chests = e.chests.map((c) => '<div class="exp-chest' + (c.claimed ? " is-open" : c.reached ? " is-ready" : "") + '"><span aria-hidden="true">' + (c.claimed ? "✅" : c.reached ? "🎁" : "🔒") + '</span><b>' + c.tier + ' %</b><small>' +
    c.balls.map((b) => ballImg(b, 18)).join("") + '</small></div>').join("") +
    '<div class="exp-chest is-legend' + (e.legend.reached ? " is-ready" : "") + '"><span aria-hidden="true">👑</span><b>100 %</b><small>' + name + '</small></div>';
  const claimable = e.chests.filter((c) => c.canClaim);
  // A legacy partially paid chest displays only the Balls still due.
  const nBalls = claimable.reduce((n, c) => n + (Number.isInteger(c.remainingBalls) ? c.remainingBalls : c.balls.length), 0);
  const days = e.days.map((d, i) => '<span class="' + (e.myDays.includes(d) ? "on" : "") + '"><i>' + (e.myDays.includes(d) ? "✓" : "·") + '</i>' + EXP_DAY_NAMES[i] + '</span>').join("");
  let legend;
  if (e.legend.pending?.kind === "legend") {
    const old = typeof POKEMON_BY_ID !== "undefined" ? POKEMON_BY_ID.get(Number(e.legend.pending.pokemonId)) : null;
    const heldName = escapeHtml(old ? old.name : "ton légendaire");
    legend = '<p class="exp-legend-msg">👑 ' + heldName + ' t’attend toujours !' +
      (e.legend.pending.expiresAt ? ' Rencontre conservée jusqu’au ' + escapeHtml(expeditionLegendExpiryText(e.legend.pending.expiresAt)) + '.' : '') +
      ' Même après le changement de semaine, tu reprends les lancers restants sans nouveau tirage.</p>' +
      '<button type="button" class="exp-legend-cta" data-action="resumeExpeditionLegend">Reprendre ma rencontre</button>';
  }
  else if (e.legend.pending) legend = '<p class="exp-legend-msg">Termine ta rencontre en cours avant de tenter un autre légendaire.</p>';
  else if (e.legend.status === "caught") legend = '<p class="exp-legend-msg">🎉 Tu as attrapé ' + name + ' cette semaine !</p>';
  else if (e.legend.status) legend = '<p class="exp-legend-msg">' + name + ' s’est échappé cette semaine. Il reviendra avec une autre région.</p>';
  else if (e.legend.available) legend = '<button type="button" class="exp-legend-cta" data-action="meetExpeditionLegend">👑 Rencontrer ' + name + '</button><p class="exp-note">3 lancers, son vrai taux de capture : ' + e.legendChances.poke + ' % avec une Poké Ball, ' + e.legendChances.great + ' % Super, ' + e.legendChances.ultra + ' % Hyper.</p>';
  else if (e.legend.reached && e.legend.needsAccount) legend = '<p class="exp-legend-msg">La jauge est pleine ! Crée un compte pour tenter ' + name + '. <a href="/auth/discord">Discord</a> · <a href="/auth/google">Google</a> · <a href="/auth/twitch">Twitch</a></p>';
  else if (e.legend.reached) legend = '<p class="exp-legend-msg">La jauge est pleine ! Encore ' + e.legend.needsDays + ' participation' + (e.legend.needsDays > 1 ? "s" : "") + ' cette semaine pour tenter ' + name + '.</p>';
  else legend = '<p class="exp-note">À 100 % : une rencontre avec ' + name + ' pour chaque participant (2 jours au moins, avec un compte). Son vrai taux de capture, rien de garanti.</p>';
  return '<div class="exp">' +
    '<div class="exp-hero">' + (p ? '<img src="' + escapeHtml(pokedexDetailArtwork(p, false)) + '" alt="" aria-hidden="true">' : "") +
      '<small>SEMAINE DU ' + escapeHtml(e.week.split("-").reverse().slice(0, 2).join("/")) + ' · ' + escapeHtml(e.region.toUpperCase()) + '</small><h3>Réveiller ' + name + '</h3>' +
      '<p>' + (e.progress >= e.goal ? e.progress + ' participations (objectif ' + e.goal + ' atteint)' : e.progress + ' / ' + e.goal + ' participations') + ' · ' + e.participants + ' dresseur' + (e.participants > 1 ? "s" : "") + ' cette semaine</p>' +
      '<div class="exp-bar" role="img" aria-label="' + e.pct + ' %"><i style="width:' + e.pct + '%"></i></div><b class="exp-pct">' + e.pct + ' %</b></div>' +
    '<section class="exp-card"><h4>🎁 Coffres de la semaine</h4><div class="exp-chests">' + chests + '</div>' +
      (nBalls ? '<button type="button" class="ball-gift-cta exp-open" data-action="claimExpeditionChests">Ouvrir mes coffres · +' + nBalls + ' Balls</button>' : "") +
      '<p class="exp-note">Les coffres non ouverts sont perdus dimanche à minuit.</p></section>' +
    '<section class="exp-card"><h4>Ta participation <span>' + e.myDays.length + ' jour' + (e.myDays.length > 1 ? "s" : "") + '</span></h4><div class="exp-days">' + days + '</div>' +
      '<p class="exp-note">1 participation = 2 jeux différents joués dans la journée (le cadeau ne compte pas).</p></section>' +
    '<section class="exp-card">' + legend + '</section>' + drattakPrestigeHtml() + '</div>';
}
function openExpedition() {
  const draw = () => { if (expeditionState && typeof ensureOverlay === "function") ensureOverlay("🧭 Expédition de la semaine", expeditionHtml(expeditionState)); };
  draw();
  const first = !expeditionState;
  loadDrattakPrestige(true);
  // Ne rouvre jamais la fenêtre fermée entre-temps (ouverture des coffres) : on redessine seulement celle qui est ouverte.
  loadExpedition(true).then(() => {
    const o = document.getElementById("overlay-modal"), open = o && !o.classList.contains("hidden");
    if ((open && document.querySelector("#overlay-body .exp")) || (first && !document.querySelector(".fx-reveal"))) draw();
  });
}
function claimExpeditionChests() {
  return expeditionFetch("/api/expedition/chests", {}).then((d) => {
    if (!d || !d.ok) { if (typeof showToast === "function") showToast("Les coffres n’ont pas pu s’ouvrir. Réessaie."); return; }
    if (typeof ballApply === "function") ballApply(d, { announce: false });
    expeditionState = d.expedition; expeditionAt = Date.now();
    const great = d.added.filter((a) => a.ball === "great").length, poke = d.added.length - great;
    if (typeof showToast === "function") showToast("🎁 Coffres ouverts : " + [poke ? "+" + poke + " Poké Ball" + (poke > 1 ? "s" : "") : "", great ? "+" + great + " Super Ball" + (great > 1 ? "s" : "") : ""].filter(Boolean).join(" · "));
    openExpedition();
  });
}
function meetExpeditionLegend() {
  return expeditionPrepareEncounter("legend");
}
function expeditionPerformLegend() {
  return expeditionFetch("/api/expedition/legend", {}).then((d) => {
    if (!d || !d.ok) {
      const msg = { no_balls: "Il te faut au moins une Ball pour le tenter.", encounter_open: "Finis d’abord ta rencontre dans les hautes herbes.", account_required: "Crée un compte pour le tenter." }[d && d.error] || "La rencontre n’a pas pu commencer.";
      if (typeof showToast === "function") showToast(msg); return;
    }
    if (typeof closeOverlayModal === "function") closeOverlayModal();
    if (typeof ballApply === "function") ballApply(d, { announce: false });
    if (typeof renderWildEncounter === "function") renderWildEncounter(d, null, true);
    const p = typeof POKEMON_BY_ID !== "undefined" ? POKEMON_BY_ID.get(Number(d.encounter.pokemonId)) : null;
    if (p && typeof playPokemonCry === "function") { try { playPokemonCry(p, 0.6); } catch (_e) {} }
    expeditionAt = 0;
  });
}
window.openExpedition = openExpedition;
window.claimExpeditionChests = claimExpeditionChests;
window.meetExpeditionLegend = meetExpeditionLegend;
