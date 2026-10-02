"""Final evidence-driven repairs; this workbench script is removed before merge."""
from pathlib import Path
import re,json,subprocess
ROOT=Path(__file__).resolve().parents[1]
def patch(path,old,new):
 p=ROOT/path;s=p.read_text(encoding='utf-8-sig')
 if old not in s:
  if new in s:return
  raise RuntimeError('Missing anchor '+path+': '+old[:90])
 if s.count(old)!=1:raise RuntimeError('Ambiguous anchor '+path+': '+old[:90])
 p.write_text(s.replace(old,new,1),encoding='utf-8')
# The 768px dark-theme regression is a header wrapping issue, not page overflow to hide.
p=ROOT/'App/visual-refresh.css';s=p.read_text()
s=s.replace('#pokdle-app.design-refresh header { background:', '#pokdle-app.design-refresh > header { background:')
if '/* Header layout is theme-independent' not in s:
 anchor='/* Home: one featured daily challenge, then clearly separated game families. */'
 fix='''/* Header layout is theme-independent; only its colors change. */
@media (min-width:641px) and (max-width:1100px) {
 #pokdle-app.design-refresh > header .header-top { display:flex !important; flex-wrap:wrap !important; align-items:center; gap:10px !important; min-width:0; }
 #pokdle-app.design-refresh > header #global-nav { order:3; flex:1 0 100%; width:100%; min-width:0; justify-content:center; }
 #pokdle-app.design-refresh > header .header-actions { margin-left:auto; min-width:0; max-width:100%; flex-wrap:wrap; }
}
'''
 if anchor not in s:raise RuntimeError('Missing header styling anchor')
 s=s.replace(anchor,fix+'\n'+anchor,1)
# Old sprite selectors only own the old direct-child structure, not the new nested previews.
i=s.index('PROFESSIONAL PASS V2');prefix,tail=s[:i],s[i:]
def direct_image(m):
 text=m.group(0)
 return text if re.search(r'>\s*img',text) else re.sub(r'\s+img$', ' > img',text)
prefix=re.sub(r'(?m)^[^\n{}]*\.mode-card-art[^\n{}]*?\s+img\b',direct_image,prefix)
s=prefix+tail;p.write_text(s,encoding='utf-8')
# Keep local rank caches scoped to identity and UTC day. Ignore stale in-flight responses.
LIVE='App/src/script.10h.live-rank.js';p=ROOT/LIVE;s=p.read_text()
if 'function liveRankCacheScope()' not in s:
 marker='const LIVE_RANK_MILESTONES = new Set();'
 s=s.replace(marker,marker+'''
let liveRankCurrentScope = "";
function liveRankCacheScope() {
  const account = typeof leaderboardAccountId === "function" ? leaderboardAccountId() : "";
  const day = typeof leaderboardTodayKey === "function" ? leaderboardTodayKey() : new Date().toISOString().slice(0,10);
  const scope = account+":"+day;
  if (scope !== liveRankCurrentScope) {
    LIVE_RANK_CACHE.clear(); LIVE_RANK_MILESTONES.clear(); liveRankCurrentScope=scope;
  }
  return scope;
}
''',1)
start=s.index('function liveRankFetch(');end=s.index('function liveRankPersonalBest',start)
s=s[:start]+'''function liveRankFetch(mode, force=false) {
  if (!mode) return Promise.resolve(null);
  const scope=liveRankCacheScope(), cached=LIVE_RANK_CACHE.get(mode), now=Date.now();
  if (!force && cached?.promise) return cached.promise;
  if (!force && cached && now-cached.at<LIVE_RANK_TTL) return Promise.resolve(cached.data);
  const url="/api/leaderboard?mode="+encodeURIComponent(mode)+"&scope=today";
  const request=typeof leaderboardFetchJson === "function" ? leaderboardFetchJson(url)
    : fetch(url,{credentials:"same-origin"}).then(r=>r.json()).then(d=>{if(!d?.ok)throw Error("unavailable");return d;});
  const promise=request.then(data=>{
    if (scope!==liveRankCacheScope()) return null;
    LIVE_RANK_CACHE.set(mode,{data,at:Date.now(),promise:null});return data;
  }).catch(()=>{
    if (scope===liveRankCacheScope()) LIVE_RANK_CACHE.set(mode,{data:null,at:Date.now(),promise:null});
    return null;
  });
  LIVE_RANK_CACHE.set(mode,{data:cached?.data||null,at:cached?.at||0,promise});
  return promise;
}
'''+s[end:]
s=s.replace('  const cached=LIVE_RANK_CACHE.get(mode)?.data||null;\n  const paint=(data)=>{','  const scope=liveRankCacheScope();\n  const cache=LIVE_RANK_CACHE.get(mode);\n  const cached=cache?.data||null;\n  const paint=(data,status="ready")=>{')
s=s.replace('    if (!hud.isConnected||hud.dataset.mode!==mode) return;','    if (!hud.isConnected||hud.dataset.mode!==mode||scope!==liveRankCacheScope()) return;')
s=s.replace('const todayText=me?liveRankFormat(me.score,mode,data.unit||meta.unit):data?"Non classé":"Indisponible";', 'const todayText=me?liveRankFormat(me.score,mode,data.unit||meta.unit):data?"Non classé":status==="loading"?"Chargement…":"Indisponible";')
s=s.replace('  paint(cached);\n  liveRankFetch(mode).then(paint);', '  paint(cached,cache?"ready":"loading");\n  liveRankFetch(mode).then(data=>paint(data,data?"ready":"error"));')
s=s.replace('<span>Record perso</span>','<span>Record local</span>');p.write_text(s,encoding='utf-8')
# Bound legacy all-time synchronization: it must not keep the dialog loading forever.
LB='App/src/script.10g.leaderboard-v2.js';p=ROOT/LB;s=p.read_text()
if 'function leaderboardWaitForSync' not in s:
 at=s.index('function leaderboardAccountId()')
 s=s[:at]+'''function leaderboardWaitForSync(promise) {
  let timer;
  return Promise.race([Promise.resolve(promise),new Promise(resolve=>{timer=setTimeout(()=>resolve(false),5000);})])
    .finally(()=>clearTimeout(timer));
}
'''+s[at:]
s=s.replace('syncTasks.push(Promise.resolve(submitLeaderboardScores()).catch(()=>false))','syncTasks.push(leaderboardWaitForSync(submitLeaderboardScores()).catch(()=>false))')
s=s.replace('if (ok && leaderboardAccountId() === account && leaderboardTodayKey() === day) {','if (ok && leaderboardAccountId() === account && leaderboardTodayKey() === day) {\n      if (typeof LIVE_RANK_CACHE !== "undefined") LIVE_RANK_CACHE.delete("daily");') if 'LIVE_RANK_CACHE.delete("daily")' not in s else s
p.write_text(s,encoding='utf-8')
# Browser regression now closes a dialog with a request genuinely in flight.
p=ROOT/'tools/browser_quality.py';s=p.read_text()
start=s.index('    def late():');end=s.index("    check('ranking-closed',late)",start)
s=s[:start]+'''    def late():
     page.unroute('**/api/leaderboard?*');pending=[]
     page.route('**/api/leaderboard?*',lambda r:pending.append(r))
     page.evaluate('void openLeaderboardV2("daily","today")');page.wait_for_timeout(200)
     expect(bool(pending),'No request was started')
     page.evaluate('closeOverlayModal()')
     for route in pending:route.fulfill(status=200,content_type='application/json',body=json.dumps({'ok':True,'top':[],'me':None,'total':0}))
     page.wait_for_timeout(150);expect(not page.locator('#overlay-modal').is_visible(),'Late response reopened closed dialog')
     page.unroute('**/api/leaderboard?*')
'''+s[end:]
# Include useful offender metadata instead of obscuring any future overflow with CSS.
s=s.replace("expect(state['visible']==[expected],f'Unexpected visible screens: {state}');expect(state['overflow']<=2,f'Horizontal overflow: {state}');return state",'''expect(state['visible']==[expected],f'Unexpected visible screens: {state}')
     if state['overflow']>2: state['offenders']=page.evaluate("[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().width && e.getBoundingClientRect().right>innerWidth+2).slice(0,8).map(e=>({tag:e.tagName,id:e.id,cls:String(e.className),right:e.getBoundingClientRect().right}))")
     expect(state['overflow']<=2,f'Horizontal overflow: {state}');return state''')
p.write_text(s,encoding='utf-8')
# Force unit race tests to wait until fetch really starts.
p=ROOT/'App/test/audit-reliability.test.js';s=p.read_text()
s=s.replace('const f=fixture(),d=deferred();f.env.fetch=async()=>{await d.promise;return {ok:true,json:async()=>({ok:true,top:[]})};};\n const p=f.env.openLeaderboardV2(\'daily\',\'today\');await Promise.resolve();f.close();', 'const f=fixture(),d=deferred(),started=deferred();f.env.fetch=async()=>{started.resolve();await d.promise;return {ok:true,json:async()=>({ok:true,top:[]})};};\n const p=f.env.openLeaderboardV2(\'daily\',\'today\');await started.promise;f.close();')
s=s.replace('const f=fixture(),d=deferred();f.env.fetch=async()=>{await d.promise;throw new Error(\'offline\');};\n const p=f.env.openLeaderboardV2(\'daily\',\'today\');await Promise.resolve();f.replaceModal();', 'const f=fixture(),d=deferred(),started=deferred();f.env.fetch=async()=>{started.resolve();await d.promise;throw new Error(\'offline\');};\n const p=f.env.openLeaderboardV2(\'daily\',\'today\');await started.promise;f.replaceModal();')
if 'newer leaderboard requests own the final modal' not in s:
 s+=r'''
test('newer leaderboard requests own the final modal even when the older response arrives last',async()=>{
 const f=fixture(),old=deferred(),started=deferred();
 f.env.fetch=async(url)=>{
  if(url.includes('mode=daily')){started.resolve();await old.promise;return {ok:true,json:async()=>({ok:true,label:'OLD DAILY',top:[]})};}
  return {ok:true,json:async()=>({ok:true,label:'LATEST QUIZ',top:[]})};
 };
 const stale=f.env.openLeaderboardV2('daily','today');await started.promise;
 await f.env.openLeaderboardV2('quiz','week');old.resolve();await stale;
 assert.match(f.html,/LATEST QUIZ/);assert.doesNotMatch(f.html,/OLD DAILY/);
});
'''
p.write_text(s,encoding='utf-8')
# Compatible lockfile remediation only: no forced major upgrades or source manifest changes.
p=ROOT/'App/package.json';before=p.read_bytes()
subprocess.run(['npm','audit','fix','--package-lock-only','--ignore-scripts'],cwd=ROOT/'App',check=False,timeout=120)
if p.read_bytes()!=before:raise RuntimeError('Unexpected dependency manifest change: review before continuing')
subprocess.run(['npm','ci','--ignore-scripts'],cwd=ROOT/'App',check=True,timeout=120)
print('Applied final reliability and measured layout corrections; compatible security updates installed.')
