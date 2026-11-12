// 📱 Accueil téléphone « appli » (12/11/2026, maquette validée par Kayan : « Go appli »).
// Sur téléphone, l'accueil empilait 9 cartes. Il devient 4 rubriques sans cadre, comme une appli :
// - le Défi du jour, plus court (les 4 épreuves en barre, compte à rebours · rappel · classement sur une ligne) ;
// - « Aujourd'hui » : des bulles qui glissent (Cadeau, Hautes herbes, Expédition, Œuf, Ligue, Pokédex, Série)
//   et une ligne « Ta prochaine capture ». Elles remplacent, sur téléphone, les cartes « Joue, gagne des Balls »,
//   « Expédition », « Cette semaine », « Mon Pokédex » et « Récompenses du jour » ;
// - « Mini-jeux » (les tuiles et leurs animations ne changent pas) ;
// - « Entre amis » en une seule carte.
// Rien n'est retiré : les cartes d'origine restent dans la page (PC, lecteurs d'écran, QA) et chaque bulle
// déclenche la même action que la carte qu'elle remplace. Le PC ne change pas (tout est sous 640 px, fin de home-v4.css).

var hva = { counts: null, countsAt: 0 };

function hvaEsc(s) { return typeof escapeHtml === 'function' ? escapeHtml(String(s)) : String(s); }
function hvaNum(n) { return Number(n || 0).toLocaleString('fr-FR'); }
function hvaItem(name) { return 'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/items/' + name + '.png'; }

// Mêmes chiffres que la carte « Mon Pokédex » (hv4Dex) : vus et attrapés. Recalculés au plus toutes les 20 s.
// La zone retenue pour les hautes herbes ; « au hasard » prend le décor de la prairie.
function hvaZone() {
  var key = typeof wildZoneRemembered === 'function' ? wildZoneRemembered() : '';
  var zone = typeof wildZoneOf === 'function' ? wildZoneOf(key) : null;
  return { name: zone ? zone.name : 'Au hasard', img: '/img/zones/' + (zone ? zone.key : 'prairie') + '.png' };
}
function hvaDexCounts() {
  if (hva.counts && Date.now() - hva.countsAt < 20000) return hva.counts;
  if (typeof pokedexCollectionBaseCatalogue !== 'function') return null;
  var base = pokedexCollectionBaseCatalogue(), loaded = typeof wildCaptures !== 'undefined' && wildCaptures !== null;
  var seen = 0, caught = 0;
  base.forEach(function (p) {
    var st = typeof pokedexCollectionState === 'function' ? pokedexCollectionState(p) : { kind: '' };
    var own = loaded && typeof colIsObtained === 'function' && colIsObtained(p);
    if (st.kind === 'registered' || own) seen++;
    if (own) caught++;
  });
  hva.counts = { seen: seen, caught: caught, total: base.length || 1025, loaded: loaded };
  hva.countsAt = Date.now();
  return hva.counts;
}

function hvaBubble(o) {
  var args = o.args ? " data-args='" + o.args + "'" : '';
  var ring = o.pct != null ? '<i class="hva-ring" style="--p:' + Math.max(0, Math.min(100, o.pct)) + '%" aria-hidden="true"></i>' : '';
  var badge = o.badge ? '<em class="hva-badge" aria-hidden="true">' + hvaEsc(o.badge) + '</em>' : '';
  var art = o.zone ? '<img class="hva-zone" src="' + o.zone + '" alt="" width="62" height="62" decoding="async">'
    : '<img src="' + o.img + '" alt="" width="40" height="40" decoding="async">';
  return '<button type="button" class="hva-bub' + (o.hot ? ' is-hot' : '') + '" data-action="' + o.action + '"' + args +
    ' aria-label="' + hvaEsc(o.label + ' : ' + o.line) + '"><span class="hva-c">' + ring + art + badge + '</span><b>' + hvaEsc(o.label) + '</b><small>' + hvaEsc(o.line) + '</small></button>';
}

function hvaBubbles() {
  var s = typeof ballState !== 'undefined' ? ballState : null;
  var authed = typeof hv4Authed === 'function' ? hv4Authed() : Boolean(window.__pokedleAuthed);
  var list = [];
  if (s && s.giftAvailable) list.push({ action: 'claimBallGift', img: hvaItem('poke-ball'), label: 'Cadeau', line: 'à ouvrir', hot: true, badge: '1' });
  var left = s && typeof ballGrassLeft === 'function' ? ballGrassLeft(s) : 0;
  var zoneImg = hvaZone().img;
  if (s) list.push({ action: 'openWildGrass', zone: zoneImg, label: 'Herbes', line: left ? left + ' rencontre' + (left > 1 ? 's' : '') : 'plus tard', hot: left > 0 && typeof ballTotal === 'function' && ballTotal(s) > 0, badge: left ? String(left) : '' });
  var e = typeof expeditionState !== 'undefined' ? expeditionState : null;
  if (e && e.goal) {
    var chest = (e.chests || []).some(function (x) { return x.canClaim; });
    list.push({ action: 'openExpedition', img: hvaItem('explorer-kit'), label: 'Expédition', line: chest ? 'coffre prêt' : Math.min(e.progress, e.goal) + ' / ' + e.goal, pct: Math.round(Math.min(e.progress, e.goal) / e.goal * 100), hot: chest, badge: chest ? '!' : '' });
  }
  list.push({ action: 'openEggGame', img: hvaItem('mystery-egg'), label: 'Œuf', line: 'de la semaine' });
  try {
    if (typeof weeklyLeagueState === 'function') {
      var lg = weeklyLeagueState();
      list.push({ action: 'openWeeklyLeague', img: hvaItem('amulet-coin'), label: 'Ligue', line: lg.completed + ' / 3', pct: Math.round(lg.completed / 3 * 100) });
    }
  } catch (_e) {}
  var dex = hvaDexCounts();
  if (dex) list.push({ action: 'openAlbumBinder', img: hvaItem('poke-radar'), label: 'Pokédex', line: hvaNum(dex.seen) + ' / ' + hvaNum(dex.total) });
  if (s && s.streak && s.streak.days) list.push({ action: 'openBallBag', img: hvaItem('ultra-ball'), label: 'Série', line: s.streak.days + ' jour' + (s.streak.days > 1 ? 's' : '') });
  if (!authed) list.push({ action: 'openLoginWelcome', img: hvaItem('town-map'), label: 'Mon compte', line: 'gratuit' });
  return list.map(hvaBubble).join('');
}

// « Ta prochaine capture » en une ligne : ce qui est vraiment possible maintenant.
function hvaCapture() {
  var s = typeof ballState !== 'undefined' ? ballState : null;
  if (!s) return '';
  var balls = typeof ballTotal === 'function' ? ballTotal(s) : 0;
  var left = typeof ballGrassLeft === 'function' ? ballGrassLeft(s) : 0;
  var zone = hvaZone(), img = zone.img;
  var coins = s.coins && s.coins.enabled ? Number(s.coins.balance) : NaN;
  var price = (s.coins && s.coins.prices && Number(s.coins.prices.poke)) || 50;
  var title = 'Ta prochaine capture', line, action = 'openWildGrass', go = 'Y aller';
  if (s.giftAvailable && !balls) { line = 'Ouvre ta Poké Ball offerte pour commencer'; action = 'claimBallGift'; go = 'Ouvrir'; }
  else if (!balls && coins >= price && left > 0) { line = 'Plus de Balls · ' + hvaNum(coins) + ' ₽ pour en acheter'; action = 'openShop'; go = 'Boutique'; }
  else if (!balls) { line = 'Gagne des Balls : 1re partie du jour des jeux « +1 Ball »'; action = 'openAllModesScreen'; go = 'Jouer'; }
  else if (!left) { line = balls + ' Ball' + (balls > 1 ? 's' : '') + ' · plus de rencontres pour l’instant'; go = 'Voir'; }
  else line = balls + ' Ball' + (balls > 1 ? 's' : '') + ' · ' + left + ' rencontre' + (left > 1 ? 's' : '') + (zone ? ' · ' + zone.name : '');
  var args = action === 'openAllModesScreen' ? " data-args='[\"solo\"]'" : '';
  return '<button type="button" class="hva-cap" data-action="' + action + '"' + args + '><img src="' + img + '" alt="" width="58" height="44" decoding="async">' +
    '<span><b>' + title + '</b><small>' + hvaEsc(line) + '</small></span><em>' + go + '</em></button>';
}

function hvaToday() {
  var hero = document.getElementById('daily-hero');
  if (!hero) return;
  var box = document.getElementById('hva-today');
  if (!box) {
    box = document.createElement('section');
    box.id = 'hva-today';
    box.className = 'hva-today';
    box.setAttribute('aria-labelledby', 'hva-today-title');
    box.innerHTML = '<div class="hva-head"><h2 id="hva-today-title">Aujourd’hui</h2><button type="button" class="hva-more" data-action="openBallBag">Mon sac ›</button></div>' +
      '<div class="hva-bubs" role="list"></div><div class="hva-capbox"></div>';
    hero.after(box);
  }
  var html = hvaBubbles();
  var bubs = box.querySelector('.hva-bubs');
  if (bubs.dataset.h !== html) { bubs.innerHTML = html; bubs.dataset.h = html; }
  var cap = hvaCapture(), capBox = box.querySelector('.hva-capbox');
  if (capBox.dataset.h !== cap) { capBox.innerHTML = cap; capBox.dataset.h = cap; }
}

// Titres courts des rubriques (le titre d'origine reste pour Google et les lecteurs d'écran).
function hvaHeads() {
  var head = document.querySelector('#screen-config .home-discovery-head');
  if (head && !head.querySelector('.hva-h')) head.insertAdjacentHTML('afterbegin', '<span class="hva-h" aria-hidden="true">Mini-jeux</span>');
  var party = document.getElementById('home-party');
  if (party && !document.getElementById('hva-party-head')) {
    party.insertAdjacentHTML('beforebegin', '<div id="hva-party-head" class="hva-phead"><span class="hva-h" aria-hidden="true">Entre amis</span><button type="button" class="hva-more" data-action="openMyFriends">Mes amis ›</button></div>');
  }
}

function hvaRefresh() {
  try {
    var screen = document.getElementById('screen-config');
    if (!screen) return;
    screen.classList.add('hva');
    hvaToday();
    hvaHeads();
  } catch (_e) {}
}

if (typeof hv4Refresh === 'function') {
  var hv4RefreshBeforeApp = hv4Refresh;
  hv4Refresh = function () { var out = hv4RefreshBeforeApp.apply(this, arguments); hvaRefresh(); return out; };
}
(function hvaBoot() {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hvaRefresh); else hvaRefresh();
})();
