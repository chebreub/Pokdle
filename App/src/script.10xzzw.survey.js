// 📊 Sondage unique (9/11/2026, maquette validée par Kayan : « Ok go »).
// « Ton avis sur Pokédle ? » : deux questions (😕 Pas fan · 🙂 Ça va · 😍 J'adore) et un mot facultatif.
// Une seule fois par joueur qui avait déjà un compte au lancement ; « Non merci » ou ✕ : jamais redemandé.
// La fenêtre attend que le joueur soit sur l'accueil, sans autre fenêtre ouverte : jamais par-dessus une partie.
var SV_FACES = [[1, '😕', 'Pas fan'], [2, '🙂', 'Ça va'], [3, '😍', 'J’adore']];
var SV_BALL = 'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/items/poke-ball.png';
var svState = { survey: null, a1: 0, a2: 0, busy: false, loaded: false };

function svPost(path, body) {
  return fetch(path, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then(function (res) { return res.json().catch(function () { return { ok: false }; }); });
}

function svFacesHtml(q) {
  var picked = q === 1 ? svState.a1 : svState.a2;
  return '<div class="sv-faces" role="radiogroup">' + SV_FACES.map(function (f) {
    var on = picked === f[0];
    return '<button type="button" class="sv-face' + (on ? ' on' : '') + '" role="radio" aria-checked="' + on + '" data-action="svPick" data-args="[' + q + ',' + f[0] + ']">' +
      '<span aria-hidden="true">' + f[1] + '</span>' + f[2] + '</button>';
  }).join('') + '</div>';
}

function svFormHtml() {
  var s = svState.survey;
  return '<button type="button" class="sv-x" data-action="svSkip" aria-label="Fermer (on ne te le redemandera pas)">✕</button>' +
    '<div class="sv-top"><img src="img/art/25.webp" alt="" width="58" height="58"><div><h2 id="sv-title">' + escapeHtml(s.title) + '</h2>' +
    '<p class="sv-sub">30 secondes, une seule fois : on ne te le redemandera pas.</p></div></div>' +
    '<div class="sv-q" id="sv-q1"><b>' + escapeHtml(s.q1) + '</b>' + svFacesHtml(1) + '</div>' +
    (s.q2 ? '<div class="sv-q" id="sv-q2"><b>' + escapeHtml(s.q2) + '</b>' + (s.hint ? '<small>' + escapeHtml(s.hint) + '</small>' : '') + svFacesHtml(2) + '</div>' : '') +
    '<div class="sv-txt"><label for="sv-comment">Un mot pour Kayan ? <i>(facultatif)</i></label>' +
    '<textarea id="sv-comment" maxlength="300" rows="2" placeholder="Ce que tu aimes, ce qui te gêne, une idée…"></textarea></div>' +
    '<p class="sv-status" role="status" aria-live="polite"></p>' +
    '<button type="button" class="sv-send" data-action="svSend">Envoyer mon avis</button>' +
    '<button type="button" class="sv-later" data-action="svSkip">Non merci</button>';
}

function svDoneHtml(ball) {
  return '<button type="button" class="sv-x" data-action="svClose" aria-label="Fermer">✕</button>' +
    '<div class="sv-done"><img src="img/art/39.webp" alt="" width="110" height="110"><h2 id="sv-title">Merci ! 💛</h2>' +
    '<p>Ton avis est bien arrivé.<br>Kayan lit chaque réponse.</p>' +
    (ball ? '<div class="sv-gift"><img src="' + SV_BALL + '" alt="" width="22" height="22">+1 Poké Ball pour te remercier</div>' : '') +
    '<button type="button" class="sv-send" data-action="svClose">Retour au jeu</button></div>';
}

function svOpen() {
  if (!svState.survey || document.getElementById('sv-veil')) return;
  var veil = document.createElement('div');
  veil.id = 'sv-veil';
  veil.className = 'sv-veil';
  veil.innerHTML = '<div class="sv" role="dialog" aria-modal="true" aria-labelledby="sv-title">' + svFormHtml() + '</div>';
  document.body.appendChild(veil);
  document.body.classList.add('sv-open');
  svPost('/api/survey/seen', { id: svState.survey.id }).catch(function () {});
}

function svPaintFaces() {
  [1, 2].forEach(function (q) {
    var box = document.querySelector('#sv-q' + q + ' .sv-faces');
    if (box) box.outerHTML = svFacesHtml(q);
  });
}

function svPick(q, n) {
  if (q === 1) svState.a1 = n; else svState.a2 = n;
  svPaintFaces();
  var status = document.querySelector('#sv-veil .sv-status');
  if (status) status.textContent = '';
}
window.svPick = svPick;

function svClose() {
  var veil = document.getElementById('sv-veil');
  if (veil) veil.remove();
  document.body.classList.remove('sv-open');
  svState.survey = null;
}
window.svClose = svClose;

// ✕ ou « Non merci » : refusé pour de bon. La fenêtre se ferme tout de suite (rien n'attend le serveur).
function svSkip() {
  var s = svState.survey;
  svClose();
  if (s) svPost('/api/survey/skip', { id: s.id }).catch(function () {});
}
window.svSkip = svSkip;

function svSend() {
  var s = svState.survey;
  if (!s || svState.busy) return;
  var status = document.querySelector('#sv-veil .sv-status');
  var say = function (line) { if (status) status.textContent = line; };
  if (!svState.a1 || (s.q2 && !svState.a2)) { say(s.q2 ? 'Choisis une tête pour les deux questions 🙂' : 'Choisis une tête 🙂'); return; }
  var box = document.getElementById('sv-comment');
  var button = document.querySelector('#sv-veil .sv-send');
  svState.busy = true;
  if (button) button.disabled = true;
  svPost('/api/survey/answer', { id: s.id, a1: svState.a1, a2: svState.a2 || null, comment: box ? box.value : '' }).then(function (data) {
    svState.busy = false;
    if (!data || (!data.ok && data.error !== 'already' && data.error !== 'gone')) {
      say('Envoi impossible pour le moment. Réessaie dans un instant.');
      if (button) button.disabled = false;
      return;
    }
    var card = document.querySelector('#sv-veil .sv');
    if (card) card.innerHTML = svDoneHtml(Boolean(data.ball));
    // La Ball apparaît tout de suite dans le sac et sur l'accueil.
    if (data.ball && typeof refreshBalls === 'function') { try { refreshBalls(); } catch (_e) {} }
  }).catch(function () {
    svState.busy = false;
    say('Envoi impossible pour le moment. Réessaie dans un instant.');
    if (button) button.disabled = false;
  });
}
window.svSend = svSend;

// Libre = sur l'accueil, sans fenêtre du site ni feuille ouverte (message 📬, niveau, invitation…).
function svFree() {
  var screen = document.body && document.body.dataset.screen;
  if (screen && screen !== 'screen-config') return false;
  var overlay = document.getElementById('overlay-modal');
  if (overlay && !overlay.classList.contains('hidden')) return false;
  var dialogs = document.querySelectorAll('[aria-modal="true"], .fav-sheet, .tb-editor-sheet, .wild-scene');
  for (var i = 0; i < dialogs.length; i++) if (!dialogs[i].closest('#sv-veil') && dialogs[i].getClientRects().length) return false;
  return document.visibilityState !== 'hidden';
}

function svShowWhenFree(tries) {
  if (!svState.survey) return;
  if (svFree()) { svOpen(); return; }
  if (tries < 200) setTimeout(function () { svShowWhenFree(tries + 1); }, 3000);
}

function svLoad() {
  if (svState.loaded) return;
  svState.loaded = true;
  fetch('/api/survey', { credentials: 'same-origin', cache: 'no-store' })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (!data || !data.survey) return;
      svState.survey = data.survey;
      svState.a1 = 0; svState.a2 = 0;
      svShowWhenFree(0);
    })
    .catch(function () { svState.loaded = false; });
}

if (typeof window !== 'undefined' && window.addEventListener) {
  // Après les messages 📬 (1,5 s) : la fenêtre du sondage attend qu'ils soient fermés.
  window.addEventListener('pokedle:auth-ready', function () { setTimeout(svLoad, 4000); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.getElementById('sv-veil') && !svState.busy) {
      if (svState.survey && document.querySelector('#sv-veil .sv-faces')) svSkip(); else svClose();
    }
  });
}
