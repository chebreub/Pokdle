
// 🏠 Accueil simplifié (4/11/2026, maquette validée par Kayan : « go », sans changer les couleurs du Défi du jour).
// Une seule boucle visible : devine → gagne une Ball → attrape.
// - Le « Défi du jour » (ses couleurs, ses 4 épreuves et ses bonus) ne change pas.
// - « Ta journée » devient une carte courte : « Ta prochaine capture » (Balls, rencontres, hautes herbes),
//   puis « Aussi aujourd'hui » (3 lignes au plus). L'Œuf, la Ligue, l'Expédition, la série et le sac
//   passent dans une fenêtre « Œuf, Ligue, Expédition… » (rien n'est retiré, rien ne pousse à revenir).
// - Un joueur qui n'a encore aucune Ball voit à la place les 3 étapes « Joue, gagne des Balls, attrape ».
// - Les mini-jeux passent avant « À plusieurs » et montrent « +1 Ball » / « ✓ Ball gagnée » (jeux vérifiés).
// Aucune règle de gain ne change : tout est lu dans ballState (GET /api/balls).

// Clé d'une tuile de l'accueil → mode côté serveur (verifiedModes) et source de la Ball (mode:<…>).
var HOME_TILE_MODES = {
  startSilhouetteGame: 'silhouette', openHigherLowerMode: 'higher-lower', startWeightBattle: 'weight',
  openOddOneOutMode: 'odd', startQuizGame: 'quiz', openPokeConnectionsMode: 'poke-connections',
  startNormalGame: 'normal', startPixelGame: 'pixel', startDescriptionMode: 'description', startCryGame: 'cry',
  startMysteryStatGame: 'mystery', openDraftScoreAttackMode: 'draft', openTypeComboSolo: 'typecombo',
  openSpeedrunMode: 'speedrun', openQuiEstCeMode: 'quiestce', openPetitBacMode: 'petitbac', openShinyMode: 'shiny',
  startWordleTraining: 'wordletraining'
};
var HOME_TILE_SOURCES = { 'higher-lower': 'higherlower', 'poke-connections': 'connections' };

function homeSimpleBeginner(s) {
  var w = s.wild || {};
  return !ballTotal(s) && !Number(s.today) && !Number(w.caught) && !(s.streak && s.streak.days) && !w.open;
}
function homeSimpleBallsWon(s, source) {
  return (s.gains || []).concat(s.bonus || []).some(function (g) { return g.source === source; });
}
function homeSimpleIcon(name) {
  var paths = {
    find: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    grass: '<path d="M4 21c1-5 1-9 0-13M9 21c0-6 1-11 3-15M15 21c-1-5 0-9 2-12M20 21c0-4-1-7-2-9"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>'
  };
  return '<svg class="hs-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths[name] + '</svg>';
}

// Nouveau joueur : les 3 étapes, sans chiffres ni compteurs.
function homeSimpleStepsHtml(s) {
  return '<div class="hs-steps-head"><h2>Joue, gagne des Balls, attrape</h2></div>' +
    '<ol class="hs-steps">' +
    '<li><span class="hs-step-ico is-find">' + homeSimpleIcon('find') + '</span><b>1. Devine</b><small>le Pokémon du jour ou un mini-jeu</small></li>' +
    '<li><span class="hs-step-ico is-ball">' + ballImg('poke', 24) + '</span><b>2. Gagne</b><small>une Ball dans les mini-jeux marqués +1 Ball</small></li>' +
    '<li><span class="hs-step-ico is-grass">' + homeSimpleIcon('grass') + '</span><b>3. Attrape</b><small>dans les hautes herbes, remplis ton album</small></li>' +
    '</ol>' +
    (s && s.giftAvailable ? '<button type="button" class="hs-beginner-gift" data-action="claimBallGift">' + ballImg('poke', 24) + '🎁 Ouvrir ma Poké Ball offerte</button>' : '');
}

// Joueur qui revient : la prochaine capture.
function homeSimpleCaptureHtml(s) {
  var w = s.wild || {}, balls = ballTotal(s), left = ballGrassLeft(s), full = s.today >= s.cap;
  var later = w.nextAt && typeof wildNextLabel === 'function' ? wildNextLabel(w) : '';
  var title = balls + ' Ball' + (balls > 1 ? 's' : '') + ', ' + (w.open ? 'un Pokémon t’attend' : left + ' rencontre' + (left > 1 ? 's' : ''));
  var button = balls && left > 0
    ? '<button type="button" class="hs-capture-go" data-action="openWildGrass">' + homeSimpleIcon('grass') + (w.open ? 'Retourner dans les hautes herbes' : 'Aller dans les hautes herbes') + '</button>'
    : !balls
      ? '<button type="button" class="hs-capture-go" data-action="openBallBag">Comment gagner des Balls</button>'
      : '<button type="button" class="hs-capture-go" data-action="openBallBag">' + (later ? 'Nouvelles rencontres ' + escapeHtml(later) : 'Mon sac') + '</button>';
  var hint = full ? 'Tes 10 Balls du jour sont gagnées. Les mini-jeux restent là pour le plaisir.'
    : 'Joue à un mini-jeu marqué +1 Ball pour gagner une Ball (' + s.today + ' sur ' + s.cap + ' aujourd’hui).';
  if (balls && left <= 0 && later) hint = '+' + (Number(w.nextCount) || 4) + ' rencontres ' + later + '. ' + hint;
  return '<div class="hs-capture"><span class="hs-eyebrow">Ta prochaine capture</span><strong>' + escapeHtml(title) + '</strong>' + button + '<small>' + escapeHtml(hint) + '</small></div>';
}

function homeSimpleRow(action, title, line, extra) {
  return '<button type="button" class="hs-row" data-action="' + action + '"><span class="hs-row-text"><b>' + title + '</b><small>' + line + '</small></span>' + (extra || homeSimpleIcon('chevron')) + '</button>';
}
function homeSimpleMoreRows(s) {
  var rows = [];
  if (s.giftAvailable) rows.push(homeSimpleRow('claimBallGift', '🎁 Cadeau du jour', '1 Poké Ball à ouvrir', '<span class="hs-dot" aria-hidden="true"></span>'));
  var e = typeof expeditionState !== 'undefined' ? expeditionState : null;
  if (e && (e.legend && e.legend.available || (e.chests || []).some(function (c) { return c.canClaim; }))) {
    rows.push(homeSimpleRow('openExpedition', '🧭 Expédition', e.legend && e.legend.available ? 'Le légendaire t’attend' : 'Un coffre à ouvrir', '<span class="hs-dot" aria-hidden="true"></span>'));
  }
  // Garder les récompenses disponibles prioritaires ; proposer le partage seulement si une place reste.
  if (s.authenticated) rows.push(homeSimpleRow('openInviteFriend', '🎁 Invite un ami', '+100 XP chacun après son premier Pokémon du jour'));
  try {
    var goal = typeof albumNextGoal === 'function' && typeof albumDiscoveries === 'function' && Object.keys(albumDiscoveries()).length ? albumNextGoal() : null;
    if (goal) rows.push(homeSimpleRow('openAlbumBinder', '📒 Ton album · ' + escapeHtml(goal.stats.name) + ' ' + goal.stats.found + '/' + goal.stats.total, 'Plus que ' + goal.left + ' pour la médaille ' + goal.tier.icon));
  } catch (_e) {}
  rows = rows.slice(0, 2);
  rows.push(homeSimpleRow('openHomeDayMore', 'Œuf mystère, Ligue, Expédition', s.giftAvailable ? 'Et ton sac' : 'Et ton sac, ta série'));
  return '<div class="hs-more"><span class="hs-eyebrow">Aussi aujourd’hui</span>' + rows.join('') + '</div>';
}

// La fenêtre « Œuf, Ligue, Expédition… » : les anciennes tuiles de « Ta journée », telles quelles.
function openHomeDayMore() {
  var s = ballState;
  if (!s || typeof ensureOverlay !== 'function') return;
  var exp = typeof expeditionBannerHtml === 'function' ? expeditionBannerHtml() : '';
  ensureOverlay('Aussi aujourd’hui', '<div class="home-day hs-sheet">' + exp + (typeof homeDayStreakHtml === 'function' ? homeDayStreakHtml(s) : '') +
    '<div class="day-tiles">' + homeDayBagTile(s) + homeDayEggTile() + homeDayLeagueTile() + '</div></div>');
}

// Les mini-jeux : « +1 Ball » / « ✓ Ball gagnée » sur les jeux qui rapportent (vérifiés par le serveur).
function homeSimpleTagTiles() {
  var s = typeof ballState !== 'undefined' ? ballState : null;
  var grid = document.getElementById('home-games-grid');
  if (!grid) return;
  grid.querySelectorAll('.hs-ball-tag').forEach(function (n) { n.remove(); });
  if (!s || !Array.isArray(s.verifiedModes)) return;
  var full = s.today >= s.cap;
  Array.prototype.forEach.call(grid.children, function (tile) {
    var key = typeof modeCatalogActionKey === 'function' ? modeCatalogActionKey(tile) : '';
    var mode = HOME_TILE_MODES[key];
    if (!mode || s.verifiedModes.indexOf(mode) < 0) return;
    var won = homeSimpleBallsWon(s, 'mode:' + (HOME_TILE_SOURCES[mode] || mode));
    if (full && !won) return;
    tile.classList.add('hs-tagged');
    tile.insertAdjacentHTML('afterbegin', won
      ? '<span class="hs-ball-tag is-won">✓ Ball gagnée</span>'
      : '<span class="hs-ball-tag">' + ballImg('poke', 14) + '+1 Ball</span>');
  });
}

// Mini-jeux avant « À plusieurs » (maquette du 4/11).
function homeSimpleOrder() {
  var party = document.getElementById('home-party'), games = document.querySelector('#screen-config .home-discovery');
  if (party && games && games.nextElementSibling !== party) games.after(party);
}

if (typeof renderBallHomeCard === 'function') {
  var renderBallHomeCardBeforeSimple = renderBallHomeCard;
  renderBallHomeCard = function () {
    var out = renderBallHomeCardBeforeSimple.apply(this, arguments);
    var card = document.getElementById('home-balls'), s = ballState;
    if (card && s) {
      var beginner = homeSimpleBeginner(s);
      card.classList.add('home-simple');
      card.classList.toggle('is-beginner', beginner);
      card.setAttribute('aria-label', beginner ? 'Comment ça marche' : 'Ta prochaine capture');
      card.innerHTML = beginner ? homeSimpleStepsHtml(s) : homeSimpleCaptureHtml(s) + homeSimpleMoreRows(s);
      document.getElementById('screen-config')?.classList.add('home-simple-on');
    }
    homeSimpleOrder();
    homeSimpleTagTiles();
    return out;
  };
}
if (typeof renderHomeDiscovery === 'function') {
  var renderHomeDiscoveryBeforeSimple = renderHomeDiscovery;
  renderHomeDiscovery = function () {
    var out = renderHomeDiscoveryBeforeSimple.apply(this, arguments);
    homeSimpleTagTiles();
    return out;
  };
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', homeSimpleOrder);
else homeSimpleOrder();
window.openHomeDayMore = openHomeDayMore;
