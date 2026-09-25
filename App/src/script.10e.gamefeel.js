
// Global Pokédle game-feel layer.
// Small, reusable reactions for player actions and end-of-game progression.
let gameFeelResultTimer = null;
let gameFeelPulseTimer = null;

function gameFeelSettings() {
  try { return typeof getStoredAppSettings === 'function' ? getStoredAppSettings() : {}; }
  catch (_e) { return {}; }
}
function gameFeelReducedMotion() {
  const settings = gameFeelSettings();
  if (settings.reduceMotion) return true;
  try { return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches); }
  catch (_e) { return false; }
}
function gameFeelSoundEnabled() {
  try { return gameFeelSettings().soundEffects !== false; }
  catch (_e) { return true; }
}
function gameFeelModeLabel(mode) {
  const labels = {
    normal:'Mode illimité', daily:'Pokémon du jour', challenge:'Défi ami',
    silhouette:'Silhouette', pixel:'Pixelisé', cry:'Cri', mystery:'Stat Mystère',
    description:'Description', evolution:'Évolution', order:'Ordre Pokédex',
    quiz:'Quiz Pokémon', weight:'Duel de poids', speedrun:'Speedrun Pokédex',
    'higher-lower':'Higher or Lower', 'higher-lower-rush':'Higher or Lower 60s',
    typeCombo:'Combo de types', 'type-combo':'Combo de types',
    party:'Party Room', 'stat-clash':'Stat Clash', draft:'Draft Score Attack',
    connections:'Poké-Connections', odd:'Intrus Pokémon'
  };
  if (typeof modeLabelFr === 'function') {
    try { return modeLabelFr(mode) || labels[mode] || mode; } catch (_e) {}
  }
  return labels[mode] || String(mode || 'Partie');
}
function gameFeelMissionSnapshot() {
  const out = {};
  if (typeof ALBUM_MISSIONS === 'undefined' || typeof albumMissionState !== 'function') return out;
  for (const mission of ALBUM_MISSIONS) {
    try {
      const state = albumMissionState(mission);
      out[mission.id] = { done:Number(state?.done)||0, total:Number(state?.total)||0, ready:Boolean(state?.ready), claimed:Boolean(state?.claimed) };
    } catch (_e) {}
  }
  return out;
}
function gameFeelMissionChanges(before) {
  if (typeof ALBUM_MISSIONS === 'undefined' || typeof albumMissionState !== 'function') return [];
  const changes = [];
  for (const mission of ALBUM_MISSIONS) {
    try {
      const prev = before?.[mission.id] || { done:0,total:0,ready:false,claimed:false };
      const next = albumMissionState(mission);
      if (next.claimed) continue;
      const delta = (Number(next.done)||0) - (Number(prev.done)||0);
      const becameReady = Boolean(next.ready) && !prev.ready;
      if (delta > 0 || becameReady) changes.push({ mission, state:next, delta, becameReady });
    } catch (_e) {}
  }
  return changes.sort((a,b)=>Number(b.becameReady)-Number(a.becameReady) || b.delta-a.delta).slice(0,3);
}
function ensureGameFeelLayer() {
  let layer=document.getElementById('gamefeel-layer');
  if (layer) return layer;
  layer=document.createElement('div');
  layer.id='gamefeel-layer';
  layer.className='gamefeel-layer';
  layer.setAttribute('aria-live','polite');
  layer.setAttribute('aria-atomic','true');
  document.body.appendChild(layer);
  return layer;
}
function gameFeelPlay(kind) {
  if (!gameFeelSoundEnabled() || typeof playPokedexUiSfx !== 'function') return;
  const map={success:'correct',win:'prestige',record:'legendary',progress:'register',error:'error',loss:'error'};
  try { playPokedexUiSfx(map[kind] || kind || 'register'); } catch (_e) {}
}
function gameFeelScreenPulse(kind='success') {
  const root=document.querySelector('main') || document.body;
  if (!root) return;
  root.classList.remove('gf-pulse-success','gf-pulse-error','gf-pulse-record');
  const cls=kind==='record'?'gf-pulse-record':kind==='error'||kind==='loss'?'gf-pulse-error':'gf-pulse-success';
  if (gameFeelReducedMotion()) return;
  void root.offsetWidth;
  root.classList.add(cls);
  clearTimeout(gameFeelPulseTimer);
  gameFeelPulseTimer=setTimeout(()=>root.classList.remove(cls),520);
}
function gameFeelFloatingMark(anchor, label, kind='success') {
  if (!anchor || gameFeelReducedMotion()) return;
  const rect=anchor.getBoundingClientRect?.();
  if (!rect) return;
  const el=document.createElement('span');
  el.className='gamefeel-floating-mark is-'+kind;
  el.textContent=label;
  el.style.left=(rect.left+rect.width/2)+'px';
  el.style.top=(rect.top+Math.min(rect.height/2,36))+'px';
  document.body.appendChild(el);
  setTimeout(()=>el.remove(),850);
}
function gameFeelAnswer(ok, anchor, label) {
  const kind=ok?'success':'error';
  if (anchor?.classList) {
    anchor.classList.remove('gf-action-success','gf-action-error');
    void anchor.offsetWidth;
    anchor.classList.add(ok?'gf-action-success':'gf-action-error');
    setTimeout(()=>anchor.classList.remove('gf-action-success','gf-action-error'),650);
  }
  gameFeelFloatingMark(anchor,label || (ok?'✓':'×'),kind);
  gameFeelScreenPulse(kind);
  gameFeelPlay(kind);
}
function gameFeelScorePop(element, value, kind='success') {
  if (!element) return;
  element.classList.remove('gf-counter-pop');
  if (!gameFeelReducedMotion()) { void element.offsetWidth; element.classList.add('gf-counter-pop'); }
  if (value) gameFeelFloatingMark(element,value,kind);
}
function gameFeelResultDetail(entry) {
  if (entry?.targetName) return String(entry.targetName);
  const attempts=Number(entry?.attempts);
  if (Number.isFinite(attempts)) return attempts+' point'+(attempts>1?'s':'');
  return '';
}
function showGameFeelResult(entry, missionChanges=[]) {
  if (!entry || typeof document==='undefined') return;
  if (document.body.classList.contains('pokedex-registration-open')) {
    setTimeout(()=>showGameFeelResult(entry,missionChanges),2400);
    return;
  }
  const layer=ensureGameFeelLayer();
  const result=entry.result==='win'?'win':entry.result==='draw'?'draw':'loss';
  const title=result==='win'?'Victoire enregistrée':result==='draw'?'Égalité enregistrée':'Partie terminée';
  const icon=result==='win'?'✓':result==='draw'?'=':'×';
  const missionHtml=missionChanges.length ? '<div class="gamefeel-mission-stack">'+missionChanges.map(({mission,state,becameReady})=>{
    const pokemon=typeof POKEMON_BY_ID!=='undefined'?POKEMON_BY_ID.get(mission.pokemonId):null;
    const reward=pokemon?.name || 'Récompense';
    return '<div class="gamefeel-mission-progress '+(becameReady?'is-ready':'')+'"><span>'+(becameReady?'◆ MISSION PRÊTE':'◆ PROGRESSION')+'</span><b>'+escapeHtml(mission.title)+'</b><small>'+escapeHtml(reward)+' · '+Math.min(state.done,state.total)+'/'+state.total+'</small></div>';
  }).join('')+'</div>' : '';
  layer.innerHTML='<section class="gamefeel-result-card is-'+result+'">'+
    '<div class="gamefeel-result-icon">'+icon+'</div>'+
    '<div class="gamefeel-result-copy"><span>'+escapeHtml(gameFeelModeLabel(entry.mode))+'</span><h4>'+title+'</h4>'+(gameFeelResultDetail(entry)?'<p>'+escapeHtml(gameFeelResultDetail(entry))+'</p>':'')+'</div>'+
    missionHtml+
    (missionChanges.some(x=>x.becameReady)?'<button type="button" class="gamefeel-result-action" data-action="openPokedexMissionHub">Voir les missions →</button>':'')+
    '</section>';
  layer.classList.add('is-visible');
  gameFeelScreenPulse(result==='win'?'success':'error');
  gameFeelPlay(result==='win'?(missionChanges.some(x=>x.becameReady)?'record':'win'):'loss');
  clearTimeout(gameFeelResultTimer);
  gameFeelResultTimer=setTimeout(()=>layer.classList.remove('is-visible'), missionChanges.length?5200:3200);
}
function gameFeelSoloGrade(won, attempts) {
  if (!won) return { grade:'—', label:'Mystère révélé' };
  const n=Math.max(1,Number(attempts)||1);
  if (n===1) return {grade:'S',label:'Lecture parfaite'};
  if (n<=3) return {grade:'A',label:'Excellent'};
  if (n<=5) return {grade:'B',label:'Solide'};
  return {grade:'C',label:'Trouvé'};
}
function gameFeelCollectionProgress(pokemon) {
  const discoveries = playerProfile?.discoveries || {};
  let national = null;
  let region = null;
  try {
    national = typeof pokedexCollectionNationalStats === 'function'
      ? pokedexCollectionNationalStats()
      : null;
    region = typeof pokedexCollectionRegionStats === 'function'
      ? pokedexCollectionRegionStats(pokemon?.gen)
      : null;
  } catch (_e) {}
  if (!national) {
    const base = typeof getPokemonUiList === 'function'
      ? getPokemonUiList({ includeAltForms:false }).filter(p=>!p.isAltForm)
      : [];
    national = {
      found: base.filter(p=>discoveries[p.id]).length,
      total: base.length,
      percent: base.length ? Math.round(base.filter(p=>discoveries[p.id]).length/base.length*100) : 0
    };
  }
  if (!region) {
    const group = typeof getPokemonUiList === 'function'
      ? getPokemonUiList({ includeAltForms:false }).filter(p=>!p.isAltForm && Number(p.gen)===Number(pokemon?.gen))
      : [];
    const found = group.filter(p=>discoveries[p.id]).length;
    region = { found, total:group.length, percent:group.length ? Math.round(found/group.length*100) : 0 };
  }
  return { national, region };
}
function renderGameFeelResultProgress(entry, pokemon, missionChanges=[], wasDiscovered=false) {
  const box=document.getElementById('win-box');
  if (!box || !pokemon || !entry || box.classList.contains('hidden')) return;
  let panel=document.getElementById('win-ceremony-progress');
  if (!panel) {
    panel=document.createElement('section');
    panel.id='win-ceremony-progress';
    panel.className='win-ceremony-progress';
    const summary=document.getElementById('win-gamefeel-summary');
    if (summary) summary.insertAdjacentElement('afterend',panel);
    else {
      const actions=box.querySelector('.win-btns');
      if (actions) box.insertBefore(panel,actions);
      else box.appendChild(panel);
    }
  }
  const won=entry.result==='win';
  const nowDiscovered=Boolean(playerProfile?.discoveries?.[pokemon.id]);
  const newEntry=won && !wasDiscovered && nowDiscovered;
  const alt=Boolean(pokemon.isAltForm);
  const statusClass=!won?'is-loss':newEntry?'is-new':'is-known';
  const statusLabel=!won
    ? 'Album inchangé'
    : newEntry
      ? (alt?'Nouvelle forme enregistrée':'Nouvelle entrée enregistrée')
      : 'Déjà enregistré';
  const {national,region}=gameFeelCollectionProgress(pokemon);
  const nationalPercent=Math.max(0,Math.min(100,Number(national?.percent)||0));
  const regionPercent=Math.max(0,Math.min(100,Number(region?.percent)||0));
  const mission=missionChanges[0] || null;
  const missionHtml=mission ? '<div class="win-ceremony-mission '+(mission.becameReady?'is-ready':'')+'">'+
      '<span>'+(mission.becameReady?'MISSION PRÊTE':'MISSION EN PROGRESSION')+'</span>'+
      '<b>'+escapeHtml(mission.mission.title)+'</b>'+
      '<small>'+Math.min(Number(mission.state.done)||0,Number(mission.state.total)||0)+' / '+(Number(mission.state.total)||0)+'</small>'+
    '</div>' : '';
  panel.innerHTML=
    '<div class="win-ceremony-head">'+
      '<div><span>PROGRESSION APRÈS LA PARTIE</span><b>'+escapeHtml(pokemon.name)+'</b></div>'+
      '<strong class="win-progress-status '+statusClass+'">'+statusLabel+'</strong>'+
    '</div>'+
    '<div class="win-progress-grid">'+
      '<div class="win-progress-card"><div><span>Pokédex national</span><b>'+Number(national?.found||0)+' <small>/ '+Number(national?.total||0)+'</small></b></div><div class="win-progress-track" aria-label="Progression Pokédex national"><i style="width:'+nationalPercent+'%"></i></div><small>'+nationalPercent+'%</small></div>'+
      '<div class="win-progress-card"><div><span>Génération '+Number(pokemon.gen||0)+'</span><b>'+Number(region?.found||0)+' <small>/ '+Number(region?.total||0)+'</small></b></div><div class="win-progress-track" aria-label="Progression génération"><i style="width:'+regionPercent+'%"></i></div><small>'+regionPercent+'%</small></div>'+
    '</div>'+
    missionHtml;
}
function enhanceGameOverBox({won,pokemon,attempts,mode}) {
  const box=document.getElementById('win-box');
  const inner=box?.querySelector('.win-inner');
  if (!box || !inner || !pokemon) return;
  let summary=document.getElementById('win-gamefeel-summary');
  if (!summary) {
    summary=document.createElement('div');
    summary.id='win-gamefeel-summary';
    summary.className='win-gamefeel-summary';
    inner.insertAdjacentElement('afterend',summary);
  }
  const grade=gameFeelSoloGrade(won,attempts);
  const dexId=typeof getPokemonSpriteId==='function'?getPokemonSpriteId(pokemon):pokemon.id;
  const types=typeof typeBadgesHtml==='function'?typeBadgesHtml(pokemon.type1,pokemon.type2||null):'';
  summary.innerHTML='<div class="win-grade '+(won?'is-win':'is-loss')+'"><strong>'+grade.grade+'</strong><span>'+grade.label+'</span></div>'+
    '<div class="win-result-facts">'+
      '<span><small>Mode</small><b>'+escapeHtml(gameFeelModeLabel(mode))+'</b></span>'+
      '<span><small>Entrée</small><b>#'+String(dexId).padStart(3,'0')+'</b></span>'+
      '<span><small>Essais</small><b>'+Math.max(0,Number(attempts)||0)+'</b></span>'+
    '</div>'+
    '<div class="win-result-types">'+types+'</div>';
  box.classList.toggle('is-win-result',Boolean(won));
  box.classList.toggle('is-loss-result',!won);
}

if (typeof recordMatchHistory==='function') {
  const recordMatchHistoryBeforeGameFeel=recordMatchHistory;
  recordMatchHistory=function(entry) {
    const before=gameFeelMissionSnapshot();
    const pokemon=(typeof secretPokemon!=='undefined' && secretPokemon && entry?.targetName===secretPokemon.name) ? secretPokemon : null;
    const wasDiscovered=Boolean(pokemon && playerProfile?.discoveries?.[pokemon.id]);
    const result=recordMatchHistoryBeforeGameFeel(entry);
    const changes=gameFeelMissionChanges(before);
    if (pokemon) setTimeout(()=>renderGameFeelResultProgress(entry,pokemon,changes,wasDiscovered),0);
    setTimeout(()=>showGameFeelResult(entry,changes),260);
    return result;
  };
}
