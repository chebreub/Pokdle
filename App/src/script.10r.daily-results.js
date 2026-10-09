// Presentation only: keep the existing score, persistence and navigation controllers.
function dailyResultDetails(parent, label, nodes) {
  const items=nodes.filter(Boolean);
  if(!items.length)return null;
  const details=document.createElement('details');details.className='daily-result-details';
  const summary=document.createElement('summary');summary.textContent=label;details.append(summary);
  items.forEach(node=>details.append(node));parent.append(details);return details;
}
function compactDailyStage(screenId, resultId, finished) {
  const screen=document.getElementById(screenId),result=document.getElementById(resultId);
  if(!screen||!result)return;
  screen.classList.toggle('daily-result-complete',Boolean(finished));
  if(!finished)return;
  result.classList.add('daily-result-card');
  const actions=result.querySelector('.wordle-result-actions,.dossier-result-actions,.challenge-actions');
  if(actions){
    actions.classList.add('daily-result-actions');
    const primary=actions.querySelector('.btn-blue');
    if(primary)primary.classList.add('daily-result-next');
    for(const button of actions.querySelectorAll('button:not(.btn-blue)')){
      if(button.dataset.action.startsWith('share'))button.textContent='Partager';
      if(button.dataset.action==='openLeaderboardV2')button.textContent='Classement';
      if(button.dataset.action==='goToConfig')button.textContent='Accueil';
    }
  }
  const paragraphs=[...result.children].filter(n=>n.tagName==='P'&&!/kicker/.test(n.className));
  dailyResultDetails(result,'Détails du résultat',paragraphs);
}
const renderWordleBeforeCompactResults=renderDailyWordle;
renderDailyWordle=function(){
  const value=renderWordleBeforeCompactResults.apply(this,arguments),s=dailyWordleState;
  compactDailyStage('screen-wordle','wordle-result',s?.finished);
  const grid=document.getElementById('wordle-board'),result=document.getElementById('wordle-result');
  let review=document.getElementById('daily-wordle-grid-review');
  if(grid&&result){
    if(s?.finished){
      if(!review){review=dailyResultDetails(result.parentElement,'Revoir ma grille',[grid]);review.id='daily-wordle-grid-review';}
      result.after(review);
    }else if(review){review.before(grid);review.remove();}
  }
  const next=document.getElementById('wordle-dossier-next');if(next)next.textContent='Épreuve suivante : Dossier →';
  return value;
};
const renderDossierBeforeCompactResults=renderDailyDossier;
renderDailyDossier=function(){
  const value=renderDossierBeforeCompactResults.apply(this,arguments),s=dailyDossierState;
  compactDailyStage('screen-dossier','dossier-result',s?.finished);
  if(s?.finished){
    const result=document.getElementById('dossier-result'),sprite=document.querySelector('#dossier-pokemon img');
    if(sprite){const small=sprite.cloneNode();small.className='daily-result-sprite';result.prepend(small);}
    const next=result.querySelector('[data-action="startDailyChallenge"]');if(next)next.textContent='Épreuve suivante : Défi →';
  }
  return value;
};
const renderChallengeBeforeCompactResults=renderDailyChallenge;
renderDailyChallenge=function(){
  const value=renderChallengeBeforeCompactResults.apply(this,arguments);
  compactDailyStage('screen-challenge','challenge-result',dailyChallengeState?.finished);
  return value;
};
const renderEnquiryBeforeCompactResults=renderGameOverBox;
renderGameOverBox=function(){
  const box=document.getElementById('win-box');
  // Restore before rendering: original controllers and other modes retain their DOM.
  const old=document.getElementById('daily-enquiry-result-details');
  if(old){[...old.children].filter(n=>n.tagName!=='SUMMARY').forEach(n=>old.before(n));old.remove();}
  const value=renderEnquiryBeforeCompactResults.apply(this,arguments);
  box.classList.toggle('daily-result-card',gameMode==='daily');
  const actions=box.querySelector('.win-btns');actions?.classList.toggle('daily-result-actions',gameMode==='daily');
  if(gameMode==='daily'){
    const details=dailyResultDetails(box,'Statistiques et autres options',[
      document.getElementById('win-gamefeel-summary'),document.getElementById('win-daily-distribution'),
      document.getElementById('win-next-daily')
    ]);
    if(details)details.id='daily-enquiry-result-details';
    document.getElementById('daily-wordle-next')?.classList.add('daily-result-next');
  }
  return value;
};
