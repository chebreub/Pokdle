'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');

function fixture({bag={poke:2,great:1,ultra:0},actionScope='scope-verified'}={}){
 const script=fs.readFileSync(path.join(__dirname,'../src/script.10xzb.expedition.js'),'utf8');
 const start=script.indexOf('let expeditionPendingEncounter = null;');
 const end=script.indexOf('function expeditionFetch(url, body)',start);
 assert.ok(start>=0&&end>start,'ECO-07 preflight functions must exist');
 let lastHtml='',posts=[],cancelled=0;
 let modalHidden=false, visible=true;
 const state={bag,actionScope};
 const prestige={available:true,chances:{poke:23,great:32,ultra:46}};
 const expedition={legend:{available:true},legendChances:{poke:3,great:5,ultra:7}};
 const ctx={
  document:{
   getElementById(id){if(id==='overlay-modal')return {classList:{contains:()=>modalHidden}};
     if(id==='prestige-drattak-answer')return {value:'Drackhaus'};return null;},
   querySelector(selector){return selector==='#overlay-body .exp-preflight'&&visible?{}:null;}
  },window:{},ballState:state,drattakPrestigeAt:42,expeditionAt:42,
  ballImg:(k)=>'<i>'+k+'</i>',escapeHtml:String,
  ensureOverlay:(_title,html)=>{lastHtml=html;visible=true;},
  refreshBalls:async()=>state,
  loadDrattakPrestige:async()=>prestige,
  loadExpedition:async()=>expedition,
  openExpedition:()=>{cancelled++;visible=false;},
  expeditionFetch:async(url,body)=>{posts.push({url,body});return {ok:true,encounter:{pokemonId:373},wild:{}};},
  expeditionPerformLegend:()=>ctx.expeditionFetch('/api/expedition/legend',{}),
  closeOverlayModal:()=>{visible=false;},ballApply:()=>{},renderWildEncounter:()=>{}
 };
 vm.createContext(ctx);
 vm.runInContext(script.slice(start,end),ctx);
 return {ctx,state,prestige,expedition,posts,html:()=>lastHtml,cancelled:()=>cancelled,
  hideModal:()=>{modalHidden=true},showModal:()=>{modalHidden=false}};
}

test('ECO-07: prestige preflight clearly shows current Balls, chances and cancel, without free Balls',()=>{
 const f=fixture();
 const html=f.ctx.expeditionPreflightHtml('prestige',f.state.bag,f.prestige.chances);
 assert.match(html,/Se préparer à Drattak/);
 assert.match(html,/Poké Ball : <b>2<\/b> disponible\(s\) · <b>23 %<\/b>/);
 assert.match(html,/Super Ball : <b>1<\/b> disponible\(s\) · <b>32 %<\/b>/);
 assert.match(html,/data-action="expeditionConfirmEncounter"/);
 assert.match(html,/data-action="expeditionCancelEncounter"/);
 assert.match(html,/aucune capture garantie/);
});
test('ECO-07: existing server conditions preserved (3 Balls Drattak, 1 weekly legend)',()=>{
 const f=fixture({bag:{poke:2,great:0,ultra:0}});
 const drattak=f.ctx.expeditionPreflightHtml('prestige',f.state.bag,f.prestige.chances);
 assert.match(drattak,/Drattak exige au moins 3 Balls/);
 assert.doesNotMatch(drattak,/data-action="expeditionConfirmEncounter"/);
 const legend=f.ctx.expeditionPreflightHtml('legend',f.state.bag,f.expedition.legendChances);
 assert.match(legend,/tu ne pourras pas effectuer les 3 lancers/);
 assert.match(legend,/data-action="expeditionConfirmEncounter"/);
});
test('ECO-07: cancel and prepare never POST a rare encounter',async()=>{
 const f=fixture();
 await f.ctx.expeditionPrepareEncounter('prestige','Drackhaus');
 assert.match(f.html(),/Se préparer à Drattak/);
 assert.equal(f.posts.length,0);
 f.ctx.expeditionCancelEncounter();
 assert.equal(f.posts.length,0);
 assert.equal(f.cancelled(),1);
});
test('ECO-07: confirmation POST happens exactly once after explicit action',async()=>{
 const f=fixture();
 await f.ctx.expeditionPrepareEncounter('prestige','Drackhaus');
 const first=f.ctx.expeditionConfirmEncounter();
 const concurrent=f.ctx.expeditionConfirmEncounter();
 assert.equal(concurrent,undefined,'busy action ignores second tap');
 await first;
 assert.equal(f.posts.length,1);
 assert.equal(f.posts[0].url,'/api/prestige/drattak/meet');
 assert.equal(f.posts[0].body.answer,'Drackhaus');
 assert.equal(f.posts[0].body.actionScope,'scope-verified');
});
test('ECO-07: weekly expedition remains at one POST only after confirmation',async()=>{
 const f=fixture({bag:{poke:1,great:0,ultra:0}});
 await f.ctx.expeditionPrepareEncounter('legend');
 assert.equal(f.posts.length,0);
 await f.ctx.expeditionConfirmEncounter();
 assert.deepEqual(f.posts.map(p=>p.url),['/api/expedition/legend']);
});
test('ECO-07: closing overlay while preflight loads never reopens it',async()=>{
 const f=fixture();let resolve;
 f.ctx.refreshBalls=()=>new Promise(r=>{resolve=r});
 const request=f.ctx.expeditionPrepareEncounter('prestige','Drackhaus');
 f.hideModal();resolve(f.state);
 await request;
 assert.equal(f.html(),'');
 assert.equal(f.posts.length,0);
});
