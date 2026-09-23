
// Unified Pokédex collection experience.
// Collection mode turns the existing encyclopaedia into the player's progression hub
// without removing the full reference view.
let pokedexExperienceView = 'collection';
let pokedexCollectionFilter = 'all';
const POKEDEX_COLLECTION_REGIONS = ['Kanto','Johto','Hoenn','Sinnoh','Unys','Kalos','Alola','Galar','Paldea'];

function pokedexCollectionDiscoveries() {
  return playerProfile?.discoveries || {};
}
function pokedexSecretMissionForPokemon(pokemonId) {
  if (typeof SECRET_MISSIONS === 'undefined') return null;
  return SECRET_MISSIONS.find(mission => Number(mission.pokemonId) === Number(pokemonId)) || null;
}
function pokedexCollectionState(pokemon) {
  if (!pokemon) return { kind:'unknown', label:'Non enregistré', entry:null, mission:null, progress:null };
  const entry = pokedexCollectionDiscoveries()[pokemon.id];
  if (entry) {
    const secret = Boolean(Object.keys(entry.secrets || {}).length);
    return { kind:'registered', label: secret ? 'Secret enregistré' : 'Enregistré', entry, mission:null, progress:null, secret };
  }
  const gate = typeof getAlbumMissionGate === 'function' ? getAlbumMissionGate(pokemon.id) : null;
  if (gate) {
    const progress = typeof albumMissionState === 'function' ? albumMissionState(gate) : null;
    const hidden = Boolean(gate.hidden || gate.tier === 'secret');
    return {
      kind: hidden ? 'secret' : 'mission',
      label: hidden ? 'Entrée secrète' : progress?.ready ? 'Mission prête' : 'Mission',
      entry:null, mission:gate, progress, hidden
    };
  }
  const secretMission = pokedexSecretMissionForPokemon(pokemon.id);
  if (secretMission) {
    return { kind:'secret', label:'Entrée secrète', entry:null, mission:secretMission, progress:null, hidden:true, journalSecret:true };
  }
  return { kind:'unknown', label:'Non enregistré', entry:null, mission:null, progress:null };
}
function pokedexCollectionVisibleName(pokemon, state = pokedexCollectionState(pokemon)) {
  if (!pokemon) return '???';
  if (state.kind === 'registered') return pokemon.name;
  if (state.kind === 'mission' && !state.hidden) return pokemon.name;
  return '???';
}
function pokedexCollectionMatchesFilter(pokemon) {
  if (pokedexExperienceView !== 'collection' || pokedexCollectionFilter === 'all') return true;
  const state = pokedexCollectionState(pokemon);
  if (pokedexCollectionFilter === 'registered') return state.kind === 'registered';
  if (pokedexCollectionFilter === 'mission') return state.kind === 'mission';
  if (pokedexCollectionFilter === 'secret') return state.kind === 'secret' || (state.kind === 'registered' && state.secret);
  if (pokedexCollectionFilter === 'unknown') return state.kind === 'unknown';
  return true;
}
function pokedexCollectionBaseCatalogue() {
  if (typeof getPokemonUiList === 'function') return getPokemonUiList({ includeAltForms:false }).filter(p => !p.isAltForm);
  return POKEMON_LIST.filter(p => !p.isAltForm && Number(p.id) < 20000);
}
function pokedexCollectionRegionStats(gen) {
  const group = pokedexCollectionBaseCatalogue().filter(p => Number(p.gen) === Number(gen));
  const discoveries = pokedexCollectionDiscoveries();
  const found = group.filter(p => discoveries[p.id]).length;
  return { found, total:group.length, percent:group.length ? Math.round(found / group.length * 100) : 0 };
}
function pokedexCollectionNationalStats() {
  const group = pokedexCollectionBaseCatalogue();
  const discoveries = pokedexCollectionDiscoveries();
  const found = group.filter(p => discoveries[p.id]).length;
  const missions = group.filter(p => {
    const state = pokedexCollectionState(p);
    return state.kind === 'mission' || state.kind === 'secret';
  }).length;
  return { found, total:group.length, missions, percent:group.length ? Math.round(found / group.length * 100) : 0 };
}
function ensurePokedexCollectionHub() {
  const screen = document.getElementById('screen-pokedex');
  if (!screen || document.getElementById('pokedex-collection-hub')) return;
  const toolbar = document.getElementById('pokedex-toolbar');
  if (!toolbar) return;
  const hub = document.createElement('section');
  hub.id = 'pokedex-collection-hub';
  hub.className = 'pokedex-collection-hub';
  hub.innerHTML = `
    <div class="pokedex-collection-console">
      <div class="pokedex-collection-identity">
        <span class="pokedex-console-kicker">POKÉDLE // TERMINAL DRESSEUR</span>
        <h3>Ton Pokédex</h3>
        <p>Chaque entrée enregistrée raconte une partie, une mission ou un secret.</p>
      </div>
      <div id="pokedex-collection-national" class="pokedex-collection-national"></div>
    </div>
    <div class="pokedex-experience-switch" role="group" aria-label="Mode du Pokédex">
      <button type="button" data-pokedex-view="collection" data-action="setPokedexExperienceView" data-args='["collection"]'>Collection</button>
      <button type="button" data-pokedex-view="encyclopedia" data-action="setPokedexExperienceView" data-args='["encyclopedia"]'>Encyclopédie</button>
      <button type="button" class="pokedex-missions-link" data-action="openPokedexMissionHub">Missions <span id="pokedex-mission-ready-count"></span></button>
    </div>
    <div id="pokedex-region-progress" class="pokedex-region-progress" aria-label="Progression par région"></div>
    <div id="pokedex-collection-filters" class="pokedex-collection-filters" role="group" aria-label="État de collection">
      <button type="button" data-collection-filter="all" data-action="setPokedexCollectionFilter" data-args='["all"]'>Toutes</button>
      <button type="button" data-collection-filter="registered" data-action="setPokedexCollectionFilter" data-args='["registered"]'>✓ Enregistrées</button>
      <button type="button" data-collection-filter="mission" data-action="setPokedexCollectionFilter" data-args='["mission"]'>◆ Missions</button>
      <button type="button" data-collection-filter="unknown" data-action="setPokedexCollectionFilter" data-args='["unknown"]'>? Inconnues</button>
      <button type="button" data-collection-filter="secret" data-action="setPokedexCollectionFilter" data-args='["secret"]'>✦ Secrets</button>
    </div>`;
  toolbar.parentElement.insertBefore(hub, toolbar);
}
function renderPokedexCollectionHub() {
  ensurePokedexCollectionHub();
  const hub = document.getElementById('pokedex-collection-hub');
  if (!hub) return;
  const stats = pokedexCollectionNationalStats();
  hub.classList.toggle('is-encyclopedia', pokedexExperienceView === 'encyclopedia');
  document.querySelectorAll('[data-pokedex-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.pokedexView === pokedexExperienceView)));
  document.querySelectorAll('[data-collection-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.collectionFilter === pokedexCollectionFilter)));
  const national = document.getElementById('pokedex-collection-national');
  if (national) national.innerHTML = `
    <div><strong>${stats.found}<small> / ${stats.total}</small></strong><span>entrées enregistrées</span></div>
    <progress value="${stats.found}" max="${stats.total || 1}" aria-label="Progression du Pokédex national"></progress>
    <small>${stats.percent}% complété · ${stats.missions} entrée(s) spéciale(s) encore à débloquer</small>`;
  const regions = document.getElementById('pokedex-region-progress');
  if (regions) regions.innerHTML = POKEDEX_COLLECTION_REGIONS.map((name,index) => {
    const gen=index+1, data=pokedexCollectionRegionStats(gen);
    const active = String(pokedexGenFilter) === String(gen);
    return `<button type="button" data-action="selectPokedexCollectionRegion" data-args='[${gen}]' aria-pressed="${active}">
      <span><b>${name}</b><small>Gen ${gen}</small></span><strong>${data.found}<small>/${data.total}</small></strong>
      <progress value="${data.found}" max="${data.total || 1}" aria-label="${name} ${data.percent}%"></progress>
    </button>`;
  }).join('');
  const ready = typeof ALBUM_MISSIONS === 'undefined' ? 0 : ALBUM_MISSIONS.filter(m => {
    const state=typeof albumMissionState === 'function' ? albumMissionState(m) : null;
    return state?.ready && !state.claimed;
  }).length;
  const readyEl=document.getElementById('pokedex-mission-ready-count');
  if (readyEl) readyEl.textContent = ready ? `· ${ready} prête${ready>1?'s':''}` : '';
  document.getElementById('pokedex-collection-filters')?.classList.toggle('hidden', pokedexExperienceView !== 'collection');
}
function setPokedexExperienceView(view) {
  pokedexExperienceView = view === 'encyclopedia' ? 'encyclopedia' : 'collection';
  if (typeof playPokedexUiSfx === 'function') playPokedexUiSfx('register');
  renderPokedexGrid();
}
function setPokedexCollectionFilter(filter) {
  const allowed=['all','registered','mission','unknown','secret'];
  pokedexCollectionFilter=allowed.includes(filter)?filter:'all';
  renderPokedexGrid();
}
function selectPokedexCollectionRegion(gen) {
  const value=String(gen);
  pokedexGenFilter = pokedexGenFilter === value ? 'all' : value;
  const select=document.getElementById('pokedex-gen-filter');
  if (select) select.value=pokedexGenFilter;
  renderPokedexGrid();
}
function openPokedexMissionHub() {
  openProfileScreen();
  switchProfileView('album');
  if (typeof ensureAlbumMissionPanel === 'function') ensureAlbumMissionPanel();
  if (typeof renderAlbumMissions === 'function') renderAlbumMissions();
  document.getElementById('album-mission-panel')?.scrollIntoView({ block:'start', behavior:'smooth' });
}
function openPokedexCollection() {
  pokedexExperienceView='collection';
  pokedexCollectionFilter='all';
  openPokedexMode();
}
function playCollectionPokemonCry(pokemonId) {
  const pokemon=POKEMON_BY_ID.get(Number(pokemonId));
  if (!pokemon) return;
  try {
    const settings=typeof getStoredAppSettings === 'function' ? getStoredAppSettings() : {};
    if (settings.pokemonCries === false) return showToast('Les cris Pokémon sont désactivés dans les paramètres.');
  } catch (_e) {}
  if (typeof playPokemonCry === 'function') playPokemonCry(pokemon,.55);
}
function chooseCollectionPartner(pokemonId) {
  if (typeof choosePartner === 'function') choosePartner(Number(pokemonId));
  renderPokedexDetail(POKEMON_BY_ID.get(Number(pokemonId)) || null);
}
function pokedexCollectionMissionRequirementsHtml(state) {
  if (!state?.mission) return '';
  if (state.journalSecret) {
    return `<div class="pokedex-lock-objectives"><p>${escapeHtml(state.mission.hint || 'Une piste secrète existe quelque part dans Pokédle.')}</p><button class="btn-ghost" type="button" data-action="openSecretJournal">Ouvrir le carnet des secrets →</button></div>`;
  }
  const missionState=state.progress || (typeof albumMissionState === 'function' ? albumMissionState(state.mission) : null);
  if (!missionState) return '';
  const rows=missionState.reqs.map(item=>`<li class="${item.done?'is-done':''}"><span>${item.done?'✓':'○'} ${escapeHtml(albumMissionRequirementLabel(item.req))}</span><b>${Math.min(item.value,item.goal)}/${item.goal}</b></li>`).join('');
  return `<div class="pokedex-lock-objectives"><ul>${rows}</ul><button class="btn-blue" type="button" data-action="openPokedexMissionHub">Voir toutes les missions →</button></div>`;
}
function renderPokedexCollectionLockedDetail(pokemon,state) {
  const detail=document.getElementById('pokedex-detail');
  if (!detail || !pokemon) return;
  const dexId=getPokemonSpriteId(pokemon);
  const visibleName=pokedexCollectionVisibleName(pokemon,state);
  const hidden=visibleName==='???';
  const missionTitle=state.mission?.title || (state.kind==='secret'?'Une piste reste à découvrir':'Entrée non enregistrée');
  const helper=state.kind==='unknown'
    ? 'Trouve ce Pokémon dans un mode compatible pour enregistrer définitivement son entrée.'
    : state.kind==='secret'
      ? (state.mission?.hint || 'Certaines entrées ne se révèlent qu’en explorant Pokédle.')
      : (state.mission?.hint || 'Accomplis cette mission pour enregistrer cette entrée.');
  const sprite=getPokedexDisplaySprite(pokemon,false);
  detail.innerHTML=`
    <div class="pokedex-collection-lock state-${state.kind}">
      <div class="pokedex-collection-lock-head"><span>POKÉDEX DU DRESSEUR</span><span>#${dexId}</span></div>
      <div class="pokedex-collection-lock-stage">
        <div class="pokedex-lock-radar" aria-hidden="true"></div>
        <img src="${sprite}" alt="" data-fallback="${getSpriteUrl(dexId)}" />
        <span class="pokedex-lock-state">${state.kind==='secret'?'✦':state.kind==='mission'?'◆':'?'}</span>
      </div>
      <div class="pokedex-collection-lock-copy">
        <span class="pokedex-lock-kicker">${escapeHtml(state.label)}</span>
        <h3>${escapeHtml(visibleName)}</h3>
        <strong>${escapeHtml(hidden && state.kind==='secret' ? 'DONNÉES CLASSIFIÉES' : missionTitle)}</strong>
        <p>${escapeHtml(helper)}</p>
      </div>
      ${pokedexCollectionMissionRequirementsHtml(state)}
      <div class="pokedex-lock-actions">
        ${state.kind==='unknown'?'<button type="button" class="btn-blue" data-action="startNormalGame">Partir à sa recherche →</button>':''}
        <button type="button" class="btn-ghost" data-action="setPokedexExperienceView" data-args='["encyclopedia"]'>Consulter l’encyclopédie</button>
      </div>
    </div>`;
}
function pokedexCollectionRecordHtml(pokemon,state) {
  if (!state?.entry) return '';
  const entry=state.entry;
  const date=entry.at ? new Date(entry.at).toLocaleDateString('fr-FR') : 'Date inconnue';
  const proof=typeof discoveryProofHtml === 'function' ? discoveryProofHtml(entry) : '';
  const partner=Number(playerProfile?.favoritePokemonId)===Number(pokemon.id);
  return `<section class="pokedex-personal-record">
    <div class="pokedex-personal-record-head"><span>✓ ENTRÉE ENREGISTRÉE</span><strong>Ton histoire avec ${escapeHtml(pokemon.name)}</strong></div>
    <div class="pokedex-personal-record-grid">
      <div><span>Enregistré le</span><b>${date}</b></div>
      <div><span>Origine</span><b>${escapeHtml(typeof discoveryModeLabel==='function'?discoveryModeLabel(entry.mode):String(entry.mode||'Pokédle'))}</b></div>
    </div>
    <div class="pokedex-personal-proof">${proof}</div>
    <div class="pokedex-personal-actions">
      <button type="button" class="btn-ghost" data-action="playCollectionPokemonCry" data-args='[${Number(pokemon.id)}]'>🔊 Écouter le cri</button>
      <button type="button" class="btn-ghost" data-action="chooseCollectionPartner" data-args='[${Number(pokemon.id)}]' ${partner?'disabled':''}>${partner?'Ton partenaire ✓':'Choisir comme partenaire'}</button>
    </div>
  </section>`;
}

const getFilteredPokedexListBeforeCollection = getFilteredPokedexList;
getFilteredPokedexList = function () {
  const list=getFilteredPokedexListBeforeCollection();
  return pokedexExperienceView==='collection' ? list.filter(pokedexCollectionMatchesFilter) : list;
};

const createPokedexCardBeforeCollection = createPokedexCard;
createPokedexCard = function (pokemon) {
  const card=createPokedexCardBeforeCollection(pokemon);
  if (pokedexExperienceView!=='collection') return card;
  const state=pokedexCollectionState(pokemon);
  card.classList.add('collection-card','state-'+state.kind);
  card.dataset.collectionState=state.kind;
  const name=card.querySelector('strong');
  if (name) name.textContent=pokedexCollectionVisibleName(pokemon,state);
  const image=card.querySelector('img');
  if (image && state.kind!=='registered') { image.alt=''; image.setAttribute('aria-hidden','true'); }
  const badge=document.createElement('span');
  badge.className='pokedex-collection-state';
  badge.textContent=state.label;
  card.appendChild(badge);
  if ((state.kind==='mission'||state.kind==='secret') && state.progress?.total) {
    const meter=document.createElement('progress');
    meter.className='pokedex-card-mission-progress';
    meter.max=state.progress.total; meter.value=state.progress.done;
    meter.setAttribute('aria-label',`Progression ${state.mission?.title || 'mission'}`);
    card.appendChild(meter);
  }
  return card;
};

const renderPokedexDetailBeforeCollection = renderPokedexDetail;
renderPokedexDetail = async function (pokemon) {
  if (!pokemon) return renderPokedexDetailBeforeCollection(pokemon);
  const state=pokedexCollectionState(pokemon);
  if (pokedexExperienceView==='collection' && state.kind!=='registered') {
    renderPokedexCollectionLockedDetail(pokemon,state);
    return;
  }
  await renderPokedexDetailBeforeCollection(pokemon);
  if (pokedexExperienceView!=='collection' || state.kind!=='registered' || Number(pokedexSelectedId)!==Number(pokemon.id)) return;
  const detail=document.getElementById('pokedex-detail');
  if (!detail || detail.querySelector('.pokedex-personal-record')) return;
  detail.insertAdjacentHTML('afterbegin',pokedexCollectionRecordHtml(pokemon,state));
};

const renderPokedexGridBeforeCollection = renderPokedexGrid;
renderPokedexGrid = function () {
  ensurePokedexCollectionHub();
  const result=renderPokedexGridBeforeCollection();
  renderPokedexCollectionHub();
  document.getElementById('screen-pokedex')?.classList.toggle('pokedex-view-collection',pokedexExperienceView==='collection');
  return result;
};

const openPokedexModeBeforeCollection = openPokedexMode;
openPokedexMode = function () {
  ensurePokedexCollectionHub();
  const result=openPokedexModeBeforeCollection();
  renderPokedexCollectionHub();
  return result;
};

if (typeof window!=='undefined' && window.addEventListener) window.addEventListener('DOMContentLoaded',()=>{
  ensurePokedexCollectionHub();
  renderPokedexCollectionHub();
});
