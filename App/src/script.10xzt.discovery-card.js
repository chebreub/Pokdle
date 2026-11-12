
// 🧭 DISC-01 (7/11/2026, maquette validée) : une seule carte « À découvrir aujourd'hui » sous les mini-jeux de
// l'accueil. Un jeu par jour de Paris, pris parmi ceux que l'étagère de l'accueil ne montre pas ; ceux que ce
// navigateur n'a jamais ouverts passent d'abord (« Jamais joué »). « Pas aujourd'hui » la cache jusqu'au
// lendemain. Rien ne bouge ailleurs sur l'accueil et rien n'est envoyé au serveur : l'ouverture du jeu est déjà
// comptée par les compteurs existants (solo:<mode>).
var DISC_CANDIDATES = [
  // [action, mode du journal des parties, phrase]
  ['startEvolutionChainGame', 'evolution', 'Une famille d’évolution avec un trou au milieu : trouve le Pokémon qui manque.'],
  ['startPokedexOrderGame', 'order', 'Deux numéros du Pokédex : trouve le Pokémon qui se cache entre les deux.'],
  ['startPixelGame', 'pixel', 'Une image très pixelisée qui se précise à chaque essai.'],
  ['startCryGame', 'cry', 'Un cri, et à toi de trouver qui le pousse.'],
  ['startDescriptionMode', 'description', 'Une entrée du Pokédex, nom caché : de qui parle-t-elle ?'],
  ['startMysteryStatGame', 'mystery', 'Seulement ses 6 stats de base pour le reconnaître.'],
  ['openTypeComboSolo', 'typecombo', 'Trouve le plus de Pokémon pour chaque combinaison de types.'],
  ['openSpeedrunMode', 'speedrun', 'Le plus de Pokémon possible, le plus vite possible.'],
  ['openDraftScoreAttackMode', 'draft', 'Six choix pour une équipe de rêve : vise le meilleur total.'],
  ['openQuiEstCeMode', 'quiestce', 'Le vrai Qui est-ce ? en Pokémon : pose les bonnes questions.'],
  ['openPetitBacMode', 'petitbac', 'Une lettre, des catégories : remplis ta grille avant la fin.'],
  ['openShinyMode', 'shiny', 'Shiny ou normal ? Trois vies pour ne pas te tromper.'],
  ['startWordleTraining', 'wordletraining', 'Le Wordle Pokémon en illimité, pour t’entraîner.'],
  ['openStatAuctionMode', 'auction', 'Enchéris sur les stats : le bon Pokémon au bon prix.']
];
var DISC_OPENED_KEY = 'pokedle_disc_opened_v1';
var DISC_HIDE_KEY = 'pokedle_disc_hide_v1';

function discRead(key, fallback) { try { var v = JSON.parse(localStorage.getItem(key) || 'null'); return v == null ? fallback : v; } catch (_e) { return fallback; } }
function discWrite(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_e) {} }
function discToday() { return typeof getDailyDateKey === 'function' ? getDailyDateKey() : new Date().toISOString().slice(0, 10); }
function discDayNumber(day) { var t = Date.parse(String(day) + 'T12:00:00Z'); return Number.isFinite(t) ? Math.floor(t / 864e5) : 0; }

// Joué : ouvert depuis cette carte dans ce navigateur, ou présent dans le journal des parties (matchHistory).
function discPlayedSet() {
  var played = new Set((discRead(DISC_OPENED_KEY, []) || []).filter(function (k) { return typeof k === 'string'; }));
  var history = typeof matchHistory !== 'undefined' && Array.isArray(matchHistory) ? matchHistory : [];
  DISC_CANDIDATES.forEach(function (c) { if (history.some(function (h) { return h && h.mode === c[1]; })) played.add(c[0]); });
  return played;
}
function discMarkOpened(action) {
  var list = (discRead(DISC_OPENED_KEY, []) || []).filter(function (k) { return typeof k === 'string' && k !== action; });
  list.unshift(action);
  discWrite(DISC_OPENED_KEY, list.slice(0, 40));
}
function discCatalogCard(action) {
  return Array.prototype.find.call(document.querySelectorAll('#screen-all-modes .all-modes-card'), function (card) {
    return typeof modeCatalogActionKey === 'function' && modeCatalogActionKey(card) === action;
  }) || null;
}
// Le jeu du jour : jamais un jeu déjà sur l'étagère de l'accueil ni un jeu récent ; jamais joué d'abord.
function discPick(day, options) {
  options = options || {};
  var onShelf = new Set(options.shelf || []);
  var recent = new Set(options.recent || []);
  var played = options.played || new Set();
  var exists = options.exists || function () { return true; };
  var pool = DISC_CANDIDATES.filter(function (c) { return exists(c[0]) && !onShelf.has(c[0]) && !recent.has(c[0]); });
  if (!pool.length) return null;
  var fresh = pool.filter(function (c) { return !played.has(c[0]); });
  var list = fresh.length ? fresh : pool;
  var pick = list[((discDayNumber(day) % list.length) + list.length) % list.length];
  return { action: pick[0], mode: pick[1], line: pick[2], fresh: !played.has(pick[0]) };
}
// L'étagère par défaut de l'accueil (script.09.club.js, « popular ») : fixe, pour que la carte ne change pas
// quand on filtre les mini-jeux.
var DISC_HOME_SHELF = ['startSilhouetteGame', 'openHigherLowerMode', 'startWeightBattle', 'openOddOneOutMode', 'startQuizGame', 'openPokeConnectionsMode'];
function discBallTag(mode) {
  var s = typeof ballState !== 'undefined' ? ballState : null;
  if (!s || !Array.isArray(s.verifiedModes) || s.verifiedModes.indexOf(mode) < 0 || s.today >= s.cap) return '';
  var src = 'mode:' + ((typeof HOME_TILE_SOURCES !== 'undefined' && HOME_TILE_SOURCES[mode]) || mode);
  if (typeof homeSimpleBallsWon === 'function' && homeSimpleBallsWon(s, src)) return '';
  return '<span class="disc-tag is-ball">' + (typeof ballImg === 'function' ? ballImg('poke', 14) : '') + '+1 Ball</span>';
}
function discArt(action) {
  var theme = typeof MODE_TILE_THEME !== 'undefined' ? MODE_TILE_THEME[action] : null;
  var id = theme && theme.ids && theme.ids[0];
  var p = id && typeof POKEMON_BY_ID !== 'undefined' ? POKEMON_BY_ID.get(Number(id)) : null;
  var src = id && typeof modeTileArtworkUrl === 'function' ? modeTileArtworkUrl(id) : p && typeof pokedexDetailArtwork === 'function' ? pokedexDetailArtwork(p, false) : '';
  return { src: src, tone: theme && theme.tone || '#C9B6F5', ink: theme && theme.ink || '#5C3FB0' };
}
function renderDiscoveryCard() {
  var host = document.querySelector('#screen-config .home-discovery');
  if (!host) return;
  var old = document.getElementById('home-disc-card');
  var day = discToday();
  if (discRead(DISC_HIDE_KEY, '') === day) { if (old) old.remove(); return; }
  var pick = discPick(day, {
    shelf: DISC_HOME_SHELF,
    recent: typeof readClubRecent === 'function' ? readClubRecent() : [],
    played: discPlayedSet(),
    exists: function (action) { return Boolean(discCatalogCard(action)); }
  });
  if (!pick) { if (old) old.remove(); return; }
  var card = discCatalogCard(pick.action);
  // Le titre du catalogue, décoré (.mode-tile-title) ou d'origine (<b>).
  var titleEl = card && (card.querySelector('.mode-tile-title') || card.querySelector('b'));
  var title = titleEl ? titleEl.textContent.trim() : '';
  if (!title) { if (old) old.remove(); return; }
  var art = discArt(pick.action);
  var html = '<div class="disc-art" style="--disc-tone:' + escapeHtml(art.tone) + '">' + (art.src ? '<img src="' + escapeHtml(art.src) + '" alt="" loading="lazy" draggable="false">' : '') + '</div>' +
    '<div class="disc-body"><span class="disc-eyebrow">🧭 À découvrir aujourd’hui</span>' +
    '<b class="disc-title">' + escapeHtml(title) + '</b><span class="disc-line">' + escapeHtml(pick.line) + '</span>' +
    '<div class="disc-row"><button type="button" class="disc-go" data-action="discoveryPlay" data-args=\'' + JSON.stringify([pick.action]) + '\'>Essayer →</button>' +
    (pick.fresh ? '<span class="disc-tag">Jamais joué</span>' : '') + discBallTag(pick.mode) +
    '<button type="button" class="disc-later" data-action="discoveryLater">Pas aujourd’hui</button></div></div>';
  if (!old) {
    old = document.createElement('section');
    old.id = 'home-disc-card';
    old.className = 'disc-card';
    old.setAttribute('aria-label', 'À découvrir aujourd’hui');
    host.appendChild(old);
  }
  if (old.dataset.key !== day + ':' + pick.action + ':' + pick.fresh + ':' + discBallTag(pick.mode).length) {
    old.dataset.key = day + ':' + pick.action + ':' + pick.fresh + ':' + discBallTag(pick.mode).length;
    old.innerHTML = html;
  }
}
function discoveryPlay(action) {
  discMarkOpened(action);
  if (typeof openFromAllModes === 'function') openFromAllModes(action);
  else if (typeof window[action] === 'function') window[action]();
}
function discoveryLater() {
  discWrite(DISC_HIDE_KEY, discToday());
  var card = document.getElementById('home-disc-card');
  if (card) card.remove();
}

if (typeof renderHomeDiscovery === 'function') {
  var renderHomeDiscoveryBeforeDisc = renderHomeDiscovery;
  renderHomeDiscovery = function () {
    var out = renderHomeDiscoveryBeforeDisc.apply(this, arguments);
    try { renderDiscoveryCard(); } catch (_e) {}
    return out;
  };
}
if (typeof homeSimpleTagTiles === 'function') {
  var homeSimpleTagTilesBeforeDisc = homeSimpleTagTiles;
  homeSimpleTagTiles = function () {
    var out = homeSimpleTagTilesBeforeDisc.apply(this, arguments);
    try { renderDiscoveryCard(); } catch (_e) {}
    return out;
  };
}
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('load', function () { setTimeout(function () { try { renderDiscoveryCard(); } catch (_e) {} }, 1200); });
}
window.discoveryPlay = discoveryPlay;
window.discoveryLater = discoveryLater;
window.renderDiscoveryCard = renderDiscoveryCard;
