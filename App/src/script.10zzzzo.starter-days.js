// 🌱 « Tes 3 premiers jours » (13/11/2026, maquette validée : « go 2 »).
// Seulement 16 % des nouveaux joueurs revenaient dans la semaine. Un nouveau joueur voit en haut de l'accueil une
// carte avec les étapes du jour ; le serveur les coche avec ce qu'il sait déjà (lib/poke-balls.js, starterOf) et
// donne le cadeau du jour réussi : Super Ball (jour 1), Hyper Ball (jour 2), Évoli dans le Pokédex (jour 3).
// Les jours n'ont pas besoin de se suivre. ✕ cache la carte pour toujours sur cet appareil.
var STARTER_HIDE_KEY = 'pokedle.starterHidden';
var starterUi = { busy: false };

var STARTER_STEPS = {
  daily: function () { return { title: 'Trouve le Pokémon du jour', sub: 'Des indices à chaque essai', action: 'startDailyGame', args: null, cta: 'Jouer' }; },
  mode: function (day) {
    return day === 1 ? { title: 'Gagne une Ball dans un mini-jeu', sub: 'Duel de poids : 20 secondes', action: 'openFromAllModes', args: '["startWeightBattle"]', cta: 'Jouer' }
      : { title: 'Essaie un autre mini-jeu', sub: 'Dernière lettre, Quiz, Classe-les…', action: 'openAllModesScreen', args: null, cta: 'Jouer' };
  },
  capture: function (day) {
    var bag = typeof ballTotal === 'function' ? ballTotal(ballState) : 0;
    return { title: day === 1 ? 'Attrape ton 1er Pokémon' : 'Attrape un Pokémon', sub: bag ? 'Tu as ' + bag + ' Ball' + (bag > 1 ? 's' : '') + ' · dans les hautes herbes' : 'Dans les hautes herbes', action: 'openWildGrass', args: null, cta: 'Aller' };
  }
};
var STARTER_DONE = { daily: 'Pokémon du jour trouvé', mode: 'Ball gagnée dans un mini-jeu', capture: 'Pokémon attrapé' };

function starterEsc(s) { return typeof escapeHtml === 'function' ? escapeHtml(String(s)) : String(s); }
function starterItem(name) { return 'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/items/' + name + '.png'; }
function starterHidden() { try { return localStorage.getItem(STARTER_HIDE_KEY) === '1'; } catch (_e) { return false; } }
function starterGiftLabel(g) {
  if (!g) return '';
  if (g.pokemon) { var p = typeof POKEMON_BY_ID !== 'undefined' ? POKEMON_BY_ID.get(Number(g.pokemon)) : null; return (p ? p.name : 'Évoli') + ' rejoint ton Pokédex'; }
  return g.ball === 'ultra' ? 'une Hyper Ball' : 'une Super Ball';
}
function starterGiftImg(g) {
  if (!g) return '';
  if (g.pokemon) { var p = typeof POKEMON_BY_ID !== 'undefined' ? POKEMON_BY_ID.get(Number(g.pokemon)) : null; return p && typeof getPokemonSprite === 'function' ? getPokemonSprite(p) : ''; }
  return starterItem(g.ball === 'ultra' ? 'ultra-ball' : 'great-ball');
}
function starterDaysHtml(st) {
  var out = '';
  for (var i = 1; i <= st.total; i++) {
    var g = st.gifts[i - 1], passed = i < st.day || (i === st.day && st.claimedToday);
    var label = passed ? 'Jour ' + i + ' ✓' : 'Jour ' + i + '<br>' + (g.pokemon ? starterGiftLabel(g).split(' ')[0] : g.ball === 'ultra' ? 'Hyper Ball' : 'Super Ball');
    out += '<div class="st-day' + (passed ? ' is-ok' : i === st.day || (st.claimedToday && i === st.day + 1) ? ' is-on' : '') + '"><img src="' + starterEsc(starterGiftImg(g)) + '" alt="" width="26" height="26">' + label + '</div>';
  }
  return '<div class="st-days">' + out + '</div>';
}

function starterCardHtml(st) {
  var gift = st.gifts[st.day - 1];
  if (st.claimedToday) {
    var next = st.gifts[st.day];
    var reminder = typeof dailyReminderSaved === 'function' && dailyReminderSaved();
    return '<div class="st-head"><h2>' + (st.finished ? '🎉 Bravo, tu es lancé !' : '✓ Jour ' + st.day + ' réussi') + '</h2><button type="button" class="st-x" data-action="hideStarterCard" aria-label="Masquer">✕</button></div>' +
      '<p class="st-lead">' + (st.finished ? 'Tes 3 premiers jours sont finis. Le Pokémon du jour change chaque jour à minuit.' : 'Reviens demain pour la suite : ' + starterGiftLabel(next) + ' t’attend.') + '</p>' +
      starterDaysHtml(st) + (st.finished || reminder ? '' : '<button type="button" class="btn-blue st-cta" data-action="openDailyReminder">🔔 Me rappeler demain</button>');
  }
  var left = st.steps.filter(function (s) { return !s.done; }).length;
  var title = st.day === 1 ? (left === st.steps.length ? '👋 Bienvenue !' : '👋 Bien parti !') : '🔥 Te revoilà !';
  var lead = st.claimable ? 'Bravo, tout est fait !' : st.day === 1 ? (left === st.steps.length ? '3 petites étapes pour bien démarrer :' : 'Plus que ' + left + ' étape' + (left > 1 ? 's' : '') + ' pour ' + starterGiftLabel(gift) + '.') : 'Le Pokémon du jour a changé. Finis ta journée :';
  var firstOpen = -1;
  var steps = st.steps.map(function (s, i) {
    var info = STARTER_STEPS[s.key](st.day);
    if (!s.done && firstOpen < 0) firstOpen = i;
    return '<div class="st-step' + (s.done ? ' is-done' : firstOpen === i ? ' is-now' : '') + '"><span class="st-n">' + (s.done ? '✓' : i + 1) + '</span>' +
      '<span class="st-txt"><b>' + starterEsc(s.done ? STARTER_DONE[s.key] : info.title) + '</b>' + (s.done ? '' : '<small>' + starterEsc(info.sub) + '</small>') + '</span>' +
      (s.done ? '<span class="st-go is-done">Fait</span>' : '<button type="button" class="st-go" data-action="' + info.action + '"' + (info.args ? ' data-args=\'' + info.args + '\'' : '') + '>' + info.cta + '</button>') + '</div>';
  }).join('');
  var foot = st.claimable
    ? '<button type="button" class="btn-blue st-cta st-claim" data-action="claimStarterGift"><img src="' + starterEsc(starterGiftImg(gift)) + '" alt="" width="26" height="26"> Récupérer ' + starterEsc(gift.pokemon ? 'mon cadeau' : starterGiftLabel(gift).replace(/^une /, 'ma ')) + '</button>'
    : '<div class="st-gift"><img src="' + starterEsc(starterGiftImg(gift)) + '" alt="" width="30" height="30">' + (st.steps.length === 3 ? 'Les 3 faits' : 'Les 2 faits') + ' : ' + starterEsc(starterGiftLabel(gift)) + '</div>';
  return '<div class="st-head"><h2>' + title + '</h2><span class="st-badge">Jour ' + st.day + ' / ' + st.total + '</span><button type="button" class="st-x" data-action="hideStarterCard" aria-label="Masquer">✕</button></div>' +
    '<p class="st-lead">' + lead + '</p>' + steps + foot + (st.day > 1 ? starterDaysHtml(st) : '');
}

function renderStarterCard() {
  var st = typeof ballState !== 'undefined' && ballState ? ballState.starter : null;
  var card = document.getElementById('starter-card');
  if (!st || starterHidden()) { if (card) card.remove(); return; }
  var hero = document.getElementById('daily-hero');
  if (!hero || !hero.parentNode) return;
  if (!card) {
    card = document.createElement('section');
    card.id = 'starter-card'; card.className = 'starter-card'; card.setAttribute('aria-label', 'Tes 3 premiers jours');
    hero.parentNode.insertBefore(card, hero);
  }
  var html = starterCardHtml(st);
  if (card.dataset.html !== html) { card.innerHTML = html; card.dataset.html = html; }
  // Sur PC, les étapes se mettent côte à côte (2 ou 3 colonnes).
  card.style.setProperty('--st-n', String(st.steps ? st.steps.length : 1));
}

function hideStarterCard() {
  try { localStorage.setItem(STARTER_HIDE_KEY, '1'); } catch (_e) { /* mode privé */ }
  var card = document.getElementById('starter-card');
  if (card) card.remove();
}

async function claimStarterGift() {
  if (starterUi.busy || typeof ballFetch !== 'function') return;
  var before = ballState && ballState.starter;
  starterUi.busy = true;
  var data = await ballFetch('/api/starter/claim', {});
  starterUi.busy = false;
  if (!data || !data.ok) { if (typeof showToast === 'function') showToast('Cadeau pas encore prêt : finis les étapes du jour.'); if (typeof refreshBalls === 'function') refreshBalls({ announce: false }); return; }
  if (typeof ballApply === 'function') ballApply(data, { announce: false });
  // Évoli rejoint l'album tout de suite (même chemin qu'une capture faite sur un autre appareil).
  if (data.starterClaimed && data.starterClaimed.pokemon && Array.isArray(data.captures) && typeof wildSyncAlbum === 'function') { try { wildSyncAlbum(data.captures); } catch (_e) { /* album */ } }
  starterCelebrate(data.starter || before, data.starterClaimed);
}

function starterCelebrate(st, claimed) {
  if (!st || !claimed || typeof ensureOverlay !== 'function') return;
  var gift = st.gifts[claimed.day - 1], next = st.gifts[claimed.day];
  var reminder = typeof dailyReminderSaved === 'function' && dailyReminderSaved();
  var img = starterGiftImg(gift);
  var body = '<div class="st-party' + (document.documentElement.classList.contains('reduce-motion') ? '' : ' is-anim') + '">' +
    '<img class="st-party-gift" src="' + starterEsc(img) + '" alt="" width="' + (gift.pokemon ? 120 : 64) + '" height="' + (gift.pokemon ? 120 : 64) + '">' +
    '<h3>' + (claimed.day >= st.total ? 'Tes 3 premiers jours sont réussis ! 🎉' : 'Journée ' + claimed.day + ' réussie ! 🎉') + '</h3>' +
    '<p>' + (gift.pokemon ? starterEsc(starterGiftLabel(gift)) + ' !' : '+1 ' + (gift.ball === 'ultra' ? 'Hyper Ball' : 'Super Ball') + ' dans ton sac.') + (next ? ' Reviens demain : ' + starterEsc(starterGiftLabel(next)) + '.' : '') + '</p>' +
    starterDaysHtml(st) +
    '<div class="st-party-actions">' + (next && !reminder ? '<button type="button" class="btn-blue" data-action="openDailyReminder">🔔 Me rappeler demain</button>' : '') +
    (typeof openInstallApp === 'function' && !(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ? '<button type="button" class="btn-ghost" data-action="openInstallApp">📲 Installer l’appli</button>' : '') +
    '<button type="button" class="btn-ghost" data-action="closeOverlayModal">Continuer</button></div></div>';
  ensureOverlay(claimed.day >= st.total ? 'Bienvenue parmi les dresseurs' : 'Cadeau du jour ' + claimed.day, body);
}

var ballApplyBeforeStarter = ballApply;
ballApply = function () {
  var out = ballApplyBeforeStarter.apply(this, arguments);
  try { renderStarterCard(); } catch (_e) { /* accueil */ }
  return out;
};

window.hideStarterCard = hideStarterCard;
window.claimStarterGift = claimStarterGift;
window.ballApply = ballApply;
