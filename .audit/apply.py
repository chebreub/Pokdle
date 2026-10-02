"""Temporary, idempotent migration of audited source on the work branch only.
Removed before merge. Does not access production data or credentials.
"""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
def patch(path,old,new):
 p=ROOT/path;s=p.read_text(encoding='utf-8-sig')
 if old==new:return
 if old not in s:
  if new in s:return
  raise RuntimeError('Missing source anchor: '+path+' '+old[:100])
 if s.count(old)!=1:raise RuntimeError('Ambiguous source anchor: '+path+' '+old[:100])
 p.write_text(s.replace(old,new,1),encoding='utf-8')
def section(path,start,end,new):
 p=ROOT/path;s=p.read_text(encoding='utf-8-sig');i=s.index(start);j=s.index(end,i)
 p.write_text(s[:i]+new+'\n'+s[j:],encoding='utf-8')
def write(path,content):
 p=ROOT/path;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(content,encoding='utf-8')
LB='App/src/script.10g.leaderboard-v2.js'
section(LB,'function submitLeaderboardResult(mode, score)', 'function leaderboardResultFromHistory(entry)',r'''// R1: validate both HTTP and application responses; a failed request is not an empty board.
async function leaderboardFetchJson(url, options = {}) {
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 10000) : null;
  try {
    const response = await fetch(url, { credentials:"same-origin", ...options, ...(controller ? { signal:controller.signal } : {}) });
    const data = await response.json();
    if (response.ok === false || !data || data.ok !== true) {
      const error = new Error("Classement indisponible");
      error.status = response.status || 0;
      throw error;
    }
    return data;
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}
function leaderboardAccountId() {
  return typeof connectedAccountUser !== "undefined" && connectedAccountUser?.id
    ? String(connectedAccountUser.id) : "";
}
function leaderboardResultId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID() : Date.now().toString(36)+"-"+Math.random().toString(36).slice(2);
}
function submitLeaderboardResult(mode, score, options = {}) {
  if (!window.__pokedleAuthed) return Promise.resolve(false);
  const n = Number(score);
  if (!mode || !Number.isInteger(n) || n <= 0) return Promise.resolve(false);
  const body = { mode, score:n, resultId:options.resultId || leaderboardResultId() };
  if (mode === "daily") body.dailyKey = options.dailyKey || leaderboardTodayKey();
  return leaderboardFetchJson("/api/leaderboard/result", {
    method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)
  }).then(() => true).catch(() => false);
}
const DAILY_LEADERBOARD_SYNC_PREFIX="pokedle_lb_daily_sync_";
const dailyLeaderboardInFlight = new Map();
function leaderboardTodayKey() {
  try { if (typeof getUTCDateKey === "function") return getUTCDateKey(); } catch (_e) {}
  const d = new Date();
  return d.getUTCFullYear()+"-"+String(d.getUTCMonth()+1).padStart(2,"0")+"-"+String(d.getUTCDate()).padStart(2,"0");
}
function pendingDailyLeaderboardScore() {
  const entries = typeof matchHistory !== "undefined" && Array.isArray(matchHistory) ? matchHistory : [];
  const now = Date.now(), d = new Date(now);
  const start = Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate());
  let best = 0;
  for (const entry of entries) {
    const at = Number(entry?.at), score = Number(entry?.attempts);
    if (entry?.mode !== "daily" || entry?.result !== "win" || !Number.isFinite(at) || at < start || at > now) continue;
    if (!Number.isInteger(score) || score < 1 || score > 100) continue;
    if (!best || score < best) best = score;
  }
  return best;
}
function syncPendingDailyLeaderboard() {
  const account = leaderboardAccountId(), day = leaderboardTodayKey();
  if (!window.__pokedleAuthed || !account) return Promise.resolve(false);
  const score = pendingDailyLeaderboardScore();
  if (!score) return Promise.resolve(false);
  // Old date-only markers are deliberately ignored: they belong to no known account.
  const key = DAILY_LEADERBOARD_SYNC_PREFIX+encodeURIComponent(account)+":"+day;
  try { if (Number(localStorage.getItem(key)) > 0) return Promise.resolve(true); } catch (_e) {}
  if (dailyLeaderboardInFlight.has(key)) return dailyLeaderboardInFlight.get(key);
  const request = submitLeaderboardResult("daily",score,{dailyKey:day,resultId:"daily:"+day}).then(ok => {
    if (ok && leaderboardAccountId() === account && leaderboardTodayKey() === day) {
      try { localStorage.setItem(key,String(score)); } catch (_e) {}
    }
    return ok;
  }).finally(() => dailyLeaderboardInFlight.delete(key));
  dailyLeaderboardInFlight.set(key,request);
  return request;
}
let leaderboardViewRequest = 0;
function leaderboardOwnsDialog(id) {
  const overlay = document.getElementById("overlay-modal");
  return id === leaderboardViewRequest && Boolean(overlay && !overlay.classList.contains("hidden") &&
    document.querySelector('#overlay-body [data-lb-request="'+id+'"]'));
}
function leaderboardUnrankedCopy(authenticated, pending) {
  if (!authenticated) return "Connecte-toi pour enregistrer ta position.";
  return pending ? "Ton résultat n’est pas encore enregistré. Réessaie la synchronisation."
    : "Aucune victoire enregistrée aujourd’hui pour ce compte.";
}
''')
patch(LB,'return typeof mode === "string" && mode.indexOf("draft") === 0;', 'return typeof mode === "string" && /^draft(?:_(?:all|[1-9]))?$/.test(mode);')
patch(LB,'  const meta=leaderboardV2ModeMeta(current);\n\n  const loading=', '  const meta=leaderboardV2ModeMeta(current);\n  const requestedScope=leaderboardV2Scope;\n  const requestId=++leaderboardViewRequest;\n\n  const loading=')
patch(LB, "const loading='<div class=\"lbv3-shell\"><div class=\"lbv3-loading\">", "const loading='<div class=\"lbv3-shell\" data-lb-request=\"'+requestId+'\"><div class=\"lbv3-loading\">")
patch(LB,'''  syncPromise.then(()=>{
    return fetch("/api/leaderboard?mode="+encodeURIComponent(current)+"&scope="+encodeURIComponent(leaderboardV2Scope),{credentials:"same-origin"});
  }).then(r=>r.json()).then(data=>{''','''  return syncPromise.then(()=>{
    if (!leaderboardOwnsDialog(requestId)) return null;
    return leaderboardFetchJson("/api/leaderboard?mode="+encodeURIComponent(current)+"&scope="+encodeURIComponent(requestedScope));
  }).then(data=>{
    if (!data || !leaderboardOwnsDialog(requestId)) return;''')
patch(LB,"        (leaderboardV2Scope===\"all\"\n          ? (window.__pokedleAuthed?'Ton record sera synchronisé dès qu’il existe pour ce mode.':'Connecte-toi pour enregistrer tes records.')\n          : 'Cette période démarre avec les performances jouées depuis la mise en place des nouveaux classements.')+", "        (requestedScope===\"all\"\n          ? (window.__pokedleAuthed?'Aucun record enregistré pour ce mode.':'Connecte-toi pour enregistrer tes records.')\n          : 'Aucune performance enregistrée sur cette période. Les records locaux antérieurs ne sont pas antidatés.')+")
patch(LB,'''  }).catch(()=>{
    ensureOverlay("Classements",'<div class="lbv3-shell"><section class="lbv3-empty"><div class="lbv3-empty-icon">!</div><h4>Classement indisponible</h4><p>Réessaie dans quelques instants.</p></section></div>');
  });''','''  }).catch(()=>{
    if (!leaderboardOwnsDialog(requestId)) return;
    const args=escapeHtml(JSON.stringify([current,requestedScope]));
    ensureOverlay("Classements",'<div class="lbv3-shell"><section class="lbv3-empty" role="status"><div class="lbv3-empty-icon">!</div><h4>Classement indisponible</h4><p>Le serveur n’a pas confirmé le classement. Aucun résultat n’est effacé.</p><button type="button" class="btn-blue" data-action="openLeaderboardV2" data-args="'+args+'">Réessayer</button></section></div>');
  });''')
section(LB,'function renderWinLeaderboardPreview(mode)', '\nif (typeof recordMatchHistory === "function")',r'''let leaderboardPreviewRequest = 0;
function renderWinLeaderboardPreview(mode) {
  const requestId = ++leaderboardPreviewRequest;
  const box=document.getElementById("win-box");
  if (!box || !["daily","normal"].includes(mode)) return Promise.resolve();
  let panel=document.getElementById("win-ranking-preview");
  if (!panel) {
    panel=document.createElement("section"); panel.id="win-ranking-preview"; panel.className="win-ranking-preview";
    const buttons=box.querySelector(".win-btns");
    if (buttons) box.insertBefore(panel,buttons); else box.appendChild(panel);
  }
  const link='<button type="button" class="btn-ghost" data-action="openLeaderboardV2" data-args="[&quot;daily&quot;,&quot;today&quot;]">Voir le classement →</button>';
  if (mode !== "daily") {
    panel.innerHTML='<div><span>CLASSEMENTS</span><b>Compare tes records sur les modes compétitifs.</b></div>'+link;
    return Promise.resolve();
  }
  const account=leaderboardAccountId();
  const current=()=>requestId===leaderboardPreviewRequest && document.getElementById("win-ranking-preview")===panel &&
    account===leaderboardAccountId() && (typeof gameMode === "undefined" || gameMode === mode);
  panel.innerHTML='<div class="win-rank-loading" role="status">Chargement de ta position du jour…</div>';
  return syncPendingDailyLeaderboard().then(()=>leaderboardFetchJson("/api/leaderboard?mode=daily&scope=today")).then(data=>{
    if (!current()) return;
    if (data.me) {
      panel.innerHTML='<div class="win-rank-position"><span>CLASSEMENT DU JOUR</span><strong>#'+Number(data.me.rank)+'</strong><small>'+escapeHtml(leaderboardV2FormatScore(data.me.score,"daily","essais"))+' · '+(Number(data.total)||0)+' classés</small></div>'+link;
    } else {
      const authenticated = typeof data.authenticated === "boolean" ? data.authenticated : Boolean(window.__pokedleAuthed);
      panel.innerHTML='<div><span>CLASSEMENT DU JOUR</span><b>'+leaderboardUnrankedCopy(authenticated,pendingDailyLeaderboardScore()>0)+'</b></div>'+link;
    }
  }).catch(()=>{
    if (current()) panel.innerHTML='<div role="status"><span>CLASSEMENT DU JOUR</span><b>Classement indisponible. Ta partie reste sauvegardée sur cet appareil.</b></div>'+link;
  });
}
''')
patch(LB,'      submitLeaderboardResult(performance.mode,performance.score).then(()=>{','      const submission=entry.mode==="daily" ? syncPendingDailyLeaderboard() : submitLeaderboardResult(performance.mode,performance.score);\n      submission.then(()=>{')
# A matching return is present on every mobile detail, including locked entries.
DEX='App/src/script.10d.pokedex-collection.js'
patch(DEX,'''  detail.innerHTML=`
    <div class="pokedex-collection-lock state-${state.kind}">''','''  // Invalidate a pending encyclopedia fetch before rendering a locked entry.
  if (typeof pokedexDetailRequestId !== 'undefined') pokedexDetailRequestId += 1;
  detail.innerHTML=`
    <button type="button" class="btn-ghost pokedex-back-to-list" data-action="closePokedexMobileDetail">← Tous les Pokémon</button>
    <div class="pokedex-collection-lock state-${state.kind}">''')
# Actual waveform dimensions; no unsupported CSS modulo operator.
patch('App/src/script.08.catalog.js', ''''<i style="--bar:'+i+'"></i>' ''', ''''<i style="--bar:'+i+'"></i>' ''') if False else None
patch('App/src/script.08.catalog.js', ''''<i style="--bar:'+i+'"></i>' ''', ''''<i style="--bar:'+i+'"></i>' ''') if False else None
p=ROOT/'App/src/script.08.catalog.js';s=p.read_text()
s=s.replace("'<i style=\"--bar:'+i+'\"></i>'", "'<i style=\"--bar:'+i+';--bar-height:'+([10,18,25,30,25,18,10][i%7])+'px\"></i>'")
s=s.replace("startEvolutionChainGame:{ids:[133,134,135]", "startEvolutionChainGame:{ids:[722,723,724]")
s=s.replace('Choisis un jeu solo. Les filtres avancés restent disponibles sans prendre toute la place.', 'Déduction, connaissances ou rapidité : choisis ton prochain défi.')
p.write_text(s,encoding='utf-8')
patch('App/visual-refresh.css','height:calc(7px + (var(--bar) % 4) * 5px);','height:var(--bar-height,14px);')
# Correct the browser assertion: Description is also a legitimate substring match for cri.
p=ROOT/'tools/browser_quality.py';s=p.read_text();s=s.replace("expect('Cri' in cards.all_text_contents()[0],'Cri missing')", "expect(any(t.strip()=='Cri' for t in page.locator('#screen-all-modes .all-modes-card:visible > b').all_text_contents()),'Cri missing')");p.write_text(s,encoding='utf-8')
# Expose authenticated/no-rank independently of missing rank, without leaking account IDs.
patch('App/server.js','''      mode,
      scope,
      direction: config.direction,''','''      mode,
      scope,
      authenticated: Boolean(user),
      direction: config.direction,''')
# New executable unit tests supplement existing source-shape checks.
write('App/test/audit-reliability.test.js',r'''"use strict";
const test=require("node:test"), assert=require("node:assert/strict"), fs=require("node:fs"), vm=require("node:vm"), path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"../src/script.10g.leaderboard-v2.js"),"utf8");
function fixture(){
 const store=new Map(), overlay={hidden:true,classList:{contains(){return overlay.hidden;}}};
 let markup="", token="", calls=[];
 const env={window:{__pokedleAuthed:true,addEventListener(){}},connectedAccountUser:{id:"A"},matchHistory:[],playerProfile:{},
 document:{getElementById(id){return id==="overlay-modal"?overlay:null;},querySelector(sel){return !overlay.hidden && token && sel.includes('"'+token+'"') ? {}:null;}},
 ensureOverlay(title,html){markup=html;token=html.match(/data-lb-request="(\d+)"/)?.[1]||"";overlay.hidden=false;},
 escapeHtml:s=>String(s).replace(/&/g,"&amp;").replace(/"/g,"&quot;"),
 localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},
 fetch:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({ok:true,top:[],around:[],total:0})};},
 setTimeout(){return 1;},clearTimeout(){},Date,Math,Map,Set,Array,Object,String,Number,Boolean,Promise,JSON};
 vm.createContext(env);vm.runInContext(source,env);
 return {env,store,overlay,calls,get html(){return markup;},replaceModal(){token="";markup="other";},close(){overlay.hidden=true;}};
}
function win(at=Date.now(),attempts=6){return {mode:"daily",result:"win",at,attempts};}
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
test('daily recovery rejects missing/future/old times and noninteger scores',()=>{
 const f=fixture(),now=Date.now();f.env.matchHistory=[win(now-86400000,1),win(now+100000,1),win(undefined,2),win(now,1.2),win(now,101),win(now,6)];
 f.env.matchHistory[2].at=undefined;assert.equal(f.env.pendingDailyLeaderboardScore(),6);
});
test('daily recovery coalesces concurrent requests and scopes markers by account',async()=>{
 const f=fixture();f.env.matchHistory=[win()];const d=deferred();let posts=0;
 f.env.fetch=async()=>{posts++;await d.promise;return {ok:true,json:async()=>({ok:true})};};
 const a=f.env.syncPendingDailyLeaderboard(),b=f.env.syncPendingDailyLeaderboard();assert.equal(a,b);d.resolve();await a;assert.equal(posts,1);
 await f.env.syncPendingDailyLeaderboard();assert.equal(posts,1);f.env.connectedAccountUser={id:"B"};await f.env.syncPendingDailyLeaderboard();assert.equal(posts,2);
 assert.equal(f.store.size,2);
});
test('failed submissions remain retryable and never create success markers',async()=>{
 const f=fixture();f.env.matchHistory=[win()];f.env.fetch=async()=>({ok:false,status:503,json:async()=>({ok:false})});
 assert.equal(await f.env.syncPendingDailyLeaderboard(),false);assert.equal(f.store.size,0);
 f.env.fetch=async()=>({ok:true,json:async()=>({ok:true})});assert.equal(await f.env.syncPendingDailyLeaderboard(),true);
});
test('account changes during submission do not write a success marker',async()=>{
 const f=fixture();f.env.matchHistory=[win()];const d=deferred();f.env.fetch=async()=>{await d.promise;return {ok:true,json:async()=>({ok:true})};};
 const p=f.env.syncPendingDailyLeaderboard();f.env.connectedAccountUser={id:"B"};d.resolve();await p;assert.equal(f.store.size,0);
});
test('an application error with HTTP200 is not an empty leaderboard',async()=>{
 const f=fixture();f.env.fetch=async()=>({ok:true,json:async()=>({ok:false,top:[]})});await f.env.openLeaderboardV2('daily','today');
 assert.match(f.html,/indisponible/);assert.match(f.html,/Réessayer/);assert.doesNotMatch(f.html,/Pas encore de performance/);
});
test('empty successful boards remain a valid empty state',async()=>{
 const f=fixture();await f.env.openLeaderboardV2('daily','today');assert.match(f.html,/Pas encore de performance ici/);assert.doesNotMatch(f.html,/indisponible/);
});
test('a late successful response cannot reopen a closed dialog',async()=>{
 const f=fixture(),d=deferred();f.env.fetch=async()=>{await d.promise;return {ok:true,json:async()=>({ok:true,top:[]})};};
 const p=f.env.openLeaderboardV2('daily','today');await Promise.resolve();f.close();d.resolve();await p;assert.equal(f.overlay.hidden,true);
});
test('a late error cannot replace a different modal',async()=>{
 const f=fixture(),d=deferred();f.env.fetch=async()=>{await d.promise;throw new Error('offline');};
 const p=f.env.openLeaderboardV2('daily','today');await Promise.resolve();f.replaceModal();d.resolve();await p;assert.equal(f.html,'other');
});
test('connected users without rank never receive the disconnected instruction',()=>{
 const f=fixture();assert.doesNotMatch(f.env.leaderboardUnrankedCopy(true,true),/Connecte-toi/);assert.match(f.env.leaderboardUnrankedCopy(false,false),/Connecte-toi/);
});
''')
print('Applied R1 source corrections and executable tests.')
