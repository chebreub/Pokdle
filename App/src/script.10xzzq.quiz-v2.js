// 🧠 Quiz v2 (8/11/2026, maquette validée par Kayan : « go quiz »).
// Le serveur choisit maintenant 15 questions plus variées et de plus en plus dures (lib/quiz-higher-lower.js) :
// silhouettes, table des types, stats, taille/poids, générations, culture, un seul n° Pokédex.
// L'écran suit la maquette :
// - une barre de 15 cases (vert = bon, rouge = raté) et la série 🔥 ;
// - une « scène » colorée selon la catégorie, avec le niveau (Facile / Moyen / Difficile) et les Pokémon
//   (images sous des adresses opaques : elles ne disent pas qui c'est) ;
// - 4 grosses réponses A / B / C / D ; après la réponse, une ligne explique pourquoi.
// On ne fait qu'habiller ce que le Quiz affiche déjà : réponses, points, Balls et ₽ restent ceux du serveur.
// Le Quiz de la Party Room garde son écran.

var QZ_KINDS = {
  who: ['👤 Qui est-ce ?', 'is-who'], types: ['⚔️ Table des types', 'is-types'], type: ['⚔️ Types', 'is-types'],
  stats: ['📊 Stats', 'is-stats'], size: ['⚖️ Taille et poids', 'is-size'], gen: ['🌍 Génération', 'is-gen'],
  culture: ['📚 Culture', 'is-culture'], dex: ['🔢 Pokédex', 'is-dex']
};
var QZ_LEVELS = { 1: ['Facile', 'is-easy'], 2: ['Moyen', 'is-mid'], 3: ['Difficile', 'is-hard'] };
var qzSignature = '', qzQueued = false;

function qzOn() {
  return typeof gameMode !== 'undefined' && gameMode === 'quiz' && !(typeof isPartySessionActive === 'function' && isPartySessionActive());
}
function qzCurrent() {
  return typeof quizQuestions !== 'undefined' && Array.isArray(quizQuestions) ? quizQuestions[quizCurrentIndex] || null : null;
}
function qzImg(src, cls) {
  return '<img' + (cls ? ' class="' + cls + '"' : '') + ' src="' + escapeHtml(String(src)) + '" alt="" decoding="async">';
}
function qzSceneHtml(q, answered) {
  var kind = QZ_KINDS[q.kind] || ['❓ Quiz', 'is-culture'], lvl = QZ_LEVELS[q.level];
  var art = Array.isArray(q.art) ? q.art : [];
  var body = '';
  if (art.length === 4 && Array.isArray(q.options) && q.options.length === 4) {
    body = '<span class="qz-four">' + art.map(function (src, i) { return '<span>' + qzImg(src) + '<small>' + escapeHtml(q.options[i]) + '</small></span>'; }).join('') + '</span>';
  } else if (art.length) {
    var types = Array.isArray(q.types) && q.types.length && typeof typeBadgesHtml === 'function' ? '<span class="qz-types">' + typeBadgesHtml(q.types[0], q.types[1] || null) + '</span>' : '';
    body = '<span class="qz-solo">' + qzImg(art[0], q.silhouette && !answered ? 'is-shadow' : '') + types + '</span>';
  } else {
    body = '<span class="qz-icon" aria-hidden="true">' + kind[0].split(' ')[0] + '</span>';
  }
  return '<span class="qz-cat">' + escapeHtml(kind[0]) + '</span>' + (lvl ? '<span class="qz-lvl ' + lvl[1] + '">' + lvl[0] + '</span>' : '') + body;
}
function qzHudHtml() {
  var total = quizQuestions.length, hist = Array.isArray(quizHistory) ? quizHistory : [];
  var dots = '';
  for (var i = 0; i < total; i++) dots += '<i class="' + (i < hist.length ? (hist[i].ok ? 'is-ok' : 'is-ko') : i === quizCurrentIndex ? 'is-now' : '') + '"></i>';
  var streak = 0;
  for (var j = hist.length - 1; j >= 0 && hist[j].ok; j--) streak++;
  var pill = streak >= 2 ? '<span class="qz-pill is-fire">🔥 ' + streak + '</span>' : '<span class="qz-pill">' + Number(quizScore || 0) + ' / ' + total + '</span>';
  return '<span class="qz-dots" aria-hidden="true">' + dots + '</span>' + pill;
}

function qzDecorate() {
  qzQueued = false;
  var box = document.getElementById('quiz-box');
  if (!box) return;
  if (!qzOn()) { if (box.classList.contains('qz-on')) box.classList.remove('qz-on'); return; }
  var q = qzCurrent(), done = !q || (typeof gameOver !== 'undefined' && gameOver && quizCurrentIndex >= quizQuestions.length);
  var answered = Boolean(typeof quizAnswered !== 'undefined' && quizAnswered);
  var buttons = Array.prototype.slice.call(document.querySelectorAll('#quiz-options > button'));
  var sig = [quizCurrentIndex, answered, (quizHistory || []).length, done, q ? q.question : '', q && q.explain || '',
    buttons.map(function (b) { return b.className.replace(/\s*qz-dim/g, '') + (b.disabled ? '!' : ''); }).join(',')].join('|');
  if (sig === qzSignature && box.classList.contains('qz-on')) return;
  qzSignature = sig;
  if (!box.classList.contains('qz-on')) box.classList.add('qz-on');
  box.classList.toggle('qz-done', done);

  var hud = document.getElementById('qz-hud');
  if (!hud) { hud = document.createElement('div'); hud.id = 'qz-hud'; hud.className = 'qz-hud'; box.prepend(hud); }
  var scene = document.getElementById('qz-scene'), questionEl = document.getElementById('quiz-question');
  if (!scene && questionEl) { scene = document.createElement('div'); scene.id = 'qz-scene'; scene.setAttribute('aria-hidden', 'true'); questionEl.before(scene); }
  if (done) { hud.innerHTML = ''; if (scene) scene.hidden = true; return; }
  hud.innerHTML = qzHudHtml();
  if (scene) {
    scene.hidden = false;
    scene.className = 'qz-scene ' + ((QZ_KINDS[q.kind] || [0, 'is-culture'])[1]);
    scene.innerHTML = qzSceneHtml(q, answered);
  }
  // A / B / C / D devant chaque réponse (le texte de la réponse ne change pas).
  buttons.forEach(function (b, i) {
    if (!b.querySelector('.qz-letter')) b.insertAdjacentHTML('afterbegin', '<b class="qz-letter" aria-hidden="true">' + 'ABCD'.charAt(i) + '</b>');
    b.classList.toggle('qz-dim', answered && b.disabled && !/btn-yellow|btn-red/.test(b.className));
  });
  // L'explication, une fois la réponse donnée (envoyée par le serveur avec la bonne réponse).
  var explain = document.getElementById('qz-explain'), feedback = document.getElementById('quiz-feedback');
  if (answered && q.explain) {
    if (!explain) { explain = document.createElement('p'); explain.id = 'qz-explain'; explain.className = 'qz-explain'; }
    if (feedback && explain.previousElementSibling !== feedback) feedback.after(explain);
    explain.textContent = q.explain;
  } else if (explain) explain.remove();
}
function qzQueue() {
  if (qzQueued) return;
  qzQueued = true;
  (window.requestAnimationFrame || setTimeout)(qzDecorate);
}
(function () {
  var box = document.getElementById('quiz-box');
  if (!box || typeof MutationObserver !== 'function') return;
  new MutationObserver(qzQueue).observe(box, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'disabled'] });
})();
['renderQuizQuestion', 'submitQuizAnswer', 'startQuizGame'].forEach(function (name) {
  var original = window[name];
  if (typeof original !== 'function') return;
  window[name] = function () {
    // Fin du quiz : on retire la barre et la scène AVANT que le bilan prenne le focus (et fasse défiler la page).
    // Les retirer après faisait remonter le bilan hors de l'écran sur Safari, qui ne recale pas le défilement.
    if (name === 'renderQuizQuestion' && qzOn() && typeof quizQuestions !== 'undefined' && quizCurrentIndex >= quizQuestions.length) {
      var hud = document.getElementById('qz-hud'), scene = document.getElementById('qz-scene');
      if (hud) hud.innerHTML = '';
      if (scene) scene.hidden = true;
    }
    var out = original.apply(this, arguments);
    qzQueue();
    if (out && typeof out.then === 'function') out.then(qzQueue, qzQueue);
    return out;
  };
});
window.qzDecorate = qzDecorate;
