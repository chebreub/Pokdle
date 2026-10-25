
// Links from the game pages (/jeux/<slug>) open their game at once: /?jeu=<slug>.
// The parameter is removed first, so a reload or a shared link lands on the home.
const LANDING_GAMES = Object.freeze({
  'pokemon-du-jour': ['startDailyGame'],
  'wordle-pokemon': ['startDailyGame'],
  'grille-pokemon': ['startDailyGrid'],
  'petit-bac-pokemon': ['openPetitBacMode'],
  'oeuf-mystere': ['openEggGame'],
  'ligue-pokemon': ['openWeeklyLeague'],
  'devine-le-pokemon': ['startNormalGame'],
  'zoom-pokemon': ['startSilhouetteGame'],
  'pokemon-pixelise': ['startPixelGame'],
  'description-pokedex': ['startDescriptionMode'],
  'cri-pokemon': ['startCryGame'],
  'stat-mystere': ['startMysteryStatGame'],
  'poke-connections': ['openPokeConnectionsMode'],
  'quiz-pokemon': ['startQuizGame'],
  'higher-or-lower-pokemon': ['openHigherLowerMode'],
  'intrus-pokemon': ['openOddOneOutMode'],
  'qui-est-ce-pokemon': ['openQuiEstCeMode'],
  'evolution-pokemon': ['startEvolutionChainGame'],
  'ordre-pokedex': ['startPokedexOrderGame'],
  'combo-de-types': ['openTypeComboSolo'],
  'duel-de-poids': ['startWeightBattle'],
  'speedrun-pokedex': ['openSpeedrunMode'],
  'jeux-pokemon-entre-amis': ['openPartyRoomMode'],
  'table-des-types': ['openTypeChartScreen'],
  'team-builder': ['openTeamBuilderScreen'],
  'pokedex': ['openPokedexMode'],
});
// The contact link of the About page (/a-propos) opens « Donne ton avis »: /?avis.
function openLandingGame() {
  let params;
  try { params = new URLSearchParams(location.search); } catch (e) { return; }
  const slug = params.get('jeu');
  const feedback = params.has('avis');
  if (!slug && !feedback) return;
  params.delete('jeu');
  params.delete('avis');
  const query = params.toString();
  try { history.replaceState(history.state, '', location.pathname + (query ? '?' + query : '') + location.hash); } catch (e) {}
  if (feedback) {
    if (typeof window.openFeedbackModal === 'function') try { window.openFeedbackModal(); } catch (e) { console.warn('[avis] ouverture impossible :', e); }
    return;
  }
  const entry = Object.prototype.hasOwnProperty.call(LANDING_GAMES, slug) ? LANDING_GAMES[slug] : null;
  if (!entry || typeof window[entry[0]] !== 'function') return;
  try { window[entry[0]](...(entry[1] || [])); } catch (e) { console.warn('[jeu] ouverture impossible :', e); }
}
// After the screen history has read the address (same event, registered earlier).
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(openLandingGame, 0));
else setTimeout(openLandingGame, 0);
