
// 🎯 GEST-03 (7/11/2026, option, maquette envoyée) : réglage « Lancer la Ball d'un geste » (désactivé par défaut).
// Une Ball posée en bas de la scène des hautes herbes ; glissée vers le haut et lâchée, elle part par EXACTEMENT
// le même chemin que le bouton (wildThrow → /api/wild/throw) : même serveur, même chance de capture. Un geste
// trop court, vers le bas, interrompu ou annulé ne dépense rien : aucune Ball n'est retirée sans lancer. Les
// boutons Poké Ball / Super Ball restent.
var BALL_FLICK_HINT_KEY = 'pokedle_ball_flick_hint_v1';
var ballFlickKind = 'poke';

function ballFlickEnabled() {
  try { return typeof getStoredAppSettings === 'function' && getStoredAppSettings().ballFlick === true; } catch (_e) { return false; }
}
// Lancer ou non au lâcher (testé sans le DOM) : vers le haut, assez loin, plutôt vertical.
function ballFlickShouldThrow(dx, dy) {
  return dy <= -80 && Math.abs(dx) <= Math.abs(dy) * 0.8;
}
function ballFlickPick(scene) {
  var available = Array.prototype.filter.call(scene.querySelectorAll('.wild-ball-btn'), function (b) { return !b.disabled; })
    .map(function (b) { try { return JSON.parse(b.getAttribute('data-args'))[0]; } catch (_e) { return null; } }).filter(Boolean);
  if (!available.length) return null;
  return available.indexOf(ballFlickKind) >= 0 ? ballFlickKind : available[0];
}
function renderBallFlick() {
  var scene = document.getElementById('wild-scene');
  var stage = scene && scene.querySelector('.wild-stage');
  var old = scene && scene.querySelector('.wild-flick');
  if (old) old.remove();
  if (!stage || !ballFlickEnabled() || !scene.querySelector('.wild-ball-btn') || (typeof wildBusy !== 'undefined' && wildBusy)) return;
  var kind = ballFlickPick(scene);
  if (!kind) return;
  var el = document.createElement('div');
  el.className = 'wild-flick';
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', 'Glisse vers le haut pour lancer une ' + ((typeof BALL_KINDS !== 'undefined' && BALL_KINDS[kind] && BALL_KINDS[kind].name) || 'Ball'));
  el.innerHTML = '<span class="wild-flick-ball">' + (typeof moBallSvg === 'function' ? moBallSvg(kind) : '') + '</span>';
  var hints = 0;
  try { hints = Number(localStorage.getItem(BALL_FLICK_HINT_KEY)) || 0; } catch (_e) {}
  if (hints < 2) {
    el.insertAdjacentHTML('beforeend', '<span class="wild-flick-hint">👆 Glisse la Ball vers le haut pour la lancer</span>');
    try { localStorage.setItem(BALL_FLICK_HINT_KEY, String(hints + 1)); } catch (_e) {}
  }
  stage.appendChild(el);
  var ball = el.querySelector('.wild-flick-ball');
  var start = null;
  el.addEventListener('pointerdown', function (e) {
    if (typeof wildBusy !== 'undefined' && wildBusy) return;
    start = { x: e.clientX, y: e.clientY, id: e.pointerId };
    try { el.setPointerCapture(e.pointerId); } catch (_e) {}
    ball.style.transition = '';
  });
  el.addEventListener('pointermove', function (e) {
    if (!start || e.pointerId !== start.id) return;
    var dx = e.clientX - start.x, dy = Math.min(40, e.clientY - start.y);
    ball.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(' + (1 - Math.min(0.25, Math.max(0, -dy) / 1200)) + ')';
  });
  var end = function (e) {
    if (!start || e.pointerId !== start.id) return;
    var dx = e.clientX - start.x, dy = e.clientY - start.y;
    start = null;
    if (e.type === 'pointerup' && ballFlickShouldThrow(dx, dy) && !(typeof wildBusy !== 'undefined' && wildBusy)) {
      try { localStorage.setItem(BALL_FLICK_HINT_KEY, '2'); } catch (_e) {}
      var kindNow = ballFlickPick(scene);
      el.remove();
      if (kindNow && typeof window.wildThrow === 'function') window.wildThrow(kindNow); // le même lancer que le bouton
      return;
    }
    ball.style.transition = 'transform .2s ease-out'; // rien n'est dépensé : la Ball revient
    ball.style.transform = '';
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

if (typeof renderWildEncounter === 'function') {
  var renderWildEncounterBeforeFlick = renderWildEncounter;
  renderWildEncounter = function () {
    var out = renderWildEncounterBeforeFlick.apply(this, arguments);
    try { renderBallFlick(); } catch (_e) {}
    return out;
  };
}
// La Ball glissée est celle choisie en dernier avec les boutons.
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('#wild-scene .wild-ball-btn');
    if (!b) return;
    try { ballFlickKind = JSON.parse(b.getAttribute('data-args'))[0] || ballFlickKind; } catch (_e) {}
  }, true);
}
window.renderBallFlick = renderBallFlick;
