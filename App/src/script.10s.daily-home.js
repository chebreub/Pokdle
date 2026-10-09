// Read-only journey status, scoped to the active account and Paris day.
let dailyHomeSnapshot=null,dailyHomePending=null,dailyHomeRevision=0;
function dailyHomeKey(){return String(dailyObservedAccountId()||'guest')+':'+getDailyDateKey();}
function dailyHomeNext(summary){return summary.stages.findIndex(stage=>!stage.finished);}
function applyDailyHomeSummary(summary){
  const hero=document.getElementById('daily-hero'),cta=document.getElementById('daily-hero-cta');
  if(!hero||!cta)return;
  const next=dailyHomeNext(summary),complete=next===-1;
  const actions=['startDailyGame','startDailyWordle','startDailyDossier','startDailyChallenge'];
  const names=['Enquête','Wordle','Dossier','Défi'];
  cta.dataset.action=complete?'showDailyJourneySummary':actions[next];
  cta.textContent=complete?'Voir mon bilan du jour →':'Épreuve '+(next+1)+' : '+names[next]+' →';
  const status=document.getElementById('daily-hero-status');
  if(status){status.classList.remove('hidden');status.textContent=complete?'Journée terminée · '+summary.points+' / '+(summary.maxPoints||100)+' pts':summary.stages.filter(s=>s.finished).length+' / 4 épreuves terminées';}
  const subtitle=hero.querySelector('.pk-hero-sub');
  if(subtitle)subtitle.textContent=complete?'Tes quatre épreuves sont terminées. Retrouve tes résultats et ton classement.':'Enquête, Wordle, Dossier, Défi : reprends ta journée à la prochaine épreuve.';
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
    const status=document.getElementById('daily-hero-status');
    if(status){status.classList.remove('hidden');status.textContent='Progression momentanément indisponible';}
  }finally{clearTimeout(timeout);if(dailyHomePending===request)dailyHomePending=null;}
}
const renderHeroBeforeServerJourney=renderDailyHero;
renderDailyHero=function(){
  const value=renderHeroBeforeServerJourney.apply(this,arguments);
  document.getElementById('daily-wordle-home')?.classList.add('hidden');
  // Never leave a previous account's or day's completion CTA while refreshing.
  const key=dailyHomeKey(),cta=document.getElementById('daily-hero-cta');
  if((dailyHomeSnapshot?.key!==key||dailyHomeSnapshot?.revision!==dailyHomeRevision)&&cta){cta.dataset.action='startDailyGame';cta.textContent='Ouvrir ma journée →';}
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
