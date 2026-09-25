
// Home Adventure V2 — makes progression the primary entry point of Pokédle.
const HOME_ADVENTURE_REGIONS = ['Kanto','Johto','Hoenn','Sinnoh','Unys','Kalos','Alola','Galar','Paldea'];

function homeAdventureRegionStats(gen) {
  if (typeof pokedexCollectionRegionStats === 'function') return pokedexCollectionRegionStats(gen);
  const list = typeof getPokemonUiList === 'function'
    ? getPokemonUiList({ includeAltForms:false }).filter(p => !p.isAltForm && Number(p.gen) === Number(gen))
    : Array.from(typeof POKEMON_BY_ID !== 'undefined' ? POKEMON_BY_ID.values() : []).filter(p => !p.isAltForm && Number(p.gen) === Number(gen));
  const discoveries = playerProfile?.discoveries || {};
  const found = list.filter(p => discoveries[p.id]).length;
  return { found, total:list.length, percent:list.length ? Math.round(found/list.length*100) : 0 };
}
function homeAdventureNationalStats() {
  if (typeof pokedexCollectionNationalStats === 'function') return pokedexCollectionNationalStats();
  const list = typeof getPokemonUiList === 'function'
    ? getPokemonUiList({ includeAltForms:false }).filter(p => !p.isAltForm)
    : Array.from(typeof POKEMON_BY_ID !== 'undefined' ? POKEMON_BY_ID.values() : []).filter(p => !p.isAltForm);
  const discoveries = playerProfile?.discoveries || {};
  const found = list.filter(p => discoveries[p.id]).length;
  return { found, total:list.length, percent:list.length ? Math.round(found/list.length*100) : 0 };
}
function homeAdventureCurrentRegion() {
  const discoveries = playerProfile?.discoveries || {};
  let recentPokemon = null, recentAt = -1;
  for (const [rawId, entry] of Object.entries(discoveries)) {
    const pokemon = typeof POKEMON_BY_ID !== 'undefined' ? POKEMON_BY_ID.get(Number(rawId)) : null;
    const at = Number(entry?.at) || 0;
    if (pokemon && Number(pokemon.gen) >= 1 && Number(pokemon.gen) <= 9 && at > recentAt) {
      recentPokemon = pokemon; recentAt = at;
    }
  }
  if (recentPokemon) {
    const stats = homeAdventureRegionStats(recentPokemon.gen);
    if (stats.total && stats.found < stats.total) return { gen:Number(recentPokemon.gen), name:HOME_ADVENTURE_REGIONS[Number(recentPokemon.gen)-1], ...stats };
  }
  const regions = HOME_ADVENTURE_REGIONS.map((name,index)=>({gen:index+1,name,...homeAdventureRegionStats(index+1)}));
  const active = regions.filter(r=>r.found>0 && r.found<r.total).sort((a,b)=>b.percent-a.percent || b.found-a.found);
  if (active.length) return active[0];
  const incomplete = regions.find(r=>r.total && r.found<r.total) || regions[0];
  return incomplete;
}
function homeAdventureMissionCandidate(regionGen) {
  if (typeof ALBUM_MISSIONS === 'undefined' || typeof albumMissionState !== 'function') return null;
  const candidates = [];
  for (const mission of ALBUM_MISSIONS) {
    let state;
    try { state = albumMissionState(mission); } catch (_e) { continue; }
    if (!state || state.claimed) continue;
    const ratio = state.total ? state.done/state.total : 0;
    const hiddenDormant = Boolean(mission.hidden) && state.done === 0 && !state.ready;
    let score = ratio * 20;
    if (Number(mission.generation) === Number(regionGen)) score += 24;
    if (state.done > 0) score += 18;
    if (state.ready) score += 100;
    if (mission.tier === 'legendary') score += 3;
    if (hiddenDormant) score -= 80;
    candidates.push({ mission, state, ratio, score });
  }
  candidates.sort((a,b)=>b.score-a.score || b.ratio-a.ratio || a.mission.generation-b.mission.generation);
  return candidates[0] || null;
}
function homeAdventureMissionReward(candidate) {
  if (!candidate || typeof POKEMON_BY_ID === 'undefined') return null;
  return POKEMON_BY_ID.get(Number(candidate.mission.pokemonId)) || null;
}
function homeAdventureMissionSummary(candidate) {
  if (!candidate) return 'Explore ton Pokédex pour faire apparaître de nouveaux objectifs.';
  const { mission, state } = candidate;
  if (state.ready) return 'Tous les objectifs sont remplis. La récompense t’attend.';
  const pending = state.reqs?.find(item=>!item.done);
  if (pending && typeof albumMissionRequirementLabel === 'function') return albumMissionRequirementLabel(pending.req);
  return mission.hint || 'Continue ta progression pour faire avancer cette mission.';
}
function homeAdventureMissionTier(candidate) {
  if (!candidate) return 'PROCHAINE ÉTAPE';
  if (typeof albumMissionTierLabel === 'function') return albumMissionTierLabel(candidate.mission).toUpperCase();
  return String(candidate.mission.tier || 'mission').toUpperCase();
}
function homeAdventureClaimedMissionCount() {
  return Object.keys(playerProfile?.albumMissionClaims || {}).length;
}
function homeAdventureSecretCount() {
  return Object.keys(playerProfile?.secrets?.claimed || {}).length;
}
function homeAdventurePartner() {
  return typeof POKEMON_BY_ID !== 'undefined' ? POKEMON_BY_ID.get(Number(playerProfile?.favoritePokemonId)) || null : null;
}
function homeAdventureTrainerName() {
  const raw = String(playerProfile?.nickname || '').trim();
  return raw || 'Dresseur';
}
function homeAdventurePartnerVisual(pokemon) {
  if (!pokemon) return '<div class="home-adventure-partner-empty"><span>?</span><small>Choisis ton partenaire</small></div>';
  const sprite = typeof getPokemonSprite === 'function' ? getPokemonSprite(pokemon) : '';
  const fallback = typeof getSpriteUrl === 'function' && typeof getPokemonSpriteId === 'function' ? getSpriteUrl(getPokemonSpriteId(pokemon)) : sprite;
  return `<div class="home-adventure-partner-art"><span class="home-adventure-dexno">#${String(Number(pokemon.baseId || pokemon.id)).padStart(3,'0')}</span><img src="${sprite}" alt="${escapeHtml(pokemon.name)}" data-fallback="${fallback}" /><small>PARTENAIRE · ${escapeHtml(pokemon.name)}</small></div>`;
}
function renderHomeAdventureV2() {
  const home = document.getElementById('home-partner');
  const screen = document.getElementById('screen-config');
  const daily = document.getElementById('daily-hero');
  if (!home || !screen || !daily) return;

  const pathways = screen.querySelector('.home-pathways');
  const weekly = document.getElementById('weekly-league-home');
  const anchor = pathways || weekly || daily;
  if (anchor.nextElementSibling !== home) {
    anchor.insertAdjacentElement('afterend', home);
  }

  const xp = Number(playerProfile?.xp) || 0;
  const xpProgress = typeof getXpProgress === 'function' ? getXpProgress(xp) : { tier:{level:1,name:'Débutant',emoji:'⭐'}, next:null, percent:0, xpInTier:xp, xpToNext:0 };
  const national = homeAdventureNationalStats();
  const region = homeAdventureCurrentRegion();
  const candidate = homeAdventureMissionCandidate(region?.gen || 1);
  const reward = homeAdventureMissionReward(candidate);
  const partner = homeAdventurePartner();
  const ready = Boolean(candidate?.state?.ready);
  const progressDone = Number(candidate?.state?.done) || 0;
  const progressTotal = Math.max(1, Number(candidate?.state?.total) || 1);
  const missionTitle = candidate?.mission?.title || 'Commence ton aventure';
  const rewardName = reward?.name || 'Prochaine découverte';
  const missionAction = candidate ? `continueHomeAdventureMission', data-args='["${candidate.mission.id}"]` : 'openPokedexCollection';
  const xpLabel = xpProgress.next ? `${xpProgress.xpInTier} / ${xpProgress.xpToNext} XP vers ${escapeHtml(xpProgress.next.name)}` : `${xp} XP · palier maximum`;

  home.className = 'home-adventure-v2';
  home.innerHTML = `
    <div class="home-adventure-main">
      <div class="home-adventure-copy">
        <span class="home-adventure-eyebrow">TON AVENTURE CONTINUE</span>
        <h1>Bon retour, <span>${escapeHtml(homeAdventureTrainerName())}</span>.</h1>
        <p>Ton Pokédex avance à chaque défi. Continue là où ton aventure s’est arrêtée.</p>
        <div class="home-trainer-rank">
          <span class="home-rank-icon">${xpProgress.tier.emoji || '⭐'}</span>
          <div><b>Niv. ${xpProgress.tier.level} · ${escapeHtml(xpProgress.tier.name)}</b><small>${xpLabel}</small><progress value="${xpProgress.percent}" max="100"></progress></div>
        </div>
        <div class="home-adventure-stats">
          <button type="button" data-action="openPokedexCollection"><strong>${national.found}<small>/${national.total}</small></strong><span>Pokédex</span></button>
          <button type="button" data-action="openPokedexMissionHub"><strong>${homeAdventureClaimedMissionCount()}<small>/108</small></strong><span>Missions</span></button>
          <button type="button" data-action="openSecretJournal"><strong>${homeAdventureSecretCount()}<small>/12</small></strong><span>Secrets</span></button>
        </div>
      </div>
      ${homeAdventurePartnerVisual(partner)}
    </div>

    <div class="home-adventure-next">
      <div class="home-next-head">
        <span>${escapeHtml(homeAdventureMissionTier(candidate))}</span>
        <b>${ready ? 'RÉCOMPENSE PRÊTE' : 'À POURSUIVRE'}</b>
      </div>
      <div class="home-next-body">
        <div class="home-next-reward">
          ${reward ? `<img src="${getPokemonSprite(reward)}" alt="${escapeHtml(reward.name)}" data-fallback="${getSpriteUrl(getPokemonSpriteId(reward))}" />` : '<span class="home-next-question">?</span>'}
          <div><small>RÉCOMPENSE</small><strong>${escapeHtml(rewardName)}</strong></div>
        </div>
        <div class="home-next-copy">
          <h2>${escapeHtml(missionTitle)}</h2>
          <p>${escapeHtml(homeAdventureMissionSummary(candidate))}</p>
          <div class="home-next-progress"><progress value="${progressDone}" max="${progressTotal}"></progress><span>${progressDone}/${progressTotal} objectifs</span></div>
        </div>
      </div>
      <button type="button" class="${ready ? 'btn-yellow' : 'btn-blue'} home-adventure-continue" data-action="${candidate ? 'continueHomeAdventureMission' : 'openPokedexCollection'}" ${candidate ? `data-args='["${candidate.mission.id}"]'` : ''}>${ready ? 'Réclamer la récompense' : 'Continuer mon aventure'} <span aria-hidden="true">→</span></button>
    </div>

    <div class="home-adventure-region">
      <div class="home-region-head"><div><span>RÉGION EN COURS</span><h3>${escapeHtml(region?.name || 'Kanto')}</h3></div><strong>${region?.percent || 0}%</strong></div>
      <progress value="${region?.found || 0}" max="${region?.total || 1}" aria-label="Progression ${escapeHtml(region?.name || 'Kanto')}"></progress>
      <div class="home-region-foot"><span><b>${region?.found || 0}</b> / ${region?.total || 0} enregistrés</span><button type="button" data-action="openHomeAdventureRegion" data-args='[${Number(region?.gen || 1)}]'>Explorer ${escapeHtml(region?.name || 'Kanto')} →</button></div>
    </div>`;

  home.querySelectorAll('img[data-fallback]').forEach(img=>img.addEventListener('error',()=>{
    const fallback=img.dataset.fallback;
    if (fallback && img.src!==fallback) img.src=fallback;
  },{once:true}));
}
function continueHomeAdventureMission(missionId) {
  if (typeof openPokedexMissionHub === 'function') openPokedexMissionHub();
  else {
    openProfileScreen();
    switchProfileView('album');
  }
  setTimeout(()=>{
    if (typeof focusAlbumMission === 'function') focusAlbumMission(missionId);
  },90);
}
function openHomeAdventureRegion(gen) {
  if (typeof openPokedexCollection !== 'function') return openPokedexMode();
  openPokedexCollection();
  setTimeout(()=>{
    if (typeof selectPokedexCollectionRegion === 'function') {
      pokedexGenFilter = String(gen);
      const select=document.getElementById('pokedex-gen-filter');
      if (select) select.value=String(gen);
      renderPokedexGrid();
    }
  },60);
}

if (typeof renderPartner === 'function') {
  const renderPartnerBeforeHomeAdventureV2 = renderPartner;
  renderPartner = function () {
    const result = renderPartnerBeforeHomeAdventureV2();
    renderHomeAdventureV2();
    return result;
  };
}
if (typeof goToConfig === 'function') {
  const goToConfigBeforeHomeAdventureV2 = goToConfig;
  goToConfig = function () {
    const result = goToConfigBeforeHomeAdventureV2.apply(this, arguments);
    setTimeout(renderHomeAdventureV2,0);
    return result;
  };
}
if (typeof recordMatchHistory === 'function') {
  const recordMatchHistoryBeforeHomeAdventureV2 = recordMatchHistory;
  recordMatchHistory = function (entry) {
    const result = recordMatchHistoryBeforeHomeAdventureV2(entry);
    setTimeout(renderHomeAdventureV2,0);
    return result;
  };
}
if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('DOMContentLoaded',()=>{
  renderHomeAdventureV2();
});
