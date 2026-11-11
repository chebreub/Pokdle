// 🎉 Tuiles des jeux de la Party Room (11/11/2026, maquette validée, « ok » ; « faut des tuiles animées aussi »).
// Même identité que les écrans de jeu (arcade-v2) : chaque jeu a sa couleur, un grand artwork dans le coin,
// le nom en gros et le nombre de joueurs dans une pastille. Animées : l'artwork respire, et une petite scène
// propre à chaque jeu passe d'une tuile à l'autre (une à la fois). Rien hors de l'écran, onglet caché, ou avec
// « Animations réduites ». Mêmes boutons, mêmes actions (pl3Pick, modes à deux) : seul l'habillage change.

var PT_GAMES = {
  dessin: ['#F08A4B', 'draw'], quiestce1v1: ['#7C5BD6', 'who'], petitbac: ['#3FA06A', 'bac'], dexrace: ['#4069E0', 'race'],
  coop: ['#D9A21B', 'coop'], deduction: ['#E06AA0', 'mystery'], guess: ['#E07B32', 'speed'], nearest: ['#2E9FD8', 'number'],
  typecombo: ['#8C7A55', 'combo'], duocriteria: ['#3B8FD1', 'duo'], statclashparty: ['#B0563A', 'stat'], statclash: ['#5E7F9E', 'stat']
};
var PT_DUOS = {
  openMultiplayerMode: ['#E8B820', 'vs'], openStatClashMode: ['#5E7F9E', 'stat'], openStatAuctionMode: ['#3E8E8A', 'coin'], openDefiAmiFromAllModes: ['#4069E0', 'send']
};
var PT_FX = {
  draw: '<svg viewBox="0 0 100 60"><path d="M6 48 C 22 10, 38 10, 46 34 S 72 58, 94 14" /></svg><i class="pt-pen"></i>',
  who: '<i class="pt-card"><b>?</b></i>',
  bac: '<i class="pt-letter"><span>A B C D E F G H P</span></i>',
  race: '<i class="pt-cells">' + new Array(9).join('<u></u>') + '<u></u></i>',
  coop: '<i class="pt-lens"></i>',
  mystery: '<i class="pt-q">?</i>',
  speed: '<i class="pt-lines"><u></u><u></u><u></u></i>',
  number: '<i class="pt-num"><span>N° 025 133 448 151 006</span></i>',
  combo: '<i class="pt-chip is-a"></i><i class="pt-chip is-b"></i>',
  duo: '<i class="pt-tick is-a">✓</i><i class="pt-tick is-b">✓</i>',
  stat: '<i class="pt-bar"><u></u></i>',
  vs: '<i class="pt-vs">VS</i>',
  coin: '<i class="pt-coin">₽</i>',
  send: '<i class="pt-plane"></i>'
};
var ptLive = { timer: 0, k: 0, seen: typeof Set === 'function' ? new Set() : null, io: null };

function ptReduced() {
  if (typeof hmReduced === 'function') return hmReduced();
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
function ptObserve(el) {
  if (!ptLive.seen || typeof IntersectionObserver !== 'function') return;
  if (!ptLive.io) ptLive.io = new IntersectionObserver(function (list) { list.forEach(function (e) { if (e.isIntersecting) ptLive.seen.add(e.target); else ptLive.seen.delete(e.target); }); }, { threshold: 0.6 });
  ptLive.io.observe(el);
}
function ptDecorate() {
  var lobby = document.getElementById('party-lobby');
  if (!lobby || !lobby.querySelector('.pl3')) return;
  lobby.classList.add('pt-on');
  lobby.querySelectorAll('.pl3-game, .party-duel-link').forEach(function (b, i) {
    if (b.dataset.pt) return;
    var def = PT_GAMES[b.getAttribute('data-pl3')] || PT_DUOS[b.getAttribute('data-action')];
    if (!def) return;
    b.dataset.pt = def[1];
    b.classList.add('pt-tile');
    b.style.setProperty('--c', def[0]);
    b.style.setProperty('--d', (i % 6) * 0.45 + 's');
    var fx = document.createElement('span');
    fx.className = 'pt-fx pt-fx-' + def[1];
    fx.setAttribute('aria-hidden', 'true');
    fx.innerHTML = PT_FX[def[1]] || '';
    b.appendChild(fx);
    ptObserve(b);
  });
}
// Une scène à la fois, seulement sur une tuile visible.
function ptStep() {
  if (document.hidden || ptReduced()) return;
  if (document.querySelector('#party-lobby .pt-tile.pt-play')) return;
  var tiles = Array.prototype.filter.call(document.querySelectorAll('#party-lobby .pt-tile'), function (t) {
    return t.isConnected && t.getClientRects().length && (!ptLive.seen || ptLive.seen.has(t));
  });
  if (!tiles.length) return;
  var t = tiles[ptLive.k++ % tiles.length];
  t.classList.add('pt-play');
  setTimeout(function () { t.classList.remove('pt-play'); }, 2400);
}
function ptStart() {
  if (ptLive.timer) return;
  ptLive.timer = setInterval(ptStep, 2700);
}
// Les anciennes petites scènes des vignettes (motion-all-modes) laissent la place aux nouvelles tuiles.
if (typeof mo2DecorateLobby === 'function') mo2DecorateLobby = function () {};
if (typeof pl3Paint === 'function') {
  var pl3PaintBeforePt = pl3Paint;
  pl3Paint = function () {
    var out = pl3PaintBeforePt.apply(this, arguments);
    try { ptDecorate(); ptStart(); } catch (_e) {}
    return out;
  };
}
try { ptDecorate(); } catch (_e) {}
