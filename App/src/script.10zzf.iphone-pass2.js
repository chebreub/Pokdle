// 📱 Passe iPhone, lot 2 (9/11/2026, maquettes validées : « go ») : Mon sac, Expédition, Hautes herbes, Mes amis.
// Sur téléphone seulement : les longues explications passent derrière un bouton (« Comment gagner des Balls »,
// « ⓘ Comment ça marche », « 📖 Lire l'histoire », « ⓘ Comment ajouter des amis ? »), le reste est resserré par le CSS.
// Rien n'est retiré de la page : les textes restent là, repliés (le PC ne change pas).

function sxBtn(kind, label) {
  return '<button type="button" class="sx-toggle" data-action="sxToggle" data-args=\'["' + kind + '"]\' aria-expanded="false">' + label + '</button>';
}

// Mon sac : « Comment gagner des Balls » se déplie au toucher.
function sxPaintBag() {
  var how = document.querySelector('#overlay-modal .ball-bag .ball-how:not(.sx-fold)');
  if (!how) return;
  var title = how.querySelector('h4');
  if (!title) return;
  how.classList.add('sx-fold');
  title.insertAdjacentHTML('afterend', sxBtn('how', '❓ ' + escapeHtml(title.textContent || 'Comment gagner des Balls') + '<b aria-hidden="true">›</b>'));
}

// Expédition : les explications (coffres, 100 %, jours de réussite) derrière « ⓘ Comment ça marche »,
// l'histoire de Draby derrière « 📖 Lire l'histoire ».
function sxPaintExpedition() {
  var root = document.querySelector('#overlay-modal .exp.exp2:not(.sx-on)');
  if (!root) return;
  root.classList.add('sx-on');
  root.querySelectorAll('.exp2-goal > p.exp-note').forEach(function (p) { p.classList.add('sx-more'); });
  root.querySelectorAll(':scope > section.exp-card').forEach(function (card) {
    if (!card.querySelector('h4') && card.querySelector('p.exp-note')) card.classList.add('sx-more');
  });
  var quest = root.querySelector('.exp-prestige');
  var story = quest && quest.querySelector(':scope > h4 + p.exp-note');
  if (story) story.classList.add('sx-story');
  if (quest) quest.querySelectorAll('.exp2-steps ~ p.exp-note').forEach(function (p) { p.classList.add('sx-more'); });
  var links = '<div class="sx-links">' + (story ? sxBtn('story', '📖 Lire l’histoire') : '') + sxBtn('rules', 'ⓘ Comment ça marche') + '</div>';
  (quest || root).insertAdjacentHTML('beforeend', links);
}

// Mes amis : l'explication sous la liste derrière « ⓘ Comment ajouter des amis ? ».
function sxPaintFriends() {
  var note = document.querySelector('#party-friends .fr-note:not(.sx-fold)');
  if (!note) return;
  note.classList.add('sx-fold');
  note.insertAdjacentHTML('beforebegin', sxBtn('friends', 'ⓘ Comment ajouter des amis ?<b aria-hidden="true">›</b>'));
}

// Hautes herbes : le bouton dit la zone choisie (« Chercher en Forêt → »), sur téléphone comme sur PC il est déjà là ;
// rien à ajouter, le CSS met les 6 zones en 3 colonnes plus basses.

function sxToggle(kind) {
  var map = {
    how: ['#overlay-modal .ball-how.sx-fold', 'is-open'],
    rules: ['#overlay-modal .exp.sx-on', 'sx-rules'],
    story: ['#overlay-modal .exp.sx-on', 'sx-story-open'],
    friends: ['#party-friends .fr-note.sx-fold', 'is-open']
  };
  var target = map[kind] && document.querySelector(map[kind][0]);
  if (!target) return;
  var open = target.classList.toggle(map[kind][1]);
  document.querySelectorAll('.sx-toggle[data-args=\'["' + kind + '"]\']').forEach(function (b) { b.setAttribute('aria-expanded', open ? 'true' : 'false'); });
}
window.sxToggle = sxToggle;

function sxPaint() {
  try { sxPaintBag(); sxPaintExpedition(); sxPaintFriends(); } catch (_e) {}
}

// Ces fenêtres se redessinent seules (onglets du sac, coffres, liste d'amis) : on repasse après chaque changement.
(function () {
  if (typeof MutationObserver !== 'function' || typeof document === 'undefined') return;
  var queued = false;
  var run = function () { queued = false; sxPaint(); };
  var watch = function () {
    ['overlay-modal', 'screen-party-room'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && !el.__sxWatched) {
        el.__sxWatched = true;
        new MutationObserver(function () {
          if (queued) return;
          queued = true;
          (window.requestAnimationFrame || setTimeout)(run);
        }).observe(el, { childList: true, subtree: true });
      }
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();
})();
