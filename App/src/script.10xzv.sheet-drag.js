
// ⬇ GEST-02 (7/11/2026, maquette validée) : sur téléphone, une fenêtre ou un panneau du bas se ferme en le tirant
// vers le bas par sa poignée (ou son titre). Le ✕ reste. Le geste ne part que de la poignée ou du titre, jamais
// du contenu, donc faire défiler une liste ne ferme rien. Lâché assez bas (ou d'un coup sec), il se ferme ;
// sinon il remonte. En « Animations réduites », il se ferme sans effet. Rien n'est envoyé au serveur.
var SHEET_DRAG_DEFS = [
  { card: '#overlay-modal .overlay-card', zone: '.sheet-grab, .overlay-head', back: function () { return document.getElementById('overlay-modal'); },
    close: function () { if (typeof closeOverlayModal === 'function') closeOverlayModal(); } },
  { card: '.tb-editor-sheet', zone: '.sheet-grab', back: function () { return document.querySelector('.tb-editor-back'); },
    close: function () { if (typeof closeTeamEditor === 'function') closeTeamEditor(); } },
  { card: '.fav-sheet', zone: '.fav-sheet-grab, .fav-sheet-head', back: function () { return document.querySelector('.fav-sheet-back'); },
    close: function () { if (typeof closeRankingPicker === 'function') closeRankingPicker(); } }
];
var sheetDrag = null;

function sheetDragPhone() { try { return window.matchMedia('(max-width: 640px)').matches; } catch (_e) { return false; } }
function sheetDragReduced() { try { return typeof appAnimationMode === 'function' && appAnimationMode() === 'reduced'; } catch (_e) { return false; } }
// Fermer ou non au lâcher (testé sans le DOM) : assez bas, ou un geste rapide déjà engagé.
function sheetDragShouldClose(dy, ms, height) {
  if (dy <= 0) return false;
  if (dy >= Math.max(90, (Number(height) || 0) * 0.22)) return true;
  return dy >= 40 && ms > 0 && dy / ms > 0.6;
}
function sheetDragDefFor(target) {
  for (var i = 0; i < SHEET_DRAG_DEFS.length; i++) {
    var d = SHEET_DRAG_DEFS[i], card = target.closest(d.card);
    if (card && target.closest(d.zone)) return { def: d, card: card };
  }
  return null;
}
function sheetDragTip(on) {
  var tip = document.getElementById('sheet-drag-tip');
  if (on && !tip) {
    tip = document.createElement('div');
    tip.id = 'sheet-drag-tip'; tip.className = 'sheet-drag-tip'; tip.setAttribute('aria-hidden', 'true');
    tip.textContent = '⬇ Lâche pour fermer';
    document.body.appendChild(tip);
  } else if (!on && tip) tip.remove();
}
function sheetDragReset(s, animate) {
  s.card.style.transition = animate ? 'transform .2s ease-out' : '';
  s.card.style.transform = '';
  var back = s.def.back();
  if (back) { back.style.transition = animate ? 'opacity .2s ease-out' : ''; back.style.opacity = ''; }
  sheetDragTip(false);
}

if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' || !sheetDragPhone() || !e.target || !e.target.closest) return;
    if (e.target.closest('button, input, select, textarea, a, label')) return; // le ✕ et les boutons gardent leur clic
    var found = sheetDragDefFor(e.target);
    if (!found) return;
    sheetDrag = { def: found.def, card: found.card, id: e.pointerId, y0: e.clientY, t0: performance.now(), dy: 0, h: found.card.getBoundingClientRect().height };
  });
  document.addEventListener('pointermove', function (e) {
    var s = sheetDrag;
    if (!s || e.pointerId !== s.id) return;
    s.dy = Math.max(0, e.clientY - s.y0);
    if (sheetDragReduced()) return;
    s.card.style.transition = '';
    s.card.style.transform = s.dy ? 'translateY(' + s.dy + 'px)' : '';
    var back = s.def.back();
    if (back) back.style.opacity = String(Math.max(0.35, 1 - s.dy / Math.max(240, s.h)));
    sheetDragTip(sheetDragShouldClose(s.dy, 0, s.h));
  });
  var sheetDragEnd = function (e) {
    var s = sheetDrag;
    if (!s || e.pointerId !== s.id) return;
    sheetDrag = null;
    if (e.type === 'pointercancel' || !sheetDragShouldClose(s.dy, performance.now() - s.t0, s.h)) { sheetDragReset(s, s.dy > 0); return; }
    var finish = function () { sheetDragReset(s, false); s.def.close(); };
    if (sheetDragReduced()) { finish(); return; }
    sheetDragTip(false);
    s.card.style.transition = 'transform .16s ease-in';
    s.card.style.transform = 'translateY(' + Math.round(window.innerHeight || 800) + 'px)';
    setTimeout(finish, 160);
  };
  document.addEventListener('pointerup', sheetDragEnd);
  document.addEventListener('pointercancel', sheetDragEnd);
}

// La poignée : dans la fenêtre générale (une fois), et dans l'éditeur du Team Builder quand il s'ouvre.
function sheetDragAddGrabs() {
  var card = document.querySelector('#overlay-modal .overlay-card');
  if (card && !card.querySelector(':scope > .sheet-grab')) card.insertAdjacentHTML('afterbegin', '<div class="sheet-grab" aria-hidden="true"></div>');
  var tb = document.querySelector('.tb-editor-sheet');
  if (tb && !tb.querySelector(':scope > .sheet-grab')) tb.insertAdjacentHTML('afterbegin', '<div class="sheet-grab" aria-hidden="true"></div>');
}
if (typeof window !== 'undefined' && window.addEventListener && typeof MutationObserver !== 'undefined') {
  window.addEventListener('load', function () {
    sheetDragAddGrabs();
    new MutationObserver(function () { sheetDragAddGrabs(); })
      .observe(document.body, { childList: true });
  });
}
window.sheetDragShouldClose = sheetDragShouldClose;
