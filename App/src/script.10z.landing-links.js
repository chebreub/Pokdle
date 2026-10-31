
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
  'shiny-ou-normal': ['openShinyMode'],
  'qui-est-ce-pokemon': ['openQuiEstCeMode'],
  'evolution-pokemon': ['startEvolutionChainGame'],
  'ordre-pokedex': ['startPokedexOrderGame'],
  'combo-de-types': ['openTypeComboSolo'],
  'duel-de-poids': ['startWeightBattle'],
  'speedrun-pokedex': ['openSpeedrunMode'],
  'jeux-pokemon-entre-amis': ['openPartyRoomMode'],
  'dessine-le-pokemon': ['openPartyRoomWithGame', ['dessin']],
  'table-des-types': ['openTypeChartScreen'],
  'team-builder': ['openTeamBuilderScreen'],
  'pokedex': ['openPokedexMode'],
});
// A friend's shared daily result (/?defi=<number>-<attempts>) opens the Pokémon du jour with
// their score as the target, kept under the game's title while the visitor plays.
let landingFriendGoal = null;
function landingChallengeMessage(code, today) {
  const match = /^(\d{1,5})-(\d{1,2})$/.exec(code || '');
  if (!match) return '';
  const attempts = Number(match[2]);
  return Number(match[1]) === Number(today)
    ? `🎯 Ton ami l'a trouvé en ${attempts} essai${attempts > 1 ? 's' : ''}. À toi de faire mieux !`
    : '🎯 Ton ami t\'a lancé un défi. Voici le Pokémon du jour !';
}
function renderLandingFriendGoal() {
  const intro = document.getElementById?.('shell-intro');
  if (!intro) return;
  let line = document.getElementById('shell-friend-goal');
  if (!landingFriendGoal || typeof gameMode === 'undefined' || gameMode !== 'daily') { line?.remove(); return; }
  if (!line) {
    line = document.createElement('p');
    line.id = 'shell-friend-goal';
    line.className = 'shell-friend-goal';
    intro.appendChild(line);
  }
  line.textContent = landingFriendGoal;
}
if (typeof renderGameShell === 'function') {
  const renderGameShellBeforeFriendGoal = renderGameShell;
  renderGameShell = function () {
    const value = renderGameShellBeforeFriendGoal.apply(this, arguments);
    renderLandingFriendGoal();
    return value;
  };
}
// The contact link of the About page (/a-propos) opens « Donne ton avis »: /?avis.
function openLandingGame() {
  let params;
  try { params = new URLSearchParams(location.search); } catch (e) { return; }
  const slug = params.get('jeu');
  const feedback = params.has('avis');
  const challenge = params.get('defi');
  if (!slug && !feedback && !challenge) return;
  params.delete('jeu');
  params.delete('avis');
  params.delete('defi');
  const query = params.toString();
  try { history.replaceState(history.state, '', location.pathname + (query ? '?' + query : '') + location.hash); } catch (e) {}
  if (feedback) {
    if (typeof window.openFeedbackModal === 'function') try { window.openFeedbackModal(); } catch (e) { console.warn('[avis] ouverture impossible :', e); }
    return;
  }
  if (challenge && !slug) {
    const message = landingChallengeMessage(challenge, typeof getDailyNumber === 'function' ? getDailyNumber() : 0);
    landingFriendGoal = message || null;
    try { window.startDailyGame(); } catch (e) { console.warn('[defi] ouverture impossible :', e); }
    renderLandingFriendGoal();
    return;
  }
  const entry = Object.prototype.hasOwnProperty.call(LANDING_GAMES, slug) ? LANDING_GAMES[slug] : null;
  if (!entry || typeof window[entry[0]] !== 'function') return;
  try { window[entry[0]](...(entry[1] || [])); } catch (e) { console.warn('[jeu] ouverture impossible :', e); }
}
// After the screen history has read the address (same event, registered earlier).
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(openLandingGame, 0));
else setTimeout(openLandingGame, 0);
