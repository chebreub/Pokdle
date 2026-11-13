// 🌐 Traduction, lot 1a (13/11/2026) : l'en-tête, les menus, l'accueil et le bas de page en anglais et en espagnol.
// L'accueil est écrit par une quinzaine de morceaux de script ; plutôt que de toucher chacun, on traduit ce qui est
// affiché : chaque texte (et aria-label, title, placeholder) des zones ci-dessous est cherché dans i18n/ui.json
// (français normalisé → anglais / espagnol). Normalisation : un nombre devient « # », un nom de Pokémon « %P »,
// un jour « %W », un mois « %M » ; ils sont remis à leur place, traduits (pokemonName, jours et mois).
// En français il ne se passe rien : le site reste exactement le même (la QA cherche des textes français).
// Un texte sans traduction reste en français (bandeau « traduction en cours »). Les textes d'origine sont gardés :
// revenir au français les remet tels quels, sans recharger.
// Lot 1b : le Pokémon du jour et les jeux de devinette (#screen-game), Higher or Lower, l'Intrus, Poké-Connections et « Tous les jeux ».
var I18N_DOM_ROOTS = ['header', '#news-ticker', '#mobile-tabbar', '#screen-config', '.site-footer', '#screen-game', '#screen-higher-lower', '#screen-odd-one-out', '#screen-poke-connections', '#screen-all-modes', '#overlay-modal'];
var I18N_DOM_ATTRS = ['aria-label', 'title', 'placeholder'];
var I18N_WEEKDAYS = {
  fr: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  es: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
};
var I18N_MONTHS = {
  fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
};
var i18nDom = { orig: new WeakMap(), done: new WeakMap(), touched: new Set(), names: null, observer: null, queued: false, cache: {} };

// Les noms français des Pokémon (sans les formes), du plus long au plus court, pour les reconnaître dans un texte.
function i18nNameIndex() {
  if (i18nDom.names) return i18nDom.names;
  var list = typeof POKEMON_LIST !== 'undefined' ? POKEMON_LIST : [];
  var byName = {}, words = [];
  list.forEach(function (p) {
    if (!p || p.isAltForm || !(p.id >= 1 && p.id <= 1025) || byName[p.name]) return;
    byName[p.name] = p; words.push(p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  });
  words.sort(function (a, b) { return b.length - a.length; });
  var re = null;
  try { re = words.length ? new RegExp('(^|[^\\p{L}])(' + words.join('|') + ')(?![\\p{L}])', 'gu') : null; } catch (_e) { re = null; }
  i18nDom.names = { byName: byName, re: re };
  return i18nDom.names;
}

// Français → { key, nums, pokes, days, months } ; null si rien à chercher.
// Les valeurs des indices (types, couleurs, habitats) : cherchées seulement si le texte entier n'a pas été trouvé,
// pour ne jamais casser une phrase où « Rare » ou « Normal » est un mot ordinaire.
var I18N_VALUES = {
  fr: ['Acier', 'Combat', 'Dragon', 'Eau', 'Feu', 'Fée', 'Glace', 'Insecte', 'Normal', 'Plante', 'Poison', 'Psy', 'Roche', 'Sol', 'Spectre', 'Ténèbres', 'Vol', 'Électrik',
    'Blanc', 'Bleu', 'Brun', 'Gris', 'Jaune', 'Noir', 'Rose', 'Rouge', 'Vert', 'Violet', 'Eau douce', 'Forêt', 'Grotte', 'Mer', 'Montagne', 'Prairie', 'Rare', 'Sentier accidenté', 'Urbain'],
  en: ['Steel', 'Fighting', 'Dragon', 'Water', 'Fire', 'Fairy', 'Ice', 'Bug', 'Normal', 'Grass', 'Poison', 'Psychic', 'Rock', 'Ground', 'Ghost', 'Dark', 'Flying', 'Electric',
    'White', 'Blue', 'Brown', 'Gray', 'Yellow', 'Black', 'Pink', 'Red', 'Green', 'Purple', 'Fresh water', 'Forest', 'Cave', 'Sea', 'Mountain', 'Grassland', 'Rare', 'Rough terrain', 'Urban'],
  es: ['Acero', 'Lucha', 'Dragón', 'Agua', 'Fuego', 'Hada', 'Hielo', 'Bicho', 'Normal', 'Planta', 'Veneno', 'Psíquico', 'Roca', 'Tierra', 'Fantasma', 'Siniestro', 'Volador', 'Eléctrico',
    'Blanco', 'Azul', 'Marrón', 'Gris', 'Amarillo', 'Negro', 'Rosa', 'Rojo', 'Verde', 'Morado', 'Agua dulce', 'Bosque', 'Cueva', 'Mar', 'Montaña', 'Pradera', 'Raro', 'Terreno agreste', 'Urbano']
};
var I18N_VALUES_RE = new RegExp('(^|[^\\p{L}])(' + I18N_VALUES.fr.slice().sort(function (a, b) { return b.length - a.length; }).join('|') + ')(?![\\p{L}])', 'gu');

function i18nNormalize(text, withValues) {
  var idx = i18nNameIndex(), pokes = [], days = [], months = [], nums = [], vals = [];
  var s = text.replace(/#/g, '＃'); // un « # » écrit dans le texte (« Jour #236 ») n'est pas un nombre
  if (idx.re) s = s.replace(idx.re, function (all, pre, name) { pokes.push(idx.byName[name]); return pre + '%P'; });
  s = s.replace(/(^|[^\p{L}])(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)(?![\p{L}])/giu, function (all, pre, d) { days.push(I18N_WEEKDAYS.fr.indexOf(d.toLowerCase())); return pre + '%W'; });
  s = s.replace(/(^|[^\p{L}])(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)(?![\p{L}])/giu, function (all, pre, m) { months.push(I18N_MONTHS.fr.indexOf(m.toLowerCase())); return pre + '%M'; });
  if (withValues) s = s.replace(I18N_VALUES_RE, function (all, pre, v) { vals.push(I18N_VALUES.fr.indexOf(v)); return pre + '%V'; });
  s = s.replace(/\d[\d\s.,]*/g, function (n) { nums.push(n); return '#'; });
  return { key: s, nums: nums, pokes: pokes, days: days, months: months, vals: vals };
}

// Chaque texte n'est cherché qu'une fois par langue (l'accueil bouge souvent : scènes animées, comptes à rebours).
function i18nTranslateText(text, lang) {
  var cache = i18nDom.cache[lang] || (i18nDom.cache[lang] = new Map());
  if (cache.has(text)) return cache.get(text);
  var out = i18nTranslateRaw(text, lang);
  if (cache.size > 5000) cache.clear();
  cache.set(text, out);
  return out;
}
function i18nTranslateRaw(text, lang) {
  var dict = typeof I18N_DATA !== 'undefined' && I18N_DATA.ui ? I18N_DATA.ui[lang] : null;
  if (!dict) return null;
  var core = text.replace(/\s+/g, ' ').trim();
  if (!core) return null;
  var n = i18nNormalize(core);
  var out = Object.prototype.hasOwnProperty.call(dict, n.key) ? dict[n.key] : null;
  if (out === null) { var nv = i18nNormalize(core, true); if (nv.vals.length && Object.prototype.hasOwnProperty.call(dict, nv.key)) { n = nv; out = dict[nv.key]; } }
  if (out === null) {
    // Motifs avec une partie libre, comme un pseudo (« L’Œuf mystère a éclos : Marco l’a trouvé »).
    var pats = I18N_DATA.ui.patterns || [], col = lang === 'en' ? 1 : 2;
    for (var k = 0; k < pats.length; k++) { var re = new RegExp(pats[k][0]); if (re.test(core)) return text.replace(core, core.replace(re, pats[k][col])); }
    if (n.pokes.length && n.key.replace(/%P/g, '').trim().length <= 2) out = n.key; // un nom seul (avec « ! »)
    else return null;
  }
  var i = 0, p = 0, d = 0, m = 0, v = 0;
  // « # » prend le nombre suivant ; « {2} » prend le 2e nombre du texte (quand une langue en saute un).
  out = out.replace(/\{(\d)\}|#|%P|%W|%M|%V/g, function (tok, at) {
    if (at) return n.nums[Number(at) - 1] || '';
    if (tok === '%V') return I18N_VALUES[lang][n.vals[v++]] || '';
    if (tok === '#') return n.nums[i++] || '';
    if (tok === '%P') { var poke = n.pokes[p++]; return poke ? (typeof pokemonName === 'function' ? pokemonName(poke, lang) : poke.name) : ''; }
    if (tok === '%W') return I18N_WEEKDAYS[lang][n.days[d++]] || '';
    return I18N_MONTHS[lang][n.months[m++]] || '';
  });
  var lead = text.match(/^\s*/)[0], trail = text.match(/\s*$/)[0];
  // Pas d'espace avant « : ! ? ; » en anglais et en espagnol (il vient du nombre français « 1 : »).
  return lead + out.replace(/＃/g, '#').replace(/[ \u00a0\u202f]+([:!?;])/g, '$1').trim() + trail;
}

function i18nDomNode(node, lang) {
  if (node.nodeType === 3) {
    var cur = node.nodeValue;
    if (!cur || !/\p{L}/u.test(cur)) return;
    // Un texte changé par le site depuis notre passage devient le nouveau texte d'origine.
    if (i18nDom.done.get(node) !== cur) i18nDom.orig.set(node, cur);
    var orig = i18nDom.orig.get(node);
    var tr = lang === 'fr' ? orig : i18nTranslateText(orig, lang);
    if (tr == null) tr = orig;
    if (tr !== cur) node.nodeValue = tr;
    i18nDom.done.set(node, tr);
    if (lang !== 'fr') i18nDom.touched.add(node);
    return;
  }
  if (node.nodeType !== 1) return;
  if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE' || node.closest('[data-i18n-skip]')) return;
  I18N_DOM_ATTRS.forEach(function (a) {
    if (!node.hasAttribute(a)) return;
    var cur = node.getAttribute(a), store = node.__i18nAttr || (node.__i18nAttr = {});
    var st = store[a] || (store[a] = {});
    if (st.done !== cur) st.orig = cur;
    var tr = lang === 'fr' ? st.orig : i18nTranslateText(st.orig, lang);
    if (tr == null) tr = st.orig;
    if (tr !== cur) node.setAttribute(a, tr);
    st.done = tr;
    if (lang !== 'fr') i18nDom.touched.add(node);
  });
  for (var c = node.firstChild; c; c = c.nextSibling) i18nDomNode(c, lang);
}

function i18nDomApply() {
  i18nDom.queued = false;
  var lang = typeof getLang === 'function' ? getLang() : 'fr';
  if (lang === 'fr') {
    // Retour au français : on remet les textes d'origine, puis on ne touche plus à rien.
    i18nDom.touched.forEach(function (node) { if (node.isConnected) i18nDomNode(node, 'fr'); });
    i18nDom.touched.clear();
    return;
  }
  I18N_DOM_ROOTS.forEach(function (sel) { document.querySelectorAll(sel).forEach(function (root) { i18nDomNode(root, lang); }); });
}
function i18nDomQueue() {
  if (i18nDom.queued) return;
  i18nDom.queued = true;
  (window.requestAnimationFrame || setTimeout)(i18nDomApply);
}

function i18nDomWatch() {
  var lang = typeof getLang === 'function' ? getLang() : 'fr';
  if (lang === 'fr') { if (i18nDom.observer) { i18nDom.observer.disconnect(); i18nDom.observer = null; } return; }
  if (i18nDom.observer || typeof MutationObserver !== 'function') return;
  i18nDom.observer = new MutationObserver(function (list) {
    for (var k = 0; k < list.length; k++) {
      var r = list[k];
      // Nos propres changements ne relancent rien.
      if (r.type === 'characterData' && i18nDom.done.get(r.target) === r.target.nodeValue) continue;
      if (r.type === 'attributes' && r.target.__i18nAttr && r.target.__i18nAttr[r.attributeName] && r.target.__i18nAttr[r.attributeName].done === r.target.getAttribute(r.attributeName)) continue;
      i18nDomQueue(); return;
    }
  });
  i18nDom.observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: I18N_DOM_ATTRS });
}

function i18nDomRefresh() { i18nDomWatch(); i18nDomApply(); }

window.addEventListener('pokdle:lang', function () {
  // Les suggestions déjà calculées ne tenaient pas compte des noms de l'autre langue.
  try { if (typeof guessCache !== 'undefined') guessCache.clear(); } catch (_e) { /* jeux */ }
  i18nDomRefresh();
});
(function i18nDomBoot() {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', i18nDomRefresh); else i18nDomRefresh();
})();
