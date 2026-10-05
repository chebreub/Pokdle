
/* Game discovery: every destination stays available, without crowding the home. */
var modeCatalogCategory = 'solo';
var modeCatalogDifficulty = 'all';
var MODE_CATALOG_DIFFICULTY_LABELS = Object.freeze({ all:'Toutes', easy:'Facile', medium:'Moyen', hard:'Difficile', expert:'Expert' });
var MODE_CATALOG_DIFFICULTY = Object.freeze({
  startDailyGame:'medium', startNormalGame:'medium', startSilhouetteGame:'easy', startPixelGame:'medium',
  startDescriptionMode:'hard', startCryGame:'hard', startMysteryStatGame:'hard', openOddOneOutMode:'medium',
  startQuizGame:'medium', startEvolutionChainGame:'easy', startPokedexOrderGame:'medium', openPokeConnectionsMode:'hard',
  openTypeComboSolo:'hard', startWeightBattle:'easy', openHigherLowerMode:'easy', openSpeedrunMode:'hard',
  startPartyMode:'medium', openDraftArenaMode:'hard', openDraftScoreAttackMode:'hard', openPartyRoomMode:'medium',
  openMultiplayerMode:'medium', openStatClashMode:'hard', openStatAuctionMode:'hard', openDefiAmiFromAllModes:'medium',
  openDraftScoreAttackProDuel:'expert'
});
var MODE_CATALOG_ART = Object.freeze({
  startDailyGame:{ids:[149],effect:'mystery',glyph:'?'},
  startNormalGame:{ids:[133],effect:'mystery',glyph:'∞'},
  startSilhouetteGame:{ids:[352],effect:'scan',glyph:'◐'},
  startPixelGame:{ids:[137],effect:'pixel',glyph:'▦'},
  startDescriptionMode:{ids:[479],effect:'dossier',glyph:'≡'},
  startCryGame:{ids:[441],effect:'audio',glyph:'♪'},
  startMysteryStatGame:{ids:[376],effect:'stats',glyph:'Σ'},
  openOddOneOutMode:{ids:[132,25,133],effect:'group',glyph:'?'},
  startQuizGame:{ids:[65],effect:'quiz',glyph:'?'},
  startEvolutionChainGame:{ids:[722,723,724],effect:'evolution',glyph:'↻'},
  startPokedexOrderGame:{ids:[152,155,158],effect:'order',glyph:'#'},
  openPokeConnectionsMode:{ids:[133,134,135],effect:'links',glyph:'↔'},
  openTypeComboSolo:{ids:[493,352],effect:'types',glyph:'+'},
  startWeightBattle:{ids:[143,50],effect:'versus',glyph:'↕'},
  openHigherLowerMode:{ids:[248,10],effect:'versus',glyph:'↕'},
  openSpeedrunMode:{ids:[291],effect:'speed',glyph:'⚡'},
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
function modeCatalogPreviewImage(id,index=0) {
  return '<img src="'+modeCatalogSpriteUrl(id)+'" alt="" aria-hidden="true" loading="lazy" decoding="async" style="--art-index:'+index+'" />';
}
function modeCatalogPreviewBars(count=5) {
  return '<span class="mode-preview-bars">'+Array.from({length:count},(_,i)=>'<i style="--bar:'+i+';--bar-height:'+([10,18,25,30,25,18,10][i%7])+'px"></i>').join('')+'</span>';
}
function modeCatalogPreviewHtml(spec) {
  const ids=spec.ids.slice(0,3);
  const images=ids.map((id,index)=>modeCatalogPreviewImage(id,index));
  switch(spec.effect) {
    case 'mystery':
      return '<span class="mode-preview mode-preview-mystery">'+(images[0]||'')+'<i class="preview-question">?</i></span>';
    case 'scan':
      return '<span class="mode-preview mode-preview-scan"><i class="preview-scan-line"></i>'+(images[0]||'')+'</span>';
    case 'pixel':
      return '<span class="mode-preview mode-preview-pixel"><i class="preview-pixel-grid"></i>'+(images[0]||'')+'</span>';
    case 'dossier':
      return '<span class="mode-preview mode-preview-dossier"><i></i><i></i><i></i>'+(images[0]||'')+'</span>';
    case 'audio':
      return '<span class="mode-preview mode-preview-audio">'+modeCatalogPreviewBars(7)+(images[0]||'')+'</span>';
    case 'stats':
      return '<span class="mode-preview mode-preview-stats">'+modeCatalogPreviewBars(4)+(images[0]||'')+'</span>';
    case 'group':
      return '<span class="mode-preview mode-preview-group">'+images.join('')+'<i class="preview-odd-ring"></i></span>';
    case 'quiz':
      return '<span class="mode-preview mode-preview-quiz"><b>?</b><i></i><i></i><i></i><i></i></span>';
    case 'evolution':
      return '<span class="mode-preview mode-preview-evolution">'+images.map((img,i)=>img+(i<images.length-1?'<b>›</b>':'')).join('')+'</span>';
    case 'order':
      return '<span class="mode-preview mode-preview-order">'+images.map((img,i)=>'<i>'+(i+1)+'</i>'+img).join('')+'</span>';
    case 'links':
      return '<span class="mode-preview mode-preview-links"><i class="preview-link-line l1"></i><i class="preview-link-line l2"></i>'+images.join('')+'</span>';
    case 'types':
      return '<span class="mode-preview mode-preview-types"><i>TYPE</i><b>+</b><i>TYPE</i>'+(images[0]||'')+'</span>';
    case 'versus':
    case 'duel':
      return '<span class="mode-preview mode-preview-versus">'+(images[0]||'')+'<b>VS</b>'+(images[1]||'')+'</span>';
    case 'speed':
      return '<span class="mode-preview mode-preview-speed"><i></i><i></i><i></i>'+(images[0]||'')+'</span>';
    case 'team':
      return '<span class="mode-preview mode-preview-team">'+images.map(img=>'<i>'+img+'</i>').join('')+'</span>';
    case 'party':
      return '<span class="mode-preview mode-preview-party">'+images.map(img=>'<i>'+img+'</i>').join('')+'</span>';
    case 'auction':
      return '<span class="mode-preview mode-preview-auction"><b>₽</b>'+(images[0]||'')+(images[1]||'')+'</span>';
    case 'dex':
      return '<span class="mode-preview mode-preview-dex">'+images.map(img=>'<i>'+img+'</i>').join('')+'</span>';
    case 'podium':
      return '<span class="mode-preview mode-preview-podium"><i>2</i><i>1</i><i>3</i>'+images.slice(0,3).join('')+'</span>';
    default:
      return '<span class="mode-preview mode-preview-generic">'+images.join('')+'</span>';
  }
}
function modeCatalogArtHtml(key, variant='card') {
  const spec=MODE_CATALOG_ART[key];
  if (!spec) return '';
  return '<span class="mode-card-art art-'+spec.effect+' is-'+variant+'" aria-hidden="true">'+
    modeCatalogPreviewHtml(spec)+'</span>';
}
function modeCatalogDifficultyForCard(card) {
  const key=modeCatalogActionKey(card);
  if (!key) return '';
  let level=MODE_CATALOG_DIFFICULTY[key] || '';
  if (key === 'openDraftScoreAttackMode') {
    try {
      const args=JSON.parse(card.dataset.args || '[]');
      if (args[1] === true) level='expert';
    } catch (_e) {}
  }
  return level;
}
function modeCatalogDecorateDifficulty(card) {
  if (!card || card.dataset.category === 'explore') return;
  const level=modeCatalogDifficultyForCard(card);
  if (!level) return;
  card.dataset.difficulty=level;
  card.dataset.difficultyLabel=MODE_CATALOG_DIFFICULTY_LABELS[level] || level;
  const desc=card.querySelector('small');
  if (desc && !desc.querySelector('.mode-difficulty-inline')) {
    desc.insertAdjacentHTML('afterbegin','<span class="mode-difficulty-inline is-'+level+'">'+card.dataset.difficultyLabel+'</span>');
  }
}

function decorateModeCatalogCards() {
  document.querySelectorAll('#screen-all-modes .all-modes-card').forEach(card=>{
    modeCatalogDecorateDifficulty(card);
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
  solo: 'Déduction, connaissances ou rapidité : choisis ton prochain défi.',
  friends: 'Party Room, duels et jeux à plusieurs sont regroupés ici.',
  explore: 'Les outils utiles vivent ici, séparés des jeux.',
  all: 'Tous les jeux et outils, réunis au même endroit.'
};
var modeCatalogTitle = {
  solo: 'Jouer',
  friends: 'Entre amis',
  explore: 'Outils Pokémon',
  all: 'Tous les modes'
};
function normalizeModeSearch(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function modeCatalogMatches(cardCategory, cardDifficulty, text, category, difficulty, query) {
  const categoryMatches = category === 'all' || cardCategory === category;
  const difficultyMatches = category === 'explore' || difficulty === 'all' || cardDifficulty === difficulty;
  return categoryMatches && difficultyMatches && normalizeModeSearch(query).split(/\s+/).every(word => normalizeModeSearch(text).includes(word));
}
function saveModeCatalogState() {
  if (history.state?.screen !== 'allModes') return;
  history.replaceState({ ...history.state, category: modeCatalogCategory, difficulty: modeCatalogDifficulty, query: document.getElementById('mode-search')?.value || '' }, '', location.href);
}
function renderModeCatalog() {
  var query = document.getElementById('mode-search')?.value || '';
  document.getElementById('mode-refinements')?.classList.toggle('hidden', modeCatalogCategory === 'explore');
  if (typeof renderCatalogPicks === "function") renderCatalogPicks(modeCatalogCategory, query, modeCatalogDifficulty);
  var count = 0;
  document.querySelectorAll('#screen-all-modes .all-modes-cat').forEach(section => {
    var visible = 0;
    section.querySelectorAll('.all-modes-card').forEach(card => {
      const matches = modeCatalogMatches(card.dataset.category, card.dataset.difficulty || '', card.textContent, modeCatalogCategory, modeCatalogDifficulty, query);
      if (matches) count++;
      card.hidden = !matches || (typeof isClubFeatured === 'function' && isClubFeatured(card, modeCatalogCategory, query, modeCatalogDifficulty));
      if (!card.hidden) visible++;
    });
    section.hidden = visible === 0;

  });
  document.querySelectorAll('[data-mode-category]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.modeCategory === modeCatalogCategory));
  });
  document.getElementById('mode-empty').hidden = count !== 0;
  const resultLine = document.getElementById('mode-results');
  const isFiltering = Boolean(query.trim()) || modeCatalogDifficulty !== 'all';
  if (resultLine) resultLine.textContent = isFiltering
    ? `${count} ${count === 1 ? 'résultat' : 'résultats'}${query.trim() ? ' pour « ' + query.trim() + ' »' : ''}`
    : '';
  const title = document.getElementById('mode-hub-title');
  if (title) title.textContent = modeCatalogTitle[modeCatalogCategory] || modeCatalogTitle.solo;
  document.getElementById('mode-hub-description').textContent = modeCatalogCopy[modeCatalogCategory];
  document.getElementById('home-gens-card').hidden = modeCatalogCategory === 'explore' || Boolean(query.trim());
  const difficultyField=document.getElementById('mode-difficulty-field');
  if (difficultyField) difficultyField.hidden = modeCatalogCategory === 'explore';
  const difficultySelect=document.getElementById('mode-difficulty');
  if (difficultySelect && difficultySelect.value !== modeCatalogDifficulty) difficultySelect.value = modeCatalogDifficulty;
  setGlobalNavActive(modeCatalogCategory === 'friends' ? 'social' : modeCatalogCategory === 'explore' ? 'extras' : 'game');
}
function setModeCatalogCategory(category, save = true) {
  modeCatalogCategory = Object.prototype.hasOwnProperty.call(modeCatalogCopy, category) ? category : 'solo';
  var input = document.getElementById('mode-search');
  if (input) input.value = '';
  renderModeCatalog();
  if (save) saveModeCatalogState();
}
function setModeCatalogDifficulty(difficulty, save = true) {
  modeCatalogDifficulty = Object.prototype.hasOwnProperty.call(MODE_CATALOG_DIFFICULTY_LABELS, difficulty) ? difficulty : 'all';
  renderModeCatalog();
  if (save) saveModeCatalogState();
}
function toggleModeRefinements() {
  const panel = document.getElementById("mode-refinements");
  const expanded = panel?.classList.toggle("is-expanded") || false;
  const button = document.getElementById("mode-refinements-toggle");
  if (button) {
    button.setAttribute("aria-expanded", String(expanded));
    button.textContent = "Difficulté et générations " + (expanded ? "▴" : "▾");
  }
}
function resetModeCatalog() {
  modeCatalogDifficulty = 'all';
  const input = document.getElementById('mode-search');
  if (input) input.value = '';
  renderModeCatalog();
  saveModeCatalogState();
  input?.focus();
}
document.addEventListener('DOMContentLoaded', function () {
  decorateModeCatalogCards();
  document.getElementById('mode-search')?.addEventListener('input', function () {
    // Search stays inside the destination the player deliberately opened.
    renderModeCatalog();
    saveModeCatalogState();
  });
  document.getElementById('mode-difficulty')?.addEventListener('change', function (event) {
    setModeCatalogDifficulty(event.target.value);
  });
});
