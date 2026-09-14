
/* Game discovery: every destination stays available, without crowding the home. */
var modeCatalogCategory = 'solo';
var modeCatalogCopy = {
  solo: 'Choisis un défi et joue à ton rythme.',
  friends: 'Une soirée à plusieurs ? Commence par la Party Room. Pour un face-à-face, choisis un duel.',
  explore: 'Explore le Pokédex, prépare tes équipes et retrouve ta progression.',
  all: 'Tous les jeux et outils, réunis au même endroit.'
};
function normalizeModeSearch(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function modeCatalogMatches(cardCategory, text, category, query) {
  return (category === 'all' || cardCategory === category) && normalizeModeSearch(query).split(/\s+/).every(word => normalizeModeSearch(text).includes(word));
}
function saveModeCatalogState() {
  if (history.state?.screen !== 'allModes') return;
  history.replaceState({ ...history.state, category: modeCatalogCategory, query: document.getElementById('mode-search')?.value || '' }, '', location.href);
}
function renderModeCatalog() {
  var query = document.getElementById('mode-search')?.value || '';
  if (typeof renderCatalogPicks === "function") renderCatalogPicks(modeCatalogCategory, query);
  var count = 0;
  document.querySelectorAll('#screen-all-modes .all-modes-cat').forEach(section => {
    var visible = 0;
    section.querySelectorAll('.all-modes-card').forEach(card => {
      const matches = modeCatalogMatches(card.dataset.category, card.textContent, modeCatalogCategory, query);
      if (matches) count++;
      card.hidden = !matches || (typeof isClubFeatured === 'function' && isClubFeatured(card, modeCatalogCategory, query));
      if (!card.hidden) visible++;
    });
    section.hidden = visible === 0;

  });
  document.querySelectorAll('[data-mode-category]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.modeCategory === modeCatalogCategory));
  });
  document.getElementById('mode-empty').hidden = count !== 0;
  document.getElementById('mode-results').textContent = `${count} ${count === 1 ? 'résultat' : 'résultats'}${query.trim() ? ' pour « ' + query.trim() + ' »' : ''}`;
  document.getElementById('mode-hub-description').textContent = modeCatalogCopy[modeCatalogCategory];
  document.getElementById('home-gens-card').hidden = modeCatalogCategory === 'explore' || Boolean(query.trim());
  setGlobalNavActive(modeCatalogCategory === 'friends' ? 'social' : modeCatalogCategory === 'explore' ? 'extras' : 'game');
}
function setModeCatalogCategory(category, save = true) {
  modeCatalogCategory = Object.prototype.hasOwnProperty.call(modeCatalogCopy, category) ? category : 'solo';
  var input = document.getElementById('mode-search');
  if (input) input.value = '';
  renderModeCatalog();
  if (save) saveModeCatalogState();
}
function resetModeCatalog() {
  setModeCatalogCategory('all');
  document.getElementById('mode-search')?.focus();
}
document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('mode-search')?.addEventListener('input', function () {
    // Search the whole catalog, including tools, regardless of the entry point.
    modeCatalogCategory = 'all';
    renderModeCatalog();
    saveModeCatalogState();
  });
});
