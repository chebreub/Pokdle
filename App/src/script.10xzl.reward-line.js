// 🎁 Les gains annoncés avant de jouer (4/11/2026, maquette validée) : une ligne en haut de chaque jeu dit ce
// que rapporte la 1re partie du jour (Ball et ₽ pour les jeux vérifiés par le serveur, règle de la Super Ball),
// « ✓ Gagné aujourd'hui », ou « Entraînement » pour un jeu pas encore vérifié (il ne rapporte rien pour
// l'instant). Rien en Party Room, au Pokémon du jour ni dans les défis entre joueurs.
var REWARD_GOLD = {
  normal: 'trouvé en 6 essais au plus', mystery: 'trouvé en 6 essais au plus',
  pixel: 'trouvé en 3 essais au plus', silhouette: 'trouvé en 3 essais au plus', cry: 'trouvé en 3 essais au plus',
  description: 'trouvé en 3 essais au plus', evolution: 'trouvé en 3 essais au plus', order: 'trouvé en 3 essais au plus',
  quiestce: 'trouvé en 8 essais au plus', quiz: '12 / 15 ou plus', speedrun: '25 Pokémon ou plus',
  'higher-lower': 'série de 15 ou plus', 'higher-lower-rush': '25 points ou plus', odd: '10 énigmes ou plus',
  weight: 'série de 10 ou plus', petitbac: '6 bonnes réponses ou plus', shiny: '20 bonnes réponses ou plus',
  'poke-connections': 'les 4 groupes trouvés', typecombo: '10 points ou plus', 'stat-clash': 'une victoire',
  'stat-auction': 'une victoire', draft: 'palier Elite (550+)'
};
// Le nom de la source côté serveur (mode:<…>) quand il diffère du mode.
var REWARD_SOURCE = { 'higher-lower': 'higherlower', 'higher-lower-rush': 'higherlower', 'poke-connections': 'connections', 'stat-auction': 'statauction', 'stat-clash': 'statclash' };
var REWARD_SCREENS = {
  'screen-type-combo': 'typecombo', 'screen-speedrun': 'speedrun', 'screen-poke-connections': 'poke-connections',
  'screen-qui-est-ce': 'quiestce', 'screen-odd-one-out': 'odd', 'screen-stat-auction': 'stat-auction',
  'screen-stat-clash': 'stat-clash', 'screen-draft-score-attack': 'draft', 'screen-shiny': 'shiny'
};
function rewardModeNow() {
  var screen = document.body && document.body.dataset.screen;
  if (!screen || (typeof isPartySessionActive === 'function' && isPartySessionActive())) return null;
  if (screen === 'screen-game') return REWARD_GOLD[gameMode] ? gameMode : null;
  if (screen === 'screen-higher-lower') return typeof higherLowerState !== 'undefined' && higherLowerState && ['rush60', 'rush'].includes(higherLowerState.mode) ? 'higher-lower-rush' : 'higher-lower';
  return REWARD_SCREENS[screen] || null;
}
function rewardLineHtml(mode) {
  var s = typeof ballState !== 'undefined' ? ballState : null;
  if (!s) return '';
  // A game without server verification remains training, including when the daily Ball cap is reached.
  var paid = Array.isArray(s.verifiedModes) && s.verifiedModes.indexOf(mode) >= 0;
  if (!paid) return '<p class="reward-line is-training"><span>🎯 Entraînement : pas de Ball ni de ₽ pour ce jeu pour l’instant</span></p>';
  var source = 'mode:' + (REWARD_SOURCE[mode] || mode);
  var won = (s.gains || []).concat(s.bonus || []).some(function (g) { return g.source === source; });
  if (won) return '<p class="reward-line is-done"><span>✓ Récompense du jour gagnée · revient demain</span></p>';
  // Pokédollars and Balls have distinct caps: a paid mode may still grant coins after 10 Balls.
  if (Number(s.today) >= Number(s.cap || 10)) {
    var coinNote = s.coins && s.coins.enabled ? ' · Les Pokédollars ont leur propre plafond.' : '';
    return '<p class="reward-line is-done"><span>Plafond quotidien des Balls atteint (' + Number(s.cap || 10) + '/' + Number(s.cap || 10) + '). Continue de jouer !' + coinNote + '</span></p>';
  }
  var coins = s.coins && s.coins.enabled ? ' + 30 à 90 ₽' : ' (+ ₽ avec un compte)';
  return '<p class="reward-line"><span class="reward-ball" aria-hidden="true"></span><span>1re partie du jour : 1 Ball' + coins +
    ' · <b>Super Ball</b> : ' + escapeHtml(REWARD_GOLD[mode]) + '</span></p>';
}
function renderRewardLine() {
  var old = document.querySelectorAll('.reward-line');
  var mode = rewardModeNow();
  var screen = mode && document.getElementById(document.body.dataset.screen);
  var html = screen ? rewardLineHtml(mode) : '';
  if (!html) { old.forEach(function (n) { n.remove(); }); return; }
  var anchor = screen.querySelector('.game-topbar, .dedicated-toolbar');
  var current = screen.querySelector('.reward-line');
  if (current && current.outerHTML === html) return;
  old.forEach(function (n) { n.remove(); });
  if (anchor) anchor.insertAdjacentHTML('afterend', html);
  else (screen.querySelector('.gameplay-screen-card') || screen).insertAdjacentHTML('afterbegin', html);
}
if (typeof showScreen === 'function') {
  var showScreenBeforeReward = showScreen;
  showScreen = function () { var out = showScreenBeforeReward.apply(this, arguments); try { renderRewardLine(); } catch (_e) {} return out; };
}
if (typeof startGameWithSecret === 'function') {
  var startGameBeforeReward = startGameWithSecret;
  startGameWithSecret = function () { var out = startGameBeforeReward.apply(this, arguments); try { renderRewardLine(); } catch (_e) {} return out; };
}
if (typeof ballApply === 'function') {
  var ballApplyBeforeReward = ballApply;
  ballApply = function () { var out = ballApplyBeforeReward.apply(this, arguments); try { renderRewardLine(); } catch (_e) {} return out; };
}
