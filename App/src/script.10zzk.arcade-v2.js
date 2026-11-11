// Écrans de jeu « identité Pokédle » (11/11/2026, maquette v4 validée par Kayan : « go »).
// Inspirés des écrans calmes de PokeQuizz, sans les copier : fond crème, la couleur du jeu en accent
// (léger dégradé en haut, liseré des cartes, pastille de la stat), une ligne d'en-tête, de grandes cartes
// blanches et les boutons posés en bas. Code couleur : « Plus haut » orange, « Plus bas » bleu.
// Seul l'habillage change : mêmes boutons, mêmes actions, mêmes règles, même vérification par le serveur.
// Ce fichier pose la classe av2 et range quelques éléments ; tout le style est dans arcade-v2.css.

var AV2_EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]️?\s*/gu;
function av2Clean(el) { if (el && AV2_EMOJI.test(el.textContent)) el.textContent = el.textContent.replace(AV2_EMOJI, '').trim(); }

// L'artwork officiel à la place du petit sprite pixelisé (même Pokémon, retrouvé par son nom).
var av2ByName = null;
function av2Artwork(img) {
  if (!img || img.dataset.av2Art) return;
  img.dataset.av2Art = '1';
  if (!av2ByName && typeof POKEMON_BY_ID !== 'undefined') { av2ByName = new Map(); POKEMON_BY_ID.forEach(function (p) { if (p && p.name && !av2ByName.has(p.name)) av2ByName.set(p.name, p); }); }
  var mon = av2ByName && av2ByName.get(img.getAttribute('alt'));
  if (!mon || typeof pokedexDetailArtwork !== 'function') return;
  var fallback = img.src;
  img.addEventListener('error', function () { if (img.src !== fallback) img.src = fallback; }, { once: true });
  img.src = pokedexDetailArtwork(mon, false);
}

// Higher or Lower
function av2HigherLower() {
  var screen = document.getElementById('screen-higher-lower');
  if (!screen) return;
  screen.classList.add('av2', 'av2-hl');
  var root = document.getElementById('higher-lower-root');
  var playing = Boolean(root && root.querySelector('.higher-lower-board'));
  var over = Boolean(root && root.querySelector('.higher-lower-gameover'));
  screen.classList.toggle('av2-playing', playing);
  screen.classList.toggle('av2-over', over);
  if (!root) return;
  screen.classList.toggle('av2-lobby', Boolean(root.querySelector('.higher-lower-lobby')));
  // Menu des modes : des icônes dessinées à la place des emojis.
  var AV2_MODE_ICONS = {
    infinite: '<svg viewBox="0 0 48 24"><path d="M24 12c-5-6-9-9-14-9a9 9 0 0 0 0 18c5 0 9-3 14-9s9-9 14-9a9 9 0 0 1 0 18c-5 0-9-3-14-9z" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/></svg>',
    rush60: '<svg viewBox="0 0 32 32"><circle cx="16" cy="18" r="11" fill="none" stroke="#fff" stroke-width="3.5"/><path d="M16 11v7l5 3M12 3h8" stroke="#fff" stroke-width="3.5" stroke-linecap="round" fill="none"/></svg>',
    versus: '<b>VS</b>'
  };
  root.querySelectorAll('.higher-lower-mode-card').forEach(function (card) {
    var icon = card.querySelector('.higher-lower-mode-icon');
    if (!icon || icon.dataset.av2) return;
    var args = card.getAttribute('data-args') || '';
    var key = /rush60/.test(args) ? 'rush60' : /infinite/.test(args) ? 'infinite' : 'versus';
    card.classList.add('av2-mode-' + key);
    icon.dataset.av2 = '1';
    icon.innerHTML = AV2_MODE_ICONS[key];
  });
  root.querySelectorAll('.higher-lower-sprite, .higher-lower-card-mini img').forEach(av2Artwork);
  // Version B (11/11/2026, « B ») : chaque moitié prend la couleur du type de son Pokémon.
  root.querySelectorAll('.higher-lower-card-pokemon, .higher-lower-card-mini').forEach(function (card) {
    var img = card.querySelector('img');
    var mon = img && av2ByName && av2ByName.get(img.getAttribute('alt'));
    var c = mon && typeof FAV_TYPE_COLORS !== 'undefined' ? FAV_TYPE_COLORS[mon.type1] : null;
    if (c) card.style.setProperty('--t', c);
  });
  // La stat sans emoji, dans une pastille ; la valeur en très gros.
  root.querySelectorAll('.higher-lower-stat-banner b, .higher-lower-stat-value span, .higher-lower-card-mini b').forEach(av2Clean);
  root.querySelectorAll('.higher-lower-scoreline span').forEach(function (s) { s.childNodes.forEach(function (n) { if (n.nodeType === 3) n.textContent = n.textContent.replace(AV2_EMOJI, ''); }); });
  root.querySelectorAll('.higher-lower-btn-higher, .higher-lower-btn-lower').forEach(function (b) {
    if (b.dataset.av2) return;
    b.dataset.av2 = '1';
    var up = b.classList.contains('higher-lower-btn-higher');
    b.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="' + (up ? 'M10 3l7 8h-4v6H7v-6H3z' : 'M10 17l7-8h-4V3H7v6H3z') + '"/></svg>' + (up ? 'Plus haut' : 'Plus bas');
  });
  var over2 = root.querySelector('.higher-lower-gameover');
  if (over2) {
    var h = over2.querySelector('h3');
    av2Clean(h);
    over2.querySelectorAll('.higher-lower-record, .higher-lower-final-actions button').forEach(av2Clean);
  }
}

if (typeof renderHigherLowerScreen === 'function') {
  var av2HlBefore = renderHigherLowerScreen;
  renderHigherLowerScreen = function () { var r = av2HlBefore.apply(this, arguments); try { av2HigherLower(); } catch (_e) {} return r; };
}

// Duel de poids (même identité) : les deux Pokémon dans la couleur de leur type, en grand, sur une balance
// qui penche vers le plus lourd après la réponse ; les deux poids s'affichent. Les cartes restent les boutons.
function av2Weight() {
  var game = document.getElementById('screen-game'), box = document.getElementById('weight-box');
  if (!game || !box) return;
  var on = !box.classList.contains('hidden');
  game.classList.toggle('av2', on);
  game.classList.toggle('av2-wt', on);
  if (!on || typeof weightBattleState === 'undefined' || !weightBattleState) return;
  var st = weightBattleState, pair = [st.left, st.right];
  var cards = box.querySelectorAll('#weight-grid .versus-card');
  cards.forEach(function (card, i) {
    var mon = pair[i];
    if (!mon) return;
    var c = typeof FAV_TYPE_COLORS !== 'undefined' ? FAV_TYPE_COLORS[mon.type1] : null;
    if (c) card.style.setProperty('--t', c);
    var img = card.querySelector('img');
    if (img && typeof pokedexDetailArtwork === 'function' && !img.dataset.av2Art) {
      img.dataset.av2Art = '1';
      var fb = img.src;
      img.addEventListener('error', function () { if (img.src !== fb) img.src = fb; }, { once: true });
      img.src = pokedexDetailArtwork(mon, false);
    }
    var kg = card.querySelector('.av2-kg');
    if (!kg) { kg = document.createElement('span'); kg.className = 'av2-kg'; card.appendChild(kg); }
    kg.textContent = st.revealed && mon.weight != null ? String(mon.weight).replace('.', ',') + ' kg' : '? kg';
  });
  var beam = box.querySelector('.av2-scale');
  if (!beam) {
    beam = document.createElement('div');
    beam.className = 'av2-scale';
    beam.setAttribute('aria-hidden', 'true');
    beam.innerHTML = '<i class="av2-beam"></i><i class="av2-post"></i><i class="av2-foot"></i>';
    box.querySelector('#weight-grid').after(beam);
  }
  var tilt = 0;
  if (st.revealed && st.left && st.right) tilt = Number(st.left.weight) >= Number(st.right.weight) ? -7 : 7;
  beam.style.setProperty('--tilt', tilt + 'deg');
  box.classList.toggle('av2-revealed', Boolean(st.revealed));
}
if (typeof renderWeightBattlePanel === 'function') {
  var av2WtBefore = renderWeightBattlePanel;
  renderWeightBattlePanel = function () { var r = av2WtBefore.apply(this, arguments); try { av2Weight(); } catch (_e) {} return r; };
}
if (typeof hideCustomModeSurfaces === 'function') {
  var av2HideBefore = hideCustomModeSurfaces;
  hideCustomModeSurfaces = function () { var r = av2HideBefore.apply(this, arguments); var g = document.getElementById('screen-game'); if (g) g.classList.remove('av2', 'av2-wt', 'av2-qz'); return r; };
}

// Intrus (même identité) : six grandes cartes aux couleurs du type de chaque Pokémon, artworks ; l'indice
// en bulle sous la question. Les cartes restent les boutons du jeu.
function av2Odd() {
  var screen = document.getElementById('screen-odd-one-out');
  if (!screen) return;
  screen.classList.add('av2', 'av2-odd', 'av2-playing');
  var newBtn = document.getElementById('odd-new-puzzle-btn');
  av2Clean(newBtn);
  if (typeof oddOneOutState === 'undefined' || !oddOneOutState) return;
  var cards = document.querySelectorAll('#odd-grid .odd-card');
  cards.forEach(function (card, i) {
    var mon = oddOneOutState.cards[i];
    if (!mon) return;
    var c = typeof FAV_TYPE_COLORS !== 'undefined' ? FAV_TYPE_COLORS[mon.type1] : null;
    if (c) card.style.setProperty('--t', c);
    var img = card.querySelector('img');
    if (img && typeof pokedexDetailArtwork === 'function' && !img.dataset.av2Art) {
      img.dataset.av2Art = '1';
      var fb = img.src;
      img.addEventListener('error', function () { if (img.src !== fb) img.src = fb; }, { once: true });
      img.src = pokedexDetailArtwork(mon, false);
    }
  });
}
if (typeof renderOddOneOutPuzzle === 'function') {
  var av2OddBefore = renderOddOneOutPuzzle;
  renderOddOneOutPuzzle = function () { var r = av2OddBefore.apply(this, arguments); try { av2Odd(); } catch (_e) {} return r; };
}

// Quiz (même identité) : la scène de la question en couleur, les réponses A/B/C/D en grandes cartes
// blanches avec la lettre dans une pastille de couleur. Pas d'emoji dans l'étiquette de catégorie.
function av2Quiz() {
  var game = document.getElementById('screen-game'), box = document.getElementById('quiz-box');
  if (!game || !box) return;
  var on = !box.classList.contains('hidden');
  game.classList.toggle('av2-qz', on);
  if (on) game.classList.add('av2');
  box.querySelectorAll('.qz-cat').forEach(av2Clean);
}
['renderQuizQuestion', 'showQuizQuestion', 'renderQuizV2'].forEach(function (name) {
  if (typeof window[name] !== 'function') return;
  var before = window[name];
  window[name] = function () { var r = before.apply(this, arguments); try { av2Quiz(); } catch (_e) {} return r; };
});
if (typeof MutationObserver === 'function') {
  var av2QzObs = new MutationObserver(function () { try { av2Quiz(); } catch (_e) {} });
  var av2QzStart = function () { var b = document.getElementById('quiz-box'); if (b) av2QzObs.observe(b, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', av2QzStart); else av2QzStart();
}
