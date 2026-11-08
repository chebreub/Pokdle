// 🎬 « Tous les jeux » et Party Room en mouvement (9/11/2026, « go »).
// Les 6 jeux de la Sélection et les 4 jeux de salon de l'accueil gardent leur petite scène quand on les retrouve
// dans « Tous les jeux » et dans les vignettes de la Party Room, une tuile à la fois. Les autres jeux ont un
// mouvement léger et commun : l'image respire, un reflet passe sur la tuile. Rien hors de l'écran, onglet caché,
// ou avec « Animations réduites ». Aucun jeu, aucun bouton, aucune règle ne change.

var MO2_PARTY = { dessin: 'draw', quiestce1v1: 'who', petitbac: 'bac', dexrace: 'race' };
var mo2Live = { timer: 0, k: 0 };

function mo2DecorateAllModes() {
  var screen = document.getElementById('screen-all-modes');
  if (!screen || typeof hmDecorateTile !== 'function') return;
  screen.classList.add('hm-on');
  screen.querySelectorAll('.all-modes-card.mode-tile').forEach(function (card) {
    hmDecorateTile(card);
    if (!card.classList.contains('hm-has-scene')) card.classList.add('mo2-idle');
    hmObserve(card);
    if (!card._mo2Hover) {
      card._mo2Hover = true;
      card.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse' && card.classList.contains('hm-has-scene')) hmPlay(card); });
    }
  });
}

function mo2DecorateLobby() {
  var lobby = document.getElementById('party-lobby');
  if (!lobby || typeof hmPartySceneHtml !== 'function') return;
  lobby.classList.add('hm-on');
  lobby.querySelectorAll('.pl3-game, .party-duel-link').forEach(function (b) {
    var key = b.getAttribute('data-pl3'), kind = key && MO2_PARTY[key], thumb = b.querySelector('.pl3-thumb');
    if (kind && thumb && !thumb.querySelector('.hm-scene')) {
      var scene = document.createElement('span');
      scene.className = 'hm-scene is-' + kind;
      scene.setAttribute('aria-hidden', 'true');
      scene.innerHTML = hmPartySceneHtml(kind);
      var img = thumb.querySelector('img'), slot = scene.querySelector('[data-hm-main]');
      if (img && slot) slot.appendChild(img);
      thumb.appendChild(scene);
      b.classList.add('hm-has-scene');
      b.dataset.hmScene = kind;
    } else if (!kind) b.classList.add('mo2-idle');
    hmObserve(b);
  });
}

// Une scène à la fois, seulement pour les tuiles à l'écran, sur l'écran ouvert.
function mo2Step() {
  if (document.hidden || (typeof hmReduced === 'function' && hmReduced())) return;
  var tiles = Array.prototype.filter.call(document.querySelectorAll('#screen-all-modes .hm-has-scene, #party-lobby .hm-has-scene'), function (t) {
    return t.isConnected && hmLive.seen.has(t) && t.getClientRects().length;
  });
  if (!tiles.length) return;
  hmPlay(tiles[mo2Live.k++ % tiles.length]);
}
function mo2Start() {
  if (mo2Live.timer) return;
  mo2Live.timer = setInterval(mo2Step, 1700);
}

if (typeof openAllModesScreen === 'function') {
  var openAllModesScreenBeforeMo2 = openAllModesScreen;
  openAllModesScreen = function () {
    var out = openAllModesScreenBeforeMo2.apply(this, arguments);
    try { mo2DecorateAllModes(); mo2Start(); } catch (_e) {}
    return out;
  };
}
if (typeof pl3Paint === 'function') {
  var pl3PaintBeforeMo2 = pl3Paint;
  pl3Paint = function () {
    var out = pl3PaintBeforeMo2.apply(this, arguments);
    try { mo2DecorateLobby(); mo2Start(); } catch (_e) {}
    return out;
  };
}
