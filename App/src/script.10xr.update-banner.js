
// ===== 🔄 « Pokédle a été mis à jour » (01/11/2026) =====
// A page left open across a deploy keeps its old script, and the new features do not open in it
// (« Relever le défi » did nothing). When the server's build differs from this page's, a banner at the
// top of the page offers to reload. Never on its own: a game in progress is not lost.
var siteBuildMine = (function () {
  try {
    var tag = document.querySelector('script[src*="dist/script.min.js"]');
    var match = tag && /[?&]v=([0-9a-f]+)/.exec(tag.getAttribute('src') || '');
    return match ? match[1] : '';
  } catch (_e) { return ''; }
})();
var siteBuildShown = false;
var siteBuildLastCheck = Date.now();
var SITE_BUILD_EVERY = 5 * 60 * 1000;
function checkSiteBuild(force) {
  if (!siteBuildMine || siteBuildShown) return;
  if (!force && Date.now() - siteBuildLastCheck < SITE_BUILD_EVERY) return;
  siteBuildLastCheck = Date.now();
  fetch('/api/version', { cache: 'no-store', credentials: 'same-origin' })
    .then(function (res) { return res.json(); })
    .then(function (data) { if (data && data.build && data.build !== siteBuildMine) showSiteUpdateBanner(); })
    .catch(function () {});
}
function showSiteUpdateBanner() {
  if (siteBuildShown || document.getElementById('site-update-banner')) return;
  siteBuildShown = true;
  var bar = document.createElement('div');
  bar.id = 'site-update-banner';
  bar.className = 'site-update-banner';
  bar.setAttribute('role', 'status');
  bar.innerHTML = '<span>🔄 Pokédle a été mis à jour.</span>' +
    '<button type="button" class="btn-blue" data-action="reloadSiteNow">Recharger</button>' +
    '<button type="button" class="site-update-x" data-action="dismissSiteUpdate" aria-label="Plus tard">✕</button>';
  var main = document.querySelector('main') || document.body;
  main.insertBefore(bar, main.firstChild);
  if (typeof showToast === 'function') showToast('🔄 Pokédle a été mis à jour : recharge la page.');
}
function reloadSiteNow() { location.reload(); }
function dismissSiteUpdate() { var bar = document.getElementById('site-update-banner'); if (bar) bar.remove(); }
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') checkSiteBuild(false); });
  setInterval(function () { checkSiteBuild(false); }, 10 * 60 * 1000);
}
window.reloadSiteNow = reloadSiteNow;
window.dismissSiteUpdate = dismissSiteUpdate;
