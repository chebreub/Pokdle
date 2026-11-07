"use strict";
const test=require("node:test"), assert=require("node:assert/strict"), fs=require("node:fs"),path=require("node:path");
const {renderStatsDashboard,rangeDays}=require("../lib/admin-stats-dashboard");
const {summarizeModes,SOLO_CATALOG,PARTY_CATALOG,HISTORY_TO_LAUNCH}=require("../lib/usage-metrics");

const base={days:1,endDay:"2026-11-04",livePeriod:true,generatedAt:"2026-11-04T20:36:00Z",adminKey:"preview-only",
  metrics:[{day:"2026-11-04",event:"visit",hits:21}],
  uniqueRows:[{day:"2026-11-04",uniques:16}],rawRows:[{d:"2026-11-04",hits:30}],
  feedbackHtml:"<p>Aucun retour</p>",diagnosticDays:[],diagnosticRows:[],
  retention:{nextDay:{back:4,base:20,rate:20},week:{back:5,base:30,rate:17},newWeek:{back:2,base:10,rate:20}}};

test("today is an in-progress UTC calendar day, not a fake 24-hour rolling trend",()=>{
  const html=renderStatsDashboard(base);
  assert.match(html,/Aujourd’hui, journée UTC en cours/);
  assert.match(html,/name="days" value="1" class="period-choice is-active"/);
  assert.match(html,/Page générée le 04\/11 à 20:36 UTC/);
  assert.match(html,/Sessions aujourd’hui/);
  assert.doesNotMatch(html,/<svg class="trend-chart"/);
  for(const n of [1,3,7,14,30,90])assert.match(html,new RegExp('name="days" value="'+n+'"'));
  assert.equal(rangeDays(1,"2026-11-04").join(), "2026-11-04");
});

test("three days include today while historical filters remain explicitly completed",()=>{
  const three=renderStatsDashboard({...base,days:3,metrics:[
    {day:"2026-11-02",event:"visit",hits:4},{day:"2026-11-03",event:"visit",hits:5},{day:"2026-11-04",event:"visit",hits:10}
  ]});
  assert.match(three,/3 jours UTC dont aujourd’hui/);
  assert.match(three,/name="days" value="3" class="period-choice is-active"/);
  assert.match(three,/<svg class="trend-chart"/);
  assert.deepEqual(rangeDays(3,"2026-11-04"),["2026-11-02","2026-11-03","2026-11-04"]);
  const past=renderStatsDashboard({...base,days:7,livePeriod:false,endDay:"2026-11-03"});
  assert.match(past,/7 jours complets, jusqu’au 03\/11\/2026 inclus/);
});

test("Wordle, Dossier, Grille, training and both Higher or Lower variants appear separately",()=>{
  const rows=[
    {day:"2026-11-04",event:"solo:wordle",hits:4},
    {day:"2026-11-04",event:"solo:dossier",hits:3},
    {day:"2026-11-04",event:"solo:grid",hits:2},
    {day:"2026-11-04",event:"solo:wordletraining",hits:5},
    {day:"2026-11-04",event:"solo:higherlowerrush",hits:8},
    {day:"2026-11-04",event:"solo:higherlower",hits:1},
    {day:"2026-11-04",event:"complete:higher-lower-rush:win",hits:2},
    {day:"2026-11-04",event:"party:start:dessin",hits:6},
    {day:"2026-11-04",event:"share:daily",hits:7},
    {day:"2026-11-04",event:"share:visit",hits:9}
  ];
  const html=renderStatsDashboard({...base,days:3,metrics:rows});
  for(const name of ["Wordle du jour","Dossier du jour","Grille du jour","Wordle Pokémon · Entraînement",
    "Higher or Lower · 60 s","Higher or Lower · Illimité","Dessine-le !","2. Lien ouvert","3. Partie lancée"]) {
    assert.ok(html.includes(name),name+" should be shown by name");
  }
  const summary=summarizeModes(rows);
  const rush=summary.find(s=>s.mode==="higherlowerrush");
  const infinite=summary.find(s=>s.mode==="higherlower");
  assert.equal(rush.launches,8);
  assert.equal(rush.completions,2);
  assert.equal(infinite.launches,1);
  assert.equal(infinite.completions,0);
  assert.equal(HISTORY_TO_LAUNCH["higher-lower-rush"],"higherlower","the ball reward source remains shared as before");
  assert.ok(PARTY_CATALOG["party:start:dessin"]);
  assert.ok(SOLO_CATALOG.wordletraining);
  assert.match(html,/leur rapport aux ouvertures ne mesure pas l’abandon/);
  assert.doesNotMatch(html,/Taux de fin/);
});

test("unavailable data never turns into invented zeros or percentages",()=>{
  const html=renderStatsDashboard({...base,metrics:null,uniqueRows:null,rawRows:null,retention:null});
  assert.match(html,/Aucune donnée de fréquentation disponible|Aucune donnée de fréquentation disponible sur cette période|Sessions aujourd’hui/);
  assert.match(html,/Retour des joueurs/);
  assert.match(html,/>—</);
  assert.doesNotMatch(html,/>NaN</);
  assert.doesNotMatch(html,/>100 %</);
});

test("route remains authenticated and measures short windows without writing to gameplay tables",()=>{
  const server=fs.readFileSync(path.join(__dirname,"../server.js"),"utf8");
  const a=server.indexOf('app.get("/admin/stats"'),b=server.indexOf("\n});",a);
  const route=server.slice(a,b);
  assert.match(route,/\[1, 3, 7, 14, 30, 90\]/);
  assert.match(route,/livePeriod = days === 1 \|\| days === 3/);
  assert.match(route,/usageMetrics\.startDay\(14, retentionEnd\)/);
  for(const header of ["X-Robots-Tag","Referrer-Policy","Cache-Control"])assert.ok(route.includes(header));
  assert.match(route,/res\.status\(403\)/);
  assert.doesNotMatch(route,/INSERT INTO|UPDATE\s+\w+|DELETE FROM/);
});

test("the new tracked modes send only aggregate event names and preserve server whitelist",()=>{
  const client=mode=>fs.readFileSync(path.join(__dirname,"../src",mode),"utf8");
  assert.match(client("script.10o.daily-wordle.js"),/trackUsage\('solo:wordle'\)/);
  assert.match(client("script.10p.daily-dossier.js"),/trackUsage\('solo:dossier'\)/);
  assert.match(client("script.10w.daily-grid.js"),/trackUsage\('solo:grid'\)/);
  assert.match(client("script.10xn.wordle-training.js"),/trackUsage\('solo:wordletraining'\)/);
  assert.match(client("script.03.minijeux.js"),/solo:higherlowerrush/);
  assert.match(client("script.10xzj.verified-quiz-hl.js"),/solo:higherlowerrush/);
  const server=fs.readFileSync(path.join(__dirname,"../server.js"),"utf8");
  assert.match(server,/\.\.\.Object\.keys\(usageMetrics\.SOLO_CATALOG\)\.map/);
  assert.match(server,/if \(!USAGE_EVENTS\.has\(event\)\) return res\.status\(400\)/);
});
