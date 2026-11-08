// 📕 Pokédex v2 (8/11/2026, maquette v2 validée par Kayan : « go poke »). Le carnet garde ses données, ses filtres,
// ses médailles et ses onglets ; on change l'habillage :
// - une coque de Pokédex (objectif bleu, 3 voyants) ;
// - les régions sur une ligne, chacune avec son anneau de progression ;
// - un bandeau de région : Vus (Poké Radar), Attrapés (Poké Ball), Shinies (Charme Chroma), une piste des badges
//   bronze / argent / or dessinés par nous, les 3 starters de la région ;
// - les filtres avec leur nombre ; des cases bien distinctes (attrapé en couleur, vu en gris, manquant en ombre
//   avec « où le trouver » quand il vit dans une zone des hautes herbes).
// Objets du jeu : sprites officiels de PokéAPI (comme les Balls du site). Aucune règle ne change.

var DEX_ITEM_BASE = 'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/items/';
var DEX_STARTERS = { 1: [1, 4, 7], 2: [152, 155, 158], 3: [252, 255, 258], 4: [387, 390, 393], 5: [495, 498, 501], 6: [650, 653, 656], 7: [722, 725, 728], 8: [810, 813, 816], 9: [906, 909, 912] };
var DEX_BADGE_COLORS = { 25: ['#C77B3B', '#F2C08A', '#7A4518'], 50: ['#A9B4C2', '#F2F6FA', '#5E6B7A'], 100: ['#E8B923', '#FFF1A8', '#9A6A00'] };

function dexItem(name, cls) {
  return '<img class="dex-it' + (cls ? ' ' + cls : '') + '" src="' + DEX_ITEM_BASE + name + '.png" alt="" width="24" height="24" loading="lazy" decoding="async" draggable="false">';
}
function dexUnown() {
  return '<span class="dex-unown" aria-hidden="true"><img src="https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/201-question.png" alt="" loading="lazy" draggable="false"></span>';
}
// Un badge d'arène dessiné par nous (pas une copie des vrais badges).
function dexBadge(pct, size, off) {
  var c = DEX_BADGE_COLORS[pct] || DEX_BADGE_COLORS[100], id = 'dexg' + pct + (off ? 'o' : '') + size;
  return '<svg class="dex-badge' + (off ? ' is-off' : '') + '" width="' + size + '" height="' + size + '" viewBox="0 0 40 40" aria-hidden="true">' +
    '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + c[1] + '"/><stop offset=".55" stop-color="' + c[0] + '"/><stop offset="1" stop-color="' + c[2] + '"/></linearGradient></defs>' +
    '<path d="M20 2 33 9.5v15L20 38 7 24.5v-15z" fill="url(#' + id + ')" stroke="' + c[2] + '" stroke-width="2"/>' +
    '<path d="M20 9 27 13v9l-7 8-7-8v-9z" fill="' + c[1] + '" opacity=".55"/><circle cx="20" cy="17" r="4" fill="#fff" opacity=".85"/>' +
    '<path d="M12 8l4 3" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".7"/></svg>';
}
function dexRing(pct, on) {
  var len = (Math.max(0, Math.min(100, pct)) * 0.942).toFixed(1);
  return '<svg class="dex-ring" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15" class="bg"/><circle cx="18" cy="18" r="15" class="fg" style="stroke-dasharray:' + len + ' 94.2"/></svg>';
}
function dexZoneOf(id) {
  if (typeof WILD_ZONES === 'undefined' || typeof wildZonePools === 'undefined' || !wildZonePools) return null;
  return WILD_ZONES.find(function (z) { return Array.isArray(wildZonePools[z.key]) && wildZonePools[z.key].indexOf(id) >= 0; }) || null;
}
function dexSlotId(slot) { return Number(String((slot.querySelector('.alb-num') || {}).textContent || '').replace(/\D/g, '')) || 0; }

function dexDecorateHeader(overlay) {
  var title = document.getElementById('overlay-title');
  if (!title || title.querySelector('.dex-leds')) return;
  title.insertAdjacentHTML('afterbegin', '<span class="dex-leds" aria-hidden="true"><i></i><i></i><i></i></span>');
}
function dexDecorateTabs(body) {
  body.querySelectorAll('.alb-tabs > button').forEach(function (b) {
    if (b.querySelector('.dex-tab-ico')) return;
    var args = String(b.getAttribute('data-args') || '') + ' ' + b.textContent;
    var ico = /regions|Régions/.test(args) ? dexBadge(100, 18) : /shiny/i.test(args) ? dexItem('shiny-charm') : '<span class="dex-mini-lens"></span>';
    // L'onglet shiny avait déjà un « ✨ » écrit : l'objet le remplace.
    Array.prototype.forEach.call(b.childNodes, function (n) { if (n.nodeType === 3) n.textContent = n.textContent.replace(/✨\s*/g, ''); });
    b.insertAdjacentHTML('afterbegin', '<span class="dex-tab-ico" aria-hidden="true">' + ico + '</span>');
  });
}
function dexDecorateChips(body) {
  body.querySelectorAll('.alb-chip').forEach(function (b) {
    if (b.classList.contains('dex-chip')) return;
    var gen = Number(String(b.getAttribute('data-args') || '').replace(/\D/g, '')) || 0;
    if (!gen || typeof albumStats !== 'function') return;
    var s = albumStats(gen), on = b.classList.contains('is-on');
    b.classList.add('dex-chip');
    b.innerHTML = dexRing(s.percent, on) + '<span><b>' + escapeHtml(s.name) + '</b><small>' + s.percent + ' %</small></span>';
    b.setAttribute('aria-label', s.name + ' : ' + s.found + ' sur ' + s.total);
  });
}
function dexDecorateHead(body) {
  var head = body.querySelector('.alb-head');
  if (!head || head.classList.contains('dex-head') || typeof albumStats !== 'function') return;
  var gen = albumView.gen, s = albumStats(gen);
  head.classList.add('dex-head');
  var h3 = head.querySelector('h3');
  if (h3) h3.insertAdjacentHTML('afterend', '<p class="dex-sub">Génération ' + gen + ' · ' + s.total + ' Pokémon</p>');
  var seen = head.querySelector('.alb-track.is-seen > span');
  if (seen) seen.innerHTML = dexItem('poke-radar') + ' Vus';
  var caughtLabel = head.querySelector('.alb-track.is-caught > span');
  if (caughtLabel) caughtLabel.innerHTML = dexItem('poke-ball') + ' Attrapés';
  var caughtTrack = head.querySelector('.alb-track.is-caught');
  if (caughtTrack && !head.querySelector('.alb-track.is-shiny')) caughtTrack.insertAdjacentHTML('afterend',
    '<div class="alb-track is-shiny is-count" title="Shinies trouvés dans cette région"><span>' + dexItem('shiny-charm') + ' Shinies</span><em>' + s.shinies + '</em></div>');
  // La piste des badges : où on en est, et ce qu'il manque pour le prochain.
  var medals = head.querySelector('.alb-medals');
  if (medals && typeof ALBUM_TIERS !== 'undefined') {
    var pct = s.total ? Math.min(100, s.found / s.total * 100) : 0;
    var next = typeof albumNextTier === 'function' ? albumNextTier(s) : null;
    var left = next ? Math.max(0, albumTierNeed(next, s.total) - s.found) : 0;
    var marks = ALBUM_TIERS.map(function (t) {
      var got = albumTierReached(t, s);
      return '<span class="dex-mark' + (got ? ' is-got' : '') + '" style="left:' + t.pct + '%" title="' + t.pct + ' %">' + dexBadge(t.pct, 34, !got) + '</span>';
    }).join('');
    var label = next ? 'Encore ' + left + ' vu' + (left > 1 ? 's' : '') + ' pour le badge ' + (next.pct === 25 ? 'de bronze' : next.pct === 50 ? 'd’argent' : 'd’or') : 'Région complète : badge d’or !';
    medals.insertAdjacentHTML('beforebegin', '<div class="dex-track" role="img" aria-label="' + escapeHtml(label) + '"><span class="dex-track-bar"><i style="width:' + pct.toFixed(1) + '%"></i></span>' + marks + '<span class="dex-track-label">' + escapeHtml(label) + '</span></div>');
    medals.classList.add('dex-medals-text');
  }
  var starters = DEX_STARTERS[gen];
  if (starters && typeof POKEMON_BY_ID !== 'undefined' && typeof pokedexDetailArtwork === 'function') {
    head.insertAdjacentHTML('beforeend', '<span class="dex-deco" aria-hidden="true">' + starters.map(function (id) {
      var p = POKEMON_BY_ID.get(id);
      return p ? '<img src="' + escapeHtml(pokedexDetailArtwork(p, false)) + '" alt="" loading="lazy" draggable="false">' : '';
    }).join('') + '</span>');
  }
}
function dexDecorateFilters(body) {
  var page = body.querySelector('.alb-page');
  if (!page) return;
  var slots = Array.prototype.slice.call(page.querySelectorAll('.alb-slot'));
  var counts = {
    all: slots.length,
    caught: slots.filter(function (s) { return s.classList.contains('is-caught'); }).length,
    seen: slots.filter(function (s) { return !s.classList.contains('is-miss'); }).length,
    miss: slots.filter(function (s) { return s.classList.contains('is-miss'); }).length,
    shiny: slots.filter(function (s) { return s.classList.contains('is-shiny'); }).length
  };
  var icons = { caught: dexItem('poke-ball'), seen: dexItem('poke-radar'), miss: dexUnown(), shiny: dexItem('shiny-charm') };
  body.querySelectorAll('.dex-filter').forEach(function (b) {
    var f = b.dataset.f;
    if (!b.querySelector('.dex-count')) {
      if (icons[f]) b.insertAdjacentHTML('afterbegin', icons[f]);
      b.insertAdjacentHTML('beforeend', ' <em class="dex-count">' + (counts[f] == null ? '' : counts[f]) + '</em>');
    }
  });
}
function dexDecorateSlots(body) {
  body.querySelectorAll('.alb-slot').forEach(function (slot) {
    if (slot.classList.contains('dex-v2')) return;
    slot.classList.add('dex-v2');
    var id = dexSlotId(slot), p = id && typeof POKEMON_BY_ID !== 'undefined' ? POKEMON_BY_ID.get(id) : null;
    var eye = slot.querySelector('.alb-origin.is-seen');
    if (eye) eye.innerHTML = dexItem('poke-radar');
    if (p && !slot.classList.contains('is-miss') && typeof pokemonTypeColor === 'function') {
      slot.style.setProperty('--dex-t', pokemonTypeColor(p.type1));
      slot.insertAdjacentHTML('beforeend', '<span class="dex-dots" aria-hidden="true">' + [p.type1, p.type2].filter(Boolean).map(function (t) { return '<i style="background:' + pokemonTypeColor(t) + '"></i>'; }).join('') + '</span>');
    }
    if (slot.classList.contains('is-miss') && !slot.classList.contains('is-secret')) {
      var zone = dexZoneOf(id);
      if (zone) {
        slot.insertAdjacentHTML('beforeend', '<small class="dex-where" title="Il vit dans cette zone des hautes herbes">' + escapeHtml(zone.name) + '</small>');
        slot.classList.add('has-zone');
      }
    }
  });
}
function dexV2Decorate() {
  var overlay = document.getElementById('overlay-modal');
  if (!overlay || !overlay.classList.contains('is-dex')) return;
  var body = document.querySelector('#overlay-body .alb');
  if (!body) return;
  overlay.classList.add('dex-v2-on');
  dexDecorateHeader(overlay);
  dexDecorateTabs(body);
  dexDecorateChips(body);
  dexDecorateHead(body);
  dexDecorateFilters(body);
  dexDecorateSlots(body);
}
if (typeof albumRender === 'function') {
  var albumRenderBeforeDexV2 = albumRender;
  albumRender = function () {
    var out = albumRenderBeforeDexV2.apply(this, arguments);
    dexV2Decorate();
    return out;
  };
}
if (typeof closeOverlayModal === 'function') {
  var closeOverlayModalBeforeDexV2 = closeOverlayModal;
  closeOverlayModal = function () {
    var o = document.getElementById('overlay-modal');
    if (o) o.classList.remove('dex-v2-on');
    var leds = document.querySelector('#overlay-title .dex-leds');
    if (leds) leds.remove();
    return closeOverlayModalBeforeDexV2.apply(this, arguments);
  };
}
window.dexV2Decorate = dexV2Decorate;
