
// ===== 📒 Mon album : un classeur par région, des médailles (01/11/2026) =====
// Idea seen on HoloPocket (binders born full of reserved places), told the Pokédle way: each
// Pokémon of a region has its place in Pokédex order, filled once it is found in a game. Nothing
// to buy, no energy: a Pokémon is still found by guessing it. 🥉 at a quarter of a region, 🥈 at
// half, 🥇 complete (the existing +1 000 XP of a complete region). The medals are kept in the
// profile (albumMedals, « gen:tier »), so they follow the account and show on the trainer card.
var ALBUM_PAGE = 9;
var ALBUM_TIERS = [
  { key: 'b', pct: 25, icon: '🥉', name: 'de bronze', xp: 100 },
  { key: 's', pct: 50, icon: '🥈', name: 'd’argent', xp: 200 },
  { key: 'g', pct: 100, icon: '🥇', name: 'd’or', xp: 0 }, // a complete region already gives +1 000 XP
];
var albumView = { tab: 'binder', gen: 1, page: 0 };

function albumRegionName(gen) {
  return (typeof POKEDEX_COLLECTION_REGIONS !== 'undefined' ? POKEDEX_COLLECTION_REGIONS[gen - 1] : null) || ('Génération ' + gen);
}
function albumRegionList(gen) {
  var list = typeof pokedexCollectionBaseCatalogue === 'function' ? pokedexCollectionBaseCatalogue() : [];
  return list.filter(function (p) { return Number(p.gen) === Number(gen); }).sort(function (a, b) { return (a.baseId || a.id) - (b.baseId || b.id); });
}
function albumDiscoveries() {
  return (typeof playerProfile !== 'undefined' && playerProfile && playerProfile.discoveries) || {};
}
function albumStats(gen) {
  var list = albumRegionList(gen), found = albumDiscoveries();
  var have = 0, shinies = 0;
  list.forEach(function (p) { var e = found[p.id]; if (e) { have += 1; if (e.shiny) shinies += 1; } });
  var total = list.length;
  return { gen: gen, name: albumRegionName(gen), found: have, total: total, shinies: shinies, percent: total ? Math.floor(have / total * 100) : 0 };
}
// How many Pokémon a tier needs in a region (a quarter is rounded up: 38 of 151 for 🥉).
function albumTierNeed(tier, total) { return Math.ceil(total * tier.pct / 100); }
function albumTierReached(tier, s) { return s.total > 0 && s.found >= albumTierNeed(tier, s.total); }
function albumBestTier(s) {
  var best = null;
  ALBUM_TIERS.forEach(function (t) { if (albumTierReached(t, s)) best = t; });
  return best;
}
function albumNextTier(s) {
  return ALBUM_TIERS.find(function (t) { return !albumTierReached(t, s); }) || null;
}
// The closest medal to win, for the home strip: « Encore 4 pour 🥉 Kalos ».
function albumNextGoal() {
  var best = null;
  for (var gen = 1; gen <= 9; gen++) {
    var s = albumStats(gen), next = albumNextTier(s);
    if (!next || !s.total) continue;
    var left = albumTierNeed(next, s.total) - s.found;
    // A region already started comes first: « encore 25 pour 🥉 Johto » means little with 0 found there.
    var started = s.found > 0, bestStarted = Boolean(best && best.stats.found > 0);
    var better = !best || (started && !bestStarted) || (started === bestStarted && (left < best.left || (left === best.left && s.found > best.stats.found)));
    if (better) best = { left: left, tier: next, stats: s };
  }
  return best;
}

// ---- medals: claimed once, XP once
function albumClaimMedals(silent) {
  if (typeof playerProfile === 'undefined' || !playerProfile) return [];
  var claimed = playerProfile.albumMedals && typeof playerProfile.albumMedals === 'object' ? playerProfile.albumMedals : {};
  var fresh = [];
  for (var gen = 1; gen <= 9; gen++) {
    var s = albumStats(gen);
    ALBUM_TIERS.forEach(function (t) {
      var key = gen + ':' + t.key;
      if (albumTierReached(t, s) && !claimed[key]) { claimed[key] = Date.now(); fresh.push({ gen: gen, tier: t, stats: s }); }
    });
  }
  if (!fresh.length) return fresh;
  playerProfile.albumMedals = claimed;
  var xp = fresh.reduce(function (sum, m) { return sum + m.tier.xp; }, 0);
  if (xp > 0 && typeof awardXp === 'function') awardXp(xp, fresh.length > 1 ? 'Médailles d’album' : 'Médaille d’album');
  else { try { saveProfile(); } catch (_e) {} }
  if (silent) {
    if (fresh.length && typeof showToast === 'function') {
      showToast('📒 Médailles d’album : ' + fresh.map(function (m) { return m.tier.icon + ' ' + m.stats.name; }).join(', ') + (xp ? ' · +' + xp + ' XP' : ''));
    }
  } else {
    fresh.forEach(function (m, i) {
      setTimeout(function () {
        showToast(m.tier.icon + ' Médaille ' + m.tier.name + ' · ' + m.stats.name + ' : ' +
          (m.tier.key === 'g' ? 'région complète !' : (m.tier.key === 's' ? 'la moitié' : 'un quart') + ' de ' + m.stats.name + ' dans ton album !') + (m.tier.xp ? ' +' + m.tier.xp + ' XP' : ''));
      }, 1600 + i * 3400);
    });
  }
  return fresh;
}

// ---- the window
function albumMedalPills(s) {
  return '<div class="alb-medals">' + ALBUM_TIERS.map(function (t) {
    var got = albumTierReached(t, s), need = albumTierNeed(t, s.total);
    return '<span class="alb-medal' + (got ? ' is-got' : '') + '">' + t.icon + ' ' + t.pct + ' %' + (got ? '' : ' · encore ' + Math.max(0, need - s.found)) + '</span>';
  }).join('') + '</div>';
}
function albumSlotHtml(p) {
  var entry = albumDiscoveries()[p.id];
  var num = '#' + String(p.baseId || p.id).padStart(3, '0');
  if (entry) {
    var shiny = Boolean(entry.shiny);
    var src = typeof pokedexDetailArtwork === 'function' ? pokedexDetailArtwork(p, shiny) : getPokemonSprite(p);
    return '<div class="alb-slot' + (shiny ? ' is-shiny' : '') + '"><span class="alb-num">' + num + '</span>' + (shiny ? '<span class="alb-sp" aria-label="shiny">✨</span>' : '') +
      '<img src="' + escapeHtml(src) + '" data-fallback="' + escapeHtml(getPokemonSprite(p)) + '" alt="' + escapeHtml(p.name) + '" loading="lazy" draggable="false" /><b>' + escapeHtml(p.name) + '</b></div>';
  }
  var state = typeof pokedexCollectionState === 'function' ? pokedexCollectionState(p) : { kind: 'unknown' };
  // A secret stays secret: no silhouette.
  if (state.kind === 'secret') return '<div class="alb-slot is-miss is-secret"><span class="alb-num">' + num + '</span><span class="alb-mark" aria-hidden="true">✦</span><small>Secret</small></div>';
  var art = typeof pokedexDetailArtwork === 'function' ? pokedexDetailArtwork(p, false) : getPokemonSprite(p);
  return '<div class="alb-slot is-miss"><span class="alb-num">' + num + '</span><img class="alb-shadow" src="' + escapeHtml(art) + '" data-fallback="' + escapeHtml(getPokemonSprite(p)) + '" alt="" loading="lazy" draggable="false" /><small>' +
    (state.kind === 'mission' ? '◆ Mission' : '???') + '</small></div>';
}
function albumRegionChips() {
  var html = '<div class="alb-chips" role="tablist">';
  for (var gen = 1; gen <= 9; gen++) {
    var s = albumStats(gen), best = albumBestTier(s);
    html += '<button type="button" role="tab" aria-selected="' + (gen === albumView.gen) + '" class="alb-chip' + (gen === albumView.gen ? ' is-on' : '') + '" data-action="albumGoRegion" data-args="[' + gen + ']">' +
      (best ? best.icon + ' ' : '') + escapeHtml(s.name) + '</button>';
  }
  return html + '</div>';
}
function albumBinderHtml() {
  var gen = albumView.gen, s = albumStats(gen), list = albumRegionList(gen);
  var pages = Math.max(1, Math.ceil(list.length / ALBUM_PAGE));
  albumView.page = Math.max(0, Math.min(pages - 1, albumView.page));
  var slice = list.slice(albumView.page * ALBUM_PAGE, (albumView.page + 1) * ALBUM_PAGE);
  var have = slice.filter(function (p) { return albumDiscoveries()[p.id]; }).length;
  var missing = list.find(function (p) { return !albumDiscoveries()[p.id] && (typeof pokedexCollectionState !== 'function' || pokedexCollectionState(p).kind !== 'secret'); });
  return albumRegionChips() +
    '<div class="alb-head"><h3>' + escapeHtml(s.name) + ' <small>' + s.found + ' / ' + s.total + (s.shinies ? ' · ✨ ' + s.shinies : '') + '</small></h3>' +
      '<div class="alb-bar" role="img" aria-label="' + s.percent + ' %"><b style="width:' + s.percent + '%"></b></div>' + albumMedalPills(s) + '</div>' +
    '<div class="alb-binder"><div class="alb-page">' + slice.map(albumSlotHtml).join('') + '</div>' +
      '<div class="alb-pager"><button type="button" class="alb-arrow" data-action="albumTurn" data-args="[-1]" aria-label="Page précédente"' + (albumView.page === 0 ? ' disabled' : '') + '>‹</button>' +
      '<span>Page ' + (albumView.page + 1) + ' / ' + pages + ' · ' + have + ' sur ' + slice.length + '</span>' +
      '<button type="button" class="alb-arrow" data-action="albumTurn" data-args="[1]" aria-label="Page suivante"' + (albumView.page >= pages - 1 ? ' disabled' : '') + '>›</button></div></div>' +
    (missing
      ? '<div class="alb-hint"><span class="alb-hint-num">#' + String(missing.baseId || missing.id).padStart(3, '0') + '</span><p>Il te manque le #' + String(missing.baseId || missing.id).padStart(3, '0') +
        '<small>Trouve-le en jouant avec les Pokémon de ' + escapeHtml(s.name) + ' (Gen ' + gen + ').</small></p><button type="button" class="btn-blue" data-action="albumPlayGen" data-args="[' + gen + ']">Jouer Gen ' + gen + '</button></div>'
      : '<div class="alb-hint is-done"><p>🥇 ' + escapeHtml(s.name) + ' est complet. Bravo !</p></div>');
}
function albumRegionsHtml() {
  var all = 0, total = 0, medals = 0, shinies = 0, rows = '';
  for (var gen = 1; gen <= 9; gen++) {
    var s = albumStats(gen), best = albumBestTier(s), next = albumNextTier(s);
    all += s.found; total += s.total; shinies += s.shinies;
    medals += ALBUM_TIERS.filter(function (t) { return albumTierReached(t, s); }).length;
    var left = next ? albumTierNeed(next, s.total) - s.found : 0;
    rows += '<button type="button" class="alb-row" data-action="albumOpenRegion" data-args="[' + gen + ']"><span class="alb-row-medal' + (best ? '' : ' is-none') + '">' + (best ? best.icon : '🥉') + '</span>' +
      '<span class="alb-row-main"><b>' + escapeHtml(s.name) + '</b><small>' + s.found + ' / ' + s.total + (s.shinies ? ' · ✨ ' + s.shinies : '') + (next ? ' · encore ' + left + ' pour ' + next.icon : ' · complet') + '</small>' +
      '<span class="alb-bar is-thin"><b style="width:' + s.percent + '%"></b></span></span><em>' + s.percent + ' %</em></button>';
  }
  return '<div class="alb-total"><b>' + all + ' / ' + total + ' Pokémon</b><span class="alb-bar"><b style="width:' + (total ? Math.floor(all / total * 100) : 0) + '%"></b></span>' +
    '<small>' + medals + ' médaille' + (medals > 1 ? 's' : '') + (shinies ? ' · ' + shinies + ' shin' + (shinies > 1 ? 'ies' : 'y') + ' capturé' + (shinies > 1 ? 's' : '') + ' ✨' : '') + '</small></div>' +
    '<div class="alb-rows">' + rows + '</div>';
}
function albumRender() {
  var body = document.querySelector('#overlay-body .alb');
  if (!body) return;
  body.classList.toggle('is-binder', albumView.tab === 'binder');
  body.innerHTML = '<div class="alb-tabs" role="tablist">' +
      '<button type="button" role="tab" aria-selected="' + (albumView.tab === 'binder') + '" class="' + (albumView.tab === 'binder' ? 'is-on' : '') + '" data-action="albumTab" data-args=\'["binder"]\'>Classeur</button>' +
      '<button type="button" role="tab" aria-selected="' + (albumView.tab === 'regions') + '" class="' + (albumView.tab === 'regions' ? 'is-on' : '') + '" data-action="albumTab" data-args=\'["regions"]\'>Régions et médailles</button></div>' +
    (albumView.tab === 'regions' ? albumRegionsHtml() : albumBinderHtml()) +
    '<p class="alb-foot">Un Pokémon rejoint ton album quand tu le trouves dans un jeu (Pokémon du jour, illimité, Pixelisé, Party Room…). <button type="button" class="fr-card-link" data-action="albumToPokedex">Voir ma collection dans le Pokédex</button></p>';
  var chip = body.querySelector('.alb-chip.is-on');
  if (chip && chip.scrollIntoView) chip.scrollIntoView({ block: 'nearest', inline: 'center' });
}
// Opens on the region closest to its next medal (or the one asked).
function openAlbumBinder(gen) {
  var goal = albumNextGoal();
  albumView.gen = Number(gen) >= 1 && Number(gen) <= 9 ? Number(gen) : (goal ? goal.stats.gen : 1);
  albumView.tab = 'binder';
  albumView.page = 0;
  var list = albumRegionList(albumView.gen);
  var firstMissing = list.findIndex(function (p) { return !albumDiscoveries()[p.id]; });
  if (firstMissing > 0) albumView.page = Math.floor(firstMissing / ALBUM_PAGE);
  ensureOverlay('📒 Mon album', '<div class="alb"></div>');
  var overlay = document.getElementById('overlay-modal');
  if (overlay) overlay.dataset.kind = 'album';
  albumClaimMedals(true);
  albumRender();
}
function albumTab(tab) { albumView.tab = tab === 'regions' ? 'regions' : 'binder'; albumRender(); }
function albumGoRegion(gen) { albumView.gen = Number(gen) || 1; albumView.page = 0; albumRender(); }
function albumOpenRegion(gen) { albumView.tab = 'binder'; albumGoRegion(gen); }
function albumTurn(step) { albumView.page += Number(step) < 0 ? -1 : 1; albumRender(); }
function albumPlayGen(gen) {
  closeOverlayModal();
  if (typeof setSelectedGenerations === 'function') setSelectedGenerations([Number(gen)]);
  if (typeof startNormalGame === 'function') startNormalGame();
  setTimeout(function () { showToast('🎯 Pokémon de Gen ' + gen + ' seulement (modifiable avec les générations).'); }, 600);
}
function albumToPokedex() {
  closeOverlayModal();
  if (typeof openPokedexCollection === 'function') openPokedexCollection();
}

// « Ma collection » (account menu, home strip) now opens the album.
openDiscoveryAlbum = function () { openAlbumBinder(); };

// A new Pokémon may bring a medal.
if (typeof recordPokemonDiscovery === 'function') {
  var albumDiscoveryBefore = recordPokemonDiscovery;
  recordPokemonDiscovery = function () {
    var out = albumDiscoveryBefore.apply(this, arguments);
    if (out) albumClaimMedals(false);
    return out;
  };
}

// The home (the « Mon aventure » strip is hidden by the current design): a small card under
// « À plusieurs » with the next medal, once at least one Pokémon is in the album.
function renderAlbumHomeCard() {
  var home = document.getElementById('screen-config');
  if (!home) return;
  var card = document.getElementById('home-album');
  var count = Object.keys(albumDiscoveries()).length;
  if (!count) { if (card) card.remove(); return; }
  if (!card) {
    card = document.createElement('section');
    card.id = 'home-album';
    card.className = 'home-album';
    var anchor = document.getElementById('home-party') || document.getElementById('daily-hero');
    if (anchor && anchor.parentNode === home) anchor.after(card); else home.appendChild(card);
  }
  var goal = albumNextGoal();
  card.innerHTML = '<span class="home-album-ico" aria-hidden="true">📒</span><span class="home-album-text"><b>' +
    (goal ? 'Ton album : ' + escapeHtml(goal.stats.name) + ' ' + goal.stats.found + '/' + goal.stats.total : 'Ton album est complet 🥇') + '</b><small>' +
    (goal ? 'Encore ' + goal.left + ' pour la médaille ' + goal.tier.icon + ' de ' + escapeHtml(goal.stats.name) : 'Les 1025 Pokémon sont dans ton classeur.') + '</small></span>' +
    '<button type="button" class="btn-blue" data-action="openAlbumBinder">Ouvrir</button>';
}
if (typeof renderPartner === 'function') {
  var albumPartnerBefore = renderPartner;
  renderPartner = function () { var out = albumPartnerBefore.apply(this, arguments); renderAlbumHomeCard(); return out; };
}

// In the Pokédex « Ma collection », a way to the album.
if (typeof renderPokedexCollectionHub === 'function') {
  var albumHubBefore = renderPokedexCollectionHub;
  renderPokedexCollectionHub = function () {
    var out = albumHubBefore.apply(this, arguments);
    var sw = document.querySelector('#pokedex-collection-hub .pokedex-experience-switch');
    if (sw && !sw.querySelector('.pokedex-album-link')) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'pokedex-album-link'; b.dataset.action = 'openAlbumBinder';
      b.textContent = '📒 Album';
      sw.appendChild(b);
    }
    return out;
  };
}

// The trainer card: album total and best medal per region (lib/player-cards.js reads the profile).
if (typeof playerCardHtml === 'function') {
  var albumCardBefore = playerCardHtml;
  playerCardHtml = function (data) {
    var html = albumCardBefore.apply(this, arguments);
    var album = data && data.album;
    if (!album || !album.found) return html;
    var medals = (Array.isArray(album.medals) ? album.medals : []).map(function (m) {
      var tier = ALBUM_TIERS.find(function (t) { return t.key === m.tier; });
      return tier ? '<span>' + tier.icon + ' ' + escapeHtml(albumRegionName(Number(m.gen))) + '</span>' : '';
    }).join('');
    var row = '<div class="player-card-album"><b>📒 ' + Number(album.found) + ' / ' + Number(album.total || 1025) + ' dans l’album</b>' + (medals ? '<div class="player-card-album-medals">' + medals + '</div>' : '') + '</div>';
    return html.replace('<div class="player-card-figures">', row + '<div class="player-card-figures">');
  };
}

// Medals already earned before this version: given once, quietly, after the profile is loaded.
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
      if (typeof playerProfile !== 'undefined' && playerProfile && Object.keys(playerProfile.discoveries || {}).length) albumClaimMedals(true);
      renderAlbumHomeCard();
    }, 3500);
  });
}
window.openAlbumBinder = openAlbumBinder;
window.albumTab = albumTab;
window.albumGoRegion = albumGoRegion;
window.albumOpenRegion = albumOpenRegion;
window.albumTurn = albumTurn;
window.albumPlayGen = albumPlayGen;
window.albumToPokedex = albumToPokedex;
