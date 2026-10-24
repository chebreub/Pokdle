// Read-only journey status, scoped to the active account and Paris day.
let dailyHomeSnapshot=null,dailyHomePending=null,dailyHomeRevision=0;
function dailyHomeKey(){return String(dailyObservedAccountId()||'guest')+':'+getDailyDateKey();}
function dailyHomeNext(summary){return summary.stages.findIndex(stage=>!stage.finished);}
const DAILY_STAGE_ACTIONS=['startDailyGame','startDailyWordle','startDailyDossier','startDailyChallenge'];
// The first stage is the Enquête, named after its game so a new visitor knows what it is.
const DAILY_STAGE_NAMES=['Pokémon du jour','Wordle','Dossier','Défi'];
// Four steps under the hero: points of finished stages, the one to play, the locked ones.
function renderDailyHomeSteps(summary,next){
  const chips=document.querySelector('#daily-hero .pk-hero-chips');if(!chips)return;
  let steps=document.getElementById('daily-hero-steps');
  if(!steps){steps=document.createElement('ol');steps.id='daily-hero-steps';steps.className='daily-hero-steps';steps.setAttribute('aria-label','Les quatre épreuves du jour');(document.getElementById('daily-hero-note')||chips).after(steps);}
  steps.innerHTML=summary.stages.map((stage,i)=>{
    const state=stage.finished?'is-done':i===next?'is-next':'is-locked';
    const value=stage.finished?stage.points+' / '+stage.max:i===next?'À jouer':'Après '+DAILY_STAGE_NAMES[i-1];
    return '<li class="'+state+'"><button type="button" data-action="'+DAILY_STAGE_ACTIONS[i]+'"'+(state==='is-locked'?' disabled':'')+'><span>'+(i+1)+' · '+DAILY_STAGE_NAMES[i]+'</span><b>'+value+'</b></button></li>';
  }).join('');
}
// The Enquête result points to the first unfinished stage, even when reopened later in the day.
function syncDailyResultNext(summary){
  const next=document.getElementById('daily-wordle-next');
  if(!next||gameMode!=='daily'||!summary)return;
  const index=dailyHomeNext(summary),stage=index===-1?-1:Math.max(1,index);
  next.dataset.action=stage===-1?'showDailyJourneySummary':DAILY_STAGE_ACTIONS[stage];
  next.textContent=stage===-1?'Voir mon bilan du jour →':'Épreuve suivante : '+DAILY_STAGE_NAMES[stage]+' →';
}
// The hero's second button: today's ranking while playing, the day's summary once it is over.
function setDailyHeroGhost(complete){
  const ghost=document.getElementById('daily-hero-ghost');if(!ghost)return;
  ghost.dataset.action=complete?'showDailyJourneySummary':'openLeaderboardV2';
  if(complete)delete ghost.dataset.args;else ghost.dataset.args='["journey","today"]';
  ghost.textContent=complete?'Voir mon bilan du jour →':'Classement du jour →';
}
function applyDailyHomeSummary(summary){
  syncDailyResultNext(summary);
  const hero=document.getElementById('daily-hero'),cta=document.getElementById('daily-hero-cta');
  if(!hero||!cta)return;
  const next=dailyHomeNext(summary),complete=next===-1;
  const actions=DAILY_STAGE_ACTIONS,names=DAILY_STAGE_NAMES;
  renderDailyHomeSteps(summary,next);
  const done=summary.stages.filter(s=>s.finished).length;
  // A finished day keeps people playing: the catalogue first, the summary as the second button.
  cta.dataset.action=complete?'openAllModesScreen':actions[next];
  if(complete)cta.dataset.args='["solo"]';else delete cta.dataset.args;
  cta.textContent=complete?'Choisir un autre jeu →':next===0?'▶ Jouer au Pokémon du jour':'Épreuve '+(next+1)+' : '+names[next]+' →';
  setDailyHeroGhost(complete);
  // Nothing played yet: no « 0 / 4 · 0 pts » scoreboard, the presentation speaks first.
  const status=document.getElementById('daily-hero-status');
  if(status&&done){status.classList.remove('hidden');status.textContent=complete?'Journée terminée · '+summary.points+' / '+(summary.maxPoints||100)+' pts':done+' / 4 épreuves · '+summary.points+' pts';}
  setDailyHeroNote(complete?'Tes quatre épreuves sont terminées. Le prochain Pokémon arrive à minuit : en attendant, choisis un autre jeu.':done?'Reprends ta journée à la prochaine épreuve.':'Ton parcours du jour : 4 épreuves, une après l’autre.');
  hero.dataset.dailyState=complete?'complete':'available';
  // The deduction notebook is useful during Enquête, not after moving on.
  document.getElementById('daily-notebook')?.classList.toggle('hidden',next!==0);
  document.getElementById('daily-wordle-home')?.classList.add('hidden');
}
async function refreshDailyHomeSummary(){
  const key=dailyHomeKey(),revision=dailyHomeRevision;
  if(dailyHomeSnapshot?.key===key&&dailyHomeSnapshot.revision===revision&&Date.now()-dailyHomeSnapshot.at<30000){applyDailyHomeSummary(dailyHomeSnapshot.data);return;}
  if(dailyHomePending?.key===key&&dailyHomePending.revision===revision)return;
  const request={key,revision};dailyHomePending=request;
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);
  try{
    const response=await fetch('/api/daily/challenge/summary',{credentials:'same-origin',cache:'no-store',signal:controller.signal});
    const data=await response.json();
    if(!response.ok||!data.ok||data.day!==getDailyDateKey()||data.stages?.length!==4)throw Error('unavailable');
    if(key!==dailyHomeKey()||revision!==dailyHomeRevision)return;
    dailyHomeSnapshot={key,revision,at:Date.now(),data};applyDailyHomeSummary(data);
  }catch(_e){
    if(key!==dailyHomeKey()||revision!==dailyHomeRevision)return;
    // Only someone who has played today misses their progress; a new visitor keeps a clean hero.
    const status=document.getElementById('daily-hero-status');
    if(status&&getTodayDailyResult()){status.classList.remove('hidden');status.textContent='Progression momentanément indisponible';}
  }finally{clearTimeout(timeout);if(dailyHomePending===request)dailyHomePending=null;}
}
const renderHeroBeforeServerJourney=renderDailyHero;
renderDailyHero=function(){
  const value=renderHeroBeforeServerJourney.apply(this,arguments);
  document.getElementById('daily-wordle-home')?.classList.add('hidden');
  // Never leave a previous account's or day's completion CTA while refreshing.
  const key=dailyHomeKey(),cta=document.getElementById('daily-hero-cta');
  if((dailyHomeSnapshot?.key!==key||dailyHomeSnapshot?.revision!==dailyHomeRevision)&&cta){cta.dataset.action='startDailyGame';delete cta.dataset.args;cta.textContent='▶ Jouer au Pokémon du jour';setDailyHeroGhost(false);}
  if(!document.getElementById('screen-config')?.classList.contains('hidden'))refreshDailyHomeSummary();return value;
};
function invalidateDailyHomeSummary(){dailyHomeRevision++;}
const applyDailyBeforeHomeStatus=applyDailyObservedState;
applyDailyObservedState=function(){invalidateDailyHomeSummary();return applyDailyBeforeHomeStatus.apply(this,arguments);};
for(const name of ['renderDailyWordle','renderDailyDossier','renderDailyChallenge']){
  const previous=window[name];
  window[name]=function(){invalidateDailyHomeSummary();return previous.apply(this,arguments);};
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden){invalidateDailyHomeSummary();renderDailyHero();}});
const goHomeBeforeServerJourney=goToConfig;
goToConfig=function(){const value=goHomeBeforeServerJourney.apply(this,arguments);refreshDailyHomeSummary();return value;};
const renderGameOverBeforeJourneyNext=renderGameOverBox;
renderGameOverBox=function(){
  const value=renderGameOverBeforeJourneyNext.apply(this,arguments);
  if(gameMode==='daily'){if(dailyHomeSnapshot?.key===dailyHomeKey())syncDailyResultNext(dailyHomeSnapshot.data);refreshDailyHomeSummary();}
  return value;
};
