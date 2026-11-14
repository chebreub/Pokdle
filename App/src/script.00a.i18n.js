// 🌐 Traduction, lot 0 (13/11/2026, plan dans docs/i18n/AUDIT_I18N_2026-11-13.md).
// Fondations seulement : rien ne change en français. Les textes de chaque langue viennent de i18n/fr.json,
// en.json et es.json, collés en tête du script par build.mjs (I18N_DATA), avec les noms officiels des Pokémon.
//   t('cle')                      → le texte dans la langue du joueur, sinon en français, sinon la clé
//   t('cle', { n: 3, nom: 'X' })  → remplace {n} et {nom}
//   t('cle', { count: 2 })        → une entrée { "one": "…", "other": "…" } choisit la forme au pluriel
//   pokemonName(p)                → le nom du Pokémon dans la langue du joueur (le français reste le nom de référence)
// La langue : ?lang=en|es|fr (gardée), sinon le choix enregistré, sinon le français. La langue du téléphone ne sera
// prise en compte qu'au lot 1, quand l'essentiel sera traduit (sinon un anglophone verrait le même site en français).
var I18N_LANGS = ['fr', 'en', 'es'];
var I18N_KEY = 'pokdle.lang';
var I18N_LOCALES = { fr: 'fr-FR', en: 'en-GB', es: 'es-ES' };
var I18N_AUTO_DETECT = false;
var i18nLang = 'fr';

// La langue portée par l'adresse de l'accueil : « /en » → 'en', « /es » → 'es', sinon rien.
function i18nPathLang() {
  try {
    var m = /^\/(en|es)\/?$/.exec(location.pathname || '');
    return m ? m[1] : null;
  } catch (_e) { return null; }
}
// Le chemin de l'accueil pour un lien à partager : toujours « / », pour que l'ami garde sa propre langue.
function i18nSharePath() {
  try { return i18nPathLang() ? '/' : (location.pathname || '/'); } catch (_e) { return '/'; }
}
// Sur un accueil (/, /en, /es), l'adresse suit la langue choisie dans 🌐 (sinon recharger /en remettrait l'anglais).
function i18nSyncHomePath(lang) {
  try {
    var path = location.pathname;
    if (path !== '/' && path !== '/index.html' && !i18nPathLang()) return;
    var want = lang === 'fr' ? '/' : '/' + lang;
    if (path !== want) history.replaceState(history.state, '', want + location.search + location.hash);
  } catch (_e) { /* pas d'historique */ }
}

function i18nDetect() {
  var pick = null;
  try {
    var q = new URLSearchParams(location.search).get('lang');
    if (q && I18N_LANGS.indexOf(q) >= 0) { pick = q; localStorage.setItem(I18N_KEY, q); }
  } catch (_e) { /* pas d'adresse ou mode privé */ }
  // 🌐 Les accueils /en et /es (14/11) : l'adresse dit la langue, comme ?lang=.
  if (!pick) {
    var fromPath = i18nPathLang();
    if (fromPath) { pick = fromPath; try { localStorage.setItem(I18N_KEY, fromPath); } catch (_e) { /* mode privé */ } }
  }
  if (!pick) { try { var saved = localStorage.getItem(I18N_KEY); if (I18N_LANGS.indexOf(saved) >= 0) pick = saved; } catch (_e) { /* mode privé */ } }
  if (!pick && I18N_AUTO_DETECT && typeof navigator !== 'undefined') {
    var nav = String((navigator.languages && navigator.languages[0]) || navigator.language || '').slice(0, 2).toLowerCase();
    if (I18N_LANGS.indexOf(nav) >= 0) pick = nav;
  }
  return pick || 'fr';
}

function getLang() { return i18nLang; }
function getLocale() { return I18N_LOCALES[i18nLang] || 'fr-FR'; }

function setLang(lang) {
  if (I18N_LANGS.indexOf(lang) < 0) return false;
  i18nLang = lang;
  try { localStorage.setItem(I18N_KEY, lang); } catch (_e) { /* mode privé */ }
  if (typeof document !== 'undefined' && document.documentElement) document.documentElement.lang = lang;
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
    window.dispatchEvent(new CustomEvent('pokdle:lang', { detail: { lang: lang } }));
  }
  return true;
}

function i18nLookup(lang, key) {
  var texts = typeof I18N_DATA !== 'undefined' && I18N_DATA && I18N_DATA.texts ? I18N_DATA.texts[lang] : null;
  return texts && Object.prototype.hasOwnProperty.call(texts, key) ? texts[key] : undefined;
}

function t(key, vars) {
  var value = i18nLookup(i18nLang, key);
  if (value === undefined) value = i18nLookup('fr', key);
  if (value === undefined) return key;
  if (value && typeof value === 'object') {
    var count = vars && typeof vars.count === 'number' ? vars.count : 1;
    var rule = typeof Intl !== 'undefined' && Intl.PluralRules ? new Intl.PluralRules(getLocale()).select(count) : (count === 1 ? 'one' : 'other');
    value = value[rule] !== undefined ? value[rule] : value.other;
  }
  return String(value).replace(/\{(\w+)\}/g, function (all, name) {
    return vars && Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : all;
  });
}

// Le nom d'un Pokémon dans la langue du joueur. Les données du site gardent le nom français : il reste la référence
// (jeux du jour, comparaisons du serveur). Les formes (Alola, Méga…) gardent leur nom français pour l'instant.
function pokemonName(p, lang) {
  if (!p) return '';
  var l = lang || i18nLang, id = Number(p.id);
  if (l === 'fr' || !(id >= 1 && id <= 1025) || p.isAltForm) return p.name;
  var names = typeof I18N_DATA !== 'undefined' && I18N_DATA && I18N_DATA.names ? I18N_DATA.names : null;
  if (!names) return p.name;
  if (l === 'es' && names.es && names.es[id]) return names.es[id];
  return (names.en && names.en[id]) || p.name;
}

// Nombres et dates au format de la langue (le jour des jeux reste celui de Paris).
function fmtNumber(n) {
  try { return Number(n).toLocaleString(getLocale()); } catch (_e) { return String(n); }
}
function fmtDate(date, options) {
  try { return new Date(date).toLocaleDateString(getLocale(), options || { day: 'numeric', month: 'long' }); } catch (_e) { return ''; }
}

i18nLang = i18nDetect();
