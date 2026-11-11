// Grande tuile des jeux sur l'accueil (11/11/2026, maquette validée par Kayan : « go mais faut que les tuiles
// soient animées comme avant »). La grille des mini-jeux de l'accueil devient un carrousel :
// - un jeu à la fois, en grand (son image animée à droite, son nom, sa règle et « Jouer » à gauche) ;
// - il passe tout seul au jeu suivant toutes les 5 s, et la scène animée du jeu se joue à son arrivée ;
// - au doigt, on le fait glisser (défilement natif), et il ne repart plus tout seul ;
// - sur ordinateur, des flèches apparaissent au survol ; la souris dessus met en pause ;
// - des points montrent où on en est (le point actif se remplit pendant les 5 s).
// Rien ne bouge seul avec « Animations réduites », hors de l'écran ou onglet caché.
// Les tuiles restent les mêmes boutons (mêmes jeux, mêmes filtres Sélection / Deviner / Arcade) : seul l'habillage change.

var HC_EVERY = 5000;
var hc = { stopped: false, paused: false, visible: true, index: 0, elapsed: 0, last: 0, io: null, raf: 0, played: false };

function hcReduced() { return typeof hmReduced === 'function' ? hmReduced() : false; }
function hcGrid() { return document.getElementById('home-games-grid'); }
function hcTiles() { var g = hcGrid(); return g ? Array.prototype.filter.call(g.children, function (t) { return t.classList.contains('mode-tile'); }) : []; }

function hcBuild() {
  var grid = hcGrid();
  if (!grid) return;
  grid.classList.add('hc-on');
  var box = grid.parentElement.classList.contains('hc-box') ? grid.parentElement : null;
  if (!box) {
    box = document.createElement('div');
    box.className = 'hc-box';
    grid.parentElement.insertBefore(box, grid);
    box.appendChild(grid);
    box.insertAdjacentHTML('beforeend',
      '<button type="button" class="hc-arrow is-prev" aria-label="Jeu précédent"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3L5 8l5 5"/></svg></button>' +
      '<button type="button" class="hc-arrow is-next" aria-label="Jeu suivant"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5"/></svg></button>');
    box.insertAdjacentHTML('afterend', '<div class="hc-dots" role="group" aria-label="Choisir un jeu"></div>');
    box.querySelector('.is-prev').addEventListener('click', function () { hcStop(); hcGo(hc.index - 1); });
    box.querySelector('.is-next').addEventListener('click', function () { hcStop(); hcGo(hc.index + 1); });
    // Le doigt, la molette ou le clavier : on laisse la main au joueur.
    ['pointerdown', 'wheel', 'keydown'].forEach(function (ev) {
      grid.addEventListener(ev, function (e) { if (ev !== 'pointerdown' || e.pointerType !== 'mouse') hcStop(); }, { passive: true });
    });
    box.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') hc.paused = true; });
    box.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') hc.paused = false; });
    box.addEventListener('focusin', function () { hc.paused = true; });
    box.addEventListener('focusout', function () { hc.paused = false; });
    var t = 0;
    grid.addEventListener('scroll', function () { clearTimeout(t); t = setTimeout(hcSettled, 90); }, { passive: true });
    // Un filtre (Sélection / Deviner / Arcade) remplace les tuiles : les points et la position repartent du début.
    if ('MutationObserver' in window) {
      var mt = 0;
      new MutationObserver(function () { clearTimeout(mt); mt = setTimeout(function () { hcDots(); hc.index = 0; hc.elapsed = 0; grid.scrollLeft = 0; hcPaint(); }, 30); }).observe(grid, { childList: true });
    }
    if ('IntersectionObserver' in window) {
      hc.io = new IntersectionObserver(function (es) { hc.visible = es[0].isIntersecting; }, { threshold: 0.4 });
      hc.io.observe(box);
    }
  }
  hcDots();
  hc.index = 0;
  grid.scrollLeft = 0;
  hc.elapsed = 0;
  hcStart();
}

// Fond plein : le Pokémon du jeu en très grand, estompé, derrière la scène (Kayan : « ça fait beaucoup de vide »).
function hcBackdrops() {
  hcTiles().forEach(function (t) {
    var art = t.querySelector('.mode-tile-art');
    var img = t.querySelector('.mode-tile-sprite');
    if (!art || !img || art.querySelector('.hc-back')) return;
    var b = document.createElement('img');
    b.className = 'hc-back';
    b.alt = '';
    b.setAttribute('aria-hidden', 'true');
    b.decoding = 'async';
    b.src = img.currentSrc || img.src;
    art.insertBefore(b, art.firstChild);
  });
}

function hcDots() {
  hcBackdrops();
  var dots = document.querySelector('.hc-dots'), tiles = hcTiles();
  if (!dots) return;
  dots.innerHTML = tiles.map(function (t, i) {
    var name = (t.querySelector('.mode-tile-title') || {}).textContent || 'Jeu ' + (i + 1);
    return '<button type="button" class="hc-dot" aria-label="' + escapeHtml(name) + '"><i></i></button>';
  }).join('');
  Array.prototype.forEach.call(dots.children, function (d, i) { d.addEventListener('click', function () { hcStop(); hcGo(i); }); });
  hcPaint();
}

function hcPaint() {
  var dots = document.querySelectorAll('.hc-dots .hc-dot');
  Array.prototype.forEach.call(dots, function (d, i) {
    var on = i === hc.index;
    d.classList.toggle('is-on', on);
    d.setAttribute('aria-current', on ? 'true' : 'false');
  });
}

function hcGo(i) {
  var grid = hcGrid(), tiles = hcTiles();
  if (!grid || !tiles.length) return;
  hc.index = (i + tiles.length) % tiles.length;
  grid.scrollTo({ left: tiles[hc.index].offsetLeft - grid.offsetLeft, behavior: hcReduced() ? 'auto' : 'smooth' });
  hc.elapsed = 0;
  hcPaint();
}

// Après un glissement (doigt ou flèches) : le jeu le plus au centre devient le jeu courant, et sa scène se joue.
function hcSettled() {
  var grid = hcGrid(), tiles = hcTiles();
  if (!grid || !tiles.length) return;
  var mid = grid.scrollLeft + grid.clientWidth / 2, best = 0, gap = Infinity;
  tiles.forEach(function (t, i) { var d = Math.abs(t.offsetLeft - grid.offsetLeft + t.offsetWidth / 2 - mid); if (d < gap) { gap = d; best = i; } });
  var changed = best !== hc.index;
  hc.index = best;
  hcPaint();
  if (changed || !hc.played) { hc.played = true; if (typeof hmPlay === 'function' && tiles[best].classList.contains('hm-has-scene')) hmPlay(tiles[best]); }
}

function hcStop() {
  hc.stopped = true;
  var dots = document.querySelector('.hc-dots');
  if (dots) dots.classList.add('is-stopped');
}

function hcTick(now) {
  hc.raf = requestAnimationFrame(hcTick);
  var dt = hc.last ? Math.min(100, now - hc.last) : 0;
  hc.last = now;
  var on = document.querySelector('.hc-dots .hc-dot.is-on i');
  var screen = document.getElementById('screen-config');
  var running = !hc.stopped && !hc.paused && hc.visible && !document.hidden && !hcReduced() && screen && !screen.classList.contains('hidden');
  if (!running) { if (on && hc.stopped) on.style.width = '100%'; return; }
  hc.elapsed = (hc.elapsed || 0) + dt;
  var p = hc.elapsed / HC_EVERY;
  if (on) on.style.width = Math.min(100, p * 100) + '%';
  if (p >= 1) hcGo(hc.index + 1);
}
function hcStart() { if (!hc.raf) hc.raf = requestAnimationFrame(hcTick); }

// Les « petits » blocs de l'accueil descendent en bas de page (Kayan : l'accueil faisait « fourre-tout »).
function hcTidy() {
  var screen = document.getElementById('screen-config');
  if (!screen) return;
  var tail = screen.querySelector('.hc-tail');
  if (!tail) {
    tail = document.createElement('div');
    tail.className = 'hc-tail';
    screen.appendChild(tail);
  }
  ['#home-disc-card', '.home-tools-strip', '.home-seo-links'].forEach(function (sel) {
    var el = screen.querySelector(sel);
    if (el && el.parentElement !== tail) tail.appendChild(el);
  });
}

if (typeof renderHomeDiscovery === 'function') {
  var renderHomeDiscoveryBeforeCarousel = renderHomeDiscovery;
  renderHomeDiscovery = function () {
    var out = renderHomeDiscoveryBeforeCarousel.apply(this, arguments);
    try { hcBuild(); hcTidy(); } catch (_e) {}
    return out;
  };
}
(function hcBoot() {
  var go = function () { try { hcBuild(); hcTidy(); } catch (_e) {} };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
