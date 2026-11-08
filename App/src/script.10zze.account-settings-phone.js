// 📱 Menu du compte et Paramètres plus courts sur iPhone (9/11/2026, maquette validée : « go »).
// Mon compte : tout sur un écran (4 tuiles « Entre joueurs », 6 tuiles « Ma progression », Invite et Installer en boutons).
// Paramètres : une ligne par réglage, menus déroulants en boutons à toucher, explications raccourcies.
// Les éléments d'origine restent dans la page (QA, PC) : ce fichier ajoute des versions courtes, le CSS choisit selon la largeur.

// ===== Mon compte =====
var AM2_TILES = {
  defis: ['c1', 'Mes défis'], messages: ['c2', 'Messages'], amis: ['c3', 'Mes amis'], echanges: ['c4', 'Échanges'],
  profile: ['c2', 'Profil'], album: ['c5', 'Album'], sac: ['c1', 'Mon sac'], shiny: ['c5', 'Carnet shiny'], past: ['c6', 'Jours passés'], settings: ['c6', 'Paramètres']
};

function am2Dest(button) {
  try { return JSON.parse(button.getAttribute('data-args') || '[]')[0] || ''; } catch (_e) { return ''; }
}

function am2Paint() {
  var menu = document.querySelector('#overlay-modal .account-menu-v3');
  if (!menu || menu.classList.contains('am2')) return;
  menu.classList.add('am2');
  // Pseudo + petite étiquette du fournisseur ; « Niv. 35 · Dresseur » puis l'XP sous la barre.
  var who = menu.querySelector('.account-menu-who');
  var eyebrow = who && who.querySelector('.adventure-eyebrow');
  var name = who && who.querySelector('h4');
  var line = who && who.querySelector('small');
  if (eyebrow && name && !name.querySelector('.am2-via')) {
    var via = String(eyebrow.textContent || '').replace(/^.*AVEC\s+/i, '').trim();
    if (via) name.insertAdjacentHTML('beforeend', ' <small class="am2-via">' + escapeHtml(via.charAt(0) + via.slice(1).toLowerCase()) + '</small>');
  }
  if (line && !who.querySelector('.am2-lvl')) {
    var parts = String(line.textContent || '').split(' · ');
    var level = parts.slice(0, 2).join(' · ');
    var xp = parts.slice(2).join(' · ');
    line.insertAdjacentHTML('afterend', '<small class="am2-lvl">' + escapeHtml(level) + '</small>');
    var bar = who.querySelector('.account-menu-xpbar');
    if (xp && bar) bar.insertAdjacentHTML('afterend', '<small class="am2-xp">' + escapeHtml(xp) + '</small>');
  }
  var stat = menu.querySelector('.account-menu-stats > div:nth-child(2) span');
  if (stat && !stat.querySelector('.am2-long')) stat.innerHTML = '<span class="am2-long">' + stat.innerHTML + '</span><span class="am2-short" aria-hidden="true">Album</span>';
  // Les liens deviennent des tuiles : icône dans un rond de couleur, nom court, pastille rouge gardée.
  menu.querySelectorAll('.account-menu-groups .account-menu-links button').forEach(function (button) {
    var dest = am2Dest(button);
    var tile = AM2_TILES[dest];
    var label = button.querySelector('span');
    if (!label || button.querySelector('.am2-ic')) return;
    if (!tile) { button.classList.add('am2-pill-src'); return; }
    var text = String(label.firstChild && label.firstChild.nodeType === 3 ? label.firstChild.textContent : label.textContent).trim();
    var icon = text.split(/\s+/)[0];
    var badge = label.querySelector('.pc-badge');
    button.classList.add('am2-tile');
    label.classList.add('am2-long');
    button.insertAdjacentHTML('afterbegin', '<span class="am2-ic ' + tile[0] + '" aria-hidden="true">' + escapeHtml(icon) + '</span>');
    button.insertAdjacentHTML('beforeend', '<span class="am2-short" aria-hidden="true">' + escapeHtml(tile[1]) + '</span>' +
      (badge ? '<i class="am2-badge" aria-hidden="true">' + escapeHtml(badge.textContent) + '</i>' : ''));
  });
  // « Invite un ami » rejoint « Installer l'appli » en boutons sous les tuiles (sur téléphone seulement).
  var extra = menu.querySelector('.account-menu-extra');
  var invite = menu.querySelector('.account-menu-groups button.am2-pill-src');
  if (extra && invite && !extra.querySelector('.am2-invite')) {
    var copy = invite.cloneNode(true);
    copy.classList.remove('am2-pill-src');
    copy.classList.add('am2-invite');
    extra.insertBefore(copy, extra.firstChild);
  }
}

if (typeof openAccountMenu === 'function') {
  var openAccountMenuBeforeAm2 = openAccountMenu;
  openAccountMenu = function () {
    var out = openAccountMenuBeforeAm2.apply(this, arguments);
    try { am2Paint(); } catch (_e) {}
    return out;
  };
}

// ===== Paramètres =====
// Explications courtes sur téléphone (la longue reste sur PC).
var AS2_SHORT = {
  seasonalDecorations: 'Halloween, Noël…', theme: '', density: '', textScale: '', soundEffects: '', pokemonCries: '',
  highContrast: '', ballFlick: 'Glisser vers le haut, mêmes chances'
};
var AS2_SEGMENTS = {
  theme: [['light', 'Clair'], ['dark', 'Sombre']],
  textScale: [['small', 'A-'], ['normal', 'A'], ['large', 'A+']],
  density: [['compact', 'Compacte'], ['normal', 'Normale'], ['airy', 'Aérée']]
};
var AS2_ROW_SHORT = {
  'app-settings-feedback': '', 'app-settings-support': ''
};

function as2SegHtml(key, value) {
  return '<span class="as2-seg" role="radiogroup" aria-hidden="true">' + AS2_SEGMENTS[key].map(function (o) {
    return '<button type="button" tabindex="-1" data-as2-key="' + key + '" data-as2-value="' + o[0] + '" class="' + (o[0] === value ? 'is-on' : '') + '">' + escapeHtml(o[1]) + '</button>';
  }).join('') + '</span>';
}

function as2SyncSeg(select) {
  var row = select.closest('.app-setting-item');
  if (!row) return;
  row.querySelectorAll('.as2-seg button').forEach(function (b) { b.classList.toggle('is-on', b.getAttribute('data-as2-value') === select.value); });
}

function as2Short(row, text) {
  var small = row.querySelector(':scope > span > small');
  if (!small || small.classList.contains('as2-long')) return;
  small.classList.add('as2-long');
  if (text) small.insertAdjacentHTML('afterend', '<small class="as2-short">' + escapeHtml(text) + '</small>');
}

function as2Paint() {
  var grid = document.querySelector('#overlay-modal .app-settings-grid');
  if (!grid || grid.classList.contains('as2')) return;
  grid.classList.add('as2');
  grid.querySelectorAll('.app-setting-item').forEach(function (row) {
    var input = row.querySelector('[data-setting]');
    var key = input ? input.getAttribute('data-setting') : '';
    if (key && key in AS2_SHORT) as2Short(row, AS2_SHORT[key]);
    if (key && AS2_SEGMENTS[key] && input.tagName === 'SELECT') {
      row.classList.add('as2-has-seg');
      input.classList.add('as2-select');
      input.insertAdjacentHTML('afterend', as2SegHtml(key, input.value));
      input.addEventListener('change', function () { as2SyncSeg(input); });
    }
    if (row.classList.contains('app-setting-volume')) { row.classList.add('as2-volume'); as2Short(row, ''); }
    if (row.classList.contains('app-setting-anim')) { row.classList.add('as2-anim'); as2Short(row, '⚡ Rapides : 2× plus courtes'); }
    if (row.classList.contains('app-settings-feedback')) as2Short(row, '');
    if (row.classList.contains('app-settings-support')) as2Short(row, '');
    var b = row.querySelector(':scope > span > b');
    if (b && /Pokédle en appli/.test(b.textContent)) as2Short(row, 'Sur iPhone, ça permet les notifs');
    if (b && /Notifications/.test(b.textContent)) as2Short(row, 'Défis et rappel du jour');
  });
  // « Son & accessibilité » : sur téléphone, le contraste, les animations et le lancer passent sous « Jeu et accessibilité ».
  var contrast = grid.querySelector('[data-setting="highContrast"]');
  var row = contrast && contrast.closest('.app-setting-item');
  if (row && !grid.querySelector('.as2-split')) {
    var anim = grid.querySelector('.app-setting-anim');
    var first = anim && anim.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING ? anim : row;
    first.insertAdjacentHTML('beforebegin', '<h4 class="as2-split" aria-hidden="true">Jeu et accessibilité</h4>');
  }
  grid.querySelectorAll('.app-settings-section > h4:not(.as2-split)').forEach(function (h) {
    var t = String(h.textContent || '').trim();
    var short = t === 'Son & accessibilité' ? 'Son' : t === 'Appli & notifications' ? 'Appli et notifications' : t === 'Aide & soutien' ? 'Aide et soutien' : '';
    if (short && !h.querySelector('.as2-long')) h.innerHTML = '<span class="as2-long">' + escapeHtml(t) + '</span><span class="as2-short-h" aria-hidden="true">' + escapeHtml(short) + '</span>';
  });
}

// Un bouton de la version courte règle le vrai menu déroulant (même enregistrement qu'avant).
document.addEventListener('click', function (event) {
  var button = event.target && event.target.closest && event.target.closest('.as2-seg button');
  if (!button) return;
  var row = button.closest('.app-setting-item');
  var select = row && row.querySelector('select[data-setting="' + button.getAttribute('data-as2-key') + '"]');
  if (!select) return;
  select.value = button.getAttribute('data-as2-value');
  select.dispatchEvent(new Event('change', { bubbles: true }));
  as2SyncSeg(select);
});

if (typeof openSettingsModal === 'function') {
  var openSettingsModalBeforeAs2 = openSettingsModal;
  openSettingsModal = function () {
    var out = openSettingsModalBeforeAs2.apply(this, arguments);
    try { as2Paint(); } catch (_e) {}
    return out;
  };
}
