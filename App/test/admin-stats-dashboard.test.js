"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {renderStatsDashboard,rangeDays} = require("../lib/admin-stats-dashboard");
const fs = require("node:fs");

const sample = {
  days: 7, endDay: "2026-10-28", adminKey: "secret&A",
  metrics: [
    {day:"2026-10-28",event:"visit",hits:"62"},
    {day:"2026-10-27",event:"visit",hits:"56"},
    {day:"2026-10-28",event:"solo:daily",hits:"12"},
    {day:"2026-10-28",event:"solo:normal",hits:"9"},
    {day:"2026-10-28",event:"complete:daily:win",hits:"7"},
    {day:"2026-10-28",event:"party:create",hits:"2"},
    {day:"2026-10-28",event:"party:join",hits:"5"},
    {day:"2026-10-28",event:"party:start:dexrace",hits:"3"}
  ],
  uniqueRows: [{day:"2026-10-28",uniques:40}],
  rawRows: [{d:"2026-10-28",hits:154}],
  labels: {"solo:daily":"Pokémon du jour","solo:normal":"Classique"},
  feedbackHtml: "<h2>Retours des joueurs</h2><p>Aucun message.</p>",
  diagnosticDays: ["2026-10-28"],
  diagnosticRows: [{label:"complete:daily:win",values:[7],total:7}],
  bootedAt: "2026-10-29 11:44"
};
test("dashboard shows truthful summary, party metrics, charts and details without inventing retention", () => {
  const html = renderStatsDashboard(sample);
  assert.match(html, /<!doctype html>/);
  assert.match(html, /name="days"/);
  assert.match(html, /7 jours complets, jusqu.au 28\/10\/2026/);
  assert.match(html, /Sessions enregistrées/);
  assert.match(html, /118/);
  assert.match(html, /Navigateurs uniques/);
  assert.match(html, />40</);
  assert.match(html, /Party Room/);
  assert.match(html, /Manches démarrées/);
  assert.match(html, />154</);
  assert.match(html, /Pokémon du jour/);
  assert.match(html, /<svg/);
  // No figure is invented: without the daily plays, the return of players says it is unavailable.
  assert.match(html, /Retour des joueurs<\/div><strong>—<\/strong><small>Indisponible : base du Pokémon du jour injoignable/);
  const withReturn = renderStatsDashboard({ ...sample, retention: { nextDay: { back: 12, base: 40, rate: 30 }, week: { back: 9, base: 20, rate: 45 }, newWeek: { back: 2, base: 10, rate: 20 } } });
  assert.match(withReturn, /Retour des joueurs<\/div><strong>30 %<\/strong><small>Rejouent le lendemain \(12\/40\) · dans les 7 jours : 45 % · nouveaux revenus en 7 jours : 20 %/);
  assert.match(html, /Diagnostic technique/);
  assert.match(html, /complete:daily:win/);
  assert.doesNotMatch(html, /128 joueurs ont abandonné/);
});
test("handles missing days without silently treating unmeasured browsers as zero", () => {
  const html = renderStatsDashboard({...sample, metrics:null, uniqueRows:null, rawRows:null, diagnosticRows:[], diagnosticDays:[]});
  assert.match(html, /Aucune donnée de fréquentation disponible/);
  assert.match(html, /Aucun lancement de jeu comptabilisé/);
  assert.match(html, /—/);
  assert.doesNotMatch(html, />NaN</);
});
test("calendar uses real UTC days even around the Paris clock change", () => {
  assert.deepEqual(rangeDays(7,"2026-10-28"),[
    "2026-10-22","2026-10-23","2026-10-24","2026-10-25","2026-10-26","2026-10-27","2026-10-28"
  ]);
  assert.equal(rangeDays(90,"2026-10-28").length,90);
});
test("admin key, labels and diagnostic content are HTML escaped", () => {
  const html = renderStatsDashboard({...sample,
    adminKey:'bad" onfocus="steal()',
    labels: {"solo:daily":"<script>alert(1)</script>"},
    diagnosticRows:[{label:'<img src=x onerror=alert(1)>',values:[1],total:1}]
  });
  assert.match(html, /&quot; onfocus=&quot;steal/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
});
test("stats route keeps access control, does not touch gameplay and excludes today from comparison", () => {
  const server = fs.readFileSync(require("node:path").join(__dirname,"../server.js"),"utf8");
  const a=server.indexOf('app.get("/admin/stats"'),b=server.indexOf("\n});",a);
  const route=server.slice(a,b);
  assert.match(route,/ADMIN_STATS_KEY/);
  assert.match(route,/return res\.status\(403\)/);
  assert.match(route,/Date\.parse\(usageMetrics\.utcDay\(\)/);
  assert.match(route,/usageMetrics\.recent\(pgPool, days, end\)/);
  assert.doesNotMatch(route,/INSERT INTO|UPDATE\s+\w+|DELETE FROM/);
});
