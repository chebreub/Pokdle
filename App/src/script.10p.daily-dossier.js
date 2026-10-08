// Stage three: common questions and scores are owned by the server.
let dailyDossierState=null,dailyDossierBusy=false,dailyDossierSerial=0,dailyDossierFeedback=false;
function ensureDailyDossierScreen() {
  if(document.getElementById('screen-dossier'))return;
  const screen=document.createElement('section');screen.id='screen-dossier';screen.className='hidden dossier-screen';
  screen.innerHTML=`<div class="dossier-toolbar"><button class="btn-ghost" data-action="goToConfig">← Accueil</button><button class="btn-ghost" data-action="openLeaderboardV2" data-args='["dossier","today"]'>Classement</button></div>
    <article class="dossier-card"><nav class="dossier-journey" aria-label="Parcours du jour"><button data-action="startDailyGame">1 · Enquête</button><button data-action="startDailyWordle">2 · Wordle</button><span aria-current="step">3 · Dossier</span></nav>
    <div class="dossier-heading"><p class="dossier-kicker" id="dossier-day">LE DOSSIER DU JOUR</p><h1>Tu l’as trouvé. Le connais-tu ?</h1><p>Dix questions pour explorer le Pokémon de ton enquête. Une erreur ? Tu apprends, puis tu continues.</p></div>
    <div id="dossier-pokemon" class="dossier-pokemon"></div><div id="dossier-message" class="dossier-message" role="status" aria-live="polite"></div><div id="dossier-progress" class="dossier-progress"></div>
    <section id="dossier-question" class="dossier-question" aria-labelledby="dossier-prompt"></section><section id="dossier-result" class="dossier-result hidden" tabindex="-1" aria-live="polite"></section>
    <details class="dossier-help"><summary>Règles et points du Dossier</summary><p>Les mêmes questions pour tous, une seule tentative par jour. Chaque bonne réponse rapporte 1 point. Les erreurs n’arrêtent pas la partie. Un sans-faute sur les dix premières questions ouvre dix questions bonus : jusqu’à 20 points.</p><p>Le chrono n’est pas une limite : il départage les égalités au classement. Les statistiques sont des valeurs de base, avant niveau, nature, IV et EV. Les évolutions incluent les branches et les variantes régionales.</p><p>Invités : ta progression est conservée sur cet appareil, hors classement. Connecte-toi avant de terminer pour enregistrer ton résultat. Le Dossier ne modifie pas les points de Ligue.</p></details>
    <button id="dossier-abandon" class="btn-ghost" data-action="confirmDossierAbandon">Terminer sans finir le dossier</button></article>`;
  document.getElementById('screen-game').parentElement.appendChild(screen);
}
function dossierMessage(text){const node=document.getElementById('dossier-message');if(node)node.textContent=text;}
function dossierTime(ms){const sec=Math.floor(Number(ms||0)/1000);return Math.floor(sec/60)+' min '+String(sec%60).padStart(2,'0')+' s';}
function renderDailyDossier() {
  const s=dailyDossierState;if(!s)return;
  document.getElementById('dossier-day').textContent='JOUR #'+s.number+' · ÉPREUVE 3/3';
  const p=POKEMON_BY_ID.get(s.pokemonId);
  document.getElementById('dossier-pokemon').innerHTML=(p?'<img src="'+escapeHtml(getPokemonSprite(p))+'" alt="" width="96" height="96">':'')+'<div><small>LE POKÉMON DE TON ENQUÊTE</small><h2>'+escapeHtml(s.pokemonName)+'</h2><p>'+(s.bonusUnlocked?'Dossier expert débloqué · jusqu’à 20 points':'10 questions · 1 point par bonne réponse')+'</p></div>';
  document.getElementById('dossier-progress').innerHTML='<div class="dossier-progress-label"><strong>'+s.answered+' / '+s.total+' réponses</strong><span>'+s.points+' pt'+(s.points>1?'s':'')+'</span></div><div class="dossier-dots" aria-label="Progression des réponses">'+Array.from({length:s.total},(_,i)=>'<span class="'+(i<s.results.length?(s.results[i].correct?'correct':'incorrect'):i===s.answered?'current':'')+'" aria-label="Question '+(i+1)+(i<s.results.length?(s.results[i].correct?' : correcte':' : incorrecte'):' : à venir')+'">'+(i<s.results.length?(s.results[i].correct?'✓':'×'):i+1)+'</span>').join('')+'</div>';
  const question=document.getElementById('dossier-question'),result=document.getElementById('dossier-result');
  question.classList.toggle('hidden',s.finished);result.classList.toggle('hidden',!s.finished);document.getElementById('dossier-abandon').classList.toggle('hidden',s.finished);
  if(s.finished) {
    const completed=s.status==='completed';
    const review=s.results.map((r,i)=>'<li><strong>'+(i+1)+'. '+escapeHtml(r.prompt)+'</strong><p class="'+(r.correct?'correct':'incorrect')+'">'+(r.correct?'✓ Bonne réponse':'× Ta réponse : '+escapeHtml(r.options[r.choice]))+'</p><p>'+escapeHtml(r.explanation)+'</p></li>').join('');
    result.innerHTML='<p class="dossier-kicker">'+(completed?'DOSSIER BOUCLÉ':'DOSSIER REFERMÉ')+'</p><h2>'+(completed?s.points===20?'Expert du jour !':s.baseCorrect===10?'Un sans-faute sur le dossier !':'Une découverte de plus.':'On reprend demain.')+'</h2><div class="dossier-score"><strong>'+s.points+'</strong><span>/ '+s.total+' points</span></div><div class="dossier-breakdown"><span>Dossier : <strong>'+s.baseCorrect+' / 10</strong></span>'+(s.bonusUnlocked?'<span>Bonus : <strong>'+s.results.slice(10).filter(r=>r.correct).length+' / 10</strong></span>':'<span>Bonus expert : un 10/10 le débloque</span>')+'</div><p>'+(completed?'Un point par bonne réponse.':'Terminer sans finir rapporte 0 point, même si des réponses étaient correctes.')+'</p><p class="dossier-result-status">'+(s.ranked?'Résultat enregistré · '+dossierTime(s.elapsedMs)+' · le temps départage les égalités.':s.authenticated?'Ce résultat reste hors classement.':'Résultat invité conservé · hors classement.')+'</p><div class="dossier-result-actions"><button class="btn-blue" data-action="shareDailyDossier">Partager mon dossier</button><button class="btn-ghost" data-action="openLeaderboardV2" data-args=\'["dossier","today"]\'>Voir mon classement</button><button class="btn-ghost" data-action="goToConfig">Retour à l’accueil</button></div>'+(review?'<details class="dossier-review"><summary>Mon carnet de corrections</summary><ol>'+review+'</ol></details>':'');
    dossierMessage('Les trois épreuves du parcours sont terminées. Nouveau rendez-vous à minuit à Paris.');
  }else {
    const feedback=dailyDossierFeedback?s.feedback:null,q=feedback||s.question,qIndex=feedback?feedback.index:s.question.index;
    question.innerHTML='<p class="dossier-topic">'+(qIndex>=10?'BONUS EXPERT · ':'')+(feedback?'CORRECTION':escapeHtml(q.category))+' · QUESTION '+(qIndex+1)+'</p><h2 id="dossier-prompt" tabindex="-1">'+escapeHtml(q.prompt)+'</h2><div class="dossier-options">'+q.options.map((option,i)=>'<button type="button" class="dossier-option '+(feedback?(i===feedback.answer?'correct':i===feedback.choice?'incorrect':''):'')+'" '+(feedback?'disabled':'data-action="answerDailyDossier" data-args=\'['+q.index+','+i+']\'')+'><span class="dossier-option-letter">'+String.fromCharCode(65+i)+'</span><span>'+escapeHtml(option)+'</span>'+(feedback&&i===feedback.answer?'<span aria-label="Bonne réponse">✓</span>':feedback&&i===feedback.choice?'<span aria-label="Réponse incorrecte">×</span>':'')+'</button>').join('')+'</div>'+(feedback?'<div class="dossier-feedback '+(feedback.correct?'correct':'incorrect')+'" role="status"><strong>'+(feedback.correct?'Bien vu ! +1 point':'Tu peux continuer, même après une erreur.')+'</strong><p>'+escapeHtml(feedback.explanation)+'</p></div>'+(s.answered===10&&s.bonusUnlocked?'<div class="dossier-bonus"><strong>10/10 · Le dossier expert s’ouvre !</strong><p>Dix questions supplémentaires pour aller jusqu’à 20 points.</p></div>':'')+'<button class="btn-blue dossier-continue" data-action="nextDossierQuestion">'+(s.answered===10?'Ouvrir le dossier expert →':'Question suivante →')+'</button>':'');
    dossierMessage(dailyDossierBusy?'Vérification de ta réponse…':feedback?'Réponse enregistrée. Prends le temps de lire la correction.':'Choisis une réponse. Aucune limite de temps, aucune élimination.');
  }
  syncDossierControls();
}
function syncDossierControls() {
  document.querySelectorAll('#dossier-question .dossier-option').forEach(b=>b.disabled=dailyDossierBusy||dailyDossierFeedback||!dailyDossierState||dailyDossierState.finished);
  const abandon=document.getElementById('dossier-abandon');if(abandon)abandon.disabled=dailyDossierBusy||!dailyDossierState||dailyDossierState.finished;
  document.getElementById('dossier-question')?.setAttribute('aria-busy',String(dailyDossierBusy));
}
async function dossierRequest(action='',payload={}) {
  const serial=++dailyDossierSerial,accountId=dailyObservedAccountId();dailyDossierBusy=true;syncDossierControls();
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  try {
    const response=await fetch('/api/daily/dossier'+action,{credentials:'same-origin',signal:controller.signal,...(action?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({day:dailyDossierState?.day,accountId,...payload})}:{})});
    const data=await response.json();
    if(serial!==dailyDossierSerial||accountId!==dailyObservedAccountId()||document.getElementById('screen-dossier')?.classList.contains('hidden'))return false;
    if(!response.ok||!data.ok)throw Object.assign(new Error(data.error||'unavailable'),{code:data.error});
    if(data.accountId!==accountId)throw Object.assign(new Error('account_changed'),{code:'account_changed'});
    dailyDossierState=data;dailyDossierFeedback=Boolean(data.feedback&&!data.finished);renderDailyDossier();
    if(action){const target=document.getElementById(data.finished?'dossier-result':'dossier-prompt');target?.focus({preventScroll:true});target?.scrollIntoView({block:'nearest'});}
    return true;
  }catch(e) {
    if(serial!==dailyDossierSerial||accountId!==dailyObservedAccountId()||document.getElementById('screen-dossier')?.classList.contains('hidden'))return false;
    const messages={daily_required:'Termine d’abord l’Enquête du jour.',wordle_required:'Termine d’abord le Wordle du jour, même en révélant son nom.',stale_daily:'Le jour a changé à Paris. Ouvre le nouveau parcours.',account_changed:'Ton compte a changé. Recharge le dossier.',question_changed:'Cette question a déjà changé. Recharge pour retrouver ta progression.',rate_limited:'Trop de réponses rapprochées. Réessaie dans une minute.'};
    dossierMessage(messages[e.code]||'Le serveur est injoignable. Tes réponses validées sont conservées. Recharge le dossier pour vérifier la dernière réponse.');
    const retry=document.createElement('button');retry.className='btn-ghost';retry.dataset.action=e.code==='stale_daily'||e.code==='daily_required'?'startDailyGame':e.code==='wordle_required'?'startDailyWordle':'startDailyDossier';retry.textContent='Reprendre';document.getElementById('dossier-message').append(' ',retry);return false;
  }finally{clearTimeout(timer);if(serial===dailyDossierSerial){dailyDossierBusy=false;syncDossierControls();}}
}
async function startDailyDossier() {
  ensureDailyDossierScreen();closeOverlayModal();showScreen('screen-dossier');setGlobalNavActive('game');dailyDossierState=null;dailyDossierFeedback=false;
  for(const id of ['dossier-pokemon','dossier-progress','dossier-question','dossier-result'])document.getElementById(id).innerHTML='';
  document.getElementById('dossier-result').classList.add('hidden');document.getElementById('dossier-question').classList.remove('hidden');
  dossierMessage('Ouverture du carnet d’enquête…');await dossierRequest();
}
async function answerDailyDossier(index,choice) {
  if(dailyDossierBusy||dailyDossierFeedback||!dailyDossierState||dailyDossierState.finished)return;
  if(dailyDossierState.accountId!==dailyObservedAccountId()){dossierMessage('Ton compte a changé. Recharge le dossier.');return;}
  dossierMessage('Vérification de ta réponse…');await dossierRequest('/answer',{index,choice});
}
function nextDossierQuestion() {
  if(dailyDossierBusy||!dailyDossierState||dailyDossierState.finished)return;
  dailyDossierFeedback=false;renderDailyDossier();const prompt=document.getElementById('dossier-prompt');prompt?.focus({preventScroll:true});prompt?.scrollIntoView({block:'nearest'});
}
function confirmDossierAbandon() {
  if(dailyDossierBusy||!dailyDossierState||dailyDossierState.finished)return;
  ensureOverlay('Refermer le dossier ?', '<p>Cela termine le Dossier du jour avec 0 point. Tu pourras consulter les corrections de tes réponses et revenir demain.</p><div class="dossier-result-actions"><button class="btn-ghost" data-action="closeOverlayModal">Continuer le dossier</button><button class="btn-blue" data-action="abandonDailyDossier">Terminer avec 0 point</button></div>');
}
async function abandonDailyDossier(){closeOverlayModal();if(!dailyDossierBusy&&dailyDossierState&&!dailyDossierState.finished)await dossierRequest('/abandon');}
async function shareDailyDossier() {
  const s=dailyDossierState;if(!s?.finished)return;
  const text='Pokédle #'+s.number+' · Dossier du jour'+(s.status==='abandoned'?' · abandon':'')+' · '+s.points+'/'+s.total+' pts\n'+s.results.map(r=>r.correct?'🟩':'⬜').join('')+'\n'+(s.bonusUnlocked?'Dossier expert débloqué !\n':'')+'https://pokdle.onrender.com/';
  try{await navigator.clipboard.writeText(text);dossierMessage('Dossier copié, sans révéler le Pokémon ni les réponses !');}catch(_e){ensureOverlay('Partager mon dossier','<pre>'+escapeHtml(text)+'</pre>');}
}
const renderWordleBeforeDossier=renderDailyWordle;
renderDailyWordle=function() {
  const value=renderWordleBeforeDossier.apply(this,arguments),s=dailyWordleState;
  if(s) {
    document.getElementById('wordle-day').textContent='JOUR #'+s.number+' · ÉPREUVE 2/3';
    const journey=document.querySelector('#screen-wordle .wordle-journey');
    if(journey&&!document.getElementById('wordle-dossier-step')){const step=document.createElement('button');step.id='wordle-dossier-step';step.dataset.action='startDailyDossier';step.textContent='3 · Dossier';journey.appendChild(step);}
    const step=document.getElementById('wordle-dossier-step');if(step)step.disabled=!s.finished;
    if(s.finished) {
      const actions=document.querySelector('#wordle-result .wordle-result-actions'),next=document.createElement('button');next.className='btn-blue';next.id='wordle-dossier-next';next.dataset.action='startDailyDossier';next.textContent='Ouvrir son dossier →';actions.prepend(next);
      actions.querySelector('[data-action="shareDailyWordle"]')?.classList.replace('btn-blue','btn-ghost');wordleMessage('Wordle terminé. Retrouve le Pokémon de ton enquête dans le Dossier du jour.');
    }
  }
  return value;
};
function refreshDossierDay(){if(dailyDossierState&&dailyDossierState.day!==getDailyDateKey()&&!document.getElementById('screen-dossier')?.classList.contains('hidden'))startDailyDossier();}
setInterval(refreshDossierDay,30000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshDossierDay();});
const renderDailyHeroBeforeDossier=renderDailyHero;
renderDailyHero=function() {
  const value=renderDailyHeroBeforeDossier.apply(this,arguments),button=document.getElementById('daily-wordle-home'),day=getDailyDateKey();
  if(button) {
    const wordleDone=dailyWordleState?.day===day&&dailyWordleState.finished,dossierDone=dailyDossierState?.day===day&&dailyDossierState.finished;
    button.dataset.action=wordleDone?'startDailyDossier':'startDailyWordle';
    button.textContent=dossierDone?'Voir mon dossier · '+dailyDossierState.points+' pts':wordleDone?'Épreuve 3 : Dossier →':'Épreuve 2 : Wordle →';
    const subtitle=document.querySelector('#daily-hero .pk-hero-sub');
    if(getTodayDailyResult()&&subtitle)subtitle.textContent='Enquête, Wordle, Dossier : trois épreuves pour ton rendez-vous du jour.';
  }
  return value;
};
