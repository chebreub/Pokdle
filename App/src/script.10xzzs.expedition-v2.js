// 🧭 Expédition v2 (8/11/2026, maquette validée par Kayan : « go expé »).
// Kayan : « l'icône rencontre est pas belle », « l'événement Terrakium est caché », « l'écran Expédition est pas bien ».
// - « Ta prochaine capture » : le décor de ta zone, un Pokémon caché dans l'herbe, les vraies Balls ;
// - l'Expédition a sa propre carte sur l'accueil, avec son légendaire (avant : cachée dans « Aussi aujourd'hui ») ;
// - « Aussi aujourd'hui » devient 4 tuiles (Œuf, Ligue, Série, Sac), sans fenêtre ; le cadeau du jour garde sa ligne ;
// - l'écran Expédition : le légendaire sur le décor de son type, une seule barre avec les coffres, la semaine en
//   7 cases, la quête de Draby en étapes.
// Rien ne change côté serveur : mêmes données (ballState, expeditionState, drattakPrestigeState), mêmes boutons.

var EXP2_ITEM = 'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/items/';
var EXP2_TYPE_ZONE = { 'Plante': 'foret', 'Insecte': 'foret', 'Poison': 'foret', 'Eau': 'mer', 'Glace': 'mer', 'Vol': 'mer', 'Roche': 'montagne', 'Sol': 'montagne', 'Acier': 'montagne',
  'Feu': 'volcan', 'Dragon': 'volcan', 'Combat': 'volcan', 'Spectre': 'tour', 'Ténèbres': 'tour', 'Psy': 'tour', 'Normal': 'prairie', 'Électrik': 'prairie', 'Fée': 'prairie' };

function exp2Item(name, size) {
  return '<img class="exp2-it" src="' + EXP2_ITEM + name + '.png" alt="" width="' + (size || 24) + '" height="' + (size || 24) + '" loading="lazy" decoding="async" draggable="false">';
}
function exp2Art(p) {
  // L'artwork officiel (img/art/ n'a pas tous les légendaires de la rotation, Chongjian manquait).
  return p ? pokedexDetailArtwork(p, false) : '';
}
function exp2Zone() {
  var key = typeof wildZoneRemembered === 'function' ? wildZoneRemembered() : 'prairie';
  if (!key || key === 'hasard') key = 'prairie';
  var z = typeof wildZoneOf === 'function' ? wildZoneOf(key) : null;
  return { key: key, img: typeof wildZoneImg === 'function' ? wildZoneImg(key) : '/img/zones/' + key + '.png', mascot: z ? z.mascot : 179 };
}

// --- « Ta prochaine capture » : une petite scène au lieu du trait d'herbe ---
function exp2DecorateCapture() {
  var box = document.querySelector('#home-balls .hs-capture');
  var s = typeof ballState !== 'undefined' ? ballState : null;
  if (!box || !s || box.classList.contains('exp2-capture')) return;
  box.classList.add('exp2-capture');
  var zone = exp2Zone(), p = typeof POKEMON_BY_ID !== 'undefined' ? POKEMON_BY_ID.get(zone.mascot) : null;
  var w = s.wild || {}, balls = ballTotal(s), left = ballGrassLeft(s);
  var title = box.querySelector('strong');
  box.insertAdjacentHTML('afterbegin', '<span class="exp2-scene" style="background-image:url(' + zone.img + ')" aria-hidden="true">' +
    (p ? '<img class="exp2-peek" src="' + escapeHtml(pokedexDetailArtwork(p, false)) + '" alt="" loading="lazy" draggable="false">' : '') +
    '<i class="exp2-alert">!</i><span class="exp2-grass" style="background-image:url(' + zone.img + ')"></span></span>');
  if (title) title.outerHTML = '<span class="exp2-stats"><span>' + (typeof ballImg === 'function' ? ballImg('poke', 24) : '') + balls + ' Ball' + (balls > 1 ? 's' : '') + '</span>' +
    '<span>' + exp2Item('poke-radar') + (w.open ? 'Un Pokémon t’attend' : left + ' rencontre' + (left > 1 ? 's' : '')) + '</span></span>';
  var icon = box.querySelector('.hs-capture-go .hs-ico');
  if (icon && typeof ballImg === 'function') icon.outerHTML = ballImg('poke', 22);
}

// --- La carte Expédition sur l'accueil ---
function exp2HomeCardHtml(e) {
  var p = expeditionLegend(e), name = p ? p.name : 'le légendaire';
  var ready = e.chests.some(function (c) { return c.canClaim; });
  var held = e.legend && e.legend.pending && e.legend.pending.kind === 'legend';
  var caught = e.legend && e.legend.status === 'caught';
  var title = caught ? name + ' attrapé ! 🎉' : held ? name + ' t’attend toujours' : e.legend.available ? name + ' t’attend !' : ready ? 'Un coffre à ouvrir !' : 'Réveiller ' + name;
  var line = (e.progress >= e.goal ? 'Objectif atteint · ' + e.progress + ' participations' : e.progress + ' / ' + e.goal + ' participations') +
    ' · ' + e.myDays.length + ' jour' + (e.myDays.length > 1 ? 's' : '') + ' pour toi';
  var cta = held ? 'Reprendre ma rencontre →' : e.legend.available ? 'Rencontrer ' + name + ' →' : ready ? 'Ouvrir mes coffres →' : 'Voir l’Expédition →';
  return '<button type="button" class="exp2-home' + (caught ? ' is-caught' : '') + (e.legend.available || held ? ' is-hot' : '') + '" data-action="openExpedition">' +
    (p ? '<img class="exp2-home-leg' + (caught || e.legend.available || held ? '' : ' is-shadow') + '" src="' + escapeHtml(exp2Art(p)) + '" alt="" aria-hidden="true" loading="lazy">' : '') +
    '<small>🧭 EXPÉDITION · ' + escapeHtml(e.region.toUpperCase()) + '</small><b>' + escapeHtml(title) + '</b><span class="exp2-home-line">' + escapeHtml(line) + '</span>' +
    '<span class="exp2-home-bar"><i style="width:' + e.pct + '%"></i></span><span class="exp2-home-cta">' + escapeHtml(cta) + '</span></button>';
}
function exp2MountHomeCard() {
  var e = typeof expeditionState !== 'undefined' ? expeditionState : null, card = document.getElementById('home-balls');
  var old = document.getElementById('exp2-home');
  if (!e || !card || !card.parentElement) { if (old) old.remove(); return; }
  var html = exp2HomeCardHtml(e);
  if (!old) { old = document.createElement('div'); old.id = 'exp2-home'; old.className = 'exp2-home-wrap'; }
  if (old.dataset.html !== html) { old.innerHTML = html; old.dataset.html = html; }
  // Juste après le Défi du jour : sur PC elle remplit la colonne de gauche, sur téléphone elle suit « Ta prochaine capture » (ordre CSS).
  var hero = document.getElementById('daily-hero'), anchor = hero && hero.parentElement === card.closest('#screen-config') ? hero : card;
  if (anchor.nextElementSibling !== old) anchor.insertAdjacentElement('afterend', old);
}

// --- « Aussi aujourd'hui » : 4 tuiles, sans fenêtre ---
function exp2DecorateMore() {
  var more = document.querySelector('#home-balls .hs-more');
  var s = typeof ballState !== 'undefined' ? ballState : null;
  if (!more || !s || more.classList.contains('exp2-more')) return;
  more.classList.add('exp2-more');
  // Le cadeau garde sa ligne ; l'album et la porte « Œuf, Ligue, Expédition » deviennent des tuiles.
  more.querySelectorAll('.hs-row').forEach(function (row) {
    var a = row.getAttribute('data-action');
    if (a === 'openHomeDayMore' || a === 'openAlbumBinder' || a === 'openExpedition') row.remove();
  });
  var egg = typeof homeDayEgg !== 'undefined' && homeDayEgg ? homeDayEgg : (typeof eggState !== 'undefined' ? eggState : null);
  var eggLine = egg && egg.solved ? 'trouvé ✓' : 'à deviner';
  var lg = null;
  try { lg = typeof weeklyLeagueState === 'function' ? weeklyLeagueState() : null; } catch (_e) { lg = null; }
  var lgLine = lg ? (lg.mastered && !lg.claimed ? 'badge prêt !' : lg.completed + '/3') : 'la semaine';
  var st = s.streak || {}, every = st.every || 7, done = Math.min(every, st.inCycle || 0);
  var dots = Array.from({ length: every }, function (_, i) { return '<i class="' + (i < done ? 'on' : '') + '"></i>'; }).join('');
  var tiles = '<div class="exp2-tiles">' +
    '<button type="button" data-action="openEggGame">' + exp2Item('oval-stone', 34) + '<b>Œuf</b><small>' + eggLine + '</small></button>' +
    '<button type="button" data-action="openWeeklyLeague">' + exp2Item('gold-bottle-cap', 34) + '<b>Ligue</b><small>' + escapeHtml(lgLine) + '</small></button>' +
    '<button type="button" data-action="openHomeDayMore">' + exp2Item('ultra-ball', 34) + '<b>Série</b><span class="exp2-dots" aria-label="' + done + ' jours sur ' + every + '">' + dots + '</span><small>' + (st.left ? 'encore ' + st.left + ' → Hyper' : 'Hyper Ball au 7e jour') + '</small></button>' +
    '<button type="button" data-action="openBallBag">' + exp2Item('amulet-coin', 34) + '<b>Sac</b><small>' + (s.coins && s.coins.balance != null ? s.coins.balance + ' ₽' : ballTotal(s) + ' Balls') + '</small></button>' +
    '</div>';
  more.insertAdjacentHTML('beforeend', tiles);
}

if (typeof renderBallHomeCard === 'function') {
  var renderBallHomeCardBeforeExp2 = renderBallHomeCard;
  renderBallHomeCard = function () {
    var out = renderBallHomeCardBeforeExp2.apply(this, arguments);
    exp2DecorateCapture();
    exp2DecorateMore();
    exp2MountHomeCard();
    return out;
  };
}

// --- L'écran Expédition ---
function exp2ChestIcon(c) {
  var lid = c.claimed ? '#3E9B57' : c.reached ? '#E8B923' : '#9A8F86';
  return '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="4" y="13" width="24" height="15" rx="3" fill="' + (c.reached || c.claimed ? '#8B5A2B' : '#B9AFA3') + '" stroke="#5C3A17" stroke-width="2"/>' +
    '<path d="M4 13a12 7 0 0 1 24 0z" fill="' + lid + '" stroke="#5C3A17" stroke-width="2"/><rect x="14" y="15" width="4" height="6" rx="1" fill="#FFD45C"/>' +
    (c.claimed ? '<path d="M9 6l3 3M23 6l-3 3M16 3v4" stroke="#3E9B57" stroke-width="2" stroke-linecap="round"/>' : '') + '</svg>';
}
function exp2ScreenTop(e) {
  var p = expeditionLegend(e), name = p ? p.name : 'le légendaire', zone = EXP2_TYPE_ZONE[p && p.type1] || 'montagne';
  var caught = e.legend && e.legend.status === 'caught', hot = e.legend && (e.legend.available || (e.legend.pending && e.legend.pending.kind === 'legend'));
  var week = escapeHtml(e.week.split('-').reverse().slice(0, 2).join('/'));
  var hero = '<div class="exp2-hero" style="background-image:url(/img/zones/' + zone + '.png)">' +
    '<span class="exp2-hero-top"><span>SEMAINE DU ' + week + '</span><span>' + e.participants + ' dresseur' + (e.participants > 1 ? 's' : '') + '</span></span>' +
    (p ? '<img class="exp2-hero-leg' + (caught || hot ? '' : ' is-shadow') + '" src="' + escapeHtml(exp2Art(p)) + '" alt="" aria-hidden="true">' : '') +
    '<span class="exp2-hero-bot"><b>' + escapeHtml(e.region) + ' · ' + escapeHtml(name) + '</b>' +
    (caught ? '<span class="exp2-pill is-ok">' + exp2Item('ultra-ball', 20) + 'Attrapé cette semaine !</span>' : hot ? '<span class="exp2-pill is-hot">👑 Il t’attend !</span>' : '<span class="exp2-pill">À réveiller ensemble</span>') +
    '</span></div>';
  var marks = e.chests.map(function (c) {
    return '<span class="exp2-mark' + (c.claimed ? ' is-open' : c.reached ? ' is-ready' : '') + '" style="left:' + c.tier + '%" title="' + c.tier + ' %">' + exp2ChestIcon(c) +
      '<small>' + c.balls.map(function (b) { return typeof ballImg === 'function' ? ballImg(b, 14) : ''; }).join('') + '</small></span>';
  }).join('') + '<span class="exp2-mark is-crown' + (e.legend.reached ? ' is-ready' : '') + '" style="left:100%" title="100 %"><svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13" fill="' + (e.legend.reached ? '#FFD45C' : '#E7DFD4') + '" stroke="#9A6A00" stroke-width="2"/><path d="M9 20l2-9 5 5 5-5 2 9z" fill="#fff" stroke="#9A6A00" stroke-width="1.5" stroke-linejoin="round"/></svg><small>' + escapeHtml(name) + '</small></span>';
  var claimable = e.chests.filter(function (c) { return c.canClaim; });
  var nBalls = claimable.reduce(function (n, c) { return n + (Number.isInteger(c.remainingBalls) ? c.remainingBalls : c.balls.length); }, 0);
  var goal = '<section class="exp-card exp2-goal"><h4>Objectif de la communauté <em>' + (e.progress >= e.goal ? e.progress + ' / ' + e.goal + ' ✓' : e.progress + ' / ' + e.goal) + '</em></h4>' +
    '<div class="exp2-track" role="img" aria-label="' + e.pct + ' %"><span class="exp2-track-bar"><i style="width:' + e.pct + '%"></i></span>' + marks + '</div>' +
    (nBalls ? '<button type="button" class="ball-gift-cta exp-open" data-action="claimExpeditionChests">Ouvrir mes coffres · +' + nBalls + ' Balls</button>' : '') +
    '<p class="exp-note">25 % : 2 Poké Balls · 50 % : Super + Poké · 75 % : 2 Super · 100 % : une rencontre avec ' + escapeHtml(name) + '. Les coffres non ouverts sont perdus dimanche à minuit.</p></section>';
  var today = typeof getDailyDateKey === 'function' ? getDailyDateKey() : null;
  var days = '<section class="exp-card exp2-week"><h4>Ta participation <em>' + e.myDays.length + ' jour' + (e.myDays.length > 1 ? 's' : '') + '</em></h4><div class="exp2-days">' +
    e.days.map(function (d, i) { var on = e.myDays.indexOf(d) >= 0; return '<span class="' + (on ? 'on' : '') + (d === today ? ' is-today' : '') + '"><i>' + (on ? '✓' : '·') + '</i>' + EXP_DAY_NAMES[i] + '</span>'; }).join('') +
    '</div><p class="exp-note">1 participation = 2 jeux différents joués dans la journée (le cadeau ne compte pas).</p></section>';
  return hero + goal + days;
}
// La quête de Draby : les 3 indices et la capture en 4 étapes, les indices gagnés dans une bulle.
function exp2DecoratePrestige(root) {
  var sec = root.querySelector('.exp-prestige');
  if (!sec || sec.querySelector('.exp2-steps')) return;
  var trials = Array.prototype.slice.call(sec.querySelectorAll('.exp-prestige-trial'));
  if (!trials.length) return;
  var lineage = sec.querySelector('.exp-prestige-lineage');
  var chips = '', clues = '';
  trials.forEach(function (t) {
    var b = (t.querySelector('b') || {}).textContent || '', done = b.indexOf('✅') === 0;
    var m = b.replace(/^[^\wÀ-ÿ]+/, '').match(/^(.*?)\s·\s(\d+\/\d+)/);
    chips += '<span class="' + (done ? 'ok' : '') + '"><b>' + (m ? m[2] : '') + '</b>' + escapeHtml(m ? m[1] : b) + '</span>';
    var span = t.querySelector('span');
    if (done && span) clues += '<p class="exp2-clue">' + escapeHtml(span.textContent) + '</p>';
    t.hidden = true;
  });
  var lineDone = lineage && lineage.textContent.indexOf('✅') >= 0;
  chips += '<span class="' + (lineDone ? 'ok' : '') + '"><b>' + (lineDone ? '✓' : '🔒') + '</b>Lignée</span>';
  var after = lineage || trials[trials.length - 1];
  after.insertAdjacentHTML('afterend', '<div class="exp2-steps">' + chips + '</div>' + clues);
  if (lineage) lineage.classList.add('exp2-lineage');
}
if (typeof expeditionHtml === 'function') {
  var expeditionHtmlBeforeV2 = expeditionHtml;
  expeditionHtml = function (e) {
    var html = expeditionHtmlBeforeV2.apply(this, arguments);
    try {
      var tpl = document.createElement('template');
      tpl.innerHTML = html;
      var root = tpl.content.querySelector('.exp');
      if (!root || !e) return html;
      var cards = root.querySelectorAll(':scope > .exp-card');
      // Le haut de l'écran est refait ; la carte du légendaire et la quête de Draby restent les mêmes (mêmes boutons).
      root.querySelector('.exp-hero')?.remove();
      if (cards[0]) cards[0].remove();
      if (cards[1]) cards[1].remove();
      root.insertAdjacentHTML('afterbegin', exp2ScreenTop(e));
      root.classList.add('exp2');
      exp2DecoratePrestige(root);
      return tpl.innerHTML;
    } catch (_e) { return html; }
  };
}
window.exp2MountHomeCard = exp2MountHomeCard;
