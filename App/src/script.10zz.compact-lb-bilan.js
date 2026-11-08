// 📱 Classement et bilan du jour plus courts sur iPhone (9/11/2026, maquettes validées : « go les 2 »).
// Kayan : « tous les écrans iPhone sont pas top, c'est un empilement de choses ».
// - Classement : l'encadré « À gagner cette semaine » tient en 2 lignes (le détail derrière ⓘ), partout.
//   Sur téléphone, la barre du haut, le menu, les onglets, le podium et les lignes sont plus serrés.
// - Bilan du jour (téléphone seulement) : une carte (anneau, série, 4 épreuves, bonus) et « Prochain Pokémon ».
//   Les éléments d'origine restent dans la page (la QA et le PC s'en servent) : on les cache sur téléphone.

// ===== Classement : « À gagner » en 2 lignes =====
if (typeof leaderboardPrizeHtml === 'function') {
  var leaderboardPrizeHtmlBeforeLbp2 = leaderboardPrizeHtml;
  leaderboardPrizeHtml = function () {
    var html = leaderboardPrizeHtmlBeforeLbp2.apply(this, arguments);
    return String(html)
      .replace('<section class="lbv5-prize"', '<section class="lbv5-prize is-compact"')
      .replace(/<\/section>$/, '<button type="button" class="lbp2-info" data-action="lbp2Toggle" aria-expanded="false" aria-label="Détails du lot de la semaine">ⓘ</button></section>');
  };
}
function lbp2Toggle() {
  var box = document.querySelector('.lbv5-prize.is-compact');
  if (!box) return;
  var open = box.classList.toggle('is-open');
  var button = box.querySelector('.lbp2-info');
  if (button) button.setAttribute('aria-expanded', open ? 'true' : 'false');
}
window.lbp2Toggle = lbp2Toggle;

// « ← Accueil » devient une flèche ronde sur téléphone (le mot reste lu par les lecteurs d'écran).
function lbp2Bar() {
  var back = document.querySelector('#screen-leaderboard .leaderboard-page-bar [data-action="goToConfig"]');
  if (!back || back.querySelector('.lbp2-long')) return;
  back.setAttribute('aria-label', 'Accueil');
  back.innerHTML = '<span aria-hidden="true">←</span><span class="lbp2-long"> Accueil</span>';
}
lbp2Bar();

// ===== Bilan du jour (téléphone) =====
function bj2Num(text) { var m = String(text || '').match(/\d+/); return m ? Number(m[0]) : 0; }

function bj2Html(content) {
  var total = content.querySelector('.journey-total');
  if (!total) return null;
  var points = bj2Num((total.querySelector('strong') || {}).textContent);
  var max = bj2Num((total.querySelector('span') || {}).textContent) || 100;
  var stages = Array.prototype.map.call(content.querySelectorAll('.journey-stages > button'), function (b) {
    var score = String((b.querySelector('strong') || {}).textContent || '').replace(/\s+/g, '');
    var parts = score.split('/');
    return { name: String((b.querySelector('span') || {}).textContent || '').trim(), score: score, full: parts.length === 2 && parts[0] === parts[1],
      done: /^Terminé/.test(String((b.querySelector('small') || {}).textContent || '')), action: b.getAttribute('data-action') || '' };
  });
  if (stages.length !== 4) return null;
  var allDone = stages.every(function (s) { return s.done; });
  var number = bj2Num((document.getElementById('challenge-day') || {}).textContent);
  var streakEl = document.getElementById('daily-hero-streak');
  var streak = streakEl && !streakEl.classList.contains('hidden') ? bj2Num(streakEl.textContent) : 0;
  var status = String((content.querySelector('.journey-status') || {}).textContent || '');
  var ranked = /est classé/.test(status);
  var bonusEl = document.querySelector('#daily-hero-bonus b');
  var bonus = bonusEl ? bonusEl.textContent : 'À jouer';
  var bonusDone = Boolean(document.querySelector('#daily-hero-bonus .is-done'));
  var pct = Math.max(0, Math.min(100, Math.round((points / max) * 100)));
  var title = !allDone ? 'Ta journée en cours' : pct >= 85 ? 'Superbe journée !' : pct >= 60 ? 'Belle journée !' : pct >= 35 ? 'Bonne journée !' : 'Journée terminée';
  var date = '';
  try { date = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Paris' }).format(new Date()); } catch (_e) {}
  var chips = (streak > 0 ? '<span class="bj2-chip is-fire">🔥 ' + streak + ' jour' + (streak > 1 ? 's' : '') + '</span>' : '') +
    (ranked ? '<span class="bj2-chip is-ranked">🏅 Classé</span>' : allDone ? '' : '<span class="bj2-chip">' + stages.filter(function (s) { return s.done; }).length + ' / 4 épreuves</span>');
  var card = '<div class="bj2-bar"><button type="button" class="bj2-back" data-action="goToConfig" aria-label="Accueil">←</button><h2>Bilan du jour</h2>' +
    '<button type="button" class="bj2-share" data-action="bj2Share">⤴ Partager</button></div>' +
    '<div class="bj2-card"><div class="bj2-hero"><div class="bj2-ring" style="--p:' + pct + '"><span><b>' + points + '</b><small>/ ' + max + '</small></span></div>' +
    '<div class="bj2-head"><h3>' + escapeHtml(title) + '</h3><p>Pokédle' + (number ? ' #' + number : '') + (date ? ' · ' + escapeHtml(date) : '') + '</p>' + (chips ? '<div class="bj2-chips">' + chips + '</div>' : '') + '</div></div>' +
    '<div class="bj2-four">' + stages.map(function (s) {
      return '<button type="button" class="' + (s.full ? 'is-full' : s.done ? 'is-done' : 'is-todo') + '"' + (s.action ? ' data-action="' + escapeHtml(s.action) + '"' : '') + '>' +
        '<span>' + escapeHtml(s.name) + '</span><b>' + escapeHtml(s.score) + '</b>' + (s.done ? '' : '<small>À finir →</small>') + '</button>';
    }).join('') + '</div>' +
    '<button type="button" class="bj2-bonus' + (bonusDone ? ' is-done' : '') + '" data-action="startDailyGrid"><span>★ Bonus · Grille du jour</span><b>' + escapeHtml(bonus) + (bonusDone ? ' ✓' : ' →') + '</b></button></div>';
  var clock = String((document.getElementById('daily-hero-countdown') || {}).textContent || '').match(/(\d+\s*h(?:\s*\d+\s*min)?|\d+\s*min)/);
  var countdown = clock ? clock[1] : '';
  var next = allDone ? '<div class="bj2-next"><h3>🎉 Prochain Pokémon' + (countdown ? ' dans ' + escapeHtml(countdown) : ' à minuit') + '</h3><div class="bj2-go">' +
    '<button type="button" class="is-blue" data-action="startNormalGame">🔁 Illimité</button>' +
    '<button type="button" data-action="openAllModesScreen" data-args=\'["solo"]\'>Mini-jeux</button>' +
    (typeof openPastDays === 'function' ? '<button type="button" data-action="openPastDays">📅 Jours passés</button>' : '') + '</div></div>' : '';
  return { card: card, next: next };
}

function bj2Paint() {
  var content = document.getElementById('challenge-content');
  if (!content || !content.classList.contains('is-summary')) return;
  Array.prototype.forEach.call(content.querySelectorAll('.bj2, .bj2-next'), function (el) { el.remove(); });
  var parts = bj2Html(content);
  if (!parts) return;
  var box = document.createElement('div');
  box.className = 'bj2';
  box.innerHTML = parts.card;
  content.insertBefore(box, content.firstChild);
  var actions = content.querySelector('.challenge-actions');
  if (parts.next && actions) actions.insertAdjacentHTML('afterend', parts.next);
}

// « Partager » : le bouton d'origine copie le bilan ; le message part dans une bulle (le texte du haut est caché sur téléphone).
function bj2Share() {
  var share = document.getElementById('journey-share');
  if (!share) return;
  share.click();
  setTimeout(function () {
    var line = String((document.getElementById('challenge-message') || {}).textContent || '');
    if (/copié/.test(line) && typeof showToast === 'function') showToast('Bilan copié ✓ Colle-le où tu veux.');
  }, 400);
}
window.bj2Share = bj2Share;

if (typeof showDailyJourneySummary === 'function') {
  var showDailyJourneySummaryBeforeBj2 = showDailyJourneySummary;
  showDailyJourneySummary = async function () {
    var value = await showDailyJourneySummaryBeforeBj2.apply(this, arguments);
    try { bj2Paint(); } catch (_e) {}
    return value;
  };
}
