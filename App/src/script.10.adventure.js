
// Discoveries live in the existing profile, so account sync and reset include them.
const DISCOVERY_MODES = new Set(['normal', 'daily', 'challenge', 'silhouette', 'pixel', 'cry', 'mystery', 'description', 'evolution', 'order', 'weight', 'odd']);
let albumPage = 1;
const ALBUM_PAGE_SIZE = 24;
function normalizeDiscoveries(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const clean = {};
  for (const [key, entry] of Object.entries(raw)) {
    const id = Number(key), at = Number(entry?.at);
    if (!Number.isInteger(id) || !POKEMON_BY_ID.has(id) || !Number.isFinite(at) || at <= 0) continue;
    clean[id] = { at: Math.min(at, Date.now()), mode: typeof entry.mode === 'string' ? entry.mode.slice(0, 30) : 'normal', source: ['game', 'history', 'secret'].includes(entry.source) ? entry.source : 'legacy' };
    if (entry.secrets && typeof entry.secrets === 'object') {
      clean[id].secrets = Object.fromEntries(Object.entries(entry.secrets).filter(([key, value]) => ['companion', 'signal', 'runes'].includes(key) && Number.isFinite(value) && value > 0).map(([key, value]) => [key, Math.min(value, Date.now())]));
    }
    if (Number.isFinite(entry.confirmed?.at) && entry.confirmed.at > 0 && typeof entry.confirmed.mode === 'string') clean[id].confirmed = { at: Math.min(entry.confirmed.at, Date.now()), mode: entry.confirmed.mode.slice(0, 30) };
  }
  return clean;
}
function addDiscovery(collection, pokemon, mode, at = Date.now(), source = 'game') {
  const id = Number(pokemon?.id);
  if (!Number.isInteger(id) || !POKEMON_BY_ID.has(id) || collection[id]) return false;
  collection[id] = { at: Number.isFinite(Number(at)) && Number(at) > 0 ? Math.min(Number(at), Date.now()) : Date.now(), mode: String(mode || 'normal').slice(0, 30), source };
  return true;
}
function historyDiscovery(entry) {
  if (entry?.result !== 'win' || !DISCOVERY_MODES.has(entry.mode)) return null;
  return findPokemonGlobalByName(entry.targetName);
}
function discoverFromHistory(entry) {
  const pokemon = historyDiscovery(entry);
  if (pokemon) recordPokemonDiscovery(pokemon, entry.mode, entry.at);
}
function duelDiscovery(room, self) {
  return room?.status === 'finished' && room.endedReason === 'guess' && self?.id && self.id === room.winnerId ? room.targetRevealed : null;
}
function partyDiscovery(room, me) {
  if (!me || !['finished', 'complete'].includes(room?.status)) return null;
  if (['guess', 'deduction', 'coop'].includes(room.gameMode) && me.correct) return findPokemonGlobalByName(room.round?.answer);
  if (room.gameMode === 'nearest') {
    const exact = room.round?.results?.find(p => p.playerId === me.id && p.pokemon && p.distance === 0);
    if (exact) return POKEMON_BY_ID.get(Number(exact.pokemon.id)) || null;
  }
  return null;
}
function recordPokemonDiscovery(pokemon, mode, at) {
  playerProfile.discoveries ||= {};
  if (typeof recordSecretWin === 'function') recordSecretWin(pokemon, mode);
  const old = playerProfile.discoveries[pokemon?.id];
  if (old && (!old.source || old.source === 'legacy' || old.source === 'history') && !old.confirmed) {
    old.confirmed = { at: Date.now(), mode };
    saveProfile();
  }
  if (!addDiscovery(playerProfile.discoveries, pokemon, mode, at)) return false;
  saveProfile();
  renderPartner();
  showToast(`${pokemon.name} rejoint ton album · ${discoveryModeLabel(mode)}`);
  return true;
}
function discoveryModeLabel(mode) {
  const labels = { duel: 'Duel 1v1', guess: 'Party · Course Pokémon', deduction: 'Party · Pokémon mystère', coop: 'Party · Enquête coop', nearest: 'Party · Numéro exact', secret: 'Rencontre secrète' };
  return labels[mode] || modeLabelFr(mode);
}
function discoveryProofHtml(entry) {
  const source = entry.source || 'legacy';
  const label = { game: 'Trouvé en jeu', history: 'Importé de l’historique', secret: 'Rencontre secrète', legacy: 'Ancienne entrée' }[source] || 'Ancienne entrée';
  const mode = escapeHtml(discoveryModeLabel(entry.mode));
  const explanations = {
    game: `Bonne réponse enregistrée en ${mode}.`,
    history: `Victoire en ${mode}, récupérée automatiquement depuis ton historique. Ce Pokémon n’a pas été rencontré à nouveau lors de l’import.`,
    legacy: `Mode enregistré : ${mode}. Cette entrée date de l’ancienne version. Elle peut venir de l’historique importé ; l’origine exacte n’avait pas été conservée.`,
    secret: 'Pokémon accueilli après avoir accompli une mission et découvert sa cachette.'
  };
  const confirmed = entry.confirmed ? `<p>Retrouvé en ${escapeHtml(discoveryModeLabel(entry.confirmed.mode))} le ${new Date(entry.confirmed.at).toLocaleDateString('fr-FR')}.</p>` : '';
  const secrets = Object.entries(entry.secrets || {}).map(([key, at]) => `<p>✦ Mission « ${escapeHtml(({companion:'Une présence familière',signal:'Un drôle de signal',runes:'Les trois marques'})[key] || key)} » · ${new Date(at).toLocaleDateString('fr-FR')}</p>`).join('');
  return `<span class="album-origin">${label}</span><details class="album-proof"><summary>Comment obtenu ?</summary><p>${explanations[source] || explanations.legacy}</p>${confirmed}${secrets}</details>`;
}

function partnerMilestone(count) {
  const stages = [{ min: 0, name: 'Premiers pas', next: 10 }, { min: 10, name: 'Complices', next: 50 }, { min: 50, name: 'Inséparables', next: 150 }, { min: 150, name: 'Duo légendaire', next: null }];
  const stage = stages.filter(s => count >= s.min).at(-1);
  return { ...stage, percent: stage.next ? Math.min(100, Math.round((count - stage.min) / (stage.next - stage.min) * 100)) : 100 };
}
function partnerImage(pokemon, className = '') {
  return `<img class="${className}" src="${getPokemonSprite(pokemon)}" alt="${escapeHtml(pokemon.name)}" loading="lazy" data-fallback="${getSpriteUrl(getPokemonSpriteId(pokemon))}" />`;
}
function renderPartner() {
  const pokemon = POKEMON_BY_ID.get(Number(playerProfile.favoritePokemonId));
  const count = Object.keys(playerProfile.discoveries || {}).length;
  const stage = partnerMilestone(count);
  const home = document.getElementById('home-partner');
  if (home) home.innerHTML = (pokemon ? partnerImage(pokemon) : '<span class="partner-placeholder" aria-hidden="true">✦</span>') +
    `<div class="partner-strip-copy"><span class="adventure-eyebrow">MON AVENTURE</span><strong>${pokemon ? escapeHtml(pokemon.name) + ' & toi' : 'Trouve ton compagnon de jeu'}</strong><span>${pokemon ? stage.name + ' · ' + count + ' découverte' + (count === 1 ? '' : 's') : 'Un partenaire, un album, tes découvertes.'}</span></div><button type="button" class="btn-ghost" data-action="${pokemon ? 'openDiscoveryAlbum' : 'openPartnerProfile'}">${pokemon ? 'Mon album →' : 'Choisir →'}</button>`;
  const card = document.getElementById('profile-favorite-card');
  if (card) card.innerHTML = pokemon ? `<div class="partner-card">${partnerImage(pokemon)}<div><span class="adventure-eyebrow">TON PARTENAIRE</span><h3>${escapeHtml(pokemon.name)}</h3><div class="pokemon-card-types">${typeBadgesHtml(pokemon.type1, pokemon.type2)}</div></div><div class="partner-bond"><strong>${stage.name}</strong><span>${count} découverte${count === 1 ? '' : 's'} dans ton aventure</span><progress value="${stage.percent}" max="100" aria-label="Progression du duo"></progress><small>${stage.next ? (stage.next - count) + ' découverte(s) avant le prochain palier' : 'Le dernier palier est atteint. L’aventure continue !'}</small></div></div>` :
    '<div class="partner-empty"><span class="adventure-eyebrow">LE DÉBUT D’UNE AVENTURE</span><h3>Avec qui pars-tu ?</h3><p>Choisis n’importe quel Pokémon dans le champ ci-dessus, ou commence avec un de ces compagnons.</p><div class="partner-starters">' + [1, 4, 7].map(id => { const p = POKEMON_BY_ID.get(id); return p ? `<button type="button" data-action="choosePartner" data-args="[${id}]">${partnerImage(p)}<span>${escapeHtml(p.name)}</span></button>` : ''; }).join('') + '</div></div>';
  const tabCount = document.getElementById('album-tab-count');
  if (tabCount) tabCount.textContent = String(count);
}
function choosePartner(id) {
  const pokemon = POKEMON_BY_ID.get(Number(id));
  if (!pokemon) return;
  playerProfile.favoritePokemonId = pokemon.id;
  saveProfile();
  document.getElementById('profile-favorite-input')?.removeAttribute('aria-invalid');
  renderProfileScreen();
  if (typeof renderSecretMissions === 'function') renderSecretMissions();
  const msg = document.getElementById('profile-save-msg');
  if (msg) { msg.textContent = `${pokemon.name} est ton partenaire. Enregistré !`; msg.classList.remove('hidden'); }
}
function openPartnerProfile() {
  openProfileScreen();
  switchProfileView('trainer');
  document.getElementById('profile-favorite-input')?.focus();
}
function openDiscoveryAlbum() {
  openProfileScreen();
  switchProfileView('album');
  document.querySelector('.profile-view-switch')?.scrollIntoView({ block: 'start' });
}
function switchProfileView(view) {
  const selected = ['trainer', 'album', 'secrets'].includes(view) ? view : 'trainer';
  document.querySelectorAll('.profile-view-switch button').forEach(button => button.setAttribute('aria-pressed', String(JSON.parse(button.dataset.args || '[]')[0] === selected)));
  document.querySelectorAll('#profile-trainer-card, #screen-profile .profile-stats-links, #screen-profile .profile-layout, #screen-profile .profile-summary-grid, #screen-profile .profile-records-panel, #profile-secret-rune').forEach(el => el.classList.toggle('hidden', selected !== 'trainer'));
  document.getElementById('profile-album')?.classList.toggle('hidden', selected !== 'album');
  document.getElementById('profile-secrets')?.classList.toggle('hidden', selected !== 'secrets');
  if (selected === 'album') renderDiscoveryAlbum();
  if (selected === 'secrets') renderSecretMissions();
}

function filterAlbum(list, discoveries, query, generation, status) {
  const q = norm(String(query || '').trim().replace(/^#/, ''));
  return list.filter(p => (generation === 'all' || Number(p.gen) === Number(generation)) &&
    (status === 'all' || (status === 'missing' ? !discoveries[p.id] : status === 'secrets' ? Boolean(Object.keys(discoveries[p.id]?.secrets || {}).length) : Boolean(discoveries[p.id]))) &&
    (!q || norm(p.name).includes(q) || String(p.baseId || p.id).padStart(3, '0').includes(q)));
}
function renderDiscoveryAlbum() {
  const grid = document.getElementById('album-grid');
  if (!grid) return;
  const discoveries = playerProfile.discoveries || {};
  const catalogue = getPokemonUiList({ includeAltForms: true });
  const count = Object.keys(discoveries).length;
  const oldCount = Object.values(discoveries).filter(e => !e.source || ['history', 'legacy'].includes(e.source)).length;
  const note = document.getElementById('album-origin-note');
  if (note) {
    note.classList.toggle('hidden', !oldCount);
    note.textContent = `${oldCount} ancienne(s) entrée(s) : l’album a pu récupérer tes victoires passées. Ouvre « Comment obtenu ? » sur une carte. Lorsque l’origine n’avait pas été enregistrée, nous le précisons.`;
  }
  const total = document.getElementById('album-total');
  total.innerHTML = `<strong>${count}<small> / ${catalogue.length}</small></strong><span>Pokémon découverts</span><progress value="${count}" max="${catalogue.length}" aria-label="Pokémon découverts"></progress>`;
  const genSelect = document.getElementById('album-generation');
  if (genSelect.options.length === 1) for (let gen = 1; gen <= 9; gen++) genSelect.add(new Option(`Gen ${gen}`, String(gen)));
  const regions = ['Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Unys', 'Kalos', 'Alola', 'Galar', 'Paldea'];
  document.getElementById('album-regions').innerHTML = regions.map((name, i) => {
    const group = catalogue.filter(p => Number(p.gen) === i + 1), found = group.filter(p => discoveries[p.id]).length;
    return `<button type="button" data-action="selectAlbumGeneration" data-args="[${i + 1}]" aria-pressed="${genSelect.value === String(i + 1)}"><span>${name}</span><b>${found}<small> / ${group.length}</small></b><progress value="${found}" max="${group.length || 1}" aria-label="Génération ${i + 1}"></progress></button>`;
  }).join('');
  const list = filterAlbum(catalogue, discoveries, document.getElementById('album-search').value, genSelect.value, document.getElementById('album-status').value);
  // Recent discoveries first; undiscovered entries remain in National Pokédex order.
  list.sort((a, b) => (discoveries[b.id]?.at || 0) - (discoveries[a.id]?.at || 0) || (a.baseId || a.id) - (b.baseId || b.id) || a.id - b.id);
  const pages = Math.max(1, Math.ceil(list.length / ALBUM_PAGE_SIZE));
  albumPage = Math.max(1, Math.min(pages, albumPage));
  document.getElementById('album-results-label').textContent = `${list.length} Pokémon ${list.length === 1 ? 'affiché' : 'affichés'}`;
  grid.innerHTML = list.slice((albumPage - 1) * ALBUM_PAGE_SIZE, albumPage * ALBUM_PAGE_SIZE).map(p => {
    const entry = discoveries[p.id];
    return `<article class="album-card ${entry ? 'is-found' : 'is-missing'}"><div class="album-card-meta"><span>#${String(p.baseId || p.id).padStart(3, '0')}</span><span>${entry ? '✓ Trouvé' : 'À découvrir'}</span></div>${entry ? partnerImage(p) : '<span class="album-unknown" aria-hidden="true">?</span>'}<h4>${escapeHtml(p.name)}</h4><span class="album-form">${p.isAltForm ? 'Forme alternative' : 'Génération ' + p.gen}</span>${entry ? '<small class="album-date">Trouvé le ' + new Date(entry.at).toLocaleDateString('fr-FR') + '</small>' + discoveryProofHtml(entry) + '<button type="button" class="btn-ghost" data-action="choosePartner" data-args="[' + p.id + ']" aria-label="Choisir ' + escapeHtml(p.name) + ' comme partenaire"' + (playerProfile.favoritePokemonId === p.id ? ' disabled' : '') + '>' + (playerProfile.favoritePokemonId === p.id ? 'Ton partenaire ✓' : 'Choisir comme partenaire') + '</button>' : '<span class="album-date">Un prochain mystère…</span>'}</article>`;
  }).join('') || '<div class="album-empty"><span aria-hidden="true">✦</span><h4>' + (count ? 'Aucune découverte avec ces filtres' : 'La première page t’attend') + '</h4><p>' + (count ? 'Essaie une autre génération ou affiche tout l’album.' : 'Trouve un Pokémon dans un jeu de devinette : sa carte apparaîtra ici.') + '</p><button type="button" class="btn-blue" data-action="' + (count ? 'resetAlbumFilters' : 'startNormalGame') + '">' + (count ? 'Réinitialiser les filtres' : 'Jouer en illimité →') + '</button></div>';
  document.getElementById('album-page').textContent = `${albumPage} / ${pages}`;
  document.getElementById('album-prev').disabled = albumPage === 1;
  document.getElementById('album-next').disabled = albumPage === pages;
  document.querySelector('.album-pagination').classList.toggle('hidden', pages === 1);
}
function resetAlbumFilters() {
  document.getElementById('album-search').value = '';
  document.getElementById('album-generation').value = 'all';
  document.getElementById('album-status').value = 'all';
  albumPage = 1;
  renderDiscoveryAlbum();
}
function selectAlbumGeneration(gen) {
  const el = document.getElementById('album-generation');
  el.value = el.value === String(gen) ? 'all' : String(gen);
  albumPage = 1;
  renderDiscoveryAlbum();
}
function changeAlbumPage(direction) {
  albumPage += Number(direction) < 0 ? -1 : 1;
  renderDiscoveryAlbum();
  document.getElementById('album-results-label')?.scrollIntoView({ block: 'start' });
}
function comparisonStatusHtml(state) {
  const labels = { ok: ['✓', 'Correspond'], close: ['≈', 'Proche'], wrong: ['×', 'Différent'] };
  const [symbol, label] = labels[state] || labels.wrong;
  return `<span class="comparison-status" role="img" aria-label="${label}">${symbol}</span>`;
}
// The existing profile/history loader listens on window; run after it, not earlier on document.
window.addEventListener('DOMContentLoaded', () => {
  let migrated = false;
  playerProfile.discoveries ||= {};
  // Oldest first preserves the earliest known win; losses and score-only records do not qualify.
  for (const entry of [...matchHistory].sort((a, b) => Number(a.at) - Number(b.at))) {
    const pokemon = historyDiscovery(entry);
    if (pokemon) migrated = addDiscovery(playerProfile.discoveries, pokemon, entry.mode, entry.at, 'history') || migrated;
  }
  if (migrated) saveProfile();
  for (const id of ['album-search', 'album-generation', 'album-status']) document.getElementById(id)?.addEventListener(id === 'album-search' ? 'input' : 'change', () => { albumPage = 1; renderDiscoveryAlbum(); });
  renderPartner();
});
