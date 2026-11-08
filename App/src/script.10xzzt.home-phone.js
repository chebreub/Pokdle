// 📱 Accueil sur téléphone (8/11/2026, maquettes validées par Kayan : « go »).
// - Journée finie : le Défi du jour devient un bilan court (anneau 78/100 + série, 4 épreuves en 4 cases,
//   bonus côte à côte, « Pokédle en illimité », puis compte à rebours · rappel · bilan sur une ligne).
// - L'ordre : Défi du jour, défi reçu, ta prochaine capture, mini-jeux, « Défie tes amis » + ses 4 jeux,
//   Expédition, « Aussi aujourd'hui » (CSS, fin de App/home.css).
// - 0 Ball mais des ₽ : « Acheter des Balls · 635 ₽ » au lieu de « Comment gagner des Balls ».
// Les textes d'origine restent dans la page (PC, lecteurs d'écran) : on ajoute seulement des versions courtes.

function hpNumber(text) {
  var m = String(text || '').match(/\d+/);
  return m ? Number(m[0]) : 0;
}

// Les noms des épreuves et des bonus en version courte (« Pokémon », « Grille ») ; le reste est caché sur téléphone.
function hpShorten(span) {
  if (!span || span.dataset.hpShort) return;
  var text = span.textContent;
  var html = escapeHtml(text)
    .replace(/^(\d+ · )/, '<i class="hp-long">$1</i>')
    .replace(/(Bonus · )/, '<i class="hp-long">$1</i>')
    .replace(/( du jour)$/, '<i class="hp-long">$1</i>');
  span.innerHTML = html;
  span.dataset.hpShort = '1';
}
function hpShortenHero() {
  document.querySelectorAll('#daily-hero-steps button > span, #daily-hero-bonus button > span').forEach(hpShorten);
}

function hpScoreHtml(summary) {
  var points = Number(summary.points) || 0, max = Number(summary.maxPoints) || 100;
  var pct = Math.max(0, Math.min(100, Math.round(points / max * 100)));
  var streak = hpNumber((document.getElementById('daily-hero-streak') || {}).textContent);
  return '<span class="hp-ring" style="--p:' + pct + '" aria-hidden="true"><b>' + points + '</b></span>' +
    '<span class="hp-score-text"><strong>✓ Journée terminée</strong><small>' + points + ' / ' + max + ' points</small></span>' +
    (streak > 0 ? '<span class="hp-fire">🔥 ' + streak + ' j</span>' : '');
}
var hpLastSummary = null;
function hpPaintScore() {
  var hero = document.getElementById('daily-hero'), title = hero && hero.querySelector('.pk-hero-title');
  var score = document.getElementById('hp-score');
  if (!hero || !title || hero.dataset.dailyState !== 'complete' || !hpLastSummary) { if (score) score.remove(); return; }
  if (!score) { score = document.createElement('div'); score.id = 'hp-score'; score.className = 'hp-score'; }
  var html = hpScoreHtml(hpLastSummary);
  if (score.dataset.html !== html) { score.innerHTML = html; score.dataset.html = html; }
  if (title.nextElementSibling !== score) title.after(score);
}
if (typeof applyDailyHomeSummary === 'function') {
  var applyDailyHomeSummaryBeforePhone = applyDailyHomeSummary;
  applyDailyHomeSummary = function (summary) {
    var out = applyDailyHomeSummaryBeforePhone.apply(this, arguments);
    hpLastSummary = summary || null;
    hpPaintScore();
    hpShortenHero();
    return out;
  };
}
if (typeof paintDailyGridBonus === 'function') {
  var paintDailyGridBonusBeforePhone = paintDailyGridBonus;
  paintDailyGridBonus = function () {
    var out = paintDailyGridBonusBeforePhone.apply(this, arguments);
    hpShortenHero();
    return out;
  };
}

// Compte à rebours et rappel en version courte (« ⏳ 7 h 34 », « 🔔 8 h »), mis à jour avec l'original.
function hpShortChips() {
  var countdown = document.getElementById('daily-hero-countdown');
  if (countdown) {
    var m = countdown.textContent.match(/(\d+)\s*h\s*(\d+)/);
    var short = m ? '⏳ ' + m[1] + ' h ' + m[2] : '';
    if (countdown.dataset.short !== short) countdown.dataset.short = short;
  }
  var remind = document.getElementById('daily-hero-remind');
  if (remind) {
    var r = remind.textContent.match(/(\d+)\s*h/);
    var rs = remind.classList.contains('is-on') && r ? '🔔 ' + r[1] + ' h' : '🔔 Rappel';
    if (remind.dataset.short !== rs) remind.dataset.short = rs;
  }
  hpPaintScore();
}
(function () {
  var chips = document.querySelector('#daily-hero .pk-hero-chips');
  if (!chips || typeof MutationObserver !== 'function') return;
  new MutationObserver(hpShortChips).observe(chips, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'] });
  hpShortChips();
})();

// « Ta prochaine capture » sans Ball : si le porte-monnaie permet d'en acheter, on le propose.
var HP_POKE_PRICE = 50;
function hpCaptureBuy() {
  var s = typeof ballState !== 'undefined' ? ballState : null;
  var go = document.querySelector('#home-balls .hs-capture-go[data-action="openBallBag"]');
  if (!s || !go || ballTotal(s) > 0) return;
  var coins = s.coins && Number(s.coins.balance);
  var left = typeof ballGrassLeft === 'function' ? ballGrassLeft(s) : 0;
  var price = (s.coins && s.coins.prices && Number(s.coins.prices.poke)) || HP_POKE_PRICE;
  if (!(coins >= price) || left <= 0) return;
  go.dataset.action = 'openShop';
  go.textContent = '🏪 Acheter des Balls · ' + coins.toLocaleString('fr-FR') + ' ₽';
}
if (typeof renderBallHomeCard === 'function') {
  var renderBallHomeCardBeforePhone = renderBallHomeCard;
  renderBallHomeCard = function () {
    var out = renderBallHomeCardBeforePhone.apply(this, arguments);
    hpCaptureBuy();
    return out;
  };
}
window.hpPaintScore = hpPaintScore;
