
// Optional exploration: no imported progress, deadlines, XP or competitive advantage.
const SECRET_MISSIONS = [
  { id: 'companion', pokemonId: 133, title: 'Une présence familière', icon: '✦', place: 'Sur l’accueil, près de ton partenaire', hint: 'Les belles aventures attirent de nouveaux compagnons.', task: 'Choisis un partenaire, puis trouve 3 Pokémon différents dans les jeux de devinette.', destination: 'home' },
  { id: 'signal', pokemonId: 479, title: 'Un drôle de signal', icon: 'ϟ', place: 'Dans le Pokédex', hint: 'Un appareil crépite quand tu t’intéresses à l’électricité…', task: 'Ouvre les fiches de 3 Pokémon Électrik différents dans le Pokédex.', destination: 'dex' },
  { id: 'runes', pokemonId: 442, title: 'Les trois marques', icon: '✧', place: 'Dans ce carnet', hint: 'Trois petites étoiles ont été gravées loin des terrains de jeu.', task: 'Examine les marques ✧ de l’accueil, du Pokédex et de l’onglet Dresseur.', destination: 'journal' }
];
function normalizeSecretProgress(raw) {
  const ids = value => Array.isArray(value) ? [...new Set(value.map(Number).filter(id => Number.isInteger(id) && POKEMON_BY_ID.has(id)))].slice(0, 3) : [];
  const claimed = {};
  for (const mission of SECRET_MISSIONS) if (Number.isFinite(raw?.claimed?.[mission.id]) && raw.claimed[mission.id] > 0) claimed[mission.id] = Math.min(raw.claimed[mission.id], Date.now());
  return { wins: ids(raw?.wins), electric: ids(raw?.electric).filter(id => isSecretElectric(POKEMON_BY_ID.get(id))), runes: Array.isArray(raw?.runes) ? [...new Set(raw.runes.filter(key => ['home', 'dex', 'profile'].includes(key)))] : [], claimed };
}
function isSecretElectric(pokemon) {
  return pokemon?.type1 === 'Électrik' || pokemon?.type2 === 'Électrik';
}
function secretProgress() {
  if (!playerProfile.secrets) playerProfile.secrets = normalizeSecretProgress(null);
  return playerProfile.secrets;
}
function secretMissionProgress(mission, state, favoriteId) {
  if (mission.id === 'companion') return POKEMON_BY_ID.has(Number(favoriteId)) ? Math.min(3, state.wins.length) : 0;
  return Math.min(3, (mission.id === 'signal' ? state.electric : state.runes).length);
}
function advanceSecretProgress(state, kind, value, favoriteId) {
  if (kind === 'runes') {
    if (!['home', 'dex', 'profile'].includes(value) || state.runes.includes(value)) return false;
    state.runes.push(value); return true;
  }
  const pokemon = POKEMON_BY_ID.get(Number(value));
  if (!pokemon || !['wins', 'electric'].includes(kind)) return false;
  if (kind === 'wins' && !POKEMON_BY_ID.has(Number(favoriteId))) return false;
  if (kind === 'electric' && !isSecretElectric(pokemon)) return false;
  if (state[kind].length >= 3 || state[kind].includes(pokemon.id)) return false;
  state[kind].push(pokemon.id); return true;
}
function recordSecretWin(pokemon, mode) {
  if (!DISCOVERY_MODES.has(mode) && !['duel', 'guess', 'deduction', 'coop', 'nearest'].includes(mode)) return;
  const state = secretProgress();
  if (!advanceSecretProgress(state, 'wins', pokemon?.id, playerProfile.favoritePokemonId)) return;
  saveProfile(); renderSecretMissions();
  if (state.wins.length === 3) showToast('Une présence t’attend près de ton partenaire, sur l’accueil…');
}
function trackSecretDexVisit(pokemon) {
  const state = secretProgress();
  if (!advanceSecretProgress(state, 'electric', pokemon?.id, playerProfile.favoritePokemonId)) return;
  saveProfile(); renderSecretMissions();
  if (state.electric.length === 3) showToast('Un drôle de signal vient d’apparaître en haut du Pokédex…');
}
function inspectSecretRune(place) {
  const state = secretProgress();
  if (advanceSecretProgress(state, 'runes', place, playerProfile.favoritePokemonId)) saveProfile();
  renderSecretMissions();
  ensureOverlay('Une marque mystérieuse', `<div class="secret-rune-reveal"><span aria-hidden="true">✧</span><h4>${state.runes.length} / 3 marques retrouvées</h4><p>${state.runes.length === 3 ? 'Les trois marques résonnent ensemble. Une présence se manifeste dans ton carnet.' : (state.runes.length === 1 ? 'La marque s’illumine. Deux autres signes lui ressemblent, entre l’accueil, le Pokédex et ton profil.' : 'La marque s’illumine. Il reste un signe à retrouver, entre l’accueil, le Pokédex et ton profil.')}</p><button type="button" class="btn-blue" data-action="openSecretJournal">Ouvrir le carnet des secrets →</button></div>`);
}
function openSecretJournal() {
  closeOverlayModal(); openProfileScreen(); switchProfileView('secrets');
  document.querySelector('.profile-view-switch')?.scrollIntoView({ block: 'start' });
}
function goToSecretPlace(key) {
  closeOverlayModal();
  const mission = SECRET_MISSIONS.find(m => m.id === key);
  if (!mission) return;
  if (mission.destination === 'home') { goToConfig(); document.getElementById('home-partner')?.scrollIntoView({ block: 'center' }); }
  else if (mission.destination === 'dex') openPokedexMode();
  else openSecretJournal();
  if (secretMissionProgress(mission, secretProgress(), playerProfile.favoritePokemonId) === 3) document.getElementById('secret-spot-' + key)?.scrollIntoView({ block: 'center' });
}
function renderSecretMissions() {
  const state = secretProgress();
  const panel = document.getElementById('secret-missions');
  const count = document.getElementById('secrets-tab-count');
  if (count) count.textContent = Object.keys(state.claimed).length + '/3';
  if (panel) panel.innerHTML = SECRET_MISSIONS.map(mission => {
    const value = secretMissionProgress(mission, state, playerProfile.favoritePokemonId), claimed = state.claimed[mission.id], ready = value === 3;
    const pokemon = claimed ? POKEMON_BY_ID.get(mission.pokemonId) : null;
    return `<article class="secret-mission ${claimed ? 'is-complete' : ready ? 'is-ready' : ''}"><div class="secret-mission-top"><span class="secret-mission-icon" aria-hidden="true">${mission.icon}</span><span>${claimed ? 'RENCONTRÉ' : ready ? 'UNE PRÉSENCE T’ATTEND' : 'PISTE À EXPLORER'}</span><b>${value}/3</b></div><h4>${mission.title}</h4><p>${mission.hint}</p>${pokemon ? `<div class="secret-found">${partnerImage(pokemon)}<strong>${escapeHtml(pokemon.name)}</strong><small>Rencontré le ${new Date(claimed).toLocaleDateString('fr-FR')}</small></div>` : `<progress max="3" value="${value}" aria-label="${mission.title}"></progress><details class="secret-hint"><summary>Voir la mission</summary><p>${mission.task}</p>${mission.id === 'runes' ? '<ul>' + [['home','Accueil'],['dex','Pokédex'],['profile','Profil · Dresseur']].map(([key, label]) => '<li>' + (state.runes.includes(key) ? '✓ ' : '○ ') + label + '</li>').join('') + '</ul>' : ''}<small>Progression conservée. Aucun compte à rebours.</small></details>`}<div class="secret-mission-bottom"><small>${mission.place}</small><button type="button" class="btn-ghost" data-action="${claimed ? 'viewSecretAlbum' : 'goToSecretPlace'}" data-args='["${mission.id}"]'>${claimed ? 'Voir dans l’album →' : ready ? 'Aller à la cachette →' : 'Explorer →'}</button></div></article>`;
  }).join('');
  for (const mission of SECRET_MISSIONS) {
    const spot = document.getElementById('secret-spot-' + mission.id);
    if (!spot) continue;
    const visible = !state.claimed[mission.id] && secretMissionProgress(mission, state, playerProfile.favoritePokemonId) === 3;
    spot.classList.toggle('hidden', !visible);
    // Preserve focus and animation state when another part of the page rerenders.
    if (visible && !spot.firstElementChild) spot.innerHTML = `<button type="button" class="secret-encounter" data-action="meetSecretPokemon" data-args='["${mission.id}"]'><span class="secret-shadow" aria-hidden="true">?</span><span><small>UNE PRÉSENCE INHABITUELLE</small><strong>${mission.id === 'signal' ? 'D’où vient ce signal ?' : mission.id === 'runes' ? 'Les marques ont réveillé quelque chose…' : 'Quelque chose bouge près de toi…'}</strong><span>Approcher doucement →</span></span></button>`;
  }
  document.querySelectorAll('[data-rune]').forEach(button => {
    const found = state.runes.includes(button.dataset.rune);
    button.classList.toggle('is-found', found);
    button.setAttribute('aria-pressed', String(found));
    button.title = found ? 'Marque déjà retrouvée' : 'Une marque mystérieuse…';
  });
}
function meetSecretPokemon(key) {
  const mission = SECRET_MISSIONS.find(m => m.id === key), state = secretProgress();
  if (!mission || state.claimed[key] || secretMissionProgress(mission, state, playerProfile.favoritePokemonId) < 3) return;
  const pokemon = POKEMON_BY_ID.get(mission.pokemonId);
  if (!pokemon) return;
  ensureOverlay('Une rencontre secrète', `<div class="secret-reveal"><span class="adventure-eyebrow">${mission.title}</span><div class="secret-reveal-sprite">${partnerImage(pokemon)}</div><h4>${escapeHtml(pokemon.name)} était caché ici !</h4><p>Tu as suivi les indices jusqu’au bout. Cette rencontre gardera sa propre trace dans ton album.</p><button type="button" class="btn-blue" data-action="claimSecretPokemon" data-args='["${mission.id}"]'>Accueillir ${escapeHtml(pokemon.name)} dans l’album</button></div>`);
}
function claimSecretReward(state, collection, key, favoriteId, now = Date.now()) {
  const mission = SECRET_MISSIONS.find(m => m.id === key);
  if (!mission || state.claimed[key] || secretMissionProgress(mission, state, favoriteId) < 3) return false;
  const pokemon = POKEMON_BY_ID.get(mission.pokemonId);
  if (!pokemon) return false;
  addDiscovery(collection, pokemon, 'secret', now, 'secret');
  collection[pokemon.id].secrets ||= {};
  collection[pokemon.id].secrets[key] = now;
  state.claimed[key] = now;
  return true;
}
function claimSecretPokemon(key) {
  const state = secretProgress();
  playerProfile.discoveries ||= {};
  if (!claimSecretReward(state, playerProfile.discoveries, key, playerProfile.favoritePokemonId)) return;
  saveProfile(); closeOverlayModal(); renderPartner(); renderSecretMissions();
  const mission = SECRET_MISSIONS.find(m => m.id === key), pokemon = POKEMON_BY_ID.get(mission.pokemonId);
  showToast(`${pokemon.name} rejoint ton album · Rencontre secrète`);
  viewSecretAlbum(key);
}
function viewSecretAlbum(key) {
  const mission = SECRET_MISSIONS.find(m => m.id === key);
  if (!mission) return;
  openDiscoveryAlbum();
  document.getElementById('album-search').value = POKEMON_BY_ID.get(mission.pokemonId)?.name || '';
  document.getElementById('album-generation').value = 'all';
  document.getElementById('album-status').value = 'secrets';
  albumPage = 1; renderDiscoveryAlbum();
}
window.addEventListener('DOMContentLoaded', () => { renderSecretMissions(); });
