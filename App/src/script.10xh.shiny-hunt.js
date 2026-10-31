
// ===== The shiny hunt (31/10/2026) =====
// Each Pokémon du jour found is captured. The server rolls the shiny at the win, with odds
// that improve with the streak (lib/daily-game.js: 1 in 40, 1 in 30 from 7 days, 1 in 20
// from 30 days). The result card shows the capture and the odds; the trainer card shows the
// shinies; « Ma collection » filters them.
var SHINY_HUNT_TIERS = [[30, 20], [7, 30], [0, 40]];
function shinyHuntOdds(streak) {
  var days = Math.max(0, Number(streak) || 0);
  for (var i = 0; i < SHINY_HUNT_TIERS.length; i++) if (days >= SHINY_HUNT_TIERS[i][0]) return SHINY_HUNT_TIERS[i][1];
  return 40;
}
// The next tier a streak can reach: { days, odds }, or null at the best odds.
function shinyHuntNextTier(streak) {
  var days = Math.max(0, Number(streak) || 0);
  var above = SHINY_HUNT_TIERS.filter(function (tier) { return tier[0] > days; });
  var next = above[above.length - 1];
  return next ? { days: next[0], odds: next[1] } : null;
}

function dailyCaptureHtml(state, pokemon) {
  var s = state && state.shiny;
  if (!s || !s.captured || !pokemon) return '';
  var shiny = Boolean(s.shiny), streak = Number(s.streak) || 0, odds = Number(s.odds) || shinyHuntOdds(streak);
  var name = escapeHtml(pokemon.name);
  var tomorrow = shinyHuntOdds(streak + 1), next = shinyHuntNextTier(streak);
  var hint = shiny ? 'Il brille dans ta vitrine, sur ta carte de dresseur.'
    : tomorrow < odds ? 'Demain, si tu le trouves, ta chance passe à 1/' + tomorrow + '.'
    : next ? 'Encore ' + (next.days - streak) + ' jours de série pour passer à 1/' + next.odds + '.'
    : 'Ta série te donne déjà la meilleure chance.';
  return '<section id="daily-capture" class="daily-capture' + (shiny ? ' is-shiny' : '') + '" aria-label="Capture du jour">' +
    '<div class="daily-capture-art"><img src="' + escapeHtml(pokedexDetailArtwork(pokemon, shiny)) + '" data-fallback="' + escapeHtml(shiny ? getPokemonShinySprite(pokemon) : getPokemonSprite(pokemon)) + '" alt="' + name + (shiny ? ' shiny' : '') + '" width="112" height="112" /></div>' +
    '<div class="daily-capture-text"><small>' + (shiny ? '✨ Shiny ! · Capturé' : 'Capturé') + '</small>' +
    '<b>' + name + (shiny ? ' shiny' : '') + ' rejoint ta collection</b>' +
    '<span class="daily-capture-odds">✨ Chance de shiny : 1/' + odds + (streak > 1 ? ' · série de ' + streak + ' jours' : '') + '</span>' +
    '<span class="daily-capture-hint">' + hint + '</span></div></section>';
}

// The player's shinies, from the server: by account, or this browser's guest plays.
function markShinyDiscoveries(list) {
  var found = typeof playerProfile !== 'undefined' && playerProfile ? playerProfile.discoveries : null;
  if (!found) return;
  var changed = false;
  (list || []).forEach(function (entry) {
    var record = found[Number(entry.id)];
    if (record && !record.shiny) { record.shiny = String(entry.day || true); changed = true; }
  });
  if (changed && typeof saveProfile === 'function') saveProfile();
}
function loadShinyCollection() {
  return fetch('/api/daily/shinies', { credentials: 'same-origin', cache: 'no-store' })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (!data || !data.ok) return null;
      window.__pokedleShinies = { count: Number(data.count) || 0, shinies: Array.isArray(data.shinies) ? data.shinies : [] };
      markShinyDiscoveries(window.__pokedleShinies.shinies);
      if (document.getElementById('screen-profile') && !document.getElementById('screen-profile').classList.contains('hidden') && typeof renderProfileScreen === 'function') renderProfileScreen();
      return window.__pokedleShinies;
    })
    .catch(function () { return null; });
}

// On the trainer card: the shinies, or what the next Pokémon du jour can bring.
function profileShinyHtml() {
  var data = typeof window !== 'undefined' ? window.__pokedleShinies : null;
  if (data && data.count) {
    return '<div class="profile-shinies"><span class="profile-shinies-title">✨ Mes shinies · ' + data.count + '</span>' +
      (typeof shinyShowcaseHtml === 'function' ? shinyShowcaseHtml(data.shinies.slice(0, 6), data.count) : '') + '</div>';
  }
  var streak = typeof playerStats !== 'undefined' ? Number(playerStats.dailyCurrentStreak) || 0 : 0;
  return '<p class="profile-shinies-empty">✨ Chasse au shiny : 1/' + shinyHuntOdds(streak + 1) + ' sur ton prochain Pokémon du jour. Plus ta série est longue, plus ta chance monte.</p>';
}

function celebrateShinyCapture(pokemon) {
  if (typeof playPokedexUiSfx === 'function') { try { playPokedexUiSfx('legendary'); } catch (_e) {} }
  if (typeof showToast === 'function') showToast('✨ Incroyable : ' + pokemon.name + ' shiny ! Il rejoint ta vitrine.');
}

if (typeof renderGameOverBox === 'function') {
  var renderGameOverBeforeShinyHunt = renderGameOverBox;
  renderGameOverBox = function () {
    var value = renderGameOverBeforeShinyHunt.apply(this, arguments);
    var old = document.getElementById('daily-capture');
    if (old) old.remove();
    if (gameMode === 'daily' && dailyServerState && dailyServerState.won && secretPokemon) {
      var html = dailyCaptureHtml(dailyServerState, secretPokemon);
      var anchor = document.getElementById('daily-enquiry-points') || document.querySelector('#win-box .win-inner');
      if (html && anchor) anchor.insertAdjacentHTML('afterend', html);
    }
    return value;
  };
}
if (typeof applyDailyObservedState === 'function') {
  var applyDailyBeforeShinyHunt = applyDailyObservedState;
  applyDailyObservedState = function (data, options) {
    var value = applyDailyBeforeShinyHunt.apply(this, arguments);
    var shiny = data && data.won && data.shiny && data.shiny.captured && data.shiny.shiny;
    if (shiny) {
      var pokemon = typeof POKEMON_BY_ID !== 'undefined' ? POKEMON_BY_ID.get(Number(data.answerId)) : null;
      if (pokemon && options && options.awardFreshWin) celebrateShinyCapture(pokemon);
      // The discovery is recorded during the win; mark it shiny right after.
      setTimeout(function () { markShinyDiscoveries([{ id: data.answerId, day: data.day }]); }, 0);
    }
    if (data && data.won && options && options.awardFreshWin) loadShinyCollection();
    return value;
  };
}
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('pokedle:account-known', function () { loadShinyCollection(); });
}
