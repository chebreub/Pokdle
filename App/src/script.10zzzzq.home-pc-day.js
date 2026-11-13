// 🖥️ Accueil PC « A » (13/11/2026, maquette A validée : « ok a »).
// Kayan trouvait l'accueil PC trop chargé : 7 cadres de 5 couleurs. Sur un écran d'au moins 1 280 px :
// - à gauche, le Défi du jour puis les mini-jeux et la Party Room ;
// - à droite, sous « Défie tes amis », UN seul panneau blanc « Ta journée », une ligne par chose (capture,
//   Expédition, cadeau, Œuf, Ligue, Pokédex, série, Balls du jour), avec des objets du jeu comme icônes.
// Il remplace à l'écran les cartes « Ta prochaine capture », « Expédition », « Cette semaine », « Mon Pokédex »
// et « Récompenses du jour », qui restent dans la page (téléphone, tablette, lecteurs d'écran) ; chaque ligne
// déclenche la même action que la carte qu'elle remplace. Mêmes chiffres que les bulles du téléphone (home-app).
// Téléphone et tablette ne changent pas (tout est sous @media (min-width:1280px), fin de home-v4.css).

function hpdEsc(s) { return typeof escapeHtml === 'function' ? escapeHtml(String(s)) : String(s); }
function hpdNum(n) { return Number(n || 0).toLocaleString('fr-FR'); }
function hpdItem(name) { return 'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/items/' + name + '.png'; }
function hpdPlural(n, word) { return n + ' ' + word + (n > 1 ? 's' : ''); }

function hpdRow(o) {
  var args = o.args ? " data-args='" + o.args + "'" : '';
  var bar = o.pct != null ? '<i class="hpd-bar"><u style="width:' + Math.max(0, Math.min(100, o.pct)) + '%"></u></i>' : '';
  var ico = o.art ? '<img class="hpd-art' + (o.shadow ? ' is-shadow' : '') + '" src="' + hpdEsc(o.art) + '" alt="" width="40" height="40" loading="lazy" decoding="async">'
    : '<img src="' + hpdEsc(o.img) + '" alt="" width="32" height="32" loading="lazy" decoding="async">';
  return '<button type="button" class="hpd-row' + (o.hot ? ' is-hot' : '') + '" data-action="' + o.action + '"' + args + '>' +
    '<span class="hpd-ico">' + ico + '</span><span class="hpd-t"><b>' + hpdEsc(o.title) + '</b><small>' + hpdEsc(o.line) + '</small>' + bar + '</span>' +
    '<em' + (o.go ? '' : ' class="hpd-chev" aria-hidden="true"') + '>' + hpdEsc(o.go || '›') + '</em></button>';
}

// « Ta prochaine capture » : le décor de la zone retenue et ce qui est vraiment possible maintenant.
function hpdCapture(s) {
  if (!s) return '';
  var balls = typeof ballTotal === 'function' ? ballTotal(s) : 0;
  var left = typeof ballGrassLeft === 'function' ? ballGrassLeft(s) : 0;
  var zone = typeof hvaZone === 'function' ? hvaZone() : { name: '', img: '/img/zones/prairie.png' };
  var coins = s.coins && s.coins.enabled ? Number(s.coins.balance) : NaN;
  var price = (s.coins && s.coins.prices && Number(s.coins.prices.poke)) || 50;
  var open = s.wild && s.wild.open;
  var line, action = 'openWildGrass', go = '🌿 Hautes herbes', args = '';
  if (s.giftAvailable && !balls) { line = 'Ouvre ta Poké Ball offerte pour commencer'; action = 'claimBallGift'; go = 'Ouvrir le cadeau'; }
  else if (open) line = 'Un Pokémon t’attend · ' + hpdPlural(balls, 'Ball');
  else if (!balls && coins >= price && left > 0) { line = 'Plus de Balls · ' + hpdNum(coins) + ' ₽ pour en acheter'; action = 'openShop'; go = '🏪 Boutique'; }
  else if (!balls) { line = 'Gagne des Balls : 1re partie du jour des jeux « +1 Ball »'; action = 'openAllModesScreen'; go = 'Jouer'; args = '["solo"]'; }
  else if (!left) line = hpdPlural(balls, 'Ball') + ' · plus de rencontres pour l’instant';
  else line = hpdPlural(balls, 'Ball') + ' · ' + hpdPlural(left, 'rencontre') + (zone.name ? ' · ' + zone.name : '');
  return '<div class="hpd-cap"><span class="hpd-zone" style="background-image:url(' + hpdEsc(zone.img) + ')" aria-hidden="true"><i>!</i></span>' +
    '<span class="hpd-t"><b>Ta prochaine capture</b><small>' + hpdEsc(line) + '</small>' +
    '<button type="button" class="hpd-go" data-action="' + action + '"' + (args ? " data-args='" + args + "'" : '') + '>' + hpdEsc(go) + '</button></span></div>';
}

function hpdRows(s) {
  var rows = [];
  var authed = typeof hv4Authed === 'function' ? hv4Authed() : Boolean(window.__pokedleAuthed);
  if (s && s.giftAvailable && typeof ballTotal === 'function' && ballTotal(s) > 0) rows.push({ action: 'claimBallGift', img: hpdItem('poke-ball'), title: 'Cadeau du jour', line: '1 Poké Ball à ouvrir', go: 'Ouvrir', hot: true });
  var e = typeof expeditionState !== 'undefined' ? expeditionState : null;
  if (e && e.goal) {
    var p = typeof expeditionLegend === 'function' ? expeditionLegend(e) : null, name = p ? p.name : 'le légendaire';
    var chest = (e.chests || []).some(function (x) { return x.canClaim; });
    var held = e.legend && e.legend.pending && e.legend.pending.kind === 'legend';
    var caught = e.legend && e.legend.status === 'caught', meet = e.legend && e.legend.available;
    var art = p && typeof pokedexDetailArtwork === 'function' ? pokedexDetailArtwork(p, false) : '';
    rows.push({
      action: 'openExpedition', art: art || null, img: hpdItem('explorer-kit'), shadow: !(caught || meet || held),
      title: 'Expédition · ' + (caught ? name + ' attrapé' : name),
      line: held ? name + ' t’attend toujours' : meet ? name + ' t’attend !' : chest ? 'Un coffre à ouvrir !' : Math.min(e.progress, e.goal) + ' / ' + e.goal + ' participations',
      pct: Math.round(Math.min(e.progress, e.goal) / e.goal * 100), hot: chest || meet || held, go: chest ? 'Ouvrir' : meet || held ? 'Rencontrer' : ''
    });
  }
  rows.push({ action: 'openEggGame', img: hpdItem('mystery-egg'), title: 'Œuf mystère', line: 'Un indice par jour · de la semaine', go: 'Ouvrir' });
  try {
    if (typeof weeklyLeagueState === 'function') {
      var lg = weeklyLeagueState();
      rows.push({ action: 'openWeeklyLeague', img: hpdItem('amulet-coin'), title: 'Ligue · ' + hpdNum(lg.score) + ' pts', line: lg.completed + ' / 3 disciplines cette semaine', pct: Math.round(lg.completed / 3 * 100) });
    }
  } catch (_e) { /* ligue */ }
  var dex = typeof hvaDexCounts === 'function' ? hvaDexCounts() : null;
  if (dex) {
    var album = '';
    try {
      var goal = typeof albumNextGoal === 'function' && typeof albumDiscoveries === 'function' && Object.keys(albumDiscoveries()).length ? albumNextGoal() : null;
      if (goal) album = goal.stats.name + ' ' + goal.stats.found + '/' + goal.stats.total + ' · encore ' + goal.left + ' pour ' + goal.tier.icon;
    } catch (_e) { /* album */ }
    rows.push({ action: 'openAlbumBinder', img: hpdItem('poke-radar'), title: 'Pokédex · ' + hpdNum(dex.seen) + ' vus' + (dex.loaded ? ' · ' + hpdNum(dex.caught) + ' attrapés' : ''), line: album || hpdNum(dex.seen) + ' / ' + hpdNum(dex.total) + ' Pokémon' });
  }
  if (s && s.streak && s.streak.days) {
    var every = s.streak.every || 7, left = every - Math.min(every, s.streak.inCycle || 0);
    rows.push({ action: 'openBallBag', img: hpdItem('ultra-ball'), title: 'Série de ' + hpdPlural(Number(s.streak.days), 'jour'), line: left ? 'Hyper Ball dans ' + hpdPlural(left, 'jour') : 'Hyper Ball gagnée aujourd’hui' });
  }
  if (s && s.cap) {
    var coins = s.coins && s.coins.enabled ? Number(s.coins.balance) : NaN;
    rows.push({ action: 'openBallBag', img: hpdItem('poke-ball'), title: s.today + ' / ' + s.cap + ' Balls du jour' + (Number.isFinite(coins) ? ' · ' + hpdNum(coins) + ' ₽' : ''),
      line: s.today >= s.cap ? 'Les jeux restent là pour le plaisir' : 'Encore ' + (s.cap - s.today) + ' à gagner aujourd’hui', go: 'Mon sac' });
  }
  if (!authed) rows.push({ action: 'openLoginWelcome', img: hpdItem('town-map'), title: 'Mon compte gratuit', line: 'Ta progression te suit partout', go: 'Créer' });
  return rows.map(hpdRow).join('');
}

function hpdRender() {
  var side = document.getElementById('hm-side');
  var screen = document.getElementById('screen-config');
  if (!side || !screen) return;
  screen.classList.add('hpd');
  var box = document.getElementById('hpd-day');
  if (!box) {
    box = document.createElement('section');
    box.id = 'hpd-day';
    box.className = 'hpd-day';
    box.setAttribute('aria-label', 'Ta journée');
    box.innerHTML = '<span class="hpd-k">Ta journée</span><div class="hpd-capbox"></div><div class="hpd-rows"></div>';
    side.appendChild(box);
  } else if (box.parentElement !== side) side.appendChild(box);
  var s = typeof ballState !== 'undefined' ? ballState : null;
  var cap = hpdCapture(s), capBox = box.querySelector('.hpd-capbox');
  if (capBox.dataset.h !== cap) { capBox.innerHTML = cap; capBox.dataset.h = cap; }
  var html = hpdRows(s), rows = box.querySelector('.hpd-rows');
  if (rows.dataset.h !== html) { rows.innerHTML = html; rows.dataset.h = html; }
}

if (typeof hv4Refresh === 'function') {
  var hv4RefreshBeforePcDay = hv4Refresh;
  hv4Refresh = function () { var out = hv4RefreshBeforePcDay.apply(this, arguments); try { hpdRender(); } catch (_e) { /* accueil PC */ } return out; };
}
(function hpdBoot() {
  var go = function () { try { hpdRender(); } catch (_e) { /* accueil PC */ } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('pokedle:auth-ready', function () { setTimeout(go, 400); setTimeout(go, 3200); });
})();
