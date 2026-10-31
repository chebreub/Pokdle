
// ===== « Nouveau » on the latest games (31/10/2026) =====
// A small badge on the tiles of a new game, until the date given (day of Paris, included), then it
// disappears by itself. The tiles are matched by the action they open, wherever they appear.
var NEW_GAME_BADGES = [
  { selector: '[data-args=\'["openShinyMode"]\']', until: '2026-11-13' },
  { selector: '[data-args=\'["dessin"]\']', until: '2026-11-12' },
];

function newGameBadgesActive(day) {
  return NEW_GAME_BADGES.filter(function (badge) { return String(day) <= badge.until; });
}

function applyNewGameBadges(day) {
  var today = day || (typeof getDailyDateKey === 'function' ? getDailyDateKey() : new Date().toISOString().slice(0, 10));
  var active = newGameBadgesActive(today);
  document.querySelectorAll('.new-game-badge').forEach(function (node) {
    if (!active.some(function (badge) { return node.parentElement && node.parentElement.matches(badge.selector); })) node.remove();
  });
  active.forEach(function (badge) {
    document.querySelectorAll(badge.selector).forEach(function (tile) {
      if (tile.querySelector(':scope > .new-game-badge')) return;
      tile.classList.add('has-new-badge');
      tile.insertAdjacentHTML('beforeend', '<span class="new-game-badge">Nouveau</span>');
    });
  });
}

if (typeof window !== 'undefined' && window.addEventListener) {
  // The game catalog and the home grid are drawn after load: badge them once they exist.
  window.addEventListener('DOMContentLoaded', function () {
    applyNewGameBadges();
    setTimeout(function () { applyNewGameBadges(); }, 1500);
  });
  if (typeof renderModeCatalog === 'function') {
    var renderModeCatalogBeforeBadges = renderModeCatalog;
    renderModeCatalog = function () { var value = renderModeCatalogBeforeBadges.apply(this, arguments); applyNewGameBadges(); return value; };
  }
}
