// 📱 Pokédex › Ma collection plus courte sur iPhone (9/11/2026, maquette validée : « go »).
// Kayan : « bizarre sur iPhone, et je vois pas la diff entre possédé et capturé, ça fait doublon ».
// Sur téléphone : 3 compteurs (Vus · Attrapés · Shinies) au lieu de 4 barres, « Attrapés » = encore à toi,
// avec « N capturés en tout » en petit ; vitrine en une ligne de ronds ; cibles et découvertes en lignes ;
// filtres courts, régions en pastilles, 3 Pokémon par ligne. Les blocs d'origine restent dans la page
// (la QA et le PC s'en servent) : ce fichier ajoute des versions courtes, le CSS choisit selon la largeur.

function colmStatsHtml() {
  if (typeof pokedexCollectionBaseCatalogue !== 'function' || typeof colCollectionProgress !== 'function') return '';
  var base = pokedexCollectionBaseCatalogue();
  var totals = colCollectionProgress(base);
  var loaded = typeof wildCaptures !== 'undefined' && wildCaptures !== null;
  var historyLoaded = typeof wildCaptureHistory !== 'undefined' && wildCaptureHistory !== null;
  var shinies = base.filter(function (p) { return colIsShiny(p, pokedexCollectionState(p)); }).length;
  var total = base.length || 1;
  var pct = Math.max(0, Math.min(100, Math.round(totals.seen * 100 / total)));
  var item = function (name) { return typeof dexItem === 'function' ? dexItem(name, 'colm-ico') : ''; };
  var ever = historyLoaded && totals.caught !== totals.obtained ? '<em>' + totals.caught + ' capturé' + (totals.caught > 1 ? 's' : '') + ' en tout</em>' : '';
  return '<div class="colm-stats" aria-label="Ta collection">' +
    '<div class="colm-st"><small>' + item('poke-radar') + 'Vus</small><b>' + totals.seen + '<i> / ' + total + '</i></b><span class="colm-bar"><i style="width:' + pct + '%"></i></span></div>' +
    '<div class="colm-st is-caught"><small>' + item('poke-ball') + 'Attrapés</small><b>' + (loaded ? totals.obtained : '…') + '</b>' + ever + '</div>' +
    '<div class="colm-st is-shiny"><small>' + item('shiny-charm') + 'Shinies</small><b>' + shinies + '</b></div></div>';
}

var COLM_REGIONS = ['Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Unys', 'Kalos', 'Alola', 'Galar', 'Paldea'];
function colmGensHtml() {
  var current = typeof pokedexGenFilter !== 'undefined' ? String(pokedexGenFilter) : 'all';
  return '<button type="button" data-action="colmAllGens" aria-pressed="' + (current === 'all') + '">Toutes</button>' +
    COLM_REGIONS.map(function (name, i) {
      return '<button type="button" data-action="selectPokedexCollectionRegion" data-args="[' + (i + 1) + ']" aria-pressed="' + (current === String(i + 1)) + '">' + name + '</button>';
    }).join('');
}
function colmAllGens() {
  if (typeof pokedexGenFilter === 'undefined') return;
  pokedexGenFilter = 'all';
  var select = document.getElementById('pokedex-gen-filter');
  if (select) select.value = 'all';
  if (typeof renderPokedexGrid === 'function') renderPokedexGrid();
}
window.colmAllGens = colmAllGens;

// Libellés courts des filtres sur téléphone (le libellé long reste pour le PC).
var COLM_SHORT = { all: 'Tous', obtained: 'Attrapés', seen: 'Vus', shiny: '✨', missing: 'Manquants', mission: 'À mériter', secret: 'Secrets', caught: 'Déjà capturés' };

function colmPaint() {
  var hub = document.getElementById('pokedex-collection-hub');
  if (!hub) return;
  var national = document.getElementById('pokedex-collection-national');
  if (national) {
    var old = national.querySelector('.colm-stats');
    if (old) old.remove();
    national.insertAdjacentHTML('afterbegin', colmStatsHtml());
  }
  var filters = document.getElementById('pokedex-collection-filters');
  if (filters) {
    filters.querySelectorAll('[data-collection-filter]').forEach(function (b) {
      if (b.querySelector('.colm-long')) return;
      var key = b.getAttribute('data-collection-filter');
      if (!COLM_SHORT[key]) return;
      var long = document.createElement('span');
      long.className = 'colm-long';
      while (b.firstChild) long.appendChild(b.firstChild);
      b.appendChild(long);
      b.insertAdjacentHTML('beforeend', '<span class="colm-short" aria-hidden="true">' + COLM_SHORT[key] + '</span>');
    });
    var gens = document.getElementById('colm-gens');
    if (!gens) {
      gens = document.createElement('div');
      gens.id = 'colm-gens';
      gens.className = 'colm-gens';
      gens.setAttribute('role', 'group');
      gens.setAttribute('aria-label', 'Régions');
      filters.insertAdjacentElement('afterend', gens);
    }
    gens.innerHTML = colmGensHtml();
  }
}

// « ← Retour » du Pokédex : une flèche ronde sur téléphone (le mot reste lu par les lecteurs d'écran).
function colmBack() {
  var back = document.querySelector('#screen-pokedex .ranking-head-actions .btn-ghost');
  if (!back || back.querySelector('.colm-long')) return;
  if (!back.getAttribute('aria-label')) back.setAttribute('aria-label', String(back.textContent || 'Retour').replace(/[←\s]+/, '').trim() || 'Retour');
  back.innerHTML = '<span aria-hidden="true">←</span><span class="colm-long"> ' + escapeHtml(back.getAttribute('aria-label')) + '</span>';
}

if (typeof renderPokedexCollectionHub === 'function') {
  var renderPokedexCollectionHubBeforeColm = renderPokedexCollectionHub;
  renderPokedexCollectionHub = function () {
    var out = renderPokedexCollectionHubBeforeColm.apply(this, arguments);
    try { colmPaint(); colmBack(); } catch (_e) {}
    return out;
  };
}
