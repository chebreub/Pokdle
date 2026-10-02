"""Reviewed R1/R2/R3/R4/R5 edits, isolated from main; removed before merge."""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]
def patch(path,old,new):
 p=ROOT/path;s=p.read_text(encoding='utf-8-sig')
 if old not in s:
  if new in s:return
  raise RuntimeError('Missing anchor '+path+': '+old[:100])
 if s.count(old)!=1:raise RuntimeError('Ambiguous anchor '+path+': '+old[:100])
 p.write_text(s.replace(old,new,1),encoding='utf-8')
def write(path,content):
 p=ROOT/path;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(content,encoding='utf-8')
# Extend the current suite instead of creating a second competing browser runner.
p=ROOT/'tools/browser_quality.py';s=p.read_text()
s=s.replace('[(390,844),(1366,900)]','[(360,800),(390,844),(768,1024),(1366,900),(1920,1080)]')
if 'def empty_search()' not in s:
 s=s.replace("    check('search',search)",'''    check('search',search)
    def empty_search():
     page.locator('#mode-search').fill('zzzznoresultzzzz');page.wait_for_timeout(100)
     expect(page.locator('#mode-empty').is_visible(),'Missing empty state')
     expect(page.locator('#screen-all-modes .all-modes-card:visible').count()==0,'Filtered cards remain visible')
     page.locator('#mode-empty button').click();expect(page.locator('#mode-search').input_value()=='','Search was not reset')
     return screen('screen-all-modes')
    check('empty-search-reset',empty_search)''')
if 'def preview_layout()' not in s:
 s=s.replace("    check('waveform',waveform,False)",'''    check('waveform',waveform,False)
    def preview_layout():
     sample=page.locator('.mode-preview-evolution img')
     sizes=sample.evaluate_all('(els)=>els.map(e=>({position:getComputedStyle(e).position,width:e.getBoundingClientRect().width}))')
     expect(len(sizes)==3,'Evolution sequence missing')
     expect(all(e['position']=='static' and 12<=e['width']<=30 for e in sizes),str(sizes))
     return sizes
    check('preview-layout',preview_layout,False)''')
if "check('daily-result'" not in s:
 s=s.replace("    check('normal-result',finish);check('pokedex',lambda:nav('pokedex','screen-pokedex'))",'''    check('normal-result',finish)
    def daily_finish():
     start('startDailyGame','screen-game')
     name=page.evaluate('secretPokemon.name');page.locator('#guess-input').fill(name);page.locator('#btn-submit').click()
     page.locator('#win-box').wait_for(state='visible');return screen('screen-game')
    check('daily-result',daily_finish)
    def completed_home():
     nav('home','screen-config')
     expect(page.locator('#daily-hero').get_attribute('data-daily-state')=='complete','Daily summary did not update')
     return screen('screen-config')
    check('home-completed',completed_home)
    check('pokedex',lambda:nav('pokedex','screen-pokedex'))''')
if "check('pixel'" not in s:
 s=s.replace("    check('party-entry',party)",'''    check('party-entry',party)
    check('pixel',lambda:start('startPixelGame','screen-game'))
    check('cry',lambda:start('startCryGame','screen-game'))
    check('quiz',lambda:start('startQuizGame','screen-game'))
    def draft_pro():
     nav('game','screen-all-modes')
     page.locator('button[data-action="openFromAllModes"][data-args=\\'["openDraftScoreAttackMode", true]\\']:visible').first.click()
     return screen('screen-draft-score-attack')
    check('draft-pro',draft_pro)
    def back_history():
     nav('game','screen-all-modes');page.locator('#mode-search').fill('cri');nav('pokedex','screen-pokedex')
     page.go_back();screen('screen-all-modes');expect(page.locator('#mode-search').input_value()=='cri','Back lost catalog search')
    check('browser-back',back_history)''')
if "check('home-dark'" not in s:
 s=s.replace("    check('ranking-closed',late);check('javascript-errors',lambda:expect(not errors,repr(errors)),False);ctx.close()",'''    check('ranking-closed',late)
    def dark():
     nav('home','screen-config');page.evaluate("document.body.classList.add('theme-dark')");return screen('screen-config')
    check('home-dark',dark)
    page.evaluate("document.body.classList.remove('theme-dark')")
    check('javascript-errors',lambda:expect(not errors,repr(errors)),False);ctx.close()''')
p.write_text(s,encoding='utf-8')
# Repair specificity in the owning thumbnail rules, rather than append an override layer.
p=ROOT/'App/visual-refresh.css';s=p.read_text();start=s.index('PROFESSIONAL PASS V2');prefix,tail=s[:start],s[start:]
tail=tail.replace('#pokdle-app.design-refresh .mode-preview','#pokdle-app.design-refresh #screen-all-modes .mode-card-art .mode-preview')
tail=tail.replace('#pokdle-app.design-refresh .preview-','#pokdle-app.design-refresh #screen-all-modes .mode-card-art .preview-')
# idempotent exact base selector
base='#pokdle-app.design-refresh #screen-all-modes .mode-card-art .mode-preview img{\n  position:absolute;'
if base in tail:tail=tail.replace(base,base+'\n  inset:auto;',1)
s=prefix+tail
# Shared SVG symbols use strokes; bare SVGs caused the black/blank recommended icons.
if '.club-pick-icon svg {' not in s:
 s+='\n/* Shared icon treatment: same symbols as the regular catalogue. */\n#pokdle-app.design-refresh .club-pick-icon svg { width:22px; height:22px; fill:none; stroke:currentColor; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }\n'
if '/* Contextual home states' not in s:
 s+='''
/* Contextual home states: completed Daily is a summary, not another launch pitch. */
#pokdle-app.design-refresh #screen-config .pk-hero[data-daily-state="complete"] { min-height:0 !important; padding:22px 28px !important; }
#pokdle-app.design-refresh #screen-config .pk-hero[data-daily-state="complete"] .pk-hero-title { font-size:clamp(1.6rem,2.8vw,2.2rem) !important; }
#pokdle-app.design-refresh #screen-config .pk-hero[data-daily-state="complete"] .pk-hero-visual { max-height:160px; }
#pokdle-app.design-refresh #screen-config .pk-hero[data-daily-state="complete"] .pk-qm { display:none; }
#pokdle-app.design-refresh #screen-config .home-path { display:flex; flex-direction:column; min-height:190px !important; }
#pokdle-app.design-refresh #screen-config .home-path-actions { margin-top:auto; display:flex; flex-wrap:wrap; align-items:center; gap:10px; padding-top:12px; }
#pokdle-app.design-refresh #screen-config .home-path-actions .home-text-link { margin:0; }
#pokdle-app.design-refresh #screen-all-modes .mode-hub-controls .mode-search { width:100%; min-width:0; max-width:none; margin:0; justify-self:stretch; }
#pokdle-app.design-refresh #screen-all-modes .mode-hub-controls .mode-search input { width:100%; min-width:0; }
@media (max-width:640px) {
 #pokdle-app.design-refresh #screen-config .pk-hero[data-daily-state="complete"] { padding:18px !important; }
 #pokdle-app.design-refresh #screen-config .home-path { min-height:170px !important; }
 #pokdle-app.design-refresh #screen-config .home-path-actions { align-items:flex-start; }
}
'''
p.write_text(s,encoding='utf-8')
CORE='App/src/script.02.statclash.js'
patch(CORE,'{ weekday: "long", day: "numeric", month: "long" }','{ weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }')
patch(CORE,'? "🔁 Revoir le mode du jour"','? "🔁 Revoir mon résultat"')
patch(CORE,'''  const lostToday = Boolean(todayResult && !todayResult.won);
  let inProgress = false;''','''  const lostToday = Boolean(todayResult && !todayResult.won);
  const hero = document.getElementById("daily-hero");
  if (hero) {
    hero.dataset.dailyState = wonToday || lostToday ? "complete" : "available";
    const subtitle = hero.querySelector(".pk-hero-sub");
    if (subtitle) {
      if (!subtitle.dataset.initialCopy) subtitle.dataset.initialCopy = subtitle.textContent;
      const count = Number(todayResult?.attempts) || 0;
      subtitle.textContent = wonToday ? (count > 0 ? `Trouvé en ${count} essai${count > 1 ? "s" : ""}. Continue en solo ou entre amis.` : "Défi réussi. Continue en solo ou entre amis.")
        : lostToday ? "Défi terminé. Un nouveau Pokémon arrive au prochain rendez-vous." : subtitle.dataset.initialCopy;
    }
    const image = hero.querySelector(".pk-silo-img");
    if (image) {
      if (!image.dataset.initialSrc) image.dataset.initialSrc = image.getAttribute("src");
      const completed = todayResult && (wonToday || lostToday) ? POKEMON_BY_ID.get(Number(todayResult.secretId)) : null;
      image.src = completed ? image.dataset.initialSrc.replace(/\\/\\d+\\.png$/, "/"+Number(completed.id)+".png") : image.dataset.initialSrc;
    }
    const date = hero.querySelector(".pk-kicker");
    if (date) date.title = "Le défi est commun à tous et se renouvelle à minuit UTC.";
  }
  let inProgress = false;''')
# Explicit actions at the bottom of both home paths; no new destination.
patch('App/index.html','''          <button class="btn-blue" type="button" data-action="openAllModesScreen" data-args='["solo"]'>Choisir un jeu <span aria-hidden="true">→</span></button>''','''          <div class="home-path-actions"><button class="btn-blue" type="button" data-action="openAllModesScreen" data-args='["solo"]'>Choisir un jeu <span aria-hidden="true">→</span></button></div>''')
patch('App/index.html','''          <button class="btn-blue" type="button" data-action="openPartyRoomMode">Ouvrir la Party Room <span aria-hidden="true">→</span></button>
          <button class="home-text-link" type="button" data-action="openAllModesScreen" data-args='["friends"]'>Duels et autres jeux entre amis</button>''','''          <div class="home-path-actions"><button class="btn-blue" type="button" data-action="openPartyRoomMode">Ouvrir la Party Room <span aria-hidden="true">→</span></button>
          <button class="home-text-link" type="button" data-action="openAllModesScreen" data-args='["friends"]'>Duels et autres jeux entre amis</button></div>''')
patch('App/index.html','''<input id="pokedex-search" type="search" placeholder="Rechercher un Pokémon..." autocomplete="off" />''','''<input id="pokedex-search" type="search" aria-label="Rechercher un Pokémon" placeholder="Rechercher un Pokémon..." autocomplete="off" autocorrect="off" spellcheck="false" />''')
patch('App/index.html','''<div id="mode-empty" class="mode-empty" hidden><p>Aucun résultat. Essaie un autre nom ou explore tous les modes.</p><button class="btn-ghost" type="button" data-action="resetModeCatalog">Voir tous les modes</button></div>''','''<div id="mode-empty" class="mode-empty" hidden><p>Aucun résultat dans cette rubrique. Essaie un autre nom ou efface les filtres.</p><button class="btn-ghost" type="button" data-action="resetModeCatalog">Effacer les filtres</button></div>''')
# Result settings duplicated the permanent header action; leave game actions focused.
patch('App/index.html','''          <button class="btn-ghost" data-action="openSettingsModal"><svg class="btn-ico"><use href="#i-sliders"/></svg>Paramètres</button>''','''          <!-- Global display/audio settings remain available in the header. -->''')
# Put creating/joining a room first in document order; keep all rules and modes accessible.
p=ROOT/'App/index.html';s=p.read_text()
start=s.index('<div id="party-lobby" class="party-lobby">')+len('<div id="party-lobby" class="party-lobby">');end=s.index('\n        </div>\n        <div id="party-joined"',start)
part=s[start:end]
if part.lstrip().startswith('<div class="party-welcome">'):
 pivot=part.index('<div class="party-entry-panel">');welcome=part[:pivot].strip();entry=part[pivot:].strip();s=s[:start]+'\n          '+entry+'\n          '+welcome+s[end:]
p.write_text(s,encoding='utf-8')
# Live HUD must not advertise a first place when the endpoint failed.
LIVE='App/src/script.10h.live-rank.js'
patch(LIVE,'''    const goalCopy=liveRankGoalCopy(data,mode,current.score);''','''    const goalCopy=data ? liveRankGoalCopy(data,mode,current.score) : {tone:"muted",text:"Classement en attente de confirmation."};''')
patch(LIVE,'''    const todayText=me?liveRankFormat(me.score,mode,data.unit||meta.unit):"Non classé";''','''    const todayText=me?liveRankFormat(me.score,mode,data.unit||meta.unit):data?"Non classé":"Indisponible";''')
# New atomic storage module. Scores remain client-reported, NOT anti-cheat certified.
write('App/lib/leaderboard-store.js',r'''"use strict";
async function ensureLeaderboardResultKeys(pool) {
  await pool.query("ALTER TABLE leaderboard_events ADD COLUMN IF NOT EXISTS result_key TEXT");
  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS leaderboard_result_key_idx ON leaderboard_events (discord_id, mode, result_key) WHERE result_key IS NOT NULL");
}
async function recordLeaderboardResult(pool, user, mode, score, config, resultKey = null) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query(
      `INSERT INTO leaderboard_events (discord_id, mode, score, created_at, result_key) VALUES ($1,$2,$3,now(),$4)
       ON CONFLICT (discord_id, mode, result_key) WHERE result_key IS NOT NULL DO NOTHING RETURNING score`,
      [user.id,mode,score,resultKey]
    );
    const duplicate = inserted.rows.length === 0;
    let accepted = score;
    if (duplicate) {
      const existing = await client.query("SELECT score FROM leaderboard_events WHERE discord_id=$1 AND mode=$2 AND result_key=$3",[user.id,mode,resultKey]);
      if (!existing.rows[0]) throw new Error("Missing duplicate leaderboard result");
      accepted = Number(existing.rows[0].score);
    }
    const ascending = config.direction === "asc";
    const best = ascending ? "LEAST" : "GREATEST";
    await client.query(
      `INSERT INTO scores (discord_id,mode,score,username,avatar,updated_at) VALUES ($1,$2,$3,$4,$5,now())
       ON CONFLICT (discord_id,mode) DO UPDATE SET score=${best}(scores.score,EXCLUDED.score), username=EXCLUDED.username,avatar=EXCLUDED.avatar,
       updated_at=CASE WHEN EXCLUDED.score ${ascending ? "<" : ">"} scores.score THEN now() ELSE scores.updated_at END`,
      [user.id,mode,accepted,user.username||"",user.avatar||""]
    );
    await client.query("COMMIT");
    return {score:accepted,duplicate};
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch (_rollbackError) {}
    throw error;
  } finally { client.release(); }
}
module.exports={ensureLeaderboardResultKeys,recordLeaderboardResult};
''')
p=ROOT/'App/server.js';s=p.read_text()
req='const { ensureLeaderboardResultKeys, recordLeaderboardResult } = require("./lib/leaderboard-store");\n'
if req not in s:s=req+s
anchor='    await pgPool.query(`CREATE INDEX IF NOT EXISTS leaderboard_events_mode_created_idx ON leaderboard_events (mode, created_at DESC)`);'
if 'await ensureLeaderboardResultKeys(pgPool);' not in s:
 if anchor not in s:raise RuntimeError('DB migration anchor missing')
 s=s.replace(anchor,anchor+'\n    await ensureLeaderboardResultKeys(pgPool);',1)
start=s.index('app.post("/api/leaderboard/result"');end=s.index('app.get("/api/leaderboard"',start)
s=s[:start]+r'''app.post("/api/leaderboard/result", express.json({ limit: "4kb" }), async (req, res) => {
  if (!authReady()) return res.status(503).json({ok:false,error:"unavailable"});
  const user=getSessionUser(req);
  if (!user) return res.status(401).json({ok:false,error:"authentication_required"});
  const mode=String(req.body?.mode||""), config=leaderboardConfig(mode);
  const score=clampLeaderboardScore(req.body?.score,config);
  if (!config || score==null) return res.status(400).json({ok:false,error:"invalid_score"});
  const today=new Date().toISOString().slice(0,10);
  if (mode==="daily" && req.body.dailyKey!=null && req.body.dailyKey!==today) return res.status(409).json({ok:false,error:"stale_daily"});
  const id=req.body?.resultId;
  if (id!=null && (typeof id!=="string" || !/^[A-Za-z0-9:_-]{1,100}$/.test(id))) return res.status(400).json({ok:false,error:"invalid_result_id"});
  const key=mode==="daily"?"daily:"+today:id||null;
  try {
    const stored=await recordLeaderboardResult(pgPool,user,mode,score,config,key);
    res.json({ok:true,mode,...stored});
  } catch (error) {
    console.error("[leaderboard] result:",error.message);
    res.status(503).json({ok:false,error:"storage_unavailable"});
  }
});

'''+s[end:]
p.write_text(s,encoding='utf-8')
write('App/test/leaderboard-store.test.js',r'''"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const {ensureLeaderboardResultKeys,recordLeaderboardResult}=require("../lib/leaderboard-store");
test("a storage failure rolls back the event and always releases the connection",async()=>{
 const calls=[];let released=false;
 const client={query:async(sql)=>{calls.push(sql);if(sql.startsWith("INSERT INTO scores"))throw Error("write failed");return {rows:[{score:6}]};},release(){released=true;}};
 await assert.rejects(recordLeaderboardResult({connect:async()=>client},{id:"test"},"daily",6,{direction:"asc"},"daily:2026-10-02"),/write failed/);
 assert.equal(calls[0],"BEGIN");assert.equal(calls.at(-1),"ROLLBACK");assert.equal(released,true);assert.equal(calls.includes("COMMIT"),false);
});
test("PostgreSQL migration preserves legacy records and concurrent retries count once",{skip:!process.env.QA_DATABASE_URL},async()=>{
 const {Pool}=require("pg"),url=process.env.QA_DATABASE_URL;
 const admin=new Pool({connectionString:url});const schema="qa_"+crypto.randomUUID().replaceAll("-","");let pool;
 try {
  await admin.query('CREATE SCHEMA "'+schema+'"');
  pool=new Pool({connectionString:url,options:"-c search_path="+schema});
  await pool.query("CREATE TABLE leaderboard_events(id bigserial PRIMARY KEY,discord_id text NOT NULL,mode text NOT NULL,score integer NOT NULL,created_at timestamptz NOT NULL DEFAULT now())");
  await pool.query("CREATE TABLE scores(discord_id text NOT NULL,mode text NOT NULL,score integer NOT NULL,username text NOT NULL DEFAULT '',avatar text NOT NULL DEFAULT '',updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(discord_id,mode))");
  await pool.query("INSERT INTO leaderboard_events(discord_id,mode,score) VALUES('legacy','daily',4)");
  await ensureLeaderboardResultKeys(pool);await ensureLeaderboardResultKeys(pool);
  const user={id:"A",username:"QA A"};
  const results=await Promise.all([1,2,3].map(()=>recordLeaderboardResult(pool,user,"daily",6,{direction:"asc"},"daily:2026-10-02")));
  assert.equal(results.filter(r=>r.duplicate).length,2);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM leaderboard_events WHERE discord_id='A'")).rows[0].n,1);
  const repeated=await recordLeaderboardResult(pool,user,"daily",1,{direction:"asc"},"daily:2026-10-02");assert.equal(repeated.score,6);
  assert.equal((await pool.query("SELECT score FROM scores WHERE discord_id='A'")).rows[0].score,6);
  await recordLeaderboardResult(pool,{id:"B"},"daily",2,{direction:"asc"},"daily:2026-10-02");
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM leaderboard_events")).rows[0].n,3);
  assert.equal((await pool.query("SELECT score FROM leaderboard_events WHERE discord_id='legacy'")).rows[0].score,4);
 } finally {if(pool)await pool.end();await admin.query('DROP SCHEMA IF EXISTS "'+schema+'" CASCADE');await admin.end();}
});
''')
print('Applied audited R1/R2/R3/R4/R5 corrections; preserved modes, progression and legacy records.')
