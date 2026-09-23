
// Pokédex game-feel V1 — original UI SFX + registration ceremonies.
// Pokémon cries reuse the existing PokeAPI cries source already used by the Cry mode.
let pokedexFxAudioContext = null;
let pokedexRegistrationTimer = null;

function pokedexFxSettings() {
  try { return typeof getStoredAppSettings === 'function' ? getStoredAppSettings() : { soundEffects: true, pokemonCries: true, reduceMotion: false }; }
  catch (_e) { return { soundEffects: true, pokemonCries: true, reduceMotion: false }; }
}
function pokedexFxReducedMotion() {
  const settings = pokedexFxSettings();
  if (settings.reduceMotion) return true;
  try { return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches); } catch (_e) { return false; }
}
function getPokedexFxAudioContext() {
  if (!pokedexFxSettings().soundEffects) return null;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!pokedexFxAudioContext) pokedexFxAudioContext = new Ctx();
    if (pokedexFxAudioContext.state === 'suspended') pokedexFxAudioContext.resume().catch(() => {});
    return pokedexFxAudioContext;
  } catch (_e) { return null; }
}
function pokedexFxTone(ctx, frequency, start, duration, gain = 0.035, type = 'sine') {
  if (!ctx) return;
  const oscillator = ctx.createOscillator(), amp = ctx.createGain();
  oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, start);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + Math.min(0.025, duration / 3));
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(amp); amp.connect(ctx.destination);
  oscillator.start(start); oscillator.stop(start + duration + 0.02);
}
function playPokedexUiSfx(kind = 'register') {
  const ctx = getPokedexFxAudioContext();
  if (!ctx) return;
  const t = ctx.currentTime + 0.01;
  const score = {
    correct: [[620,0,.07,.025,'sine'],[820,.07,.09,.028,'sine']],
    error: [[180,0,.11,.025,'square'],[135,.09,.13,.02,'square']],
    register: [[440,0,.07,.022,'triangle'],[660,.07,.09,.026,'triangle'],[880,.15,.12,.03,'sine']],
    prestige: [[392,0,.09,.025,'triangle'],[587,.08,.12,.03,'triangle'],[784,.18,.18,.034,'sine']],
    legendary: [[261.6,0,.14,.03,'triangle'],[392,.09,.17,.034,'triangle'],[523.3,.2,.22,.038,'sine'],[784,.34,.24,.03,'sine']],
    secret: [[329.6,0,.16,.02,'sine'],[493.9,.12,.18,.026,'sine'],[659.3,.27,.24,.03,'sine']]
  }[kind] || [[440,0,.1,.025,'sine']];
  for (const [freq,offset,duration,gain,type] of score) pokedexFxTone(ctx,freq,t+offset,duration,gain,type);
}
function playPokedexRegistrationCry(pokemon, volume = 0.5) {
  if (!pokemon || !pokedexFxSettings().pokemonCries) return;
  if (typeof playPokemonCry === 'function') {
    setTimeout(() => playPokemonCry(pokemon, volume), pokedexFxReducedMotion() ? 80 : 620);
  }
}
function pokedexRegistrationTierMeta(tier = 'standard') {
  return {
    standard: { label: 'NOUVELLE ENTRÉE', sfx: 'register', kicker: 'DONNÉES ENREGISTRÉES' },
    expert: { label: 'ENTRÉE EXPERT', sfx: 'register', kicker: 'MISSION ACCOMPLIE' },
    prestige: { label: 'ENTRÉE PRESTIGE', sfx: 'prestige', kicker: 'MISSION PRESTIGE ACCOMPLIE' },
    legendary: { label: 'ENTRÉE LÉGENDAIRE', sfx: 'legendary', kicker: 'SIGNATURE LÉGENDAIRE DÉTECTÉE' },
    secret: { label: 'ENTRÉE SECRÈTE', sfx: 'secret', kicker: 'DONNÉES ANORMALES IDENTIFIÉES' }
  }[tier] || { label: 'NOUVELLE ENTRÉE', sfx: 'register', kicker: 'DONNÉES ENREGISTRÉES' };
}
function ensurePokedexRegistrationLayer() {
  let layer = document.getElementById('pokedex-registration-layer');
  if (layer) return layer;
  layer = document.createElement('section');
  layer.id = 'pokedex-registration-layer';
  layer.className = 'pokedex-registration-layer hidden';
  layer.setAttribute('aria-live','polite');
  layer.setAttribute('aria-modal','true');
  layer.setAttribute('role','dialog');
  document.body.appendChild(layer);
  return layer;
}
function closePokedexRegistration() {
  if (pokedexRegistrationTimer) { clearTimeout(pokedexRegistrationTimer); pokedexRegistrationTimer = null; }
  const layer = document.getElementById('pokedex-registration-layer');
  if (!layer || layer.classList.contains('hidden')) return;
  layer.classList.add('is-closing');
  const finish = () => {
    layer.classList.add('hidden'); layer.classList.remove('is-closing');
    layer.innerHTML = ''; document.body.classList.remove('pokedex-registration-open');
  };
  if (pokedexFxReducedMotion()) finish(); else setTimeout(finish, 220);
}
function openRegisteredPokemonInPokedex(pokemonId) {
  closePokedexRegistration();
  if (typeof openPokedexMode === 'function') openPokedexMode();
  if (typeof openPokedexRecent === 'function') openPokedexRecent(Number(pokemonId));
  if (typeof showPokedexMobileDetail === 'function') showPokedexMobileDetail();
}
function showPokedexRegistration(pokemon, options = {}) {
  if (!pokemon || typeof document === 'undefined') return false;
  const tier = options.tier || 'standard', meta = pokedexRegistrationTierMeta(tier);
  const special = ['prestige','legendary','secret'].includes(tier);
  const layer = ensurePokedexRegistrationLayer();
  if (pokedexRegistrationTimer) { clearTimeout(pokedexRegistrationTimer); pokedexRegistrationTimer = null; }
  const dexId = Number(pokemon.baseId || pokemon.id);
  const artworkId = typeof getPokemonSpriteId === 'function' ? getPokemonSpriteId(pokemon) : dexId;
  const artwork = `https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/other/official-artwork/${artworkId}.png`;
  const mission = options.missionTitle ? `<div class="pokedex-registration-mission"><span>${escapeHtml(options.missionLabel || 'MISSION')}</span><strong>${escapeHtml(options.missionTitle)}</strong></div>` : '';
  const types = typeof typeBadgesHtml === 'function' ? typeBadgesHtml(pokemon.type1,pokemon.type2) : '';
  layer.className = `pokedex-registration-layer tier-${tier} ${special ? 'is-special' : 'is-standard'}`;
  layer.innerHTML = `
    <div class="pokedex-registration-backdrop" aria-hidden="true"></div>
    <div class="pokedex-registration-shell">
      <div class="pokedex-registration-scan" aria-hidden="true"></div>
      <div class="pokedex-registration-gridfx" aria-hidden="true"></div>
      <div class="pokedex-registration-head"><span>POKÉDLE // POKÉDEX</span><span>#${String(dexId).padStart(3,'0')}</span></div>
      <div class="pokedex-registration-stage">
        <div class="pokedex-registration-rings" aria-hidden="true"><i></i><i></i><i></i></div>
        <span class="pokedex-registration-silhouette" aria-hidden="true">?</span>
        <img src="${artwork}" data-fallback="${getPokemonSprite(pokemon)}" alt="${escapeHtml(pokemon.name)}" />
        <div class="pokedex-registration-particles" aria-hidden="true">${'<i></i>'.repeat(special ? 16 : 8)}</div>
      </div>
      <div class="pokedex-registration-copy">
        <span class="pokedex-registration-kicker">${meta.kicker}</span>
        <h2>${escapeHtml(pokemon.name)}</h2>
        <div class="pokedex-registration-meta"><span>${meta.label}</span><span>GÉNÉRATION ${pokemon.gen}</span></div>
        <div class="pokedex-registration-types">${types}</div>
        ${mission}
      </div>
      <div class="pokedex-registration-actions">
        <button type="button" class="btn-blue" data-action="openRegisteredPokemonInPokedex" data-args='[${Number(pokemon.id)}]'>Voir la fiche Pokédex →</button>
        <button type="button" class="btn-ghost" data-action="closePokedexRegistration">Continuer</button>
      </div>
    </div>`;
  layer.querySelector('img')?.addEventListener('error', event => {
    const fallback = event.currentTarget?.dataset?.fallback;
    if (fallback && event.currentTarget.src !== fallback) event.currentTarget.src = fallback;
  }, { once: true });
  document.body.classList.add('pokedex-registration-open');
  requestAnimationFrame(() => layer.classList.add('is-active'));
  playPokedexUiSfx(meta.sfx);
  playPokedexRegistrationCry(pokemon, special ? 0.58 : 0.42);
  if (!special && options.autoClose !== false) {
    pokedexRegistrationTimer = setTimeout(closePokedexRegistration, pokedexFxReducedMotion() ? 900 : 2300);
  }
  return true;
}
function celebrateAlbumMission(mission, pokemon) {
  if (!mission || !pokemon) return false;
  return showPokedexRegistration(pokemon, {
    tier: mission.tier || 'expert',
    missionLabel: albumMissionTierLabel(mission),
    missionTitle: mission.title,
    autoClose: false
  });
}
function celebrateStandardDiscovery(pokemon, mode, at) {
  const timestamp = Number(at) || Date.now();
  if (Date.now() - timestamp > 12000) return false;
  return showPokedexRegistration(pokemon, {
    tier: 'standard',
    missionLabel: 'MODE',
    missionTitle: typeof discoveryModeLabel === 'function' ? discoveryModeLabel(mode) : String(mode || 'Jeu'),
    autoClose: true
  });
}
