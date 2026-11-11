// 🏠 Accueil V4 (11/11/2026, maquettes V4 validées par Kayan : « Go dev accueil V4 »).
// On réorganise et on rhabille les blocs existants, sans rien recopier ni retirer :
// - le Défi du jour (#daily-hero) prend 3 visages selon les vraies données du parcours
//   (GET /api/daily/challenge/summary, lu par script.10s) : à découvrir, en cours (anneau x / 100), terminé (bande fine) ;
// - les mini-jeux restent le carrousel de l'accueil (script.10zzg) mais en tuiles compactes, 6 visibles sur PC ;
//   la carte « À découvrir aujourd'hui » (script.10xzt, avec « Pas aujourd'hui ») devient la 1re tuile de la Sélection ;
//   un 4e filtre « Entre amis » montre les jeux de salon ;
// - joueur connecté : une rangée « Ta prochaine capture » (#home-balls) · Expédition (#exp2-home) · « Cette semaine »
//   (Œuf, Ligue, album, série, cadeau), puis « Mon Pokédex » et « Récompenses du jour » (ballState, wildCaptures) ;
// - visiteur sans compte : 3 cartes « Avec un compte gratuit » à la place de la progression ;
// - un emplacement « FR » dans l'en-tête (le multilingue est un chantier à part).
// Aucune règle de gain ne change : tout est lu dans les états déjà chargés par le site.

var HV4_PARTY = [
  ['dessin', 'Dessine-le !', 'img/home/235.webp', '#F08A4B', '2 à 8 joueurs'],
  ['quiestce1v1', 'Qui est-ce ?', 'img/home/132.webp', '#7C5BD6', 'À deux'],
  ['petitbac', 'Petit Bac', 'img/home/201.webp', '#3FA06A', '2 à 8 joueurs'],
  ['dexrace', 'Course au Pokédex', 'img/home/479.webp', '#4069E0', '2 à 8 joueurs'],
  ['coop', 'Enquête coop', 'img/art/65.webp', '#D9A21B', '2 à 8 joueurs'],
  ['deduction', 'Pokémon mystère', 'img/art/151.webp', '#E06AA0', '2 à 8 joueurs']
];
var hv4 = { disc: null, filter: 'popular' };

function hv4Screen() { return document.getElementById('screen-config'); }
function hv4Authed() { return Boolean(window.__pokedleAuthed); }
function hv4Esc(s) { return typeof escapeHtml === 'function' ? escapeHtml(String(s)) : String(s); }

// ---- En-tête : emplacement de la langue (visuel seulement) ----
function hv4Lang() {
  var actions = document.querySelector('header .header-actions');
  if (!actions || actions.querySelector('.hv4-lang')) return;
  var b = document.createElement('span');
  b.className = 'hv4-lang';
  b.title = 'Langue : français (l’anglais arrive bientôt)';
  b.setAttribute('aria-label', 'Langue : français');
  b.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5"/><path d="M1.5 8h13M8 1.5c2 2 2.6 4 2.6 6.5S10 12.5 8 14.5M8 1.5C6 3.5 5.4 5.5 5.4 8S6 12.5 8 14.5"/></svg>FR';
  actions.insertBefore(b, actions.firstChild);
}

// ---- Défi du jour : 3 visages, avec les vraies données du parcours ----
function hv4Summary() {
  var snap = typeof dailyHomeSnapshot !== 'undefined' ? dailyHomeSnapshot : null;
  return snap && typeof dailyHomeKey === 'function' && snap.key === dailyHomeKey() ? snap.data : null;
}
function hv4Hero() {
  var hero = document.getElementById('daily-hero');
  if (!hero) return;
  var main = hero.querySelector('.pk-hero-main');
  if (!main) return;
  var sum = hv4Summary();
  var stages = sum && Array.isArray(sum.stages) ? sum.stages : [];
  var done = stages.filter(function (s) { return s.finished; }).length;
  var complete = hero.dataset.dailyState === 'complete' || (stages.length === 4 && done === 4);
  var state = complete ? 'done' : done ? 'progress' : 'fresh';
  hero.classList.add('hv4-hero');
  ['fresh', 'progress', 'done'].forEach(function (k) { hero.classList.toggle('hv4-' + k, k === state); });
  hv4Screen()?.setAttribute('data-hv4-day', state);
  // La grande question (visuelle) : le H1 d'origine reste pour Google, en sous-titre.
  var q = main.querySelector('.hv4-q');
  if (!q) {
    q = document.createElement('p');
    q.className = 'hv4-q';
    q.setAttribute('aria-hidden', 'true');
    var title = main.querySelector('.pk-hero-title');
    if (title) title.before(q); else main.prepend(q);
  }
  var points = sum ? Number(sum.points) || 0 : 0, max = sum ? Number(sum.maxPoints) || 100 : 100;
  var qText = state === 'fresh' ? 'Qui est le Pokémon du jour ?' : state === 'progress' ? 'Ta journée : ' + points + ' / ' + max : 'Journée terminée : ' + points + ' / ' + max;
  if (q.textContent !== qText) q.textContent = qText;
  // L'ombre décorative (toujours la même, jamais le Pokémon du jour) ou l'anneau des points.
  var deco = hero.querySelector('.hv4-deco');
  if (!deco) { deco = document.createElement('span'); deco.className = 'hv4-deco'; deco.setAttribute('aria-hidden', 'true'); main.appendChild(deco); }
  var pct = Math.max(0, Math.min(100, Math.round(points / max * 100)));
  var decoHtml = state === 'fresh'
    ? '<img class="hv4-sil" src="img/art/448.webp" alt="" width="200" height="200" decoding="async"><b class="hv4-qm">?</b>'
    : '<span class="hv4-ring" style="--p:' + pct + '"><b>' + points + '</b><small>/' + max + '</small></span>';
  if (deco.dataset.h !== decoHtml) { deco.innerHTML = decoHtml; deco.dataset.h = decoHtml; }
}

// ---- Mini-jeux : tuiles compactes, découverte du jour en 1re tuile, filtre « Entre amis » ----
function hv4Filters() {
  var box = document.getElementById('home-game-filters');
  if (!box || box.querySelector('[data-action="hv4FriendsFilter"]')) return;
  box.insertAdjacentHTML('beforeend', '<button type="button" data-action="hv4FriendsFilter" data-args=\'["friends"]\' aria-pressed="false">Entre amis</button>');
}
function hv4FriendsFilter() {
  var grid = document.getElementById('home-games-grid');
  if (!grid) return;
  hv4.filter = 'friends';
  grid.replaceChildren.apply(grid, HV4_PARTY.map(function (g) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'all-modes-card mode-tile hv4-ptile';
    b.dataset.action = 'openPartyRoomWithGame';
    b.dataset.args = JSON.stringify([g[0]]);
    b.style.setProperty('--c', g[3]);
    b.innerHTML = '<span class="mode-tile-art"><img class="mode-tile-sprite" src="' + g[2] + '" alt="" loading="lazy" decoding="async" width="96" height="96"></span>' +
      '<span class="mode-tile-body"><strong class="mode-tile-title">' + hv4Esc(g[1]) + '</strong><span class="mode-tile-desc">' + g[4] + '</span></span>';
    return b;
  }));
  document.querySelectorAll('#home-game-filters button').forEach(function (button) {
    button.setAttribute('aria-pressed', String(button.dataset.action === 'hv4FriendsFilter'));
  });
}
// La carte « À découvrir aujourd'hui » (script.10xzt) devient la 1re tuile de la Sélection.
function hv4Discovery() {
  var grid = document.getElementById('home-games-grid');
  var card = document.getElementById('home-disc-card') || hv4.disc;
  if (!grid || !card) return;
  hv4.disc = card;
  var popular = typeof homeGameFilter === 'undefined' || homeGameFilter === 'popular';
  if (popular && hv4.filter !== 'friends') {
    card.classList.add('hv4-disc');
    if (grid.firstElementChild !== card) grid.insertBefore(card, grid.firstChild);
  } else if (card.parentElement === grid) {
    var tail = hv4Screen()?.querySelector('.hc-tail');
    if (tail) tail.prepend(card); else card.remove();
  }
}
// Le carrousel : avance seul toutes les 7 s sur PC seulement, jamais au doigt (script.10zzg arrête au 1er geste).
function hv4Carousel() {
  if (typeof HC_EVERY !== 'undefined') HC_EVERY = 7000;
  if (typeof hc !== 'undefined' && typeof matchMedia === 'function' && matchMedia('(max-width: 860px), (pointer: coarse)').matches && typeof hcStop === 'function') hcStop();
}

// ---- Rangée « progression » (joueur connecté) ----
function hv4Row() {
  var screen = hv4Screen();
  if (!screen) return null;
  var row = document.getElementById('hv4-row');
  if (!row) {
    row = document.createElement('section');
    row.id = 'hv4-row';
    row.className = 'hv4-row';
    row.setAttribute('aria-label', 'Ta progression');
    var games = screen.querySelector('.home-discovery');
    if (games) games.after(row); else screen.appendChild(row);
  }
  return row;
}
function hv4Week() {
  // « Cette semaine » : la carte Œuf d'origine (.home-pathways) reçoit la Ligue, l'album, la série et le cadeau.
  var paths = hv4Screen()?.querySelector('.home-pathways');
  if (!paths) return null;
  paths.classList.add('hv4-week');
  if (!paths.querySelector('.hv4-week-t')) paths.insertAdjacentHTML('afterbegin', '<span class="hv4-week-t">Cette semaine</span>');
  var s = typeof ballState !== 'undefined' ? ballState : null;
  var rows = '';
  if (s && s.giftAvailable) rows += hv4RowBtn('claimBallGift', '🎁 Cadeau du jour', '1 Poké Ball à ouvrir', 'is-hot');
  try {
    if (typeof weeklyLeagueState === 'function') {
      var lg = weeklyLeagueState();
      rows += hv4RowBtn('openWeeklyLeague', '🏅 Ligue de la semaine', lg.completed + ' / 3 disciplines · ' + lg.score + ' pts', '', Math.round(lg.completed / 3 * 100));
    }
  } catch (_e) {}
  try {
    var goal = typeof albumNextGoal === 'function' && typeof albumDiscoveries === 'function' && Object.keys(albumDiscoveries()).length ? albumNextGoal() : null;
    if (goal) rows += hv4RowBtn('openAlbumBinder', '📒 Album · ' + hv4Esc(goal.stats.name) + ' ' + goal.stats.found + '/' + goal.stats.total, 'Plus que ' + goal.left + ' pour la médaille ' + goal.tier.icon);
  } catch (_e) {}
  if (s && s.streak && s.streak.days) {
    var every = s.streak.every || 7, left = every - Math.min(every, s.streak.inCycle || 0);
    rows += hv4RowBtn('openBallBag', '🔥 Série de ' + Number(s.streak.days) + ' jour' + (s.streak.days > 1 ? 's' : ''), left ? 'Hyper Ball dans ' + left + ' jour' + (left > 1 ? 's' : '') : 'Hyper Ball gagnée aujourd’hui');
  }
  var box = paths.querySelector('.hv4-week-rows');
  if (!box) { box = document.createElement('div'); box.className = 'hv4-week-rows'; paths.appendChild(box); }
  if (box.dataset.h !== rows) { box.innerHTML = rows; box.dataset.h = rows; }
  return paths;
}
function hv4RowBtn(action, title, line, cls, pct) {
  return '<button type="button" class="hv4-wrow ' + (cls || '') + '" data-action="' + action + '"><span><b>' + title + '</b><small>' + line + '</small>' +
    (pct != null ? '<i class="hv4-bar"><u style="width:' + pct + '%"></u></i>' : '') + '</span><em aria-hidden="true">→</em></button>';
}
function hv4Dex() {
  var stats = typeof pokedexCollectionNationalStats === 'function' ? pokedexCollectionNationalStats() : null;
  if (!stats) return '';
  var caught = 0, shiny = 0;
  if (typeof wildCaptures !== 'undefined' && wildCaptures) {
    Object.keys(wildCaptures).forEach(function (id) { var c = wildCaptures[id] || {}; if ((c.normal || 0) + (c.shiny || 0) > 0) caught++; if (c.shiny > 0) shiny++; });
  }
  var total = stats.total || 1025, bar = function (n, color) { return '<i class="hv4-bar"><u style="width:' + Math.max(1, Math.round(n / total * 100)) + '%;background:' + color + '"></u></i>'; };
  var known = typeof wildCaptures !== 'undefined' && wildCaptures;
  var bs = typeof ballState !== 'undefined' && ballState && ballState.wild ? ballState.wild : null;
  if (!known && bs && Number.isFinite(Number(bs.caught))) { caught = Number(bs.caught); }
  return '<div class="hv4-card hv4-dex"><span class="hv4-k" style="color:#C8333A">Mon Pokédex</span><h3>' + stats.found + ' / ' + total + ' vus' + (known || bs ? ' · ' + caught + ' attrapé' + (caught > 1 ? 's' : '') : '') + '</h3>' +
    '<div class="hv4-bars"><span>👁️ Vus</span>' + bar(stats.found, '#4069E0') + '<b>' + stats.found + '</b>' +
    (known || bs ? '<span>Attrapés</span>' + bar(caught, '#E0402E') + '<b>' + caught + '</b>' : '') + (known ? '<span>✨ Shinies</span>' + bar(shiny, '#D9A21B') + '<b>' + shiny + '</b>' : '') + '</div>' +
    '<button type="button" class="hv4-ghost" data-action="openAlbumBinder">📒 Ouvrir mon Pokédex</button></div>';
}
function hv4Rewards() {
  var s = typeof ballState !== 'undefined' ? ballState : null;
  if (!s || !s.cap) return '';
  var full = s.today >= s.cap, coins = s.coins && s.coins.enabled ? Number(s.coins.balance) : NaN;
  var line = full ? 'Tes ' + s.cap + ' Balls du jour sont gagnées. Les jeux restent là pour le plaisir.'
    : 'La 1re partie du jour d’un jeu marqué « +1 Ball » rapporte une Ball' + (Number.isFinite(coins) ? ' et des ₽' : '') + '. Encore ' + (s.cap - s.today) + ' possible' + (s.cap - s.today > 1 ? 's' : '') + ' aujourd’hui.';
  return '<div class="hv4-card hv4-rewards"><span class="hv4-k" style="color:#4069E0">Récompenses du jour</span><h3>' + s.today + ' Ball' + (s.today > 1 ? 's' : '') + ' sur ' + s.cap +
    (Number.isFinite(coins) ? ' · ' + coins.toLocaleString('fr-FR') + ' ₽' : '') + '</h3><p>' + hv4Esc(line) + '</p>' +
    '<button type="button" class="hv4-ghost" data-action="openBallBag">🎒 Mon sac</button></div>';
}
function hv4Why() {
  var A = function (k, color, title, line, img, alt) {
    return '<div class="hv4-card hv4-why-card"><span class="hv4-k" style="color:' + color + '">' + k + '</span><h3>' + title + '</h3><p>' + line + '</p><img src="' + img + '" alt="' + (alt || '') + '" width="96" height="96" loading="lazy" decoding="async"></div>';
  };
  return '<div class="hv4-why-head"><h2>Avec un compte gratuit, ta progression te suit</h2><button type="button" class="hv4-cta" data-action="openLoginWelcome">Créer mon compte</button></div>' +
    '<div class="hv4-why">' +
    A('Attrape-les', '#2F8F4A', 'Tes parties rapportent des Balls', 'Jusqu’à 10 par jour, à lancer dans les hautes herbes. Ton Pokédex se remplit.', 'img/art/25.webp') +
    A('Chaque semaine', '#B07A1E', 'Une expédition en commun', 'Tous les joueurs remplissent la même barre : coffres de Balls, puis un légendaire.', 'img/art/785.webp') +
    A('Ta progression', '#7C5BD6', 'Niveaux, séries, classements', 'Ta progression est gardée sur tous tes appareils. Une série de 7 jours rapporte une Hyper Ball.', 'img/art/151.webp') +
    '</div>';
}
// Plus de Balls ou plus de rencontres : la carte capture propose ce qui est vraiment possible maintenant.
function hv4CaptureAlt() {
  var card = document.getElementById('home-balls'), s = typeof ballState !== 'undefined' ? ballState : null;
  if (!card || !s || !hv4Authed() || card.classList.contains('is-beginner')) { card && card.querySelector('.hv4-alt')?.remove(); return; }
  var bag = s.bag || {}, balls = (bag.poke || 0) + (bag.great || 0) + (bag.ultra || 0);
  var left = s.wild ? Number(s.wild.left) || 0 : 0;
  var rows = [];
  if (!balls && s.today < s.cap) rows.push(['openAllModesScreen', '["solo"]', 'Gagner des Balls : encore ' + (s.cap - s.today) + ' sur ' + s.cap + ' aujourd\u2019hui', 'Jeux « +1 Ball » →']);
  var c = s.coins;
  if (!left && c && c.enabled && Number(c.rechargeLeft) > 0) rows.push(['openShop', '', 'Recharger ' + (Number(s.wild && s.wild.nextCount) || 4) + ' rencontres', Number(c.rechargePrice) + ' ₽']);
  var e = typeof expeditionState !== 'undefined' ? expeditionState : null;
  if (e && (e.chests || []).some(function (x) { return x.canClaim; })) rows.push(['openExpedition', '', 'Un coffre d\u2019Expédition à ouvrir', 'Ouvrir →']);
  var html = (balls && left) || !rows.length ? '' : '<div class="hv4-alt"><span>Ce qui reste possible maintenant :</span>' + rows.map(function (r) {
    return '<button type="button" data-action="' + r[0] + '"' + (r[1] ? " data-args='" + r[1] + "'" : '') + '><b>' + hv4Esc(r[2]) + '</b><em>' + hv4Esc(r[3]) + '</em></button>';
  }).join('') + '</div>';
  var box = card.querySelector('.hv4-alt');
  if (!html) { if (box) box.remove(); return; }
  if (box && box.dataset.h === html) return;
  if (box) box.remove();
  var host = card.querySelector('.hs-capture') || card;
  host.insertAdjacentHTML('beforeend', html);
  card.querySelector('.hv4-alt').dataset.h = html;
}
function hv4Layout() {
  var screen = hv4Screen();
  if (!screen) return;
  screen.classList.add('hv4');
  var row = hv4Row();
  if (!row) return;
  var authed = hv4Authed();
  screen.classList.toggle('hv4-guest', !authed);
  var balls = document.getElementById('home-balls'), exp = document.getElementById('exp2-home');
  var week = hv4Week();
  var main = row.querySelector('.hv4-main');
  if (!main) { row.innerHTML = '<div class="hv4-main"></div><div class="hv4-sub"></div><div class="hv4-guest-box"></div>'; main = row.querySelector('.hv4-main'); }
  // Les blocs existants entrent dans la rangée (déplacés, jamais recopiés).
  if (authed) {
    if (balls && balls.parentElement !== main) main.appendChild(balls);
  }
  if (exp && exp.parentElement !== main) main.appendChild(exp);
  if (week && week.parentElement !== main) main.appendChild(week);
  // Visiteur : la carte « Joue, gagne des Balls, attrape » rejoint « Avec un compte gratuit » (après les mini-jeux).
  if (!authed && balls && balls.parentElement !== row) row.insertBefore(balls, row.querySelector('.hv4-guest-box'));
  var sub = row.querySelector('.hv4-sub'), html = authed ? hv4Dex() + hv4Rewards() : '';
  if (sub.dataset.h !== html) { sub.innerHTML = html; sub.dataset.h = html; }
  var gb = row.querySelector('.hv4-guest-box'), gh = authed ? '' : hv4Why();
  if (gb.dataset.h !== gh) { gb.innerHTML = gh; gb.dataset.h = gh; }
  hv4CaptureAlt();
  row.classList.toggle('has-balls', Boolean(authed && balls));
  row.classList.toggle('has-exp', Boolean(authed && exp));
}

function hv4Refresh() {
  try { hv4Lang(); hv4Hero(); hv4Filters(); hv4Discovery(); hv4Layout(); } catch (_e) {}
}
// Les rendus d'origine se font en premier ; la V4 range ensuite.
['renderDailyHero', 'applyDailyHomeSummary', 'renderBallHomeCard', 'renderHomeDiscovery', 'goToConfig'].forEach(function (name) {
  if (typeof window[name] !== 'function') return;
  var before = window[name];
  window[name] = function () { var out = before.apply(this, arguments); hv4Refresh(); return out; };
});
if (typeof filterHomeGames === 'function') {
  var filterHomeGamesBeforeV4 = filterHomeGames;
  filterHomeGames = function () { hv4.filter = 'popular'; var out = filterHomeGamesBeforeV4.apply(this, arguments); hv4Refresh(); return out; };
}
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('pokedle:auth-ready', function () { setTimeout(hv4Refresh, 300); setTimeout(hv4Refresh, 3000); });
}
(function hv4Boot() {
  var go = function () { hv4Carousel(); hv4Refresh(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
window.hv4FriendsFilter = hv4FriendsFilter;
