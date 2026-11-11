'use strict';
// Higher or Lower Rush: overlap network time with the full visible reveal.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const script=fs.readFileSync(path.join(__dirname,'../src/script.10xzj.verified-quiz-hl.js'),'utf8');
function extract(start,end){
  const a=script.indexOf(start),b=script.indexOf(end,a);
  assert.ok(a>=0&&b>a,'function boundaries exist');
  return script.slice(a,b);
}
function nextDelay(mode,nextAt=1900,serverNow=1000){
  const fn=extract('function verifiedHLNextDelay(server, requestRttMs) {','\n// Monotonic local countdown');
  const ctx=vm.createContext({});
  vm.runInContext(fn,ctx);
  return rtt=>ctx.verifiedHLNextDelay({mode,nextAt,serverNow},rtt);
}

test('Rush and infinite anticipate /next; the server still enforces 60 s, 900 ms and 1 s',()=>{
  const rush=nextDelay('higher-lower-rush');
  assert.equal(rush(0),930);
  assert.equal(rush(100),830);
  assert.equal(rush(400),530);
  assert.equal(rush(10000),30,'round-trip compensation cannot exceed the reveal');
  const inf=nextDelay('higher-lower',2000,1000);
  assert.equal(inf(0),1030);
  assert.equal(inf(400),630,'infinite mode now overlaps the network time too (11/11)');
  assert.equal(inf(10000),30);
  const server=fs.readFileSync(path.join(__dirname,'../lib/quiz-higher-lower.js'),'utf8');
  assert.match(server,/s\.endsAt=\+clock\(\)\+60000/);
  assert.match(server,/s\.nextAt=\+clock\(\)\+\(s\.mode==='higher-lower-rush'\?900:1000\)/);
});

function runner(responses, clock=()=>1000){
  const tasks=[];
  const calls=[];
  const applied=[];
  const failures=[];
  const state={mode:'rush60',phase:'revealing',busy:false,revealReadyMono:1900,
    verified:{mode:'higher-lower-rush',sessionId:'the-session',round:7}};
  const ctx=vm.createContext({
    performance:{now:clock},
    trackHigherLowerTimeout:(cb,delay)=>{tasks.push({cb,delay});return tasks.length;},
    verifiedHLVisible:s=>s===state,
    isVerifiedHL:s=>s===state,
    verifiedHLBody:s=>({mode:s.verified.mode,sessionId:s.verified.sessionId,round:s.verified.round}),
    verifiedArcadeRequest:async (action,body)=>{
      calls.push({action,body});
      return responses.shift();
    },
    applyVerifiedHL:(data,prior)=>{applied.push({data,prior});},
    hlRequestFailed:(s,data)=>{failures.push(data);s.busy=false;}
  });
  vm.runInContext(extract('function advanceVerifiedHL(state){','\nstartHigherLowerMode=function(mode){'),ctx);
  return {state,ctx,tasks,calls,applied,failures};
}

test('the next round is verified early but not displayed before 900 ms of reveal',async()=>{
  const next={ok:true,arcade:{mode:'higher-lower-rush',round:8,phase:'playing'}};
  const t=runner([next]);
  await t.ctx.advanceVerifiedHL(t.state);
  assert.equal(t.calls.length,1);
  assert.equal(t.calls[0].action,'next');
  assert.equal(t.calls[0].body.round,7);
  assert.equal(t.applied.length,0,'the response must be buffered during the reveal');
  assert.equal(t.tasks.length,1);
  assert.equal(t.tasks[0].delay,900);
  assert.equal(t.state.busy,true,'no concurrent answer or timeout finalization while buffering');
  t.tasks.shift().cb();
  assert.equal(t.applied.length,1);
  assert.equal(t.applied[0].data,next);
  assert.equal(t.failures.length,0);
});

test('early round_wait is retried automatically and never double-advances',async()=>{
  const ready={ok:true,arcade:{mode:'higher-lower-rush',round:8,phase:'playing'}};
  const t=runner([{ok:false,error:'round_wait'},ready],()=>1900);
  await t.ctx.advanceVerifiedHL(t.state);
  assert.equal(t.failures.length,0);
  assert.equal(t.calls.length,1);
  assert.equal(t.tasks.length,1);
  assert.equal(t.tasks[0].delay,100);
  assert.equal(t.state.busy,false);
  const repeat=t.tasks.shift();
  await repeat.cb();
  // The timer callback starts the request; give the async response a microtask turn.
  await Promise.resolve();
  assert.equal(t.calls.length,2);
  assert.equal(t.applied.length,1);
  assert.equal(t.applied[0].data,ready);
  assert.equal(t.failures.length,0);
  assert.equal(t.calls[0].body.sessionId,t.calls[1].body.sessionId);
  assert.equal(t.calls[0].body.round,t.calls[1].body.round);
});

test('more than two premature replies surface the normal recovery UI',async()=>{
  const t=runner(Array.from({length:3},()=>({ok:false,error:'round_wait'})),()=>1900);
  await t.ctx.advanceVerifiedHL(t.state);
  for(let i=0;i<2;i++){
    const task=t.tasks.shift();
    assert.equal(task.delay,100*(i+1));
    await task.cb();
    await Promise.resolve();
  }
  assert.equal(t.calls.length,3);
  assert.equal(t.failures.length,1);
  assert.equal(t.failures[0].error,'round_wait');
  assert.equal(t.tasks.length,0);
  assert.equal(t.state.busy,false);
});

test('an error unrelated to timing is never silently retried',async()=>{
  const t=runner([{ok:false,error:'account_changed'}]);
  await t.ctx.advanceVerifiedHL(t.state);
  assert.equal(t.calls.length,1);
  assert.equal(t.tasks.length,0);
  assert.equal(t.failures.length,1);
  assert.equal(t.failures[0].error,'account_changed');
});

test('the answer RTT is measured and the visible deadline is set separately from server readiness',()=>{
  assert.match(script,/const requestStarted=performance\.now\(\)/);
  assert.match(script,/applyVerifiedHL\(data,state,performance\.now\(\)-requestStarted\)/);
  assert.match(script,/revealReadyMono=s\.phase==='reveal' \? performance\.now\(\)\+\(s\.mode==='higher-lower-rush'\?900:1000\) : 0/);
  assert.match(script,/verifiedHLNextDelay\(s,state\.networkRttMs\)/);
  assert.match(script,/const revealLeft=Math\.max\(0,\(state\.revealReadyMono\|\|0\)-performance\.now\(\)\)/);
});
