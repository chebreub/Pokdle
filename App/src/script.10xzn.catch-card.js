
// 🌿 Carte « Attrapé ! » (4/11/2026, maquette validée par Kayan) : à chaque capture, même d'un Pokémon déjà vu
// ou déjà attrapé, une vraie carte remplace le « Gotcha ! » nu : artwork, n° et région, types, « Attrapé ×N »,
// progression de la région, la Ball utilisée et un gros bouton « Rencontre suivante · N restantes ».
// La fiche « Nouvelle entrée » d'une 1re capture (script.10xzc) s'ouvre toujours par-dessus, comme avant.
var catchCardBall = 'poke';
if (typeof wildAnimate === 'function') {
  var wildAnimateBeforeCard = wildAnimate;
  wildAnimate = function (scene, ball) { catchCardBall = String(ball || 'poke'); return wildAnimateBeforeCard.apply(this, arguments); };
}
function catchCardTypeColor(type) {
  var key = String(type || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return (typeof POKEMON_TYPE_COLORS !== 'undefined' && POKEMON_TYPE_COLORS[key]) || '#8A8392';
}
function catchCardCollectionHtml(p, state) {
  var zone = typeof wildZoneOf === 'function' && wildZoneOf(state && state.encounter && state.encounter.zone);
  var progress = zone && typeof wildZoneProgress === 'function' && wildZoneProgress(zone.key);
  var chains = typeof wildCollectionChains === 'function' ? wildCollectionChains(p.id) : [];
  return (progress ? '<div class="cc-zone"><span><b>' + escapeHtml(zone.name) + '</b><strong>' + progress.owned + ' / ' + progress.total + ' possédés</strong></span>' +
    '<span class="wz-meter" aria-hidden="true"><i style="width:' + progress.percent + '%"></i></span>' +
    '<small>' + (progress.missing ? progress.missing + ' espèces encore absentes de ta collection' : 'Toutes les espèces de cette zone sont dans ta collection !') + '</small></div>' : '') +
    (chains.length ? '<div class="cc-chain">' + wildChainHtml(chains[0]) + '</div>' : '');
}
function catchCardHtml(outcome, state) {
  var p = wildPokemon(outcome.pokemonId);
  if (!p) return '';
  var gen = Number(p.gen || p.generation) || 1;
  var region = (typeof GENERATIONS !== 'undefined' && GENERATIONS[gen] && GENERATIONS[gen].label) || '';
  var mine = (wildCaptures && wildCaptures[p.id]) || { normal: 0, shiny: 0 };
  var count = (Number(mine.normal) || 0) + (Number(mine.shiny) || 0);
  var list = typeof albumRegionList === 'function' ? albumRegionList(gen) : [];
  var inRegion = typeof albumCaughtIn === 'function' ? albumCaughtIn(list) : 0;
  var kind = (typeof BALL_KINDS !== 'undefined' && BALL_KINDS[catchCardBall]) ? catchCardBall : 'poke';
  var types = [p.type1, p.type2].filter(Boolean).map(function (t) {
    return '<span style="background:color-mix(in srgb,' + catchCardTypeColor(t) + ' 72%,#2E2A33)">' + escapeHtml(t) + '</span>';
  }).join('');
  return '<div class="wild-gotcha catch-card' + (outcome.shiny ? ' is-shiny' : '') + '">' +
    '<div class="cc-head">' + (typeof ballImg === 'function' ? ballImg(kind, 26) : '') + '<strong>Attrapé !</strong><span>' + escapeHtml(BALL_KINDS[kind].name) + '</span></div>' +
    '<div class="cc-body">' +
      '<div class="cc-art" style="--cc1:' + catchCardTypeColor(p.type1) + '"><img src="' + escapeHtml(wildArtwork(p, outcome.shiny)) + '" alt="" draggable="false"></div>' +
      '<span class="cc-num">N° ' + String(p.id).padStart(3, '0') + (region ? ' · ' + escapeHtml(region.toUpperCase()) : '') + '</span>' +
      '<strong class="cc-name">' + escapeHtml(p.name) + (outcome.shiny ? ' ✨' : '') + '</strong>' +
      '<div class="cc-types">' + types + '</div>' +
      '<div class="cc-stats"><div><small>Dans ta collection</small><b>Possédé ×' + Math.max(1, count) + '</b></div>' +
        (list.length ? '<div><small>' + escapeHtml(region) + '</small><b>' + inRegion + ' / ' + list.length + ' attrapés</b></div>' : '') + '</div>' +
      '<p class="cc-line">' + wildCatchLine(outcome) + '</p>' +
      catchCardCollectionHtml(p, state) +
      ((Number(mine.normal) > 1 || Number(mine.shiny) > 1) ? '<button type="button" class="btn-ghost cc-duplicate" data-action="catchCardOpenMon" data-args="[' + p.id + ']">🔁 Voir ce doublon dans mon album</button>' : '') +
      (typeof choosePartner === 'function' ? '<button type="button" class="btn-ghost cc-partner" data-action="catchCardPartner" data-args="[' + p.id + ']"' +
        (typeof playerProfile !== 'undefined' && playerProfile && Number(playerProfile.favoritePokemonId) === p.id ? ' disabled>Ton partenaire ✓' : '>☆ Choisir comme partenaire') + '</button>' : '') +
    '</div></div>';
}
// Les actions réutilisent la fiche et le partenaire existants. Aucun échange automatique.
function catchCardOpenMon(id) {
  if (typeof openTradeMon !== 'function') return;
  closeWildGrass();
  openTradeMon(Number(id));
}
function catchCardPartner(id) {
  if (typeof wildOwned !== 'function' || !wildOwned(id) || typeof choosePartner !== 'function') return;
  choosePartner(Number(id));
  var button = document.querySelector('#wild-scene .cc-partner');
  if (button) { button.textContent = 'Ton partenaire ✓'; button.disabled = true; }
}
window.catchCardOpenMon = catchCardOpenMon;
window.catchCardPartner = catchCardPartner;
if (typeof renderWildEnd === 'function') {
  var renderWildEndBeforeCard = renderWildEnd;
  renderWildEnd = function (state, outcome) {
    var out = renderWildEndBeforeCard.apply(this, arguments);
    if (!outcome || !outcome.caught) return out;
    var end = document.querySelector('#wild-scene .wild-end');
    var old = end && end.querySelector('.wild-gotcha');
    var html = catchCardHtml(outcome, state);
    if (!old || !html) return out;
    old.outerHTML = html;
    end.classList.add('has-catch-card');
    var w = state && state.wild || {};
    var cta = end.querySelector('.wild-cta');
    if (cta) cta.innerHTML = 'Rencontre suivante<span class="cc-left">' + w.left + ' restante' + (w.left > 1 ? 's' : '') + '</span>';
    var album = end.querySelector('.btn-ghost[data-action="wildOpenAlbum"]');
    if (album) album.textContent = 'Voir dans le carnet';
    return out;
  };
}
