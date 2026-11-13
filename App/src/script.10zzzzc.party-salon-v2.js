// 🎉 Salon de la Party Room v2 (11/11/2026, maquette validée par Kayan : « go salon »).
// Kayan : « faut améliorer l'écran des modes dans le salon ». Comme la maquette :
// - les jeux en tuiles colorées avec leur Pokémon (mêmes images et couleurs que le lobby), « Jeu surprise » en tête ;
// - des filtres Tous · Rapidité · Déduction · Dessin et mots · Stats ;
// - le jeu choisi en grand avec son image, son nom et sa règle (le texte d'origine de #party-mode-hint) ;
// - « Lancer la partie » collé en bas (barre sombre), au-dessus de la barre d'onglets sur téléphone.
// Rien n'est créé ni retiré : les boutons d'origine (#party-mode-*), leurs actions (partySetMode) et la QA restent les mêmes.

var PSV_GAMES = {
  dexrace: ['#4069E0', 'img/home/479.webp', 'Course', 'speed', 'Course au Pokédex'],
  coop: ['#D9A21B', 'img/art/65.webp', 'Coopération', 'deduction', 'Enquête coop'],
  deduction: ['#E06AA0', 'img/art/151.webp', 'Déduction', 'deduction', 'Pokémon mystère'],
  quiestce1v1: ['#7C5BD6', 'img/home/132.webp', 'À deux', 'deduction', 'Qui est-ce ?'],
  dessin: ['#F08A4B', 'img/home/235.webp', '2 à 8', 'words', 'Dessine-le !'],
  lastletter: ['#C2477E', 'img/art/25.webp', '2 à 8', 'words', 'Dernière lettre'],
  petitbac: ['#3FA06A', 'img/home/201.webp', '2 à 8', 'words', 'Petit Bac'],
  nearest: ['#2E9FD8', 'img/art/137.webp', 'Flair', 'speed', 'Numéro mystère'],
  guess: ['#E07B32', 'img/art/149.webp', 'Rapidité', 'speed', 'Course Pokémon'],
  typecombo: ['#8C7A55', 'img/art/493.webp', 'Réflexes', 'speed', 'Combo de types'],
  duocriteria: ['#3B8FD1', 'img/art/233.webp', 'Déduction', 'deduction', 'Duo de critères'],
  statclash: ['#5E7F9E', 'img/art/106.webp', 'Instinct', 'stats', 'Meilleure stat'],
  statclashparty: ['#B0563A', 'img/art/107.webp', 'Stratégie', 'stats', 'Stat Clash Party']
};
var PSV_CATS = [['all', 'Tous'], ['speed', 'Rapidité'], ['deduction', 'Déduction'], ['words', 'Dessin et mots'], ['stats', 'Stats']];
var psv = { cat: 'all' };

function psvKey(btn) { return String(btn.id || '').replace(/^party-mode-/, ''); }

function psvSetCat(cat) {
  psv.cat = PSV_CATS.some(function (c) { return c[0] === cat; }) ? cat : 'all';
  psvPaint();
}

function psvPaint() {
  var select = document.getElementById('party-mode-select');
  var setup = document.getElementById('party-setup');
  if (!select || !setup) return;
  if (!setup.classList.contains('psv')) setup.classList.add('psv');
  var dock = document.getElementById('party-action-dock');
  if (dock && !dock.classList.contains('psv-dock')) dock.classList.add('psv-dock');
  // Filtres (une seule fois), juste au-dessus des tuiles.
  var chips = document.getElementById('psv-chips');
  if (!chips) {
    chips = document.createElement('div');
    chips.id = 'psv-chips';
    chips.className = 'psv-chips';
    chips.setAttribute('role', 'group');
    chips.setAttribute('aria-label', 'Filtrer les jeux');
    select.parentNode.insertBefore(chips, select);
  }
  var tiles = Array.prototype.slice.call(select.querySelectorAll('.party-mode-tile'));
  var count = tiles.filter(function (b) { return b.id !== 'party-mode-surprise'; }).length;
  var chipsHtml = PSV_CATS.map(function (c) {
    var n = c[0] === 'all' ? ' (' + count + ')' : '';
    return '<button type="button" data-action="psvSetCat" data-args=\'["' + c[0] + '"]\' aria-pressed="' + (psv.cat === c[0]) + '">' + c[1] + n + '</button>';
  }).join('');
  // Réécrit seulement si quelque chose a changé (sinon les boutons sont remplacés à chaque rendu du salon).
  if (chips.dataset.html !== chipsHtml) { chips.innerHTML = chipsHtml; chips.dataset.html = chipsHtml; }
  if (chips.classList.contains('hidden') !== select.classList.contains('hidden')) chips.classList.toggle('hidden', select.classList.contains('hidden'));
  var active = null;
  tiles.forEach(function (b) {
    var key = psvKey(b), def = PSV_GAMES[key];
    if (!b.classList.contains('psv-tile')) b.classList.add('psv-tile');
    if (key === 'surprise') {
      b.classList.add('psv-rand');
      if (!b.querySelector('.psv-dice')) b.insertAdjacentHTML('beforeend', '<span class="psv-dice" aria-hidden="true">🎲</span>');
    } else if (def) {
      if (b.style.getPropertyValue('--c') !== def[0]) b.style.setProperty('--c', def[0]);
      if (!b.querySelector('.psv-art')) b.insertAdjacentHTML('beforeend', '<img class="psv-art" src="' + def[1] + '" alt="" aria-hidden="true" width="96" height="96" decoding="async">');
      var tag = b.querySelector('.pmt-tag');
      if (tag && !tag.dataset.psv) { tag.dataset.psv = '1'; tag.dataset.orig = tag.textContent; }
    }
    var cat = def ? def[3] : 'all';
    var off = psv.cat !== 'all' && cat !== psv.cat && key !== 'surprise' && !b.classList.contains('is-active');
    if (b.classList.contains('psv-off') !== off) b.classList.toggle('psv-off', off);
    if (b.classList.contains('is-active') || b.getAttribute('aria-pressed') === 'true') active = key;
  });
  psvPick(active);
}

// Le jeu choisi en grand : image, nom, tag, et la règle d'origine (#party-mode-hint, déplacée dedans).
function psvPick(key) {
  var hint = document.getElementById('party-mode-hint');
  if (!hint) return;
  var pick = document.getElementById('psv-pick');
  if (!pick) {
    pick = document.createElement('div');
    pick.id = 'psv-pick';
    pick.className = 'psv-pick';
    pick.innerHTML = '<img class="psv-pick-art" alt="" aria-hidden="true" width="84" height="84"><div class="psv-pick-text"><span class="psv-pick-k"></span><h4 class="psv-pick-name"></h4></div>';
    hint.parentNode.insertBefore(pick, hint);
    pick.querySelector('.psv-pick-text').appendChild(hint);
  }
  var def = PSV_GAMES[key];
  pick.classList.toggle('psv-none', !def);
  pick.classList.toggle('hidden', hint.classList.contains('hidden'));
  if (!def) return;
  pick.style.setProperty('--c', def[0]);
  var img = pick.querySelector('.psv-pick-art');
  if (img.getAttribute('src') !== def[1]) img.setAttribute('src', def[1]);
  pick.querySelector('.psv-pick-k').textContent = def[2];
  pick.querySelector('.psv-pick-name').textContent = def[4];
}

if (typeof renderPartyRoom === 'function') {
  var psvRenderBefore = renderPartyRoom;
  renderPartyRoom = function () {
    var r = psvRenderBefore.apply(this, arguments);
    try { psvPaint(); } catch (_e) {}
    return r;
  };
}
// La tuile « Jeu surprise » est ajoutée par script.10xzzx : on repasse quand la liste change.
document.addEventListener('DOMContentLoaded', function () {
  var select = document.getElementById('party-mode-select');
  if (!select || !('MutationObserver' in window)) return;
  var t = 0;
  new MutationObserver(function () { clearTimeout(t); t = setTimeout(function () { try { psvPaint(); } catch (_e) {} }, 30); })
    .observe(select, { childList: true, attributes: true, subtree: true, attributeFilter: ['class', 'aria-pressed'] });
});
window.psvSetCat = psvSetCat;
