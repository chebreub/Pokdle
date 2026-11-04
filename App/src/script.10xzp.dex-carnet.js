
// 📕 Carnet façon Pokédex (4/11/2026, maquette 3 validée par Kayan : « go 3 »). L'album garde ses données, ses onglets
// (Classeur, Régions et médailles, Carnet shiny) et ses médailles ; seul le classeur change de forme :
// - toute la région d'un coup, dans l'ordre du Pokédex (fini les pages de 9) ;
// - une coque rouge de Pokédex, un écran crème, des cases plus lisibles (n°, Ball si attrapé, gris si vu, ??? sinon) ;
// - recherche par nom ou numéro et filtres Tous / Attrapés / Vus / Manquants / Shinies, sans recharger la page.
ALBUM_PAGE = 2000;
albumView.filter = albumView.filter || 'all';
albumView.q = albumView.q || '';
var DEX_FILTERS = [['all', 'Tous'], ['caught', 'Attrapés'], ['seen', 'Vus'], ['miss', 'Manquants'], ['shiny', 'Shinies']];
function dexSlotMatches(slot) {
  var f = albumView.filter;
  if (f === 'caught' && !slot.classList.contains('is-caught')) return false;
  if (f === 'seen' && (slot.classList.contains('is-caught') || slot.classList.contains('is-miss'))) return false;
  if (f === 'miss' && !slot.classList.contains('is-miss')) return false;
  if (f === 'shiny' && !slot.classList.contains('is-shiny')) return false;
  var q = String(albumView.q || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/^#/, '');
  if (!q) return true;
  var num = String((slot.querySelector('.alb-num') || {}).textContent || '').replace(/\D/g, '');
  var name = String((slot.querySelector(':scope > b') || {}).textContent || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/^\d+$/.test(q)) return num.replace(/^0+/, '').indexOf(q.replace(/^0+/, '') || '0') === 0;
  return name.indexOf(q) >= 0;
}
function dexApplyFilter() {
  var page = document.querySelector('#overlay-body .alb-page');
  if (!page) return;
  var shown = 0;
  page.querySelectorAll('.alb-slot').forEach(function (slot) { var ok = dexSlotMatches(slot); slot.hidden = !ok; if (ok) shown++; });
  var empty = page.parentElement.querySelector('.dex-empty');
  if (!shown && !empty) page.insertAdjacentHTML('afterend', '<p class="dex-empty">Aucun Pokémon ne correspond.</p>');
  else if (shown && empty) empty.remove();
  document.querySelectorAll('#overlay-body .dex-filter').forEach(function (b) { var on = b.dataset.f === albumView.filter; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); });
}
function dexFilter(f) { albumView.filter = f || 'all'; dexApplyFilter(); }
function dexSearch(value) { albumView.q = String(value || ''); dexApplyFilter(); }
if (typeof albumRender === 'function') {
  var albumRenderBeforeDex = albumRender;
  albumRender = function () {
    var out = albumRenderBeforeDex.apply(this, arguments);
    var overlay = document.getElementById('overlay-modal');
    if (overlay && overlay.dataset.kind === 'album') {
      overlay.classList.add('is-dex');
      var title = document.getElementById('overlay-title');
      if (title) title.textContent = 'Mon Pokédex';
    }
    var body = document.querySelector('#overlay-body .alb');
    var head = body && body.querySelector('.alb-head');
    if (body && head && albumView.tab === 'binder' && !body.querySelector('.dex-tools')) {
      head.insertAdjacentHTML('afterend', '<div class="dex-tools"><label class="dex-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"></circle><path d="M16 16l4.5 4.5"></path></svg>' +
        '<input type="search" placeholder="Nom ou n°" aria-label="Chercher dans le Pokédex" value="' + escapeHtml(albumView.q) + '"></label>' +
        '<div class="dex-filters" role="group" aria-label="Filtrer">' + DEX_FILTERS.map(function (f) {
          return '<button type="button" class="dex-filter" data-f="' + f[0] + '" data-action="dexFilter" data-args=\'["' + f[0] + '"]\' aria-pressed="false">' + f[1] + '</button>';
        }).join('') + '</div></div>');
      var input = body.querySelector('.dex-search input');
      if (input) input.addEventListener('input', function () { dexSearch(input.value); });
      dexApplyFilter();
    }
    return out;
  };
}
// Une autre région : on repart sur « Tous », sans recherche.
if (typeof albumGoRegion === 'function') {
  var albumGoRegionBeforeDex = albumGoRegion;
  albumGoRegion = function () { albumView.filter = 'all'; albumView.q = ''; return albumGoRegionBeforeDex.apply(this, arguments); };
}
if (typeof closeOverlayModal === 'function') {
  var closeOverlayModalBeforeDex = closeOverlayModal;
  closeOverlayModal = function () { var o = document.getElementById('overlay-modal'); if (o) o.classList.remove('is-dex'); return closeOverlayModalBeforeDex.apply(this, arguments); };
}
window.dexFilter = dexFilter;
window.dexSearch = dexSearch;
