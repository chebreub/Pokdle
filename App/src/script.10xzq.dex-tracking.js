// DEX-03 — three optional personal targets. No influence on draws, captures or XP.
// Stored in the existing player profile and reconciled by timestamp across devices.
const POKEDEX_TARGET_LIMIT = 3;
function pokedexTrackedTargetIds(source = playerProfile?.pokedexTrackedTargets) {
  const ids = [], seen = new Set();
  for (const raw of Array.isArray(source) ? source : []) {
    const id = Number(raw);
    if (!Number.isInteger(id) || id < 1 || id > 1025 || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length === POKEDEX_TARGET_LIMIT) break;
  }
  return ids;
}
function pokedexTargetVisible(pokemon) {
  if (!pokemon || pokemon.isAltForm || Number(pokemon.id) > 1025) return false;
  // Hidden album missions and secret journal entries remain masked, including in the encyclopedia.
  const state = pokedexCollectionState(pokemon);
  return state.kind !== 'secret' && !state.hidden;
}
function pokedexTrackingButtonHtml(pokemon) {
  if (!pokedexTargetVisible(pokemon)) return '';
  if (pokedexExperienceView === 'collection' && pokedexCollectionState(pokemon).kind === 'unknown') return '';
  const ids = pokedexTrackedTargetIds(), selected = ids.includes(Number(pokemon.id));
  const full = ids.length >= POKEDEX_TARGET_LIMIT && !selected;
  return '<div class="pokedex-tracking-control">' +
    '<button type="button" class="btn-ghost" data-action="togglePokedexTrackedTarget" data-args="[' + Number(pokemon.id) + ']" aria-pressed="' + selected + '"' +
    (full ? ' disabled title="Trois cibles maximum"' : '') + '>' +
    (selected ? '★ Retirer de mes cibles' : '☆ Suivre ce Pokémon') + '</button></div>';
}
function pokedexTrackedRouteText(id) {
  const routes = typeof wildCaptureRoutes !== 'undefined' ? wildCaptureRoutes : null;
  if (!routes) return 'Voie de capture indisponible';
  if (Number(routes.prestige) === id) return 'Épreuve de prestige';
  if (Array.isArray(routes.expedition) && routes.expedition.includes(id)) return 'Expédition hebdomadaire';
  if (Array.isArray(routes.wild) && routes.wild.includes(id)) return 'Hautes herbes';
  return 'Pas de capture par Ball actuellement';
}
function pokedexTrackingHubHtml() {
  const ids = pokedexTrackedTargetIds();
  const items = ids.map(id => {
    const pokemon = POKEMON_BY_ID.get(id);
    if (!pokemon) return '';
    const state = pokedexCollectionState(pokemon);
    const safe = pokedexTargetVisible(pokemon);
    // No new name is exposed by Ma collection; a selected undiscovered target is masked there.
    const showName = safe && (pokedexExperienceView === 'encyclopedia' || state.kind === 'registered' || state.kind === 'mission');
    const label = showName ? escapeHtml(pokemon.name) : 'Cible non révélée';
    const owned = typeof wildCaptures !== 'undefined' && wildCaptures !== null
      ? (Number(wildCaptures[id]?.normal) || 0) + (Number(wildCaptures[id]?.shiny) || 0)
      : null;
    const status = !safe ? 'Entrée masquée' : owned > 0 ? 'Déjà possédé'
      : showName ? pokedexTrackedRouteText(id) : 'Consulte l’encyclopédie pour retrouver cette cible';
    return '<li><div><b>' + label + '</b><small>' + escapeHtml(status) + '</small></div>' +
      '<button type="button" class="btn-ghost" data-action="togglePokedexTrackedTarget" data-args="[' + id + ']" aria-label="Retirer la cible ' + label + '">Retirer</button></li>';
  }).join('');
  return '<div class="pokedex-targets-heading"><h3>Mes cibles <small>' + ids.length + ' / ' + POKEDEX_TARGET_LIMIT + '</small></h3>' +
    '<span>Un repère personnel, sans bonus d’apparition.</span></div>' +
    (ids.length ? '<ul>' + items + '</ul>' : '<p>Choisis jusqu’à trois Pokémon depuis leur fiche de l’encyclopédie.</p>');
}
function pokedexRenderTrackingHub() {
  const hub = document.getElementById('pokedex-collection-hub');
  if (!hub) return;
  let panel = document.getElementById('pokedex-tracking-hub');
  if (!panel) {
    panel = document.createElement('section');
    panel.id = 'pokedex-tracking-hub';
    panel.className = 'pokedex-tracking-hub';
    const anchor = hub.querySelector('.pokedex-experience-switch');
    if (!anchor) return;
    anchor.after(panel);
  }
  panel.innerHTML = pokedexTrackingHubHtml();
}
function togglePokedexTrackedTarget(rawId) {
  if (!playerProfile) return false;
  const id = Number(rawId), pokemon = POKEMON_BY_ID.get(id);
  if (!Number.isInteger(id) || id < 1 || id > 1025 || !pokemon) return false;
  const ids = pokedexTrackedTargetIds(), found = ids.indexOf(id);
  if (found < 0 && !pokedexTargetVisible(pokemon)) return false;
  if (found < 0 && ids.length >= POKEDEX_TARGET_LIMIT) {
    if (typeof showToast === 'function') showToast('Trois cibles maximum. Retire-en une avant d’en ajouter.');
    return false;
  }
  const updated = found >= 0 ? ids.filter(value => value !== id) : [...ids, id];
  playerProfile.pokedexTrackedTargets = updated;
  playerProfile.pokedexTrackedUpdatedAt = Math.max(Date.now(), (Number(playerProfile.pokedexTrackedUpdatedAt) || 0) + 1);
  if (typeof saveProfile === 'function') saveProfile();
  if (typeof syncProfileNow === 'function') syncProfileNow();
  pokedexRenderTrackingHub();
  const control = document.querySelector('#pokedex-detail .pokedex-tracking-control');
  if (control && Number(pokedexSelectedId) === id) {
    const html = pokedexTrackingButtonHtml(pokemon);
    if (html) control.outerHTML = html;
  }
  return true;
}
const renderPokedexCollectionHubBeforeTargets = renderPokedexCollectionHub;
renderPokedexCollectionHub = function () {
  const result = renderPokedexCollectionHubBeforeTargets.apply(this, arguments);
  pokedexRenderTrackingHub();
  return result;
};
const renderPokedexDetailBeforeTargets = renderPokedexDetail;
renderPokedexDetail = async function (pokemon) {
  const result = await renderPokedexDetailBeforeTargets.apply(this, arguments);
  if (!pokemon || Number(pokedexSelectedId) !== Number(pokemon.id)) return result;
  const detail = document.getElementById('pokedex-detail');
  if (!detail) return result;
  detail.querySelector('.pokedex-tracking-control')?.remove();
  const html = pokedexTrackingButtonHtml(pokemon);
  if (html) detail.insertAdjacentHTML('afterbegin', html);
  return result;
};
