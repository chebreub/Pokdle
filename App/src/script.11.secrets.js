
// Optional exploration: no imported progress, deadlines, XP or competitive advantage.
const SECRET_MISSIONS = [
  { id: 'companion', pokemonId: 133, title: 'Une présence familière', icon: '✦', place: 'Sur l’accueil, près de ton partenaire', hint: 'Les belles aventures attirent de nouveaux compagnons.', task: 'Choisis un partenaire, puis trouve 3 Pokémon différents dans les jeux de devinette.', destination: 'home', goal: 3 },
  { id: 'signal', pokemonId: 479, title: 'Un drôle de signal', icon: 'ϟ', place: 'Dans le Pokédex', hint: 'Un appareil crépite quand tu t’intéresses à l’électricité…', task: 'Ouvre les fiches de 3 Pokémon Électrik différents dans le Pokédex.', destination: 'dex', goal: 3 },
  { id: 'runes', pokemonId: 442, title: 'Les trois marques', icon: '✧', place: 'Dans ce carnet', hint: 'Trois petites étoiles ont été gravées loin des terrains de jeu.', task: 'Examine les marques ✧ de l’accueil, du Pokédex et de l’onglet Dresseur.', destination: 'journal', goal: 3 },
  { id: 'starters', pokemonId: 151, title: 'Le tout premier choix', icon: '❋', place: 'Dans le Pokédex', hint: 'Trois chemins, une même aventure. Tout a commencé à Kanto.', task: 'Ouvre les fiches de Bulbizarre, Salamèche et Carapuce.', destination: 'dex', goal: 3 },
  { id: 'fossils', pokemonId: 142, title: 'Sous la poussière', icon: '◇', place: 'Dans le Pokédex', hint: 'Certaines histoires dorment dans la pierre.', task: 'Examine 3 fossiles différents : Amonita, Kabuto, Ptéra, Lilia, Anorith, Kranidos, Dinoclier, Carapagos, Arkéapti, Ptyranidur ou Amagara.', destination: 'dex', goal: 3 },
  { id: 'dragons', pokemonId: 147, title: 'Une écaille azur', icon: '≋', place: 'Dans le Pokédex', hint: 'Une écaille minuscule attend un connaisseur des dragons.', task: 'Ouvre les fiches de 3 Pokémon de type Dragon différents.', destination: 'dex', goal: 3 },
  { id: 'ghosts', pokemonId: 353, title: 'Derrière les pages', icon: '◈', place: 'Dans le Pokédex', hint: 'Tu tournes une page. Quelqu’un la retourne derrière toi.', task: 'Ouvre les fiches de 3 Pokémon de type Spectre différents.', destination: 'dex', goal: 3 },
  { id: 'forms', pokemonId: 132, title: 'Un visage peut en cacher un autre', icon: '◐', place: 'Dans le Pokédex', hint: 'Le même nom, mais jamais tout à fait la même silhouette…', task: 'Examine 3 formes alternatives différentes. Active les formes dans les filtres du Pokédex.', destination: 'dex', goal: 3 },
  { id: 'regions', pokemonId: 251, title: 'Les pages du temps', icon: '⌘', place: 'Dans le Pokédex', hint: 'Un voyage ne se compte pas seulement en kilomètres.', task: 'Ouvre au moins une fiche dans 5 générations différentes.', destination: 'dex', goal: 5 },
  { id: 'variety', pokemonId: 235, title: 'Toutes les couleurs du jeu', icon: '✺', place: 'Sur l’accueil', hint: 'Un artiste cherche trois façons de raconter la même aventure.', task: 'Trouve un Pokémon dans 3 modes de devinette différents (solo, silhouette, duel, course en Party… au choix).', destination: 'home', goal: 3 },
  { id: 'melody', pokemonId: 385, title: 'La boîte à souhaits', icon: '✧', place: 'Dans ce carnet', hint: 'Une feuille s’éveille au soleil, rêve sous la lune, puis revient à la forêt.', task: 'Ouvre la boîte et touche ses quatre symboles dans l’ordre raconté par l’indice.', destination: 'journal', goal: 4 },
  { id: 'aurora', pokemonId: 570, title: 'La piste des éléments', icon: '⟡', place: 'Dans le Pokédex', hint: 'Une braise. Une goutte. Une feuille. Quelqu’un te suit.', task: 'Ouvre, dans cet ordre et sans autre fiche entre les trois, Salamèche, Carapuce puis Bulbizarre.', destination: 'dex', goal: 3 }
];
const SECRET_FOSSILS = new Set([138, 140, 142, 345, 347, 408, 410, 564, 566, 696, 698]);
const SECRET_MELODY = ['leaf', 'sun', 'moon', 'leaf'];
let secretJournalFilter = 'active';
function secretModeEligible(mode) {
  return DISCOVERY_MODES.has(mode) || ['duel', 'guess', 'deduction', 'coop', 'nearest'].includes(mode);
}
function normalizeSecretProgress(raw) {
  const ids = (value, limit = 3, accept = () => true) => Array.isArray(value) ? [...new Set(value.map(Number).filter(id => Number.isInteger(id) && POKEMON_BY_ID.has(id) && accept(POKEMON_BY_ID.get(id))))].slice(0, limit) : [];
  const claimed = {};
  for (const mission of SECRET_MISSIONS) if (Number.isFinite(raw?.claimed?.[mission.id]) && raw.claimed[mission.id] > 0) claimed[mission.id] = Math.min(raw.claimed[mission.id], Date.now());
  const melody = Array.isArray(raw?.melody) ? raw.melody.slice(0, 4) : [];
  const trail = Array.isArray(raw?.trail) ? raw.trail.slice(0, 3) : [];
  return {
    wins: ids(raw?.wins), electric: ids(raw?.electric, 3, isSecretElectric),
    runes: Array.isArray(raw?.runes) ? [...new Set(raw.runes.filter(key => ['home', 'dex', 'profile'].includes(key)))] : [],
    visits: ids(raw?.visits, 2000),
    modes: Array.isArray(raw?.modes) ? [...new Set(raw.modes.filter(secretModeEligible))].slice(0, 3) : [],
    melody: melody.every((note, i) => note === SECRET_MELODY[i]) ? melody : [],
    trail: trail.every((id, i) => id === [4, 7, 1][i]) ? trail : [], claimed
  };
}
function isSecretElectric(pokemon) { return secretHasType(pokemon, 'Électrik'); }
function secretHasType(pokemon, type) { return pokemon?.type1 === type || pokemon?.type2 === type; }
function secretProgress() {
  if (!playerProfile.secrets) playerProfile.secrets = normalizeSecretProgress(null);
  return playerProfile.secrets;
}
function secretMissionProgress(mission, state, favoriteId) {
  const visits = (state.visits || []).map(id => POKEMON_BY_ID.get(id)).filter(Boolean);
  const counts = {
    companion: POKEMON_BY_ID.has(Number(favoriteId)) ? state.wins.length : 0,
    signal: state.electric.length, runes: state.runes.length,
    starters: visits.filter(p => [1, 4, 7].includes(p.id)).length,
    fossils: visits.filter(p => SECRET_FOSSILS.has(p.id)).length,
    dragons: visits.filter(p => secretHasType(p, 'Dragon')).length,
    ghosts: visits.filter(p => secretHasType(p, 'Spectre')).length,
    forms: visits.filter(p => p.isAltForm === true).length,
    regions: new Set(visits.map(p => Number(p.gen)).filter(gen => Number.isInteger(gen) && gen >= 1 && gen <= 9)).size,
    variety: (state.modes || []).length, melody: (state.melody || []).length, aurora: (state.trail || []).length
  };
  return Math.min(mission.goal, counts[mission.id] || 0);
}
function advanceSecretProgress(state, kind, value, favoriteId) {
  if (kind === 'runes') {
    if (!['home', 'dex', 'profile'].includes(value) || state.runes.includes(value)) return false;
    state.runes.push(value); return true;
  }
  const pokemon = POKEMON_BY_ID.get(Number(value));
  if (!pokemon || !['wins', 'electric', 'visits'].includes(kind)) return false;
  if (kind === 'wins' && !POKEMON_BY_ID.has(Number(favoriteId))) return false;
  if (kind === 'electric' && !isSecretElectric(pokemon)) return false;
  state[kind] ||= [];
  if (state[kind].length >= (kind === 'visits' ? 2000 : 3) || state[kind].includes(pokemon.id)) return false;
  state[kind].push(pokemon.id); return true;
}
function secretReadyIds(state) {
  return SECRET_MISSIONS.filter(m => !state.claimed[m.id] && secretMissionProgress(m, state, playerProfile.favoritePokemonId) >= m.goal).map(m => m.id);
}
function finishSecretProgress(before) {
  saveProfile(); renderSecretMissions();
  const fresh = secretReadyIds(secretProgress()).filter(id => !before.includes(id));
  if (fresh.length) showToast(`${fresh.length === 1 ? 'Une nouvelle cachette t’attend' : fresh.length + ' nouvelles cachettes t’attendent'} · Profil → Secrets`);
}
function recordSecretWin(pokemon, mode) {
  if (!pokemon || !POKEMON_BY_ID.has(pokemon.id) || !secretModeEligible(mode)) return;
  const state = secretProgress(), before = secretReadyIds(state);
  let changed = advanceSecretProgress(state, 'wins', pokemon.id, playerProfile.favoritePokemonId);
  state.modes ||= [];
  if (!state.modes.includes(mode) && state.modes.length < 3) { state.modes.push(mode); changed = true; }
  if (changed) finishSecretProgress(before);
}
function trackSecretDexVisit(pokemon) {
  if (!pokemon || !POKEMON_BY_ID.has(pokemon.id)) return;
  const state = secretProgress(), before = secretReadyIds(state);
  let changed = advanceSecretProgress(state, 'electric', pokemon.id, playerProfile.favoritePokemonId);
  changed = advanceSecretProgress(state, 'visits', pokemon.id, playerProfile.favoritePokemonId) || changed;
  state.trail ||= [];
  if (state.trail.length < 3) {
    const next = pokemon.id === [4, 7, 1][state.trail.length] ? [...state.trail, pokemon.id] : pokemon.id === 4 ? [4] : [];
    if (String(next) !== String(state.trail)) { state.trail = next; changed = true; }
  }
  if (changed) finishSecretProgress(before);
}
function advanceSecretMelody(state, note) {
  if (!['leaf', 'sun', 'moon'].includes(note) || state.melody.length === 4) return false;
  state.melody = note === SECRET_MELODY[state.melody.length] ? [...state.melody, note] : note === 'leaf' ? ['leaf'] : [];
  return true;
}
function openSecretMelody() {
  const state = secretProgress();
  ensureOverlay('La boîte à souhaits', `<div class="secret-puzzle"><span class="adventure-eyebrow">UNE INSCRIPTION SUR LE COUVERCLE</span><p>Une feuille s’éveille au soleil, rêve sous la lune, puis revient à la forêt.</p><div class="secret-puzzle-keys">${[['leaf','❋','Feuille'],['sun','☀','Soleil'],['moon','☾','Lune']].map(([key,icon,label]) => `<button type="button" data-action="playSecretNote" data-args='["${key}"]'><span aria-hidden="true">${icon}</span>${label}</button>`).join('')}</div><p id="secret-puzzle-status" role="status">${state.melody.length}/4 symboles alignés</p><button id="secret-puzzle-meet" type="button" class="btn-blue ${state.melody.length < 4 ? 'hidden' : ''}" data-action="meetSecretPokemon" data-args='["melody"]'>Ouvrir la boîte →</button></div>`);
}
function playSecretNote(note) {
  const state = secretProgress(), before = secretReadyIds(state), oldLength = state.melody.length;
  if (!advanceSecretMelody(state, note)) return;
  finishSecretProgress(before);
  const status = document.getElementById('secret-puzzle-status');
  if (status) status.textContent = state.melody.length === 4 ? 'Les quatre symboles s’illuminent. La boîte s’ouvre !' : `${state.melody.length}/4 symboles alignés${state.melody.length <= oldLength ? ' · La boîte attend une nouvelle séquence.' : ''}`;
  document.getElementById('secret-puzzle-meet')?.classList.toggle('hidden', state.melody.length < 4);
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
  else if (key === 'melody' && !secretProgress().claimed[key]) { openSecretMelody(); return; }
  else openSecretJournal();
  if (secretMissionProgress(mission, secretProgress(), playerProfile.favoritePokemonId) >= mission.goal) document.getElementById('secret-spot-' + key)?.scrollIntoView({ block: 'center' });
}
function setSecretJournalFilter(filter) {
  if (!['active', 'ready', 'found'].includes(filter)) return;
  secretJournalFilter = filter; renderSecretMissions();
}
function renderSecretMissions() {
  const state = secretProgress(), readyIds = secretReadyIds(state);
  const panel = document.getElementById('secret-missions'), count = document.getElementById('secrets-tab-count');
  if (count) count.textContent = Object.keys(state.claimed).length + '/' + SECRET_MISSIONS.length;
  document.querySelectorAll('[data-secret-filter]').forEach(button => {
    const filter = button.dataset.secretFilter;
    button.setAttribute('aria-pressed', String(filter === secretJournalFilter));
    const n = filter === 'ready' ? readyIds.length : filter === 'found' ? Object.keys(state.claimed).length : SECRET_MISSIONS.length - Object.keys(state.claimed).length;
    button.querySelector('span').textContent = n;
  });
  const missions = SECRET_MISSIONS.filter(m => secretJournalFilter === 'found' ? state.claimed[m.id] : secretJournalFilter === 'ready' ? readyIds.includes(m.id) : !state.claimed[m.id]);
  missions.sort((a, b) => Number(readyIds.includes(b.id)) - Number(readyIds.includes(a.id)));
  if (panel) panel.innerHTML = missions.map(mission => {
    const value = secretMissionProgress(mission, state, playerProfile.favoritePokemonId), claimed = state.claimed[mission.id], ready = value >= mission.goal;
    const pokemon = claimed ? POKEMON_BY_ID.get(mission.pokemonId) : null;
    return `<article class="secret-mission ${claimed ? 'is-complete' : ready ? 'is-ready' : ''}"><div class="secret-mission-top"><span class="secret-mission-icon" aria-hidden="true">${mission.icon}</span><span>${claimed ? 'RENCONTRÉ' : ready ? 'UNE PRÉSENCE T’ATTEND' : 'PISTE À EXPLORER'}</span><b>${value}/${mission.goal}</b></div><h4>${mission.title}</h4><p>${mission.hint}</p>${pokemon ? `<div class="secret-found">${partnerImage(pokemon)}<strong>${escapeHtml(pokemon.name)}</strong><small>Rencontré le ${new Date(claimed).toLocaleDateString('fr-FR')}</small></div>` : `<progress max="${mission.goal}" value="${value}" aria-label="${mission.title}"></progress><details class="secret-hint"><summary>Voir la mission</summary><p>${mission.task}</p>${mission.id === 'runes' ? '<ul>' + [['home','Accueil'],['dex','Pokédex'],['profile','Profil · Dresseur']].map(([key, label]) => '<li>' + (state.runes.includes(key) ? '✓ ' : '○ ') + label + '</li>').join('') + '</ul>' : ''}<small>Progression conservée. Aucun compte à rebours.</small></details>`}<div class="secret-mission-bottom"><small>${mission.place}</small><button type="button" class="btn-ghost" data-action="${claimed ? 'viewSecretAlbum' : 'goToSecretPlace'}" data-args='["${mission.id}"]'>${claimed ? 'Voir dans l’album →' : ready ? 'Aller à la cachette →' : mission.id === 'melody' ? 'Examiner la boîte →' : 'Explorer →'}</button>${claimed ? `<button type="button" class="secret-replay" data-action="replaySecretEncounter" data-args='["${mission.id}"]'>Revoir la rencontre</button>` : ''}</div></article>`;
  }).join('') || '<p class="secret-empty">' + (secretJournalFilter === 'ready' ? 'Aucune cachette prête pour le moment. Les indices t’attendent dans « À explorer ».' : secretJournalFilter === 'found' ? 'Tes rencontres apparaîtront ici. Choisis une piste pour commencer.' : 'Toutes les rencontres sont dans ton album. Tu peux les revoir dans « Rencontrés ».') + '</p>';
  for (const mission of SECRET_MISSIONS) {
    let spot = document.getElementById('secret-spot-' + mission.id);
    if (!spot) {
      const host = document.getElementById('secret-extra-' + mission.destination);
      if (!host) continue;
      spot = document.createElement('div'); spot.id = 'secret-spot-' + mission.id; spot.className = 'secret-spot hidden'; host.appendChild(spot);
    }
    const visible = !state.claimed[mission.id] && readyIds.includes(mission.id);
    spot.classList.toggle('hidden', !visible);
    if (visible && !spot.firstElementChild) spot.innerHTML = `<button type="button" class="secret-encounter" data-action="meetSecretPokemon" data-args='["${mission.id}"]'><span class="secret-shadow" aria-hidden="true">${mission.icon}</span><span><small>UNE PRÉSENCE INHABITUELLE</small><strong>${mission.title}</strong><span>Approcher doucement →</span></span></button>`;
  }
  document.querySelectorAll('[data-rune]').forEach(button => {
    const found = state.runes.includes(button.dataset.rune);
    button.classList.toggle('is-found', found); button.setAttribute('aria-pressed', String(found));
    button.title = found ? 'Marque déjà retrouvée' : 'Une marque mystérieuse…';
  });
}
function secretEncounterHtml(mission, pokemon, collected, alreadyOwned = false, replay = false) {
  const artwork = `https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/other/official-artwork/${pokemon.id}.png`;
  return `<div class="encounter-scene ${collected ? 'is-collected' : 'is-revealing'} ${replay ? 'is-revealing is-replaying' : ''}" data-encounter="${mission.id}">
    <div class="encounter-chapter"><span>LE CARNET DES SECRETS</span><span>RENCONTRE ${String(SECRET_MISSIONS.indexOf(mission) + 1).padStart(2, '0')}</span></div>
    <div class="encounter-stage"><div class="encounter-orbit" aria-hidden="true"></div><div class="encounter-sparks" aria-hidden="true">${'<i></i>'.repeat(8)}</div><img class="encounter-art" width="280" height="280" src="${artwork}" data-fallback="${getPokemonSprite(pokemon)}" alt="${escapeHtml(pokemon.name)}" fetchpriority="high" /><span class="encounter-seal" aria-hidden="true">✦</span></div>
    <div class="encounter-copy"><span class="encounter-kicker">${collected ? '✦ RENCONTRE ENREGISTRÉE' : 'UNE RENCONTRE SECRÈTE'}</span><h4>${escapeHtml(pokemon.name)}</h4><span class="encounter-number">N° ${String(pokemon.id).padStart(3, '0')} · ${escapeHtml(mission.title)}</span><p>${collected ? (alreadyOwned ? 'Déjà dans ton album, désormais avec une nouvelle histoire à raconter.' : replay ? 'Le souvenir de votre première rencontre est conservé dans ton album.' : 'Une nouvelle page de ton aventure vient de s’écrire.') : escapeHtml(mission.hint)}</p></div>
    <div class="encounter-actions">${collected ? `<p class="encounter-saved" role="status">✓ Enregistré dans ton album</p><button type="button" class="btn-blue" data-action="viewSecretAlbum" data-args='["${mission.id}"]'>Voir ${escapeHtml(pokemon.name)} dans l’album →</button><button type="button" class="btn-ghost" data-action="closeOverlayModal">Continuer l’exploration</button>` : `<button type="button" class="btn-blue" data-action="claimSecretPokemon" data-args='["${mission.id}"]'>Accueillir ${escapeHtml(pokemon.name)} <span aria-hidden="true">✦</span></button><small>Cette rencontre restera liée à la mission dans ton album.</small>`}</div>
  </div>`;
}
function showSecretEncounter(mission, collected = false, alreadyOwned = false, replay = false) {
  const pokemon = POKEMON_BY_ID.get(mission.pokemonId);
  if (pokemon) ensureOverlay(collected ? 'Un souvenir dans ton album' : 'Tu as trouvé une cachette', secretEncounterHtml(mission, pokemon, collected, alreadyOwned, replay));
}
function meetSecretPokemon(key) {
  const mission = SECRET_MISSIONS.find(m => m.id === key), state = secretProgress();
  if (!mission || state.claimed[key] || secretMissionProgress(mission, state, playerProfile.favoritePokemonId) < mission.goal) return;
  showSecretEncounter(mission);
}
function replaySecretEncounter(key) {
  const mission = SECRET_MISSIONS.find(m => m.id === key);
  if (mission && secretProgress().claimed[key]) showSecretEncounter(mission, true, false, true);
}
function claimSecretReward(state, collection, key, favoriteId, now = Date.now()) {
  const mission = SECRET_MISSIONS.find(m => m.id === key);
  if (!mission || state.claimed[key] || secretMissionProgress(mission, state, favoriteId) < mission.goal) return false;
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
  const mission = SECRET_MISSIONS.find(m => m.id === key);
  const alreadyOwned = !!playerProfile.discoveries[mission?.pokemonId];
  if (!claimSecretReward(state, playerProfile.discoveries, key, playerProfile.favoritePokemonId)) return;
  // Persist before any animation: closing, reloading or reduced motion never loses a reward.
  saveProfile(); renderPartner(); renderSecretMissions();
  showSecretEncounter(mission, true, alreadyOwned);
}

function viewSecretAlbum(key) {
  const mission = SECRET_MISSIONS.find(m => m.id === key);
  if (!mission) return;
  closeOverlayModal(); openDiscoveryAlbum();
  document.getElementById('album-search').value = POKEMON_BY_ID.get(mission.pokemonId)?.name || '';
  document.getElementById('album-generation').value = 'all';
  document.getElementById('album-status').value = 'secrets';
  albumPage = 1; renderDiscoveryAlbum();
}
window.addEventListener('DOMContentLoaded', () => { renderSecretMissions(); });
