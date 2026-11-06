// DEX-04 — optional showcase, six currently owned species at most.
// Profile stores only a personal selection; actual ownership always comes from the server.
const POKEDEX_SHOWCASE_LIMIT = 6;
function pokedexShowcaseIds(raw = playerProfile?.pokedexShowcaseIds) {
  const result = [], seen = new Set();
  for (const value of Array.isArray(raw) ? raw : []) {
    if (value === null || value === '' || typeof value === 'boolean') continue;
    const id = Number(value);
    if (!Number.isInteger(id) || id < 1 || id > 1025 || seen.has(id)) continue;
    result.push(id); seen.add(id);
    if (result.length === POKEDEX_SHOWCASE_LIMIT) break;
  }
  return result;
}
function pokedexShowcaseOwnedCount(id, snapshot = typeof wildCaptures !== 'undefined' ? wildCaptures : null) {
  if (snapshot === null || snapshot === undefined) return null;
  const record = snapshot[id];
  return record ? Math.max(0, Number(record.normal) || 0) + Math.max(0, Number(record.shiny) || 0) : 0;
}
function pokedexShowcaseMilestone(raw = typeof wildCaptureHistory !== 'undefined' ? wildCaptureHistory : null,
                                  total = typeof wildCatchableTotal !== 'undefined' ? wildCatchableTotal : null) {
  if (raw === null || raw === undefined) return null;
  const entries = Array.isArray(raw) ? raw : Object.values(raw);
  const count = entries.filter(c => c && (Number(c.normal) > 0 || Number(c.shiny) > 0)).length;
  const ceiling = Number.isInteger(total) && total > 0 ? total : 852;
  return { count, goal: count >= ceiling ? ceiling : Math.min(ceiling, (Math.floor(count / 5) + 1) * 5), reached: count >= ceiling };
}
function pokedexShowcaseGoalText(milestone = pokedexShowcaseMilestone()) {
  if (!milestone) return 'Objectif proche : historique de captures indisponible.';
  if (milestone.reached) return 'Objectif atteint : ' + milestone.count + ' espèces capturées personnellement.';
  return 'Objectif proche : ' + milestone.count + ' / ' + milestone.goal + ' espèces capturées personnellement.';
}
function pokedexShowcaseButtonHtml(pokemon) {
  if (!pokemon || pokedexExperienceView !== 'collection') return '';
  const id = Number(pokemon.id), selected = pokedexShowcaseIds().includes(id);
  const count = pokedexShowcaseOwnedCount(id);
  if (!selected && (count === null || count <= 0)) return '';
  const full = pokedexShowcaseIds().length >= POKEDEX_SHOWCASE_LIMIT && !selected;
  return '<div class="pokedex-showcase-control">' +
    '<button type="button" class="btn-ghost" data-action="togglePokedexShowcase" data-args="[' + id + ']" aria-pressed="' + selected + '"' +
    (full ? ' disabled title="Six Pokémon maximum"' : '') + '>' +
    (selected ? '◆ Retirer de ma vitrine' : '◇ Ajouter à ma vitrine') + '</button></div>';
}
function pokedexShowcaseHubHtml() {
  const ids = pokedexShowcaseIds(), snapshot = typeof wildCaptures !== 'undefined' ? wildCaptures : null;
  const known = snapshot !== null && snapshot !== undefined;
  let active = 0;
  const tiles = Array.from({length:POKEDEX_SHOWCASE_LIMIT}, (_, i) => {
    const id = ids[i];
    if (!id) return '<li class="pokedex-showcase-slot is-empty"><span aria-hidden="true">＋</span><small>Emplacement libre</small></li>';
    const p = POKEMON_BY_ID.get(id), owned = pokedexShowcaseOwnedCount(id, snapshot);
    if (!p) return '<li class="pokedex-showcase-slot is-inactive"><span>Entrée indisponible</span>' +
      '<button type="button" class="btn-ghost" data-action="togglePokedexShowcase" data-args="[' + id + ']">Retirer</button></li>';
    if (owned > 0) active++;
    const status = !known ? 'Inventaire indisponible' : owned > 0
      ? owned + ' exemplaire' + (owned > 1 ? 's' : '') + ' possédé' + (owned > 1 ? 's' : '')
      : 'Plus possédé · non partageable';
    const sprite = typeof getPokemonSprite === 'function' && owned > 0 ? getPokemonSprite(p) : '';
    return '<li class="pokedex-showcase-slot' + (owned > 0 ? '' : ' is-inactive') + '">' +
      (sprite ? '<img src="' + escapeHtml(sprite) + '" alt="" loading="lazy" />' : '<span class="pokedex-showcase-placeholder" aria-hidden="true">◇</span>') +
      '<b>' + escapeHtml(p.name) + '</b><small>' + escapeHtml(status) + '</small>' +
      '<button type="button" class="btn-ghost" data-action="togglePokedexShowcase" data-args="[' + id + ']" aria-label="Retirer ' + escapeHtml(p.name) + ' de la vitrine">Retirer</button></li>';
  }).join('');
  return '<div class="pokedex-showcase-heading"><h3>Ma vitrine <small>' + ids.length + ' / 6</small></h3>' +
    '<p>Choisis jusqu’à six Pokémon que tu possèdes. La vitrine est privée tant que tu ne la partages pas.</p></div>' +
    '<ul class="pokedex-showcase-grid">' + tiles + '</ul>' +
    '<p class="pokedex-showcase-goal">' + escapeHtml(pokedexShowcaseGoalText()) + '</p>' +
    '<p class="pokedex-showcase-note">Paliers indicatifs, sans récompense. Une cession retire le Pokémon du partage, pas de ta sélection.</p>' +
    '<div class="pokedex-showcase-actions">' +
    '<button type="button" class="btn-ghost" data-action="setPokedexCollectionFilter" data-args=\'["obtained"]\'>Voir mes Pokémon possédés</button>' +
    '<button type="button" class="btn-blue" data-action="sharePokedexShowcase"' + (active === 0 ? ' disabled' : '') + '>Partager volontairement' + (known ? ' (' + active + ')' : '') + '</button></div>';
}
function pokedexRenderShowcaseHub() {
  const hub = document.getElementById('pokedex-collection-hub');
  if (!hub) return;
  let panel = document.getElementById('pokedex-showcase-hub');
  if (!panel) {
    panel = document.createElement('section');
    panel.id = 'pokedex-showcase-hub';
    panel.className = 'pokedex-showcase-hub';
    const anchor = hub.querySelector('#pokedex-tracking-hub') || hub.querySelector('.pokedex-experience-switch');
    if (!anchor) return;
    anchor.after(panel);
  }
  panel.hidden = pokedexExperienceView !== 'collection';
  if (!panel.hidden) panel.innerHTML = pokedexShowcaseHubHtml();
}
function togglePokedexShowcase(rawId) {
  if (!playerProfile) return false;
  const id = Number(rawId), pokemon = Number.isInteger(id) && id >= 1 && id <= 1025 ? POKEMON_BY_ID.get(id) : null;
  if (!pokemon) return false;
  const current = pokedexShowcaseIds(), at = current.indexOf(id);
  if (at < 0 && (pokedexShowcaseOwnedCount(id) ?? 0) <= 0) return false;
  if (at < 0 && current.length >= POKEDEX_SHOWCASE_LIMIT) {
    if (typeof showToast === 'function') showToast('Six Pokémon maximum : retire un emplacement.');
    return false;
  }
  playerProfile.pokedexShowcaseIds = at >= 0 ? current.filter(x => x !== id) : [...current, id];
  playerProfile.pokedexShowcaseUpdatedAt = Math.max(Date.now(), (Number(playerProfile.pokedexShowcaseUpdatedAt) || 0) + 1);
  if (typeof saveProfile === 'function') saveProfile();
  if (typeof syncProfileNow === 'function') syncProfileNow();
  pokedexRenderShowcaseHub();
  if (Number(pokedexSelectedId) === id) {
    const old = document.querySelector('#pokedex-detail .pokedex-showcase-control');
    const html = pokedexShowcaseButtonHtml(pokemon);
    if (old) {
      if (html) old.outerHTML = html;
      else old.remove();
    } else if (html) document.getElementById('pokedex-detail')?.insertAdjacentHTML('afterbegin', html);
  }
  return true;
}
function pokedexShowcaseShareText(captures, captureHistory = null, catchableTotal = null) {
  if (!Array.isArray(captures)) return null;
  const valid = new Map();
  for (const c of captures) {
    const id = Number(c?.id), qty = Math.max(0, Number(c?.normal) || 0) + Math.max(0, Number(c?.shiny) || 0);
    if (Number.isInteger(id) && qty > 0) valid.set(id,qty);
  }
  const names = pokedexShowcaseIds().filter(id=>valid.has(id))
    .map(id=>POKEMON_BY_ID.get(id)).filter(Boolean).map(p=>p.name);
  if (!names.length) return null;
  const lines = ['◆ Ma vitrine Pokédle (' + names.length + '/6)', ...names.map((name,i)=>(i+1) + '. ' + name)];
  const progress = pokedexShowcaseMilestone(captureHistory, catchableTotal);
  if (progress) lines.push('', pokedexShowcaseGoalText(progress));
  lines.push('', 'Vitrine personnelle partagée volontairement · https://pokdle.fr/');
  return lines.join('\n');
}
async function sharePokedexShowcase() {
  // Only a direct click opts into sharing. Refresh ownership first: a traded or
  // released Pokémon must never be represented as currently owned from stale state.
  let payload = null;
  try {
    const response = await fetch('/api/wild/collection', { credentials:'same-origin', cache:'no-store' });
    if (response.ok) payload = await response.json();
  } catch (_error) {}
  if (!payload?.ok || !Array.isArray(payload.captures)) {
    if (typeof showToast === 'function') showToast('Inventaire indisponible : partage annulé.');
    return false;
  }
  if (typeof wildSyncAlbum === 'function') wildSyncAlbum(payload.captures);
  if (Array.isArray(payload.captureHistory) && typeof wildCaptureHistory !== 'undefined') {
    wildCaptureHistory = Object.fromEntries(payload.captureHistory.map(c=>[c.id,{normal:Number(c.normal)||0,shiny:Number(c.shiny)||0}]));
  }
  pokedexRenderShowcaseHub();
  const text = pokedexShowcaseShareText(payload.captures,payload.captureHistory,payload.catchableTotal);
  if (!text) {
    if (typeof showToast === 'function') showToast('Aucun Pokémon encore possédé dans ta vitrine.');
    return false;
  }
  try {
    if (navigator.share) { await navigator.share({ title:'Ma vitrine Pokédle', text }); return true; }
  } catch (error) { if (error?.name === 'AbortError') return false; }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      if (typeof showToast === 'function') showToast('Vitrine copiée !');
      return true;
    }
  } catch (_error) {}
  if (typeof ensureOverlay === 'function') {
    ensureOverlay('Partager ma vitrine', '<p>Copie le texte ci-dessous :</p><textarea readonly rows="10" style="width:100%">' + escapeHtml(text) + '</textarea>');
  }
  return false;
}
const renderPokedexCollectionHubBeforeShowcase = renderPokedexCollectionHub;
renderPokedexCollectionHub = function () {
  const result = renderPokedexCollectionHubBeforeShowcase.apply(this, arguments);
  pokedexRenderShowcaseHub();
  return result;
};
const renderPokedexDetailBeforeShowcase = renderPokedexDetail;
renderPokedexDetail = async function (pokemon) {
  const result = await renderPokedexDetailBeforeShowcase.apply(this, arguments);
  if (!pokemon || pokedexExperienceView !== 'collection' || Number(pokedexSelectedId) !== Number(pokemon.id)) return result;
  const detail = document.getElementById('pokedex-detail');
  if (!detail) return result;
  detail.querySelector('.pokedex-showcase-control')?.remove();
  const html = pokedexShowcaseButtonHtml(pokemon);
  if (html) detail.insertAdjacentHTML('afterbegin', html);
  return result;
};
