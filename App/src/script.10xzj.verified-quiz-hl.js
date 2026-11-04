// Solo Quiz / Higher or Lower: the browser renders observed results; the server awards the economy.
let verifiedQuiz = null, verifiedQuizLoading = false, verifiedHLLoading = false;
function advancedArcadeError(data,rootId,resume) {
  if (typeof showToast === 'function') showToast(VERIFIED_ARCADE_ERRORS[data?.error] || (data?.error === 'round_wait'
    ? 'La prochaine question arrive. Réessaie dans un instant.' : 'Réponse non confirmée. Réessaie : elle ne sera comptée qu’une fois.'));
  if (['session_changed','round_changed','answer_conflict','session_expired','account_changed'].includes(data?.error)) {
    const root=document.getElementById(rootId);
    if(root){const b=document.createElement('button');b.type='button';b.className='btn-blue';b.textContent='Reprendre la partie';
      b.addEventListener('click',async()=>{await refreshBalls({announce:false});resume();});root.appendChild(b);}
  }
}
const startQuizUnverified=startQuizGame, renderQuizUnverified=renderQuizQuestion;
const submitQuizUnverified=submitQuizAnswer, nextQuizUnverified=nextQuizQuestion;
// Keep the clicked answer visibly selected while waiting for the authoritative server.
// Never guess whether it is correct: only the server may reveal that.
function verifiedQuizShowPending(choice) {
  const buttons=document.querySelectorAll('#quiz-options button');
  buttons.forEach(b=>{b.disabled=true;});
  if(Number.isInteger(choice)) {
    const selected=buttons[choice];
    if(selected){selected.classList.add('is-verifying');selected.setAttribute('aria-pressed','true');}
    const feedback=document.getElementById('quiz-feedback');
    if(feedback){feedback.textContent='Vérification de ta réponse…';feedback.setAttribute('role','status');}
  } else {
    const next=document.getElementById('quiz-next-btn');
    if(next){next.disabled=true;next.textContent='Chargement de la question…';}
  }
}
// Show the next question immediately on request, with disabled options until
// /api/arcade/next confirms the actual round. The preview never includes an answer
// or commits score, attempts or progression client-side.
function verifiedQuizShowNextPreview(s) {
  const preview=s?.phase==='reveal' ? s.nextQuestion : null;
  if(!preview||!Array.isArray(preview.options)||!preview.options.length||typeof preview.question!=='string')return false;
  const progress=document.getElementById('quiz-progress');
  const question=document.getElementById('quiz-question');
  const options=document.getElementById('quiz-options');
  const feedback=document.getElementById('quiz-feedback');
  if(!progress||!question||!options)return false;
  progress.textContent='Question '+(s.round+2)+' / '+s.total;
  question.textContent=preview.question;
  options.replaceChildren();
  for(const label of preview.options) {
    const button=document.createElement('button');
    button.type='button';button.className='btn-blue';button.disabled=true;
    button.textContent=label;
    options.appendChild(button);
  }
  if(feedback)feedback.textContent='Chargement de la question…';
  return true;
}
function renderVerifiedQuiz() {
  const state=verifiedQuiz,s=state.server;
  quizQuestions=Array.from({length:s.total},()=>({question:'',options:[]}));
  quizQuestions[s.round]={...s.question,...(s.reveal||{})};
  quizCurrentIndex=state.showResult?s.total:s.round;
  quizScore=s.score;
  quizHistory=s.history.slice();
  attempts=quizHistory.length;
  gameOver=Boolean(state.showResult);
  if(!state.showResult&&s.answer){quizScore-=s.answer.correct?1:0;quizHistory.pop();attempts--;}
  renderQuizUnverified();
  if(!state.showResult&&s.answer)submitQuizUnverified(s.answer.choice);
  setGameCounter(s.score,'Bonnes réponses');
  if(state.busy)document.querySelectorAll('#quiz-options button, #quiz-next-btn').forEach(b=>{b.disabled=true;});
  else document.getElementById('quiz-next-btn').disabled=false;
}
renderQuizQuestion=function(){
  if(verifiedQuiz&&gameMode==='quiz'&&!isPartySessionActive())return renderVerifiedQuiz();
  const out=renderQuizUnverified();
  if(gameMode==='quiz'&&!isPartySessionActive()){
    const feedback=document.getElementById('quiz-feedback');
    if(feedback&&!gameOver)feedback.textContent='Entraînement sans Pokédollars ni Balls';
  }
  return out;
};
startQuizGame=function(){
  if(verifiedQuizLoading)return;
  if(!verifiedArcadeOnline('quiz')||isPartySessionActive()){verifiedQuiz=null;return startQuizUnverified();}
  verifiedQuizLoading=true;
  const screen=document.body.dataset.screen,mode=gameMode;
  return verifiedArcadeRequest('start',{mode:'quiz',startId:crypto.randomUUID()}).then(data=>{
    if(document.body.dataset.screen!==screen||gameMode!==mode)return;
    if(!data?.ok){advancedArcadeError(data,'quiz-feedback',startQuizGame);return;}
    verifiedQuiz=null;startQuizUnverified();
    verifiedQuiz={server:data.arcade,busy:false,showResult:false};renderVerifiedQuiz();
  }).finally(()=>{verifiedQuizLoading=false;});
};
submitQuizAnswer=function(choice){
  const state=verifiedQuiz;
  if(!state||isPartySessionActive())return submitQuizUnverified(choice);
  if(verifiedQuizLoading||state.busy||state.server.phase!=='playing'||gameMode!=='quiz')return;
  state.busy=true;verifiedQuizShowPending(choice);
  const s=state.server;
  return verifiedArcadeRequest('answer',{mode:'quiz',sessionId:s.sessionId,round:s.round,choice}).then(data=>{
    state.busy=false;
    if(verifiedQuiz!==state||gameMode!=='quiz'||document.body.dataset.screen!=='screen-game')return;
    if(data?.ok)state.server=data.arcade;
    renderVerifiedQuiz();
    if(!data?.ok)advancedArcadeError(data,'quiz-feedback',startQuizGame);
  });
};
nextQuizQuestion=function(){
  const state=verifiedQuiz;
  if(!state||isPartySessionActive())return nextQuizUnverified();
  if(verifiedQuizLoading||state.busy||gameMode!=='quiz')return;
  if(state.showResult)return startQuizGame();
  if(state.server.phase==='over'){state.showResult=true;return renderVerifiedQuiz();}
  if(state.server.phase!=='reveal')return;
  state.busy=true;verifiedQuizShowPending(null);
  const s=state.server;
  verifiedQuizShowNextPreview(s);
  return verifiedArcadeRequest('next',{mode:'quiz',sessionId:s.sessionId,round:s.round}).then(data=>{
    state.busy=false;
    if(verifiedQuiz!==state||gameMode!=='quiz'||document.body.dataset.screen!=='screen-game')return;
    if(data?.ok)state.server=data.arcade;
    renderVerifiedQuiz();
    if(!data?.ok)advancedArcadeError(data,'quiz-feedback',startQuizGame);
  });
};

const startHLUnverified=startHigherLowerMode, answerHLUnverified=answerHigherLower;
const finalizeHLUnverified=finalizeHigherLowerRush, renderHLUnverified=renderHigherLowerScreen;
const restartHLUnverified=restartHigherLowerGame;
function isVerifiedHL(state=higherLowerState){return Boolean(state?.verified&&['infinite','rush60'].includes(state.mode)&&!higherLowerIsPartyRound());}
function verifiedHLVisible(state){return higherLowerState===state&&gameMode==='higher-lower'&&document.body.dataset.screen==='screen-higher-lower';}
function verifiedHLBody(state){const s=state.verified;return {mode:s.mode,sessionId:s.sessionId,round:s.round};}
// Monotonic local countdown: a delayed server response must never give a 60 s
// run extra visible time. The server's endsAt remains authoritative.
function verifiedHLClockReading(server, previous, now=performance.now()) {
  const remaining=server.endsAt?Math.max(0,server.endsAt-server.serverNow):60000;
  const candidate=now+remaining;
  const same=server.endsAt&&previous?.verified?.sessionId===server.sessionId;
  const endsMono=same&&Number.isFinite(previous.endsMono)
    ? Math.min(previous.endsMono,candidate) : candidate;
  return {endsMono,rushLeftMs:Math.max(0,endsMono-now)};
}
function startVerifiedHLClock(state){
  clearHigherLowerRushInterval();
  if(state.mode!=='rush60'||state.phase==='gameover')return;
  higherLowerRushIntervalId=setInterval(()=>{
    if(!verifiedHLVisible(state)||!isVerifiedHL(state)||state.phase==='gameover')return clearHigherLowerRushInterval();
    state.rushLeftMs=Math.max(0,state.endsMono-performance.now());
    const el=document.getElementById('higher-lower-timer');if(el)el.textContent=Math.ceil(state.rushLeftMs/1000)+'s';
    if(state.rushLeftMs<=0&&!state.busy){clearHigherLowerRushInterval();finalizeHigherLowerRush();}
  },100);
}
function applyVerifiedHL(data,previous){
  const s=data.arcade,q=s.question,same=previous?.verified?.sessionId===s.sessionId;
  const clockReading=verifiedHLClockReading(s,previous);
  const state={...createHigherLowerState(),...(same?previous:{}),verified:s,
    mode:s.mode==='higher-lower-rush'?'rush60':'infinite',phase:s.phase==='over'?'gameover':s.phase==='reveal'?'revealing':'playing',
    left:{pokemon:POKEMON_BY_ID.get(q.left),statValue:q.leftValue},right:{pokemon:POKEMON_BY_ID.get(q.right),statValue:s.reveal?.rightValue},
    score:s.score,statKey:q.statKey,lastChoice:s.answer?.choice,lastCorrect:s.answer?.correct,
    busy:false,isAnimating:s.phase==='reveal',recorded:same&&previous.recorded,
    rushLeftMs:clockReading.rushLeftMs,endsMono:clockReading.endsMono};
  higherLowerState=state;
  if(state.mode==='infinite'&&same&&s.score>previous.score){
    awardXp(3,'Higher or Lower','higherlower');progressQuest('hl_streak_10',s.score);
  }
  if(state.mode==='infinite'&&s.score>state.highScore){state.highScore=s.score;playerProfile.higherLowerHighScore=s.score;saveProfile();}
  if(state.phase==='gameover'&&!state.recorded){
    state.recorded=true;
    if(state.mode==='rush60'&&s.score>state.rushHighScore){state.rushHighScore=s.score;playerProfile.higherLower60sHighScore=s.score;saveProfile();}
    recordMatchHistory({mode:s.mode,result:s.score>=(state.mode==='rush60'?10:5)?'win':'loss',attempts:s.score,
      targetName:state.mode==='rush60'?`60s · ${s.score} pts`:`Score ${s.score}`});
  }
  renderHigherLowerScreen();startVerifiedHLClock(state);
  if(state.phase==='revealing')trackHigherLowerTimeout(()=>{
    if(verifiedHLVisible(state))advanceVerifiedHL(state);
  },Math.max(0,(s.nextAt||s.serverNow)-s.serverNow)+30);
}
function hlRequestFailed(state,data,retry){
  state.busy=false;state.isAnimating=state.phase==='revealing';renderHigherLowerScreen();
  advancedArcadeError(data,'higher-lower-root',()=>startHigherLowerMode(state.mode));
  if(!['session_changed','round_changed','answer_conflict','session_expired','account_changed'].includes(data?.error)){
    const root=document.getElementById('higher-lower-root'),b=document.createElement('button');
    b.type='button';b.className='btn-blue';b.textContent='Réessayer';b.addEventListener('click',retry);root.appendChild(b);
  }
}
function advanceVerifiedHL(state){
  if(!verifiedHLVisible(state)||state.busy||!isVerifiedHL(state)||state.phase!=='revealing')return;
  state.busy=true;
  return verifiedArcadeRequest('next',verifiedHLBody(state)).then(data=>{
    state.busy=false;if(!verifiedHLVisible(state))return;
    if(!data?.ok)return hlRequestFailed(state,data,()=>advanceVerifiedHL(state));
    applyVerifiedHL(data,state);
  });
}
startHigherLowerMode=function(mode){
  const key=mode==='rush60'?'higher-lower-rush':'higher-lower';
  if(verifiedHLLoading)return;
  if(!verifiedArcadeOnline(key)||higherLowerIsPartyRound()){
    if(higherLowerState)delete higherLowerState.verified;
    return startHLUnverified(mode);
  }
  verifiedHLLoading=true;clearHigherLowerTimeouts();clearHigherLowerRushInterval();
  const previous=higherLowerState;
  higherLowerState={...createHigherLowerState(mode),mode:mode==='rush60'?'rush60':'infinite'};
  const pending=higherLowerState;renderHigherLowerScreen();trackUsage('solo:higherlower');
  return verifiedArcadeRequest('start',{mode:key,startId:crypto.randomUUID()}).then(data=>{
    if(!verifiedHLVisible(pending))return;
    if(!data?.ok){
      higherLowerState=createHigherLowerState('lobby');renderHigherLowerScreen();
      advancedArcadeError(data,'higher-lower-root',()=>startHigherLowerMode(mode));return;
    }
    applyVerifiedHL(data,previous);
  }).finally(()=>{verifiedHLLoading=false;});
};
answerHigherLower=function(choice){
  const state=higherLowerState;
  if(!isVerifiedHL(state))return answerHLUnverified(choice);
  if(verifiedHLLoading||!verifiedHLVisible(state)||state.busy||state.phase!=='playing')return;
  state.busy=true;state.isAnimating=true;renderHigherLowerScreen();
  return verifiedArcadeRequest('answer',{...verifiedHLBody(state),choice}).then(data=>{
    state.busy=false;if(!verifiedHLVisible(state))return;
    if(!data?.ok)return hlRequestFailed(state,data,()=>answerHigherLower(choice));
    applyVerifiedHL(data,state);
    if(data.arcade.answer&&typeof gameFeelAnswer==='function')gameFeelAnswer(data.arcade.answer.correct,document.querySelector('#higher-lower-root .side-right'),data.arcade.answer.correct?'✓':'×');
  });
};
finalizeHigherLowerRush=function(){
  const state=higherLowerState;
  if(!isVerifiedHL(state))return finalizeHLUnverified();
  if(!verifiedHLVisible(state)||state.busy||state.phase==='gameover')return;
  state.busy=true;state.isAnimating=true;clearHigherLowerTimeouts();clearHigherLowerRushInterval();renderHigherLowerScreen();
  return verifiedArcadeRequest('finish',verifiedHLBody(state)).then(data=>{
    state.busy=false;if(!verifiedHLVisible(state))return;
    if(!data?.ok)return hlRequestFailed(state,data,finalizeHigherLowerRush);
    applyVerifiedHL(data,state);
  });
};
restartHigherLowerGame=function(){
  if(higherLowerState)delete higherLowerState.verified;
  return restartHLUnverified();
};
renderHigherLowerScreen=function(){
  const out=renderHLUnverified(),state=higherLowerState;
  if(state&&isVerifiedHL(state)&&state.busy&&state.phase==='playing') {
    const actions=document.querySelector('#higher-lower-root .higher-lower-actions');
    if(actions){
      const note=document.createElement('p');
      note.className='higher-lower-feedback';
      note.setAttribute('role','status');
      note.textContent='Vérification de ta réponse…';
      actions.after(note);
    }
  }
  if(state&&!isVerifiedHL(state)&&['infinite','rush60'].includes(state.mode)&&!higherLowerIsPartyRound()){
    const note=document.createElement('p');note.className='higher-lower-feedback';note.textContent='Entraînement sans Pokédollars ni Balls';document.getElementById('higher-lower-root')?.appendChild(note);
  }
  return out;
};
