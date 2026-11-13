// 📱 Safari iPhone (iOS 26) : la barre d'adresse flotte en bas et la page défile derrière elle. Notre menu du bas
// se calait au-dessus de la zone de Safari et laissait voir un bout de page entre les deux (capture de Kayan, 13/11/2026).
// Essai d'abord sur une adresse de test : pokdle.fr/?navtest=1 l'active sur ce navigateur (gardé), ?navtest=0 l'enlève.
// Quand il est actif, hors appli installée :
// - la page s'étend jusqu'en bas de l'écran (viewport-fit=cover), et le menu se pose au-dessus de la barre de Safari
//   grâce à env(safe-area-inset-bottom) (règle déjà en place dans mobile.css) ;
// - un fond crème en fondu remplit le bas de l'écran sous le menu, pour que la page ne se voie plus entre les deux.
// Rien ne change dans l'appli installée (la barre de Safari n'y existe pas) ni sur PC.

var IOS_NAV_KEY = 'pokdle_navtest';

function iosNavStandalone() {
  try { return navigator.standalone === true || Boolean(window.matchMedia && matchMedia('(display-mode: standalone)').matches); }
  catch (_e) { return false; }
}

function iosNavWanted() {
  var flag = null;
  try {
    var q = new URLSearchParams(location.search).get('navtest');
    if (q === '1') localStorage.setItem(IOS_NAV_KEY, '1');
    if (q === '0') localStorage.removeItem(IOS_NAV_KEY);
    flag = localStorage.getItem(IOS_NAV_KEY);
  } catch (_e) {}
  return flag === '1' && !iosNavStandalone();
}

function iosNavApply() {
  if (!iosNavWanted()) return;
  var meta = document.querySelector('meta[name="viewport"]');
  if (meta && !/viewport-fit=cover/.test(meta.content)) meta.content = meta.content + ', viewport-fit=cover';
  document.documentElement.classList.add('ios-safe-nav');
  if (!document.getElementById('ios-safe-nav-fade')) {
    var fade = document.createElement('div');
    fade.id = 'ios-safe-nav-fade';
    fade.setAttribute('aria-hidden', 'true');
    document.body.appendChild(fade);
  }
  iosNavPaint();
  // Le thème (clair / sombre) change la couleur du fond : on la reprend à chaque changement de classe du body.
  if (window.MutationObserver) new MutationObserver(iosNavPaint).observe(document.body, { attributes: true, attributeFilter: ['class'] });
}

function iosNavPaint() {
  var fade = document.getElementById('ios-safe-nav-fade');
  if (!fade) return;
  var c = getComputedStyle(document.body).backgroundColor;
  if (!c || c === 'transparent' || c === 'rgba(0, 0, 0, 0)') c = '#FFF8EF';
  if (fade.style.getPropertyValue('--ios-fade-c') !== c) fade.style.setProperty('--ios-fade-c', c);
}

(function iosNavBoot() {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iosNavApply); else iosNavApply();
})();
