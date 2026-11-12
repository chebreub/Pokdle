// 🏆 Classement : animation d'ouverture (12/11/2026, maquette vidéo validée par Kayan : « Go »).
// Quand on ouvre le classement (pas quand on change d'onglet Jour / Semaine / Total) :
// l'encadré « À gagner » glisse en place, le podium monte (2e, 3e puis 1er) avec ses points qui comptent,
// un halo doré passe derrière le 1er, puis les lignes arrivent une à une et la tienne s'allume.
// ≈ 1,5 s, jamais si « réduire les animations » est demandé, et rien n'empêche de cliquer pendant ce temps.
// Les données, l'ordre et les textes ne changent pas (les points retrouvent leur texte exact à la fin).

var lba = { until: 0, observer: null };

function lbaReduced() {
  return (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) ||
    document.body.classList.contains('reduce-motion') || document.documentElement.classList.contains('reduce-motion');
}

// Les points du podium comptent de 0 jusqu'au score, puis reprennent leur texte d'origine.
function lbaCount(el, delay) {
  var text = el.textContent, m = text.match(/\d[\d\s  ]*/);
  if (!m) return;
  var to = Number(m[0].replace(/\D/g, '')), start = performance.now() + delay;
  if (!(to > 0)) return;
  var paint = function (now) {
    if (!el.isConnected) return;
    var k = Math.max(0, Math.min(1, (now - start) / 700));
    if (k >= 1) { el.textContent = text; return; }
    el.textContent = text.replace(m[0], String(Math.round(to * (1 - Math.pow(1 - k, 3)))) + (/\s$/.test(m[0]) ? ' ' : ''));
    requestAnimationFrame(paint);
  };
  el.textContent = text.replace(m[0], '0' + (/\s$/.test(m[0]) ? ' ' : ''));
  requestAnimationFrame(paint);
}

function lbaPlay(shell) {
  if (!shell || shell.dataset.lba) return;
  shell.dataset.lba = '1';
  shell.classList.add('lba');
  shell.querySelectorAll('.lbv5-step strong').forEach(function (el) {
    var step = el.closest('.lbv5-step');
    lbaCount(el, step.classList.contains('is-gold') ? 950 : step.classList.contains('is-bronze') ? 750 : 600);
  });
  // La classe s'en va à la fin : un nouveau rendu (onglet, filtre) n'est jamais rejoué.
  setTimeout(function () { shell.classList.remove('lba'); }, 3200);
}

function lbaWatch() {
  var body = document.getElementById('leaderboard-page-body');
  if (!body || lba.observer) return;
  lba.observer = new MutationObserver(function () {
    if (Date.now() > lba.until) return;
    var shell = body.querySelector('.lbv3-shell');
    if (shell && shell.querySelector('.lbv5-podium .lbv5-step')) { lba.until = 0; lbaPlay(shell); }
  });
  lba.observer.observe(body, { childList: true, subtree: true });
}

if (typeof openLeaderboardV2 === 'function') {
  var openLeaderboardV2BeforeAnim = openLeaderboardV2;
  openLeaderboardV2 = function () {
    var screen = document.getElementById('screen-leaderboard');
    var opening = !screen || screen.classList.contains('hidden') || screen.offsetParent === null;
    if (opening && !lbaReduced()) { lbaWatch(); lba.until = Date.now() + 2500; }
    var out = openLeaderboardV2BeforeAnim.apply(this, arguments);
    if (opening && lba.until) {
      var shell = document.querySelector('#leaderboard-page-body .lbv3-shell');
      if (shell && shell.querySelector('.lbv5-podium .lbv5-step')) { lba.until = 0; lbaPlay(shell); }
    }
    return out;
  };
  window.openLeaderboardV2 = openLeaderboardV2;
}
