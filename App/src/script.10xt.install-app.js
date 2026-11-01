
// ===== 📲 Installer l'appli + 🔔 notifications au bon moment (01/11/2026) =====
// Kayan was the only player with notifications on: on iPhone they only work once the site is on the
// home screen, and nothing explained how. One window explains it for the device in hand (a real
// « Installer » button where the browser offers one); it is reachable from the account menu, the
// settings, the footer, pokdle.fr/appli and a card on the home after a few days of visits.
// The notifications are also asked for where their use is obvious: right after a challenge.
var installPromptEvent = null;
var installTab = null;
var INSTALL_DAYS_KEY = 'pokedle.visitDays';
var INSTALL_CARD_KEY = 'pokedle.installCard';
var NOTIF_ASK_KEY = 'pokedle.notifAskLater';
var NOTIF_BONUS_XP = 50;

function installStore(key, value) {
  try { if (value === undefined) return localStorage.getItem(key); localStorage.setItem(key, value); } catch (_e) { /* private mode */ }
  return null;
}
function installIsStandalone() {
  try { return navigator.standalone === true || Boolean(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches); }
  catch (_e) { return false; }
}
function installPlatform() {
  var ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'iphone';
  if (/Android/i.test(ua)) return 'android';
  return 'pc';
}

if (typeof window !== 'undefined' && window.addEventListener) {
  // Chrome / Edge / Android: the browser's own install prompt, kept for our button.
  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    installPromptEvent = event;
    renderInstallUi();
  });
  window.addEventListener('appinstalled', function () {
    installPromptEvent = null;
    installStore(INSTALL_CARD_KEY, 'installed');
    if (typeof showToast === 'function') showToast('📲 Pokédle est installé : retrouve-le sur ton écran d’accueil !');
    renderInstallUi();
  });
}

function installStepsHtml(tab) {
  if (tab === 'iphone') {
    return '<ol class="install-steps">' +
      '<li>Ouvre <b>pokdle.fr</b> dans <b>Safari</b>.</li>' +
      '<li>Touche <span class="install-ico" aria-hidden="true">⬆︎</span> <b>Partager</b> (en bas de l’écran, ou en haut sur iPad).</li>' +
      '<li>Choisis <b>Sur l’écran d’accueil</b> (fais défiler la liste si tu ne le vois pas).</li>' +
      '<li>Touche <b>Ajouter</b> : l’icône Pokédle apparaît. Ouvre Pokédle depuis cette icône.</li></ol>';
  }
  var button = installPromptEvent
    ? '<button type="button" class="btn-blue install-now" data-action="installAppNow">📲 Installer Pokédle</button>' +
      '<p class="install-hint">Ou à la main :</p>'
    : '';
  if (tab === 'android') {
    return button + '<ol class="install-steps">' +
      '<li>Ouvre <b>pokdle.fr</b> dans <b>Chrome</b>.</li>' +
      '<li>Touche le menu <span class="install-ico" aria-hidden="true">⋮</span> en haut à droite.</li>' +
      '<li>Choisis <b>Installer l’application</b> (ou <b>Ajouter à l’écran d’accueil</b>).</li></ol>';
  }
  return button + '<ol class="install-steps">' +
    '<li>Dans <b>Chrome</b> ou <b>Edge</b>, clique sur l’icône d’installation <span class="install-ico" aria-hidden="true">⊕</span> à droite de la barre d’adresse.</li>' +
    '<li>Clique sur <b>Installer</b> : Pokédle s’ouvre dans sa propre fenêtre.</li>' +
    '<li>Sur Mac avec Safari : menu <b>Fichier</b> → <b>Ajouter au Dock</b>.</li></ol>';
}

function installWindowHtml(reason) {
  if (installIsStandalone()) {
    return '<div class="install-sheet"><p class="install-done">✅ Pokédle est déjà installé sur cet appareil.</p>' +
      (notifCanAsk() ? notifAskHtml('', 'install') : '') + '</div>';
  }
  var tab = installTab || installPlatform();
  var tabs = [['iphone', 'iPhone'], ['android', 'Android'], ['pc', 'PC']];
  return '<div class="install-sheet">' +
    (reason === 'notif' ? '<p class="install-lead"><b>Sur iPhone, les notifications marchent seulement depuis l’icône Pokédle de ton écran d’accueil.</b> Ajoute-la, ouvre Pokédle depuis l’icône, puis active 🔔.</p>' : '') +
    '<div class="install-why"><span>📌 Une icône sur ton écran</span><span>⛶ En plein écran</span><span>🔔 Les notifs, même sur iPhone</span></div>' +
    '<div class="install-tabs" role="tablist">' + tabs.map(function (t) {
      return '<button type="button" role="tab" aria-selected="' + (t[0] === tab) + '" class="' + (t[0] === tab ? 'is-on' : '') + '" data-action="pickInstallTab" data-args=\'["' + t[0] + '"]\'>' + t[1] + '</button>';
    }).join('') + '</div>' +
    '<div class="install-body">' + installStepsHtml(tab) + '</div>' +
    '<p class="install-note">Gratuit, rien à télécharger depuis un store : c’est le site, avec sa propre icône.</p></div>';
}

function openInstallApp(reason) {
  installTab = null;
  ensureOverlay('📲 Pokédle en appli', installWindowHtml(reason));
  var overlay = document.getElementById('overlay-modal');
  if (overlay) overlay.dataset.kind = 'install';
  if (installStore(INSTALL_CARD_KEY) !== 'installed') installStore(INSTALL_CARD_KEY, 'seen');
  renderInstallHomeCard();
}
function pickInstallTab(tab) {
  installTab = tab;
  var sheet = document.querySelector('#overlay-body .install-sheet');
  if (!sheet) return;
  sheet.querySelectorAll('.install-tabs button').forEach(function (b) {
    var on = b.getAttribute('data-args') === '["' + tab + '"]';
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-selected', String(on));
  });
  var body = sheet.querySelector('.install-body');
  if (body) body.innerHTML = installStepsHtml(tab);
}
function installAppNow() {
  var event = installPromptEvent;
  if (!event) { pickInstallTab(installTab || installPlatform()); return; }
  installPromptEvent = null;
  try {
    event.prompt();
    Promise.resolve(event.userChoice).then(function (choice) {
      if (choice && choice.outcome === 'accepted') closeOverlayModal();
      else pickInstallTab(installTab || installPlatform());
    }).catch(function () {});
  } catch (_e) { pickInstallTab(installTab || installPlatform()); }
}

// The home card: from the third day with a visit, once, until opened or closed. Never in the app.
function installVisitDays() {
  var today = typeof getDailyDateKey === 'function' ? getDailyDateKey() : new Date().toISOString().slice(0, 10);
  var days = [];
  try { days = JSON.parse(installStore(INSTALL_DAYS_KEY) || '[]'); } catch (_e) { days = []; }
  if (!Array.isArray(days)) days = [];
  if (days.indexOf(today) < 0) { days.push(today); days = days.slice(-10); installStore(INSTALL_DAYS_KEY, JSON.stringify(days)); }
  return days.length;
}
function installCardWanted() {
  if (installIsStandalone() || installStore(INSTALL_CARD_KEY)) return false;
  // On a PC browser with no install prompt (Firefox…), the card would only explain a dead end.
  if (installPlatform() === 'pc' && !installPromptEvent) return false;
  return installVisitDays() >= 3;
}
function renderInstallHomeCard() {
  var home = document.getElementById('screen-config');
  var card = document.getElementById('home-install');
  if (!home || !installCardWanted()) { if (card) card.remove(); return; }
  if (card) return;
  card = document.createElement('section');
  card.id = 'home-install';
  card.className = 'home-install';
  card.innerHTML = '<span class="home-install-ico" aria-hidden="true">📲</span>' +
    '<span class="home-install-text"><b>Joue plus vite : installe Pokédle</b><small>' + (installPlatform() === 'iphone' ? 'Une icône sur ton écran + les notifs sur iPhone.' : 'Une icône sur ton écran, en plein écran.') + '</small></span>' +
    '<button type="button" class="btn-blue" data-action="openInstallApp">Voir</button>' +
    '<button type="button" class="home-install-close" data-action="closeInstallHomeCard" aria-label="Ne plus afficher">✕</button>';
  var inbox = document.getElementById('home-inbox');
  if (inbox && inbox.parentNode === home) inbox.after(card);
  else home.insertBefore(card, home.firstChild);
}
function closeInstallHomeCard() {
  installStore(INSTALL_CARD_KEY, 'closed');
  var card = document.getElementById('home-install');
  if (card) card.remove();
}

// Footer: one more line, next to « Donne ton avis ».
function renderInstallFooter() {
  var footer = document.querySelector('.site-footer');
  if (!footer || footer.querySelector('.site-footer-install')) return;
  var line = document.createElement('p');
  line.className = 'site-footer-install';
  line.innerHTML = '<button type="button" class="btn-ghost" data-action="openInstallApp">📲 Installer l’appli Pokédle</button>';
  var feedback = footer.querySelector('.site-footer-feedback');
  if (feedback) feedback.after(line); else footer.appendChild(line);
}
function renderInstallUi() {
  renderInstallHomeCard();
  var body = document.querySelector('#overlay-modal:not(.hidden)[data-kind="install"] .install-body');
  if (body) body.innerHTML = installStepsHtml(installTab || installPlatform());
}

// ---- 🔔 Notifications, asked where they are useful
// Same subscription as the daily reminder (lib/push-reminders.js): it also carries the challenges.
function notifIsOn() {
  return typeof dailyReminderSupport === 'function' && dailyReminderSupport() === 'push' &&
    typeof Notification !== 'undefined' && Notification.permission === 'granted' &&
    typeof dailyReminderSaved === 'function' && Boolean(dailyReminderSaved());
}
function notifCanAsk() {
  if (typeof dailyReminderSupport !== 'function') return false;
  var support = dailyReminderSupport();
  if (!support || notifIsOn()) return false;
  if (support === 'push' && (typeof Notification === 'undefined' || Notification.permission === 'denied')) return false;
  if (typeof dailyReminderServer !== 'undefined' && dailyReminderServer && dailyReminderServer.ok === false) return false;
  return true;
}
function notifBonusLeft() {
  return typeof playerProfile !== 'undefined' && playerProfile && !playerProfile.notifXpAt;
}
// +50 XP once: the mark lives in the profile, so it follows the account to every device.
function notifGiveBonus() {
  if (!notifBonusLeft() || typeof awardXp !== 'function') return;
  playerProfile.notifXpAt = Date.now();
  awardXp(NOTIF_BONUS_XP, 'Notifications activées');
}
// « Plus tard » hides the card for 3 days, everywhere.
function notifAskedLater() {
  var at = Number(installStore(NOTIF_ASK_KEY)) || 0;
  return at && Date.now() - at < 3 * 86400000;
}
function notifAskHtml(name, where) {
  if (!notifCanAsk() || (where !== 'install' && notifAskedLater())) return '';
  var title = name ? '🔔 Sois prévenu quand ' + escapeHtml(name) + ' répond' : '🔔 Sois prévenu du prochain défi';
  return '<div class="notif-ask" data-notif-ask="' + escapeHtml(where || '') + '">' +
    '<b class="notif-ask-title">' + title + '</b>' +
    '<p>Une notification quand on te défie ou qu’on relève ton défi, et un rappel du Pokémon du jour à l’heure de ton choix (jamais si tu as déjà joué).</p>' +
    '<div class="notif-ask-actions"><button type="button" class="btn-blue" data-action="openNotifSetup">Activer' + (notifBonusLeft() ? ' <i class="notif-ask-xp">+' + NOTIF_BONUS_XP + ' XP</i>' : '') + '</button>' +
    '<button type="button" class="btn-ghost" data-action="notifAskLater">Plus tard</button></div></div>';
}
function openNotifSetup() {
  var support = typeof dailyReminderSupport === 'function' ? dailyReminderSupport() : null;
  if (support === 'ios-install') { openInstallApp('notif'); return; }
  if (!support) { showToast('Ce navigateur ne peut pas recevoir de notifications. Essaie avec Chrome, Edge, Firefox ou Safari.'); return; }
  loadDailyReminderServer().then(function (server) {
    if (!server || !server.ok) { showToast('Les notifications ne sont pas disponibles pour le moment.'); return; }
    openDailyReminder('notif');
  });
}
function notifAskLater() {
  installStore(NOTIF_ASK_KEY, String(Date.now()));
  document.querySelectorAll('.notif-ask').forEach(function (el) { if (el.getAttribute('data-notif-ask') !== 'install') el.remove(); });
}

// « Défi envoyé » shows the card itself (sendChallenge); the challenge windows get it on top.
function notifAddToChallengeList() {
  var list = document.querySelector('#overlay-modal:not(.hidden) #overlay-body .pc-list');
  if (!list || list.querySelector('.notif-ask')) return;
  var html = notifAskHtml('', 'list');
  if (html) list.insertAdjacentHTML('afterbegin', html);
}
if (typeof pcShowNews === 'function') {
  var installNewsBefore = pcShowNews;
  pcShowNews = function () { var out = installNewsBefore.apply(this, arguments); notifAddToChallengeList(); return out; };
}
if (typeof renderMyChallenges === 'function') {
  var installMineBefore = renderMyChallenges;
  renderMyChallenges = function () { var out = installMineBefore.apply(this, arguments); notifAddToChallengeList(); return out; };
}

if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('DOMContentLoaded', function () {
    renderInstallFooter();
    // pokdle.fr/appli (server redirect) and ?appli=1 open the window.
    if (/[?&]appli=1\b/.test(location.search || '')) {
      try {
        var params = new URLSearchParams(location.search);
        params.delete('appli');
        var query = params.toString();
        history.replaceState(history.state, '', location.pathname + (query ? '?' + query : '') + location.hash);
      } catch (_e) {}
      setTimeout(function () { openInstallApp(); }, 600);
    }
    setTimeout(renderInstallHomeCard, 1200);
  });
}
window.openInstallApp = openInstallApp;
window.pickInstallTab = pickInstallTab;
window.installAppNow = installAppNow;
window.closeInstallHomeCard = closeInstallHomeCard;
window.openNotifSetup = openNotifSetup;
window.notifAskLater = notifAskLater;
