// Bonus of the day: the Grille du jour. A 3×3 grid, one Pokémon per cell that matches
// its row and its column, nine PP for nine cells, and each answer's rarity among the
// day's players. The server keeps the grid, the answers and the rarity.
let dailyGridState=null,dailyGridBusy=false,dailyGridSerial=0,dailyGridCell=null,dailyGridPeek=null;
const GRID_REGIONS=['Kanto','Johto','Hoenn','Sinnoh','Unys','Kalos','Alola','Galar','Paldea'];
function ensureDailyGridScreen(){
  if(document.getElementById('screen-grid'))return;
  const screen=document.createElement('section');screen.id='screen-grid';screen.className='hidden grid-screen';
  screen.innerHTML=`<div class="challenge-toolbar"><button class="btn-ghost" data-action="goToConfig">← Accueil</button><button class="btn-ghost" data-action="openLeaderboardV2" data-args='["grid","today"]'>Classement</button></div>
<article class="grid-card">
  <div class="grid-heading"><p class="challenge-kicker" id="grid-day">BONUS DU JOUR</p><h1>Grille du jour</h1><p class="grid-lead">Un Pokémon par case, qui coche sa ligne <b>et</b> sa colonne. Plus ton choix est rare, plus tu es original.</p><p id="grid-forms-rule" class="grid-lead grid-forms-rule"></p></div>
  <div id="grid-hud" class="grid-hud"></div>
  <div id="grid-board" class="grid-board"></div>
  <p id="grid-message" class="grid-message" role="status" aria-live="polite"></p>
  <form id="grid-form" class="grid-picker hidden" autocomplete="off">
    <p id="grid-picker-title" class="grid-picker-title"></p>
    <div class="wordle-search"><input id="grid-input" type="text" inputmode="search" placeholder="Nom du Pokémon" aria-label="Nom du Pokémon" aria-autocomplete="list" aria-controls="grid-suggestions" aria-expanded="false" maxlength="40"><button id="grid-submit" class="btn-blue" type="submit">Valider</button></div>
    <div id="grid-suggestions" class="wordle-suggestions hidden" role="listbox" aria-label="Pokémon proposés"></div>
    <p id="grid-picker-tried" class="grid-picker-tried"></p>
    <button type="button" class="btn-ghost grid-picker-close" data-action="closeGridPicker">Choisir une autre case</button>
  </form>
  <section id="grid-result" class="grid-result hidden" tabindex="-1"></section>
  <div class="grid-actions"><button type="button" id="grid-stop" class="btn-ghost hidden" data-action="confirmGridStop">Terminer ma grille</button></div>
  <details class="challenge-help"><summary>Règles et points</summary><p>Choisis une case, puis un Pokémon qui coche à la fois le critère de sa ligne et celui de sa colonne. Un même Pokémon ne sert qu’une fois dans ta grille.</p><p>Tu as 9 PP : chaque proposition en consomme un, bonne ou non. Reproposer un nom déjà refusé dans la même case ne coûte rien. Chaque case indique combien de réponses existent.</p><p>10 points par case trouvée, 10 de plus pour une grille complète : jusqu’à 100 points. À points égaux, l’originalité départage : la part des joueurs qui ont fait les mêmes choix que toi (moins elle est grande, mieux c’est). La Grille est le bonus du jour : elle ne compte pas dans les 100 points de la journée.</p></details>
</article>`;
  document.getElementById('screen-game').parentElement.appendChild(screen);
  const input=document.getElementById('grid-input');
  input.addEventListener('input',renderGridSuggestions);
  input.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closeGridPicker();}});
  document.getElementById('grid-form').addEventListener('submit',e=>{e.preventDefault();if(!e.isComposing)submitGridGuess();});
}
function gridMessage(text){const node=document.getElementById('grid-message');if(node)node.textContent=text;}
function gridPokemon(id){return POKEMON_BY_ID.get(Number(id))||null;}
function gridSprite(id){const p=gridPokemon(id);return p?getPokemonSprite(p):'';}
function gridAccount(){return dailyObservedAccountId()||null;}
function gridIsCurrent(s){return Boolean(s&&s.day===getDailyDateKey()&&s.accountId===gridAccount());}
function gridCriterionHtml(c){
  if(c.family==='type'&&typeof typeBadgeHtml==='function')return typeBadgeHtml(c.value);
  if(c.family==='gen')return '<b>'+escapeHtml(GRID_REGIONS[c.value-1]||c.label)+'</b><small>Gén. '+c.value+'</small>';
  return '<b>'+escapeHtml(c.label)+'</b>'+(c.hint?'<small>'+escapeHtml(c.hint)+'</small>':'');
}
function gridCellLabel(s,i){return s.rows[Math.floor(i/3)].label+' et '+s.cols[i%3].label;}
function gridCellHtml(s,i,shown=new Set()){
  const cell=s.cells[i],label=gridCellLabel(s,i);
  if(cell){
    const p=gridPokemon(cell.pokemonId);
    return '<div class="grid-cell is-filled" data-cell="'+i+'" role="img" aria-label="'+escapeHtml(label+' : '+(p?.name||'')+', choisi par '+cell.rarity+' % des joueurs')+'"><img src="'+escapeHtml(gridSprite(cell.pokemonId))+'" alt="" width="96" height="96" loading="lazy"><span class="grid-name">'+escapeHtml(p?.name||'')+'</span><span class="grid-rarity'+(cell.rarity<=10?' is-rare':'')+'">'+cell.rarity+' %</span></div>';
  }
  if(s.finished){
    // The most played answer, else an example not already shown in another cell.
    const r=s.reveal?.[i],options=[r?.popular?.pokemonId,...(r?.examples||[])].filter(Boolean),id=options.find(o=>!shown.has(o))||options[0],p=id?gridPokemon(id):null;
    if(id)shown.add(id);
    return '<div class="grid-cell is-missed" data-cell="'+i+'" role="img" aria-label="'+escapeHtml(label+' : case vide'+(p?', par exemple '+p.name:''))+'">'+(p?'<img src="'+escapeHtml(gridSprite(id))+'" alt="" width="96" height="96" loading="lazy"><span class="grid-name">'+escapeHtml(p.name)+'</span>':'')+'<span class="grid-possible">'+s.possible[i]+' possibles</span></div>';
  }
  const tried=s.misses.filter(m=>m.cell===i).length,selected=dailyGridCell===i;
  return '<button type="button" class="grid-cell'+(selected?' is-selected':'')+'" data-cell="'+i+'" data-action="openGridCell" data-args="['+i+']" aria-pressed="'+selected+'" aria-label="'+escapeHtml(label+' : '+s.possible[i]+' réponses possibles')+'"'+(s.pp<=0?' disabled':'')+'><span class="grid-plus" aria-hidden="true">+</span><span class="grid-possible">'+s.possible[i]+' possibles</span>'+(tried?'<span class="grid-tried">'+tried+' raté'+(tried>1?'s':'')+'</span>':'')+'</button>';
}
function renderGridBoard(s){
  const board=document.getElementById('grid-board'),shown=new Set(s.cells.filter(Boolean).map(c=>c.pokemonId));
  board.innerHTML='<div class="grid-corner" aria-hidden="true"><strong>'+s.pp+'</strong><span>PP</span></div>'+
    s.cols.map(c=>'<div class="grid-head grid-col" title="'+escapeHtml(c.label)+'">'+gridCriterionHtml(c)+'</div>').join('')+
    s.rows.map((r,ri)=>'<div class="grid-head grid-row" title="'+escapeHtml(r.label)+'">'+gridCriterionHtml(r)+'</div>'+[0,1,2].map(ci=>gridCellHtml(s,ri*3+ci,shown)).join('')).join('');
}
function gridOrdinal(n){return n===1?'1er':n+'e';}
function renderGridResult(s){
  const result=document.getElementById('grid-result');result.classList.toggle('hidden',!s.finished);
  if(!s.finished){result.innerHTML='';return;}
  const kicker={full:'GRILLE COMPLÈTE',out_of_pp:'PLUS DE PP'}[s.endReason]||'GRILLE TERMINÉE';
  const title=s.found===9?'Grille parfaite !':s.found>=6?'Très belle grille !':s.found>=3?'Pas mal du tout !':'Ce sera mieux demain !';
  const original=s.originality!=null&&s.players>=3;
  const rank=s.rank?'Tu es '+gridOrdinal(s.rank.rank)+' sur '+s.rank.total+' aujourd’hui.':s.authenticated?'Résultat enregistré au classement.':'Connecte-toi pour entrer au classement : ta grille te suit.';
  result.innerHTML='<p class="challenge-kicker">'+kicker+'</p><h2>'+title+'</h2><div class="challenge-score"><strong>'+s.points+'</strong><span>/ '+s.maxPoints+' points</span></div>'+
    '<p class="grid-result-line">'+s.found+' / 9 cases'+(original?' · originalité '+s.originality+' %':'')+' · '+s.players+' joueur'+(s.players>1?'s':'')+' aujourd’hui</p><p>'+rank+'</p>'+
    '<p class="grid-result-hint">Dans les cases vides : la réponse la plus jouée, sinon un exemple.</p>'+
    '<div class="challenge-actions"><button type="button" class="btn-blue" data-action="shareDailyGrid">Partager ma grille</button><button type="button" class="btn-ghost" data-action="openLeaderboardV2" data-args=\'["grid","today"]\'>Classement</button><button type="button" class="btn-ghost" data-action="goToConfig">Accueil</button></div>';
}
function renderDailyGrid(){
  const s=dailyGridState;if(!s)return;
  document.getElementById('grid-day').textContent='BONUS DU JOUR · JOUR #'+s.number;
  document.getElementById('grid-forms-rule').textContent=s.regionalForms?'Les formes régionales (Alola, Galar, Hisui, Paldea) comptent, avec leurs propres types. Une seule forme par Pokémon.':'Seule la forme normale de chaque Pokémon compte.';
  document.getElementById('grid-hud').innerHTML='<span class="grid-pp" aria-label="'+s.pp+' PP sur '+s.maxPp+'">'+Array.from({length:s.maxPp},(_,i)=>'<i class="'+(i<s.pp?'is-full':'')+'"></i>').join('')+'<b>'+s.pp+' / '+s.maxPp+' PP</b></span><span><strong>'+s.points+'</strong> / '+s.maxPoints+' pts</span><span title="Part des joueurs qui n’ont pas fait les mêmes choix que toi">Originalité <strong>'+(s.originality==null||s.players<3?'—':s.originality+' %')+'</strong></span>';
  renderGridBoard(s);renderGridResult(s);
  document.getElementById('grid-stop').classList.toggle('hidden',s.finished||s.status==='ready');
  if(s.finished){dailyGridCell=null;document.getElementById('grid-form').classList.add('hidden');}
  gridMessage(s.finished?'À demain pour une nouvelle grille !':s.status==='ready'?'Choisis une case pour commencer. Chaque proposition coûte 1 PP.':'Encore '+s.pp+' PP. Choisis une case.');
  renderGridPicker();syncGridControls();
}
function syncGridControls(){
  const submit=document.getElementById('grid-submit');if(!submit)return;
  submit.disabled=dailyGridBusy||!dailyGridState||dailyGridState.finished;submit.textContent=dailyGridBusy?'Vérification…':'Valider';
}
// Same as the server's REGIONAL_FORM_NAME (lib/daily-grid.js).
const GRID_REGIONAL_FORM=/(d['’]Alola|de Galar|de Hisui|de Paldea)( \(.+\))?$/;
function gridIsRegionalForm(p){return Boolean(p&&p.isAltForm&&p.baseId&&GRID_REGIONAL_FORM.test(p.name));}
function gridSpeciesId(p){return p.isAltForm?Number(p.baseId):Number(p.id);}
// Species, plus regional forms on the days they count; never a Pokémon (or another form of
// it) already placed in the grid, nor one already refused in this cell.
function gridChoices(q){
  const s=dailyGridState;if(!s||q.length<2)return [];
  const used=new Set(s.cells.filter(Boolean).map(c=>gridPokemon(c.pokemonId)).filter(Boolean).map(gridSpeciesId)),tried=new Set(s.misses.filter(m=>m.cell===dailyGridCell).map(m=>m.pokemonId));
  return getPokemonUiList({includeAltForms:Boolean(s.regionalForms)}).filter(p=>(p.isAltForm?gridIsRegionalForm(p):p.id>=1&&p.id<=1025)&&!used.has(gridSpeciesId(p))&&!tried.has(p.id)&&wordleNormalize(p.name).includes(q))
    .sort((a,b)=>(wordleNormalize(a.name).startsWith(q)?0:1)-(wordleNormalize(b.name).startsWith(q)?0:1)).slice(0,6);
}
function renderGridSuggestions(){
  const input=document.getElementById('grid-input'),list=document.getElementById('grid-suggestions');if(!input||!list)return;
  const choices=gridChoices(wordleNormalize(input.value));
  list.innerHTML='';list.classList.toggle('hidden',!choices.length);input.setAttribute('aria-expanded',String(Boolean(choices.length)));
  for(const p of choices){const b=document.createElement('button');b.type='button';b.setAttribute('role','option');b.textContent=p.name;b.addEventListener('pointerdown',e=>e.preventDefault());b.addEventListener('click',()=>submitGridGuess(p.id));list.appendChild(b);}
}
function renderGridPicker(){
  const s=dailyGridState,form=document.getElementById('grid-form'),i=dailyGridCell;if(!form)return;
  if(!s||i===null||s.finished||s.cells[i]){form.classList.add('hidden');return;}
  form.classList.remove('hidden');
  document.getElementById('grid-picker-title').innerHTML='<b>'+escapeHtml(s.rows[Math.floor(i/3)].label)+'</b> × <b>'+escapeHtml(s.cols[i%3].label)+'</b><span>'+s.possible[i]+' réponses possibles</span>';
  const tried=s.misses.filter(m=>m.cell===i).map(m=>gridPokemon(m.pokemonId)?.name).filter(Boolean);
  document.getElementById('grid-picker-tried').textContent=tried.length?'Raté sur cette case : '+tried.join(', '):'';
  renderGridSuggestions();
}
function openGridCell(i){
  const s=dailyGridState;if(!s||s.finished||s.cells[i]||s.pp<=0)return;
  dailyGridCell=Number(i);renderDailyGrid();
  const form=document.getElementById('grid-form'),input=document.getElementById('grid-input');
  input.value='';renderGridSuggestions();form.scrollIntoView({block:'nearest',behavior:'smooth'});input.focus({preventScroll:true});
}
function closeGridPicker(){dailyGridCell=null;const input=document.getElementById('grid-input');if(input)input.value='';if(dailyGridState)renderDailyGrid();}
function gridNudge(){if(typeof gameFeelReplay!=='function')return;gameFeelReplay(document.getElementById('grid-message'),'is-nudged');gameFeelReplay(document.querySelector('#grid-form .wordle-search'),'is-nudged');}
async function gridRequest(action='',payload={}){
  const serial=++dailyGridSerial,accountId=gridAccount();dailyGridBusy=true;syncGridControls();
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  try{
    const response=await fetch('/api/daily/grid'+action,{credentials:'same-origin',cache:'no-store',signal:controller.signal,...(action?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({day:dailyGridState?.day,accountId,...payload})}:{})});
    const data=await response.json().catch(()=>({}));
    if(serial!==dailyGridSerial)return null;
    if(!response.ok||!data.ok)throw Object.assign(new Error(data.error||'unavailable'),{code:data.error||'unavailable'});
    dailyGridState=data;return data;
  }catch(e){
    if(serial!==dailyGridSerial)return null;
    const messages={cell_filled:'Cette case est déjà remplie.',already_used:'Ce Pokémon (ou une autre de ses formes) est déjà dans ta grille : un Pokémon par case.',form_not_allowed:'Seule la forme normale compte dans cette grille.',already_tried:'Déjà refusé dans cette case. Ça ne coûte pas de PP : choisis-en un autre.',stale_daily:'Une nouvelle grille est arrivée. On recharge…',account_changed:'Ton compte a changé. On recharge ta grille…',rate_limited:'Doucement ! Réessaie dans un instant.',invalid_guess:'Choisis un Pokémon dans la liste.'};
    gridMessage(messages[e.code]||'Grille momentanément indisponible. Réessaie dans un instant.');
    if(['already_used','already_tried','invalid_guess','cell_filled','form_not_allowed'].includes(e.code))gridNudge();
    if(e.code==='stale_daily'||e.code==='account_changed')setTimeout(startDailyGrid,900);
    return null;
  }finally{clearTimeout(timer);if(serial===dailyGridSerial){dailyGridBusy=false;syncGridControls();}}
}
async function startDailyGrid(){
  ensureDailyGridScreen();closeOverlayModal();showScreen('screen-grid');setGlobalNavActive('game');
  dailyGridCell=null;document.getElementById('grid-form').classList.add('hidden');
  if(gridIsCurrent(dailyGridState))renderDailyGrid();
  else{dailyGridState=null;document.getElementById('grid-hud').innerHTML='';document.getElementById('grid-result').classList.add('hidden');document.getElementById('grid-board').innerHTML=typeof skeletonHtml==='function'?skeletonHtml('Chargement de la grille du jour','card'):'';gridMessage('');}
  if(await gridRequest())renderDailyGrid();
  else if(!dailyGridState){const b=document.createElement('button');b.className='btn-ghost';b.dataset.action='startDailyGrid';b.textContent='Réessayer';document.getElementById('grid-message').append(' ',b);}
}
async function submitGridGuess(id){
  const s=dailyGridState,cell=dailyGridCell;if(dailyGridBusy||!s||s.finished||cell===null)return;
  if(s.accountId!==gridAccount()){gridMessage('Ton compte a changé. On recharge ta grille…');startDailyGrid();return;}
  const input=document.getElementById('grid-input');
  if(!id){const q=wordleNormalize(input.value),choices=gridChoices(q),exact=choices.find(p=>wordleNormalize(p.name)===q);id=(exact||(choices.length===1?choices[0]:null))?.id;}
  if(!id){gridMessage('Choisis un Pokémon dans la liste.');gridNudge();return;}
  const data=await gridRequest('/guess',{cell,pokemonId:id});if(!data)return;
  const f=data.feedback,p=gridPokemon(id);
  // A miss keeps the same cell open, ready for another name.
  dailyGridCell=f&&!f.correct&&!data.finished?cell:null;input.value='';
  renderDailyGrid();
  if(f){
    const node=document.querySelector('#grid-board [data-cell="'+cell+'"]');
    if(f.correct)gridMessage('Bien vu ! '+(p?.name||'')+' · choisi par '+data.cells[cell].rarity+' % des joueurs.');
    else gridMessage((p?.name||'Ce Pokémon')+(p?.type1?' ('+[p.type1,p.type2].filter(Boolean).join('/')+')':'')+' ne coche pas « '+f.failed.join(' » ni « ')+' ». −1 PP.');
    if(typeof gameFeelAnswer==='function')gameFeelAnswer(f.correct,node,f.correct?'+10':'×');
    if(f.correct&&typeof gameFeelReplay==='function')gameFeelReplay(node,'is-new');
    if(!f.correct)gridNudge();
  }
  if(data.finished){const result=document.getElementById('grid-result');if(typeof gameFeelReplay==='function')gameFeelReplay(result,'is-new');result.focus({preventScroll:true});result.scrollIntoView({block:'nearest',behavior:'smooth'});}
  else if(dailyGridCell!==null)input.focus({preventScroll:true});
}
function confirmGridStop(){
  const s=dailyGridState;if(dailyGridBusy||!s||s.finished)return;
  ensureOverlay('Terminer ta grille ?','<p>Tu gardes tes '+s.points+' points ('+s.found+' / 9 cases) et tes PP restants sont perdus. Les réponses s’affichent ensuite.</p><div class="challenge-actions"><button class="btn-ghost" data-action="closeOverlayModal">Continuer à jouer</button><button class="btn-blue" data-action="stopDailyGrid">Terminer</button></div>');
}
async function stopDailyGrid(){closeOverlayModal();if(dailyGridBusy)return;dailyGridCell=null;if(await gridRequest('/stop'))renderDailyGrid();}
async function shareDailyGrid(){
  const s=dailyGridState;if(!s?.finished)return;
  const rows=[0,1,2].map(r=>[0,1,2].map(c=>{const cell=s.cells[r*3+c];return cell?(cell.rarity<=10?'🟪':'🟩'):'⬜';}).join('')).join('\n');
  const text='Pokédle · Grille du jour #'+s.number+'\n'+rows+'\n'+s.found+'/9 · '+s.points+' pts'+(s.originality!=null&&s.players>=3?' · originalité '+s.originality+' %':'')+'\nhttps://pokdle.onrender.com';
  try{if(navigator.share){await navigator.share({text});return;}await navigator.clipboard.writeText(text);if(typeof showToast==='function')showToast('Résultat copié !');}
  catch(e){if(e?.name!=='AbortError'&&typeof showToast==='function')showToast('Partage impossible sur cet appareil.');}
}
// Home: the bonus sits under the four stages, with today's progress when known.
function paintDailyGridBonus(){
  const steps=document.getElementById('daily-hero-steps');if(!steps)return;
  let bonus=document.getElementById('daily-hero-bonus');
  if(!bonus){bonus=document.createElement('p');bonus.id='daily-hero-bonus';bonus.className='daily-hero-bonus';steps.after(bonus);}
  const s=gridIsCurrent(dailyGridState)?dailyGridState:null;
  const value=s?.finished?s.points+' / 100 pts':s&&s.status!=='ready'?s.found+' / 9 cases':'À jouer';
  bonus.innerHTML='<button type="button" data-action="startDailyGrid"'+(s?.finished?' class="is-done"':'')+'><span>★ Bonus · Grille du jour</span><b>'+value+'</b></button>';
}
async function peekDailyGrid(){
  const key=dailyHomeKey();if(dailyGridPeek?.key===key&&Date.now()-dailyGridPeek.at<30000)return;
  dailyGridPeek={key,at:Date.now()};
  try{const response=await fetch('/api/daily/grid',{credentials:'same-origin',cache:'no-store'}),data=await response.json();
    if(response.ok&&data.ok&&key===dailyHomeKey()&&!dailyGridBusy&&gridIsCurrent(data)){dailyGridState=data;paintDailyGridBonus();}}catch(_e){}
}
const renderDailyHomeStepsBeforeGrid=renderDailyHomeSteps;
renderDailyHomeSteps=function(){const value=renderDailyHomeStepsBeforeGrid.apply(this,arguments);paintDailyGridBonus();peekDailyGrid();return value;};
// The day's summary offers the bonus once the four stages are behind.
const showSummaryBeforeGrid=showDailyJourneySummary;
showDailyJourneySummary=async function(){
  const value=await showSummaryBeforeGrid.apply(this,arguments),content=document.getElementById('challenge-content');
  if(content?.classList.contains('is-summary')&&!document.getElementById('journey-grid-bonus')){const p=document.createElement('p');p.id='journey-grid-bonus';p.className='grid-bonus-link';p.innerHTML='<button type="button" class="btn-ghost" data-action="startDailyGrid">★ Bonus du jour : la Grille →</button>';content.appendChild(p);}
  return value;
};
