// 🌐 Traduction, lot 0 : le vrai sélecteur de langue (maquette validée le 13/11, « go », avec les drapeaux).
// La pastille de l'en-tête (hv4Lang, d'abord décorative) ouvre un menu Français / English / Español :
// sous la pastille sur PC, en panneau du bas sur téléphone. Une ligne « Langue » arrive en tête des Paramètres.
// En anglais ou en espagnol, un bandeau dit que la traduction est en cours (✕ le ferme pour la visite).
// Changer de langue ne recharge pas la page : une partie en cours n'est pas perdue.
// Les drapeaux sont dessinés en SVG : les drapeaux emoji ne s'affichent pas sur Windows.
var LANG_FLAGS = {
  fr: '<svg class="lang-flag" viewBox="0 0 3 2" aria-hidden="true"><rect width="1" height="2" fill="#0055A4"/><rect x="1" width="1" height="2" fill="#fff"/><rect x="2" width="1" height="2" fill="#EF4135"/></svg>',
  en: '<svg class="lang-flag" viewBox="0 0 60 30" preserveAspectRatio="none" aria-hidden="true"><rect width="60" height="30" fill="#012169"/><path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" stroke-width="6"/><path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" stroke-width="2"/><path d="M30,0 v30 M0,15 h60" stroke="#fff" stroke-width="10"/><path d="M30,0 v30 M0,15 h60" stroke="#C8102E" stroke-width="6"/></svg>',
  es: '<svg class="lang-flag" viewBox="0 0 3 2" aria-hidden="true"><rect width="3" height="2" fill="#AA151B"/><rect y=".5" width="3" height="1" fill="#F1BF00"/></svg>'
};
// Le nom de chaque langue s'écrit dans sa propre langue, quelle que soit la langue choisie.
var LANG_NAMES = { fr: 'Français', en: 'English', es: 'Español' };
var LANG_BETA = { en: true, es: true };
var langUi = { bannerClosed: false };

function langShort(l) { return String(l || 'fr').toUpperCase(); }

function langChipHtml() {
  var l = getLang();
  return LANG_FLAGS[l] + '<span class="lang-code">' + langShort(l) + '</span><span class="lang-caret" aria-hidden="true">▾</span>';
}

// La pastille de l'en-tête devient un bouton.
hv4Lang = function () {
  var actions = document.querySelector('header .header-actions');
  if (!actions) return;
  var b = actions.querySelector('.hv4-lang');
  if (b && b.tagName !== 'BUTTON') { b.remove(); b = null; }
  if (!b) {
    b = document.createElement('button');
    b.type = 'button';
    b.className = 'hv4-lang lang-chip';
    b.setAttribute('data-action', 'toggleLangMenu');
    b.setAttribute('aria-haspopup', 'true');
    b.setAttribute('aria-expanded', 'false');
    actions.insertBefore(b, actions.firstChild);
  }
  langPaintChip(b);
};

function langPaintChip(b) {
  b = b || document.querySelector('header .lang-chip');
  if (!b) return;
  var html = langChipHtml();
  if (b.dataset.html !== html) { b.innerHTML = html; b.dataset.html = html; }
  b.title = t('lang.title') + ' : ' + LANG_NAMES[getLang()];
  b.setAttribute('aria-label', t('lang.title') + ' : ' + LANG_NAMES[getLang()]);
}

function langMenuHtml() {
  var cur = getLang();
  var rows = I18N_LANGS.map(function (l) {
    var on = l === cur;
    return '<button type="button" class="lang-opt' + (on ? ' is-on' : '') + '" role="menuitemradio" aria-checked="' + on + '" lang="' + l + '" data-action="pickLang" data-args=\'["' + l + '"]\'>' +
      LANG_FLAGS[l] + '<span class="lang-opt-name">' + LANG_NAMES[l] + '</span>' +
      (on ? '<span class="lang-opt-tick" aria-hidden="true">✓</span>' : LANG_BETA[l] ? '<span class="lang-opt-beta">' + t('lang.beta') + '</span>' : '') + '</button>';
  }).join('');
  return '<div class="lang-sheet-grip" aria-hidden="true"></div><p class="lang-pop-title">🌐 ' + t('lang.title') + '</p>' + rows +
    '<p class="lang-pop-note">' + t('lang.inProgress') + '</p>';
}

function langMenuOpen() { return Boolean(document.getElementById('lang-pop')); }

function closeLangMenu() {
  var pop = document.getElementById('lang-pop'), veil = document.getElementById('lang-veil');
  if (pop) pop.remove();
  if (veil) veil.remove();
  var chip = document.querySelector('header .lang-chip');
  if (chip) chip.setAttribute('aria-expanded', 'false');
  document.removeEventListener('keydown', langKey, true);
}

function langKey(e) { if (e.key === 'Escape') { closeLangMenu(); var c = document.querySelector('header .lang-chip'); if (c) c.focus(); } }

function toggleLangMenu() {
  if (langMenuOpen()) { closeLangMenu(); return; }
  var chip = document.querySelector('header .lang-chip');
  var veil = document.createElement('div');
  veil.id = 'lang-veil';
  veil.className = 'lang-veil';
  veil.setAttribute('data-action', 'closeLangMenu');
  var pop = document.createElement('div');
  pop.id = 'lang-pop';
  pop.className = 'lang-pop';
  pop.setAttribute('role', 'menu');
  pop.setAttribute('aria-label', t('lang.title'));
  pop.innerHTML = langMenuHtml();
  document.body.appendChild(veil);
  document.body.appendChild(pop);
  // Sur PC, le menu s'ouvre sous la pastille, aligné sur son bord droit.
  if (chip && !window.matchMedia('(max-width:640px)').matches) {
    var r = chip.getBoundingClientRect();
    pop.style.top = Math.round(r.bottom + 8) + 'px';
    pop.style.right = Math.max(8, Math.round(window.innerWidth - r.right)) + 'px';
  }
  if (chip) chip.setAttribute('aria-expanded', 'true');
  document.addEventListener('keydown', langKey, true);
  var first = pop.querySelector('.lang-opt.is-on') || pop.querySelector('.lang-opt');
  if (first) first.focus({ preventScroll: true });
}

function pickLang(l) {
  closeLangMenu();
  if (l === getLang()) return;
  if (!setLang(l)) return;
  i18nSyncHomePath(l);
  langUi.bannerClosed = false;
  langRefresh();
  if (typeof showToast === 'function') showToast('🌐 ' + LANG_NAMES[l] + ' · ' + t('lang.saved'));
}

// Le bandeau « traduction en cours », seulement en anglais ou en espagnol.
function langBanner() {
  var bar = document.getElementById('lang-banner');
  if (getLang() === 'fr' || langUi.bannerClosed) { if (bar) bar.remove(); return; }
  var html = '<span>🌐 ' + t('lang.inProgress') + '</span><button type="button" class="lang-banner-x" data-action="closeLangBanner" aria-label="✕">✕</button>';
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'lang-banner';
    bar.className = 'lang-banner';
    bar.setAttribute('role', 'status');
    var main = document.querySelector('main') || document.body;
    main.insertBefore(bar, main.firstChild);
  }
  if (bar.dataset.html !== html) { bar.innerHTML = html; bar.dataset.html = html; }
}
function closeLangBanner() { langUi.bannerClosed = true; langBanner(); }

// La ligne « Langue » en tête des Paramètres.
function langSettingsRowHtml() {
  var cur = getLang();
  return '<span><b>' + t('lang.title') + '</b></span><span class="lang-seg" role="radiogroup" aria-label="' + t('lang.title') + '">' +
    I18N_LANGS.map(function (l) {
      var on = l === cur;
      return '<button type="button" role="radio" aria-checked="' + on + '" class="' + (on ? 'is-on' : '') + '" lang="' + l + '" title="' + LANG_NAMES[l] + '" data-action="pickLang" data-args=\'["' + l + '"]\'>' +
        LANG_FLAGS[l] + (on ? '<span>' + langShort(l) + '</span>' : '<span class="lang-sr">' + LANG_NAMES[l] + '</span>') + '</button>';
    }).join('') + '</span>';
}
function langSettingsRow() {
  var grid = document.querySelector('#overlay-modal .app-settings-grid');
  if (!grid) return;
  var row = grid.querySelector('.lang-setting-row');
  if (!row) {
    var first = grid.querySelector('.app-settings-section');
    if (!first) return;
    row = document.createElement('div');
    row.className = 'app-setting-item lang-setting-row';
    var h = first.querySelector('h4');
    if (h && h.nextSibling) first.insertBefore(row, h.nextSibling); else first.insertBefore(row, first.firstChild);
  }
  row.innerHTML = langSettingsRowHtml();
}

if (typeof openSettingsModal === 'function') {
  var openSettingsBeforeLang = openSettingsModal;
  openSettingsModal = function () {
    var out = openSettingsBeforeLang.apply(this, arguments);
    try { langSettingsRow(); } catch (_e) { /* paramètres */ }
    return out;
  };
  window.openSettingsModal = openSettingsModal;
}

function langRefresh() {
  try { hv4Lang(); } catch (_e) { /* en-tête */ }
  langBanner();
  langSettingsRow();
}

window.addEventListener('pokdle:lang', function () { langRefresh(); });
window.addEventListener('resize', function () { if (langMenuOpen()) closeLangMenu(); });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', langRefresh); else langRefresh();

window.hv4Lang = hv4Lang;
window.toggleLangMenu = toggleLangMenu;
window.closeLangMenu = closeLangMenu;
window.pickLang = pickLang;
window.closeLangBanner = closeLangBanner;
