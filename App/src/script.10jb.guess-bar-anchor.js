
// ⌨️ iPhone (7/11/2026, retour de Kayan) : dans les jeux à essais (Pokémon du jour, Classique, Défi), chaque essai
// ajoute une carte juste au-dessus de la barre « Tape un nom de Pokémon… ». Chrome garde la page en place, mais
// Safari ne le fait pas : la barre descendait d'une carte à chaque essai et finissait sous le menu du bas.
// Après chaque nouvel essai, sur téléphone, si la barre est passée sous le menu (ou sous le clavier), la page
// remonte juste assez pour qu'elle soit de nouveau entière au-dessus. Rien ne bouge si elle est déjà visible.
function guessBarLimits() {
  var vv = window.visualViewport;
  var top = (vv ? vv.offsetTop : 0) + 8;
  var bottom = (vv ? vv.offsetTop + vv.height : window.innerHeight) - 8;
  var header = document.querySelector('body > header');
  if (header && ['fixed', 'sticky'].indexOf(getComputedStyle(header).position) >= 0) top = Math.max(top, header.getBoundingClientRect().bottom + 8);
  var nav = document.getElementById('mobile-tabbar');
  if (nav && !document.body.classList.contains('mobile-keyboard-open') && nav.getClientRects().length) {
    var navTop = nav.getBoundingClientRect().top;
    if (navTop > top) bottom = Math.min(bottom, navTop - 8);
  }
  return { top: top, bottom: bottom };
}
// Le décalage à faire défiler (testé sans le DOM) : seulement quand la barre est passée sous la limite.
function guessBarScrollDelta(barTop, barBottom, limits) {
  if (barBottom <= limits.bottom) return 0;
  return Math.max(0, Math.round(Math.min(barBottom - limits.bottom, barTop - limits.top)));
}
function guessBarKeepVisible() {
  if (!(window.matchMedia && window.matchMedia('(max-width: 640px)').matches)) return;
  var screen = document.getElementById('screen-game'), input = document.getElementById('guess-input');
  if (!screen || screen.classList.contains('hidden') || screen.dataset.finished === 'true') return;
  var bar = input && input.closest('.search-bar');
  if (!bar || !bar.getClientRects().length || getComputedStyle(bar).display === 'none') return;
  var box = bar.getBoundingClientRect();
  var delta = guessBarScrollDelta(box.top, box.bottom, guessBarLimits());
  if (delta) window.scrollBy({ top: delta, behavior: 'instant' });
}
if (typeof window !== 'undefined' && window.addEventListener && typeof MutationObserver !== 'undefined') {
  window.addEventListener('load', function () {
    var body = document.getElementById('results-body');
    if (!body) return;
    var timer = 0;
    new MutationObserver(function (records) {
      if (!records.some(function (r) { return r.addedNodes.length; })) return;
      requestAnimationFrame(guessBarKeepVisible);
      clearTimeout(timer);
      timer = setTimeout(guessBarKeepVisible, 350); // après le chargement de l'image de la carte
    }).observe(body, { childList: true });
  });
}
