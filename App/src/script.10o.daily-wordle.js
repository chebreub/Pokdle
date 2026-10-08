// Daily stage two. The browser only sees evaluated guesses, never the hidden name.
let dailyWordleState=null, dailyWordleBusy=false, dailyWordleSerial=0;
function wordleNormalize(name) {
  return String(name).replace(/♀/g,"F").replace(/♂/g,"M").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z]/g,"");
}
function ensureDailyWordleScreen() {
  if(document.getElementById('screen-wordle'))return;
  const screen=document.createElement('section');screen.id='screen-wordle';screen.className='hidden wordle-screen';
  screen.innerHTML=`<div class="wordle-toolbar"><button class="btn-ghost" data-action="goToConfig">← Accueil</button><button class="btn-ghost" data-action="openLeaderboardV2" data-args='["wordle","today"]'>Classement</button></div>
    <article class="wordle-card"><nav class="wordle-journey" aria-label="Parcours du jour"><button data-action="startDailyGame">1 · Enquête</button><span aria-current="step">2 · Wordle</span></nav>
    <header><p class="wordle-kicker" id="wordle-day">LE RENDEZ-VOUS DU JOUR</p><h1>Un nom à déchiffrer</h1><p>Un autre Pokémon. Six essais. Chaque lettre te rapproche du mystère.</p></header>
    <div id="wordle-message" class="wordle-message" role="status" aria-live="polite"></div>
    <div id="wordle-board" class="wordle-board" aria-label="Grille du Wordle"></div>
    <div class="wordle-legend"><span><i class="exact">✓</i> Bien placée</span><span><i class="present">↔</i> Ailleurs</span><span><i class="absent">×</i> Absente</span></div>
    <form id="wordle-form" class="wordle-form"><label for="wordle-input">Ta proposition</label><div class="wordle-search"><input id="wordle-input" type="text" placeholder="Nom d’un Pokémon…" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="80" aria-controls="wordle-suggestions" aria-expanded="false"><button id="wordle-submit" class="btn-blue" type="submit">Valider</button></div><div id="wordle-suggestions" class="wordle-suggestions hidden" aria-label="Propositions de Pokémon"></div></form>
    <div id="wordle-keyboard" class="wordle-keyboard" aria-label="Clavier de lettres"></div>
    <section id="wordle-result" class="wordle-result hidden" aria-live="polite"></section>
    <details class="wordle-help"><summary>Comment jouer et marquer des points ?</summary><p>Propose un vrai Pokémon, même si son nom est plus long ou plus court. Une lettre verte est bien placée, une lettre orange se trouve ailleurs. Les lettres répétées respectent le nombre de copies du nom mystère.</p><p>Accents, espaces, chiffres et ponctuation ne prennent aucune case. Pour Nidoran, ♀ devient F et ♂ devient M. La cible est une espèce de base.</p><p>Une victoire rapporte 6 points au premier essai, puis un point de moins par essai, jusqu’à 1. Une défaite ou un abandon rapporte 0. Le classement Wordle compare le nombre d’essais des victoires ; ces points ne changent pas la Ligue.</p><p>Une partie commune par jour, renouvelée à minuit à Paris. Invités : progression conservée sur cet appareil, sans classement.</p></details>
    <button id="wordle-abandon" class="btn-ghost" data-action="confirmWordleAbandon">Révéler et terminer</button>
    </article>`;
  document.getElementById('screen-game').parentElement.appendChild(screen);
  const input=document.getElementById('wordle-input');
  input.addEventListener('input',renderWordleSuggestions);
  input.addEventListener('keydown',e=>{if(e.isComposing&&e.key==='Enter')e.preventDefault();if(e.key==='Escape'){document.getElementById('wordle-suggestions').classList.add('hidden');input.setAttribute('aria-expanded','false');}});
  document.getElementById('wordle-form').addEventListener('submit',e=>{e.preventDefault();if(!e.isComposing)submitDailyWordle();});
  const keyboard=document.getElementById('wordle-keyboard');
  keyboard.innerHTML=['AZERTYUIOP','QSDFGHJKLM','WXCVBN'].map(line=>'<div class="wordle-key-row">'+[...line].map(letter=>'<button type="button" data-action="wordleKey" data-args=\'["'+letter+'"]\' data-letter="'+letter+'">'+letter+'</button>').join('')+'</div>').join('')+'<div class="wordle-key-row"><button type="button" data-action="wordleKey" data-args=\'["Backspace"]\' aria-label="Effacer une lettre">⌫ Effacer</button><button type="button" data-action="wordleKey" data-args=\'["Enter"]\'>Valider ↵</button></div>';
  keyboard.addEventListener('pointerdown',e=>{if(e.target.closest('button'))e.preventDefault();});
}
function wordleMessage(text) {const node=document.getElementById('wordle-message');if(node)node.textContent=text;}
function wordleCells(letters,colors=[]) {
  const labels={exact:'bien placée',present:'présente ailleurs',absent:'absente'};
  return [...letters].map((letter,i)=>'<span class="wordle-cell '+(colors[i]||'empty')+'" aria-label="'+escapeHtml(letter==='?'?'Lettre inconnue':letter+(labels[colors[i]]?' : '+labels[colors[i]]:''))+'">'+escapeHtml(letter)+'</span>').join('');
}
function renderDailyWordle() {
  const s=dailyWordleState;if(!s)return;
  document.getElementById('wordle-day').textContent='JOUR #'+s.number+' · ÉPREUVE 2/2';
  const known=Array(s.length).fill('?'), keyStates={},priority={absent:1,present:2,exact:3};
  for(const row of s.rows)for(let i=0;i<row.letters.length;i++) {
    const letter=row.letters[i],color=row.colors[i];
    if(color==='exact'&&i<known.length)known[i]=letter;
    if((priority[color]||0)>(priority[keyStates[letter]]||0))keyStates[letter]=color;
  }
  const grid=document.getElementById('wordle-board');
  grid.innerHTML='<div class="wordle-mystery"><small>NOM MYSTÈRE · '+s.length+' LETTRES</small><div class="wordle-tiles" style="--wordle-columns:'+s.length+'">'+wordleCells(known.join(''),known.map(l=>l==='?'?'empty':'exact'))+'</div></div>'+
    s.rows.map((row,i)=>'<div class="wordle-guess"><small>ESSAI '+(i+1)+' · '+escapeHtml(row.name)+'</small><div class="wordle-tiles" style="--wordle-columns:'+row.letters.length+'">'+wordleCells(row.letters,row.colors)+'</div></div>').join('')+
    (!s.finished?'<div class="wordle-guess wordle-next"><small>ESSAI '+(s.attempts+1)+' / '+s.maxTries+'</small><div class="wordle-tiles" style="--wordle-columns:'+s.length+'">'+wordleCells(' '.repeat(s.length))+'</div></div>':'');
  for(const key of document.querySelectorAll('#wordle-keyboard [data-letter]'))key.className=keyStates[key.dataset.letter]||'';
  document.getElementById('wordle-form').classList.toggle('hidden',s.finished);
  document.getElementById('wordle-keyboard').classList.toggle('hidden',s.finished);
  document.getElementById('wordle-abandon').classList.toggle('hidden',s.finished);
  const result=document.getElementById('wordle-result');result.classList.toggle('hidden',!s.finished);
  if(s.finished) {
    const p=POKEMON_BY_ID.get(Number(s.answerId));
    result.innerHTML='<p class="wordle-kicker">'+(s.won?'NOM DÉCHIFFRÉ !':'LE MYSTÈRE EST RÉVÉLÉ')+'</p><div class="wordle-answer">'+(p?'<img src="'+escapeHtml(getPokemonSprite(p))+'" alt="" width="80" height="80">':'')+'<div><h2>'+escapeHtml(s.answerName)+'</h2><p>'+(s.won?'Trouvé en '+s.attempts+' essai'+(s.attempts>1?'s':'')+'.':s.status==='abandoned'?'Tu as choisi de révéler le nom.':'Les six essais sont épuisés. On retente demain !')+'</p></div></div><div class="wordle-score"><strong>'+s.points+' <small>pt'+(s.points>1?'s':'')+'</small></strong><span>'+(s.won?'6 − '+(s.attempts-1)+' essai'+(s.attempts>2?'s':'')+' supplémentaire'+(s.attempts>2?'s':''): 'Aucun point sur cette épreuve')+'</span></div><p>'+(s.ranked?'Ta victoire est enregistrée au classement Wordle.':s.authenticated?'Cette partie ne compte pas au classement.':'Tu as joué en invité : résultat conservé, hors classement.')+'</p><div class="wordle-result-actions"><button class="btn-blue" data-action="shareDailyWordle">Partager ma grille</button><button class="btn-ghost" data-action="openLeaderboardV2" data-args=\'["wordle","today"]\'>Classement</button><button class="btn-ghost" data-action="goToConfig">Retour à l’accueil</button></div>';
    wordleMessage(s.won?'Bravo ! Les deux épreuves du jour sont terminées.':'Épreuve terminée. Un nouveau nom arrive à minuit à Paris.');
  } else wordleMessage((s.maxTries-s.attempts)+' essai'+(s.maxTries-s.attempts>1?'s':'')+' restant'+(s.maxTries-s.attempts>1?'s':'')+' · progression sauvegardée');
  syncWordleControls();
  renderWordleSuggestions();
}
function syncWordleControls() {
  const submit=document.getElementById('wordle-submit');if(!submit)return;
  submit.disabled=dailyWordleBusy||!dailyWordleState||dailyWordleState.finished;
  submit.textContent=dailyWordleBusy?'Vérification…':'Valider';submit.setAttribute('aria-busy',String(dailyWordleBusy));
  document.getElementById('wordle-abandon').disabled=submit.disabled;
  document.querySelectorAll('#wordle-keyboard button').forEach(b=>b.disabled=!dailyWordleState||dailyWordleState.finished||(dailyWordleBusy&&b.dataset.args==='["Enter"]'));
  document.getElementById('wordle-input').disabled=!dailyWordleState||dailyWordleState.finished;
}
async function wordleRequest(action='',pokemonId) {
  const serial=++dailyWordleSerial,accountId=dailyObservedAccountId();dailyWordleBusy=true;syncWordleControls();
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  try {
    const response=await fetch('/api/daily/wordle'+action,{credentials:'same-origin',signal:controller.signal,
      ...(action?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({day:dailyWordleState?.day,accountId,pokemonId})}:{})});
    const data=await response.json();
    const current=serial===dailyWordleSerial&&accountId===dailyObservedAccountId()&&!document.getElementById('screen-wordle')?.classList.contains('hidden');
    if(!current)return false;
    if(!response.ok||!data.ok)throw Object.assign(new Error(data.error||'unavailable'),{code:data.error});
    if(data.accountId!==accountId)throw Object.assign(new Error('account_changed'),{code:'account_changed'});
    dailyWordleState=data;renderDailyWordle();
    if(action&&data.finished)document.getElementById('wordle-result').scrollIntoView({block:'nearest'});
    if(data.duplicate)wordleMessage('Ce Pokémon a déjà été proposé. Aucun essai retiré.');
    return true;
  } catch(e) {
    if(serial!==dailyWordleSerial||document.getElementById('screen-wordle')?.classList.contains('hidden'))return false;
    const messages={daily_required:'Termine d’abord l’Enquête du jour, même en révélant la réponse.',stale_daily:'Le jour a changé à Paris. Recharge l’épreuve du jour.',account_changed:'Ton compte a changé. Recharge ta partie.',rate_limited:'Trop de propositions rapprochées. Réessaie dans une minute.'};
    wordleMessage(messages[e.code]||'Le serveur est injoignable. Réessaie : tes propositions validées sont conservées.');
    const retry=document.createElement('button');retry.className='btn-ghost';
    const nextDay=e.code==='daily_required'||e.code==='stale_daily';
    retry.dataset.action=nextDay?'startDailyGame':'startDailyWordle';retry.textContent=nextDay?'Ouvrir l’Enquête du jour':'Recharger l’épreuve';document.getElementById('wordle-message').append(' ',retry);
    return false;
  } finally {clearTimeout(timer);if(serial===dailyWordleSerial){dailyWordleBusy=false;syncWordleControls();}}
}
async function startDailyWordle() {
  ensureDailyWordleScreen();closeOverlayModal();showScreen('screen-wordle');setGlobalNavActive('game');
  dailyWordleState=null;document.getElementById('wordle-board').innerHTML='';document.getElementById('wordle-result').classList.add('hidden');
  document.getElementById('wordle-form').classList.remove('hidden');document.getElementById('wordle-keyboard').classList.remove('hidden');
  document.getElementById('wordle-input').value='';document.getElementById('wordle-suggestions').classList.add('hidden');
  wordleMessage('Ouverture du dossier de lettres…');await wordleRequest();
}
function renderWordleSuggestions() {
  const input=document.getElementById('wordle-input'),list=document.getElementById('wordle-suggestions'),query=wordleNormalize(input.value);
  const next=document.querySelector('.wordle-next .wordle-tiles');
  if(next){const width=Math.max(query.length,dailyWordleState?.length||0);next.style.setProperty('--wordle-columns',width);next.innerHTML=wordleCells(query.padEnd(width,' '));}
  const choices=query.length>=2?getPokemonUiList().filter(p=>wordleNormalize(p.name).includes(query)&&!dailyWordleState?.rows.some(row=>row.pokemonId===p.id)).slice(0,7):[];
  list.innerHTML='';list.classList.toggle('hidden',!choices.length);input.setAttribute('aria-expanded',String(Boolean(choices.length)));
  for(const p of choices) {
    const button=document.createElement('button');button.type='button';button.textContent=p.name;
    button.addEventListener('pointerdown',e=>e.preventDefault());
    button.addEventListener('click',()=>submitDailyWordle(p.id));list.appendChild(button);
  }
}
async function submitDailyWordle(pokemonId=null) {
  if(dailyWordleBusy||!dailyWordleState||dailyWordleState.finished)return;
  if(dailyWordleState.accountId!==dailyObservedAccountId()){wordleMessage('Ton compte a changé. Recharge ta partie.');return;}
  const input=document.getElementById('wordle-input'),draft=input.value;
  const p=pokemonId?POKEMON_BY_ID.get(Number(pokemonId)):getPokemonUiList().find(p=>wordleNormalize(p.name)===wordleNormalize(draft));
  if(!p){wordleMessage('Choisis un vrai nom de Pokémon dans les propositions. Aucun essai retiré.');return;}
  if(dailyWordleState.rows.some(row=>row.letters===wordleNormalize(p.name))){wordleMessage('Déjà proposé ! Choisis un autre Pokémon.');return;}
  input.value='';document.getElementById('wordle-suggestions').classList.add('hidden');input.setAttribute('aria-expanded','false');input.focus({preventScroll:true});
  const serial=dailyWordleSerial+1,accountId=dailyObservedAccountId();
  const ok=await wordleRequest('/guess',p.id);
  if(serial!==dailyWordleSerial||accountId!==dailyObservedAccountId()||document.getElementById('screen-wordle')?.classList.contains('hidden'))return;
  if(!ok&&!input.value&&!dailyWordleState?.finished)input.value=draft;
  renderWordleSuggestions();
}
function wordleKey(key) {
  if(!dailyWordleState||dailyWordleState.finished)return;
  if(key==='Enter'){submitDailyWordle();return;}
  const input=document.getElementById('wordle-input');
  if(key==='Backspace')input.value=input.value.slice(0,-1);else if(input.value.length<80)input.value+=key;
  renderWordleSuggestions();
}
function confirmWordleAbandon() {
  if(dailyWordleBusy||!dailyWordleState||dailyWordleState.finished)return;
  ensureOverlay('Révéler le nom ?', '<p>Cela termine le Wordle du jour avec 0 point. Tu pourras revenir demain.</p><div class="wordle-result-actions"><button class="btn-ghost" data-action="closeOverlayModal">Continuer à chercher</button><button class="btn-blue" data-action="abandonDailyWordle">Révéler et terminer</button></div>');
}
async function abandonDailyWordle() {closeOverlayModal();if(!dailyWordleBusy&&dailyWordleState&&!dailyWordleState.finished)await wordleRequest('/abandon');}
async function shareDailyWordle() {
  const s=dailyWordleState;if(!s?.finished)return;
  const emoji={exact:'🟩',present:'🟧',absent:'⬜'};
  const text='Pokédle #'+s.number+' · Wordle '+(s.won?s.attempts:'X')+'/6 · '+s.points+' pt'+(s.points>1?'s':'')+'\n'+s.rows.map(r=>r.colors.map(c=>emoji[c]).join('')).join('\n')+'\nhttps://pokdle.onrender.com/';
  try{await navigator.clipboard.writeText(text);wordleMessage('Grille copiée, sans révéler le Pokémon !');}catch(_e){ensureOverlay('Partager ma grille','<pre>'+escapeHtml(text)+'</pre>');}
}

// Keep the existing result controller and its Unlimited action. Add the next stage.
const renderGameOverBeforeWordle=renderGameOverBox;
renderGameOverBox=function() {
  const value=renderGameOverBeforeWordle.apply(this,arguments),restart=document.getElementById('btn-restart');
  let next=document.getElementById('daily-wordle-next');
  if(gameMode==='daily'&&restart) {
    if(!next){next=document.createElement('button');next.id='daily-wordle-next';next.type='button';next.className='btn-blue result-primary';next.dataset.action='startDailyWordle';restart.before(next);}
    next.textContent='Épreuve suivante : Wordle →';next.classList.remove('hidden');
  } else next?.classList.add('hidden');
  if(restart){const daily=gameMode==='daily';restart.classList.toggle('btn-blue',!daily);restart.classList.toggle('result-primary',!daily);restart.classList.toggle('btn-ghost',daily);}
  return value;
};
const renderDailyHeroBeforeWordle=renderDailyHero;
renderDailyHero=function() {
  const value=renderDailyHeroBeforeWordle.apply(this,arguments),row=document.querySelector('#daily-hero .pk-hero-cta-row');
  if(row) {
    let button=document.getElementById('daily-wordle-home');
    if(!button){button=document.createElement('button');button.id='daily-wordle-home';button.type='button';button.className='pk-cta-ghost';button.dataset.action='startDailyWordle';row.appendChild(button);}
    const complete=Boolean(getTodayDailyResult());button.classList.toggle('hidden',!complete);button.textContent='Épreuve 2 : Wordle →';
    const subtitle=document.querySelector('#daily-hero .pk-hero-sub');
    if(complete&&subtitle)subtitle.textContent='Enquête terminée. Passe au Wordle du jour : un autre nom à déchiffrer en six essais.';
  }
  return value;
};
document.addEventListener('DOMContentLoaded',()=>renderDailyHero());
function refreshWordleDay() {
  if(dailyWordleState&&dailyWordleState.day!==getDailyDateKey()&&!document.getElementById('screen-wordle')?.classList.contains('hidden'))startDailyWordle();
}
setInterval(refreshWordleDay,30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshWordleDay();});
