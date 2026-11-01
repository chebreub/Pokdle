
// Supporting Pokédle: a Ko-fi page, offered in the footer, in the settings and,
// at most once a week, under a finished day's summary.
const POKEDLE_SUPPORT_URL = 'https://ko-fi.com/chebreub';
const SUPPORT_NUDGE_KEY = 'pokedle_support_nudge';
const SUPPORT_NUDGE_EVERY_MS = 7 * 86400000;
const SUPPORT_THANKS_MS = 30 * 86400000;

function supportLinkHtml(className) {
  return '<a class="support-kofi-btn ' + (className || '') + '" href="' + POKEDLE_SUPPORT_URL + '" target="_blank" rel="noopener noreferrer" data-support-link="1">☕ Soutenir Pokédle</a>';
}
function readSupportNudge() {
  try { return JSON.parse(localStorage.getItem(SUPPORT_NUDGE_KEY) || '{}') || {}; } catch (e) { return {}; }
}
function writeSupportNudge(patch) {
  try { localStorage.setItem(SUPPORT_NUDGE_KEY, JSON.stringify({ ...readSupportNudge(), ...patch })); } catch (e) {}
}
function supportNudgeDue(now = Date.now()) {
  const state = readSupportNudge();
  if (Number(state.supportedAt) && now - Number(state.supportedAt) < SUPPORT_THANKS_MS) return false;
  return !Number(state.shownAt) || now - Number(state.shownAt) >= SUPPORT_NUDGE_EVERY_MS;
}
function dismissSupportNudge() {
  document.getElementById('journey-support')?.remove();
}
// A click on any support link counts as a thank you: no reminder for a month.
document.addEventListener('click', (event) => {
  if (event.target.closest?.('[data-support-link]')) writeSupportNudge({ supportedAt: Date.now() });
});

const openSettingsBeforeSupport = openSettingsModal;
openSettingsModal = function () {
  const value = openSettingsBeforeSupport.apply(this, arguments);
  const grid = document.querySelector('#overlay-modal .app-settings-grid');
  if (grid && !grid.querySelector('.app-settings-support')) {
    // « Aide & soutien » (01/11/2026): one section, one line per action, the button on the right.
    let section = grid.querySelector('.app-settings-help');
    if (!section) {
      section = document.createElement('section');
      section.className = 'app-settings-section app-settings-help';
      section.innerHTML = '<h4>Aide & soutien</h4>';
      grid.insertBefore(section, grid.querySelector('.app-settings-reset'));
    }
    const row = document.createElement('div');
    row.className = 'app-setting-item app-settings-support';
    row.innerHTML = '<span><b>☕ Soutenir Pokédle</b><small>Gratuit et sans pub : un café aide à payer le serveur.</small></span>' + supportLinkHtml('app-settings-support-link');
    section.appendChild(row);
  }
  return value;
};

const showSummaryBeforeSupport = showDailyJourneySummary;
showDailyJourneySummary = async function () {
  const value = await showSummaryBeforeSupport.apply(this, arguments);
  const content = document.getElementById('challenge-content');
  const stages = content ? [...content.querySelectorAll('.journey-stages small')] : [];
  const finished = stages.length > 0 && stages.every((el) => el.textContent.startsWith('Terminé'));
  if (content?.classList.contains('is-summary') && finished && !document.getElementById('journey-support') && supportNudgeDue()) {
    writeSupportNudge({ shownAt: Date.now() });
    const box = document.createElement('div');
    box.id = 'journey-support';
    box.className = 'journey-support';
    box.innerHTML = '<p>Tu aimes Pokédle ? Le site reste gratuit et sans pub grâce aux joueurs qui offrent un café.</p><div class="journey-support-actions">' + supportLinkHtml() + '<button type="button" class="btn-ghost" data-action="dismissSupportNudge">Plus tard</button></div>';
    content.appendChild(box);
  }
  return value;
};
