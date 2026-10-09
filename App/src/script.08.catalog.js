
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
// Illustration filenames are versioned because /img assets are cached for 30 days.
var MODE_CATALOG_ILLUSTRATIONS = Object.freeze({
  startDailyGame:'daily',
  openPokeConnectionsMode:'connections',
  openDraftScoreAttackMode:'draft'
});
// Catalogue tiles: one mascot, one pastel colour and one drawn mechanic per game,
// so a game is recognised at a glance before its title is read.
var MODE_TILE_THEME = Object.freeze({
  startDailyGame:{ids:[149],tone:'#FFD45C',ink:'#7A5700',prop:'question',silhouette:true,badge:'Du jour'},
  startNormalGame:{ids:[132],tone:'#C9B98E',ink:'#6B5A2E',prop:'infinity'},
  startSilhouetteGame:{ids:[352],tone:'#FF8FB5',ink:'#A3285A',prop:'loupe'},
  startPixelGame:{ids:[137],tone:'#8FC8FF',ink:'#245F96',prop:'pixels'},
  startDescriptionMode:{ids:[479],tone:'#F5D96B',ink:'#6E5600',prop:'lines'},
  startCryGame:{ids:[441],tone:'#86D9B0',ink:'#1E6B45',prop:'wave'},
  startMysteryStatGame:{ids:[68],tone:'#F59A86',ink:'#9A2E22',prop:'bars'},
  openPokeConnectionsMode:{ids:[133,700],tone:'#F7A8C8',ink:'#A3285A',prop:'grid'},
  openOddOneOutMode:{ids:[570],tone:'#B9A3C9',ink:'#5A3F6E',prop:'odd'},
  startQuizGame:{ids:[65],tone:'#B9A6F2',ink:'#5C3FB0',prop:'abc'},
  startEvolutionChainGame:{ids:[130,129],tone:'#8FB2FF',ink:'#2F51B8',prop:'chain'},
  startPokedexOrderGame:{ids:[1],tone:'#9ADB7E',ink:'#2F7A1F',prop:'numbers'},
  openTypeComboSolo:{ids:[131],tone:'#8FDCD8',ink:'#1F6E6A',prop:'types',types:['water','ice']},
  startWeightBattle:{ids:[143,50],tone:'#E3C99A',ink:'#6B4E1E',prop:'balance'},
  openHigherLowerMode:{ids:[248,10],tone:'#A9DB8A',ink:'#2F6A1F',prop:'updown'},
  openSpeedrunMode:{ids:[291],tone:'#C4D66A',ink:'#4E5E00',prop:'timer'},
  startPartyMode:{ids:[128],tone:'#FFB27A',ink:'#8A3F0E',prop:'flag'},
  openDraftArenaMode:{ids:[448],tone:'#9FB4D6',ink:'#2F4A70',prop:'slots'},
  openDraftScoreAttackMode:{ids:[448],tone:'#9FB4D6',ink:'#2F4A70',prop:'slots'},
  openPartyRoomMode:{ids:[25,39],tone:'#C9B6F5',ink:'#5C3FB0',prop:'party',badge:'2 à 8 joueurs'},
  openMultiplayerMode:{ids:[6,9],tone:'#FFB27A',ink:'#8A3F0E',prop:'versus'},
  openStatClashMode:{ids:[107,106],tone:'#F59A86',ink:'#9A2E22',prop:'bars'},
  openStatAuctionMode:{ids:[52],tone:'#F5D96B',ink:'#6E5600',prop:'coin'},
  openDefiAmiFromAllModes:{ids:[54],tone:'#86D9B0',ink:'#1E6B45',prop:'link'},
  openDraftScoreAttackProDuel:{ids:[445,448],tone:'#9FB4D6',ink:'#2F4A70',prop:'slots',badge:'PRO'},
  openTeamBuilderScreen:{ids:[3],tone:'#9ADB7E',ink:'#2F7A1F',prop:'plus'},
  openTypeChartScreen:{ids:[493],tone:'#8FDCD8',ink:'#1F6E6A',prop:'types',types:['fire','water']},
  openPokedexMode:{ids:[4],tone:'#F59A86',ink:'#9A2E22',prop:'book'},
  openProfileScreen:{ids:[151],tone:'#F7A8C8',ink:'#A3285A',prop:'user'},
  openAchievementsScreen:{ids:[150],tone:'#F5D96B',ink:'#6E5600',prop:'trophy'},
  openMatchHistoryScreen:{ids:[251],tone:'#86D9B0',ink:'#1E6B45',prop:'history'},
  openTeamsScreen:{ids:[9],tone:'#8FB2FF',ink:'#2F51B8',prop:'slots'},
  openEmulatorMode:{ids:[233],tone:'#8FC8FF',ink:'#245F96',prop:'gamepad'},
  openLeaderboard:{ids:[384],tone:'#C4D66A',ink:'#4E5E00',prop:'podium'}
});
var MODE_TILE_PROPS = Object.freeze({
  question:'<svg viewBox="0 0 24 24" fill="currentColor"><text x="12" y="18.5" text-anchor="middle" font-family="Fredoka, Nunito, sans-serif" font-weight="700" font-size="19">?</text></svg>',
  infinity:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 12c-2-3-4-4.5-6-4.5S2.5 9.5 2.5 12 4 16.5 6 16.5s4-1.5 6-4.5 4-4.5 6-4.5 3.5 2 3.5 4.5-1.5 4.5-3.5 4.5-4-1.5-6-4.5z"/></svg>',
  loupe:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="10" cy="10" r="6"/><path d="M14.5 14.5 20 20M8.5 8.5a2 2 0 0 1 2.5-.5"/></svg>',
  pixels:'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="5.5" height="5.5" rx="1"/><rect x="9.25" y="3" width="5.5" height="5.5" rx="1" opacity=".35"/><rect x="15.5" y="3" width="5.5" height="5.5" rx="1"/><rect x="3" y="9.25" width="5.5" height="5.5" rx="1" opacity=".35"/><rect x="9.25" y="9.25" width="5.5" height="5.5" rx="1"/><rect x="15.5" y="9.25" width="5.5" height="5.5" rx="1" opacity=".35"/><rect x="3" y="15.5" width="5.5" height="5.5" rx="1"/><rect x="9.25" y="15.5" width="5.5" height="5.5" rx="1" opacity=".35"/><rect x="15.5" y="15.5" width="5.5" height="5.5" rx="1"/></svg>',
  lines:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
  wave:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M3 10v4M7 7v10M11 3v18M15 6v12M19 9v6"/></svg>',
  bars:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M4 20v-7M9.3 20V6M14.6 20v-9M20 20v-5"/></svg>',
  grid:'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="8" height="8" rx="2.5"/><rect x="13" y="3" width="8" height="8" rx="2.5" opacity=".45"/><rect x="3" y="13" width="8" height="8" rx="2.5" opacity=".45"/><rect x="13" y="13" width="8" height="8" rx="2.5"/></svg>',
  odd:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="7" cy="7" r="3.2" fill="currentColor"/><circle cx="17" cy="7" r="3.2" fill="currentColor"/><circle cx="7" cy="17" r="3.2" fill="currentColor"/><circle cx="17" cy="17" r="3.4"/><path d="m15.4 15.4 3.2 3.2m0-3.2-3.2 3.2"/></svg>',
  abc:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="4" width="18" height="6.5" rx="2.5"/><rect x="3" y="13.5" width="18" height="6.5" rx="2.5" fill="currentColor" opacity=".35"/><circle cx="6.5" cy="7.25" r="1.2" fill="currentColor"/><path d="M9.5 7.25h8" stroke-linecap="round"/></svg>',
  chain:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="4.5" cy="12" r="2.6"/><circle cx="12" cy="12" r="2.6" stroke-dasharray="2 2"/><circle cx="19.5" cy="12" r="2.6"/><path d="M7.4 12h1.4M15.2 12h1.4"/></svg>',
  numbers:'<svg viewBox="0 0 24 24" fill="currentColor"><text x="12" y="10" text-anchor="middle" font-family="Fredoka, Nunito, sans-serif" font-weight="700" font-size="7.5">001</text><text x="12" y="19" text-anchor="middle" font-family="Fredoka, Nunito, sans-serif" font-weight="700" font-size="7.5" opacity=".45">002</text></svg>',
  balance:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v17M7 20h10M4 7h16M4 7 1.8 13h4.4zM20 7l-2.2 6h4.4z"/></svg>',
  updown:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 20V4M4 8l4-4 4 4M16 4v16M12 16l4 4 4-4"/></svg>',
  timer:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5v-4M10 2.5h4M18.5 6 20 4.5"/></svg>',
  flag:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 4h13l-2.5 4.5L18 13H5" fill="currentColor" fill-opacity=".3"/></svg>',
  slots:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="8" r="2.8" fill="currentColor"/><circle cx="12" cy="8" r="2.8" fill="currentColor"/><circle cx="19" cy="8" r="2.8" fill="currentColor"/><circle cx="5" cy="16.5" r="2.8" fill="currentColor"/><circle cx="12" cy="16.5" r="2.8"/><circle cx="19" cy="16.5" r="2.8"/></svg>',
  party:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="8" cy="8.5" r="3.2"/><circle cx="17" cy="9.5" r="2.5"/><path d="M2.5 19.5c.8-3 2.9-4.6 5.5-4.6s4.7 1.6 5.5 4.6M14.5 15c2.6-.5 4.8.8 6 3.6"/></svg>',
  versus:'<svg viewBox="0 0 24 24" fill="currentColor"><text x="12" y="16.5" text-anchor="middle" font-family="Fredoka, Nunito, sans-serif" font-weight="700" font-size="11">VS</text></svg>',
  coin:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="8.5"/><text x="12" y="16" text-anchor="middle" font-family="Fredoka, Nunito, sans-serif" font-weight="700" font-size="11" fill="currentColor" stroke="none">₽</text></svg>',
  link:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><path d="M12 8v8M8 12h8"/></svg>',
  book:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M4 5.5C6.5 4 9.5 4 12 5.5v14c-2.5-1.5-5.5-1.5-8 0zM20 5.5C17.5 4 14.5 4 12 5.5v14c2.5-1.5 5.5-1.5 8 0z"/></svg>',
  user:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1-3.6 3.9-5.5 7.5-5.5s6.5 1.9 7.5 5.5"/></svg>',
  trophy:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v3M8 20h8"/></svg>',
  history:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5M3.5 4v4.5H8M12 8v4l3 2"/></svg>',
  gamepad:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="2.5" y="7" width="19" height="11" rx="5.5"/><path d="M7.5 10.5v4M5.5 12.5h4"/><circle cx="16" cy="11" r="1" fill="currentColor"/><circle cx="18" cy="13.5" r="1" fill="currentColor"/></svg>',
  podium:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M9 20V8h6v12M3 20v-7h6M15 20v-9h6v9M2 20h20"/></svg>'
});
var MODE_CATALOG_FAMILY_LABELS = Object.freeze({ guess:'Deviner', reflection:'Réflexion', arcade:'Arcade', strategy:'Stratégie', social:'Entre amis', collection:'Collection' });
var MODE_CATALOG_FAMILY_COPY = Object.freeze({ guess:'retrouve le Pokémon mystère', reflection:'liens, logique et culture', arcade:'parties rapides et records', strategy:'compose ton équipe', social:'de 2 à 8 joueurs', collection:'tes outils de dresseur' });
var MODE_CATALOG_LEVELS = Object.freeze({ easy:1, medium:2, hard:3, expert:4 });
// Unfinished games stay reachable by their own links but are not advertised in the catalogue.
var MODE_CATALOG_UNLISTED = Object.freeze(['openDraftArenaMode']);
var modeCatalogFamily = 'all';
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
  const illustration=MODE_CATALOG_ILLUSTRATIONS[key];
  if (illustration) {
    const base='img/modes/'+illustration+'-v1-';
    const sizes=variant === 'pick' ? '(max-width:760px) 112px, (max-width:1800px) 30vw, 550px' : '144px';
    return '<span class="mode-illustration is-'+variant+'" aria-hidden="true"><img src="'+base+'480.webp" srcset="'+base+'480.webp 480w, '+base+'960.webp 960w" sizes="'+sizes+'" width="960" height="640" alt="" loading="lazy" decoding="async" /></span>';
  }
  const spec=MODE_CATALOG_ART[key];
  if (!spec) return '';
  if (variant === 'home') {
    const artwork=spec.ids.slice(0,3).map(id=>'<img src="https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/other/official-artwork/'+id+'.png" data-fallback="'+modeCatalogSpriteUrl(id)+'" alt="" loading="lazy" decoding="async" width="180" height="180"/>').join('');
    const cue=spec.effect==='audio'?'<span class="cover-wave">'+[20,42,66,88,60,34,50,76,40].map(n=>'<i style="height:'+n+'px"></i>').join('')+'</span>'
      :spec.effect==='quiz'?'<span class="cover-question">?</span><span class="cover-answers"><i>A</i><i>B</i><i>C</i></span>'
      :spec.effect==='versus'?'<span class="cover-compare">↑<small>OU</small>↓</span>'
      :spec.effect==='scan'?'<span class="cover-lens"></span>'
      :spec.effect==='stats'?'<span class="cover-stats"><i></i><i></i><i></i><i></i></span>'
      :spec.effect==='dossier'?'<span class="cover-page"><i></i><i></i><i></i></span>'
      :spec.effect==='mystery'?'<span class="cover-question">?</span>'
      :spec.effect==='speed'?'<span class="cover-question">60<small>secondes</small></span>'
      :spec.effect==='types'?'<span class="cover-types"><img src="img/type-icons/fire.svg" alt=""/><b>+</b><img src="img/type-icons/flying.svg" alt=""/></span>':'';
    return '<span class="home-cover cover-'+spec.effect+'" aria-hidden="true">'+artwork+cue+'</span>';
  }
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
}
function modeCatalogIsUnlisted(card) {
  return MODE_CATALOG_UNLISTED.includes(modeCatalogActionKey(card));
}
function modeCatalogIsPro(card) {
  try { return JSON.parse(card.dataset.args || '[]')[1] === true; } catch (_e) { return false; }
}
function modeTileArtworkUrl(id) {
  return 'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/other/official-artwork/'+Number(id)+'.png';
}
function modeTilePropHtml(theme) {
  if (theme.prop === 'types') {
    return '<span class="mode-tile-prop is-types">'+theme.types.map(type=>'<img src="img/type-icons/'+type+'.svg" alt="" width="22" height="22"/>').join('<span>+</span>')+'</span>';
  }
  return '<span class="mode-tile-prop">'+(MODE_TILE_PROPS[theme.prop] || '')+'</span>';
}
function modeTileArtHtml(theme) {
  const sprites=theme.ids.slice(0,2).map((id,index)=>'<img class="mode-tile-sprite'+(index ? ' is-second' : '')+(theme.silhouette && !index ? ' is-silhouette' : '')+'" src="'+modeTileArtworkUrl(id)+'" data-fallback="'+modeCatalogSpriteUrl(id)+'" alt="" loading="lazy" decoding="async" width="124" height="124"/>');
  return '<span class="mode-tile-art'+(sprites.length > 1 ? ' has-duo' : '')+'" aria-hidden="true">'+sprites.reverse().join('')+modeTilePropHtml(theme)+'</span>';
}
function modeTileHtml(card) {
  const key=modeCatalogActionKey(card), theme=MODE_TILE_THEME[key];
  if (!theme) return '';
  const title=card.querySelector('b')?.textContent.trim() || '';
  const description=card.querySelector('small')?.textContent.trim() || '';
  const isTool=card.dataset.category === 'explore';
  const family=card.closest?.('.all-modes-cat')?.dataset.family || '';
  const familyLabel=isTool && family !== 'collection' ? 'Outil' : (MODE_CATALOG_FAMILY_LABELS[family] || '');
  const badge=modeCatalogIsPro(card) ? 'PRO' : theme.badge;
  const level=MODE_CATALOG_LEVELS[card.dataset.difficulty] || 0;
  const levelHtml=level ? '<span class="mode-tile-level" title="Difficulté : '+card.dataset.difficultyLabel+'">'+[1,2,3,4].map(i=>'<i'+(i <= level ? ' class="is-on"' : '')+'></i>').join('')+'<span>'+card.dataset.difficultyLabel+'</span></span>' : '<span></span>';
  card.dataset.search=[title, description, familyLabel, badge || ''].join(' ');
  return modeTileArtHtml(theme)+
    (badge ? '<span class="mode-tile-badge">'+badge+'</span>' : '')+
    '<span class="mode-tile-body"><span class="mode-tile-family">'+familyLabel+'</span><span class="mode-tile-title">'+title+'</span><span class="mode-tile-desc">'+description+'</span>'+
    '<span class="mode-tile-foot">'+levelHtml+'<span class="mode-tile-go" aria-hidden="true">'+(isTool ? 'Ouvrir' : 'Jouer')+' →</span></span><span class="mode-tile-record"></span></span>';
}
function modeTileRefreshRecord(card) {
  const slot=card.querySelector?.('.mode-tile-record');
  if (!slot) return;
  const html=typeof homeGameRecordHtml === 'function' ? homeGameRecordHtml(modeCatalogActionKey(card)) : '';
  if (slot.innerHTML !== html) slot.innerHTML=html;
}

function decorateModeCatalogCards() {
  document.querySelectorAll('#screen-all-modes .all-modes-card').forEach(card=>{
    modeCatalogDecorateDifficulty(card);
    if (card.classList.contains('mode-tile')) return;
    const key=modeCatalogActionKey(card), html=modeTileHtml(card);
    if (!html) return;
    const theme=MODE_TILE_THEME[key];
    card.classList.add('mode-tile');
    card.style.setProperty('--tile-tone',theme.tone);
    card.style.setProperty('--tile-ink',theme.ink);
    card.innerHTML=html;
  });
  document.querySelectorAll('#screen-all-modes .all-modes-cat').forEach(section=>{
    const title=section.querySelector('.all-modes-cat-title');
    if (!title || title.querySelector('.all-modes-cat-count')) return;
    title.insertAdjacentHTML('beforeend','<span class="all-modes-cat-count"></span><span class="all-modes-cat-desc">'+(MODE_CATALOG_FAMILY_COPY[section.dataset.family] || '')+'</span>');
  });
}
function renderModeCatalogFamilies() {
  const group=document.getElementById('mode-family-filters');
  if (!group) return;
  group.hidden=modeCatalogCategory !== 'solo';
  if (group.hidden) return;
  const counts={ all:0 };
  document.querySelectorAll('#screen-all-modes .all-modes-cat').forEach(section=>{
    const family=section.dataset.family;
    section.querySelectorAll('.all-modes-card').forEach(card=>{
      if (card.dataset.category !== 'solo' || modeCatalogIsUnlisted(card)) return;
      counts[family]=(counts[family] || 0)+1;
      counts.all++;
    });
  });
  group.innerHTML=['all','guess','reflection','arcade','strategy'].filter(family=>counts[family]).map(family=>
    '<button type="button" data-action="setModeCatalogFamily" data-args=\'["'+family+'"]\' aria-pressed="'+(family === modeCatalogFamily)+'">'+(family === 'all' ? 'Tous' : MODE_CATALOG_FAMILY_LABELS[family])+'<span>'+counts[family]+'</span></button>'
  ).join('');
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
  // Words must start a word of the card: « cri » finds Cri, not Description.
  const words = normalizeModeSearch(text).split(' ');
  return categoryMatches && difficultyMatches && normalizeModeSearch(query).split(/\s+/).every(word => !word || words.some(candidate => candidate.startsWith(word)));
}
function saveModeCatalogState() {
  if (history.state?.screen !== 'allModes') return;
  history.replaceState({ ...history.state, category: modeCatalogCategory, difficulty: modeCatalogDifficulty, family: modeCatalogFamily, query: document.getElementById('mode-search')?.value || '' }, '', location.href);
}
function renderModeCatalog() {
  var query = document.getElementById('mode-search')?.value || '';
  document.getElementById('mode-refinements')?.classList.toggle('hidden', modeCatalogCategory === 'explore');
  if (typeof renderCatalogPicks === "function") renderCatalogPicks(modeCatalogCategory, query, modeCatalogDifficulty, modeCatalogFamily);
  renderModeCatalogFamilies();
  var count = 0;
  document.querySelectorAll('#screen-all-modes .all-modes-cat').forEach(section => {
    var visible = 0;
    const familyMatches = modeCatalogCategory !== 'solo' || modeCatalogFamily === 'all' || section.dataset?.family === modeCatalogFamily;
    section.querySelectorAll('.all-modes-card').forEach(card => {
      const matches = familyMatches && !modeCatalogIsUnlisted(card) && modeCatalogMatches(card.dataset.category, card.dataset.difficulty || '', card.dataset.search || card.textContent, modeCatalogCategory, modeCatalogDifficulty, query);
      if (matches) count++;
      card.hidden = !matches;
      if (!card.hidden) { visible++; modeTileRefreshRecord(card); }
    });
    section.hidden = visible === 0;
    const counter = section.querySelector?.('.all-modes-cat-count');
    if (counter) counter.textContent = visible + (visible > 1 ? ' jeux' : ' jeu');
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
  document.getElementById('home-gens-card').hidden = modeCatalogCategory === 'explore';
  const difficultyField=document.getElementById('mode-difficulty-field');
  if (difficultyField) difficultyField.hidden = modeCatalogCategory === 'explore';
  const difficultySelect=document.getElementById('mode-difficulty');
  if (difficultySelect && difficultySelect.value !== modeCatalogDifficulty) difficultySelect.value = modeCatalogDifficulty;
  setGlobalNavActive(modeCatalogCategory === 'friends' ? 'social' : modeCatalogCategory === 'explore' ? 'extras' : 'game');
}
function setModeCatalogCategory(category, save = true) {
  modeCatalogCategory = Object.prototype.hasOwnProperty.call(modeCatalogCopy, category) ? category : 'solo';
  modeCatalogFamily = 'all';
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
function setModeCatalogFamily(family, save = true) {
  modeCatalogFamily = Object.prototype.hasOwnProperty.call(MODE_CATALOG_FAMILY_LABELS, family) ? family : 'all';
  renderModeCatalog();
  if (save) saveModeCatalogState();
}
function toggleModeRefinements() {
  const panel = document.getElementById("mode-refinements");
  const expanded = panel?.classList.toggle("is-expanded") || false;
  const button = document.getElementById("mode-refinements-toggle");
  if (button) {
    button.setAttribute("aria-expanded", String(expanded));
    button.textContent = "Filtres " + (expanded ? "▴" : "▾");
  }
}
function resetModeCatalog() {
  modeCatalogDifficulty = 'all';
  modeCatalogFamily = 'all';
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
