
// « Donne ton avis »: a player sends an idea, a bug or an opinion from the footer or the
// settings. The message reaches the private stats page (lib/feedback.js): no e-mail is
// asked, a pseudo is optional so the owner can answer on Discord or Reddit.
const FEEDBACK_KINDS = [['idea', 'Une idée'], ['bug', 'Un bug'], ['opinion', 'Un avis']];

// The screen the player was on helps to understand a bug report.
function feedbackContext() {
  const screen = [...document.querySelectorAll('main [id^="screen-"]')].find((el) => !el.classList.contains('hidden') && el.offsetParent !== null);
  const name = !screen || screen.id === 'screen-config' ? 'accueil' : screen.id.replace(/^screen-/, '');
  return name === 'game' && typeof gameMode === 'string' ? 'jeu · ' + gameMode : name;
}

function openFeedbackModal() {
  const context = feedbackContext();
  const pseudo = (typeof connectedAccountUser !== 'undefined' && connectedAccountUser?.username) || '';
  ensureOverlay('Donne ton avis', '<form class="feedback-form" data-submit-action="submitFeedback" data-context="' + escapeHtml(context) + '">' +
    '<p class="card-desc">Une idée de jeu, un bug, une remarque ? Tous les messages sont lus.</p>' +
    '<fieldset class="feedback-kinds"><legend>C’est…</legend>' +
    FEEDBACK_KINDS.map(([value, label], i) => '<label><input type="radio" name="kind" value="' + value + '"' + (i ? '' : ' checked') + '> ' + label + '</label>').join('') +
    '</fieldset>' +
    '<label class="feedback-field"><span>Ton message</span><textarea name="message" rows="5" minlength="5" maxlength="1000" required placeholder="Dis-moi tout…"></textarea></label>' +
    '<label class="feedback-field"><span>Ton pseudo (Discord, Reddit…), facultatif, pour pouvoir te répondre</span><input name="pseudo" maxlength="60" autocomplete="nickname" value="' + escapeHtml(pseudo) + '"></label>' +
    '<label class="feedback-trap" aria-hidden="true">Ne pas remplir <input name="website" tabindex="-1" autocomplete="off"></label>' +
    '<p class="feedback-status" role="status" aria-live="polite"></p>' +
    '<button class="btn-blue" type="submit">Envoyer</button></form>');
}

async function submitFeedback(event) {
  event.preventDefault();
  const form = event.target.closest('form');
  const status = form?.querySelector('.feedback-status');
  const button = form?.querySelector('button[type="submit"]');
  if (!form || !status || !button || button.disabled) return;
  const data = new FormData(form);
  button.disabled = true;
  status.textContent = 'Envoi…';
  try {
    const response = await fetch('/api/feedback', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: data.get('kind'), message: data.get('message'), pseudo: data.get('pseudo'), website: data.get('website'), context: form.dataset.context }),
    });
    const result = await response.json().catch(() => ({}));
    if (response.ok && result.ok) {
      form.innerHTML = '<p class="card-desc feedback-thanks">Merci ! Ton message est bien arrivé.</p><button class="btn-ghost" type="button" data-action="closeOverlayModal">Fermer</button>';
      form.querySelector('button')?.focus();
      return;
    }
    status.textContent = result.error === 'too_short' ? 'Ton message est un peu court : écris au moins quelques mots.'
      : result.error === 'rate_limited' ? 'Tu as déjà envoyé plusieurs messages. Réessaie dans une heure.'
      : 'Envoi impossible pour le moment. Réessaie un peu plus tard.';
  } catch (_error) {
    status.textContent = 'Envoi impossible : vérifie ta connexion et réessaie.';
  }
  button.disabled = false;
}

// The same button in the settings, under « Soutenir Pokédle ».
const openSettingsBeforeFeedback = openSettingsModal;
openSettingsModal = function () {
  const value = openSettingsBeforeFeedback.apply(this, arguments);
  const grid = document.querySelector('#overlay-modal .app-settings-grid');
  if (grid && !grid.querySelector('.app-settings-feedback')) {
    const section = document.createElement('section');
    section.className = 'app-settings-section app-settings-feedback';
    section.innerHTML = '<h4>Une idée, un bug ?</h4><p class="card-desc">Dis-le directement : tous les messages sont lus.</p><button class="btn-ghost" type="button" data-action="openFeedbackModal">Donner mon avis</button>';
    grid.insertBefore(section, grid.querySelector('.app-settings-reset'));
  }
  return value;
};
