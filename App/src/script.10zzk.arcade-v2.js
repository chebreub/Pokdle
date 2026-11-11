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
  root.querySelectorAll('.higher-lower-sprite, .higher-lower-card-mini img').forEach(av2Artwork);
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
