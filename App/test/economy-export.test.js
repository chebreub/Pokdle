"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {summarizeEconomy}=require("../lib/economy-stats");
const {buildEconomyExport,economyExportHref}=require("../lib/economy-export");
const {renderEconomySection}=require("../lib/admin-economy-section");
const {renderStatsDashboard}=require("../lib/admin-stats-dashboard");

const example = () => summarizeEconomy({
  startDay:"2026-11-03",endDay:"2026-11-05",
  coinRows:[
    {category:"daily",gained:"750",spent:"0",operations:4},
    {category:"buy_great",gained:"0",spent:"240",operations:1}
  ],
  ballRows:[{category:"shop",ball:"great",awarded:2},{category:"daily",ball:"poke",awarded:3}],
  wildRows:[
    {kind:"wild",status:"caught",shiny:true,ball:"great",encounters:1,attempted:1,poke:0,great:1,ultra:0},
    {kind:"wild",status:"skipped",shiny:false,ball:null,encounters:1,attempted:0,poke:0,great:0,ultra:0}
  ],actors:2
});

test("shared JSON export matches actual aggregate totals and period without guessing metrics",()=>{
  const data=buildEconomyExport(example());
  assert.equal(data.schema,"pokdle-economy-aggregate-v1");
  assert.deepEqual(data.period,{startDay:"2026-11-03",endDay:"2026-11-05",timezone:"Europe/Paris"});
  assert.deepEqual([data.pokedollars.credited,data.pokedollars.spent,data.pokedollars.netFlow],[750,240,510]);
  assert.deepEqual([data.balls.awarded,data.balls.awardedByType.great],[5,2]);
  assert.deepEqual([data.encounters.total,data.encounters.caught,data.encounters.shinySeen,
    data.encounters.shinyCaught,data.encounters.totalThrows,data.encounters.observedCapturesPerThrowPct],
    [2,1,1,1,1,100]);
  assert.deepEqual(data.pokedollars.byCategory.map(x=>x.category),["daily","buy_great"]);
  assert.equal(buildEconomyExport(null),null);
  assert.equal(economyExportHref(null),null);
  const none=example();none.wild.successPerThrow=null;
  assert.equal(buildEconomyExport(none).encounters.observedCapturesPerThrowPct,null,
    "unknown empirical rate must remain unknown, never become zero");
});

test("the download contains only allowlisted aggregates even when source has hostile extra keys",()=>{
  const data=example();
  data.adminKey="SUPER_SECRET_ADMIN_KEY";
  data.identity="user:very-sensitive";
  data.coins.sources[0].account_id="VERY_PRIVATE_ACCOUNT";
  data.coins.sources[0].category="user:unexpected-secret-classification";
  data.balls.sources[0].actionId="PRIVATE_ACTION_ID";
  data.wild.rawActions=[{identity:"guest:private"}];
  const exported=buildEconomyExport(data);
  const text=JSON.stringify(exported);
  for(const secret of ["SUPER_SECRET_ADMIN_KEY","user:very-sensitive","VERY_PRIVATE_ACCOUNT",
    "PRIVATE_ACTION_ID","guest:private","unexpected-secret-classification","adminKey","account_id"])
    assert.equal(text.includes(secret),false,"must not export: "+secret);
  assert.equal(exported.pokedollars.byCategory[0].category,"other");
  assert.equal(exported.interpretation.noIndividualDataIncluded,true);
});

test("the admin page provides a directly downloadable no-credential JSON report",()=>{
  const data=example(),markup=renderEconomySection(data);
  assert.match(markup,/Exporter le bilan anonymisé \(JSON\)/);
  assert.match(markup,/download="pokdle-economie-2026-11-05\.json"/);
  const match=markup.match(/href="(data:application\/json;charset=utf-8,[^"]+)"/);
  assert.ok(match,"the report must be a local data URI, without server POST");
  const decoded=JSON.parse(decodeURIComponent(match[1].split(",").slice(1).join(",")));
  assert.deepEqual(decoded,buildEconomyExport(data));
  assert.ok(!match[1].includes("ADMIN_STATS_KEY"));
  assert.ok(!match[1].includes("user:"));
  const page=renderStatsDashboard({days:3,endDay:"2026-11-05",adminKey:"test-admin-key-only",economy:data,
    metrics:[],uniqueRows:[],rawRows:[]});
  assert.match(page,/Exporter le bilan anonymisé/);
  const unavailable=renderEconomySection(null);
  assert.doesNotMatch(unavailable,/download=/);
  assert.match(unavailable,/Mesures indisponibles/);
});
