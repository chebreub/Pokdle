
// ===== 🧭 L'Expédition de la semaine (3/11/2026, maquette « ce qui manque au plan ») =====
// Le serveur (lib/poke-balls.js) calcule tout : région, objectif commun, participations, coffres, légendaire.
let expeditionState = null, expeditionAt = 0;
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
const EXP_DAY_NAMES = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

// La bannière de « Ta journée ».
function expeditionBannerHtml() {
  const e = expeditionState;
  if (!e) return "";
  const p = expeditionLegend(e);
  const ready = e.chests.some((c) => c.canClaim);
  const line = e.legend.available ? "100 % : " + (p ? p.name : "le légendaire") + " t’attend !" : ready ? e.pct + " % · un coffre à ouvrir !" : e.pct + " % · " + e.progress + " / " + e.goal + " participations";
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
  const nBalls = claimable.reduce((n, c) => n + c.balls.length, 0);
  const days = e.days.map((d, i) => '<span class="' + (e.myDays.includes(d) ? "on" : "") + '"><i>' + (e.myDays.includes(d) ? "✓" : "·") + '</i>' + EXP_DAY_NAMES[i] + '</span>').join("");
  let legend;
  if (e.legend.status === "caught") legend = '<p class="exp-legend-msg">🎉 Tu as attrapé ' + name + ' cette semaine !</p>';
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
    '<section class="exp-card">' + legend + '</section></div>';
}
function openExpedition() {
  const draw = () => { if (expeditionState && typeof ensureOverlay === "function") ensureOverlay("🧭 Expédition de la semaine", expeditionHtml(expeditionState)); };
  draw();
  loadExpedition(true).then(() => { const o = document.getElementById("overlay-modal"); if (o && !o.classList.contains("hidden") && document.querySelector("#overlay-body .exp")) draw(); else if (!document.querySelector("#overlay-body .exp")) draw(); });
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
