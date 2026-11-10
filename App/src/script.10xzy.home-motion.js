// 🎬 Accueil en mouvement (8/11/2026). Maquettes validées par Kayan (« go », « c bien mieux »), puis la qualité
// visée : « Défie tes amis » v3 (orbe d'énergie, rayons, éclairs, halos). Pas une copie d'un autre site.
// - L'accueil est plus court : le Défi du jour garde ses couleurs, ses 4 épreuves et ses bonus, en plus compact,
//   et les mini-jeux se voient sans défiler sur téléphone.
// - Les 6 jeux de la « Sélection » jouent chacun une petite scène, une tuile à la fois (comme un projecteur).
//   Le Pokémon de chaque tuile reste son image du catalogue ; seuls Salamèche et Dracaufeu (Intrus) s'ajoutent.
// - « Défie tes amis » (elle ouvre un salon) et « Ta prochaine capture » à droite du Défi du jour sur PC ;
//   les 4 jeux de la Party Room gardent leur bande, avec chacun sa scène.
// - Rien ne bouge avec « Animations réduites » ; rien ne tourne hors de l'écran ou quand l'onglet est caché.
// Aucun gain, aucune règle de jeu ne change : les tuiles lancent les mêmes jeux qu'avant.

var HM_SCENES = {
  startSilhouetteGame: 'zoom', openHigherLowerMode: 'hl', startWeightBattle: 'weight',
  openOddOneOutMode: 'odd', startQuizGame: 'quiz', openPokeConnectionsMode: 'conn'
};
// Zoom progressif : la tuile montre un Pokémon différent à chaque passage.
var HM_ZOOM = [[352, 'Kecleon'], [131, 'Lokhlass'], [133, 'Évoli'], [448, 'Lucario']];
var hmLive = { io: null, seen: new Set(), timer: 0, k: 0, zoom: 0 };

function hmReduced() {
  try {
    if (typeof appAnimationMode === 'function' && appAnimationMode() === 'reduced') return true;
    return document.body.classList.contains('reduce-motion') || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (_e) { return false; }
}
function hmArt(id) { return typeof modeTileArtworkUrl === 'function' ? modeTileArtworkUrl(id) : 'img/art/' + Number(id) + '.webp'; }
function hmImg(src, cls) { return '<img' + (cls ? ' class="' + cls + '"' : '') + ' src="' + src + '" alt="" loading="lazy" decoding="async" width="96" height="96">'; }
function hmAtmo() { return '<i class="hm-glow"></i><i class="hm-rays"></i><i class="hm-bokeh"><i></i><i></i><i></i><i></i></i>'; }
function hmBurst() {
  var h = '';
  for (var i = 0; i < 8; i++) h += '<i style="--a:' + (i * 45 + 12) + 'deg"></i>';
  return '<i class="hm-burst">' + h + '</i>';
}
function hmSceneHtml(kind) {
  var tap = '<i class="hm-tap"></i>', flash = '<i class="hm-flash"></i>';
  if (kind === 'zoom') return hmAtmo() + '<span class="hm-lens" data-hm-main></span><span class="hm-tries"><i></i><i></i><i></i></span><span class="hm-name">' + escapeHtml(HM_ZOOM[0][1]) + ' !</span>' + flash + hmBurst();
  if (kind === 'hl') return hmAtmo() + '<span class="hm-card is-a"><span data-hm-main></span><em>600</em></span><span class="hm-vs"><i>↑</i><i class="is-down">↓</i></span><span class="hm-card is-b"><span data-hm-second></span><em class="hm-count"></em></span>' + tap + hmBurst();
  if (kind === 'weight') return hmAtmo() + '<i class="hm-halo"></i><span class="hm-kg">460 kg</span><span class="hm-post"></span><i class="hm-dust is-l"></i><i class="hm-dust is-r"></i><span class="hm-beam"><span class="hm-pan is-a" data-hm-main></span><span class="hm-pan is-b" data-hm-second></span></span>';
  if (kind === 'odd') return hmAtmo() + '<span class="hm-odd"><span>' + hmImg('img/motion/4.webp') + '</span><span class="is-x" data-hm-main><i class="hm-x"></i></span><span>' + hmImg('img/motion/6.webp') + '</span></span>' + tap + flash;
  if (kind === 'quiz') return hmAtmo() + '<i class="hm-halo"></i><span class="hm-q"><u>Son type ?</u><i>A · Spectre</i><i class="is-ok">B · Psy</i><i>C · Ténèbres</i></span><span class="hm-plus">+1</span><span class="hm-mon" data-hm-main></span>' + tap + hmBurst();
  if (kind === 'conn') return hmAtmo() + '<span class="hm-cg"><i class="hm-bar"></i><span class="is-1" data-hm-main></span><span class="is-2">' + hmImg(hmArt(25)) + '</span><span class="is-3" data-hm-second></span><span class="is-4">' + hmImg(hmArt(39)) + '</span><span class="hm-lab">Famille d’Évoli</span></span>' + hmBurst();
  return '';
}

// Les 4 jeux de la Party Room sur l'accueil ont aussi leur scène.
var HM_PARTY = { dessin: 'draw', quiestce1v1: 'who', petitbac: 'bac', dexrace: 'race' };
function hmPartySceneHtml(kind) {
  if (kind === 'draw') return hmAtmo() + '<svg class="hm-draw" viewBox="0 0 80 60" aria-hidden="true"><path class="is-line" d="M14 40c6-18 20-26 30-22s10 16 2 20-18-2-14-10 20-12 32-4"/><circle class="is-dot" cx="64" cy="22" r="5"/></svg><span class="hm-brush" data-hm-main></span>' + hmBurst();
  if (kind === 'who') return hmAtmo() + '<span class="hm-who"><i class="is-c1">?</i><i class="is-c2">?</i><span class="is-ditto" data-hm-main></span><i class="is-c3">?</i></span>' + hmBurst();
  if (kind === 'bac') return hmAtmo() + '<span class="hm-letter"><i><b>A</b><b>K</b><b>M</b><b>S</b><b>P</b></i></span><span class="hm-stop">STOP !</span><span class="hm-unown" data-hm-main></span>';
  if (kind === 'race') return hmAtmo() + '<span class="hm-race">' + new Array(10).join('<i></i>') + '</span><span class="hm-rotom" data-hm-main></span>';
  return '';
}
function hmDecorateParty() {
  document.querySelectorAll('#home-party .home-party-game').forEach(function (tile) {
    var key = Object.keys(HM_PARTY).find(function (k) { return tile.classList.contains('is-' + k); });
    var art = tile.querySelector('.home-party-art');
    if (!key || !art || art.querySelector('.hm-scene')) return;
    var scene = document.createElement('span');
    scene.className = 'hm-scene is-' + HM_PARTY[key];
    scene.setAttribute('aria-hidden', 'true');
    scene.innerHTML = hmPartySceneHtml(HM_PARTY[key]);
    var img = art.querySelector('img'), slot = scene.querySelector('[data-hm-main]');
    if (img && slot) slot.appendChild(img);
    art.appendChild(scene);
    tile.classList.add('hm-has-scene');
    tile.dataset.hmScene = HM_PARTY[key];
    hmObserve(tile);
    tile.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') hmPlay(tile); });
  });
}

// Une tuile du catalogue (clone) reçoit sa scène ; son image reste la même (la QA attend qu'elle se charge).
function hmDecorateTile(tile) {
  var key = typeof modeCatalogActionKey === 'function' ? modeCatalogActionKey(tile) : '';
  var kind = HM_SCENES[key], art = tile.querySelector('.mode-tile-art');
  if (!kind || !art || art.querySelector('.hm-scene')) return;
  var scene = document.createElement('span');
  scene.className = 'hm-scene is-' + kind;
  scene.setAttribute('aria-hidden', 'true');
  scene.innerHTML = hmSceneHtml(kind);
  var main = art.querySelector('.mode-tile-sprite:not(.is-second)'), second = art.querySelector('.mode-tile-sprite.is-second');
  var slot = scene.querySelector('[data-hm-main]'), slot2 = scene.querySelector('[data-hm-second]');
  if (main && slot) slot.insertBefore(main, slot.firstChild);
  if (second && slot2) slot2.insertBefore(second, slot2.firstChild);
  art.appendChild(scene);
  tile.classList.add('hm-has-scene');
  tile.dataset.hmScene = kind;
  if (kind === 'zoom') {
    var z = HM_ZOOM[hmLive.zoom % HM_ZOOM.length];
    if (main && hmLive.zoom) { main.src = hmArt(z[0]); scene.querySelector('.hm-name').textContent = z[1] + ' !'; }
  }
}

function hmPlay(el) {
  if (!el || hmReduced()) return;
  el.classList.remove('hm-play');
  void el.offsetWidth;
  el.classList.add('hm-play');
  clearTimeout(el._hmEnd);
  el._hmEnd = setTimeout(function () {
    el.classList.remove('hm-play');
    if (el.dataset.hmScene === 'zoom') hmNextZoom(el);
  }, 2700);
}
function hmNextZoom(tile) {
  var img = tile.querySelector('.hm-lens .mode-tile-sprite'), name = tile.querySelector('.hm-name');
  if (!img || !name) return;
  hmLive.zoom = (hmLive.zoom + 1) % HM_ZOOM.length;
  img.src = hmArt(HM_ZOOM[hmLive.zoom][0]);
  name.textContent = HM_ZOOM[hmLive.zoom][1] + ' !';
}

// Le chef d'orchestre : une scène à la fois, seulement pour les tuiles à l'écran, onglet visible.
function hmObserve(el) {
  if (!el || el._hmSeen) return;
  el._hmSeen = true;
  if (!hmLive.io && 'IntersectionObserver' in window) {
    hmLive.io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        e.target.classList.toggle('hm-live', e.isIntersecting);
        if (e.isIntersecting) hmLive.seen.add(e.target); else hmLive.seen.delete(e.target);
      });
    }, { threshold: 0.35 });
  }
  if (hmLive.io) hmLive.io.observe(el); else { el.classList.add('hm-live'); hmLive.seen.add(el); }
}
function hmStep() {
  if (document.hidden || hmReduced()) return;
  // 9/11/2026 (audit) : une scène dure 2,7 s ; on attend qu'elle soit finie avant d'en lancer une autre.
  if (document.querySelector('.hm-has-scene.hm-play')) return;
  var tiles = Array.prototype.filter.call(document.querySelectorAll('#home-games-grid .hm-has-scene, #home-party .hm-has-scene'), function (t) { return t.isConnected && hmLive.seen.has(t); });
  if (!tiles.length) return;
  hmPlay(tiles[hmLive.k++ % tiles.length]);
}
function hmStart() {
  if (hmLive.timer) return;
  hmLive.timer = setInterval(hmStep, 1500);
  setTimeout(hmStep, 500);
}

function hmDecorateGrid() {
  var grid = document.getElementById('home-games-grid');
  if (!grid) return;
  Array.prototype.forEach.call(grid.children, function (tile) {
    hmDecorateTile(tile);
    hmObserve(tile);
    if (!tile._hmHover) {
      tile._hmHover = true;
      tile.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse' && tile.classList.contains('hm-has-scene')) hmPlay(tile); });
    }
  });
}

// « Défie tes amis » : orbe d'énergie entre deux Pokémon, en tête de la bande « À plusieurs ».
function hmDuelHtml() {
  var sparks = '', arcs = ['M100 60 L86 49 L70 44 L57 33 L41 30 L26 21 L10 20', 'M100 60 L116 66 L130 75 L145 80 L161 89 L176 92 L190 95',
    'M100 60 L88 69 L74 72 L63 82 L49 88 L40 99 L30 105', 'M100 60 L114 51 L128 43 L143 37 L158 26 L175 15'];
  for (var i = 0; i < 9; i++) sparks += '<i class="hm-sp" style="--a:' + (i * 40) + 'deg;--d:' + (54 + (i * 13) % 36) + 'px;animation-delay:-' + (i * 0.17).toFixed(2) + 's"></i>';
  return '<button type="button" class="hm-duel" data-action="openPartyRoomWithGame" data-args=\'[""]\' aria-label="Défie tes amis : créer un salon">' +
    '<i class="hm-speed"></i><i class="hm-speed is-b"></i>' +
    '<i class="hm-pad is-l"></i><i class="hm-pad is-r"></i>' +
    '<span class="hm-clash"><i class="hm-ray is-l"></i><i class="hm-ray is-r"></i><i class="hm-orb"></i>' + sparks +
    '<svg class="hm-arcs" viewBox="0 0 200 120" aria-hidden="true">' + arcs.map(function (d) { return '<path d="' + d + '"/>'; }).join('') + '</svg></span>' +
    '<span class="hm-fighter is-l"><span>' + hmImg(hmArt(25)) + '</span></span><span class="hm-fighter is-r"><span>' + hmImg(hmArt(39)) + '</span></span>' +
    '<span class="hm-duel-tag" aria-hidden="true">À plusieurs · Party Room</span><span class="hm-duel-title" aria-hidden="true">Défie tes amis</span></button>';
}
// La colonne « Défie tes amis » + « Ta prochaine capture » (à droite du Défi du jour sur PC, sous les mini-jeux
// sur téléphone, où les 4 jeux de la Party Room passent entre les deux).
function hmMountSide() {
  var hero = document.getElementById('daily-hero');
  if (!hero || document.getElementById('hm-side')) return;
  hero.insertAdjacentHTML('afterend', '<div id="hm-side" class="hm-side">' + hmDuelHtml() + '</div>');
  hmObserve(document.querySelector('#hm-side .hm-duel'));
}
function hmPlaceDay() {
  var card = document.getElementById('home-balls'), hero = document.getElementById('daily-hero'), side = document.getElementById('hm-side');
  if (!card || !hero || !side) return;
  hero.classList.remove('has-day');
  if (card.parentElement !== side) side.appendChild(card);
}

function hmMount() {
  var screen = document.getElementById('screen-config');
  if (!screen) return;
  screen.classList.add('hm-on');
  hmDecorateGrid();
  hmMountSide();
  hmDecorateParty();
  hmPlaceDay();
  hmStart();
}

if (typeof renderHomeDiscovery === 'function') {
  var renderHomeDiscoveryBeforeMotion = renderHomeDiscovery;
  renderHomeDiscovery = function () {
    var out = renderHomeDiscoveryBeforeMotion.apply(this, arguments);
    hmDecorateGrid();
    return out;
  };
}
if (typeof renderBallHomeCard === 'function') {
  var renderBallHomeCardBeforeMotion = renderBallHomeCard;
  renderBallHomeCard = function () {
    var out = renderBallHomeCardBeforeMotion.apply(this, arguments);
    hmPlaceDay();
    return out;
  };
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hmMount);
else hmMount();
window.hmPlay = hmPlay;
