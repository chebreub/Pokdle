
/* Game discovery: every destination stays available, without crowding the home. */
var modeCatalogCategory = 'solo';
var MODE_CATALOG_ART = Object.freeze({
  startDailyGame:{ids:[149],effect:'mystery',glyph:'?'},
  startNormalGame:{ids:[133],effect:'mystery',glyph:'∞'},
  startSilhouetteGame:{ids:[448],effect:'scan',glyph:'◐'},
  startPixelGame:{ids:[6],effect:'pixel',glyph:'▦'},
  startDescriptionMode:{ids:[150],effect:'dossier',glyph:'≡'},
  startCryGame:{ids:[39],effect:'audio',glyph:'♪'},
  startMysteryStatGame:{ids:[376],effect:'stats',glyph:'Σ'},
  openOddOneOutMode:{ids:[25,133,94],effect:'group',glyph:'?'},
  startQuizGame:{ids:[54],effect:'quiz',glyph:'?'},
  startEvolutionChainGame:{ids:[1,2,3],effect:'evolution',glyph:'↻'},
  startPokedexOrderGame:{ids:[152,155,158],effect:'order',glyph:'#'},
  openPokeConnectionsMode:{ids:[133,134,135],effect:'links',glyph:'↔'},
  openTypeComboSolo:{ids:[6,130],effect:'types',glyph:'+'},
  startWeightBattle:{ids:[143,50],effect:'versus',glyph:'↕'},
  openHigherLowerMode:{ids:[248,10],effect:'versus',glyph:'↕'},
  openSpeedrunMode:{ids:[135],effect:'speed',glyph:'⚡'},
  startPartyMode:{ids:[25,133,448],effect:'party',glyph:'✦'},
  openDraftArenaMode:{ids:[6,9,3],effect:'team',glyph:'III'},
  openDraftScoreAttackMode:{ids:[248,376,445],effect:'team',glyph:'6'},
  openTeamBuilderScreen:{ids:[6,9,3],effect:'team',glyph:'+'},
  openTypeChartScreen:{ids:[6,130],effect:'types',glyph:'×'},
  openPartyRoomMode:{ids:[25,133,448],effect:'party',glyph:'●'},
  openMultiplayerMode:{ids:[6,9],effect:'duel',glyph:'VS'},
  openStatClashMode:{ids:[68,65],effect:'duel',glyph:'Σ'},
  openStatAuctionMode:{ids:[52,197],effect:'auction',glyph:'$'},
  openDefiAmiFromAllModes:{ids:[25,133],effect:'duel',glyph:'↗'},
  openDraftScoreAttackProDuel:{ids:[248,445],effect:'duel',glyph:'PRO'},
  openPokedexMode:{ids:[1,4,7],effect:'dex',glyph:'#'},
  openProfileScreen:{ids:[25],effect:'trainer',glyph:'★'},
  openAchievementsScreen:{ids:[150],effect:'trophy',glyph:'◆'},
  openMatchHistoryScreen:{ids:[251],effect:'history',glyph:'↶'},
  openTeamsScreen:{ids:[6,9,3],effect:'team',glyph:'6'},
  openEmulatorMode:{ids:[25],effect:'pixel',glyph:'8-BIT'},
  openLeaderboard:{ids:[150,25,448],effect:'podium',glyph:'1'}
});
function modeCatalogSpriteUrl(id) {
  try { if (typeof getSpriteUrl === 'function') return getSpriteUrl(Number(id)); } catch (_e) {}
  return 'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/'+Number(id)+'.png';
}
function modeCatalogActionKey(card) {
  if (!card) return '';
  if (card.dataset.action && card.dataset.action !== 'openFromAllModes') return card.dataset.action;
  try {
    const args=JSON.parse(card.dataset.args || '[]');
    return typeof args[0] === 'string' ? args[0] : '';
  } catch (_e) { return ''; }
}
function modeCatalogArtHtml(key, variant='card') {
  const spec=MODE_CATALOG_ART[key];
  if (!spec) return '';
  const images=spec.ids.slice(0,3).map((id,index)=>
    '<img src="'+modeCatalogSpriteUrl(id)+'" alt="" aria-hidden="true" loading="lazy" decoding="async" style="--art-index:'+index+'" />'
  ).join('');
  return '<span class="mode-card-art art-'+spec.effect+' is-'+variant+'" aria-hidden="true">'+
    '<span class="mode-card-art-orbit"></span>'+images+
    '<b>'+spec.glyph+'</b></span>';
}
function decorateModeCatalogCards() {
  document.querySelectorAll('#screen-all-modes .all-modes-card').forEach(card=>{
    if (card.querySelector('.mode-card-art')) return;
    const key=modeCatalogActionKey(card);
    const html=modeCatalogArtHtml(key,'card');
    if (!html) return;
    card.classList.add('has-mode-art');
    card.dataset.modeArt=MODE_CATALOG_ART[key]?.effect || '';
    card.insertAdjacentHTML('beforeend',html);
  });
}
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
  decorateModeCatalogCards();
  document.getElementById('mode-search')?.addEventListener('input', function () {
    // Search the whole catalog, including tools, regardless of the entry point.
    modeCatalogCategory = 'all';
    renderModeCatalog();
    saveModeCatalogState();
  });
});
