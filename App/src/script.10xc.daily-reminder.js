// « 🔔 Me rappeler le Pokémon du jour » : the player picks an hour and gets one notification a
// day, never once the daily Pokémon is found. The browser permission is asked only after a
// tap on this button. iPhone needs the site on the home screen first, so it gets a short guide.
const DAILY_REMINDER_KEY = 'pokedle.dailyReminder';
const DAILY_REMINDER_DEFAULT_HOUR = 18;
let dailyReminderServer = null;
let dailyReminderPicked = DAILY_REMINDER_DEFAULT_HOUR;
let dailyReminderBusy = false;

function dailyReminderSaved() {
  try { const saved = JSON.parse(localStorage.getItem(DAILY_REMINDER_KEY) || 'null'); return saved && Number.isInteger(saved.hour) ? saved : null; }
  catch (_e) { return null; }
}
function dailyReminderRemember(value) {
  try { value ? localStorage.setItem(DAILY_REMINDER_KEY, JSON.stringify(value)) : localStorage.removeItem(DAILY_REMINDER_KEY); } catch (_e) { /* private mode */ }
}

// 'push' when this browser can receive it, 'ios-install' on an iPhone browsing outside the home-screen app.
function dailyReminderSupport() {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;
  if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) return 'push';
  return ios && !standalone ? 'ios-install' : null;
}

async function loadDailyReminderServer() {
  if (dailyReminderServer) return dailyReminderServer;
  try {
    const response = await fetch('/api/push/key', { credentials: 'same-origin' });
    const data = response.ok ? await response.json() : null;
    dailyReminderServer = data && data.ok ? data : { ok: false };
  } catch (_e) { dailyReminderServer = { ok: false }; }
  return dailyReminderServer;
}

function dailyReminderHourLabel(hour) { return hour + ' h'; }

function renderDailyReminderChip() {
  const countdown = document.getElementById('daily-hero-countdown');
  if (!countdown) return;
  let chip = document.getElementById('daily-hero-remind');
  const support = dailyReminderSupport();
  if (!support || !dailyReminderServer?.ok) { chip?.remove(); return; }
  if (!chip) {
    chip = document.createElement('button');
    chip.id = 'daily-hero-remind';
    chip.type = 'button';
    chip.className = 'pk-chip pk-chip-remind';
    chip.dataset.action = 'openDailyReminder';
    countdown.after(chip);
  }
  const saved = support === 'push' && Notification.permission === 'granted' ? dailyReminderSaved() : null;
  chip.textContent = saved ? '🔔 Rappel à ' + dailyReminderHourLabel(saved.hour) : '🔔 Me rappeler demain';
  chip.classList.toggle('is-on', Boolean(saved));
  if (saved) document.getElementById('daily-remind-cta')?.remove();
}

function dailyReminderHoursHtml() {
  const hours = dailyReminderServer?.hours || [8, 12, 18, 20];
  return '<div class="remind-hours" role="radiogroup" aria-label="Heure du rappel">' + hours.map((hour) =>
    `<button type="button" role="radio" class="remind-hour${hour === dailyReminderPicked ? ' is-on' : ''}" aria-checked="${hour === dailyReminderPicked}" data-action="pickDailyReminderHour" data-args="[${hour}]">${dailyReminderHourLabel(hour)}</button>`).join('') + '</div>';
}

// reason 'notif': opened from a challenge (script.10xt.install-app.js), the same subscription also
// brings the challenges. The first activation gives +50 XP once (notifGiveBonus).
function openDailyReminder(reason) {
  const support = dailyReminderSupport();
  const fromChallenge = reason === 'notif';
  const title = fromChallenge ? '🔔 Les notifications Pokédle' : 'Me rappeler le Pokémon du jour';
  if (support === 'ios-install') {
    // Sur iPhone, les rappels marchent seulement depuis l'icône Pokédle de ton écran d'accueil.
    if (typeof openInstallApp === 'function') { openInstallApp('notif'); return; }
    ensureOverlay(title, `<div class="remind-sheet">
      <p>Sur iPhone, les rappels marchent seulement depuis l'icône Pokédle de ton écran d'accueil.</p>
      <ol class="remind-steps"><li>Touche <b>Partager</b> (le carré avec une flèche) en bas de Safari.</li>
        <li>Choisis <b>Sur l'écran d'accueil</b>.</li>
        <li>Ouvre Pokédle depuis la nouvelle icône, puis touche à nouveau 🔔.</li></ol></div>`);
    return;
  }
  if (Notification.permission === 'denied') {
    ensureOverlay(title, `<div class="remind-sheet"><p>Les notifications sont bloquées pour pokdle.fr.</p>
      <p class="remind-note">Autorise-les dans les réglages de ton navigateur, puis touche à nouveau 🔔.</p></div>`);
    return;
  }
  const saved = Notification.permission === 'granted' ? dailyReminderSaved() : null;
  dailyReminderPicked = saved ? saved.hour : DAILY_REMINDER_DEFAULT_HOUR;
  const bonus = !saved && typeof notifBonusLeft === 'function' && notifBonusLeft() ? ' <i class="notif-ask-xp">+' + NOTIF_BONUS_XP + ' XP</i>' : '';
  ensureOverlay(title, `<div class="remind-sheet">
    ${fromChallenge
      ? '<p>Une notification quand on te défie ou qu\'on relève ton défi, et un petit rappel du Pokémon du jour. <b>Rien si tu as déjà joué.</b></p>'
      : '<p>Une petite notification par jour pour ne pas casser ta série. <b>Rien si tu as déjà joué.</b></p>'}
    <p class="remind-label">${fromChallenge ? 'Le rappel du Pokémon du jour, à quelle heure ?' : 'À quelle heure ?'}</p>
    <div id="remind-hours-box">${dailyReminderHoursHtml()}</div>
    <button type="button" class="remind-go" id="remind-go" data-action="activateDailyReminder">${saved ? 'Enregistrer' : (fromChallenge ? '🔔 Activer les notifications' : '🔔 Activer le rappel') + bonus}</button>
    ${saved ? '<button type="button" class="remind-stop" data-action="stopDailyReminder">Arrêter le rappel</button>' : ''}
    <p class="remind-note">${saved ? 'Tu peux changer l\'heure ou arrêter quand tu veux.' : 'Tu peux l\'arrêter quand tu veux depuis ce même bouton.'}</p></div>`);
}

function pickDailyReminderHour(hour) {
  dailyReminderPicked = Number(hour);
  const box = document.getElementById('remind-hours-box');
  if (box) box.innerHTML = dailyReminderHoursHtml();
}

function dailyReminderKeyBytes(base64) {
  const padded = (base64 + '='.repeat((4 - base64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function dailyReminderPost(path, body) {
  const response = await fetch(path, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error('push_' + response.status);
  return response.json();
}

async function dailyReminderSubscription(create) {
  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const current = await registration.pushManager.getSubscription();
  if (current || !create) return current;
  return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: dailyReminderKeyBytes(dailyReminderServer.publicKey) });
}

function setDailyReminderBusy(busy) {
  dailyReminderBusy = busy;
  const go = document.getElementById('remind-go');
  if (go) { go.disabled = busy; if (busy) go.textContent = 'Un instant…'; }
}

async function activateDailyReminder() {
  if (dailyReminderBusy || !dailyReminderServer?.ok) return;
  setDailyReminderBusy(true);
  const hour = dailyReminderPicked;
  try {
    // Asked first, while the tap still counts as the player's own gesture.
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (permission !== 'granted') { setDailyReminderBusy(false); openDailyReminder(); return; }
    const subscription = await dailyReminderSubscription(true);
    await dailyReminderPost('/api/push/subscribe', { subscription: subscription.toJSON(), hour });
    dailyReminderRemember({ hour, synced: getDailyQuestKey() });
    closeOverlayModal();
    showToast('C\'est noté : rappel chaque jour à ' + dailyReminderHourLabel(hour) + '.');
    if (typeof notifGiveBonus === 'function') notifGiveBonus();
    document.querySelectorAll('.notif-ask').forEach((el) => el.remove());
  } catch (_e) {
    showToast('Le rappel n\'a pas pu être activé. Réessaie dans un moment.');
  } finally {
    setDailyReminderBusy(false);
    renderDailyReminderChip();
  }
}

async function stopDailyReminder() {
  if (dailyReminderBusy) return;
  setDailyReminderBusy(true);
  try {
    const subscription = await dailyReminderSubscription(false);
    if (subscription) {
      await dailyReminderPost('/api/push/unsubscribe', { endpoint: subscription.endpoint }).catch(() => null);
      await subscription.unsubscribe();
    }
    dailyReminderRemember(null);
    closeOverlayModal();
    showToast('Rappel arrêté.');
  } catch (_e) {
    showToast('Le rappel n\'a pas pu être arrêté. Réessaie dans un moment.');
  } finally {
    setDailyReminderBusy(false);
    renderDailyReminderChip();
  }
}

// Once a day, tells the server again who this browser belongs to (guest, then account), so a
// game played after signing in still counts as « déjà joué ».
async function syncDailyReminder() {
  const saved = dailyReminderSaved();
  if (!saved || saved.synced === getDailyQuestKey() || dailyReminderSupport() !== 'push' || Notification.permission !== 'granted') return;
  try {
    const subscription = await dailyReminderSubscription(false);
    if (!subscription) { dailyReminderRemember(null); renderDailyReminderChip(); return; }
    await dailyReminderPost('/api/push/subscribe', { subscription: subscription.toJSON(), hour: saved.hour });
    dailyReminderRemember({ hour: saved.hour, synced: getDailyQuestKey() });
  } catch (_e) { /* next visit */ }
}

const renderDailyHeroBeforeReminder = renderDailyHero;
renderDailyHero = function () {
  const value = renderDailyHeroBeforeReminder.apply(this, arguments);
  renderDailyReminderChip();
  return value;
};
document.addEventListener('DOMContentLoaded', () => {
  if (!dailyReminderSupport()) return;
  loadDailyReminderServer().then(() => { renderDailyReminderChip(); if (dailyReminderServer.ok) syncDailyReminder(); });
});

// The win card asks once more, at the best moment: « Reviens demain ? » with the same button, only
// while no reminder is on and this browser can show one (or guide an iPhone to the home screen).
function dailyRemindCtaHtml() {
  const support = dailyReminderSupport();
  if (!support || !dailyReminderServer?.ok) return '';
  if (support === 'push' && Notification.permission === 'granted' && dailyReminderSaved()) return '';
  return '<div class="daily-remind-cta" id="daily-remind-cta"><span class="daily-remind-cta-ico" aria-hidden="true">🔔</span>' +
    '<span class="daily-remind-cta-text"><b>Reviens demain ?</b><small>Un rappel à l’heure de ton choix, jamais si tu as déjà joué.</small></span>' +
    '<button type="button" class="btn-blue" data-action="openDailyReminder">Activer</button></div>';
}
if (typeof renderGameOverBox === 'function') {
  const renderGameOverBeforeReminder = renderGameOverBox;
  renderGameOverBox = function () {
    const value = renderGameOverBeforeReminder.apply(this, arguments);
    document.getElementById('daily-remind-cta')?.remove();
    if (gameMode === 'daily' && typeof dailyServerState !== 'undefined' && dailyServerState && dailyServerState.won) {
      const html = dailyRemindCtaHtml();
      const anchor = document.getElementById('daily-enquiry-points') || document.querySelector('#win-box .win-inner');
      if (html && anchor) anchor.insertAdjacentHTML('afterend', html);
    }
    return value;
  };
}
